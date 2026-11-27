// Yüksek kaliteli prosedürel 3B At + Hamam Böceği Jokey (Kadın/Erkek kıyafetleri) + Fantastik Modifiyeler.
// Kutu/küre yerine LatheGeometry, TubeGeometry, ExtrudeGeometry, RoundedBoxGeometry ve prosedürel PBR dokular kullanılır.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const LANES = [
  { name: 'KIRMIZI', hex: 0xff3b5c, css: '#ff3b5c', num: '1', coat: '#8b4220', coat2: '#5c260e', mane: '#1f0e06' },
  { name: 'MAVİ',    hex: 0x2f8cff, css: '#2f8cff', num: '2', coat: '#24222b', coat2: '#121118', mane: '#0a0a0f' },
  { name: 'YEŞİL',   hex: 0x22d07a, css: '#22d07a', num: '3', coat: '#ede8e0', coat2: '#cfc6ba', mane: '#b8afa2' },
  { name: 'SARI',    hex: 0xffc833, css: '#ffc833', num: '4', coat: '#c98e3b', coat2: '#9a631d', mane: '#fff1cc' },
  { name: 'MOR',     hex: 0xb55cff, css: '#b55cff', num: '5', coat: '#5c2b29', coat2: '#381515', mane: '#1c0909' },
  { name: 'TURUNCU', hex: 0xff8c24, css: '#ff8c24', num: '6', coat: '#707885', coat2: '#464d59', mane: '#1f232b' },
  { name: 'TURKUAZ', hex: 0x25f4ee, css: '#25f4ee', num: '7', coat: '#2b4a64', coat2: '#16293a', mane: '#d9fbff' },
];

// ---------- prosedürel PBR dokular (önbellekli) ----------
const texCache = new Map();
function makeTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const coatTexture = (c1, c2) => makeTex(`coat_${c1}_${c2}`, 256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c1); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // İnce tüy yönü ve hafif benek dokusu
  for (let i = 0; i < 2400; i++) {
    x.fillStyle = i % 3 === 0 ? 'rgba(255,240,220,0.06)' : 'rgba(20,8,0,0.08)';
    x.fillRect(Math.random() * w, Math.random() * h, 2, 7);
  }
  for (let i = 0; i < 45; i++) {
    x.fillStyle = 'rgba(255,255,255,0.045)';
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 0, Math.PI * 2); x.fill();
  }
});

const chitinTexture = () => makeTex('chitin', 256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8a3d1a'); g.addColorStop(0.5, '#6d2c10'); g.addColorStop(1, '#3d1506');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // Kabuk segment bantları ve organik benekler
  for (let i = 1; i < 6; i++) {
    const y = (h * i) / 6;
    const bg = x.createLinearGradient(0, y - 10, 0, y + 6);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.7, 'rgba(22,6,0,0.52)'); bg.addColorStop(1, 'rgba(255,200,145,0.2)');
    x.fillStyle = bg; x.fillRect(0, y - 10, w, 16);
  }
  for (let i = 0; i < 400; i++) {
    x.fillStyle = i % 3 ? 'rgba(30,8,0,0.12)' : 'rgba(255,210,160,0.07)';
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, Math.PI * 2); x.fill();
  }
});

const blanketTexture = (css, num) => makeTex(`blk_${css}_${num}`, 256, 256, (x, w, h) => {
  x.fillStyle = css; x.fillRect(0, 0, w, h);
  // Kapitone dikiş deseni
  x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 2;
  for (let i = -h; i < w + h; i += 28) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
    x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke();
  }
  // Altın kenar şeridi
  x.strokeStyle = '#ffd166'; x.lineWidth = 14; x.strokeRect(10, 10, w - 20, h - 20);
  // Numara dairesi
  x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, h / 2, 54, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#1a1a2e'; x.lineWidth = 5; x.stroke();
  x.fillStyle = '#111'; x.font = '900 72px "Segoe UI", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(num, w / 2, h / 2 + 4);
});

const dressTexture = (base) => makeTex(`dress_${base}`, 256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, base); g.addColorStop(1, '#a01858');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // Parlak çiçek/puantiye deseni ve altın etek ucu
  for (let i = 0; i < 120; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,245,210,0.45)' : 'rgba(255,190,225,0.35)';
    x.beginPath(); x.arc(Math.random() * w, Math.random() * (h - 32), 3 + Math.random() * 5, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#ffd166'; x.fillRect(0, h - 22, w, 10);
  x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(0, h - 9, w, 9);
});

const vestTexture = (css) => makeTex(`vest_${css}`, 256, 256, (x, w, h) => {
  x.fillStyle = css; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < w; i += 48) x.fillRect(i, 0, 22, h);
  x.fillStyle = '#ffd166'; x.fillRect(0, h - 18, w, 10);
});

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.08, ...o });
const glow = (color, intensity = 2.2, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.2, ...extra });

// Eğri tüp yardımcı
function curvedTube(pts, r, segs = 14, radSegs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, segs, r, radSegs, false);
}

// Zarif kıvrımlı Pegasus tüy kanadı (ExtrudeGeometry)
function makeWingMesh(side, matMain, matTip) {
  const g = new THREE.Group();
  const layers = [
    { len: 1.85, w: 0.34, y: 0.24, z: 0.05, rotY: 0.08, rotZ: 0.28, tip: true },
    { len: 1.68, w: 0.32, y: 0.14, z: -0.18, rotY: 0.24, rotZ: 0.18, tip: false },
    { len: 1.45, w: 0.3,  y: 0.04, z: -0.4,  rotY: 0.42, rotZ: 0.08, tip: false },
    { len: 1.15, w: 0.26, y: -0.04, z: -0.58, rotY: 0.62, rotZ: -0.02, tip: false },
  ];
  layers.forEach((l) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(side * l.len * 0.55, l.w * 0.9, side * l.len, l.w * 0.15);
    sh.quadraticCurveTo(side * l.len * 0.6, -l.w * 0.45, 0, -l.w * 0.35);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const m = new THREE.Mesh(geo, l.tip ? matTip : matMain);
    m.position.set(0, l.y, l.z);
    m.rotation.set(0.18, -side * l.rotY, side * l.rotZ);
    m.castShadow = true;
    g.add(m);
  });
  return g;
}

// ---------- Hamam Böceği Jokey (organik kabuk + kıvrık antenler + detaylı kadın/erkek kıyafetleri) ----------
export function createRoachJockey(lane) {
  const root = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ map: chitinTexture(), roughness: 0.22, metalness: 0.14, envMapIntensity: 1.6 });
  const darkChitin = std({ color: 0x351406, roughness: 0.28, metalness: 0.15, envMapIntensity: 1.4 });
  const goldMat = std({ color: 0xffd166, metalness: 0.92, roughness: 0.2, envMapIntensity: 1.8 });

  // Organik hamam böceği gövdesi (LatheGeometry ile doğal oval kabuk)
  const bodyPts = [[0, 0], [0.16, 0.04], [0.25, 0.16], [0.27, 0.34], [0.24, 0.52], [0.17, 0.64], [0.06, 0.68], [0, 0.69]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 20), shellMat);
  torso.scale.set(1.0, 1.0, 0.85);
  torso.position.set(0, 0.08, -0.02);
  torso.rotation.x = 0.16;
  torso.castShadow = true;
  root.add(torso);

  // Kafa (pürüzsüz oval + hafif çene)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), shellMat);
  head.position.set(0, 0.84, 0.11);
  head.scale.set(1.05, 0.95, 1.02);
  head.castShadow = true;
  root.add(head);

  // Parlak çizgi film gözleri + göz bebekleri + göz kapakları + gülümseme
  const eyeW = std({ color: 0xffffff, roughness: 0.08, envMapIntensity: 1.4 });
  const eyeB = std({ color: 0x111116, roughness: 0.05, metalness: 0.2 });
  const lidGeo = new THREE.SphereGeometry(0.094, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
  for (const s of [-1, 1]) {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), eyeW);
    ew.position.set(s * 0.088, 0.87, 0.265); root.add(ew);
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), eyeB);
    eb.position.set(s * 0.092, 0.865, 0.335); root.add(eb);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), glow(0xffffff, 1.5));
    glint.position.set(s * 0.075, 0.89, 0.365); root.add(glint);
    const lid = new THREE.Mesh(lidGeo, darkChitin);
    lid.position.set(s * 0.088, 0.87, 0.265); lid.rotation.x = -0.35; root.add(lid);
  }
  const smile = new THREE.Mesh(curvedTube([[-0.07, 0.77, 0.29], [0, 0.745, 0.315], [0.07, 0.77, 0.29]], 0.014, 10, 6), darkChitin);
  root.add(smile);

  // İki zarif kıvrımlı anten (TubeGeometry)
  const antennae = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(s * 0.075, 0.99, 0.16);
    const ant = new THREE.Mesh(
      curvedTube([[0, 0, 0], [s * 0.14, 0.26, 0.12], [s * 0.34, 0.44, 0.04], [s * 0.52, 0.46, -0.18]], 0.016, 14, 6),
      darkChitin,
    );
    piv.add(ant);
    root.add(piv);
    antennae.push(piv);
  }

  // Eklemli böcek kolları (normalde dizgin tutar, ayakta şov yaparken iki yana açılıp sallanır!)
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(s * 0.19, 0.62, 0.04);
    const arm = new THREE.Mesh(curvedTube([[0, 0, 0], [s * 0.07, -0.08, 0.2], [0, -0.05, 0.42]], 0.028, 10, 6), darkChitin);
    piv.add(arm);
    root.add(piv);
    arms.push({ piv, side: s });
    for (let k = 0; k < 2; k++) {
      const leg = new THREE.Mesh(curvedTube([[s * 0.21, 0.34 - k * 0.11, -0.02], [s * 0.38, 0.28 - k * 0.1, 0.04], [s * 0.36, 0.05 - k * 0.05, 0.08]], 0.024, 10, 6), darkChitin);
      root.add(leg);
    }
  }
  // Ayakta dururken atın sırtına basan dik bacaklar
  const standLegs = new THREE.Group();
  for (const s of [-1, 1]) {
    const sl = new THREE.Mesh(curvedTube([[s * 0.14, 0.1, 0], [s * 0.18, -0.16, 0.02], [s * 0.16, -0.44, 0.05]], 0.03, 8, 6), darkChitin);
    standLegs.add(sl);
  }
  standLegs.visible = false;
  root.add(standLegs);

  // Halat / kement çıkış noktası (sağ el)
  const handAnchor = new THREE.Object3D();
  handAnchor.position.set(0.28, 0.68, 0.38);
  root.add(handAnchor);

  // ---- KADIN KIYAFETİ (Fit Binici Ceketi, Bel Kemeri + Fiyonk, Dalgalı At Kuyruğu Saç, İnci & Taç — SIFIR HUNİ!) ----
  const female = new THREE.Group();
  const dressCol = lane.css === '#ff3b5c' ? '#ff4da6' : '#f74b9a';
  const femaleJacketMat = std({ map: dressTexture(dressCol), roughness: 0.48 });
  const whiteCollarMat = std({ color: 0xf8fafc, roughness: 0.4 });
  const bowMat = std({ color: 0xffd166, roughness: 0.35, metalness: 0.25 });
  const hairMat = std({ color: 0x3b1f12, roughness: 0.55 });

  // Fit dar binici ceketi (huni gibi açılan etek yerine şık atletik bel kesimi!)
  const fTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.28, 8, 16), femaleJacketMat);
  fTop.position.set(0, 0.46, -0.01); fTop.scale.set(1.02, 1.0, 0.88); fTop.castShadow = true;
  female.add(fTop);
  for (const s of [-1, 1]) {
    const fSh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), femaleJacketMat);
    fSh.position.set(s * 0.22, 0.62, 0.01); female.add(fSh);
  }
  const fCollar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 8, 18), whiteCollarMat);
  fCollar.position.set(0, 0.70, 0.02); fCollar.rotation.x = Math.PI / 2;
  female.add(fCollar);
  // Altın bel kemeri + arkadan çok şirin görünen kurdele fiyonk!
  const fBelt = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.028, 8, 20), goldMat);
  fBelt.position.set(0, 0.30, -0.01); fBelt.rotation.x = Math.PI / 2; fBelt.scale.set(1.02, 0.88, 1);
  female.add(fBelt);
  for (const s of [-1, 1]) {
    const bowWing = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), bowMat);
    bowWing.position.set(s * 0.095, 0.31, -0.25); bowWing.scale.set(1.3, 0.75, 0.5);
    female.add(bowWing);
  }
  // Arkaya doğru dalgalanan uzun at kuyruğu saç (arkadan kadın/erkek anında ayırt edilir!)
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hairCap.position.set(0, 0.88, 0.07);
  female.add(hairCap);
  const ponytail = new THREE.Mesh(
    curvedTube([[0, 0.90, -0.13], [0, 0.82, -0.34], [0, 0.56, -0.44], [0, 0.34, -0.38]], 0.075, 12, 8),
    hairMat,
  );
  ponytail.castShadow = true;
  female.add(ponytail);
  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.022, 6, 14), bowMat);
  hairTie.position.set(0, 0.89, -0.15);
  female.add(hairTie);
  // Gerçek halka prenses tacı + parlayan yakut taş
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 8, 18), goldMat);
  crownRing.position.set(0, 1.07, 0.09); crownRing.rotation.x = Math.PI / 2 - 0.14;
  female.add(crownRing);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), glow(0xff2d75, 2.2));
  gem.position.set(0, 1.11, 0.24); female.add(gem);
  // İnci kolye
  const pearlM = std({ color: 0xfff8f0, roughness: 0.12, metalness: 0.15, envMapIntensity: 1.5 });
  for (let i = 0; i < 9; i++) {
    const a = -1.0 + (i / 8) * 2.0;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), pearlM);
    p.position.set(Math.sin(a) * 0.21, 0.67, 0.05 + Math.cos(a) * 0.16); female.add(p);
  }
  root.add(female);

  // ---- ERKEK KIYAFETİ (Pro Jokey Ceketi, Gerçek Yarış Kaskı + Beyaz Şerit, Krom Gözlük, Pala Bıyık!) ----
  const male = new THREE.Group();
  const maleJacketMat = std({ map: vestTexture(lane.css), roughness: 0.46 });
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.255, 0.30, 8, 16), maleJacketMat);
  vest.position.set(0, 0.46, -0.01); vest.scale.set(1.06, 1.0, 0.9); vest.castShadow = true;
  male.add(vest);
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), maleJacketMat);
    sh.position.set(s * 0.24, 0.63, 0); male.add(sh);
  }
  const mCollar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 8, 18), whiteCollarMat);
  mCollar.position.set(0, 0.70, 0.02); mCollar.rotation.x = Math.PI / 2;
  male.add(mCollar);
  const mBelt = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 8, 20), std({ color: 0x1a1412, roughness: 0.4 }));
  mBelt.position.set(0, 0.29, -0.01); mBelt.rotation.x = Math.PI / 2; mBelt.scale.set(1.05, 0.9, 1);
  male.add(mBelt);
  // Gerçek profesyonel at yarışı jokey kaskı (kulvar renginde parlak kubbe + beyaz yarış şeridi + ön siperlik!)
  const helmetMat = std({ color: lane.hex, roughness: 0.18, metalness: 0.18, envMapIntensity: 1.4 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMat);
  helmet.position.set(0, 0.90, 0.09); helmet.castShadow = true;
  male.add(helmet);
  const hStripe = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.22, 0.44), whiteCollarMat);
  hStripe.position.set(0, 1.04, 0.09);
  male.add(hStripe);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.035, 14, 1, false, -0.85, 1.7), std({ color: 0x161a24, roughness: 0.35 }));
  visor.position.set(0, 0.94, 0.17); visor.rotation.x = 0.14;
  male.add(visor);
  // Metalik güneş gözlüğü
  const glassM = std({ color: 0x0c1424, roughness: 0.05, metalness: 0.92, envMapIntensity: 2.2 });
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.075, 0.035, 3, 0.02), glassM);
    lens.position.set(s * 0.088, 0.87, 0.335); male.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), goldMat);
  bridge.position.set(0, 0.88, 0.34); bridge.rotation.z = Math.PI / 2; male.add(bridge);
  // Kıvrık pala bıyık (TubeGeometry)
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(curvedTube([[0, 0.77, 0.315], [s * 0.08, 0.785, 0.33], [s * 0.16, 0.755, 0.31], [s * 0.21, 0.795, 0.28]], 0.022, 10, 6), std({ color: 0x160a04, roughness: 0.6 }));
    male.add(st);
  }
  root.add(male);

  const setGender = (g) => { female.visible = g === 'f'; male.visible = g !== 'f'; };
  setGender('m');

  // ---- 3B BÜYÜK ANADOLU DAVULU & ZURNASI (Her açıdan net seçilen dev şov enstrümanları!) ----
  const woodMat = std({ color: 0x8b4513, roughness: 0.42, metalness: 0.08 });
  const drumRedMat = std({ color: 0xd92638, roughness: 0.36, metalness: 0.14 });
  const skinMat = std({ color: 0xfff3d1, emissive: 0xffe4a0, emissiveIntensity: 0.18, roughness: 0.52 });
  const ropeMat = std({ color: 0xffd166, roughness: 0.55 });

  const davulGroup = new THREE.Group();
  // Büyük kırmızı-altın işlemeli Anadolu davulu (sağ-ön tarafa belirgin taşar — arkadan bile anında görünür!)
  const drumShell = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.42, 20), drumRedMat);
  drumShell.rotation.z = Math.PI / 2;
  drumShell.position.set(0.30, 0.52, 0.30);
  drumShell.castShadow = true;
  davulGroup.add(drumShell);
  for (const s of [-1, 1]) {
    const headSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.035, 20), skinMat);
    headSkin.rotation.z = Math.PI / 2;
    headSkin.position.set(0.30 + s * 0.215, 0.52, 0.30);
    davulGroup.add(headSkin);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.565, 0.032, 8, 22), goldMat);
    hoop.rotation.y = Math.PI / 2;
    hoop.position.set(0.30 + s * 0.195, 0.52, 0.30);
    davulGroup.add(hoop);
  }
  // Çapraz davul ipi desenleri
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 5), ropeMat);
    cord.position.set(0.30, 0.52 + Math.cos(a) * 0.56, 0.30 + Math.sin(a) * 0.56);
    cord.rotation.z = Math.PI / 2 + (i % 2 ? 0.24 : -0.24);
    davulGroup.add(cord);
  }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 6, 18), ropeMat);
  strap.position.set(0.14, 0.62, 0.12);
  strap.rotation.set(0.4, 0.35, 0);
  davulGroup.add(strap);
  // Dev şok dalgası halkası (her vuruşta patlar!)
  const dPulse = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.032, 8, 20), glow(0xffd166, 2.8));
  dPulse.rotation.y = Math.PI / 2;
  dPulse.position.set(0.54, 0.52, 0.30);
  davulGroup.add(dPulse);
  // Sağ elde büyük eğri tokmak
  const tokmakPiv = new THREE.Group();
  tokmakPiv.position.set(0.62, 0.78, 0.26);
  const tStick = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.56, 8), woodMat);
  tStick.position.set(0.10, -0.22, 0.08); tStick.rotation.set(0.3, 0, -0.42);
  tokmakPiv.add(tStick);
  const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skinMat);
  tHead.position.set(0.22, -0.46, 0.16);
  tokmakPiv.add(tHead);
  davulGroup.add(tokmakPiv);
  // Sol elde uzun ince ritim çubuğu
  const cubukPiv = new THREE.Group();
  cubukPiv.position.set(-0.08, 0.76, 0.26);
  const cStick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.62, 6), ropeMat);
  cStick.position.set(-0.10, -0.22, 0.08); cStick.rotation.set(0.3, 0, 0.46);
  cubukPiv.add(cStick);
  davulGroup.add(cubukPiv);
  davulGroup.visible = false;
  root.add(davulGroup);

  // 3B DEV ANADOLU ZURNASI (Nefeslik diski + konik parlak ahşap gövde + nota delikleri + geniş altın çan ağız + kırmızı püskül!)
  const zurnaWoodMat = std({ color: 0xe07a18, emissive: 0x8a3808, emissiveIntensity: 0.34, roughness: 0.26, metalness: 0.16 });
  const zurnaBoreMat = std({ color: 0x160904, roughness: 0.9 });
  const zurnaGroup = new THREE.Group();
  zurnaGroup.position.set(0.06, 0.82, 0.24);
  const zPivot = new THREE.Group();
  // Yukarı-sağa gururla uzanan 1.32m dev zurna (her açıdan apacık seçilir!)
  zPivot.rotation.set(-0.56, 0.44, -0.32);
  // 1) Ağızlık & metal nefeslik diski (z = 0.02..0.14)
  const zReed = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.14, 10), goldMat);
  zReed.rotation.x = Math.PI / 2;
  zReed.position.set(0, 0, 0.06);
  zPivot.add(zReed);
  const zDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.024, 16), goldMat);
  zDisc.rotation.x = Math.PI / 2;
  zDisc.position.set(0, 0, 0.11);
  zPivot.add(zDisc);
  // 2) Konik gövde (CylinderGeometry radiusTop = +Y -> +Z'ye genişler, radiusBottom = -Y -> ağızlıkta ince!)
  const zTube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.036, 0.96, 16), zurnaWoodMat);
  zTube.rotation.x = Math.PI / 2;
  zTube.position.set(0, 0, 0.60);
  zTube.castShadow = true;
  zPivot.add(zTube);
  // 3) Altın zurna bilezikleri & üstte siyah nota delikleri
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056 + k * 0.017, 0.014, 6, 14), goldMat);
    ring.position.set(0, 0, 0.28 + k * 0.22);
    zPivot.add(ring);
  }
  for (let k = 0; k < 5; k++) {
    const hz = 0.34 + k * 0.13;
    const hr = 0.052 + k * 0.012;
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), zurnaBoreMat);
    hole.position.set(0, hr, hz);
    zPivot.add(hole);
  }
  // 4) Genişleyen altın zurna ağzı (bell: +Z ucu geniş 0.26, gövde bağlantısı 0.11!)
  const zBell = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.11, 0.28, 18), goldMat);
  zBell.rotation.x = Math.PI / 2;
  zBell.position.set(0, 0, 1.21);
  zPivot.add(zBell);
  const zBellRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.024, 8, 20), glow(0xffd166, 1.8));
  zBellRim.position.set(0, 0, 1.35);
  zPivot.add(zBellRim);
  const zBore = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), zurnaBoreMat);
  zBore.position.set(0, 0, 1.355);
  zPivot.add(zBore);
  // 5) Zurnadan sarkan kırmızı ipek püskül
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 8), drumRedMat);
  tassel.position.set(0, -0.22, 1.02);
  zPivot.add(tassel);
  // Ağızdan fışkıran parlayan altın ses halkaları
  const zPulse = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.034, 8, 18), glow(0xffd166, 3.2));
  zPulse.position.set(0, 0, 1.34);
  zPivot.add(zPulse);
  zurnaGroup.add(zPivot);
  zurnaGroup.visible = false;
  root.add(zurnaGroup);

  return { root, antennae, arms, standLegs, handAnchor, davulGroup, dPulse, tokmakPiv, cubukPiv, zurnaGroup, zPulse, setGender };
}

// ---------- Organik 3B At + Fantastik Modifiyeler ----------
export function createRacer(laneIdx) {
  const lane = LANES[laneIdx];
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const coat = new THREE.MeshStandardMaterial({ map: coatTexture(lane.coat, lane.coat2), roughness: 0.46, metalness: 0.06, envMapIntensity: 0.9 });
  const maneM = std({ color: lane.mane, roughness: 0.72 });
  const leatherM = std({ color: 0x3b1d0d, roughness: 0.42, metalness: 0.1 });
  const goldM = std({ color: 0xffd166, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.8 });
  const hoofM = std({ color: 0x1a1412, roughness: 0.32, metalness: 0.15 });

  // ---- AT GÖVDESİ (organik kaslı göğüs + sağrı + bel) ----
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), coat);
  chest.scale.set(0.92, 0.98, 1.15); chest.position.set(0, 1.62, 0.56); chest.castShadow = true; chest.receiveShadow = true;
  bodyRoot.add(chest);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.85, 10, 18), coat);
  belly.rotation.x = Math.PI / 2; belly.position.set(0, 1.56, 0); belly.castShadow = true; belly.receiveShadow = true;
  bodyRoot.add(belly);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), coat);
  haunch.scale.set(0.95, 1.0, 1.18); haunch.position.set(0, 1.62, -0.58); haunch.castShadow = true; haunch.receiveShadow = true;
  bodyRoot.add(haunch);

  // Kapitone yarış örtüsü (numaralı!) & yumuşak deri eyer
  const blanket = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.48, 0.96, 4, 0.12), std({ map: blanketTexture(lane.css, lane.num), roughness: 0.55 }));
  blanket.position.set(0, 1.72, -0.05); blanket.castShadow = true;
  bodyRoot.add(blanket);
  const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.18, 0.72, 4, 0.08), leatherM);
  saddle.position.set(0, 2.0, -0.05); saddle.castShadow = true;
  bodyRoot.add(saddle);

  // ---- KAVİSLİ BOYUN + HEYKELSİ AT BAŞI (kutu değil!) ----
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 1.84, 0.82);
  bodyRoot.add(neckGroup);

  const neckPts = [[0.36, 0], [0.33, 0.25], [0.27, 0.6], [0.21, 0.92], [0.16, 1.05]].map(([x, y]) => new THREE.Vector2(x, y));
  const neck = new THREE.Mesh(new THREE.LatheGeometry(neckPts, 18), coat);
  neck.scale.set(0.85, 1.0, 1.18); neck.rotation.x = 0.55; neck.castShadow = true;
  neckGroup.add(neck);

  // Kıvrımlı yele bukleleri
  const normalMane = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const tuft = new THREE.Mesh(
      curvedTube([[0, 0.15 + t * 0.78, -0.02 + t * 0.42], [0, 0.24 + t * 0.78, -0.2 + t * 0.42], [0, 0.14 + t * 0.78, -0.34 + t * 0.42]], 0.085 - t * 0.02, 8, 6),
      maneM,
    );
    normalMane.add(tuft);
  }
  neckGroup.add(normalMane);

  // Organik at başı: yuvarlak kafatası + incelen yüz + kadifemsi burun
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), coat);
  cranium.scale.set(0.92, 0.95, 1.2); cranium.position.set(0, 0.86, 0.56); cranium.castShadow = true;
  neckGroup.add(cranium);
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.58, 14), coat);
  bridge.rotation.x = 1.92; bridge.position.set(0, 0.72, 0.86); bridge.castShadow = true;
  neckGroup.add(bridge);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), std({ color: 0x3b2a24, roughness: 0.65 }));
  muzzle.scale.set(0.95, 0.85, 1.12); muzzle.position.set(0, 0.6, 1.12);
  neckGroup.add(muzzle);

  // Kulaklar, parlak gözler ve deri gem + altın tokalar
  const bridle = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.022, 8, 18), leatherM);
  bridle.position.set(0, 0.66, 1.0); bridle.rotation.x = 0.45; neckGroup.add(bridle);
  const eyeW = std({ color: 0xffffff, roughness: 0.08 }), eyeB = std({ color: 0x111116, roughness: 0.05 });
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.28, 10), coat);
    ear.position.set(s * 0.14, 1.14, 0.46); ear.rotation.set(0.18, 0, -s * 0.22); neckGroup.add(ear);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 10), eyeW);
    ew.position.set(s * 0.2, 0.9, 0.72); neckGroup.add(ew);
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), eyeB);
    eb.position.set(s * 0.245, 0.9, 0.75); neckGroup.add(eb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12), goldM);
    ring.position.set(s * 0.17, 0.64, 1.02); ring.rotation.y = Math.PI / 2; neckGroup.add(ring);
    // Hamam böceğinin eline uzanan kıvrık dizgin
    const rein = new THREE.Mesh(curvedTube([[s * 0.17, 0.64, 1.02], [s * 0.25, 0.6, 0.45], [s * 0.18, 0.76, -0.4]], 0.015, 10, 6), leatherM);
    neckGroup.add(rein);
  }

  // Kıvrımlı savrulan kuyruk (TubeGeometry)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 1.72, -1.16);
  const tail = new THREE.Mesh(curvedTube([[0, 0, 0], [0, -0.18, -0.36], [0, -0.62, -0.58], [0, -1.02, -0.45]], 0.12, 12, 8), maneM);
  tail.castShadow = true; tailPivot.add(tail);
  bodyRoot.add(tailPivot);

  // 4 Eklemli Bacak (kalça/omuz + diz + incik + toynak)
  const legs = [];
  const legPos = [[-0.34, 1.32, 0.64], [0.34, 1.32, 0.64], [-0.34, 1.32, -0.64], [0.34, 1.32, -0.64]];
  legPos.forEach(([lx, ly, lz], i) => {
    const piv = new THREE.Group();
    piv.position.set(lx, ly, lz);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.52, 8, 12), coat);
    upper.position.y = -0.3; upper.castShadow = true; piv.add(upper);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), coat);
    knee.position.y = -0.62; piv.add(knee);
    const lowerPiv = new THREE.Group();
    lowerPiv.position.y = -0.62;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.48, 8, 10), coat);
    lower.position.y = -0.28; lower.castShadow = true; lowerPiv.add(lower);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.18, 12), hoofM);
    hoof.position.y = -0.58; lowerPiv.add(hoof);
    piv.add(lowerPiv);
    bodyRoot.add(piv);
    legs.push({ piv, lowerPiv, phase: [0, 0.85, Math.PI, Math.PI + 0.85][i], isFront: i < 2 });
  });

  // ---- HAMAM BÖCEĞİ JOKEY (1.38× daha büyük, geniş kamerada bile net ve komik!) ----
  const jockey = createRoachJockey(lane);
  jockey.root.scale.setScalar(1.38);
  jockey.root.position.set(0, 1.98, -0.04);
  bodyRoot.add(jockey.root);

  // 2B projeksiyon için kafa üstü referans noktası
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 4.05, 0.05);
  bodyRoot.add(headAnchor);

  // ---- FANTASTİK MODİFİYELER (Bloom ile parlayan sinematik efektler!) ----
  // 1) Alev Modu: heykelsi alev dilleri + pisti aydınlatan sıcak turuncu PointLight
  const flameGroup = new THREE.Group();
  const fCore = glow(0xffd166, 3.2), fOuter = glow(0xff4d00, 2.8);
  const flamePts = [[0, 0], [0.16, 0.12], [0.12, 0.35], [0.05, 0.58], [0, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
  const flameGeo = new THREE.LatheGeometry(flamePts, 10);
  for (let i = 0; i < 6; i++) {
    const fl = new THREE.Mesh(flameGeo, i % 2 ? fCore : fOuter);
    fl.position.set(0, 2.05 + i * 0.14, 0.68 + i * 0.08);
    fl.rotation.x = -0.7; fl.scale.setScalar(0.85);
    flameGroup.add(fl);
  }
  const fireTail = new THREE.Mesh(flameGeo, fOuter);
  fireTail.position.set(0, 1.66, -1.25); fireTail.rotation.x = -Math.PI / 2 - 0.15; fireTail.scale.set(1.8, 2.3, 1.8);
  flameGroup.add(fireTail);
  const fireLight = new THREE.PointLight(0xff6b1a, 14, 9, 1.8);
  fireLight.position.set(0, 1.4, -0.8);
  flameGroup.add(fireLight);
  flameGroup.visible = false;
  bodyRoot.add(flameGroup);

  // 2) Pegasus Kanatları (kıvrımlı tüy katmanlı zarif melek kanatları + altın hale!)
  const wingsGroup = new THREE.Group();
  const wMain = glow(0xfff5dc, 1.15, { roughness: 0.25 });
  const wTip = glow(0xffd166, 2.0, { metalness: 0.4 });
  const wingL = makeWingMesh(-1, wMain, wTip);
  const wingR = makeWingMesh(1, wMain, wTip);
  wingL.position.set(-0.54, 1.86, 0.35);
  wingR.position.set(0.54, 1.86, 0.35);
  wingsGroup.add(wingL, wingR);
  wingsGroup.visible = false;
  bodyRoot.add(wingsGroup);

  // 3) Yıldırım Zırhı (kırık şimşek yayları + cyan ışık)
  const lightningGroup = new THREE.Group();
  const lGlow = glow(0x25f4ee, 3.2);
  for (let k = 0; k < 2; k++) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 1.18 + (i % 2 ? 0.16 : -0.08);
      pts.push([Math.cos(a) * r, (i % 3 - 1) * 0.15, Math.sin(a) * r * 1.2]);
    }
    const bolt = new THREE.Mesh(curvedTube(pts, 0.032, 24, 6), lGlow);
    bolt.position.set(0, 1.65, 0);
    bolt.rotation.x = k === 0 ? 0.35 : -0.45;
    lightningGroup.add(bolt);
  }
  const boltLight = new THREE.PointLight(0x25f4ee, 14, 9, 1.8);
  boltLight.position.set(0, 1.8, 0);
  lightningGroup.add(boltLight);
  lightningGroup.visible = false;
  bodyRoot.add(lightningGroup);

  // 4) Efsanevi Unicorn (spiral altın boynuz + yumuşak dalgalanan gökkuşağı kurdele!)
  const hornPts = [[0.095, 0], [0.08, 0.25], [0.058, 0.55], [0.032, 0.85], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const horn = new THREE.Mesh(new THREE.LatheGeometry(hornPts, 14), glow(0xffd166, 2.6, { metalness: 0.7 }));
  horn.position.set(0, 1.04, 0.84); horn.rotation.x = 0.82;
  neckGroup.add(horn);

  const rbCv = document.createElement('canvas'); rbCv.width = 64; rbCv.height = 128;
  const rbc = rbCv.getContext('2d');
  const rbg = rbc.createLinearGradient(0, 0, 0, 128);
  ['#ff3b5c', '#ff9e00', '#ffd166', '#22d07a', '#25f4ee', '#b55cff'].forEach((c, i) => rbg.addColorStop(i / 5, c));
  rbc.fillStyle = rbg; rbc.fillRect(0, 0, 64, 128);
  const rbFade = rbc.createLinearGradient(0, 0, 64, 0);
  rbFade.addColorStop(0, 'rgba(0,0,0,1)'); rbFade.addColorStop(1, 'rgba(0,0,0,0)');
  rbc.globalCompositeOperation = 'destination-in'; rbc.fillStyle = rbFade; rbc.fillRect(0, 0, 64, 128);
  const rbTex = new THREE.CanvasTexture(rbCv); rbTex.colorSpace = THREE.SRGBColorSpace;
  const rbGeo = new THREE.PlaneGeometry(3.4, 0.9, 14, 1);
  const rbMesh = new THREE.Mesh(rbGeo, new THREE.MeshBasicMaterial({ map: rbTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  rbMesh.rotation.y = Math.PI / 2;
  rbMesh.position.set(0, 1.62, -2.75);
  bodyRoot.add(rbMesh);
  horn.visible = rbMesh.visible = false;

  // 5) Kristal Buz Bloğu (şeffaf buz kristali — içindeki jokey net görünür)
  const iceBlock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.32, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xa8efff, emissive: 0x0096c7, emissiveIntensity: 0.35, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.34 }),
  );
  iceBlock.scale.set(0.75, 0.95, 1.15);
  iceBlock.position.set(0, 1.55, 0.05);
  iceBlock.visible = false;
  bodyRoot.add(iceBlock);

  // 6) Domates Şapırtısı & Yapışkan Bal Efekti (tribünden gelen sabotajlarda görünür!)
  const tomatoSplat = new THREE.Group();
  const tomMat = std({ color: 0xe6192e, emissive: 0x7a0814, emissiveIntensity: 0.35, roughness: 0.18 });
  for (const [x, y, z, r] of [[0, 0.85, 0.28, 0.22], [-0.14, 0.72, 0.24, 0.14], [0.16, 0.92, 0.22, 0.13], [0.05, 0.52, 0.27, 0.15]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), tomMat);
    b.scale.set(1.1, 1.1, 0.42);
    b.position.set(x, y, z);
    tomatoSplat.add(b);
  }
  tomatoSplat.visible = false;
  jockey.root.add(tomatoSplat);

  const honeyRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.18, 10, 22),
    std({ color: 0xffb703, emissive: 0xff9500, emissiveIntensity: 0.95, roughness: 0.15, transparent: true, opacity: 0.88 }),
  );
  honeyRing.rotation.x = Math.PI / 2;
  honeyRing.position.set(0, 0.22, 0);
  honeyRing.visible = false;
  bodyRoot.add(honeyRing);

  function updateVisual(dt, time, state) {
    const { speed, mods, frozen, standUntil = 0, spinT = 0, tomatoUntil = 0, honeyUntil = 0, davulUntil = 0, zurnaUntil = 0 } = state;
    const isFlame = time < mods.flame;
    const isPegasus = time < mods.pegasus;
    const isLightning = time < mods.lightning;
    const isUnicorn = time < mods.unicorn;
    const isFrozen = time < frozen;
    const isDavul = time < davulUntil;
    const isZurna = time < zurnaUntil;
    const isStanding = time < standUntil || isDavul || isZurna;
    const isTomato = time < tomatoUntil;
    const isHoney = time < honeyUntil;

    flameGroup.visible = isFlame;
    wingsGroup.visible = isPegasus;
    lightningGroup.visible = isLightning;
    horn.visible = rbMesh.visible = isUnicorn;
    iceBlock.visible = isFrozen;
    tomatoSplat.visible = isTomato;
    honeyRing.visible = isHoney;
    jockey.davulGroup.visible = isDavul;
    jockey.zurnaGroup.visible = isZurna;
    if (isHoney) honeyRing.rotation.z = time * 4;
    if (isDavul) {
      // 136 BPM halay davul tokmak & çubuk vuruşu + şok halkası!
      const beat = time * 14.2;
      jockey.tokmakPiv.rotation.z = Math.sin(beat) * 1.05;
      jockey.cubukPiv.rotation.z = -Math.sin(beat * 2) * 0.85;
      const dp = 0.75 + ((time * 4.5) % 1) * 0.9;
      jockey.dPulse.scale.setScalar(dp);
    }
    if (isZurna) {
      // Düğün zurnacısı gibi sağa sola coşkuyla sallan + ses halkası fışkırsın!
      jockey.zurnaGroup.rotation.y = Math.sin(time * 7.5) * 0.42;
      jockey.zurnaGroup.rotation.z = Math.sin(time * 5.2) * 0.18;
      const p = 0.7 + ((time * 3.8) % 1) * 1.35;
      jockey.zPulse.scale.setScalar(p);
    }

    // Eklemli 4 zamanlı dörtnala animasyonu
    const freq = isFrozen ? 1.2 : 5.2 + speed * 0.34;
    state.animPh = (state.animPh || 0) + dt * freq;
    const ph = state.animPh;

    for (const l of legs) {
      const s = Math.sin(ph + l.phase);
      l.piv.rotation.x = s * (isPegasus ? 0.3 : 0.7);
      l.lowerPiv.rotation.x = l.isFront ? Math.max(0, -s) * 0.95 : Math.min(0, -s) * 0.65;
    }

    const targetY = isPegasus ? 1.75 + Math.sin(time * 4.5) * 0.24 : Math.abs(Math.sin(ph)) * 0.22;
    bodyRoot.position.y += (targetY - bodyRoot.position.y) * Math.min(1, dt * 8);
    bodyRoot.rotation.x = isPegasus ? -0.08 : Math.sin(ph) * 0.06;
    // Muz kabuğunda kayınca komik 360° dönüş!
    bodyRoot.rotation.y = spinT > 0 ? spinT * Math.PI * 2 * 1.35 : 0;
    neckGroup.rotation.x = Math.sin(ph - 0.5) * 0.09;
    tailPivot.rotation.x = Math.sin(ph * 1.35) * 0.28;

    // Atın üstünde ayakta durma (sörf / şov) animasyonu!
    const standBlend = state._sb = (state._sb || 0) + ((isStanding ? 1 : 0) - (state._sb || 0)) * Math.min(1, dt * 9);
    jockey.standLegs.visible = standBlend > 0.15;
    jockey.root.position.y = 1.98 + standBlend * 0.62;
    jockey.root.rotation.x = (0.08 + Math.sin(ph) * 0.1) * (1 - standBlend) + Math.sin(time * 7) * 0.08 * standBlend;
    jockey.root.rotation.z = Math.sin(time * 6.5) * 0.16 * standBlend + (isTomato ? Math.sin(time * 24) * 0.24 : 0);
    headAnchor.position.y = 4.05 + standBlend * 0.62;
    for (const a of jockey.arms) {
      // Ayaktayken kollar iki yana açılıp coşkuyla sallanır!
      a.piv.rotation.y = a.side * (1.25 * standBlend);
      a.piv.rotation.x = (-0.75 + Math.sin(time * 12 + a.side) * 0.35) * standBlend;
    }
    jockey.antennae[0].rotation.z = Math.sin(time * 11) * 0.16;
    jockey.antennae[1].rotation.z = -Math.sin(time * 12 + 1.2) * 0.16;

    if (isPegasus) {
      const flap = Math.sin(time * 10.5) * 0.52;
      wingL.rotation.z = flap; wingR.rotation.z = -flap;
    }
    if (isLightning) {
      lightningGroup.children[0].rotation.y = time * 5.2;
      lightningGroup.children[1].rotation.z = -time * 4.4;
    }
    if (isFlame) {
      fireTail.scale.set(1.7 + Math.sin(time * 22) * 0.25, 2.2 + Math.cos(time * 26) * 0.35, 1.7);
    }
    if (isUnicorn) {
      // Gökkuşağı kurdeleyi dalgalandır
      const pos = rbGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        pos.setZ(i, Math.sin(px * 2.2 + time * 14) * 0.22);
      }
      pos.needsUpdate = true;
    }
  }

  return { group, bodyRoot, jockey, headAnchor, updateVisual };
}

// ---------- MAÇ SONU İLK 3 BÖCEK HALAY EKİBİ (1. Halay Başı Mendilli, 2. ve 3. Yan Yana Halay!) ----------
export function createHalayTrio(scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // Işıklı podyum halı & altın spot halkası
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.9, 0.18, 28),
    std({ color: 0x9b1c31, roughness: 0.65 }),
  );
  rug.position.y = 0.09;
  root.add(rug);
  const rugRim = new THREE.Mesh(
    new THREE.TorusGeometry(5.65, 0.12, 10, 32),
    glow(0xffd166, 2.2),
  );
  rugRim.rotation.x = Math.PI / 2;
  rugRim.position.y = 0.18;
  root.add(rugRim);

  // 1. 2. 3. Sıra basamak işaretleri (halay çekerken soldan sağa 1 - 2 - 3 dizilimi!)
  const medalCols = [0xffd166, 0xdbe4f0, 0xe09153];
  const slots = [-2.55, 0, 2.55].map((xOff, idx) => {
    const holder = new THREE.Group();
    holder.position.set(xOff, 0.18, 0);
    root.add(holder);

    // Altın / Gümüş / Bronz yer plakası
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.02, 0.12, 20),
      std({ color: medalCols[idx], metalness: 0.72, roughness: 0.25 }),
    );
    pad.position.y = 0.06;
    holder.add(pad);

    // Dansçı böcek (her yarış sonunda ilgili kulvarın kostümüyle güncellenir)
    const dancerRoot = new THREE.Group();
    dancerRoot.position.y = 0.78;
    dancerRoot.scale.setScalar(2.05);
    holder.add(dancerRoot);

    let jockey = createRoachJockey(LANES[idx]);
    dancerRoot.add(jockey.root);

    // 1. sıradaki HALAY BAŞI'nın sağ elinde sallanan dev kırmızı-beyaz ipek mendil!
    let mendilPiv = null;
    if (idx === 0) {
      mendilPiv = new THREE.Group();
      mendilPiv.position.set(0.45, 0.95, 0.12);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 0.56, 6, 6),
        std({ color: 0xff2e54, emissive: 0xff2e54, emissiveIntensity: 0.45, roughness: 0.4, side: THREE.DoubleSide }),
      );
      cloth.position.set(0.18, 0.22, 0);
      cloth.rotation.z = 0.35;
      mendilPiv.add(cloth);
      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.025, 6, 16),
        std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 }),
      );
      trim.position.set(0.18, 0.22, 0.02);
      mendilPiv.add(trim);
      dancerRoot.add(mendilPiv);
    }

    const headAnchor = new THREE.Object3D();
    headAnchor.position.set(0, 4.45, 0);
    holder.add(headAnchor);

    return { idx, baseX: xOff, holder, dancerRoot, jockey, mendilPiv, headAnchor, racer: null };
  });

  // Omuz omuza halay bağlantı kolları (1↔2 ve 2↔3 arasında neşeli kol bağı!)
  const linkMat = std({ color: 0x3a1608, roughness: 0.4 });
  const link12 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.35, 8), linkMat);
  link12.rotation.z = Math.PI / 2;
  link12.position.set(-1.27, 2.15, 0);
  const link23 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.35, 8), linkMat);
  link23.rotation.z = Math.PI / 2;
  link23.position.set(1.27, 2.15, 0);
  root.add(link12, link23);

  const spotLight = new THREE.PointLight(0xffd166, 22, 18, 1.4);
  spotLight.position.set(0, 5.5, 2.5);
  root.add(spotLight);

  function setup(top3, zPos) {
    root.position.set(0, 0, zPos);
    root.visible = top3.length > 0;
    link12.visible = top3.length >= 2;
    link23.visible = top3.length >= 3;
    slots.forEach((s, i) => {
      const r = top3[i] || null;
      s.racer = r;
      s.holder.visible = !!r;
      if (!r) return;
      s.dancerRoot.remove(s.jockey.root);
      s.jockey = createRoachJockey(LANES[r.lane]);
      s.jockey.setGender(r.gender);
      s.jockey.standLegs.visible = true;
      // 2. sıradaki böcek davul, 3. sıradaki böcek zurna çalsın; 1. sıradaki şampiyon HALAY BAŞI mendil sallasın!
      s.jockey.davulGroup.visible = i === 1;
      s.jockey.zurnaGroup.visible = i === 2;
      s.dancerRoot.add(s.jockey.root);
    });
  }

  function update(time) {
    if (!root.visible) return;
    // Senkronize Anadolu Halay Koreografisi (3 adım sağa-sola + diz çekme + omuz zıplaması + mendil sallama!)
    const beat = time * 8.6;
    const swayX = Math.sin(beat * 0.5) * 0.85; // Tüm 3'lü ekip omuz omuza sağa-sola halay adımı atar!
    const bounceY = Math.abs(Math.sin(beat)) * 0.34;
    const shoulderTilt = Math.sin(beat * 0.5) * 0.16;

    link12.position.set(-1.27 + swayX, 2.15 + bounceY, 0);
    link23.position.set(1.27 + swayX, 2.15 + bounceY, 0);
    rugRim.rotation.z = time * 1.2;

    slots.forEach((s, i) => {
      if (!s.racer) return;
      s.holder.position.x = s.baseX + swayX;
      s.dancerRoot.position.y = 0.78 + bounceY;
      s.headAnchor.position.y = 4.45 + bounceY;
      s.dancerRoot.rotation.z = shoulderTilt + Math.sin(beat + i * 0.4) * 0.08;
      s.dancerRoot.rotation.y = Math.sin(beat * 0.5) * 0.18;

      // Bacak tekme / halay sekmesi
      s.jockey.standLegs.rotation.x = Math.sin(beat + i * 0.25) * 0.32;
      for (const a of s.jockey.arms) {
        a.piv.rotation.y = a.side * 1.3;
        a.piv.rotation.x = -0.85 + Math.sin(beat + a.side) * 0.38;
      }
      if (s.mendilPiv) {
        // Halay başı mendili havada 8 çizerek coşkuyla sallar!
        s.mendilPiv.rotation.z = Math.sin(beat * 1.5) * 0.75;
        s.mendilPiv.rotation.x = Math.cos(beat * 1.5) * 0.45;
      }
      if (i === 1) {
        s.jockey.tokmakPiv.rotation.z = Math.sin(time * 14.2) * 1.05;
        s.jockey.cubukPiv.rotation.z = -Math.sin(time * 28.4) * 0.85;
        s.jockey.dPulse.scale.setScalar(0.75 + ((time * 4.5) % 1) * 0.9);
      }
      if (i === 2) {
        s.jockey.zurnaGroup.rotation.y = Math.sin(time * 7.5) * 0.42;
        s.jockey.zPulse.scale.setScalar(0.7 + ((time * 3.8) % 1) * 1.35);
      }
    });
  }

  function hide() { root.visible = false; }
  function getPodiumItems() {
    return slots.filter((s) => s.holder.visible && s.racer).map((s) => ({ rank: s.idx + 1, racer: s.racer, headAnchor: s.headAnchor }));
  }
  function dispose() {
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { if (m.map) m.map.dispose(); if (m.dispose) m.dispose(); }
    });
    scene.remove(root);
  }

  return { root, setup, update, hide, getPodiumItems, dispose };
}
