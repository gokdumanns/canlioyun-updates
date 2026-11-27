// Süper Hipodrom 3D — 7 Geniş Kulvar + Koşan Tribün Seyircileri + 3B Sabotaj Fırlatma + Adil Yarış Sırası.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loop, Roster, Sound, clamp, lerp, rand, pick, hash } from '@sdk/kit.js';
import { createRacer, createHalayTrio, LANES } from './horse.js';
import { createLobbyChaos } from './lobby-chaos.js';
import { createStadium } from './stadium.js';
import { createSpectators } from './spectators.js';
import { createHudRenderer } from './hud.js';

const W = 1080, H = 1920, LANE_W = 3.05;
const DEFAULT_NAMES = ['Şimşek', 'Alev', 'Kral', 'Rüzgar', 'Fırtına', 'Yıldız', 'Gölge'];

// Dengeli hız, sabotaj & bağışıklık sabitleri (bkz. .agents/skills/tiktok-game-balance/SKILL.md)
const BAL = {
  baseSpeed: 8.4,
  maxSpeed: 16.5,          // ~1.96× tavan: fark aşırı açılmaz
  maxBoostVel: 4.5,        // beğeni/havuç anlık ivme tavanı
  modBonus: { flame: 1.9, pegasus: 2.5, lightning: 3.1, unicorn: 4.2 },
  modCap:   { flame: 6.0, pegasus: 7.5, lightning: 8.0, unicorn: 9.0 },
  standBonus: 0.85,
  standCap: 7.0,
  lassoPullDist: 5.5,
  lassoDur: 1.45,
  lassoImmuneSec: 5.5,
  tomatoDur: 2.2,
  tomatoImmuneSec: 3.5,
  mudDur: 2.2,
  mudImmuneSec: 4.5,
  honeyDur: 2.5,
  honeyImmuneSec: 5.0,
  freezeSpeedFactor: 0.42,
  freezeImmuneSec: 6.5,
};

export default async function createGame(ctx) {
  const sound = new Sound();
  let settings = { ...ctx.settings };
  let rules = ctx.rules || [];

  // ---------- Three.js Render + Güvenli GPU / Post-Processing Desteği ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    renderer = new THREE.WebGLRenderer({ antialias: false });
  }
  const gl = renderer.getContext();
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  const glName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'yok');
  const isSoftGpu = /swiftshader|basic render|llvmpipe|software/i.test(String(glName || ''));
  ctx.log(`WebGL: ${glName}${isSoftGpu ? ' [YAZILIM MODU]' : ''}`);
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ctx.log('WebGL: CONTEXT LOST!'); });

  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = !isSoftGpu;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  ctx.root.appendChild(renderer.domElement);

  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = W; hudCanvas.height = H;
  hudCanvas.style.pointerEvents = 'none';
  ctx.root.appendChild(hudCanvas);
  // Hot-update ile toast konumunu doğrudan oyun içinden sağ hediye paneline uyumlu ayarla (.exe kurmadan!)
  const toastsEl = document.getElementById('toasts');
  const prevToastCss = toastsEl ? toastsEl.style.cssText : '';
  if (toastsEl) {
    toastsEl.style.top = '612px';
    toastsEl.style.left = '16px';
    toastsEl.style.right = '306px';
  }
  const hud = createHudRenderer(hudCanvas);
  const actionsMap = new Map((ctx.manifest.actions || []).map((a) => [a.id, a]));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14142b');
  scene.fog = new THREE.Fog('#1c1936', 55, 190);
  let pmrem = null;
  if (!isSoftGpu) {
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      envScene.dispose();
      scene.environmentIntensity = 0.55;
    } catch (e) { ctx.log('PMREM atlandı:', e.message); }
  }

  const camera = new THREE.PerspectiveCamera(60, W / H, 0.5, 360);
  camera.position.set(0, 7.8, 36);
  const camLook = new THREE.Vector3(0, 2.0, 0.5);
  camera.lookAt(camLook);

  scene.add(new THREE.HemisphereLight('#9fb8ff', '#3a2214', isSoftGpu ? 1.15 : 0.85));
  const sun = new THREE.DirectionalLight('#ffd39b', 2.4);
  sun.position.set(22, 34, 18);
  sun.castShadow = !isSoftGpu;
  sun.shadow.mapSize.set(isSoftGpu ? 1024 : 2048, isSoftGpu ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const sc = 38;
  Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 4, far: 145 });
  scene.add(sun, sun.target);

  const rim = new THREE.DirectionalLight('#6eb8ff', 0.9);
  rim.position.set(-20, 18, -26);
  scene.add(rim);

  let composer = null;
  if (!isSoftGpu) {
    try {
      // WebGL2 4× MSAA render target: EffectComposer kullanırken pikselli/tırtıklı kenarları tamamen yok eder!
      const maxSamples = Math.min(4, renderer.capabilities.maxSamples || 0);
      const rt = new THREE.WebGLRenderTarget(W, H, {
        type: THREE.HalfFloatType,
        samples: maxSamples,
      });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.34, 0.5, 1.05));
      composer.addPass(new OutputPass());
    } catch (e) { composer = null; ctx.log('Bloom atlandı:', e.message); }
  }

  // ---------- Yarış, Sıra & Tribün Seyirci Durumu ----------
  const roster = new Roster({ max: 600, idle: 1800, idleGifter: 3600 });
  const ruleFlash = new Map();
  const userStats = new Map(); // userId → { followed, likes, gifted, gender }
  const raceQueue = [];        // [{ user, preferredLane, vip, joinedAt }]
  let stadium = null;
  let spectators = null;
  let halayTrio = null;
  let lobbyChaos = null;
  let racers = [];
  let time = 0, round = 1, phase = 'countdown', phaseT = 0, winner = null;
  let dailyTop = (ctx.leaderboard && ctx.leaderboard.top) || [];
  const speak = (text, opts = {}) => { if (ctx.ui && typeof ctx.ui.speak === 'function') ctx.ui.speak(text, opts); };
  let champId = null, champStreak = 0;
  let camShake = 0, fireworkT = 0, victoryHalayT = 0;
  const VICTORY_SEC = 8.5;
  let cdStep = 0, hoofT = 0, leaderLane = -1, lastOvertakeT = 0, finalBellRung = false;
  let swoop = { active: false, lane: 0, t: 0, dur: 4.0, side: 1, nextAt: 9.0, seq: 0 };

  const laneCount = () => clamp(Number(settings.laneCount) || 7, 5, 7);
  const trackLen = () => clamp(Number(settings.trackLength) || 420, 220, 700);
  const play = (fn) => { if (settings.sound) try { fn(); } catch { /* sessiz */ } };
  const isDemo = (id) => String(id || '').startsWith('demo_');

  // ---- Güçlü Anadolu Davul & Zurna Halay Sentezi (hot-update ile v1.1.3+ istemcilerde anında çalışır!) ----
  let lastDavulAt = 0, lastZurnaAt = 0;
  function playDavulHalay({ force = false } = {}) {
    const now = performance.now();
    if (!force && now - lastDavulAt < 550) return;
    lastDavulAt = now;
    const ac = sound.ac();
    const out = typeof sound.out === 'function' ? sound.out() : sound.master;
    const t0 = ac.currentTime + 0.01;
    const step = 0.14; // ~142 BPM coşkulu Anadolu halay davulu (2 ölçü = 3.36 sn)
    const hitDum = (off, v = 0.64) => {
      const t = t0 + off;
      // 1) Göğüs titreten büyük tokmak bas vuruşu
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(128, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.27);
      // 2) Ahşap kasnak + deri gövde vuruşu
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(195, t);
      o2.frequency.exponentialRampToValueAtTime(72, t + 0.09);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(v * 0.42, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o2.connect(g2).connect(out);
      o2.start(t); o2.stop(t + 0.12);
      sound.noise(0.085, { filter: 'bandpass', freq: 270, q: 1.4, vol: v * 0.48, delay: off });
    };
    const hitTek = (off, v = 0.28) => {
      // İnce çubuk şaklaması (yüksek deri + ahşap tık)
      sound.noise(0.055, { filter: 'bandpass', freq: 2900, q: 2.2, vol: v, delay: off });
      sound.tone(860, 0.04, { type: 'triangle', vol: v * 0.62, slide: -480, delay: off });
    };
    for (let bar = 0; bar < 2; bar++) {
      const b = bar * 12 * step;
      hitDum(b + 0, 0.66);
      hitTek(b + step * 1, 0.26); hitTek(b + step * 1.5, 0.22);
      hitDum(b + step * 2, 0.56);
      hitTek(b + step * 3, 0.28);
      hitDum(b + step * 4, 0.66);
      hitDum(b + step * 5, 0.58);
      hitTek(b + step * 6, 0.30); hitTek(b + step * 6.5, 0.24);
      hitDum(b + step * 7, 0.64);
      hitTek(b + step * 8, 0.28);
      hitDum(b + step * 9, 0.62);
      hitTek(b + step * 10, 0.28); hitTek(b + step * 10.5, 0.24);
      if (bar === 1) { hitDum(b + step * 11, 0.68); hitDum(b + step * 11.5, 0.60); }
      else hitDum(b + step * 11, 0.64);
    }
  }

  function playZurnaHalay({ force = false } = {}) {
    const now = performance.now();
    if (!force && now - lastZurnaAt < 650) return;
    lastZurnaAt = now;
    const ac = sound.ac();
    const out = typeof sound.out === 'function' ? sound.out() : sound.master;
    const t0 = ac.currentTime + 0.01;
    const s = 0.14; // Davul ile tam senkronize 142 BPM Hicaz Halay melodisi (3.36 sn)
    // Hicaz makamı düğün/halay ezgisi: D5(587.3) Eb5(622.3) F#5(740) G5(784) A5(880) Bb5(932.3) C5(523.3)
    const notes = [
      // 1. Ölçü: yükselip inen klasik halay girişi
      [587.3, 0 * s, 1.0 * s], [740.0, 1.0 * s, 1.0 * s], [784.0, 2.0 * s, 1.5 * s], [740.0, 3.5 * s, 0.5 * s],
      [622.3, 4.0 * s, 1.0 * s], [740.0, 5.0 * s, 1.0 * s], [587.3, 6.0 * s, 1.5 * s], [523.3, 7.5 * s, 0.5 * s],
      [587.3, 8.0 * s, 1.0 * s], [622.3, 9.0 * s, 1.0 * s], [740.0, 10.0 * s, 1.0 * s], [587.3, 11.0 * s, 1.0 * s],
      // 2. Ölçü: coşkulu tiz halay zirvesi + karar sesi!
      [740.0, 12.0 * s, 1.0 * s], [784.0, 13.0 * s, 1.0 * s], [880.0, 14.0 * s, 1.5 * s], [932.3, 15.5 * s, 0.5 * s],
      [880.0, 16.0 * s, 1.0 * s], [784.0, 17.0 * s, 1.0 * s], [740.0, 18.0 * s, 1.5 * s], [622.3, 19.5 * s, 0.5 * s],
      [740.0, 20.0 * s, 0.75 * s], [622.3, 20.75 * s, 0.75 * s], [587.3, 21.5 * s, 2.3 * s],
    ];
    // Gerçek çift kamışlı Anadolu zurnası: 2 detuned sawtooth + alt kamış buzz + güçlü nazal peaking formantlar!
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), oReed = ac.createOscillator();
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    const mix = ac.createGain(), reedG = ac.createGain();
    const hp = ac.createBiquadFilter(), pk1 = ac.createBiquadFilter(), pk2 = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
    const env = ac.createGain();

    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o2.detune.value = 9; // canlı akort zenginliği
    oReed.type = 'square';
    reedG.gain.value = 0.16;

    lfo.frequency.value = 7.2; // hızlı düğün zurnası vibratosu
    lfoG.gain.value = 12;
    lfo.connect(lfoG);
    lfoG.connect(o1.frequency);
    lfoG.connect(o2.frequency);

    hp.type = 'highpass'; hp.frequency.value = 390; hp.Q.value = 0.7;
    pk1.type = 'peaking'; pk1.frequency.value = 1380; pk1.Q.value = 2.0; pk1.gain.value = 10.5;
    pk2.type = 'peaking'; pk2.frequency.value = 2650; pk2.Q.value = 2.4; pk2.gain.value = 7.5;
    lp.type = 'lowpass'; lp.frequency.value = 4500; lp.Q.value = 0.9;

    o1.connect(mix);
    o2.connect(mix);
    oReed.connect(reedG).connect(mix);
    mix.gain.value = 0.52;
    mix.connect(hp).connect(pk1).connect(pk2).connect(lp).connect(env).connect(out);

    env.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < notes.length; i++) {
      const [freq, off, dur] = notes[i];
      const t = t0 + off;
      // Anadolu zurna çarpması (hızlı alt notadan kayarak giriş!)
      o1.frequency.setValueAtTime(freq * 0.955, t);
      o1.frequency.exponentialRampToValueAtTime(freq, t + 0.022);
      o2.frequency.setValueAtTime(freq * 0.955, t);
      o2.frequency.exponentialRampToValueAtTime(freq, t + 0.022);
      oReed.frequency.setValueAtTime(freq * 0.5, t);

      if (i === 0) {
        env.gain.linearRampToValueAtTime(0.34, t + 0.025);
      } else {
        // Sürekli nefes (dairesel nefes tekniği — notalar arası kesilmeden vurgu verir!)
        env.gain.setValueAtTime(0.22, t);
        env.gain.linearRampToValueAtTime(0.35, t + 0.018);
      }
      if (i === notes.length - 1) {
        env.gain.setValueAtTime(0.34, t + Math.max(0.05, dur - 0.14));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      }
    }
    const endT = t0 + 24 * s + 0.08;
    o1.start(t0); o2.start(t0); oReed.start(t0); lfo.start(t0);
    o1.stop(endT); o2.stop(endT); oReed.stop(endT); lfo.stop(endT);
  }

  function playVictoryHalay() {
    playDavulHalay({ force: true });
    playZurnaHalay({ force: true });
  }

  let lastHitAt = 0, lastJetAt = 0;
  function playBrawlHit() {
    const now = performance.now();
    if (now - lastHitAt < 220) return;
    lastHitAt = now;
    sound.tone(175, 0.09, { type: 'triangle', vol: 0.24, slide: -110 });
    sound.noise(0.06, { filter: 'bandpass', freq: 950, q: 1.5, vol: 0.16 });
  }
  function playJetWhoosh() {
    const now = performance.now();
    if (now - lastJetAt < 1800) return;
    lastJetAt = now;
    const ac = sound.ac();
    const out = typeof sound.out === 'function' ? sound.out() : sound.master;
    const t0 = ac.currentTime;
    const src = ac.createBufferSource();
    const len = Math.floor(ac.sampleRate * 1.4);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 1.6;
    flt.frequency.setValueAtTime(1650, t0);
    flt.frequency.exponentialRampToValueAtTime(320, t0 + 1.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.24, t0 + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
    src.connect(flt).connect(g).connect(out);
    src.start(t0); src.stop(t0 + 1.38);
  }

  function statOf(userId) {
    let s = userStats.get(userId);
    if (!s) { s = { followed: false, likes: 0, likeReward25: 0, likeReward75: 0, gifted: false, gender: null }; userStats.set(userId, s); }
    return s;
  }

  // 9:16 dikey ekranda 7 kulvar + her iki yandaki koşan seyirci teraslarını BOLCA kadraja sığdıran mesafe
  const laneCamDist = () => {
    const trackW = laneCount() * LANE_W;
    const halfHFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (W / H));
    return (trackW / 2 + 5.6) / Math.tan(halfHFov);
  };

  // ---------- 3B Halat / Kement (Lasso) Sistemi ----------
  const activeLassos = [];
  const lassoRopeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 8, 1);
  const lassoLoopGeo = new THREE.TorusGeometry(0.95, 0.12, 10, 24);
  const lassoRopeMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9e00, emissiveIntensity: 2.2, roughness: 0.28 });
  const lassoUp = new THREE.Vector3(0, 1, 0);
  const lassoA = new THREE.Vector3(), lassoB = new THREE.Vector3(), lassoDir = new THREE.Vector3(), lassoMid = new THREE.Vector3();

  function clearLassos() {
    for (const l of activeLassos) { scene.remove(l.ropeMesh); scene.remove(l.loopMesh); }
    activeLassos.length = 0;
  }

  function spawnLasso(anchorObj, target, pullMeters = BAL.lassoPullDist) {
    const ropeMesh = new THREE.Mesh(lassoRopeGeo, lassoRopeMat);
    const loopMesh = new THREE.Mesh(lassoLoopGeo, lassoRopeMat);
    scene.add(ropeMesh, loopMesh);
    activeLassos.push({ anchorObj, target, t: 0, dur: BAL.lassoDur, pullMeters, ropeMesh, loopMesh });
  }

  function updateLassos(dt) {
    for (let i = activeLassos.length - 1; i >= 0; i--) {
      const l = activeLassos[i];
      l.t += dt;
      if (l.t >= l.dur) {
        scene.remove(l.ropeMesh); scene.remove(l.loopMesh);
        activeLassos.splice(i, 1);
        continue;
      }
      if (l.t > 0.18) {
        const pullStep = (l.pullMeters / (l.dur - 0.18)) * dt;
        l.target.z = Math.max(0, l.target.z - pullStep);
        l.target.speed = Math.min(l.target.speed, BAL.baseSpeed * 0.72);
        l.target.visual.group.position.z = l.target.z;
        if (Math.random() < 0.45) stadium.burst(l.target.x, 0.45, l.target.z + 0.5, 0xffd166, 2, 4.5);
      }
      l.anchorObj.getWorldPosition(lassoA);
      l.target.visual.bodyRoot.getWorldPosition(lassoB);
      lassoB.y += 1.72;
      const extend = clamp(l.t / 0.18, 0.15, 1);
      lassoB.lerpVectors(lassoA, lassoB, extend);
      lassoDir.subVectors(lassoB, lassoA);
      const dist = Math.max(0.2, lassoDir.length());
      lassoMid.addVectors(lassoA, lassoB).multiplyScalar(0.5);
      l.ropeMesh.position.copy(lassoMid);
      l.ropeMesh.scale.set(1, dist, 1);
      l.ropeMesh.quaternion.setFromUnitVectors(lassoUp, lassoDir.normalize());
      l.loopMesh.visible = extend >= 0.95;
      l.loopMesh.position.set(l.target.x, l.target.visual.bodyRoot.position.y + 1.65, l.target.z + 0.25);
      l.loopMesh.rotation.set(Math.PI * 0.42, l.t * 9, Math.sin(l.t * 14) * 0.2);
      const tighten = 1.15 - clamp((l.t - 0.18) / (l.dur - 0.18), 0, 1) * 0.35;
      l.loopMesh.scale.setScalar(tighten);
    }
  }

  // ---------- Dünya & Kulvar İnşası ----------
  function buildWorld() {
    clearLassos();
    if (lobbyChaos) lobbyChaos.dispose();
    if (halayTrio) halayTrio.dispose();
    if (spectators) spectators.dispose();
    if (stadium) stadium.dispose();
    for (const r of racers) scene.remove(r.visual.group);

    const n = laneCount(), len = trackLen();
    stadium = createStadium(scene, { laneCount: n, laneWidth: LANE_W, trackLength: len });
    if (settings.randomEvents !== false) stadium.populateTrackProps();
    spectators = createSpectators(scene, {
      trackW: n * LANE_W,
      trackLength: len,
      onBurst: (x, y, z, hex, c, spd) => stadium.burst(x, y, z, hex, c, spd),
    });
    halayTrio = createHalayTrio(scene);
    lobbyChaos = createLobbyChaos(scene, {
      onBurst: (x, y, z, hex, c, spd) => stadium.burst(x, y, z, hex, c, spd),
      onHit: () => play(() => playBrawlHit()),
      onBoom: () => play(() => sound.explosion(false)),
      onFirework: () => play(() => sound.firework()),
      onJet: () => play(() => playJetWhoosh()),
    });

    racers = Array.from({ length: n }, (_, i) => {
      const visual = createRacer(i);
      const x = stadium.laneX(i);
      visual.group.position.set(x, 0, 0);
      scene.add(visual.group);
      const gender = i % 2 ? 'f' : 'm';
      visual.jockey.setGender(gender);
      return {
        lane: i, x, z: 0, speed: 0, baseSpeed: BAL.baseSpeed + rand(-0.28, 0.28), boostVel: 0,
        jockeyId: null, nick: DEFAULT_NAMES[i] || `At ${i + 1}`, avatar: '', gender, wins: 0,
        supporters: new Set(),
        mods: { flame: 0, pegasus: 0, lightning: 0, unicorn: 0 },
        frozen: 0, freezeImmuneUntil: 0, slowUntil: 0,
        tomatoUntil: 0, tomatoImmuneUntil: 0,
        mudImmuneUntil: 0,
        honeyUntil: 0, honeyImmuneUntil: 0,
        likeBoostUntil: 0, joinedFlashUntil: 0, lastSeen: 0,
        standUntil: 0, davulUntil: 0, zurnaUntil: 0, spinT: 0, lassoImmuneUntil: 0, pulledUntil: 0, _sb: 0,
        animPh: rand(0, 6), trailT: 0,
        visual,
      };
    });
    spectators.syncQueue(raceQueue);
    syncRacerVisibility();
    startCountdown();
  }

  const allowBots = () => settings.allowBots === true;
  const isRacerActive = (r) => allowBots() || (!!r.jockeyId && !isDemo(r.jockeyId));
  const getActiveRacers = () => racers.filter(isRacerActive);

  function syncRacerVisibility() {
    for (const r of racers) r.visual.group.visible = isRacerActive(r);
  }

  function startCountdown() {
    clearLassos();
    if (halayTrio) halayTrio.hide();
    spectators.resetPositions();
    syncRacerVisibility();
    const activeCount = getActiveRacers().length;
    // Botlar kapalıysa ve sahada henüz 2'den az gerçek oyuncu varsa lobide bekle (kavgacı böcekler & savaş uçakları şov yapsın!)
    phase = (!allowBots() && activeCount < 2) ? 'lobby' : 'countdown';
    if (lobbyChaos) { if (phase === 'lobby') lobbyChaos.show(); else lobbyChaos.hide(); }
    phaseT = 0; cdStep = 0; winner = null;
    swoop.active = false; swoop.nextAt = 9.0;
    leaderLane = -1; finalBellRung = false;
    stadium.setGatesOpen(false, true);
    for (const r of racers) {
      r.z = 0; r.speed = 0; r.boostVel = 0;
      // Her yeni koşuda taban hızı sıfırdan karıştır & destekçi birikimini sıfırla (hep aynı kulvar kazanmasın!)
      r.baseSpeed = BAL.baseSpeed + rand(-0.16, 0.16);
      r.supporters.clear();
      if (r.jockeyId && !isDemo(r.jockeyId)) r.supporters.add(r.jockeyId);
      r.frozen = 0; r.freezeImmuneUntil = 0; r.slowUntil = 0;
      r.tomatoUntil = 0; r.tomatoImmuneUntil = 0; r.mudImmuneUntil = 0;
      r.honeyUntil = 0; r.honeyImmuneUntil = 0; r.likeBoostUntil = 0;
      r.standUntil = 0; r.davulUntil = 0; r.zurnaUntil = 0; r.spinT = 0; r.lassoImmuneUntil = 0; r.pulledUntil = 0; r._sb = 0;
      r.mods.flame = r.mods.pegasus = r.mods.lightning = r.mods.unicorn = 0;
      r.visual.group.position.set(r.x, 0, 0);
    }
    if (phase === 'countdown') play(() => sound.trumpet());
  }

  buildWorld();

  // ---------- Yarışçı Koltuğu, Katılım Koşulu & Sıra Yönetimi ----------
  const findRacerByUser = (userId) => racers.find((r) => r.jockeyId === userId) || null;
  const isSeatOpenFor = (r, userId) => !r.jockeyId || (!isDemo(userId) && isDemo(r.jockeyId));

  function isQualified(user, { vip = false } = {}) {
    if (vip || isDemo(user.id)) return true;
    const mode = settings.joinCondition || 'easy';
    if (mode === 'easy') return true;
    const st = statOf(user.id);
    if (mode === 'vip') return st.followed || st.gifted;
    // 'engage': Takip Et veya 10+ Beğeni veya Hediye
    return st.followed || st.gifted || st.likes >= 10;
  }

  function conditionHint() {
    const mode = settings.joinCondition || 'easy';
    if (mode === 'vip') return 'takip et veya hediye gönder';
    if (mode === 'engage') return 'takip et veya 10 beğeni at';
    return '"katıl" veya 1–7 yaz';
  }

  function seatOnLane(user, laneIdx, { announce = true } = {}) {
    const idx = clamp(laneIdx, 0, racers.length - 1);
    const r = racers[idx];
    const p = roster.touch(user);
    const st = statOf(user.id);
    // Başka kulvardaysa eskisini boşalt
    for (const o of racers) {
      if (o.jockeyId === user.id && o.lane !== idx) {
        o.jockeyId = null; o.nick = DEFAULT_NAMES[o.lane] || `At ${o.lane + 1}`;
      }
    }
    // Sıradaysa çıkar ve tribün seyirci yuvasını serbest bırak
    const qi = raceQueue.findIndex((q) => q.user.id === user.id);
    if (qi >= 0) raceQueue.splice(qi, 1);
    spectators.removeUser(user.id);
    spectators.syncQueue(raceQueue);

    const wasHidden = !r.visual.group.visible;
    const gender = st.gender || (p && p.gender) || (hash(user.id) % 2 ? 'f' : 'm');
    st.gender = gender;
    if (p) { p.lane = idx; p.gender = gender; }
    r.jockeyId = user.id;
    r.nick = user.nick;
    r.avatar = user.avatar || '';
    r.gender = gender;
    r.lastSeen = time;
    r.visual.jockey.setGender(gender);
    if (!isDemo(user.id)) { r.supporters.add(user.id); r.joinedFlashUntil = time + 4.5; }
    syncRacerVisibility();
    // Botlar kapalıyken yarış ortasında boş kulvara yeni oyuncu girerse paketin hemen arkasından koşuya katılsın!
    if (phase === 'race' && wasHidden) {
      const others = getActiveRacers().filter((o) => o.lane !== idx);
      const tail = others.length ? Math.min(...others.map((o) => o.z)) : 0;
      r.z = Math.max(0, tail - 1.0);
      r.speed = BAL.baseSpeed;
      r.visual.group.position.set(r.x, 0, r.z);
    }
    r.boostVel = Math.min(BAL.maxBoostVel, r.boostVel + 1.4);
    stadium.burst(r.x, 2.2, r.z, LANES[idx].hex, 16, 7);
    if (announce && !isDemo(user.id)) {
      ctx.ui.toast(`✅ ${user.nick} → ${idx + 1}. KULVARA BİNDİN! (${LANES[idx].name})`, { color: '#19e6a8', duration: 2200 });
      play(() => sound.pop());
    }
    // Lobideyken 2. gerçek oyuncu geldiği an kavgayı bitirip geri sayımı başlat!
    if (phase === 'lobby' && getActiveRacers().length >= 2) {
      if (lobbyChaos) lobbyChaos.hide();
      phase = 'countdown'; phaseT = 0; cdStep = 0;
      play(() => sound.trumpet());
    }
    return r;
  }

  const AFK_EVICT_SEC = 55; // 55 sn hiç etkileşim vermeyen (yayından çıkan) oyuncunun koltuğu yeni gelene açılır!
  const ROUND_AFK_SEC = 75; // Tur arasında 75 sn'dir pasif olan oyuncular otomatik indirilir.

  function tryJoinRace(user, preferredLane = null, { vip = false, announce = true } = {}) {
    if (!user || !user.id) return null;
    if (isDemo(user.id) && !allowBots()) return null;
    roster.touch(user);
    const existing = findRacerByUser(user.id);
    if (existing) {
      existing.lastSeen = time;
      if (preferredLane != null) {
        const targetIdx = clamp(preferredLane, 0, racers.length - 1);
        if (targetIdx !== existing.lane && isSeatOpenFor(racers[targetIdx], user.id)) {
          return seatOnLane(user, targetIdx, { announce });
        }
      }
      existing.boostVel = Math.min(BAL.maxBoostVel, existing.boostVel + 1.0);
      existing.joinedFlashUntil = time + 2.5;
      if (announce && !isDemo(user.id)) {
        ctx.ui.toast(`🏇 ${user.nick} zaten ${existing.lane + 1}. kulvardasın! (+Hız)`, { color: LANES[existing.lane].css, duration: 1800 });
      }
      return existing;
    }

    // 1) Katılım koşulunu kontrol et
    if (!isQualified(user, { vip })) {
      spectators.ensureUser(user);
      if (announce && !isDemo(user.id)) {
        ctx.ui.toast(`🎟️ ${user.nick} tribünde! Yarışa girmek için ${conditionHint()}`, { color: '#ffd166', duration: 2200 });
      }
      return null;
    }

    // 2) Zafer anındayken (phase === 'win') koltukları bozmadan doğrudan sonraki koşu sırasına al!
    if (phase !== 'win') {
      if (preferredLane != null) {
        const idx = clamp(preferredLane, 0, racers.length - 1);
        if (isSeatOpenFor(racers[idx], user.id)) return seatOnLane(user, idx, { announce });
      }
      const openSeat = racers.find((r) => isSeatOpenFor(r, user.id));
      if (openSeat) return seatOnLane(user, openSeat.lane, { announce });

      // 2B) Tüm 7 at doluysa: yayından çıkıp gitmiş (55 sn+ pasif / AFK) oyuncu varsa onun koltuğunu yeni gelene ver!
      if (!isDemo(user.id)) {
        const afkList = racers
          .filter((r) => r.jockeyId && !isDemo(r.jockeyId) && time - (r.lastSeen || 0) > AFK_EVICT_SEC)
          .sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0));
        if (afkList.length) {
          const victim = afkList[0];
          spectators.ensureUser({ id: victim.jockeyId, nick: victim.nick, avatar: victim.avatar });
          victim.jockeyId = null;
          return seatOnLane(user, victim.lane, { announce });
        }
      }
    }

    // 3) Tüm 7 at gerçek oyuncularla dolu → Sıraya al ve tribünde koşmaya başlat!
    if (isDemo(user.id)) {
      // Demo botu gerçek kuyruğu şişirmesin, sadece tribünde koşsun
      spectators.ensureUser(user);
      return null;
    }
    let idx = raceQueue.findIndex((q) => q.user.id === user.id);
    const alreadyInQueue = idx >= 0;
    if (alreadyInQueue) {
      const entry = raceQueue[idx];
      entry.joinedAt = time;
      if (preferredLane != null) entry.preferredLane = preferredLane;
      if (vip && !entry.vip) {
        entry.vip = true;
        raceQueue.splice(idx, 1);
        const insertAt = raceQueue.findIndex((q) => !q.vip);
        if (insertAt < 0) raceQueue.push(entry); else raceQueue.splice(insertAt, 0, entry);
      }
    } else {
      const entry = { user: { id: user.id, nick: user.nick, avatar: user.avatar || '' }, preferredLane, vip: !!vip, joinedAt: time };
      if (vip) {
        const insertAt = raceQueue.findIndex((q) => !q.vip);
        if (insertAt < 0) raceQueue.push(entry); else raceQueue.splice(insertAt, 0, entry);
      } else {
        raceQueue.push(entry);
      }
    }
    spectators.syncQueue(raceQueue);
    const pos = raceQueue.findIndex((q) => q.user.id === user.id) + 1;
    if (announce) {
      play(() => sound.queueChime());
      const msg = alreadyInQueue
        ? `🎟️ ${user.nick} zaten sıradasın! (Sıra #${pos} · Sonraki koşuda atın hazır)`
        : `✅ ${user.nick} SONRAKİ KOŞUYA ALINDIN! (Sıra #${pos}${vip ? ' ⭐VIP' : ''})`;
      ctx.ui.toast(msg, { color: '#19e6a8', duration: 2400 });
    }
    return null;
  }

  function resetRace() {
    round++;
    if (settings.randomEvents !== false) stadium.populateTrackProps();

    // 1) Kuyruktaki 3 dk+ eski (yayından ayrılmış) kayıtları temizle
    for (let i = raceQueue.length - 1; i >= 0; i--) {
      if (time - (raceQueue[i].joinedAt || 0) > 180) raceQueue.splice(i, 1);
    }

    // 2) Tur arasında yayından çıkmış / 75 sn'dir hiç etkileşim vermemiş AFK oyuncuları attan indir!
    for (const r of racers) {
      if (r.jockeyId && !isDemo(r.jockeyId) && time - (r.lastSeen || 0) > ROUND_AFK_SEC) {
        spectators.removeUser(r.jockeyId);
        r.jockeyId = null;
        r.nick = DEFAULT_NAMES[r.lane] || `At ${r.lane + 1}`;
        r.supporters.clear();
      }
    }

    // 3) Şampiyonu (aktifse ve en fazla 2 tur üst üste) koltukta tut, sıradan gelenleri yeni koşuya bindir!
    const keepChamp = winner && winner.jockeyId && !isDemo(winner.jockeyId) && champStreak < 2 ? winner : null;
    const prevRacers = racers
      .filter((r) => r.jockeyId && !isDemo(r.jockeyId))
      .map((r) => ({ id: r.jockeyId, nick: r.nick, avatar: r.avatar, lastSeen: r.lastSeen || time }));

    if (raceQueue.length > 0) {
      for (const r of racers) {
        if (keepChamp && r.lane === keepChamp.lane) continue;
        if (r.jockeyId && !isDemo(r.jockeyId)) {
          spectators.ensureUser({ id: r.jockeyId, nick: r.nick, avatar: r.avatar });
        }
        r.jockeyId = null;
        r.nick = DEFAULT_NAMES[r.lane] || `At ${r.lane + 1}`;
        r.supporters.clear();
      }
      let mounted = 0;
      while (raceQueue.length > 0) {
        const open = racers.find((r) => !r.jockeyId);
        if (!open) break;
        const next = raceQueue.shift();
        const pref = next.preferredLane != null ? clamp(next.preferredLane, 0, racers.length - 1) : null;
        const lane = pref != null && !racers[pref].jockeyId ? pref : open.lane;
        seatOnLane(next.user, lane, { announce: false });
        mounted++;
      }
      // Hâlâ boş koltuk kaldıysa aktif olan önceki yarışçılardan geri doldur (AFK sayacını koruyarak)
      for (const pr of prevRacers) {
        if (findRacerByUser(pr.id)) continue;
        const open = racers.find((r) => !r.jockeyId);
        if (!open) break;
        const seated = seatOnLane({ id: pr.id, nick: pr.nick, avatar: pr.avatar }, open.lane, { announce: false });
        if (seated) seated.lastSeen = pr.lastSeen;
      }
      spectators.syncQueue(raceQueue);
      if (mounted > 0) {
        ctx.ui.toast(`🎟️ Sıradan ${mounted} izleyici yeni koşuda ata bindi!`, { color: '#25f4ee', duration: 2400 });
      }
    }
    startCountdown();
  }

  // ---------- Akışkan Drone Yakın Çekim & Skill / Şov Ortalama ----------
  function triggerSwoop(lane, dur = 3.8, kind = 'jockey', { force = false } = {}) {
    if (phase !== 'race') return;
    const mode = settings.cameraMode || 'auto';
    const isHero = kind === 'skill' || kind === 'show';
    // Skill/Şov odaklaması 'auto' ve 'chase' modlarında çalışır; sadece 'front' modunda devre dışı kalır
    if (isHero) {
      if (mode === 'front') return;
    } else if (mode !== 'auto') {
      return;
    }
    if (!force && swoop.active) return;
    const len = trackLen();
    const leadZ = Math.max(...racers.map((r) => r.z));
    if (leadZ > len - (isHero ? 18 : 50)) return;
    swoop.active = true;
    swoop.kind = kind;
    swoop.lane = clamp(lane, 0, racers.length - 1);
    swoop.t = 0;
    swoop.dur = dur;
    swoop.side = racers[swoop.lane].x >= 0 ? 1 : -1;
    swoop.nextAt = phaseT + dur + 7.5;
  }

  function focusOn(lane, sec = 3.8, kind = 'skill') {
    // Skill (arkadan kahraman takip) veya Şov (önden-çapraz davul/zurna/kıyafet vitrini) anında ortalar!
    triggerSwoop(lane, Math.max(3.2, sec), kind, { force: true });
  }

  // ---------- Lobi (Maç öncesi pistte böcek kavgası + patlamalar + havai fişek + alçaktan savaş uçakları!) ----------
  function updateLobby(dt) {
    for (const r of getActiveRacers()) r.visual.updateVisual(dt, time, { ...r, speed: 1.6 });
    spectators.update(dt, time, 6, false);
    if (lobbyChaos) {
      lobbyChaos.show();
      const sh = lobbyChaos.update(dt, time);
      if (sh > camShake) camShake = sh;
    }
    const desX = Math.sin(time * 0.42) * 2.5;
    const desY = 5.4 + (laneCount() - 5) * 0.32;
    const desZ = 24.8 + (laneCount() - 5) * 1.1;
    camera.position.lerp(new THREE.Vector3(desX, desY, desZ), Math.min(1, dt * 3.5));
    camLook.lerp(new THREE.Vector3(0, 3.2, 7.6), Math.min(1, dt * 4));
    if (camShake > 0.02) {
      camera.position.x += rand(-camShake, camShake);
      camera.position.y += rand(-camShake, camShake);
      camShake = Math.max(0, camShake - dt * 1.9);
    }
    camera.lookAt(camLook);
    // Botlar açıldıysa veya 2+ gerçek oyuncu geldiyse kavgayı bitirip hemen geri sayıma geç!
    if (allowBots() || getActiveRacers().length >= 2) {
      if (lobbyChaos) lobbyChaos.hide();
      phase = 'countdown'; phaseT = 0; cdStep = 0;
      play(() => sound.trumpet());
    }
  }

  // ---------- Geri Sayım ----------
  function updateCountdown(dt) {
    const active = getActiveRacers();
    for (const r of active) r.visual.updateVisual(dt, time, { ...r, speed: 2.2 });
    spectators.update(dt, time, 2, false);

    if (phaseT >= 0.9 && cdStep === 0) { cdStep = 1; play(() => sound.countdownBeep(false)); }
    if (phaseT >= 1.55 && cdStep === 1) { cdStep = 2; play(() => sound.countdownBeep(false)); }
    if (phaseT >= 2.2 && cdStep === 2) { cdStep = 3; play(() => sound.countdownBeep(false)); }

    const d0 = laneCamDist();
    const desX = Math.sin(phaseT * 0.7) * 1.6;
    const desY = 5.6 + (laneCount() - 5) * 0.4;
    const desZ = 22.5 + (laneCount() - 5) * 1.4;
    camera.position.lerp(new THREE.Vector3(desX, desY, desZ), Math.min(1, dt * 4));
    camLook.lerp(new THREE.Vector3(0, 2.2, 1.2), Math.min(1, dt * 5));
    camera.lookAt(camLook);

    if (phaseT >= 2.85) {
      phase = 'race'; phaseT = 0;
      stadium.setGatesOpen(true, false);
      camShake = 0.4;
      if (settings.cameraMode !== 'front') {
        camera.position.set(0, 9.6 + (laneCount() - 5) * 0.45, -(d0 * 0.56));
        camLook.set(0, 2.4, 14);
      }
      play(() => { sound.gateBell(true); sound.neigh(); sound.crowdCheer(false); });
      for (const r of active) {
        r.speed = BAL.baseSpeed; r.boostVel = 2.6 + rand(0, 1.4);
        stadium.burst(r.x, 0.6, 1.0, 0xc2956b, 12, 7);
      }
      ctx.ui.toast(`🔔 KAPILAR AÇILDI! ${active.length} AT YARIŞA BAŞLADI!`, { color: '#ffd166', duration: 2000 });
      speak(pick([
        'Kapılar açıldı, dev yarış başladı!',
        'Ve start verildi, böcekler fırladı!',
        'Yarış başladı, kemerleri bağlayın!',
      ]), { kind: 'announcer' });
    }
  }

  // ---------- Yarış Fiziği & Kamera ----------
  function updateRace(dt) {
    const active = getActiveRacers();
    if (!active.length) { phase = 'lobby'; phaseT = 0; return; }
    const len = trackLen();
    const sorted = [...active].sort((a, b) => b.z - a.z);
    const lead = sorted[0];
    const leadZ = lead.z;
    const tailZ = sorted[sorted.length - 1].z;
    const midZ = lerp(tailZ, leadZ, 0.48);
    const nearFinish = leadZ > len - 60;

    hoofT -= dt;
    if (hoofT <= 0) {
      hoofT = clamp(0.58 - lead.speed * 0.011, 0.38, 0.58);
      play(() => sound.hoof(0.24));
    }

    if (leadZ > 28 && lead.lane !== leaderLane) {
      if (leaderLane >= 0 && time - lastOvertakeT > 4.5) {
        lastOvertakeT = time;
        play(() => { sound.overtake(); sound.crowdCheer(false); if (Math.random() < 0.45) sound.neigh(); });
        ctx.ui.toast(`🔥 YENİ LİDER: ${lead.nick}!`, { color: LANES[lead.lane].css, duration: 2000 });
        speak(pick([
          `Vay vay vay, ${lead.nick} öne fırladı!`,
          `Yeni lider ${lead.nick}, ortalık kızıştı!`,
          `${lead.nick} liderliği kaptı gidiyor!`,
        ]), { kind: 'announcer' });
      }
      leaderLane = lead.lane;
    }

    if (!finalBellRung && nearFinish) {
      finalBellRung = true;
      play(() => { sound.gateBell(false); sound.crowdCheer(true); });
      ctx.ui.toast('🏁 SON DÜZLÜK! HIZLANIN!', { color: '#ff3b5c', duration: 2400 });
      speak(`Son düzlük! ${lead.nick} önde, nefesler tutuldu!`, { kind: 'announcer', priority: 'high' });
    }
    if (nearFinish) {
      const finProg = clamp((leadZ - (len - 60)) / 60, 0, 1);
      const pulseGap = lerp(0.68, 0.34, finProg);
      if (time - (updateRace._lastPulse || 0) >= pulseGap) {
        updateRace._lastPulse = time;
        play(() => sound.tensionPulse(finProg));
      }
    }

    for (const r of active) {
      const isFlame = time < r.mods.flame;
      const isPegasus = time < r.mods.pegasus;
      const isLightning = time < r.mods.lightning;
      const isUnicorn = time < r.mods.unicorn;
      const isFrozen = time < r.frozen;
      const isSlow = time < r.slowUntil && !isPegasus;
      const isTomato = time < r.tomatoUntil;
      const isHoney = time < r.honeyUntil && !isPegasus;
      const isStanding = time < r.standUntil;
      const isLikeBoost = time < r.likeBoostUntil;
      if (r.spinT > 0) r.spinT = Math.max(0, r.spinT - dt);

      const gap = leadZ - r.z;
      const finishFade = clamp((len - 45 - leadZ) / 30, 0, 1);
      const catchup = (clamp((gap - 3.5) * 0.28, 0, 6.2) + (gap > 16 ? (gap - 16) * 0.45 : 0)) * finishFade;
      const crowdBonus = Math.min(0.7, r.supporters.size * 0.14);

      const activeBonuses = [];
      if (isFlame) activeBonuses.push(BAL.modBonus.flame);
      if (isPegasus) activeBonuses.push(BAL.modBonus.pegasus);
      if (isLightning) activeBonuses.push(BAL.modBonus.lightning);
      if (isUnicorn) activeBonuses.push(BAL.modBonus.unicorn);
      activeBonuses.sort((a, b) => b - a);
      let modSpd = 0;
      activeBonuses.forEach((b, i) => { modSpd += i === 0 ? b : b * 0.3; });

      let targetSpd = r.baseSpeed + crowdBonus + catchup + modSpd + (isStanding ? BAL.standBonus : 0) + (isLikeBoost ? 1.15 : 0) + Math.sin(time * 1.3 + r.lane * 2.1 + round * 1.9) * 0.65;
      if (isTomato) targetSpd *= 0.82;
      if (isSlow) targetSpd *= 0.74;
      if (isHoney) targetSpd *= 0.68;
      if (isFrozen) targetSpd = BAL.baseSpeed * BAL.freezeSpeedFactor;

      r.boostVel *= Math.exp(-dt * 2.4);
      const desired = clamp(targetSpd + r.boostVel, 2.2, BAL.maxSpeed);
      r.speed += (desired - r.speed) * Math.min(1, dt * 4.5);
      r.z += r.speed * dt;
      r.visual.group.position.set(r.x, 0, r.z);
      r.visual.updateVisual(dt, time, r);

      r.trailT -= dt;
      if (r.trailT <= 0) {
        r.trailT = isFlame || isUnicorn || isLightning ? 0.05 : 0.16;
        const pCol = isUnicorn ? pick([0xff3b5c, 0xffd166, 0x22d07a, 0x25f4ee, 0xb55cff])
          : isFlame ? 0xff5400 : isLightning ? 0x25f4ee : isPegasus ? 0xffe599 : isTomato ? 0xff2438 : isHoney ? 0xffb703 : 0xba8b60;
        stadium.burst(r.x + rand(-0.4, 0.4), isPegasus ? 1.8 : 0.25, r.z - 1.3, pCol, 2, 3.0);
      }

      for (const p of stadium.props) {
        if (!p.active || p.lane !== r.lane) continue;
        if (Math.abs(p.z - r.z) < 2.2) {
          if (p.kind === 'carrot') {
            p.active = false; p.mesh.visible = false;
            r.boostVel = Math.min(BAL.maxBoostVel, r.boostVel + 4.2);
            stadium.burst(r.x, 1.8, r.z, 0xffd166, 20, 9);
            play(() => { sound.chest(); sound.neigh(); });
            ctx.ui.toast(`🥕 ${r.nick} Altın Havuç kaptı!`, { color: '#ffd166', duration: 1900 });
          } else if (p.kind === 'boost') {
            p.active = false; p.mesh.visible = false;
            r.boostVel = Math.min(BAL.maxBoostVel, r.boostVel + 4.6);
            stadium.burst(r.x, 0.8, r.z, 0x25f4ee, 18, 9);
            play(() => sound.whoosh());
          } else if (p.kind === 'banana' && !isPegasus) {
            p.active = false; p.mesh.visible = false;
            r.spinT = 0.78;
            r.slowUntil = Math.max(r.slowUntil, time + 1.35);
            stadium.burst(r.x, 1.4, r.z, 0xffe135, 22, 8);
            play(() => sound.slip());
            ctx.ui.toast(`🍌 ${r.nick} muz kabuğunda kaydı!`, { color: '#ffd166', duration: 1900 });
          } else if (p.kind === 'honey' && !isPegasus) {
            p.active = false; p.mesh.visible = false;
            r.honeyUntil = Math.max(r.honeyUntil, time + 2.0);
            stadium.burst(r.x, 0.8, r.z, 0xffb703, 18, 6);
            play(() => sound.splat());
          } else if (p.kind === 'mud' && !isPegasus) {
            p.active = false;
            r.slowUntil = Math.max(r.slowUntil, time + 1.8);
            stadium.burst(r.x, 0.5, r.z, 0x4a2e1a, 14, 6);
            play(() => sound.mudSplash());
          }
        }
      }

      if (r.z >= len && phase === 'race') {
        clearLassos();
        phase = 'win'; phaseT = 0; winner = r; r.wins++;
        if (r.jockeyId && r.jockeyId === champId) champStreak++;
        else { champId = r.jockeyId; champStreak = 1; }
        if (r.jockeyId && !isDemo(r.jockeyId) && typeof ctx.recordWin === 'function') {
          ctx.recordWin({ id: r.jockeyId, nick: r.nick, avatar: r.avatar || '' });
        }
        // Maç bitti: İlk 3 böceği bitiş sahnesinde 1. - 2. - 3. dizip anında HALAY'a başlat!
        const top3 = [...active].sort((a, b) => b.z - a.z).slice(0, 3);
        const halayZ = len + 4.8;
        if (halayTrio) halayTrio.setup(top3, halayZ);
        for (const x of racers) x.visual.group.visible = false;
        victoryHalayT = 3.35;
        camera.position.set(0, 5.5, halayZ + 16.4);
        camLook.set(0, 4.1, halayZ);
        camera.lookAt(camLook);
        play(() => { sound.crowdCheer(true); sound.coinShower(10, { big: true }); playVictoryHalay(); });
        camShake = 0.55;
        ctx.ui.toast(`🏆 ${r.nick} ŞAMPİYON! İLK 3 HALAY ÇEKİYOR! 💃🥁🎺`, { color: LANES[r.lane].css, duration: 5200 });
        speak(`Şampiyon ${r.nick}! Mendili kap, ilk üç halaya kalktı!`, { kind: 'announcer', priority: 'high' });
        break;
      }
    }

    updateLassos(dt);
    // Tribün seyircileri yarışla birlikte bitiş çizgisine kadar koşarak takip eder!
    spectators.update(dt, time, midZ, true);

    sun.position.set(22, 34, leadZ + 18);
    sun.target.position.set(0, 0, leadZ);
    sun.target.updateMatrixWorld();

    // Dinamik 9:16 Geniş Takip (7 kulvar + İKİ YANDAKİ KOŞAN SEYİRCİLER TAM KADRAJDA) + Drone Gir-Çık & Yan Tribün Açısı
    const spread = clamp(leadZ - tailZ, 0, 22);
    const baseDist = laneCamDist();
    const mode = settings.cameraMode || 'auto';

    if (mode === 'auto' && !nearFinish && !swoop.active && activeLassos.length === 0 && phaseT >= swoop.nextAt) {
      const activeList = getActiveRacers();
      const humans = activeList.filter((r) => r.jockeyId && !isDemo(r.jockeyId));
      const pool = humans.length ? humans : activeList;
      if (pool.length) {
        const step = swoop.seq++;
        // Seyirci varsa her 2 geçişte bir çapraz yan tribün açısına geç, yoksa jokey yakın çekimi yap
        const kind = step % 2 === 1 && spectators.countNamed() > 0 ? 'sideline' : 'jockey';
        const pickR = pool[step % pool.length];
        triggerSwoop(pickR.lane, kind === 'sideline' ? 4.2 : 3.6, kind);
      }
    }

    // Sinematik TV Yarış Kamerası: Alçak-orta dinamik açı (7 kulvarın tamamı + koşan seyirciler + büyük atlar tek kadrajda!)
    let desX = Math.sin(time * 0.22) * 0.9;
    let desY = (nearFinish ? 9.6 : 10.8) + spread * 0.14 + (laneCount() - 5) * 0.5;
    let desZ = tailZ - (baseDist * 0.68 + spread * 0.24);
    let lookX = 0, lookY = 2.5, lookZ = midZ + (nearFinish ? 14 : 11);
    let skillLock = false;

    if (mode === 'front') {
      desX = Math.sin(time * 0.4) * 1.6;
      desY = 7.4 + spread * 0.12;
      desZ = leadZ + baseDist * 0.68 + spread * 0.30;
      lookX = 0; lookY = 2.3; lookZ = midZ;
    } else if (swoop.active && racers[swoop.lane]) {
      swoop.t += dt;
      const u = clamp(swoop.t / swoop.dur, 0, 1);
      const isHero = swoop.kind === 'skill' || swoop.kind === 'show';
      const stopNearEnd = isHero ? leadZ > len - 14 : nearFinish;
      if (u >= 1 || stopNearEnd) {
        swoop.active = false;
      } else {
        const smoothstep = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
        if (swoop.kind === 'show') {
          // Şov / Davul / Zurna / Kıyafet açısı: Önden-çapraz vitrin açısı (enstrüman & yüz tam ortada net!)
          const w = u < 0.20 ? smoothstep(u / 0.20) : u > 0.80 ? smoothstep((1 - u) / 0.20) : 1;
          const fr = racers[swoop.lane];
          const showX = fr.x + swoop.side * 4.2;
          const showY = 4.1;
          const showZ = fr.z + 5.2;
          const arcOut = Math.sin(w * Math.PI) * swoop.side * 3.0;
          desX = lerp(desX, showX, w) + arcOut;
          desY = lerp(desY, showY, w);
          desZ = lerp(desZ, showZ, w);
          lookX = lerp(lookX, fr.x, w);
          lookY = lerp(lookY, 2.55, w);
          lookZ = lerp(lookZ, fr.z + 0.15, w);
          skillLock = w > 0.18;
        } else if (swoop.kind === 'skill') {
          // Güç / Hız skilli açısı (Pegasus / Unicorn / Ejderha / Alev): Alçak arkadan-çapraz kahraman takibi!
          const w = u < 0.18 ? smoothstep(u / 0.18) : u > 0.80 ? smoothstep((1 - u) / 0.20) : 1;
          const fr = racers[swoop.lane];
          const heroX = fr.x + swoop.side * 1.9;
          const heroY = 4.5;
          const heroZ = fr.z - 8.0;
          desX = lerp(desX, heroX, w);
          desY = lerp(desY, heroY, w);
          desZ = lerp(desZ, heroZ, w);
          lookX = lerp(lookX, fr.x, w);
          lookY = lerp(lookY, 2.5, w);
          lookZ = lerp(lookZ, fr.z + 2.8, w);
          skillLock = w > 0.18;
        } else if (swoop.kind === 'sideline') {
          // Pist içi kenar TV ray kamerası (asla çatıya/tribüne çarpmaz; koşan seyirciler + 7 at çapraz akıyor!)
          const w = u < 0.26 ? smoothstep(u / 0.26) : u > 0.74 ? smoothstep((1 - u) / 0.26) : 1;
          const sideSign = swoop.side;
          const sideX = sideSign * ((laneCount() * LANE_W) / 2 + 1.0);
          const sideY = 6.2;
          const sideZ = midZ - 13.5;
          desX = lerp(desX, sideX, w);
          desY = lerp(desY, sideY, w);
          desZ = lerp(desZ, sideZ, w);
          lookX = lerp(lookX, -sideSign * 1.5, w);
          lookY = lerp(lookY, 2.3, w);
          lookZ = lerp(lookZ, midZ + 10.5, w);
        } else {
          const w = u < 0.24 ? smoothstep(u / 0.24) : u > 0.76 ? smoothstep((1 - u) / 0.24) : 1;
          const fr = racers[swoop.lane];
          const closeX = fr.x + swoop.side * 2.1;
          const closeY = 4.7;
          const closeZ = fr.z - 8.6;
          desX = lerp(desX, closeX, w);
          desY = lerp(desY, closeY, w);
          desZ = lerp(desZ, closeZ, w);
          lookX = lerp(lookX, fr.x, w);
          lookY = lerp(lookY, 2.5, w);
          lookZ = lerp(lookZ, fr.z + 2.6, w);
        }
      }
    }

    const kPos = Math.min(1, dt * (skillLock ? 9.5 : swoop.active ? 6.0 : 4.6));
    const kLook = Math.min(1, dt * (skillLock ? 16.0 : swoop.active ? 9.0 : 5.2));
    camera.position.x = lerp(camera.position.x, desX, kPos);
    camera.position.y = lerp(camera.position.y, desY, kPos);
    camera.position.z = lerp(camera.position.z, desZ, kPos);
    camLook.x = lerp(camLook.x, lookX, kLook);
    camLook.y = lerp(camLook.y, lookY, kLook);
    camLook.z = lerp(camLook.z, lookZ, kLook);

    if (camShake > 0.02) {
      camera.position.x += rand(-camShake, camShake);
      camera.position.y += rand(-camShake, camShake);
      camShake = Math.max(0, camShake - dt * 1.8);
    }
    camera.lookAt(camLook);
  }

  function updateVictory(dt) {
    if (!winner) return;
    const halayZ = trackLen() + 4.8;
    if (halayTrio) halayTrio.update(time);
    spectators.update(dt, time, trackLen() - 2, false);

    // Yeni yarış başlayana kadar davul-zurna halay müziği kesintisiz devam etsin!
    victoryHalayT -= dt;
    if (victoryHalayT <= 0 && phaseT < VICTORY_SEC - 1.2) {
      victoryHalayT = 3.35;
      play(() => playVictoryHalay());
    }

    // 1., 2. ve 3. halay ekibini 9:16 dikey ekranda tam ortalayan kutlama kamerası
    const desX = Math.sin(phaseT * 0.72) * 1.45;
    const desY = 5.45 + Math.sin(phaseT * 1.8) * 0.22;
    const desZ = halayZ + 16.4;
    camera.position.lerp(new THREE.Vector3(desX, desY, desZ), Math.min(1, dt * 4.5));
    camLook.lerp(new THREE.Vector3(0, 4.1, halayZ), Math.min(1, dt * 5.5));
    camera.lookAt(camLook);

    fireworkT -= dt;
    if (fireworkT <= 0) {
      fireworkT = 0.72;
      stadium.burst(rand(-6.5, 6.5), rand(6.5, 11.5), halayZ + rand(-5, 1), pick([0xff3b5c, 0xffd166, 0x25f4ee, 0x22d07a, 0xb55cff]), 28, 12);
      play(() => sound.firework());
    }
    if (phaseT >= VICTORY_SEC) resetRace();
  }

  // ---------- Ana Döngü ----------
  const handle = loop((dt) => {
    time += dt; phaseT += dt;
    roster.update(dt);
    if (phase === 'lobby') updateLobby(dt);
    else if (phase === 'countdown') updateCountdown(dt);
    else if (phase === 'race') updateRace(dt);
    else updateVictory(dt);
    stadium.update(dt, time, camera.position.z);
    if (composer) {
      try { composer.render(); } catch (e) { composer = null; ctx.log('Composer fallback:', e.message); renderer.render(scene, camera); }
    } else {
      renderer.render(scene, camera);
    }
    const active = getActiveRacers();
    const sorted = [...active].sort((a, b) => b.z - a.z);
    hud.render({
      racers: active,
      sorted,
      spectators,
      camera,
      round,
      len: trackLen(),
      time,
      phase,
      phaseT,
      winner,
      champStreak,
      raceQueue,
      openSeats: racers.filter((r) => !r.jockeyId || isDemo(r.jockeyId)).length,
      spectatorCount: spectators.countNamed(),
      conditionHint: conditionHint(),
      laneCount: laneCount(),
      rules,
      actionsMap,
      ruleFlash,
      podiumItems: phase === 'win' && halayTrio ? halayTrio.getPodiumItems() : [],
      victorySec: VICTORY_SEC,
      dailyTop,
    });
  });

  // Hedef lider bulucu (atan yarışçıysa kendini vurmasın!)
  function pickLeadingTargets(senderRacer, count = 1) {
    const sorted = [...getActiveRacers()].sort((x, y) => y.z - x.z);
    const list = senderRacer ? sorted.filter((o) => o.lane !== senderRacer.lane) : sorted;
    return list.slice(0, count);
  }

  // ---------- Platform Kancaları ----------
  return {
    onEvent(ev) {
      if (!ev.user || (isDemo(ev.user.id) && !allowBots())) return;
      roster.touch(ev.user);
      const st = statOf(ev.user.id);
      if (ev.type === 'follow') st.followed = true;
      if (ev.type === 'like') st.likes += Number(ev.count) || 1;
      if (ev.type === 'gift') st.gifted = true;

      // Aktif yarışçının etkileşim zamanını güncelle (AFK takibi!)
      const activeR = findRacerByUser(ev.user.id);
      if (activeR && ev.type !== 'member') activeR.lastSeen = time;
      // Kuyruktaki kişi de aktifse sırası taze kalsın
      const qEntry = raceQueue.find((q) => q.user.id === ev.user.id);
      if (qEntry && ev.type !== 'member') qEntry.joinedAt = Math.max(qEntry.joinedAt, time - 5);

      if (phase === 'win') return;
      // ÖNEMLİ: Sadece yayından geçip giden (member) izleyiciler ASLA at koltuğu kapmasın — tribüne gelsin!
      // Yalnızca bizzat komut/katıl/1-7 yazan veya hediye/beğeni atan aktif izleyiciler ata biner.
      if (!activeR) {
        if (ev.type === 'member' || (ev.type === 'chat' && !ev.matched)) {
          if (!isDemo(ev.user.id) || allowBots()) spectators.ensureUser(ev.user);
        } else if (ev.type === 'follow' || ev.type === 'like' || ev.type === 'gift') {
          if (!isDemo(ev.user.id) || allowBots()) spectators.ensureUser(ev.user, { vip: ev.type === 'gift' });
        }
      }
    },
    onAction(a) {
      if (!a.user || (isDemo(a.user.id) && !allowBots())) return;
      if (a.rule && a.rule.id) ruleFlash.set(a.rule.id, time);
      const P = a.params || {};
      const st = statOf(a.user.id);
      const isGift = a.event && a.event.type === 'gift';
      if (isGift) st.gifted = true;

      // 1) Katılım / Sıra aksiyonları: ZAFER ANINDA (phase === 'win') BİLE çalışsın ki sonraki tura girenler asla kaçmasın!
      if (a.action === 'join_lane') {
        tryJoinRace(a.user, Number(P.lane) || 0, { vip: isGift, announce: !isDemo(a.user.id) });
        return;
      }
      if (a.action === 'join_queue') {
        tryJoinRace(a.user, null, { vip: isGift, announce: !isDemo(a.user.id) });
        return;
      }

      if (phase === 'win') return;

      let myRacer = findRacerByUser(a.user.id);

      // 2) Tribün Sabotaj Aksiyonları (7 at dolu olsa da seyirciler tribünden sahaya fırlatır!)
      if (a.action === 'throw_tomato') {
        const target = pickLeadingTargets(myRacer, 1)[0];
        if (!target) return;
        const sender = myRacer ? { ...a.user, _isRacer: true } : a.user;
        if (myRacer) myRacer.boostVel = Math.min(BAL.maxBoostVel, myRacer.boostVel + 1.2);
        play(() => sound.throwWhoosh());
        spectators.throwProjectile(sender, 'tomato', target, (hit) => {
          play(() => sound.splat());
          if (time >= hit.tomatoImmuneUntil) {
            hit.tomatoUntil = time + BAL.tomatoDur;
            hit.tomatoImmuneUntil = hit.tomatoUntil + BAL.tomatoImmuneSec;
          }
        });
        ctx.ui.toast(`🍅 ${a.user.nick} → ${target.nick}'a domates fırlattı!`, { color: '#ff4d6d', duration: 1900 });
        return;
      }

      if (a.action === 'throw_mud') {
        const target = pickLeadingTargets(myRacer, 1)[0];
        if (!target) return;
        const sender = myRacer ? { ...a.user, _isRacer: true } : a.user;
        if (isGift && !myRacer && !isDemo(a.user.id)) tryJoinRace(a.user, null, { vip: true, announce: false });
        play(() => sound.throwWhoosh());
        spectators.throwProjectile(sender, 'mud', target, (hit) => {
          play(() => sound.mudSplash());
          if (time >= hit.mudImmuneUntil && time >= hit.mods.pegasus) {
            hit.slowUntil = Math.max(hit.slowUntil, time + BAL.mudDur);
            hit.mudImmuneUntil = hit.slowUntil + BAL.mudImmuneSec;
          }
          stadium.spawnProp('mud', hit.lane, clamp(hit.z + 9, 8, trackLen() - 10));
        });
        ctx.ui.toast(`🟤 ${a.user.nick} → ${target.nick}'a çamur bombası attı!`, { color: '#d49a6a', duration: 2000 });
        return;
      }

      if (a.action === 'throw_honey') {
        const targets = pickLeadingTargets(myRacer, 2);
        if (!targets.length) return;
        const sender = myRacer ? { ...a.user, _isRacer: true } : a.user;
        play(() => sound.throwWhoosh());
        for (const t of targets) {
          spectators.throwProjectile(sender, 'honey', t, (hit) => {
            play(() => sound.splat());
            if (time >= hit.honeyImmuneUntil && time >= hit.mods.pegasus) {
              hit.honeyUntil = time + BAL.honeyDur;
              hit.honeyImmuneUntil = hit.honeyUntil + BAL.honeyImmuneSec;
            }
            stadium.spawnProp('honey', hit.lane, clamp(hit.z + 11, 10, trackLen() - 10));
          });
        }
        ctx.ui.toast(`🍯 ${a.user.nick} liderlere yapışkan bal tuzağı fırlattı!`, { color: '#ffd166', duration: 2100 });
        return;
      }

      if (a.action === 'banana') {
        const target = pickLeadingTargets(myRacer, 1)[0];
        if (!target) return;
        if (!myRacer) spectators.ensureUser(a.user, { icon: '🍌' });
        const bz = clamp(target.z + 15, 12, trackLen() - 12);
        stadium.spawnProp('banana', target.lane, bz);
        stadium.burst(target.x, 1.0, bz, 0xffe135, 12, 5);
        play(() => sound.pop());
        ctx.ui.toast(`🍌 ${a.user.nick} → ${target.nick}'ın önüne muz kabuğu attı!`, { color: '#ffd166', duration: 2000 });
        return;
      }

      if (a.action === 'lasso') {
        if (phase !== 'race') return;
        const target = pickLeadingTargets(myRacer, 1)[0];
        const pull = clamp(Number(P.pull) || BAL.lassoPullDist, 2.5, 8.5);
        if (isGift && !myRacer && !isDemo(a.user.id)) {
          myRacer = tryJoinRace(a.user, null, { vip: true, announce: false }) || findRacerByUser(a.user.id);
        }

        const activeList = getActiveRacers();
        if (!activeList.length) return;
        if (!target || time < target.lassoImmuneUntil) {
          const boostR = myRacer || [...activeList].sort((x, y) => x.z - y.z)[0];
          if (!boostR) return;
          boostR.standUntil = Math.min(time + BAL.standCap, Math.max(boostR.standUntil, time) + 3.5);
          boostR.boostVel = Math.min(BAL.maxBoostVel, boostR.boostVel + 2.8);
          stadium.burst(boostR.x, 3.0, boostR.z, 0xffd166, 22, 8);
          play(() => sound.lasso());
          ctx.ui.toast(`🤠 ${a.user.nick} kement şovuyla hızlandı!`, { color: '#ffd166', duration: 2000 });
        } else {
          const sp = myRacer ? null : spectators.ensureUser(a.user, { icon: '🤠', vip: isGift });
          const anchor = myRacer ? myRacer.visual.jockey.handAnchor : sp.visual.headAnchor;
          if (sp) sp.throwT = 1.1;
          target.lassoImmuneUntil = time + BAL.lassoDur + BAL.lassoImmuneSec;
          target.pulledUntil = time + BAL.lassoDur;
          spawnLasso(anchor, target, pull);
          if (myRacer) {
            myRacer.standUntil = Math.min(time + BAL.standCap, Math.max(myRacer.standUntil, time) + 2.4);
            myRacer.boostVel = Math.min(BAL.maxBoostVel, myRacer.boostVel + 3.4);
          } else {
            const chaser = [...activeList].sort((x, y) => y.z - x.z)[1];
            if (chaser) chaser.boostVel = Math.min(BAL.maxBoostVel, chaser.boostVel + 2.2);
          }
          camShake = 0.28;
          stadium.burst(target.x, 2.0, target.z, 0xffd166, 22, 9);
          play(() => { sound.lasso(); sound.coinShower(4); sound.neigh(); });
          swoop.active = false;
          swoop.nextAt = Math.max(swoop.nextAt, phaseT + 4.0);
          ctx.ui.toast(`🤠 ${a.user.nick} halatla ${target.nick}'ı geri çekti!`, { color: '#ffd166', duration: 2300 });
          speak(`${a.user.nick} halatı attı, ${target.nick} geri çekildi!`, { kind: 'gift' });
        }
        return;
      }

      // 3) Jokey & Modifiye Aksiyonları (boş koltuk varsa bin, doluysa VIP sıraya gir + desteklenen ata uygula!)
      if (!myRacer) {
        const open = racers.find((r) => isSeatOpenFor(r, a.user.id));
        if (open && isQualified(a.user, { vip: isGift })) {
          myRacer = seatOnLane(a.user, open.lane, { announce: false });
        } else {
          spectators.ensureUser(a.user, { vip: isGift });
          if (isGift && !isDemo(a.user.id)) tryJoinRace(a.user, null, { vip: true, announce: false });
          const activeList = getActiveRacers();
          if (!activeList.length) return;
          myRacer = activeList[hash(a.user.id) % activeList.length];
        }
      } else {
        myRacer.lastSeen = time;
      }

      const r = myRacer;
      const lane = LANES[r.lane];
      const addMod = (key, sec, times) => {
        const gain = sec * (1 + Math.min(times - 1, 5) * 0.25);
        r.mods[key] = Math.min(time + BAL.modCap[key], Math.max(r.mods[key], time) + gain);
      };
      const addBoost = (v) => { r.boostVel = Math.min(BAL.maxBoostVel, r.boostVel + v); };
      const tryFreeze = (target, sec) => {
        if (!target || time < target.freezeImmuneUntil) return false;
        target.frozen = Math.max(target.frozen, time) + sec;
        target.freezeImmuneUntil = target.frozen + BAL.freezeImmuneSec;
        stadium.burst(target.x, 2, target.z, 0x90e0ef, 24, 9);
        return true;
      };

      switch (a.action) {
        case 'set_gender': {
          const gen = P.gender === 'f' ? 'f' : 'm';
          st.gender = gen;
          const p = roster.touch(a.user); if (p) p.gender = gen;
          r.gender = gen; r.visual.jockey.setGender(gen);
          stadium.burst(r.x, 3.0, r.z, gen === 'f' ? 0xff5ca8 : 0x25f4ee, 18, 7);
          play(() => sound.pop());
          if (!isDemo(a.user.id)) focusOn(r.lane, 3.6, 'show');
          ctx.ui.toast(`${gen === 'f' ? '👗' : '🤠'} ${r.nick} kıyafet değiştirdi!`, { color: lane.css, duration: 1700 });
          break;
        }
        case 'cheer': {
          const isLike = a.event && a.event.type === 'like';
          const mul = Math.min(a.times || 1, 3);
          addBoost((1.1 + (Number(P.power) || 1) * 0.45) * mul);
          r.likeBoostUntil = Math.min(time + 3.6, Math.max(r.likeBoostUntil, time) + (isLike ? 1.6 : 1.2));
          stadium.burst(r.x, 1.35, r.z - 0.6, isLike ? 0xff4d8d : lane.hex, isLike ? 9 : 6, 5.5);
          if (isLike) play(() => sound.likeCombo());
          else if (Math.random() < 0.4) play(() => sound.whip());

          // Beğeni Ödül Basamakları: her 50 beğenide 🪽 PEGASUS KANATLARI, her 25 beğenide 🔥 ALEV TURBO!
          if (isLike && !isDemo(a.user.id)) {
            const tier50 = Math.floor(st.likes / 50);
            const tier25 = Math.floor(st.likes / 25);
            if (tier50 > (st.likeReward50 || 0)) {
              st.likeReward50 = tier50;
              st.likeReward25 = tier25;
              addMod('pegasus', 4.8, 1);
              addBoost(3.0);
              focusOn(r.lane, 3.6);
              stadium.burst(r.x, 2.5, r.z, 0xffe599, 28, 10);
              play(() => { sound.wingFlap(); sound.powerup(); sound.coinShower(8, { big: true }); });
              ctx.ui.toast(`🪽 ${a.user.nick} → PEGASUS KANATLARI AÇILDI!`, { color: '#ffd166', duration: 2200 });
              speak(`${a.user.nick} Pegasus kanatlarını açtı, uçuyor!`, { kind: 'announcer' });
            } else if (tier25 > st.likeReward25) {
              st.likeReward25 = tier25;
              addMod('flame', 2.8, 1);
              addBoost(2.6);
              stadium.burst(r.x, 2.0, r.z, 0xff5400, 20, 8);
              play(() => { sound.powerup(); sound.coinShower(5); });
              ctx.ui.toast(`🔥 ${a.user.nick} → ALEV TURBO AÇILDI!`, { color: '#ff6b86', duration: 1900 });
            }
          }
          break;
        }
        case 'stand_up': {
          const sec = clamp(Number(P.seconds) || 5, 2, 10);
          r.standUntil = Math.min(time + BAL.standCap, Math.max(r.standUntil, time) + sec);
          addBoost(0.9);
          stadium.burst(r.x, 3.2, r.z, 0xffd166, 18, 7);
          play(() => sound.crowdCheer(false));
          if (!isDemo(a.user.id)) focusOn(r.lane, 3.6, 'show');
          ctx.ui.toast(`🤸 ${r.nick} atın üstünde ayağa kalktı!`, { color: lane.css, duration: 1900 });
          break;
        }
        case 'play_davul': {
          const sec = clamp(Number(P.seconds) || 6.5, 3, 12);
          r.davulUntil = Math.min(time + 11, Math.max(r.davulUntil || 0, time) + sec);
          r.standUntil = Math.max(r.standUntil, r.davulUntil);
          addBoost(1.65);
          stadium.burst(r.x, 3.3, r.z, 0xffd166, 24, 8);
          play(() => playDavulHalay());
          if (!isDemo(a.user.id)) focusOn(r.lane, 4.0, 'show');
          ctx.ui.toast(`🥁 ${r.nick} atın üstünde DAVUL ÇALIYOR!`, { color: '#ffd166', duration: 2200 });
          speak(`${r.nick} atın üstünde davul şov yapıyor!`, { kind: 'announcer' });
          break;
        }
        case 'play_zurna': {
          const sec = clamp(Number(P.seconds) || 6.5, 3, 12);
          r.zurnaUntil = Math.min(time + 11, Math.max(r.zurnaUntil || 0, time) + sec);
          r.standUntil = Math.max(r.standUntil, r.zurnaUntil);
          addBoost(1.65);
          stadium.burst(r.x, 3.4, r.z, 0xff5ca8, 24, 8);
          play(() => playZurnaHalay());
          if (!isDemo(a.user.id)) focusOn(r.lane, 4.0, 'show');
          ctx.ui.toast(`🎺 ${r.nick} atın üstünde ZURNA ÇALIYOR!`, { color: '#ff5ca8', duration: 2200 });
          speak(`${r.nick} halay zurnasına üflüyor, coşku tavan!`, { kind: 'announcer' });
          break;
        }
        case 'mod_flame':
          addMod('flame', Number(P.seconds) || 4, a.times);
          addBoost(2.0);
          focusOn(r.lane, 3.6);
          stadium.burst(r.x, 2, r.z, 0xff5400, 24, 9);
          play(() => sound.flameRoar());
          ctx.ui.toast(`🔥 ${a.user.nick} → ALEV MODU!`, { color: '#ff5400', duration: 1900 });
          break;
        case 'mod_pegasus':
          addMod('pegasus', Number(P.seconds) || 5, a.times);
          addBoost(2.6);
          focusOn(r.lane, 3.8);
          stadium.burst(r.x, 2.5, r.z, 0xffe599, 28, 10);
          play(() => { sound.wingFlap(); sound.powerup(); });
          ctx.ui.toast(`🪽 ${a.user.nick} → PEGASUS KANATLARI!`, { color: '#ffd166', duration: 2100 });
          speak(`${a.user.nick} Pegasus açtı, havadan uçuyor!`, { kind: 'gift' });
          break;
        case 'mod_lightning': {
          addMod('lightning', Number(P.seconds) || 5, a.times);
          addBoost(3.0);
          const rival = pickLeadingTargets(r, 1)[0];
          const froze = tryFreeze(rival, 1.6);
          camShake = 0.35; focusOn(r.lane, 3.8);
          play(() => { sound.lightning(); if (froze) sound.iceFreeze(); });
          ctx.ui.toast(`⚡ ${a.user.nick} → YILDIRIM ZIRHI!`, { color: '#25f4ee', duration: 2100 });
          speak(`${a.user.nick} yıldırım indirdi!`, { kind: 'gift' });
          break;
        }
        case 'mod_unicorn':
          addMod('unicorn', Number(P.seconds) || 6, a.times);
          addBoost(3.8);
          camShake = 0.38; focusOn(r.lane, 4.0);
          stadium.burst(r.x, 2.6, r.z, 0xffd166, 34, 11);
          play(() => { sound.chest(); sound.neigh(); sound.crowdCheer(false); });
          ctx.ui.toast(`🦄 ${a.user.nick} → EFSANEVİ UNICORN!`, { color: '#ff85c2', duration: 2200 });
          speak(`${a.user.nick} efsanevi Unicorn ile roket gibi gidiyor!`, { kind: 'gift', priority: 'high' });
          break;
        case 'mod_dragon': {
          const sec = Number(P.seconds) || 7;
          addMod('flame', sec, a.times); addMod('pegasus', sec, a.times);
          addMod('lightning', sec, a.times); addMod('unicorn', sec, a.times);
          addBoost(4.5);
          for (const o of getActiveRacers()) if (o.lane !== r.lane) tryFreeze(o, 2.0);
          camShake = 0.65; focusOn(r.lane, 4.4);
          stadium.burst(r.x, 3, r.z, 0xff5400, 48, 13);
          play(() => { sound.explosion(true); sound.flameRoar(); sound.coinShower(10, { big: true }); sound.crowdCheer(true); });
          ctx.ui.toast(`🐉 ${a.user.nick} → EJDERHA KIYAMETİ!`, { color: '#ff3b5c', duration: 2600 });
          speak(`Aman Allahım! ${a.user.nick} Ejderha kıyametini indirdi, herkes dondu!`, { kind: 'gift', priority: 'high' });
          break;
        }
      }
    },
    onRules(next) { rules = next || []; },
    onLeaderboard(lb) { dailyTop = (lb && lb.top) || []; },
    onSettings(next) {
      const prevBots = allowBots();
      const rebuild = next.laneCount !== settings.laneCount || Number(next.trackLength) !== Number(settings.trackLength);
      settings = { ...next };
      const nowBots = allowBots();
      if (rebuild) buildWorld();
      else {
        if (prevBots && !nowBots) {
          let winnerCleared = false;
          for (const r of racers) {
            if (r.jockeyId && isDemo(r.jockeyId)) {
              if (winner && winner.lane === r.lane) winnerCleared = true;
              r.jockeyId = null;
              r.nick = DEFAULT_NAMES[r.lane] || `At ${r.lane + 1}`;
              r.supporters.clear();
            }
          }
          if (spectators) spectators.removeWhere(isDemo);
          syncRacerVisibility();
          if (phase === 'win' && winnerCleared) {
            resetRace();
          } else if (getActiveRacers().length < 2) {
            clearLassos();
            phase = 'lobby'; phaseT = 0;
            if (lobbyChaos) lobbyChaos.show();
          }
          ctx.ui.toast('🤖 Botlar kapatıldı — sadece gerçek izleyiciler yarışır!', { color: '#9fb0d0', duration: 2200 });
        } else {
          syncRacerVisibility();
          if (!prevBots && nowBots) {
            ctx.ui.toast('🤖 Botlar aktif edildi!', { color: '#25f4ee', duration: 2000 });
          }
          if (phase === 'lobby' && (nowBots || getActiveRacers().length >= 2)) {
            if (lobbyChaos) lobbyChaos.hide();
            phase = 'countdown'; phaseT = 0; cdStep = 0;
            play(() => sound.trumpet());
          }
        }
      }
    },
    destroy() {
      clearLassos();
      if (toastsEl) toastsEl.style.cssText = prevToastCss;
      if (lobbyChaos) lobbyChaos.dispose();
      if (halayTrio) halayTrio.dispose();
      if (spectators) spectators.dispose();
      if (stadium) stadium.dispose();
      lassoRopeGeo.dispose(); lassoLoopGeo.dispose(); lassoRopeMat.dispose();
      handle.stop(); sound.stopMusic(); if (pmrem) pmrem.dispose(); if (composer) composer.dispose(); renderer.dispose();
      renderer.domElement.remove(); hudCanvas.remove();
    },
  };
}
