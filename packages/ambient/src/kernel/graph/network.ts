/**
 * TransportNetwork: the registry of nodes, edges, lanes and junctions built from tiles,
 * documents and script polylines. Tiles register and unregister as the host streams them;
 * border nodes stitch to their neighbours so lanes continue across tile edges.
 *
 * The network is derived data outside world state (like the worldgen index): agents store lane
 * ids, and a keyframe restores correctly into any world whose network was built from the same
 * inputs.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  bridgeDeckHeightFn,
  PATH_SURFACE_LIFT,
  ROAD_SURFACE_LIFT,
  type TerrainLinePath,
  type TerrainPoiFeature,
  type TerrainTransportationFeature,
} from '@bendyline/molen-terrain/kernel';
import { fnv1a, shortHash } from '../ids';
import { documentPois, documentRunways, type TransportNetworkDocument, wayDraft } from './doc';
import {
  type EdgeDraft,
  featureDrafts,
  KIND_SPEED,
  type Point2,
  tilePois,
  type WorldPoi,
} from './drafts';
import { type GraphStore, rebuildNodeGroup } from './junctions';
import { cumulative, planarSplit } from './planar';
import { laneCoordinate, laneSample, sampleLaneBody } from './sample';
import { LaneGrid } from './spatial';
import type {
  LaneMovement,
  LaneSample,
  LaneStop,
  TransportClass,
  TransportCrossing,
  TransportEdge,
  TransportJunction,
  TransportLane,
  TransportNode,
  TransportRunway,
} from './types';

/** One streamed map tile's transport data. */
export interface AmbientTileInput {
  /** Unique tile key, e.g. `terrainPyramidTileKey(address)`. */
  key: string;
  /** World X/Z of the tile's north-west corner, in metres. */
  origin: readonly [number, number];
  /** Tile edge length in metres; feature coordinates are normalized to it. */
  tileSize: number;
  features: readonly TerrainTransportationFeature[];
  pois?: readonly TerrainPoiFeature[];
  /** Ground height at a world X/Z (default: the network's ground sampler). */
  heightAt?: (x: number, z: number) => number;
  /** Infer sidewalks along streets without mapped footways (default true). */
  sidewalks?: boolean;
}

export interface TransportNetworkOptions {
  traffic?: 'right' | 'left';
  tunnels?: 'hidden' | 'skip';
  /** Ground height used when a tile or document gives none (default 0). */
  ground?: (x: number, z: number) => number;
  /** Lane classes to build (default all); skipping unused classes makes tiles cheaper. */
  classes?: readonly TransportClass[];
}

export interface TransportNetworkStats {
  tiles: number;
  nodes: number;
  edges: number;
  lanes: number;
  junctions: number;
  signals: number;
  /** Lane-kilometres per class. */
  laneKm: Record<TransportClass, number>;
  degradedTiles: number;
}

/** A script-added polyline. */
export interface AmbientPolyline {
  class: 'road' | 'rail' | 'path';
  subclass?: string;
  /** `[x, z]` or `[x, y, z]` points in scene metres. */
  points: ([number, number] | [number, number, number])[];
  oneway?: boolean;
  lanes?: number;
  width?: number;
  speed?: number;
  layer?: number;
}

interface TileRecord {
  key: string;
  nodes: string[];
  edges: string[];
  pois: WorldPoi[];
  runways: TransportRunway[];
  crossings: string[];
  degraded: boolean;
  rect?: [number, number, number, number];
}

const DOC_TILE = '*';
const SIDEWALK_LIFT = 0.14;
const SIDEWALK_KINDS: ReadonlySet<string> = new Set([
  'primary',
  'secondary',
  'tertiary',
  'street',
  'living',
]);

export class TransportNetwork implements GraphStore {
  readonly traffic: 'right' | 'left';
  readonly grid: LaneGrid = new LaneGrid();
  private readonly tunnels: 'hidden' | 'skip';
  private readonly ground: (x: number, z: number) => number;
  private classes: ReadonlySet<TransportClass>;
  private readonly nodes = new Map<string, TransportNode>();
  private readonly edges = new Map<string, TransportEdge>();
  private readonly lanes = new Map<string, TransportLane>();
  private readonly junctions = new Map<string, TransportJunction>();
  private readonly tiles = new Map<string, TileRecord>();
  private readonly borders = new Map<string, string[]>();
  private readonly crossings = new Map<string, TransportCrossing>();
  private readonly crossingsByEdge = new Map<string, TransportCrossing[]>();
  private readonly signalCells = new Map<string, WorldPoi[]>();
  private readonly docDrafts: EdgeDraft[] = [];
  private readonly docPois: WorldPoi[] = [];
  private readonly docRunways: { a: Point2; b: Point2 }[] = [];
  private docSidewalks = false;
  /** Bumped whenever lanes appear, disappear or change. */
  version = 0;

  constructor(options: TransportNetworkOptions = {}) {
    this.traffic = options.traffic ?? 'right';
    this.tunnels = options.tunnels ?? 'hidden';
    this.ground = options.ground ?? (() => 0);
    this.classes = new Set(options.classes ?? ['road', 'rail', 'walk', 'air']);
  }

  /** Change which lane classes are built (applies to tiles registered afterwards). */
  setClasses(classes: readonly TransportClass[]): void {
    this.classes = new Set(classes);
  }

  /** Whether a lane class is being built. */
  builds(cls: TransportClass): boolean {
    return this.classes.has(cls);
  }

  // --- GraphStore ---
  node(id: string): TransportNode | undefined {
    return this.nodes.get(id);
  }
  edge(id: string): TransportEdge | undefined {
    return this.edges.get(id);
  }
  lane(id: string): TransportLane | undefined {
    return this.lanes.get(id);
  }
  junction(id: string): TransportJunction | undefined {
    return this.junctions.get(id);
  }
  setJunction(junction: TransportJunction): void {
    this.junctions.set(junction.id, junction);
  }
  deleteJunction(id: string): void {
    this.junctions.delete(id);
  }
  signalNear(x: number, z: number, radius: number): boolean {
    return this.controlsNear(x, z, radius, 'traffic_signals').length > 0;
  }
  giveWayNear(x: number, z: number, radius: number): readonly WorldPoi[] {
    return this.controlsNear(x, z, radius, 'give_way');
  }
  private controlsNear(
    x: number,
    z: number,
    radius: number,
    kind: 'traffic_signals' | 'give_way',
  ): WorldPoi[] {
    const cx = dmath.floor(x / 64);
    const cz = dmath.floor(z / 64);
    const found: WorldPoi[] = [];
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const poi of this.signalCells.get(`${cx + ox}/${cz + oz}`) ?? [])
          if (poi.kind === kind && dmath.hypot(poi.x - x, poi.z - z) <= radius) found.push(poi);
    return found;
  }

  /** Whether a tile key is registered. */
  hasTile(key: string): boolean {
    return this.tiles.has(key);
  }

  tileKeys(): string[] {
    return [...this.tiles.keys()];
  }

  /** Every lane id (registration order). */
  laneIds(): IterableIterator<string> {
    return this.lanes.keys();
  }

  junctionList(): IterableIterator<TransportJunction> {
    return this.junctions.values();
  }

  runways(): TransportRunway[] {
    const out: TransportRunway[] = [];
    for (const tile of this.tiles.values()) out.push(...tile.runways);
    return out;
  }

  /** Aerodrome POIs (and runway midpoints) across registered tiles. */
  aerodromes(): WorldPoi[] {
    const out: WorldPoi[] = [];
    for (const tile of this.tiles.values())
      for (const poi of tile.pois) if (poi.kind === 'aerodrome') out.push(poi);
    return out;
  }

  crossingsOf(edgeId: string): readonly TransportCrossing[] {
    return this.crossingsByEdge.get(edgeId) ?? [];
  }

  /** The movement from `from` onto `to`, if one exists. */
  movement(from: string | undefined, to: string): LaneMovement | undefined {
    if (from === undefined) return undefined;
    const lane = this.lanes.get(from);
    if (lane === undefined) return undefined;
    for (const move of lane.next) if (move.to === to) return move;
    return undefined;
  }

  // --- registration ---

  /** Build and add one map tile (replacing a previous registration under the same key). */
  registerTile(input: AmbientTileInput): void {
    if (this.tiles.has(input.key)) this.unregisterTile(input.key);
    const { drafts, runways } = featureDrafts(input, { tunnels: this.tunnels });
    const pois = tilePois(input.pois, input.origin, input.tileSize);
    const rect: [number, number, number, number] = [
      input.origin[0],
      input.origin[1],
      input.origin[0] + input.tileSize,
      input.origin[1] + input.tileSize,
    ];
    this.addTile(
      input.key,
      drafts,
      pois,
      runways,
      input.heightAt ?? this.ground,
      input.sidewalks !== false,
      rect,
    );
  }

  /** Remove a tile: its edges, lanes and nodes; stitched neighbours become open ends again. */
  unregisterTile(key: string): void {
    const tile = this.tiles.get(key);
    if (tile === undefined) return;
    const partners: string[] = [];
    for (const nodeId of tile.nodes) {
      const node = this.nodes.get(nodeId);
      if (node?.link !== undefined) {
        const partner = this.nodes.get(node.link);
        if (partner !== undefined) {
          partner.link = undefined;
          partners.push(partner.id);
        }
      }
    }
    for (const edgeId of tile.edges) {
      const edge = this.edges.get(edgeId);
      if (edge === undefined) continue;
      for (const laneId of edge.lanes) this.lanes.delete(laneId);
      this.grid.remove(edgeId);
      this.edges.delete(edgeId);
      this.crossingsByEdge.delete(edgeId);
    }
    for (const id of tile.crossings) this.crossings.delete(id);
    for (const nodeId of tile.nodes) {
      const node = this.nodes.get(nodeId);
      if (node === undefined) continue;
      this.junctions.delete(nodeId);
      if (node.border) {
        const key = borderKey(node);
        const list = this.borders.get(key)?.filter((id) => id !== nodeId) ?? [];
        if (list.length === 0) this.borders.delete(key);
        else this.borders.set(key, list);
      }
      this.nodes.delete(nodeId);
    }
    for (const poi of tile.pois) this.removeSignal(poi);
    this.tiles.delete(key);
    for (const id of partners) rebuildNodeGroup(this, [id]);
    this.version++;
  }

  /** Add a transport-network document's ways, stations, signals and aerodromes. */
  addDocument(doc: TransportNetworkDocument): void {
    for (const way of doc.ways) {
      const draft = wayDraft(way);
      if (draft !== undefined) this.docDrafts.push(draft);
    }
    this.docPois.push(...documentPois(doc));
    this.docRunways.push(...documentRunways(doc));
    if (doc.sidewalks === true) this.docSidewalks = true;
    this.rebuildDocTile();
  }

  /** Add one polyline (scripts); returns the id of the first edge it produced, if any. */
  addPolyline(line: AmbientPolyline): string | undefined {
    const draft = wayDraft({ ...line, class: line.class });
    if (draft === undefined) return undefined;
    this.docDrafts.push(draft);
    const before = new Set(this.tiles.get(DOC_TILE)?.edges ?? []);
    this.rebuildDocTile();
    return this.tiles.get(DOC_TILE)?.edges.find((id) => !before.has(id));
  }

  private rebuildDocTile(): void {
    if (this.tiles.has(DOC_TILE)) this.unregisterTile(DOC_TILE);
    this.addTile(
      DOC_TILE,
      this.docDrafts.map((d) => ({ ...d, points: d.points.map((p) => [p[0], p[1]] as Point2) })),
      [...this.docPois],
      [...this.docRunways],
      this.ground,
      this.docSidewalks,
      undefined,
    );
  }

  private addTile(
    key: string,
    allDrafts: EdgeDraft[],
    pois: WorldPoi[],
    runwaySegments: { a: Point2; b: Point2 }[],
    heightAt: (x: number, z: number) => number,
    sidewalksWanted: boolean,
    rect: [number, number, number, number] | undefined,
  ): void {
    // Sidewalks and crossings ride on road edges, so walkers need the road graph too.
    const drafts = allDrafts.filter(
      (d) => this.classes.has(d.class) || (d.class === 'road' && this.classes.has('walk')),
    );
    const sidewalks = sidewalksWanted && this.classes.has('walk');
    const split = planarSplit(drafts);
    const record: TileRecord = {
      key,
      nodes: [],
      edges: [],
      pois,
      runways: runwaySegments.map((r) => ({
        tile: key,
        ax: r.a[0],
        az: r.a[1],
        bx: r.b[0],
        bz: r.b[1],
        y: heightAt((r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2),
      })),
      crossings: [],
      degraded: split.degraded,
      ...(rect !== undefined ? { rect } : {}),
    };
    this.tiles.set(key, record);
    for (const poi of pois) this.addSignal(poi);

    // Nodes.
    const nodeIds = split.nodes.map((node) => {
      const base = `${key}@${shortHash(`${node.class}:${q(node.x)},${q(node.z)}`)}`;
      let id = base;
      for (let i = 1; this.nodes.has(id); i++) id = `${base}.${i}`;
      const onBorder =
        rect !== undefined &&
        (dmath.abs(node.x - rect[0]) < 0.01 ||
          dmath.abs(node.x - rect[2]) < 0.01 ||
          dmath.abs(node.z - rect[1]) < 0.01 ||
          dmath.abs(node.z - rect[3]) < 0.01);
      const created: TransportNode = {
        id,
        x: node.x,
        z: node.z,
        layer: node.layer,
        edges: [],
        tile: key,
        border: onBorder,
        class: node.class,
      };
      this.nodes.set(id, created);
      record.nodes.push(id);
      return id;
    });

    // Walk segments for sidewalk inference.
    const walkSegments = sidewalks
      ? segmentIndex(drafts.filter((d) => d.class === 'walk'))
      : undefined;

    // Which nodes carry a grade road (for bridge approach heights).
    const gradeRoad = new Set<number>();
    for (const piece of split.pieces) {
      const draft = drafts[piece.draft] as EdgeDraft;
      if (!draft.bridge && !draft.tunnel) {
        gradeRoad.add(piece.from);
        gradeRoad.add(piece.to);
      }
    }

    // Edges and lanes.
    for (const piece of split.pieces) {
      const draft = drafts[piece.draft] as EdgeDraft;
      const from = nodeIds[piece.from] as string;
      const to = nodeIds[piece.to] as string;
      const dense = densify(piece.points, piece.heights, 8);
      const path = linePath(dense.points);
      if (path.length < 0.05) continue;
      const lift =
        draft.class === 'walk'
          ? draft.kind === 'crossing'
            ? ROAD_SURFACE_LIFT + 0.01
            : PATH_SURFACE_LIFT
          : ROAD_SURFACE_LIFT;
      const ys = new Float64Array(path.points.length);
      if (dense.heights !== undefined) {
        dense.heights.forEach((h, i) => {
          ys[i] = h;
        });
      } else if (draft.bridge) {
        const deck = bridgeDeckHeightFn(path, heightAt, {
          ...(draft.deckElevation !== undefined ? { deckElevation: draft.deckElevation } : {}),
          clearance: draft.class === 'walk' ? 3 : 6,
          approachLift: lift,
          connects: [gradeRoad.has(piece.from), gradeRoad.has(piece.to)],
          ...(draft.bridgeConnections !== undefined
            ? { connections: draft.bridgeConnections }
            : {}),
        });
        path.points.forEach((p, i) => {
          ys[i] = deck(p[0], p[1]);
        });
      } else {
        path.points.forEach((p, i) => {
          ys[i] = heightAt(p[0], p[1]) + lift;
        });
      }
      const first = path.points[0] as Point2;
      const last = path.points[path.points.length - 1] as Point2;
      const base = `${key}#${shortHash(`${draft.class}:${draft.kind}:${q(first[0])},${q(first[1])}:${q(last[0])},${q(last[1])}:${q(path.length)}`)}`;
      let id = base;
      for (let i = 1; this.edges.has(id); i++) id = `${base}.${i}`;
      const edge: TransportEdge = {
        id,
        tile: key,
        class: draft.class,
        kind: draft.kind,
        from,
        to,
        path,
        ys,
        width: draft.width,
        speed: draft.speed ?? KIND_SPEED[draft.kind] * (draft.link ? 0.7 : 1),
        layer: draft.layer,
        bridge: draft.bridge,
        tunnel: draft.tunnel,
        link: draft.link,
        oneway: draft.oneway,
        lanes: [],
        ...(draft.name !== undefined ? { name: draft.name } : {}),
      };
      const inferSidewalks =
        walkSegments !== undefined &&
        draft.class === 'road' &&
        SIDEWALK_KINDS.has(draft.kind) &&
        !draft.tunnel &&
        !nearWalk(walkSegments, path, draft.width / 2 + 4);
      this.createLanes(edge, draft, inferSidewalks);
      this.edges.set(id, edge);
      record.edges.push(id);
      (this.nodes.get(from) as TransportNode).edges.push(id);
      if (to !== from) (this.nodes.get(to) as TransportNode).edges.push(id);
      const counts = { road: 0, rail: 0, walk: 0, air: 0 };
      for (const laneId of edge.lanes) counts[(this.lanes.get(laneId) as TransportLane).class]++;
      this.grid.insert(edge, counts);
    }

    // Stitch border nodes to neighbours.
    const groups = new Set<string>();
    for (const nodeId of record.nodes) {
      const node = this.nodes.get(nodeId) as TransportNode;
      if (node.edges.length === 0) continue;
      if (node.border) this.stitch(node);
      groups.add(node.link !== undefined && node.link < node.id ? node.link : node.id);
    }
    for (const root of [...groups].sort()) {
      const node = this.nodes.get(root);
      if (node === undefined) continue;
      rebuildNodeGroup(this, node.link !== undefined ? [node.id, node.link] : [node.id]);
    }

    this.addStops(record);
    this.addCrossings(record);
    this.version++;
  }

  private createLanes(edge: TransportEdge, draft: EdgeDraft, sidewalks: boolean): void {
    const side = this.traffic === 'right' ? 1 : -1;
    const make = (
      code: string,
      cls: TransportClass,
      dir: 1 | -1,
      index: number,
      offset: number,
      lift = 0,
    ): void => {
      const id = `${edge.id}>${code}`;
      const lane: TransportLane = {
        id,
        edge: edge.id,
        class: cls,
        dir,
        index,
        offset,
        trimStart: 0,
        trimEnd: 0,
        length: edge.path.length,
        lift,
        start: dir === 1 ? edge.from : edge.to,
        end: dir === 1 ? edge.to : edge.from,
        next: [],
        stops: [],
      };
      this.lanes.set(id, lane);
      edge.lanes.push(id);
    };
    if (draft.class === 'road') {
      const total = draft.lanes;
      const width = draft.width / total;
      if (draft.oneway) {
        for (let i = 0; i < total; i++)
          make(`f${i}`, 'road', 1, i, side * (i - (total - 1) / 2) * width);
      } else {
        const forward = dmath.max(1, dmath.ceil(total / 2));
        const backward = dmath.max(1, total - forward);
        const w = draft.width / (forward + backward);
        for (let i = 0; i < forward; i++) make(`f${i}`, 'road', 1, i, side * (i + 0.5) * w);
        for (let i = 0; i < backward; i++) make(`b${i}`, 'road', -1, i, side * (i + 0.5) * w);
      }
      if (sidewalks) {
        const o = draft.width / 2 + 1.1;
        // Two directions on each sidewalk, each keeping to its own right.
        make('sr+', 'walk', 1, 0, o + side * 0.35, SIDEWALK_LIFT);
        make('sr-', 'walk', -1, 0, -(o - side * 0.35), SIDEWALK_LIFT);
        make('sl+', 'walk', 1, 1, -o + side * 0.35, SIDEWALK_LIFT);
        make('sl-', 'walk', -1, 1, o + side * 0.35, SIDEWALK_LIFT);
      }
    } else if (draft.class === 'rail') {
      make('f0', 'rail', 1, 0, 0);
      make('b0', 'rail', -1, 0, 0);
    } else if (draft.class === 'walk') {
      const o = dmath.min(0.45, draft.width / 4) * side;
      make('f0', 'walk', 1, 0, o);
      make('b0', 'walk', -1, 0, o);
    }
  }

  private stitch(node: TransportNode): void {
    const own = borderKey(node);
    const candidates: string[] = [...(this.borders.get(own) ?? [])];
    let best: TransportNode | undefined;
    let bestDistance = 1.01;
    const consider = (ids: readonly string[], limit: number): void => {
      for (const id of ids) {
        const other = this.nodes.get(id);
        if (other === undefined || other.tile === node.tile || other.link !== undefined) continue;
        const d = dmath.hypot(other.x - node.x, other.z - node.z);
        if (
          d < limit &&
          (best === undefined || d < bestDistance || (d === bestDistance && id < best.id))
        ) {
          best = other;
          bestDistance = d;
        }
      }
    };
    consider(candidates, 1.01);
    if (best === undefined) {
      // Second pass: neighbouring keys within 2 m (overzoomed and native tiles disagree slightly).
      bestDistance = 2.01;
      const [cls, layer] = own.split('/');
      const bx = dmath.round(node.x);
      const bz = dmath.round(node.z);
      for (let ox = -2; ox <= 2; ox++)
        for (let oz = -2; oz <= 2; oz++)
          consider(this.borders.get(`${cls}/${layer}/${bx + ox}/${bz + oz}`) ?? [], 2.01);
    }
    const list = this.borders.get(own);
    if (list === undefined) this.borders.set(own, [node.id]);
    else list.push(node.id);
    const partner = best as TransportNode | undefined;
    if (partner !== undefined) {
      node.link = partner.id;
      partner.link = node.id;
    }
  }

  private addSignal(poi: WorldPoi): void {
    if (poi.kind !== 'traffic_signals' && poi.kind !== 'give_way') return;
    const key = `${dmath.floor(poi.x / 64)}/${dmath.floor(poi.z / 64)}`;
    const list = this.signalCells.get(key);
    if (list === undefined) this.signalCells.set(key, [poi]);
    else list.push(poi);
  }

  private removeSignal(poi: WorldPoi): void {
    if (poi.kind !== 'traffic_signals' && poi.kind !== 'give_way') return;
    const key = `${dmath.floor(poi.x / 64)}/${dmath.floor(poi.z / 64)}`;
    const list = this.signalCells.get(key)?.filter((p) => p !== poi) ?? [];
    if (list.length === 0) this.signalCells.delete(key);
    else this.signalCells.set(key, list);
  }

  /** Project stations onto rail lanes and bus stops onto footways. */
  private addStops(record: TileRecord): void {
    const own = new Set(record.edges);
    record.pois.forEach((poi, i) => {
      const wantRail = poi.kind === 'station' || poi.kind === 'tram_stop';
      const wantWalk = poi.kind === 'bus_stop';
      if (!wantRail && !wantWalk) return;
      const reach = wantRail ? 25 : 12;
      let best: { edge: TransportEdge; d: number; distance: number } | undefined;
      for (const edgeId of this.grid.edgesNear(poi.x, poi.z, reach)) {
        if (!own.has(edgeId)) continue;
        const edge = this.edges.get(edgeId) as TransportEdge;
        const hasClass = edge.lanes.some(
          (l) => this.lanes.get(l)?.class === (wantRail ? 'rail' : 'walk'),
        );
        if (!hasClass) continue;
        const hit = projectOnPath(edge.path, poi.x, poi.z);
        if (hit.distance <= reach && (best === undefined || hit.distance < best.distance))
          best = { edge, d: hit.d, distance: hit.distance };
      }
      if (best === undefined) return;
      const stop: LaneStop = {
        d: best.d,
        kind: wantRail ? 'station' : 'bus',
        id: `${record.key}:${poi.kind}:${i}`,
        ...(poi.dwell !== undefined ? { dwell: poi.dwell } : {}),
      };
      for (const laneId of best.edge.lanes) {
        const lane = this.lanes.get(laneId) as TransportLane;
        if (lane.class === (wantRail ? 'rail' : 'walk')) lane.stops.push(stop);
      }
    });
  }

  /** Record where footway crossings and railways cross roads at grade. */
  private addCrossings(record: TileRecord): void {
    const edges = record.edges.map((id) => this.edges.get(id) as TransportEdge);
    const roads = edges.filter((e) => e.class === 'road' && !e.bridge && !e.tunnel);
    const others = edges.filter(
      (e) => (e.kind === 'crossing' || e.class === 'rail') && !e.bridge && !e.tunnel,
    );
    if (roads.length === 0 || others.length === 0) return;
    const roadIndex = segmentIndexOfPaths(roads.map((e) => e.path));
    for (const other of others) {
      const path = other.path;
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1] as Point2;
        const b = path.points[i] as Point2;
        for (const hit of roadIndex.crossing(a, b)) {
          const road = roads[hit.path] as TransportEdge;
          if (road.layer !== other.layer) continue;
          const otherS =
            (path.distances[i - 1] as number) +
            hit.t * ((path.distances[i] as number) - (path.distances[i - 1] as number));
          const id = `${record.key}:x${fnv1a(`${road.id}|${other.id}|${q(hit.roadS)}`).toString(36)}`;
          if (this.crossings.has(id)) continue;
          const kind = other.class === 'rail' ? 'level-crossing' : 'crossing';
          const crossing: TransportCrossing = {
            id,
            tile: record.key,
            kind,
            road: road.id,
            roadS: hit.roadS,
            other: other.id,
            otherS,
          };
          this.crossings.set(id, crossing);
          record.crossings.push(id);
          for (const edgeId of [road.id, other.id]) {
            const list = this.crossingsByEdge.get(edgeId);
            if (list === undefined) this.crossingsByEdge.set(edgeId, [crossing]);
            else list.push(crossing);
          }
          for (const laneId of road.lanes) {
            const lane = this.lanes.get(laneId) as TransportLane;
            if (lane.class === 'road') lane.stops.push({ d: hit.roadS, kind, id });
          }
        }
      }
    }
  }

  // --- queries ---

  /** Sample a lane body at `s` (clamped to the lane). */
  sampleLane(laneId: string, s: number, out: LaneSample = laneSample()): LaneSample | undefined {
    const lane = this.lanes.get(laneId);
    if (lane === undefined) return undefined;
    const edge = this.edges.get(lane.edge);
    if (edge === undefined) return undefined;
    return sampleLaneBody(lane, edge, s, out);
  }

  /** The nearest lane of a class to a point, with the lane coordinate of the closest point. */
  laneAt(
    x: number,
    z: number,
    opts: { class?: TransportClass; radius?: number } = {},
  ): { lane: string; s: number; distance: number } | undefined {
    const radius = opts.radius ?? 20;
    let best: { lane: string; s: number; distance: number } | undefined;
    const sample = laneSample();
    for (const edgeId of this.grid.edgesNear(x, z, radius)) {
      const edge = this.edges.get(edgeId) as TransportEdge;
      const hit = projectOnPath(edge.path, x, z);
      if (hit.distance > radius + edge.width) continue;
      for (const laneId of edge.lanes) {
        const lane = this.lanes.get(laneId) as TransportLane;
        if (opts.class !== undefined && lane.class !== opts.class) continue;
        const s = dmath.clamp(laneCoordinate(lane, edge, hit.d), 0, lane.length);
        sampleLaneBody(lane, edge, s, sample);
        const distance = dmath.hypot(sample.x - x, sample.z - z);
        if (distance <= radius && (best === undefined || distance < best.distance))
          best = { lane: laneId, s, distance };
      }
    }
    return best;
  }

  stats(): TransportNetworkStats {
    const laneKm: Record<TransportClass, number> = { road: 0, rail: 0, walk: 0, air: 0 };
    for (const lane of this.lanes.values()) laneKm[lane.class] += lane.length / 1000;
    let signals = 0;
    for (const junction of this.junctions.values()) if (junction.control === 'signal') signals++;
    let degradedTiles = 0;
    for (const tile of this.tiles.values()) if (tile.degraded) degradedTiles++;
    return {
      tiles: this.tiles.size,
      nodes: this.nodes.size,
      edges: this.edges.size,
      lanes: this.lanes.size,
      junctions: this.junctions.size,
      signals,
      laneKm,
      degradedTiles,
    };
  }

  /** Drop everything. */
  clear(): void {
    for (const key of [...this.tiles.keys()]) this.unregisterTile(key);
    this.docDrafts.length = 0;
    this.docPois.length = 0;
    this.docRunways.length = 0;
    this.docSidewalks = false;
    this.grid.clear();
    this.version++;
  }

  /** Every edge, for export (`networkToDocument`). */
  edgeList(): IterableIterator<TransportEdge> {
    return this.edges.values();
  }
}

function q(value: number): number {
  return dmath.round(value * 10);
}

function borderKey(node: TransportNode): string {
  return `${node.class}/${node.layer}/${dmath.round(node.x)}/${dmath.round(node.z)}`;
}

function linePath(points: Point2[]): TerrainLinePath {
  const distances = cumulative(points);
  return { points, distances, length: distances[distances.length - 1] as number };
}

/** Insert vertices so no segment exceeds `spacing` (heights interpolate along). */
function densify(
  points: readonly Point2[],
  heights: readonly number[] | undefined,
  spacing: number,
): { points: Point2[]; heights?: number[] } {
  const out: Point2[] = [[...(points[0] as Point2)] as Point2];
  const hs: number[] | undefined = heights !== undefined ? [heights[0] as number] : undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point2;
    const b = points[i] as Point2;
    const length = dmath.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-4) continue;
    const steps = dmath.max(1, dmath.ceil(length / spacing));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      out.push(k === steps ? [b[0], b[1]] : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (hs !== undefined && heights !== undefined) {
        const h0 = heights[i - 1] as number;
        const h1 = heights[i] as number;
        hs.push(h0 + (h1 - h0) * t);
      }
    }
  }
  return hs !== undefined ? { points: out, heights: hs } : { points: out };
}

/** Closest point on a path: its path distance and the planar distance to it. */
export function projectOnPath(
  path: TerrainLinePath,
  x: number,
  z: number,
): { d: number; distance: number } {
  let bestD = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1] as Point2;
    const b = path.points[i] as Point2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? dmath.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / len2, 0, 1) : 0;
    const px = a[0] + dx * t;
    const pz = a[1] + dz * t;
    const distance = dmath.hypot(px - x, pz - z);
    if (distance < best) {
      best = distance;
      bestD =
        (path.distances[i - 1] as number) +
        t * ((path.distances[i] as number) - (path.distances[i - 1] as number));
    }
  }
  return { d: bestD, distance: best };
}

interface SegmentRef {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

function segmentIndex(drafts: readonly EdgeDraft[]): Map<string, SegmentRef[]> {
  const cells = new Map<string, SegmentRef[]>();
  for (const draft of drafts)
    for (let i = 1; i < draft.points.length; i++) {
      const a = draft.points[i - 1] as Point2;
      const b = draft.points[i] as Point2;
      const seg = { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
      const x0 = dmath.floor(dmath.min(a[0], b[0]) / 32);
      const x1 = dmath.floor(dmath.max(a[0], b[0]) / 32);
      const z0 = dmath.floor(dmath.min(a[1], b[1]) / 32);
      const z1 = dmath.floor(dmath.max(a[1], b[1]) / 32);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = `${x}/${z}`;
          const list = cells.get(key);
          if (list === undefined) cells.set(key, [seg]);
          else list.push(seg);
        }
    }
  return cells;
}

/** Whether any walk segment lies within `reach` of the path at 25/50/75 %. */
function nearWalk(cells: Map<string, SegmentRef[]>, path: TerrainLinePath, reach: number): boolean {
  for (const fraction of [0.25, 0.5, 0.75]) {
    const target = path.length * fraction;
    let i = 1;
    while (i < path.distances.length - 1 && (path.distances[i] as number) < target) i++;
    const a = path.points[i - 1] as Point2;
    const b = path.points[i] as Point2;
    const d0 = path.distances[i - 1] as number;
    const d1 = path.distances[i] as number;
    const t = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const cx = dmath.floor(x / 32);
    const cz = dmath.floor(z / 32);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const seg of cells.get(`${cx + ox}/${cz + oz}`) ?? []) {
          const dx = seg.bx - seg.ax;
          const dz = seg.bz - seg.az;
          const len2 = dx * dx + dz * dz;
          const u =
            len2 > 0 ? dmath.clamp(((x - seg.ax) * dx + (z - seg.az) * dz) / len2, 0, 1) : 0;
          if (dmath.hypot(seg.ax + dx * u - x, seg.az + dz * u - z) <= reach) return true;
        }
  }
  return false;
}

/** Segment grid over several paths for crossing detection. */
function segmentIndexOfPaths(paths: readonly TerrainLinePath[]): {
  crossing(a: Point2, b: Point2): { path: number; roadS: number; t: number }[];
} {
  const cells = new Map<string, { path: number; i: number }[]>();
  paths.forEach((path, p) => {
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1] as Point2;
      const b = path.points[i] as Point2;
      const x0 = dmath.floor(dmath.min(a[0], b[0]) / 32);
      const x1 = dmath.floor(dmath.max(a[0], b[0]) / 32);
      const z0 = dmath.floor(dmath.min(a[1], b[1]) / 32);
      const z1 = dmath.floor(dmath.max(a[1], b[1]) / 32);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = `${x}/${z}`;
          const list = cells.get(key);
          if (list === undefined) cells.set(key, [{ path: p, i }]);
          else list.push({ path: p, i });
        }
    }
  });
  return {
    crossing(a, b) {
      const out: { path: number; roadS: number; t: number }[] = [];
      const seen = new Set<string>();
      const x0 = dmath.floor(dmath.min(a[0], b[0]) / 32);
      const x1 = dmath.floor(dmath.max(a[0], b[0]) / 32);
      const z0 = dmath.floor(dmath.min(a[1], b[1]) / 32);
      const z1 = dmath.floor(dmath.max(a[1], b[1]) / 32);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++)
          for (const ref of cells.get(`${x}/${z}`) ?? []) {
            const key = `${ref.path}:${ref.i}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const path = paths[ref.path] as TerrainLinePath;
            const c = path.points[ref.i - 1] as Point2;
            const d = path.points[ref.i] as Point2;
            const rx = b[0] - a[0];
            const rz = b[1] - a[1];
            const sx = d[0] - c[0];
            const sz = d[1] - c[1];
            const denom = rx * sz - rz * sx;
            if (dmath.abs(denom) < 1e-12) continue;
            const wx = c[0] - a[0];
            const wz = c[1] - a[1];
            const t = (wx * sz - wz * sx) / denom;
            const u = (wx * rz - wz * rx) / denom;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const s0 = path.distances[ref.i - 1] as number;
            const s1 = path.distances[ref.i] as number;
            out.push({ path: ref.path, roadS: s0 + u * (s1 - s0), t });
          }
      return out;
    },
  };
}
