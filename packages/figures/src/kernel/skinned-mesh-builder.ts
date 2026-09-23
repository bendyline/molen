/**
 * Growable, indexed skinned-mesh builder for figure bodies. Vertices are shared inside rings
 * and between lofted rings, so segments shade smoothly; hard color edges come from duplicated
 * rings (different region = different vertices). Each vertex carries two joint influences.
 * Three-free and deterministic: dmath only, iteration in insertion order, output quantized to
 * 1e-5 before Float32 so committed bakes survive engine ULP drift.
 */

import { dmath, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import type { RGB } from './color';

export type FigureRegion =
  | 'skin'
  | 'hair'
  | 'brow'
  | 'eyes'
  | 'top'
  | 'sleeves'
  | 'bottom'
  | 'shoes'
  | 'accent'
  | 'markings';

/** Fixed region order used when concatenating mesh groups. */
export const FIGURE_REGIONS: readonly FigureRegion[] = [
  'skin',
  'hair',
  'brow',
  'eyes',
  'top',
  'sleeves',
  'bottom',
  'shoes',
  'accent',
  'markings',
];

export type FigureTier = 0 | 1 | 2;

export interface FigureMeshGroup {
  /** Offset into `indices` of the group's first index. */
  start: number;
  /** Number of indices in the group. */
  count: number;
  region: FigureRegion;
}

export interface SkinnedMeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  /** 8-bit linear RGB triplets. */
  colors: Uint8Array;
  /** 4 joint indices per vertex (2 used); absent on rigid tiers. */
  joints?: Uint8Array;
  /** 4 weights per vertex summing to 1; absent on rigid tiers. */
  weights?: Float32Array;
  indices: Uint16Array | Uint32Array;
  groups: FigureMeshGroup[];
  vertexCount: number;
  triangleCount: number;
  bytes: number;
  tier: FigureTier;
}

/** A pair of joint influences: [joint, weight] each; weights need not be normalized. */
export type Skin = readonly [j0: number, w0: number, j1: number, w1: number];

/** One influence. */
export function skin(joint: number): Skin {
  return [joint, 1, joint, 0];
}

/** Two influences (weights are normalized on write). */
export function blend(j0: number, w0: number, j1: number, w1: number): Skin {
  return [j0, w0, j1, w1];
}

export interface RingRef {
  /** Index of the ring's first vertex. */
  start: number;
  sides: number;
  center: Vec3;
}

interface Part {
  region: FigureRegion;
  indices: number[];
}

function toByte(value: number): number {
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return dmath.round(clamped * 255);
}

/**
 * cos/sin of vertex `i` of an even-sided ring, folded so vertices that mirror across the first
 * tangent (i and sides/2 - i) share the same magnitudes exactly: centered rings come out
 * bitwise symmetric instead of one ULP apart.
 */
function circlePoint(sides: number, i: number, phase: number): [number, number] {
  if (phase !== 0 || sides % 2 !== 0) {
    const theta = (dmath.TAU * i) / sides + phase;
    return [dmath.cos(theta), dmath.sin(theta)];
  }
  const quarter = sides / 4;
  const half = sides / 2;
  const k = i % sides;
  if (k <= quarter) {
    const theta = (dmath.TAU * k) / sides;
    return [dmath.cos(theta), dmath.sin(theta)];
  }
  if (k <= half) {
    const [c, sn] = circlePoint(sides, half - k, 0);
    return [-c, sn];
  }
  const [c, sn] = circlePoint(sides, sides - k, 0);
  return [c, -sn];
}

/** Two unit tangents perpendicular to `axis` (axis need not be unit length). */
function tangents(axis: Vec3): [Vec3, Vec3] {
  const l = dmath.hypot(axis[0], axis[1], axis[2]) || 1;
  const a: Vec3 = [axis[0] / l, axis[1] / l, axis[2] / l];
  // Prefer +X as the first tangent when the axis is vertical, so ring phase is predictable.
  const helper: Vec3 = dmath.abs(a[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  let u: Vec3 = [
    helper[1] * a[2] - helper[2] * a[1],
    helper[2] * a[0] - helper[0] * a[2],
    helper[0] * a[1] - helper[1] * a[0],
  ];
  const ul = dmath.hypot(u[0], u[1], u[2]) || 1;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: Vec3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  return [u, v];
}

export class SkinnedMeshBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly joints: number[] = [];
  private readonly weights: number[] = [];
  /** Per-vertex flag: normals accumulate from faces (smooth) unless a hard normal was given. */
  private readonly hardNormals: (Vec3 | undefined)[] = [];
  private readonly parts = new Map<FigureRegion, Part>();

  private part(region: FigureRegion): Part {
    let part = this.parts.get(region);
    if (part === undefined) {
      part = { region, indices: [] };
      this.parts.set(region, part);
    }
    return part;
  }

  /** Append a vertex; returns its index. */
  vertex(p: Vec3, color: RGB, s: Skin, hardNormal?: Vec3): number {
    const index = this.positions.length / 3;
    this.positions.push(p[0], p[1], p[2]);
    this.colors.push(toByte(color[0]), toByte(color[1]), toByte(color[2]));
    const total = s[1] + s[3] || 1;
    this.joints.push(s[0], s[2]);
    this.weights.push(s[1] / total, s[3] / total);
    this.hardNormals.push(hardNormal);
    return index;
  }

  triangle(region: FigureRegion, a: number, b: number, c: number): void {
    this.part(region).indices.push(a, b, c);
  }

  quad(region: FigureRegion, a: number, b: number, c: number, d: number): void {
    this.part(region).indices.push(a, b, c, a, c, d);
  }

  /**
   * A ring of `sides` vertices around `center` in the plane perpendicular to `axis`, with radii
   * `rx` along the first tangent and `rz` along the second (for a vertical axis: +X and +Z).
   * `bulge` offsets the ring along the axis per vertex (0..1 of `rx`) for organic caps.
   */
  ring(
    region: FigureRegion,
    center: Vec3,
    axis: Vec3,
    rx: number,
    rz: number,
    sides: number,
    s: Skin,
    color: RGB,
    phase = 0,
  ): RingRef {
    const [u, v] = tangents(axis);
    const start = this.positions.length / 3;
    for (let i = 0; i < sides; i++) {
      const [c, sn] = circlePoint(sides, i, phase);
      const cu = c * rx;
      const cv = sn * rz;
      this.vertex(
        [
          center[0] + u[0] * cu + v[0] * cv,
          center[1] + u[1] * cu + v[1] * cv,
          center[2] + u[2] * cu + v[2] * cv,
        ],
        color,
        s,
      );
    }
    this.part(region);
    return { start, sides, center: [center[0], center[1], center[2]] };
  }

  /** Quads between two rings of equal side count (b is "further along" the segment). */
  loft(region: FigureRegion, a: RingRef, b: RingRef): void {
    if (a.sides !== b.sides) throw new Error('loft rings must have the same side count');
    for (let i = 0; i < a.sides; i++) {
      const j = (i + 1) % a.sides;
      this.quad(region, a.start + i, b.start + i, b.start + j, a.start + j);
    }
  }

  /** Fan-close a ring onto a new vertex at `apex` (default: the ring center). */
  cap(
    region: FigureRegion,
    ring: RingRef,
    s: Skin,
    color: RGB,
    apex?: Vec3,
    outward = true,
  ): number {
    const center = this.vertex(apex ?? ring.center, color, s);
    for (let i = 0; i < ring.sides; i++) {
      const j = (i + 1) % ring.sides;
      if (outward) this.triangle(region, center, ring.start + j, ring.start + i);
      else this.triangle(region, center, ring.start + i, ring.start + j);
    }
    return center;
  }

  /**
   * A lat-long ellipsoid with its polar axis along `axis` (unit), radii (a, b, c) along the two
   * tangents and the axis; `latMin`/`latMax` (−1..1, fraction of the axis) crop it for caps and
   * shells. Returns the ring nearest `latMin` when the bottom is open.
   */
  ellipsoid(
    region: FigureRegion,
    center: Vec3,
    axis: Vec3,
    radii: Vec3,
    segments: number,
    rings: number,
    s: Skin,
    color: RGB,
    latMin = -1,
    latMax = 1,
  ): RingRef | undefined {
    const [u, v] = tangents(axis);
    const al = dmath.hypot(axis[0], axis[1], axis[2]) || 1;
    const a: Vec3 = [axis[0] / al, axis[1] / al, axis[2] / al];
    const closedTop = latMax >= 1;
    const closedBottom = latMin <= -1;
    const angleMax = dmath.acos(dmath.clamp(latMax, -1, 1));
    const angleMin = dmath.acos(dmath.clamp(latMin, -1, 1));
    const ringRefs: RingRef[] = [];
    const first = closedTop ? 1 : 0;
    const last = closedBottom ? rings - 1 : rings;
    for (let r = first; r <= last; r++) {
      const t = angleMax + ((angleMin - angleMax) * r) / rings;
      const y = dmath.cos(t);
      const rad = dmath.sin(t);
      const c: Vec3 = [
        center[0] + a[0] * radii[2] * y,
        center[1] + a[1] * radii[2] * y,
        center[2] + a[2] * radii[2] * y,
      ];
      const start = this.positions.length / 3;
      for (let i = 0; i < segments; i++) {
        const [cc, sn] = circlePoint(segments, i, 0);
        const cu = cc * radii[0] * rad;
        const cv = sn * radii[1] * rad;
        this.vertex(
          [
            c[0] + u[0] * cu + v[0] * cv,
            c[1] + u[1] * cu + v[1] * cv,
            c[2] + u[2] * cu + v[2] * cv,
          ],
          color,
          s,
        );
      }
      ringRefs.push({ start, sides: segments, center: c });
    }
    for (let i = 0; i + 1 < ringRefs.length; i++) {
      this.loft(region, ringRefs[i + 1] as RingRef, ringRefs[i] as RingRef);
    }
    if (closedTop && ringRefs.length > 0) {
      const top: Vec3 = [
        center[0] + a[0] * radii[2],
        center[1] + a[1] * radii[2],
        center[2] + a[2] * radii[2],
      ];
      this.cap(region, ringRefs[0] as RingRef, s, color, top, true);
    }
    if (closedBottom && ringRefs.length > 0) {
      const bottom: Vec3 = [
        center[0] - a[0] * radii[2],
        center[1] - a[1] * radii[2],
        center[2] - a[2] * radii[2],
      ];
      this.cap(region, ringRefs[ringRefs.length - 1] as RingRef, s, color, bottom, false);
    }
    return closedBottom ? undefined : ringRefs[ringRefs.length - 1];
  }

  /** An axis-aligned box with hard (per-face) normals. */
  box(region: FigureRegion, min: Vec3, max: Vec3, s: Skin, color: RGB): void {
    const faces: [Vec3, Vec3[]][] = [
      [
        [1, 0, 0],
        [
          [max[0], min[1], min[2]],
          [max[0], max[1], min[2]],
          [max[0], max[1], max[2]],
          [max[0], min[1], max[2]],
        ],
      ],
      [
        [-1, 0, 0],
        [
          [min[0], min[1], max[2]],
          [min[0], max[1], max[2]],
          [min[0], max[1], min[2]],
          [min[0], min[1], min[2]],
        ],
      ],
      [
        [0, 1, 0],
        [
          [min[0], max[1], min[2]],
          [min[0], max[1], max[2]],
          [max[0], max[1], max[2]],
          [max[0], max[1], min[2]],
        ],
      ],
      [
        [0, -1, 0],
        [
          [min[0], min[1], max[2]],
          [min[0], min[1], min[2]],
          [max[0], min[1], min[2]],
          [max[0], min[1], max[2]],
        ],
      ],
      [
        [0, 0, 1],
        [
          [max[0], min[1], max[2]],
          [max[0], max[1], max[2]],
          [min[0], max[1], max[2]],
          [min[0], min[1], max[2]],
        ],
      ],
      [
        [0, 0, -1],
        [
          [min[0], min[1], min[2]],
          [min[0], max[1], min[2]],
          [max[0], max[1], min[2]],
          [max[0], min[1], min[2]],
        ],
      ],
    ];
    for (const [n, corners] of faces) {
      const ids = corners.map((p) => this.vertex(p, color, s, n));
      this.quad(region, ids[0] as number, ids[1] as number, ids[2] as number, ids[3] as number);
    }
  }

  /** A flat disc facing `normal` (hard normal), fanned from its center. */
  disc(
    region: FigureRegion,
    center: Vec3,
    normal: Vec3,
    radius: number,
    sides: number,
    s: Skin,
    color: RGB,
  ): void {
    const [u, v] = tangents(normal);
    const nl = dmath.hypot(normal[0], normal[1], normal[2]) || 1;
    const n: Vec3 = [normal[0] / nl, normal[1] / nl, normal[2] / nl];
    const c = this.vertex(center, color, s, n);
    const rim: number[] = [];
    for (let i = 0; i < sides; i++) {
      const [cc, sn] = circlePoint(sides, i, 0);
      const cu = cc * radius;
      const cv = sn * radius;
      rim.push(
        this.vertex(
          [
            center[0] + u[0] * cu + v[0] * cv,
            center[1] + u[1] * cu + v[1] * cv,
            center[2] + u[2] * cu + v[2] * cv,
          ],
          color,
          s,
          n,
        ),
      );
    }
    for (let i = 0; i < sides; i++) {
      this.triangle(region, c, rim[i] as number, rim[(i + 1) % sides] as number);
    }
  }

  /** Vertex count so far (a mark for `mirrorX`). */
  mark(): number {
    return this.positions.length / 3;
  }

  /**
   * Duplicate everything emitted since `mark` mirrored across x = 0 with reversed winding and
   * remapped joints, in the same order (deterministic left/right symmetry).
   */
  mirrorX(mark: number, jointMirror: (joint: number) => number): void {
    const count = this.positions.length / 3;
    const offset = count - mark;
    for (let i = mark; i < count; i++) {
      const p = i * 3;
      const s2 = i * 2;
      const hard = this.hardNormals[i];
      this.vertex(
        [
          -(this.positions[p] as number),
          this.positions[p + 1] as number,
          this.positions[p + 2] as number,
        ],
        [
          (this.colors[p] as number) / 255,
          (this.colors[p + 1] as number) / 255,
          (this.colors[p + 2] as number) / 255,
        ],
        [
          jointMirror(this.joints[s2] as number),
          this.weights[s2] as number,
          jointMirror(this.joints[s2 + 1] as number),
          this.weights[s2 + 1] as number,
        ],
        hard === undefined ? undefined : [-hard[0], hard[1], hard[2]],
      );
    }
    for (const part of this.parts.values()) {
      const n = part.indices.length;
      for (let i = 0; i + 2 < n; i += 3) {
        const a = part.indices[i] as number;
        const b = part.indices[i + 1] as number;
        const c = part.indices[i + 2] as number;
        if (a < mark || b < mark || c < mark) continue;
        part.indices.push(a + offset, c + offset, b + offset);
      }
    }
  }

  triangleCount(): number {
    let count = 0;
    for (const part of this.parts.values()) count += part.indices.length / 3;
    return count;
  }

  /** Smooth (area-weighted) normals for shared vertices; hard normals where given; quantized. */
  finalize(tier: FigureTier, skinned = true): SkinnedMeshBuffers {
    const vertexCount = this.positions.length / 3;
    const normalsAcc = new Float64Array(vertexCount * 3);
    const ordered = [...this.parts.values()]
      .filter((part) => part.indices.length > 0)
      .sort((a, b) => FIGURE_REGIONS.indexOf(a.region) - FIGURE_REGIONS.indexOf(b.region));
    let indexTotal = 0;
    for (const part of ordered) {
      indexTotal += part.indices.length;
      for (let i = 0; i + 2 < part.indices.length; i += 3) {
        const ia = part.indices[i] as number;
        const ib = part.indices[i + 1] as number;
        const ic = part.indices[i + 2] as number;
        const ax = this.positions[ia * 3] as number;
        const ay = this.positions[ia * 3 + 1] as number;
        const az = this.positions[ia * 3 + 2] as number;
        const ex = (this.positions[ib * 3] as number) - ax;
        const ey = (this.positions[ib * 3 + 1] as number) - ay;
        const ez = (this.positions[ib * 3 + 2] as number) - az;
        const fx = (this.positions[ic * 3] as number) - ax;
        const fy = (this.positions[ic * 3 + 1] as number) - ay;
        const fz = (this.positions[ic * 3 + 2] as number) - az;
        // Cross product magnitude is twice the area: area weighting for free.
        const nx = ey * fz - ez * fy;
        const ny = ez * fx - ex * fz;
        const nz = ex * fy - ey * fx;
        for (const v of [ia, ib, ic]) {
          normalsAcc[v * 3] = (normalsAcc[v * 3] as number) + nx;
          normalsAcc[v * 3 + 1] = (normalsAcc[v * 3 + 1] as number) + ny;
          normalsAcc[v * 3 + 2] = (normalsAcc[v * 3 + 2] as number) + nz;
        }
      }
    }
    // Sign-symmetric quantization so mirrored vertices stay exactly mirrored.
    const q = (value: number): number =>
      (dmath.sign(value) * dmath.round(dmath.abs(value) * 1e5)) / 1e5 + 0;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    for (let v = 0; v < vertexCount; v++) {
      positions[v * 3] = q(this.positions[v * 3] as number);
      positions[v * 3 + 1] = q(this.positions[v * 3 + 1] as number);
      positions[v * 3 + 2] = q(this.positions[v * 3 + 2] as number);
      const hard = this.hardNormals[v];
      let nx = hard === undefined ? (normalsAcc[v * 3] as number) : hard[0];
      let ny = hard === undefined ? (normalsAcc[v * 3 + 1] as number) : hard[1];
      let nz = hard === undefined ? (normalsAcc[v * 3 + 2] as number) : hard[2];
      const l = dmath.hypot(nx, ny, nz);
      if (l === 0) {
        nx = 0;
        ny = 1;
        nz = 0;
      } else {
        nx /= l;
        ny /= l;
        nz /= l;
      }
      normals[v * 3] = q(nx);
      normals[v * 3 + 1] = q(ny);
      normals[v * 3 + 2] = q(nz);
    }
    const colors = new Uint8Array(this.colors);
    const indices = vertexCount > 65535 ? new Uint32Array(indexTotal) : new Uint16Array(indexTotal);
    const groups: FigureMeshGroup[] = [];
    let offset = 0;
    for (const part of ordered) {
      for (let i = 0; i < part.indices.length; i++) indices[offset + i] = part.indices[i] as number;
      groups.push({ start: offset, count: part.indices.length, region: part.region });
      offset += part.indices.length;
    }
    let joints: Uint8Array | undefined;
    let weights: Float32Array | undefined;
    if (skinned) {
      joints = new Uint8Array(vertexCount * 4);
      weights = new Float32Array(vertexCount * 4);
      for (let v = 0; v < vertexCount; v++) {
        joints[v * 4] = this.joints[v * 2] as number;
        joints[v * 4 + 1] = this.joints[v * 2 + 1] as number;
        weights[v * 4] = q(this.weights[v * 2] as number);
        weights[v * 4 + 1] = q(1 - (this.weights[v * 2] as number));
      }
    }
    const bytes =
      positions.byteLength +
      normals.byteLength +
      colors.byteLength +
      indices.byteLength +
      (joints?.byteLength ?? 0) +
      (weights?.byteLength ?? 0);
    return {
      positions,
      normals,
      colors,
      ...(joints !== undefined ? { joints } : {}),
      ...(weights !== undefined ? { weights } : {}),
      indices,
      groups,
      vertexCount,
      triangleCount: indexTotal / 3,
      bytes,
      tier,
    };
  }
}

/** Rotate a local offset by a quaternion and add it to a base point. */
export function offsetPoint(base: Vec3, rot: [number, number, number, number], local: Vec3): Vec3 {
  const r = quatRotateVec3(rot, local);
  return [base[0] + r[0], base[1] + r[1], base[2] + r[2]];
}
