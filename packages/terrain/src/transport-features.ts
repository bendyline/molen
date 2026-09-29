/**
 * Three-free transport classification rules shared by the surface painter and kernel-side
 * transport graphs, so simulated lanes land exactly on painted lanes.
 */
import type { TerrainTransportationFeature } from './semantic-types';
import { roadWidth } from './semantic-widths';

/** Painter/simulation class of a transportation feature. */
export type TransportKind = 'street' | 'service' | 'path' | 'rail' | 'motorway';

/** Height of a painted street surface above the rendered terrain, in metres. */
export const ROAD_SURFACE_LIFT = 0.32;
/** Height of a painted path surface above the rendered terrain, in metres. */
export const PATH_SURFACE_LIFT = 0.43;
/** Extra height the painter adds to a bridge road's nominal elevation, in metres. */
export const BRIDGE_SURFACE_LIFT = 4;

/** Classify a feature from its class, subclass and service tags. */
export function transportKind(feature: TerrainTransportationFeature): TransportKind {
  const tag = `${feature.class} ${feature.subclass ?? ''} ${feature.service ?? ''}`.toLowerCase();
  if (/rail|tram|train/.test(tag)) return 'rail';
  if (/path|foot|cycle|pedestrian|steps|trail|bridle/.test(tag)) return 'path';
  if (/service|parking|driveway|alley/.test(tag)) return 'service';
  if (/motorway|freeway|highway/.test(tag)) return 'motorway';
  return 'street';
}

/** True for slip roads and ramps. */
export function isTransportLink(feature: TerrainTransportationFeature): boolean {
  return feature.link === true || /(?:_link|ramp)$/.test(feature.subclass ?? '');
}

/**
 * Merge features whose properties are identical (ignoring `id`), concatenating their lines.
 * Protomaps splits one road into many features; grouping lets fragments join end to end.
 */
export function groupTransportationFeatures(
  features: readonly TerrainTransportationFeature[],
): TerrainTransportationFeature[] {
  const groups = new Map<string, TerrainTransportationFeature>();
  for (const feature of features) {
    const { id: _id, lines, ...properties } = feature;
    const key = JSON.stringify(properties);
    const group = groups.get(key);
    if (group) group.lines.push(...lines);
    else groups.set(key, { ...feature, lines: [...lines] });
  }
  return [...groups.values()];
}

/** Carriageway width in metres, matching the painter (capped at 80 m). */
export function transportWidth(
  feature: TerrainTransportationFeature,
  kind: TransportKind = transportKind(feature),
  scale = 1,
): number {
  const width =
    feature.width ??
    (kind === 'path'
      ? 2.4
      : kind === 'service'
        ? 4.5
        : feature.lanes
          ? Math.min(12, feature.lanes) * 3.2
          : roadWidth(feature.subclass ?? feature.class)) * scale;
  return Math.min(80, width);
}

/** Total lane count across both directions, matching the painted lane lines. */
export function inferLaneCount(feature: TerrainTransportationFeature, width: number): number {
  return feature.lanes ?? Math.max(2, Math.round(width / 3.3));
}

/** Nominal painted surface elevation above terrain (bridges add {@link BRIDGE_SURFACE_LIFT}). */
export function transportSurfaceLift(kind: TransportKind, bridge = false): number {
  return (
    (kind === 'path' ? PATH_SURFACE_LIFT : ROAD_SURFACE_LIFT) + (bridge ? BRIDGE_SURFACE_LIFT : 0)
  );
}

/** Whether the painter draws this feature at all (tunnels, crossings and unstyled sidewalks are skipped). */
export function isPaintedTransport(
  feature: TerrainTransportationFeature,
  options: { sidewalks: boolean },
): boolean {
  return !(
    feature.tunnel ||
    (feature.subclass === 'sidewalk' && !options.sidewalks) ||
    feature.subclass === 'crossing'
  );
}
