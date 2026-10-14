// Downloads every flag ONCE into assets/flags/{code}.png (the game never touches the network at runtime).
//
//   node tools/fetch-flags.js                 # default: flagcdn.com  (w160 PNGs)
//   node tools/fetch-flags.js --source npm    # offline fallback: renders the `flag-icons` npm SVGs with sharp
//
// Flags are kept at their native 4:3 ratio; the renderer cover-crops them into round balls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/flags');
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/countries.json'), 'utf8'));
const source = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : 'flagcdn';
const force = process.argv.includes('--force');
const W = 160, H = 120;

fs.mkdirSync(OUT, { recursive: true });

async function fromFlagcdn(code) {
  const res = await fetch(`https://flagcdn.com/w${W}/${code}.png`);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fromNpm(code) {
  const sharp = (await import('sharp')).default;
  const svg = fs.readFileSync(path.join(ROOT, 'node_modules/flag-icons/flags/4x3', `${code}.svg`));
  return sharp(svg, { density: 300 }).resize(W, H, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();
}

let ok = 0, skipped = 0;
const failed = [];
for (const c of countries) {
  const file = path.join(OUT, `${c.code}.png`);
  if (!force && fs.existsSync(file) && fs.statSync(file).size > 200) { skipped++; continue; }
  try {
    fs.writeFileSync(file, source === 'npm' ? await fromNpm(c.code) : await fromFlagcdn(c.code));
    ok++;
  } catch (e) {
    failed.push(`${c.code} (${e.message})`);
  }
}
console.log(`flags: ${ok} downloaded (${source}), ${skipped} already present, ${failed.length} failed`);
if (failed.length) {
  console.log('failed:', failed.slice(0, 5).join(', '), failed.length > 5 ? `... (+${failed.length - 5} more)` : '');
  console.log('Tip: retry with --source npm if flagcdn is blocked on this machine.');
  process.exit(1);
}
