// Renders the YouTube thumbnails (1280x720 JPEG, well under YouTube's 2 MB limit) into docs/.
//   node tools/thumbnail.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.js';
import { startServer } from '../server.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
const srv = await startServer({ port: 8091 });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (const v of ['1', '2']) {
  await page.goto(`http://localhost:8091/src/web/thumbnail.html?v=${v}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 30000 });
  const file = path.join(ROOT, 'docs', `thumbnail-${v}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 93 });
  console.log('saved', file, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
}
await browser.close(); srv.close(); process.exit(0);
