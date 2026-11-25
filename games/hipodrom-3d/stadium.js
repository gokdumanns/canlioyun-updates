// 3B Hipodrom Stadyumu: gün batımı gökyüzü kubbesi, biçilmiş çim desenli saha,
// dokulu toprak pist, çitler, çatılı ve ampullü tribünler, bitiş kemeri ve 3B pist objeleri.
import * as THREE from 'three';

function makeCanvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

function makeSkyDome() {
  const tex = makeCanvasTex(32, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#0a0e29');
    g.addColorStop(0.35, '#1b1d4a');
    g.addColorStop(0.54, '#5a2b56');
    g.addColorStop(0.66, '#d96b43');
    g.addColorStop(0.75, '#f6b365');
    g.addColorStop(1.0, '#1a1524');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(210, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  return dome;
}

function makeTrackTexture(laneCount) {
  return makeCanvasTex(1024, 1024, (c, w, h) => {
    // Zengin sıcak hipodrom toprağı + şerit izleri
    c.fillStyle = '#9b6440'; c.fillRect(0, 0, w, h);
    const lw = w / laneCount;
    for (let i = 0; i < laneCount; i++) {
      const g = c.createLinearGradient(i * lw, 0, (i + 1) * lw, 0);
      g.addColorStop(0, 'rgba(65,35,18,0.22)');
      g.addColorStop(0.5, 'rgba(225,175,130,0.08)');
      g.addColorStop(1, 'rgba(65,35,18,0.22)');
      c.fillStyle = g; c.fillRect(i * lw, 0, lw, h);
    }
    // Toynak izleri ve ince kum dokusu
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = i % 3 === 0 ? 'rgba(235,190,145,0.16)' : 'rgba(52,26,12,0.2)';
      c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 6 + Math.random() * 14);
    }
    // İnce kesikli beyaz kulvar şeritleri
    c.strokeStyle = 'rgba(255,248,236,0.58)';
    c.lineWidth = 5;
    c.setLineDash([42, 34]);
    for (let i = 1; i < laneCount; i++) {
      const x = i * lw;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    }
  });
}

function makeGrassTexture() {
  return makeCanvasTex(512, 512, (c, w, h) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#1f6434' : '#26733d';
      c.fillRect(0, (i * h) / 8, w, h / 8);
    }
    for (let i = 0; i < 6000; i++) {
      c.fillStyle = i % 2 ? 'rgba(10,35,15,0.15)' : 'rgba(130,210,120,0.08)';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 5);
    }
  }, [24, 34]);
}

function makeCheckerTexture() {
  return makeCanvasTex(256, 64, (c) => {
    const s = 16;
    for (let y = 0; y < 64; y += s) for (let x = 0; x < 256; x += s) {
      c.fillStyle = ((x / s + y / s) % 2) ? '#14141c' : '#fffaf0';
      c.fillRect(x, y, s, s);
    }
  }, [4, 1]);
}

export function createStadium(scene, { laneCount = 7, laneWidth = 3.05, trackLength = 420 }) {
  const group = new THREE.Group();
  scene.add(group);
  const trackW = laneCount * laneWidth;
  const totalLen = trackLength + 120;

  // Gün batımı / akşamüstü stadyum gökyüzü kubbesi (kamerayı takip eder)
  const sky = makeSkyDome();
  group.add(sky);

  // Şeritli biçilmiş stadyum çimi
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(260, totalLen + 100),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.9 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, trackLength / 2);
  grass.receiveShadow = true;
  group.add(grass);

  // Dokulu toprak pist
  const dirtTex = makeTrackTexture(laneCount);
  dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
  dirtTex.repeat.set(1, totalLen / 18);
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(trackW, totalLen),
    new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.88 }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0, trackLength / 2 + 12);
  track.receiveShadow = true;
  group.add(track);

  // Alçak beyaz pist çitleri (koşan seyircileri kapatmaz!)
  const railMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.35, metalness: 0.1 });
  const postGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.92, 8);
  for (const s of [-1, 1]) {
    const rx = s * (trackW / 2 + 0.42);
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, totalLen), railMat);
    bar1.position.set(rx, 0.78, trackLength / 2 + 12); bar1.castShadow = true; group.add(bar1);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, totalLen), railMat);
    bar2.position.set(rx, 0.4, trackLength / 2 + 12); group.add(bar2);
    for (let z = -16; z <= trackLength + 48; z += 10) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(rx, 0.46, z); group.add(post);
    }
  }

  // Mimari Stadyum Tribünleri + Parlak Koşucu Seyirci Terası (çitin hemen dibinde — koşan seyirciler çok net seçilir!)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x22263d, roughness: 0.72 });
  const walkMat1 = new THREE.MeshStandardMaterial({ color: 0x3b486b, roughness: 0.62 });
  const walkMat2 = new THREE.MeshStandardMaterial({ color: 0x2d3756, roughness: 0.68 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x16192c, roughness: 0.45, metalness: 0.35 });
  const warmLed = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa62b, emissiveIntensity: 1.05 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xffc857, emissiveIntensity: 3.6 });
  const crowdDots = [];

  for (const s of [-1, 1]) {
    // 1. ve 2. kademe Seyirci Koşu Terası (pist kenarının hemen yanında!)
    const walk1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, trackLength + 60), walkMat1);
    walk1.position.set(s * (trackW / 2 + 1.85), 0.325, trackLength / 2);
    walk1.receiveShadow = true;
    group.add(walk1);
    const walk2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.55, trackLength + 60), walkMat2);
    walk2.position.set(s * (trackW / 2 + 3.85), 0.775, trackLength / 2);
    walk2.receiveShadow = true;
    group.add(walk2);

    const sx = s * (trackW / 2 + 6.4);
    // Arka kademeli üst tribünler
    for (let tier = 0; tier < 3; tier++) {
      const h = 2.5 + tier * 1.25;
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, trackLength + 50), standMat);
      step.position.set(sx + s * tier * 2.2, h / 2, trackLength / 2);
      step.receiveShadow = true;
      group.add(step);
      for (let z = -6; z <= trackLength + 10; z += 4.2) {
        crowdDots.push({ x: sx + s * tier * 2.2, y: h, z: z + (Math.random() - 0.5) * 1.1, side: s, ph: Math.random() * 6 });
      }
    }
    // Tribün çatısı & ince ön ışıklı şerit
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.45, trackLength + 54), roofMat);
    roof.position.set(sx + s * 3.0, 11.0, trackLength / 2);
    roof.rotation.z = -s * 0.16;
    group.add(roof);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, trackLength + 56), warmLed);
    led.position.set(s * (trackW / 2 + 0.88), 0.68, trackLength / 2);
    group.add(led);

    // Çatı altında sıcak stadyum ampulleri
    for (let z = -4; z <= trackLength + 20; z += 14) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), bulbMat);
      bulb.position.set(s * (trackW / 2 + 5.6), 9.8, z);
      group.add(bulb);
    }

    // Yüksek projektör kuleleri
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b4159, metalness: 0.65, roughness: 0.35 });
    for (let z = 12; z <= trackLength + 16; z += 56) {
      const px = s * (trackW / 2 + 15.5);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 25, 8), poleMat);
      pole.position.set(px, 12.5, z); group.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.9), bulbMat);
      lamp.position.set(px - s * 1.2, 24.5, z); lamp.rotation.z = s * 0.45; group.add(lamp);
    }
  }

  // ---- HAYVANLAR ALEMİ TRİBÜNÜ (7 Farklı 3B Hayvan Türü · Vertex-Colored InstancedMesh · 60 FPS!) ----
  function mergeColoredParts(parts) {
    const posArr = [], normArr = [], colArr = [];
    const tmpCol = new THREE.Color();
    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const vPos = new THREE.Vector3();
    const vScale = new THREE.Vector3();

    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      vPos.set(...(p.pos || [0, 0, 0]));
      euler.set(...(p.rot || [0, 0, 0]));
      quat.setFromEuler(euler);
      vScale.set(...(p.scale || [1, 1, 1]));
      mat4.compose(vPos, quat, vScale);
      g.applyMatrix4(mat4);
      g.computeVertexNormals();
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      tmpCol.setHex(p.color);
      for (let i = 0; i < pos.count; i++) {
        posArr.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normArr.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        colArr.push(tmpCol.r, tmpCol.g, tmpCol.b);
      }
      g.dispose();
      p.geo.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    return merged;
  }

  function makeAnimalGeo(kind) {
    const S = (r) => new THREE.SphereGeometry(r, 9, 8);
    const C = (rt, rb, h) => new THREE.CylinderGeometry(rt, rb, h, 8);
    const K = (r, h) => new THREE.ConeGeometry(r, h, 7);
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const parts = [];

    // Ortak tezahürat gövdesi & havaya kalkmış kollar (+Z yönü piste bakar!)
    const addBase = (bodyCol, armCol) => {
      parts.push({ geo: C(0.34, 0.44, 0.85), pos: [0, 0.44, 0], color: bodyCol });
      parts.push({ geo: C(0.11, 0.13, 0.56), pos: [-0.46, 0.78, 0.08], rot: [0.35, 0, 0.48], color: armCol });
      parts.push({ geo: C(0.11, 0.13, 0.56), pos: [0.46, 0.78, 0.08], rot: [0.35, 0, -0.48], color: armCol });
    };
    const addEyes = (y, z, x = 0.16, r = 0.065) => {
      parts.push({ geo: S(r), pos: [-x, y, z], color: 0x111520 });
      parts.push({ geo: S(r), pos: [x, y, z], color: 0x111520 });
    };

    if (kind === 'panda') {
      addBase(0x222633, 0x1c1f2b);
      parts.push({ geo: S(0.42), pos: [0, 1.18, 0], color: 0xfafcff });
      parts.push({ geo: S(0.16), pos: [-0.32, 1.54, -0.02], color: 0x1a1c24 }); // siyah kulaklar
      parts.push({ geo: S(0.16), pos: [0.32, 1.54, -0.02], color: 0x1a1c24 });
      parts.push({ geo: S(0.12), pos: [-0.16, 1.21, 0.35], scale: [1.1, 0.85, 0.5], color: 0x1a1c24 }); // göz halkaları
      parts.push({ geo: S(0.12), pos: [0.16, 1.21, 0.35], scale: [1.1, 0.85, 0.5], color: 0x1a1c24 });
      parts.push({ geo: S(0.045), pos: [-0.16, 1.22, 0.41], color: 0xffffff });
      parts.push({ geo: S(0.045), pos: [0.16, 1.22, 0.41], color: 0xffffff });
      parts.push({ geo: S(0.08), pos: [0, 1.07, 0.40], color: 0x1a1c24 }); // burun
    } else if (kind === 'bear') {
      addBase(0xe63946, 0x8d5524);
      parts.push({ geo: S(0.43), pos: [0, 1.18, 0], color: 0x8d5524 });
      parts.push({ geo: S(0.16), pos: [-0.32, 1.53, -0.02], color: 0x6f3f18 });
      parts.push({ geo: S(0.16), pos: [0.32, 1.53, -0.02], color: 0x6f3f18 });
      parts.push({ geo: S(0.18), pos: [0, 1.08, 0.36], scale: [1.15, 0.85, 0.8], color: 0xf1d0a8 }); // krem ağız
      parts.push({ geo: S(0.075), pos: [0, 1.11, 0.49], color: 0x1e1612 });
      addEyes(1.24, 0.37);
    } else if (kind === 'rabbit') {
      addBase(0x4ea8de, 0xf7f5f0);
      parts.push({ geo: S(0.40), pos: [0, 1.16, 0], color: 0xf9f7f4 });
      // Uzun dik tavşan kulakları!
      parts.push({ geo: C(0.09, 0.11, 0.62), pos: [-0.18, 1.72, -0.02], rot: [0, 0, 0.14], color: 0xf9f7f4 });
      parts.push({ geo: C(0.09, 0.11, 0.62), pos: [0.18, 1.72, -0.02], rot: [0, 0, -0.14], color: 0xf9f7f4 });
      parts.push({ geo: C(0.045, 0.055, 0.45), pos: [-0.18, 1.72, 0.06], rot: [0, 0, 0.14], color: 0xff8fab });
      parts.push({ geo: C(0.045, 0.055, 0.45), pos: [0.18, 1.72, 0.06], rot: [0, 0, -0.14], color: 0xff8fab });
      parts.push({ geo: S(0.08), pos: [0, 1.10, 0.39], color: 0xff7597 }); // pembe burun
      addEyes(1.22, 0.35);
    } else if (kind === 'fox') {
      addBase(0x7209b7, 0xf77f00);
      parts.push({ geo: S(0.40), pos: [0, 1.16, 0], scale: [1.08, 0.92, 1.0], color: 0xf77f00 });
      parts.push({ geo: K(0.16, 0.40), pos: [-0.26, 1.56, 0], rot: [0, 0, 0.2], color: 0xf77f00 }); // sivri tilki kulakları
      parts.push({ geo: K(0.16, 0.40), pos: [0.26, 1.56, 0], rot: [0, 0, -0.2], color: 0xf77f00 });
      parts.push({ geo: K(0.15, 0.30), pos: [0, 1.07, 0.44], rot: [Math.PI / 2, 0, 0], color: 0xfff8ee }); // beyaz burun
      parts.push({ geo: S(0.065), pos: [0, 1.07, 0.59], color: 0x141414 });
      addEyes(1.22, 0.36);
    } else if (kind === 'frog') {
      addBase(0xffb703, 0x38b000);
      parts.push({ geo: S(0.42), pos: [0, 1.14, 0], scale: [1.18, 0.82, 1.02], color: 0x38b000 });
      // Kafanın üstünde kocaman pörtlek kurbağa gözleri!
      parts.push({ geo: S(0.19), pos: [-0.23, 1.48, 0.14], color: 0x70e000 });
      parts.push({ geo: S(0.19), pos: [0.23, 1.48, 0.14], color: 0x70e000 });
      parts.push({ geo: S(0.13), pos: [-0.23, 1.50, 0.26], color: 0xffffff });
      parts.push({ geo: S(0.13), pos: [0.23, 1.50, 0.26], color: 0xffffff });
      parts.push({ geo: S(0.075), pos: [-0.23, 1.50, 0.35], color: 0x0b0e16 });
      parts.push({ geo: S(0.075), pos: [0.23, 1.50, 0.35], color: 0x0b0e16 });
      parts.push({ geo: B(0.46, 0.08, 0.12), pos: [0, 1.04, 0.40], color: 0xff5ca8 }); // gülen ağız
    } else if (kind === 'duck') {
      addBase(0x00b4d8, 0xffd60a);
      parts.push({ geo: S(0.41), pos: [0, 1.18, 0], color: 0xffd60a });
      parts.push({ geo: K(0.11, 0.24), pos: [0, 1.62, 0], color: 0xffbe0b }); // tepedeki tüy
      parts.push({ geo: B(0.32, 0.14, 0.34), pos: [0, 1.09, 0.44], color: 0xfb5607 }); // turuncu gaga
      addEyes(1.26, 0.36);
    } else {
      // İnek (cow)
      addBase(0x2ec4b6, 0xf8f9fa);
      parts.push({ geo: S(0.42), pos: [0, 1.18, 0], color: 0xf8f9fa });
      parts.push({ geo: S(0.20), pos: [0.22, 1.32, 0.12], color: 0x1d2029 }); // siyah benek
      parts.push({ geo: K(0.08, 0.28), pos: [-0.24, 1.58, 0], rot: [0, 0, 0.3], color: 0xffd166 }); // küçük boynuzlar
      parts.push({ geo: K(0.08, 0.28), pos: [0.24, 1.58, 0], rot: [0, 0, -0.3], color: 0xffd166 });
      parts.push({ geo: B(0.44, 0.26, 0.26), pos: [0, 1.04, 0.38], color: 0xff99ac }); // büyük pembe inek burnu
      addEyes(1.26, 0.37);
    }
    return mergeColoredParts(parts);
  }

  const SPECIES = ['panda', 'bear', 'rabbit', 'fox', 'frog', 'duck', 'cow'];
  const animalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.05 });
  const animalBuckets = SPECIES.map(() => []);
  crowdDots.forEach((d, i) => {
    const spIdx = (i * 5 + Math.floor(Math.abs(d.z))) % SPECIES.length;
    animalBuckets[spIdx].push(d);
  });

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const animalMeshes = SPECIES.map((sp, idx) => {
    const items = animalBuckets[idx];
    const geo = makeAnimalGeo(sp);
    const mesh = new THREE.InstancedMesh(geo, animalMat, Math.max(1, items.length));
    items.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(0, d.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      dummy.scale.setScalar(1.32);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    group.add(mesh);
    return { mesh, items };
  });

  // Başlangıç Çizgisi + 3B Mekanik Kulvar Kapıları (Start Makinesi!)
  const checker = makeCheckerTexture();
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(trackW, 1.8), new THREE.MeshBasicMaterial({ map: checker }));
  startLine.rotation.x = -Math.PI / 2; startLine.position.set(0, 0.02, 0); group.add(startLine);

  const gateDoors = [];
  const steelM = new THREE.MeshStandardMaterial({ color: 0xe6ecf5, metalness: 0.72, roughness: 0.28 });
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(trackW + 1.8, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0xd92638, roughness: 0.4, metalness: 0.3 }));
  gateTop.position.set(0, 4.9, 1.6); gateTop.castShadow = true; group.add(gateTop);
  for (let i = 0; i <= laneCount; i++) {
    const px = -trackW / 2 + i * laneWidth;
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.9, 2.8), steelM);
    div.position.set(px, 2.45, 0.4); div.castShadow = true; group.add(div);
    if (i < laneCount) {
      const cx = px + laneWidth / 2;
      const halfW = laneWidth * 0.46;
      for (const s of [-1, 1]) {
        const piv = new THREE.Group();
        piv.position.set(cx + s * (laneWidth / 2 - 0.1), 1.4, 1.65);
        const door = new THREE.Mesh(new THREE.BoxGeometry(halfW, 2.1, 0.09), steelM);
        door.position.set(-s * halfW / 2, 0, 0);
        door.castShadow = true;
        piv.add(door);
        group.add(piv);
        gateDoors.push({ piv, side: s });
      }
    }
  }
  let gateOpenAmt = 0, gateTarget = 0;
  function setGatesOpen(open, instant = false) {
    gateTarget = open ? 1 : 0;
    if (instant) {
      gateOpenAmt = gateTarget;
      for (const d of gateDoors) d.piv.rotation.y = d.side * gateOpenAmt * 1.48;
    }
  }

  const finLine = new THREE.Mesh(new THREE.PlaneGeometry(trackW, 2.8), new THREE.MeshBasicMaterial({ map: checker }));
  finLine.rotation.x = -Math.PI / 2; finLine.position.set(0, 0.03, trackLength); group.add(finLine);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9e00, emissiveIntensity: 0.7, metalness: 0.88, roughness: 0.22 });
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 11.5, 14), goldMat);
    pillar.position.set(s * (trackW / 2 + 1.2), 5.75, trackLength); pillar.castShadow = true; group.add(pillar);
  }
  const archBanner = new THREE.Mesh(new THREE.BoxGeometry(trackW + 3.6, 2.1, 0.9), new THREE.MeshBasicMaterial({ map: checker }));
  archBanner.position.set(0, 10.8, trackLength); group.add(archBanner);
  for (let i = -5; i <= 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), bulbMat);
    b.position.set((i / 5) * (trackW / 2 + 1), 12.05, trackLength); group.add(b);
  }

  // ---- 3B PİST OBJELERİ (Altın Havuç, Hız Bandı, Çamur) ----
  const props = [];
  const laneX = (lane) => (lane - (laneCount - 1) / 2) * laneWidth;

  function spawnProp(kind, lane, z) {
    const x = laneX(lane);
    let mesh;
    if (kind === 'carrot') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.35, 12), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9e00, emissiveIntensity: 2.2, metalness: 0.5 }));
      body.rotation.x = Math.PI; body.position.y = 1.4; g.add(body);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x22d07a, emissive: 0x22d07a, emissiveIntensity: 1.0 }));
      leaf.position.y = 2.18; g.add(leaf);
      mesh = g;
    } else if (kind === 'boost') {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(laneWidth * 0.74, 0.12, 3.6),
        new THREE.MeshStandardMaterial({ color: 0x25f4ee, emissive: 0x25f4ee, emissiveIntensity: 2.8 }),
      );
      mesh.position.y = 0.06;
    } else if (kind === 'banana') {
      const g = new THREE.Group();
      const peelMat = new THREE.MeshStandardMaterial({ color: 0xffe135, emissive: 0xffb703, emissiveIntensity: 0.9, roughness: 0.35 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x4a2c10, roughness: 0.7 });
      // 3 yana kıvrılmış parlak sarı muz kabuğu yaprağı
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.78, 0),
          new THREE.Vector3(Math.cos(a) * 0.35, 0.56, Math.sin(a) * 0.35),
          new THREE.Vector3(Math.cos(a) * 0.78, 0.18, Math.sin(a) * 0.78),
          new THREE.Vector3(Math.cos(a) * 0.98, 0.24, Math.sin(a) * 0.98),
        ]);
        const petal = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.13, 8, false), peelMat);
        petal.castShadow = true;
        g.add(petal);
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.28, 8), tipMat);
      stem.position.y = 0.88;
      g.add(stem);
      mesh = g;
    } else if (kind === 'honey') {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.65, 0.14, 18),
        new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xff8800, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.15 }),
      );
      mesh.position.y = 0.07;
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.55, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0x3b2214, roughness: 0.25, metalness: 0.1 }),
      );
      mesh.position.y = 0.06;
    }
    mesh.position.x = x; mesh.position.z = z;
    group.add(mesh);
    props.push({ kind, lane, z, mesh, active: true });
  }

  function populateTrackProps() {
    for (const p of props) group.remove(p.mesh);
    props.length = 0;
    for (let z = 42; z < trackLength - 32; z += 38) {
      const lane = Math.floor(Math.random() * laneCount);
      const kind = ['carrot', 'boost', 'mud'][Math.floor(Math.random() * 3)];
      spawnProp(kind, lane, z + (Math.random() - 0.5) * 10);
    }
  }

  // ---- 3B PARÇACIK HAVUZU ----
  const MAX_P = 320;
  const pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_P);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(pMesh);
  const particles = [];

  function burst(x, y, z, hex, count = 14, speed = 8) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_P) particles.shift();
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x, y, z,
        vx: Math.cos(a) * speed * (0.3 + Math.random() * 0.7),
        vy: Math.random() * speed,
        vz: Math.sin(a) * speed * (0.3 + Math.random() * 0.7),
        life: 0.45 + Math.random() * 0.55,
        scale: 0.55 + Math.random() * 1.0,
        hex,
      });
    }
  }

  function update(dt, time, camZ = 0) {
    sky.position.set(0, 0, camZ);
    // Start kapıları yaylı şekilde açılıp kapanır
    if (Math.abs(gateTarget - gateOpenAmt) > 0.002) {
      gateOpenAmt += (gateTarget - gateOpenAmt) * Math.min(1, dt * 14);
      for (const d of gateDoors) d.piv.rotation.y = d.side * gateOpenAmt * 1.48;
    }
    // Hayvanlar alemi tribünde Meksika dalgasıyla zıplayıp sallanarak tezahürat yapar!
    for (const am of animalMeshes) {
      const { mesh, items } = am;
      for (let i = 0; i < items.length; i++) {
        const d = items[i];
        const wave = Math.sin(time * 5.6 + d.z * 0.22 + d.ph);
        dummy.position.set(d.x, d.y + Math.abs(wave) * 0.42, d.z);
        dummy.rotation.set(0, d.side > 0 ? -Math.PI / 2 : Math.PI / 2, wave * 0.14);
        dummy.scale.setScalar(1.32);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (const p of props) {
      if (p.active && p.kind === 'carrot') {
        p.mesh.rotation.y = time * 3;
        p.mesh.position.y = Math.sin(time * 4) * 0.25;
      } else if (p.active && p.kind === 'banana') {
        p.mesh.rotation.y = time * 1.8;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= 14 * dt;
      p.x += p.vx * dt; p.y = Math.max(0.1, p.y + p.vy * dt); p.z += p.vz * dt;
    }
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < MAX_P; i++) {
      const p = particles[i];
      if (p) {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.scale * Math.min(1, p.life * 2));
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

  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) {
        if (m.map) m.map.dispose();
        if (m.dispose) m.dispose();
      }
    });
    scene.remove(group);
  }

  return { group, props, laneX, spawnProp, populateTrackProps, setGatesOpen, burst, update, dispose };
}
