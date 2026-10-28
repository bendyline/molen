/**
 * Semantic tiles as they cross between threads. A decoded town tile is up to 100k small point
 * arrays, and structured cloning them one by one held the main thread 30-80 ms each way: once
 * as a decoder worker's reply, and again for every worker the tile went on to (surfaces, land
 * cover, worldgen). A packet carries the points in one Float64Array and the rest as JSON text.
 */
import type { TerrainPyramidTileAddress } from './pyramid-types';
import { overzoomTerrainSemanticTile } from './semantic-overzoom';
import {
  markTerrainSemanticTileChecked,
  setTerrainSemanticTileContentHash,
  type TerrainBuildingFeature,
  type TerrainLandcoverFeature,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  terrainSemanticTileChecked,
  terrainSemanticTileContentHash,
} from './semantic-types';

/** A tile packed by packTerrainSemanticTile: the skeleton as JSON (or, failing that, as an
 * object) and every line's points in `points`. */
export interface TerrainSemanticTilePacket {
  json?: string;
  tile?: unknown;
  points: Float64Array;
  /** A tile composed with another's land cover (see composeTerrainSemanticTile). */
  landcover?: TerrainSemanticTilePacket;
  /** ...and its POIs too, where the tile has none. */
  landcoverPois?: boolean;
  /** Collections a derived tile replaced, applied in order (see deriveTerrainSemanticTilePacket). */
  edits?: readonly TerrainSemanticTileEdit[];
  /**
   * The packed tile is an ancestor's, re-expressed for a descendant on unpacking (see
   * overzoomTerrainSemanticTile), before any land cover or edits.
   */
  overzoom?: {
    from: TerrainPyramidTileAddress;
    to: TerrainPyramidTileAddress;
    buffer?: number;
  };
}

/**
 * A derived tile's replacement for a collection: each entry the feature at that index of the
 * collection as it stood, or a new feature (cloned with the message).
 */
export interface TerrainSemanticTileEdit {
  buildings?: readonly (number | TerrainBuildingFeature)[];
  transportation?: readonly (number | TerrainTransportationFeature)[];
  landcover?: readonly (number | TerrainLandcoverFeature)[];
}

const EDITABLE = ['buildings', 'transportation', 'landcover'] as const;

/** Marks a line moved into a packed tile's point buffer: `n` points from point `at`. */
const LINE = '~line';
interface PackedLine {
  [LINE]: number;
  n: number;
}
/**
 * An object or line the tile holds in more than one place (two features sharing a polygon list):
 * its first appearance defines it, `{ '~def': k, v }`, and later ones refer back, `{ '~ref': k }`,
 * so the receiver gets one object again, as a structured clone would give it. Points inside a
 * line are not tracked.
 */
const DEF = '~def';
const REF = '~ref';
/**
 * A number JSON would lose (NaN, an infinity, -0), as `{ '~num': String(value) }`. Without it one
 * such number (a place at -0) sent the whole tile as an object, without a packet or a content
 * hash: cloned whole to every worker and serialized whole for cache keys.
 */
const NUM = '~num';

function isLine(value: readonly unknown[]): boolean {
  if (value.length === 0) return false;
  for (const point of value)
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number'
    )
      return false;
  return true;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * A copy of `tile` whose lines (arrays of [u, v] points) are moved into one Float64Array; the
 * rest goes as JSON (numbers JSON would lose marked, see NUM) unless an undefined array entry or
 * a non-plain object would not survive it, else as an object. A browser parses JSON several times
 * faster than it deserializes the same objects from a structured clone.
 * unpackTerrainSemanticTile rebuilds every point and number exactly.
 */
export function packTerrainSemanticTile(tile: TerrainSemanticTile): TerrainSemanticTilePacket {
  // Which objects and lines appear more than once (see DEF).
  const seen = new Set<object>();
  const shared = new Map<object, number>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) {
      if (!shared.has(value)) shared.set(value, -1);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      if (!isLine(value)) for (const entry of value) visit(entry);
    } else if (isPlainObject(value)) for (const entry of Object.values(value)) visit(entry);
  };
  visit(tile);
  let definitions = 0;
  const values: number[] = [];
  let jsonSafe = true;
  const packValue = (value: object): unknown => {
    if (Array.isArray(value)) {
      if (isLine(value)) {
        const line: PackedLine = { [LINE]: values.length / 2, n: value.length };
        for (const point of value as [number, number][]) values.push(point[0], point[1]);
        return line;
      }
      return value.map(pack);
    }
    if (!isPlainObject(value)) {
      jsonSafe = false;
      return value;
    }
    const copy: Record<string, unknown> = {};
    // An absent optional property is the same with or without its undefined key.
    for (const [key, entry] of Object.entries(value))
      if (entry !== undefined) copy[key] = pack(entry);
    return copy;
  };
  const pack = (value: unknown): unknown => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Object.is(value, -0))
        return { [NUM]: Object.is(value, -0) ? '-0' : String(value) };
      return value;
    }
    if (value === undefined) jsonSafe = false;
    if (value === null || typeof value !== 'object') return value;
    const id = shared.get(value);
    if (id === undefined) return packValue(value);
    if (id >= 0) return { [REF]: id };
    const k = definitions++;
    shared.set(value, k);
    return { [DEF]: k, v: packValue(value) };
  };
  const packed = pack(tile);
  const points = Float64Array.from(values);
  return jsonSafe ? { json: JSON.stringify(packed), points } : { tile: packed, points };
}

/** Rebuild a packed tile in place (it is the receiver's own copy). */
export function unpackTerrainSemanticTile(
  packed: unknown,
  points: Float64Array,
): TerrainSemanticTile {
  const defined: unknown[] = [];
  const unpack = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = unpack(value[i]);
      return value;
    }
    if (!isPlainObject(value)) return value;
    const record = value as Record<string, unknown>;
    if (typeof record[NUM] === 'string') return Number(record[NUM]);
    // Definitions come before their references in packing order, which unpacking follows.
    if (typeof record[REF] === 'number') return defined[record[REF] as number];
    if (typeof record[DEF] === 'number') {
      const object = unpack(record.v);
      defined[record[DEF] as number] = object;
      return object;
    }
    const at = record[LINE];
    if (typeof at === 'number') {
      const n = record.n as number;
      const line: [number, number][] = new Array(n);
      for (let i = 0; i < n; i++)
        line[i] = [points[(at + i) * 2] as number, points[(at + i) * 2 + 1] as number];
      return line;
    }
    for (const key of Object.keys(record)) record[key] = unpack(record[key]);
    return record;
  };
  return unpack(packed) as TerrainSemanticTile;
}

const packets = new WeakMap<TerrainSemanticTile, TerrainSemanticTilePacket>();

/**
 * The packet `tile` arrived as from a decoder worker, to post on to other workers as is (without
 * transferring `points`: it is reused). Undefined for a tile made on this thread: post the tile
 * itself, as packing it here would cost more than the structured clone it saves.
 */
export function terrainSemanticTilePacket(
  tile: TerrainSemanticTile,
): TerrainSemanticTilePacket | undefined {
  return packets.get(tile);
}

/** Internal: keep the packet a tile arrived as (see terrainSemanticTilePacket). */
export function rememberTerrainSemanticTilePacket(
  tile: TerrainSemanticTile,
  packet: TerrainSemanticTilePacket,
): void {
  packets.set(tile, packet);
}

/** The tile a received packet carries. The packet must be the receiver's own copy. */
export function terrainSemanticTileFromPacket(
  packet: TerrainSemanticTilePacket,
): TerrainSemanticTile {
  const skeleton = packet.json !== undefined ? JSON.parse(packet.json) : packet.tile;
  let tile = unpackTerrainSemanticTile(skeleton, packet.points);
  if (packet.overzoom !== undefined) {
    const { from, to, buffer } = packet.overzoom;
    tile = overzoomTerrainSemanticTile(tile, from, to, buffer === undefined ? {} : { buffer });
  }
  if (packet.landcover !== undefined) {
    const land = terrainSemanticTileFromPacket(packet.landcover);
    tile.landcover = land.landcover;
    if (packet.landcoverPois && tile.pois === undefined && land.pois !== undefined)
      tile.pois = land.pois;
  }
  for (const edit of packet.edits ?? []) {
    const buildings = edit.buildings;
    if (buildings !== undefined) {
      const from = tile.buildings;
      tile.buildings = buildings.map((entry) =>
        typeof entry === 'number' ? (from[entry] as TerrainBuildingFeature) : entry,
      );
    }
    const transportation = edit.transportation;
    if (transportation !== undefined) {
      const from = tile.transportation;
      tile.transportation = transportation.map((entry) =>
        typeof entry === 'number' ? (from[entry] as TerrainTransportationFeature) : entry,
      );
    }
    const landcover = edit.landcover;
    if (landcover !== undefined) {
      const from = tile.landcover;
      tile.landcover = landcover.map((entry) =>
        typeof entry === 'number' ? (from[entry] as TerrainLandcoverFeature) : entry,
      );
    }
  }
  return tile;
}

/** Whether a packet decodes afresh each time: its skeleton, and any it derives from, is JSON text. */
function redecodable(packet: TerrainSemanticTilePacket): boolean {
  return (
    packet.json !== undefined && (packet.landcover === undefined || redecodable(packet.landcover))
  );
}

/**
 * A tile to come back to later, kept as the packet it arrived as when it can be decoded again
 * from it (see terrainSemanticTilePacket): the returned call answers the tile while it lives,
 * else decodes it afresh, with its packet, content hash and check. A layer keeping every
 * displayed tile whole for a rebuild that seldom comes kept every point of them on the heap
 * that each collection walks. Other tiles are kept as they are.
 */
export function keepTerrainSemanticTile(tile: TerrainSemanticTile): () => TerrainSemanticTile {
  const packet = packets.get(tile);
  // Each call made in a function of its own: closures share their function's scope, and one
  // holding the tile would keep it for the other too.
  if (packet === undefined || !redecodable(packet)) return keptWhole(tile);
  return keptAsPacket(
    packet,
    new WeakRef(tile),
    terrainSemanticTileContentHash(tile),
    terrainSemanticTileChecked(tile),
  );
}

function keptWhole(tile: TerrainSemanticTile): () => TerrainSemanticTile {
  return () => tile;
}

function keptAsPacket(
  packet: TerrainSemanticTilePacket,
  first: WeakRef<TerrainSemanticTile>,
  hash: string | undefined,
  checked: boolean,
): () => TerrainSemanticTile {
  let kept = first;
  return () => {
    let current = kept.deref();
    if (current === undefined) {
      current = terrainSemanticTileFromPacket(packet);
      packets.set(current, packet);
      if (hash !== undefined) setTerrainSemanticTileContentHash(current, hash);
      if (checked) markTerrainSemanticTileChecked(current);
      kept = new WeakRef(current);
    }
    return current;
  };
}

/**
 * Remember a packet and content hash for `tile`, overzoomed from `ancestor` (see
 * overzoomTerrainSemanticTile): the ancestor's, with the overzoom to apply. A tile finer than its
 * source was otherwise cloned whole to each worker and serialized whole for cache keys.
 */
export function deriveOverzoomTerrainSemanticTilePacket(
  ancestor: TerrainSemanticTile,
  tile: TerrainSemanticTile,
  from: TerrainPyramidTileAddress,
  to: TerrainPyramidTileAddress,
  buffer?: number,
): void {
  if (tile === ancestor) return;
  const packet = packets.get(ancestor);
  if (
    packet !== undefined &&
    packet.overzoom === undefined &&
    packet.landcover === undefined &&
    packet.edits === undefined &&
    !packets.has(tile)
  )
    packets.set(tile, {
      ...packet,
      overzoom: {
        from: { level: from.level, x: from.x, z: from.z },
        to: { level: to.level, x: to.x, z: to.z },
        ...(buffer !== undefined ? { buffer } : {}),
      },
    });
  const hash = terrainSemanticTileContentHash(ancestor);
  if (hash !== undefined && terrainSemanticTileContentHash(tile) === undefined)
    setTerrainSemanticTileContentHash(
      tile,
      `${hash}|overzoom:${from.level}/${from.x}/${from.z}>${to.level}/${to.x}/${to.z}:${buffer ?? ''}`,
    );
}

/** A feature's own arrays and objects, and one level within them (lines, polygons, rings). */
function* featureParts(feature: object): Generator<object> {
  for (const value of Object.values(feature)) {
    if (value === null || typeof value !== 'object') continue;
    yield value;
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item === null || typeof item !== 'object') continue;
      yield item;
      if (Array.isArray(item)) continue;
      const { outer, holes } = item as { outer?: unknown; holes?: unknown };
      if (Array.isArray(outer)) yield outer;
      if (Array.isArray(holes)) {
        yield holes;
        for (const hole of holes) if (Array.isArray(hole)) yield hole;
      }
    }
  }
}

/**
 * Remember a packet for `derived`, made from `base` by replacing its buildings, transportation or
 * land cover while keeping most features as they are: `base`'s packet and the edit. A
 * footprint-filtered or road-replaced town tile then crosses to a worker without being cloned
 * whole, 7-10 ms of main thread each time. Nothing is remembered when `base` has no packet, when
 * anything else differs, or when a new feature shares a line, ring or object with a kept one: a
 * clone keeps that sharing and an edit would not.
 */
export function deriveTerrainSemanticTilePacket(
  base: TerrainSemanticTile,
  derived: TerrainSemanticTile,
): void {
  if (derived === base || packets.has(derived)) return;
  const packet = packets.get(base);
  if (packet === undefined) return;
  const before = base as unknown as Record<string, unknown>;
  const after = derived as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!(EDITABLE as readonly string[]).includes(key) && before[key] !== after[key]) return;
  const edit: { -readonly [K in keyof TerrainSemanticTileEdit]: TerrainSemanticTileEdit[K] } = {};
  const kept: object[] = [];
  const fresh = new Set<object>();
  for (const key of EDITABLE) {
    const from = base[key] as readonly object[];
    const to = derived[key] as readonly object[];
    if (from === to) continue;
    const index = new Map<object, number>();
    for (const [i, feature] of from.entries()) index.set(feature, i);
    const entries = to.map((feature) => {
      const at = index.get(feature);
      if (at !== undefined) kept.push(feature);
      else for (const part of featureParts(feature)) fresh.add(part);
      return at ?? feature;
    });
    (edit as Record<string, unknown>)[key] = entries;
  }
  if (fresh.size > 0)
    for (const feature of kept)
      for (const part of featureParts(feature)) if (fresh.has(part)) return;
  packets.set(
    derived,
    Object.keys(edit).length === 0 ? packet : { ...packet, edits: [...(packet.edits ?? []), edit] },
  );
}

/**
 * `features` with `land`'s land cover (and, with `pois`, its POIs where `features` has none), as
 * a package joins a land-use sidecar to its feature tiles. The decoded parts' packet, content
 * hash and check carry over, so the joined tile still crosses threads and keys caches cheaply.
 */
export function composeTerrainSemanticTile(
  features: TerrainSemanticTile,
  land: TerrainSemanticTile,
  options: { pois?: boolean } = {},
): TerrainSemanticTile {
  const tile: TerrainSemanticTile = {
    ...features,
    landcover: land.landcover,
    ...(options.pois && features.pois === undefined && land.pois !== undefined
      ? { pois: land.pois }
      : {}),
  };
  const base = packets.get(features);
  const cover = packets.get(land);
  if (base !== undefined && cover !== undefined && base.landcover === undefined)
    packets.set(tile, {
      ...base,
      landcover: cover,
      ...(options.pois ? { landcoverPois: true } : {}),
    });
  const a = terrainSemanticTileContentHash(features);
  const b = terrainSemanticTileContentHash(land);
  if (a !== undefined && b !== undefined)
    setTerrainSemanticTileContentHash(tile, `${a}|landcover:${b}${options.pois ? '|pois' : ''}`);
  if (terrainSemanticTileChecked(features) && terrainSemanticTileChecked(land))
    markTerrainSemanticTileChecked(tile);
  return tile;
}
