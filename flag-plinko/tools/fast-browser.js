// Fast mode in the REAL page: ?speed=50 simulates a whole 3 h game in the browser and prints the summary.
//   node tools/fast-browser.js [seed=1] [speed=50] [gameMinutes]
import { launch } from './browser.js';
import { startServer } from '../server.js';

const seed = process.argv[2] || 1, speed = process.argv[3] || 50, game = process.argv[4];   // optional 3rd arg: game length in minutes
const srv = await startServer({ port: 8094 });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
// the page reloads for the next game within a fraction of a second at speed=50, so catch the console message instead of polling
const summary = new Promise((ok) => page.on('console', (m) => { if (m.text().startsWith('[summary]')) ok(JSON.parse(m.text().slice(10))); }));
const t0 = Date.now();
await page.goto(`http://localhost:8094/?seed=${seed}&speed=${speed}&mute=1&cooldown=5&winner=5${game ? '&game=' + game : ''}`);
const r = await Promise.race([summary, new Promise((_, no) => setTimeout(() => no(new Error('timeout after 15 min')), 15 * 60 * 1000))]);
console.log(`game (${r.minutes} min of stream time) simulated in ${((Date.now() - t0) / 1000).toFixed(1)} s of wall time at speed=${speed}`);
console.log(`rounds ${r.rounds}, replays ${r.replays}, winner ${r.winner}, nudges ${r.nudges}, forced landings ${r.forced}`);
await browser.close(); srv.close(); process.exit(0);
