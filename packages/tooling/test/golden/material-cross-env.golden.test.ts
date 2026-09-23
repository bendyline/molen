import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MatGraphDoc, PixelGridDoc } from '@bendyline/molen-materials';
import { bakeMatGraph, bakePixelGrid } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { build } from 'esbuild';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type CaptureServer, startCaptureServer } from '../../src/capture-server';

// `@bendyline/molen-materials` exists as its own pure-CPU package for exactly one reason: its
// evaluators must produce byte-identical pixels in Node and in the browser, so one set of goldens
// is valid for both and a texture baked at load time matches the one baked by tooling
// (docs/02 §30, docs/06 §3). Every other "byte-identical" test in the repo compares Node to Node,
// which cannot see an environment-dependent result. This one bakes the same documents in both and
// compares the RGBA buffers.
//
// It lives in the golden lane because it needs a browser, but it encodes no golden image: the
// reference is the Node bake of the same build, so it keeps working when a material legitimately
// changes.
//
// Every fixture goes through `validateByKind` first, and every baked slot is asserted to contain
// more than one colour before the comparison. Both matter: the bakers take *validated* documents,
// and this test once fed them raw ones — so `lacunarity`/`gain`/`factor` were `undefined`, every
// noise sample was NaN, `Math.round(NaN * 255)` stored 0, and the test compared two flat images,
// which of course agreed. A constant image equals itself in every engine; it proves nothing.

const OUT = join(process.cwd(), 'test', 'golden', '__output__', 'material-cross-env');

let browser: Browser;
let server: CaptureServer;

function validated<T>(kind: 'matgraph' | 'pixelgrid', doc: unknown): T {
  const parsed = validateByKind(kind, doc);
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as T;
}

// Chosen to exercise the transcendental paths — gradient-noise direction (Math.cos/sin per
// lattice corner), fbm octave accumulation, uv-transform rotation and the linear gradient angle —
// since those are where an engine's libm would most plausibly disagree.
const graphs: MatGraphDoc[] = [
  {
    format: 'molen/matgraph@1',
    size: [64, 64],
    seed: 4242,
    nodes: [
      { id: 'n1', type: 'noise', params: { kind: 'simplex', octaves: 5, scale: 6 } },
      {
        id: 'n2',
        type: 'ramp',
        input: 'n1',
        params: {
          stops: [
            { t: 0, color: '#3a3f2e' },
            { t: 0.5, color: '#6e6a4a' },
            { t: 1, color: '#a8a282' },
          ],
        },
      },
    ],
    outputs: { baseColor: 'n2' },
  },
  {
    format: 'molen/matgraph@1',
    size: [48, 48],
    seed: 7,
    nodes: [
      { id: 'uv', type: 'uv', params: {} },
      {
        id: 'rot',
        type: 'uv-transform',
        input: 'uv',
        params: { scale: 1.7, offset: [0.13, -0.29], rotateDeg: 37 },
      },
      { id: 'n', type: 'noise', params: { kind: 'value', octaves: 3, scale: 9 }, input: 'rot' },
      { id: 'g', type: 'gradient', params: { kind: 'linear', angleDeg: 23 } },
      // `blend` is the vocabulary's combining node ("mix" is one of its modes, not a node type),
      // and its second operand is `inputs.b` — the old fixture wrote `type: 'mix'` with an
      // `inputB` field nothing reads, so the gradient was dead and the node evaluated to 0.
      {
        id: 'mix',
        type: 'blend',
        inputs: { a: 'n', b: 'g' },
        params: { mode: 'mix', factor: 0.4 },
      },
      {
        id: 'ramp',
        type: 'ramp',
        input: 'mix',
        params: {
          stops: [
            { t: 0, color: '#101820' },
            { t: 1, color: '#d8c8a0' },
          ],
        },
      },
    ],
    outputs: { baseColor: 'ramp', roughness: 'n' },
  },
].map((doc) => validated<MatGraphDoc>('matgraph', doc));

// Palette keys are the characters the rows are written in — the schema rejects an array palette.
// Both slots are enabled so the grid's multi-slot path is compared across environments too.
const grids: PixelGridDoc[] = [
  {
    format: 'molen/pixelgrid@1',
    size: [4, 4],
    palette: { '0': '#00000000', '1': '#ff0055', '2': '#22cc88', '3': '#ffffff' },
    rows: ['0123', '1230', '2301', '3012'],
    slots: { baseColor: true, emissive: true },
  },
].map((doc) => validated<PixelGridDoc>('pixelgrid', doc));

/** Distinct packed RGBA values in a slot buffer — 1 means the image is a single flat colour. */
function uniqueColors(bytes: number[]): number {
  const seen = new Set<number>();
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    seen.add(
      ((bytes[i] as number) << 24) |
        ((bytes[i + 1] as number) << 16) |
        ((bytes[i + 2] as number) << 8) |
        (bytes[i + 3] as number),
    );
  }
  return seen.size;
}

beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
  await build({
    entryPoints: ['test/fixtures/materials-harness.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    // No `external` list: @bendyline/molen-materials must bundle for the browser as published,
    // resvg glue and all. It used to need external: ['node:module', 'node:fs/promises'] because
    // svg.ts imported those with literal specifiers; that is the bug this list was hiding.
    outfile: join(OUT, 'harness.js'),
  });
  await writeFile(
    join(OUT, 'capture.html'),
    '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./harness.js"></script></body></html>',
  );
  server = await startCaptureServer(OUT);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('materials: Node and browser bake identical bytes', () => {
  it('produces the same RGBA buffer for every slot of every document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(server.url);
      await page.waitForFunction(() => window.__bakeMaterials !== undefined);
      const browserSlots = await page.evaluate((docs) => window.__bakeMaterials(docs), {
        graphs,
        grids,
      } as never);
      expect(errors).toEqual([]);

      const nodeSlots: Record<string, number[]> = {};
      graphs.forEach((doc, i) => {
        for (const [slot, image] of Object.entries(bakeMatGraph(doc).slots)) {
          if (image !== undefined) nodeSlots[`graph${i}:${slot}`] = Array.from(image.data);
        }
      });
      grids.forEach((doc, i) => {
        for (const [slot, image] of Object.entries(bakePixelGrid(doc).slots)) {
          if (image !== undefined) nodeSlots[`grid${i}:${slot}`] = Array.from(image.data);
        }
      });

      // The same slots, so neither side quietly skipped a document.
      expect(Object.keys(browserSlots).sort()).toEqual(Object.keys(nodeSlots).sort());
      expect(Object.keys(nodeSlots).length).toBeGreaterThan(2);

      // Every slot must carry real detail. Without this a regression to a flat image (the NaN
      // bug above, or any future one) passes the comparison below silently.
      for (const [key, nodeBytes] of Object.entries(nodeSlots)) {
        expect(
          uniqueColors(nodeBytes),
          `${key}: node image is a single flat colour`,
        ).toBeGreaterThan(1);
        expect(
          uniqueColors(browserSlots[key] as number[]),
          `${key}: browser image is a single flat colour`,
        ).toBeGreaterThan(1);
      }

      for (const [key, nodeBytes] of Object.entries(nodeSlots)) {
        const browserBytes = browserSlots[key] as number[];
        expect(browserBytes.length, `${key}: buffer length`).toBe(nodeBytes.length);
        // Report the first disagreeing pixel rather than dumping two 16KB arrays.
        const at = nodeBytes.findIndex((value, i) => value !== browserBytes[i]);
        expect(
          at,
          at === -1
            ? ''
            : `${key}: first byte mismatch at ${at} (pixel ${Math.floor(at / 4)}, channel ${at % 4}): node ${nodeBytes[at]} vs browser ${browserBytes[at]}`,
        ).toBe(-1);
      }
    } finally {
      await page.close();
    }
  }, 120_000);
});
