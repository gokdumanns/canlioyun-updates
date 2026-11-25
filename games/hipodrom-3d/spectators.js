// Tribün Seyircileri (Koşan 3B Hamam Böceği Taraftarlar) + Tribünden Sahaya Fırlatılan 3B Sabotaj Objeleri.
// Kamera ve yarış aktıkça tüm izleyiciler tribün teraslarından bitiş çizgisine kadar koşarak takip eder
// ve hediyelerle/komutlarla pistteki liderlere 3B domates, çamur ve bal kavanozu fırlatır!
import * as THREE from 'three';

const PALETTE = [0xff4d6d, 0x2f8cff, 0x22d07a, 0xffd166, 0xb55cff, 0xff8c24, 0x25f4ee, 0xff66b3];
const MAX_SPECS = 26;

function std(opts) { return new THREE.MeshStandardMaterial(opts); }

export function createSpectators(scene, { trackW, trackLength, onBurst }) {
  const group = new THREE.Group();
  scene.add(group);

  // Paylaşılan hafif 3B geometriler (sıfır huni — sporcu ceketi, şapka ve gerçek VIP halka taç!)
  const bodyPts = [[0, 0], [0.16, 0.06], [0.22, 0.22], [0.21, 0.44], [0.14, 0.6], [0, 0.64]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const bodyGeo = new THREE.LatheGeometry(bodyPts, 12);
  const headGeo = new THREE.SphereGeometry(0.19, 12, 10);
  const eyeWGeo = new THREE.SphereGeometry(0.068, 8, 8);
  const eyeBGeo = new THREE.SphereGeometry(0.036, 6, 6);
  const limbGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.42, 6);
  const antGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.46, 5);
  // Fit spor forma gövdesi + omuzlar + yaka + beyzbol şapkası (huni YOK!)
  const jerseyGeo = new THREE.CapsuleGeometry(0.23, 0.24, 6, 12);
  const shoulderGeo = new THREE.SphereGeometry(0.095, 8, 8);
  const collarGeo = new THREE.TorusGeometry(0.145, 0.026, 6, 14);
  const capDomeGeo = new THREE.SphereGeometry(0.198, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const capBrimGeo = new THREE.BoxGeometry(0.22, 0.028, 0.16);
  const crownRingGeo = new THREE.TorusGeometry(0.135, 0.026, 8, 16);
  const crownOrbGeo = new THREE.SphereGeometry(0.032, 7, 7);

  const shellMat = std({ color: 0x6b2f12, roughness: 0.32, metalness: 0.1 });
  const darkMat = std({ color: 0x2a1005, roughness: 0.45 });
  const whiteTrimMat = std({ color: 0xf8fafc, roughness: 0.4 });
  const eyeWMat = std({ color: 0xffffff, roughness: 0.1 });
  const eyeBMat = std({ color: 0x111116, roughness: 0.05 });
  const vipGoldMat = std({ color: 0xffd166, emissive: 0xff9e00, emissiveIntensity: 0.9, metalness: 0.85, roughness: 0.2 });

  // Sabotaj mermileri için paylaşılan geometriler & materyaller
  const tomGeo = new THREE.SphereGeometry(0.46, 12, 10);
  const tomLeafGeo = new THREE.ConeGeometry(0.24, 0.22, 5);
  const tomMat = std({ color: 0xff2438, emissive: 0x990011, emissiveIntensity: 0.45, roughness: 0.22 });
  const tomLeafMat = std({ color: 0x22c55e, roughness: 0.5 });

  const mudGeo = new THREE.DodecahedronGeometry(0.56, 1);
  const mudMat = std({ color: 0x4a2c16, roughness: 0.72, metalness: 0.05 });

  const honeyJarGeo = new THREE.CylinderGeometry(0.36, 0.44, 0.72, 12);
  const honeyLidGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.16, 12);
  const honeyMat = std({ color: 0xffb703, emissive: 0xff9500, emissiveIntensity: 1.15, roughness: 0.18 });
  const honeyLidMat = std({ color: 0xfff3d6, roughness: 0.45 });

  function buildSpectatorMesh(colorHex) {
    const root = new THREE.Group();
    root.scale.setScalar(1.98);

    const rig = new THREE.Group();
    root.add(rig);

    const torso = new THREE.Mesh(bodyGeo, shellMat);
    torso.position.y = 0.32;
    rig.add(torso);

    const jerseyMat = std({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.24, roughness: 0.44 });
    const jersey = new THREE.Mesh(jerseyGeo, jerseyMat);
    jersey.position.y = 0.58;
    jersey.scale.set(1.06, 1.0, 0.88);
    rig.add(jersey);
    // Beyaz spor yaka & omuz kesimleri
    const collar = new THREE.Mesh(collarGeo, whiteTrimMat);
    collar.position.set(0, 0.80, 0.02);
    collar.rotation.x = Math.PI / 2;
    rig.add(collar);
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(shoulderGeo, jerseyMat);
      sh.position.set(s * 0.23, 0.72, 0);
      rig.add(sh);
    }

    const head = new THREE.Mesh(headGeo, shellMat);
    head.position.set(0, 1.04, 0.06);
    rig.add(head);

    // Taraftar beyzbol şapkası (kafa üstünde huni değil, şık şapka!)
    const cap = new THREE.Mesh(capDomeGeo, jerseyMat);
    cap.position.set(0, 1.07, 0.06);
    rig.add(cap);
    const brim = new THREE.Mesh(capBrimGeo, whiteTrimMat);
    brim.position.set(0, 1.08, 0.23);
    brim.rotation.x = 0.08;
    rig.add(brim);

    for (const s of [-1, 1]) {
      const ew = new THREE.Mesh(eyeWGeo, eyeWMat);
      ew.position.set(s * 0.075, 1.05, 0.2); rig.add(ew);
      const eb = new THREE.Mesh(eyeBGeo, eyeBMat);
      eb.position.set(s * 0.078, 1.05, 0.25); rig.add(eb);
      const ant = new THREE.Mesh(antGeo, darkMat);
      ant.position.set(s * 0.11, 1.32, 0.08);
      ant.rotation.z = -s * 0.42;
      rig.add(ant);
    }

    // Gerçek VIP / Sıra Halka Tacı (5 inci taşlı altın halka — huni değil!)
    const vipCrown = new THREE.Group();
    vipCrown.position.set(0, 1.29, 0.05);
    const ring = new THREE.Mesh(crownRingGeo, vipGoldMat);
    ring.rotation.x = Math.PI / 2;
    vipCrown.add(ring);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const orb = new THREE.Mesh(crownOrbGeo, vipGoldMat);
      orb.position.set(Math.cos(a) * 0.135, 0.045, Math.sin(a) * 0.135);
      vipCrown.add(orb);
    }
    vipCrown.visible = false;
    rig.add(vipCrown);

    // Koşan bacaklar + sallanan kollar
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
      const lp = new THREE.Group();
      lp.position.set(s * 0.13, 0.36, 0);
      const lm = new THREE.Mesh(limbGeo, darkMat);
      lm.position.y = -0.18;
      lp.add(lm);
      rig.add(lp);
      legs.push({ piv: lp, side: s });

      const ap = new THREE.Group();
      ap.position.set(s * 0.24, 0.74, 0);
      const am = new THREE.Mesh(limbGeo, darkMat);
      am.position.y = -0.16;
      ap.add(am);
      // Sağ elde sallanan parlak taraftar bayrağı/flaması (koşarken çok net seçilir!)
      if (s === 1) {
        const stick = new THREE.Mesh(antGeo, vipGoldMat);
        stick.position.set(0.02, -0.34, 0.14);
        stick.rotation.x = 0.55;
        ap.add(stick);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), std({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.65, side: THREE.DoubleSide }));
        flag.position.set(0.16, -0.45, 0.25);
        ap.add(flag);
      }
      rig.add(ap);
      arms.push({ piv: ap, side: s });
    }

    const headAnchor = new THREE.Object3D();
    headAnchor.position.set(0, 1.75, 0);
    rig.add(headAnchor);

    return { root, rig, jerseyMat, vipCrown, legs, arms, headAnchor };
  }

  // Seyirci listesi — boşken sahnede kimse yok; izleyiciler katıldıkça yürüyüş yoluna girip koşmaya başlar!
  const list = [];
  const byUser = new Map();
  let slotCursor = 0;
  let lastPackZ = 2;

  function makeSlot(i) {
    const side = i % 2 === 0 ? -1 : 1;
    const tier = Math.floor(i / 2) % 2; // 0: çit dibi ön koşu terası, 1: 2. kademe teras
    const baseX = side * (trackW / 2 + (tier === 0 ? 1.85 : 3.75));
    const baseY = tier === 0 ? 0.66 : 1.56;
    // Seyirciler atların hemen yanında ve önünde bitişe kadar koşsun (9:16 kamerada dev ve net görünür!)
    const zOff = -1 + ((i * 2.8) % 26);
    const colHex = PALETTE[i % PALETTE.length];
    const visual = buildSpectatorMesh(colHex);
    visual.root.position.set(baseX, baseY, Math.max(0, zOff));
    visual.root.visible = false;
    // Piste hafifçe dönük koşsun
    visual.root.rotation.y = side > 0 ? -0.35 : 0.35;
    group.add(visual.root);
    return {
      idx: i,
      userId: null,
      nick: '',
      ambient: true,
      side,
      tier,
      baseX,
      baseY,
      zOff,
      z: Math.max(0, zOff),
      runPh: i * 1.17,
      speedMul: 0.92 + (i % 5) * 0.04,
      throwT: 0,
      spawnPop: 0,
      lastActiveAt: 0,
      queuedPos: 0,
      vip: false,
      lastIcon: '',
      colorHex: colHex,
      visual,
    };
  }

  function ensureUser(user, { colorHex, queuedPos, vip, icon } = {}) {
    if (!user || !user.id) return null;
    let sp = byUser.get(user.id);
    if (!sp) {
      // 1) Boşalmış (gizli) yuva varsa sahiplen, 2) max'a ulaşmadıysa yeni yuva aç, 3) en eski sırasız seyirciyi devral
      sp = list.find((s) => !s.userId);
      if (!sp && list.length < MAX_SPECS) {
        sp = makeSlot(list.length);
        list.push(sp);
      }
      if (!sp) {
        const candidates = list.filter((s) => !s.queuedPos).sort((a, b) => a.lastActiveAt - b.lastActiveAt);
        sp = candidates[0] || list[slotCursor++ % list.length];
        if (sp.userId) byUser.delete(sp.userId);
      }
      sp.userId = user.id;
      sp.ambient = false;
      sp.queuedPos = 0;
      sp.vip = false;
      sp.lastIcon = '';
      sp.throwT = 0;
      sp.visual.vipCrown.visible = false;
      sp.z = Math.max(0, Math.min(trackLength - 4, lastPackZ + sp.zOff));
      sp.spawnPop = 0.01;
      sp.visual.root.position.set(sp.baseX, sp.baseY, sp.z);
      sp.visual.root.visible = true;
      byUser.set(user.id, sp);
    }
    sp.nick = user.nick || sp.nick || 'İzleyici';
    sp.lastActiveAt = performance.now();
    if (colorHex != null) {
      sp.colorHex = colorHex;
      sp.visual.jerseyMat.color.setHex(colorHex);
    }
    if (queuedPos !== undefined) sp.queuedPos = queuedPos;
    if (vip !== undefined) {
      sp.vip = !!vip;
      sp.visual.vipCrown.visible = sp.vip || sp.queuedPos > 0;
    }
    if (icon) sp.lastIcon = icon;
    return sp;
  }

  function removeUser(userId) {
    const sp = byUser.get(userId);
    if (!sp) return;
    byUser.delete(userId);
    sp.userId = null;
    sp.nick = '';
    sp.ambient = true;
    sp.queuedPos = 0;
    sp.vip = false;
    sp.lastIcon = '';
    sp.visual.vipCrown.visible = false;
    sp.visual.root.visible = false;
  }

  function removeWhere(pred) {
    for (const id of [...byUser.keys()]) {
      if (pred(id)) removeUser(id);
    }
  }

  function syncQueue(queue) {
    const qMap = new Map();
    queue.forEach((entry, idx) => qMap.set(entry.user.id, { pos: idx + 1, vip: !!entry.vip }));
    for (const sp of list) {
      if (!sp.userId) continue;
      const info = qMap.get(sp.userId);
      sp.queuedPos = info ? info.pos : 0;
      sp.vip = info ? info.vip : sp.vip;
      sp.visual.vipCrown.visible = sp.vip || sp.queuedPos > 0;
    }
    for (const entry of queue) {
      const info = qMap.get(entry.user.id);
      ensureUser(entry.user, { queuedPos: info.pos, vip: info.vip });
    }
  }

  // ---- Tribünden Sahaya 3B Parabolik Fırlatma Sistemi (Domates / Çamur / Bal) ----
  const projectiles = [];

  function makeProjectileMesh(kind) {
    if (kind === 'tomato') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(tomGeo, tomMat);
      body.scale.set(1.08, 0.9, 1.08);
      g.add(body);
      const leaf = new THREE.Mesh(tomLeafGeo, tomLeafMat);
      leaf.position.y = 0.42;
      g.add(leaf);
      return g;
    }
    if (kind === 'honey') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(honeyJarGeo, honeyMat));
      const lid = new THREE.Mesh(honeyLidGeo, honeyLidMat);
      lid.position.y = 0.42;
      g.add(lid);
      return g;
    }
    // çamur bombası
    const m = new THREE.Mesh(mudGeo, mudMat);
    m.scale.set(1.15, 0.88, 1.05);
    return m;
  }

  function throwProjectile(user, kind, targetRacer, onImpact) {
    if (!targetRacer) return;
    // Fırlatan kişi seyirciyse tribündeki kendi konumundan, yarışçıysa en yakın seyirci noktasından at!
    let sp = user ? byUser.get(user.id) : null;
    if (!sp && user && !user._isRacer) {
      sp = ensureUser(user, { icon: kind === 'tomato' ? '🍅' : kind === 'honey' ? '🍯' : '🟤' });
    }
    const startPos = new THREE.Vector3();
    if (sp) {
      sp.throwT = 0.95;
      sp.lastIcon = kind === 'tomato' ? '🍅' : kind === 'honey' ? '🍯' : '🟤';
      sp.lastActiveAt = performance.now();
      startPos.set(sp.baseX, sp.baseY + 2.2, sp.z);
    } else {
      const side = targetRacer.x >= 0 ? 1 : -1;
      startPos.set(side * (trackW / 2 + 3.2), 2.8, targetRacer.z + 2);
    }

    const count = kind === 'tomato' ? 3 : 1;
    for (let k = 0; k < count; k++) {
      const mesh = makeProjectileMesh(kind);
      mesh.position.copy(startPos);
      mesh.visible = k === 0;
      group.add(mesh);
      projectiles.push({
        kind,
        mesh,
        start: startPos.clone().add(new THREE.Vector3(0, k * 0.25, (k - 1) * 0.7)),
        target: targetRacer,
        delay: k * 0.13,
        t: 0,
        dur: kind === 'tomato' ? 0.62 : 0.78,
        arcH: kind === 'tomato' ? 6.5 + k * 0.9 : 8.5,
        isMain: k === 0,
        onImpact,
      });
    }
  }

  function clearProjectiles() {
    for (const p of projectiles) group.remove(p.mesh);
    projectiles.length = 0;
  }

  function resetPositions() {
    clearProjectiles();
    for (const sp of list) {
      sp.z = Math.max(0, sp.zOff);
      sp.throwT = 0;
      sp.visual.root.position.set(sp.baseX, sp.baseY, sp.z);
    }
  }

  function update(dt, time, packZ, racing) {
    lastPackZ = packZ;
    // 1) Yalnızca yayına/tribüne katılmış seyirciler sahnede koşar (doldukça birer birer görünürler!)
    for (const sp of list) {
      if (!sp.userId) continue;
      if (sp.spawnPop > 0 && sp.spawnPop < 1) {
        sp.spawnPop = Math.min(1, sp.spawnPop + dt * 3.8);
        const s = 1.98 * (0.25 + 0.75 * (1 - Math.pow(1 - sp.spawnPop, 3)));
        sp.visual.root.scale.setScalar(s);
      } else if (sp.spawnPop >= 1) {
        sp.visual.root.scale.setScalar(1.98);
        sp.spawnPop = 0;
      }
      const goalZ = racing
        ? Math.max(0, Math.min(trackLength - 1.5, packZ + sp.zOff))
        : Math.max(0, Math.min(trackLength - 1.5, packZ + sp.zOff * 0.6));
      const dz = goalZ - sp.z;
      const move = Math.sign(dz) * Math.min(Math.abs(dz), (13.5 * sp.speedMul + Math.abs(dz) * 1.1) * dt);
      sp.z += move;
      const running = Math.abs(move / Math.max(dt, 0.001)) > 1.2;

      sp.runPh += dt * (running ? 14.5 * sp.speedMul : 6.2);
      const ph = sp.runPh;
      if (sp.throwT > 0) sp.throwT = Math.max(0, sp.throwT - dt);

      const bounce = running ? Math.abs(Math.sin(ph)) * 0.34 : Math.abs(Math.sin(ph)) * 0.16;
      const throwJump = sp.throwT > 0.45 ? Math.sin(((sp.throwT - 0.45) / 0.5) * Math.PI) * 0.85 : 0;
      sp.visual.root.position.set(sp.baseX, sp.baseY + bounce + throwJump, sp.z);
      // Fırlatırken piste doğru dön, koşarken öne eğil!
      const baseYaw = sp.side > 0 ? -0.45 : 0.45;
      const throwYaw = sp.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const tw = Math.min(1, sp.throwT * 2.2);
      sp.visual.root.rotation.y = baseYaw + (throwYaw - baseYaw) * tw;
      sp.visual.rig.rotation.x = running ? 0.16 : 0;

      for (const l of sp.visual.legs) {
        l.piv.rotation.x = Math.sin(ph + (l.side > 0 ? 0 : Math.PI)) * (running ? 0.92 : 0.18);
      }
      for (const a of sp.visual.arms) {
        if (sp.throwT > 0) {
          a.piv.rotation.x = -2.4 + Math.sin(sp.throwT * 18) * 0.45;
          a.piv.rotation.z = a.side * 0.45;
        } else {
          a.piv.rotation.x = running ? Math.sin(ph + (a.side > 0 ? Math.PI : 0)) * 0.75 - 0.4 : -2.1 + Math.sin(ph * 1.4 + a.side) * 0.35;
          a.piv.rotation.z = a.side * (running ? 0.35 : 0.55);
        }
      }
    }

    // 2) Fırlatılan 3B sabotaj objeleri (parabolik yörünge → hedef ata isabet!)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay <= 0) p.mesh.visible = true;
        continue;
      }
      p.t += dt;
      const u = Math.min(1, p.t / p.dur);
      const tx = p.target.x;
      const ty = 2.4;
      const tz = p.target.z;
      const x = p.start.x + (tx - p.start.x) * u;
      const z = p.start.z + (tz - p.start.z) * u;
      const y = p.start.y + (ty - p.start.y) * u + Math.sin(u * Math.PI) * p.arcH;
      p.mesh.position.set(x, y, z);
      p.mesh.rotation.x += dt * 11;
      p.mesh.rotation.z += dt * 8;

      if (u >= 1) {
        group.remove(p.mesh);
        projectiles.splice(i, 1);
        if (onBurst) {
          const hex = p.kind === 'tomato' ? 0xff2438 : p.kind === 'honey' ? 0xffb703 : 0x5c361a;
          onBurst(tx, 2.2, tz, hex, p.isMain ? 22 : 10, 8.5);
        }
        if (p.isMain && p.onImpact) p.onImpact(p.target);
      }
    }
  }

  function getNamedSpectators() {
    return list
      .filter((s) => !s.ambient && s.nick)
      .sort((a, b) => {
        // Sıradakiler ve yeni fırlatanlar öncelikli görünsün
        const sa = (a.queuedPos > 0 ? 1000 - a.queuedPos : 0) + (a.throwT > 0 ? 500 : 0);
        const sb = (b.queuedPos > 0 ? 1000 - b.queuedPos : 0) + (b.throwT > 0 ? 500 : 0);
        return sb - sa || b.lastActiveAt - a.lastActiveAt;
      });
  }

  function dispose() {
    clearProjectiles();
    scene.remove(group);
    bodyGeo.dispose(); headGeo.dispose(); eyeWGeo.dispose(); eyeBGeo.dispose();
    limbGeo.dispose(); antGeo.dispose(); jerseyGeo.dispose(); shoulderGeo.dispose();
    collarGeo.dispose(); capDomeGeo.dispose(); capBrimGeo.dispose();
    crownRingGeo.dispose(); crownOrbGeo.dispose();
    tomGeo.dispose(); tomLeafGeo.dispose(); mudGeo.dispose(); honeyJarGeo.dispose(); honeyLidGeo.dispose();
  }

  return {
    ensureUser,
    removeUser,
    removeWhere,
    syncQueue,
    throwProjectile,
    clearProjectiles,
    resetPositions,
    update,
    getNamedSpectators,
    countNamed: () => byUser.size,
    dispose,
  };
}
