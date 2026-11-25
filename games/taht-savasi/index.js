// Taht Savaşı — Lavlarla çevrili daralan ring arenasında Battle Royale + Rastgele Olaylar + Dinamik Kalabalık Ölçekleme.
import { loop, createCanvas, Particles, Sound, drawAvatar, strokeText, roundRect, colorFor, clamp, lerp, rand, pick, ease, fmt } from '@sdk/kit.js';
import { describeTrigger } from '@sdk/rules-text.js';

const W = 1080, H = 1920;
const ARENA = { cx: 540, cy: 965, baseR: 435, maxExpandR: 495, minR: 205, throneR: 108 };
const BOTS = [
  { id: 'bot_1', nick: 'Kral_Bot' }, { id: 'bot_2', nick: 'Alev_Savaşçı' },
  { id: 'bot_3', nick: 'Gölge_Avcı' }, { id: 'bot_4', nick: 'Demir_Yumruk' },
];

export default async function createGame(ctx) {
  const { canvas, ctx: g } = createCanvas(ctx.root);
  const fx = new Particles(900);
  const sound = new Sound();
  let settings = { ...ctx.settings };
  let rules = ctx.rules || [];
  let time = 0, round = 1, roundT = 0, phase = 'fight', phaseT = 0;
  let shake = 0, flash = 0, flashCol = '#fff';
  let winner = null, kingId = null;

  const fighters = new Map();     // id -> fighter
  const scores = new Map();       // id -> { id, nick, avatar, kills, throne, wins }
  const falling = [];             // lavlara düşenler (animasyon)
  const waves = [];               // genişleyen şok halkaları
  const meteors = [];             // düşen meteorlar
  const lightnings = [];          // şimşek fırtınası { x, y, t, dur, struck }
  let chest = null;               // gizemli sandık { x, y, spawnedAt, reward }
  let iceUntil = 0, doubleThroneUntil = 0;
  let nextEventAt = 16;           // ilk rastgele olay zamanı
  const killFeed = [];            // { text, color, t }
  const embers = Array.from({ length: 65 }, () => ({ x: rand(0, W), y: rand(0, H), vy: -rand(28, 85), vx: rand(-20, 20), s: rand(2, 6), ph: rand(0, 6) }));
  let blackhole = null;           // { ownerId, until, x, y }
  const ruleFlash = new Map();    // ruleId -> t

  const roundDur = () => Math.max(30, Number(settings.roundSeconds) || 90);
  const maxFighters = () => clamp(Number(settings.maxFighters) || 45, 8, 80);
  const play = (fn) => { if (settings.sound) try { fn(); } catch { /* sessiz */ } };
  const addShake = (v) => { shake = Math.min(34, Math.max(shake, v)); };

  // Kalabalığa göre dinamik arena çapı, karakter boyutu ve Kaos Seviyesi (1x / 2x / 3x)
  const chaosLevel = () => (fighters.size >= 24 ? 3 : fighters.size >= 12 ? 2 : 1);
  const fighterBaseR = () => lerp(41, 26, clamp((fighters.size - 8) / 36, 0, 1));
  let curBaseR = ARENA.baseR;
  const targetBaseR = () => lerp(ARENA.baseR, ARENA.maxExpandR, clamp((fighters.size - 8) / 28, 0, 1));

  function safeRadius() {
    if (!settings.shrinkArena || phase !== 'fight') return curBaseR;
    const speedBoost = 1 + (chaosLevel() - 1) * 0.22;
    const p = clamp(((roundT - 12) * speedBoost) / Math.max(20, roundDur() - 18), 0, 1);
    return lerp(curBaseR, ARENA.minR, p * p * (3 - 2 * p));
  }

  function triggerRandomEvent() {
    const ch = chaosLevel();
    const sr = safeRadius();
    const kinds = ['ice', 'lightning', 'chest', 'quake', 'double'];
    const kind = pick(kinds);
    if (kind === 'ice') {
      iceUntil = time + 10;
      play(() => sound.ice());
      ctx.ui.toast('🧊 BUZ ZEMİNİ! Arena 10 sn kaygan!', { color: '#72efdd', duration: 3000 });
    } else if (kind === 'lightning') {
      const n = 2 + ch * 2;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), d = rand(30, sr * 0.78);
        lightnings.push({ x: ARENA.cx + Math.cos(a) * d, y: ARENA.cy + Math.sin(a) * d, t: -i * 0.35, dur: 1.05, struck: false });
      }
      ctx.ui.toast(`⚡ ŞİMŞEK FIRTINASI! (${n} yıldırım)`, { color: '#4cc9f0', duration: 2800 });
    } else if (kind === 'chest') {
      const a = rand(0, Math.PI * 2), d = rand(80, sr * 0.65);
      chest = { x: ARENA.cx + Math.cos(a) * d, y: ARENA.cy + Math.sin(a) * d, spawnedAt: time, reward: pick(['giant', 'shield', 'shockwave']) };
      play(() => sound.ding());
      ctx.ui.toast('🎁 GİZEMLİ SANDIK DÜŞTÜ! İlk kapan gücü alır!', { color: '#ffd166', duration: 3000 });
    } else if (kind === 'quake') {
      waves.push({ x: ARENA.cx, y: ARENA.cy, r: 20, maxR: curBaseR, col: '#ff5400', life: 0.85, maxLife: 0.85, w: 18 });
      addShake(24); flash = 0.35; flashCol = '#ff6b35';
      play(() => sound.quake());
      const push = 440 + ch * 140;
      for (const f of fighters.values()) {
        const dx = f.x - ARENA.cx, dy = f.y - ARENA.cy, d = Math.hypot(dx, dy) || 1;
        const k = time < f.shieldUntil ? 0.2 : 1;
        f.vx += (dx / d) * push * k; f.vy += (dy / d) * push * k;
      }
      ctx.ui.toast('🌋 DEPREM DALGASI! Kenardakiler dikkat!', { color: '#ff5400', duration: 2800 });
    } else if (kind === 'double') {
      doubleThroneUntil = time + 12;
      play(() => sound.powerup());
      ctx.ui.toast('👑 2× ALTIN TAHT! 12 sn boyunca çifte puan!', { color: '#ffd166', duration: 3000 });
    }
    // Kaos seviyesi arttıkça olaylar sıklaşır
    nextEventAt = roundT + Math.max(12, 23 - ch * 3.5);
  }

  function scoreOf(u) {
    let s = scores.get(u.id);
    if (!s) { s = { id: u.id, nick: u.nick, avatar: u.avatar || '', kills: 0, throne: 0, wins: 0 }; scores.set(u.id, s); }
    else { if (u.nick) s.nick = u.nick; if (u.avatar) s.avatar = u.avatar; }
    return s;
  }

  function spawn(user, { isBot = false, silent = false } = {}) {
    if (!user || !user.id) return null;
    const existing = fighters.get(user.id);
    if (existing) {
      existing.lastActive = time;
      if (user.nick) existing.nick = user.nick;
      if (user.avatar) existing.avatar = user.avatar;
      return existing;
    }
    // Yer aç: gerçek veya manuel test oyuncusu gelince önce botları, sonra demo botları çıkar
    const isDemo = (id) => String(id || '').startsWith('demo_');
    if (fighters.size >= maxFighters()) {
      const rank = (f) => (f.isBot ? 0 : isDemo(f.id) ? 1 : 2);
      const victim = [...fighters.values()].sort((a, b) => (rank(a) - rank(b)) || (a.lastActive - b.lastActive))[0];
      if (victim && (rank({ isBot, id: user.id }) >= rank(victim))) fighters.delete(victim.id);
      else return null;
    }
    const sr = safeRadius();
    const ang = rand(0, Math.PI * 2), dist = rand(sr * 0.28, sr * 0.72);
    const f = {
      id: user.id, nick: user.nick || 'Savaşçı', avatar: user.avatar || '', isBot,
      x: ARENA.cx + Math.cos(ang) * dist, y: ARENA.cy + Math.sin(ang) * dist,
      vx: rand(-40, 40), vy: rand(-40, 40),
      r: fighterBaseR(), targetR: fighterBaseR(), mass: 1,
      col: colorFor(user.id, 82, 58),
      giantUntil: 0, shieldUntil: time + 2.5, hitFlash: 0, dropT: 0.45, // yeni inen savaşçıya 2.5 sn doğuş koruması
      kills: 0, thronePts: 0, lastHitBy: null, lastHitAt: 0,
      lastActive: time, trail: [], bubble: null,
    };
    fighters.set(f.id, f);
    if (!isBot) scoreOf(user);
    waves.push({ x: f.x, y: f.y, r: 10, maxR: 110, col: f.col, life: 0.45, maxLife: 0.45, w: 6 });
    if (!silent) play(() => sound.pop());
    return f;
  }

  function ensureBots() {
    if (fighters.size < 4) {
      for (const b of BOTS) if (!fighters.has(b.id) && fighters.size < 4) spawn(b, { isBot: true, silent: true });
    }
  }
  ensureBots();

  function pushKill(text, color) {
    killFeed.unshift({ text, color, t: time });
    if (killFeed.length > 3) killFeed.pop();
  }

  function dash(f, power = 1) {
    let target = null, bestD = Infinity;
    for (const o of fighters.values()) {
      if (o.id === f.id) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bestD) { bestD = d; target = o; }
    }
    const tx = target ? target.x : ARENA.cx, ty = target ? target.y : ARENA.cy;
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
    const sp = 420 + power * 150 + (time < f.giantUntil ? 120 : 0);
    f.vx += (dx / d) * sp; f.vy += (dy / d) * sp;
    waves.push({ x: f.x, y: f.y, r: f.r * 0.6, maxR: f.r * 2.1, col: '#fff', life: 0.28, maxLife: 0.28, w: 4 });
  }

  function triggerShockwave(f, force = 950) {
    waves.push({ x: f.x, y: f.y, r: f.r, maxR: 380, col: '#25f4ee', life: 0.65, maxLife: 0.65, w: 14 });
    waves.push({ x: f.x, y: f.y, r: f.r, maxR: 260, col: '#ffffff', life: 0.45, maxLife: 0.45, w: 8 });
    fx.burst(f.x, f.y, 40, '#25f4ee', 560);
    addShake(16);
    play(() => sound.explosion());
    for (const o of fighters.values()) {
      if (o.id === f.id) continue;
      const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 1;
      if (d < 380) {
        const k = (1 - d / 380) * (time < o.shieldUntil ? 0.22 : 1);
        o.vx += (dx / d) * force * k; o.vy += (dy / d) * force * k;
        o.lastHitBy = f.id; o.lastHitAt = time; o.hitFlash = 0.25;
      }
    }
    ctx.ui.toast(`💥 ${f.nick} ŞOK DALGASI patlattı!`, { color: '#25f4ee', duration: 2400 });
  }

  function triggerMeteor(f, count = 3) {
    const rivals = [...fighters.values()].filter((o) => o.id !== f.id);
    const sr = safeRadius();
    for (let i = 0; i < Math.min(10, count); i++) {
      const target = rivals[i % Math.max(1, rivals.length)];
      const a = rand(0, Math.PI * 2), d = rand(40, sr * 0.72);
      const tx = target ? target.x + rand(-35, 35) : ARENA.cx + Math.cos(a) * d;
      const ty = target ? target.y + rand(-35, 35) : ARENA.cy + Math.sin(a) * d;
      meteors.push({ ownerId: f.id, tx, ty, t: -i * 0.28, dur: 0.75 });
    }
    ctx.ui.toast(`☄️ ${f.nick} METEOR YAĞMURU indirdi!`, { color: '#ff6b35', duration: 2800 });
    play(() => sound.whoosh());
  }

  function triggerBlackhole(f, seconds = 3.5) {
    blackhole = { ownerId: f.id, x: ARENA.cx, y: ARENA.cy, started: time, until: time + seconds };
    flash = 0.45; flashCol = '#b5179e'; addShake(20);
    play(() => sound.explosion());
    ctx.ui.toast(`🌀 ${f.nick} KARA DELİK AÇTI!`, { color: '#c77dff', duration: 3400 });
  }

  function eliminate(f) {
    fighters.delete(f.id);
    falling.push({ ...f, t: 0, dur: 0.75 });
    fx.burst(f.x, f.y, 26, '#ff6b35', 380);
    addShake(8);
    play(() => sound.hit());
    const killer = f.lastHitBy && time - f.lastHitAt < 4.5 ? fighters.get(f.lastHitBy) || scores.get(f.lastHitBy) : null;
    if (killer && killer.id !== f.id) {
      const kf = fighters.get(killer.id);
      if (kf) kf.kills++;
      if (!kf || !kf.isBot) scoreOf(killer).kills++;
      pushKill(`🔥 ${killer.nick} ⚔️ ${f.nick}'i lavlara attı!`, '#ffd166');
      fx.float(f.x, f.y - 30, `⚔️ ${killer.nick}`, '#ffd166');
    } else {
      pushKill(`🌋 ${f.nick} lavlara düştü!`, '#ff7b54');
    }
  }

  function finishRound() {
    phase = 'win'; phaseT = 0;
    const all = [...fighters.values()].sort((a, b) => (b.kills * 10 + b.thronePts) - (a.kills * 10 + a.thronePts));
    winner = all[0] || [...scores.values()].sort((a, b) => b.kills - a.kills)[0] || { id: 'none', nick: 'Taht Boş', kills: 0 };
    if (winner.id !== 'none' && !winner.isBot) scoreOf(winner).wins++;
    fx.confetti(280);
    flash = 0.5; flashCol = '#ffd166';
    play(() => sound.fanfare());
  }

  function nextRound() {
    round++; roundT = 0; phase = 'fight'; phaseT = 0; winner = null; blackhole = null;
    meteors.length = 0; lightnings.length = 0; chest = null; iceUntil = 0; doubleThroneUntil = 0; nextEventAt = 16;
    for (const f of fighters.values()) {
      const a = rand(0, Math.PI * 2), d = rand(90, curBaseR * 0.65);
      f.x = ARENA.cx + Math.cos(a) * d; f.y = ARENA.cy + Math.sin(a) * d;
      f.vx = f.vy = 0; f.kills = 0; f.thronePts = 0; f.giantUntil = f.shieldUntil = 0;
    }
    ensureBots();
  }

  // ---------- fizik güncelleme ----------
  function updatePhysics(dt) {
    curBaseR += (targetBaseR() - curBaseR) * Math.min(1, dt * 2.5);
    if (settings.randomEvents !== false && !blackhole && roundT >= nextEventAt && roundT < roundDur() - 8) triggerRandomEvent();
    const sr = safeRadius();
    const isIce = time < iceUntil;
    const throneMult = time < doubleThroneUntil ? 2 : 1;
    const ch = chaosLevel();
    const bR = fighterBaseR();
    const list = [...fighters.values()];

    // Kara delik çekimi ve final patlaması
    if (blackhole) {
      if (time >= blackhole.until) {
        const bh = blackhole; blackhole = null;
        waves.push({ x: bh.x, y: bh.y, r: 20, maxR: 520, col: '#c77dff', life: 0.75, maxLife: 0.75, w: 18 });
        fx.burst(bh.x, bh.y, 75, '#c77dff', 680);
        addShake(28); flash = 0.55; flashCol = '#e0aaff';
        play(() => sound.explosion());
        for (const o of list) {
          if (o.id === bh.ownerId) continue;
          const dx = o.x - bh.x, dy = o.y - bh.y, d = Math.hypot(dx, dy) || 1;
          o.vx += (dx / d) * 1250; o.vy += (dy / d) * 1250;
          o.lastHitBy = bh.ownerId; o.lastHitAt = time; o.hitFlash = 0.35;
        }
      } else {
        for (const o of list) {
          if (o.id === blackhole.ownerId) continue;
          const dx = blackhole.x - o.x, dy = blackhole.y - o.y, d = Math.hypot(dx, dy) || 1;
          const pull = clamp(520 / (d * 0.015 + 1), 160, 720);
          o.vx += (dx / d) * pull * dt - (dy / d) * 260 * dt;
          o.vy += (dy / d) * pull * dt + (dx / d) * 260 * dt;
          o.lastHitBy = blackhole.ownerId; o.lastHitAt = time;
        }
      }
    }

    // Her savaşçının hareketi + hafif yapay zeka dürtüsü (arena hep canlı kalsın)
    for (const f of list) {
      const isGiant = time < f.giantUntil;
      f.targetR = isGiant ? bR * 1.68 : bR;
      f.r += (f.targetR - f.r) * Math.min(1, dt * 8);
      f.mass = isGiant ? 3.2 : 1;
      if (f.dropT > 0) f.dropT = Math.max(0, f.dropT - dt);
      if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);

      const dxC = ARENA.cx - f.x, dyC = ARENA.cy - f.y, dC = Math.hypot(dxC, dyC) || 1;
      // Sandık varsa yakın savaşçılar sandığa doğru çekilir
      if (chest && Math.hypot(chest.x - f.x, chest.y - f.y) < 260) {
        const dCh = Math.hypot(chest.x - f.x, chest.y - f.y) || 1;
        f.vx += ((chest.x - f.x) / dCh) * 190 * dt;
        f.vy += ((chest.y - f.y) / dCh) * 190 * dt;
      } else {
        const urge = dC > sr * 0.72 ? 260 : 75;
        f.vx += (dxC / dC) * urge * dt;
        f.vy += (dyC / dC) * urge * dt;
      }
      if (Math.random() < dt * (f.isBot ? 1.1 : 0.45)) dash(f, 0.55);

      // Buz zemininde sürtünme çok düşük (herkes kayar!)
      const drag = Math.exp(-dt * (isIce ? 0.55 : 2.4));
      f.vx *= drag; f.vy *= drag;
      f.x += f.vx * dt; f.y += f.vy * dt;

      // Hız izi
      const spd = Math.hypot(f.vx, f.vy);
      if (spd > 240) { f.trail.push({ x: f.x, y: f.y, r: f.r, life: 0.22 }); if (f.trail.length > 7) f.trail.shift(); }
      for (let i = f.trail.length - 1; i >= 0; i--) { f.trail[i].life -= dt; if (f.trail[i].life <= 0) f.trail.splice(i, 1); }

      // Taht çemberi puanı
      if (dC < ARENA.throneR) {
        f.thronePts += dt * 3 * throneMult;
        if (!f.isBot) scoreOf(f).throne += dt * 3 * throneMult;
      }

      // Gizemli sandık toplama
      if (chest && Math.hypot(chest.x - f.x, chest.y - f.y) < f.r + 34) {
        const rw = chest.reward; chest = null;
        fx.burst(f.x, f.y, 35, '#ffd166', 460);
        play(() => sound.chest());
        if (rw === 'giant') { f.giantUntil = Math.max(f.giantUntil, time) + 12; fx.float(f.x, f.y - 60, '🎁 DEV MODU!', '#ff9e00'); }
        else if (rw === 'shield') { f.shieldUntil = Math.max(f.shieldUntil, time) + 12; fx.float(f.x, f.y - 60, '🎁 KALKAN!', '#ffd166'); }
        else triggerShockwave(f, 950);
        pushKill(`🎁 ${f.nick} gizemli sandığı kaptı!`, '#ffd166');
      }
    }

    // Çarpışmalar (kütle bazlı elastik itme + kaos seviyesi çarpanı)
    const bounceMult = 1.45 + (ch - 1) * 0.14;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r;
        if (d < minD) {
          const nx = dx / d, ny = dy / d, overlap = minD - d;
          const totalM = a.mass + b.mass;
          a.x -= nx * overlap * (b.mass / totalM); a.y -= ny * overlap * (b.mass / totalM);
          b.x += nx * overlap * (a.mass / totalM); b.y += ny * overlap * (a.mass / totalM);

          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const velN = rvx * nx + rvy * ny;
          if (velN < 0) {
            const jImp = -(bounceMult * velN) / (1 / a.mass + 1 / b.mass);
            const aSh = time < a.shieldUntil ? 0.18 : 1;
            const bSh = time < b.shieldUntil ? 0.18 : 1;
            a.vx -= (jImp / a.mass) * nx * aSh; a.vy -= (jImp / a.mass) * ny * aSh;
            b.vx += (jImp / b.mass) * nx * bSh; b.vy += (jImp / b.mass) * ny * bSh;
            // Kalkanlıya çarpan ekstra geri teper
            if (aSh < 1) { b.vx += nx * 320; b.vy += ny * 320; }
            if (bSh < 1) { a.vx -= nx * 320; a.vy -= ny * 320; }
            if (Math.abs(velN) > 130) {
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              fx.burst(mx, my, 8, '#ffd166', 240);
              a.lastHitBy = b.id; a.lastHitAt = time; b.lastHitBy = a.id; b.lastHitAt = time;
              a.hitFlash = b.hitFlash = 0.12;
              if (Math.abs(velN) > 280) { addShake(5); play(() => sound.hit()); }
            }
          }
        }
      }
    }

    // Ring dışına düşenleri ele
    for (const f of list) {
      if (Math.hypot(f.x - ARENA.cx, f.y - ARENA.cy) > sr + f.r * 0.35) eliminate(f);
    }

    // Şimşek fırtınası çarpışmaları
    for (let i = lightnings.length - 1; i >= 0; i--) {
      const l = lightnings[i];
      l.t += dt;
      if (!l.struck && l.t >= l.dur) {
        l.struck = true;
        waves.push({ x: l.x, y: l.y, r: 10, maxR: 180, col: '#4cc9f0', life: 0.45, maxLife: 0.45, w: 10 });
        fx.burst(l.x, l.y, 26, '#90e0ef', 460);
        addShake(13); flash = 0.22; flashCol = '#90e0ef';
        play(() => sound.lightning());
        for (const o of fighters.values()) {
          const dx = o.x - l.x, dy = o.y - l.y, d = Math.hypot(dx, dy) || 1;
          if (d < 185) {
            const k = (1 - d / 185) * (time < o.shieldUntil ? 0.25 : 1);
            o.vx += (dx / d) * 1050 * k; o.vy += (dy / d) * 1050 * k; o.hitFlash = 0.28;
          }
        }
      }
      if (l.t >= l.dur + 0.28) lightnings.splice(i, 1);
    }

    // Meteor çarpışmaları
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.t += dt;
      if (m.t >= m.dur) {
        meteors.splice(i, 1);
        waves.push({ x: m.tx, y: m.ty, r: 15, maxR: 230, col: '#ff5400', life: 0.55, maxLife: 0.55, w: 14 });
        fx.burst(m.tx, m.ty, 36, '#ff9e00', 520);
        addShake(18); flash = 0.25; flashCol = '#ff6b35';
        play(() => sound.explosion());
        for (const o of fighters.values()) {
          if (o.id === m.ownerId) continue;
          const dx = o.x - m.tx, dy = o.y - m.ty, d = Math.hypot(dx, dy) || 1;
          if (d < 230) {
            const k = (1 - d / 230) * (time < o.shieldUntil ? 0.25 : 1);
            o.vx += (dx / d) * 1150 * k; o.vy += (dy / d) * 1150 * k;
            o.lastHitBy = m.ownerId; o.lastHitAt = time; o.hitFlash = 0.3;
          }
        }
      }
    }

    // Kralı belirle (en çok kill + taht puanı)
    let best = null, bs = -1;
    for (const f of fighters.values()) {
      const s = f.kills * 12 + f.thronePts;
      if (s > bs) { bs = s; best = f; }
    }
    kingId = best && bs > 0 ? best.id : null;

    if (fighters.size < 2 && roundT > 5) ensureBots();
    if (roundT >= roundDur()) finishRound();
  }

  // ---------- çizim ----------
  function drawLavaBackdrop() {
    const bg = g.createRadialGradient(ARENA.cx, ARENA.cy, 260, ARENA.cx, ARENA.cy, 1180);
    bg.addColorStop(0, '#4a1208');
    bg.addColorStop(0.45, '#2b0908');
    bg.addColorStop(1, '#0b050b');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // Hareketli magma parıltıları
    g.save();
    for (let i = 0; i < 6; i++) {
      const a = time * 0.18 * (i % 2 ? 1 : -1) + i * 1.1;
      const x = ARENA.cx + Math.cos(a) * (490 + (i % 3) * 70);
      const y = ARENA.cy + Math.sin(a) * (490 + (i % 2) * 90);
      const gr = g.createRadialGradient(x, y, 10, x, y, 220);
      gr.addColorStop(0, 'rgba(255, 92, 0, 0.24)'); gr.addColorStop(1, 'rgba(255, 92, 0, 0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 220, 0, Math.PI * 2); g.fill();
    }
    // Yüzen kıvılcımlar
    for (const e of embers) {
      g.globalAlpha = 0.35 + 0.45 * Math.sin(time * 3 + e.ph);
      g.fillStyle = e.s > 4 ? '#ffd166' : '#ff6b35';
      g.beginPath(); g.arc(e.x, e.y, e.s, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawArena() {
    const sr = safeRadius();
    const isIce = time < iceUntil;
    const isDouble = time < doubleThroneUntil;
    g.save();
    // Dış lav halesi
    const glow = g.createRadialGradient(ARENA.cx, ARENA.cy, curBaseR - 20, ARENA.cx, ARENA.cy, curBaseR + 75);
    glow.addColorStop(0, 'rgba(255, 90, 0, .55)'); glow.addColorStop(1, 'rgba(255, 90, 0, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(ARENA.cx, ARENA.cy, curBaseR + 75, 0, Math.PI * 2); g.fill();

    // Ana taş platform (erimiş alan dahil)
    g.beginPath(); g.arc(ARENA.cx, ARENA.cy, curBaseR, 0, Math.PI * 2);
    g.fillStyle = '#3b110c'; g.fill();
    g.lineWidth = 10; g.strokeStyle = '#ff5400'; g.stroke();

    // Daralan tehlike bölgesi (güvenli alan dışı kızgın lav)
    if (sr < curBaseR - 2) {
      g.save();
      g.beginPath(); g.arc(ARENA.cx, ARENA.cy, curBaseR - 4, 0, Math.PI * 2);
      g.arc(ARENA.cx, ARENA.cy, sr, 0, Math.PI * 2, true);
      g.fillStyle = `rgba(255, 45, 0, ${0.38 + 0.14 * Math.sin(time * 6)})`;
      g.fill();
      g.restore();
    }

    // Güvenli zemin (normal: obsidyen, buz olayı: parlak buz)
    const floor = g.createRadialGradient(ARENA.cx, ARENA.cy, 20, ARENA.cx, ARENA.cy, sr);
    if (isIce) {
      floor.addColorStop(0, '#2a5f82'); floor.addColorStop(0.65, '#193b5c'); floor.addColorStop(1, '#0e243d');
    } else {
      floor.addColorStop(0, '#2a2242'); floor.addColorStop(0.65, '#19162b'); floor.addColorStop(1, '#120f1e');
    }
    g.beginPath(); g.arc(ARENA.cx, ARENA.cy, sr, 0, Math.PI * 2);
    g.fillStyle = floor; g.fill();

    // Zemin çizgileri ve rün halkaları
    g.strokeStyle = isIce ? 'rgba(144,224,239,.2)' : 'rgba(255,255,255,.06)'; g.lineWidth = 3;
    for (const f of [0.45, 0.75]) { g.beginPath(); g.arc(ARENA.cx, ARENA.cy, sr * f, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + time * 0.04;
      g.beginPath(); g.moveTo(ARENA.cx + Math.cos(a) * ARENA.throneR, ARENA.cy + Math.sin(a) * ARENA.throneR);
      g.lineTo(ARENA.cx + Math.cos(a) * sr, ARENA.cy + Math.sin(a) * sr); g.stroke();
    }

    // Altın Taht Çemberi (merkez)
    const pulse = 0.5 + 0.5 * Math.sin(time * (isDouble ? 8 : 4));
    const tg = g.createRadialGradient(ARENA.cx, ARENA.cy, 10, ARENA.cx, ARENA.cy, ARENA.throneR);
    tg.addColorStop(0, `rgba(255, 209, 102, ${(isDouble ? 0.52 : 0.28) + pulse * 0.14})`);
    tg.addColorStop(1, 'rgba(255, 209, 102, 0.04)');
    g.beginPath(); g.arc(ARENA.cx, ARENA.cy, ARENA.throneR, 0, Math.PI * 2);
    g.fillStyle = tg; g.fill();
    g.lineWidth = isDouble ? 6 : 4; g.strokeStyle = `rgba(255, 209, 102, ${0.6 + pulse * 0.35})`; g.stroke();
    strokeText(g, isDouble ? '👑 2×' : '👑', ARENA.cx, ARENA.cy, { size: isDouble ? 44 : 54, fill: '#ffd166', width: isDouble ? 6 : 0 });

    // Gizemli Sandık
    if (chest) {
      const bob = Math.sin(time * 6) * 6;
      const cg = g.createRadialGradient(chest.x, chest.y, 5, chest.x, chest.y, 58);
      cg.addColorStop(0, 'rgba(255, 209, 102, .55)'); cg.addColorStop(1, 'rgba(255, 209, 102, 0)');
      g.fillStyle = cg; g.beginPath(); g.arc(chest.x, chest.y, 58, 0, Math.PI * 2); g.fill();
      strokeText(g, '🎁', chest.x, chest.y + bob, { size: 58, width: 0 });
    }

    // Güvenli alanın ateş / buz çemberi
    g.beginPath(); g.arc(ARENA.cx, ARENA.cy, sr, 0, Math.PI * 2);
    g.lineWidth = 8; g.strokeStyle = isIce ? '#72efdd' : sr < curBaseR - 8 ? '#ff3b30' : '#ff9e00';
    g.shadowColor = isIce ? '#4cc9f0' : '#ff5400'; g.shadowBlur = 24; g.stroke(); g.shadowBlur = 0;

    // Kara delik girdabı
    if (blackhole) {
      g.save(); g.translate(blackhole.x, blackhole.y); g.rotate(time * 5);
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = k % 2 ? '#c77dff' : '#7b2cbf'; g.lineWidth = 6 - k;
        g.beginPath(); g.arc(0, 0, 35 + k * 28, 0, Math.PI * 1.45); g.stroke();
      }
      g.fillStyle = '#07020d'; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();
  }

  function drawFighter(f, scale = 1, alpha = 1) {
    const isKing = f.id === kingId;
    const isGiant = time < f.giantUntil;
    const isShield = time < f.shieldUntil;
    const dropScale = f.dropT > 0 ? lerp(1, 2.2, f.dropT / 0.45) : 1;
    const r = f.r * scale * dropScale;

    g.save();
    g.globalAlpha = alpha;
    // Hız izi
    for (const tr of f.trail) {
      g.globalAlpha = alpha * (tr.life / 0.22) * 0.28;
      g.fillStyle = f.col; g.beginPath(); g.arc(tr.x, tr.y, tr.r * 0.85, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = alpha;

    // Zemin gölgesi
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.ellipse(f.x, f.y + r * 0.82, r * 0.88, r * 0.34, 0, 0, Math.PI * 2); g.fill();

    // Dev modu alev halkası
    if (isGiant) {
      g.save(); g.translate(f.x, f.y); g.rotate(time * 4);
      g.strokeStyle = '#ff6b35'; g.lineWidth = 8; g.setLineDash([22, 14]);
      g.beginPath(); g.arc(0, 0, r + 12, 0, Math.PI * 2); g.stroke();
      g.restore();
    }

    // Avatar + çerçeve
    drawAvatar(g, f, f.x, f.y, r - 4);
    g.lineWidth = isKing ? 8 : 6;
    g.strokeStyle = f.hitFlash > 0 ? '#ffffff' : isKing ? '#ffd166' : f.col;
    g.shadowColor = isKing ? '#ffd166' : f.col; g.shadowBlur = isKing ? 26 : 12;
    g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0;

    // Altın kalkan küresi
    if (isShield) {
      g.save(); g.translate(f.x, f.y); g.rotate(-time * 3);
      g.fillStyle = 'rgba(255, 209, 102, 0.22)';
      g.beginPath(); g.arc(0, 0, r + 14, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd166'; g.lineWidth = 5; g.setLineDash([28, 12]);
      g.beginPath(); g.arc(0, 0, r + 14, 0, Math.PI * 2); g.stroke();
      g.restore();
    }

    // Kral tacı
    if (isKing && scale === 1) {
      strokeText(g, '👑', f.x, f.y - r - 26 + Math.sin(time * 6) * 5, { size: 46, width: 0 });
    }
    // Kill rozeti
    if (f.kills > 0 && scale === 1) {
      roundRect(g, f.x + r * 0.45, f.y - r - 6, 54, 30, 15);
      g.fillStyle = '#e63946'; g.fill();
      strokeText(g, `⚔️${f.kills}`, f.x + r * 0.45 + 27, f.y - r + 10, { size: 20, width: 3 });
    }
    // İsim etiketi
    if (scale === 1) {
      strokeText(g, f.nick.slice(0, 12), f.x, f.y + r + 22, { size: 24, weight: 800, fill: isKing ? '#ffd166' : '#fff', width: 6, maxWidth: 150 });
    }
    g.restore();
  }

  function drawEffects() {
    // Düşenler
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.t += 1 / 60;
      const p = clamp(f.t / f.dur, 0, 1);
      drawFighter(f, lerp(1, 0.15, p), 1 - p);
      if (p >= 1) falling.splice(i, 1);
    }
    // Şok dalgaları
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.life -= 1 / 60;
      if (w.life <= 0) { waves.splice(i, 1); continue; }
      const p = 1 - w.life / w.maxLife;
      g.save();
      g.globalAlpha = 1 - p;
      g.strokeStyle = w.col; g.lineWidth = w.w * (1 - p * 0.6);
      g.beginPath(); g.arc(w.x, w.y, lerp(w.r, w.maxR, ease.outCubic(p)), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // Düşen meteorlar
    for (const m of meteors) {
      if (m.t < 0) continue;
      const p = clamp(m.t / m.dur, 0, 1);
      // Hedef halkası
      g.save();
      g.strokeStyle = `rgba(255, 84, 0, ${0.4 + p * 0.6})`; g.lineWidth = 5;
      g.beginPath(); g.arc(m.tx, m.ty, lerp(110, 28, p), 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(255, 84, 0, ${0.15 + p * 0.25})`; g.beginPath(); g.arc(m.tx, m.ty, 85, 0, Math.PI * 2); g.fill();
      // Meteor taşı
      const sx = m.tx + 240 * (1 - p), sy = m.ty - 900 * (1 - p);
      const grad = g.createLinearGradient(sx, sy, sx + 90, sy - 260);
      grad.addColorStop(0, '#ffd166'); grad.addColorStop(0.5, '#ff5400'); grad.addColorStop(1, 'rgba(255,84,0,0)');
      g.strokeStyle = grad; g.lineWidth = 34; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 80, sy - 240); g.stroke();
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(sx, sy, 26, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // Şimşek fırtınası
    for (const l of lightnings) {
      if (l.t < 0) continue;
      g.save();
      if (!l.struck) {
        const p = clamp(l.t / l.dur, 0, 1);
        g.strokeStyle = `rgba(76, 201, 240, ${0.4 + p * 0.6})`; g.lineWidth = 5;
        g.beginPath(); g.arc(l.x, l.y, lerp(95, 24, p), 0, Math.PI * 2); g.stroke();
        g.fillStyle = `rgba(76, 201, 240, ${0.12 + p * 0.22})`; g.beginPath(); g.arc(l.x, l.y, 75, 0, Math.PI * 2); g.fill();
      } else {
        const a = clamp(1 - (l.t - l.dur) / 0.28, 0, 1);
        g.globalAlpha = a; g.strokeStyle = '#ffffff'; g.shadowColor = '#4cc9f0'; g.shadowBlur = 26; g.lineWidth = 10;
        g.beginPath(); g.moveTo(l.x + rand(-40, 40), l.y - 750);
        for (let k = 1; k <= 6; k++) g.lineTo(l.x + (k === 6 ? 0 : rand(-45, 45)), l.y - 750 + (k / 6) * 750);
        g.stroke();
      }
      g.restore();
    }
  }

  function drawTopHUD() {
    // Başlık
    strokeText(g, '⚔️ TAHT SAVAŞI', W / 2, 74, { size: 78, weight: 900, fill: '#fff', stroke: '#3a0a0a', width: 14 });
    const left = Math.max(0, Math.ceil(roundDur() - roundT));
    const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
    const ch = chaosLevel();
    const chaosTxt = ch > 1 ? `  ·  🔥 KAOS ${ch}×` : '';
    strokeText(g, `${round}. TUR  ·  ⏱ ${mm}:${ss}  ·  ⚔️ ${fighters.size} SAVAŞÇI${chaosTxt}`, W / 2, 138, { size: 30, fill: left <= 15 || ch >= 3 ? '#ff4d6d' : '#ffd166', width: 7 });

    // Taht Sahibi Kartı
    const king = kingId ? fighters.get(kingId) : null;
    const cx = 150, cy = 178, cw = 780, ch = 114;
    roundRect(g, cx, cy, cw, ch, 28);
    const kg = g.createLinearGradient(cx, cy, cx + cw, cy);
    kg.addColorStop(0, 'rgba(42, 22, 10, .86)'); kg.addColorStop(0.5, 'rgba(72, 42, 12, .9)'); kg.addColorStop(1, 'rgba(42, 22, 10, .86)');
    g.fillStyle = kg; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#ffd166'; g.stroke();
    if (king) {
      drawAvatar(g, king, cx + 68, cy + ch / 2, 42);
      g.lineWidth = 5; g.strokeStyle = '#ffd166'; g.beginPath(); g.arc(cx + 68, cy + ch / 2, 42, 0, Math.PI * 2); g.stroke();
      strokeText(g, '👑 TAHT SAHİBİ', cx + 132, cy + 36, { size: 24, align: 'left', fill: '#ffd166', width: 5 });
      strokeText(g, king.nick, cx + 132, cy + 78, { size: 42, weight: 900, align: 'left', width: 8, maxWidth: 420 });
      strokeText(g, `⚔️ ${king.kills}  ·  ⭐ ${Math.round(king.thronePts)}`, cx + cw - 32, cy + ch / 2, { size: 34, align: 'right', fill: '#ffe599', width: 6 });
    } else {
      strokeText(g, '👑 TAHT BOŞ — MERKEZE YÜRÜ VE TAHTI KAP!', W / 2, cy + ch / 2, { size: 30, fill: '#ffd166', width: 6 });
    }

    // Canlı Kill Feed
    killFeed.forEach((k, i) => {
      const age = time - k.t;
      if (age > 5.5) return;
      const a = age > 4.5 ? 1 - (age - 4.5) : 1;
      const y = 326 + i * 44;
      g.save(); g.globalAlpha = a;
      roundRect(g, 190, y - 19, 700, 38, 19);
      g.fillStyle = 'rgba(15, 10, 24, .72)'; g.fill();
      strokeText(g, k.text, W / 2, y, { size: 24, fill: k.color, width: 5, maxWidth: 660 });
      g.restore();
    });
  }

  function drawBottomHUD() {
    strokeText(g, '💬 "gir" yaz arenaya in!   ·   ❤️ Beğen = Saldır!', W / 2, 1468, { size: 32, fill: '#fff', width: 7 });

    // Alt Yatay Hediye Rehberi (aktif kurallardan otomatik)
    const actionsMap = new Map((ctx.manifest.actions || []).map((a) => [a.id, a]));
    const shown = rules.filter((r) => r.enabled !== false && r.trigger.type === 'gift').slice(0, 5);
    if (shown.length) {
      const pad = 28, gap = 12, bw = (W - pad * 2 - gap * (shown.length - 1)) / shown.length;
      shown.forEach((r, i) => {
        const x = pad + i * (bw + gap), y = 1510, h = 178;
        const lit = time - (ruleFlash.get(r.id) || -99) < 0.9;
        roundRect(g, x, y, bw, h, 24);
        g.fillStyle = lit ? 'rgba(255, 209, 102, .35)' : 'rgba(18, 14, 34, .82)'; g.fill();
        g.lineWidth = lit ? 5 : 3; g.strokeStyle = lit ? '#ffd166' : 'rgba(255,255,255,.16)'; g.stroke();
        const ico = (actionsMap.get(r.action) || {}).icon || '🎁';
        strokeText(g, ico, x + bw / 2, y + 48, { size: 52, width: 0 });
        strokeText(g, r.label || r.action, x + bw / 2, y + 108, { size: 25, weight: 900, width: 5, maxWidth: bw - 14 });
        strokeText(g, describeTrigger(r.trigger).replace(' hediye', ''), x + bw / 2, y + 146, { size: 20, fill: '#ffd166', width: 4, maxWidth: bw - 14 });
      });
    }

    // Alt Top 3 Sıralama Şeridi
    const top = [...scores.values()].sort((a, b) => (b.kills * 10 + b.throne) - (a.kills * 10 + a.throne)).slice(0, 3);
    if (top.length) {
      const y = 1720, cw = 328, gap = 20, startX = (W - (top.length * cw + (top.length - 1) * gap)) / 2;
      const medals = ['🥇', '🥈', '🥉'];
      top.forEach((p, i) => {
        const x = startX + i * (cw + gap);
        roundRect(g, x, y, cw, 118, 24);
        g.fillStyle = 'rgba(14, 12, 28, .82)'; g.fill();
        g.lineWidth = 3; g.strokeStyle = i === 0 ? '#ffd166' : 'rgba(255,255,255,.14)'; g.stroke();
        drawAvatar(g, p, x + 54, y + 59, 34);
        strokeText(g, medals[i], x + 22, y + 26, { size: 28, width: 0 });
        strokeText(g, p.nick, x + 100, y + 42, { size: 26, align: 'left', width: 5, maxWidth: cw - 115 });
        strokeText(g, `⚔️ ${p.kills}  🏆 ${p.wins}`, x + 100, y + 82, { size: 23, align: 'left', fill: '#ffd166', width: 4 });
      });
    }
  }

  function drawVictory() {
    const k = ease.outBack(clamp(phaseT / 0.55, 0, 1));
    g.fillStyle = `rgba(0,0,0,${0.66 * clamp(phaseT * 2, 0, 1)})`; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, 920); g.scale(k, k);
    roundRect(g, -430, -310, 860, 620, 48);
    const vg = g.createLinearGradient(-430, -310, 430, 310);
    vg.addColorStop(0, '#2b150c'); vg.addColorStop(1, '#180d28');
    g.fillStyle = vg; g.fill();
    g.lineWidth = 10; g.strokeStyle = '#ffd166'; g.stroke();
    strokeText(g, '👑 TURUN KRALI 👑', 0, -225, { size: 54, fill: '#ffd166', width: 10 });
    drawAvatar(g, winner, 0, -45, 105);
    g.lineWidth = 9; g.strokeStyle = '#ffd166'; g.beginPath(); g.arc(0, -45, 105, 0, Math.PI * 2); g.stroke();
    strokeText(g, winner.nick, 0, 125, { size: 66, weight: 900, width: 12, maxWidth: 780 });
    strokeText(g, `⚔️ ${winner.kills || 0} Eleme`, 0, 205, { size: 42, fill: '#ffe599', width: 8 });
    g.restore();
    strokeText(g, `Yeni tur ${Math.max(0, Math.ceil(7 - phaseT))} sn sonra başlıyor…`, W / 2, 1340, { size: 40, width: 8 });
  }

  // ---------- ana döngü ----------
  const handle = loop((dt) => {
    time += dt; phaseT += dt;
    if (phase === 'fight') { roundT += dt; updatePhysics(dt); }
    else if (phaseT >= 7) nextRound();

    for (const e of embers) { e.y += e.vy * dt; e.x += e.vx * dt; if (e.y < -10) { e.y = H + 10; e.x = rand(0, W); } }
    shake = Math.max(0, shake - dt * 42);
    flash = Math.max(0, flash - dt * 1.8);
    fx.update(dt);

    g.save();
    if (shake > 0.5) g.translate(rand(-shake, shake), rand(-shake, shake));
    drawLavaBackdrop();
    drawArena();
    drawEffects();
    const sorted = [...fighters.values()].sort((a, b) => a.y - b.y);
    for (const f of sorted) drawFighter(f);
    fx.draw(g);
    g.restore();

    drawTopHUD();
    drawBottomHUD();
    if (phase === 'win') drawVictory();
    if (flash > 0.01) { g.fillStyle = flashCol; g.globalAlpha = flash * 0.4; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  });

  // ---------- platform kancaları ----------
  return {
    onEvent(ev) {
      if (!ev.user) return;
      if (ev.type === 'chat' || ev.type === 'member') {
        const f = spawn(ev.user);
        if (f) f.lastActive = time;
      }
    },
    onAction(a) {
      if (!a.user) return;
      if (a.rule && a.rule.id) ruleFlash.set(a.rule.id, time);
      const P = a.params || {};
      const f = spawn(a.user);
      if (!f) return;
      switch (a.action) {
        case 'join':
          dash(f, 1.2);
          break;
        case 'dash':
          dash(f, Math.min(4, (Number(P.power) || 1) * Math.min(a.times, 3)));
          break;
        case 'giant':
          f.giantUntil = Math.min(time + 18, Math.max(f.giantUntil, time) + (Number(P.seconds) || 12) * (1 + Math.min(a.times - 1, 4) * 0.25));
          fx.burst(f.x, f.y, 28, '#ff6b35', 420);
          fx.float(f.x, f.y - 60, '🔥 DEV MODU!', '#ff9e00');
          addShake(10); play(() => sound.powerup());
          break;
        case 'shockwave':
          triggerShockwave(f, (Number(P.force) || 950) * (1 + (Math.min(a.times, 5) - 1) * 0.18));
          break;
        case 'shield':
          f.shieldUntil = Math.min(time + 18, Math.max(f.shieldUntil, time) + (Number(P.seconds) || 12) * (1 + Math.min(a.times - 1, 4) * 0.25));
          fx.float(f.x, f.y - 60, '🛡️ KALKAN!', '#ffd166');
          play(() => sound.shield());
          break;
        case 'meteor':
          triggerMeteor(f, (Number(P.count) || 3) * Math.min(a.times, 3));
          break;
        case 'blackhole':
          triggerBlackhole(f, (Number(P.seconds) || 3.5));
          break;
      }
    },
    onRules(next) { rules = next || []; },
    onSettings(next) { settings = { ...next }; },
    destroy() { handle.stop(); sound.stopMusic(); canvas.remove(); },
  };
}
