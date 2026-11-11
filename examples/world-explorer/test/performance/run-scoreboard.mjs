/**
 * The World Explorer's performance scoreboard: one settled view and one flight, measured in the
 * real explorer on a real GPU and checked against `scoreboard-budgets.json`.
 *
 *   node test/performance/run-scoreboard.mjs --label=main
 *   node test/performance/run-scoreboard.mjs --tier=4 --seconds=120 --report-only
 *
 * What a view is made of (draws, triangles, memory, rebuilt work) is the same on any machine with
 * the same window, and fails the run when over budget. Times (frame work, long frames, settling)
 * depend on the machine and what else it is doing: they are reported against advisory budgets
 * and fail only with `--strict`. Results go to the ignored `.artifacts/scoreboard/<label>/`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const flag = (name) => process.argv.includes(`--${name}`);

const label = option('label', 'run');
const tier = option('tier', '3');
const seconds = Number(option('seconds', 60));
const settleLimit = Number(option('settle', 90));
const extra = option('params', '');
const budgets = JSON.parse(
  await readFile(option('budgets', resolve(here, 'scoreboard-budgets.json')), 'utf8'),
);
const output = resolve(root, '.artifacts/scoreboard', label);
const MIB = 1_048_576;

// Over the east shore of Lake Washington, looking west across Bellevue toward Seattle.
const view = { lat: '47.6', lon: '-122.22', yaw: String(-Math.PI / 2), alt: '900', radius: '4000' };
const url = (port, params) =>
  `http://127.0.0.1:${port}/?${new URLSearchParams({
    ...view,
    autopilot: 'circle',
    hud: '0',
    mode: 'human',
    tier,
    ...params,
  })}${extra ? `&${extra}` : ''}`;

const server = await createServer({
  configFile: resolve(root, 'vite.config.ts'),
  root,
  server: { host: '127.0.0.1', port: 0, watch: null },
  logLevel: 'error',
});
await server.listen();
const port = server.httpServer.address().port;
await mkdir(output, { recursive: true });
// An installed Chrome: Playwright's Chromium has no hardware adapter headless.
const browser = await chromium.launch({
  headless: true,
  channel: option('channel', 'chrome'),
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

/** Frame intervals and main-thread work a frame, recorded from inside the page. */
const recordFrames = () => {
  const frames = [];
  globalThis.__scoreboard = { take: () => frames.splice(0) };
  const raf = globalThis.requestAnimationFrame.bind(globalThis);
  let stamp = -1,
    previous = -1,
    work = 0;
  globalThis.requestAnimationFrame = (callback) =>
    raf((time) => {
      if (time !== stamp) {
        if (stamp >= 0 && previous >= 0) frames.push(stamp - previous, work);
        previous = stamp;
        stamp = time;
        work = 0;
      }
      const started = performance.now();
      try {
        callback(time);
      } finally {
        work += performance.now() - started;
      }
    });
};
const frameStats = (flat) => {
  const intervals = [],
    work = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    intervals.push(flat[i]);
    work.push(flat[i + 1]);
  }
  const sorted = Float64Array.from(work).sort();
  const mean = work.reduce((a, b) => a + b, 0) / Math.max(1, work.length);
  return {
    frames: intervals.length,
    over33: intervals.filter((ms) => ms > 33.4).length,
    workMean: +mean.toFixed(2),
    workP95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2),
  };
};

async function open(params) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(recordFrames);
  const started = Date.now();
  await page.goto(url(port, params), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof globalThis.molenFlightProbe === 'function', undefined, {
    timeout: 240_000,
  });
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return String(gl?.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) ?? 'none');
  });
  if (/swiftshader|llvmpipe|software/i.test(renderer))
    throw new Error(`Software renderer (${renderer}): not a device measurement.`);
  return { context, page, errors, started, renderer };
}
const probe = (page) => page.evaluate(() => globalThis.molenFlightProbe());
const report = (page) => page.evaluate(() => globalThis.molenFlightReport());

/** A view held still until streaming is done: what it is made of, and what a frame of it costs. */
async function still() {
  const { context, page, errors, started, renderer } = await open({ speed: '0', start: '0' });
  let idle = 0,
    settled;
  while (Date.now() - started < settleLimit * 1000 && idle < 4) {
    const { loading } = await probe(page);
    idle = (loading?.tiles ?? 0) + (loading?.layers ?? 0) === 0 ? idle + 1 : 0;
    if (idle === 1) settled = (Date.now() - started) / 1000;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => globalThis.__scoreboard.take());
  await page.waitForTimeout(5_000);
  const frames = frameStats(await page.evaluate(() => globalThis.__scoreboard.take()));
  const state = await probe(page);
  const { scene } = await report(page);
  await page.screenshot({ path: resolve(output, 'still.jpg'), quality: 85, type: 'jpeg' });
  await context.close();
  return {
    renderer,
    errors,
    metrics: {
      settleSeconds: idle >= 4 ? +settled.toFixed(1) : settleLimit,
      drawCalls: state.rendered.drawCalls,
      triangles: state.rendered.triangles,
      shownMiB: Math.round((state.pressure?.displayedBytes ?? 0) / MIB),
      landcoverMiB: Math.round(scene.landcover.bytes / MIB),
      landcoverTriangles: Math.round(scene.landcover.triangles),
      texturedLandcoverTiles: scene.landcover.textured,
      scatterTriangles: Math.round(scene.scatter.triangles),
      workMs: frames.workMean,
    },
  };
}

/** Laps at 250 m/s: how smooth the frames are, and how much work streaming did twice. */
async function circle() {
  const settle = 30;
  const { context, page, errors, started } = await open({ speed: '250', start: String(settle) });
  await page.waitForTimeout(Math.max(0, started + settle * 1000 - Date.now()));
  const before = (await report(page)).stats ?? {};
  await page.evaluate(() => globalThis.__scoreboard.take());
  const samples = [];
  const ends = Date.now() + seconds * 1000;
  while (Date.now() < ends) {
    samples.push(await probe(page));
    await page.waitForTimeout(500);
  }
  const frames = frameStats(await page.evaluate(() => globalThis.__scoreboard.take()));
  const after = await report(page);
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize);
  await context.close();
  const delta = (key) => (after.stats?.[key] ?? 0) - (before[key] ?? 0);
  const near = samples
    .map((sample) => sample.coverage?.[0]?.drawnLevel)
    .filter((level) => typeof level === 'number');
  const background = after.graphics?.stages?.['admission-wait-background'];
  return {
    errors,
    metrics: {
      framesOver33: frames.over33,
      workMeanMs: frames.workMean,
      workP95Ms: frames.workP95,
      rebuiltTiles: delta('rebuiltTiles'),
      evictions: delta('evictions'),
      coarsenedInView: delta('coarsenedInView'),
      shownPeakMiB: Math.round(
        Math.max(...samples.map((sample) => sample.pressure?.displayedBytes ?? 0)) / MIB,
      ),
      heapMiB: heap === undefined ? undefined : Math.round(heap / MIB),
      nearLevel: near.length
        ? +(near.reduce((a, b) => a + b, 0) / near.length).toFixed(2)
        : undefined,
      backgroundWaitP95Ms: background?.p95 === undefined ? undefined : Math.round(background.p95),
    },
  };
}

let failed = 0;
const rows = [];
function judge(scenario, metrics) {
  for (const [name, value] of Object.entries(metrics)) {
    const budget = budgets[scenario]?.[name];
    let verdict = '';
    if (budget !== undefined && value !== undefined) {
      const over =
        (budget.max !== undefined && value > budget.max) ||
        (budget.min !== undefined && value < budget.min);
      const counts = budget.advisory !== true || flag('strict');
      verdict = !over ? 'ok' : counts ? 'OVER' : 'over (advisory)';
      if (over && counts) failed++;
    }
    const limit =
      budget === undefined
        ? ''
        : [
            budget.min !== undefined ? `>= ${budget.min}` : '',
            budget.max !== undefined ? `<= ${budget.max}` : '',
          ]
            .filter(Boolean)
            .join(' ');
    rows.push([`${scenario}.${name}`, String(value ?? '–'), limit, verdict]);
  }
}

try {
  const result = { label, tier, when: new Date().toISOString() };
  result.still = await still();
  judge('still', result.still.metrics);
  result.circle = await circle();
  judge('circle', result.circle.metrics);
  const widths = [0, 1, 2, 3].map((i) => Math.max(...rows.map((row) => row[i].length)));
  for (const row of rows)
    console.log(
      row
        .map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i])))
        .join('  '),
    );
  console.log(`\n${result.still.renderer} · tier ${tier} · 1440x900`);
  for (const error of [...result.still.errors, ...result.circle.errors])
    console.log(`page error: ${error}`);
  await writeFile(resolve(output, 'result.json'), `${JSON.stringify(result, null, 1)}\n`);
  if (failed > 0) console.log(`\n${failed} over budget.`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed > 0 && !flag('report-only') ? 1 : 0);
