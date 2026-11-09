/**
 * Measure terrain streaming under a scripted flight in the real explorer, on a real GPU.
 *
 *   node test/performance/run-flight-streaming.mjs --flight=circle --seconds=230 --label=before
 *
 * Reports, for what the camera faces, how much of each distance band is finished, and how many
 * tile builds repeated work the cache should have kept (the `rebuilt` counters). Flights hold a
 * fixed quality so the adaptive tier cannot move under the comparison. Results and screenshots go
 * to `.artifacts/flight-streaming/`; keep only concise conclusions in the repository.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

// Over Bellevue, heading west across the lake into Seattle, or circling over the lake's east shore.
const FLIGHTS = {
  straight: { autopilot: 'straight', lat: 47.62, lon: -122.0, yaw: Math.PI },
  circle: { autopilot: 'circle', lat: 47.6, lon: -122.22, yaw: -Math.PI / 2 },
};
const flightName = option('flight', 'circle');
const preset = FLIGHTS[flightName];
if (preset === undefined) throw new Error(`Unknown flight ${flightName}`);
// `--lat`, `--lon` and `--yaw` move a flight to where a report came from.
const flight = {
  ...preset,
  lat: Number(option('lat', preset.lat)),
  lon: Number(option('lon', preset.lon)),
  yaw: Number(option('yaw', preset.yaw)),
};
const seconds = Number(option('seconds', flightName === 'circle' ? 230 : 110));
const settle = Number(option('settle', 40));
const speed = Number(option('speed', 250));
const altitude = Number(option('alt', 900));
const radius = Number(option('radius', 4000));
const quality = option('quality', 'balanced');
const label = option('label', 'run');
const extra = option('params', '');
const shotEvery = Number(option('shots', 10));
const output = resolve(root, '.artifacts/flight-streaming', label);

const query = new URLSearchParams({
  autopilot: flight.autopilot,
  lat: String(flight.lat),
  lon: String(flight.lon),
  yaw: String(flight.yaw),
  alt: String(altitude),
  speed: String(speed),
  radius: String(radius),
  start: String(settle),
  quality,
  hud: '0',
  mode: 'human',
  ambient: option('ambient', '1'),
  ...(option('tier', undefined) !== undefined ? { tier: option('tier') } : {}),
});

const server = await createServer({
  configFile: resolve(root, 'vite.config.ts'),
  root,
  // No file watching: a package rebuild during a flight would reload the page and end the run.
  server: { host: '127.0.0.1', port: 0, watch: null },
  logLevel: 'error',
});
await server.listen();
const port = server.httpServer.address().port;
await mkdir(output, { recursive: true });

// Playwright's own Chromium finds no WebGPU adapter headless; installed Chrome finds the real one.
const browser = await chromium.launch({
  headless: true,
  channel: option('channel', 'chrome'),
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
});
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return String(gl?.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) ?? 'none');
  });
  console.log(`Renderer: ${renderer}`);
  if (/swiftshader|llvmpipe|software/i.test(renderer))
    throw new Error('Software renderer: refusing to report it as device performance.');
  await page.goto(`http://127.0.0.1:${port}/?${query}${extra ? `&${extra}` : ''}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => typeof globalThis.molenFlightProbe === 'function', undefined, {
    timeout: 180_000,
  });
  const flightStarts = Date.now() + settle * 1000;
  const flightEnds = flightStarts + seconds * 1000;
  const samples = [];
  let frames = 0;
  await page.exposeFunction('molenFrames', (count) => {
    frames = count;
  });
  await page.evaluate(() => {
    let count = 0;
    const tick = () => {
      count++;
      if (count % 30 === 0) void globalThis.molenFrames(count);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // The view at rest, once it has streamed in: what drawing it costs with no streaming at all.
  const samples0 = [];
  while (Date.now() < flightStarts - 1500) {
    if (Date.now() >= flightStarts - 11_500) {
      const at = Date.now();
      const probe = await page.evaluate(() => globalThis.molenFlightProbe());
      samples0.push({ t: (at - flightStarts) / 1000, frames, rendered: probe.rendered });
    }
    await page.waitForTimeout(250);
  }
  const opening = await page.evaluate(() => globalThis.molenFlightReport());
  let nextShot = flightStarts;
  // `--profile=N` records a main-thread CPU profile for N seconds of flight.
  const profileSeconds = Number(option('profile', 0));
  const cdp = profileSeconds > 0 ? await context.newCDPSession(page) : undefined;
  let profileState = profileSeconds > 0 ? 'waiting' : 'done';
  const profileStart = flightStarts + 15_000;
  while (Date.now() < flightEnds) {
    const at = Date.now();
    if (profileState === 'waiting' && at >= profileStart) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 2000 });
      await cdp.send('Profiler.start');
      profileState = 'running';
    } else if (profileState === 'running' && at >= profileStart + profileSeconds * 1000) {
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(resolve(output, 'flight.cpuprofile'), JSON.stringify(profile));
      profileState = 'done';
    }
    const probe = await page.evaluate(() => globalThis.molenFlightProbe());
    samples.push({ t: (at - flightStarts) / 1000, frames, ...probe });
    if (at >= nextShot && shotEvery > 0) {
      nextShot += shotEvery * 1000;
      const name = `t${String(Math.round((at - flightStarts) / 1000)).padStart(4, '0')}.jpg`;
      await page.screenshot({ path: resolve(output, name), type: 'jpeg', quality: 70 });
    }
    await page.waitForTimeout(250);
  }
  const final = await page.evaluate(() => globalThis.molenFlightReport());
  // TEMP-COMPILE-PROBE
  await writeFile(
    resolve(output, 'compiles.json'),
    JSON.stringify(await page.evaluate(() => globalThis.__molenCompileStats ?? {}), null, 1),
  );
  const backend = await page.evaluate(
    () => document.querySelector('#performance-status')?.textContent?.split('\n')[0],
  );

  const flying = samples.filter((sample) => sample.t >= 0);
  const bandNames = ['0-2km', '2-5km', '5-10km', '10-20km', '20km+'];
  const bands = bandNames.map((name, index) => {
    const total = { tiles: 0, complete: 0, stale: 0, bare: 0, empty: 0 };
    for (const sample of flying) {
      const band = sample.coverage[index];
      for (const key of Object.keys(total)) total[key] += band[key];
    }
    const share = (value) => (total.tiles === 0 ? 0 : value / total.tiles);
    // How fine the ground drawn there is: `complete` is measured against a selection that
    // coarsens at speed, so it cannot tell coarse ground from fine.
    const levels = flying
      .map((sample) => sample.coverage[index].drawnLevel)
      .filter((level) => level !== undefined && level !== null);
    return {
      band: name,
      tiles: +(total.tiles / Math.max(1, flying.length)).toFixed(1),
      complete: +share(total.complete).toFixed(3),
      stale: +share(total.stale).toFixed(3),
      bare: +share(total.bare).toFixed(3),
      empty: +share(total.empty).toFixed(3),
      drawnLevel:
        levels.length === 0
          ? undefined
          : +(levels.reduce((sum, level) => sum + level, 0) / levels.length).toFixed(2),
    };
  });
  const first = flying[0];
  const last = flying[flying.length - 1];
  const delta = (name) => final.stats[name] - opening.stats[name];
  const worst = (values) => Math.max(...values);
  const tiers = [];
  for (const sample of samples) {
    if (tiers.at(-1)?.tier !== sample.tier) {
      tiers.push({ t: +sample.t.toFixed(1), tier: sample.tier, reason: sample.tierReason });
    }
  }
  const summary = {
    label,
    flight: flightName,
    seconds,
    speed,
    altitude,
    quality,
    renderer,
    backend,
    fps: +((last.frames - first.frames) / (last.t - first.t)).toFixed(1),
    restFps:
      samples0.length > 1
        ? +(
            (samples0.at(-1).frames - samples0[0].frames) /
            (samples0.at(-1).t - samples0[0].t)
          ).toFixed(1)
        : undefined,
    restDraws: samples0.at(-1)?.rendered?.drawCalls,
    restTriangles: samples0.at(-1)?.rendered?.triangles,
    flightDraws: Math.round(
      flying.reduce((sum, sample) => sum + (sample.rendered?.drawCalls ?? 0), 0) / flying.length,
    ),
    flightTriangles: Math.round(
      flying.reduce((sum, sample) => sum + (sample.rendered?.triangles ?? 0), 0) / flying.length,
    ),
    tiers,
    bands,
    builtTiles: delta('builtTiles'),
    rebuiltTiles: delta('rebuiltTiles'),
    builtLayers: delta('builtLayers'),
    rebuiltLayers: delta('rebuiltLayers'),
    evictions: delta('evictions'),
    // Ground in view that changed level: coarsening there is what reads as popping.
    refinedInView: delta('refinedInView'),
    coarsenedInView: delta('coarsenedInView'),
    residentTilesPeak: worst(flying.map((sample) => sample.pressure.residentTiles)),
    residentBytesPeakMiB: +(
      worst(flying.map((sample) => sample.pressure.residentBytes)) / 1_048_576
    ).toFixed(0),
    displayedBytesPeakMiB: +(
      worst(flying.map((sample) => sample.pressure.displayedBytes)) / 1_048_576
    ).toFixed(0),
    maxResidentBytesMiB: +((last.pressure.maxResidentBytes ?? 0) / 1_048_576).toFixed(0),
    maxResidentTiles: last.pressure.maxResidentTiles,
    worldgenCache: final.worldgen?.cache,
    errors: errors.slice(0, 8),
  };
  const stages = Object.fromEntries(
    Object.entries(final.graphics.stages).map(([stage, value]) => [
      stage,
      { n: value.count, mean: +value.mean.toFixed(1), p95: +value.p95.toFixed(1) },
    ]),
  );
  await writeFile(
    resolve(output, `${flightName}.json`),
    JSON.stringify({ summary, stages, counters: final.graphics.counters, samples }, null, 1),
  );
  console.log(JSON.stringify({ ...summary, stages }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
