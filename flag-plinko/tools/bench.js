// Frame-rate check: 200 balls on screen at once (constantly refilled), measured in the real page.
//   node tools/bench.js [balls=200] [seconds=12] [--headed]
import { launch } from './browser.js';
import { startServer } from '../server.js';

const balls = +(process.argv[2] || 200);
const secs = +(process.argv[3] || 12);
const srv = await startServer({ port: 8097 });
const browser = await launch({ headless: !process.argv.includes('--headed') });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:8097/?bench=${balls}&mute=1&seed=5`);
await page.waitForFunction(() => window.__ready);
await page.waitForTimeout(3000);                    // warm-up
await page.evaluate(() => { window.__bench.frames = []; window.__bench.work = []; });
await page.waitForTimeout(secs * 1000);
const r = await page.evaluate(() => {
  const f = window.__bench.frames.slice(5).sort((a, b) => a - b);
  const sum = f.reduce((a, b) => a + b, 0);
  return { n: f.length, avgMs: sum / f.length, p50: f[Math.floor(f.length * 0.5)], p95: f[Math.floor(f.length * 0.95)], p99: f[Math.floor(f.length * 0.99)], worst: f[f.length - 1], work: window.__bench.work.reduce((a, b) => a + b, 0) / window.__bench.work.length, workMax: Math.max(...window.__bench.work), on: window.__game.world.balls.length };
});
console.log(`balls on screen: ${r.on}`);
console.log(`frames ${r.n}  avg ${r.avgMs.toFixed(2)} ms (${(1000 / r.avgMs).toFixed(1)} fps)  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  p99 ${r.p99.toFixed(1)}  worst ${r.worst.toFixed(1)} ms`);
console.log(`CPU per frame (simulation + draw): avg ${r.work.toFixed(2)} ms, worst ${r.workMax.toFixed(1)} ms  (budget at 60 fps: 16.7 ms)`);
await browser.close(); srv.close();
process.exit(0);
