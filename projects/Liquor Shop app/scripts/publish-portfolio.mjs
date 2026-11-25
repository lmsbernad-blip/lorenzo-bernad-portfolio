// Copy the static shop into the portfolio site so GitHub Pages serves it at
// https://lmsbernad-blip.github.io/lorenzo-bernad-portfolio/sip-twice/
// Usage: npm run publish:portfolio
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(app, '../../public/sip-twice');

if (!existsSync(resolve(app, '../../astro.config.mjs'))) {
  throw new Error('Expected the portfolio (astro.config.mjs) two folders up from this app.');
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const item of ['index.html', 'favicon.svg', 'css', 'js', 'data', 'images']) {
  if (existsSync(resolve(app, item))) cpSync(resolve(app, item), resolve(target, item), { recursive: true });
}
for (const f of ['EXPECTED.txt', 'REJECTED.txt', 'CREDITS.json']) rmSync(resolve(target, 'images', f), { force: true });
console.log(`Shop copied to ${target}`);
