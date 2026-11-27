// Sahil Böcekleri 3D — Akdeniz Akşamları Canlı Yayın (Broadcast Telemetry) HUD Sistemi.
// ECC design-system + frontend-design-direction + make-interfaces-feel-better standartlarıyla tasarlandı.
import * as THREE from 'three';
import { roundRect, clamp, ease } from '@sdk/kit.js';
import { describeTrigger } from '@sdk/rules-text.js';
import { ROLES } from './cockroach.js';

const W = 1080, H = 1920;

const TOKENS = {
  font: '"Segoe UI", "Inter", system-ui, sans-serif',
  mono: '"Cascadia Mono", "Consolas", "Segoe UI", monospace',
  bgPanel: 'rgba(9, 12, 22, 0.90)',
  bgCell: 'rgba(18, 24, 40, 0.86)',
  bgRecess: 'rgba(5, 8, 15, 0.80)',
  border: 'rgba(255, 255, 255, 0.14)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  amber: '#ff9e2c',
  gold: '#f5c542',
  cyan: '#25f4ee',
  liveRed: '#ff2e54',
  sabotage: '#ff5268',
  vip: '#c77dff',
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

function shortCoinLabel(trigger) {
  if (!trigger || trigger.type !== 'gift') return describeTrigger(trigger || {});
  if (trigger.diamonds != null) return `${trigger.diamonds} 🪙`;
  if (trigger.minDiamonds != null && trigger.maxDiamonds != null) return `${trigger.minDiamonds}–${trigger.maxDiamonds} 🪙`;
  if (trigger.minDiamonds != null) return `${trigger.minDiamonds}+ 🪙`;
  return 'Hediye';
}

function cardTier(actionId) {
  if (['seagull_raid', 'big_wave'].includes(actionId)) {
    return { tag: 'SABOTAJ', color: TOKENS.sabotage, bg: 'rgba(255, 82, 104, 0.09)' };
  }
  if (actionId === 'vip_spotlight') {
    return { tag: 'VIP ROL', color: TOKENS.vip, bg: 'rgba(199, 125, 255, 0.10)' };
  }
  if (actionId === 'zabita_raid') {
    return { tag: 'EFSANE', color: TOKENS.gold, bg: 'rgba(245, 197, 66, 0.13)' };
  }
  return { tag: 'KEYİF', color: TOKENS.amber, bg: 'rgba(255, 158, 44, 0.09)' };
}

function vibeLabel(pct) {
  if (pct >= 90) return '🔥 AKDENİZ ŞÖLENİ!';
  if (pct >= 65) return '🎸 ATEŞ HARLANDI';
  if (pct >= 35) return '🌭 MANGAL KÖZDE';
  return '🌙 SAKİN KUMSAL';
}

function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createBeachHud(canvas) {
  const g = canvas.getContext('2d');

  // ---------- 1) Birleşik Üst Akdeniz Yayın Paneli ----------
  function drawTopDeck(s) {
    const { night, time, remSec, vibe, crowdCount, roleSlots, sucukCount } = s;
    const pct = clamp(Math.round(vibe), 0, 100);

    const topFade = g.createLinearGradient(0, 0, 0, 210);
    topFade.addColorStop(0, 'rgba(5, 8, 16, 0.72)');
    topFade.addColorStop(1, 'rgba(5, 8, 16, 0)');
    g.fillStyle = topFade;
    g.fillRect(0, 0, W, 210);

    const dx = 22, dy = 12, dw = W - 44, dh = 172;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.48)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    fillRounded(g, dx, dy, dw, dh, 20, TOKENS.bgPanel, TOKENS.border, 1.5);
    g.restore();

    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(dx + 20, dy + 1, dw - 40, 1.5);

    // Satır 1: CANLI + GECE #N + Başlık  |  SUCUK + SAYAÇ + KALABALIK
    const r1y = dy + 24;
    fillRounded(g, dx + 12, r1y - 13, 84, 26, 8, 'rgba(255, 46, 84, 0.18)', 'rgba(255, 46, 84, 0.55)', 1.2);
    const pulse = 0.55 + 0.45 * Math.sin(time * 5.2);
    g.fillStyle = `rgba(255, 46, 84, ${pulse})`;
    g.beginPath(); g.arc(dx + 26, r1y, 5, 0, Math.PI * 2); g.fill();
    drawText(g, 'CANLI', dx + 59, r1y + 0.5, { size: 14, weight: 900, fill: '#ff6b86' });

    fillRounded(g, dx + 104, r1y - 13, 94, 26, 8, 'rgba(255, 158, 44, 0.16)', 'rgba(255, 158, 44, 0.48)', 1.2);
    drawText(g, `GECE #${night}`, dx + 151, r1y + 0.5, { size: 14, weight: 900, fill: TOKENS.amber, font: TOKENS.mono });

    drawText(g, 'SAHİL BÖCEKLERİ 3D', dx + 210, r1y + 0.5, { size: 22, weight: 900, align: 'left', fill: TOKENS.text });

    // Sağ sayaçlar: Mangal Sucuk + Süre + Kişi
    fillRounded(g, dx + dw - 306, r1y - 13, 80, 26, 8, 'rgba(255, 107, 53, 0.16)', 'rgba(255, 107, 53, 0.45)', 1.2);
    drawText(g, `🌭 ${sucukCount}/6`, dx + dw - 266, r1y + 0.5, { size: 14, weight: 800, fill: '#ffae7a', font: TOKENS.mono });

    fillRounded(g, dx + dw - 218, r1y - 13, 88, 26, 8, 'rgba(255,255,255,0.06)', TOKENS.border, 1.2);
    drawText(g, `⏱ ${fmtClock(remSec)}`, dx + dw - 174, r1y + 0.5, { size: 14, weight: 800, fill: TOKENS.text, font: TOKENS.mono });

    fillRounded(g, dx + dw - 122, r1y - 13, 110, 26, 8, 'rgba(37, 244, 238, 0.14)', 'rgba(37, 244, 238, 0.45)', 1.2);
    drawText(g, `🪲 ${crowdCount} KİŞİ`, dx + dw - 67, r1y + 0.5, { size: 14, weight: 800, fill: TOKENS.cyan, font: TOKENS.mono });

    // Satır 2: 🔥 AKDENİZ KEYİF METRESİ (%0 → %100)
    const my = dy + 58;
    const mx = dx + 14, mw = dw - 28;
    fillRounded(g, mx, my - 12, mw, 24, 12, TOKENS.bgRecess, 'rgba(255,255,255,0.1)', 1);
    if (pct > 0) {
      const vg = g.createLinearGradient(mx, 0, mx + mw, 0);
      vg.addColorStop(0, '#ff5400');
      vg.addColorStop(0.55, '#ff9e2c');
      vg.addColorStop(1, '#f5c542');
      fillRounded(g, mx + 2, my - 10, Math.max(24, (mw - 4) * (pct / 100)), 20, 10, vg, null);
    }
    drawText(g, vibeLabel(pct), mx + 16, my + 0.5, { size: 13, weight: 900, align: 'left', fill: '#fff', shadow: true });
    drawText(g, `KEYİF %${pct}`, mx + mw - 14, my + 0.5, { size: 14, weight: 900, align: 'right', fill: '#fff', font: TOKENS.mono, shadow: true });

    // Satır 3: 4 VIP Başrol Şeridi (Gitarist · Mangal · Çaycı · Ritim — eşmerkezli köşe: 12px)
    const py = dy + 82, ph = 54, pGap = 8;
    const cw = (dw - 16 - pGap * 3) / 4;
    const order = ['guitar', 'mangal', 'tea', 'darbuka'];
    order.forEach((roleId, i) => {
      const meta = ROLES[roleId];
      const holder = roleSlots[roleId];
      const cx = dx + 8 + i * (cw + pGap);
      const hasReal = holder && holder.nick;
      const protRem = holder ? Math.max(0, holder.protectedUntil - time) : 0;

      fillRounded(g, cx, py, cw, ph, 12, TOKENS.bgCell, hasReal ? `${meta.css}66` : 'rgba(255,255,255,0.08)', 1.2);
      fillRounded(g, cx + 4, py + 7, 4.5, ph - 14, 3, meta.css, null);

      drawText(g, `${meta.icon} ${meta.label.toUpperCase()}`, cx + 16, py + 17, { size: 12, weight: 900, align: 'left', fill: meta.css });
      drawText(g, hasReal ? holder.nick.slice(0, 11) : 'Boş · Yaz!', cx + 16, py + 37, {
        size: 17, weight: 800, align: 'left', fill: hasReal ? TOKENS.text : TOKENS.textMuted, maxWidth: cw - 24,
      });

      // Koltuk koruma süresi ince barı (12 sn koruma!)
      if (protRem > 0) {
        fillRounded(g, cx + 14, py + ph - 6, (cw - 24) * clamp(protRem / 12, 0, 1), 3, 2, meta.css, null);
      }
    });

    // Satır 4: Gömülü durum alt şeridi
    const sy = dy + 142, sh = 24;
    fillRounded(g, dx + 8, sy, dw - 16, sh, 8, TOKENS.bgRecess, 'rgba(255,255,255,0.06)', 1);
    const tip = s.zabitaActive
      ? '👮 SAHİL BEKÇİSİ GELDİ! Çaycı hemen çay ikram ediyor...'
      : '🎵 Akdeniz Akşamları canlı · VIP koltuk için "gitar / mangal / çay / ritim" yaz veya hediye gönder!';
    drawText(g, tip, W / 2, sy + sh / 2 + 0.5, { size: 14, weight: 700, fill: s.zabitaActive ? TOKENS.gold : TOKENS.textMuted, maxWidth: dw - 36 });
  }

  // ---------- 2) 3B Projeksiyonlu İsim Plakaları (VIP + Kalabalık + Zabıta + Dilek Fenerleri) ----------
  function drawProjectedLabels(s) {
    const { bugs, zabita, zabitaState, lanterns, camera, time } = s;

    // A) Gökyüzüne yükselen isimli Dilek Fenerleri
    for (const l of lanterns) {
      if (!l.nick) continue;
      l.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z > 1) continue;
      const sx = (projV.x * 0.5 + 0.5) * W;
      const sy = (-projV.y * 0.5 + 0.5) * H;
      if (sx < 30 || sx > W - 30 || sy < 210 || sy > 1500) continue;
      drawText(g, `🏮 ${l.nick.slice(0, 10)}`, sx, sy, { size: 15, weight: 800, fill: '#ffe599', shadow: true });
    }

    // B) Zabıta etiketi
    if (zabitaState.active) {
      zabita.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z <= 1) {
        const sx = clamp((projV.x * 0.5 + 0.5) * W, 110, W - 110);
        const sy = (-projV.y * 0.5 + 0.5) * H;
        const friendly = zabitaState.phase === 'friendly';
        const txt = friendly ? '🫖 BİZDEN ABİ!' : '👮 BEKÇİ AMCA!';
        fillRounded(g, sx - 86, sy - 18, 172, 34, 10, 'rgba(9, 12, 22, 0.90)', friendly ? TOKENS.gold : TOKENS.liveRed, 2);
        drawText(g, txt, sx, sy, { size: 17, weight: 900, fill: friendly ? TOKENS.gold : '#ff8599' });
      }
    }

    // C) Böcek plakaları (4 VIP her zaman + en aktif 8 sahil böceği)
    const vips = bugs.filter((b) => b.role);
    const others = bugs.filter((b) => !b.role && b.userId).sort((a, b) => b.lastActive - a.lastActive).slice(0, 8);
    const items = [];

    for (const b of [...vips, ...others]) {
      b.visual.headAnchor.getWorldPosition(projV);
      projV.project(camera);
      if (projV.z > 1) continue;
      const sx = (projV.x * 0.5 + 0.5) * W;
      const sy = (-projV.y * 0.5 + 0.5) * H;
      if (sx < 30 || sx > W - 30 || sy < 225 || sy > 1640) continue;
      items.push({ b, x: clamp(sx, 86, W - 86), y: sy, isVip: !!b.role });
    }

    // Çakışma ayırma
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(items[i].x - items[j].x) < 138 && Math.abs(items[i].y - items[j].y) < 38) {
          items[i].y = items[j].y + 38;
        }
      }
    }

    for (const it of items) {
      const { b, x, y, isVip } = it;
      const meta = b.role ? ROLES[b.role] : null;
      const status = b.swimming ? '🌊' : time < b.lighterUntil ? '🔦' : '';
      const label = `${meta ? meta.icon + ' ' : (status ? status + ' ' : '')}${b.nick.slice(0, 10)}`;
      const fontSize = isVip ? 18 : 15;
      g.font = `800 ${fontSize}px ${TOKENS.font}`;
      const tw = Math.min(165, g.measureText(label).width);
      const pw = tw + (isVip ? 26 : 20);
      const ph = isVip ? 32 : 26;
      const px = x - pw / 2, py = y - ph / 2;

      const accent = meta ? meta.css : (b.swimming ? TOKENS.cyan : 'rgba(255,255,255,0.38)');
      fillRounded(g, px, py, pw, ph, isVip ? 10 : 8, isVip ? 'rgba(9, 12, 22, 0.90)' : 'rgba(9, 12, 22, 0.78)', isVip ? accent : 'rgba(255,255,255,0.16)', isVip ? 1.8 : 1.1);
      fillRounded(g, px + 3, py + 4, 4, ph - 8, 2, accent, null);
      drawText(g, label, px + 13, py + ph / 2 + 0.5, { size: fontSize, weight: 800, align: 'left', fill: isVip ? '#fff' : '#e2e8f0', maxWidth: 165 });
    }
  }

  // ---------- 3) Alt Keycap Komut Barı & Kademeli 6'lı Hediye Dock'u ----------
  function drawBottomDeck(s) {
    const { rules, actionsMap, ruleFlash, time } = s;

    const botFade = g.createLinearGradient(0, H - 275, 0, H);
    botFade.addColorStop(0, 'rgba(5, 8, 16, 0)');
    botFade.addColorStop(1, 'rgba(5, 8, 16, 0.92)');
    g.fillStyle = botFade;
    g.fillRect(0, H - 275, W, 275);

    const chips = [
      { key: 'katıl', desc: '🔥 Ateş' },
      { key: 'gitar / mangal / çay', desc: 'Rol' },
      { key: 'közle', desc: '🪵' },
      { key: 'ışık', desc: '🔦' },
      { key: 'deniz', desc: '🌊' },
    ];
    const chipWidths = chips.map((c) => {
      g.font = `800 15px ${TOKENS.font}`;
      const kw = g.measureText(c.key).width + 16;
      g.font = `700 15px ${TOKENS.font}`;
      const dw = g.measureText(c.desc).width + 10;
      return { ...c, kw, w: kw + dw + 10 };
    });
    const chipGap = 9;
    const totalW = chipWidths.reduce((a, c) => a + c.w, 0) + chipGap * (chipWidths.length - 1);
    let cx = (W - totalW) / 2;
    const cy = 1690, ch = 34;

    for (const c of chipWidths) {
      fillRounded(g, cx, cy, c.w, ch, 10, 'rgba(9, 12, 22, 0.86)', 'rgba(255,255,255,0.14)', 1.2);
      fillRounded(g, cx + 4, cy + 4, c.kw, ch - 8, 6, 'rgba(255,255,255,0.12)', null);
      drawText(g, c.key, cx + 4 + c.kw / 2, cy + ch / 2 + 0.5, { size: 15, weight: 800, fill: '#fff' });
      drawText(g, c.desc, cx + c.kw + (c.w - c.kw) / 2, cy + ch / 2 + 0.5, { size: 15, weight: 700, fill: TOKENS.gold });
      cx += c.w + chipGap;
    }

    const shown = rules.filter((r) => r.enabled !== false && r.trigger.type === 'gift').slice(0, 6);
    if (!shown.length) return;

    const dockX = 20, dockY = 1736, dockW = W - 40, dockH = 164, pad = 8, gap = 8;
    fillRounded(g, dockX, dockY, dockW, dockH, 22, TOKENS.bgPanel, TOKENS.border, 1.5);

    const cardW = (dockW - pad * 2 - gap * (shown.length - 1)) / shown.length;
    const cardH = dockH - pad * 2;

    shown.forEach((r, i) => {
      const x = dockX + pad + i * (cardW + gap);
      const lit = time - (ruleFlash.get(r.id) || -99) < 0.9;
      const y = dockY + pad - (lit ? 4 : 0);
      const tier = cardTier(r.action);
      const icon = (actionsMap.get(r.action) || {}).icon || '🎁';

      const fill = lit ? 'rgba(245, 197, 66, 0.25)' : tier.bg;
      const stroke = lit ? TOKENS.gold : (tier.tag === 'EFSANE' ? 'rgba(245, 197, 66, 0.45)' : 'rgba(255,255,255,0.11)');
      fillRounded(g, x, y, cardW, cardH, 14, fill, stroke, lit ? 2.5 : 1.2);

      fillRounded(g, x + 16, y + 6, cardW - 32, 3.5, 2, lit ? TOKENS.gold : tier.color, null);
      drawText(g, tier.tag, x + cardW / 2, y + 21, { size: 11, weight: 900, fill: lit ? TOKENS.gold : tier.color });
      drawText(g, icon, x + cardW / 2, y + 58, { size: 36 });
      drawText(g, r.label || r.action, x + cardW / 2, y + 98, { size: 18, weight: 800, fill: TOKENS.text, maxWidth: cardW - 12 });

      const pillW = cardW - 18, pillH = 26;
      fillRounded(g, x + 9, y + cardH - pillH - 8, pillW, pillH, 8, TOKENS.bgRecess, lit ? 'rgba(245,197,66,0.55)' : 'rgba(255,255,255,0.1)', 1);
      drawText(g, shortCoinLabel(r.trigger), x + cardW / 2, y + cardH - pillH / 2 - 7.5, {
        size: 14, weight: 800, fill: TOKENS.gold, font: TOKENS.mono, maxWidth: pillW - 8,
      });
    });
  }

  // ---------- 4) Akdeniz Final Şöleni / Gecenin Kralı Kartı ----------
  function drawFinaleCard(s) {
    const { finaleT, night, nightKing } = s;
    const k = ease.outBack(clamp(finaleT / 0.5, 0, 1));
    const remSec = Math.max(0, Math.ceil(9.0 - finaleT));

    g.save();
    g.translate(W / 2, 420);
    g.scale(k, k);
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 36;
    fillRounded(g, -390, -124, 780, 248, 24, 'rgba(9, 12, 22, 0.94)', TOKENS.gold, 2.5);
    g.restore();

    g.save();
    g.translate(W / 2, 420);
    g.scale(k, k);
    fillRounded(g, -376, -110, 10, 220, 5, TOKENS.amber, null);
    fillRounded(g, -155, -100, 310, 32, 10, 'rgba(245, 197, 66, 0.16)', 'rgba(245, 197, 66, 0.5)', 1.2);
    drawText(g, `🎆 ${night}. GECE · AKDENİZ ŞÖLENİ`, 0, -83.5, { size: 17, weight: 900, fill: TOKENS.gold });

    drawText(g, `👑 ${nightKing ? nightKing.nick : 'Sahil Tayfası'}`, 0, -8, { size: 52, weight: 900, fill: '#fff', maxWidth: 680, shadow: true });
    drawText(g, nightKing ? `GECENİN KEYİF KRALI · ${nightKing.score} PUAN` : 'HERKES ÇAKMAKLARI KALDIRSIN!', 0, 46, { size: 21, weight: 800, fill: TOKENS.amber });

    fillRounded(g, -220, 72, 440, 36, 12, TOKENS.bgRecess, 'rgba(255,255,255,0.12)', 1);
    drawText(g, `Yeni gece başlıyor · ${remSec} sn`, 0, 90.5, { size: 18, weight: 800, fill: TOKENS.cyan, font: TOKENS.mono });
    g.restore();
  }

  function render(state) {
    g.clearRect(0, 0, W, H);
    drawTopDeck(state);
    drawProjectedLabels(state);
    drawBottomDeck(state);
    if (state.finale) drawFinaleCard(state);
  }

  return { render };
}
