// Maç Öncesi Lobi Kaosu: Pistte kafa göz dalan random hamam böcekleri, çizgi film patlamaları,
// arkada sürekli havai fişekler ve stadyum üstünden alçaktan süzülen savaş uçakları!
// 2+ gerçek oyuncu gelip maç başlayınca anında temizlenip gizlenir.
import * as THREE from 'three';
import { clamp, rand, pick } from '@sdk/kit.js';
import { createRoachJockey, LANES } from './horse.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const glow = (hex, intensity = 2.4) => new THREE.MeshStandardMaterial({
  color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.25,
});

// ---- 3B Alçak İrtifa Savaş Uçağı (F-16 / Jet + Çift Kuyruk + Parlayan Afterburner!) ----
function createFighterJet(accentHex = 0xff2e54) {
  const root = new THREE.Group();
  const bodyMat = std({ color: 0x64748b, metalness: 0.72, roughness: 0.28 });
  const darkMat = std({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
  const stripeMat = std({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.35, roughness: 0.32 });
  const canopyMat = std({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85, roughness: 0.08, metalness: 0.85 });

  // Ana gövde (+Z burun yönü)
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 3.6, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  root.add(fuselage);

  // Sivri radar burnu
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.35, 12), darkMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 2.45;
  root.add(nose);

  // Parlak cam kokpit
  const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.72, 6, 12), canopyMat);
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(0, 0.24, 0.85);
  root.add(canopy);

  // Ok açılı delta kanatlar (sol + sağ)
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.75);
    sh.lineTo(s * 2.45, -0.75);
    sh.lineTo(s * 2.45, -1.25);
    sh.lineTo(0, -1.15);
    sh.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }), bodyMat);
    wing.rotation.x = Math.PI / 2;
    wing.position.set(0, 0.02, 0.05);
    root.add(wing);

    // Kanat ucu renkli şerit + füze
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), stripeMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(s * 2.45, -0.02, -0.75);
    root.add(tip);

    // Yatay kuyruk kanatçığı
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.55), darkMat);
    hTail.position.set(s * 0.72, 0.0, -1.55);
    hTail.rotation.y = s * -0.35;
    root.add(hTail);

    // Çift eğimli dikey kuyruk yüzgeci
    const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.92), stripeMat);
    vTail.position.set(s * 0.34, 0.45, -1.45);
    vTail.rotation.z = s * -0.22;
    root.add(vTail);
  }

  // Egzoz nozülü + yanan mavi-turuncu afterburner alevi!
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.20, 0.35, 12), darkMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -1.92;
  root.add(nozzle);

  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.85, 10), glow(0xff6b00, 3.6));
  flameOuter.rotation.x = -Math.PI / 2;
  flameOuter.position.z = -2.95;
  root.add(flameOuter);

  const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.25, 8), glow(0x38bdf8, 4.4));
  flameCore.rotation.x = -Math.PI / 2;
  flameCore.position.z = -2.62;
  root.add(flameCore);

  return { root, flameOuter, flameCore };
}

export function createLobbyChaos(scene, { onBurst, onHit, onBoom, onFirework, onJet }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ---------- 1) 6 Dev Kavgacı Random Hamam Böceği ----------
  const ARENA_X = 6.8;
  const ARENA_Z_MIN = 3.6;
  const ARENA_Z_MAX = 14.2;

  const starGeo = new THREE.OctahedronGeometry(0.14, 0);
  const starMat = glow(0xffd166, 3.0);

  const fighters = Array.from({ length: 6 }, (_, i) => {
    const lane = LANES[i % LANES.length];
    const holder = new THREE.Group();
    const jockey = createRoachJockey(lane);
    jockey.setGender(i % 2 ? 'f' : 'm');
    jockey.standLegs.visible = true;
    // Bazı kavgacı böcekler elinde davul/zurnayla bile dalabilir!
    jockey.root.scale.setScalar(1.92);
    jockey.root.position.y = 0.82;
    holder.add(jockey.root);

    // Sersemleyince kafada dönen çizgi film yıldızları!
    const dizzy = new THREE.Group();
    dizzy.position.set(0, 3.05, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const st = new THREE.Mesh(starGeo, starMat);
      st.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
      dizzy.add(st);
    }
    dizzy.visible = false;
    holder.add(dizzy);

    root.add(holder);
    const angle = (i / 6) * Math.PI * 2;
    return {
      idx: i,
      lane,
      holder,
      jockey,
      dizzy,
      x: Math.cos(angle) * 4.5,
      y: 0,
      z: 9.0 + Math.sin(angle) * 3.8,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: angle + Math.PI,
      state: 'chase',    // 'chase' | 'attack' | 'launched' | 'stun'
      attackKind: 'headbutt', // 'headbutt' | 'dropkick' | 'uppercut'
      targetIdx: (i + 1) % 6,
      stateT: rand(0.1, 0.9),
      spinX: 0,
      spinZ: 0,
      coolT: 0,
    };
  });

  // ---------- 2) Çizgi Film Patlama Küreleri & Şok Halkaları (Pool) ----------
  const blastSphereGeo = new THREE.SphereGeometry(1, 14, 12);
  const blastRingGeo = new THREE.TorusGeometry(1, 0.055, 8, 24);
  const fwRingGeo = new THREE.TorusGeometry(1, 0.025, 6, 28);
  const blasts = [];

  function spawnBlast(x, y, z, big = false) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const coreMat = new THREE.MeshBasicMaterial({ color: big ? 0xffef99 : 0xff9e00, transparent: true, opacity: 0.72, depthWrite: false });
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0.56, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const core = new THREE.Mesh(blastSphereGeo, coreMat);
    const shell = new THREE.Mesh(blastSphereGeo, shellMat);
    const ring = new THREE.Mesh(blastRingGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    g.add(core, shell, ring);
    root.add(g);
    blasts.push({ g, core, shell, ring, coreMat, shellMat, ringMat, t: 0, dur: big ? 0.58 : 0.42, maxR: big ? 2.4 : 1.55 });
    if (onBurst) {
      onBurst(x, y + 0.4, z, 0xff5400, big ? 32 : 18, big ? 13 : 9);
      onBurst(x, y + 0.6, z, 0xffd166, big ? 22 : 12, big ? 11 : 8);
    }
  }

  // ---------- 3) Alçaktan Uçan Savaş Uçağı Filosu (3 Dev Jet!) ----------
  const jetColors = [0xff2e54, 0x25f4ee, 0xffd166];
  const jets = jetColors.map((col, idx) => {
    const mesh = createFighterJet(col);
    mesh.root.scale.setScalar(1.22);
    mesh.root.visible = false;
    root.add(mesh.root);
    return {
      idx,
      mesh,
      active: false,
      x: 0, y: 8.0, z: -26,
      vx: 0, vy: 0, vz: 0,
      bank: 0,
      trailT: 0,
      smokeCol: idx === 0 ? 0xff2e54 : idx === 1 ? 0xffffff : 0x25f4ee,
      life: 0,
      maxLife: 3.4,
    };
  });

  // Gökyüzünde patlayan 3B ışıklı havai fişek halkaları (arka planda anında parlar!)
  const fwStarGeo = new THREE.OctahedronGeometry(0.28, 0);
  const skyFireworks = [];
  function spawnSkyFirework(x, y, z, hex) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 1 });
    const rays = [];
    for (let k = 0; k < 14; k++) {
      const a1 = (k / 14) * Math.PI * 2;
      const a2 = ((k % 3) - 1) * 0.55;
      const m = new THREE.Mesh(fwStarGeo, mat);
      g.add(m);
      rays.push({ m, dx: Math.cos(a1) * Math.cos(a2), dy: Math.sin(a2) + 0.12, dz: Math.sin(a1) * Math.cos(a2) });
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(fwRingGeo, ringMat);
    g.add(ring);
    root.add(g);
    skyFireworks.push({ g, rays, ring, mat, ringMat, t: 0, dur: 1.05, maxR: rand(3.2, 4.8) });
    if (onBurst) onBurst(x, y, z, hex, 26, 11);
  }

  let jetWaveT = 0.25;
  let fireworkT = 0.2;
  let ambientBlastT = 1.4;
  let shakeOut = 0;

  function launchJetSquadron() {
    const pattern = Math.floor(Math.random() * 3);
    const count = 3;
    for (let i = 0; i < jets.length; i++) {
      const j = jets[i];
      if (i >= count) { j.active = false; j.mesh.root.visible = false; continue; }
      j.active = true;
      j.mesh.root.visible = true;
      j.life = 0;
      j.trailT = 0;
      const formSide = i === 0 ? 0 : (i === 1 ? -1 : 1);
      if (pattern === 0) {
        // Soldan sağa stadyumun hemen üstünden alçak V-formasyonu geçişi (tam gökyüzü penceresinde!)
        j.x = -14 - i * 3.6;
        j.y = 7.2 + (i === 0 ? 1.0 : 0.2) + (i === 2 ? 1.8 : 0);
        j.z = -5.5 + formSide * 3.2;
        j.vx = 18;
        j.vy = 0.35;
        j.vz = 1.2;
        j.bank = -0.45;
        j.maxLife = 2.6;
      } else if (pattern === 1) {
        // Sağdan sola kanat yatırarak alçak geçiş!
        j.x = 14 + i * 3.6;
        j.y = 7.4 + (i === 0 ? 1.0 : 0.2) + (i === 2 ? 1.8 : 0);
        j.z = -4.5 + formSide * 3.0;
        j.vx = -18;
        j.vy = 0.35;
        j.vz = 1.2;
        j.bank = 0.45;
        j.maxLife = 2.6;
      } else {
        // Başlangıç kapılarının üstünden kameraya doğru alçak V-dalışı!
        j.x = formSide * 4.2;
        j.y = 7.8 + Math.abs(formSide) * 0.9;
        j.z = -20 - Math.abs(formSide) * 4.0;
        j.vx = formSide * 0.35;
        j.vy = 0.45;
        j.vz = 22;
        j.bank = formSide * 0.28;
        j.maxLife = 2.5;
      }
      j.mesh.root.position.set(j.x, j.y, j.z);
    }
    if (onJet) onJet();
  }

  function show() {
    if (root.visible) return;
    root.visible = true;
    jetWaveT = 0;
    fireworkT = 0;
    ambientBlastT = 0.7;
    fighters.forEach((f, i) => {
      const a = (i / fighters.length) * Math.PI * 2;
      f.x = Math.cos(a) * 4.6;
      f.y = 0;
      f.z = 9.0 + Math.sin(a) * 3.6;
      f.vx = f.vy = f.vz = 0;
      f.state = 'chase';
      f.targetIdx = (i + 1 + Math.floor(Math.random() * 4)) % fighters.length;
      if (f.targetIdx === i) f.targetIdx = (i + 1) % fighters.length;
      f.stateT = rand(0.1, 0.5);
      f.coolT = 0;
      f.dizzy.visible = false;
      f.holder.rotation.set(0, a + Math.PI, 0);
    });
  }

  function hide() {
    if (!root.visible) return;
    root.visible = false;
    for (const j of jets) { j.active = false; j.mesh.root.visible = false; }
    for (const b of blasts) { root.remove(b.g); b.coreMat.dispose(); b.shellMat.dispose(); b.ringMat.dispose(); }
    blasts.length = 0;
    for (const fw of skyFireworks) { root.remove(fw.g); fw.mat.dispose(); fw.ringMat.dispose(); }
    skyFireworks.length = 0;
  }

  function update(dt, time) {
    if (!root.visible) return 0;
    shakeOut = 0;

    // 1) Kavgacı böcek yapay zekâsı & fizik (kafa atma, uçan tekme, havaya fırlama!)
    for (const f of fighters) {
      f.coolT = Math.max(0, f.coolT - dt);
      f.stateT -= dt;

      if (f.state === 'launched') {
        f.vy -= 26 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;
        f.holder.rotation.x += f.spinX * dt;
        f.holder.rotation.z += f.spinZ * dt;
        if (f.y <= 0) {
          f.y = 0;
          if (Math.abs(f.vy) > 4.2) {
            f.vy = Math.abs(f.vy) * 0.42;
            f.vx *= 0.65; f.vz *= 0.65;
            if (onBurst) onBurst(f.x, 0.35, f.z, 0xc2956b, 10, 6);
          } else {
            f.vy = 0; f.vx = 0; f.vz = 0;
            f.state = 'stun';
            f.stateT = 0.65;
            f.holder.rotation.x = 0;
            f.holder.rotation.z = 0;
          }
        }
      } else if (f.state === 'stun') {
        f.dizzy.visible = true;
        f.dizzy.rotation.y = time * 8.5;
        f.jockey.root.rotation.z = Math.sin(time * 22) * 0.24;
        if (f.stateT <= 0) {
          f.dizzy.visible = false;
          f.jockey.root.rotation.z = 0;
          f.state = 'chase';
          f.targetIdx = (f.idx + 1 + Math.floor(Math.random() * (fighters.length - 1))) % fighters.length;
        }
      } else {
        f.dizzy.visible = false;
        let target = fighters[f.targetIdx];
        if (!target || target.idx === f.idx || target.state === 'launched') {
          const alive = fighters.filter((o) => o.idx !== f.idx && o.state !== 'launched');
          if (alive.length) {
            target = pick(alive);
            f.targetIdx = target.idx;
          }
        }
        if (target) {
          const dx = target.x - f.x;
          const dz = target.z - f.z;
          const dist = Math.hypot(dx, dz) || 0.001;
          const desiredRot = Math.atan2(dx, dz);
          // Yumuşak yönelme
          let diff = desiredRot - f.rotY;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          f.rotY += diff * Math.min(1, dt * 9);

          if (f.state === 'chase') {
            const spd = 7.4;
            f.x += (dx / dist) * spd * dt;
            f.z += (dz / dist) * spd * dt;
            f.y = Math.abs(Math.sin(time * 16 + f.idx)) * 0.28;
            f.jockey.root.rotation.x = 0.25; // öne eğilip koşma!
            for (const a of f.jockey.arms) {
              a.piv.rotation.y = a.side * 0.9;
              a.piv.rotation.x = -0.8 + Math.sin(time * 22 + a.side * 1.5) * 0.65;
            }
            if (dist < 2.65 && f.coolT <= 0) {
              f.state = 'attack';
              f.attackKind = pick(['headbutt', 'dropkick', 'uppercut']);
              f.stateT = 0.34;
              f.vx = (dx / dist) * 11.5;
              f.vz = (dz / dist) * 11.5;
              f.vy = f.attackKind === 'dropkick' ? 6.8 : 4.2;
            }
          } else if (f.state === 'attack') {
            f.vy -= 22 * dt;
            f.x += f.vx * dt;
            f.z += f.vz * dt;
            f.y = Math.max(0, f.y + f.vy * dt);
            // Saldırı pozu!
            if (f.attackKind === 'headbutt') f.jockey.root.rotation.x = 0.95;
            else if (f.attackKind === 'dropkick') f.jockey.root.rotation.x = -0.85;
            else { f.rotY += dt * 18; f.jockey.root.rotation.x = 0.15; }
            for (const a of f.jockey.arms) {
              a.piv.rotation.y = a.side * 1.4;
              a.piv.rotation.x = -1.35 + Math.sin(time * 36) * 0.45;
            }

            // Çarpışma kontrolü — rakibe kafa göz daldı!
            for (const o of fighters) {
              if (o.idx === f.idx || o.state === 'launched') continue;
              const od = Math.hypot(o.x - f.x, o.z - f.z);
              if (od < 2.15) {
                const nx = (o.x - f.x) / (od || 1);
                const nz = (o.z - f.z) / (od || 1);
                const bigBoom = Math.random() < 0.48;
                o.state = 'launched';
                o.vx = nx * (bigBoom ? 11.5 : 8.2) + rand(-1.5, 1.5);
                o.vz = nz * (bigBoom ? 11.5 : 8.2) + rand(-1.5, 1.5);
                o.vy = bigBoom ? rand(10.5, 13.5) : rand(7.2, 9.8);
                o.spinX = rand(-11, 11);
                o.spinZ = rand(-11, 11);

                const mx = (f.x + o.x) * 0.5;
                const mz = (f.z + o.z) * 0.5;
                if (bigBoom) {
                  spawnBlast(mx, 1.35, mz, true);
                  shakeOut = Math.max(shakeOut, 0.36);
                  if (onBoom) onBoom();
                } else {
                  spawnBlast(mx, 1.25, mz, false);
                  shakeOut = Math.max(shakeOut, 0.16);
                  if (onHit) onHit();
                }
                f.state = 'chase';
                f.coolT = 0.55;
                f.y = 0;
                f.jockey.root.rotation.x = 0;
                break;
              }
            }
            if (f.stateT <= 0) {
              f.state = 'chase';
              f.y = 0;
              f.coolT = 0.35;
              f.jockey.root.rotation.x = 0;
            }
          }
        }
        f.holder.rotation.set(0, f.rotY, 0);
      }

      // Arena sınırları içinde tut (kenardan sekip kavgaya geri dönsün!)
      if (f.x < -ARENA_X) { f.x = -ARENA_X; f.vx = Math.abs(f.vx) * 0.7; }
      if (f.x > ARENA_X) { f.x = ARENA_X; f.vx = -Math.abs(f.vx) * 0.7; }
      if (f.z < ARENA_Z_MIN) { f.z = ARENA_Z_MIN; f.vz = Math.abs(f.vz) * 0.7; }
      if (f.z > ARENA_Z_MAX) { f.z = ARENA_Z_MAX; f.vz = -Math.abs(f.vz) * 0.7; }

      f.jockey.antennae[0].rotation.z = Math.sin(time * 18 + f.idx) * 0.25;
      f.jockey.antennae[1].rotation.z = -Math.sin(time * 19 + f.idx) * 0.25;
      f.jockey.standLegs.rotation.x = f.state === 'chase' ? Math.sin(time * 20 + f.idx) * 0.55 : 0;
      f.holder.position.set(f.x, f.y, f.z);
    }

    // 2) Patlama kürelerini & şok halkalarını animasyonla büyütüp temizle
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.t += dt;
      const u = clamp(b.t / b.dur, 0, 1);
      if (u >= 1) {
        root.remove(b.g);
        b.coreMat.dispose(); b.shellMat.dispose(); b.ringMat.dispose();
        blasts.splice(i, 1);
        continue;
      }
      const easeOut = 1 - Math.pow(1 - u, 3);
      b.core.scale.setScalar(0.35 + easeOut * b.maxR * 0.72);
      b.shell.scale.setScalar(0.45 + easeOut * b.maxR);
      b.ring.scale.setScalar(0.4 + easeOut * b.maxR * 1.45);
      b.coreMat.opacity = (1 - u) * 0.95;
      b.shellMat.opacity = (1 - u) * 0.72;
      b.ringMat.opacity = (1 - u) * 0.92;
    }

    // 3) Savaş uçakları alçak irtifa geçişi & renkli akrobasi dumanı!
    jetWaveT -= dt;
    if (jetWaveT <= 0) {
      jetWaveT = rand(2.4, 3.6);
      launchJetSquadron();
    }
    for (const j of jets) {
      if (!j.active) continue;
      j.life += dt;
      if (j.life >= j.maxLife) { j.active = false; j.mesh.root.visible = false; continue; }
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      j.z += j.vz * dt;
      j.mesh.root.position.set(j.x, j.y, j.z);
      j.mesh.root.lookAt(j.x + j.vx, j.y + j.vy, j.z + j.vz);
      j.mesh.root.rotateZ(j.bank + Math.sin(time * 5 + j.idx) * 0.08);
      const flick = 0.85 + Math.sin(time * 48 + j.idx) * 0.25;
      j.mesh.flameOuter.scale.set(1, flick, 1);
      j.mesh.flameCore.scale.set(1, flick * 1.1, 1);

      j.trailT -= dt;
      if (j.trailT <= 0 && onBurst) {
        j.trailT = 0.025;
        onBurst(j.x, j.y, j.z, j.smokeCol, 4, 2.4);
      }
    }

    // 4) Arka planda gökyüzünde sürekli dev renkli 3B havai fişekler!
    fireworkT -= dt;
    if (fireworkT <= 0) {
      fireworkT = rand(0.55, 0.95);
      const fx = rand(-8.5, 8.5);
      const fy = rand(6.4, 10.6);
      const fz = rand(-15, -4);
      const col = pick([0xff3b5c, 0xffd166, 0x25f4ee, 0x22d07a, 0xb55cff, 0xff9e00]);
      spawnSkyFirework(fx, fy, fz, col);
      if (onFirework) onFirework();
    }
    for (let i = skyFireworks.length - 1; i >= 0; i--) {
      const fw = skyFireworks[i];
      fw.t += dt;
      const u = clamp(fw.t / fw.dur, 0, 1);
      if (u >= 1) {
        root.remove(fw.g);
        fw.mat.dispose(); fw.ringMat.dispose();
        skyFireworks.splice(i, 1);
        continue;
      }
      const easeOut = 1 - Math.pow(1 - u, 3);
      const r = easeOut * fw.maxR;
      const grav = u * u * 1.6;
      for (const ray of fw.rays) {
        ray.m.position.set(ray.dx * r, ray.dy * r - grav, ray.dz * r);
        ray.m.scale.setScalar(Math.max(0.2, (1 - u) * 1.4));
      }
      fw.ring.scale.setScalar(0.3 + easeOut * fw.maxR * 0.85);
      fw.mat.opacity = Math.max(0, 1 - u * u);
      fw.ringMat.opacity = Math.max(0, (1 - u) * 0.8);
    }

    // 5) Pistte ekstra kaotik mini patlamalar (böcekler uçuşsun!)
    ambientBlastT -= dt;
    if (ambientBlastT <= 0) {
      ambientBlastT = rand(2.2, 3.6);
      const bx = rand(-4.8, 4.8);
      const bz = rand(5.5, 12.5);
      spawnBlast(bx, 0.9, bz, true);
      shakeOut = Math.max(shakeOut, 0.32);
      if (onBoom) onBoom();
      for (const f of fighters) {
        const d = Math.hypot(f.x - bx, f.z - bz);
        if (d < 4.5 && f.state !== 'launched') {
          const nx = (f.x - bx) / (d || 1);
          const nz = (f.z - bz) / (d || 1);
          f.state = 'launched';
          f.vx = nx * 9.5;
          f.vz = nz * 9.5;
          f.vy = rand(8.5, 12.0);
          f.spinX = rand(-10, 10);
          f.spinZ = rand(-10, 10);
        }
      }
    }

    return shakeOut;
  }

  function dispose() {
    hide();
    blastSphereGeo.dispose();
    blastRingGeo.dispose();
    fwRingGeo.dispose();
    starGeo.dispose();
    starMat.dispose();
    fwStarGeo.dispose();
    root.traverse((obj) => {
      if (obj.geometry && obj.geometry !== blastSphereGeo && obj.geometry !== blastRingGeo && obj.geometry !== fwRingGeo && obj.geometry !== starGeo && obj.geometry !== fwStarGeo) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { if (m && m !== starMat && m.dispose) m.dispose(); }
    });
    scene.remove(root);
  }

  return { root, show, hide, update, dispose };
}
