// Süper Hipodrom 3D — Canlı Spor Yayını (Broadcast Telemetry) HUD Sistemi.
// ECC design-system + frontend-design-direction + make-interfaces-feel-better ilkeleriyle tasarlandı:
// - Tek birleşik üst skor/telemetri paneli (5 kopuk hap yerine düzenli hiyerarşi)
// - Eşmerkezli köşe yarıçapları (outer = inner + padding)
// - Net kademe ayrımı (Sabotaj / Güç / Efsane hediye kartları)
// - Motor sporları numara plakalı 3B projeksiyon etiketleri + F1 başlangıç ışıkları.
import * as THREE from 'three';
import { roundRect, clamp, ease, drawAvatar, image } from '@sdk/kit.js';
import { LANES } from './horse.js';

const W = 1080, H = 1920;

const TOKENS = {
  font: '"Segoe UI", "Inter", system-ui, sans-serif',
  mono: '"Cascadia Mono", "Consolas", "Segoe UI", monospace',
  bgPanel: 'rgba(8, 12, 22, 0.46)',
  bgCell: 'rgba(14, 20, 34, 0.42)',
  bgRecess: 'rgba(5, 8, 14, 0.44)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderStrong: 'rgba(255, 255, 255, 0.24)',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  gold: '#f5c542',
  silver: '#e2e8f0',
  bronze: '#e09153',
  liveRed: '#ff2e54',
  cyan: '#25f4ee',
  emerald: '#19e6a8',
  sabotage: '#ff5268',
  power: '#25f4ee',
  ultimate: '#f5c542',
};

const projV = new THREE.Vector3();

function fillRounded(g, x, y, w, h, r, fill, stroke, lw = 1.5) {
  roundRect(g, x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}

function drawText(g, text, x, y, {
  size = 20, weight = 700, fill = TOKENS.text, align = 'center',
  font = TOKENS.font, maxWidth, shadow = false,
} = {}) {
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (shadow) {
    g.shadowColor = 'rgba(0,0,0,0.65)';
    g.shadowBlur = 4;
    g.shadowOffsetY = 1;
  }
  g.fillStyle = fill;
  if (maxWidth) g.fillText(text, x, y, maxWidth);
  else g.fillText(text, x, y);
  g.restore();
}

function giftPowerMeta(r) {
  const act = r && r.action;
  if (act === 'throw_tomato') return { icon: '🌹', name: 'DOMATES', actIcon: '🍅' };
  if (act === 'throw_mud') return { icon: '🍦', name: 'ÇAMUR', actIcon: '🟤' };
  if (act === 'lasso') return { icon: '🐼', name: 'HALAT', actIcon: '🤠' };
  if (act === 'mod_pegasus') return { icon: '☕', name: 'PEGASUS', actIcon: '🪽' };
  if (act === 'mod_unicorn') return { icon: '🍩', name: 'UNICORN', actIcon: '🦄' };
  if (act === 'mod_dragon') return { icon: '👑', name: 'EJDERHA', actIcon: '🐉' };
  if (act === 'mod_flame') return { icon: '🔥', name: 'ALEV', actIcon: '🔥' };
  if (act === 'mod_lightning') return { icon: '⚡', name: 'YILDIRIM', actIcon: '⚡' };
  if (act === 'throw_honey') return { icon: '🍯', name: 'BAL', actIcon: '🍯' };
  return { icon: '⚡', name: String((r && r.label) || 'GÜÇ').toUpperCase().slice(0, 9), actIcon: '⚡' };
}

function cardTier(actionId) {
  if (['throw_tomato', 'throw_mud', 'throw_honey', 'banana', 'lasso'].includes(actionId)) {
    return { tag: 'SABOTAJ', color: TOKENS.sabotage, bg: 'rgba(255, 82, 104, 0.08)' };
  }
  if (actionId === 'mod_dragon') {
    return { tag: 'EFSANE', color: TOKENS.ultimate, bg: 'rgba(245, 197, 66, 0.12)' };
  }
  return { tag: 'GÜÇ', color: TOKENS.power, bg: 'rgba(37, 244, 238, 0.08)' };
}

export function createHudRenderer(canvas) {
  const g = canvas.getContext('2d');

  // ---------- 1) TikTok Mobil Güvenli Bölge HUD'u: Solda Tam 1–7 Canlı Sıralama + Sağda Komut & Sıra ----------
  function drawChipRowInBox(chips, boxX, boxW, cy, ch, fontSize, { gap = 8, padX = 12 } = {}) {
    const measured = chips.map((c) => {
      g.font = `900 ${fontSize}px ${TOKENS.font}`;
      const kw = g.measureText(c.key).width + padX * 1.3;
      g.font = `800 ${fontSize - 1}px ${TOKENS.font}`;
      const dw = c.desc ? g.measureText(c.desc).width + padX : 0;
      return { ...c, kw, dw, w: kw + dw + (c.desc ? 8 : 6) };
    });
    const totalW = measured.reduce((a, c) => a + c.w, 0) + gap * (measured.length - 1);
    const maxW = boxW - 18;
    const scaleX = totalW > maxW ? maxW / totalW : 1;
    const effW = totalW * scaleX;
    let cx = boxX + (boxW - effW) / 2;
    for (const c of measured) {
      const cw = c.w * scaleX;
      const kw = c.kw * scaleX;
      if (c.desc) {
        fillRounded(g, cx, cy, cw, ch, 12, c.bg || 'rgba(12, 18, 32, 0.56)', c.border || 'rgba(255,255,255,0.24)', 1.6);
        fillRounded(g, cx + 4, cy + 4, kw, ch - 8, 8, c.keyBg || 'rgba(255,255,255,0.20)', null);
        drawText(g, c.key, cx + 4 + kw / 2, cy + ch / 2 + 1, {
          size: Math.round(fontSize * scaleX), weight: 900, fill: c.keyFill || '#fff', maxWidth: kw - 6, shadow: c.keyFill === '#fff',
        });
        drawText(g, c.desc, cx + kw + (cw - kw) / 2 + 2, cy + ch / 2 + 1, {
          size: Math.round((fontSize - 1) * scaleX), weight: 900, fill: c.descFill || TOKENS.gold, maxWidth: cw - kw - 10, shadow: true,
        });
      } else {
        // Açıklamasız tek parça canlı buton (içi içe kutu yok, optik tam ortalı!)
        fillRounded(g, cx, cy, cw, ch, 12, c.keyBg || 'rgba(255,255,255,0.20)', c.border || 'rgba(255,255,255,0.45)', 2.0);
        drawText(g, c.key, cx + cw / 2, cy + ch / 2 + 1, {
          size: Math.round(fontSize * scaleX), weight: 900, fill: c.keyFill || '#fff', maxWidth: cw - 12, shadow: c.keyFill === '#fff',
        });
      }
      cx += cw + gap * scaleX;
    }
  }

  function drawTopDeck(s) {
    const { racers, sorted, round, len, time, raceQueue, openSeats = 0, spectatorCount, laneCount = 7 } = s;
    const lead = sorted[0];
    const leadZ = lead ? lead.z : 0;
    const remMeters = Math.max(0, Math.round(len - leadZ));
    const nearFinish = remMeters <= 60;

    // Hafif şeffaf üst vinyet (arka plandaki 3B stadyum ve gökyüzü net görünsün!)
    const topFade = g.createLinearGradient(0, 0, 0, 420);
    topFade.addColorStop(0, 'rgba(4, 7, 14, 0.36)');
    topFade.addColorStop(1, 'rgba(4, 7, 14, 0)');
    g.fillStyle = topFade;
    g.fillRect(0, 0, W, 420);

    // =========================================================================
    // 1A) SOL CANLI TAM SIRALAMA KULESİ (Şeffaf füme cam, TÜM 1–7 YARIŞÇI ANLIK!)
    // =========================================================================
    const tx = 16, ty = 184, tw = 362;
    const headH = 74;
    const rowH = 47, rowGap = 4;
    const rowsCount = Math.max(1, sorted.length);
    const bodyH = rowsCount * rowH + Math.max(0, rowsCount - 1) * rowGap + 14;
    const towerH = headH + bodyH;

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.34)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 4;
    fillRounded(g, tx, ty, tw, towerH, 18, 'rgba(7, 10, 18, 0.44)', nearFinish ? 'rgba(255, 46, 84, 0.62)' : 'rgba(255, 255, 255, 0.20)', 1.5);
    g.restore();

    // Kule Başlığı: KOŞU #N · KALAN MESAFE + İlerleme Çubuğu
    fillRounded(g, tx + 2, ty + 2, tw - 4, headH - 2, 16, 'rgba(12, 18, 32, 0.48)', null);
    const pulse = 0.55 + 0.45 * Math.sin(time * 5.5);
    g.fillStyle = `rgba(255, 46, 84, ${pulse})`;
    g.beginPath(); g.arc(tx + 20, ty + 20, 5.5, 0, Math.PI * 2); g.fill();
    drawText(g, `KOŞU #${round}`, tx + 34, ty + 21, { size: 17, weight: 900, align: 'left', fill: TOKENS.gold, font: TOKENS.mono, shadow: true });
    drawText(g, nearFinish ? '🏁 SON DÜZLÜK' : 'KALAN', tx + tw - 14, ty + 21, {
      size: 15, weight: 900, align: 'right', fill: nearFinish ? '#ff6b86' : TOKENS.textMuted, shadow: true,
    });

    // Büyük Kalan Mesafe (394 m)
    drawText(g, `${remMeters} m`, tx + 16, ty + 48, {
      size: 32, weight: 900, align: 'left', fill: nearFinish ? '#ff8599' : '#ffffff', font: TOKENS.mono, shadow: true,
    });
    // Mini ilerleme rayı (mesafenin sağında)
    const barX = tx + 162, barY = ty + 48, barW = tw - 178;
    fillRounded(g, barX, barY - 6, barW, 12, 6, 'rgba(5, 8, 14, 0.45)', 'rgba(255,255,255,0.2)', 1);
    const leadProg = clamp(leadZ / len, 0, 1);
    if (leadProg > 0.005) {
      const barGrad = g.createLinearGradient(barX, 0, barX + barW, 0);
      barGrad.addColorStop(0, TOKENS.cyan);
      barGrad.addColorStop(1, TOKENS.gold);
      fillRounded(g, barX, barY - 6, Math.max(12, barW * leadProg), 12, 6, barGrad, null);
    }

    // Canlı 1–7 Sıralama Satırları (şeffaf cam satırlar + keskin gölgeli yazılar!)
    const rankColors = [TOKENS.gold, TOKENS.silver, TOKENS.bronze];
    sorted.forEach((r, idx) => {
      const ry = ty + headH + 7 + idx * (rowH + rowGap);

      const lane = LANES[r.lane];
      const isFirst = idx === 0;
      const rowBg = isFirst ? 'rgba(245, 197, 66, 0.24)' : (idx % 2 === 0 ? 'rgba(12, 18, 32, 0.42)' : 'rgba(8, 12, 22, 0.34)');
      const rowStroke = isFirst ? 'rgba(245, 197, 66, 0.68)' : 'rgba(255, 255, 255, 0.10)';
      fillRounded(g, tx + 8, ry, tw - 16, rowH, 10, rowBg, rowStroke, isFirst ? 1.6 : 1);

      // Sıra Numarası (1..7)
      drawText(g, String(idx + 1), tx + 25, ry + rowH / 2 + 1, {
        size: 21, weight: 900, fill: rankColors[idx] || '#e2e8f0', font: TOKENS.mono, shadow: true,
      });

      // Kulvar Numara Rozeti
      fillRounded(g, tx + 42, ry + 8, 30, 31, 8, lane.css, null);
      drawText(g, lane.num, tx + 57, ry + rowH / 2 + 1, { size: 18, weight: 900, fill: '#fff', font: TOKENS.mono, shadow: true });

      // Yuvarlak Profil Avatarı
      drawAvatar(g, { id: r.jockeyId || `lane_${r.lane}`, nick: r.nick, avatar: r.avatar }, tx + 94, ry + rowH / 2, 16);
      g.beginPath(); g.arc(tx + 94, ry + rowH / 2, 16, 0, Math.PI * 2);
      g.lineWidth = 1.6; g.strokeStyle = isFirst ? TOKENS.gold : 'rgba(255,255,255,0.34)'; g.stroke();

      // Oyuncu Adı
      const nameStr = r.nick.slice(0, 11);
      drawText(g, nameStr, tx + 118, ry + rowH / 2 + 1, {
        size: 21, weight: 900, align: 'left', fill: isFirst ? '#fff7d1' : '#ffffff', maxWidth: 162, shadow: true,
      });

      // Sağda aktif güç ikonu veya fark (-4m)
      const activeMod = time < r.mods.unicorn ? '🦄'
        : time < r.mods.lightning ? '⚡'
        : time < r.mods.pegasus ? '🪽'
        : time < r.mods.flame ? '🔥'
        : time < (r.davulUntil || 0) ? '🥁'
        : time < (r.zurnaUntil || 0) ? '🎺'
        : time < r.standUntil ? '🤸'
        : time < r.frozen ? '🧊'
        : '';
      const gapM = Math.max(0, leadZ - r.z);
      const rightTxt = activeMod || (isFirst ? '👑' : (gapM >= 1 ? `-${Math.round(gapM)}m` : '='));
      drawText(g, rightTxt, tx + tw - 18, ry + rowH / 2 + 1, {
        size: activeMod || isFirst ? 20 : 17, weight: 900, align: 'right',
        fill: isFirst ? TOKENS.gold : '#cbd5e1', font: TOKENS.mono, shadow: true,
      });
    });

    // =========================================================================
    // 1B) SAĞ ÜST MOBİL-ODAKLI DEV KOMUT KARTI (x: 390..1064 — Telefonda %100 Net!)
    // =========================================================================
    const rx = 390, rw = W - rx - 16; // 674px genişlik

    // 2 Dev Satır (min 28-30px Extra-Bold — telefonda 10-12 CSS px, anında okunur!)
    const cmdY = 184, cmdH = 148;
    const glowPulse = 0.5 + 0.5 * Math.sin(time * 3.8);
    fillRounded(g, rx, cmdY, rw, cmdH, 20, 'rgba(7, 10, 18, 0.56)', `rgba(37, 244, 238, ${0.38 + glowPulse * 0.25})`, 2.0);

    // Satır 1: Katıl (Dev yeşil & turkuaz haplar!)
    drawChipRowInBox([
      { key: `1–${laneCount}`, desc: 'AT SEÇ', keyBg: '#19e6a8', keyFill: '#041410', descFill: '#d1fae5', border: 'rgba(25, 230, 168, 0.72)' },
      { key: 'KATIL', desc: 'SIRA AL', keyBg: '#25f4ee', keyFill: '#041418', descFill: '#cffafe', border: 'rgba(37, 244, 238, 0.72)' },
    ], rx, rw, cmdY + 11, 58, 29, { gap: 12, padX: 16 });

    // Satır 2: Dikkat Çeken Şov Komutları (Sırayla hafif nabız parlaması!)
    const safeT = Math.max(0, Number(time) || 0);
    const hiIdx = Math.floor(safeT / 1.8) % 3;
    drawChipRowInBox([
      { key: '🥁 DAVUL', keyBg: hiIdx === 0 ? '#ffd166' : 'rgba(245, 158, 11, 0.92)', keyFill: '#0b0e16', border: hiIdx === 0 ? '#fff3c4' : 'rgba(245, 158, 11, 0.65)' },
      { key: '🎺 ZURNA', keyBg: hiIdx === 1 ? '#ff4da6' : 'rgba(236, 72, 153, 0.90)', keyFill: '#fff', border: hiIdx === 1 ? '#fbcfe8' : 'rgba(236, 72, 153, 0.65)' },
      { key: '🤸 AYAKTA', keyBg: hiIdx === 2 ? '#ff9f1c' : 'rgba(249, 115, 22, 0.90)', keyFill: '#0b0e16', border: hiIdx === 2 ? '#ffedd5' : 'rgba(249, 115, 22, 0.65)' },
    ], rx, rw, cmdY + 78, 58, 28, { gap: 10, padX: 14 });

    // Kart 2: Şeffaf Sonraki Koşu / Boş Koltuk (y: 340..420)
    const qbY = 340;
    const hasQ = raceQueue.length > 0;
    if (hasQ) {
      const qbH = 82;
      fillRounded(g, rx, qbY, rw, qbH, 16, 'rgba(8, 22, 36, 0.54)', 'rgba(25, 230, 168, 0.58)', 1.6);
      drawText(g, `🎟️ SONRAKİ KOŞU (${raceQueue.length})`, rx + rw / 2, qbY + 21, {
        size: 20, weight: 900, fill: '#9effe5', maxWidth: rw - 24, shadow: true,
      });

      const shownQ = raceQueue.slice(0, 3);
      const hasMore = raceQueue.length > 3;
      const qGap = 8;
      const chipH = 38;
      const qPad = 10;
      const slots = shownQ.length + (hasMore ? 1 : 0);
      const chipW = (rw - qPad * 2 - qGap * (slots - 1)) / slots;
      shownQ.forEach((q, idx) => {
        const qx = rx + qPad + idx * (chipW + qGap);
        const qy = qbY + 36;
        const justJoined = time - (q.joinedAt || -99) < 4.5;
        const fill = justJoined ? 'rgba(25, 230, 168, 0.36)' : (q.vip ? 'rgba(245, 197, 66, 0.26)' : 'rgba(12, 20, 36, 0.56)');
        const stroke = justJoined ? '#19e6a8' : (q.vip ? TOKENS.gold : 'rgba(37, 244, 238, 0.48)');
        fillRounded(g, qx, qy, chipW, chipH, 10, fill, stroke, justJoined ? 2.2 : 1.3);
        const badge = `${justJoined ? '✓' : (q.vip ? '⭐' : '#')}${idx + 1} ${q.user.nick.slice(0, 8)}`;
        drawText(g, badge, qx + chipW / 2, qy + chipH / 2 + 1, {
          size: 21, weight: 900,
          fill: justJoined ? '#b8ffe6' : (q.vip ? TOKENS.gold : '#fff'),
          maxWidth: chipW - 10, shadow: true,
        });
      });
      if (hasMore) {
        const qx = rx + qPad + 3 * (chipW + qGap);
        fillRounded(g, qx, qbY + 36, chipW, chipH, 10, 'rgba(8, 12, 22, 0.52)', 'rgba(37,244,238,0.45)', 1.3);
        drawText(g, `+${raceQueue.length - 3}`, qx + chipW / 2, qbY + 36 + chipH / 2 + 1, { size: 22, weight: 900, fill: TOKENS.cyan, font: TOKENS.mono, shadow: true });
      }
    } else {
      const qbH = 52;
      const openClr = openSeats > 0 ? '#19e6a8' : TOKENS.cyan;
      fillRounded(g, rx, qbY, rw, qbH, 15, openSeats > 0 ? 'rgba(10, 34, 28, 0.56)' : 'rgba(8, 22, 36, 0.54)', openClr, 1.8);
      const bannerTxt = openSeats > 0
        ? `🏇 ${openSeats} BOŞ AT! "1–${laneCount}" YAZ!`
        : `🎟️ DOLU! SONRAKİNE "KATIL" YAZ!`;
      drawText(g, bannerTxt, rx + rw / 2, qbY + qbH / 2 + 1, { size: 25, weight: 900, fill: openSeats > 0 ? '#b8ffe6' : '#aef9ff', maxWidth: rw - 24, shadow: true });
    }
  }

  // ---------- 2) 3B İzdüşümlü Telemetri Plakaları (7 Jokey + Koşan Tribün Seyircileri) ----------
  function drawProjectedLabels(s) {
    const { racers, sorted, spectators, camera, time } = s;
    const leadLane = sorted[0] ? sorted[0].lane : -1;

    // A) Tribünlerde koşan isimli/sıradaki seyirciler (temiz kenar mikro-plakası, en fazla 6 adet)
    const namedSpecs = spectators.getNamedSpectators().slice(0, 6);
    for (const sp of namedSpecs) {
      sp.visual.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z > 1) continue;
      const sx = (projV.x * 0.5 + 0.5) * W;
      const sy = (-projV.y * 0.5 + 0.5) * H;
      if (sx < 14 || sx > W - 14 || sy < 402 || sy > 1640) continue;

      const badge = sp.queuedPos > 0 ? `${sp.vip ? '⭐' : '#'}${sp.queuedPos}` : (sp.lastIcon || '🏟️');
      const nameTxt = sp.nick.slice(0, 8);
      const label = `${badge} ${nameTxt}`;
      g.font = `900 20px ${TOKENS.font}`;
      const tw = Math.min(156, g.measureText(label).width);
      const pw = tw + 24, ph = 32;
      const px = clamp(sx - pw / 2, 8, W - pw - 8), py = sy - ph / 2;

      const accent = sp.vip ? TOKENS.gold : sp.queuedPos > 0 ? TOKENS.cyan : 'rgba(255,255,255,0.55)';
      fillRounded(g, px, py, pw, ph, 9, 'rgba(8, 11, 20, 0.54)', 'rgba(255,255,255,0.22)', 1.2);
      fillRounded(g, px + 3, py + 5, 4.5, ph - 10, 2.5, accent, null);
      drawText(g, label, px + 13, py + ph / 2 + 1, { size: 20, weight: 900, align: 'left', fill: sp.vip ? TOKENS.gold : '#fff', maxWidth: 152, shadow: true });
    }

    // B) 7 Kulvar Jokey Numara Plakaları (Mobilde net okunan büyük motor sporları plakaları!)
    const items = [];
    for (const r of racers) {
      r.visual.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z > 1) continue;
      const sx = (projV.x * 0.5 + 0.5) * W;
      const sy = (-projV.y * 0.5 + 0.5) * H;
      if (sx < -50 || sx > W + 50 || sy < 395 || sy > 1640) continue;
      const mods = `${time < r.mods.flame ? '🔥' : ''}${time < r.mods.pegasus ? '🪽' : ''}${time < r.mods.lightning ? '⚡' : ''}${time < r.mods.unicorn ? '🦄' : ''}${time < (r.davulUntil || 0) ? '🥁' : ''}${time < (r.zurnaUntil || 0) ? '🎺' : ''}${time < r.likeBoostUntil ? '❤️' : ''}${time < r.standUntil ? '🤸' : ''}${time < r.pulledUntil ? '🤠' : ''}${time < r.tomatoUntil ? '🍅' : ''}${time < r.honeyUntil ? '🍯' : ''}${time < r.frozen ? '🧊' : ''}`;
      items.push({ r, x: clamp(sx, 110, W - 110), y: sy, mods, isLead: r.lane === leadLane && r.z > 5 });
    }
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(items[i].x - items[j].x) < 178 && Math.abs(items[i].y - items[j].y) < 52) {
          items[i].y = Math.min(1656, items[j].y + 52);
        }
      }
    }

    for (const it of items) {
      const { r, x, y, mods, isLead } = it;
      const lane = LANES[r.lane];
      const justJoined = time < (r.joinedFlashUntil || 0);
      const txt = `${justJoined ? '✓ ' : (isLead ? '👑 ' : '')}${r.nick.slice(0, 9)}${mods ? ' ' + mods : ''}`;
      g.font = `900 24px ${TOKENS.font}`;
      const tw = Math.min(205, g.measureText(txt).width);
      const rem = Math.max(r.mods.unicorn - time, r.mods.lightning - time, r.mods.pegasus - time, r.mods.flame - time, 0);
      const pw = tw + 56, ph = rem > 0 ? 48 : 42;
      const px = x - pw / 2, py = y - ph / 2;

      const plateStroke = justJoined ? TOKENS.emerald : (isLead ? TOKENS.gold : 'rgba(255,255,255,0.28)');
      fillRounded(g, px, py, pw, ph, 12, justJoined ? 'rgba(10, 36, 28, 0.64)' : 'rgba(8, 11, 20, 0.58)', plateStroke, justJoined || isLead ? 2.2 : 1.3);
      fillRounded(g, px + 4, py + 4, 34, ph - 8, 8, lane.css, null);
      drawText(g, lane.num, px + 21, py + ph / 2 + 1, { size: 21, weight: 900, fill: '#fff', font: TOKENS.mono, shadow: true });

      drawText(g, txt, px + 45, py + (rem > 0 ? 19 : ph / 2 + 1), { size: 24, weight: 900, align: 'left', fill: '#fff', maxWidth: 205, shadow: true });

      if (rem > 0) {
        const bx = px + 45, by = py + ph - 9, bw = pw - 54;
        fillRounded(g, bx, by, bw, 5, 2.5, 'rgba(255,255,255,0.18)', null);
        fillRounded(g, bx, by, bw * clamp(rem / 8, 0, 1), 5, 2.5, TOKENS.gold, null);
      }
    }
  }

  // ---------- 3) F1 Tarzı Başlangıç Işıkları & Geri Sayım ----------
  function drawCountdown(phaseT) {
    const step = phaseT < 0.9 ? 0 : phaseT < 1.55 ? 1 : phaseT < 2.2 ? 2 : 3;
    const label = step === 0 ? 'HAZIRLAN' : String(4 - step);
    const gx = W / 2 - 146, gy = 610, gw = 292, gh = 154;

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 32;
    fillRounded(g, gx, gy, gw, gh, 22, 'rgba(9, 12, 20, 0.56)', 'rgba(255,255,255,0.22)', 1.5);
    g.restore();

    // 3 başlangıç lambası
    for (let i = 0; i < 3; i++) {
      const lx = gx + 62 + i * 84, ly = gy + 44;
      const lit = i < step;
      g.beginPath(); g.arc(lx, ly, 20, 0, Math.PI * 2);
      g.fillStyle = lit ? '#ff2e54' : 'rgba(255,255,255,0.08)';
      g.fill();
      g.lineWidth = 2; g.strokeStyle = lit ? '#ff8599' : 'rgba(255,255,255,0.18)'; g.stroke();
    }

    drawText(g, label, W / 2, gy + 114, {
      size: step === 0 ? 34 : 58,
      weight: 900,
      fill: step === 0 ? TOKENS.gold : '#ffffff',
      font: step === 0 ? TOKENS.font : TOKENS.mono,
      shadow: true,
    });
  }

  // ---------- 4) Sağ Orta Sade Dev-İkon Güç Şeridi (SIFIR Küçük Yazı — Telefonda Anında Okunur!) ----------
  // ECC İlkesi: İkon kendi kendini anlatır — altında ufak etiket ve açıklama YOK!
  function drawGiftPanel(s) {
    const { rules, ruleFlash, time, raceQueue = [] } = s;
    const shown = rules.filter((r) => r.enabled !== false && r.trigger.type === 'gift').slice(0, 6);
    if (!shown.length) return;

    const pw = 282;
    const px = W - pw - 16; // x: 782..1064
    const py = raceQueue.length > 0 ? 430 : 402;
    const headH = 34;
    const rowH = 58;
    const gap = 5;
    const pad = 8;
    const bonusH = 46;
    const ph = headH + shown.length * rowH + (shown.length - 1) * gap + bonusH + pad * 2 + 6;

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.40)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 4;
    fillRounded(g, px, py, pw, ph, 18, 'rgba(7, 10, 18, 0.54)', 'rgba(255, 255, 255, 0.24)', 1.6);
    g.restore();

    drawText(g, '⚡ GÜÇLER', px + pw / 2, py + 19, {
      size: 20, weight: 900, fill: TOKENS.gold, shadow: true,
    });

    shown.forEach((r, i) => {
      const rx = px + pad;
      const ry = py + headH + 2 + i * (rowH + gap);
      const rw = pw - pad * 2;
      const lit = time - (ruleFlash.get(r.id) || -99) < 0.9;
      const tier = cardTier(r.action);
      const meta = giftPowerMeta(r);
      const gImg = r.trigger && r.trigger.giftImage ? image(r.trigger.giftImage) : null;

      const fill = lit ? 'rgba(245, 197, 66, 0.36)' : (i % 2 === 0 ? 'rgba(14, 20, 36, 0.56)' : 'rgba(9, 13, 24, 0.46)');
      const stroke = lit ? TOKENS.gold : (tier.tag === 'EFSANE' ? 'rgba(245, 197, 66, 0.65)' : 'rgba(255,255,255,0.16)');
      fillRounded(g, rx, ry, rw, rowH, 12, fill, stroke, lit ? 2.6 : 1.2);

      // Sol kademe renk şeridi
      fillRounded(g, rx + 4, ry + 7, 5, rowH - 14, 2.5, lit ? TOKENS.gold : tier.color, null);

      // Dev Hediye Simgesi (40px — altı tamamen temiz!)
      if (gImg) {
        g.drawImage(gImg, rx + 14, ry + 9, 40, 40);
      } else {
        drawText(g, meta.icon, rx + 36, ry + rowH / 2 + 1, { size: 36 });
      }

      // Ok
      drawText(g, '→', rx + 68, ry + rowH / 2, { size: 22, weight: 900, fill: 'rgba(255,255,255,0.58)' });

      // Tek Kelime DEV Güç Adı + İkonu (25px Extra-Bold!)
      drawText(g, `${meta.actIcon} ${meta.name}`, rx + 84, ry + rowH / 2 + 1, {
        size: 25, weight: 900, align: 'left', fill: '#ffffff', maxWidth: rw - 92, shadow: true,
      });
    });

    // Tek Satır Dev Dokunma Ödülü (4 sn'de bir 50× Pegasus / 25× Alev değişir — %100 TikTok güvenli!)
    const by = py + headH + 8 + shown.length * (rowH + gap);
    const showPeg = Math.floor(time / 4.0) % 2 === 0;
    fillRounded(g, px + pad, by, pw - pad * 2, bonusH, 12, showPeg ? 'rgba(245, 197, 66, 0.22)' : 'rgba(255, 84, 0, 0.22)', showPeg ? TOKENS.gold : '#ff7b33', 1.6);
    drawText(g, showPeg ? '👆 50× → 🪽 PEGASUS' : '👆 25× → 🔥 ALEV', px + pw / 2, by + bonusH / 2 + 1, {
      size: 22, weight: 900, fill: '#fff', maxWidth: pw - 28, shadow: true,
    });
  }

  // ---------- 4B) KAYAN DİKKAT ÇEKİCİ KOMUT ŞERİDİ (Sohbetin Hemen Üstünde, 32px DEV YAZI!) ----------
  function drawCommandTicker(s) {
    const { time, laneCount = 7, dailyTop = [] } = s;
    const tips = [
      { key: `1–${laneCount} / KATIL`, text: 'YAZ · HEMEN ATA BİN! 🏇', bg: '#19e6a8', fg: '#041410', border: '#6ee7b7' },
      { key: 'DAVUL', text: 'YAZ · AT ÜSTÜNDE DAVUL ÇAL! 🥁', bg: '#ffd166', fg: '#0b0e16', border: '#fef08a' },
      { key: 'ZURNA', text: 'YAZ · HALAY ZURNASI ÜFLE! 🎺', bg: '#ff4da6', fg: '#ffffff', border: '#fbcfe8' },
      { key: 'AYAKTA', text: 'YAZ · AT ÜSTÜNDE ŞOV YAP! 🤸', bg: '#ff9f1c', fg: '#0b0e16', border: '#fed7aa' },
      { key: 'DOMATES / MUZ', text: 'YAZ · LİDERİ SABOTE ET! 🍅🍌', bg: '#ef4444', fg: '#ffffff', border: '#fca5a5' },
      { key: 'KADIN / ERKEK', text: 'YAZ · KIYAFET DEĞİŞTİR! 👗🤠', bg: '#a855f7', fg: '#ffffff', border: '#e9d5ff' },
      { key: '50× DOKUN', text: '🪽 PEGASUS KANATLARI AÇ! ✨', bg: '#25f4ee', fg: '#041418', border: '#a5f3fc' },
    ];
    if (dailyTop.length > 0) {
      const king = dailyTop[0];
      tips.push({
        key: '👑 GÜNÜN KRALI',
        text: `${king.nick.slice(0, 12).toUpperCase()} (${king.wins} GALİBİYET) · TAHTI KAP! 🏆`,
        bg: '#f5c542', fg: '#0b0e16', border: '#fef08a',
      });
    }
    const safeT = Math.max(0, Number(time) || 0);
    const period = 4.6;
    const idx = Math.floor(safeT / period) % tips.length;
    const u = (safeT % period) / period;
    if (u > 0.96) return; // İki komut arasında kısa nefes

    const tip = tips[idx] || tips[0];
    // Yumuşak sağdan giriş → merkezde net bekleme → soldan çıkış
    let offsetX = 0, alpha = 1;
    if (u < 0.12) {
      const t = 1 - Math.pow(1 - u / 0.12, 3);
      offsetX = (1 - t) * (W * 0.72);
      alpha = t;
    } else if (u > 0.84) {
      const t = (u - 0.84) / 0.12;
      offsetX = -(t * t) * (W * 0.72);
      alpha = Math.max(0, 1 - t);
    }

    const barH = 66;
    const barY = 1432; // TikTok alt sohbet kutusunun hemen üstü — göz tam burada!
    g.save();
    g.globalAlpha = alpha;
    g.font = `900 30px ${TOKENS.font}`;
    const kw = g.measureText(tip.key).width + 34;
    g.font = `900 28px ${TOKENS.font}`;
    const tw = g.measureText(tip.text).width + 32;
    const totalW = Math.min(W - 44, kw + tw + 22);
    const bx = W / 2 - totalW / 2 + offsetX;

    g.shadowColor = 'rgba(0,0,0,0.58)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 5;
    fillRounded(g, bx, barY, totalW, barH, 18, 'rgba(8, 12, 24, 0.78)', tip.border, 2.4);
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;

    // Sol dikkat çekici komut rozeti
    const effKw = Math.min(kw, totalW * 0.44);
    fillRounded(g, bx + 7, barY + 7, effKw, barH - 14, 12, tip.bg, null);
    drawText(g, tip.key, bx + 7 + effKw / 2, barY + barH / 2 + 1, {
      size: 29, weight: 900, fill: tip.fg, maxWidth: effKw - 14, shadow: tip.fg === '#ffffff',
    });

    // Sağ büyük aksiyon yazısı
    const textAreaX = bx + 14 + effKw;
    const textAreaW = totalW - effKw - 24;
    drawText(g, tip.text, textAreaX + textAreaW / 2, barY + barH / 2 + 1, {
      size: 28, weight: 900, fill: '#ffffff', maxWidth: textAreaW, shadow: true,
    });
    g.restore();
  }

  // ---------- 5) Şampiyonluk Yayın Kartı + İlk 3 Halay Rozetleri ----------
  function drawPodiumBadges(s) {
    const { podiumItems = [], camera } = s;
    if (!podiumItems.length) return;
    const rankMeta = [
      { medal: '🥇 1.', role: '👑 HALAY BAŞI', stroke: TOKENS.gold, bg: 'rgba(38, 28, 6, 0.72)', accent: TOKENS.gold },
      { medal: '🥈 2.', role: '🥁 DAVUL', stroke: '#dbe4f0', bg: 'rgba(18, 24, 38, 0.72)', accent: '#e2e8f0' },
      { medal: '🥉 3.', role: '🎺 ZURNA', stroke: '#f0a060', bg: 'rgba(36, 20, 10, 0.72)', accent: '#f5b076' },
    ];
    for (const item of podiumItems) {
      const meta = rankMeta[item.rank - 1] || rankMeta[0];
      const r = item.racer;
      const lane = LANES[r.lane];
      item.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z > 1) continue;
      const sx = clamp((projV.x * 0.5 + 0.5) * W, 128, W - 128);
      const sy = clamp((-projV.y * 0.5 + 0.5) * H - 16, 840, 1380);
      const pw = 236, ph = 72;
      const px = sx - pw / 2, py = sy - ph / 2;

      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = 18;
      fillRounded(g, px, py, pw, ph, 14, meta.bg, meta.stroke, 2.2);
      g.restore();

      fillRounded(g, px + 5, py + 6, 7, ph - 12, 3.5, lane.css, null);
      drawText(g, `${meta.medal} ${r.nick.slice(0, 9)}`, px + 22, py + 25, {
        size: 24, weight: 900, align: 'left', fill: '#fff', maxWidth: pw - 30, shadow: true,
      });
      drawText(g, meta.role, px + 22, py + 53, {
        size: 16, weight: 900, align: 'left', fill: meta.accent, maxWidth: pw - 30, shadow: true,
      });
    }
  }

  function drawVictoryCard(s) {
    const { winner, phaseT, raceQueue, round, champStreak, laneCount = 7, victorySec = 8.5, dailyTop = [] } = s;
    if (!winner) return;
    const lane = LANES[winner.lane];
    const k = ease.outBack(clamp(phaseT / 0.45, 0, 1));
    const remSec = Math.max(0, Math.ceil(victorySec - phaseT));
    const winEntry = winner.jockeyId ? dailyTop.find((x) => x.id === winner.jockeyId) : null;

    // İlk 3 halay ekibinin kafasının üstündeki 1. / 2. / 3. madalya rozetleri
    drawPodiumBadges(s);

    // Kompakt şeffaf zafer kartı (y: 616..828 — altta halay çeken 3 böceği ASLA kapatmaz!)
    const cy = 722;
    g.save();
    g.translate(W / 2, cy);
    g.scale(k, k);
    g.shadowColor = 'rgba(0,0,0,0.58)';
    g.shadowBlur = 32;
    fillRounded(g, -390, -106, 780, 212, 22, 'rgba(9, 12, 20, 0.62)', TOKENS.gold, 2.4);
    g.restore();

    g.save();
    g.translate(W / 2, cy);
    g.scale(k, k);
    // Sol kulvar renk şeridi
    fillRounded(g, -376, -94, 10, 188, 5, lane.css, null);
    // Üst rozet
    fillRounded(g, -240, -90, 480, 30, 10, 'rgba(245, 197, 66, 0.18)', 'rgba(245, 197, 66, 0.55)', 1.2);
    drawText(g, `🏆 ${round}. KOŞU ŞAMPİYONU · 💃 HALAY ZAMANI!`, 0, -74.5, { size: 16, weight: 900, fill: TOKENS.gold });

    // Kazanan adı
    drawText(g, `${winner.gender === 'f' ? '👗' : '🤠'} ${winner.nick}`, 0, -14, { size: 48, weight: 900, fill: '#fff', maxWidth: 680, shadow: true });

    // Alt istatistik & günlük liderlik bilgisi
    const dailyTxt = winEntry && winEntry.wins > 0 ? ` · 👑 BUGÜN ${winEntry.wins}. GALİBİYET` : '';
    const info = `${winner.lane + 1}. KULVAR (${lane.name})${champStreak > 1 ? ` · 🔥 ${champStreak}× SERİ` : ''}${dailyTxt}`;
    drawText(g, info, 0, 34, { size: 20, weight: 800, fill: lane.css, maxWidth: 720 });

    const nextMsg = raceQueue.length > 0
      ? `🎟️ Sıradan ${Math.min(Math.max(1, laneCount - 1), raceQueue.length)} oyuncu giriyor · ${remSec} sn`
      : `Yeni koşu başlıyor · ${remSec} sn`;
    fillRounded(g, -260, 56, 520, 36, 12, TOKENS.bgRecess, 'rgba(255,255,255,0.14)', 1);
    drawText(g, nextMsg, 0, 74.5, { size: 19, weight: 800, fill: TOKENS.cyan, font: TOKENS.mono });
    g.restore();
  }

  function drawLobbyBanner(s) {
    const { racers, laneCount, dailyTop = [] } = s;
    // Kompakt şeffaf lobi bandı (x: 18..762, y: 606..702) — pistteki böcek kavgasını, patlamaları ve savaş uçaklarını ASLA kapatmaz!
    const gx = 18, gy = 606, gw = 744, gh = 96;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.52)';
    g.shadowBlur = 26;
    fillRounded(g, gx, gy, gw, gh, 20, 'rgba(9, 12, 22, 0.60)', TOKENS.emerald, 2.2);
    g.restore();

    drawText(g, `🥊 ISINMA KAVGASI · 🏇 YARIŞÇI BEKLENİYOR (${racers.length}/2)`, gx + gw / 2, gy + 32, {
      size: 27, weight: 900, fill: TOKENS.emerald, maxWidth: gw - 28, shadow: true,
    });
    drawText(g, `Sohbete "1–${laneCount}" veya "KATIL" yaz — 2 kişi olunca maç başlar!`, gx + gw / 2, gy + 69, {
      size: 22, weight: 900, fill: '#ffffff', maxWidth: gw - 28, shadow: true,
    });

    // Kalıcı Günlük Liderlik Şeridi (yalnızca galibiyet bazlı — %100 TikTok OCR güvenli!)
    if (dailyTop.length > 0) {
      const ly = gy + gh + 8, lh = 50;
      const medals = ['🥇', '🥈', '🥉'];
      const line = '🏆 GÜNÜN ŞAMPİYONLARI:  ' + dailyTop.slice(0, 3).map((x, i) => `${medals[i]} ${x.nick.slice(0, 9)} (${x.wins})`).join('  ·  ');
      fillRounded(g, gx, ly, gw, lh, 14, 'rgba(28, 22, 6, 0.72)', TOKENS.gold, 1.8);
      drawText(g, line, gx + gw / 2, ly + lh / 2 + 1, {
        size: 22, weight: 900, fill: '#fef08a', maxWidth: gw - 24, shadow: true,
      });
    }
  }

  function render(state) {
    g.clearRect(0, 0, W, H);
    drawTopDeck(state);
    if (state.phase === 'race' || state.phase === 'countdown' || state.phase === 'lobby') drawProjectedLabels(state);
    if (state.phase === 'lobby') drawLobbyBanner(state);
    if (state.phase === 'countdown') drawCountdown(state.phaseT);
    if (state.phase !== 'win') {
      drawGiftPanel(state);
      drawCommandTicker(state);
    }
    if (state.phase === 'win') drawVictoryCard(state);
  }

  return { render };
}
