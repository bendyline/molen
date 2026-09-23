import { createImage, type RGBAImage } from './types';

// UV paint-by-numbers import processing (rung 5, docs/06 §6). The two hard requirements:
// island masking (clip a painted image to the island map; generators slop across boundaries)
// and edge dilation (push island colors into the gutters to stop seam bleed under sampling).
// Pure image ops — the heavy part (xatlas unwrap + template generation from glTF UVs) is a
// separate Node toolchain step.

function clone(img: RGBAImage): RGBAImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/** A pixel is "inside an island" if the island map there is not pure background (black/transparent). */
function isInside(map: RGBAImage, i: number): boolean {
  const a = map.data[i + 3] as number;
  if (a === 0) return false;
  return (
    (map.data[i] as number) !== 0 ||
    (map.data[i + 1] as number) !== 0 ||
    (map.data[i + 2] as number) !== 0
  );
}

/** Clip a painted image to the island map: pixels outside any island become transparent. */
export function maskToIslands(painted: RGBAImage, islandMap: RGBAImage): RGBAImage {
  if (painted.width !== islandMap.width || painted.height !== islandMap.height) {
    throw new Error(
      `painted (${painted.width}x${painted.height}) and island map (${islandMap.width}x${islandMap.height}) must match`,
    );
  }
  const out = clone(painted);
  for (let p = 0; p < out.data.length; p += 4) {
    if (!isInside(islandMap, p)) {
      out.data[p] = 0;
      out.data[p + 1] = 0;
      out.data[p + 2] = 0;
      out.data[p + 3] = 0;
    }
  }
  return out;
}

/** Push opaque colors outward into transparent gutters by `px` rings (nearest-valid flood). */
export function dilate(img: RGBAImage, px: number): RGBAImage {
  const w = img.width;
  const h = img.height;
  let cur = clone(img);
  for (let ring = 0; ring < px; ring++) {
    const next = clone(cur);
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if ((cur.data[p + 3] as number) > 0) continue; // already opaque
        // find an opaque 4-neighbour to copy from
        const neighbours: Array<[number, number]> = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [dx, dy] of neighbours) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = (ny * w + nx) * 4;
          if ((cur.data[np + 3] as number) > 0) {
            next.data[p] = cur.data[np] as number;
            next.data[p + 1] = cur.data[np + 1] as number;
            next.data[p + 2] = cur.data[np + 2] as number;
            next.data[p + 3] = 255;
            changed = true;
            break;
          }
        }
      }
    }
    cur = next;
    if (!changed) break;
  }
  return cur;
}

export interface ApplyUvPaintOptions {
  maskToIslands?: boolean;
  dilationPx?: number;
}

/** Full import: mask the painted image to the islands, then dilate to fill the gutters. */
export function applyUvPaint(
  painted: RGBAImage,
  islandMap: RGBAImage,
  opts: ApplyUvPaintOptions = {},
): RGBAImage {
  const masked = opts.maskToIslands === false ? clone(painted) : maskToIslands(painted, islandMap);
  const dilationPx = opts.dilationPx ?? 8;
  return dilationPx > 0 ? dilate(masked, dilationPx) : masked;
}

/** A trivial island map for tests/demos: a filled rectangle island on a transparent background. */
export function rectIslandMap(
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RGBAImage {
  const img = createImage(width, height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 4;
      img.data[p] = 80;
      img.data[p + 1] = 80;
      img.data[p + 2] = 80;
      img.data[p + 3] = 255;
    }
  }
  return img;
}
