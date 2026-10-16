// Hall-of-fame test: wins are counted per country, persisted, and test games are only previewed.
//   node tools/test-wins.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';

let failed = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-wins-'));
const srv = await startServer({ port: 8097, stateDir: dir });
let base = 'http://localhost:8097';
const post = (body) => fetch(base + '/api/log', { method: 'POST', body: JSON.stringify({ seed: 1, ...body }) }).then((r) => r.json());
const get = () => fetch(base + '/api/wins').then((r) => r.json());

check('empty at start', (await get()).games === 0);
let r = await post({ winner: 'ye', official: true });
check('first win counted', r.winner.n === 1 && r.counted === true);
await post({ winner: 'jp', official: true });
r = await post({ winner: 'ye', official: true });
check('second win for the same country', r.winner.n === 2, JSON.stringify(r.wins));
r = await post({ winner: 'ye', official: false });
check('test game previews #3 but is not saved', r.winner.n === 3 && r.counted === false && (await get()).wins.ye === 2);
const h = await get();
check('recent winners newest first', h.recent.join() === 'ye,jp,ye' && h.games === 3, h.recent.join());
srv.close();
const srv2 = await startServer({ port: 8096, stateDir: dir });
base = 'http://localhost:8096';
check('persisted after a restart', (await get()).wins.ye === 2);
srv2.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(failed ? `${failed} FAILED` : 'wins tests passed');
process.exit(failed ? 1 : 0);
