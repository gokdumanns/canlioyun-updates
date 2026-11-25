// Organik 3B Akdeniz Sahil Hamam Böcekleri (Gitarist, Mangal Şefi, Semaver Çaycı, Darbukacı, Dinleyici, Yüzücü & Zabıta!).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ROLES = {
  guitar:  { id: 'guitar',  label: 'Gitarist', icon: '🎸', css: '#f5c542', hex: 0xf5c542 },
  mangal:  { id: 'mangal',  label: 'Mangal',   icon: '🔥', css: '#ff6b35', hex: 0xff6b35 },
  tea:     { id: 'tea',     label: 'Çaycı',    icon: '🫖', css: '#25f4ee', hex: 0x25f4ee },
  darbuka: { id: 'darbuka', label: 'Ritim',    icon: '🥁', css: '#c77dff', hex: 0xc77dff },
};

const SHIRT_COLORS = ['#ff4d6d', '#25f4ee', '#ffd166', '#22d07a', '#b55cff', '#ff8c24', '#38bdf8', '#fb7185'];
const texCache = new Map();

function makeTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const chitinTex = () => makeTex('beach_chitin', 256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#91421d'); g.addColorStop(0.55, '#6e2d10'); g.addColorStop(1, '#3b1405');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 1; i < 6; i++) {
    const y = (h * i) / 6;
    c.fillStyle = 'rgba(20,6,0,0.34)'; c.fillRect(0, y, w, 4);
    c.fillStyle = 'rgba(255,195,140,0.16)'; c.fillRect(0, y + 4, w, 3);
  }
});

const hawaiiTex = (bg) => makeTex(`hawaii_${bg}`, 128, 128, (c, w, h) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  // Tropik yaprak & çiçek deseni
  for (let y = 16; y < h; y += 32) {
    for (let x = 16; x < w; x += 32) {
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd166';
      c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    }
  }
});

const sundressTex = (bg) => makeTex(`sun_${bg}`, 128, 128, (c, w, h) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.24)';
  for (let y = 10; y < h; y += 22) for (let x = 10; x < w; x += 22) {
    c.beginPath(); c.arc(x + (y % 44 ? 8 : 0), y, 4.5, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#fff3d6'; c.fillRect(0, h - 14, w, 6);
});

function std(opts) { return new THREE.MeshStandardMaterial(opts); }
function glow(color, intensity = 2.0) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.25 }); }
function curvedTube(pts, r = 0.024, segs = 12, radSegs = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, r, radSegs, false);
}

// Paylaşılan temel geometriler (yüksek performanslı 25+ sahil böceği için)
const sharedGeo = (() => {
  const bodyPts = [[0, 0], [0.18, 0.05], [0.28, 0.2], [0.3, 0.4], [0.25, 0.58], [0.16, 0.68], [0, 0.72]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const skirtPts = [[0.24, 0.55], [0.24, 0.44], [0.38, 0.24], [0.5, 0.06], [0.52, 0.02]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const shirtPts = [[0.25, 0.14], [0.31, 0.36], [0.28, 0.58], [0.22, 0.67]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const hatPts = [[0, 0.22], [0.16, 0.21], [0.2, 0.08], [0.39, 0.04], [0.42, 0.07], [0.19, 0.05]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const darbukaPts = [[0.14, 0], [0.11, 0.18], [0.19, 0.36], [0.23, 0.52], [0.21, 0.54]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return {
    body: new THREE.LatheGeometry(bodyPts, 16),
    head: new THREE.SphereGeometry(0.22, 16, 14),
    eyeW: new THREE.SphereGeometry(0.088, 12, 10),
    eyeB: new THREE.SphereGeometry(0.045, 8, 8),
    skirt: new THREE.LatheGeometry(skirtPts, 18),
    shirt: new THREE.LatheGeometry(shirtPts, 16),
    strawHat: new THREE.LatheGeometry(hatPts, 18),
    darbuka: new THREE.LatheGeometry(darbukaPts, 14),
    floatie: new THREE.TorusGeometry(0.42, 0.14, 10, 22),
  };
})();

const sharedMat = {
  shell: std({ map: chitinTex(), roughness: 0.28, metalness: 0.12 }),
  dark: std({ color: 0x260f05, roughness: 0.48 }),
  eyeW: std({ color: 0xffffff, roughness: 0.08 }),
  eyeB: std({ color: 0x111118, roughness: 0.06 }),
  gold: std({ color: 0xffd166, metalness: 0.88, roughness: 0.22 }),
  straw: std({ color: 0xe6c37a, roughness: 0.78 }),
  wood: std({ color: 0xc97b36, roughness: 0.42 }),
  woodDark: std({ color: 0x3b1d0c, roughness: 0.55 }),
  cardboard: std({ color: 0xb68b57, roughness: 0.88 }),
  silver: std({ color: 0xdbe3ee, metalness: 0.85, roughness: 0.22 }),
  teaAmber: glow(0xff6b00, 1.4),
  lighterGlow: glow(0xffe082, 3.2),
};

export function createBeachBug(seed = 0, scale = 1.38) {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(scale);
  group.add(rig);

  const colorCss = SHIRT_COLORS[Math.abs(seed) % SHIRT_COLORS.length];

  // Gövde & Kafa
  const torso = new THREE.Mesh(sharedGeo.body, sharedMat.shell);
  torso.position.y = 0.26;
  torso.castShadow = true;
  rig.add(torso);

  const head = new THREE.Mesh(sharedGeo.head, sharedMat.shell);
  head.position.set(0, 1.04, 0.08);
  head.castShadow = true;
  rig.add(head);

  // Gözler + gülümseme + antenler
  const antennae = [];
  for (const s of [-1, 1]) {
    const ew = new THREE.Mesh(sharedGeo.eyeW, sharedMat.eyeW);
    ew.position.set(s * 0.088, 1.08, 0.24); rig.add(ew);
    const eb = new THREE.Mesh(sharedGeo.eyeB, sharedMat.eyeB);
    eb.position.set(s * 0.092, 1.075, 0.31); rig.add(eb);

    const ap = new THREE.Group();
    ap.position.set(s * 0.075, 1.2, 0.12);
    const ant = new THREE.Mesh(curvedTube([[0, 0, 0], [s * 0.14, 0.24, 0.1], [s * 0.32, 0.4, -0.06]], 0.015, 10, 5), sharedMat.dark);
    ap.add(ant);
    rig.add(ap);
    antennae.push(ap);
  }

  // Eklemli kollar (sağ ve sol)
  const armL = new THREE.Group(); armL.position.set(-0.24, 0.82, 0.04);
  const armLM = new THREE.Mesh(curvedTube([[0, 0, 0], [-0.08, -0.14, 0.16], [-0.02, -0.18, 0.36]], 0.028, 8, 5), sharedMat.dark);
  armL.add(armLM); rig.add(armL);

  const armR = new THREE.Group(); armR.position.set(0.24, 0.82, 0.04);
  const armRM = new THREE.Mesh(curvedTube([[0, 0, 0], [0.08, -0.14, 0.16], [0.02, -0.18, 0.36]], 0.028, 8, 5), sharedMat.dark);
  armR.add(armRM); rig.add(armR);

  // Bacaklar
  const legs = [];
  for (const s of [-1, 1]) {
    const lp = new THREE.Group();
    lp.position.set(s * 0.16, 0.34, 0.04);
    const lm = new THREE.Mesh(curvedTube([[0, 0, 0], [s * 0.06, -0.16, 0.14], [s * 0.04, -0.32, 0.24]], 0.028, 8, 5), sharedMat.dark);
    lp.add(lm); rig.add(lp);
    legs.push({ piv: lp, side: s });
  }

  // ---- KADIN SAHİL KIYAFETİ (Yazlık Elbise + Çiçek Tacı) ----
  const female = new THREE.Group();
  const skirt = new THREE.Mesh(sharedGeo.skirt, std({ map: sundressTex(colorCss), roughness: 0.6, side: THREE.DoubleSide }));
  skirt.position.y = 0.22; skirt.castShadow = true; female.add(skirt);
  const flowerCols = [0xff4d6d, 0xffd166, 0x25f4ee, 0xff85c2, 0xfff3d6];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow(flowerCols[i % flowerCols.length], 0.55));
    fl.position.set(Math.sin(a) * 0.21, 1.2, 0.08 + Math.cos(a) * 0.2);
    female.add(fl);
  }
  rig.add(female);

  // ---- ERKEK SAHİL KIYAFETİ (Hawaii Gömlek + Hasır Şapka + Güneş Gözlüğü) ----
  const male = new THREE.Group();
  const shirt = new THREE.Mesh(sharedGeo.shirt, std({ map: hawaiiTex(colorCss), roughness: 0.58 }));
  shirt.position.y = 0.22; shirt.castShadow = true; male.add(shirt);
  const hat = new THREE.Mesh(sharedGeo.strawHat, sharedMat.straw);
  hat.position.set(0, 1.16, 0.06); hat.rotation.x = -0.12; male.add(hat);
  const hatRibbon = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.024, 6, 16), std({ color: 0xff4d6d, roughness: 0.5 }));
  hatRibbon.position.set(0, 1.23, 0.06); hatRibbon.rotation.x = Math.PI / 2 - 0.12; male.add(hatRibbon);
  const glassM = std({ color: 0x0c1424, roughness: 0.05, metalness: 0.9 });
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.072, 0.032, 2, 0.015), glassM);
    lens.position.set(s * 0.088, 1.08, 0.31); male.add(lens);
  }
  rig.add(male);

  // ---- ROL & ETKİNLİK EKİPMANLARI ----
  // 1) 3B Akustik Gitar
  const guitarProp = new THREE.Group();
  const gLower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14), sharedMat.wood);
  gLower.rotation.x = Math.PI / 2; gLower.position.set(-0.08, 0.54, 0.32); guitarProp.add(gLower);
  const gUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 14), sharedMat.wood);
  gUpper.rotation.x = Math.PI / 2; gUpper.position.set(0.14, 0.62, 0.32); guitarProp.add(gUpper);
  const gHole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.11, 12), sharedMat.woodDark);
  gHole.rotation.x = Math.PI / 2; gHole.position.set(0.04, 0.58, 0.32); guitarProp.add(gHole);
  const gNeck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.075, 0.05), sharedMat.woodDark);
  gNeck.position.set(0.42, 0.72, 0.33); gNeck.rotation.z = 0.34; guitarProp.add(gNeck);
  guitarProp.visible = false;
  rig.add(guitarProp);

  // 2) Mangal Kartonu (sağ elde yelleme!) + Maşa (sol elde)
  const cardboardProp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.03), sharedMat.cardboard);
  cardboardProp.position.set(0.06, -0.1, 0.44);
  cardboardProp.visible = false;
  armR.add(cardboardProp);

  const tongsProp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 6), sharedMat.silver);
  tongsProp.rotation.x = Math.PI / 2;
  tongsProp.position.set(-0.02, -0.16, 0.52);
  tongsProp.visible = false;
  armL.add(tongsProp);

  // 3) Semaver Çay Tepsisi (3 ince belli parlayan çay bardağı!)
  const teaProp = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.03, 16), sharedMat.silver);
  tray.position.set(0.02, -0.14, 0.46); teaProp.add(tray);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.14, 8), sharedMat.teaAmber);
    cup.position.set(0.02 + Math.cos(a) * 0.12, -0.05, 0.46 + Math.sin(a) * 0.12);
    teaProp.add(cup);
  }
  teaProp.visible = false;
  armR.add(teaProp);

  // 4) Darbuka
  const darbukaProp = new THREE.Mesh(sharedGeo.darbuka, std({ color: 0xc77dff, metalness: 0.45, roughness: 0.32 }));
  darbukaProp.position.set(0, 0.24, 0.38);
  darbukaProp.rotation.x = 0.25;
  darbukaProp.visible = false;
  rig.add(darbukaProp);

  // 5) Közleme Çubuğu (ateşe uzatılan mısır/marshmallow!)
  const stickProp = new THREE.Group();
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.85, 5), sharedMat.woodDark);
  twig.rotation.x = Math.PI / 2; twig.position.set(0.02, -0.16, 0.65); stickProp.add(twig);
  const marsh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8), std({ color: 0xfff5d6, emissive: 0xffb703, emissiveIntensity: 0.4 }));
  marsh.rotation.x = Math.PI / 2; marsh.position.set(0.02, -0.16, 1.05); stickProp.add(marsh);
  stickProp.visible = false;
  armR.add(stickProp);

  // 6) Parlayan Çakmak / Telefon Işığı (havaya kaldırıp sallanma!)
  const lighterProp = new THREE.Group();
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.03), sharedMat.dark);
  phone.position.set(0.02, -0.08, 0.4); lighterProp.add(phone);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), sharedMat.lighterGlow);
  flame.position.set(0.02, 0.06, 0.4); lighterProp.add(flame);
  lighterProp.visible = false;
  armR.add(lighterProp);

  // 7) Deniz Simidi (denizde yüzerken!)
  const floatieProp = new THREE.Mesh(sharedGeo.floatie, glow(seed % 2 ? 0xff4d6d : 0x25f4ee, 0.45));
  floatieProp.rotation.x = Math.PI / 2;
  floatieProp.position.set(0, 0.44, 0);
  floatieProp.visible = false;
  rig.add(floatieProp);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 1.68, 0);
  rig.add(headAnchor);

  const setGender = (g) => { female.visible = g === 'f'; male.visible = g !== 'f'; };
  setGender(seed % 2 ? 'f' : 'm');

  function setRole(role, { roasting = false, swimming = false } = {}) {
    guitarProp.visible = role === 'guitar';
    cardboardProp.visible = tongsProp.visible = role === 'mangal';
    teaProp.visible = role === 'tea';
    darbukaProp.visible = role === 'darbuka';
    stickProp.visible = !role && !swimming && roasting;
    floatieProp.visible = swimming;
  }

  function updateVisual(dt, time, state) {
    const {
      role = null, swimming = false, lighterUntil = 0,
      tumbleUntil = 0, panicUntil = 0, soloUntil = 0, celebration = false, ph = 0,
    } = state;
    const isLighter = time < lighterUntil || celebration;
    const isTumble = time < tumbleUntil;
    const isPanic = time < panicUntil;
    const isSolo = time < soloUntil;

    lighterProp.visible = isLighter && !role && !swimming;
    if (lighterProp.visible) stickProp.visible = false;

    // Anten sallanması
    antennae[0].rotation.z = Math.sin(time * 8 + ph) * 0.16;
    antennae[1].rotation.z = -Math.sin(time * 8.5 + ph + 1) * 0.16;

    // Dalga vurunca kumda yuvarlanma!
    if (isTumble) {
      rig.rotation.z = Math.sin(time * 16 + ph) * 1.1;
      rig.position.y = Math.abs(Math.sin(time * 12 + ph)) * 0.65;
      armL.rotation.x = -2.2; armR.rotation.x = -2.2;
      return;
    }

    // Zabıta gelince kısa panik koşuşması!
    if (isPanic) {
      rig.rotation.z = Math.sin(time * 22 + ph) * 0.25;
      rig.position.y = Math.abs(Math.sin(time * 18 + ph)) * 0.45;
      armL.rotation.x = -2.4 + Math.sin(time * 20) * 0.4;
      armR.rotation.x = -2.4 - Math.sin(time * 20) * 0.4;
      return;
    }

    rig.rotation.z = 0;

    if (swimming) {
      rig.position.y = Math.sin(time * 3.5 + ph) * 0.22;
      rig.rotation.x = Math.sin(time * 2.4 + ph) * 0.12;
      armL.rotation.x = Math.sin(time * 7 + ph) * 0.8;
      armR.rotation.x = -Math.sin(time * 7 + ph) * 0.8;
      return;
    }

    const groove = isSolo || celebration ? 1.7 : 1.0;
    rig.position.y = Math.abs(Math.sin(time * 4.2 * groove + ph)) * (celebration ? 0.42 : 0.12);
    rig.rotation.x = Math.sin(time * 2.6 + ph) * 0.08;

    if (role === 'guitar') {
      // Gitarist akor basar, sağ el hızla telleri tıngırdatır!
      const strumSpeed = isSolo ? 18 : 9;
      armR.rotation.x = -0.35 + Math.sin(time * strumSpeed) * 0.42;
      armR.rotation.z = -0.2;
      armL.rotation.x = -0.25 + Math.sin(time * 3.5) * 0.14;
      armL.rotation.z = 0.25;
      rig.rotation.z = Math.sin(time * 3.2) * (isSolo ? 0.18 : 0.09);
    } else if (role === 'mangal') {
      // Mangal Şefi sağ eldeki kartonla harıl harıl yeller!
      armR.rotation.x = -0.8 + Math.sin(time * 14) * 0.65;
      armR.rotation.z = 0.35;
      armL.rotation.x = -0.3 + Math.sin(time * 4) * 0.2;
      armL.rotation.z = 0;
    } else if (role === 'tea') {
      // Çaycı tepsiyi dengede tutup keyifle sallanır!
      armR.rotation.x = -0.45 + Math.sin(time * 4.5) * 0.1;
      armR.rotation.z = 0.12;
      armL.rotation.x = -0.2 + Math.sin(time * 5) * 0.3;
      armL.rotation.z = -0.25;
    } else if (role === 'darbuka') {
      // Darbukacı iki elle ritim tutar!
      armR.rotation.x = -0.35 + Math.abs(Math.sin(time * 12)) * 0.55;
      armL.rotation.x = -0.35 + Math.abs(Math.cos(time * 12)) * 0.55;
      armR.rotation.z = -0.2; armL.rotation.z = 0.2;
    } else if (isLighter) {
      // Telefon ışığı / çakmak havada müzikle sağa sola sallanır!
      armR.rotation.x = -2.55;
      armR.rotation.z = Math.sin(time * 3.8 + ph) * 0.48;
      armL.rotation.x = -0.3;
      armL.rotation.z = 0;
    } else {
      // Ateş çemberi ritmik alkış & sallanma
      armR.rotation.x = -0.5 + Math.sin(time * 6.5 + ph) * 0.28;
      armL.rotation.x = -0.5 + Math.sin(time * 6.5 + ph) * 0.28;
      armR.rotation.z = -0.18 + Math.sin(time * 6.5 + ph) * 0.15;
      armL.rotation.z = 0.18 - Math.sin(time * 6.5 + ph) * 0.15;
    }

    for (const l of legs) l.piv.rotation.x = Math.sin(time * 4 + ph + l.side) * 0.12;
  }

  return { group, rig, headAnchor, setGender, setRole, updateVisual };
}

// ---------- Özel Dev Karakter: Sahil Bekçisi / Zabıta Böcek ("BİZDEN ABİ!") ----------
export function createZabitaBug() {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(1.75);
  group.add(rig);

  const uniformMat = std({ color: 0x162b5c, roughness: 0.48 });
  const torso = new THREE.Mesh(sharedGeo.body, sharedMat.shell);
  torso.position.y = 0.26; torso.castShadow = true; rig.add(torso);
  const jacket = new THREE.Mesh(sharedGeo.shirt, uniformMat);
  jacket.position.y = 0.22; jacket.castShadow = true; rig.add(jacket);

  // Altın düğmeler
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), sharedMat.gold);
    btn.position.set(0, 0.42 + i * 0.13, 0.29); rig.add(btn);
  }

  const head = new THREE.Mesh(sharedGeo.head, sharedMat.shell);
  head.position.set(0, 1.04, 0.08); rig.add(head);
  for (const s of [-1, 1]) {
    const ew = new THREE.Mesh(sharedGeo.eyeW, sharedMat.eyeW);
    ew.position.set(s * 0.088, 1.08, 0.24); rig.add(ew);
    const eb = new THREE.Mesh(sharedGeo.eyeB, sharedMat.eyeB);
    eb.position.set(s * 0.092, 1.075, 0.31); rig.add(eb);
  }
  // Bekçi kasketi + altın kokart
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.16, 16), uniformMat);
  capTop.position.set(0, 1.24, 0.07); rig.add(capTop);
  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.18), sharedMat.dark);
  capVisor.position.set(0, 1.17, 0.24); rig.add(capVisor);
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), sharedMat.gold);
  badge.position.set(0, 1.25, 0.26); rig.add(badge);

  // Sağ elde el feneri + ışık konisi (panik fazında parlar!)
  const armR = new THREE.Group(); armR.position.set(0.26, 0.82, 0.04);
  const armRM = new THREE.Mesh(curvedTube([[0, 0, 0], [0.08, -0.08, 0.22], [0.04, -0.08, 0.42]], 0.032, 8, 5), sharedMat.dark);
  armR.add(armRM);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.28, 8), sharedMat.silver);
  torch.rotation.x = Math.PI / 2; torch.position.set(0.04, -0.08, 0.5); armR.add(torch);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 5.2, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0.04, -0.08, 3.15);
  armR.add(beam);

  // Barışma anında ("BİZDEN ABİ!") elinde beliren ince belli çay bardağı!
  const teaGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.048, 0.2, 10), sharedMat.teaAmber);
  teaGlass.position.set(0.04, -0.02, 0.45);
  teaGlass.visible = false;
  armR.add(teaGlass);
  rig.add(armR);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 1.72, 0);
  rig.add(headAnchor);

  group.visible = false;

  function update(dt, time, state) {
    group.visible = state.active;
    if (!state.active) return;
    const friendly = state.phase === 'friendly';
    beam.visible = !friendly;
    torch.visible = !friendly;
    teaGlass.visible = friendly;

    if (!friendly) {
      // Feneri sağa sola tarayarak sahile yürür!
      armR.rotation.y = Math.sin(time * 5.5) * 0.65;
      armR.rotation.x = -0.2;
      rig.position.y = Math.abs(Math.sin(time * 9)) * 0.24;
    } else {
      // Çayını yudumlayıp müzikle keyifle sallanır!
      armR.rotation.y = 0;
      armR.rotation.x = -0.65 + Math.sin(time * 4.5) * 0.25;
      rig.position.y = Math.abs(Math.sin(time * 4.2)) * 0.2;
      rig.rotation.z = Math.sin(time * 3.5) * 0.14;
    }
  }

  return { group, headAnchor, update };
}
