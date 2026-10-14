// Finds a Chrome/Chromium binary for playwright-core (no browser download needed).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

export function findChrome(hint) {
  const cands = [hint, process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).sort().reverse()) {
    if (/^chromium-\d+$/.test(d)) cands.push(path.join(pw, d, 'chrome-linux/chrome'), path.join(pw, d, 'chrome-win/chrome.exe'), path.join(pw, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'));
  }
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  try { return chromium.executablePath(); } catch { return null; }
}

export async function launch(opts = {}) {
  const exe = findChrome(opts.exe);
  if (!exe) throw new Error('No Chrome found. Set CHROME_PATH or config.stream.chrome');
  return chromium.launch({ executablePath: exe, headless: opts.headless ?? true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--hide-scrollbars', ...(opts.args || [])] });
}
