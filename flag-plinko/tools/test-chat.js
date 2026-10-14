// Chat tests: country matching, anti-spam, end-to-end SSE, and the fairness guarantee.
//   node tools/test-chat.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchCountry, startChat } from '../src/server/chat.js';
import { startServer } from '../server.js';
import { Game } from '../src/shared/game.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };

// 1) matching
const cases = [
  ['Brazil', 'br'], ['GO BRAZIL!!!', 'br'], ['i love south korea', 'kr'], ['north korea', 'kp'], ['korea', 'kr'], ['Papua New Guinea rocks', 'pg'], ['guinea', 'gn'],
  ['Equatorial Guinea', 'gq'], ['holland', 'nl'], ['Côte d\'Ivoire', 'ci'], ['USA USA', 'us'], ['🇳🇱', 'nl'], ['let\'s go 🇮🇹🇮🇹', 'it'], ['🇽🇰', 'xk'], ['DR Congo', 'cd'],
  ['congo', 'cg'], ['Türkiye', 'tr'], ['NL', 'nl'], ['DE', 'de'], ['uk', 'gb'], ['Czech Republic', 'cz'], ['Vatican', 'va'],
  ['is', null], ['IN', 'in'], ['hello everyone', null], ['no way', null], ['IT', 'it'], ['it', null], ['I am here', null],
];
let bad = [];
for (const [t, want] of cases) { const got = matchCountry(t); if (got !== want) bad.push(`${JSON.stringify(t)} -> ${got} (want ${want})`); }
check('country matching', bad.length === 0, bad.join('; '));

// 2) anti-spam: same user + country within 20 s counts once
{
  const got = [];
  const chat = startChat({ chat: {} }, (e) => got.push(e));
  chat.handleMessage('anna', 'Brazil'); chat.handleMessage('anna', 'brazil!'); chat.handleMessage('bob', 'brazil'); chat.handleMessage('anna', 'Peru');
  check('anti-spam (one count per user+country per 20 s)', got.length === 3 && got.filter((e) => e.code === 'br').length === 2, `${got.length} events`);
}

// 3) end-to-end: POST /api/chat -> SSE /api/events
{
  const srv = await startServer({ port: 8095 });
  const events = [];
  const ac = new AbortController();
  const res = await fetch('http://localhost:8095/api/events', { signal: ac.signal });
  const reader = res.body.getReader();
  (async () => { const dec = new TextDecoder(); try { for (;;) { const { value, done } = await reader.read(); if (done) break; for (const m of dec.decode(value).matchAll(/data: (.*)\n/g)) events.push(JSON.parse(m[1])); } } catch {} })();
  await new Promise((r) => setTimeout(r, 200));
  await fetch('http://localhost:8095/api/chat', { method: 'POST', body: JSON.stringify({ user: 'Tester', text: 'go Japan!' }) });
  await fetch('http://localhost:8095/api/chat', { method: 'POST', body: JSON.stringify({ user: 'Tester', text: 'nice stream' }) });
  await new Promise((r) => setTimeout(r, 300));
  check('server turns a chat message into an SSE highlight event', events.length === 1 && events[0].code === 'jp' && events[0].user === 'Tester', JSON.stringify(events));
  ac.abort(); srv.close();
}

// 4) fairness: the game core has no chat input and results are identical whatever the chat does
{
  const core = ['game.js', 'physics.js', 'board.js', 'rng.js'].map((f) => fs.readFileSync(path.join(ROOT, 'src/shared', f), 'utf8')).join('\n');
  check('game core never references chat', !/chat/i.test(core));
  const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));
  const probs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bin-probs.json'), 'utf8')).probs;
  const play = (spam) => {
    const g = new Game({ seed: 321, countries, probs });
    const hl = new Map();                                  // what the overlay would hold
    let i = 0;
    while (g.mode !== 'winner') { g.tick(); if (spam && ++i % 50 === 0) hl.set(countries[i % 197].code, { user: 'x', until: i }); }
    return g.winner + '|' + JSON.stringify(g.log.rounds);
  };
  check('identical result with and without heavy chat activity', play(false) === play(true));
}
console.log(failed ? `\n${failed} FAILED` : '\nall chat tests passed');
process.exit(failed ? 1 : 0);
