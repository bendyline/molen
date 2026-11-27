/**
 * Three-free tunnel portals: where a mapped tunnel meets the way it continues, how far that way's
 * approach is cut down into the ground to meet it, and the floor a bore follows between portals.
 *
 * A map draws a tunnel as the stretch of road that is covered, and the road before it as an
 * ordinary one. The road before it is not on the ground: it runs down a cutting to the portal,
 * and the portal opens a clear height and some cover below the surface. An elevation model knows
 * nothing of either. Graded from the ground at one portal to the ground at the other, a bore under
 * a level city stood on the surface as a 6.5 m concrete box (the Eastern Distributor across
 * Sydney's Moore Park), and a street dipping under a motorway that sits on the ground was a box
 * across the motorway (every underpass of Alicante's ring road).
 *
 * So the approach is cut, as an engineer would cut it: down at its class's grade from the last
 * place it must stay on the ground (a junction, a crossing, a bridge) to the depth the bore needs,
 * and no deeper than the ground over the bore asks (a portal in a hillside has the hill over it
 * at once, and needs little or no cutting). The cutting is earthworks, applied by the road grading
 * (road-grading.ts) to the ground the approach is graded on, so the pavement, the traffic and
 * everything that drives agree. The bore (tunnels.ts) starts at the cutting's floor and keeps the
 * clear height and cover under the ground between its portals, as steeply as its class may climb.
 *
 * Every answer reads only what lies near the portal (its approach within `TERRAIN_TUNNEL_
 * CUTTING_REACH`, the bore within `TERRAIN_TUNNEL_INWARD_REACH`) and ground that is a function of
 * position alone, so two tiles that both see a portal cut it alike. It is an inference that yields
 * a buildable cutting, not a survey of the real one.
 *
 * Related: tunnels.ts (the bores), road-grading.ts (where cuttings are found and applied),
 * road-earthworks.ts (`RoadEarthworkLine.depths`), underpasses.ts (tunnel ways that are streets).
 */
import {
  clipRoadLine,
  isRoadEarthworkGraded,
  type RoadEarthworkLine,
  roadProfileHeight,
} from './road-earthworks';
import type { TerrainTransportationFeature } from './semantic-types';
import {
  isAeroway,
  type TransportKind,
  transportKind,
  transportSurfaceLift,
  transportWidth,
} from './transport-features';

/** What a tunnel carries, for how steeply it and its approach may climb. */
export type TerrainTunnelFamily = 'road' | 'rail' | 'path';

/** The family of a transport kind. */
export function terrainTunnelFamily(kind: TransportKind): TerrainTunnelFamily {
  return kind === 'rail' ? 'rail' : kind === 'path' ? 'path' : 'road';
}

/**
 * Steepest grade a portal's approach and its bore take, rise over run: 8% for a road (an urban
 * underpass ramp; motorway tunnels are gentler, but their approaches are rarely cut short), 4% for
 * a railway (a metro's steepest), and 1 in 12 for a path (an accessible ramp).
 */
export const TERRAIN_TUNNEL_GRADE: Readonly<Record<TerrainTunnelFamily, number>> = {
  road: 0.08,
  rail: 0.04,
  path: 0.083,
};
/** Meters of ground a bore keeps over its roof once it is in: a cut-and-cover slab's fill. */
export const TERRAIN_TUNNEL_COVER = 1.5;
/**
 * Meters into a bore from a portal within which its roof may stand clear of the ground: the
 * portal's own structure, where a hillside closes over the bore. Past it the bore is under cover.
 */
export const TERRAIN_TUNNEL_PORTAL_ZONE = 15;
/** Meters of approach a portal looks along for the places it must stay on the ground. */
export const TERRAIN_TUNNEL_CUTTING_REACH = 250;
/** Meters into a bore a portal reads the ground over it, deciding how deep to cut. */
export const TERRAIN_TUNNEL_INWARD_REACH = 75;
/** Meters within which two ends are one point (a shared map node, or a tile edge's cut). */
const JOIN = 0.5;
/** Meters from an approach's centerline within which another way's end joins it. */
const TEE = 0.75;

/** Clear height inside a bore: surveyed, or 6.5 m for a road, 6 m for a railway, 3.5 m for a path. */
export function terrainTunnelClearance(
  feature: TerrainTransportationFeature,
  kind: TransportKind = transportKind(feature),
): number {
  return feature.tunnelClearance ?? (kind === 'path' ? 3.5 : kind === 'rail' ? 6 : 6.5);
}

/** A way the map calls a tunnel, with no surveyed floor: its bore and portals are inferred. */
export function isInferredTerrainTunnel(feature: TerrainTransportationFeature): boolean {
  return feature.tunnel === true && feature.tunnelFloorElevation === undefined;
}

/**
 * Where a road grading cut the approaches to portals: the ground a bore's road reaches its portal
 * at (world meters), so the bore begins at the cutting's floor. Undefined where no portal is known
 * at that point or that level's ground is not graded.
 */
export interface TerrainTunnelPortalSource {
  tunnelPortalGround(level: number, x: number, z: number): Promise<number | undefined>;
}

/** One way of a neighborhood, cut to its tile's square, in world meters. */
export interface TerrainTunnelWay {
  feature: TerrainTransportationFeature;
  /** World X/Z of each vertex: x0, z0, x1, z1, and so on. */
  points: Float64Array;
  /** Whether each end is where the tile's edge cut the line, rather than where the way ends. */
  cut: readonly [boolean, boolean];
}

/**
 * The ways of a tile and the tiles around it (`dx`, `dz` from it), each cut to its own tile's
 * square so neighbors' buffers do not overlap, in world meters (`origin` and `tileSize` are the
 * middle tile's). Airside pavement and ferries are left out.
 */
export function terrainTunnelWays(
  tiles: readonly {
    dx: number;
    dz: number;
    transportation: readonly TerrainTransportationFeature[];
  }[],
  origin: readonly [number, number],
  tileSize: number,
): TerrainTunnelWay[] {
  const ways: TerrainTunnelWay[] = [];
  const edge = (u: number, v: number): boolean =>
    u <= 1e-9 || u >= 1 - 1e-9 || v <= 1e-9 || v >= 1 - 1e-9;
  for (const { dx, dz, transportation } of tiles)
    for (const feature of transportation) {
      if (isAeroway(feature) || feature.class === 'ferry' || feature.subclass === 'ferry') continue;
      for (const line of feature.lines)
        for (const piece of clipRoadLine(line, [0, 0, 1, 1])) {
          if (piece.length < 2) continue;
          const points = new Float64Array(piece.length * 2);
          piece.forEach(([u, v], i) => {
            points[i * 2] = origin[0] + (u + dx) * tileSize;
            points[i * 2 + 1] = origin[1] + (v + dz) * tileSize;
          });
          const first = piece[0] as [number, number],
            last = piece.at(-1) as [number, number];
          ways.push({ feature, points, cut: [edge(...first), edge(...last)] });
        }
    }
  return ways;
}

/** A portal found in a neighborhood's ways: everything its cutting depends on but the ground. */
export interface TerrainTunnelPortalSeed {
  /** World X/Z of the portal. */
  x: number;
  z: number;
  /** The tunnel that opens here. */
  tunnel: TerrainTransportationFeature;
  /** The way that continues from the portal into the open. */
  approach: TerrainTransportationFeature;
  /** The bore from the portal inward, world X/Z pairs, as far as it was followed. */
  inward: Float64Array;
  /** The bore's length from this portal when its far portal lies within reach; else Infinity. */
  length: number;
  /** The approach from the portal outward, world X/Z pairs, and the distance from the portal at each. */
  chain: Float64Array;
  distances: Float64Array;
  /**
   * Meters from the portal at which the approach must be back on the ground: a junction, a way
   * crossing it at grade, a bridge, or the end of what the neighborhood shows. Infinity when
   * nothing within reach holds it there (it goes on into another tunnel, or ends).
   */
  limit: number;
}

/** Numeric key of an integer cell; cells stay well within +-2^25 of the origin. */
function cellKey(i: number, j: number): number {
  return (i + 2 ** 25) * 2 ** 26 + (j + 2 ** 25);
}

interface WayEnd {
  way: number;
  end: 0 | 1;
}

/**
 * The portals among `ways` (see `terrainTunnelWays`): ends of inferred tunnels where no other
 * tunnel goes on but an ordinary way does. With `near` (world `[minX, minZ, maxX, maxZ]`), only
 * portals within it. Each comes with its approach and the bore inward, as far as a cutting needs.
 */
export function findTerrainTunnelPortals(
  ways: readonly TerrainTunnelWay[],
  near?: readonly [number, number, number, number],
): TerrainTunnelPortalSeed[] {
  if (!ways.some((way) => isInferredTerrainTunnel(way.feature))) return [];
  // Ends by one-meter cell, and segments by 32 m cell, for the questions the walks ask.
  const ends = new Map<number, WayEnd[]>();
  const endPoint = (e: WayEnd): [number, number] => {
    const points = (ways[e.way] as TerrainTunnelWay).points;
    const i = e.end === 0 ? 0 : points.length - 2;
    return [points[i] as number, points[i + 1] as number];
  };
  ways.forEach((_, way) => {
    for (const end of [0, 1] as const) {
      const [x, z] = endPoint({ way, end });
      const key = cellKey(Math.floor(x), Math.floor(z));
      const list = ends.get(key);
      if (list) list.push({ way, end });
      else ends.set(key, [{ way, end }]);
    }
  });
  const endsNear = (x: number, z: number, reach: number): WayEnd[] => {
    const found: WayEnd[] = [];
    const span = Math.ceil(reach);
    for (let i = Math.floor(x) - span; i <= Math.floor(x) + span; i++)
      for (let j = Math.floor(z) - span; j <= Math.floor(z) + span; j++)
        for (const e of ends.get(cellKey(i, j)) ?? []) {
          const [ex, ez] = endPoint(e);
          if (Math.hypot(ex - x, ez - z) <= reach) found.push(e);
        }
    return found;
  };
  const CELL = 32;
  let segments: Map<number, [number, number][]> | undefined;
  const segmentsNear = (ax: number, az: number, bx: number, bz: number): [number, number][] => {
    let index = segments;
    if (!index) {
      const built = new Map<number, [number, number][]>();
      ways.forEach(({ points }, way) => {
        for (let s = 0; s + 3 < points.length; s += 2) {
          const x0 = Math.floor(Math.min(points[s] as number, points[s + 2] as number) / CELL),
            x1 = Math.floor(Math.max(points[s] as number, points[s + 2] as number) / CELL),
            z0 = Math.floor(Math.min(points[s + 1] as number, points[s + 3] as number) / CELL),
            z1 = Math.floor(Math.max(points[s + 1] as number, points[s + 3] as number) / CELL);
          for (let i = x0; i <= x1; i++)
            for (let j = z0; j <= z1; j++) {
              const key = cellKey(i, j);
              const list = built.get(key);
              if (list) list.push([way, s]);
              else built.set(key, [[way, s]]);
            }
        }
      });
      segments = index = built;
    }
    const seen = new Set<number>();
    const found: [number, number][] = [];
    for (let i = Math.floor(Math.min(ax, bx) / CELL); i <= Math.floor(Math.max(ax, bx) / CELL); i++)
      for (
        let j = Math.floor(Math.min(az, bz) / CELL);
        j <= Math.floor(Math.max(az, bz) / CELL);
        j++
      )
        for (const entry of index.get(cellKey(i, j)) ?? []) {
          const id = entry[0] * 2 ** 21 + entry[1];
          if (seen.has(id)) continue;
          seen.add(id);
          found.push(entry);
        }
    return found;
  };
  /** The way's vertices from end `from`, in order. */
  const walk = (way: number, from: 0 | 1): [number, number][] => {
    const points = (ways[way] as TerrainTunnelWay).points;
    const list: [number, number][] = [];
    for (let i = 0; i < points.length; i += 2)
      list.push([points[i] as number, points[i + 1] as number]);
    return from === 0 ? list : list.reverse();
  };

  const seeds: TerrainTunnelPortalSeed[] = [];
  ways.forEach((tunnelWay, index) => {
    if (!isInferredTerrainTunnel(tunnelWay.feature)) return;
    for (const end of [0, 1] as const) {
      if (tunnelWay.cut[end]) continue;
      const [x, z] = endPoint({ way: index, end });
      if (near && (x < near[0] || x > near[2] || z < near[1] || z > near[3])) continue;
      const others = endsNear(x, z, JOIN).filter((e) => e.way !== index);
      if (others.some((e) => (ways[e.way] as TerrainTunnelWay).feature.tunnel)) continue;
      const open = others;
      if (open.length === 0) continue;
      const inward = followTunnel(index, end);
      const first = open[0] as WayEnd;
      const approach = (ways[first.way] as TerrainTunnelWay).feature;
      const seed: TerrainTunnelPortalSeed = {
        x,
        z,
        tunnel: tunnelWay.feature,
        approach,
        inward: inward.points,
        length: inward.length,
        chain: Float64Array.of(x, z),
        distances: Float64Array.of(0),
        limit: 0,
      };
      // Two ways leave the portal (a junction at its mouth), or the road goes on over a bridge:
      // it is on the ground, or above it, at the portal itself.
      if (open.length === 1 && !approach.bridge) Object.assign(seed, followApproach(first, index));
      seeds.push(seed);
    }
  });
  return seeds;

  /** The bore from a portal inward, through the joints and tile edges of its pieces. */
  function followTunnel(way: number, from: 0 | 1): { points: Float64Array; length: number } {
    const out: number[] = [];
    let length = 0;
    let current = way,
      start = from;
    const visited = new Set<number>();
    for (;;) {
      visited.add(current);
      const vertices = walk(current, start);
      for (let i = 0; i < vertices.length; i++) {
        const [px, pz] = vertices[i] as [number, number];
        if (out.length) {
          const step = Math.hypot(px - (out.at(-2) as number), pz - (out.at(-1) as number));
          if (step < 1e-9) continue;
          length += step;
        }
        out.push(px, pz);
        if (length >= TERRAIN_TUNNEL_INWARD_REACH)
          return { points: Float64Array.from(out), length: Number.POSITIVE_INFINITY };
      }
      const far = (1 - start) as 0 | 1;
      const [fx, fz] = endPoint({ way: current, end: far });
      const next = endsNear(fx, fz, JOIN).filter((e) => e.way !== current);
      const tunnels = next.filter((e) => (ways[e.way] as TerrainTunnelWay).feature.tunnel);
      // The far portal (or the bore's dead end): the bore's whole length is known.
      if (tunnels.length === 0)
        return {
          points: Float64Array.from(out),
          length: (ways[current] as TerrainTunnelWay).cut[far] ? Number.POSITIVE_INFINITY : length,
        };
      const onward = tunnels[0] as WayEnd;
      if (tunnels.length > 1 || visited.has(onward.way))
        return { points: Float64Array.from(out), length: Number.POSITIVE_INFINITY };
      current = onward.way;
      start = onward.end;
    }
  }

  /** The approach from a portal outward, to where it must be back on the ground. */
  function followApproach(
    first: WayEnd,
    tunnel: number,
  ): Pick<TerrainTunnelPortalSeed, 'chain' | 'distances' | 'limit'> {
    const chain: number[] = [];
    const distances: number[] = [];
    let distance = 0;
    let limit = Number.POSITIVE_INFINITY;
    let current = first.way,
      start = first.end;
    const visited = new Set<number>([tunnel]);
    const finish = (): Pick<TerrainTunnelPortalSeed, 'chain' | 'distances' | 'limit'> => ({
      chain: Float64Array.from(chain),
      distances: Float64Array.from(distances),
      limit,
    });
    for (;;) {
      visited.add(current);
      const vertices = walk(current, start);
      const [sx, sz] = vertices[0] as [number, number];
      const [ex, ez] = vertices.at(-1) as [number, number];
      if (!chain.length) {
        chain.push(sx, sz);
        distances.push(0);
      }
      for (let i = 1; i < vertices.length; i++) {
        const [ax, az] = vertices[i - 1] as [number, number];
        const [bx, bz] = vertices[i] as [number, number];
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 1e-9) continue;
        // The first place along this stretch where the approach meets another way on the ground.
        let meet = Number.POSITIVE_INFINITY;
        // Ends that join it from the side, asked for ten meters of it at a time.
        const parts = Math.max(1, Math.ceil(length / 10));
        for (let part = 0; part < parts; part++) {
          const t0 = (part + 0.5) / parts;
          for (const e of endsNear(
            ax + (bx - ax) * t0,
            az + (bz - az) * t0,
            length / parts / 2 + TEE,
          )) {
            if (e.way === current || visited.has(e.way)) continue;
            const [px, pz] = endPoint(e);
            // This way's own ends are asked about where they are: at its far end, below.
            if (Math.hypot(px - sx, pz - sz) <= JOIN || Math.hypot(px - ex, pz - ez) <= JOIN)
              continue;
            const t = Math.max(
              0,
              Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / (length * length)),
            );
            if (Math.hypot(ax + (bx - ax) * t - px, az + (bz - az) * t - pz) <= TEE)
              meet = Math.min(meet, t * length);
          }
        }
        for (const [w, s] of segmentsNear(ax, az, bx, bz)) {
          if (w === current) continue;
          const other = ways[w] as TerrainTunnelWay;
          if (other.feature.tunnel || other.feature.bridge) continue;
          const cx = other.points[s] as number,
            cz = other.points[s + 1] as number,
            dx = other.points[s + 2] as number,
            dz = other.points[s + 3] as number;
          const rx = bx - ax,
            rz = bz - az,
            qx = dx - cx,
            qz = dz - cz;
          const denominator = rx * qz - rz * qx;
          if (Math.abs(denominator) < 1e-12) continue;
          const t = ((cx - ax) * qz - (cz - az) * qx) / denominator,
            u = ((cx - ax) * rz - (cz - az) * rx) / denominator;
          if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) continue;
          meet = Math.min(meet, t * length);
        }
        if (meet < Number.POSITIVE_INFINITY) {
          chain.push(ax + ((bx - ax) * meet) / length, az + ((bz - az) * meet) / length);
          distances.push(distance + meet);
          limit = distance + meet;
          return finish();
        }
        chain.push(bx, bz);
        distance += length;
        distances.push(distance);
        if (distance >= TERRAIN_TUNNEL_CUTTING_REACH) return finish();
      }
      const next = endsNear(ex, ez, JOIN).filter((e) => e.way !== current);
      if (next.length === 0) {
        // Where a way stops, it is on the ground: a map's dead end is most often a way that
        // goes on without a shared node (a footway beside a road, a sidewalk to a crossing),
        // and a tile's edge with nothing past it is not known. A cutting to it was a pit.
        limit = distance;
        return finish();
      }
      const onward = next[0] as WayEnd;
      const feature = (ways[onward.way] as TerrainTunnelWay).feature;
      // Into another tunnel: the stretch between two bores stays down in its cutting.
      if (next.length === 1 && feature.tunnel) return finish();
      if (next.length > 1 || feature.bridge || visited.has(onward.way)) {
        limit = distance;
        return finish();
      }
      current = onward.way;
      start = onward.end;
    }
  }
}

/** A portal's cutting: how far its approach goes down, and to what. */
export interface TerrainTunnelCutting {
  /** World X/Z of the portal. */
  x: number;
  z: number;
  /**
   * Height of the approach's graded ground at the portal once it is cut, world Y: where the
   * bore's road begins, a pavement's lift below its floor.
   */
  ground: number;
  /** Meters the approach is cut below its ordinary profile at the portal (0: not at all). */
  depth: number;
  /** Rise over run of the cutting, climbing away from the portal. */
  grade: number;
  /** The approach from the portal outward: world X/Z pairs, and the distance from the portal at each. */
  chain: Float64Array;
  distances: Float64Array;
  /** The approach itself, for an approach the ground is not graded for of its own (a path). */
  approach: TerrainTransportationFeature;
}

/**
 * How deep a portal's approach is cut, reading `reference`: the natural ground as a function of
 * world position alone (the one road grading reads). Deep enough for the bore's clear height,
 * pavement and cover under the ground over its first stretch, as far down as the approach can
 * reach at its grade before the place it must stay on the ground, and never more.
 */
export function terrainTunnelCutting(
  seed: TerrainTunnelPortalSeed,
  reference: (x: number, z: number) => number,
): TerrainTunnelCutting {
  const kind = transportKind(seed.tunnel);
  const grade = TERRAIN_TUNNEL_GRADE[terrainTunnelFamily(kind)];
  const full =
    terrainTunnelClearance(seed.tunnel, kind) + TERRAIN_TUNNEL_COVER + transportSurfaceLift(kind);
  // Along the approach, as the earthworks read its profile there; along the bore without one.
  let dx: number, dz: number;
  if (seed.chain.length >= 4) {
    dx = (seed.chain[2] as number) - seed.x;
    dz = (seed.chain[3] as number) - seed.z;
  } else if (seed.inward.length >= 4) {
    dx = seed.x - (seed.inward[2] as number);
    dz = seed.z - (seed.inward[3] as number);
  } else {
    dx = 1;
    dz = 0;
  }
  const norm = Math.hypot(dx, dz) || 1;
  const profile = roadProfileHeight(reference, seed.x, seed.z, dx / norm, dz / norm);
  // Where the ground over the bore is read: past the portal's own structure, or the middle of a
  // bore too short to have one.
  const known = Math.min(seed.length, lineLength(seed.inward));
  const samples: number[] = [];
  if (seed.length < 2 * TERRAIN_TUNNEL_PORTAL_ZONE) samples.push(seed.length / 2);
  else
    for (
      let s = TERRAIN_TUNNEL_PORTAL_ZONE;
      s <= Math.min(60, seed.length - TERRAIN_TUNNEL_PORTAL_ZONE);
      s += 15
    )
      samples.push(s);
  let need = Number.NEGATIVE_INFINITY;
  for (const s of samples) {
    if (s > known + 1e-6) continue;
    const [px, pz] = pointAlong(seed.inward, s);
    // The bore runs level through the portal zone, then may fall at its grade.
    const fall = grade * Math.max(0, s - TERRAIN_TUNNEL_PORTAL_ZONE);
    need = Math.max(need, profile - reference(px, pz) + full - fall);
  }
  if (need === Number.NEGATIVE_INFINITY) need = full;
  const depth = Math.min(Math.max(0, Math.min(full, need)), grade * seed.limit);
  return {
    x: seed.x,
    z: seed.z,
    ground: profile - depth,
    depth,
    grade,
    chain: seed.chain,
    distances: seed.distances,
    approach: seed.approach,
  };
}

/** Length of a polyline of X/Z pairs. */
function lineLength(points: Float64Array): number {
  let length = 0;
  for (let i = 2; i + 1 < points.length; i += 2)
    length += Math.hypot(
      (points[i] as number) - (points[i - 2] as number),
      (points[i + 1] as number) - (points[i - 1] as number),
    );
  return length;
}

/** The point `distance` along a polyline of X/Z pairs (its last point past its end). */
function pointAlong(points: Float64Array, distance: number): [number, number] {
  let walked = 0;
  for (let i = 2; i + 1 < points.length; i += 2) {
    const ax = points[i - 2] as number,
      az = points[i - 1] as number,
      bx = points[i] as number,
      bz = points[i + 1] as number;
    const step = Math.hypot(bx - ax, bz - az);
    if (walked + step >= distance && step > 0) {
      const t = (distance - walked) / step;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    walked += step;
  }
  return [points[points.length - 2] as number, points[points.length - 1] as number];
}

/**
 * How far below its profile each station of a graded line (`points`, world X/Z pairs) is cut,
 * where it is the approach to one of `cuttings`; undefined when none of it is. A station belongs
 * to an approach when it lies on the approach's centerline, running along it.
 */
export function terrainTunnelCuttingDepths(
  points: Float64Array,
  bounds: readonly [number, number, number, number],
  cuttings: readonly TerrainTunnelCutting[],
): Float32Array | undefined {
  let depths: Float32Array | undefined;
  const stations = points.length >> 1;
  for (const cutting of cuttings) {
    if (cutting.depth <= 0) continue;
    const reach = cutting.depth / cutting.grade;
    const { chain, distances } = cutting;
    let minX = Number.POSITIVE_INFINITY,
      minZ = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxZ = Number.NEGATIVE_INFINITY;
    let last = 0;
    for (let k = 0; k < distances.length; k++) {
      minX = Math.min(minX, chain[k * 2] as number);
      maxX = Math.max(maxX, chain[k * 2] as number);
      minZ = Math.min(minZ, chain[k * 2 + 1] as number);
      maxZ = Math.max(maxZ, chain[k * 2 + 1] as number);
      last = k;
      if ((distances[k] as number) >= reach) break;
    }
    if (last === 0) continue;
    if (
      bounds[0] > maxX + 1 ||
      bounds[2] < minX - 1 ||
      bounds[1] > maxZ + 1 ||
      bounds[3] < minZ - 1
    )
      continue;
    for (let i = 0; i < stations; i++) {
      const x = points[i * 2] as number,
        z = points[i * 2 + 1] as number;
      if (x < minX - 1 || x > maxX + 1 || z < minZ - 1 || z > maxZ + 1) continue;
      // The line's direction here, as the earthworks read its profile.
      const before = Math.max(0, i - 1),
        after = Math.min(stations - 1, i + 1);
      const lx = (points[after * 2] as number) - (points[before * 2] as number),
        lz = (points[after * 2 + 1] as number) - (points[before * 2 + 1] as number);
      const lineLength = Math.hypot(lx, lz);
      for (let k = 1; k <= last; k++) {
        const ax = chain[k * 2 - 2] as number,
          az = chain[k * 2 - 1] as number,
          bx = chain[k * 2] as number,
          bz = chain[k * 2 + 1] as number;
        const sx = bx - ax,
          sz = bz - az;
        const span = Math.hypot(sx, sz);
        if (span < 1e-9) continue;
        const t = ((x - ax) * sx + (z - az) * sz) / (span * span);
        if (t < -1e-6 || t > 1 + 1e-6) continue;
        if (Math.hypot(ax + sx * t - x, az + sz * t - z) > 0.35) continue;
        if (lineLength > 0 && Math.abs(lx * sx + lz * sz) / (lineLength * span) < 0.94) continue;
        const along = (distances[k - 1] as number) + Math.max(0, Math.min(1, t)) * span;
        const depth = cutting.depth - cutting.grade * along;
        if (depth <= 0) continue;
        depths ??= new Float32Array(stations);
        depths[i] = Math.max(depths[i] as number, depth);
      }
    }
  }
  return depths;
}

/**
 * Graded lines for the cuttings whose approach the ground is not otherwise graded for (a path,
 * which takes the ground as it finds it): the stretch from the portal to where the cutting meets
 * the ground, cut by its depth there.
 */
export function terrainTunnelCuttingLines(
  cuttings: readonly TerrainTunnelCutting[],
): RoadEarthworkLine[] {
  const lines: RoadEarthworkLine[] = [];
  for (const cutting of cuttings) {
    if (cutting.depth <= 0 || isRoadEarthworkGraded(cutting.approach)) continue;
    const reach = cutting.depth / cutting.grade;
    const { chain, distances } = cutting;
    const stations: number[] = [];
    const along: number[] = [];
    for (let k = 1; k < distances.length; k++) {
      const from = distances[k - 1] as number;
      if (from >= reach) break;
      const to = Math.min(reach, distances[k] as number);
      const span = (distances[k] as number) - from;
      if (span < 1e-9) continue;
      const ax = chain[k * 2 - 2] as number,
        az = chain[k * 2 - 1] as number,
        bx = chain[k * 2] as number,
        bz = chain[k * 2 + 1] as number;
      const steps = Math.max(1, Math.ceil((to - from) / 5));
      for (let j = stations.length ? 1 : 0; j <= steps; j++) {
        const t = ((to - from) * j) / steps / span;
        stations.push(ax + (bx - ax) * t, az + (bz - az) * t);
        along.push(from + (to - from) * (j / steps));
      }
    }
    if (stations.length < 4) continue;
    let minX = Number.POSITIVE_INFINITY,
      minZ = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxZ = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < stations.length; i += 2) {
      minX = Math.min(minX, stations[i] as number);
      maxX = Math.max(maxX, stations[i] as number);
      minZ = Math.min(minZ, stations[i + 1] as number);
      maxZ = Math.max(maxZ, stations[i + 1] as number);
    }
    lines.push({
      points: Float64Array.from(stations),
      halfWidth: transportWidth(cutting.approach) / 2 + 0.6,
      bounds: [minX, minZ, maxX, maxZ],
      heights: new Float32Array(along.length).fill(Number.NaN),
      depths: Float32Array.from(along, (d) => Math.max(0, cutting.depth - cutting.grade * d)),
    });
  }
  return lines;
}

/** A bore's floor along it, and the ground over it as the floor was fitted to. */
export interface TerrainTunnelBoreProfile {
  /** Height of the bore's pavement `distance` meters from its first portal. */
  floorAt(distance: number): number;
  /** Height of the ground over the bore there; NaN where it is not known. */
  groundAt(distance: number): number;
}

/** Meters between the stations a bore's profile is fitted at. */
const BORE_STATION = 6;

/**
 * The floor of a bore `length` meters long from `startFloor` to `endFloor` (pavement heights at
 * its portals). Past each portal's zone it keeps its clear height and the cover under the ground
 * (`ground`, read at a distance along it; undefined where unknown), climbing and falling no more
 * steeply than `grade` allows (or than the portals' own difference asks). Where the ground is
 * high over it, as in a hill, it runs straight between its portals as it always did; a bore under
 * level ground goes down at its grade and back up.
 */
export function terrainTunnelBoreProfile(
  length: number,
  ground: (distance: number) => number | undefined,
  startFloor: number,
  endFloor: number,
  options: { grade: number; clearance: number; cover?: number; zone?: number },
): TerrainTunnelBoreProfile {
  const cover = options.cover ?? TERRAIN_TUNNEL_COVER;
  const n = Math.max(1, Math.ceil(length / BORE_STATION));
  const step = length / n;
  const zone = Math.max(
    0,
    Math.min(options.zone ?? TERRAIN_TUNNEL_PORTAL_ZONE, length / 2 - BORE_STATION),
  );
  const grade =
    length > 0 ? Math.max(options.grade, Math.abs(endFloor - startFloor) / length) : options.grade;
  const grounds = new Float64Array(n + 1);
  const floors = new Float64Array(n + 1);
  const envelope = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const s = k * step;
    const g = ground(s);
    grounds[k] = g === undefined || !Number.isFinite(g) ? Number.NaN : g;
    envelope[k] =
      s >= zone - 1e-9 && s <= length - zone + 1e-9 && !Number.isNaN(grounds[k] as number)
        ? (grounds[k] as number) - options.clearance - cover
        : Number.POSITIVE_INFINITY;
  }
  // As low as the cover needs anywhere, but never falling faster than the grade toward it.
  for (let k = 1; k <= n; k++)
    envelope[k] = Math.min(envelope[k] as number, (envelope[k - 1] as number) + grade * step);
  for (let k = n - 1; k >= 0; k--)
    envelope[k] = Math.min(envelope[k] as number, (envelope[k + 1] as number) + grade * step);
  for (let k = 0; k <= n; k++) {
    const s = k * step;
    const straight = length > 0 ? startFloor + ((endFloor - startFloor) * s) / length : startFloor;
    const lowest = Math.max(startFloor - grade * s, endFloor - grade * (length - s));
    floors[k] = Math.max(lowest, Math.min(straight, envelope[k] as number));
  }
  const at = (values: Float64Array, distance: number): number => {
    if (!(length > 0)) return values[0] as number;
    const u = Math.max(0, Math.min(n, distance / step));
    const k = Math.min(n - 1, Math.floor(u));
    const t = u - k;
    return (values[k] as number) + ((values[k + 1] as number) - (values[k] as number)) * t;
  };
  return { floorAt: (d) => at(floors, d), groundAt: (d) => at(grounds, d) };
}
