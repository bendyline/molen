/**
 * Facade elements on top of plain walls: punched, ribbon, or grid windows per bay and floor,
 * storefront glazing on the ground floor, and trim bands (base band, floor lines, cornice).
 * Glazing stays on the wall plane; near detail adds raised surrounds and projecting trim.
 * Texture repeats follow windows/bays, while trim uses metric UVs.
 */

import type { ArchFacadeDetails } from './archstyle-types';
import { buildFacadeDetails, type FacadeDetailWindow } from './facade-details';
import type { BuildingOpening } from './interior-types';
import type { MeshBufferBuilder } from './mesh-buffers';
import { hashCoord, unit01 } from './seed';
import type { Vec2, Vec3 } from './types';
import type { WallSurface } from './walls';

export interface FacadeWindows {
  style: 'punched' | 'ribbon' | 'grid' | 'none';
  /** Window width in meters (clamped to the bay). */
  width: number;
  /** Window height in meters (clamped to the floor). */
  height: number;
  /** Sill height above the floor in meters. */
  sill: number;
  probabilityPerBay: number;
  groundFloor: 'same' | 'storefront' | 'none';
}

export interface FacadeBands {
  /** Base band height in meters; 0 disables. */
  baseHeight: number;
  floorLines: boolean;
  /** Cornice height in meters; 0 disables. */
  corniceHeight: number;
}

export interface FacadeInput {
  /** Outer ring first, holes after (canonical orientation, as for walls). */
  rings: readonly (readonly Vec2[])[];
  /** Wall base height. */
  base: number;
  /** Wall top at a 2D point. */
  topAt: (p: Vec2) => number;
  floorHeight: number;
  groundFloorHeight: number;
  /** Resolved storeys; prevents a leftover strip below the roof becoming another floor. */
  floorCount?: number;
  bayWidth: number;
  cornerMargin: number;
  /** Seed for per-bay draws. */
  salt: number;
  windows?: FacadeWindows;
  /** Budget fallback: sample existing bays/floors without changing their positions or seeds. */
  maxWindowColumns?: number;
  maxWindowRows?: number;
  bands?: FacadeBands;
  /** Raised window surrounds and mullions, admitted with the full facade detail tier. */
  relief?: boolean;
  window: WallSurface;
  trim: WallSurface;
  roof?: WallSurface;
  details?: ArchFacadeDetails;
  /** Raised building parts cannot support a ground veranda. */
  raised?: boolean;
  /** Outer-ring edges on a cut boundary get no elements. */
  seamEdges?: ReadonlySet<number>;
  /** Ground frontage supplied by structural door/window openings. */
  openGroundEdges?: ReadonlySet<number>;
  structuralOpenings?: readonly {
    edge: number;
    bottom: number;
    top: number;
    start?: number;
    end?: number;
  }[];
}

export interface FacadeStats {
  windows: number;
  storefronts: number;
  bands: number;
}

const WINDOW_PROUD = 0.03;
const FLOOR_LINE_HEIGHT = 0.12;
const MIN_STOREFRONT_LENGTH = 2;

interface Edge {
  a: Vec2;
  dir: Vec2;
  normal: Vec3;
  length: number;
  top: number;
  flatTop: boolean;
  key: number;
}

function edgeOf(
  ring: readonly Vec2[],
  index: number,
  ringIndex: number,
  input: Pick<FacadeInput, 'topAt'>,
): Edge {
  const a = ring[index] as Vec2;
  const b = ring[(index + 1) % ring.length] as Vec2;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  const topA = input.topAt(a);
  const topB = input.topAt(b);
  return {
    a,
    dir: [dx / length, dz / length],
    normal: [dz / length, 0, -dx / length],
    length,
    top: Math.min(topA, topB),
    flatTop: Math.abs(topA - topB) < 0.01,
    key: ringIndex * 4096 + index,
  };
}

/** Quad on the wall plane between distances s0..s1 along the edge and heights y0..y1. */
function wallQuad(
  edge: Edge,
  proud: number,
  s0: number,
  s1: number,
  y0: number,
  y1: number,
  uv: readonly [Vec2, Vec2, Vec2, Vec2],
  surface: WallSurface,
  out: MeshBufferBuilder,
): void {
  const ox = edge.normal[0] * proud;
  const oz = edge.normal[2] * proud;
  const p = (s: number, y: number): Vec3 => [
    edge.a[0] + edge.dir[0] * s + ox,
    y,
    edge.a[1] + edge.dir[1] * s + oz,
  ];
  out.addQuad(
    surface.slot,
    surface.ref,
    [p(s0, y0), p(s1, y0), p(s1, y1), p(s0, y1)],
    edge.normal,
    uv,
    surface.color,
  );
}

const UNIT_UV: readonly [Vec2, Vec2, Vec2, Vec2] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function metricUv(s0: number, s1: number, y0: number, y1: number): [Vec2, Vec2, Vec2, Vec2] {
  return [
    [s0, y0],
    [s1, y0],
    [s1, y1],
    [s0, y1],
  ];
}

/** Front plus exposed returns of a rectangular moulding; no hidden back face. */
function moulding(
  edge: Edge,
  s0: number,
  s1: number,
  y0: number,
  y1: number,
  depth: number,
  surface: WallSurface,
  out: MeshBufferBuilder,
): void {
  wallQuad(edge, depth, s0, s1, y0, y1, metricUv(s0, s1, y0, y1), surface, out);
  const p = (s: number, y: number, d: number): Vec3 => [
    edge.a[0] + edge.dir[0] * s + edge.normal[0] * d,
    y,
    edge.a[1] + edge.dir[1] * s + edge.normal[2] * d,
  ];
  for (const [y, sign] of [
    [y0, -1],
    [y1, 1],
  ] as const)
    out.addQuad(
      surface.slot,
      surface.ref,
      [p(s0, y, 0), p(s1, y, 0), p(s1, y, depth), p(s0, y, depth)],
      [0, sign, 0],
      metricUv(s0, s1, 0, depth),
      surface.color,
    );
}

/** A continuous surround with an open center. Simplified frames use only 3–4 front quads. */
function windowFrame(
  edge: Edge,
  s0: number,
  s1: number,
  y0: number,
  y1: number,
  surface: WallSurface,
  out: MeshBufferBuilder,
  relief: boolean,
  door = false,
): void {
  const width = 0.1;
  const depth = relief ? 0.14 : 0.045;
  const strips = [
    [s0 - width, s0, y0, y1],
    [s1, s1 + width, y0, y1],
    [s0 - width, s1 + width, y1, y1 + width],
    ...(!door ? [[s0 - width, s1 + width, y0 - width, y0]] : []),
  ];
  for (const [a, b, c, d] of strips as Array<[number, number, number, number]>)
    wallQuad(edge, depth, a, b, c, d, metricUv(a, b, c, d), surface, out);
  if (!relief) return;
  const p = (s: number, y: number, forward: number): Vec3 => [
    edge.a[0] + edge.dir[0] * s + edge.normal[0] * forward,
    y,
    edge.a[1] + edge.dir[1] * s + edge.normal[2] * forward,
  ];
  for (const [s, sign] of [
    [s0, 1],
    [s1, -1],
  ] as const)
    out.addQuad(
      surface.slot,
      surface.ref,
      [p(s, y0, 0), p(s, y1, 0), p(s, y1, depth), p(s, y0, depth)],
      [edge.dir[0] * sign, 0, edge.dir[1] * sign],
      metricUv(0, depth, y0, y1),
      surface.color,
    );
  out.addQuad(
    surface.slot,
    surface.ref,
    [p(s0, y1, 0), p(s1, y1, 0), p(s1, y1, depth), p(s0, y1, depth)],
    [0, -1, 0],
    metricUv(s0, s1, 0, depth),
    surface.color,
  );
  if (!door)
    out.addQuad(
      surface.slot,
      surface.ref,
      [
        p(s0 - width, y0, 0),
        p(s1 + width, y0, 0),
        p(s1 + width, y0, depth + 0.06),
        p(s0 - width, y0, depth + 0.06),
      ],
      [0, 1, 0],
      metricUv(s0, s1, 0, depth + 0.06),
      surface.color,
    );
}

/** Permanent structural frames keep doors open without spending cuboids on hidden faces. */
export function buildOpeningFrames(
  outline: readonly Vec2[],
  openings: readonly BuildingOpening[],
  surface: WallSurface,
  relief: boolean,
  out: MeshBufferBuilder,
): void {
  for (const opening of openings) {
    const edge = edgeOf(outline, opening.edge, 0, { topAt: () => opening.top });
    windowFrame(
      edge,
      opening.start,
      opening.end,
      opening.bottom,
      opening.top,
      surface,
      out,
      relief,
      opening.kind === 'door',
    );
  }
}

function glazingFrame(
  edge: Edge,
  input: FacadeInput,
  out: MeshBufferBuilder,
  s0: number,
  s1: number,
  y0: number,
  y1: number,
  panes = 1,
): void {
  if (!input.relief) return;
  windowFrame(edge, s0, s1, y0, y1, input.trim, out, true);
  // Bound long retail ribbons; repeat the original pane grid rather than rescaling glazing.
  const stride = Math.max(1, Math.ceil(panes / 24));
  for (let pane = stride; pane < panes; pane += stride) {
    const s = s0 + ((s1 - s0) * pane) / panes;
    wallQuad(edge, 0.09, s - 0.035, s + 0.035, y0, y1, metricUv(0, 0.07, y0, y1), input.trim, out);
  }
}

/** Floors that fit under the edge top: [floor base, floor height] pairs. */
function floorsUnder(edge: Edge, input: FacadeInput): Array<[number, number]> {
  const floors: Array<[number, number]> = [];
  let y = input.base;
  for (let floor = 0; floor < Math.min(200, input.floorCount ?? 200); floor++) {
    const height = floor === 0 ? input.groundFloorHeight : input.floorHeight;
    if (y + Math.min(height, 1.2) > edge.top) break;
    floors.push([y, Math.min(height, edge.top - y)]);
    y += height;
  }
  return floors;
}

/** Evenly spaced members of the original grid (all members when uncapped). */
function* gridMembers(count: number, limit = count): Generator<number> {
  const kept = Math.max(0, Math.min(count, Math.floor(limit)));
  for (let index = 0; index < kept; index++) {
    yield kept === count ? index : Math.floor(((index + 0.5) * count) / kept);
  }
}

function buildWindows(
  edge: Edge,
  input: FacadeInput,
  out: MeshBufferBuilder,
  stats: FacadeStats,
  layout: FacadeDetailWindow[],
) {
  const windows = input.windows;
  if (windows === undefined) return;
  const usable = edge.length - 2 * input.cornerMargin;
  const bays = Math.floor(usable / input.bayWidth);
  const floors = floorsUnder(edge, input);
  [...gridMembers(floors.length, input.maxWindowRows)].forEach((floor) => {
    const [floorBase, floorHeight] = floors[floor] as [number, number];
    if (floor === 0 && input.openGroundEdges?.has(edge.key)) return;
    if (
      input.structuralOpenings?.some(
        (o) => o.edge === edge.key && o.bottom < floorBase + floorHeight && o.top > floorBase,
      )
    )
      return;
    if (floor === 0 && windows.groundFloor === 'none') return;
    if (floor === 0 && windows.groundFloor === 'storefront') {
      if (usable < MIN_STOREFRONT_LENGTH) return;
      const y0 = floorBase + 0.25;
      const y1 = Math.min(floorBase + floorHeight - 0.35, y0 + windows.height);
      if (y1 - y0 < 1) return;
      const s0 = input.cornerMargin;
      const s1 = edge.length - input.cornerMargin;
      const panes = Math.max(1, Math.round(usable / Math.min(input.bayWidth, windows.width)));
      wallQuad(
        edge,
        WINDOW_PROUD,
        s0,
        s1,
        y0,
        y1,
        [
          [0, 0],
          [panes, 0],
          [panes, 1],
          [0, 1],
        ],
        input.window,
        out,
      );
      stats.storefronts++;
      if (input.details) layout.push({ s0, s1, y0, y1, floor, bay: 0, storefront: true });
      glazingFrame(edge, input, out, s0, s1, y0, y1, panes);
      return;
    }
    if (windows.style === 'none' || bays <= 0) return;
    const start = (edge.length - bays * input.bayWidth) / 2;
    if (windows.style === 'ribbon') {
      const hash = hashCoord(edge.key, floor, input.salt);
      if (unit01(hash, 0) >= Math.max(windows.probabilityPerBay, 0.5)) return;
      const height = Math.min(windows.height, floorHeight - windows.sill - 0.25);
      if (height < 0.4) return;
      const y0 = floorBase + windows.sill;
      wallQuad(
        edge,
        WINDOW_PROUD,
        start,
        start + bays * input.bayWidth,
        y0,
        y0 + height,
        [
          [0, 0],
          [bays, 0],
          [bays, 1],
          [0, 1],
        ],
        input.window,
        out,
      );
      stats.windows += bays;
      if (input.details)
        layout.push({
          s0: start,
          s1: start + bays * input.bayWidth,
          y0,
          y1: y0 + height,
          floor,
          bay: 0,
        });
      glazingFrame(edge, input, out, start, start + bays * input.bayWidth, y0, y0 + height, bays);
      return;
    }
    const grid = windows.style === 'grid';
    const width = grid ? input.bayWidth - 0.3 : Math.min(windows.width, input.bayWidth - 0.4);
    const sill = grid ? 0.3 : windows.sill;
    const height = grid
      ? floorHeight - 0.55
      : Math.min(windows.height, floorHeight - windows.sill - 0.25);
    if (width < 0.4 || height < 0.4) return;
    for (const bay of gridMembers(bays, input.maxWindowColumns)) {
      const hash = hashCoord(edge.key, floor * 1024 + bay, input.salt);
      if (unit01(hash, 0) >= windows.probabilityPerBay) continue;
      const centre = start + (bay + 0.5) * input.bayWidth;
      const y0 = floorBase + sill;
      if (y0 + height > edge.top - 0.05) continue;
      wallQuad(
        edge,
        WINDOW_PROUD,
        centre - width / 2,
        centre + width / 2,
        y0,
        y0 + height,
        UNIT_UV,
        input.window,
        out,
      );
      stats.windows++;
      if (input.details)
        layout.push({
          s0: centre - width / 2,
          s1: centre + width / 2,
          y0,
          y1: y0 + height,
          floor,
          bay,
        });
      glazingFrame(edge, input, out, centre - width / 2, centre + width / 2, y0, y0 + height);
    }
  });
}

function buildBands(edge: Edge, input: FacadeInput, out: MeshBufferBuilder, stats: FacadeStats) {
  const bands = input.bands;
  if (bands === undefined) return;
  const y = input.base;
  if (
    !input.openGroundEdges?.has(edge.key) &&
    bands.baseHeight > 0 &&
    edge.top - y > bands.baseHeight + 0.5
  ) {
    moulding(edge, 0, edge.length, y, y + bands.baseHeight, 0.09, input.trim, out);
    stats.bands++;
  }
  if (bands.floorLines) {
    const floors = floorsUnder(edge, input);
    floors.forEach(([floorBase], floor) => {
      if (floor === 0) return;
      const y0 = floorBase - FLOOR_LINE_HEIGHT / 2;
      moulding(edge, 0, edge.length, y0, y0 + FLOOR_LINE_HEIGHT, 0.12, input.trim, out);
      stats.bands++;
    });
  }
  if (bands.corniceHeight > 0 && edge.flatTop && edge.top - y > bands.corniceHeight + 1) {
    moulding(edge, 0, edge.length, edge.top - bands.corniceHeight, edge.top, 0.24, input.trim, out);
    stats.bands++;
  }
}

/** Emit windows and bands for every edge of the rings; returns what was placed. */
export function buildFacade(input: FacadeInput, out: MeshBufferBuilder): FacadeStats {
  const stats: FacadeStats = { windows: 0, storefronts: 0, bands: 0 };
  const detailBudget = { remaining: 3600 };
  let remainingEdges = input.rings.reduce((count, ring) => count + ring.length, 0);
  input.rings.forEach((ring, ringIndex) => {
    for (let index = 0; index < ring.length; index++) {
      remainingEdges--;
      if (ringIndex === 0 && input.seamEdges?.has(index) === true) continue;
      const edge = edgeOf(ring, index, ringIndex, input);
      if (edge.length < 0.5 || edge.top - input.base < 1.2) continue;
      const layout: FacadeDetailWindow[] = [];
      buildWindows(edge, input, out, stats, layout);
      buildBands(edge, input, out, stats);
      if (input.details) {
        // Share ornament across the whole perimeter, independent of which edge appears first.
        // Unspent shares from small/blank walls remain available to the later edges.
        const allowance = Math.floor(detailBudget.remaining / (remainingEdges + 1));
        const edgeBudget = { remaining: allowance };
        buildFacadeDetails(edge, input, layout, out, edgeBudget);
        detailBudget.remaining -= allowance - edgeBudget.remaining;
      }
    }
  });
  return stats;
}
