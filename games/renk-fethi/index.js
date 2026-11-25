// Renk Fethi — 4 renkli haritada kalabalık dostu bölge fetih savaşı.
import { loop, createCanvas, Roster, Particles, Sound, drawAvatar, strokeText, roundRect, clamp, lerp, rand, randInt, pick, ease, fmt } from '@sdk/kit.js';
import { describeTrigger } from '@sdk/rules-text.js';

const W = 1080, H = 1920;
const GRID = 24, TOTAL = GRID * GRID;
const MAP = { x: 60, y: 468, size: 960, cell: 960 / GRID };
const TEAMS = [
  { i: 0, name: 'KIRMIZI', main: '#ff3b5c', light: '#ff758f', dark: '#801028', corner: [2, 2] },
  { i: 1, name: 'MAVİ',    main: '#2f8cff', light: '#74b5ff', dark: '#103b7a', corner: [GRID - 3, 2] },
  { i: 2, name: 'YEŞİL',   main: '#22d07a', light: '#6ef2af', dark: '#0c6036', corner: [2, GRID - 3] },
  { i: 3, name: 'SARI',    main: '#ffcc33', light: '#ffe585', dark: '#7c5d06', corner: [GRID - 3, GRID - 3] },
];

export default async function createGame(ctx) {
  const { canvas, ctx: g } = createCanvas(ctx.root);
  const fx = new Particles(900);
  const sound = new Sound();
  let settings = { ...ctx.settings };
  let rules = ctx.rules || [];

  const roster = new Roster({ max: 800, idle: 1800, idleGifter: 3600 });
  const owner = new Int8Array(TOTAL);        // 0..3 veya -1 (nötr)
  const popAnim = new Float32Array(TOTAL);   // kare ele geçirilince zıplama animasyonu
  const counts = [0, 0, 0, 0];
  const wins = [0, 0, 0, 0];
  const shieldUntil = [0, 0, 0, 0];
  const memberCounts = [0, 0, 0, 0];

  const orbs = [];        // uçan fetih topları { team, sx, sy, tx, ty, gx, gy, t, dur, user }
  const lasers = [];      // lazer taramaları { team, row, col, t, dur }
  const waves = [];       // genişleyen şok halkaları
  let goldenTile = null;  // { gx, gy, spawnedAt }
  let nextEventAt = 18;
  let time = 0, round = 1, roundT = 0, phase = 'fight', phaseT = 0;
  let shake = 0, flash = 0, flashCol = '#fff', winnerTeam = 0, combo = 0, lastCapT = 0;
  const ruleFlash = new Map();

  const winPct = () => clamp(Number(settings.winPercent) || 68, 40, 95);
  const roundDur = () => Math.max(30, Number(settings.roundSeconds) || 120);
  const play = (fn) => { if (settings.sound) try { fn(); } catch { /* sessiz */ } };
  const addShake = (v) => { shake = Math.min(30, Math.max(shake, v)); };

  const idx = (gx, gy) => gy * GRID + gx;
  const cellCenter = (gx, gy) => ({ x: MAP.x + (gx + 0.5) * MAP.cell, y: MAP.y + (gy + 0.5) * MAP.cell });

  function resetMap() {
    counts.fill(0);
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const t = (gy < GRID / 2 ? 0 : 2) + (gx < GRID / 2 ? 0 : 1);
        owner[idx(gx, gy)] = t;
        popAnim[idx(gx, gy)] = 0;
        counts[t]++;
      }
    }
    orbs.length = 0; lasers.length = 0; waves.length = 0;
    shieldUntil.fill(0);
    goldenTile = null;
    nextEventAt = 18;
  }
  resetMap();

  function setTile(gx, gy, team, { bypassShield = false } = {}) {
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return false;
    const k = idx(gx, gy), prev = owner[k];
    if (prev === team) return false;
    if (!bypassShield && prev >= 0 && time < shieldUntil[prev] && Math.random() < 0.55) return false;
    if (prev >= 0) counts[prev]--;
    owner[k] = team;
    if (team >= 0) counts[team]++;
    popAnim[k] = 1;

    // Altın kareyi kapan renk bedava bomba patlatır!
    if (goldenTile && goldenTile.gx === gx && goldenTile.gy === gy && team >= 0) {
      goldenTile = null;
      const p = cellCenter(gx, gy);
      fx.burst(p.x, p.y, 40, '#ffd166', 480);
      play(() => sound.chest());
      blastCircle(gx, gy, 3.2, team, true);
      ctx.ui.toast(`🎯 ${TEAMS[team].name} ALTIN KAREYİ KAPTI!`, { color: TEAMS[team].main, duration: 2600 });
    }
    return true;
  }

  function blastCircle(cx, cy, radius, team, bypassShield = false) {
    let taken = 0;
    const r2 = radius * radius;
    for (let gy = Math.max(0, Math.floor(cy - radius)); gy <= Math.min(GRID - 1, Math.ceil(cy + radius)); gy++) {
      for (let gx = Math.max(0, Math.floor(cx - radius)); gx <= Math.min(GRID - 1, Math.ceil(cx + radius)); gx++) {
        if ((gx - cx) ** 2 + (gy - cy) ** 2 <= r2) {
          if (setTile(gx, gy, team, { bypassShield })) taken++;
        }
      }
    }
    const p = cellCenter(cx, cy);
    waves.push({ x: p.x, y: p.y, r: 20, maxR: radius * MAP.cell * 1.4, col: TEAMS[team].light, life: 0.55, maxLife: 0.55, w: 12 });
    return taken;
  }

  // Bir rengin cephe (sınır) hedeflerini bulur; yoksa en yakın rakip kareyi seçer
  function pickTargetTile(team) {
    const border = [];
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        if (owner[idx(gx, gy)] === team) continue;
        // Komşularından biri bizim renkse cephedir
        const adj = (gx > 0 && owner[idx(gx - 1, gy)] === team)
          || (gx < GRID - 1 && owner[idx(gx + 1, gy)] === team)
          || (gy > 0 && owner[idx(gx, gy - 1)] === team)
          || (gy < GRID - 1 && owner[idx(gx, gy + 1)] === team);
        if (adj) border.push([gx, gy]);
      }
    }
    if (border.length) {
      // Altın kare sınıra yakınsa öncelik ver
      if (goldenTile && Math.random() < 0.35) {
        border.sort((a, b) => Math.hypot(a[0] - goldenTile.gx, a[1] - goldenTile.gy) - Math.hypot(b[0] - goldenTile.gx, b[1] - goldenTile.gy));
        return border[0];
      }
      return pick(border);
    }
    // Hiç karesi kalmadıysa köşesinden yeniden doğar
    return TEAMS[team].corner;
  }

  function joinColor(user, teamIdx, silent = false) {
    const p = roster.touch(user);
    if (!p || teamIdx < 0 || teamIdx > 3) return null;
    if (p.team === teamIdx) return p;
    if (p.team != null) memberCounts[p.team] = Math.max(0, memberCounts[p.team] - 1);
    p.team = teamIdx;
    memberCounts[teamIdx]++;
    if (!silent) {
      ctx.ui.toast(`${p.nick} → ${TEAMS[teamIdx].name}`, { color: TEAMS[teamIdx].main, duration: 1800 });
      play(() => sound.pop());
      launchOrbs(teamIdx, 2, p);
    }
    return p;
  }

  function teamOf(user) {
    const p = roster.touch(user);
    if (!p) return null;
    if (p.team == null) {
      // En az destekçisi olan renge dengeli dağıt
      let best = 0;
      for (let i = 1; i < 4; i++) if (memberCounts[i] < memberCounts[best]) best = i;
      joinColor(user, best, true);
    }
    return p;
  }

  function launchOrbs(team, n, user) {
    // %12 altına düşen renge geri dönüş (comeback) desteği (+25% top)
    const comeback = counts[team] < TOTAL * 0.12 ? 1.25 : 1;
    const total = Math.min(Math.ceil(n * comeback), 45);
    const base = cellCenter(TEAMS[team].corner[0], TEAMS[team].corner[1]);
    for (let i = 0; i < total; i++) {
      const [gx, gy] = pickTargetTile(team);
      const tgt = cellCenter(gx, gy);
      orbs.push({
        team, sx: base.x + rand(-40, 40), sy: base.y + rand(-40, 40),
        tx: tgt.x, ty: tgt.y, gx, gy, t: -i * 0.025, dur: rand(0.28, 0.48), user,
      });
    }
    if (orbs.length > 260) orbs.splice(0, orbs.length - 260);
  }

  function triggerBomb(team, radius, user) {
    // En büyük rakibin içinden hedef seç
    const rivals = [0, 1, 2, 3].filter((i) => i !== team).sort((a, b) => counts[b] - counts[a]);
    const targetTeam = rivals[0];
    const cands = [];
    for (let gy = 2; gy < GRID - 2; gy++) for (let gx = 2; gx < GRID - 2; gx++) if (owner[idx(gx, gy)] === targetTeam) cands.push([gx, gy]);
    const [gx, gy] = cands.length ? pick(cands) : [GRID >> 1, GRID >> 1];
    const taken = blastCircle(gx, gy, radius, team, true);
    if (user) user.score += taken * 4;
    const p = cellCenter(gx, gy);
    fx.burst(p.x, p.y, 44, TEAMS[team].light, 520);
    addShake(16); flash = 0.25; flashCol = TEAMS[team].main;
    play(() => sound.explosion());
    ctx.ui.toast(`💥 ${user ? user.nick : TEAMS[team].name} RENK BOMBASI attı!`, { color: TEAMS[team].main, duration: 2400 });
  }

  function triggerLaser(team, user) {
    const row = randInt(2, GRID - 3), col = randInt(2, GRID - 3);
    lasers.push({ team, row, col, t: 0, dur: 0.75 });
    let taken = 0;
    for (let i = 0; i < GRID; i++) {
      if (setTile(i, row, team, { bypassShield: true })) taken++;
      if (setTile(col, i, team, { bypassShield: true })) taken++;
    }
    if (user) user.score += taken * 5;
    addShake(18); flash = 0.3; flashCol = TEAMS[team].light;
    play(() => sound.lightning());
    ctx.ui.toast(`⚡ ${user ? user.nick : TEAMS[team].name} LAZER TARAMA yaptı!`, { color: TEAMS[team].main, duration: 2800 });
  }

  function triggerSupernova(team, user) {
    const taken = blastCircle(GRID / 2 - 0.5, GRID / 2 - 0.5, 7.6, team, true);
    if (user) user.score += taken * 6;
    const p = cellCenter(GRID / 2 - 0.5, GRID / 2 - 0.5);
    fx.burst(p.x, p.y, 85, TEAMS[team].light, 720);
    addShake(28); flash = 0.5; flashCol = TEAMS[team].main;
    play(() => sound.explosion(true));
    ctx.ui.toast(`🌋 ${user ? user.nick : TEAMS[team].name} SÜPERNOVA PATLATTI!`, { color: TEAMS[team].main, duration: 3500 });
  }

  function triggerMapEvent() {
    if (Math.random() < 0.6) {
      goldenTile = { gx: randInt(4, GRID - 5), gy: randInt(4, GRID - 5), spawnedAt: time };
      play(() => sound.ding());
      ctx.ui.toast('🎯 ALTIN KARE ÇIKTI! Kapan renk dev bomba kazanır!', { color: '#ffd166', duration: 2800 });
    } else {
      // Merkezde nötr fırtına alanı aç
      const cx = GRID / 2 - 0.5, cy = GRID / 2 - 0.5;
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        if ((gx - cx) ** 2 + (gy - cy) ** 2 <= 18) setTile(gx, gy, -1, { bypassShield: true });
      }
      addShake(14); play(() => sound.quake());
      ctx.ui.toast('🌀 MERKEZ SIFIRLANDI! Hemen saldırın!', { color: '#25f4ee', duration: 2800 });
    }
    nextEventAt = roundT + 22;
  }

  function finishRound(teamIdx) {
    phase = 'win'; phaseT = 0; winnerTeam = teamIdx; wins[teamIdx]++;
    fx.confetti(280);
    flash = 0.45; flashCol = TEAMS[teamIdx].main;
    play(() => sound.fanfare());
  }

  function nextRound() {
    round++; roundT = 0; phase = 'fight'; phaseT = 0;
    resetMap();
  }

  // ---------- güncelleme ----------
  function update(dt) {
    time += dt; phaseT += dt;
    roster.update(dt);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt * 1.8);
    for (let i = 0; i < TOTAL; i++) if (popAnim[i] > 0) popAnim[i] = Math.max(0, popAnim[i] - dt * 4.5);

    if (phase === 'fight') {
      roundT += dt;
      if (settings.randomEvents !== false && roundT >= nextEventAt && roundT < roundDur() - 10) triggerMapEvent();

      // Uçan topları güncelle
      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.t += dt;
        if (o.t >= o.dur) {
          orbs.splice(i, 1);
          if (setTile(o.gx, o.gy, o.team)) {
            if (o.user) o.user.score += 2;
            combo = time - lastCapT < 0.6 ? Math.min(20, combo + 1) : 0;
            lastCapT = time;
            play(() => sound.capture(combo));
            fx.burst(o.tx, o.ty, 4, TEAMS[o.team].light, 150);
          }
        }
      }

      // Kazanma kontrolü
      const targetTiles = Math.ceil((winPct() / 100) * TOTAL);
      for (let i = 0; i < 4; i++) {
        if (counts[i] >= targetTiles) { finishRound(i); break; }
      }
      if (phase === 'fight' && roundT >= roundDur()) {
        let best = 0;
        for (let i = 1; i < 4; i++) if (counts[i] > counts[best]) best = i;
        finishRound(best);
      }
    } else if (phaseT >= 7) {
      nextRound();
    }

    for (let i = lasers.length - 1; i >= 0; i--) { lasers[i].t += dt; if (lasers[i].t >= lasers[i].dur) lasers.splice(i, 1); }
    for (let i = waves.length - 1; i >= 0; i--) { waves[i].life -= dt; if (waves[i].life <= 0) waves.splice(i, 1); }
    fx.update(dt);
  }

  // ---------- çizim ----------
  function drawBackground() {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d0c1d'); bg.addColorStop(0.5, '#14132e'); bg.addColorStop(1, '#090915');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
  }

  function drawTopHUD() {
    strokeText(g, '🎨 RENK FETHİ', W / 2, 70, { size: 76, weight: 900, width: 12 });
    const left = Math.max(0, Math.ceil(roundDur() - roundT));
    const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
    strokeText(g, `${round}. TUR  ·  ⏱ ${mm}:${ss}  ·  HEDEF %${winPct()}`, W / 2, 134, { size: 30, fill: '#ffd166', width: 6 });

    // 4 Renk Kartı
    const bw = 236, gap = 12, startX = (W - (4 * bw + 3 * gap)) / 2;
    TEAMS.forEach((t, i) => {
      const x = startX + i * (bw + gap), y = 175, h = 132;
      const pct = Math.round((counts[i] / TOTAL) * 100);
      const shielded = time < shieldUntil[i];
      roundRect(g, x, y, bw, h, 24);
      g.fillStyle = t.dark; g.fill();
      g.lineWidth = shielded ? 6 : 4; g.strokeStyle = shielded ? '#ffd166' : t.main; g.stroke();
      strokeText(g, `${i + 1}`, x + 36, y + 44, { size: 48, weight: 900, fill: t.light, width: 6 });
      strokeText(g, t.name + (shielded ? ' 🛡️' : ''), x + 68, y + 40, { size: 26, align: 'left', width: 5, maxWidth: bw - 80 });
      strokeText(g, `%${pct}`, x + bw / 2, y + 96, { size: 44, weight: 900, fill: '#fff', width: 8 });
      strokeText(g, `🏆${wins[i]}`, x + bw - 16, y + 106, { size: 22, align: 'right', fill: '#ffd166', width: 4 });
    });

    // Canlı Bölge Yüzde Çubuğu (Halat çekme barı)
    const bx = 60, by = 330, bwBar = 960, bh = 36;
    g.save();
    roundRect(g, bx, by, bwBar, bh, 18); g.clip();
    g.fillStyle = '#24243a'; g.fillRect(bx, by, bwBar, bh);
    let cx = bx;
    for (let i = 0; i < 4; i++) {
      const w = (counts[i] / TOTAL) * bwBar;
      g.fillStyle = TEAMS[i].main; g.fillRect(cx, by, w + 1, bh);
      cx += w;
    }
    g.restore();
    roundRect(g, bx, by, bwBar, bh, 18); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();

    strokeText(g, '💬 1-2-3-4 yaz rengini seç!  ·  ❤️ Beğen = Fethet!', W / 2, 416, { size: 32, fill: '#fff', width: 7 });
  }

  function drawMap() {
    // Harita çerçevesi
    roundRect(g, MAP.x - 10, MAP.y - 10, MAP.size + 20, MAP.size + 20, 26);
    g.fillStyle = '#090914'; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();

    const pad = 2.5, c = MAP.cell;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const k = idx(gx, gy), o = owner[k], anim = popAnim[k];
        const s = 1 + anim * 0.22;
        const px = MAP.x + gx * c + c / 2, py = MAP.y + gy * c + c / 2;
        const w = (c - pad * 2) * s;
        g.fillStyle = o >= 0 ? (anim > 0.35 ? TEAMS[o].light : TEAMS[o].main) : '#3a3c55';
        roundRect(g, px - w / 2, py - w / 2, w, w, 7);
        g.fill();
        // Kalkanlı takım karelerinde hafif altın parlama
        if (o >= 0 && time < shieldUntil[o]) {
          g.strokeStyle = 'rgba(255, 209, 102, .45)'; g.lineWidth = 2; g.stroke();
        }
      }
    }

    // Altın Kare
    if (goldenTile) {
      const p = cellCenter(goldenTile.gx, goldenTile.gy);
      const pulse = 1 + 0.15 * Math.sin(time * 8);
      g.save(); g.translate(p.x, p.y); g.scale(pulse, pulse);
      roundRect(g, -c * 0.55, -c * 0.55, c * 1.1, c * 1.1, 12);
      g.fillStyle = '#ffd166'; g.shadowColor = '#ffd166'; g.shadowBlur = 24; g.fill(); g.shadowBlur = 0;
      strokeText(g, '⭐', 0, 2, { size: 32, width: 0 });
      g.restore();
    }

    // Uçan fetih topları
    for (const o of orbs) {
      if (o.t < 0) continue;
      const p = clamp(o.t / o.dur, 0, 1);
      const x = lerp(o.sx, o.tx, ease.outCubic(p)), y = lerp(o.sy, o.ty, ease.outCubic(p)) - Math.sin(p * Math.PI) * 70;
      g.save();
      g.fillStyle = TEAMS[o.team].light; g.shadowColor = TEAMS[o.team].main; g.shadowBlur = 16;
      g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.restore();
    }

    // Lazer taramaları
    for (const l of lasers) {
      const a = 1 - clamp(l.t / l.dur, 0, 1);
      const ry = MAP.y + (l.row + 0.5) * c, cx = MAP.x + (l.col + 0.5) * c;
      g.save(); g.globalAlpha = a;
      g.fillStyle = TEAMS[l.team].light; g.shadowColor = TEAMS[l.team].main; g.shadowBlur = 28;
      g.fillRect(MAP.x, ry - c * 0.45, MAP.size, c * 0.9);
      g.fillRect(cx - c * 0.45, MAP.y, c * 0.9, MAP.size);
      g.fillStyle = '#fff';
      g.fillRect(MAP.x, ry - 6, MAP.size, 12);
      g.fillRect(cx - 6, MAP.y, 12, MAP.size);
      g.restore();
    }

    // Şok halkaları
    for (const w of waves) {
      const p = 1 - w.life / w.maxLife;
      g.save(); g.globalAlpha = 1 - p; g.strokeStyle = w.col; g.lineWidth = w.w * (1 - p * 0.6);
      g.beginPath(); g.arc(w.x, w.y, lerp(w.r, w.maxR, ease.outCubic(p)), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  function drawBottomHUD() {
    const actionsMap = new Map((ctx.manifest.actions || []).map((a) => [a.id, a]));
    const shown = rules.filter((r) => r.enabled !== false && r.trigger.type === 'gift').slice(0, 5);
    if (shown.length) {
      const pad = 28, gap = 12, bw = (W - pad * 2 - gap * (shown.length - 1)) / shown.length;
      shown.forEach((r, i) => {
        const x = pad + i * (bw + gap), y = 1485, h = 180;
        const lit = time - (ruleFlash.get(r.id) || -99) < 0.9;
        roundRect(g, x, y, bw, h, 24);
        g.fillStyle = lit ? 'rgba(255, 209, 102, .35)' : 'rgba(18, 16, 36, .86)'; g.fill();
        g.lineWidth = lit ? 5 : 3; g.strokeStyle = lit ? '#ffd166' : 'rgba(255,255,255,.16)'; g.stroke();
        strokeText(g, (actionsMap.get(r.action) || {}).icon || '🎁', x + bw / 2, y + 48, { size: 52, width: 0 });
        strokeText(g, r.label || r.action, x + bw / 2, y + 108, { size: 24, weight: 900, width: 5, maxWidth: bw - 14 });
        strokeText(g, describeTrigger(r.trigger).replace(' hediye', ''), x + bw / 2, y + 148, { size: 20, fill: '#ffd166', width: 4, maxWidth: bw - 14 });
      });
    }

    const top = roster.top(3).filter((p) => p.score > 0);
    if (top.length) {
      const y = 1705, cw = 328, gap = 20, startX = (W - (top.length * cw + (top.length - 1) * gap)) / 2;
      const medals = ['🥇', '🥈', '🥉'];
      top.forEach((p, i) => {
        const x = startX + i * (cw + gap), t = TEAMS[p.team ?? 0];
        roundRect(g, x, y, cw, 118, 24);
        g.fillStyle = 'rgba(14, 14, 30, .86)'; g.fill();
        g.lineWidth = 3; g.strokeStyle = t ? t.main : 'rgba(255,255,255,.15)'; g.stroke();
        drawAvatar(g, p, x + 54, y + 59, 34);
        strokeText(g, medals[i], x + 22, y + 26, { size: 28, width: 0 });
        strokeText(g, p.nick, x + 100, y + 42, { size: 26, align: 'left', width: 5, maxWidth: cw - 115 });
        strokeText(g, `⭐ ${fmt(p.score)}`, x + 100, y + 82, { size: 23, align: 'left', fill: '#ffd166', width: 4 });
      });
    }
  }

  function drawVictory() {
    const t = TEAMS[winnerTeam], k = ease.outBack(clamp(phaseT / 0.55, 0, 1));
    g.fillStyle = `rgba(0,0,0,${0.66 * clamp(phaseT * 2, 0, 1)})`; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, 920); g.scale(k, k);
    roundRect(g, -430, -280, 860, 560, 48);
    g.fillStyle = t.dark; g.fill();
    g.lineWidth = 10; g.strokeStyle = t.main; g.stroke();
    strokeText(g, '🏆', 0, -165, { size: 130, width: 0 });
    strokeText(g, `${t.name} FETHETTİ!`, 0, -25, { size: 74, weight: 900, width: 12, maxWidth: 800 });
    const mvp = roster.all().filter((p) => p.team === winnerTeam).sort((a, b) => b.score - a.score)[0];
    if (mvp) {
      drawAvatar(g, mvp, -150, 125, 50);
      strokeText(g, `MVP: ${mvp.nick}`, -80, 125, { size: 42, align: 'left', width: 8, maxWidth: 480 });
    }
    g.restore();
    strokeText(g, `Yeni tur ${Math.max(0, Math.ceil(7 - phaseT))} sn sonra…`, W / 2, 1310, { size: 40, width: 8 });
  }

  const handle = loop((dt) => {
    update(dt);
    g.save();
    if (shake > 0.5) g.translate(rand(-shake, shake), rand(-shake, shake));
    drawBackground();
    drawTopHUD();
    drawMap();
    fx.draw(g);
    g.restore();
    drawBottomHUD();
    if (phase === 'win') drawVictory();
    if (flash > 0.01) { g.fillStyle = flashCol; g.globalAlpha = flash * 0.35; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  });

  return {
    onEvent(ev) {
      if (!ev.user) return;
      roster.touch(ev.user);
      if ((ev.type === 'member' || (ev.type === 'chat' && !ev.matched)) && phase === 'fight') {
        const p = teamOf(ev.user);
        if (p) {
          launchOrbs(p.team, 2, p);
          if (!String(ev.user.id || '').startsWith('demo_')) {
            ctx.ui.toast(`🎨 ${ev.user.nick} → ${TEAMS[p.team].name}`, { color: TEAMS[p.team].main, duration: 1700 });
            play(() => sound.pop());
          }
        }
      }
    },
    onAction(a) {
      if (!a.user || phase !== 'fight') return;
      if (a.rule && a.rule.id) ruleFlash.set(a.rule.id, time);
      const P = a.params || {};
      if (a.action === 'join_color') { joinColor(a.user, Number(P.color) || 0); return; }
      const p = teamOf(a.user);
      if (!p) return;
      const t = p.team;
      switch (a.action) {
        case 'push': launchOrbs(t, (Number(P.orbs) || 2) * Math.min(a.times, 8), p); break;
        case 'wave':
          p.gifted++;
          launchOrbs(t, (Number(P.orbs) || 14) * Math.min(a.times, 4), p);
          play(() => sound.whoosh());
          break;
        case 'bomb':
          p.gifted++;
          for (let i = 0; i < Math.min(a.times, 3); i++) triggerBomb(t, Number(P.radius) || 3.4, p);
          break;
        case 'shield':
          p.gifted++;
          shieldUntil[t] = Math.min(time + 18, Math.max(shieldUntil[t], time) + (Number(P.seconds) || 12) * (1 + Math.min(a.times - 1, 4) * 0.25));
          play(() => sound.shield());
          ctx.ui.toast(`🛡️ ${p.nick} ${TEAMS[t].name} için KALE KALKANI açtı!`, { color: TEAMS[t].main, duration: 2400 });
          break;
        case 'laser':
          p.gifted++;
          triggerLaser(t, p);
          break;
        case 'supernova':
          p.gifted++;
          triggerSupernova(t, p);
          break;
      }
    },
    onRules(next) { rules = next || []; },
    onSettings(next) { settings = { ...next }; },
    destroy() { handle.stop(); sound.stopMusic(); canvas.remove(); },
  };
}
