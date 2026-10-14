// Live-chat integration (server side).
//  - matchCountry(text): finds which country a chat message is about (names, aliases, flag emoji, ISO code alone)
//  - startChat(cfg, broadcast): YouTube Live Chat poller (optional) + handleMessage() used by the poller and by tests
// FAIRNESS: chat events are only broadcast to the overlay (highlight + "most supported" counter).
// The game core (src/shared) has no chat input at all, so chat can never influence a result.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();

const phraseMap = new Map();     // normalized name/alias -> code
const codeSet = new Set(countries.map((c) => c.code));
for (const c of countries) {
  phraseMap.set(norm(c.name), c.code);
  for (const a of c.aliases) phraseMap.set(norm(a), c.code);
}
const maxWords = Math.max(...[...phraseMap.keys()].map((k) => k.split(' ').length));
// two-letter codes that are ordinary words: only accepted as an UPPERCASE message of their own, never lower case
const AMBIGUOUS = new Set(['is', 'in', 'no', 'it', 'to', 'me', 'do', 'my', 'so', 'at', 'as', 'be', 'he', 'we', 'by', 'id', 'la', 'am', 'ga', 'st', 'ma', 'pa']);

function emojiFlagCodes(text) {
  const out = [];
  const cps = [...text].map((ch) => ch.codePointAt(0));
  for (let i = 0; i < cps.length - 1; i++) {
    const a = cps[i], b = cps[i + 1];
    if (a >= 0x1f1e6 && a <= 0x1f1ff && b >= 0x1f1e6 && b <= 0x1f1ff) {
      out.push(String.fromCharCode(a - 0x1f1e6 + 97, b - 0x1f1e6 + 97));
      i++;
    }
  }
  return out;
}

/** @returns {string|null} country code */
export function matchCountry(raw) {
  if (!raw) return null;
  for (const code of emojiFlagCodes(raw)) if (codeSet.has(code)) return code;
  const text = norm(raw);
  if (!text) return null;
  // longest phrase wins ("north korea" before "korea", "papua new guinea" before "guinea")
  const words = text.split(' ');
  for (let n = Math.min(maxWords, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const hit = phraseMap.get(words.slice(i, i + n).join(' '));
      if (hit) return hit;
    }
  }
  // bare ISO code: the whole message is exactly the two letters
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const c = trimmed.toLowerCase();
    if (codeSet.has(c) && (!AMBIGUOUS.has(c) || trimmed === trimmed.toUpperCase())) return c;
  }
  return null;
}

export function startChat(cfg, broadcast) {
  const lastByUser = new Map();           // anti-spam: one count per user per country per 20 s
  const state = { stopped: false };

  function handleMessage(user, text) {
    const code = matchCountry(text);
    if (!code) return null;
    const now = Date.now();
    const key = `${user}|${code}`;
    if (now - (lastByUser.get(key) || 0) < 20000) return null;
    lastByUser.set(key, now);
    if (lastByUser.size > 5000) for (const [k, t] of lastByUser) if (now - t > 60000) lastByUser.delete(k);
    const evt = { type: 'chat', code, user: String(user).slice(0, 24), ts: now };
    broadcast(evt);
    return evt;
  }

  const c = cfg.chat || {};
  if (c.enabled && (c.apiKey || c.oauthToken) && (c.videoId || c.liveChatId)) pollYouTube(c, handleMessage, state).catch((e) => console.error('[chat] stopped:', e.message));
  else if (c.enabled) console.warn('[chat] enabled but apiKey/oauthToken and videoId/liveChatId are not configured; chat will only accept /api/chat injections');

  return { handleMessage, stop: () => { state.stopped = true; } };
}

// ---------------------------------------------------------------- YouTube Live Chat (REST, no SDK)
// Quota note: liveChatMessages.list costs ~5 units per call and the default project quota is 10,000 units/day.
// Polling every 10 s for 3 h = 1,080 calls = 5,400 units. Several streams a day need a quota extension.
async function pollYouTube(c, onMsg, state) {
  const API = 'https://www.googleapis.com/youtube/v3';
  const auth = c.oauthToken ? { headers: { Authorization: `Bearer ${c.oauthToken}` }, q: '' } : { headers: {}, q: `&key=${encodeURIComponent(c.apiKey)}` };
  const get = async (url) => {
    const r = await fetch(url + auth.q, { headers: auth.headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(`YouTube API ${r.status}: ${j.error?.message || ''}`); err.status = r.status; err.reason = j.error?.errors?.[0]?.reason; throw err; }
    return j;
  };
  let liveChatId = c.liveChatId;
  while (!liveChatId && !state.stopped) {
    try {
      const j = await get(`${API}/videos?part=liveStreamingDetails&id=${encodeURIComponent(c.videoId)}`);
      liveChatId = j.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) throw new Error('no activeLiveChatId yet (is the stream live?)');
    } catch (e) { console.warn('[chat]', e.message, '- retrying in 30 s'); await new Promise((r) => setTimeout(r, 30000)); }
  }
  let pageToken = '';
  let first = true;
  while (!state.stopped) {
    let wait = Math.max(10000, c.pollMinMs || 10000);
    try {
      const j = await get(`${API}/liveChat/messages?liveChatId=${encodeURIComponent(liveChatId)}&part=snippet,authorDetails&maxResults=200${pageToken ? `&pageToken=${pageToken}` : ''}`);
      pageToken = j.nextPageToken || pageToken;
      if (!first) for (const it of j.items || []) onMsg(it.authorDetails?.displayName || 'viewer', it.snippet?.displayMessage || '');
      first = false;                      // ignore the backlog that existed when we connected
      wait = Math.max(wait, j.pollingIntervalMillis || 0);
    } catch (e) {
      console.warn('[chat]', e.message);
      if (e.status === 403 && /quota|rateLimit/i.test(e.reason || '')) wait = 5 * 60000;
      else if (e.status === 403 || e.status === 404) { console.warn('[chat] chat ended or not accessible'); return; }
      else wait = 30000;
    }
    await new Promise((r) => setTimeout(r, wait));
  }
}
