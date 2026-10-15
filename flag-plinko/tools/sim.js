// Fast mode: simulates complete games without rendering and checks the schedule.
//   node tools/sim.js --games 50 [--seed 1000] [--workers 4] [--json out.json]
//   node tools/sim.js --games 1 --verbose        # print every round
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const has = (k) => process.argv.includes(k);

export async function runGame(seed, opts = {}) {
  const { Game } = await import('../src/shared/game.js');
  const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));
  const probs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bin-probs.json'), 'utf8')).probs;
  const game = new Game({ seed, countries, probs, config: opts.config });
  const startPause = game.cfg.winnerSeconds;
  let maxBalls = 0, ticks = 0;
  const t0 = Date.now();
  while (game.mode !== 'winner' && game.T < 3600 * 4) {
    game.tick(); ticks++;
    if (game.world.balls.length > maxBalls) maxBalls = game.world.balls.length;
  }
  const log = game.log;
  const rounds = log.rounds.filter((r) => !r.replay);
  return {
    seed, winner: game.winner, minutes: game.T / 60, rounds: rounds.length, replays: log.replays,
    nudges: game.world.stats.nudges + game.world.stats.progressNudges, forced: game.world.stats.forced,
    maxFall: game.world.stats.maxFall, maxBalls, wallSec: (Date.now() - t0) / 1000, log,
    phaseSurvivors: rounds.map((r) => r.survivors),
  };
}

if (isMainThread) {
  const games = +arg('--games', 10);
  const seed0 = +arg('--seed', 1000);
  const workers = Math.min(+arg('--workers', Math.max(1, os.cpus().length)), games);
  const results = [];
  let next = 0;
  const t0 = Date.now();
  await new Promise((resolve) => {
    let active = 0;
    const launch = () => {
      if (next >= games) { if (!active) resolve(); return; }
      const s = seed0 + next++;
      active++;
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seed: s, minutes: +arg('--minutes', 0) } });
      w.on('message', (r) => { results.push(r); process.stdout.write(`  game seed ${r.seed}: ${r.minutes.toFixed(2)} min, ${r.rounds} rounds, ${r.replays} replays, winner ${r.winner}, nudges ${r.nudges}, forced ${r.forced}, ${r.wallSec.toFixed(0)}s wall\n`); });
      w.on('exit', () => { active--; launch(); if (!active && next >= games) resolve(); });
      w.on('error', (e) => { console.error(e); process.exit(1); });
    };
    for (let i = 0; i < workers; i++) launch();
  });
  results.sort((a, b) => a.seed - b.seed);
  const mins = results.map((r) => r.minutes);
  const target = +arg('--minutes', 180), tol = target >= 120 ? 5 : Math.max(1.5, target * 0.06);
  const ok = results.filter((r) => r.minutes >= target - tol && r.minutes <= target + tol);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  console.log(`\n=== ${results.length} games in ${((Date.now() - t0) / 1000).toFixed(0)}s wall ===`);
  console.log(`duration  min ${Math.min(...mins).toFixed(2)}  mean ${(sum(mins) / mins.length).toFixed(2)}  max ${Math.max(...mins).toFixed(2)} minutes`);
  console.log(`within ${target - tol}-${target + tol} min (target ${target}): ${ok.length}/${results.length}`);
  console.log(`rounds    min ${Math.min(...results.map((r) => r.rounds))}  max ${Math.max(...results.map((r) => r.rounds))}   replays total ${sum(results.map((r) => r.replays))}`);
  console.log(`stuck     nudges ${sum(results.map((r) => r.nudges))}  forced landings ${sum(results.map((r) => r.forced))}   slowest fall ${Math.max(...results.map((r) => r.maxFall)).toFixed(1)}s   max balls on board ${Math.max(...results.map((r) => r.maxBalls))}`);
  const winners = new Map(); for (const r of results) winners.set(r.winner, (winners.get(r.winner) || 0) + 1);
  console.log(`winners   ${results.length} games, ${winners.size} different countries`);
  if (has('--verbose')) for (const r of results[0].log.rounds) console.log(JSON.stringify(r));
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(results.map(({ log, ...r }) => r), null, 1));
  const pass = ok.length === results.length && sum(results.map((r) => r.forced)) === 0;
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
} else {
  const r = await runGame(workerData.seed, { config: workerData.minutes ? { gameSeconds: workerData.minutes * 60 } : undefined });
  parentPort.postMessage(r);
}
