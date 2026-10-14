// Physics calibration + stuck test.
//   node tools/calibrate.js [--n 3000] [--write]
// 1) single balls (no interaction): fall-time distribution + landing probability per bin
// 2) 200 balls released at once: nobody may get stuck
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RNG } from '../src/shared/rng.js';
import { World, PHYS } from '../src/shared/physics.js';
import { BOARD, binIndex } from '../src/shared/board.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const N = +arg('--n', 3000);
const DT = 1 / 120;

export function singleDrops(n, seed = 7, phys) {
  const rng = new RNG(seed);
  const world = new World(rng, { phys });
  const hist = new Array(BOARD.bins).fill(0);
  const times = [];
  world.onLand = (b, bin) => { hist[bin]++; times.push(b.age); };
  // 50 balls at a time but far enough apart in time not to interact much: drop one every 0.4 s (they overlap in flight, which is realistic)
  let spawned = 0, t = 0;
  while (world.balls.length || spawned < n) {
    if (spawned < n && t >= spawned * 0.4) { world.spawn(null); spawned++; }
    world.step(DT); t += DT;
  }
  return { hist, times, stats: world.stats, simTime: t };
}

export function burst(count, seed = 3, phys) {
  const rng = new RNG(seed);
  const world = new World(rng, { phys });
  const hist = new Array(BOARD.bins).fill(0);
  let landed = 0; const times = [];
  world.onLand = (b, bin) => { hist[bin]++; landed++; times.push(b.age); };
  // two staggered rows so that spawn overlaps are minimal
  for (let i = 0; i < count; i++) {
    const col = i % 20, row = Math.floor(i / 20);
    world.spawn(null, 30 + col * ((BOARD.W - 60) / 19), { y: BOARD.spawnY - row * 44, vx: rng.float(-20, 20) });
  }
  let t = 0;
  while (world.balls.length && t < 200) { world.step(DT); t += DT; }
  return { landed, hist, times, stats: world.stats, left: world.balls.length, simTime: t };
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('physics:', JSON.stringify(PHYS));
  const t0 = Date.now();
  const r = singleDrops(N);
  const tot = r.hist.reduce((a, b) => a + b, 0);
  const probs = r.hist.map((h) => h / tot);
  console.log(`\n[single] ${N} balls in ${((Date.now() - t0) / 1000).toFixed(1)}s wall (sim ${r.simTime.toFixed(0)}s)`);
  console.log(`fall time  mean ${(r.times.reduce((a, b) => a + b, 0) / r.times.length).toFixed(2)}s  p5 ${q(r.times, .05).toFixed(2)}  p50 ${q(r.times, .5).toFixed(2)}  p95 ${q(r.times, .95).toFixed(2)}  max ${Math.max(...r.times).toFixed(2)}`);
  console.log('bin probs  ', probs.map((p) => (p * 100).toFixed(1)).join(' '));
  console.log('stats      ', JSON.stringify(r.stats));
  const b = burst(200);
  console.log(`\n[burst 200] landed ${b.landed}/200 left ${b.left}  sim ${b.simTime.toFixed(1)}s  fall mean ${(b.times.reduce((a, c) => a + c, 0) / b.times.length).toFixed(1)}s max ${Math.max(...b.times).toFixed(1)}s`);
  console.log('stats      ', JSON.stringify(b.stats));
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, 'data/bin-probs.json'), JSON.stringify({ n: tot, probs, fall: { p5: q(r.times, .05), p50: q(r.times, .5), p95: q(r.times, .95) } }, null, 1));
    console.log('\nwrote data/bin-probs.json');
  }
}
