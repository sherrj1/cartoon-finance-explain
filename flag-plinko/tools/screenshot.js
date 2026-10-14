// Layout check: renders the real page at 1080x1920 in headless Chrome and saves screenshots of every screen.
//   node tools/screenshot.js [outdir]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.js';
import { startServer } from '../server.js';

const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 8099 });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8099/?seed=123&mute=1&game=60&intro=40&winner=60&cooldown=120');
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('saved', name); };
const ff = (cond) => page.evaluate(`window.__ff(${cond})`);

await ff('(g)=>g.T>=22'); await shot('01-intro');
await ff("(g)=>g.mode==='banner'&&g.roundNo===1"); await ff('(g)=>g.T>=g.round.startT+4'); await shot('02-banner');
await ff("(g)=>g.mode==='drop'&&g.round.landed>=25&&g.T>g.round.bannerEnd+40"); await shot('03-drop-round1');
await ff("(g)=>g.mode==='results'&&g.roundNo===3"); await ff('(g)=>g.T>=g.modeEnd-12'); await shot('04-results');
await ff("(g)=>g.mode==='drop'&&g.roundNo===8&&g.round.landed>=3"); await shot('05-drop-small-round');
await ff("(g)=>g.inFinale&&g.mode==='drop'&&g.round.landed>=6"); await shot('06-finale');
await ff("(g)=>g.mode==='winner'"); await ff('(g)=>g.T>=g.modeEnd-25'); await shot('07-winner');
console.log('page errors:', errors.length ? errors : 'none');
await browser.close(); srv.close();
process.exit(errors.length ? 1 : 0);
