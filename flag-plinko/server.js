// Tiny dependency-free server: static files + config + resume state + game logs + live-chat events (SSE).
//   node server.js            (PORT from config.json or env PORT)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomSeed } from './src/shared/rng.js';
import { startChat } from './src/server/chat.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

export function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
  const local = path.join(ROOT, 'config.local.json');           // secrets (stream key, API keys) live here, git-ignored
  if (fs.existsSync(local)) {
    const o = JSON.parse(fs.readFileSync(local, 'utf8'));
    for (const k of Object.keys(o)) cfg[k] = typeof o[k] === 'object' && o[k] && !Array.isArray(o[k]) ? { ...cfg[k], ...o[k] } : o[k];
  }
  return cfg;
}

export function startServer({ port, stateDir } = {}) {
  const cfg = loadConfig();
  const PORT = port ?? +(process.env.PORT || cfg.port || 8080);
  const STATE = stateDir || path.join(ROOT, 'state');
  const LOGS = path.join(ROOT, 'logs');
  fs.mkdirSync(STATE, { recursive: true }); fs.mkdirSync(LOGS, { recursive: true });
  const clients = new Set();
  const broadcast = (evt) => { const msg = `data: ${JSON.stringify(evt)}\n\n`; for (const r of clients) r.write(msg); };
  const chat = startChat(cfg, broadcast);

  // hall of fame: wins per country, persisted across games and restarts (state/wins.json)
  const WINS = path.join(STATE, 'wins.json');
  const readWins = () => { try { const j = JSON.parse(fs.readFileSync(WINS, 'utf8')); return { wins: j.wins || {}, recent: j.recent || [], games: j.games || 0 }; } catch { return { wins: {}, recent: [], games: 0 }; } };
  const withWin = (s, code) => ({ wins: { ...s.wins, [code]: (s.wins[code] || 0) + 1 }, recent: [code, ...s.recent].slice(0, 12), games: s.games + 1 });

  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => ok(b)); });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (p === '/api/config') {
        const { stream, chat: ch, ...pub } = cfg;                // never expose keys to the page
        return send(res, 200, JSON.stringify({ ...pub, chat: { enabled: !!ch.enabled, highlightSeconds: ch.highlightSeconds } }));
      }
      if (p === '/api/wins') return send(res, 200, JSON.stringify(readWins()));
      if (p === '/api/newseed') return send(res, 200, JSON.stringify({ seed: randomSeed() }));
      if (p === '/api/state' && req.method === 'GET') {
        const f = path.join(STATE, 'current.json');
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f)) : send(res, 404, '{}');
      }
      if (p === '/api/state' && req.method === 'POST') { fs.writeFileSync(path.join(STATE, 'current.json'), await readBody(req)); return send(res, 200, '{}'); }
      if (p === '/api/state' && req.method === 'DELETE') { fs.rmSync(path.join(STATE, 'current.json'), { force: true }); return send(res, 200, '{}'); }
      if (p === '/api/log' && req.method === 'POST') {
        const body = await readBody(req);
        const j = JSON.parse(body);
        fs.writeFileSync(path.join(LOGS, `game-${j.seed}-${Date.now()}.json`), JSON.stringify(j, null, 1));
        fs.rmSync(path.join(STATE, 'current.json'), { force: true });
        // official games are counted in the hall of fame; test games (?seed, ?speed, ?game ...) only get a preview of the result
        let out = {};
        if (j.winner) {
          const next = withWin(readWins(), j.winner);
          if (j.official !== false) fs.writeFileSync(WINS, JSON.stringify(next));
          out = { ...next, winner: { code: j.winner, n: next.wins[j.winner] }, counted: j.official !== false };
        }
        return send(res, 200, JSON.stringify(out));
      }
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (p === '/api/chat' && req.method === 'POST') {   // inject a chat message (tests / mock)
        const { user, text } = JSON.parse(await readBody(req));
        chat.handleMessage(user, text);
        return send(res, 200, '{}');
      }
      if (p === '/favicon.ico') return send(res, 204, '');
      // static
      let rel = decodeURIComponent(p === '/' ? '/src/web/index.html' : p);
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT) || /node_modules|config\.local|\/state\//.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
      send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    } catch (e) {
      send(res, 500, JSON.stringify({ error: String(e) }));
    }
  });
  return new Promise((ok) => server.listen(PORT, () => { console.log(`[server] http://localhost:${PORT}`); ok({ server, port: PORT, chat, close: () => { chat.stop?.(); for (const r of clients) r.end(); server.close(); } }); }));
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
