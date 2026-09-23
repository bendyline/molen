import { beforeAll, describe, expect, it } from 'vitest';
import { bakeSvg, initSvg } from '../src/svg';

// The Node auto-load half of the rasterizer contract. The explicit-wasm (browser) half lives in
// svg-browser-init.test.ts — resvg's initWasm runs once per process, so the two paths cannot
// share a file. Both pin the same flat-fill pixel values, which is what ties them together.

beforeAll(async () => {
  await initSvg();
});

const circle = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1a1a2e"/>
  <circle cx="32" cy="32" r="20" fill="#e94560"/>
</svg>`;

describe('bakeSvg (rung 3)', () => {
  it('rasterizes an SVG to a texture at the requested width', async () => {
    const baked = await bakeSvg(circle, { rasterSize: [128, 48] });
    expect(baked.slots.baseColor?.width).toBe(128);
    expect(baked.slots.baseColor?.height).toBe(48);
    expect(baked.slots.baseColor?.data.length).toBe(128 * 48 * 4);
  });

  it('produces the expected colors (background + circle)', async () => {
    const baked = await bakeSvg(circle, { rasterSize: [64, 64] });
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    // Flat interior fills, so these are exact — and svg-browser-init.test.ts asserts the same
    // numbers after initialising from explicit wasm bytes.
    const c = (32 * 64 + 32) * 4; // centre pixel (32,32), inside the #e94560 circle
    expect([d[c], d[c + 1], d[c + 2], d[c + 3]]).toEqual([233, 69, 96, 255]);
    expect([d[0], d[1], d[2], d[3]]).toEqual([26, 26, 46, 255]); // corner: #1a1a2e background
  });

  it('is deterministic (identical bytes for the same SVG)', async () => {
    const a = await bakeSvg(circle, { rasterSize: [48, 48] });
    const b = await bakeSvg(circle, { rasterSize: [48, 48] });
    expect(Array.from(a.slots.baseColor?.data ?? [])).toEqual(
      Array.from(b.slots.baseColor?.data ?? []),
    );
  });

  it('rejects <text> with an outline-to-paths fix message', async () => {
    const withText = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><text x="8" y="32">hi</text></svg>`;
    await expect(bakeSvg(withText)).rejects.toThrow(/to paths/i);
  });
});
