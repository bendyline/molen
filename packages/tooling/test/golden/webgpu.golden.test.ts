import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type CaptureServer, startCaptureServer } from '../../src/capture-server';
import { buildCubeGlb } from '../fixtures/build-glb';
import type { BackendCaptureOptions, BackendCaptureStats } from '../fixtures/webgpu-harness';

// Browser integration tests live in the golden lane so unit tests need no browser. These
// assert visible pixels and rendering behavior without encoding driver-specific golden PNGs.
const OUT = join(process.cwd(), 'test', 'golden', '__output__', 'webgpu');
const REQUIRE_WEBGPU = process.env.MOLEN_REQUIRE_WEBGPU === '1';
// MOLEN_SKIP_WEBGPU=1 (set by CI) runs the suite as if WebGPU were missing: every page gets the
// `missing` fault, so WebGPU cases skip while the WebGL and fallback cases still run.
const SKIP_WEBGPU = process.env.MOLEN_SKIP_WEBGPU === '1';
const BROWSER_CHANNEL = process.env.MOLEN_WEBGPU_CHANNEL;
const GPU_ARGS = process.env.MOLEN_WEBGPU_ARGS
  ? (JSON.parse(process.env.MOLEN_WEBGPU_ARGS) as string[])
  : REQUIRE_WEBGPU
    ? []
    : [
        '--enable-unsafe-webgpu',
        '--use-webgpu-adapter=swiftshader',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ];
let browser: Browser;
let server: CaptureServer;
let gpuAvailable = false;

beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
  await build({
    entryPoints: ['test/fixtures/webgpu-harness.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external: ['@resvg/resvg-wasm', 'node:module', 'node:fs/promises'],
    outfile: join(OUT, 'harness.js'),
  });
  await writeFile(
    join(OUT, 'capture.html'),
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block;width:320px;height:240px}</style></head><body><canvas></canvas><script type="module" src="./harness.js"></script></body></html>',
  );
  await writeFile(join(OUT, 'crate.glb'), await buildCubeGlb());
  server = await startCaptureServer(OUT);
  browser = await chromium.launch({
    headless: true,
    args: GPU_ARGS,
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {}),
  });
  const page = await browser.newPage();
  try {
    await page.goto(server.url);
    const probe = await page.evaluate(async () => {
      // Match Three r184's request so compatibility-level adapters are covered too.
      const adapter = await navigator.gpu?.requestAdapter({ featureLevel: 'compatibility' });
      if (!adapter) return { available: false };
      const device = await adapter.requestDevice();
      device.destroy();
      return {
        available: true,
        adapter: {
          vendor: adapter.info.vendor,
          architecture: adapter.info.architecture,
          description: adapter.info.description,
          isFallbackAdapter: adapter.info.isFallbackAdapter,
        },
      };
    });
    gpuAvailable = probe.available && !SKIP_WEBGPU;
    await writeFile(
      join(OUT, 'capabilities.json'),
      JSON.stringify(
        {
          browser: browser.version(),
          channel: BROWSER_CHANNEL ?? 'bundled-chromium',
          args: GPU_ARGS,
          skipWebGpu: SKIP_WEBGPU,
          ...probe,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close();
  }
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

type Fault = 'missing' | 'adapter-null' | 'adapter-reject' | 'device-reject';

async function open(requested?: Fault): Promise<{ page: Page; errors: string[] }> {
  const fault = requested ?? (SKIP_WEBGPU ? 'missing' : undefined);
  const page = await browser.newPage({
    viewport: { width: 640, height: 480 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  if (fault) {
    await page.addInitScript((kind) => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value:
          kind === 'missing'
            ? undefined
            : {
                requestAdapter: async () => {
                  if (kind === 'adapter-null') return null;
                  if (kind === 'adapter-reject') throw new Error('test adapter rejected');
                  return {
                    features: new Set(),
                    limits: {},
                    info: {},
                    requestDevice: async () => {
                      throw new Error('test device rejected');
                    },
                  };
                },
                getPreferredCanvasFormat: () => 'bgra8unorm',
              },
      });
    }, fault);
  }
  await page.goto(server.url);
  await page.waitForFunction(() => window.__backendCapture !== undefined);
  return { page, errors };
}

function assertVisible(png: Buffer): void {
  const image = PNG.sync.read(png);
  let changed = 0;
  const colors = new Set<number>();
  for (let i = 0; i < image.data.length; i += 4) {
    const red = image.data[i] ?? 0;
    const green = image.data[i + 1] ?? 0;
    const blue = image.data[i + 2] ?? 0;
    const distance =
      Math.abs(red - (image.data[0] ?? 0)) +
      Math.abs(green - (image.data[1] ?? 0)) +
      Math.abs(blue - (image.data[2] ?? 0));
    if (distance > 30) changed++;
    colors.add((red << 16) | (green << 8) | blue);
  }
  expect(
    changed,
    'a significant part of the screenshot must contain rendered geometry',
  ).toBeGreaterThan(image.width * image.height * 0.05);
  expect(colors.size, 'lit textured geometry must have varied visible colors').toBeGreaterThan(20);
}

async function capture(page: Page, name: string): Promise<Buffer> {
  const png = await page.locator('canvas').screenshot({ path: join(OUT, `${name}.png`) });
  assertVisible(png);
  return png;
}

async function render(
  page: Page,
  options: BackendCaptureOptions,
  name: string,
): Promise<BackendCaptureStats> {
  const result = await page.evaluate((value) => window.__backendCapture.create(value), options);
  expect(result.sameCanvas).toBe(true);
  expect(result.entities).toBe(1);
  expect(result.drawCalls).toBeGreaterThanOrEqual(4);
  expect(result.triangles).toBeGreaterThan(100);
  expect(result.gpuValidationErrors).toEqual([]);
  expect(result.skinnedMeshes).toBe(1);
  expect(result.instancedMeshes).toBe(1);
  expect(result.shadowCasters).toBeGreaterThanOrEqual(3);
  expect(result.shadowsEnabled).toBe(true);
  expect(result.fogFar).toBe(60);
  expect(result.toneMapping).toBeGreaterThan(0);
  await capture(page, name);
  await writeFile(join(OUT, `${name}.json`), JSON.stringify(result, null, 2));
  return result;
}

describe('graphics backends in Chromium', () => {
  for (const backend of ['webgl', 'webgpu'] as const) {
    for (const reversed of [false, true]) {
      it(`${backend}: keeps water above terrain with ${reversed ? 'reversed' : 'ordinary'} depth`, async (context) => {
        if (backend === 'webgpu' && !gpuAvailable) {
          context.skip();
          return;
        }
        const { page, errors } = await open();
        try {
          await page.evaluate(
            ({ backend, reversed }) =>
              window.__backendCapture.renderWaterOverTerrain(backend, reversed),
            { backend, reversed },
          );
          const pixels = PNG.sync.read(
            await page.locator('canvas').screenshot({
              path: join(OUT, `${backend}-water-terrain-${reversed}.png`),
            }),
          );
          let water = 0;
          let island = 0;
          for (let i = 0; i < pixels.data.length; i += 4) {
            const r = pixels.data[i] ?? 0;
            const g = pixels.data[i + 1] ?? 0;
            const b = pixels.data[i + 2] ?? 0;
            if (b > r + 25 && g > r + 20) water++;
            if (r > g + 25 && r > b + 25) island++;
          }
          expect(water, 'the raised lake must remain visible over its terrain').toBeGreaterThan(
            pixels.width * pixels.height * 0.2,
          );
          expect(island, 'ordinary geometry must still occlude water').toBeGreaterThan(100);
          expect(errors).toEqual([]);
        } finally {
          await page.close();
        }
      });
    }
  }
  it('preserves the atmospheric sky with reverse depth on both backends', async (context) => {
    if (!gpuAvailable) {
      context.skip();
      return;
    }
    const images: PNG[] = [];
    for (const backend of ['webgl', 'webgpu'] as const) {
      const { page, errors } = await open();
      try {
        await page.evaluate(
          (backend) => window.__backendCapture.create({ backend, mode: 'world' }),
          backend,
        );
        const pixels = PNG.sync.read(await page.locator('canvas').screenshot());
        expect(
          pixels.data[0],
          `${backend}: sky must not disappear into the clear color`,
        ).toBeGreaterThan(220);
        images.push(pixels);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
    const [a, b] = images;
    if (!a || !b) throw new Error('missing sky captures');
    let error = 0;
    for (let i = 0; i < a.width * 20 * 4; i++)
      error += Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0));
    expect(error / (a.width * 20 * 4)).toBeLessThan(1.5);
  });
  it('matches uncached rendering through instance edits, LOD, streaming, visibility, materials and rebasing', async (context) => {
    if (!gpuAvailable) {
      context.skip();
      return;
    }
    const reference = await open();
    const optimized = await open();
    try {
      let previousImage: PNG | undefined;
      for (const step of [
        'initial',
        'instances',
        'far',
        'near',
        'hide',
        'show',
        'count',
        'material',
        'pipeline',
        'geometry',
        'add',
        'remove',
        'away',
        'return',
        'rebase',
        'resize',
        'pixel-ratio',
        'animation',
      ]) {
        const baseline = await reference.page.evaluate(
          (step) => window.__backendCapture.optimizationStep(false, step),
          step,
        );
        const actual = await optimized.page.evaluate(
          (step) => window.__backendCapture.optimizationStep(true, step),
          step,
        );
        expect(actual.errors, step).toEqual([]);
        expect(actual.cached, step).toBe(true);
        expect(actual.storage, step).toBe(false);
        expect(actual.drawCalls, step).toBe(baseline.drawCalls);
        expect(actual.triangles, step).toBe(baseline.triangles);
        const a = PNG.sync.read(await reference.page.locator('canvas').screenshot());
        const b = PNG.sync.read(
          await optimized.page
            .locator('canvas')
            .screenshot({ path: join(OUT, `optimized-${step}.png`) }),
        );
        let error = 0;
        expect(a.data.length).toBe(b.data.length);
        for (let i = 0; i < a.data.length; i++)
          error += Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0));
        expect(error / a.data.length, `${step}: mean pixel error`).toBeLessThan(0.05);
        if (step === 'animation' && previousImage) {
          let change = 0;
          for (let i = 0; i < b.data.length; i++)
            change += Math.abs((b.data[i] ?? 0) - (previousImage.data[i] ?? 0));
          expect(change, 'cached water must continue animating').toBeGreaterThan(100);
        }
        previousImage = b;
      }
      expect(reference.errors).toEqual([]);
      expect(optimized.errors).toEqual([]);
    } finally {
      await reference.page.close();
      await optimized.page.close();
    }
  }, 60_000);
  it('requires a real adapter when the GPU CI lane is requested', () => {
    if (REQUIRE_WEBGPU)
      expect(gpuAvailable, 'MOLEN_REQUIRE_WEBGPU=1 requires an actual working WebGPU device').toBe(
        true,
      );
  });

  for (const mode of ['perspective', 'ortho', 'world'] as const) {
    it(`renders explicit WebGL ${mode} with assets, PBR, instancing and skinning`, async () => {
      const { page, errors } = await open('missing');
      try {
        const result = await render(page, { backend: 'webgl', mode }, `webgl-${mode}`);
        expect(result.backend).toBe('webgl');
        expect(result.fallbackReason).toBeUndefined();
        const resized = await page.evaluate(() => window.__backendCapture.resizeAndRebase());
        expect(resized.width).toBe(600);
        expect(resized.height).toBe(360);
        expect(resized.worldOrigin).toEqual([1_000_000, 0, -1_000_000]);
        expect(resized.drawCalls).toBeGreaterThanOrEqual(4);
        expect(resized.gpuValidationErrors).toEqual([]);
        await capture(page, `webgl-${mode}-resized-rebased`);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }

  for (const fault of ['missing', 'adapter-null', 'adapter-reject', 'device-reject'] as const) {
    it(`auto falls back to visible legacy WebGL after ${fault}`, async () => {
      const { page } = await open(fault);
      try {
        const result = await render(page, { backend: 'auto' }, `fallback-${fault}`);
        expect(result.backend).toBe('webgl');
        expect(result.fallbackReason).toBeTruthy();
      } finally {
        await page.close();
      }
    });
  }

  it('explicit WebGPU rejects an unavailable adapter without consuming the supplied canvas', async () => {
    const { page } = await open('adapter-null');
    try {
      const error = await page.evaluate(async () => {
        try {
          await window.__backendCapture.create({ backend: 'webgpu' });
          return undefined;
        } catch (reason) {
          return String(reason);
        }
      });
      expect(error).toMatch(/webgpu|adapter/i);
      expect((await render(page, { backend: 'webgl' }, 'strict-failure-recovered')).backend).toBe(
        'webgl',
      );
    } finally {
      await page.close();
    }
  });

  it('auto selects the available renderer and draws real geometry', async () => {
    const { page, errors } = await open();
    try {
      const result = await render(page, {}, 'auto');
      expect(result.backend).toBe(gpuAvailable ? 'webgpu' : 'webgl');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('resynchronizes a live kernel that sent its first keyframe during backend initialization', async () => {
    const { page, errors } = await open('adapter-null');
    try {
      const result = await page.evaluate(() => window.__backendCapture.startLive());
      expect(result).toEqual({
        earlyDelivered: false,
        resyncRequests: 1,
        subscribedAtResync: true,
        tick: 42,
        entities: 1,
        commandSent: true,
        unhookedAfterDispose: true,
      });
      await capture(page, 'live-startup-resynchronized');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  for (const mode of ['perspective', 'ortho', 'world'] as const) {
    it(`renders native WebGPU ${mode} and survives resize/rebase`, async (context) => {
      if (!gpuAvailable) {
        context.skip();
        return;
      }
      const { page, errors } = await open();
      try {
        const result = await render(page, { backend: 'webgpu', mode }, `webgpu-${mode}`);
        expect(result.backend).toBe('webgpu');
        expect(result.fallbackReason).toBeUndefined();
        const timing = await page.evaluate(() => window.__backendCapture.measureGpu());
        await writeFile(join(OUT, `webgpu-${mode}-timing.json`), JSON.stringify(timing, null, 2));
        expect(timing.supported).toBe(timing.advertised);
        if (timing.supported) {
          expect(
            timing.samples.length,
            'timestamp-capable devices must complete bounded readback',
          ).toBeGreaterThan(0);
          expect(timing.samples.every((sample) => Number.isFinite(sample) && sample >= 0)).toBe(
            true,
          );
        }
        const resized = await page.evaluate(() => window.__backendCapture.resizeAndRebase());
        expect(resized.width).toBe(600);
        expect(resized.height).toBe(360);
        expect(resized.drawCalls).toBeGreaterThanOrEqual(4);
        expect(resized.gpuValidationErrors).toEqual([]);
        await capture(page, `webgpu-${mode}-resized-rebased`);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }

  it('executes the water and sky node shaders through Three node-WebGL (supplemental coverage)', async () => {
    const { page, errors } = await open();
    try {
      const result = await page.evaluate(() => window.__backendCapture.renderNodeWebGL(0));
      expect(result.backend).toBe('node-webgl');
      expect(result.drawCalls).toBeGreaterThanOrEqual(2);
      const first = await capture(page, 'node-webgl-water-sky');
      await page.evaluate(() => window.__backendCapture.renderNodeWebGL(10));
      const animated = await capture(page, 'node-webgl-water-sky-animated');
      expect(first.equals(animated), 'water uniforms must affect actual pixels').toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
