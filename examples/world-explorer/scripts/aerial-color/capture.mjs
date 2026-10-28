// Capture the explorer's north-up orthographic view of every aerial-color frame.
//
//   node examples/world-explorer/scripts/aerial-color/capture.mjs [--base http://localhost:5225/]
//     [--out .artifacts/aerial-color/captures] [--ids yuma,kyoto] [--seed 0] [--quality balanced]
//
// Run the explorer first (`pnpm --filter @bendyline/molen-examples-world-explorer dev`). A frame
// is written only once terrain, layers and landmarks report nothing loading for several seconds;
// an incomplete frame is a failed capture, not evidence about the scene.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg) => /^--([^=]+)=(.*)$/.exec(arg))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const base = args.base ?? 'http://localhost:5225/';
const out = resolve(root, args.out ?? '.artifacts/aerial-color/captures');
const wanted = new Set((args.ids ?? '').split(',').filter(Boolean));
const config = JSON.parse(await readFile(args.frames ?? resolve(here, 'frames.json'), 'utf8'));
const [width, height] = [1200, 800];
const viewHeight = config.extentMeters[1];

function frameUrl(frame) {
  const url = new URL(base);
  const query = {
    region: frame.region,
    lat: frame.center[0],
    lon: frame.center[1],
    alt: Number(args.alt ?? Math.round(viewHeight * 0.9)),
    yaw: Number(args.yaw ?? -Math.PI / 2),
    pitch: Number(args.pitch ?? -1.5),
    ...(args.perspective === '1' ? {} : { aerialOrtho: viewHeight }),
    quality: args.quality ?? 'balanced',
    backend: 'webgl',
    mode: 'human',
    freeze: 1,
    month: 0,
    date: args.date ?? frame.date,
    weather: 'sunny',
    ambient: 0,
    dioramas: 0,
    audio: 0,
    infillSeed: args.seed ?? 0,
    hud: 0,
  };
  // --extra=key:value,key:value adds diagnostic query parameters (e.g. buildingInfill:0).
  for (const pair of (args.extra ?? '').split(',').filter(Boolean)) {
    const [key, value = ''] = pair.split(':');
    query[key] = value;
  }
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  return url;
}

/** Loaded = nothing pending in terrain, layers, coverage or landmarks, continuously for `settle` ms. */
async function waitForLoaded(page, { timeout = 240_000, settle = 6_000 } = {}) {
  const started = Date.now();
  let quietSince;
  let text = '';
  while (Date.now() - started < timeout) {
    text = await page.evaluate(
      () => (document.getElementById('status') ?? document.getElementById('error'))?.textContent,
    );
    const quiet =
      typeof text === 'string' &&
      /\b0 loading terrain · 0 loading layers · 0 failed/.test(text) &&
      /\b0 selected leaves awaiting coverage/.test(text) &&
      !/landmarks [^\n]*?\b[1-9]\d* loading/.test(text) &&
      /worldgen \d+ buildings/.test(text);
    if (!quiet) quietSince = undefined;
    else if (quietSince === undefined) quietSince = Date.now();
    else if (Date.now() - quietSince >= settle) return { loaded: true, text };
    await page.waitForTimeout(500);
  }
  return { loaded: false, text };
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--force_high_performance_gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const records = {};
try {
  for (const frame of config.frames) {
    if (wanted.size > 0 && !wanted.has(frame.id)) continue;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text().slice(0, 300));
    });
    const url = frameUrl(frame);
    await page.goto(url.href, { waitUntil: 'load' });
    const state = await waitForLoaded(page);
    // Textures bake after geometry arrives; give the last ones a moment to land.
    await page.waitForTimeout(3_000);
    const path = resolve(out, `${frame.id}${args.suffix ?? ''}.png`);
    await page.screenshot({ path, clip: { x: 0, y: 0, width, height } });
    const credit = await page.evaluate(() => {
      const element = document.getElementById('credit');
      if (!element || element.hidden) return undefined;
      const r = element.getBoundingClientRect();
      return [r.left, r.top, r.right, r.bottom].map(Math.round);
    });
    records[`${frame.id}${args.suffix ?? ''}`] = {
      url: url.href,
      loaded: state.loaded,
      status: state.text?.split('\n') ?? [],
      ...(credit ? { maskRect: credit } : {}),
      errors,
    };
    console.log(`${frame.id}: ${state.loaded ? 'loaded' : 'INCOMPLETE'} -> ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
}
const manifestPath = resolve(out, 'captures.json');
let previous = {};
try {
  previous = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {}
await writeFile(manifestPath, `${JSON.stringify({ ...previous, ...records }, null, 2)}\n`);
