// 3B Dolunaylı Akdeniz Kumsalı: dalgalı deniz, ay yakamozu, orta kamp ateşi, mangal + sucuklar,
// bakır semaver, palmiyeler, ampul dizisi, dev dalga, pike yapan 3B martı ve dilek fenerleri!
import * as THREE from 'three';

function makeCanvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

function makeSkyDome() {
  const tex = makeCanvasTex(32, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#040817');
    g.addColorStop(0.32, '#0c1838');
    g.addColorStop(0.55, '#1d325c');
    g.addColorStop(0.68, '#3f365c');
    g.addColorStop(0.77, '#874c56');
    g.addColorStop(1.0, '#0b1020');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  return new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
}

function makeSandTex() {
  return makeCanvasTex(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9e7d54');
    g.addColorStop(0.45, '#cfa974');
    g.addColorStop(1, '#d9b582');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      c.fillStyle = i % 3 === 0 ? 'rgba(255,244,218,0.16)' : 'rgba(92,62,32,0.12)';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, [6, 6]);
}

function makePalmTree(scale = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, 3.2, 0.2),
    new THREE.Vector3(1.1, 6.4, 0.5),
    new THREE.Vector3(1.8, 9.2, 0.9),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.34, 8, false), trunkMat);
  trunk.castShadow = true;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(1.8, 9.2, 0.9);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d6b3a, roughness: 0.72, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.95, 4.6, 4), leafMat);
    frond.scale.set(1.0, 1.0, 0.16);
    frond.rotation.z = -1.15;
    frond.rotation.y = a;
    frond.position.set(Math.cos(a) * 1.9, -0.35, Math.sin(a) * 1.9);
    crown.add(frond);
  }
  // 3 hindistan cevizi
  const cocoMat = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const cc = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), cocoMat);
    cc.position.set(Math.cos(a) * 0.35, -0.3, Math.sin(a) * 0.35);
    crown.add(cc);
  }
  g.add(crown);
  g.scale.setScalar(scale);
  return { root: g, crown };
}

export function createBeach(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // 1) Akdeniz Gece Gökyüzü + Yıldızlar + Parlayan Dolunay!
  group.add(makeSkyDome());

  const starPos = [];
  for (let i = 0; i < 320; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const r = 135;
    starPos.push(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r + 12, Math.sin(phi) * Math.sin(theta) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6dc, size: 0.85, fog: false })));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5.8, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xfff6d6, emissive: 0xffe49e, emissiveIntensity: 1.8, fog: false }),
  );
  moon.position.set(-2.5, 16.5, -68);
  group.add(moon);

  // 2) Kumsal Zemini (kıyı çizgisi z = -8.2'de temiz biter, arkası tamamen Akdeniz!)
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 34, 24, 14),
    new THREE.MeshStandardMaterial({ map: makeSandTex(), roughness: 0.92 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, 8.8);
  sand.receiveShadow = true;
  group.add(sand);

  // 3) Hareketli Akdeniz Denizi + Yakamoz + Köpük Şeridi
  const seaGeo = new THREE.PlaneGeometry(140, 88, 44, 28);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x0a5380,
    emissive: 0x04233d,
    emissiveIntensity: 0.85,
    roughness: 0.28,
    metalness: 0.16,
    envMapIntensity: 0.3,
  });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(0, -0.08, -51.5);
  group.add(sea);

  // Ay yakamozu (deniz üstünde parlayan altın-gümüş ışık yolu!)
  const shimmer = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 56),
    new THREE.MeshBasicMaterial({ color: 0xffe8a3, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(-2.4, 0.08, -36);
  group.add(shimmer);

  // Kıyı köpüğü
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 1.8),
    new THREE.MeshBasicMaterial({ color: 0xe6faff, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.04, -8.2);
  group.add(foam);

  // Dev Dalga / Tsunami 3B Silindiri (big_wave sabotajında denizden kumsala kabarır!)
  const bigWaveGroup = new THREE.Group();
  const waveBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 2.3, 34, 16, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x168aad, emissive: 0x0c4a6e, emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.88 }),
  );
  waveBody.rotation.z = Math.PI / 2;
  bigWaveGroup.add(waveBody);
  const waveCrest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.8, 34, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0fdff, emissive: 0xa5f3fc, emissiveIntensity: 1.1, roughness: 0.4 }),
  );
  waveCrest.rotation.z = Math.PI / 2;
  waveCrest.position.set(0, 1.55, 0.9);
  bigWaveGroup.add(waveCrest);
  bigWaveGroup.visible = false;
  group.add(bigWaveGroup);
  let waveState = { active: false, t: 0, dur: 2.8, hitDone: false, onHit: null };

  // 4) MERKEZİ 3B KAMP ATEŞİ (taş çember + çapraz odunlar + dinamik alev + ışık!)
  const fireGroup = new THREE.Group();
  group.add(fireGroup);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5c5b63, roughness: 0.88 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), stoneMat);
    st.scale.set(1.15, 0.72, 1.0);
    st.position.set(Math.cos(a) * 1.48, 0.18, Math.sin(a) * 1.48);
    st.rotation.y = a;
    st.castShadow = true;
    fireGroup.add(st);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2010, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.0, 8), logMat);
    log.position.set(Math.cos(a) * 0.45, 0.35, Math.sin(a) * 0.45);
    log.rotation.z = 0.95;
    log.rotation.y = a;
    fireGroup.add(log);
  }
  const emberBed = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.25, 0.2, 14),
    new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff3300, emissiveIntensity: 2.2, roughness: 0.7 }),
  );
  emberBed.position.y = 0.1;
  fireGroup.add(emberBed);

  const flames = new THREE.Group();
  const f1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.82, 2.15, 9),
    new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.92 }),
  );
  f1.position.y = 1.15;
  const f2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.54, 1.65, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.95 }),
  );
  f2.position.set(0.14, 1.0, 0.08);
  const f3 = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 1.15, 7),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
  );
  f3.position.set(-0.1, 0.78, -0.06);
  flames.add(f1, f2, f3);
  fireGroup.add(flames);

  const fireLight = new THREE.PointLight(0xff8c2b, 26, 26, 1.5);
  fireLight.position.set(0, 2.4, 0);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(1024, 1024);
  fireGroup.add(fireLight);

  // Kütük oturaklar (ateş çemberinin etrafında 4 dekoratif kumsal kütüğü)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 3.2, 10), logMat);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = -a + Math.PI / 2;
    bench.position.set(Math.cos(a) * 5.2, 0.28, Math.sin(a) * 5.2);
    bench.receiveShadow = true;
    group.add(bench);
  }

  // 5) SAĞ İSTASYON: 3B KÖMÜR MANGALI + SUCUKLAR + BAKIR SEMAVER
  const mangalPos = new THREE.Vector3(4.9, 0, 1.1);
  const mangalGroup = new THREE.Group();
  mangalGroup.position.copy(mangalPos);
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x222630, metalness: 0.72, roughness: 0.42 });
  const mBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 1.1), ironMat);
  mBox.position.y = 1.15; mBox.castShadow = true; mangalGroup.add(mBox);
  for (const [lx, lz] of [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 6), ironMat);
    leg.position.set(lx, 0.57, lz); mangalGroup.add(leg);
  }
  const mCoal = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.14, 0.92),
    new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff2200, emissiveIntensity: 2.1 }),
  );
  mCoal.position.y = 1.36; mangalGroup.add(mCoal);

  // 6 adet cızırdayan sucuk/köfte şişi!
  const sucukMeshes = [];
  const sucukMat = new THREE.MeshStandardMaterial({ color: 0xa82818, emissive: 0x450904, emissiveIntensity: 0.4, roughness: 0.35 });
  const pepperMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), i % 3 === 2 ? pepperMat : sucukMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(-0.7 + i * 0.28, 1.48, 0);
    mangalGroup.add(s);
    sucukMeshes.push(s);
  }
  group.add(mangalGroup);

  // Bakır Semaver (mangalın hemen yanında!)
  const semaverGroup = new THREE.Group();
  semaverGroup.position.set(5.4, 0, -1.7);
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97b38, metalness: 0.85, roughness: 0.25 });
  const semBody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 1.35, 16), copperMat);
  semBody.position.y = 0.72; semBody.castShadow = true; semaverGroup.add(semBody);
  const semTop = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.22 }));
  semTop.position.y = 1.62; semaverGroup.add(semTop);
  const semChim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 10), copperMat);
  semChim.position.set(-0.32, 1.5, 0); semaverGroup.add(semChim);
  group.add(semaverGroup);

  // 6) PALMİYELER + SICAK SAHİL AMPUL DİZİSİ + SÖRF TAHTASI
  const palms = [];
  for (const [px, pz, ry, sc] of [[-9.2, -3.5, 0.4, 1.05], [9.5, -3.0, 2.5, 1.0], [-10.5, 5.5, 0.9, 0.9], [10.8, 5.0, 2.2, 0.95]]) {
    const p = makePalmTree(sc);
    p.root.position.set(px, 0, pz);
    p.root.rotation.y = ry;
    group.add(p.root);
    palms.push(p);
  }

  // Ahşap direkler arası parlayan sıcak ampul dizisi (Bloom ile büyülü sahil ambiyansı!)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3c20, roughness: 0.85 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xffb703, emissiveIntensity: 3.4 });
  const poles = [[-7.6, -5.2], [7.6, -5.2], [-8.4, 3.2], [8.4, 3.2]];
  for (const [x, z] of poles) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.6, 8), poleMat);
    pole.position.set(x, 2.8, z); group.add(pole);
  }
  const addLights = (pA, pB, count = 11) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pA[0], 5.3, pA[1]),
      new THREE.Vector3((pA[0] + pB[0]) / 2, 4.35, (pA[1] + pB[1]) / 2),
      new THREE.Vector3(pB[0], 5.3, pB[1]),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.025, 5, false), new THREE.MeshBasicMaterial({ color: 0x1a1a22 })));
    for (let i = 1; i < count; i++) {
      const pt = curve.getPoint(i / count);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), bulbMat);
      b.position.copy(pt);
      b.position.y -= 0.14;
      group.add(b);
    }
  };
  addLights(poles[0], poles[1], 13);
  addLights(poles[0], poles[2], 7);
  addLights(poles[1], poles[3], 7);

  // Sol kumsalda dikili sörf tahtası
  const surf = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 2.2, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x25f4ee, emissive: 0x0b7285, emissiveIntensity: 0.25, roughness: 0.25 }),
  );
  surf.scale.set(1, 1, 0.22);
  surf.position.set(-7.1, 1.35, -3.4);
  surf.rotation.set(0.18, 0.45, -0.14);
  group.add(surf);

  // 7) 3B DİLEK FENERLERİ (Gökyüzüne süzülen isimli altın kağıt fenerler!)
  const lanterns = [];
  const lanternGeo = new THREE.CylinderGeometry(0.38, 0.28, 0.68, 10, 1, true);
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff8800, emissiveIntensity: 2.6, side: THREE.DoubleSide });
  const lanternCoreGeo = new THREE.SphereGeometry(0.14, 8, 6);
  const lanternCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff8dc });

  function spawnLantern(nick = '') {
    const lg = new THREE.Group();
    lg.add(new THREE.Mesh(lanternGeo, lanternMat));
    const core = new THREE.Mesh(lanternCoreGeo, lanternCoreMat);
    core.position.y = -0.16; lg.add(core);
    const headAnchor = new THREE.Object3D();
    headAnchor.position.y = 0.58; lg.add(headAnchor);
    const x = (Math.random() - 0.5) * 11;
    const z = -2 + (Math.random() - 0.5) * 7;
    lg.position.set(x, 2.2 + Math.random() * 1.5, z);
    group.add(lg);
    lanterns.push({
      mesh: lg, headAnchor, nick,
      x0: x, z0: z,
      vy: 1.4 + Math.random() * 0.7,
      ph: Math.random() * 6,
      life: 16,
    });
    if (lanterns.length > 18) {
      const old = lanterns.shift();
      group.remove(old.mesh);
    }
  }

  // 8) 3B MARTI BASKINI (Gökten pike yapıp mangaldaki sucuğu kapıp kaçar!)
  const gull = new THREE.Group();
  const gullWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const gullWingMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 });
  const gullBeakMat = new THREE.MeshStandardMaterial({ color: 0xff9e00, roughness: 0.4 });
  const gullBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 6, 12), gullWhite);
  gullBody.rotation.x = Math.PI / 2; gull.add(gullBody);
  const gullHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gullWhite);
  gullHead.position.set(0, 0.14, 0.52); gull.add(gullHead);
  const gullBeak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 6), gullBeakMat);
  gullBeak.rotation.x = Math.PI / 2; gullBeak.position.set(0, 0.12, 0.78); gull.add(gullBeak);
  const stolenSucuk = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.44, 4, 8), sucukMat);
  stolenSucuk.rotation.z = Math.PI / 2; stolenSucuk.position.set(0, 0.02, 0.85); stolenSucuk.visible = false; gull.add(stolenSucuk);

  const gullWingL = new THREE.Group(); gullWingL.position.set(-0.22, 0.1, 0.05);
  const wlM = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.55), gullWingMat); wlM.position.x = -0.82; gullWingL.add(wlM); gull.add(gullWingL);
  const gullWingR = new THREE.Group(); gullWingR.position.set(0.22, 0.1, 0.05);
  const wrM = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.55), gullWingMat); wrM.position.x = 0.82; gullWingR.add(wrM); gull.add(gullWingR);
  gull.scale.setScalar(1.35);
  gull.visible = false;
  group.add(gull);

  let gullState = { active: false, t: 0, dur: 2.6, stolen: false, onSteal: null };

  function triggerSeagull(onSteal) {
    gullState = { active: true, t: 0, dur: 2.6, stolen: false, onSteal };
    stolenSucuk.visible = false;
    gull.visible = true;
  }

  function triggerWave(onHit) {
    waveState = { active: true, t: 0, dur: 2.9, hitDone: false, onHit };
    bigWaveGroup.visible = true;
  }

  function setSucukCount(n) {
    sucukMeshes.forEach((m, i) => { m.visible = i < n; });
  }

  // 9) 3B PARÇACIK HAVUZU (Kıvılcım, Duman, Dalga Köpüğü, Havai Fişek)
  const MAX_P = 320;
  const pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_P);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(pMesh);
  const particles = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  function burst(x, y, z, hex, count = 14, speed = 6, gravity = 10) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_P) particles.shift();
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x, y, z,
        vx: Math.cos(a) * speed * (0.25 + Math.random() * 0.75),
        vy: Math.random() * speed,
        vz: Math.sin(a) * speed * (0.25 + Math.random() * 0.75),
        life: 0.55 + Math.random() * 0.65,
        scale: 0.5 + Math.random() * 0.95,
        gravity,
        hex,
      });
    }
  }

  let emberTimer = 0;

  function update(dt, time, fireLevel = 1.0) {
    // 1) Dalgalı deniz animasyonu
    const seaPos = seaGeo.attributes.position;
    for (let i = 0; i < seaPos.count; i++) {
      const sx = seaPos.getX(i);
      const sz = seaPos.getZ(i);
      seaPos.setY(i, Math.sin(sx * 0.18 + time * 1.6) * 0.24 + Math.cos(sz * 0.22 + time * 1.3) * 0.2);
    }
    seaPos.needsUpdate = true;
    foam.position.z = -8.2 + Math.sin(time * 1.4) * 0.65;
    shimmer.material.opacity = 0.2 + Math.sin(time * 2.2) * 0.06;

    // 2) Palmiye esintisi
    palms.forEach((p, idx) => {
      p.crown.rotation.z = Math.sin(time * 1.3 + idx) * 0.06;
    });

    // 3) Kamp ateşi titreşimi & gücü
    const fl = Math.max(0.25, fireLevel);
    flames.scale.set(
      (0.85 + Math.sin(time * 14) * 0.1) * Math.sqrt(fl),
      (0.9 + Math.cos(time * 17) * 0.14) * fl,
      (0.85 + Math.sin(time * 13 + 1) * 0.1) * Math.sqrt(fl),
    );
    flames.rotation.y = time * 1.8;
    fireLight.intensity = (20 + Math.sin(time * 16) * 3.5) * fl;
    emberBed.material.emissiveIntensity = 1.6 + fl * 0.9 + Math.sin(time * 10) * 0.25;

    // Yükselen ateş kıvılcımları + mangal dumanı
    emberTimer -= dt;
    if (emberTimer <= 0) {
      emberTimer = 0.08;
      burst((Math.random() - 0.5) * 0.8, 1.3, (Math.random() - 0.5) * 0.8, Math.random() < 0.6 ? 0xffb703 : 0xff5400, 1, 2.2, -2.5);
      if (Math.random() < 0.55) {
        burst(mangalPos.x + (Math.random() - 0.5) * 1.2, 1.65, mangalPos.z + (Math.random() - 0.5) * 0.6, 0xdbe4ee, 1, 1.3, -1.8);
      }
    }

    // 4) Dev Dalga animasyonu
    if (waveState.active) {
      waveState.t += dt;
      const u = waveState.t / waveState.dur;
      if (u >= 1) {
        waveState.active = false;
        bigWaveGroup.visible = false;
      } else {
        // Denizden (-16) kumsala (+5.5) yükselip vurur, sonra çekilir!
        const surge = Math.sin(u * Math.PI);
        bigWaveGroup.position.set(0, 0.35 + surge * 1.6, -16 + surge * 21.5);
        bigWaveGroup.scale.set(1, 0.55 + surge * 0.8, 0.7 + surge * 0.5);
        if (Math.random() < 0.7) burst((Math.random() - 0.5) * 14, 1.4, bigWaveGroup.position.z + 1.2, 0xe0faff, 3, 5.5, 11);
        if (!waveState.hitDone && u >= 0.45) {
          waveState.hitDone = true;
          if (waveState.onHit) waveState.onHit();
        }
      }
    }

    // 5) Pike Yapan 3B Martı animasyonu
    if (gullState.active) {
      gullState.t += dt;
      const u = gullState.t / gullState.dur;
      if (u >= 1) {
        gullState.active = false;
        gull.visible = false;
      } else {
        // Sol gökyüzünden mangalın (4.9, 1.8, 1.1) üstüne pike yapıp sağ denize kaçar!
        const p0 = new THREE.Vector3(-12, 11.5, -6);
        const p1 = new THREE.Vector3(mangalPos.x, 1.85, mangalPos.z);
        const p2 = new THREE.Vector3(14, 12.0, -8);
        const cur = new THREE.Vector3();
        if (u < 0.5) {
          const t2 = u * 2;
          cur.lerpVectors(p0, p1, t2);
          cur.y -= Math.sin(t2 * Math.PI) * 1.4;
        } else {
          const t2 = (u - 0.5) * 2;
          cur.lerpVectors(p1, p2, t2);
          cur.y += Math.sin(t2 * Math.PI) * 1.5;
        }
        gull.position.copy(cur);
        gull.lookAt(u < 0.5 ? p1 : p2);
        const flap = Math.sin(time * 22) * 0.65;
        gullWingL.rotation.z = flap;
        gullWingR.rotation.z = -flap;
        if (!gullState.stolen && u >= 0.48) {
          gullState.stolen = true;
          stolenSucuk.visible = true;
          burst(mangalPos.x, 1.8, mangalPos.z, 0xffd166, 16, 7, 10);
          if (gullState.onSteal) gullState.onSteal();
        }
      }
    }

    // 6) Yükselen Dilek Fenerleri
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const l = lanterns[i];
      l.life -= dt;
      if (l.life <= 0) {
        group.remove(l.mesh);
        lanterns.splice(i, 1);
        continue;
      }
      l.mesh.position.y += l.vy * dt;
      l.mesh.position.x = l.x0 + Math.sin(time * 0.9 + l.ph) * 0.9;
      l.mesh.position.z = l.z0 + Math.cos(time * 0.7 + l.ph) * 0.7;
      l.mesh.rotation.y = time * 0.5 + l.ph;
    }

    // 7) Parçacıklar
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y = Math.max(0.08, p.y + p.vy * dt); p.z += p.vz * dt;
    }
    for (let i = 0; i < MAX_P; i++) {
      const p = particles[i];
      if (p) {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.scale * Math.min(1, p.life * 1.8));
        dummy.updateMatrix();
        pMesh.setMatrixAt(i, dummy.matrix);
        col.setHex(p.hex);
        pMesh.setColorAt(i, col);
      } else {
        dummy.position.set(0, -100, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
        pMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    pMesh.instanceMatrix.needsUpdate = true;
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }

  return {
    group,
    mangalPos,
    lanterns,
    spawnLantern,
    triggerSeagull,
    triggerWave,
    setSucukCount,
    burst,
    update,
    dispose: () => scene.remove(group),
  };
}
