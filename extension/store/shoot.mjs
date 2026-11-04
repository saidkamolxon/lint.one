#!/usr/bin/env node
/* Draws the Chrome Web Store images into extension/store/:

     screenshot-1..5.png   1280×800, what the store shows on the listing
     promo-small.png       440×280, the small promo tile
     promo-marquee.png     1400×560, the marquee (used if the store features it)

   Run from the repository root, after both builds:

     npm run build && npm run dev:extension && node extension/store/shoot.mjs

   The site is served from site/dist by a small server of its own (on
   localhost:8787, where the dev extension looks), the tools load their own
   samples, the popup and the in-page viewer are photographed from a copy
   of the dev extension that already holds its optional permissions (a
   headless browser cannot answer Chrome's prompt), and each image is laid
   out as HTML in the site's font. Nothing is deployed; upload the PNGs in
   the developer dashboard. */

import { createServer } from 'node:http';
import { readFile, writeFile, stat, cp, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(dirname(here));
const SITE = join(root, 'site', 'dist');
const EXT = join(root, 'extension', 'dist');
const PORT = 8787;
const BASE = `http://localhost:${PORT}`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.json': 'application/json', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };

/* an API response, for the in-page viewer */
const ORDERS = {
  page: 1, perPage: 20, total: 248,
  next: 'https://api.shop.example/v2/orders?page=2',
  orders: [
    { id: 1042, status: 'paid', placedAt: '2026-03-14T09:31:07Z', total: 217,
      customer: { id: 7, name: 'Dilnoza', city: 'Tashkent', email: 'dilnoza@example.com' },
      items: [{ sku: 'KB-75', title: 'Keyboard', qty: 1, price: 119 }, { sku: 'MS-02', title: 'Mouse', qty: 2, price: 49 }],
      shipping: { method: 'courier', eta: '2026-03-16', tracking: null } },
    ...[1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1051, 1052, 1053].map((id, i) => ({
      id, status: ['pending', 'paid', 'refunded'][i % 3], placedAt: '2026-03-14T1' + (i % 10) + ':0' + (i % 6) + ':00Z',
      total: [58, 412.5, 99, 1260, 35.9, 640, 77, 189.99, 320, 45, 980][i],
      customer: { id: 20 + i, name: ['Aziz', 'Malika', 'Jasur', 'Nodira', 'Timur', 'Sevara', 'Bekzod', 'Lola', 'Rustam', 'Kamola', 'Otabek'][i], city: ['Samarkand', 'Bukhara', 'Khiva', 'Tashkent'][i % 4] },
      items: [{ sku: 'KB-75', qty: 1 }], shipping: { method: 'pickup' } }))
  ]
};

/* site/dist as it is deployed: a folder answers with its index.html, and
   /extension/store/ serves the shots taken so far to the layout page */
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, BASE).pathname);
  if (path === '/sample/orders.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(ORDERS));
    return;
  }
  let file = path.startsWith('/extension/store/') ? join(root, path) : join(SITE, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(PORT, r));

/* screenshots 3–5: the tool, its hue, and the two lines above it */
const SHOTS = [
  { tool: 'json', hue: '#4F46E5', title: 'Then the whole tool, one click away',
    sub: 'Search, compare two documents, convert to YAML or CSV, errors pinned to the line.' },
  { tool: 'har', hue: '#475569', title: 'Find the failed and slow requests in a HAR',
    sub: 'Then save a copy without cookies, tokens and passwords, safe to send.' },
  { tool: 'env', hue: '#A32972', title: 'See which .env lines break your app',
    sub: 'How Node, Python, Compose, docker run and the shell each read it, with one-click fixes.' }
];
const SUITE = [
  ['json', '#4F46E5'], ['yaml', '#B45309'], ['csv', '#4D7C0F'], ['env', '#A32972'],
  ['log', '#0369A1'], ['har', '#475569'], ['xml', '#0F766E'], ['cert', '#4ADE80'],
  ['sqlite', '#7C3AED'], ['pdf', '#BE123C'], ['parquet', '#F7CE46'], ['audio', '#C026D3']
];

/* the dev build, with what Chrome would have asked for already granted */
const SHOT_EXT = await mkdtemp(join(tmpdir(), 'lintone-shoot-'));
await cp(EXT, SHOT_EXT, { recursive: true });
const mf = JSON.parse(await readFile(join(SHOT_EXT, 'manifest.json'), 'utf8'));
mf.host_permissions = ['http://*/*', 'https://*/*'];
mf.permissions.push('clipboardRead', 'clipboardWrite');
await writeFile(join(SHOT_EXT, 'manifest.json'), JSON.stringify(mf));

const ctx = await chromium.launchPersistentContext('', {
  headless: false, viewport: { width: 1280, height: 800 }, colorScheme: 'light',
  args: ['--headless=new', `--disable-extensions-except=${SHOT_EXT}`, `--load-extension=${SHOT_EXT}`]
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
await sw.evaluate(() => chrome.storage.local.set({ pageMode: 'view', clipboard: true, tipClipboard: 'on' }));
await new Promise((r) => setTimeout(r, 800));
for (const p of ctx.pages()) if (p.url().includes('welcome.html')) await p.close();

/* 1. the tools, each with its own sample */
const page = await ctx.newPage();
for (const s of SHOTS) {
  await page.goto(`${BASE}/${s.tool}/`);
  await page.waitForTimeout(800);
  const sample = page.locator('button:visible', { hasText: /sample/i }).first();
  if (await sample.count()) await sample.click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(here, `raw-${s.tool}.png`) });
}

/* 2. the in-page viewer, with a branch or two open */
const api = await ctx.newPage();
await api.goto(`${BASE}/sample/orders.json`);
await api.waitForTimeout(1000);
await api.locator('#lintone-view .tw', { hasText: '▸' }).nth(1).click();
await api.mouse.move(300, 330);
await api.waitForTimeout(300);
await api.screenshot({ path: join(here, 'raw-viewer.png') });

/* 3. the popup, with something just copied: a manifest a person might
   copy from a pull request */
await api.evaluate(() => navigator.clipboard.writeText(
  'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: checkout-api\nspec:\n  replicas: 3\n'));
await sw.evaluate(() => chrome.storage.session.set({ recents: [
  { id: 'a', name: 'orders.json', tool: 'json', size: 48211, at: Date.now() - 6 * 60000, stored: true },
  { id: 'b', name: 'staging.env', tool: 'env', size: 1290, at: Date.now() - 31 * 60000, stored: true },
  { id: 'c', name: 'checkout-api.log', tool: 'log', size: 2.4e6, at: Date.now() - 2 * 3600000, stored: true }
] }));
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 372, height: 700 });
await pop.goto(`chrome-extension://${id}/popup.html`);
await pop.waitForTimeout(1000);
await pop.setViewportSize({ width: 372, height: await pop.evaluate(() => document.body.scrollHeight) });
await pop.waitForTimeout(300);
await pop.screenshot({ path: join(here, 'raw-popup.png') });
await pop.close();

/* 4. the layouts */
const CSS = `
  @font-face { font-family: Plex; src: url(${BASE}/shared/fonts/plex-sans-var.woff2); font-weight: 100 700; }
  @font-face { font-family: Mono; src: url(${BASE}/shared/fonts/jetbrains-mono-var.woff2); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Plex, sans-serif; color: #1A1D23; background: #F3F4F6; overflow: hidden; }
  .tile { display: inline-block; border-radius: 22%; background: var(--hue); position: relative; }
  .tile::after { content: ''; position: absolute; inset: 18%; background: var(--ink, #fff);
    -webkit-mask: var(--glyph) center / contain no-repeat; }
  .mark { display: inline-block; border-radius: 22%; background: #1A1D23; position: relative; }
  .mark::after { content: ''; position: absolute; inset: 14%; background: #fff;
    -webkit-mask: url(${BASE}/shared/glyph.svg) center / contain no-repeat; }
`;
const tile = (t, hue, size) =>
  `<span class="tile" style="--hue:${hue};--glyph:url(${BASE}/shared/glyphs/${t}.svg);` +
  `${hue === '#F7CE46' || hue === '#4ADE80' ? '--ink:#1A1D23;' : ''}width:${size}px;height:${size}px"></span>`;

async function draw(name, w, hgt, html) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: hgt });
  await p.goto(`${BASE}/`); // same origin as the fonts and shots
  await p.setContent(`<!doctype html><html><head><base href="${BASE}/"><style>${CSS}</style></head><body>${html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(here, name) });
  await p.close();
}

const caption = (title, sub) => `
  <div style="position:absolute;left:64px;right:64px;top:40px">
    <div style="font-size:34px;font-weight:600;letter-spacing:-0.01em">${title}</div>
    <div style="font-size:19px;color:#5F6672;margin-top:6px">${sub}</div>
  </div>`;

/* a browser window around a shot, its address bar saying where it is */
const browser = (url, inner, h) => `
  <div style="position:absolute;left:64px;top:160px;width:1152px;height:${h}px;border-radius:12px;background:#fff;
       box-shadow:0 10px 40px #0002;overflow:hidden">
    <div style="height:44px;background:#E8EAED;display:flex;align-items:center;gap:8px;padding:0 16px">
      <span style="width:12px;height:12px;border-radius:50%;background:#F87171"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#FBBF24"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#34D399"></span>
      <span style="margin-left:16px;flex:1;height:28px;border-radius:14px;background:#fff;font-size:14px;
            line-height:28px;padding-left:14px;color:#5F6672">${url}</span>
      <span class="mark" style="width:24px;height:24px;margin-left:8px"></span>
    </div>
    ${inner}
  </div>`;

/* screenshot 1: the popup, offering what was just copied */
await draw('screenshot-1.png', 1280, 800, `
  ${caption('Copy it, click once, read it', 'The popup offers what you just copied, the page you are on, and what you opened lately.')}
  ${browser('github.com/shop/infra/pull/318/files', `<pre style="font-family:Mono,monospace;font-size:13px;line-height:1.7;padding:20px 24px;color:#5F6672;width:620px;white-space:pre-wrap">
<span style="color:#1A1D23;font-weight:600">deploy/checkout.yaml</span>

<span style="background:#4D7C0F22;display:block">+ apiVersion: apps/v1
+ kind: Deployment
+ metadata:
+   name: checkout-api
+ spec:
+   replicas: 3</span></pre>`, 620)}
  <img src="/extension/store/raw-popup.png" style="position:absolute;right:84px;top:184px;width:336px;
       border-radius:10px;box-shadow:0 12px 48px #0004;border:1px solid #0001">`);

/* screenshot 2: raw JSON, formatted where it is */
await draw('screenshot-2.png', 1280, 800, `
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#4F46E518,#F3F4F6 60%)"></div>
  ${caption('Raw JSON, readable where it opens', 'API responses become a tree you can fold, with a preview of every branch. Click a key to copy its path.')}
  ${browser('api.shop.example/v2/orders?page=1', `<img src="/extension/store/raw-viewer.png" style="display:block;width:1152px">`, 640)}`);

/* screenshots 3–5: a tool, framed under its caption */
for (let i = 0; i < SHOTS.length; i++) {
  const s = SHOTS[i];
  await draw(`screenshot-${i + 3}.png`, 1280, 800, `
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${s.hue}18,#F3F4F6 60%)"></div>
    ${caption(s.title, s.sub)}
    <img src="/extension/store/raw-${s.tool}.png" style="position:absolute;left:96px;top:160px;width:1088px;
         border-radius:10px;box-shadow:0 10px 40px #0003;border:1px solid #0001">`);
}

/* promo tiles: the mark, the promise, the suite */
const promo = (w, hgt, mark, title, sub, tileSize, gap) => `
  <div style="position:absolute;inset:0;background:#FBFBFC;display:flex;flex-direction:column;justify-content:center;padding:0 ${w * 0.07}px">
    <div style="display:flex;align-items:center;gap:${mark * 0.4}px">
      <span class="mark" style="width:${mark}px;height:${mark}px"></span>
      <span style="font-size:${mark * 0.8}px;font-weight:600">lint<span style="color:#8A909C">.one</span></span>
    </div>
    <div style="font-size:${title}px;font-weight:600;margin-top:${title * 0.6}px;letter-spacing:-0.01em">Open any data file in the right viewer.</div>
    <div style="font-size:${sub}px;color:#5F6672;margin-top:${sub * 0.3}px">Nothing you open leaves your browser.</div>
    <div style="display:flex;gap:${gap}px;margin-top:${title}px">${SUITE.map(([t, c]) => tile(t, c, tileSize)).join('')}</div>
  </div>`;
await draw('promo-small.png', 440, 280, promo(440, 280, 34, 21, 15, 22, 7));
await draw('promo-marquee.png', 1400, 560, promo(1400, 560, 64, 48, 28, 56, 16));

await ctx.close();
server.close();
await rm(SHOT_EXT, { recursive: true, force: true });
console.log('✓ extension/store: screenshot-1..5.png, promo-small.png, promo-marquee.png');
