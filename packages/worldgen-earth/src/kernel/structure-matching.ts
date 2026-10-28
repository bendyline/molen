/** Conservative map-to-model matching. Geographic identity and reusable categories are separate. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  pointInPolygon,
  type TerrainBuildingFeature,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import type { TileGeometry } from './semantic-adapter';
import type { StructureMapRule, StructurePlacement } from './structure-index';
import { analyzeTileEdge, PROTOMAPS_TILE_BUFFER } from './tile-edges';

type Feature = TerrainBuildingFeature | TerrainPoiFeature;
type Frame = { point: TerrainSemanticPoint; heading?: number; width?: number; depth?: number };

function normalized(value: string): string {
  return value.trim().toLowerCase();
}
/** Features by identity (wikidata, normalized name), each list in the tile's own order. */
interface IdentityIndex<T> {
  wikidata: Map<string, T[]>;
  names: Map<string, { feature: T; order: number }[]>;
}

function identityIndex<T extends { wikidata?: string; name?: string }>(
  features: readonly T[],
): IdentityIndex<T> {
  const index: IdentityIndex<T> = { wikidata: new Map(), names: new Map() };
  features.forEach((feature, order) => {
    if (feature.wikidata !== undefined) {
      const list = index.wikidata.get(feature.wikidata);
      if (list) list.push(feature);
      else index.wikidata.set(feature.wikidata, [feature]);
    }
    const name = normalized(feature.name ?? '');
    const list = index.names.get(name);
    if (list) list.push({ feature, order });
    else index.names.set(name, [{ feature, order }]);
  });
  return index;
}

/** The features an identity names (see orientMappedStructure's `exact`), in the tile's order. */
function identified<T>(
  index: IdentityIndex<T>,
  identity: { wikidata?: string; names?: readonly string[] },
): readonly T[] {
  if (identity.wikidata !== undefined) return index.wikidata.get(identity.wikidata) ?? [];
  const names = new Set((identity.names ?? []).map(normalized));
  const found = [...names].flatMap((name) => index.names.get(name) ?? []);
  if (names.size > 1) found.sort((a, b) => a.order - b.order);
  return found.map((entry) => entry.feature);
}

/** A tile's mapped features and bridges by identity. */
interface TileIdentities {
  features: IdentityIndex<Feature>;
  bridges: IdentityIndex<TerrainTransportationFeature>;
}

function tileIdentities(tile: TerrainSemanticTile): TileIdentities {
  return {
    features: identityIndex<Feature>([
      ...(tile.buildingsGeneralized ? [] : tile.buildings),
      ...(tile.pois ?? []),
    ]),
    bridges: identityIndex(tile.transportation.filter((road) => road.bridge && !road.tunnel)),
  };
}

/**
 * orientMappedStructure for each entry, indexing the tile's identities once. Each mapped
 * structure near a tile looked itself up by scanning, and name-normalizing, all of the tile's
 * buildings, places and roads: a dense city's tile held the main thread 18 ms.
 */
export function orientMappedStructures(
  entries: readonly StructurePlacement[],
  tile: TerrainSemanticTile,
  geometry: TileGeometry,
): StructurePlacement[] {
  let identities: TileIdentities | undefined;
  return entries.flatMap((entry) => {
    if (entry.orientation === 'mapped') identities ??= tileIdentities(tile);
    const resolved = orientMappedStructure(entry, tile, geometry, identities);
    return resolved ? [resolved] : [];
  });
}

function owned(point: TerrainSemanticPoint): boolean {
  return point[0] >= 0 && point[0] < 1 && point[1] >= 0 && point[1] < 1;
}

/** Canonical +X axis follows the longest edge; rotation sign matches Three's +Y convention. */
function frameFor(feature: Feature, size: number, lengthAxis: 'x' | 'z' = 'x'): Frame | undefined {
  if ('point' in feature) return { point: feature.point, heading: feature.heading };
  const polygon = [...feature.polygons].sort((a, b) => area(b.outer) - area(a.outer))[0];
  if (!polygon) return undefined;
  // Truncated geometry cannot establish the center or axis of a whole model. Keep the
  // existing procedural pieces until a tile supplies the complete owned footprint.
  if (analyzeTileEdge(polygon, PROTOMAPS_TILE_BUFFER).mode !== 'whole') return undefined;
  const points = polygon.outer;
  let longest = 0,
    heading: number | undefined;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = dx * dx + dz * dz;
    if (length <= longest) continue;
    longest = length;
    // Opposite edges describe the same undirected axis. Canonicalize for tile-order stability.
    heading = -dmath.atan2(dz, dx) + (lengthAxis === 'z' ? Math.PI / 2 : 0);
    heading = ((heading % Math.PI) + Math.PI) % Math.PI;
  }
  if (heading === undefined) return undefined;
  heading = feature.heading ?? heading;
  const c = dmath.cos(heading),
    s = dmath.sin(heading);
  const local = points.map(([x, z]) => [c * x - s * z, s * x + c * z]);
  const minX = Math.min(...local.map((p) => p[0] ?? 0)),
    maxX = Math.max(...local.map((p) => p[0] ?? 0));
  const minZ = Math.min(...local.map((p) => p[1] ?? 0)),
    maxZ = Math.max(...local.map((p) => p[1] ?? 0));
  const x = (minX + maxX) / 2,
    z = (minZ + maxZ) / 2;
  const point: TerrainSemanticPoint = [c * x + s * z, -s * x + c * z];
  // Never place a whole replacement in the void of a U-shaped building or courtyard.
  if (!pointInPolygon(point, polygon)) return undefined;
  return { point, heading, width: (maxX - minX) * size, depth: (maxZ - minZ) * size };
}

function area(points: TerrainSemanticPoint[]): number {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (a && b) result += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(result);
}

function anchorFor(point: TerrainSemanticPoint, geometry: TileGeometry): [number, number] {
  return worldToWgs84(
    geometry.metersPerUnit,
    geometry.originX + point[0] * geometry.size,
    geometry.originZ + point[1] * geometry.size,
  );
}

/** A rule's match, normalized once: each field's alternatives as a set. */
interface RuleMatch {
  names?: Set<string>;
  classes?: Set<string>;
  subclasses?: Set<string>;
  tags: (readonly [string, Set<string>])[];
}

const ruleMatches = new WeakMap<StructureMapRule, RuleMatch>();

function ruleMatch(rule: StructureMapRule): RuleMatch {
  let match = ruleMatches.get(rule);
  if (match === undefined) {
    const { classes, subclasses, tags, names } = rule.match;
    const set = (values: readonly string[] | undefined) =>
      values === undefined ? undefined : new Set(values.map(normalized));
    match = {
      ...(names ? { names: set(names) } : {}),
      ...(classes ? { classes: set(classes) } : {}),
      ...(subclasses ? { subclasses: set(subclasses) } : {}),
      tags: Object.entries(tags ?? {}).map(([key, values]) => [
        key,
        new Set(values.map(normalized)),
      ]),
    };
    ruleMatches.set(rule, match);
  }
  return match;
}

/** A feature's labels, normalized once for every rule it is tried against. */
class FeatureLabels {
  readonly name: string;
  readonly class: string;
  readonly subclass: string;
  private readonly tags = new Map<string, string>();
  constructor(private readonly feature: Feature) {
    this.name = normalized(feature.name ?? '');
    this.class = normalized(feature.class ?? '');
    this.subclass = normalized(feature.subclass ?? '');
  }
  tag(key: string): string {
    let value = this.tags.get(key);
    if (value === undefined) {
      value = normalized(this.feature.tags?.[key] ?? '');
      this.tags.set(key, value);
    }
    return value;
  }
}

/**
 * Whether a feature satisfies every field of a rule's match. Each feature was normalized again
 * for every rule (and each rule's values for every feature): a dense tile against a category
 * catalog held the main thread up to 15 ms.
 */
function matches(labels: FeatureLabels, rule: StructureMapRule): boolean {
  const { names, classes, subclasses, tags } = ruleMatch(rule);
  if (names && !names.has(labels.name)) return false;
  if (classes && !classes.has(labels.class)) return false;
  if (subclasses && !subclasses.has(labels.subclass)) return false;
  return tags.every(([key, values]) => values.has(labels.tag(key)));
}

/**
 * Rules by one field each must match (its subclasses, else classes, names or first tag), so a
 * feature is tried only against rules that could match it. Trying every rule on every building of
 * a dense tile still held a frame 6 ms.
 */
interface RuleIndex {
  /** Rule positions by `s:subclass`, `c:class`, `n:name` or `t:key=value`. */
  keys: Map<string, number[]>;
  /** Rules that match on nothing but other fields: tried on every feature. */
  always: number[];
  /** The tag keys rules are indexed under. */
  tags: string[];
}

const ruleIndexes = new WeakMap<readonly StructureMapRule[], RuleIndex>();

function ruleIndex(rules: readonly StructureMapRule[]): RuleIndex {
  let index = ruleIndexes.get(rules);
  if (index !== undefined) return index;
  const keys = new Map<string, number[]>(),
    always: number[] = [],
    tags = new Set<string>();
  const add = (key: string, position: number): void => {
    const list = keys.get(key);
    if (list === undefined) keys.set(key, [position]);
    else list.push(position);
  };
  rules.forEach((rule, position) => {
    const { names, classes, subclasses, tags: tagged } = ruleMatch(rule);
    const [tag] = tagged;
    if (subclasses) for (const value of subclasses) add(`s:${value}`, position);
    else if (classes) for (const value of classes) add(`c:${value}`, position);
    else if (names) for (const value of names) add(`n:${value}`, position);
    else if (tag) {
      tags.add(tag[0]);
      for (const value of tag[1]) add(`t:${tag[0]}=${value}`, position);
    } else always.push(position);
  });
  index = { keys, always, tags: [...tags] };
  ruleIndexes.set(rules, index);
  return index;
}

/** The positions of the rules that could match a feature, in rule order. */
function candidateRules(index: RuleIndex, labels: FeatureLabels): number[] {
  const found = [...index.always];
  const take = (key: string): void => {
    const list = index.keys.get(key);
    if (list !== undefined) found.push(...list);
  };
  take(`s:${labels.subclass}`);
  take(`c:${labels.class}`);
  take(`n:${labels.name}`);
  for (const key of index.tags) take(`t:${key}=${labels.tag(key)}`);
  // Each rule is indexed under one field, and a feature has one value of each: no repeats.
  return found.sort((a, b) => a - b);
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

/** Resolve a named landmark only against its explicit identity, never category similarity. */
export function orientMappedStructure(
  entry: StructurePlacement,
  tile: TerrainSemanticTile,
  geometry: TileGeometry,
  identities?: TileIdentities,
): StructurePlacement | undefined {
  if (entry.orientation !== 'mapped') return entry;
  const identity = entry.mapIdentity;
  if (!identity) return undefined;
  const [projectedX, z] = wgs84ToWorld(geometry.metersPerUnit, ...entry.anchor);
  const worldWidth = 2 * Math.PI * 6378137 * geometry.metersPerUnit;
  const x =
    projectedX +
    Math.round((geometry.originX + geometry.size / 2 - projectedX) / worldWidth) * worldWidth;
  const origin: TerrainSemanticPoint = [
    (x - geometry.originX) / geometry.size,
    (z - geometry.originZ) / geometry.size,
  ];
  const maxDistance = identity.maxDistance ?? 150;
  const indexes = identities ?? tileIdentities(tile);
  const candidates: Array<{ frame: Frame; distance: number; road?: boolean }> = [];
  for (const feature of identified(indexes.features, identity)) {
    const frame = frameFor(feature, geometry.size, entry.lengthAxis);
    if (!frame || frame.heading === undefined || !owned(frame.point)) continue;
    const distance =
      Math.hypot(frame.point[0] - origin[0], frame.point[1] - origin[1]) * geometry.size;
    if (distance <= maxDistance) candidates.push({ frame, distance });
  }
  for (const road of identified(indexes.bridges, identity)) {
    for (const line of road.lines)
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i];
        if (!a || !b) continue;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          squared = dx * dx + dz * dz;
        if (squared === 0) continue;
        const t = Math.max(
          0,
          Math.min(1, ((origin[0] - a[0]) * dx + (origin[1] - a[1]) * dz) / squared),
        );
        const distance =
          Math.hypot(origin[0] - a[0] - dx * t, origin[1] - a[1] - dz * t) * geometry.size;
        if (distance <= maxDistance)
          candidates.push({
            distance,
            road: true,
            frame: {
              point: origin,
              heading: -dmath.atan2(dz, dx) + (entry.lengthAxis === 'z' ? Math.PI / 2 : 0),
            },
          });
      }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const match = candidates[0];
  if (!match) return undefined;
  if (
    !identity.wikidata &&
    candidates.some(
      (other) =>
        !other.road &&
        !match.road &&
        Math.hypot(
          other.frame.point[0] - match.frame.point[0],
          other.frame.point[1] - match.frame.point[1],
        ) *
          geometry.size >
          10,
    )
  )
    return undefined;
  return {
    ...entry,
    heading: match.frame.heading,
    ...(match.road ? {} : { anchor: anchorFor(match.frame.point, geometry) }),
  };
}

/** Emit at most 64 category structures per resident tile. Rule order defines preference. */
export function matchMapStructures(
  tile: TerrainSemanticTile,
  geometry: TileGeometry,
  rules: readonly StructureMapRule[],
  geographic: readonly StructurePlacement[] = [],
  maxPerTile = 64,
): StructurePlacement[] {
  const result: StructurePlacement[] = [];
  const counts = new Map<string, number>();
  const occupied = geographic.map((entry) => wgs84ToWorld(geometry.metersPerUnit, ...entry.anchor));
  const features: Feature[] = [
    ...(tile.buildingsGeneralized ? [] : tile.buildings),
    ...(tile.pois ?? []),
  ];
  if (rules.length === 0) return result;
  const index = ruleIndex(rules);
  for (const feature of features) {
    if (result.length >= Math.max(0, Math.min(64, maxPerTile))) break;
    const labels = new FeatureLabels(feature);
    for (const position of candidateRules(index, labels)) {
      const rule = rules[position] as StructureMapRule;
      if (
        geometry.level < (rule.minLevel ?? 14) ||
        (counts.get(rule.id) ?? 0) >= (rule.maxPerTile ?? 16)
      )
        continue;
      if (!matches(labels, rule)) continue;
      // An explicitly typed point can identify an otherwise unclassified shell.
      // Use its sole complete containing footprint for fit; never the nearest house.
      const containing =
        rule.fit === 'footprint' && 'point' in feature && !tile.buildingsGeneralized
          ? tile.buildings.filter((building) =>
              building.polygons.some((polygon) => pointInPolygon(feature.point, polygon)),
            )
          : [];
      if (containing.length > 1) continue;
      const shell = containing[0];
      const frame = frameFor(shell ?? feature, geometry.size, rule.lengthAxis);
      if (!frame || !owned(frame.point)) continue;
      const anchor = anchorFor(frame.point, geometry);
      if (
        rule.bounds &&
        (anchor[0] < rule.bounds[0] ||
          anchor[0] >= rule.bounds[2] ||
          anchor[1] < rule.bounds[1] ||
          anchor[1] >= rule.bounds[3])
      )
        continue;
      const world = wgs84ToWorld(geometry.metersPerUnit, ...anchor);
      if (
        occupied.some(
          ([x, z]) =>
            Math.hypot(world[0] - x, world[1] - z) <
            Math.max(5, Math.min(rule.dimensions[0], rule.dimensions[2]) / 2),
        )
      )
        break;
      const heading = rule.orientation === 'north' ? Math.PI : (frame.heading ?? Math.PI);
      const scale: [number, number, number] = [1, 1, 1];
      if (rule.fit === 'footprint' && frame.width && frame.depth) {
        scale[0] = Math.max(0.2, Math.min(5, frame.width / rule.dimensions[0]));
        scale[2] = Math.max(0.2, Math.min(5, frame.depth / rule.dimensions[2]));
      }
      const measuredHeight = feature.height ?? shell?.height;
      if (measuredHeight) {
        scale[1] = Math.max(0.2, Math.min(5, measuredHeight / rule.dimensions[1]));
        // Preserve rotor circles, arches and other authored proportions for native models.
        if (rule.fit !== 'footprint') scale[0] = scale[2] = scale[1];
      }
      const key =
        feature.id === undefined
          ? `${anchor[0].toFixed(7)},${anchor[1].toFixed(7)}`
          : `${'point' in feature ? 'poi' : 'building'}:${feature.id}`;
      result.push({
        id: `map.${rule.id}.${stableId(key)}`,
        title: feature.name ?? rule.title,
        asset: rule.asset,
        anchor,
        heading,
        scale,
        datum: 'terrain',
        status: 'preview',
        replaceFootprint: 'polygons' in feature || rule.replaceFootprint === true,
        minLevel: rule.minLevel ?? 14,
        source: rule.source,
      });
      occupied.push(world);
      counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
      break;
    }
  }
  return result;
}
