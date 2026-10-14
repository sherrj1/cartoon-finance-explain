// Sends fake chat messages to a running server so you can see the highlights without a live stream.
//   node tools/mock-chat.js [port=8080] [messagesPerSecond=2]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));
const port = process.argv[2] || 8080, rate = +(process.argv[3] || 2);
const users = ['Anna', 'Jeroen', 'Maria', 'Luca', 'Sven', 'Aiko', 'Omar', 'Chloe', 'Tariq', 'Zoe'];
const phrases = ['go {c}!', '{c} 🔥', 'come on {c}', '{c}', 'I pick {c}', '{c} will win'];
setInterval(() => {
  const c = countries[Math.floor(Math.random() * countries.length)].name;
  const text = phrases[Math.floor(Math.random() * phrases.length)].replace('{c}', c);
  fetch(`http://localhost:${port}/api/chat`, { method: 'POST', body: JSON.stringify({ user: users[Math.floor(Math.random() * users.length)], text }) }).catch(() => {});
}, 1000 / rate);
console.log(`sending ~${rate} fake chat messages/s to :${port} (Ctrl+C to stop)`);
