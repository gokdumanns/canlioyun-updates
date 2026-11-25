// Sahil Böcekleri 3D — Akdeniz Akşamları: Dolunaylı sahilde kamp ateşi, gitarist, mangal şefi,
// semaver çaycı, darbukacı, denizde yüzenler, martı baskını, dev dalga, dilek fenerleri ve zabıta baskını!
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loop, Roster, Sound, clamp, lerp, rand, pick, hash } from '@sdk/kit.js';
import { createBeach } from './beach.js';
import { createBeachBug, createZabitaBug, ROLES } from './cockroach.js';
import { createBeachHud } from './hud.js';

const W = 1080, H = 1920;

// 4 VIP Başrolün sahnedeki konumları & bakış açıları
const ROLE_SPOTS = {
  guitar:  { x: -1.4, z: -3.2, lookAt: [0, 0, 1.5],  defaultNick: 'Gitarist Can' },
  darbuka: { x:  1.6, z: -3.1, lookAt: [0, 0, 1.5],  defaultNick: 'Ritimci Emre' },
  mangal:  { x:  4.9, z:  2.7, lookAt: [4.9, 0, 1.1], defaultNick: 'Mangalcı Usta' },
  tea:     { x:  4.5, z: -2.4, lookAt: [0, 0, 0],     defaultNick: 'Semaverci' },
};

const AMBIENT_NAMES = ['Akdeniz', 'Yakamoz', 'Közcü', 'Sahilci', 'Meltem', 'Poyraz', 'Dalgacı', 'Çekirdek'];

export default async function createGame(ctx) {
  const sound = new Sound();
  let settings = { ...ctx.settings };
  let rules = ctx.rules || [];

  // ---------- Three.js + Güvenli GPU / Bloom Desteği ----------
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
  renderer.toneMappingExposure = 1.06;
  ctx.root.appendChild(renderer.domElement);

  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = W; hudCanvas.height = H;
  hudCanvas.style.pointerEvents = 'none';
  ctx.root.appendChild(hudCanvas);
  const hud = createBeachHud(hudCanvas);
  const actionsMap = new Map((ctx.manifest.actions || []).map((a) => [a.id, a]));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070d1f');
  scene.fog = new THREE.Fog('#0c1730', 62, 185);
  let pmrem = null;
  if (!isSoftGpu) {
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      envScene.dispose();
      scene.environmentIntensity = 0.42;
    } catch (e) { ctx.log('PMREM atlandı:', e.message); }
  }

  const camera = new THREE.PerspectiveCamera(56, W / H, 0.5, 260);
  camera.position.set(0, 9.2, 23.5);
  const camLook = new THREE.Vector3(0, 2.2, -3.2);
  camera.lookAt(camLook);

  // Ay ışığı + serin deniz dolgu ışığı (merkezi ateş ışığı beach.js içinde dinamik!)
  scene.add(new THREE.HemisphereLight('#7aa7ff', '#2c1e16', isSoftGpu ? 0.9 : 0.62));
  const moonLight = new THREE.DirectionalLight('#b9d6ff', 1.25);
  moonLight.position.set(-10, 28, -32);
  moonLight.castShadow = !isSoftGpu;
  moonLight.shadow.mapSize.set(1024, 1024);
  scene.add(moonLight);

  let composer = null;
  if (!isSoftGpu) {
    try {
      const maxSamples = Math.min(4, renderer.capabilities.maxSamples || 0);
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: maxSamples });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.36, 0.55, 1.02));
      composer.addPass(new OutputPass());
    } catch (e) { composer = null; ctx.log('Bloom atlandı:', e.message); }
  }

  const beach = createBeach(scene);
  const zabita = createZabitaBug();
  scene.add(zabita.group);

  // ---------- Oyun Durumu ----------
  const roster = new Roster({ max: 600, idle: 1800, idleGifter: 3600 });
  const ruleFlash = new Map();
  const scores = new Map(); // userId → { nick, score }
  const bugs = [];          // 4 VIP + N sahil çemberi böceği
  const roleSlots = { guitar: null, mangal: null, tea: null, darbuka: null };
  const isDemo = (id) => String(id || '').startsWith('demo_');
  const play = (fn) => { if (settings.sound) try { fn(); } catch { /* sessiz */ } };
  const nightDur = () => clamp(Number(settings.nightDuration) || 90, 45, 180);
  const maxCrowd = () => clamp(Number(settings.maxCrowd) || 20, 12, 28);

  let time = 0, night = 1, nightT = 0;
  let vibe = 28; // %0..100 Keyif Metresi
  let fireLevel = 1.0, sucukCount = 6;
  let finale = false, finaleT = 0, nightKing = null, fireworkT = 0;
  let ambientWaveT = 3.5, ambientCrackleT = 1.8;
  let camShake = 0;
  let swoop = { active: false, target: new THREE.Vector3(), t: 0, dur: 3.6, side: 1, nextAt: 11 };
  let zabitaState = { active: false, t: 0, dur: 11, phase: 'march', caller: '' };

  // ---------- Sahil Böcek Yuvalarını Oluştur ----------
  function makeCircleSpot(idx, total) {
    // Ateş çemberinin sol + ön tarafına yayıl (sağdaki Mangal & Semaver istasyonunu hiç kapatmasın!)
    const ring = idx < 10 ? 0 : 1;
    const countInRing = ring === 0 ? Math.min(10, total) : Math.max(1, total - 10);
    const localIdx = ring === 0 ? idx : idx - 10;
    const angStart = 0.85;
    const angSpan = Math.PI * 1.18;
    const a = angStart + (localIdx / Math.max(1, countInRing - 1)) * angSpan;
    const rad = ring === 0 ? 3.85 : 5.75;
    return { x: Math.cos(a) * rad - 0.6, z: Math.sin(a) * rad + 0.5 };
  }

  function buildBugs() {
    for (const b of bugs) scene.remove(b.visual.group);
    bugs.length = 0;

    // 1) 4 VIP Başrol Yuvası
    const roleIds = ['guitar', 'mangal', 'tea', 'darbuka'];
    roleIds.forEach((roleId, i) => {
      const sp = ROLE_SPOTS[roleId];
      const visual = createBeachBug(i, 1.48);
      visual.group.position.set(sp.x, 0, sp.z);
      visual.group.lookAt(sp.lookAt[0], 0, sp.lookAt[2]);
      visual.setRole(roleId);
      scene.add(visual.group);
      const bug = {
        idx: i,
        role: roleId,
        userId: null,
        nick: sp.defaultNick,
        gender: i % 2 ? 'f' : 'm',
        baseX: sp.x, baseZ: sp.z,
        lookX: sp.lookAt[0], lookZ: sp.lookAt[2],
        swimming: false,
        protectedUntil: 0,
        lighterUntil: 0, tumbleUntil: 0, panicUntil: 0, soloUntil: 0,
        lastActive: 0,
        ph: rand(0, 6),
        visual,
      };
      visual.setGender(bug.gender);
      bugs.push(bug);
      roleSlots[roleId] = bug;
    });

    // 2) Ateş Çemberi Seyirci Yuvaları
    const total = maxCrowd();
    for (let i = 0; i < total; i++) {
      const pos = makeCircleSpot(i, total);
      const visual = createBeachBug(i + 4, 1.32);
      visual.group.position.set(pos.x, 0, pos.z);
      visual.group.lookAt(0, 0, 0);
      const roasting = i % 3 === 0;
      visual.setRole(null, { roasting, swimming: false });
      scene.add(visual.group);
      const ambient = i < 6;
      const bug = {
        idx: i + 4,
        role: null,
        userId: null,
        nick: ambient ? AMBIENT_NAMES[i % AMBIENT_NAMES.length] : '',
        gender: i % 2 ? 'f' : 'm',
        baseX: pos.x, baseZ: pos.z,
        lookX: 0, lookZ: 0,
        roasting,
        swimming: false,
        swimX: -5.5 + (i % 7) * 1.85,
        swimZ: -11.4 - (i % 3) * 1.4,
        protectedUntil: 0,
        lighterUntil: 0, tumbleUntil: 0, panicUntil: 0, soloUntil: 0,
        lastActive: 0,
        ph: rand(0, 6),
        visual,
      };
      visual.setGender(bug.gender);
      // Başta sadece 6 ortam böceği görünsün; izleyiciler geldikçe sahil dolsun!
      visual.group.visible = ambient;
      bugs.push(bug);
    }
  }

  buildBugs();

  // ---------- Kullanıcı & Rol Yönetimi ----------
  const findBug = (userId) => bugs.find((b) => b.userId === userId) || null;

  function addScore(user, pts) {
    if (!user || !user.id || isDemo(user.id)) return;
    const cur = scores.get(user.id) || { nick: user.nick, score: 0 };
    cur.nick = user.nick;
    cur.score += pts;
    scores.set(user.id, cur);
  }

  function addVibe(delta) {
    if (finale) return;
    vibe = clamp(vibe + delta, 0, 100);
    if (vibe >= 100) startFinale();
  }

  function ensureBeachBug(user, { announce = false } = {}) {
    if (!user || !user.id) return null;
    roster.touch(user);
    let b = findBug(user.id);
    if (b) { b.lastActive = time; b.nick = user.nick; return b; }

    // 1) Görünmez boş yuva, 2) İsimsiz ortam böceği, 3) Demo botu (gerçek kullanıcı ise), 4) En eski pasif çember böceği
    const circle = bugs.filter((x) => !x.role);
    b = circle.find((x) => !x.visual.group.visible)
      || circle.find((x) => !x.userId)
      || (!isDemo(user.id) && circle.find((x) => isDemo(x.userId)))
      || [...circle].sort((a, c) => a.lastActive - c.lastActive)[0];
    if (!b) return null;

    b.userId = user.id;
    b.nick = user.nick;
    b.gender = hash(user.id) % 2 ? 'f' : 'm';
    b.lastActive = time;
    b.swimming = false;
    b.visual.setGender(b.gender);
    b.visual.setRole(null, { roasting: b.roasting, swimming: false });
    b.visual.group.visible = true;
    b.visual.group.position.set(b.baseX, 0, b.baseZ);
    b.visual.group.lookAt(0, 0, 0);
    beach.burst(b.baseX, 1.4, b.baseZ, 0xffd166, 12, 5);
    if (announce && !isDemo(user.id)) {
      ctx.ui.toast(`🔥 ${user.nick} ateş başına oturdu!`, { color: '#ff9e2c', duration: 1800 });
      play(() => sound.pop());
    }
    return b;
  }

  function assignRole(user, roleId, { force = false, protectSec = 12, announce = true } = {}) {
    const slot = roleSlots[roleId];
    if (!slot || !user) return null;

    // Zaten bu roldeyse sadece korumayı yenile + solo patlat!
    if (slot.userId === user.id) {
      slot.protectedUntil = Math.max(slot.protectedUntil, time + protectSec);
      slot.soloUntil = time + 4.5;
      slot.lastActive = time;
      return slot;
    }

    // Denge koruması: mevcut sahibin koltuk koruması bitmediyse (ve hediye/force değilse) alma!
    const occupiedByReal = slot.userId && !isDemo(slot.userId);
    if (occupiedByReal && time < slot.protectedUntil && !force) {
      ensureBeachBug(user);
      if (announce && !isDemo(user.id)) {
        const rem = Math.ceil(slot.protectedUntil - time);
        ctx.ui.toast(`${ROLES[roleId].icon} ${slot.nick} koltuğu koruyor (${rem} sn kaldı)!`, { color: ROLES[roleId].css, duration: 1900 });
      }
      return null;
    }

    // Eski sahibi gerçek kullanıcıysa ateş çemberine nazikçe geçir (atılmaz!)
    const prevUser = occupiedByReal ? { id: slot.userId, nick: slot.nick } : null;

    // Yeni kullanıcı başka bir yuvadaysa orayı temizle
    const oldBug = findBug(user.id);
    if (oldBug && oldBug !== slot) {
      if (oldBug.role) {
        oldBug.userId = null;
        oldBug.nick = ROLE_SPOTS[oldBug.role].defaultNick;
        oldBug.protectedUntil = 0;
      } else {
        oldBug.userId = null;
        oldBug.nick = '';
        oldBug.visual.group.visible = false;
      }
    }

    slot.userId = user.id;
    slot.nick = user.nick;
    slot.gender = hash(user.id) % 2 ? 'f' : 'm';
    slot.visual.setGender(slot.gender);
    slot.protectedUntil = time + protectSec;
    slot.soloUntil = time + 5.0;
    slot.lastActive = time;
    beach.burst(slot.baseX, 2.0, slot.baseZ, ROLES[roleId].hex, 22, 7);

    if (prevUser) ensureBeachBug(prevUser, { announce: false });

    if (announce && !isDemo(user.id)) {
      const meta = ROLES[roleId];
      ctx.ui.toast(`${meta.icon} ${user.nick} artık ${meta.label}!`, { color: meta.css, duration: 2200 });
    }
    return slot;
  }

  function triggerSwoopTo(x, y, z, dur = 3.6) {
    if ((settings.cameraMode || 'auto') !== 'auto') return;
    swoop.active = true;
    swoop.target.set(x, y, z);
    swoop.t = 0;
    swoop.dur = dur;
    swoop.side = x >= 0 ? -1 : 1;
    swoop.nextAt = time + dur + 8.0;
  }

  function startFinale() {
    finale = true;
    finaleT = 0;
    fireLevel = 1.9;
    let best = null;
    for (const v of scores.values()) if (!best || v.score > best.score) best = v;
    nightKing = best;
    play(() => { sound.fanfare(); sound.crowdCheer(true); sound.strum(0); });
    for (let i = 0; i < 6; i++) beach.spawnLantern(best ? best.nick : '');
    ctx.ui.toast(`🎆 AKDENİZ ŞÖLENİ! ${best ? `Gecenin Kralı: ${best.nick}` : 'Herkes ışıkları kaldırsın!'}`, { color: '#f5c542', duration: 4200 });
  }

  function nextNight() {
    night++;
    nightT = 0;
    vibe = 24;
    fireLevel = 1.0;
    sucukCount = 6;
    beach.setSucukCount(6);
    finale = false;
    finaleT = 0;
    scores.clear();
    ctx.ui.toast(`🌙 ${night}. AKDENİZ GECESİ BAŞLADI!`, { color: '#25f4ee', duration: 2400 });
  }

  // ---------- Güncelleme Döngüsü ----------
  function updateScene(dt) {
    // Doğal ortam sesleri (hafif deniz dalgası + ateş çıtırtısı — YouTube müziğini boğmaz!)
    ambientWaveT -= dt;
    if (ambientWaveT <= 0) {
      ambientWaveT = rand(5.5, 9.5);
      play(() => sound.wave(false));
    }
    ambientCrackleT -= dt;
    if (ambientCrackleT <= 0) {
      ambientCrackleT = rand(2.5, 5.0);
      if (fireLevel > 0.7) play(() => sound.woodCrack());
    }

    // Ateş gücü yavaşça normale (0.95) döner
    fireLevel += (0.95 - fireLevel) * Math.min(1, dt * 0.25);

    if (finale) {
      finaleT += dt;
      fireworkT -= dt;
      if (fireworkT <= 0) {
        fireworkT = 0.65;
        beach.burst(rand(-8, 8), rand(7, 13), rand(-14, -4), pick([0xff4d6d, 0xf5c542, 0x25f4ee, 0x22d07a, 0xc77dff]), 26, 11, 8);
        play(() => sound.firework());
      }
      if (finaleT >= 9.0) nextNight();
    } else {
      nightT += dt;
      if (nightT >= nightDur()) startFinale();
    }

    // Zabıta Baskını ("Saat 12 oldu!" → 3.5 sn sonra Çaycı çay ikram eder → "BİZDEN ABİ!" oturup eğlenir!)
    if (zabitaState.active) {
      zabitaState.t += dt;
      const zt = zabitaState.t;
      if (zt >= zabitaState.dur) {
        zabitaState.active = false;
      } else if (zt < 3.6) {
        zabitaState.phase = 'march';
        const u = clamp(zt / 1.8, 0, 1);
        zabita.group.position.set(lerp(-11, -3.4, u), 0, lerp(6.5, 1.8, u));
        zabita.group.lookAt(0, 0, 0);
      } else {
        if (zabitaState.phase !== 'friendly') {
          zabitaState.phase = 'friendly';
          play(() => { sound.teaClink(); sound.crowdCheer(true); sound.strum(0); });
          beach.burst(-3.4, 2.5, 1.8, 0xf5c542, 34, 10);
          ctx.ui.toast('🫖 Çaycı çay uzattı — Zabıta: "BİZDEN ABİ!" deyip oturdu! 🔥', { color: '#f5c542', duration: 3000 });
        }
        zabita.group.position.set(-3.4, 0, 1.8);
        zabita.group.lookAt(0, 0, 0);
      }
    }
    zabita.update(dt, time, zabitaState);

    // Tüm böceklerin animasyonu ve konum geçişi (kumsal ↔ deniz)
    for (const b of bugs) {
      if (!b.visual.group.visible) continue;
      const tx = b.swimming ? b.swimX : b.baseX;
      const tz = b.swimming ? b.swimZ : b.baseZ;
      const ty = b.swimming ? -0.32 : 0;
      b.visual.group.position.x = lerp(b.visual.group.position.x, tx, Math.min(1, dt * 3.5));
      b.visual.group.position.z = lerp(b.visual.group.position.z, tz, Math.min(1, dt * 3.5));
      b.visual.group.position.y = lerp(b.visual.group.position.y, ty, Math.min(1, dt * 5));
      if (!b.swimming) b.visual.group.lookAt(b.lookX, 0, b.lookZ);
      else b.visual.group.lookAt(0, -0.32, 0);
      b.visual.updateVisual(dt, time, { ...b, celebration: finale });
    }

    beach.update(dt, time, fireLevel);

    // 9:16 Akışkan Sahil Drone Kamerası
    const mode = settings.cameraMode || 'auto';
    if (mode === 'auto' && !swoop.active && time >= swoop.nextAt && !finale) {
      const spotlightPool = Object.values(roleSlots).filter((r) => r && r.userId);
      const chosen = spotlightPool.length ? pick(spotlightPool) : roleSlots.guitar;
      triggerSwoopTo(chosen.baseX, 1.8, chosen.baseZ, 3.6);
    }

    let desX = Math.sin(time * 0.18) * (mode === 'fire' ? 0.6 : 2.6);
    let desY = mode === 'fire' ? 8.2 : 9.2 + Math.sin(time * 0.25) * 0.5;
    let desZ = mode === 'fire' ? 20.5 : 23.2;
    let lookX = 0, lookY = 2.3, lookZ = -3.0;

    if (swoop.active) {
      swoop.t += dt;
      const u = clamp(swoop.t / swoop.dur, 0, 1);
      if (u >= 1) {
        swoop.active = false;
      } else {
        const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
        const w = u < 0.26 ? smooth(u / 0.26) : u > 0.74 ? smooth((1 - u) / 0.26) : 1;
        const cx = swoop.target.x + swoop.side * 3.4;
        const cy = 4.2;
        const cz = swoop.target.z + 7.2;
        desX = lerp(desX, cx, w);
        desY = lerp(desY, cy, w);
        desZ = lerp(desZ, cz, w);
        lookX = lerp(lookX, swoop.target.x, w);
        lookY = lerp(lookY, swoop.target.y, w);
        lookZ = lerp(lookZ, swoop.target.z, w);
      }
    }

    const k = Math.min(1, dt * (swoop.active ? 4.8 : 2.8));
    camera.position.x = lerp(camera.position.x, desX, k);
    camera.position.y = lerp(camera.position.y, desY, k);
    camera.position.z = lerp(camera.position.z, desZ, k);
    camLook.x = lerp(camLook.x, lookX, k);
    camLook.y = lerp(camLook.y, lookY, k);
    camLook.z = lerp(camLook.z, lookZ, k);

    if (camShake > 0.02) {
      camera.position.x += rand(-camShake, camShake);
      camera.position.y += rand(-camShake, camShake);
      camShake = Math.max(0, camShake - dt * 1.6);
    }
    camera.lookAt(camLook);
  }

  // ---------- Ana Döngü ----------
  const handle = loop((dt) => {
    time += dt;
    roster.update(dt);
    updateScene(dt);
    if (composer) {
      try { composer.render(); } catch (e) { composer = null; ctx.log('Composer fallback:', e.message); renderer.render(scene, camera); }
    } else {
      renderer.render(scene, camera);
    }
    hud.render({
      night,
      time,
      remSec: Math.max(0, nightDur() - nightT),
      vibe,
      crowdCount: bugs.filter((b) => b.visual.group.visible).length,
      roleSlots,
      sucukCount,
      zabitaActive: zabitaState.active,
      bugs,
      zabita,
      zabitaState,
      lanterns: beach.lanterns,
      camera,
      rules,
      actionsMap,
      ruleFlash,
      finale,
      finaleT,
      nightKing,
    });
  });

  // ---------- Platform Kancaları ----------
  return {
    onEvent(ev) {
      if (!ev.user) return;
      roster.touch(ev.user);
      if (ev.type === 'member' || (ev.type === 'chat' && !ev.matched)) {
        if (!findBug(ev.user.id)) ensureBeachBug(ev.user, { announce: !isDemo(ev.user.id) });
      }
    },
    onAction(a) {
      if (!a.user) return;
      if (a.rule && a.rule.id) ruleFlash.set(a.rule.id, time);
      const P = a.params || {};
      const isGift = a.event && a.event.type === 'gift';

      switch (a.action) {
        case 'join_beach':
          ensureBeachBug(a.user, { announce: true });
          addScore(a.user, 2);
          break;

        case 'set_gender': {
          const b = ensureBeachBug(a.user);
          if (!b) return;
          const gen = P.gender === 'f' ? 'f' : 'm';
          b.gender = gen;
          b.visual.setGender(gen);
          beach.burst(b.visual.group.position.x, 2.0, b.visual.group.position.z, gen === 'f' ? 0xff66b3 : 0x25f4ee, 16, 6);
          play(() => sound.pop());
          ctx.ui.toast(`${gen === 'f' ? '👗' : '🕶️'} ${a.user.nick} sahil kıyafetini değiştirdi!`, { color: gen === 'f' ? '#ff66b3' : '#25f4ee', duration: 1800 });
          break;
        }

        case 'take_role': {
          const roleId = ROLES[P.role] ? P.role : 'guitar';
          const slot = assignRole(a.user, roleId, { force: isGift, protectSec: 12, announce: true });
          if (slot) {
            addScore(a.user, 8);
            addVibe(4);
            if (roleId === 'guitar') play(() => sound.strum(0));
            else if (roleId === 'mangal') play(() => sound.sizzle());
            else if (roleId === 'tea') play(() => sound.teaClink());
            else play(() => sound.pop());
            if (!isDemo(a.user.id)) triggerSwoopTo(slot.baseX, 1.8, slot.baseZ, 3.6);
          }
          break;
        }

        case 'stoke_fire': {
          ensureBeachBug(a.user);
          const pwr = clamp(Number(P.power) || 2, 1, 10) * Math.min(a.times || 1, 3);
          fireLevel = Math.min(2.1, fireLevel + 0.14 * pwr);
          addVibe(pwr * 1.1);
          addScore(a.user, pwr);
          beach.burst(0, 1.4, 0, 0xff9e2c, 10 + pwr * 2, 6.5, 4);
          play(() => sound.woodCrack());
          break;
        }

        case 'lighter': {
          const b = ensureBeachBug(a.user);
          if (!b) return;
          const sec = clamp(Number(P.seconds) || 10, 4, 20);
          b.lighterUntil = Math.max(b.lighterUntil, time) + sec;
          addVibe(2.5);
          addScore(a.user, 3);
          play(() => sound.strum());
          if (!isDemo(a.user.id)) ctx.ui.toast(`🔦 ${a.user.nick} ışıkları kaldırdı!`, { color: '#ffe082', duration: 1700 });
          break;
        }

        case 'swim': {
          const b = ensureBeachBug(a.user);
          if (!b || b.role) return;
          b.swimming = !b.swimming;
          b.visual.setRole(null, { roasting: b.roasting, swimming: b.swimming });
          play(() => sound.wave(false));
          beach.burst(b.swimming ? b.swimX : b.baseX, 0.8, b.swimming ? b.swimZ : b.baseZ, 0x25f4ee, 14, 6);
          if (!isDemo(a.user.id)) {
            ctx.ui.toast(b.swimming ? `🌊 ${a.user.nick} Akdeniz'e atladı!` : `🏖️ ${a.user.nick} ateş başına döndü!`, { color: '#25f4ee', duration: 1800 });
          }
          break;
        }

        case 'grill_sucuk': {
          ensureBeachBug(a.user);
          sucukCount = Math.min(6, sucukCount + 2);
          beach.setSucukCount(sucukCount);
          fireLevel = Math.min(2.2, fireLevel + 0.45);
          addVibe(5.5 * Math.min(a.times || 1, 3));
          addScore(a.user, 10 * Math.min(a.times || 1, 5));
          beach.burst(beach.mangalPos.x, 1.8, beach.mangalPos.z, 0xff6b35, 22, 7, 5);
          beach.burst(0, 1.8, 0, 0xffb703, 18, 7, 4);
          play(() => { sound.sizzle(); sound.woodCrack(); });
          ctx.ui.toast(`🌭 ${a.user.nick} mangala taze sucuk & odun attı!`, { color: '#ff9e2c', duration: 2000 });
          break;
        }

        case 'seagull_raid': {
          ensureBeachBug(a.user);
          addScore(a.user, 18);
          play(() => sound.seagull());
          beach.triggerSeagull(() => {
            sucukCount = Math.max(0, sucukCount - 1);
            beach.setSucukCount(sucukCount);
            play(() => sound.seagull());
            addVibe(-4);
          });
          swoop.active = false;
          swoop.nextAt = Math.max(swoop.nextAt, time + 5.5); // martının gökyüzünden mangala pike yapışı geniş sahilde tam görünsün!
          ctx.ui.toast(`🐦 ${a.user.nick} MARTI GÖNDERDİ! Mangaldaki sucuğu kaptı!`, { color: '#ff5268', duration: 2400 });
          break;
        }

        case 'big_wave': {
          ensureBeachBug(a.user);
          addScore(a.user, 35);
          play(() => sound.wave(true));
          beach.triggerWave(() => {
            fireLevel = 0.35;
            camShake = 0.42;
            addVibe(-7);
            for (const b of bugs) if (b.visual.group.visible && !b.swimming) b.tumbleUntil = time + 2.4;
            beach.burst(0, 1.5, 0, 0xe0faff, 34, 9, 10);
          });
          swoop.active = false;
          swoop.nextAt = Math.max(swoop.nextAt, time + 6.0); // dev dalga tüm sahilde tam görünsün!
          ctx.ui.toast(`🌊 ${a.user.nick} DEV DALGA GÖNDERDİ! Herkes sırılsıklam!`, { color: '#25f4ee', duration: 2600 });
          break;
        }

        case 'vip_spotlight': {
          const slot = assignRole(a.user, 'guitar', { force: true, protectSec: 16, announce: false });
          if (slot) {
            slot.soloUntil = time + 8.0;
            // Herkes telefon ışıklarını kaldırsın!
            for (const b of bugs) if (b.visual.group.visible && !b.role && !b.swimming) b.lighterUntil = Math.max(b.lighterUntil, time + 8.0);
            addVibe(14);
            addScore(a.user, 60);
            play(() => { sound.strum(0); sound.crowdCheer(false); });
            triggerSwoopTo(slot.baseX, 1.9, slot.baseZ, 4.2);
            ctx.ui.toast(`🎸 ${a.user.nick} GİTARİST OLDU! AKDENİZ SOLOSU!`, { color: '#f5c542', duration: 2600 });
          }
          break;
        }

        case 'lantern_feast': {
          ensureBeachBug(a.user);
          const count = clamp(Number(P.count) || 8, 1, 14);
          for (let i = 0; i < count; i++) beach.spawnLantern(i < 4 ? a.user.nick : '');
          addVibe(count >= 6 ? 20 : 6);
          addScore(a.user, count >= 6 ? 100 : 12);
          play(() => { sound.teaClink(); sound.chest(); sound.strum(2); });
          swoop.active = false;
          swoop.nextAt = Math.max(swoop.nextAt, time + 5.5); // gökyüzüne yükselen fenerler geniş açıda görünsün!
          ctx.ui.toast(`🏮 ${a.user.nick} gökyüzüne ${count} Dilek Feneri & Çay Şöleni saldı!`, { color: '#f5c542', duration: 2600 });
          break;
        }

        case 'zabita_raid': {
          ensureBeachBug(a.user);
          addScore(a.user, 250);
          addVibe(28);
          zabitaState = { active: true, t: 0, dur: 11.5, phase: 'march', caller: a.user.nick };
          for (const b of bugs) if (b.visual.group.visible && !b.swimming) b.panicUntil = time + 3.4;
          play(() => sound.whistle());
          camShake = 0.35;
          swoop.active = false;
          swoop.nextAt = Math.max(swoop.nextAt, time + 11.5);
          ctx.ui.toast(`👮 ${a.user.nick} ZABITA ÇAĞIRDI! "Saat 12 oldu gençler!"`, { color: '#ff2e54', duration: 2800 });
          break;
        }
      }
    },
    onRules(next) { rules = next || []; },
    onSettings(next) {
      const rebuild = Number(next.maxCrowd) !== Number(settings.maxCrowd);
      settings = { ...next };
      if (rebuild) buildBugs();
    },
    destroy() {
      handle.stop();
      sound.stopMusic();
      beach.dispose();
      if (pmrem) pmrem.dispose();
      if (composer) composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hudCanvas.remove();
    },
  };
}
