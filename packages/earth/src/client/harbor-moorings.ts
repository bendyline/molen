/**
 * Boats moored at a tile's docks: deterministic berths along the mapped piers and floating docks
 * that stand in open water, filled most near a mapped marina and sparsely at a private dock.
 *
 * Maps draw a marina as a point (Protomaps `marina`) with its docks as `pier` land-use polygons or
 * pier paths. A dock edge that faces water takes boats three ways: tied alongside an edge long
 * enough for one (a finger pier, a side-tie dock); bow-in in a row of slips along a long, narrow
 * marina walk with no mapped fingers; and one boat in each short gap between mapped fingers. Every
 * hull must lie on water, clear of docks, buildings (floating homes) and the boats already placed.
 * A berth belongs to the tile its center lies in, and the choices are hashed from world positions,
 * so a tile and its neighbors and a reload agree on what is moored where.
 *
 * Related: harbors.ts (draws them and the cruising boats), harbor-geometry.ts.
 */
import {
  type HarborPolygon,
  type HarborRect,
  type HarborRing,
  harborHash,
  harborRectsOverlap,
  harborRingArea,
  harborRingPerimeter,
  segmentPointDistance2,
} from './harbor-geometry';

/** A boat type that may be moored, with its draw weight at each kind of dock. */
export interface HarborBoatKind {
  id: string;
  length: number;
  width: number;
  /** Relative prevalence at marina docks, private docks and wide commercial piers. */
  weights: { marina: number; private: number; commercial: number };
  /** Hull paints to choose from (`#rrggbb`); empty keeps the model's own. */
  paints: readonly string[];
}

/** A water polygon and the height its surface is drawn at. */
export interface HarborWater {
  polygon: HarborPolygon;
  height: number;
}

/** A mapped dock or pier outline. */
export interface HarborDock {
  polygon: HarborPolygon;
  /** Mean width, meters (twice the area over the perimeter). */
  width: number;
}

/** A dock mapped as a path: its points and half its walking width. */
export interface HarborDockLine {
  points: HarborRing;
  halfWidth: number;
}

/** A mapped place that fills nearby docks: a marina, a yacht club, a boat rental. */
export interface HarborAnchor {
  x: number;
  z: number;
  radius: number;
  /** Share of berths in use within `radius`. */
  occupancy: number;
}

/** What a tile offers for mooring, in absolute world meters. */
export interface HarborTileShapes {
  /** The tile's corner and edge length: berths whose center lies outside belong elsewhere. */
  origin: readonly [number, number];
  size: number;
  water: readonly HarborWater[];
  docks: readonly HarborDock[];
  dockLines: readonly HarborDockLine[];
  /** Footprints a hull must keep off (buildings, including floating homes). */
  solids: readonly HarborPolygon[];
  anchors: readonly HarborAnchor[];
}

/** One moored boat. */
export interface HarborMooring {
  /** Stable across reloads: the type and where it lies. */
  key: string;
  type: string;
  x: number;
  y: number;
  z: number;
  /** Heading of the bow (0 faces +Z). */
  yaw: number;
  length: number;
  width: number;
  paint?: string;
  /** 0..1, for bobbing out of step with the neighbors. */
  phase: number;
}

/** Occupancy where no anchor reaches: a private dock, a wide commercial pier. */
const PRIVATE_OCCUPANCY = 0.32;
/**
 * A dock with fingers (three or more notches in its outline, or a pier path three or more others
 * branch from) is a marina's, filled like one, whether or not the map's marina point is in reach:
 * a large marina runs on past its point's radius and across tile edges, where no anchor is seen.
 */
const COMB_OCCUPANCY = 0.8;
const COMB_FINGERS = 3;
const COMMERCIAL_OCCUPANCY = 0.22;
/** A dock wider than this (meters) is a pier, not a floating dock. */
const COMMERCIAL_WIDTH = 10;
/** Slips bow-in along a marina walk: their spacing and the walk length that gets them. */
const SLIP_PITCH = 5.2;
const SLIP_WALK = 18;
/** Fender gap between a hull and its dock, meters. */
const FENDER = 0.55;
/** Most boats one tile moors. */
const DEFAULT_MAX = 1200;

interface Edge {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Unit direction a→b and the outward normal (toward the water). */
  dx: number;
  dz: number;
  nx: number;
  nz: number;
  length: number;
  /** Offset from the edge line to the dock's side (half a path's width; 0 for an outline). */
  offset: number;
  narrow: boolean;
  wide: boolean;
  /** The bottom of a notch in a dock's outline (both corners turn in): a slip between fingers. */
  notch: boolean;
  /** Its dock has fingers: a marina's (see COMB_OCCUPANCY). */
  comb: boolean;
}

type Setting = 'marina' | 'private' | 'commercial';

/**
 * The boats moored in a tile. A generator: it yields every few dozen dock edges so a caller can
 * spread the work over frames, and returns the berths.
 */
export function* placeHarborMoorings(
  shapes: HarborTileShapes,
  kinds: readonly HarborBoatKind[],
  options: { max?: number } = {},
): Generator<undefined, HarborMooring[], void> {
  const placed: HarborMooring[] = [];
  if (kinds.length === 0 || shapes.water.length === 0) return placed;
  if (shapes.docks.length === 0 && shapes.dockLines.length === 0) return placed;
  const max = options.max ?? DEFAULT_MAX;
  const [ox, oz] = shapes.origin;
  const owned = (x: number, z: number): boolean =>
    x >= ox && z >= oz && x < ox + shapes.size && z < oz + shapes.size;
  const waterAt = (x: number, z: number): HarborWater | undefined => {
    for (const water of shapes.water) if (water.polygon.contains(x, z)) return water;
    return undefined;
  };
  const onDock = (x: number, z: number, margin: number): boolean => {
    for (const dock of shapes.docks) if (dock.polygon.near(x, z, margin)) return true;
    for (const line of shapes.dockLines) {
      const r = line.halfWidth + margin;
      const p = line.points;
      for (let i = 2; i < p.length; i += 2)
        if (
          segmentPointDistance2(
            p[i - 2] as number,
            p[i - 1] as number,
            p[i] as number,
            p[i + 1] as number,
            x,
            z,
          ) <=
          r * r
        )
          return true;
    }
    return false;
  };
  const onSolid = (x: number, z: number): boolean => {
    for (const solid of shapes.solids) if (solid.near(x, z, 1.2)) return true;
    return false;
  };
  // Placed hulls by 24 m cell, for the overlap test.
  const cells = new Map<string, HarborRect[]>();
  const cellOf = (x: number, z: number): string => `${Math.floor(x / 24)}:${Math.floor(z / 24)}`;
  const overlaps = (rect: HarborRect): boolean => {
    const cx = Math.floor(rect.x / 24);
    const cz = Math.floor(rect.z / 24);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const other of cells.get(`${cx + i}:${cz + j}`) ?? [])
          if (harborRectsOverlap(rect, other, 0.35)) return true;
    return false;
  };
  const occupancyAt = (x: number, z: number): { setting: Setting; occupancy: number } => {
    let best = 0;
    for (const anchor of shapes.anchors) {
      const d = Math.hypot(anchor.x - x, anchor.z - z);
      if (d <= anchor.radius)
        best = Math.max(best, anchor.occupancy * (d < anchor.radius * 0.7 ? 1 : 0.75));
    }
    return best > 0
      ? { setting: 'marina', occupancy: best }
      : { setting: 'private', occupancy: PRIVATE_OCCUPANCY };
  };
  /** The kinds that fit, the weighted draw for `u` first, then the rest by weight. */
  const choices = (
    setting: Setting,
    u: number,
    fits: (kind: HarborBoatKind) => boolean,
  ): HarborBoatKind[] => {
    const fitting = kinds.filter((kind) => kind.weights[setting] > 0 && fits(kind));
    let total = 0;
    for (const kind of fitting) total += kind.weights[setting];
    let left = u * total;
    let first = fitting.at(-1);
    for (const kind of fitting) {
      left -= kind.weights[setting];
      if (left < 0) {
        first = kind;
        break;
      }
    }
    if (first === undefined) return [];
    return [
      first,
      ...fitting.filter((k) => k !== first).sort((a, b) => b.weights[setting] - a.weights[setting]),
    ];
  };
  /** Moor `kind` with its center at (x, z) heading `yaw`, if the hull lies clear on water. */
  const moor = (kind: HarborBoatKind, x: number, z: number, yaw: number): boolean => {
    if (!owned(x, z) || placed.length >= max) return false;
    const water = waterAt(x, z);
    if (water === undefined) return false;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const hl = kind.length / 2;
    const hw = kind.width / 2;
    for (const [along, across] of [
      [0.97, 0],
      [-0.97, 0],
      [0.55, 0.8],
      [0.55, -0.8],
      [-0.75, 0.9],
      [-0.75, -0.9],
      [0, 0.95],
      [0, -0.95],
    ] as const) {
      const px = x + fx * hl * along + fz * hw * across;
      const pz = z + fz * hl * along - fx * hw * across;
      if (waterAt(px, pz) === undefined || onDock(px, pz, 0.15) || onSolid(px, pz)) return false;
    }
    const rect: HarborRect = { x, z, yaw, halfLength: hl, halfWidth: hw };
    if (overlaps(rect)) return false;
    const key = cellOf(x, z);
    const list = cells.get(key);
    if (list) list.push(rect);
    else cells.set(key, [rect]);
    const paints = kind.paints;
    const paint =
      paints.length > 0
        ? paints[Math.floor(harborHash(x, z, 41) * paints.length) % paints.length]
        : undefined;
    placed.push({
      key: `${kind.id}@${Math.round(x * 2)}:${Math.round(z * 2)}`,
      type: kind.id,
      x,
      y: water.height,
      z,
      yaw,
      length: kind.length,
      width: kind.width,
      ...(paint !== undefined ? { paint } : {}),
      phase: harborHash(x, z, 43),
    });
    return true;
  };

  const edges = collectEdges(shapes, (x, z) => waterAt(x, z) !== undefined, onDock);
  // Long edges first and the gaps between fingers last, so a boat tied alongside a finger wins
  // the slip over one squared into the gap.
  edges.sort((a, b) => Number(a.notch) - Number(b.notch) || b.length - a.length);
  let work = 0;
  for (const edge of edges) {
    if (placed.length >= max) break;
    if (++work % 24 === 0) yield;
    const mx = (edge.ax + edge.bx) / 2;
    const mz = (edge.az + edge.bz) / 2;
    const anchored = occupancyAt(mx, mz);
    const near =
      anchored.setting === 'private' && edge.comb
        ? { setting: 'marina' as const, occupancy: COMB_OCCUPANCY }
        : anchored;
    const setting: Setting = near.setting === 'private' && edge.wide ? 'commercial' : near.setting;
    const occupancy =
      setting === 'commercial'
        ? COMMERCIAL_OCCUPANCY
        : near.setting === 'marina'
          ? near.occupancy
          : PRIVATE_OCCUPANCY;
    if (edge.notch && setting !== 'commercial') {
      gap(edge, occupancy, setting);
      continue;
    }
    if (setting === 'marina' && edge.narrow && edge.length >= SLIP_WALK) {
      slips(edge, occupancy, setting);
      continue;
    }
    if (edge.length >= 6) alongside(edge, occupancy, setting);
  }
  return placed;

  /**
   * A boat square to the edge, bow or stern to the dock, `at(kind)` meters along it: the first
   * kind no wider than `beam` that fits. (px, pz) is the station that seeds the choices.
   */
  function square(
    edge: Edge,
    px: number,
    pz: number,
    setting: Setting,
    beam: number,
    at?: (kind: HarborBoatKind) => number,
  ): void {
    const bowIn = harborHash(px, pz, 13) < 0.45;
    const yaw = Math.atan2(bowIn ? -edge.nx : edge.nx, bowIn ? -edge.nz : edge.nz);
    for (const kind of choices(setting, harborHash(px, pz, 12), (k) => k.width <= beam)) {
      const s = at?.(kind);
      const x = s === undefined ? px : edge.ax + edge.dx * s;
      const z = s === undefined ? pz : edge.az + edge.dz * s;
      const reach = edge.offset + FENDER + kind.length / 2;
      if (moor(kind, x + edge.nx * reach, z + edge.nz * reach, yaw)) return;
    }
  }

  /**
   * The gap between two mapped fingers: as many slips across it as fit. Two boats in a double
   * slip each lie against a finger, fendered off it, as they are tied.
   */
  function gap(edge: Edge, occupancy: number, setting: Setting): void {
    const count = Math.max(1, Math.floor(edge.length / 4.4));
    const pitch = edge.length / count;
    for (let k = 0; k < count; k++) {
      const s = (k + 0.5) * pitch;
      const px = edge.ax + edge.dx * s;
      const pz = edge.az + edge.dz * s;
      if (harborHash(px, pz, 7) >= occupancy) continue;
      const against =
        count === 2
          ? (kind: HarborBoatKind): number =>
              k === 0 ? FENDER + kind.width / 2 : edge.length - FENDER - kind.width / 2
          : undefined;
      square(edge, px, pz, setting, pitch - 0.5, against);
    }
  }

  /** Boats bow- or stern-in at world-anchored slip stations along a long walk. */
  function slips(edge: Edge, occupancy: number, setting: Setting): void {
    const along = (x: number, z: number): number => x * edge.dx + z * edge.dz;
    const s0 = along(edge.ax, edge.az);
    const first = Math.ceil((s0 + 2) / SLIP_PITCH);
    const last = Math.floor((s0 + edge.length - 2) / SLIP_PITCH);
    for (let k = first; k <= last; k++) {
      const s = k * SLIP_PITCH - s0;
      const px = edge.ax + edge.dx * s;
      const pz = edge.az + edge.dz * s;
      if (harborHash(px, pz, 11) < occupancy) square(edge, px, pz, setting, SLIP_PITCH - 0.6);
    }
  }

  /** Boats tied alongside, bow one way or the other, one after another down the edge. */
  function alongside(edge: Edge, occupancy: number, setting: Setting): void {
    let s = 0.6;
    while (s < edge.length - 2) {
      const px = edge.ax + edge.dx * s;
      const pz = edge.az + edge.dz * s;
      const room = edge.length - s;
      // A boat may run on past the end of a short finger by a quarter of its length.
      const options = choices(setting, harborHash(px, pz, 21), (k) => k.length * 0.75 <= room);
      const first = options[0];
      if (first === undefined) break;
      if (harborHash(px, pz, 22) >= occupancy) {
        s += Math.min(first.length, 9) + 1.2;
        continue;
      }
      const forward = harborHash(px, pz, 23) < 0.5;
      const yaw = Math.atan2(forward ? edge.dx : -edge.dx, forward ? edge.dz : -edge.dz);
      const kind = options.find((k) => {
        const mid = s + k.length / 2;
        const reach = edge.offset + FENDER + k.width / 2;
        return moor(
          k,
          edge.ax + edge.dx * mid + edge.nx * reach,
          edge.az + edge.dz * mid + edge.nz * reach,
          yaw,
        );
      });
      s += kind !== undefined ? kind.length + 1.4 : 2.5;
    }
  }
}

/** The dock edges that face water: outline edges outward, both sides of each pier path. */
function collectEdges(
  shapes: HarborTileShapes,
  water: (x: number, z: number) => boolean,
  onDock: (x: number, z: number, margin: number) => boolean,
): Edge[] {
  const edges: Edge[] = [];
  const add = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    nx: number,
    nz: number,
    offset: number,
    narrow: boolean,
    wide: boolean,
    notch: boolean,
    comb: boolean,
  ): void => {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 3.4) return;
    // Water a few meters out, clear of other docks: this side is open to boats.
    const mx = (ax + bx) / 2 + nx * (offset + 3);
    const mz = (az + bz) / 2 + nz * (offset + 3);
    if (!water(mx, mz) || onDock(mx, mz, 0.2)) return;
    edges.push({
      ax,
      az,
      bx,
      bz,
      dx: (bx - ax) / length,
      dz: (bz - az) / length,
      nx,
      nz,
      length,
      offset,
      narrow,
      wide,
      notch,
      comb,
    });
  };
  for (const dock of shapes.docks) {
    const ring = dock.polygon.rings[0];
    if (ring === undefined || ring.length < 6) continue;
    // Counterclockwise in X/Z (+Z south) puts the outside on the right of each edge.
    const ccw = harborRingArea(ring) > 0;
    const n = ring.length / 2;
    const x = (k: number): number => ring[((k + n) % n) * 2] as number;
    const z = (k: number): number => ring[((k + n) % n) * 2 + 1] as number;
    // A corner turning toward the outside (a reflex corner) opens a notch.
    const reflex = (k: number): boolean => {
      const cross = (x(k) - x(k - 1)) * (z(k + 1) - z(k)) - (z(k) - z(k - 1)) * (x(k + 1) - x(k));
      return ccw ? cross < -1e-6 : cross > 1e-6;
    };
    const notches: boolean[] = [];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const length = Math.hypot(x(i) - x(j), z(i) - z(j));
      notches.push(length >= 3.4 && length < 24 && reflex(j) && reflex(i));
    }
    const comb = notches.filter(Boolean).length >= COMB_FINGERS;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = x(j);
      const az = z(j);
      const bx = x(i);
      const bz = z(i);
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 3.4) continue;
      const dx = (bx - ax) / length;
      const dz = (bz - az) / length;
      const nx = ccw ? dz : -dz;
      const nz = ccw ? -dx : dx;
      const wide = dock.width > COMMERCIAL_WIDTH;
      add(ax, az, bx, bz, nx, nz, 0, dock.width <= 8, wide, notches[i] === true, comb && !wide);
    }
  }
  // A pier path that three or more others end on is a marina walk with its fingers.
  const branches = shapes.dockLines.map((line) => {
    let count = 0;
    for (const other of shapes.dockLines) {
      if (other === line) continue;
      const q = other.points;
      for (const end of [0, q.length - 2])
        if (nearLine(line.points, q[end] as number, q[end + 1] as number, line.halfWidth + 1.5)) {
          count++;
          break;
        }
    }
    return count;
  });
  for (const [index, line] of shapes.dockLines.entries()) {
    const comb = (branches[index] ?? 0) >= COMB_FINGERS;
    const p = line.points;
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2] as number;
      const az = p[i - 1] as number;
      const bx = p[i] as number;
      const bz = p[i + 1] as number;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 3.4) continue;
      const dx = (bx - ax) / length;
      const dz = (bz - az) / length;
      add(ax, az, bx, bz, dz, -dx, line.halfWidth, true, false, false, comb);
      add(ax, az, bx, bz, -dz, dx, line.halfWidth, true, false, false, comb);
    }
  }
  return edges;
}

/** Whether (x, z) lies within `radius` of the polyline `points`. */
function nearLine(points: HarborRing, x: number, z: number, radius: number): boolean {
  for (let i = 2; i < points.length; i += 2)
    if (
      segmentPointDistance2(
        points[i - 2] as number,
        points[i - 1] as number,
        points[i] as number,
        points[i + 1] as number,
        x,
        z,
      ) <=
      radius * radius
    )
      return true;
  return false;
}

/** A dock outline's mean width: twice its area over its perimeter. */
export function harborDockWidth(ring: HarborRing): number {
  const perimeter = harborRingPerimeter(ring);
  return perimeter > 0 ? (2 * Math.abs(harborRingArea(ring))) / perimeter : 0;
}
