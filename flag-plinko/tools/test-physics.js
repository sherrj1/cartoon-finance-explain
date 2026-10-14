// Automated checks: wall-hugging balls, determinism, crash-resume, fairness hooks.
//   node tools/test-physics.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RNG } from '../src/shared/rng.js';
import { World } from '../src/shared/physics.js';
import { BOARD } from '../src/shared/board.js';
import { Game } from '../src/shared/game.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));
const probs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bin-probs.json'), 'utf8')).probs;
let failed = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };

// 1) the v1 bug: balls hugging the side walls must never rest there
{
  const world = new World(new RNG(99));
  let landed = 0, maxAge = 0;
  world.onLand = (b) => { landed++; maxAge = Math.max(maxAge, b.age); };
  let n = 0;
  for (let i = 0; i < 600; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side < 0 ? BOARD.ballR + 0.5 + (i % 7) : BOARD.W - BOARD.ballR - 0.5 - (i % 7);
    world.spawn(null, x, { vx: side * -(i % 5), vy: 20 }); n++;
    for (let k = 0; k < 120 * 0.5; k++) world.step(1 / 120);   // one wall-hugger every 0.5 s
  }
  while (world.balls.length) world.step(1 / 120);
  check('wall-hugging balls all land', landed === n, `${landed}/${n}`);
  check('wall-hugging balls never slow-stuck', maxAge < 15 && world.stats.forced === 0, `slowest ${maxAge.toFixed(1)}s, nudges ${world.stats.nudges + world.stats.progressNudges}, forced ${world.stats.forced}`);
}

// 2) determinism: same seed -> identical game; other seed -> different
const run = (seed, cfg) => { const g = new Game({ seed, countries, probs, config: cfg }); while (g.mode !== 'winner') g.tick(); return g; };
{
  const a = run(4242), b = run(4242), c = run(4243);
  check('same seed reproduces the exact game', a.winner === b.winner && JSON.stringify(a.log.rounds) === JSON.stringify(b.log.rounds), `winner ${a.winner}`);
  check('different seed gives a different game', JSON.stringify(a.log.rounds) !== JSON.stringify(c.log.rounds));
  check('game ends 175-185 min', a.T / 60 >= 175 && a.T / 60 <= 185, `${(a.T / 60).toFixed(2)} min`);
}

// 3) crash-resume: restoring the saved round-start snapshot continues the same game
{
  const g = new Game({ seed: 777, countries, probs });
  let snap = null;
  g.on('snapshot', (s) => { if (g.roundNo === 6 && !snap) snap = JSON.parse(JSON.stringify(s)); });
  while (g.mode !== 'winner') g.tick();
  const r = new Game({ seed: 777, countries, probs, resume: snap });
  while (r.mode !== 'winner') r.tick();
  check('resume from a round snapshot gives the same winner and rounds', r.winner === g.winner && JSON.stringify(r.log.rounds) === JSON.stringify(g.log.rounds), `winner ${g.winner}, resumed at round 6`);
}

// 4) no predetermined outcome: every country can win (spot check of landing distribution fairness is in calibrate.js)
{
  const w = new Set();
  for (let s = 0; s < 12; s++) w.add(run(9000 + s).winner);
  check('winners vary across seeds', w.size >= 9, `${w.size} different winners in 12 games`);
}

// 5) fast mode speed
{
  const t0 = Date.now(); run(5);
  const s = (Date.now() - t0) / 1000;
  check('3-hour game simulates in under 60 s', s < 60, `${s.toFixed(1)} s`);
}
console.log(failed ? `\n${failed} FAILED` : '\nall physics/game tests passed');
process.exit(failed ? 1 : 0);
