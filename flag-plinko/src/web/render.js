// Canvas renderer for the 1080x1920 vertical layout.
import { BOARD, BOARD_X, BOARD_Y, BIN_POINTS } from '../shared/board.js';
import { buildBoard } from '../shared/board.js';

export const LAYOUT = {
  W: 1080, H: 1920,
  stripY: 1314, stripH: 60,
  gridX: 40, gridY: 1386, cellW: 50, cellH: 44, cols: 20, rows: 10,
  tickY: 1832, tickH: 44,
  wmY: 1884,
};
const F = (size, weight = 800) => `${weight} ${size}px Inter, "Segoe UI", Arial, Helvetica, sans-serif`;
const C = { bg0: '#070b1f', bg1: '#1b0f3d', panel: '#0c1433', line: '#3a5bff', cyan: '#35e0ff', green: '#2fe39a', red: '#ff4d6d', gold: '#ffd84d', text: '#ffffff', dim: '#8d9bd6' };

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function txt(g, s, x, y, size, color = C.text, o = {}) {
  g.font = F(size, o.weight || 800);
  g.textAlign = o.align || 'center';
  g.textBaseline = o.base || 'middle';
  if (o.stroke) { g.lineWidth = o.strokeW || Math.max(3, size / 6); g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color;
  g.fillText(s, x, y);
}
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const hms = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export class Renderer {
  constructor(cv, assets, cfg = {}) {
    this.cv = cv;
    this.g = cv.getContext('2d', { alpha: false });
    this.assets = assets;
    this.cfg = cfg;
    this.order = [...assets.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.code);
    this.cellOf = new Map(this.order.map((code, i) => [code, i]));
    this.S = 2 * BOARD.ballR + 6;
    this.ball = new Map(); this.pill = new Map(); this.cell = new Map(); this.cellGray = new Map();
    for (const c of assets.countries) this._sprites(c);
    this.board = buildBoard();
    this.static = this._buildStatic();
    this.gridCv = canvas(LAYOUT.cols * LAYOUT.cellW, LAYOUT.rows * LAYOUT.cellH);
    this.gridKey = '';
    this.tickerCv = null; this.tickerKey = '';
    this.fpsAvg = 60; this.lastDraw = 0;
  }

  // ------------------------------------------------------------------ sprites
  _sprites(c) {
    const img = this.assets.imgs.get(c.code);
    const R = BOARD.ballR, S = this.S;
    // round ball with the flag cover-cropped inside
    const b = canvas(S, S), g = b.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(S / 2, S / 2, R + 2.5, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, 7); g.clip();
    const sh = 2 * R, sw = (img.width * sh) / img.height;
    g.drawImage(img, S / 2 - sw / 2, S / 2 - R, sw, sh);
    const gl = g.createRadialGradient(S / 2 - 7, S / 2 - 9, 1, S / 2 - 4, S / 2 - 6, R * 1.2);
    gl.addColorStop(0, 'rgba(255,255,255,0.45)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = gl; g.fillRect(0, 0, S, S);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(S / 2, S / 2, R + 2.5, 0, 7); g.stroke();
    this.ball.set(c.code, b);
    // name pill
    let size = 16; const m = canvas(10, 10).getContext('2d');
    m.font = F(size, 800); let w = m.measureText(c.name).width;
    while (w > 150 && size > 10) { size--; m.font = F(size, 800); w = m.measureText(c.name).width; }
    const p = canvas(Math.ceil(w) + 14, 22), pg = p.getContext('2d');
    pg.fillStyle = 'rgba(5,8,25,0.72)'; rr(pg, 0, 0, p.width, 22, 11); pg.fill();
    pg.font = F(size, 800); pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillStyle = '#fff'; pg.fillText(c.name, p.width / 2, 12);
    this.pill.set(c.code, p);
    // grid cell (colour + greyed-out)
    const cw = 42, ch = 32;
    const mk = (gray) => {
      const k = canvas(cw + 4, ch + 4), kg = k.getContext('2d');
      kg.save(); rr(kg, 2, 2, cw, ch, 5); kg.clip();
      if (gray) kg.filter = 'grayscale(1) brightness(0.38) contrast(0.9)';
      kg.drawImage(img, 2, 2, cw, ch);
      kg.restore();
      kg.strokeStyle = gray ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)'; kg.lineWidth = 1.5; rr(kg, 2, 2, cw, ch, 5); kg.stroke();
      return k;
    };
    this.cell.set(c.code, mk(false)); this.cellGray.set(c.code, mk(true));
  }

  // ------------------------------------------------------------------ static layer
  _buildStatic() {
    const L = LAYOUT, cv = canvas(L.W, L.H), g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, L.H);
    bg.addColorStop(0, C.bg0); bg.addColorStop(1, C.bg1);
    g.fillStyle = bg; g.fillRect(0, 0, L.W, L.H);
    for (const [x, y, r, col] of [[200, 160, 420, 'rgba(53,224,255,0.10)'], [900, 700, 520, 'rgba(120,70,255,0.12)'], [300, 1500, 520, 'rgba(255,77,109,0.07)']]) {
      const rg = g.createRadialGradient(x, y, 10, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, L.W, L.H);
    }
    // header cards
    g.fillStyle = 'rgba(255,255,255,0.06)'; rr(g, 40, 80, 1000, 108, 24); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,0.07)'; rr(g, 40 + i * 340, 200, 320, 66, 18); g.fill(); }
    // board
    g.save(); g.shadowColor = 'rgba(58,91,255,0.55)'; g.shadowBlur = 30;
    g.fillStyle = C.panel; rr(g, BOARD_X - 8, BOARD_Y - 8, BOARD.W + 16, BOARD.H + 16, 28); g.fill(); g.restore();
    g.strokeStyle = C.line; g.lineWidth = 3; rr(g, BOARD_X - 8, BOARD_Y - 8, BOARD.W + 16, BOARD.H + 16, 28); g.stroke();
    g.save(); g.translate(BOARD_X, BOARD_Y);
    const bgrad = g.createLinearGradient(0, 0, 0, BOARD.H); bgrad.addColorStop(0, '#0f1a44'); bgrad.addColorStop(1, '#0a0f2b');
    g.fillStyle = bgrad; rr(g, 0, 0, BOARD.W, BOARD.H, 20); g.fill();
    // wedges
    g.fillStyle = '#6f86ff';
    for (let i = 0; i < this.board.segs.length; i++) {
      const s = this.board.segs[i];
      if (s.r !== 2) continue;
      g.strokeStyle = '#8fa2ff'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
    }
    // dividers
    for (const s of this.board.segs) {
      if (!s.divider) continue;
      g.strokeStyle = '#cfe0ff'; g.lineWidth = s.r * 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
    }
    // pegs
    for (const p of this.board.pegs) {
      const pg = g.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.r + 2);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#8fb0ff');
      g.fillStyle = pg; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    }
    g.restore();
    // bin strip + grid + ticker backgrounds
    g.fillStyle = 'rgba(255,255,255,0.05)'; rr(g, 40, L.gridY - 6, 1000, L.rows * L.cellH + 12, 18); g.fill();
    g.fillStyle = 'rgba(255,77,109,0.18)'; rr(g, 40, L.tickY, 1000, L.tickH, 14); g.fill();
    return cv;
  }

  // ------------------------------------------------------------------ main draw
  draw(game, ui) {
    const g = this.g, L = LAYOUT;
    g.drawImage(this.static, 0, 0);
    this._header(g, game);
    this._board(g, game, ui);
    this._strip(g, game);
    if (game.inFinale && game.round && game.mode !== 'winner' && game.mode !== 'cooldown') this._scoreboard(g, game);
    else this._grid(g, game, ui);
    this._ticker(g, game, ui);
    this._footer(g, game, ui);
    this._overlays(g, game, ui);
    if (ui.confetti?.length) this._confetti(g, ui);
  }

  _header(g, game) {
    const cfg = this.cfg;
    const title = cfg.channelName || 'FLAG PLINKO';
    const tg = g.createLinearGradient(240, 0, 840, 0); tg.addColorStop(0, C.cyan); tg.addColorStop(0.5, '#ffffff'); tg.addColorStop(1, C.gold);
    txt(g, title, 540, 42, 58, tg, { stroke: 'rgba(0,0,0,0.5)', strokeW: 8 });
    let label = 'GAME ENDS IN', value = hms(game.remaining), col = C.text;
    if (game.mode === 'intro') { label = 'GAME STARTS IN'; value = mmss(game.cfg.introSeconds - game.T); col = C.cyan; }
    else if (game.mode === 'winner' || game.mode === 'cooldown') { label = 'NEXT GAME IN'; value = mmss(game.mode === 'winner' ? game.cfg.cooldownSeconds : game.modeEnd - game.T); col = C.gold; }
    txt(g, label, 540, 103, 24, C.dim, { weight: 700 });
    txt(g, value, 540, 152, 78, col, { stroke: 'rgba(0,0,0,0.45)', strokeW: 8 });
    const R = game.round;
    const cards = [
      ['ROUND', game.mode === 'intro' ? '-' : String(game.roundNo) + (R && R.attempt > 1 ? `  (replay ${R.attempt - 1})` : ''), game.phase ? game.phase.name : game.inFinale ? 'FINALE' : ''],
      ['FLAGS LEFT', String(game.alive.length), ''],
      [game.inFinale ? 'ELIMINATING' : 'MUST GO', R && game.mode !== 'intro' ? String(R.mustGo) : '-', ''],
    ];
    cards.forEach(([lab, val, sub], i) => {
      const x = 40 + i * 340 + 160;
      txt(g, lab, x, 217, 18, C.dim, { weight: 700 });
      txt(g, val, x, 247, 38, i === 2 ? C.red : i === 1 ? C.cyan : C.text, { stroke: 'rgba(0,0,0,0.4)', strokeW: 5 });
      if (sub) txt(g, sub, x + 150, 217, 15, C.gold, { weight: 800, align: 'right' });
    });
  }

  _board(g, game, ui) {
    const R = game.round;
    g.save();
    g.translate(BOARD_X, BOARD_Y);
    g.beginPath(); rr(g, 0, 0, BOARD.W, BOARD.H, 20); g.clip();
    // bin tints
    const bw = BOARD.W / BOARD.bins;
    const show = R && game.mode !== 'intro';
    for (let i = 0; i < BOARD.bins; i++) {
      let col = 'rgba(255,255,255,0.05)';
      if (show) {
        const b = R.bins[i];
        const k = game.mode === 'banner' ? Math.min(1, 1 - (R.bannerEnd - game.T) / 3 + 0.2) : 1;
        col = R.finale ? `rgba(255,216,77,${0.06 + 0.22 * (b.points / 10) * k})` : b.green ? `rgba(47,227,154,${0.24 * k})` : `rgba(255,77,109,${0.26 * k})`;
      }
      g.fillStyle = col; g.fillRect(i * bw + 2, BOARD.binTop, bw - 4, BOARD.H - BOARD.binTop);
    }
    // landed stacks (mini flags)
    if (show) {
      for (let i = 0; i < BOARD.bins; i++) {
        const st = game.binStacks[i];
        const n = Math.min(st.length, 12);
        for (let k = 0; k < n; k++) {
          const code = st[st.length - n + k];
          const col = k % 4, row = Math.floor(k / 4);
          const x = i * bw + 11 + col * 20 + 10, y = BOARD.H - 14 - row * 21;
          g.drawImage(this.ball.get(code), x - 10, y - 10, 20, 20);
        }
      }
    }
    // peg flashes
    for (const f of ui.flashes) {
      const a = 1 - f.age / 0.22;
      if (a <= 0) continue;
      g.fillStyle = `rgba(150,230,255,${0.9 * a})`; g.beginPath(); g.arc(f.x, f.y, 7 + 9 * (1 - a), 0, 7); g.fill();
      g.fillStyle = `rgba(150,230,255,${0.22 * a})`; g.beginPath(); g.arc(f.x, f.y, 24, 0, 7); g.fill();
    }
    // balls
    const S = this.S, now = ui.now;
    const hl = ui.chat?.hl;
    for (const b of game.world.balls) {
      const code = b.payload.code;
      if (this.cfg.trails && b.trail) { /* reserved */ }
      g.drawImage(this.ball.get(code), b.x - S / 2, b.y - S / 2);
      const h = hl && hl.get(code);
      if (h && h.until > now) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 120);
        g.strokeStyle = `rgba(255,216,77,${0.55 + 0.45 * pulse})`; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, BOARD.ballR + 6 + pulse * 3, 0, 7); g.stroke();
        g.fillStyle = 'rgba(255,216,77,0.14)'; g.beginPath(); g.arc(b.x, b.y, BOARD.ballR + 16, 0, 7); g.fill();
        txt(g, h.user, b.x, b.y - BOARD.ballR - 20, 18, C.gold, { stroke: 'rgba(0,0,0,0.85)', strokeW: 5 });
      }
      if (b.y > -10) { const p = this.pill.get(code); g.drawImage(p, b.x - p.width / 2, b.y + BOARD.ballR + 2); }
    }
    // dropping chip
    if (show && game.mode !== 'banner' && !game.inFinale) {
      const t = `${R.released}/${R.n} DROPPED  ·  ${R.landed} LANDED`;
      g.fillStyle = 'rgba(5,8,25,0.7)'; rr(g, 16, 14, 420, 40, 20); g.fill();
      txt(g, t, 226, 35, 20, C.text, { weight: 700 });
    }
    g.restore();
  }

  _strip(g, game) {
    const L = LAYOUT, R = game.round, bw = BOARD.W / BOARD.bins;
    const show = R && game.mode !== 'intro';
    for (let i = 0; i < BOARD.bins; i++) {
      const x = BOARD_X + i * bw;
      let fill = 'rgba(255,255,255,0.08)', label = '', col = C.dim;
      if (show) {
        const b = R.bins[i];
        if (R.finale) { fill = `rgba(255,216,77,${0.10 + 0.25 * b.points / 10})`; label = `${b.points} PTS`; col = C.gold; }
        else if (b.green) { fill = 'rgba(47,227,154,0.28)'; label = 'SAFE'; col = C.green; }
        else { fill = 'rgba(255,77,109,0.30)'; label = 'OUT'; col = C.red; }
      }
      g.fillStyle = fill; rr(g, x + 2, L.stripY, bw - 4, L.stripH, 10); g.fill();
      if (label) txt(g, label, x + bw / 2, L.stripY + 17, 19, col, { stroke: 'rgba(0,0,0,0.5)', strokeW: 4 });
      if (show) txt(g, String(R.bins[i].count), x + bw / 2, L.stripY + 42, 26, C.text, { stroke: 'rgba(0,0,0,0.5)', strokeW: 5 });
    }
  }

  _grid(g, game, ui) {
    const L = LAYOUT, R = game.round, mode = game.mode;
    const chatSig = ui.chat ? ui.chat.sig : 0;
    const key = `${game.alive.length}|${R ? R.landed : 0}|${mode === 'intro'}|${game.round ? game.round.no + ':' + game.round.attempt : 0}`;
    if (key !== this.gridKey) {
      this.gridKey = key;
      const gg = this.gridCv.getContext('2d');
      gg.clearRect(0, 0, this.gridCv.width, this.gridCv.height);
      const alive = new Set(game.alive);
      const outNow = new Set(), safeNow = new Set();
      if (R && !R.finale && mode !== 'intro') for (const [code, o] of Object.entries(R.outcome)) (o === 'out' ? outNow : safeNow).add(code);
      this.order.forEach((code, i) => {
        const cx = (i % L.cols) * L.cellW + 3, cy = Math.floor(i / L.cols) * L.cellH + 4;
        const dead = !alive.has(code) || outNow.has(code);
        gg.drawImage(dead ? this.cellGray.get(code) : this.cell.get(code), cx, cy);
        if (outNow.has(code)) { gg.strokeStyle = 'rgba(255,77,109,0.9)'; gg.lineWidth = 2; rr(gg, cx + 2, cy + 2, 42, 32, 5); gg.stroke(); }
        else if (safeNow.has(code)) { gg.strokeStyle = 'rgba(47,227,154,0.95)'; gg.lineWidth = 2.5; rr(gg, cx + 2, cy + 2, 42, 32, 5); gg.stroke(); }
      });
    }
    g.drawImage(this.gridCv, L.gridX, L.gridY);
    // chat highlights on the grid
    const hl = ui.chat?.hl;
    if (hl) for (const [code, h] of hl) {
      if (h.until <= ui.now) continue;
      const i = this.cellOf.get(code);
      const x = L.gridX + (i % L.cols) * L.cellW + 3, y = L.gridY + Math.floor(i / L.cols) * L.cellH + 4;
      const pulse = 0.5 + 0.5 * Math.sin(ui.now / 130);
      g.strokeStyle = `rgba(255,216,77,${0.6 + 0.4 * pulse})`; g.lineWidth = 3; rr(g, x - 1, y - 1, 46, 36, 7); g.stroke();
    }
  }

  _scoreboard(g, game) {
    const L = LAYOUT, R = game.round;
    const list = R.participants.slice().sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
    const max = Math.max(1, ...list.map((c) => game.scores[c] || 0));
    const min = Math.min(...list.map((c) => game.scores[c] || 0));
    const rowH = Math.min(100, (L.rows * L.cellH) / Math.max(2, list.length));
    txt(g, 'FINALE  ·  LOWEST SCORE GOES OUT', 540, L.gridY + 8, 22, C.gold, { weight: 800 });
    list.forEach((code, i) => {
      const y = L.gridY + 28 + i * rowH;
      const c = game.byCode.get(code);
      const sc = game.scores[code] || 0;
      const lowest = sc === min && game.mode !== 'banner';
      g.fillStyle = lowest ? 'rgba(255,77,109,0.22)' : 'rgba(255,255,255,0.08)'; rr(g, 50, y, 980, rowH - 8, 16); g.fill();
      const img = this.cell.get(code);
      const fh = Math.min(rowH - 18, 64);
      g.drawImage(img, 64, y + (rowH - 8 - fh) / 2, fh * 1.31, fh);
      txt(g, c.name, 64 + fh * 1.31 + 18, y + (rowH - 8) / 2 - 8, 30, C.text, { align: 'left' });
      g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, 64 + fh * 1.31 + 18, y + (rowH - 8) / 2 + 12, 520, 14, 7); g.fill();
      g.fillStyle = lowest ? C.red : C.cyan; rr(g, 64 + fh * 1.31 + 18, y + (rowH - 8) / 2 + 12, Math.max(14, (520 * sc) / max), 14, 7); g.fill();
      txt(g, String(sc), 900, y + (rowH - 8) / 2, 44, lowest ? C.red : C.text, { align: 'right', stroke: 'rgba(0,0,0,0.4)', strokeW: 6 });
      txt(g, `${R.balls?.[code] ?? 0}/${R.K} balls`, 1010, y + (rowH - 8) / 2 + 22, 15, C.dim, { align: 'right', weight: 700 });
    });
  }

  _ticker(g, game, ui) {
    const L = LAYOUT;
    const recent = game.recent;
    const key = recent.map((r) => r.code).join(',');
    if (key !== this.tickerKey) {
      this.tickerKey = key;
      const items = recent.length ? recent : [];
      const m = canvas(10, 10).getContext('2d'); m.font = F(24, 800);
      let w = 0; const widths = items.map((r) => { const nm = game.byCode.get(r.code).name; const iw = 34 + 10 + m.measureText(nm).width + 44; w += iw; return iw; });
      const cv = canvas(Math.max(1, Math.ceil(w)), L.tickH), tg = cv.getContext('2d');
      let x = 0;
      items.forEach((r, i) => {
        tg.drawImage(this.ball.get(r.code), x + 4, 4, 36, 36);
        txt(tg, game.byCode.get(r.code).name.toUpperCase(), x + 50, L.tickH / 2 + 1, 24, '#fff', { align: 'left' });
        txt(tg, '•', x + widths[i] - 20, L.tickH / 2, 24, C.red);
        x += widths[i];
      });
      this.tickerCv = cv;
    }
    g.save(); g.beginPath(); rr(g, 40, L.tickY, 1000, L.tickH, 14); g.clip();
    txt(g, game.recent.length ? '' : 'NO ELIMINATIONS YET', 540, L.tickY + L.tickH / 2, 22, C.dim);
    if (this.tickerCv && this.tickerCv.width > 1) {
      const w = this.tickerCv.width;
      const off = (ui.now / 1000 * 70) % w;
      for (let x = 150 - off; x < 1040; x += w) g.drawImage(this.tickerCv, x, L.tickY);
      if (w < 1000) for (let x = 150 - off - w; x > -w; x -= w) g.drawImage(this.tickerCv, x, L.tickY);
    }
    g.fillStyle = C.red; rr(g, 40, L.tickY, 108, L.tickH, 14); g.fill();
    txt(g, 'OUT', 94, L.tickY + L.tickH / 2 + 1, 24, '#fff');
    g.restore();
  }

  _footer(g, game, ui) {
    const L = LAYOUT;
    txt(g, this.cfg.watermark || '', 40, L.wmY + 14, 22, C.dim, { align: 'left', weight: 700 });
    const top = ui.chat?.top;
    if (top && top.length) {
      const t = top[0];
      txt(g, `★ MOST SUPPORTED: ${game.byCode.get(t.code).name.toUpperCase()} (${t.n})`, 1040, L.wmY + 14, 22, C.gold, { align: 'right' });
    }
  }

  // ------------------------------------------------------------------ overlays
  _card(g, y, h) {
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 30;
    g.fillStyle = 'rgba(8,12,38,0.9)'; rr(g, BOARD_X + 100, BOARD_Y + y, 800, h, 30); g.fill(); g.restore();
    g.strokeStyle = C.cyan; g.lineWidth = 3; rr(g, BOARD_X + 100, BOARD_Y + y, 800, h, 30); g.stroke();
  }

  _overlays(g, game, ui) {
    const R = game.round, cx = BOARD_X + BOARD.W / 2, T = game.T;
    if (game.mode === 'intro') {
      this._card(g, 70, 470);
      txt(g, `${game.countries.length} FLAGS ENTER`, cx, BOARD_Y + 140, 70, C.text, { stroke: 'rgba(0,0,0,0.5)' });
      txt(g, 'ONLY ONE SURVIVES', cx, BOARD_Y + 220, 56, C.gold, { stroke: 'rgba(0,0,0,0.5)' });
      txt(g, 'Land in a green bin to stay alive', cx, BOARD_Y + 310, 32, C.green, { weight: 700 });
      txt(g, 'Land in a red bin and you are out', cx, BOARD_Y + 356, 32, C.red, { weight: 700 });
      txt(g, 'COMMENT YOUR COUNTRY!', cx, BOARD_Y + 450, 46, C.cyan, { stroke: 'rgba(0,0,0,0.5)' });
      return;
    }
    if (!R) return;
    if (game.mode === 'banner') {
      const left = R.bannerEnd - T, total = Math.max(1, R.bannerEnd - R.startT);
      const fade = Math.min(1, left / 1.0, (total - left) / 0.4 + 0.2);
      g.save(); g.globalAlpha = Math.max(0, Math.min(1, fade));
      this._card(g, 80, 520);
      const title = R.tie ? 'TIE-BREAK' : R.attempt > 1 ? `ROUND ${R.no} - REPLAY` : `ROUND ${R.no}`;
      txt(g, title, cx, BOARD_Y + 150, 82, C.text, { stroke: 'rgba(0,0,0,0.5)' });
      txt(g, R.phaseName, cx, BOARD_Y + 214, 30, C.gold, { weight: 800 });
      if (R.finale) {
        txt(g, `${R.n} FLAGS LEFT`, cx, BOARD_Y + 290, 58, C.cyan, { stroke: 'rgba(0,0,0,0.5)' });
        txt(g, 'LOWEST SCORE IS ELIMINATED', cx, BOARD_Y + 370, 38, C.red, { stroke: 'rgba(0,0,0,0.5)' });
        txt(g, `${R.K} balls each`, cx, BOARD_Y + 420, 28, C.dim, { weight: 700 });
      } else {
        txt(g, `${R.n} FLAGS LEFT`, cx, BOARD_Y + 290, 58, C.cyan, { stroke: 'rgba(0,0,0,0.5)' });
        txt(g, `${R.mustGo} MUST GO`, cx, BOARD_Y + 370, 64, C.red, { stroke: 'rgba(0,0,0,0.5)' });
        if (R.attempt > 1 && !R.tie) txt(g, 'Replay: the first attempt did not fit the schedule', cx, BOARD_Y + 420, 24, C.dim, { weight: 700 });
      }
      txt(g, 'COMMENT YOUR COUNTRY!', cx, BOARD_Y + 475, 40, C.gold, { stroke: 'rgba(0,0,0,0.5)' });
      g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, BOARD_X + 140, BOARD_Y + 560, 720, 10, 5); g.fill();
      g.fillStyle = C.cyan; rr(g, BOARD_X + 140, BOARD_Y + 560, Math.max(10, 720 * (1 - left / total)), 10, 5); g.fill();
      g.restore();
    } else if (game.mode === 'results') {
      const left = game.modeEnd - T;
      g.save();
      this._card(g, 40, 940);
      txt(g, `ROUND ${R.no} RESULTS`, cx, BOARD_Y + 105, 56, C.text, { stroke: 'rgba(0,0,0,0.5)' });
      const elim = R.eliminated || [];
      txt(g, `${elim.length} OUT  ·  ${game.alive.length} REMAIN`, cx, BOARD_Y + 170, 34, C.red, { stroke: 'rgba(0,0,0,0.5)' });
      // scrolling list in two columns
      const top = BOARD_Y + 215, bottom = BOARD_Y + 940, rowH = 44, cols = 2;
      g.beginPath(); g.rect(BOARD_X + 120, top, 760, bottom - top); g.clip();
      const rows = Math.ceil(elim.length / cols), visible = Math.floor((bottom - top) / rowH);
      const over = Math.max(0, rows - visible);
      const prog = Math.min(1, Math.max(0, (R.resultsLen - left - 1.5) / Math.max(1, R.resultsLen - 4)));
      const off = over * rowH * prog;
      elim.forEach((code, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = BOARD_X + 140 + col * 380, y = top + row * rowH - off + 4;
        g.drawImage(this.ball.get(code), x, y, 36, 36);
        txt(g, game.byCode.get(code).name, x + 46, y + 19, 22, C.text, { align: 'left', weight: 700 });
      });
      if (elim.length === 0) txt(g, 'Nobody went out', cx, BOARD_Y + 500, 40, C.dim);
      g.restore();
    } else if (game.mode === 'winner' || game.mode === 'cooldown') {
      const code = game.winner;
      const c = game.byCode.get(code);
      g.save(); g.fillStyle = 'rgba(5,8,25,0.86)'; rr(g, BOARD_X, BOARD_Y, BOARD.W, BOARD.H, 20); g.fill();
      txt(g, 'WINNER', cx, BOARD_Y + 150, 120, C.gold, { stroke: 'rgba(0,0,0,0.6)', strokeW: 14 });
      const img = this.assets.imgs.get(code);
      const pulse = 1 + Math.sin(ui.now / 300) * 0.015;
      const w = 640 * pulse, h = w * 0.75;
      g.shadowColor = 'rgba(255,216,77,0.7)'; g.shadowBlur = 50;
      g.drawImage(img, cx - w / 2, BOARD_Y + 270, w, h);
      g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(cx - w / 2, BOARD_Y + 270, w, h);
      txt(g, c.name.toUpperCase(), cx, BOARD_Y + 270 + h + 100, 78, C.text, { stroke: 'rgba(0,0,0,0.6)', strokeW: 12 });
      txt(g, `after ${hms(game.log.durationSeconds || game.T)}`, cx, BOARD_Y + 270 + h + 180, 34, C.dim, { weight: 700 });
      g.restore();
    }
    // replay / elimination flash message
    if (ui.toast && ui.toast.until > ui.now) {
      const a = Math.min(1, (ui.toast.until - ui.now) / 400);
      g.save(); g.globalAlpha = a;
      g.fillStyle = 'rgba(8,12,38,0.88)'; rr(g, BOARD_X + 160, BOARD_Y + 500, 680, 90, 24); g.fill();
      txt(g, ui.toast.text, cx, BOARD_Y + 545, 38, ui.toast.color || C.gold, { stroke: 'rgba(0,0,0,0.5)' });
      g.restore();
    }
  }

  _confetti(g, ui) {
    for (const p of ui.confetti) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
  }
}
