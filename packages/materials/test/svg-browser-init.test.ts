import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bakeSvg, initSvg } from '../src/svg';

// M1/M2 regression: bakeSvg used to be Node-only. initSvg hardwired createRequire + readFile, so
// a browser could not initialise the rasterizer at all, and the literal `node:` specifiers made
// bundlers refuse the package outright.
//
// resvg's initWasm can only run once per process, so this file (isolated from svg.test.ts, which
// covers the Node auto-load) is the explicit-source half: a runtime that does not look like Node
// must refuse to auto-load, and must then bake correctly from bytes the caller supplies.
//
// The pixel expectations below are the same flat-fill values svg.test.ts asserts on the Node
// auto-load path, so the two init paths are pinned to the same bytes. Keep them in sync.

const circle = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1a1a2e"/>
  <circle cx="32" cy="32" r="20" fill="#e94560"/>
</svg>`;

/** The bytes a browser caller would fetch; read here rather than by the Node auto-load path. */
function wasmBytes(): Promise<Uint8Array> {
  const require = createRequire(import.meta.url);
  return readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
}

/**
 * Make the module's runtime probe see a non-Node host without swapping out `process` itself:
 * the stub inherits the real process and only shadows `versions`.
 */
function pretendNotNode(): void {
  vi.stubGlobal('process', Object.create(process, { versions: { value: {}, enumerable: true } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initSvg(wasm) outside Node', () => {
  it('refuses to auto-load and names the fix', async () => {
    pretendNotNode();
    await expect(initSvg()).rejects.toThrow(/needs the resvg WASM outside Node/);
    // A failed auto-load must not poison the cache — the next test initialises successfully.
    await expect(bakeSvg(circle)).rejects.toThrow(/pass it explicitly/);
  });

  it('passes a URL source through to the loader instead of auto-loading', async () => {
    pretendNotNode();
    // A file: URL is not fetchable, so the rejection proves the URL reached resvg's fetch path
    // (and not the "outside Node" refusal, nor a silent fall back to the Node auto-load).
    const failure = await initSvg(new URL('file:///molen-no-such-resvg.wasm')).catch(
      (e: Error) => e,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toMatch(/outside Node/);
  });

  it('bakes from caller-supplied wasm bytes, matching the Node path pixel for pixel', async () => {
    pretendNotNode();
    await initSvg(await wasmBytes());

    const baked = await bakeSvg(circle, { rasterSize: [64, 64] });
    const img = baked.slots.baseColor;
    expect(img?.width).toBe(64);
    expect(img?.height).toBe(64);
    const d = img?.data as Uint8ClampedArray;
    // Flat interior fills, so these are exact: #e94560 at the centre, #1a1a2e in the corner.
    const c = (32 * 64 + 32) * 4;
    expect([d[c], d[c + 1], d[c + 2], d[c + 3]]).toEqual([233, 69, 96, 255]);
    expect([d[0], d[1], d[2], d[3]]).toEqual([26, 26, 46, 255]);
  });

  it('is idempotent once initialised, whatever later calls pass', async () => {
    pretendNotNode();
    // Second and third calls must not re-init resvg (initWasm throws if called twice).
    await initSvg(await wasmBytes());
    await initSvg();
    await initSvg(new URL('file:///molen-no-such-resvg.wasm'));
    expect((await bakeSvg(circle, { rasterSize: [8, 8] })).slots.baseColor?.width).toBe(8);
  });
});
