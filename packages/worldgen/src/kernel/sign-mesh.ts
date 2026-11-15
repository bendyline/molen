/**
 * Storefront signs whose names are set from a glyph atlas: per sign a plate, an optional accent
 * band, and two triangles per letter, merged into one mesh for the batch. Plates and bands come
 * first in the index buffer and letters after them, so a renderer stops drawing letters by draw
 * range once they are too small to read, and the plates once those are. Every vertex carries a
 * plate and a letter color: a material draws `mix(plate, ink, coverage)`, coverage read from the
 * atlas's distance field; solid faces carry the same color twice and need no texture.
 */
import { dmath } from '@bendyline/molen-kernel/determinism';
import type { GlyphAtlasSet } from '@bendyline/molen-materials/text';
import type { PropPlacement } from './props';
import { SRGB_TO_LINEAR_BYTE } from './schema-common';
import type { StorefrontSign } from './types';

/** A named sign's place on a facade (from `buildStorefronts`), before its name is laid out. */
export interface SignPlacement {
  /** Identity of the storefront, for ordering. */
  identity: string;
  sign: StorefrontSign;
  /** The bay's center on the wall line, at the fascia band's mid-height, batch meters. */
  x: number;
  y: number;
  z: number;
  /** Rotation about +Y of the wall's outward normal (+Z at 0). */
  yaw: number;
  /** Widest plate the bay takes, and the plate's height, meters. */
  maxWidth: number;
  height: number;
  /** The descriptor model to place instead when the atlas cannot set the name. */
  fallback: PropPlacement;
}

/** A batch's named signs as one mesh (see the module comment). */
export interface SignMeshBuffers {
  /** Batch meters, (x, y, z) per vertex. */
  positions: Float32Array;
  /** Unit normals as normalized signed bytes, (x, y, z, pad) per vertex. */
  normals: Int8Array;
  /** Atlas texture coordinates, (u, v) per vertex. */
  uvs: Float32Array;
  /** Normalized linear RGB plate and letter colors, (r, g, b, pad) per vertex. */
  plate: Uint8Array;
  ink: Uint8Array;
  indices: Uint16Array | Uint32Array;
  /** Leading indices that draw plates and bands; the letters follow. */
  plateIndexCount: number;
  bounds: [number, number, number, number, number, number];
  /** Smallest cap height among the names, meters: when letters stop being worth drawing. */
  capHeight: number;
  /** Smallest plate height, meters. */
  plateHeight: number;
  /** Signs in the mesh. */
  count: number;
}

/** Plate depth: its back sits inside the fascia band, its face this far from the wall. */
const PLATE_BACK = 0.2;
const PLATE_FRONT = 0.32;
/** Band and letters stand just proud of the plate, far enough not to fight it in depth. */
const BAND_FRONT = 0.33;
const LETTER_FRONT = 0.335;
/** Proportions of the plate height. */
const BAND = 0.12;
const MARGIN_X = 0.25;
const MARGIN_Y = 0.13;
/** Letters keep clear of the band by this much, so no letter quad's padding covers it. */
const BAND_CLEAR = 0.1;
/** A plate is at least this share of its bay, and this many heights wide. */
const MIN_SHARE = 0.45;
const MIN_ASPECT = 2.2;

type Rgb = [number, number, number];
function linear(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    SRGB_TO_LINEAR_BYTE[(value >> 16) & 0xff] as number,
    SRGB_TO_LINEAR_BYTE[(value >> 8) & 0xff] as number,
    SRGB_TO_LINEAR_BYTE[value & 0xff] as number,
  ];
}

class SignBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly plate: number[] = [];
  readonly ink: number[] = [];
  readonly solid: number[] = [];
  readonly letters: number[] = [];

  /** A quad from its four corners, counterclockwise seen from the side `normal` faces. */
  quad(
    corners: readonly (readonly number[])[],
    normal: readonly number[],
    plate: Rgb,
    ink: Rgb,
    uv: readonly number[] | undefined,
    letter: boolean,
  ): void {
    const base = this.positions.length / 3;
    corners.forEach((corner, i) => {
      this.positions.push(corner[0] as number, corner[1] as number, corner[2] as number);
      this.normals.push(
        Math.round((normal[0] as number) * 127),
        Math.round((normal[1] as number) * 127),
        Math.round((normal[2] as number) * 127),
        0,
      );
      // Corners run lower-left, lower-right, upper-right, upper-left.
      if (uv === undefined) this.uvs.push(0, 0);
      else this.uvs.push(uv[i === 0 || i === 3 ? 0 : 2] as number, uv[i < 2 ? 1 : 3] as number);
      this.plate.push(...plate, 255);
      this.ink.push(...ink, 255);
    });
    (letter ? this.letters : this.solid).push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/**
 * Lay out every placement's name and build the batch's sign mesh. A placement whose name the
 * atlas cannot set returns its fallback model; past `maxSigns`, placements are dropped.
 */
export function buildSignMesh(
  placements: readonly SignPlacement[],
  glyphs: GlyphAtlasSet,
  maxSigns: number,
): { mesh?: SignMeshBuffers; fallbacks: PropPlacement[] } {
  const out = new SignBuilder();
  const fallbacks: PropPlacement[] = [];
  let count = 0,
    capHeight = Infinity,
    plateHeight = Infinity;
  for (const placement of placements) {
    if (count >= maxSigns) break;
    const { sign, height: h } = placement;
    const band = sign.stripe !== undefined ? BAND * h : 0;
    // The letters' box: inside the margins, and above the band with room to spare.
    const bottom = -h / 2 + (band > 0 ? band + BAND_CLEAR * h : MARGIN_Y * h);
    const top = h / 2 - MARGIN_Y * h;
    const layout = glyphs.layout(sign.text, {
      ...(sign.font !== undefined ? { font: sign.font } : {}),
      maxWidth: Math.max(0.1, placement.maxWidth - 2 * MARGIN_X * h),
      maxHeight: top - bottom,
      maxLines: 2,
      ...(sign.letterSpacing !== undefined ? { letterSpacing: sign.letterSpacing } : {}),
    });
    if (layout === undefined) {
      fallbacks.push(placement.fallback);
      continue;
    }
    count++;
    capHeight = Math.min(capHeight, layout.capHeight);
    plateHeight = Math.min(plateHeight, h);
    const width = Math.min(
      placement.maxWidth,
      Math.max(layout.width + 2 * MARGIN_X * h, MIN_SHARE * placement.maxWidth, MIN_ASPECT * h),
    );
    const yaw = placement.yaw;
    const rx = dmath.cos(yaw),
      rz = -dmath.sin(yaw);
    const fx = dmath.sin(yaw),
      fz = dmath.cos(yaw);
    const at = (side: number, up: number, forward: number): number[] => [
      placement.x + rx * side + fx * forward,
      placement.y + up,
      placement.z + rz * side + fz * forward,
    ];
    const plate = linear(sign.plate);
    const ink = linear(sign.ink);
    const w = width / 2,
      half = h / 2;
    // Plate: front, top, bottom and both ends; its back is against the fascia.
    out.quad(
      [
        at(-w, -half, PLATE_FRONT),
        at(w, -half, PLATE_FRONT),
        at(w, half, PLATE_FRONT),
        at(-w, half, PLATE_FRONT),
      ],
      [fx, 0, fz],
      plate,
      plate,
      undefined,
      false,
    );
    out.quad(
      [
        at(-w, half, PLATE_FRONT),
        at(w, half, PLATE_FRONT),
        at(w, half, PLATE_BACK),
        at(-w, half, PLATE_BACK),
      ],
      [0, 1, 0],
      plate,
      plate,
      undefined,
      false,
    );
    out.quad(
      [
        at(-w, -half, PLATE_BACK),
        at(w, -half, PLATE_BACK),
        at(w, -half, PLATE_FRONT),
        at(-w, -half, PLATE_FRONT),
      ],
      [0, -1, 0],
      plate,
      plate,
      undefined,
      false,
    );
    out.quad(
      [
        at(w, -half, PLATE_FRONT),
        at(w, -half, PLATE_BACK),
        at(w, half, PLATE_BACK),
        at(w, half, PLATE_FRONT),
      ],
      [rx, 0, rz],
      plate,
      plate,
      undefined,
      false,
    );
    out.quad(
      [
        at(-w, -half, PLATE_BACK),
        at(-w, -half, PLATE_FRONT),
        at(-w, half, PLATE_FRONT),
        at(-w, half, PLATE_BACK),
      ],
      [-rx, 0, -rz],
      plate,
      plate,
      undefined,
      false,
    );
    if (sign.stripe !== undefined) {
      const stripe = linear(sign.stripe);
      out.quad(
        [
          at(-w, -half, BAND_FRONT),
          at(w, -half, BAND_FRONT),
          at(w, -half + band, BAND_FRONT),
          at(-w, -half + band, BAND_FRONT),
        ],
        [fx, 0, fz],
        stripe,
        stripe,
        undefined,
        false,
      );
    }
    // Letters, centered in their box.
    const middle = (top + bottom) / 2;
    const q = layout.quads;
    for (let i = 0; i < q.length; i += 8) {
      const x0 = q[i] as number,
        y0 = (q[i + 1] as number) + middle,
        x1 = q[i + 2] as number,
        y1 = (q[i + 3] as number) + middle;
      out.quad(
        [
          at(x0, y0, LETTER_FRONT),
          at(x1, y0, LETTER_FRONT),
          at(x1, y1, LETTER_FRONT),
          at(x0, y1, LETTER_FRONT),
        ],
        [fx, 0, fz],
        plate,
        ink,
        [q[i + 4] as number, q[i + 5] as number, q[i + 6] as number, q[i + 7] as number],
        true,
      );
    }
  }
  if (count === 0) return { fallbacks };
  const vertices = out.positions.length / 3;
  const positions = new Float32Array(out.positions);
  const bounds: SignMeshBuffers['bounds'] = [
    Infinity,
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
    -Infinity,
  ];
  for (let i = 0; i < positions.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[i + axis] as number;
      if (value < (bounds[axis] as number)) bounds[axis] = value;
      if (value > (bounds[axis + 3] as number)) bounds[axis + 3] = value;
    }
  const Index = vertices <= 65535 ? Uint16Array : Uint32Array;
  return {
    mesh: {
      positions,
      normals: new Int8Array(out.normals),
      uvs: new Float32Array(out.uvs),
      plate: new Uint8Array(out.plate),
      ink: new Uint8Array(out.ink),
      indices: new Index([...out.solid, ...out.letters]),
      plateIndexCount: out.solid.length,
      bounds,
      capHeight,
      plateHeight,
      count,
    },
    fallbacks,
  };
}

/** The sign mesh's ArrayBuffers, for posting across a worker boundary. */
export function signMeshTransferables(mesh: SignMeshBuffers | undefined): ArrayBuffer[] {
  if (mesh === undefined) return [];
  return [mesh.positions, mesh.normals, mesh.uvs, mesh.plate, mesh.ink, mesh.indices]
    .map((array) => array.buffer)
    .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
}
