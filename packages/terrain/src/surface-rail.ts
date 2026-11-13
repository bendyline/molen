/**
 * Railways in the surface layer: ballasted track beds the pavement material draws sleepers and
 * rails on, rails in 3D near the camera, level crossings with their panels, signs, lights and
 * gates, switch stands, color-light signals, lineside signs, overhead catenary and platforms.
 * Placement rules live in rail-features.ts; this module turns them into batched geometry that the
 * direct and worker surface builders share (lamps travel as data, like traffic signal lenses).
 */
import { InstanceBatch } from '@bendyline/molen-client/instancing';
import { buildTextMesh, type FontLibrary } from '@bendyline/molen-materials/text';
import type { VehiclePlacement } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { sampleTerrainLine, type TerrainLinePath, terrainLinePath } from './line-path';
import {
  appendTerrainLineBand,
  appendTerrainSurfaceArea,
  TERRAIN_PAVEMENT,
  TERRAIN_SURFACE_KIND,
  type TerrainBoxPlacement,
  TerrainSurfaceMeshBuilder,
  weldTerrainSurfaceMesh,
} from './linear-features';
import { normalizeRing, pointInPolygon, polygonBounds } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { placeTerrainYardCars } from './rail-cars';
import {
  findTerrainRailCrossings,
  findTerrainRailTurnouts,
  nearestTerrainRail,
  placeTerrainRailSignals,
  placeTerrainRailSigns,
  TERRAIN_RAIL_HEIGHT,
  type TerrainRailAspect,
  type TerrainRailCrossing,
  type TerrainRailLine,
  type TerrainRailSign,
  type TerrainRailTrack,
  terrainRailElectrified,
  terrainRailHash,
  terrainRailMastStations,
  terrainRailOffset,
  terrainRailTrack,
  terrainRailVariant,
} from './rail-features';
import type { TerrainRoadSignProfile } from './road-sign-styles';
import type { TerrainSemanticPoint, TerrainSemanticTile } from './semantic-types';
import type { SurfaceNetwork, SurfaceRoad } from './surface-network';
import type { TerrainParkedVehicle, TerrainSurfaceStyle } from './surface-styles';

/** Mesh names; hosts and tests can find each part by them. */
export const TERRAIN_RAIL_MESHES: {
  readonly bed: 'surface:rail-bed';
  readonly rails: 'surface:rails';
  readonly wires: 'surface:rail-wires';
  readonly lamps: 'surface:signal-rail-lamps';
} = {
  bed: 'surface:rail-bed',
  rails: 'surface:rails',
  wires: 'surface:rail-wires',
  // The `signal-` prefix keeps lit lamps out of the worker transfer: they are rebuilt from data.
  lamps: 'surface:signal-rail-lamps',
};

/** A self-lit lamp: a signal aspect, tile-local, facing along `yaw` (+Z rotated about Y). */
export interface TerrainRailLamp {
  x: number;
  y: number;
  z: number;
  yaw: number;
  color: TerrainRailAspect | 'white';
  radius: number;
}

export interface TerrainRailwayStats {
  /** Track fragments drawn (a track crossing tiles counts in each). */
  tracks: number;
  crossings: number;
  turnouts: number;
  signals: number;
  signs: number;
  masts: number;
  /** Rail segments drawn in 3D (one per rail per few meters). */
  railSegments: number;
  platforms: number;
  /** Cars standing in yards and on sidings. */
  cars: number;
}

export interface TerrainRailwayInput {
  tile: TerrainSemanticTile;
  context: TerrainPyramidTileLayerContext;
  network: SurfaceNetwork;
  style: TerrainSurfaceStyle;
  signProfile: Readonly<TerrainRoadSignProfile>;
  /** Finest tiles: rails in 3D, equipment and signs; coarser tiles draw beds only. */
  detailed: boolean;
  /** Absolute deck heights of bridges and their graded approaches. */
  bridgeProfiles: ReadonlyMap<SurfaceRoad, (x: number, z: number) => number>;
  /** Buildings and water. */
  blocked: (x: number, z: number) => boolean;
  /** The tile's shared instanced box parts (one draw with the street fixtures). */
  fixtures: TerrainBoxPlacement[];
  /** The tile's sign faces and lettering. */
  signFaces: TerrainSurfaceMeshBuilder;
  fonts?: FontLibrary;
  font?: string;
  maxFixtures: number;
  maxDetailElements: number;
  /** Rolling stock to stand in yards and on sidings, and the tile's parked placements to add to. */
  railCars?: readonly TerrainParkedVehicle[];
  railCarOccupancy?: number;
  vehicles?: VehiclePlacement[];
}

/** Ballast colors: fresh granite on main lines, a yard's oily cinders, a disused line's weeds. */
const BALLAST = {
  main: '#8b8984',
  light: '#8e8c87',
  yard: '#78746c',
  disused: '#75705e',
  slope: '#7d786f',
} as const;
const PANEL = '#a6a39b';
const STEEL = '#7c8285';
const SIGNAL_BLACK = '#24292b';

/** Rails without a host pavement material: dull steel. */
const RAIL_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.55,
  metalness: 0.25,
});
const LAMP = new THREE.CircleGeometry(1, 12);
const LAMP_MATERIAL = new THREE.MeshBasicMaterial({ toneMapped: false });
const LAMP_COLORS: Record<TerrainRailLamp['color'], THREE.Color> = {
  green: new THREE.Color('#2bf59a'),
  yellow: new THREE.Color('#ffc21c'),
  red: new THREE.Color('#ff3324'),
  white: new THREE.Color('#eef2ff'),
};

/** Unit horizontal vectors and yaw (box local +Z) for a direction. */
function yawOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** An indexed mesh of shared vertices and quads between them, without tile clipping. */
class StripMesh {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly detail: number[] = [];
  private readonly indices: number[] = [];
  /**
   * A vertex of the pavement material's rail kind: `across` is meters across its face (the head's
   * width, the web's depth), by which the material measures how many pixels wide the rail is;
   * `polished` marks a rail head's top.
   */
  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    color: THREE.Color,
    across: number,
    polished: boolean,
  ): number {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(color.r, color.g, color.b);
    this.detail.push(0, across, TERRAIN_SURFACE_KIND.rail * 128, polished ? 4 : 0);
    return this.positions.length / 3 - 1;
  }
  /** The quad a-b-c-d between existing vertices, wound to face `toward`. */
  strip(a: number, b: number, c: number, d: number, toward: readonly number[]): void {
    const at = (i: number, k: number): number => this.positions[i * 3 + k] as number;
    const ux = at(b, 0) - at(a, 0),
      uy = at(b, 1) - at(a, 1),
      uz = at(b, 2) - at(a, 2);
    const vx = at(c, 0) - at(a, 0),
      vy = at(c, 1) - at(a, 1),
      vz = at(c, 2) - at(a, 2);
    const facing =
      (uy * vz - uz * vy) * (toward[0] ?? 0) +
      (uz * vx - ux * vz) * (toward[1] ?? 0) +
      (ux * vy - uy * vx) * (toward[2] ?? 0);
    if (facing >= 0) this.indices.push(a, b, c, a, c, d);
    else this.indices.push(a, c, b, a, d, c);
  }
  mesh(name: string, material: THREE.Material): THREE.Mesh | undefined {
    if (this.indices.length === 0) return undefined;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('surfaceDetail', new THREE.Float32BufferAttribute(this.detail, 4));
    const count = this.positions.length / 3;
    geometry.setIndex(
      new THREE.BufferAttribute(
        count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
        1,
      ),
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    // A few centimeters across: their shadows would cost a shadow pass for nothing that shows.
    mesh.castShadow = false;
    mesh.userData.terrainOwnedGeometry = true;
    return mesh;
  }
}

/** Clip the segment p0-p1 to the square [0, size]²; the kept parameter range, or undefined. */
function clipToTile(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  size: number,
): [number, number] | undefined {
  let t0 = 0,
    t1 = 1;
  const dx = x1 - x0,
    dz = z1 - z0;
  for (const [p, q] of [
    [-dx, x0],
    [dx, size - x0],
    [-dz, z0],
    [dz, size - z0],
  ] as const) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return undefined;
  }
  return [t0, t1];
}

/** Sorted, unique stations along a path: its vertices and every `step` meters. */
function stations(path: TerrainLinePath, step: number): number[] {
  const list = new Set<number>(path.distances.map((d) => Math.round(d * 1000) / 1000));
  for (let d = step; d < path.length; d += step) list.add(Math.round(d * 1000) / 1000);
  list.add(Math.round(path.length * 1000) / 1000);
  return [...list].sort((a, b) => a - b);
}

/** Railways for one surface tile; appends meshes to `group` and boxes to `input.fixtures`. */
export function appendTerrainRailways(
  group: THREE.Group,
  input: TerrainRailwayInput,
): TerrainRailwayStats {
  const { tile, context, network, style, signProfile, detailed, bridgeProfiles, fixtures } = input;
  const stats: TerrainRailwayStats = {
    tracks: 0,
    crossings: 0,
    turnouts: 0,
    signals: 0,
    signs: 0,
    masts: 0,
    railSegments: 0,
    platforms: 0,
    cars: 0,
  };
  const lamps: TerrainRailLamp[] = [];
  group.userData.railLamps = lamps;
  const size = context.tileSize;
  const roads = network.roads.filter((road) => road.kind === 'rail');
  const tracks = roads.map((road) => terrainRailTrack(road.feature, style.railGauge));
  const lines: TerrainRailLine[] = roads;
  const keep = signProfile.drivingSide === 'left' ? -1 : 1;
  const equipment = detailed && style.railEquipment !== false;
  const policy = style.railElectrification ?? 'light';
  const bed = new TerrainSurfaceMeshBuilder(context);
  bed.ensureAttribute('surfaceDetail', 4);
  const rails = new StripMesh();
  const wires: TerrainBoxPlacement[] = [];
  const pois = tile.pois ?? [];
  const inTile = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < size && z < size;
  const ground = (x: number, z: number): number => bed.groundHeight(x, z);
  // Fixture budgets of their own, so a yard never crowds out a street's lights and signals.
  let boxes = Math.max(400, input.maxFixtures * 25);
  let wireBudget = Math.max(400, input.maxFixtures * 25);
  let segmentBudget = Math.round(input.maxDetailElements * 0.75);
  const push = (...parts: TerrainBoxPlacement[]): boolean => {
    if (boxes < parts.length) return false;
    boxes -= parts.length;
    fixtures.push(...parts);
    return true;
  };
  /** Top of the ballast (where sleepers lie) of track `i` at a point on or near it. */
  const ballastTop = (i: number, x: number, z: number): number => {
    const road = roads[i] as SurfaceRoad;
    const profile = bridgeProfiles.get(road);
    return (profile ? profile(x, z) : ground(x, z) + road.elevation) + road.stack;
  };
  // Other tracks' centerlines, for keeping equipment and slopes clear of them.
  const nearestOther = (x: number, z: number, except: number, reach: number): number =>
    Math.abs(
      nearestTerrainRail(
        lines,
        x,
        z,
        reach,
        (line) => line !== except && tracks[line] !== undefined,
      )?.offset ?? Number.POSITIVE_INFINITY,
    );
  const clearOfTracks = (x: number, z: number, reach: number): boolean =>
    nearestTerrainRail(lines, x, z, reach, (line) => tracks[line] !== undefined) === undefined;
  /** Somewhere equipment may stand: in the tile, off roads, buildings, water and other tracks. */
  const standable = (x: number, z: number, trackReach = 2.4): boolean =>
    inTile(x, z) &&
    !input.blocked(x, z) &&
    !network.occupied(x, z, 0.3) &&
    clearOfTracks(x, z, trackReach);
  // Street-running trams: rails set in the carriageway, no ballast or crossing panels.
  const embedded = roads.map((road, i) => {
    const track = tracks[i];
    if (!track || (track.mode !== 'tram' && track.mode !== 'light') || road.feature.bridge)
      return false;
    let paved = 0,
      count = 0;
    for (let d = 0; d <= road.path.length; d += 5) {
      const p = sampleTerrainLine(road.path, d);
      count++;
      if (network.occupied(p.x, p.z, -0.5)) paved++;
    }
    return count > 0 && paved / count > 0.6;
  });
  const order = roads
    .map((_, i) => i)
    .filter((i) => tracks[i] !== undefined)
    .sort(
      (a, b) =>
        (tracks[a] as TerrainRailTrack).rank - (tracks[b] as TerrainRailTrack).rank || a - b,
    );

  // Beds: ballast with the track drawn on it, on every tile; prism slopes close up.
  for (const i of order) {
    const road = roads[i] as SurfaceRoad;
    const track = tracks[i] as TerrainRailTrack;
    stats.tracks++;
    const profile = bridgeProfiles.get(road);
    const grounded = !profile && !road.feature.bridge;
    const elevation = (profile ? 0 : road.elevation) + road.stack;
    if (embedded[i]) {
      if (!detailed) continue;
      // Grooved rails flush with the street.
      for (const side of [-1, 1])
        appendTerrainLineBand(
          bed,
          road.path,
          {
            width: 0.11,
            offset: side * terrainRailOffset(track.gauge),
            color: '#5e5b56',
            elevation: elevation + 0.05,
            surface: TERRAIN_SURFACE_KIND.plain,
          },
          { spacing: 6 },
        );
      continue;
    }
    const color = track.disused
      ? BALLAST.disused
      : track.service === 'yard' || track.service === 'spur'
        ? BALLAST.yard
        : track.mode === 'heavy'
          ? BALLAST.main
          : BALLAST.light;
    appendTerrainLineBand(
      bed,
      road.path,
      {
        width: track.bed,
        color,
        elevation,
        surface: TERRAIN_SURFACE_KIND.track,
        variant: terrainRailVariant(track),
        ...(grounded ? { fray: 'both' as const } : {}),
      },
      {
        spacing: detailed ? 6 : 16,
        heightAt: profile,
        followGrid: !road.feature.bridge,
        // Where a road crosses, its pavement and the crossing panel carry the rails.
        filter: (points) => !points.every((p) => network.occupied(p[0], p[1], 0)),
      },
    );
    if (!detailed || !track.prism || !grounded) continue;
    // Sloped shoulders down from the ballast's edge, wherever no other track runs alongside;
    // where one does, close by, ballast fills the gap between the two beds instead.
    const slope = 1.1;
    const half = track.bed / 2;
    const slopeColor = new THREE.Color(BALLAST.slope);
    const fillColor = new THREE.Color(color);
    for (const side of [-1, 1]) {
      const marks = stations(road.path, 3);
      let previous: { d: number; free: boolean; paired: boolean } | undefined;
      for (const d of marks) {
        const outer = sampleTerrainLine(road.path, d, side * (half + slope + 0.6));
        const free =
          nearestOther(outer.x, outer.z, i, half + 2.6) > half + 2.5 &&
          !network.occupied(outer.x, outer.z, 0.4);
        const probe = sampleTerrainLine(road.path, d, side * (half + 1));
        const paired = !free && nearestOther(probe.x, probe.z, i, 2.6) < 2.6;
        if (previous?.paired && paired && segmentBudget > 0) {
          // A meter of ballast out from the bed's edge meets the neighbor's, a few millimeters
          // under both beds' tops.
          const start = bed.vertexCount;
          const corner = (distance: number, offset: number): [number, number, number] => {
            const q = sampleTerrainLine(road.path, distance, side * offset);
            return [q.x, ground(q.x, q.z) + elevation - 0.006, q.z];
          };
          bed.face(
            upward([
              corner(previous.d, half - 0.05),
              corner(d, half - 0.05),
              corner(d, half + 1),
              corner(previous.d, half + 1),
            ]),
            fillColor,
          );
          bed.surfaceSince(start, TERRAIN_SURFACE_KIND.ballast);
          segmentBudget--;
        }
        if (previous?.free && free && segmentBudget > 0) {
          const t0 = sampleTerrainLine(road.path, previous.d, side * half),
            t1 = sampleTerrainLine(road.path, d, side * half),
            b0 = sampleTerrainLine(road.path, previous.d, side * (half + slope)),
            b1 = sampleTerrainLine(road.path, d, side * (half + slope));
          const start = bed.vertexCount;
          bed.face(
            upward([
              [t0.x, ground(t0.x, t0.z) + elevation, t0.z],
              [t1.x, ground(t1.x, t1.z) + elevation, t1.z],
              [b1.x, ground(b1.x, b1.z) - 0.04, b1.z],
              [b0.x, ground(b0.x, b0.z) - 0.04, b0.z],
            ]),
            slopeColor,
          );
          bed.surfaceSince(start, TERRAIN_SURFACE_KIND.ballast);
          segmentBudget--;
        }
        previous = { d, free, paired };
      }
    }
  }

  // Rails in 3D, close up: a polished head on a rusty web, continuous through crossings. Each
  // rail is an indexed strip whose stations share vertices, so it needs no welding.
  if (detailed) {
    const headColor = new THREE.Color('#c4c4bf');
    const rustColor = new THREE.Color('#6b5544');
    const h = 0.036,
      foot = 0.065,
      depth = 0.17;
    for (const i of order) {
      const road = roads[i] as SurfaceRoad;
      const track = tracks[i] as TerrainRailTrack;
      if (embedded[i] || track.mode === 'monorail' || segmentBudget <= 0) continue;
      const rail = terrainRailOffset(track.gauge);
      const marks = stations(road.path, 6);
      const top = track.disused ? rustColor : headColor;
      // One station's vertices: the head's two top corners, and each side's top and foot.
      const station = (distance: number, side: number): number[] => {
        const p = sampleTerrainLine(road.path, distance, side * rail);
        const nx = -p.dz,
          nz = p.dx;
        const y = ballastTop(i, p.x, p.z) + TERRAIN_RAIL_HEIGHT;
        const ids = [
          rails.vertex(p.x - nx * h, y, p.z - nz * h, 0, 1, 0, top, 0, !track.disused),
          rails.vertex(p.x + nx * h, y, p.z + nz * h, 0, 1, 0, top, 2 * h, !track.disused),
        ];
        for (const s of [-1, 1]) {
          const length = Math.hypot(1, 0.3);
          const [wx, wy, wz] = [(nx * s) / length, 0.3 / length, (nz * s) / length];
          ids.push(
            rails.vertex(p.x + nx * h * s, y, p.z + nz * h * s, wx, wy, wz, rustColor, 0, false),
            rails.vertex(
              p.x + nx * foot * s,
              y - depth,
              p.z + nz * foot * s,
              wx,
              wy,
              wz,
              rustColor,
              depth,
              false,
            ),
          );
        }
        return ids;
      };
      for (const side of [-1, 1]) {
        let previous: { ids: number[]; at: number } | undefined;
        for (let k = 1; k < marks.length && segmentBudget > 0; k++) {
          const d0 = marks[k - 1] as number,
            d1 = marks[k] as number;
          const a = sampleTerrainLine(road.path, d0, side * rail),
            b = sampleTerrainLine(road.path, d1, side * rail);
          const kept = clipToTile(a.x, a.z, b.x, b.z, size);
          if (!kept || (kept[1] - kept[0]) * (d1 - d0) < 0.01) {
            previous = undefined;
            continue;
          }
          const from = d0 + (d1 - d0) * kept[0],
            to = d0 + (d1 - d0) * kept[1];
          const first =
            previous && Math.abs(previous.at - from) < 1e-6 ? previous.ids : station(from, side);
          const last = station(to, side);
          rails.strip(
            first[0] as number,
            last[0] as number,
            last[1] as number,
            first[1] as number,
            [0, 1, 0],
          );
          for (const [k0, s] of [
            [2, -1],
            [4, 1],
          ] as const) {
            const across = [-(b.z - a.z) * s, 0.3, (b.x - a.x) * s];
            rails.strip(
              first[k0] as number,
              last[k0] as number,
              last[k0 + 1] as number,
              first[k0 + 1] as number,
              across,
            );
          }
          previous = { ids: last, at: to };
          segmentBudget--;
          stats.railSegments++;
        }
      }
    }
  }

  // Level crossings, on the finest tiles: a panel carrying the rails across, and equipment.
  const streets = network.roads.filter(
    (road) => road.kind !== 'rail' && road.kind !== 'path' && !road.unpaved,
  );
  const crossings = detailed
    ? findTerrainRailCrossings(lines, streets, pois, size).filter((crossing) =>
        crossing.tracks.some(
          (t) =>
            tracks[t.line] !== undefined &&
            !embedded[t.line] &&
            tracks[t.line]?.mode !== 'monorail',
        ),
      )
    : [];
  const activeCrossing = (crossing: TerrainRailCrossing): boolean => {
    const road = streets[crossing.road] as SurfaceRoad;
    return (
      road.kind !== 'service' &&
      crossing.tracks.some((t) => {
        const track = tracks[t.line];
        return (
          track !== undefined &&
          !track.disused &&
          !embedded[t.line] &&
          (track.service === 'main' || track.service === 'siding') &&
          track.mode !== 'tram'
        );
      })
    );
  };
  const panelColor = new THREE.Color(PANEL);
  for (const crossing of crossings) {
    const road = streets[crossing.road] as SurfaceRoad;
    // A panel straddling the tile's edge is drawn by both tiles, each clipping its own part;
    // the equipment belongs to the tile holding the crossing's center.
    const owned = inTile(crossing.x, crossing.z);
    if (owned) stats.crossings++;
    const first = crossing.tracks[0];
    if (!first) continue;
    // One panel across parallel tracks, else one per track.
    const parallel = crossing.tracks.every(
      (t) => Math.abs(t.dx * first.dx + t.dz * first.dz) > 0.95,
    );
    const groups = parallel ? [crossing.tracks] : crossing.tracks.map((t) => [t]);
    for (const members of groups) {
      const lead = members[0];
      if (!lead) continue;
      const tx = lead.dx,
        tz = lead.dz;
      const nx = -tz,
        nz = tx;
      const laterals = members.map((t) => (t.x - lead.x) * nx + (t.z - lead.z) * nz);
      const widest = Math.max(...members.map((t) => tracks[t.line]?.bed ?? 3.4));
      const low = Math.min(...laterals) - widest / 2 - 0.15,
        high = Math.max(...laterals) + widest / 2 + 0.15;
      const sine = Math.max(0.3, Math.abs(tx * crossing.dz - tz * crossing.dx));
      const reach = road.width / 2 / sine + 0.6;
      // A hair under the rail heads, which run on across it.
      const lift =
        Math.min(
          ...members.map((t) => {
            const rail = roads[t.line] as SurfaceRoad;
            return rail.elevation + rail.stack;
          }),
        ) +
        TERRAIN_RAIL_HEIGHT -
        0.008;
      const at = (along: number, across: number): [number, number, number] => {
        const x = lead.x + tx * along + nx * across,
          z = lead.z + tz * along + nz * across;
        return [x, ground(x, z) + lift, z];
      };
      const start = bed.vertexCount;
      const top = [at(-reach, low), at(reach, low), at(reach, high), at(-reach, high)];
      bed.face(upward(top), panelColor);
      // Ramps down to the road on either side of the panel.
      for (const [edge, outward] of [
        [low, -1],
        [high, 1],
      ] as const) {
        const foot = edge + outward * 2.4;
        const ramp = [at(-reach, edge), at(reach, edge), at(reach, foot), at(-reach, foot)].map(
          (p, k) =>
            k >= 2
              ? ([p[0], p[1] - TERRAIN_RAIL_HEIGHT + 0.012, p[2]] as [number, number, number])
              : p,
        );
        bed.face(upward(ramp), panelColor);
      }
      bed.surfaceSince(start, TERRAIN_SURFACE_KIND.sidewalk, (x, z) => [
        (x - lead.x) * tx + (z - lead.z) * tz + 40,
        (x - lead.x) * nx + (z - lead.z) * nz - low,
      ]);
    }
    if (!equipment || !owned) continue;
    const active = activeCrossing(crossing);
    const count = crossing.tracks.length;
    const disused = crossing.tracks.every((t) => tracks[t.line]?.disused !== false);
    if (disused) continue;
    // Warning devices for each direction of road traffic, on the side it keeps to.
    for (const approach of [-1, 1]) {
      // A one-way carriageway (its line runs the way traffic does) has one approach.
      if (road.feature.oneway === true && approach > 0) continue;
      const sine = Math.max(0.35, Math.abs(first.dx * crossing.dz - first.dz * crossing.dx));
      const back = Math.min(14, 4.2 / sine);
      const along = approach < 0 ? crossing.from - back : crossing.to + back;
      if (along < 0 || along > road.path.length) continue;
      const travel = -approach;
      const lateral = road.width / 2 + 0.9;
      const p = sampleTerrainLine(road.path, along, keep * travel * lateral);
      const face: [number, number] = [p.dx * approach, p.dz * approach];
      if (!standable(p.x, p.z, 2.2)) continue;
      const base = ground(p.x, p.z);
      if (style.roadSigns !== false)
        crossbuck(input, p.x, base, p.z, face, active ? 4.1 : 3.4, count, push);
      if (active && (style.trafficSignals || style.roadSigns !== false))
        crossingLights(p.x, base, p.z, face, push);
      if (active && road.width >= 5 && road.kind !== 'service')
        crossingGate(p.x, base, p.z, face, keep * travel, road.width, push);
      // The advance warning sign up the road.
      if (style.roadSigns !== false && road.kind !== 'motorway') {
        for (const distance of road.width >= 9 ? [75, 45] : [45, 28]) {
          const ahead = approach < 0 ? crossing.from - distance : crossing.to + distance;
          if (ahead < 0 || ahead > road.path.length) continue;
          const q = sampleTerrainLine(road.path, ahead, keep * travel * (road.width / 2 + 1));
          if (!standable(q.x, q.z, 2.4)) continue;
          advanceWarning(
            input,
            q.x,
            ground(q.x, q.z),
            q.z,
            [q.dx * approach, q.dz * approach],
            push,
          );
          break;
        }
      }
    }
    if (active) {
      // An equipment house beside the track, clear of the road.
      const track = roads[first.line] as SurfaceRoad;
      for (const [step, side] of [
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ] as const) {
        const reach =
          road.width /
          2 /
          Math.max(0.35, Math.abs(first.dx * crossing.dz - first.dz * crossing.dx));
        const q = sampleTerrainLine(track.path, first.distance + step * (reach + 7), side * 4.6);
        if (!standable(q.x, q.z, 2.6)) continue;
        bungalow(q.x, ground(q.x, q.z), q.z, yawOf(q.dx, q.dz), push);
        break;
      }
    }
  }

  // Turnouts: a switch stand or powered machine beside the points.
  const turnouts = detailed ? findTerrainRailTurnouts(lines, pois, size) : [];
  if (equipment)
    for (const turnout of turnouts) {
      const track = tracks[turnout.line];
      if (!track || track.disused || embedded[turnout.line] || !inTile(turnout.x, turnout.z))
        continue;
      stats.turnouts++;
      // Opposite the diverging route; on the side traffic keeps to when that is unknown.
      const side = turnout.side === 0 ? keep : -turnout.side;
      const lateral = track.gauge / 2 + 0.585 + 0.5;
      const nx = -turnout.dz * side,
        nz = turnout.dx * side;
      const x = turnout.x + nx * lateral + turnout.dx * 0.6,
        z = turnout.z + nz * lateral + turnout.dz * 0.6;
      if (!inTile(x, z) || input.blocked(x, z) || nearestOther(x, z, turnout.line, 1.6) < 1.5)
        continue;
      const base = ballastTop(turnout.line, turnout.x, turnout.z) - 0.02;
      const yaw = yawOf(turnout.dx, turnout.dz);
      if (track.service === 'main' && (track.mode === 'heavy' || track.mode === 'light'))
        // A powered switch machine on the sleepers' ends, its throw rod under the near rail.
        push(
          { x, y: base + 0.2, z, yaw, size: [0.42, 0.4, 1.45], color: '#5b6366' },
          {
            x: x + nx * 0.02,
            y: base + 0.44,
            z: z + nz * 0.02,
            yaw,
            size: [0.3, 0.08, 0.5],
            color: '#c9a531',
          },
          {
            x: turnout.x + nx * (lateral / 2),
            y: base + 0.08,
            z: turnout.z + nz * (lateral / 2),
            yaw: yaw + Math.PI / 2,
            size: [0.05, 0.05, lateral],
            color: '#4b4f50',
          },
        );
      else {
        // A hand-thrown stand: a target facing the trains, a lamp on top and a throw lever.
        push(
          { x, y: base + 0.12, z, yaw, size: [0.36, 0.24, 0.36], color: '#3e4446' },
          { x, y: base + 0.75, z, yaw, size: [0.07, 1.1, 0.07], color: '#3e4446' },
          { x, y: base + 1.18, z, yaw, size: [0.34, 0.34, 0.03], color: '#b62c22' },
          { x, y: base + 1.43, z, yaw, size: [0.13, 0.15, 0.13], color: '#2f3436' },
          {
            x: x + turnout.dx * 0.42,
            y: base + 0.3,
            z: z + turnout.dz * 0.42,
            yaw,
            size: [0.05, 0.05, 0.8],
            color: '#3e4446',
          },
        );
      }
    }

  // Buffer stops and derails from mapped points.
  if (equipment)
    for (const poi of pois) {
      if (!/^(buffer_stop|derail)$/.test(poi.class)) continue;
      const px = poi.point[0] * size,
        pz = poi.point[1] * size;
      if (!inTile(px, pz)) continue;
      const near = nearestTerrainRail(lines, px, pz, 4, (line) => tracks[line] !== undefined);
      if (!near) continue;
      const track = tracks[near.line] as TerrainRailTrack;
      const base = ballastTop(near.line, near.x, near.z);
      const yaw = yawOf(near.dx, near.dz);
      const rail = terrainRailOffset(track.gauge);
      if (poi.class === 'derail') {
        const side = near.offset >= 0 ? 1 : -1;
        push(
          {
            x: near.x - near.dz * side * rail,
            y: base + TERRAIN_RAIL_HEIGHT + 0.05,
            z: near.z + near.dx * side * rail,
            yaw,
            size: [0.16, 0.1, 0.4],
            color: '#d6a419',
          },
          {
            x: near.x - near.dz * side * (rail + 1.6),
            y: base + 0.5,
            z: near.z + near.dx * side * (rail + 1.6),
            yaw,
            size: [0.06, 1.0, 0.06],
            color: '#5f6466',
          },
          {
            x: near.x - near.dz * side * (rail + 1.6),
            y: base + 1.1,
            z: near.z + near.dx * side * (rail + 1.6),
            yaw,
            size: [0.42, 0.28, 0.02],
            color: '#e2b52a',
          },
        );
        continue;
      }
      // A buffer stop: posts, a beam across the track and braces, facing the track's open end.
      const path = (roads[near.line] as SurfaceRoad).path;
      const end = near.distance < path.length / 2 ? -1 : 1;
      const fx = near.dx * end,
        fz = near.dz * end;
      const cx = near.x,
        cz = near.z;
      push(
        { x: cx, y: base + 0.95, z: cz, yaw, size: [2.2, 0.36, 0.3], color: '#a8352b' },
        ...[-1, 1].flatMap((s): TerrainBoxPlacement[] => [
          {
            x: cx - near.dz * s * rail,
            y: base + 0.55,
            z: cz + near.dx * s * rail,
            yaw,
            size: [0.24, 1.1, 0.24],
            color: '#3f4446',
          },
          {
            x: cx - near.dz * s * rail + fx * 0.75,
            y: base + 0.55,
            z: cz + near.dx * s * rail + fz * 0.75,
            yaw: yawOf(fx, fz),
            pitch: Math.atan2(0.9, 1.5),
            size: [0.16, 0.16, 1.75],
            color: '#3f4446',
          },
        ]),
      );
    }

  // Color-light signals at mapped signal points.
  if (equipment) {
    const signals = placeTerrainRailSignals(lines, tracks, pois, turnouts, {
      tileSize: size,
      origin: context.origin,
      drivingSide: signProfile.drivingSide,
    });
    const bridges = new Map<number, typeof signals>();
    for (const signal of signals) {
      if (signal.bridge) {
        const list = bridges.get(signal.bridge.group) ?? [];
        list.push(signal);
        bridges.set(signal.bridge.group, list);
        continue;
      }
      const x = signal.x - signal.dz * signal.offset,
        z = signal.z + signal.dx * signal.offset;
      if (!inTile(x, z) || input.blocked(x, z)) continue;
      if (nearestOther(x, z, signal.line, 1.6) < 1.5) continue;
      stats.signals++;
      const deck = bridgeProfiles.get(roads[signal.line] as SurfaceRoad);
      const base = deck ? ballastTop(signal.line, signal.x, signal.z) - 0.3 : ground(x, z);
      colorLightSignal(
        x,
        base,
        z,
        [-signal.dx, -signal.dz],
        signal.aspect,
        signal.dwarf,
        push,
        lamps,
      );
      // A mast signal's relay case, a step farther from the track.
      if (!signal.dwarf && !deck) {
        const side = Math.sign(signal.offset) || 1;
        const cx = x - signal.dz * side * 1.1,
          cz = z + signal.dx * side * 1.1;
        if (standable(cx, cz, 2.4))
          push({
            x: cx,
            y: ground(cx, cz) + 0.65,
            z: cz,
            yaw: yawOf(signal.dx, signal.dz),
            size: [0.55, 1.3, 0.75],
            color: '#a9aca6',
          });
      }
    }
    for (const members of bridges.values()) {
      const lead = members[0];
      if (!lead) continue;
      // Across the tracks, to the right of travel.
      const nx = -lead.dz,
        nz = lead.dx;
      const laterals = members.map((s) => (s.x - lead.x) * nx + (s.z - lead.z) * nz);
      const low = Math.min(...laterals) - 3,
        high = Math.max(...laterals) + 3;
      const ends = [low, high].map((l) => [lead.x + nx * l, lead.z + nz * l] as const);
      if (!ends.every(([x, z]) => inTile(x, z) && !input.blocked(x, z))) continue;
      const base = Math.min(...ends.map(([x, z]) => ground(x, z)));
      const beam = base + 7.2;
      // The interlocking's equipment house, beyond one end of the signal bridge.
      for (const l of [high + 3.2, low - 3.2]) {
        const hx = lead.x + nx * l,
          hz = lead.z + nz * l;
        if (!standable(hx, hz, 2.6)) continue;
        bungalow(hx, ground(hx, hz), hz, yawOf(nx, nz), push);
        break;
      }
      const span = high - low;
      const mid = (low + high) / 2;
      const yaw = yawOf(nx, nz);
      if (
        !push(
          ...ends.map(
            ([x, z]): TerrainBoxPlacement => ({
              x,
              y: (base + beam) / 2,
              z,
              yaw,
              size: [0.3, beam - base, 0.3],
              color: STEEL,
            }),
          ),
          {
            x: lead.x + nx * mid,
            y: beam,
            z: lead.z + nz * mid,
            yaw,
            size: [0.35, 0.45, span],
            color: STEEL,
          },
          {
            x: lead.x + nx * mid - lead.dx * 0.5,
            y: beam + 0.32,
            z: lead.z + nz * mid - lead.dz * 0.5,
            yaw,
            size: [0.05, 0.05, span],
            color: '#c9c9c4',
          },
        )
      )
        continue;
      members.forEach((signal, k) => {
        const l = laterals[k] as number;
        const x = lead.x + nx * l,
          z = lead.z + nz * l;
        stats.signals++;
        signalHead(x, beam - 1.05, z, [-lead.dx, -lead.dz], signal.aspect, 3, push, lamps);
      });
    }
  }

  // Lineside signs: whistle posts, mileposts and yard limits.
  if (equipment && style.roadSigns !== false) {
    const signs = placeTerrainRailSigns(lines, tracks, crossings, pois, {
      tileSize: size,
      origin: context.origin,
      drivingSide: signProfile.drivingSide,
      active: activeCrossing,
    });
    for (const sign of signs.slice(0, 48)) {
      if (!standable(sign.x, sign.z, 1.8)) continue;
      stats.signs++;
      linesideSign(input, sign, ground(sign.x, sign.z), push);
    }
  }

  // Overhead catenary on electrified tracks.
  if (equipment && policy !== 'none') {
    for (const i of order) {
      const track = tracks[i] as TerrainRailTrack;
      if (!terrainRailElectrified(track, policy) || wireBudget <= 0) continue;
      const road = roads[i] as SurfaceRoad;
      const heavy = track.mode === 'heavy';
      const tram = track.mode === 'tram' || embedded[i];
      const contact = heavy ? 5.5 : tram ? 5.6 : 5.2;
      const system = tram ? 0 : heavy ? 1.2 : 1.0;
      const spacing = tram ? 35 : heavy ? 60 : 50;
      const stops = terrainRailMastStations(road.path, context.origin, spacing);
      const supports = stops.map((station, k) => {
        const w = [context.origin[0] + station.x, context.origin[1] + station.z] as const;
        const stagger = (terrainRailHash(w[0], w[1], 17) < 0.5 ? -1 : 1) * (tram ? 0.1 : 0.2);
        const center = sampleTerrainLine(road.path, station.distance);
        const base = ballastTop(i, center.x, center.z) + TERRAIN_RAIL_HEIGHT;
        return { station, stagger, base, k, center };
      });
      for (const support of supports) {
        const { station, base, center } = support;
        if (!inTile(station.x, station.z)) continue;
        let mast: { x: number; z: number; offset: number } | undefined;
        // Outside a pair of tracks rather than between them; else on the side traffic keeps to.
        const beside = (side: number): boolean => {
          const probe = sampleTerrainLine(road.path, station.distance, side * 4.4);
          return nearestOther(probe.x, probe.z, i, 2.4) < 2.4;
        };
        const preferred = beside(keep) && !beside(-keep) ? -keep : keep;
        search: for (const offset of tram ? [3.4, 4.5, 6, 7.5] : [heavy ? 3.2 : 2.8]) {
          for (const side of [preferred, -preferred]) {
            const p = sampleTerrainLine(road.path, station.distance, side * offset);
            // On a viaduct the mast stands on the deck, whatever lies below it.
            const deck = road.feature.bridge === true;
            if (
              inTile(p.x, p.z) &&
              (deck || (!input.blocked(p.x, p.z) && !network.occupied(p.x, p.z, 0.3))) &&
              nearestOther(p.x, p.z, i, 2.2) > 2.1
            ) {
              mast = { x: p.x, z: p.z, offset: side * offset };
              break search;
            }
          }
        }
        if (!mast) continue;
        const foot = bridgeProfiles.get(road)
          ? base - TERRAIN_RAIL_HEIGHT - 0.3
          : ground(mast.x, mast.z);
        const height = base + contact + system + 0.6 - foot;
        const nx = -center.dz,
          nz = center.dx;
        const reach = Math.abs(mast.offset) + 0.5;
        const sign = Math.sign(mast.offset);
        const armYaw = yawOf(nx, nz);
        const parts: TerrainBoxPlacement[] = [
          {
            x: mast.x,
            y: foot + height / 2,
            z: mast.z,
            yaw: armYaw,
            size: [0.26, height, 0.26],
            color: STEEL,
          },
          {
            x: mast.x,
            y: foot + 0.15,
            z: mast.z,
            yaw: armYaw,
            size: [0.6, 0.3, 0.6],
            color: '#9c9a93',
          },
          // Registration arm at the contact wire, and the support tube for the messenger above.
          {
            x: mast.x - nx * sign * (reach / 2),
            y: base + contact + 0.12,
            z: mast.z - nz * sign * (reach / 2),
            yaw: armYaw,
            size: [0.06, 0.06, reach],
            color: STEEL,
          },
        ];
        if (system > 0)
          parts.push({
            x: mast.x - nx * sign * (reach / 2),
            y: base + contact + system + 0.08,
            z: mast.z - nz * sign * (reach / 2),
            yaw: armYaw,
            size: [0.07, 0.07, reach],
            color: STEEL,
          });
        if (push(...parts)) stats.masts++;
      }
      // Wires: each span belongs to the tile its first station lies in.
      for (let k = 0; k + 1 < supports.length && wireBudget > 0; k++) {
        const a = supports[k] as (typeof supports)[number],
          b = supports[k + 1] as (typeof supports)[number];
        if (!inTile(a.station.x, a.station.z)) continue;
        const at = (s: typeof a): [number, number] => {
          const p = sampleTerrainLine(road.path, s.station.distance, s.stagger);
          return [p.x, p.z];
        };
        const [ax, az] = at(a),
          [bx, bz] = at(b);
        const span = Math.hypot(bx - ax, bz - az);
        if (span < 5 || span > 120) continue;
        const yaw = yawOf(bx - ax, bz - az);
        const ya = a.base + contact,
          yb = b.base + contact;
        wire(wires, ax, ya, az, bx, yb, bz, 0.024, '#3b3226');
        wireBudget--;
        if (system <= 0) continue;
        const sag = Math.min(0.9, system * 0.75);
        const messenger = (t: number): [number, number, number] => [
          ax + (bx - ax) * t,
          ya + (yb - ya) * t + system - 4 * sag * t * (1 - t),
          az + (bz - az) * t,
        ];
        for (let piece = 0; piece < 4; piece++) {
          const p = messenger(piece / 4),
            q = messenger((piece + 1) / 4);
          wire(wires, p[0], p[1], p[2], q[0], q[1], q[2], 0.028, '#3b3226');
        }
        wireBudget -= 4;
        // Droppers every 5.5 m hang the contact wire level from the sagging messenger.
        for (let t = 5.5 / span; t < 1 - 2 / span && wireBudget > 0; t += 5.5 / span) {
          const top = messenger(t);
          const low = ya + (yb - ya) * t;
          wires.push({
            x: top[0],
            y: (top[1] + low) / 2,
            z: top[2],
            yaw,
            size: [0.012, Math.max(0.05, top[1] - low), 0.012],
            color: '#5d5a52',
          });
          wireBudget--;
        }
      }
    }
  }

  // Platforms: raised concrete with a tactile edge where they meet a track.
  for (const feature of tile.landcover) {
    if (!/platform/.test(`${feature.class} ${feature.subclass ?? ''}`)) continue;
    for (const polygon of feature.polygons) {
      const bounds = polygonBounds(polygon);
      const cx = ((bounds[0] + bounds[2]) / 2) * size,
        cz = ((bounds[1] + bounds[3]) / 2) * size;
      const near = nearestTerrainRail(lines, cx, cz, 40, (line) => tracks[line] !== undefined);
      const track = near ? tracks[near.line] : undefined;
      const us = northAmerican(signProfile);
      const height = !track
        ? 0.18
        : track.mode === 'light' || track.mode === 'tram'
          ? 0.36
          : track.mode === 'subway'
            ? 1.0
            : us
              ? 0.4
              : 0.9;
      const deck = near && bridgeProfiles.get(roads[near.line] as SurfaceRoad);
      if (deck) continue;
      stats.platforms++;
      const start = bed.vertexCount;
      appendTerrainSurfaceArea(bed, polygon, new THREE.Color('#b8b4a9'), height);
      bed.surfaceSince(start, TERRAIN_SURFACE_KIND.plaza);
      if (!detailed) continue;
      platformEdges(bed, polygon, height, lines, tracks, segmentBudget);
    }
  }

  const bedMesh = weldTerrainSurfaceMesh(bed.mesh(TERRAIN_RAIL_MESHES.bed));
  if (bedMesh) {
    bedMesh.userData[TERRAIN_PAVEMENT] = true;
    group.add(bedMesh);
  }
  const railMesh = rails.mesh(TERRAIN_RAIL_MESHES.rails, RAIL_MATERIAL);
  if (railMesh) {
    // The host pavement material polishes the heads and drops rails thinner than a pixel.
    railMesh.userData[TERRAIN_PAVEMENT] = true;
    group.add(railMesh);
  }
  if (wires.length) {
    const mesh = createWireInstances(wires);
    group.add(mesh);
  }
  appendTerrainRailLamps(group, lamps);
  // Cuts of cars standing in yards and on sidings, out to tiles a level coarser than the finest:
  // a yard full of cars reads from far off.
  if (
    input.railCars?.length &&
    input.vehicles &&
    context.pyramid.maxLevel - context.address.level <= 1
  ) {
    const placed = placeTerrainYardCars({
      lines,
      tracks,
      turnouts: detailed ? turnouts : findTerrainRailTurnouts(lines, pois, size),
      crossings: detailed ? crossings : findTerrainRailCrossings(lines, streets, pois, size),
      railHead: (line, x, z) => ballastTop(line, x, z) + TERRAIN_RAIL_HEIGHT,
      origin: context.origin,
      size,
      cars: input.railCars,
      ...(input.railCarOccupancy !== undefined ? { occupancy: input.railCarOccupancy } : {}),
      max: detailed ? 1400 : 900,
    });
    input.vehicles.push(...placed);
    stats.cars = placed.length;
  }
  return stats;
}

/** A sign profile for North America alone (not a shared profile that merely lists it). */
function northAmerican(profile: Readonly<TerrainRoadSignProfile>): boolean {
  return profile.countries.every((c) => c === 'US' || c === 'CA' || c === 'MX');
}

/** A face listed in either winding, wound to face up. */
function upward(points: [number, number, number][]): [number, number, number][] {
  const [a, b, c] = points as [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  const ux = b[0] - a[0],
    uz = b[2] - a[2],
    vx = c[0] - a[0],
    vz = c[2] - a[2];
  return uz * vx - ux * vz < 0 ? [...points].reverse() : points;
}

/** A straight wire from a to b, as a thin pitched box. */
function wire(
  list: TerrainBoxPlacement[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  thickness: number,
  color: string,
): void {
  const horizontal = Math.hypot(bx - ax, bz - az);
  const length = Math.hypot(horizontal, by - ay);
  if (length < 0.01) return;
  list.push({
    x: (ax + bx) / 2,
    y: (ay + by) / 2,
    z: (az + bz) / 2,
    yaw: Math.atan2(bx - ax, bz - az),
    pitch: -Math.atan2(by - ay, horizontal),
    size: [thickness, thickness, length],
    color,
  });
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
/** Meters beyond which a wire segment, a few centimeters thick, is far below a pixel. */
const WIRE_REACH = 140;
const WIRE_MATERIAL = new THREE.MeshStandardMaterial({ roughness: 0.6 });
// WebGL: collapse a whole segment (by its instance's center) once it is past WIRE_REACH, where it
// would shimmer as broken dots. WebGPU draws it to the tile's draw distance instead.
WIRE_MATERIAL.onBeforeCompile = (shader, renderer): void => {
  THREE.Material.prototype.onBeforeCompile.call(WIRE_MATERIAL, shader, renderer);
  shader.vertexShader = shader.vertexShader.replace(
    '#include <project_vertex>',
    `#include <project_vertex>
    #ifdef USE_INSTANCING
      vec4 terrainWireCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      if (length(terrainWireCenter.xyz) > ${WIRE_REACH.toFixed(1)}) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    #endif`,
  );
};
WIRE_MATERIAL.customProgramCacheKey = (): string => 'terrain-rail-wire@1';

function createWireInstances(placements: readonly TerrainBoxPlacement[]): THREE.InstancedMesh {
  const mesh = new InstanceBatch(BOX, WIRE_MATERIAL, placements.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    rotation.setFromEuler(euler.set(p.pitch ?? 0, p.yaw, 0, 'YXZ'));
    mesh.setMatrixAt(
      i,
      matrix.compose(new THREE.Vector3(p.x, p.y, p.z), rotation, new THREE.Vector3(...p.size)),
    );
    mesh.setColorAt(i, color.set(p.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = TERRAIN_RAIL_MESHES.wires;
  // Wires are a few centimeters thick: their shadows are noise, not grounding.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.terrainOwnedInstances = true;
  return mesh;
}

/** A sign plane facing `face` (unit, horizontal) with its center at (x, y, z). */
interface Frame {
  x: number;
  y: number;
  z: number;
  face: readonly [number, number];
}

/** World point of sign-plane (u right, v up) at `depth` toward the reader. */
function framePoint(frame: Frame, u: number, v: number, depth: number): [number, number, number] {
  const [nx, nz] = frame.face;
  return [frame.x + nz * u + nx * depth, frame.y + v, frame.z - nx * u + nz * depth];
}

/** A flat polygon in a sign plane, rotated `angle` about the plane's normal. */
function signPolygon(
  builder: TerrainSurfaceMeshBuilder,
  frame: Frame,
  points: readonly (readonly [number, number])[],
  depth: number,
  color: string,
  angle = 0,
  center: readonly [number, number] = [0, 0],
): void {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  builder.face(
    points.map(([u, v]) =>
      framePoint(frame, center[0] + u * c - v * s, center[1] + u * s + v * c, depth),
    ),
    new THREE.Color(color),
  );
}

function rectangle(w: number, h: number): [number, number][] {
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
}

function circle(radius: number, sides = 24): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i * Math.PI * 2) / sides;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

/** Lettering in a sign plane, fitted to a box, rotated with its board. */
function signText(
  input: Pick<TerrainRailwayInput, 'signFaces' | 'fonts' | 'font'>,
  frame: Frame,
  value: string,
  width: number,
  height: number,
  color: string,
  angle = 0,
  center: readonly [number, number] = [0, 0],
  depth = 0.032,
): void {
  const fonts = input.fonts;
  if (!fonts || !value) return;
  const requested = input.font;
  const resolved = requested ? (fonts.roles?.[requested] ?? requested) : undefined;
  const mesh = buildTextMesh(value, fonts, {
    font:
      resolved && fonts.fonts[resolved] ? resolved : (fonts.roles?.highway ?? fonts.defaultFont),
    maxWidth: width,
    maxHeight: height,
    size: height * 2,
    align: 'center',
    verticalAlign: 'center',
    maxCharacters: 24,
  });
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points: [number, number][] = [];
    for (let j = 0; j < 3; j++) {
      const index = (mesh.indices[i + j] as number) * 3;
      points.push([mesh.positions[index] as number, mesh.positions[index + 1] as number]);
    }
    signPolygon(input.signFaces, frame, points, depth, color, angle, center);
  }
}

/** A white board with a dark border, its back in galvanized grey. */
function board(
  input: Pick<TerrainRailwayInput, 'signFaces'>,
  frame: Frame,
  w: number,
  h: number,
  angle = 0,
  center: readonly [number, number] = [0, 0],
  field = '#eeeadd',
  border = '#2f3436',
): void {
  signPolygon(input.signFaces, frame, rectangle(w, h), -0.012, '#a2aaa7', angle, center);
  signPolygon(input.signFaces, frame, rectangle(w, h), 0.012, border, angle, center);
  signPolygon(input.signFaces, frame, rectangle(w - 0.05, h - 0.05), 0.018, field, angle, center);
}

/** R15-1 crossbuck on its post, with an R15-2P plate counting the tracks when more than one. */
function crossbuck(
  input: TerrainRailwayInput,
  x: number,
  base: number,
  z: number,
  face: readonly [number, number],
  height: number,
  tracks: number,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  const yaw = yawOf(face[0], face[1]);
  if (!push({ x, y: base + height / 2, z, yaw, size: [0.1, height, 0.1], color: '#a7acaa' }))
    return;
  const frame: Frame = {
    x: x + face[0] * 0.07,
    y: base + height - 0.45,
    z: z + face[1] * 0.07,
    face,
  };
  for (const [angle, label, depth] of [
    [Math.PI / 4, 'RAILROAD', 0],
    [-Math.PI / 4, 'CROSSING', 0.04],
  ] as const) {
    const lifted: Frame = { ...frame, x: frame.x + face[0] * depth, z: frame.z + face[1] * depth };
    board(input, lifted, 1.22, 0.23, angle);
    signText(input, lifted, label, 1.0, 0.13, '#2f3436', angle);
  }
  if (tracks > 1) {
    const plate: Frame = { ...frame, y: frame.y - 0.78 };
    board(input, plate, 0.68, 0.34);
    signText(input, plate, `${tracks} TRACKS`, 0.56, 0.16, '#2f3436');
  }
}

/** Flashing-light signal: a crossarm with a pair of red lamp units (dark until a train comes). */
function crossingLights(
  x: number,
  base: number,
  z: number,
  face: readonly [number, number],
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  const yaw = yawOf(face[0], face[1]);
  const rx = face[1],
    rz = -face[0];
  const y = base + 2.85;
  const parts: TerrainBoxPlacement[] = [
    {
      x: x + face[0] * 0.08,
      y,
      z: z + face[1] * 0.08,
      yaw,
      size: [1.35, 0.09, 0.09],
      color: '#a7acaa',
    },
    // The bell on top of the mast.
    { x, y: base + 4.45, z, yaw, size: [0.22, 0.14, 0.22], color: SIGNAL_BLACK },
  ];
  for (const s of [-1, 1]) {
    const lx = x + rx * s * 0.56 + face[0] * 0.14,
      lz = z + rz * s * 0.56 + face[1] * 0.14;
    parts.push(
      { x: lx, y, z: lz, yaw, size: [0.55, 0.55, 0.05], color: SIGNAL_BLACK },
      {
        x: lx + face[0] * 0.04,
        y,
        z: lz + face[1] * 0.04,
        yaw,
        size: [0.27, 0.27, 0.04],
        color: '#5b1d18',
      },
      {
        x: lx + face[0] * 0.15,
        y: y + 0.17,
        z: lz + face[1] * 0.15,
        yaw,
        size: [0.32, 0.03, 0.2],
        color: SIGNAL_BLACK,
      },
    );
  }
  push(...parts);
}

/** A crossing gate, raised: its mechanism on the mast and a striped arm standing upright. */
function crossingGate(
  x: number,
  base: number,
  z: number,
  face: readonly [number, number],
  side: number,
  roadWidth: number,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  const yaw = yawOf(face[0], face[1]);
  // Toward the road from the mast.
  const rx = -face[1] * side,
    rz = face[0] * side;
  const gx = x + rx * 0.45 - face[0] * 0.25,
    gz = z + rz * 0.45 - face[1] * 0.25;
  const length = Math.min(9, roadWidth / 2 + 1.2);
  const parts: TerrainBoxPlacement[] = [
    { x: gx, y: base + 1.05, z: gz, yaw, size: [0.32, 0.5, 0.42], color: '#a7acaa' },
    {
      x: gx - rx * 0.35,
      y: base + 1.05,
      z: gz - rz * 0.35,
      yaw,
      size: [0.3, 0.3, 0.3],
      color: '#3d4244',
    },
  ];
  const stripe = 0.6;
  for (let k = 0; k < Math.floor(length / stripe); k++)
    parts.push({
      x: gx + rx * 0.22,
      y: base + 1.35 + stripe * (k + 0.5),
      z: gz + rz * 0.22,
      yaw,
      size: [0.1, stripe, 0.08],
      color: k % 2 === 0 ? '#e9e5da' : '#b8312a',
    });
  push(...parts);
}

/** W10-1 advance warning (round, yellow, X and R R); a red-bordered triangle outside the US. */
function advanceWarning(
  input: TerrainRailwayInput,
  x: number,
  base: number,
  z: number,
  face: readonly [number, number],
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  const yaw = yawOf(face[0], face[1]);
  if (!push({ x, y: base + 1.35, z, yaw, size: [0.075, 2.7, 0.075], color: '#a7acaa' })) return;
  const frame: Frame = { x: x + face[0] * 0.06, y: base + 2.7, z: z + face[1] * 0.06, face };
  if (northAmerican(input.signProfile)) {
    signPolygon(input.signFaces, frame, circle(0.46), -0.012, '#a2aaa7');
    signPolygon(input.signFaces, frame, circle(0.46), 0.012, '#2f3436');
    signPolygon(input.signFaces, frame, circle(0.43), 0.018, '#e2b52a');
    for (const angle of [Math.PI / 4, -Math.PI / 4])
      signPolygon(input.signFaces, frame, rectangle(0.66, 0.06), 0.024, '#2f3436', angle);
    for (const u of [-0.2, 0.2]) signText(input, frame, 'R', 0.18, 0.2, '#2f3436', 0, [u, 0], 0.03);
    return;
  }
  const triangle = (r: number): [number, number][] => [
    [0, r],
    [-r * 0.866, -r * 0.5],
    [r * 0.866, -r * 0.5],
  ];
  signPolygon(input.signFaces, frame, triangle(0.58), -0.012, '#a2aaa7');
  signPolygon(input.signFaces, frame, triangle(0.58), 0.012, '#b8312a');
  signPolygon(input.signFaces, frame, triangle(0.42), 0.018, '#eeeadd');
  // A gate: two posts and a bar.
  for (const u of [-0.15, 0.15])
    signPolygon(input.signFaces, frame, rectangle(0.04, 0.2), 0.024, '#2f3436', 0, [u, -0.06]);
  signPolygon(input.signFaces, frame, rectangle(0.38, 0.05), 0.024, '#2f3436', 0, [0, 0.0]);
}

/** A relay house: walls, a slightly larger roof and a door. */
function bungalow(
  x: number,
  base: number,
  z: number,
  yaw: number,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  push(
    { x, y: base + 1.25, z, yaw, size: [2.4, 2.5, 2.6], color: '#b9bcb6' },
    { x, y: base + 2.58, z, yaw, size: [2.65, 0.16, 2.85], color: '#8e918d' },
    {
      x: x + Math.cos(yaw) * 1.21,
      y: base + 1.05,
      z: z - Math.sin(yaw) * 1.21,
      yaw,
      size: [0.03, 2.0, 0.9],
      color: '#9fa29c',
    },
  );
}

/** A color-light signal: a mast (or a dwarf's pedestal), its head and the lit aspect. */
function colorLightSignal(
  x: number,
  base: number,
  z: number,
  face: readonly [number, number],
  aspect: TerrainRailAspect,
  dwarf: boolean,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
  lamps: TerrainRailLamp[],
): void {
  const yaw = yawOf(face[0], face[1]);
  if (dwarf) {
    if (!push({ x, y: base + 0.2, z, yaw, size: [0.4, 0.4, 0.4], color: '#5f6466' })) return;
    signalHead(x, base + 0.75, z, face, aspect, 2, push, lamps);
    return;
  }
  const top = base + 5.4;
  if (
    !push(
      { x, y: base + 0.15, z, yaw, size: [0.7, 0.3, 0.7], color: '#9c9a93' },
      { x, y: (base + top) / 2, z, yaw, size: [0.18, top - base, 0.18], color: STEEL },
    )
  )
    return;
  signalHead(x, top - 0.55, z, face, aspect, 3, push, lamps);
}

/** A signal head of `count` lenses (green over yellow over red), with one lit. */
function signalHead(
  x: number,
  y: number,
  z: number,
  face: readonly [number, number],
  aspect: TerrainRailAspect,
  count: 2 | 3,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
  lamps: TerrainRailLamp[],
): void {
  const yaw = yawOf(face[0], face[1]);
  const pitch = 0.32;
  const height = count * pitch + 0.15;
  const parts: TerrainBoxPlacement[] = [
    { x, y, z, yaw, size: [0.38, height, 0.28], color: SIGNAL_BLACK },
    {
      x: x - face[0] * 0.15,
      y,
      z: z - face[1] * 0.15,
      yaw,
      size: [0.62, height + 0.18, 0.03],
      color: SIGNAL_BLACK,
    },
  ];
  const order: TerrainRailAspect[] = count === 3 ? ['green', 'yellow', 'red'] : ['yellow', 'red'];
  const lit = order.indexOf(aspect) >= 0 ? order.indexOf(aspect) : 0;
  order.forEach((_, k) => {
    const ly = y + ((count - 1) / 2 - k) * pitch;
    parts.push(
      {
        x: x + face[0] * 0.16,
        y: ly + 0.12,
        z: z + face[1] * 0.16,
        yaw,
        size: [0.26, 0.03, 0.16],
        color: SIGNAL_BLACK,
      },
      {
        x: x + face[0] * 0.145,
        y: ly,
        z: z + face[1] * 0.145,
        yaw,
        size: [0.19, 0.19, 0.02],
        color: '#1a1d1e',
      },
    );
    if (k === lit)
      lamps.push({
        x: x + face[0] * 0.16,
        y: ly,
        z: z + face[1] * 0.16,
        yaw,
        color: order[k] as TerrainRailAspect,
        radius: 0.11,
      });
  });
  push(...parts);
}

/** Whistle posts, mileposts and yard limit boards. */
function linesideSign(
  input: TerrainRailwayInput,
  sign: TerrainRailSign,
  base: number,
  push: (...parts: TerrainBoxPlacement[]) => boolean,
): void {
  const face: [number, number] = [sign.dx, sign.dz];
  const yaw = yawOf(sign.dx, sign.dz);
  const [w, h, height] =
    sign.kind === 'whistle'
      ? [0.46, 0.6, 2.2]
      : sign.kind === 'milepost'
        ? [0.36, 0.5, 1.9]
        : [0.95, 0.5, 2.3];
  if (
    !push({
      x: sign.x,
      y: base + height / 2,
      z: sign.z,
      yaw,
      size: [0.08, height, 0.08],
      color: '#a7acaa',
    })
  )
    return;
  const frame: Frame = {
    x: sign.x + sign.dx * 0.06,
    y: base + height - h / 2,
    z: sign.z + sign.dz * 0.06,
    face,
  };
  board(input, frame, w, h);
  if (sign.kind === 'yard-limit') {
    signText(input, frame, 'YARD', w * 0.8, h * 0.3, '#2f3436', 0, [0, h * 0.18]);
    signText(input, frame, 'LIMIT', w * 0.8, h * 0.3, '#2f3436', 0, [0, -h * 0.18]);
  } else signText(input, frame, sign.text, w * 0.75, h * 0.6, '#2f3436');
}

/** Platform walls down to the ground, and a yellow tactile strip along edges that face a track. */
function platformEdges(
  builder: TerrainSurfaceMeshBuilder,
  polygon: { outer: TerrainSemanticPoint[]; holes?: TerrainSemanticPoint[][] },
  height: number,
  lines: readonly TerrainRailLine[],
  tracks: readonly (TerrainRailTrack | undefined)[],
  budget: number,
): void {
  const size = builder.context.tileSize;
  const wall = new THREE.Color('#9b978d');
  let left = budget;
  for (const source of [polygon.outer, ...(polygon.holes ?? [])]) {
    const ring = normalizeRing(source).map(
      (p) => [p[0] * size, p[1] * size] as TerrainSemanticPoint,
    );
    if (ring.length < 3) continue;
    for (let k = 0; k < ring.length && left > 0; k++) {
      const a = ring[k] as TerrainSemanticPoint,
        b = ring[(k + 1) % ring.length] as TerrainSemanticPoint;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.2) continue;
      const pieces = Math.max(1, Math.ceil(length / 3));
      for (let s = 0; s < pieces; s++) {
        const t0 = s / pieces,
          t1 = (s + 1) / pieces;
        const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0] as const,
          p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1] as const;
        if (!clipToTile(p0[0], p0[1], p1[0], p1[1], size)) continue;
        const g0 = builder.groundHeight(p0[0], p0[1]),
          g1 = builder.groundHeight(p1[0], p1[1]);
        builder.face(
          [
            [p0[0], g0 - 0.05, p0[1]],
            [p1[0], g1 - 0.05, p1[1]],
            [p1[0], g1 + height, p1[1]],
            [p0[0], g0 + height, p0[1]],
          ],
          wall,
        );
        left--;
      }
      // Tactile warning strip on the edge facing a track.
      const mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      const near = nearestTerrainRail(lines, mx, mz, 4.5, (line) => tracks[line] !== undefined);
      if (!near || length < 2) continue;
      const ux = (b[0] - a[0]) / length,
        uz = (b[1] - a[1]) / length;
      const path = terrainLinePath(
        [
          [a[0] / size, a[1] / size],
          [b[0] / size, b[1] / size],
        ],
        size,
      );
      // Offsets are positive to the right of travel, [-uz, ux].
      const probe = [mx + -uz * 0.5, mz + ux * 0.5] as const;
      const rightIsInside = pointInPolygon([probe[0] / size, probe[1] / size], polygon);
      const sign = rightIsInside ? 1 : -1;
      appendTerrainLineBand(builder, path, {
        width: 0.6,
        offset: sign * 0.55,
        color: '#d9b43c',
        elevation: height + 0.012,
        surface: TERRAIN_SURFACE_KIND.plain,
      });
    }
  }
}

const LAMP_MATRIX = new THREE.Matrix4();
const LAMP_ROTATION = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Self-lit signal lamps: one instanced draw per tile, rebuilt from data on the main thread. */
export function appendTerrainRailLamps(
  group: THREE.Group,
  lamps: readonly TerrainRailLamp[],
): void {
  group.userData.railLamps = lamps;
  if (!lamps.length) return;
  const mesh = new InstanceBatch(LAMP, LAMP_MATERIAL, lamps.length);
  mesh.name = TERRAIN_RAIL_MESHES.lamps;
  lamps.forEach((lamp, i) => {
    LAMP_ROTATION.setFromAxisAngle(UP, lamp.yaw);
    mesh.setMatrixAt(
      i,
      LAMP_MATRIX.compose(
        new THREE.Vector3(lamp.x, lamp.y, lamp.z),
        LAMP_ROTATION,
        new THREE.Vector3(lamp.radius, lamp.radius, lamp.radius),
      ),
    );
    mesh.setColorAt(i, LAMP_COLORS[lamp.color]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.userData.terrainOwnedInstances = true;
  group.add(mesh);
}

/**
 * Give rail meshes, built here or reassembled from a surface worker, their materials and flags:
 * rails and wires stay out of walking and driving collision and cast no shadows, and both count
 * the camera's height above the ground toward their draw distance (see `updateDetail`), since
 * they are only centimeters thick.
 */
export function dressTerrainRailMeshes(group: THREE.Object3D): void {
  for (const child of group.children) {
    if (child.name !== TERRAIN_RAIL_MESHES.rails && child.name !== TERRAIN_RAIL_MESHES.wires)
      continue;
    const mesh = child as THREE.Mesh;
    mesh.material = child.name === TERRAIN_RAIL_MESHES.rails ? RAIL_MATERIAL : WIRE_MATERIAL;
    mesh.userData.walkIgnore = true;
    mesh.userData.detailAboveGround = true;
    mesh.castShadow = false;
    if (child.name === TERRAIN_RAIL_MESHES.wires) mesh.receiveShadow = false;
  }
}
