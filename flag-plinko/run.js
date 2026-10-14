// Headless streaming: server + Xvfb + Chrome (kiosk) + PulseAudio null sink + ffmpeg -> YouTube RTMP.
//
//   node run.js                              stream forever (new game every ~3 h 5 min), auto-restart on crash
//   node run.js --output out.mp4 --duration 60 --game 5 --intro 5      local test recording instead of RTMP
//   node run.js --once                       stream exactly one game, then stop (used with config.stream.schedule)
//
// Needs: node 20+, ffmpeg (libx264, x11grab, pulse), Xvfb, pulseaudio, chromium/chrome.
//   sudo apt install ffmpeg xvfb pulseaudio chromium && npm install
// Stream key + API keys go in config.local.json (git-ignored), see README.md.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { findChrome } from './tools/browser.js';
import { startServer, loadConfig } from './server.js';

const argv = process.argv.slice(2);
const arg = (k, d = null) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);
const cfg = loadConfig();
const S = { ...(cfg.stream || {}) };
if (process.argv.includes('--fps')) S.fps = +process.argv[process.argv.indexOf('--fps') + 1];
const DISPLAY = process.env.FP_DISPLAY || ':99';
const SINK = 'flagplinko';
const W = 1080, H = 1920;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[run]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const procs = new Set();
let stopping = false;
function keep(p, name) { procs.add(p); p.on('exit', (c, s) => { procs.delete(p); if (!stopping) log(`${name} exited (${c ?? s})`); }); return p; }
function killAll() { stopping = true; for (const p of procs) { try { p.kill('SIGTERM'); } catch {} } }
process.on('SIGINT', () => { killAll(); setTimeout(() => process.exit(0), 1500); });
process.on('SIGTERM', () => { killAll(); setTimeout(() => process.exit(0), 1500); });

// ------------------------------------------------------------------ system pieces
async function ensureXvfb() {
  const sock = `/tmp/.X11-unix/X${DISPLAY.replace(':', '')}`;
  if (fs.existsSync(sock)) return;
  log(`starting Xvfb ${DISPLAY} ${W}x${H}`);
  keep(spawn('Xvfb', [DISPLAY, '-screen', '0', `${W}x${H}x24`, '-ac', '-nolisten', 'tcp'], { stdio: 'ignore' }), 'Xvfb');
  for (let i = 0; i < 50 && !fs.existsSync(sock); i++) await sleep(100);
  if (!fs.existsSync(sock)) throw new Error('Xvfb did not start');
}

function pactl(...a) { return spawnSync('pactl', a, { encoding: 'utf8' }); }
async function ensurePulse() {
  if (S.audio !== 'pulse') return;
  if (pactl('info').status !== 0) {
    log('starting pulseaudio');
    spawnSync('pulseaudio', ['--start', '--exit-idle-time=-1'], { stdio: 'ignore' });
    for (let i = 0; i < 30 && pactl('info').status !== 0; i++) await sleep(200);
  }
  if (!pactl('list', 'short', 'sinks').stdout.includes(SINK)) {
    const r = pactl('load-module', 'module-null-sink', `sink_name=${SINK}`, 'sink_properties=device.description=FlagPlinko');
    if (r.status !== 0) throw new Error('could not create the PulseAudio null sink: ' + r.stderr);
  }
}

function ffmpegArgs(outputFile, duration) {
  const a = ['-hide_banner', '-loglevel', 'warning', '-nostdin',
    '-thread_queue_size', '512', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', String(S.fps || 60), '-video_size', `${W}x${H}`, '-i', `${DISPLAY}.0+0,0`];
  if (S.audio === 'pulse') a.push('-thread_queue_size', '512', '-f', 'pulse', '-i', `${SINK}.monitor`);
  else if (typeof S.audio === 'string' && S.audio.startsWith('file:')) a.push('-stream_loop', '-1', '-i', S.audio.slice(5));
  else a.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  const br = S.videoBitrate || '6000k';
  a.push('-map', '0:v', '-map', '1:a', '-c:v', S.encoder || 'libx264', ...(S.encoder && S.encoder !== 'libx264' ? [] : ['-preset', S.preset || 'veryfast', '-tune', 'zerolatency']), '-pix_fmt', 'yuv420p',
    '-r', String(S.fps || 60), '-g', String((S.fps || 60) * 2), '-keyint_min', String((S.fps || 60) * 2), '-sc_threshold', '0',
    '-b:v', br, '-maxrate', br, '-bufsize', `${parseInt(br) * 2}k`, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-af', 'aresample=async=1');
  if (outputFile) { if (duration) a.push('-t', String(duration)); a.push('-movflags', '+faststart', '-y', outputFile); }
  else {
    if (!S.streamKey) throw new Error('config.stream.streamKey is empty (put it in config.local.json) - or use --output file.mp4 for a local test');
    a.push('-f', 'flv', `${S.rtmpUrl.replace(/\/$/, '')}/${S.streamKey}`);
  }
  return a;
}

// ------------------------------------------------------------------ one streaming session
async function pipeline({ resume, once, port, outputFile, duration, query }) {
  await ensureXvfb();
  await ensurePulse();
  const exe = findChrome(S.chrome);
  if (!exe) throw new Error('No Chrome found: set CHROME_PATH or config.stream.chrome');
  const qs = new URLSearchParams(query);
  if (resume) qs.set('resume', '1');
  if (once) qs.set('once', '1');
  const url = `http://localhost:${port}/?${qs}`;
  log('starting Chrome', exe);
  // Chrome is started directly in --app mode (no tabs / address bar in the capture) and Playwright attaches over CDP
  const profile = '/tmp/flagplinko-chrome-profile';
  fs.rmSync(profile, { recursive: true, force: true });
  const CDP = +(process.env.FP_CDP || 9333);
  const chrome = keep(spawn(exe, [...(process.getuid?.() === 0 ? ['--no-sandbox', '--test-type'] : ['--test-type']), `--app=${url}`, `--window-size=${W},${H}`, '--window-position=0,0', '--force-device-scale-factor=1',
    '--autoplay-policy=no-user-gesture-required', '--noerrdialogs', '--disable-infobars', '--disable-session-crash-bubble', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-translate', '--disable-features=Translate,MediaRouter', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`],
    { stdio: 'ignore', env: { ...process.env, DISPLAY, PULSE_SINK: SINK, GOOGLE_API_KEY: 'no', GOOGLE_DEFAULT_CLIENT_ID: 'no', GOOGLE_DEFAULT_CLIENT_SECRET: 'no' } }), 'chrome');
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`); } catch {}
  }
  if (!browser) throw new Error('could not attach to Chrome over CDP');
  let dead = null;
  browser.on('disconnected', () => { dead = dead || 'chrome disconnected'; });
  chrome.on('exit', () => { dead = dead || 'chrome exited'; });
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || (await ctx.waitForEvent('page'));
  page.on('crash', () => { dead = dead || 'page crashed'; });
  page.on('pageerror', (e) => log('page error:', e.message));
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  log('page ready:', url);
  await sleep(1500);

  const ff = keep(spawn('ffmpeg', ffmpegArgs(outputFile, duration), { stdio: ['ignore', 'inherit', 'inherit'] }), 'ffmpeg');
  ff.on('exit', (c) => { dead = dead || `ffmpeg exited (${c})`; });
  log(outputFile ? `recording to ${outputFile}` : 'streaming to YouTube');

  let lastT = -1, lastMove = Date.now(), finished = false;
  try {
    while (!dead && !stopping) {
      await sleep(5000);
      if (outputFile && ff.exitCode !== null) { finished = true; break; }
      const s = await page.evaluate(() => ({ T: window.__game?.T ?? -1, mode: window.__game?.mode, fin: !!window.__finished, round: window.__game?.roundNo, alive: window.__game?.alive?.length, fps: window.__fps })).catch(() => null);
      if (!s) { dead = 'page not responding'; break; }
      if (s.T !== lastT) { lastT = s.T; lastMove = Date.now(); }
      else if (Date.now() - lastMove > 45000) { dead = `game clock stalled at ${s.T.toFixed(0)}s`; break; }
      if (Math.floor(s.T) % 60 < 5) log(`T ${(s.T / 60).toFixed(1)} min  round ${s.round}  flags ${s.alive}  mode ${s.mode}  fps ${s.fps?.toFixed(0)}`);
      if (s.fin) { finished = true; break; }
    }
  } finally {
    try { ff.kill('SIGINT'); } catch {}
    await sleep(1500);
    await browser.close().catch(() => {});
    try { chrome.kill('SIGTERM'); } catch {}
  }
  if (finished) return 'finished';
  throw new Error(dead || 'stopped');
}

// ------------------------------------------------------------------ scheduling
function msUntil(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(); t.setHours(h, m, 0, 0);
  if (t.getTime() <= Date.now() + 1000) t.setDate(t.getDate() + 1);
  return t.getTime() - Date.now();
}

async function main() {
  const srv = await startServer({});
  const outputFile = arg('--output', S.output);
  const duration = arg('--duration') ? +arg('--duration') : null;
  const query = {};
  for (const k of ['game', 'intro', 'winner', 'cooldown', 'seed', 'chat']) if (arg('--' + k) != null) query[k] = arg('--' + k);
  const common = { port: srv.port, outputFile, duration, query };
  const schedule = (S.schedule || []).filter(Boolean);

  if (outputFile) { await pipeline({ ...common, resume: false, once: flag('--once') }); killAll(); srv.close(); return; }

  let failures = 0;
  while (!stopping) {
    if (schedule.length) {
      const wait = Math.min(...schedule.map(msUntil));
      log(`next scheduled game in ${(wait / 60000).toFixed(0)} min`);
      await sleep(wait);
    }
    let resume = !schedule.length && fs.existsSync('state/current.json') && failures > 0;
    try {
      await pipeline({ ...common, resume, once: !!schedule.length || flag('--once') });
      failures = 0;
      if (flag('--once')) break;
    } catch (e) {
      failures++;
      const wait = Math.min(60, 2 ** Math.min(failures, 6));
      log(`pipeline failed: ${e.message} - restarting in ${wait}s (resume from the last saved round)`);
      for (const p of procs) { try { p.kill('SIGTERM'); } catch {} }
      await sleep(wait * 1000);
    }
  }
  killAll(); srv.close();
}

main().catch((e) => { console.error(e); killAll(); process.exit(1); });
