// Renders the link-preview card (public/og/artic.png). Run `pnpm og` after changing it.
// The card is laid out at 1200x630 and captured at twice that, so it stays sharp after
// LinkedIn, Slack and others recompress it.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHARE_IMAGE } from '../src/lib/seo.mjs';

const root = new URL('..', import.meta.url);
const file = (path) => fileURLToPath(new URL(path, root));
const dataUrl = (path, type) => `data:${type};base64,${readFileSync(file(path)).toString('base64')}`;

const display = dataUrl('node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', 'font/woff2');
const body = dataUrl('node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2', 'font/woff2');
const logo = dataUrl('scripts/og/logo.png', 'image/png');

// The background matches the navy behind the wolf, so the logo has no visible edge.
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: display; src: url(${display}); }
@font-face { font-family: body; src: url(${body}); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #142636; color: #e3eef6; }
.card { position: relative; box-sizing: border-box; height: 630px; padding: 84px 96px;
  display: flex; flex-direction: column; justify-content: center; }
.card::before { content: ''; position: absolute; right: -140px; top: 50%; width: 760px; height: 760px;
  transform: translateY(-50%); background: radial-gradient(closest-side, rgb(108 195 192 / 0.16), transparent); }
.row { position: relative; display: flex; align-items: center; gap: 28px; }
img { width: 132px; height: 132px; }
h1 { margin: 0; font: 700 128px/1 display; letter-spacing: -0.01em; }
p { position: relative; margin: 40px 0 0; max-width: 820px; font: 400 40px/1.3 body; color: #8aa3b8; }
p b { font-weight: 400; color: #e3eef6; }
.url { position: absolute; left: 96px; bottom: 64px; font: 400 26px body; color: #6cc3c0; }
</style>
<div class="card">
  <div class="row"><img src="${logo}" alt=""><h1>artic</h1></div>
  <p><b>Views in XAML, logic in Rust.</b> One GPU renderer draws the same pixels on every platform.</p>
  <div class="url">artic.rs</div>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
await page.screenshot({ path: file(`public${SHARE_IMAGE}`) });
await browser.close();
console.log(`wrote public${SHARE_IMAGE}`);
