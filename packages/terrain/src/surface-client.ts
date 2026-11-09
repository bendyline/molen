/** Styled roads and paved areas, built on the reusable line-feature renderer. */
import { createParkedVehicleBatch } from '@bendyline/molen-client/vehicles';
import type { VehiclePlacement } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { appendAirportSurfaces } from './airport-surfaces';
import { gradeHighwayBridges } from './highway-grading';
import { sampleTerrainLine } from './line-path';
import {
  appendTerrainLineBand,
  appendTerrainSurfaceArea,
  createTerrainBoxInstances,
  TERRAIN_PAVEMENT,
  TERRAIN_SURFACE_KIND,
  type TerrainBoxPlacement,
  type TerrainLineBand,
  type TerrainRoadWear,
  TerrainSurfaceMeshBuilder,
  terrainLinePath,
  weldTerrainSurfaceMesh,
} from './linear-features';
import { normalizeRing, pointInPolygon, polygonBounds } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { renderedGroundSampler } from './rendered-ground';
import { DEFAULT_ROAD_SIGN_PROFILE, type TerrainRoadSignProfile } from './road-sign-styles';
import { keepTerrainSemanticTile } from './semantic-packet';
import type {
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from './semantic-types';
import {
  appendBridgeApproachSupport,
  appendBridgeStructure,
  bridgeDeckProfile,
} from './surface-bridges';
import { incomingArm, surfaceJunctionControls } from './surface-controls';
import {
  appendTerrainStreetLights,
  type TerrainStreetLight,
  updateTerrainStreetLights,
} from './surface-lights';
import {
  isSurfaceLink,
  type SurfaceJunction,
  SurfaceNetwork,
  type SurfaceRoad,
} from './surface-network';
import { inferTerrainParkingAreas } from './surface-parking';
import { appendSurfaceSign } from './surface-sign-mesh';
import { planSurfaceSigns } from './surface-signage';
import {
  appendTerrainSignalLenses,
  type TerrainSignalHead,
  type TerrainTrafficSignalResolver,
  updateTerrainSurfaceSignals,
} from './surface-signals';
import {
  resolveTerrainSurfaceStyle,
  type TerrainParkedVehicle,
  type TerrainSurfaceOptions,
} from './surface-styles';
import { tagTerrainObject } from './tagged-objects';
import { inferLaneCount, isArterialRoad } from './transport-features';

export interface TerrainSurfaceStats {
  /** Resident tile fragments; a runway crossing tiles contributes more than once. */
  runways: number;
  taxiways: number;
  aprons: number;
  roads: number;
  parkingAreas: number;
  junctions: number;
  streetlights: number;
  /** Utility poles and hydrants along blocks with sidewalks. */
  streetFurniture: number;
  trafficSignals: number;
  roadSigns: number;
  parkingBays: number;
  parkedCars: number;
  detailLimited: boolean;
}

/** Dispose tile-owned buffers and GPU instance attributes, retaining shared materials. */
export function disposeTerrainSurfaceObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.terrainOwnedGeometry) {
      mesh.geometry.dispose();
      mesh.userData.terrainOwnedGeometry = false;
    }
    if (mesh.userData.terrainOwnedInstances) {
      (mesh as THREE.InstancedMesh).dispose();
      mesh.userData.terrainOwnedInstances = false;
    }
    if (mesh.userData.terrainOwnedMaterial) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        material.dispose();
      mesh.userData.terrainOwnedMaterial = false;
    }
  });
}

function areaKind(className: string, subclass = ''): 'parking' | 'plaza' | 'path' | undefined {
  const tag = `${className} ${subclass}`.toLowerCase();
  if (/parking|car_park/.test(tag) && !/garage|underground|multi.storey/.test(tag))
    return 'parking';
  if (/pedestrian|plaza|square|platform/.test(tag)) return 'plaza';
  if (/pavement|footway|sidewalk/.test(tag)) return 'path';
  return undefined;
}

/** Meters an area's frayed fringe reaches inside and outside its mapped edge. */
const FRINGE_INSIDE = 0.2;
const FRINGE_OUTSIDE = 0.3;

/**
 * Trace each ring of a paved area with a narrow band of the same surface that frays into the
 * ground outside it, so a lot or plaza no longer ends on a ruled polygon edge. `keep` drops
 * stretches that meet a road or building, where the edge belongs to them.
 */
function appendAreaFringe(
  builder: TerrainSurfaceMeshBuilder,
  polygon: TerrainSemanticPolygon,
  band: Omit<TerrainLineBand, 'width' | 'offset' | 'fray'>,
  keep: (points: readonly TerrainSemanticPoint[]) => boolean,
): void {
  const tileSize = builder.context.tileSize;
  for (const source of [polygon.outer, ...(polygon.holes ?? [])]) {
    const ring = normalizeRing(source);
    const first = ring[0];
    if (ring.length < 3 || first === undefined) continue;
    const path = terrainLinePath([...ring, first], tileSize);
    if (!(path.length > 0)) continue;
    // Which side is outside: probe just off the middle of the ring's longest segment.
    let longest = 0,
      probeAt = 0;
    for (let i = 1; i < path.distances.length; i++) {
      const span = (path.distances[i] ?? 0) - (path.distances[i - 1] ?? 0);
      if (span > longest) {
        longest = span;
        probeAt = (path.distances[i - 1] ?? 0) + span / 2;
      }
    }
    const probe = sampleTerrainLine(path, probeAt, 0.05);
    const outward = pointInPolygon([probe.x / tileSize, probe.z / tileSize], polygon) ? -1 : 1;
    appendTerrainLineBand(
      builder,
      path,
      {
        ...band,
        width: FRINGE_INSIDE + FRINGE_OUTSIDE,
        offset: (outward * (FRINGE_OUTSIDE - FRINGE_INSIDE)) / 2,
        fray: 'outer',
      },
      { spacing: 3, filter: keep },
    );
  }
}

/** Meters per cell of the building-centroid grid, and its reach in cells (about 70 m). */
const BUILT_CELL = 20;
const BUILT_REACH = 3;
/** Meters between the stations along a street at which its sidewalks are decided. */
const SIDEWALK_STATION = 10;
/** Meters between the stations at which a two-lane road's passing zones are decided. */
const PASSING_STATION = 5;
/** Countries whose center lines are yellow (MUTCD and its neighbors, much of Latin America, Korea). */
const YELLOW_CENTER_LINES: ReadonlySet<string> = new Set([
  'US',
  'CA',
  'MX',
  'GT',
  'BZ',
  'SV',
  'HN',
  'NI',
  'CR',
  'PA',
  'CO',
  'VE',
  'EC',
  'PE',
  'BO',
  'BR',
  'PY',
  'UY',
  'AR',
  'CL',
  'KR',
]);
/** US dash pattern: 10 ft of paint, 30 ft of gap. */
const BROKEN_LINE: readonly [number, number] = [3, 9];
/** Paint widths: lane and center lines (about 4.5 in), edge lines (6 in), and the gap of a double line. */
const LINE_WIDTH = 0.11;
const EDGE_LINE_WIDTH = 0.15;
const DOUBLE_LINE_GAP = 0.11;

const ARTERIAL_RANKS = ['trunk', 'primary', 'secondary', 'tertiary'];

/** Freeways 0, then trunk to tertiary roads, other streets, service roads, and the rest. */
function roadImportance(road: SurfaceRoad): number {
  if (road.kind === 'motorway') return 0;
  const category = road.feature.subclass ?? road.feature.class;
  const rank = ARTERIAL_RANKS.findIndex((name) => category.startsWith(name));
  if (rank >= 0) return rank + 1;
  return road.kind === 'street' ? 5 : road.kind === 'service' ? 6 : 7;
}

/**
 * Settle a row of 0/1 stations into runs, in place: grow every run by `grow` stations each way,
 * fill gaps of up to `gap` stations, then clear runs shorter than `minimum` stations unless they
 * reach an end of the row (where the line leaves the tile and may carry on).
 */
function settleRuns(flags: Uint8Array, grow: number, gap: number, minimum: number): void {
  const source = flags.slice();
  for (let i = 0; i < flags.length; i++) {
    let on = 0;
    for (let k = Math.max(0, i - grow); k <= Math.min(flags.length - 1, i + grow) && !on; k++)
      on = source[k] ?? 0;
    flags[i] = on;
  }
  forEachRun(flags, 0, (start, end) => {
    if (start > 0 && end < flags.length && end - start <= gap) flags.fill(1, start, end);
  });
  forEachRun(flags, 1, (start, end) => {
    if (start > 0 && end < flags.length && end - start < minimum) flags.fill(0, start, end);
  });
}

/** Visit each maximal run `[start, end)` of `value` in `flags`. */
function forEachRun(
  flags: Uint8Array,
  value: number,
  visit: (start: number, end: number) => void,
): void {
  for (let i = 0; i < flags.length; ) {
    if (flags[i] !== value) {
      i++;
      continue;
    }
    let j = i;
    while (j < flags.length && flags[j] === value) j++;
    visit(i, j);
    i = j;
  }
}

function midpoint(a: TerrainSemanticPoint, b: TerrainSemanticPoint): TerrainSemanticPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function hash(x: number, z: number): number {
  let value = Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Stable weighted selection, shared by synchronous and worker surface generation. */
export function pickParkedVehicle(
  vehicles: readonly TerrainParkedVehicle[],
  u: number,
): TerrainParkedVehicle | undefined {
  const eligible = vehicles.filter((v) => Number.isFinite(v.weight ?? 1) && (v.weight ?? 1) > 0);
  let draw = u * eligible.reduce((total, v) => total + (v.weight ?? 1), 0);
  for (const v of eligible) {
    draw -= v.weight ?? 1;
    if (draw < 0) return v;
  }
  return eligible.at(-1);
}

/** Surface meshes are tile-local, clipped, batched and deterministic. */
export function createTerrainSurfaceObject(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSurfaceOptions = {},
  roadMaterial?: THREE.Material,
  renderVehicles = true,
): THREE.Group {
  const style = resolveTerrainSurfaceStyle(options.style, options.details);
  const details = options.details ?? {};
  const regionalProfile = options.signProfile ?? DEFAULT_ROAD_SIGN_PROFILE;
  const signProfile =
    options.drivingSide === undefined
      ? regionalProfile
      : { ...regionalProfile, drivingSide: options.drivingSide };
  const side = signProfile.drivingSide === 'left' ? -1 : 1;
  const parkedVehicles = details.parkedVehicles ?? [];
  const detailed =
    context.pyramid.maxLevel - context.address.level <= (details.detailLevelsBelowMax ?? 0);
  const group = new THREE.Group();
  group.name = 'semantic:surfaces';
  // Draped over the ground: receives sun shadows, never casts them onto itself.
  group.userData.shadowCaster = false;
  group.userData.surfaceStyle = style.id;
  const stats: TerrainSurfaceStats = {
    runways: tile.transportation.filter((f) => (f.subclass ?? f.class) === 'runway').length,
    taxiways: tile.transportation.filter((f) => (f.subclass ?? f.class) === 'taxiway').length,
    aprons: tile.landcover.filter((f) => (f.subclass ?? f.class) === 'apron').length,
    roads: 0,
    parkingAreas: 0,
    junctions: 0,
    streetlights: 0,
    streetFurniture: 0,
    trafficSignals: 0,
    roadSigns: 0,
    parkingBays: 0,
    parkedCars: 0,
    detailLimited: false,
  };
  group.userData.surfaceStats = stats;
  appendAirportSurfaces(group, tile, context, options, roadMaterial);
  // Graded on the rendered ground, like the deck profiles that read the grading back.
  const renderedGround = renderedGroundSampler(
    context.heightfield,
    context.origin,
    context.tileSize,
    context.surfaceResolution,
  );
  const graded = gradeHighwayBridges(tile.transportation, context.tileSize, (x, z) =>
    renderedGround(context.origin[0] + x, context.origin[1] + z),
  );
  const network = new SurfaceNetwork(
    { ...tile, transportation: [...graded] },
    context.tileSize,
    style,
  );
  if (detailed) {
    network.findJunctions();
    // Before any band is built: mapped footways inside a turning circle are clipped away.
    if (style.sidewalks) network.findTurningCircles();
  }
  // Built-up frontage, for which stretches of street have sidewalks: building centroids counted
  // in 20 m cells, and mapped commercial land. A sidewalk on every street gave country lanes
  // and farm roads curbs and concrete through open fields.
  const builtCells = new Map<string, number>();
  for (const building of tile.buildings)
    for (const polygon of building.polygons) {
      const bounds = polygonBounds(polygon);
      const x = ((bounds[0] + bounds[2]) / 2) * context.tileSize;
      const z = ((bounds[1] + bounds[3]) / 2) * context.tileSize;
      const key = `${Math.floor(x / BUILT_CELL)}/${Math.floor(z / BUILT_CELL)}`;
      builtCells.set(key, (builtCells.get(key) ?? 0) + 1);
    }
  // A tile without footprints (a host or test map that has none) reads mapped residential land
  // as built up; one without land data either cannot tell, and keeps sidewalks on every street.
  const footprints = tile.buildings.length > 0;
  const unknownLand = !footprints && tile.landcover.length === 0;
  const shops = tile.landcover
    .filter((feature) =>
      (footprints ? /^(commercial|retail)$/ : /^(commercial|retail|residential)$/).test(
        feature.subclass ?? feature.class,
      ),
    )
    .flatMap((feature) => feature.polygons)
    .map((polygon) => ({ polygon, bounds: polygonBounds(polygon) }));
  const builtUp = (x: number, z: number, threshold: number): boolean => {
    if (unknownLand) return true;
    const cx = Math.floor(x / BUILT_CELL),
      cz = Math.floor(z / BUILT_CELL);
    let count = 0;
    for (let i = -BUILT_REACH; i <= BUILT_REACH; i++)
      for (let j = -BUILT_REACH; j <= BUILT_REACH; j++)
        count += builtCells.get(`${cx + i}/${cz + j}`) ?? 0;
    if (count >= threshold) return true;
    const u = x / context.tileSize,
      v = z / context.tileSize;
    return shops.some(
      ({ polygon, bounds }) =>
        u >= bounds[0] &&
        u <= bounds[2] &&
        v >= bounds[1] &&
        v <= bounds[3] &&
        pointInPolygon([u, v], polygon),
    );
  };
  // Per street, which 10 m stations are built up: there it has sidewalks (when the style draws
  // them), and its markings are a city street's rather than a country road's.
  const builtStations = new Map<SurfaceRoad, Uint8Array>();
  const stationsFor = (road: SurfaceRoad): Uint8Array => {
    let stations = builtStations.get(road);
    if (stations) return stations;
    const count = Math.ceil(road.path.length / SIDEWALK_STATION) + 1;
    stations = new Uint8Array(count);
    const category = road.feature.subclass ?? road.feature.class;
    // Arterials keep sidewalks through thinner frontage than local streets do.
    const threshold = /^(trunk|primary|secondary|tertiary)/.test(category) ? 5 : 8;
    if (road.kind === 'street') {
      for (let i = 0; i < count; i++) {
        const p = sampleTerrainLine(road.path, Math.min(road.path.length, i * SIDEWALK_STATION));
        stations[i] = builtUp(p.x, p.z, threshold) ? 1 : 0;
      }
      // A sidewalk runs on past the last house to the corner instead of stopping lot by lot.
      settleRuns(stations, 4, 12, 8);
    }
    builtStations.set(road, stations);
    return stations;
  };
  const builtAt = (road: SurfaceRoad, distance: number): boolean =>
    stationsFor(road)[Math.round(Math.max(0, distance) / SIDEWALK_STATION)] === 1;
  const urbanRoad = (road: SurfaceRoad): boolean => stationsFor(road).includes(1);
  const walkable = (road: SurfaceRoad): boolean =>
    style.sidewalks &&
    road.kind === 'street' &&
    !road.feature.bridge &&
    !road.unpaved &&
    // A living street is a shared surface, curb to curb.
    (road.feature.subclass ?? road.feature.class) !== 'living_street';
  const sidewalkAt = (road: SurfaceRoad, distance: number): boolean =>
    walkable(road) && builtAt(road, distance);
  const sidewalked = (road: SurfaceRoad): boolean => walkable(road) && urbanRoad(road);
  // Asphalt condition by class: busy roads are resurfaced, side streets and alleys wait.
  const wearOf = (road: SurfaceRoad): TerrainRoadWear => {
    if (road.kind === 'service') return 3;
    if (road.kind === 'motorway') return 0;
    const category = road.feature.subclass ?? road.feature.class;
    if (/^(trunk|primary)/.test(category)) return 0;
    if (/^(secondary|tertiary)/.test(category)) return 1;
    return 2;
  };
  // Lanes as the traffic simulation drives them (ambient's `roadLanes`), so paint, wheel tracks
  // and simulated cars agree: no lane under 2.5 m, and an untagged one-way about 3.3 m a lane.
  const laneCount = (road: SurfaceRoad): number => {
    const oneway = road.feature.oneway === true;
    const minimum = oneway ? 1 : 2;
    let lanes = inferLaneCount(road.feature, road.width);
    if (road.width / lanes < 2.5) lanes = Math.max(minimum, Math.floor(road.width / 2.5));
    if (oneway && road.feature.lanes === undefined)
      lanes = Math.max(1, Math.min(lanes, Math.round(road.width / 3.3)));
    return Math.max(minimum, lanes);
  };
  // Center lines are yellow in the Americas and Korea, white nearly everywhere else.
  const centerColor =
    signProfile.countries.length === 0 ||
    signProfile.countries.some((country) => YELLOW_CENTER_LINES.has(country))
      ? style.center
      : style.white;
  // A country road (no curb) has a gravel shoulder outside its edge line; a curbed street only
  // the gutter's seam.
  const shoulder = (road: SurfaceRoad): number =>
    road.unpaved
      ? 0.7
      : road.kind === 'motorway'
        ? isSurfaceLink(road)
          ? 0.8
          : 2
        : road.kind === 'street' && !urbanRoad(road) && !road.feature.bridge
          ? 0.8
          : 0.3;
  // Overlapping roads' paving must not share a plane: past the carriageway edge, each reaches
  // over its shoulders or, beyond a curb, its sidewalks.
  network.stackRoads((road) =>
    Math.max(shoulder(road), sidewalked(road) ? style.sidewalkWidth + 0.18 : 0),
  );
  const controls = surfaceJunctionControls(
    tile,
    network.junctions,
    context.tileSize,
    details.inferStopSigns ?? signProfile.inferStopSigns,
  );
  // Where each road meets a junction: the distance along it at which its arm leaves the
  // junction, which way along the road leads away, and whether the junction has signals.
  const approaches = new Map<
    SurfaceRoad,
    { distance: number; outward: number; signal: boolean }[]
  >();
  for (const node of network.junctions)
    for (const arm of node.arms) {
      const tangent = sampleTerrainLine(arm.road.path, arm.distance);
      const list = approaches.get(arm.road) ?? [];
      list.push({
        distance: arm.distance,
        outward: tangent.dx * arm.dx + tangent.dz * arm.dz >= 0 ? 1 : -1,
        signal: controls.get(node)?.signal === true,
      });
      approaches.set(arm.road, list);
    }
  type JunctionArm = SurfaceJunction['arms'][number];
  const arterialRoad = (road: SurfaceRoad, width = road.width): boolean =>
    isArterialRoad(road.feature.subclass ?? road.feature.class, width);
  /**
   * Whether an arm carries a marked crosswalk: every arm of a signal, and a stop- or
   * yield-controlled arm meeting an arterial or at a mapped all-way stop. Where two quiet streets
   * meet (stops inferred there or not), the crossing is legal but unmarked, as on most
   * residential corners.
   */
  const crosswalkAt = (node: SurfaceJunction, arm: JunctionArm): boolean => {
    const control = controls.get(node);
    if (!style.crossings || !control || !builtAt(arm.road, arm.distance)) return false;
    if (control.signal) return true;
    if (!control.stops.has(arm) && !control.yields.has(arm)) return false;
    return (
      node.arms.some((a) => arterialRoad(a.road, a.width)) ||
      (control.allWay && control.source === 'mapped')
    );
  };
  // Where each road's lines end at each junction it meets. A road with the right of way past
  // side streets that join from one side only (a tee), and that stop, yield or are minor, keeps
  // its lines across their mouths, as a through road does; its paint over their pavement is
  // dropped separately. Otherwise lines end at the crossing road's edge, and on an approach that
  // stops, yields or meets a signal, at the stop line or crosswalk.
  interface LineEnds {
    through: boolean;
    /** Clear of paint within this distance (m) of the junction's cores. */
    clear: number;
    /** Along-road spans to keep clear: outward of an arm from -inside to reach. */
    held: { distance: number; outward: number; inside: number; reach: number }[];
  }
  const lineEnds = new Map<SurfaceRoad, Map<SurfaceJunction, LineEnds>>();
  for (const node of network.junctions) {
    const control = controls.get(node);
    const held = (arm: JunctionArm): boolean =>
      control?.signal === true ||
      control?.stops.has(arm) === true ||
      control?.yields.has(arm) === true;
    for (const road of new Set(node.arms.map((arm) => arm.road))) {
      const own = node.arms.filter((arm) => arm.road === road);
      const others = node.arms.filter((arm) => arm.road !== road);
      const major = arterialRoad(road);
      const along = own[0] as JunctionArm;
      const sides = new Set(others.map((arm) => Math.sign(along.dx * arm.dz - along.dz * arm.dx)));
      const through =
        control?.signal !== true &&
        own.length >= 2 &&
        sides.size === 1 &&
        !own.some(held) &&
        others.every(
          (arm) => held(arm) || !incomingArm(arm) || (major && !arterialRoad(arm.road, arm.width)),
        );
      const ends: LineEnds = {
        through,
        clear: Math.max(0, ...others.map((arm) => arm.width / 2)) + 2,
        held: [],
      };
      for (const arm of own) {
        if (!held(arm)) continue;
        const tangent = sampleTerrainLine(road.path, arm.distance);
        const crosswalk = crosswalkAt(node, arm);
        ends.held.push({
          distance: arm.distance,
          outward: tangent.dx * arm.dx + tangent.dz * arm.dz >= 0 ? 1 : -1,
          // Back across the junction to the far arm, or across the whole of it.
          inside:
            own.length >= 2
              ? Math.max(...own.map((other) => Math.abs(other.distance - arm.distance)))
              : node.radius * 2 + 6,
          // Past the stop line (or yield teeth) of an incoming approach, else the crosswalk.
          reach: !incomingArm(arm) ? (crosswalk ? 1.6 : 0.5) : (crosswalk ? 2.8 : 1) + 0.8,
        });
      }
      const map = lineEnds.get(road) ?? new Map<SurfaceJunction, LineEnds>();
      map.set(node, ends);
      lineEnds.set(road, map);
    }
  }
  /** Whether `distance` along `road` lies within `reach` meters out along a junction's arm. */
  const nearJunction = (
    road: SurfaceRoad,
    distance: number,
    reach: number,
    signalsOnly = false,
  ): boolean =>
    (approaches.get(road) ?? []).some((arm) => {
      const out = (distance - arm.distance) * arm.outward;
      return (!signalsOnly || arm.signal) && out >= -2 && out <= reach;
    });
  /**
   * Where a two-lane road allows passing, per 5 m station: not on curves (sight distance; the
   * heading turning more than about 11° over 90 m, a radius under ~450 m), not within 60 m of a
   * junction, not on bridges, and not in zones too short to finish a pass (under ~120 m).
   */
  const passingZones = (road: SurfaceRoad): Uint8Array => {
    const count = Math.ceil(road.path.length / PASSING_STATION) + 1;
    const zones = new Uint8Array(count);
    const heading = (distance: number): number => {
      const t = sampleTerrainLine(road.path, Math.max(0, Math.min(road.path.length, distance)));
      return Math.atan2(t.dz, t.dx);
    };
    for (let i = 0; i < count; i++) {
      const distance = i * PASSING_STATION;
      let turn = heading(distance + 45) - heading(distance - 45);
      turn = Math.abs(((turn + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      zones[i] = turn < 0.2 && !road.feature.bridge && !nearJunction(road, distance, 60) ? 1 : 0;
    }
    forEachRun(zones, 1, (start, end) => {
      if (start > 0 && end < count && end - start < 24) zones.fill(0, start, end);
    });
    return zones;
  };
  const pavement = new TerrainSurfaceMeshBuilder(context);
  const roads = new TerrainSurfaceMeshBuilder(context);
  const edges = new TerrainSurfaceMeshBuilder(context);
  const marks = new TerrainSurfaceMeshBuilder(context);
  const bridges = new TerrainSurfaceMeshBuilder(context);
  const approachSupports = new TerrainSurfaceMeshBuilder(context);
  // Every pavement mesh carries surfaceDetail, so one material program serves them all.
  for (const builder of [pavement, roads, edges, marks])
    builder.ensureAttribute('surfaceDetail', 4);
  const bridgeProfiles = new Map<SurfaceRoad, (x: number, z: number) => number>();
  const groundEnds = new Set<string>();
  for (const road of network.roads)
    if (!road.feature.bridge)
      for (const [x, z] of [road.path.points[0], road.path.points.at(-1)] as TerrainSemanticPoint[])
        groundEnds.add(`${Math.round(x * 10)}/${Math.round(z * 10)}`);
  for (const road of network.roads) {
    if (
      !road.feature.bridge &&
      !road.feature.bridgeConnections?.length &&
      !road.feature.bridgeApproachProfile?.length
    )
      continue;
    const profile = bridgeDeckProfile(road, bridges, groundEnds);
    bridgeProfiles.set(road, profile);
  }
  const heightOnRoad = (road: SurfaceRoad, x: number, z: number): number =>
    bridgeProfiles.get(road)?.(x, z) ??
    context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z) + road.elevation;
  const covered = (road: SurfaceRoad, x: number, z: number): boolean =>
    network.overlappingPavement(x, z, road, heightOnRoad);
  for (const [road, profile] of bridgeProfiles) {
    if (road.feature.bridge)
      appendBridgeStructure(bridges, road, profile, detailed ? 6 : 16, {
        shoulder: detailed ? shoulder(road) : 0.3,
        covered: (x, z) => covered(road, x, z),
        supportBlocked: (x, z) => network.pavementBelow(x, z, road, heightOnRoad),
      });
    else
      appendBridgeApproachSupport(
        approachSupports,
        road,
        profile,
        detailed ? 2 : 6,
        detailed ? shoulder(road) : 0,
      );
  }
  const bridgeMesh = bridges.mesh('surfaces:bridges', roadMaterial);
  if (bridgeMesh) {
    bridgeMesh.castShadow = true;
    group.add(bridgeMesh);
  }
  const supportMesh = approachSupports.mesh('surfaces:approach-supports', roadMaterial);
  if (supportMesh) {
    supportMesh.castShadow = true;
    supportMesh.receiveShadow = true;
    group.add(supportMesh);
  }
  const fixtures: TerrainBoxPlacement[] = [];
  const signalHeads: TerrainSignalHead[] = [];
  const streetLights: TerrainStreetLight[] = [];
  const vehicles: VehiclePlacement[] = [];
  group.userData.vehicles = vehicles;
  tagTerrainObject('parked-vehicles', group);
  let fixtureCount = 0;
  let remaining = details.maxDetailElements ?? 16_000;
  const parkingReserve = Math.floor(remaining * 0.35);
  const maxFixtures = details.maxFixturesPerTile ?? 160;
  const maxStreetlights = details.maxStreetlightsPerTile ?? Math.round(maxFixtures * 1.5);
  // Poles, lines and hydrants have their own budget, so they never crowd out lights and signals.
  // A finest tile can hold well over ten kilometers of suburban street; at a box or two per
  // element these budgets furnish all of it rather than only the roads that come first.
  let furniture = 0;
  const maxFurniture = 1200;
  // Mailboxes and bins on residential streets, again with a budget of their own: a vaulted
  // mailbox is ten small boxes, so this still covers several hundred lots.
  let clutter = 0;
  const maxClutter = 4800;
  const exclusions = [
    ...tile.buildings.flatMap((b) => b.polygons),
    ...tile.water.flatMap((w) => w.polygons ?? []),
  ];
  const exclusionCells = new Map<string, TerrainSemanticPolygon[]>();
  const exclusionCellSize = Math.max(24, context.tileSize / 64);
  for (const polygon of exclusions) {
    const bounds = polygonBounds(polygon);
    const minX = Math.floor(Math.max(-1, bounds[0] * context.tileSize) / exclusionCellSize);
    const minZ = Math.floor(Math.max(-1, bounds[1] * context.tileSize) / exclusionCellSize);
    const maxX = Math.floor(
      Math.min(context.tileSize + 1, bounds[2] * context.tileSize) / exclusionCellSize,
    );
    const maxZ = Math.floor(
      Math.min(context.tileSize + 1, bounds[3] * context.tileSize) / exclusionCellSize,
    );
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x}/${z}`;
        const cell = exclusionCells.get(key) ?? [];
        cell.push(polygon);
        exclusionCells.set(key, cell);
      }
  }
  const blocked = (x: number, z: number): boolean =>
    (
      exclusionCells.get(
        `${Math.floor(x / exclusionCellSize)}/${Math.floor(z / exclusionCellSize)}`,
      ) ?? []
    ).some((p) => pointInPolygon([x / context.tileSize, z / context.tileSize], p));
  const inTile = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < context.tileSize && z < context.tileSize;
  const signs =
    detailed && style.roadSigns !== false && (style.roadSigns || style.id === 'modern')
      ? planSurfaceSigns(
          tile,
          context,
          network,
          controls,
          blocked,
          maxFixtures,
          bridgeProfiles,
          signProfile,
          options.routeShields,
        )
      : [];
  group.userData.roadSigns = signs;
  const signFaces = new TerrainSurfaceMeshBuilder(context);
  for (const sign of signs)
    appendSurfaceSign(
      signFaces,
      fixtures,
      sign,
      options.fonts,
      options.signFont,
      options.routeShields,
    );
  fixtureCount += signs.length;
  stats.roadSigns = signs.length;
  // Mapped residential land, for clutter that belongs to homes (not shops on a residential road).
  const homes = tile.landcover
    .filter((feature) => feature.class === 'residential')
    .flatMap((feature) => feature.polygons)
    .map((polygon) => ({ polygon, bounds: polygonBounds(polygon) }));
  const residential = (x: number, z: number): boolean => {
    const u = x / context.tileSize,
      v = z / context.tileSize;
    return homes.some(
      ({ polygon, bounds }) =>
        u >= bounds[0] &&
        u <= bounds[2] &&
        v >= bounds[1] &&
        v <= bounds[3] &&
        pointInPolygon([u, v], polygon),
    );
  };
  const band = (
    builder: TerrainSurfaceMeshBuilder,
    road: SurfaceRoad,
    spec: TerrainLineBand,
    filter?: (points: readonly TerrainSemanticPoint[], distance: number) => boolean,
  ): void => {
    if (remaining <= parkingReserve) return;
    remaining -= appendTerrainLineBand(builder, road.path, spec, {
      maxElements: Math.max(0, remaining - parkingReserve),
      spacing: 3,
      filter,
      ...(bridgeProfiles.has(road)
        ? { heightAt: bridgeProfiles.get(road), followGrid: !road.feature.bridge }
        : {}),
    });
  };
  // Mapped paved areas and other roads (with their sidewalks), so a sidewalk whose lawn side runs
  // over one keeps that edge clean.
  const pavedAreas = tile.landcover
    .filter((feature) => areaKind(feature.class, feature.subclass) !== undefined)
    .flatMap((feature) => feature.polygons)
    .map((polygon) => ({ polygon, bounds: polygonBounds(polygon) }));
  const overPaving = (x: number, z: number, road: SurfaceRoad): boolean => {
    // Another road's carriageway or, at a corner, its own sidewalks.
    if (network.occupied(x, z, style.sidewalkWidth + 0.5, road, true)) return true;
    const u = x / context.tileSize,
      v = z / context.tileSize;
    return pavedAreas.some(
      ({ polygon, bounds }) =>
        u >= bounds[0] &&
        u <= bounds[2] &&
        v >= bounds[1] &&
        v <= bounds[3] &&
        pointInPolygon([u, v], polygon),
    );
  };
  // Turning circles: plain asphalt (no lanes, so no wheel tracks, covers or gutters), a hair
  // under the street so the two never fight where the circle overlaps the street's end.
  for (const circle of network.turningCircles) {
    const start = roads.vertexCount;
    const color = new THREE.Color(style.road);
    const ring = circle.outline;
    for (let i = 0; i < ring.length; i++)
      roads.polygon(
        [
          circle.center,
          ring[i] as TerrainSemanticPoint,
          ring[(i + 1) % ring.length] as TerrainSemanticPoint,
        ],
        color,
        circle.road.elevation + circle.road.stack - 0.02,
      );
    roads.surfaceSince(start, TERRAIN_SURFACE_KIND.road, () => [0, 60], 127);
  }
  // Major roads first: where a dense tile runs out of detail budget, the side streets furnished
  // last go without some sidewalk and paint, not the arterials.
  const byImportance = network.roads
    .map((road, order) => ({ road, order, rank: roadImportance(road) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ road }) => road);
  for (const road of byImportance) {
    stats.roads++;
    const elevation = (bridgeProfiles.has(road) ? 0 : road.elevation) + road.stack;
    // Frayed edges show the ground beneath, so a deck keeps its edges whole.
    const grounded = !bridgeProfiles.has(road) && !road.feature.bridge;
    const clipPath =
      road.kind === 'path' && !road.feature.bridge
        ? {
            clip: (points: readonly TerrainSemanticPoint[]): TerrainSemanticPoint[][] =>
              network.clipPath(points, road),
          }
        : {};
    const color =
      road.kind === 'rail'
        ? '#807b70'
        : road.kind === 'path'
          ? style.path
          : road.unpaved
            ? style.dirt
            : style.road;
    // Mapped footways are mostly poured concrete: slabs along the path, like a sidewalk.
    const surface =
      road.kind === 'rail'
        ? TERRAIN_SURFACE_KIND.ballast
        : road.unpaved
          ? TERRAIN_SURFACE_KIND.dirt
          : road.kind === 'path'
            ? TERRAIN_SURFACE_KIND.sidewalk
            : TERRAIN_SURFACE_KIND.road;
    appendTerrainLineBand(
      roads,
      road.path,
      {
        width: road.width,
        color,
        elevation,
        surface,
        // A service road is one lane, worn by wheels down its middle.
        ...(surface === TERRAIN_SURFACE_KIND.road
          ? {
              lanes: road.kind === 'service' ? 1 : laneCount(road),
              wear: wearOf(road),
            }
          : {}),
        // Footpaths, dirt roads and track ballast meet the ground directly on both sides.
        ...(surface !== TERRAIN_SURFACE_KIND.road && grounded ? { fray: 'both' as const } : {}),
      },
      {
        spacing: detailed ? 6 : 16,
        ...clipPath,
        heightAt: bridgeProfiles.get(road),
        followGrid: !road.feature.bridge,
      },
    );
    // Draw only the exposed shoulder edges, avoiding a second sheet beneath the asphalt. They
    // are a few decimeters wide: below a pixel on coarser tiles, which are kilometers away, yet
    // draped segment by segment they were most of those tiles' memory.
    const shoulderWidth = shoulder(road);
    if (detailed)
      for (const sign of [-1, 1])
        appendTerrainLineBand(
          edges,
          road.path,
          {
            width: shoulderWidth,
            offset: sign * (road.width / 2 + shoulderWidth / 2),
            color: road.kind === 'motorway' ? style.road : style.shoulder,
            elevation: elevation - 0.04,
            surface: road.unpaved ? TERRAIN_SURFACE_KIND.dirt : TERRAIN_SURFACE_KIND.shoulder,
            ...(grounded ? { fray: 'outer' as const } : {}),
          },
          {
            spacing: 6,
            ...clipPath,
            heightAt: bridgeProfiles.get(road),
            followGrid: !road.feature.bridge,
          },
        );
    if (!detailed) continue;
    // Lit urban blocks get regular fixtures between intersections, including long roads with
    // no junctions in the tile. Respect explicit unlit roads and omit bridges/tunnels here.
    if (
      style.streetlights &&
      grounded &&
      !road.feature.tunnel &&
      !road.unpaved &&
      sidewalked(road) &&
      road.feature.tags?.lit !== 'no'
    ) {
      for (
        let d = 18;
        d < road.path.length - 12 && streetLights.length < Math.floor(maxStreetlights * 0.65);
        d += 28
      ) {
        const side = Math.floor(d / 28) % 2 === 0 ? 1 : -1;
        const p = sampleTerrainLine(road.path, d, side * (road.width / 2 + 0.7));
        if (
          !sidewalkAt(road, d) ||
          !inTile(p.x, p.z) ||
          blocked(p.x, p.z) ||
          network.occupied(p.x, p.z, 0.4, road)
        )
          continue;
        if (
          details.preferMappedProps &&
          (tile.pois ?? []).some(
            (poi) =>
              poi.class === 'street_lamp' &&
              Math.hypot(
                poi.point[0] * context.tileSize - p.x,
                poi.point[1] * context.tileSize - p.z,
              ) < 18,
          )
        )
          continue;
        const dx = side * p.dz,
          dz = -side * p.dx;
        const yaw = Math.atan2(dx, dz);
        const ground =
          context.heightfield.sampleHeight(context.origin[0] + p.x, context.origin[1] + p.z) +
          elevation;
        fixtures.push(
          { x: p.x, z: p.z, y: ground + 3.7, yaw, size: [0.16, 7.4, 0.16], color: '#667078' },
          {
            x: p.x + dx * 0.9,
            z: p.z + dz * 0.9,
            y: ground + 7.35,
            yaw,
            size: [0.12, 0.12, 1.9],
            color: '#667078',
          },
          {
            x: p.x + dx * 1.8,
            z: p.z + dz * 1.8,
            y: ground + 7.3,
            yaw,
            size: [0.48, 0.18, 0.85],
            color: '#efe8ba',
          },
        );
        streetLights.push({
          x: p.x + dx * 1.8,
          z: p.z + dz * 1.8,
          y: ground + 7.2,
          yaw,
          groundLift: Math.max(0.5, elevation + 0.06),
        });
        stats.streetlights++;
      }
    }
    if (road.kind === 'rail') {
      for (const offset of [-0.72, 0.72])
        band(marks, road, {
          width: 0.09,
          offset,
          color: '#b5b5ae',
          elevation: elevation + 0.14,
          surface: TERRAIN_SURFACE_KIND.plain,
        });
      // Ties, except where the track crosses a road: there the rails run in the pavement.
      band(
        marks,
        road,
        {
          width: 2.4,
          color: '#74634f',
          elevation: elevation + 0.06,
          dash: [0.2, 0.65],
          surface: TERRAIN_SURFACE_KIND.plain,
        },
        (points) => points.every((p) => !covered(road, p[0], p[1])),
      );
      continue;
    }
    if (sidewalked(road)) {
      const clear = (points: readonly TerrainSemanticPoint[], distance: number): boolean =>
        sidewalkAt(road, distance) &&
        points.every((p) => !network.occupied(p[0], p[1], 0.25, road) && !blocked(p[0], p[1]));
      for (const sign of [-1, 1]) {
        const start = edges.vertexCount;
        band(
          edges,
          road,
          {
            width: style.sidewalkWidth,
            offset: sign * (road.width / 2 + style.sidewalkWidth / 2 + 0.18),
            color: style.sidewalk,
            elevation: elevation + 0.13,
            surface: TERRAIN_SURFACE_KIND.sidewalk,
            fray: 'outer',
          },
          (points, distance) => {
            if (!clear(points, distance)) return false;
            // A sidewalk mapped as its own way beside the street replaces this one (the curb
            // stays), leaving the planting strip between them.
            const along = sampleTerrainLine(road.path, distance);
            let cx = 0,
              cz = 0;
            for (const p of points) {
              cx += p[0] / points.length;
              cz += p[1] / points.length;
            }
            return !network.parallelPath(cx, cz, along.dx, along.dz, style.sidewalkWidth / 2 + 1.3);
          },
        );
        // Where a driveway, footway or paved lot crosses its lawn side, that edge meets paving.
        edges.unfraySince(start, (x, z) => !overPaving(x, z, road));
        band(
          edges,
          road,
          {
            width: 0.22,
            offset: sign * (road.width / 2 + 0.11),
            color: style.curb,
            elevation: elevation + 0.15,
            surface: TERRAIN_SURFACE_KIND.curb,
            // The curb's face, down to the road surface.
            riser: 0.15,
          },
          clear,
        );
      }
      if (style.streetlights && detailed) {
        // Street furniture, fixed per road: utility poles carrying a pair of lines on one side,
        // just behind the sidewalk, and the odd hydrant at the other curb.
        const first = road.path.points[0] ?? [0, 0];
        const side = hash(first[0], first[1]) < 0.5 ? -1 : 1;
        const free = (x: number, z: number): boolean =>
          inTile(x, z) && !blocked(x, z) && !network.occupied(x, z, 1.2, road);
        const groundAt = (x: number, z: number): number =>
          context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z);
        let previous: { x: number; z: number; top: number } | undefined;
        const back = road.width / 2 + style.sidewalkWidth + 0.8;
        const overheadUtilities =
          !road.feature.bridge &&
          !road.feature.tunnel &&
          road.feature.tags?.location !== 'underground' &&
          road.feature.tags?.power !== 'cable' &&
          ['residential', 'unclassified', 'tertiary', 'living_street'].includes(
            road.feature.subclass ?? road.feature.class,
          ) &&
          !tile.buildings.some(
            (building) =>
              (building.height ?? (building.levels ?? 0) * 3) > 25 &&
              building.polygons.some((polygon) => {
                const bounds = polygonBounds(polygon);
                return (
                  Math.hypot(
                    ((bounds[0] + bounds[2]) * context.tileSize) / 2 - first[0],
                    ((bounds[1] + bounds[3]) * context.tileSize) / 2 - first[1],
                  ) < 120
                );
              }),
          );
        for (
          let d = 10 + hash(first[1], first[0]) * 14;
          overheadUtilities && d < road.path.length - 10 && furniture + 4 <= maxFurniture;
          d += 38
        ) {
          const p = sampleTerrainLine(road.path, d, side * back);
          if (!sidewalkAt(road, d) || !free(p.x, p.z)) {
            previous = undefined;
            continue;
          }
          const ground = groundAt(p.x, p.z);
          const top = ground + 9;
          const along = Math.atan2(p.dx, p.dz);
          const across = Math.atan2(-p.dz, p.dx);
          fixtures.push(
            {
              x: p.x,
              z: p.z,
              y: ground + 4.5,
              yaw: along,
              size: [0.26, 9, 0.26],
              color: '#6e5b45',
            },
            { x: p.x, z: p.z, y: top - 0.45, yaw: across, size: [0.1, 0.1, 1.7], color: '#5f4f3d' },
          );
          furniture += 2;
          stats.streetFurniture++;
          if (previous !== undefined) {
            const length = Math.hypot(p.x - previous.x, p.z - previous.z);
            const yaw = Math.atan2(p.x - previous.x, p.z - previous.z);
            for (const lateral of [-0.65, 0.65]) {
              fixtures.push({
                x: (p.x + previous.x) / 2 + -p.dz * lateral,
                z: (p.z + previous.z) / 2 + p.dx * lateral,
                // A little sag between poles.
                y: (top + previous.top) / 2 - 0.75,
                yaw,
                size: [0.03, 0.03, length],
                color: '#2a2a2a',
              });
              furniture++;
            }
          }
          previous = { x: p.x, z: p.z, top };
        }
        const curb = road.width / 2 + 0.55;
        for (
          let d = 14 + hash(first[0] + 7, first[1]) * 40;
          d < road.path.length - 14 && furniture + 2 <= maxFurniture;
          d += 95
        ) {
          const p = sampleTerrainLine(road.path, d, -side * curb);
          if (!sidewalkAt(road, d) || !free(p.x, p.z)) continue;
          const y = groundAt(p.x, p.z) + elevation + 0.13;
          fixtures.push(
            { x: p.x, z: p.z, y: y + 0.3, yaw: 0, size: [0.26, 0.6, 0.26], color: '#b3362b' },
            { x: p.x, z: p.z, y: y + 0.65, yaw: 0, size: [0.2, 0.1, 0.2], color: '#9c2c23' },
          );
          furniture += 2;
          stats.streetFurniture++;
        }
        if (road.feature.subclass === 'residential') {
          // A mailbox on a post just behind the sidewalk about once a lot, on both sides, and
          // beside some of them a pair of wheelie bins put out for collection.
          const behind = road.width / 2 + style.sidewalkWidth + 0.45;
          for (const lot of [-1, 1]) {
            for (
              let d = 6 + hash(first[0] + lot * 3, first[1] - 5) * 18;
              d < road.path.length - 6 && clutter + 12 <= maxClutter;
              d += 22 + hash(first[1] + d, first[0] - lot) * 8
            ) {
              const p = sampleTerrainLine(road.path, d, lot * behind);
              if (!sidewalkAt(road, d) || !free(p.x, p.z) || !residential(p.x, p.z)) continue;
              const ground = groundAt(p.x, p.z);
              const across = Math.atan2(-p.dz, p.dx);
              const pick = hash(p.x + context.origin[0], p.z + context.origin[1]);
              const [body, door] = (
                [
                  ['#262829', '#55595b'],
                  ['#4c5054', '#7a7f82'],
                  ['#e2e0da', '#b9b6ae'],
                  ['#2f4a3a', '#5b6f62'],
                ] as const
              )[Math.floor(pick * 97) % 4] as readonly [string, string];
              // The box's long axis runs toward the street: its door faces the curb, an arched
              // top steps in above it, and a red flag stands on its side.
              fixtures.push(
                {
                  x: p.x,
                  z: p.z,
                  y: ground + 0.52,
                  yaw: across,
                  size: [0.09, 1.04, 0.09],
                  color: pick < 0.5 ? '#e6e2d8' : '#5b4a3a',
                },
                // The post's mounting board, then the box: straight sides under a vaulted top
                // stepped in four courses, so it reads as a mailbox rather than a crate.
                {
                  x: p.x,
                  z: p.z,
                  y: ground + 1.03,
                  yaw: across,
                  size: [0.24, 0.025, 0.5],
                  color: pick < 0.5 ? '#e6e2d8' : '#5b4a3a',
                },
                ...(
                  [
                    [0.2, 0.12, 1.102],
                    [0.19, 0.04, 1.182],
                    [0.16, 0.035, 1.219],
                    [0.11, 0.03, 1.251],
                    [0.05, 0.015, 1.273],
                  ] as const
                ).map(([wide, tall, y]) => ({
                  x: p.x,
                  z: p.z,
                  y: ground + y,
                  yaw: across,
                  size: [wide, tall, 0.48] as [number, number, number],
                  color: body,
                })),
                {
                  x: p.x + lot * p.dz * 0.245,
                  z: p.z - lot * p.dx * 0.245,
                  y: ground + 1.13,
                  yaw: across,
                  size: [0.17, 0.17, 0.012],
                  color: door,
                },
                {
                  x: p.x + lot * p.dz * 0.252,
                  z: p.z - lot * p.dx * 0.252,
                  y: ground + 1.19,
                  yaw: across,
                  size: [0.04, 0.02, 0.012],
                  color: '#9a9a96',
                },
                {
                  x: p.x + p.dx * 0.11,
                  z: p.z + p.dz * 0.11,
                  y: ground + 1.27,
                  yaw: across,
                  size: [0.012, 0.2, 0.035],
                  color: '#b8322a',
                },
              );
              clutter += 10;
              stats.streetFurniture++;
              if (pick < 0.3) {
                const along = Math.atan2(p.dx, p.dz);
                for (const [step, color] of [
                  [0.95, '#3d6342'],
                  [1.7, pick < 0.15 ? '#2e5785' : '#55595c'],
                ] as const) {
                  const q = sampleTerrainLine(road.path, d + step * lot, lot * behind);
                  if (!free(q.x, q.z)) continue;
                  fixtures.push({
                    x: q.x,
                    z: q.z,
                    y: groundAt(q.x, q.z) + 0.52,
                    yaw: along,
                    size: [0.6, 1.04, 0.72],
                    color,
                  });
                  clutter++;
                }
              }
            }
          }
        }
      }
    }
    if (road.unpaved && style.id !== 'minimal' && road.kind !== 'path') {
      for (const offset of [-road.width * 0.24, road.width * 0.24]) {
        band(marks, road, {
          width: 0.48,
          offset,
          color: '#8c795b',
          elevation: elevation + 0.025,
          surface: TERRAIN_SURFACE_KIND.dirt,
          ...(grounded ? { fray: 'both' as const } : {}),
        });
      }
      continue;
    }
    if (!style.markings || road.kind === 'path' || road.kind === 'service') continue;
    // Markings after US practice (MUTCD), in the region's center-line color. Yellow separates
    // opposing traffic, white the lanes going one way; broken lines may be crossed, solid not.
    const link = isSurfaceLink(road);
    const oneway = road.feature.oneway === true;
    const category = road.feature.subclass ?? road.feature.class;
    const minor = /^(residential|living_street)$/.test(category);
    const urban = urbanRoad(road);
    const ends = lineEnds.get(road);
    const clearJunction = (points: readonly TerrainSemanticPoint[], distance: number): boolean =>
      road.feature.bridge === true ||
      !network.junctions.some((node) => {
        if (node.layer !== (road.feature.layer ?? 0)) return false;
        const end = ends?.get(node);
        if (end?.through) return false;
        // A junction this road only passes near keeps clear of its whole core.
        const clear = end?.clear;
        if (
          node.cores.some((core) =>
            points.some(
              (p) => Math.hypot(p[0] - core.x, p[1] - core.z) < (clear ?? core.radius + 0.5),
            ),
          )
        )
          return true;
        return (end?.held ?? []).some((arm) => {
          const out = (distance - arm.distance) * arm.outward;
          return out > -arm.inside && out < arm.reach;
        });
      });
    const unmerged = (points: readonly TerrainSemanticPoint[]): boolean =>
      points.every((p) => !covered(road, p[0], p[1]));
    const paint = (
      line: Pick<TerrainLineBand, 'width' | 'offset' | 'color' | 'dash'>,
      filter: (points: readonly TerrainSemanticPoint[], distance: number) => boolean,
    ): void =>
      band(
        marks,
        road,
        { ...line, elevation: elevation + 0.045, surface: TERRAIN_SURFACE_KIND.paint },
        filter,
      );
    // Edge lines along the outside of the travel lanes: on freeways and ramps, on country roads
    // (no curb to show the edge), and on wide city arterials; residential streets have none. A
    // one-way carriageway's left edge is the center-line color.
    if (road.kind === 'motorway' || (!minor && road.width >= (urban ? 8 : 5.5))) {
      const inset = road.kind === 'motorway' ? (link ? 0.2 : 0.3) : urban ? 0.3 : 0.15;
      for (const sign of [-1, 1])
        paint(
          {
            width: EDGE_LINE_WIDTH,
            offset: sign * (road.width / 2 - inset),
            color: oneway && sign === -side ? centerColor : style.white,
          },
          (points, distance) => clearJunction(points, distance) && unmerged(points),
        );
    }
    if (road.width < 5.5 || (link && road.feature.lanes === undefined)) continue;
    const lanes = laneCount(road);
    const laneWidth = road.width / lanes;
    // Center offset of each line of a double line.
    const pair = (LINE_WIDTH + DOUBLE_LINE_GAP) / 2;
    const turnLane = !oneway && lanes >= 3 && lanes % 2 === 1;
    // A residential street has no center line unless it is mapped with lanes.
    const unlined = minor && road.feature.lanes === undefined;
    if (!oneway && !link && turnLane) {
      // A two-way left-turn lane down the middle: each of its edges solid on the outside and
      // broken on the inside, toward the turn lane.
      for (const sign of [-1, 1]) {
        const edge = (sign * laneWidth) / 2;
        paint({ width: LINE_WIDTH, offset: edge + sign * pair, color: centerColor }, clearJunction);
        paint(
          { width: LINE_WIDTH, offset: edge - sign * pair, color: centerColor, dash: BROKEN_LINE },
          clearJunction,
        );
      }
    } else if (!oneway && !link && !unlined) {
      // Double solid on multilane roads and city arterials; on a two-lane country road broken
      // where passing is allowed and double where it is not; otherwise a single broken line.
      const arterial = /^(trunk|primary|secondary|tertiary)/.test(category);
      const zones = !urban && lanes === 2 ? passingZones(road) : undefined;
      const passing = (distance: number): boolean =>
        zones !== undefined
          ? zones[Math.round(Math.max(0, distance) / PASSING_STATION)] === 1
          : !(lanes >= 4 || (urban && arterial) || road.kind === 'motorway');
      for (const sign of [-1, 1])
        paint(
          { width: LINE_WIDTH, offset: sign * pair, color: centerColor },
          (points, distance) => clearJunction(points, distance) && !passing(distance),
        );
      paint(
        { width: LINE_WIDTH, offset: 0, color: centerColor, dash: BROKEN_LINE },
        (points, distance) => clearJunction(points, distance) && passing(distance),
      );
    }
    // Lane lines between lanes going the same way: broken, but solid over the last 30 m into a
    // signal, where changing lanes is discouraged.
    if (laneWidth >= 2.5 && (oneway || !unlined))
      for (let lane = 1; lane < Math.min(12, lanes); lane++) {
        if (!oneway && (lane === lanes / 2 || (turnLane && Math.abs(lane - lanes / 2) < 1)))
          continue;
        const offset = -road.width / 2 + laneWidth * lane;
        paint(
          { width: LINE_WIDTH, offset, color: style.white, dash: BROKEN_LINE },
          (points, distance) =>
            clearJunction(points, distance) &&
            unmerged(points) &&
            !nearJunction(road, distance, 30, true),
        );
        paint(
          { width: LINE_WIDTH, offset, color: style.white },
          (points, distance) =>
            clearJunction(points, distance) &&
            unmerged(points) &&
            nearJunction(road, distance, 30, true),
        );
      }
  }

  const rectangle = (
    x: number,
    z: number,
    dx: number,
    dz: number,
    width: number,
    length: number,
  ): TerrainSemanticPoint[] => [
    [x - (dx * length) / 2 - (dz * width) / 2, z - (dz * length) / 2 + (dx * width) / 2],
    [x + (dx * length) / 2 - (dz * width) / 2, z + (dz * length) / 2 + (dx * width) / 2],
    [x + (dx * length) / 2 + (dz * width) / 2, z + (dz * length) / 2 - (dx * width) / 2],
    [x - (dx * length) / 2 + (dz * width) / 2, z - (dz * length) / 2 - (dx * width) / 2],
  ];

  const white = new THREE.Color(style.white);
  const paintPolygon = (points: readonly TerrainSemanticPoint[], lift: number): void => {
    const start = marks.vertexCount;
    marks.polygon(points, white, lift);
    marks.surfaceSince(start, TERRAIN_SURFACE_KIND.paint);
  };
  /**
   * A lane arrow centered at (x, z), pointing along (fx, fz): straight (`turn` 0) or turning to
   * its right (1) or left (-1), from rectangles and triangles the draper takes whole.
   */
  const laneArrow = (
    x: number,
    z: number,
    fx: number,
    fz: number,
    turn: number,
    lift: number,
  ): void => {
    // Arrow-local (forward, right) to tile meters; right of travel is (-fz, fx).
    const at = (u: number, v: number): TerrainSemanticPoint => [
      x + fx * u - fz * v,
      z + fz * u + fx * v,
    ];
    if (turn === 0) {
      paintPolygon(rectangle(...at(-0.45, 0), fx, fz, 0.16, 1.5), lift);
      paintPolygon([at(0.3, -0.3), at(1.2, 0), at(0.3, 0.3)], lift);
      return;
    }
    paintPolygon(rectangle(...at(-0.5, 0), fx, fz, 0.16, 1.4), lift);
    paintPolygon(rectangle(...at(0.12, turn * 0.25), -fz * turn, fx * turn, 0.16, 0.5), lift);
    paintPolygon([at(-0.15, turn * 0.5), at(0.12, turn * 0.95), at(0.4, turn * 0.5)], lift);
  };
  for (const node of network.junctions) {
    if (!inTile(node.x, node.z)) continue;
    stats.junctions++;
    const control = controls.get(node);
    if (style.crossings || style.markings)
      for (const arm of node.arms) {
        const x = arm.x,
          z = arm.z;
        const lift = arm.road.elevation + arm.road.stack + 0.055;
        const oneway = arm.road.feature.oneway === true;
        const stopped = control?.stops.has(arm) === true;
        const yielding = control?.yields.has(arm) === true;
        const crosswalk = crosswalkAt(node, arm);
        if (crosswalk) {
          // High-visibility bars, then at a signal a transverse line along each side.
          for (
            let offset = -arm.width / 2 + 0.65;
            offset < arm.width / 2 - 0.3 && remaining > 0;
            offset += 1.1
          ) {
            remaining--;
            paintPolygon(
              rectangle(x - arm.dz * offset, z + arm.dx * offset, arm.dx, arm.dz, 0.5, 2.6),
              lift,
            );
          }
          if (control?.signal)
            for (const along of [-1.45, 1.45])
              if (remaining-- > 0)
                paintPolygon(
                  rectangle(
                    x + arm.dx * along,
                    z + arm.dz * along,
                    arm.dx,
                    arm.dz,
                    arm.width - 0.3,
                    0.2,
                  ),
                  lift,
                );
        }
        if (!style.markings || !incomingArm(arm)) continue;
        // The approach: all of a one-way arm, else the half traffic keeps to. The stop line
        // stands about 1.2 m short of a crosswalk, or at the corner where there is none.
        const approach = oneway ? arm.width : arm.width / 2;
        const ax = oneway ? 0 : (side * arm.dz * arm.width) / 4,
          az = oneway ? 0 : (-side * arm.dx * arm.width) / 4;
        const setback = crosswalk ? 2.8 : 1;
        if ((control?.signal || stopped) && remaining-- > 0)
          paintPolygon(
            rectangle(
              x + arm.dx * setback + ax,
              z + arm.dz * setback + az,
              arm.dx,
              arm.dz,
              approach - 0.7,
              0.45,
            ),
            lift,
          );
        else if (yielding) {
          // A yield line: a row of triangles pointing at approaching traffic ("shark teeth").
          const teeth = Math.floor((approach - 0.7) / 0.9);
          for (let i = 0; i < teeth && remaining-- > 0; i++) {
            const lateral = -((teeth - 1) * 0.9) / 2 + i * 0.9;
            const cx = x + arm.dx * setback + ax - arm.dz * lateral,
              cz = z + arm.dz * setback + az + arm.dx * lateral;
            paintPolygon(
              [
                [cx - arm.dz * 0.25, cz + arm.dx * 0.25],
                [cx + arm.dx * 0.75, cz + arm.dz * 0.75],
                [cx + arm.dz * 0.25, cz - arm.dx * 0.25],
              ],
              lift,
            );
          }
        }
        // Lane arrows 6 m behind a signal's stop line, on approaches of two or more lanes: the
        // lane nearest the center turns across traffic where an arm leads that way, the curb lane
        // goes straight (or turns curbside where nothing lies ahead), and lanes between go on.
        const lanes = oneway ? laneCount(arm.road) : Math.floor(laneCount(arm.road) / 2);
        if (!control?.signal || lanes < 2 || approach / lanes < 2.5 || remaining < lanes * 3)
          continue;
        const fx = -arm.dx,
          fz = -arm.dz;
        let ahead = false,
          right = false,
          left = false;
        for (const other of node.arms) {
          if (other === arm) continue;
          if (other.dx * fx + other.dz * fz > 0.7) ahead = true;
          const lateral = other.dx * -fz + other.dz * fx;
          if (lateral > 0.5) right = true;
          if (lateral < -0.5) left = true;
        }
        // Across traffic is left where traffic keeps right.
        const across = side > 0 ? left : right;
        const curbside = side > 0 ? right : left;
        const width = approach / lanes;
        for (let lane = 0; lane < lanes; lane++) {
          // Lane 0 is the curb lane; its center lies `lateral` from the arm's centerline, toward
          // the side traffic keeps to.
          const lateral = arm.width / 2 - (lane + 0.5) * width;
          const turn =
            lane === lanes - 1 && across
              ? -side
              : lane === 0 && !ahead && curbside
                ? side
                : ahead
                  ? 0
                  : undefined;
          if (turn === undefined) continue;
          remaining -= 3;
          laneArrow(
            x + arm.dx * (setback + 6) + side * arm.dz * lateral,
            z + arm.dz * (setback + 6) - side * arm.dx * lateral,
            fx,
            fz,
            turn,
            lift,
          );
        }
      }
    if (!style.streetlights && !style.trafficSignals) continue;
    const arms = [...node.arms].sort((a, b) => Math.atan2(a.dz, a.dx) - Math.atan2(b.dz, b.dx));
    const phaseGroups = arms.map(() => -1);
    let phaseCount = 0;
    for (const [i, arm] of arms.entries()) {
      if ((phaseGroups[i] as number) >= 0) continue;
      phaseGroups[i] = phaseCount;
      let opposite = -1;
      let bestDot = -0.7;
      for (let j = i + 1; j < arms.length; j++) {
        const other = arms[j] as (typeof arms)[number];
        const dot = arm.dx * other.dx + arm.dz * other.dz;
        if (phaseGroups[j] === -1 && dot < bestDot) {
          opposite = j;
          bestDot = dot;
        }
      }
      if (opposite >= 0) phaseGroups[opposite] = phaseCount;
      phaseCount++;
    }
    for (let i = 0; i < arms.length && fixtureCount < maxFixtures; i++) {
      const a = arms[i],
        b = arms[(i + 1) % arms.length];
      if (!a || !b) continue;
      const angle = (Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx) + Math.PI * 2) % (Math.PI * 2);
      if (angle > Math.PI + 0.1 || angle < 0.3) continue;
      const direction = Math.atan2(a.dz, a.dx) + angle / 2;
      // Intersect the two outer sidewalk edges, including divided carriageway widths.
      const ax = a.x - a.dz * (a.width / 2 + 1.5);
      const az = a.z + a.dx * (a.width / 2 + 1.5);
      const bx = b.x + b.dz * (b.width / 2 + 1.5);
      const bz = b.z - b.dx * (b.width / 2 + 1.5);
      const cross = a.dx * b.dz - a.dz * b.dx;
      let x: number, z: number;
      if (Math.abs(cross) < 0.15) {
        // The uninterrupted side of a T-junction has a straight curb, not a corner.
        if (angle < 3) continue;
        const distance = Math.max(a.width, b.width) / 2 + 1.5;
        x = node.x + Math.cos(direction) * distance;
        z = node.z + Math.sin(direction) * distance;
      } else {
        const along = ((bx - ax) * b.dz - (bz - az) * b.dx) / cross;
        x = ax + a.dx * along;
        z = az + a.dz * along;
      }
      if (Math.hypot(x - node.x, z - node.z) > node.radius + 15) continue;
      if (!inTile(x, z) || blocked(x, z) || network.occupied(x, z, 0.4)) continue;
      const y =
        context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z) + 0.45;
      const dx = -Math.cos(direction),
        dz = -Math.sin(direction),
        yaw = Math.atan2(dx, dz);
      fixtureCount++;
      const mappedLampNearby =
        details.preferMappedProps === true &&
        (tile.pois ?? []).some(
          (p) =>
            p.class === 'street_lamp' &&
            Math.hypot(p.point[0] * context.tileSize - x, p.point[1] * context.tileSize - z) < 18,
        );
      if (
        style.streetlights &&
        !mappedLampNearby &&
        streetLights.length < maxStreetlights &&
        arms.some((arm) => arm.road.feature.tags?.lit !== 'no')
      ) {
        stats.streetlights++;
        streetLights.push({
          x: x + dx * 1.8,
          z: z + dz * 1.8,
          y: y + 7.2,
          yaw,
          groundLift: Math.max(0.5, a.road.elevation + a.road.stack + 0.06),
        });
        fixtures.push(
          { x, z, y: y + 3.7, yaw, size: [0.16, 7.4, 0.16], color: '#667078' },
          { x, z, y: y + 0.15, yaw, size: [0.45, 0.3, 0.45], color: '#888d8b' },
          {
            x: x + dx * 0.9,
            z: z + dz * 0.9,
            y: y + 7.35,
            yaw,
            size: [0.12, 0.12, 1.9],
            color: '#667078',
          },
          {
            x: x + dx * 1.8,
            z: z + dz * 1.8,
            y: y + 7.3,
            yaw,
            size: [0.48, 0.18, 0.85],
            color: '#efe8ba',
          },
        );
      }
      // A curbside mast reaches across the approach, with heads facing arriving traffic.
      const approach = side === 1 ? a : b;
      const approachIndex = side === 1 ? i : (i + 1) % arms.length;
      if (style.trafficSignals && control?.signal && incomingArm(approach)) {
        stats.trafficSignals++;
        const sx = x + dx * 0.35,
          sz = z + dz * 0.35;
        const acrossX = side * approach.dz,
          acrossZ = -side * approach.dx;
        const lateral = side * ((sx - approach.x) * -approach.dz + (sz - approach.z) * approach.dx);
        const reach = Math.max(2, lateral + approach.width / 2 + 0.6);
        const armYaw = Math.atan2(acrossX, acrossZ);
        const headYaw = Math.atan2(approach.dx, approach.dz);
        // Include road grade when choosing mast height, retaining truck clearance.
        const roadHeight = context.heightfield.sampleHeight(
          context.origin[0] + sx + acrossX * reach,
          context.origin[1] + sz + acrossZ * reach,
        );
        const top = Math.max(y + 7.4, roadHeight + approach.road.elevation + 7.4);
        fixtures.push(
          {
            x: sx,
            z: sz,
            y: (y + top) / 2,
            yaw: armYaw,
            size: [0.24, top - y, 0.24],
            color: '#626d73',
          },
          { x: sx, z: sz, y: y + 0.16, yaw: armYaw, size: [0.52, 0.32, 0.52], color: '#969c99' },
          { x: sx, z: sz, y: top - 0.1, yaw: armYaw, size: [0.34, 0.4, 0.34], color: '#626d73' },
          {
            x: sx + (acrossX * reach) / 2,
            z: sz + (acrossZ * reach) / 2,
            y: top,
            yaw: armYaw,
            size: [0.2, 0.22, reach],
            color: '#626d73',
          },
        );
        const oneway = approach.road.feature.oneway === true;
        const lanes = Math.min(
          3,
          Math.max(
            1,
            Math.floor(inferLaneCount(approach.road.feature, approach.width) / (oneway ? 1 : 2)),
          ),
        );
        for (let lane = 0; lane < lanes; lane++) {
          const distance =
            lateral +
            (oneway ? -approach.width / 2 : 0) +
            (approach.width * (lane + 0.5)) / (lanes * (oneway ? 1 : 2));
          const head: TerrainSignalHead = {
            x: sx + acrossX * distance,
            z: sz + acrossZ * distance,
            y: top - 1.05,
            yaw: headYaw,
            junction: [context.origin[0] + node.x, context.origin[1] + node.z],
            direction: [approach.dx, approach.dz],
            radius: node.radius,
            group: phaseGroups[approachIndex] as number,
            groups: phaseCount,
            offset: hash(context.origin[0] + node.x, context.origin[1] + node.z) * phaseCount * 29,
          };
          signalHeads.push(head);
          fixtures.push(
            { ...head, y: top - 0.3, size: [0.12, 0.6, 0.12], color: '#626d73' },
            { ...head, size: [0.9, 1.8, 0.12], color: '#c99b3c' },
            { ...head, size: [0.62, 1.5, 0.4], color: '#20272b' },
          );
          // Projecting visors shade the round lenses and make the head readable in daylight.
          for (let light = 0; light < 3; light++)
            fixtures.push({
              ...head,
              x: head.x + approach.dx * 0.3,
              z: head.z + approach.dz * 0.3,
              y: head.y + 0.58 - light * 0.38,
              size: [0.43, 0.07, 0.32],
              color: '#20272b',
            });
        }
      }
    }
  }

  const inferredParking =
    details.inferParking === false ? [] : inferTerrainParkingAreas(tile, network, context.tileSize);
  group.userData.inferredParkingAreas = inferredParking.reduce(
    (sum, f) => sum + f.polygons.length,
    0,
  );
  const areas = [...tile.landcover, ...inferredParking]
    .filter((feature) => areaKind(feature.class, feature.subclass) !== undefined)
    .flatMap((feature) => feature.polygons)
    .map((polygon) => ({ polygon, bounds: polygonBounds(polygon) }));
  // Whether a point on one lot's edge also touches another paved area (within 0.6 m).
  const touchesOtherArea = (x: number, z: number, self: TerrainSemanticPolygon): boolean => {
    const u = x / context.tileSize,
      v = z / context.tileSize,
      r = 0.6 / context.tileSize;
    return areas.some(
      ({ polygon, bounds }) =>
        polygon !== self &&
        u >= bounds[0] - r &&
        u <= bounds[2] + r &&
        v >= bounds[1] - r &&
        v <= bounds[3] + r &&
        [
          [0, 0],
          [r, 0],
          [-r, 0],
          [0, r],
          [0, -r],
        ].some(([du = 0, dv = 0]) => pointInPolygon([u + du, v + dv], polygon)),
    );
  };
  // Neighboring bays share a side line, and back-to-back rows a back line. Painted twice, the two
  // coplanar copies fought, and the paint's wear flickered as the camera moved; paint each once.
  const stallLines = new Set<string>();
  for (const feature of [...tile.landcover, ...inferredParking]) {
    const kind = areaKind(feature.class, feature.subclass);
    if (!kind) continue;
    for (const polygon of feature.polygons) {
      const color =
        kind === 'parking' ? style.parking : kind === 'plaza' ? style.plaza : style.path;
      // Pedestrian areas can overlap mapped or inferred parking. Distinct heights
      // keep those different-colored fills from competing in the depth buffer.
      const elevation = kind === 'parking' ? 0.3 : kind === 'plaza' ? 0.38 : 0.4;
      const start = pavement.vertexCount;
      appendTerrainSurfaceArea(pavement, polygon, new THREE.Color(color), elevation);
      const surface =
        kind === 'parking' ? TERRAIN_SURFACE_KIND.parking : TERRAIN_SURFACE_KIND.plaza;
      // Areas have no band to run joints along: pedestrian areas use the world paver grid.
      pavement.surfaceSince(start, surface);
      if (detailed)
        appendAreaFringe(
          edges,
          polygon,
          { color, elevation: elevation + 0.02, surface },
          // Where a lot or plaza meets a road (within a curb-and-gutter's width), a footway,
          // another paved area or a building, the edge belongs to them and stays clean.
          (points) =>
            points.every(
              (p) =>
                !network.occupied(p[0], p[1], 1.5, undefined, true) &&
                !blocked(p[0], p[1]) &&
                !touchesOtherArea(p[0], p[1], polygon),
            ),
        );
      if (kind !== 'parking') continue;
      stats.parkingAreas++;
      if (!detailed && context.address.level === context.pyramid.maxLevel - 1 && style.parkedCars) {
        // Distant parked-car color patches share the lot mesh; no vehicle meshes/textures.
        const bounds = polygonBounds(polygon);
        const step = 8 / context.tileSize;
        for (
          let u = Math.ceil(bounds[0] / step) * step;
          u < bounds[2] && fixtureCount < Math.min(32, maxFixtures);
          u += step
        )
          for (
            let v = Math.ceil(bounds[1] / step) * step;
            v < bounds[3] && fixtureCount < Math.min(32, maxFixtures);
            v += step
          ) {
            const x = u * context.tileSize,
              z = v * context.tileSize;
            const seed = hash(context.origin[0] + x, context.origin[1] + z);
            const w = 0.9 / context.tileSize,
              d = 2.2 / context.tileSize;
            const patch = {
              outer: [
                [u - w, v - d],
                [u + w, v - d],
                [u + w, v + d],
                [u - w, v + d],
              ] as TerrainSemanticPoint[],
            };
            if (
              seed >= (details.parkingOccupancy ?? 0.7) ||
              blocked(x, z) ||
              network.occupied(x, z, 2) ||
              !patch.outer.every((p) => pointInPolygon(p, polygon))
            )
              continue;
            const tint = ['#a5afb2', '#59656b', '#bcbab0', '#777a77'][
              Math.floor(seed * 31) % 4
            ] as string;
            appendTerrainSurfaceArea(pavement, patch, new THREE.Color(tint), elevation + 0.06);
            fixtureCount++;
            stats.parkedCars++;
          }
      }
      if (!detailed || (!style.parkingStalls && !style.parkedCars) || remaining <= 0) continue;
      // Align stalls to the longest mapped boundary, and anchor the lattice in world space.
      let angle = 0,
        longest = 0;
      const ring = normalizeRing(polygon.outer);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (!a || !b) continue;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length > longest) {
          longest = length;
          angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
      }
      // Canonical orientation avoids reversing the lattice when a decoder reverses ring winding.
      angle = ((angle % Math.PI) + Math.PI) % Math.PI;
      const dx = Math.cos(angle),
        dz = Math.sin(angle);
      const projected = ring.map((p) => {
        const x = p[0] * context.tileSize + context.origin[0];
        const z = p[1] * context.tileSize + context.origin[1];
        return [x * dx + z * dz, -x * dz + z * dx];
      });
      const [minU, minV, maxU, maxV] = polygonBounds({
        outer: projected as TerrainSemanticPoint[],
      });
      const toLocal = (u: number, v: number): TerrainSemanticPoint => [
        u * dx - v * dz - context.origin[0],
        u * dz + v * dx - context.origin[1],
      ];
      const valid = (p: TerrainSemanticPoint): boolean =>
        inTile(p[0], p[1]) &&
        pointInPolygon([p[0] / context.tileSize, p[1] / context.tileSize], polygon) &&
        !network.occupied(p[0], p[1], 0.5) &&
        !blocked(p[0], p[1]);
      const rows: { v: number; side: number }[] = [];
      // Use mapped service aisles as row anchors when available. The fallback lattice is
      // for parking polygons without internal aisle geometry.
      for (const road of network.roads) {
        if (road.kind !== 'service') continue;
        for (let i = 1; i < road.path.points.length && rows.length < 256; i++) {
          const a = road.path.points[i - 1] as TerrainSemanticPoint;
          const b = road.path.points[i] as TerrainSemanticPoint;
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 10 || Math.abs((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length < 0.97)
            continue;
          if (
            !pointInPolygon(
              [(a[0] + b[0]) / (2 * context.tileSize), (a[1] + b[1]) / (2 * context.tileSize)],
              polygon,
            )
          )
            continue;
          const across = -(a[0] + context.origin[0]) * dz + (a[1] + context.origin[1]) * dx;
          for (const sign of [-1, 1]) {
            const v = across + sign * (road.width / 2 + 0.55 + 5.2);
            const side = -sign;
            if (!rows.some((row) => Math.abs(row.v + row.side * 2.6 - v - side * 2.6) < 5.15))
              rows.push({ v, side });
          }
        }
      }
      if (!rows.length)
        for (let v = Math.ceil(minV / 16.8) * 16.8; v < maxV && rows.length < 256; v += 16.8) {
          rows.push({ v, side: -1 }, { v, side: 1 });
        }
      for (const row of rows) {
        const { v } = row;
        for (let u = Math.ceil(minU / 2.65) * 2.65; u < maxU && remaining > 0; u += 2.65) {
          for (const side of [row.side]) {
            if (remaining-- <= 0) break;
            const center = toLocal(u + 1.325, v + side * 2.6);
            const corners = [
              toLocal(u, v),
              toLocal(u + 2.65, v),
              toLocal(u + 2.65, v + side * 5.2),
              toLocal(u, v + side * 5.2),
            ];
            const samples = [
              ...corners,
              center,
              ...corners.map((p, i) => midpoint(p, corners[(i + 1) % 4] as TerrainSemanticPoint)),
            ];
            if (!samples.every(valid)) continue;
            // Check complete bays at sub-meter spacing so narrow holes/obstacles don't get cars.
            let fits = true;
            for (let a = 0.4; a < 2.65 && fits; a += 0.6)
              for (let b = 0.4; b < 5.2; b += 0.6) {
                if (!valid(toLocal(u + a, v + side * b))) {
                  fits = false;
                  break;
                }
              }
            if (!fits) continue;
            stats.parkingBays++;
            if (style.parkingStalls) {
              for (const [a, b] of [
                [corners[3], corners[0]],
                [corners[0], corners[1]],
                [corners[1], corners[2]],
              ]) {
                if (!a || !b) continue;
                const ends = [a, b]
                  .map((p) => `${Math.round(p[0] * 100)}/${Math.round(p[1] * 100)}`)
                  .sort()
                  .join(':');
                if (stallLines.has(ends)) continue;
                stallLines.add(ends);
                const line = terrainLinePath(
                  [
                    a.map((n) => n / context.tileSize),
                    b.map((n) => n / context.tileSize),
                  ] as TerrainSemanticPoint[],
                  context.tileSize,
                );
                appendTerrainLineBand(marks, line, {
                  width: 0.1,
                  color: style.white,
                  elevation: 0.345,
                  surface: TERRAIN_SURFACE_KIND.paint,
                });
              }
            }
            const seed = hash(center[0] + context.origin[0], center[1] + context.origin[1]);
            if (
              style.parkedCars &&
              parkedVehicles.length > 0 &&
              fixtureCount < maxFixtures &&
              seed < (details.parkingOccupancy ?? 0.7)
            ) {
              const x = center[0],
                z = center[1];
              const yaw = -angle + (side < 0 ? Math.PI : 0);
              const wx = context.origin[0] + x,
                wz = context.origin[1] + z;
              const vehicle = pickParkedVehicle(parkedVehicles, hash(wx + 19.7, wz - 37.1));
              if (!vehicle) continue;
              fixtureCount++;
              stats.parkedCars++;
              const palette = vehicle.colors?.length
                ? vehicle.colors
                : ['#b7c0c5', '#566d82', '#914c40', '#e0dccc', '#3e4b50', '#8d989b'];
              const color = palette[Math.floor(seed * 79) % palette.length] as string;
              const kind = vehicle.id;
              const spec = vehicle.spec;
              const heights = [spec.wheelbase / 2, -spec.wheelbase / 2].flatMap((wheelZ) =>
                [-spec.wheelTrack / 2, spec.wheelTrack / 2].map(
                  (wheelX) =>
                    pavement.groundHeight(
                      x + Math.cos(yaw) * wheelX + Math.sin(yaw) * wheelZ,
                      z - Math.sin(yaw) * wheelX + Math.cos(yaw) * wheelZ,
                    ) + 0.3,
                ),
              );
              const [fl, fr, rl, rr] = heights as [number, number, number, number];
              vehicles.push({
                id: `parked-car:${Math.round(wx * 10)}:${Math.round(wz * 10)}`,
                kind,
                color,
                spec,
                position: [wx, (fl + fr + rl + rr) / 4, wz],
                yaw,
                pitch: Math.atan2((rl + rr - fl - fr) / 2, spec.wheelbase),
                roll: Math.atan2((fr + rr - fl - rl) / 2, spec.wheelTrack),
              });
            }
          }
        }
      }
    }
  }
  for (const mesh of [
    pavement.mesh('surface:areas'),
    edges.mesh('surface:edges'),
    roads.mesh('semantic:transportation', roadMaterial),
    marks.mesh('surface:markings'),
  ].map(weldTerrainSurfaceMesh)) {
    if (!mesh) continue;
    // A host pavement material (createTerrainSurfaceRenderer's setMaterial) replaces the plain one.
    if (mesh.name !== 'semantic:transportation' || roadMaterial === undefined)
      mesh.userData[TERRAIN_PAVEMENT] = true;
    group.add(mesh);
  }
  const signMesh = weldTerrainSurfaceMesh(signFaces.mesh('surface:road-signs', undefined, false));
  if (signMesh) group.add(signMesh);
  const fixtureMesh = createTerrainBoxInstances(fixtures, 'surface:street-fixtures');
  if (fixtureMesh) group.add(fixtureMesh);
  if (renderVehicles && vehicles.length)
    group.add(createParkedVehicleBatch(vehicles, context.origin));
  appendTerrainSignalLenses(group, signalHeads);
  appendTerrainStreetLights(group, streetLights, context);
  markTerrainSurfaceDetail(group);
  stats.detailLimited =
    remaining <= 0 ||
    fixtureCount >= maxFixtures ||
    streetLights.length >= maxStreetlights ||
    signs.length >= 48;
  return group;
}

export interface TerrainSurfaceGenerator {
  generate(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    options: TerrainSurfaceOptions,
  ): Promise<THREE.Group | undefined>;
  dispose(): void;
}

export interface TerrainSurfaceRenderer {
  /** Synchronous construction for direct/static consumers. Streamed renderers use createTileAsync. */
  createTile(tile: TerrainSemanticTile, context: TerrainPyramidTileLayerContext): THREE.Group;
  /** Resolves only when the newest requested style is ready, or undefined after cancellation. */
  createTileAsync(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): Promise<THREE.Group | undefined>;
  disposeTile(object: THREE.Object3D): void;
  /** Refresh resident tiles cooperatively, without refetching map data or rebuilding buildings. */
  setOptions(options: TerrainSurfaceOptions): Promise<void>;
  /**
   * Draw roads, sidewalks, markings and lots with `material` (for example
   * `createTerrainPavementMaterialAsync`, which reads their `surfaceDetail`), on resident tiles
   * and every later one. Undefined restores the plain vertex-color material.
   */
  setMaterial(material: THREE.Material | undefined): void;
  /** Absolute simulation time in seconds; optionally resolve colours from a traffic graph. */
  updateSignals(elapsedSeconds: number, resolve?: TerrainTrafficSignalResolver): void;
  /** Fade streetlamp emission and pavement pools, 0 (day) to 1 (night). */
  setNightFactor(factor: number): void;
  /** Visit lamps on attached, visible tiles; positions are local to each source object. */
  visitStreetLights(visit: (light: TerrainStreetLight, source: THREE.Object3D) => void): void;
  /**
   * Hide each tile's small street detail (signs, fixtures, signal lenses, lane markings, parked
   * cars) when the tile lies farther from `position` (the scene camera's world position) than
   * the detail's `userData.detailDistance`, and show it again as the camera nears. Call every
   * frame; it works only after the camera has moved or tiles have changed.
   */
  updateDetail(position: THREE.Vector3): void;
  stats(): TerrainSurfaceStats & {
    tiles: number;
    loading: number;
    style: string;
    /** Changes only when rendered geometry is installed, replaced or removed. */
    geometryRevision: number;
  };
  dispose(): void;
}

/**
 * Draw distances (meters from the camera to the detail's bounds) for a surface tile's small
 * detail; see `TerrainSurfaceRenderer.updateDetail`. From a jet, a view held hundreds of these
 * draws for tiles kilometers away, where a sign, a signal lens or a lane line is under a pixel.
 */
const FIXTURE_DISTANCE = 900;
const MARKING_DISTANCE = 1500;
const PARKED_CAR_DISTANCE = 1500;

/**
 * Give a surface tile's small detail its draw distance (`userData.detailDistance`), and keep its
 * paint out of walking and driving collision (`userData.walkIgnore`). Paint floats a few
 * centimeters over the asphalt so the two never fight in the depth buffer; solid, each lane line,
 * dash and crosswalk bar was a step a wheel jolted over, and crosswalks a washboard.
 */
export function markTerrainSurfaceDetail(group: THREE.Object3D): void {
  for (const child of group.children) {
    if (child.name === 'surface:markings') child.userData.walkIgnore = true;
    const distance =
      child.name === 'surface:markings'
        ? MARKING_DISTANCE
        : child.name === 'surface:parked-cars'
          ? PARKED_CAR_DISTANCE
          : /^surface:(road-signs|street-fixtures|signal-|night-)/.test(child.name)
            ? FIXTURE_DISTANCE
            : undefined;
    if (distance !== undefined) child.userData.detailDistance = distance;
  }
}

/** One controller can be shared by all semantic renderers in a viewer. */
export function createTerrainSurfaceRenderer(
  initial: TerrainSurfaceOptions = {},
  generator?: TerrainSurfaceGenerator,
  /** Resolve a tile's regional fleet on the host before serializing its worker job. */
  parkedVehiclesAt?: (x: number, z: number) => readonly TerrainParkedVehicle[],
  /** Resolve one country appearance per tile before worker serialization. Explicit options win. */
  signProfileAt?: (x: number, z: number) => Readonly<TerrainRoadSignProfile> | undefined,
): TerrainSurfaceRenderer {
  let options = initial;
  const optionsAt = (context: TerrainPyramidTileLayerContext): TerrainSurfaceOptions => {
    const x = context.origin[0] + context.tileSize / 2,
      z = context.origin[1] + context.tileSize / 2;
    const profile = options.signProfile ?? signProfileAt?.(x, z);
    return {
      ...options,
      ...(profile ? { signProfile: profile } : {}),
      ...(parkedVehiclesAt
        ? { details: { ...options.details, parkedVehicles: parkedVehiclesAt(x, z) } }
        : {}),
    };
  };
  resolveTerrainSurfaceStyle(options.style, options.details);
  interface Entry {
    /** The tile, for rebuilds when options change (see keepTerrainSemanticTile). */
    tile: () => TerrainSemanticTile;
    context: TerrainPyramidTileLayerContext;
    controller?: AbortController;
    pending?: Promise<void>;
    cleanup: () => void;
  }
  const tiles = new Map<THREE.Object3D, Entry>();
  let revision = 0;
  let geometryRevision = 0;
  let disposed = false;
  let signalTime = 0;
  let nightFactor = 0;
  let signalResolver: TerrainTrafficSignalResolver | undefined;
  let detailRevision = -1;
  const detailAt = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);
  const detailMin = new THREE.Vector3();
  const detailMax = new THREE.Vector3();
  let pavement: THREE.Material | undefined;
  const plain = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const dress = (object: THREE.Object3D): void => {
    updateTerrainStreetLights(object, nightFactor);
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData[TERRAIN_PAVEMENT] !== true) return;
      if (!plain.has(mesh)) plain.set(mesh, mesh.material);
      mesh.material = pavement ?? (plain.get(mesh) as THREE.Material);
    });
  };
  const register = (
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): THREE.Group => {
    if (disposed) throw new Error('Surface renderer is disposed');
    const root = new THREE.Group();
    root.name = 'semantic:surface-layer';
    const abort = (): void => renderer.disposeTile(root);
    context.signal.addEventListener('abort', abort, { once: true });
    tiles.set(root, {
      tile: keepTerrainSemanticTile(tile),
      context,
      cleanup: () => context.signal.removeEventListener('abort', abort),
    });
    root.userData.disposeTerrainSurfaces = () => renderer.disposeTile(root);
    return root;
  };
  const rebuild = (root: THREE.Object3D, entry: Entry): Promise<void> => {
    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    const requested = optionsAt(entry.context);
    const build = async (): Promise<void> => {
      const object = generator
        ? await generator.generate(
            entry.tile(),
            { ...entry.context, signal: controller.signal },
            requested,
          )
        : createTerrainSurfaceObject(entry.tile(), entry.context, requested);
      if (!object) return;
      if (disposed || controller.signal.aborted || !tiles.has(root)) {
        disposeTerrainSurfaceObject(object);
        return;
      }
      disposeTerrainSurfaceObject(root);
      root.clear();
      dress(object);
      root.add(object);
      updateTerrainSurfaceSignals(object, signalTime, signalResolver);
      geometryRevision++;
    };
    const pending = build().finally(() => {
      if (entry.pending === pending) entry.pending = undefined;
    });
    entry.pending = pending;
    return pending;
  };
  const renderer: TerrainSurfaceRenderer = {
    createTile(tile, context) {
      const root = register(tile, context);
      try {
        const object = createTerrainSurfaceObject(tile, context, optionsAt(context));
        dress(object);
        root.add(object);
        updateTerrainSurfaceSignals(object, signalTime, signalResolver);
        geometryRevision++;
      } catch (error) {
        renderer.disposeTile(root);
        throw error;
      }
      return root;
    },
    async createTileAsync(tile, context) {
      if (context.signal.aborted) return undefined;
      const root = register(tile, context);
      const entry = tiles.get(root) as Entry;
      rebuild(root, entry);
      try {
        // Live options can replace a queued job while its caller awaits the older revision.
        while (entry.pending) await entry.pending;
        return tiles.has(root) && !disposed ? root : undefined;
      } catch (error) {
        renderer.disposeTile(root);
        throw error;
      }
    },
    disposeTile(root) {
      const entry = tiles.get(root);
      if (entry && root.children.length > 0) geometryRevision++;
      tiles.delete(root);
      entry?.controller?.abort();
      entry?.cleanup();
      delete root.userData.disposeTerrainSurfaces;
      disposeTerrainSurfaceObject(root);
    },
    async setOptions(next) {
      if (disposed) throw new Error('Surface renderer is disposed');
      resolveTerrainSurfaceStyle(next.style, next.details);
      options = next;
      const current = ++revision;
      if (generator) {
        // Dispatch is bounded by the bridge. Enqueue replacements together so initial tile
        // callers remain attached to their newest revision throughout an options change.
        await Promise.all([...tiles].map(([root, entry]) => rebuild(root, entry)));
        return;
      }
      for (const [root, entry] of [...tiles]) {
        if (current !== revision) return;
        if (!tiles.has(root)) continue;
        await rebuild(root, entry);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    },
    setMaterial(material) {
      pavement = material;
      for (const root of tiles.keys()) dress(root);
    },
    setNightFactor(factor) {
      if (!Number.isFinite(factor)) throw new Error('Night factor must be finite');
      const next = Math.max(0, Math.min(1, factor));
      if (next === nightFactor) return;
      nightFactor = next;
      for (const root of tiles.keys()) {
        const object = root.children[0];
        if (object) updateTerrainStreetLights(object, nightFactor);
      }
    },
    visitStreetLights(visit) {
      for (const root of tiles.keys()) {
        const source = root.children[0];
        if (!source || !root.parent) continue;
        let visible = true;
        for (let parent: THREE.Object3D | null = source; parent; parent = parent.parent)
          if (!parent.visible) visible = false;
        if (!visible) continue;
        for (const light of (source.userData.streetLights ?? []) as TerrainStreetLight[])
          visit(light, source);
      }
    },
    updateDetail(position) {
      if (detailRevision === geometryRevision && detailAt.distanceToSquared(position) < 625) return;
      detailRevision = geometryRevision;
      detailAt.copy(position);
      // Measured to the tile's footprint, not each mesh's bounds: computing those for every
      // newly arrived tile's meshes was a 10 ms frame under a jet.
      for (const [root, entry] of tiles) {
        const object = root.children[0];
        if (object === undefined) continue;
        const size = entry.context.tileSize;
        detailMin.set(0, 0, 0).applyMatrix4(root.matrixWorld);
        detailMax.set(size, 0, size).applyMatrix4(root.matrixWorld);
        const dx = Math.max(
          Math.min(detailMin.x, detailMax.x) - position.x,
          0,
          position.x - Math.max(detailMin.x, detailMax.x),
        );
        const dz = Math.max(
          Math.min(detailMin.z, detailMax.z) - position.z,
          0,
          position.z - Math.max(detailMin.z, detailMax.z),
        );
        const distance = Math.hypot(dx, dz);
        for (const child of object.children) {
          const limit = child.userData.detailDistance as number | undefined;
          if (limit !== undefined) child.visible = distance <= limit;
        }
      }
    },
    updateSignals(elapsedSeconds, resolve) {
      if (!Number.isFinite(elapsedSeconds)) throw new Error('Signal time must be finite');
      signalTime = elapsedSeconds;
      signalResolver = resolve;
      for (const root of tiles.keys()) {
        const object = root.children[0];
        if (object) updateTerrainSurfaceSignals(object, signalTime, signalResolver);
      }
    },
    stats() {
      const sum = {
        runways: 0,
        taxiways: 0,
        aprons: 0,
        roads: 0,
        parkingAreas: 0,
        junctions: 0,
        streetlights: 0,
        streetFurniture: 0,
        trafficSignals: 0,
        roadSigns: 0,
        parkingBays: 0,
        parkedCars: 0,
        detailLimited: false,
        tiles: tiles.size,
        loading: 0,
        geometryRevision,
        style: resolveTerrainSurfaceStyle(options.style, options.details).id,
      };
      for (const [root, entry] of tiles) {
        if (entry.pending) sum.loading++;
        const stats = root.children[0]?.userData.surfaceStats as TerrainSurfaceStats | undefined;
        if (!stats) continue;
        for (const key of [
          'runways',
          'taxiways',
          'aprons',
          'roads',
          'parkingAreas',
          'junctions',
          'streetlights',
          'streetFurniture',
          'trafficSignals',
          'roadSigns',
          'parkingBays',
          'parkedCars',
        ] as const)
          sum[key] += stats[key];
        sum.detailLimited ||= stats.detailLimited;
      }
      return sum;
    },
    dispose() {
      disposed = true;
      revision++;
      for (const root of tiles.keys()) renderer.disposeTile(root);
      generator?.dispose();
    },
  };
  return renderer;
}
