// Browser entry: loads assets, runs the fixed-step game loop, renders, plays sound, talks to the server.
//   ?seed=123          reproducible game            ?speed=50         fast mode (50x simulation speed)
//   ?game=20&intro=10  shorter test game (minutes)  ?resume=1         continue the saved game after a crash
//   ?bench=200         200-ball frame-rate bench    ?debug=1          show fps / sim speed
import { Game, TICK } from '../shared/game.js';
import { BOARD } from '../shared/board.js';
import { Renderer } from './render.js';
import { Sfx } from './audio.js';

const q = new URLSearchParams(location.search);
const errBox = document.getElementById('err');
window.addEventListener('error', (e) => { errBox.textContent += `${e.message}\n`; });
window.addEventListener('unhandledrejection', (e) => { errBox.textContent += `${e.reason}\n`; });

const json = (u, o) => fetch(u, o).then((r) => (r.ok ? r.json() : null));
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('missing ' + src)); i.src = src; });

async function boot() {
  const [cfg, countries, bp] = await Promise.all([json('/api/config'), json('/data/countries.json'), json('/data/bin-probs.json')]);
  const imgs = new Map();
  await Promise.all(countries.map(async (c) => imgs.set(c.code, await loadImg(`/assets/flags/${c.code}.png`))));

  let resume = null, seed = q.has('seed') ? +q.get('seed') : cfg.seed;
  if (q.get('resume')) { resume = await json('/api/state'); if (resume) seed = resume.seed; }
  if (seed == null) seed = (await json('/api/newseed')).seed;
  const config = {};
  if (q.has('game')) config.gameSeconds = +q.get('game') * 60; else if (cfg.gameMinutes) config.gameSeconds = cfg.gameMinutes * 60;
  if (q.has('intro')) config.introSeconds = +q.get('intro');
  if (q.has('winner')) config.winnerSeconds = +q.get('winner');
  if (q.has('cooldown')) config.cooldownSeconds = +q.get('cooldown');
  const game = new Game({ seed, countries, probs: bp.probs, config, resume });
  window.__game = game;

  const cv = document.getElementById('c');
  const renderer = new Renderer(cv, { countries, byCode: game.byCode, imgs }, cfg);
  const sfx = new Sfx(q.get('mute') ? { enabled: false } : cfg.sound);
  sfx.init();

  const speed = +(q.get('speed') || 1);
  const ui = { flashes: [], confetti: [], now: performance.now(), toast: null, hof: null, chat: { hl: new Map(), counts: new Map(), top: [], sig: 0 } };
  // hall of fame (wins per country, kept by the server); only normal games (no test parameters) are counted
  const official = !['seed', 'speed', 'game', 'intro', 'winner', 'cooldown', 'bench'].some((k) => q.has(k));
  json('/api/wins').then((h) => { if (h && !ui.hof) ui.hof = h; }).catch(() => {});
  window.__ui = ui;
  const fast = () => speed > 4;

  // ---- wiring game events -> effects / sound / persistence
  game.on('peg', (b, peg, sp) => {
    if (fast() || b.payload?.demo === undefined && false) return;
    if (peg) { if (ui.flashes.length < 90) ui.flashes.push({ x: peg.x, y: peg.y, age: 0 }); sfx.tick(sp, peg.row, Math.round(peg.x / 66)); }
  });
  game.on('land', (b, bin, outcome) => {
    if (fast()) return;
    if (outcome === 'out') sfx.out(); else if (outcome === 'safe') sfx.safe(); else if (typeof outcome === 'number') sfx.safe();
  });
  game.on('roundStart', (info) => {
    if (!fast()) sfx.roundStart();
    fetch('/api/state', { method: 'POST', body: JSON.stringify(game.snapshot()) }).catch(() => {});
  });
  game.on('replay', (info) => {
    if (!fast()) { sfx.replay(); ui.toast = { text: info.tie ? 'TIE - RE-DROP!' : 'REPLAY!', color: '#ffd84d', until: performance.now() + 4000 }; }
  });
  game.on('results', () => { if (!fast()) sfx.results(); });
  game.on('winner', (code, log) => {
    const rounds = log.rounds.filter((r) => !r.replay).length;
    window.__summary = { seed, minutes: +(game.T / 60).toFixed(2), rounds, replays: log.replays, winner: game.byCode.get(code).name, nudges: game.world.stats.nudges + game.world.stats.progressNudges, forced: game.world.stats.forced };
    console.log('[summary] ' + JSON.stringify(window.__summary));
    if (!fast()) sfx.winner(); else sfx.cfg.enabled = false;
    for (let i = 0; i < 240; i++) ui.confetti.push({ x: Math.random() * 1080, y: -Math.random() * 900, vx: (Math.random() - 0.5) * 160, vy: 120 + Math.random() * 260, w: 8 + Math.random() * 10, h: 14 + Math.random() * 12, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, color: ['#ffd84d', '#35e0ff', '#ff4d6d', '#2fe39a', '#ffffff', '#b07bff'][i % 6] });
    fetch('/api/log', { method: 'POST', body: JSON.stringify({ ...log, finishedAt: Date.now(), countries: countries.length, official }) })
      .then((r) => r.json()).then((h) => { if (h && h.wins) ui.hof = h; }).catch(() => {});
  });
  game.on('restart', () => { if (q.get('once')) { window.__finished = true; return; } location.href = `/?${new URLSearchParams([...q.entries()].filter(([k]) => !['seed', 'resume'].includes(k)))}`; });

  // ---- live chat highlights (never touches the game state)
  if (cfg.chat?.enabled || q.get('chat')) {
    const es = new EventSource('/api/events');
    const hlMs = (cfg.chat?.highlightSeconds || 10) * 1000;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type !== 'chat') return;
      ui.chat.hl.set(e.code, { user: e.user, until: performance.now() + hlMs });
      ui.chat.counts.set(e.code, (ui.chat.counts.get(e.code) || 0) + 1);
      ui.chat.top = [...ui.chat.counts].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n).slice(0, 5);
      ui.chat.sig++;
    };
  }

  // ---- benchmark scenario: 200 balls on screen at once, constantly refilled
  const benchN = +(q.get('bench') || 0);
  if (benchN) {
    game.mode = 'bench';
    const respawn = (code) => game.world.spawn({ code, demo: true }, undefined, { y: BOARD.spawnY - Math.random() * 600 });
    for (let i = 0; i < benchN; i++) respawn(countries[i % countries.length].code);
    game.world.onLand = (b) => respawn(b.payload.code);
    window.__bench = { frames: [], work: [], done: false };
  }

  // ---- loop
  let last = performance.now(), acc = 0, fpsT = last, fpsN = 0, fps = 0, simSpeedShown = 0;
  const cpuBudget = speed > 1 ? 12 : 20;
  function frame(now) {
    const dtms = now - last; last = now;
    ui.now = now;
    if (benchN) window.__bench.frames.push(dtms);
    acc += Math.min(dtms, 250) / 1000 * speed;
    const t0 = performance.now();
    let steps = 0;
    while (acc >= TICK) {
      game.tick(); acc -= TICK; steps++;
      if (performance.now() - t0 > cpuBudget) { acc = Math.min(acc, TICK * 3); break; }
    }
    simSpeedShown = steps / (dtms / 1000) / 60;
    for (const f of ui.flashes) f.age += dtms / 1000;
    ui.flashes = ui.flashes.filter((f) => f.age < 0.22);
    if (ui.confetti.length) {
      const d = dtms / 1000;
      for (const p of ui.confetti) { p.x += p.vx * d; p.y += p.vy * d; p.rot += p.vr * d; p.vx += Math.sin(p.y / 80) * 20 * d; }
      ui.confetti = ui.confetti.filter((p) => p.y < 1980);
    }
    renderer.draw(game, ui);
    if (benchN) (window.__bench.work ||= []).push(performance.now() - t0);
    fpsN++;
    if (now - fpsT > 1000) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; window.__fps = fps; }
    if (q.get('debug')) {
      const g = renderer.g;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(8, 8, 330, 62);
      g.fillStyle = '#7CFFB2'; g.font = '700 22px monospace'; g.textAlign = 'left';
      g.fillText(`fps ${fps.toFixed(0)}  balls ${game.world.balls.length}`, 16, 32);
      g.fillText(`sim x${simSpeedShown.toFixed(1)}  T ${game.T.toFixed(0)}s  ${game.mode}`, 16, 58);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- helper for tests: run the simulation synchronously until a condition is true
  window.__ff = (fn, maxTicks = 3_000_000) => { let n = 0; while (!fn(game) && n++ < maxTicks) game.tick(); return n; };

  const fit = () => { const s = Math.min(innerWidth / 1080, innerHeight / 1920); cv.style.transform = `translateX(${-540 * s}px) scale(${s})`; };
  addEventListener('resize', fit); fit();
  window.__ready = true;
}
boot().catch((e) => { errBox.textContent += `boot failed: ${e.stack || e}\n`; });
