/**
 * Roof builders. Wing roofs work in a wing frame where `a` runs along the ridge and `b` across
 * it; every face is emitted with an analytic normal. The eave plane passes through the wall top,
 * so roofs are watertight against walls and overhangs extend past them. Flat and skillion roofs
 * cover the whole outline with one triangulated cap.
 */

import { directionToWorld, type Frame, toLocal, toWorld } from './footprint';
import { offsetRing } from './geometry2d';
import { type MeshBufferBuilder, normalize3 } from './mesh-buffers';
import type { Wing } from './rectangles';
import type { MaterialSlot, RGB, Vec2, Vec3 } from './types';

export interface RoofSurface {
  slot: MaterialSlot;
  ref: string;
  color: RGB;
}

export interface RoofSurfaces {
  roof: RoofSurface;
  trim: RoofSurface;
  wall: RoofSurface;
}

export type WingRoofKind = 'gable' | 'hip' | 'pyramid' | 'shed' | 'mansard' | 'gambrel';

export interface WingRoofInput {
  wing: Wing;
  frame: Frame;
  /** Wall top height. */
  eave: number;
  /** Rise per meter of run (tan of the pitch). */
  rise: number;
  /** Lower slope rise for mansard and gambrel. */
  lowerRise: number;
  overhang: number;
  /** 0 full detail, 1 no soffits, 2 no overhang. */
  tier: number;
  surfaces: RoofSurfaces;
  /** +1 rises toward the wing far side, -1 toward the near side (shed only). */
  shedDirection: 1 | -1;
}

const FASCIA_DEPTH = 0.15;

interface WingSpace {
  point(a: number, b: number, y: number): Vec3;
  normal(na: number, nb: number, ny: number): Vec3;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
}

function wingSpace(wing: Wing, frame: Frame): WingSpace {
  const along = wing.longAxis === 'u';
  return {
    point: (a, b, y) => {
      const local: Vec2 = along ? [a, b] : [b, a];
      const world = toWorld(frame, local);
      return [world[0], y, world[1]];
    },
    normal: (na, nb, ny) => {
      const local: Vec2 = along ? [na, nb] : [nb, na];
      const direction = directionToWorld(frame, local);
      return normalize3([direction[0], ny, direction[1]]);
    },
    a0: along ? wing.u0 : wing.v0,
    a1: along ? wing.u1 : wing.v1,
    b0: along ? wing.v0 : wing.u0,
    b1: along ? wing.v1 : wing.u1,
  };
}

function metersUv(a: number, b: number): Vec2 {
  return [a, b];
}

function addEaveTrim(
  space: WingSpace,
  side: 'b0' | 'b1' | 'a0' | 'a1',
  eave: number,
  overhang: number,
  rise: number,
  input: WingRoofInput,
  out: MeshBufferBuilder,
): void {
  if (input.tier > 0 || overhang <= 0) return;
  const trim = input.surfaces.trim;
  const yE = eave - overhang * rise;
  const { a0, a1, b0, b1 } = space;
  // Soffit (underside) and fascia (vertical strip) along one eave.
  const corners: Record<typeof side, [Vec3, Vec3, Vec3, Vec3]> = {
    b0: [
      space.point(a0, b0 - overhang, yE),
      space.point(a1, b0 - overhang, yE),
      space.point(a1, b0, eave),
      space.point(a0, b0, eave),
    ],
    b1: [
      space.point(a0, b1 + overhang, yE),
      space.point(a1, b1 + overhang, yE),
      space.point(a1, b1, eave),
      space.point(a0, b1, eave),
    ],
    a0: [
      space.point(a0 - overhang, b0, yE),
      space.point(a0 - overhang, b1, yE),
      space.point(a0, b1, eave),
      space.point(a0, b0, eave),
    ],
    a1: [
      space.point(a1 + overhang, b0, yE),
      space.point(a1 + overhang, b1, yE),
      space.point(a1, b1, eave),
      space.point(a1, b0, eave),
    ],
  };
  const quad = corners[side];
  out.addQuad(
    trim.slot,
    trim.ref,
    quad,
    [0, -1, 0],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    trim.color,
  );
  const outwardA = side === 'a0' ? -1 : side === 'a1' ? 1 : 0;
  const outwardB = side === 'b0' ? -1 : side === 'b1' ? 1 : 0;
  const fascia: [Vec3, Vec3, Vec3, Vec3] = [
    quad[0],
    quad[1],
    [quad[1][0], quad[1][1] - FASCIA_DEPTH, quad[1][2]],
    [quad[0][0], quad[0][1] - FASCIA_DEPTH, quad[0][2]],
  ];
  out.addQuad(
    trim.slot,
    trim.ref,
    fascia,
    space.normal(outwardA, outwardB, 0),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    trim.color,
  );
}

function buildGable(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const roof = input.surfaces.roof;
  const wall = input.surfaces.wall;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const hd = (b1 - b0) / 2;
  const bc = (b0 + b1) / 2;
  const yR = input.eave + hd * input.rise;
  const yE = input.eave - o * input.rise;
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(a0, b0 - o, yE),
      space.point(a1, b0 - o, yE),
      space.point(a1, bc, yR),
      space.point(a0, bc, yR),
    ],
    space.normal(0, -input.rise, 1),
    [metersUv(a0, hd + o), metersUv(a1, hd + o), metersUv(a1, 0), metersUv(a0, 0)],
    roof.color,
  );
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(a0, b1 + o, yE),
      space.point(a1, b1 + o, yE),
      space.point(a1, bc, yR),
      space.point(a0, bc, yR),
    ],
    space.normal(0, input.rise, 1),
    [metersUv(a0, hd + o), metersUv(a1, hd + o), metersUv(a1, 0), metersUv(a0, 0)],
    roof.color,
  );
  if (input.wing.endOnOutline[0]) {
    out.addTriangle(
      wall.slot,
      wall.ref,
      [space.point(a0, b0, input.eave), space.point(a0, b1, input.eave), space.point(a0, bc, yR)],
      space.normal(-1, 0, 0),
      [
        [0, 0],
        [b1 - b0, 0],
        [hd, hd * input.rise],
      ],
      wall.color,
    );
  }
  if (input.wing.endOnOutline[1]) {
    out.addTriangle(
      wall.slot,
      wall.ref,
      [space.point(a1, b0, input.eave), space.point(a1, b1, input.eave), space.point(a1, bc, yR)],
      space.normal(1, 0, 0),
      [
        [0, 0],
        [b1 - b0, 0],
        [hd, hd * input.rise],
      ],
      wall.color,
    );
  }
  addEaveTrim(space, 'b0', input.eave, o, input.rise, input, out);
  addEaveTrim(space, 'b1', input.eave, o, input.rise, input, out);
}

function buildHip(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const hd = (b1 - b0) / 2;
  if (a1 - a0 <= 2 * hd * 1.15) {
    buildPyramid(input, out);
    return;
  }
  const roof = input.surfaces.roof;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const bc = (b0 + b1) / 2;
  const yR = input.eave + hd * input.rise;
  const yE = input.eave - o * input.rise;
  const r0 = a0 + hd;
  const r1 = a1 - hd;
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(a0 - o, b0 - o, yE),
      space.point(a1 + o, b0 - o, yE),
      space.point(r1, bc, yR),
      space.point(r0, bc, yR),
    ],
    space.normal(0, -input.rise, 1),
    [metersUv(a0 - o, hd + o), metersUv(a1 + o, hd + o), metersUv(r1, 0), metersUv(r0, 0)],
    roof.color,
  );
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(a0 - o, b1 + o, yE),
      space.point(a1 + o, b1 + o, yE),
      space.point(r1, bc, yR),
      space.point(r0, bc, yR),
    ],
    space.normal(0, input.rise, 1),
    [metersUv(a0 - o, hd + o), metersUv(a1 + o, hd + o), metersUv(r1, 0), metersUv(r0, 0)],
    roof.color,
  );
  out.addTriangle(
    roof.slot,
    roof.ref,
    [space.point(a0 - o, b0 - o, yE), space.point(a0 - o, b1 + o, yE), space.point(r0, bc, yR)],
    space.normal(-input.rise, 0, 1),
    [metersUv(b0 - o, hd + o), metersUv(b1 + o, hd + o), metersUv(bc, 0)],
    roof.color,
  );
  out.addTriangle(
    roof.slot,
    roof.ref,
    [space.point(a1 + o, b0 - o, yE), space.point(a1 + o, b1 + o, yE), space.point(r1, bc, yR)],
    space.normal(input.rise, 0, 1),
    [metersUv(b0 - o, hd + o), metersUv(b1 + o, hd + o), metersUv(bc, 0)],
    roof.color,
  );
  for (const side of ['b0', 'b1', 'a0', 'a1'] as const) {
    addEaveTrim(space, side, input.eave, o, input.rise, input, out);
  }
}

function buildPyramid(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const roof = input.surfaces.roof;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const half = Math.min(a1 - a0, b1 - b0) / 2;
  const ac = (a0 + a1) / 2;
  const bc = (b0 + b1) / 2;
  const yA = input.eave + half * input.rise;
  const yE = input.eave - o * input.rise;
  const apex = space.point(ac, bc, yA);
  const riseA = (yA - yE) / ((a1 - a0) / 2 + o);
  const riseB = (yA - yE) / ((b1 - b0) / 2 + o);
  const faces: Array<[Vec3, Vec3, Vec3]> = [
    [space.point(a0 - o, b0 - o, yE), space.point(a1 + o, b0 - o, yE), apex],
    [space.point(a1 + o, b0 - o, yE), space.point(a1 + o, b1 + o, yE), apex],
    [space.point(a1 + o, b1 + o, yE), space.point(a0 - o, b1 + o, yE), apex],
    [space.point(a0 - o, b1 + o, yE), space.point(a0 - o, b0 - o, yE), apex],
  ];
  const normals: Vec3[] = [
    space.normal(0, -riseB, 1),
    space.normal(riseA, 0, 1),
    space.normal(0, riseB, 1),
    space.normal(-riseA, 0, 1),
  ];
  faces.forEach((face, index) => {
    out.addTriangle(
      roof.slot,
      roof.ref,
      face,
      normals[index] as Vec3,
      [
        [0, half + o],
        [a1 - a0 + 2 * o, half + o],
        [(a1 - a0) / 2 + o, 0],
      ],
      roof.color,
    );
  });
  for (const side of ['b0', 'b1', 'a0', 'a1'] as const) {
    addEaveTrim(space, side, input.eave, o, input.rise, input, out);
  }
}

function buildShed(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const roof = input.surfaces.roof;
  const wall = input.surfaces.wall;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const depth = b1 - b0;
  const yH = input.eave + depth * input.rise;
  const up = input.shedDirection;
  const low = up === 1 ? b0 : b1;
  const high = up === 1 ? b1 : b0;
  const lowEdge = up === 1 ? low - o : low + o;
  const yE = input.eave - o * input.rise;
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(a0, lowEdge, yE),
      space.point(a1, lowEdge, yE),
      space.point(a1, high, yH),
      space.point(a0, high, yH),
    ],
    space.normal(0, -up * input.rise, 1),
    [metersUv(a0, depth + o), metersUv(a1, depth + o), metersUv(a1, 0), metersUv(a0, 0)],
    roof.color,
  );
  // High wall strip closes the gap above the eave on the high side.
  out.addQuad(
    wall.slot,
    wall.ref,
    [
      space.point(a0, high, input.eave),
      space.point(a1, high, input.eave),
      space.point(a1, high, yH),
      space.point(a0, high, yH),
    ],
    space.normal(0, up, 0),
    [
      [0, 0],
      [a1 - a0, 0],
      [a1 - a0, yH - input.eave],
      [0, yH - input.eave],
    ],
    wall.color,
  );
  if (input.wing.endOnOutline[0]) {
    out.addTriangle(
      wall.slot,
      wall.ref,
      [
        space.point(a0, low, input.eave),
        space.point(a0, high, input.eave),
        space.point(a0, high, yH),
      ],
      space.normal(-1, 0, 0),
      [
        [0, 0],
        [depth, 0],
        [depth, yH - input.eave],
      ],
      wall.color,
    );
  }
  if (input.wing.endOnOutline[1]) {
    out.addTriangle(
      wall.slot,
      wall.ref,
      [
        space.point(a1, low, input.eave),
        space.point(a1, high, input.eave),
        space.point(a1, high, yH),
      ],
      space.normal(1, 0, 0),
      [
        [0, 0],
        [depth, 0],
        [depth, yH - input.eave],
      ],
      wall.color,
    );
  }
  addEaveTrim(space, up === 1 ? 'b0' : 'b1', input.eave, o, input.rise, input, out);
}

function buildMansard(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const roof = input.surfaces.roof;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const r2 = Math.max(input.lowerRise, 1);
  const halfMin = Math.min(a1 - a0, b1 - b0) / 2;
  const height = Math.min(2.2, 0.6 * halfMin * r2);
  const inset = height / r2;
  const yT = input.eave + height;
  const yE = input.eave - o * r2;
  const outer = {
    a0: a0 - o,
    a1: a1 + o,
    b0: b0 - o,
    b1: b1 + o,
  };
  const inner = { a0: a0 + inset, a1: a1 - inset, b0: b0 + inset, b1: b1 - inset };
  const sides: Array<{ quad: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3 }> = [
    {
      quad: [
        space.point(outer.a0, outer.b0, yE),
        space.point(outer.a1, outer.b0, yE),
        space.point(inner.a1, inner.b0, yT),
        space.point(inner.a0, inner.b0, yT),
      ],
      normal: space.normal(0, -r2, 1),
    },
    {
      quad: [
        space.point(outer.a1, outer.b0, yE),
        space.point(outer.a1, outer.b1, yE),
        space.point(inner.a1, inner.b1, yT),
        space.point(inner.a1, inner.b0, yT),
      ],
      normal: space.normal(r2, 0, 1),
    },
    {
      quad: [
        space.point(outer.a1, outer.b1, yE),
        space.point(outer.a0, outer.b1, yE),
        space.point(inner.a0, inner.b1, yT),
        space.point(inner.a1, inner.b1, yT),
      ],
      normal: space.normal(0, r2, 1),
    },
    {
      quad: [
        space.point(outer.a0, outer.b1, yE),
        space.point(outer.a0, outer.b0, yE),
        space.point(inner.a0, inner.b0, yT),
        space.point(inner.a0, inner.b1, yT),
      ],
      normal: space.normal(-r2, 0, 1),
    },
  ];
  for (const side of sides) {
    out.addQuad(
      roof.slot,
      roof.ref,
      side.quad,
      side.normal,
      [
        [0, height + o],
        [1, height + o],
        [1, 0],
        [0, 0],
      ],
      roof.color,
    );
  }
  out.addQuad(
    roof.slot,
    roof.ref,
    [
      space.point(inner.a0, inner.b0, yT),
      space.point(inner.a1, inner.b0, yT),
      space.point(inner.a1, inner.b1, yT),
      space.point(inner.a0, inner.b1, yT),
    ],
    [0, 1, 0],
    [
      metersUv(inner.a0, inner.b0),
      metersUv(inner.a1, inner.b0),
      metersUv(inner.a1, inner.b1),
      metersUv(inner.a0, inner.b1),
    ],
    roof.color,
  );
  for (const side of ['b0', 'b1', 'a0', 'a1'] as const) {
    addEaveTrim(space, side, input.eave, o, r2, input, out);
  }
}

function buildGambrel(input: WingRoofInput, out: MeshBufferBuilder): void {
  const space = wingSpace(input.wing, input.frame);
  const { a0, a1, b0, b1 } = space;
  const roof = input.surfaces.roof;
  const wall = input.surfaces.wall;
  const o = input.tier >= 2 ? 0 : input.overhang;
  const r2 = Math.max(input.lowerRise, input.rise);
  const hd = (b1 - b0) / 2;
  const bc = (b0 + b1) / 2;
  const knee = 0.55 * hd;
  const y1 = input.eave + knee * r2;
  const yR = y1 + (hd - knee) * input.rise;
  const yE = input.eave - o * r2;
  const sides: Array<{ sign: 1 | -1; edge: number }> = [
    { sign: -1, edge: b0 },
    { sign: 1, edge: b1 },
  ];
  for (const { sign, edge } of sides) {
    const eaveB = edge + sign * o;
    const kneeB = edge - sign * knee;
    out.addQuad(
      roof.slot,
      roof.ref,
      [
        space.point(a0, eaveB, yE),
        space.point(a1, eaveB, yE),
        space.point(a1, kneeB, y1),
        space.point(a0, kneeB, y1),
      ],
      space.normal(0, sign * r2, 1),
      [metersUv(a0, knee + o), metersUv(a1, knee + o), metersUv(a1, 0), metersUv(a0, 0)],
      roof.color,
    );
    out.addQuad(
      roof.slot,
      roof.ref,
      [
        space.point(a0, kneeB, y1),
        space.point(a1, kneeB, y1),
        space.point(a1, bc, yR),
        space.point(a0, bc, yR),
      ],
      space.normal(0, sign * input.rise, 1),
      [metersUv(a0, hd - knee), metersUv(a1, hd - knee), metersUv(a1, 0), metersUv(a0, 0)],
      roof.color,
    );
  }
  const ends: Array<{ a: number; sign: 1 | -1; visible: boolean }> = [
    { a: a0, sign: -1, visible: input.wing.endOnOutline[0] },
    { a: a1, sign: 1, visible: input.wing.endOnOutline[1] },
  ];
  for (const end of ends) {
    if (!end.visible) continue;
    out.addConvexPolygon(
      wall.slot,
      wall.ref,
      [
        space.point(end.a, b0, input.eave),
        space.point(end.a, b0 + knee, y1),
        space.point(end.a, bc, yR),
        space.point(end.a, b1 - knee, y1),
        space.point(end.a, b1, input.eave),
      ],
      space.normal(end.sign, 0, 0),
      (p) => [p[0] + p[2], p[1] - input.eave],
      wall.color,
    );
  }
  addEaveTrim(space, 'b0', input.eave, o, r2, input, out);
  addEaveTrim(space, 'b1', input.eave, o, r2, input, out);
}

const BUILDERS: Readonly<
  Record<WingRoofKind, (input: WingRoofInput, out: MeshBufferBuilder) => void>
> = {
  gable: buildGable,
  hip: buildHip,
  pyramid: buildPyramid,
  shed: buildShed,
  mansard: buildMansard,
  gambrel: buildGambrel,
};

export function buildWingRoof(
  kind: WingRoofKind,
  input: WingRoofInput,
  out: MeshBufferBuilder,
): void {
  BUILDERS[kind](input, out);
}

export interface ParapetSpec {
  height: number;
  thickness: number;
}

/** Flat cap over the whole outline at `eave`, with an optional parapet ring. */
export function buildFlatRoof(
  outline: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
  eave: number,
  parapet: ParapetSpec | undefined,
  surfaces: RoofSurfaces,
  tier: number,
  out: MeshBufferBuilder,
): boolean {
  const roof = surfaces.roof;
  const ok = out.addCap(
    roof.slot,
    roof.ref,
    outline,
    holes,
    () => eave,
    [0, 1, 0],
    (p) => [p[0], p[1]],
    roof.color,
  );
  if (!ok) return false;
  if (parapet === undefined || tier >= 2) return true;
  const trim = surfaces.trim;
  const top = eave + parapet.height;
  const inner = offsetRing(outline, -parapet.thickness);
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    const ia = inner[index] as Vec2;
    const ib = inner[(index + 1) % inner.length] as Vec2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz) || 1;
    const outward: Vec3 = [dz / length, 0, -dx / length];
    out.addQuad(
      trim.slot,
      trim.ref,
      [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      outward,
      [
        [0, 0],
        [length, 0],
        [length, parapet.height],
        [0, parapet.height],
      ],
      trim.color,
    );
    out.addQuad(
      trim.slot,
      trim.ref,
      [
        [ia[0], eave, ia[1]],
        [ib[0], eave, ib[1]],
        [ib[0], top, ib[1]],
        [ia[0], top, ia[1]],
      ],
      [-outward[0], 0, -outward[2]],
      [
        [0, 0],
        [length, 0],
        [length, parapet.height],
        [0, parapet.height],
      ],
      trim.color,
    );
    out.addQuad(
      trim.slot,
      trim.ref,
      [
        [a[0], top, a[1]],
        [b[0], top, b[1]],
        [ib[0], top, ib[1]],
        [ia[0], top, ia[1]],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [length, 0],
        [length, parapet.thickness],
        [0, parapet.thickness],
      ],
      trim.color,
    );
  }
  return true;
}

export interface SkillionPlane {
  eave: number;
  rise: number;
  /** +1 rises toward +v of the frame, -1 toward -v. */
  direction: 1 | -1;
}

/** Single sloped cap over the whole outline; returns the top height function for the walls. */
export function buildSkillionRoof(
  outline: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
  frame: Frame,
  plane: SkillionPlane,
  surfaces: RoofSurfaces,
  out: MeshBufferBuilder,
): ((p: Vec2) => number) | undefined {
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (const point of outline) {
    const v = toLocal(frame, point)[1];
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const topAt = (p: Vec2): number => {
    const v = toLocal(frame, p)[1];
    const run = plane.direction === 1 ? v - minV : maxV - v;
    return plane.eave + plane.rise * run;
  };
  const direction = directionToWorld(frame, [0, -plane.direction * plane.rise]);
  const normal = normalize3([direction[0], 1, direction[1]]);
  const roof = surfaces.roof;
  const ok = out.addCap(
    roof.slot,
    roof.ref,
    outline,
    holes,
    topAt,
    normal,
    (p) => [p[0], p[1]],
    roof.color,
  );
  return ok ? topAt : undefined;
}
