/**
 * Map overrides over the landmark catalog: a structure index that leaves out the catalogued
 * models a host cleared and offers the models it placed. Landmark models are not in the map
 * tiles, so the tile edit cannot reach them; the renderers ask this index instead.
 */

import {
  MAP_OVERRIDE_HOST_MODEL_MIN_LEVEL,
  type MapOverride,
  type MapOverrideSet,
  mapOverrideContains,
  type ResolvedMapOverride,
} from './map-overrides';
import { projectWgs84 } from './projection';
import type { StructureIndex, StructurePlacement } from './structure-index';

export interface MapOverrideStructureOptions {
  /**
   * Whether an asset ref is one the catalog's own model source streams with detail levels.
   * Other refs are a host's own models, drawn at one detail level and so from nearer by default.
   * Without it every ref is taken for the catalog's.
   */
  isCatalogAsset?: (asset: string) => boolean;
}

/** Whether a catalogued placement stands in a rectangle an override clears of landmarks. */
function hidden(entry: StructurePlacement, overrides: readonly ResolvedMapOverride[]): boolean {
  if (overrides.length === 0) return false;
  const [x, z] = projectWgs84(entry.anchor[0], entry.anchor[1]);
  // An extended model (a bridge, a stadium precinct) goes when its middle is cleared, not when
  // the rectangle only takes in one end of it.
  const middle = entry.bounds
    ? projectWgs84((entry.bounds[0] + entry.bounds[2]) / 2, (entry.bounds[1] + entry.bounds[3]) / 2)
    : undefined;
  return overrides.some(
    (override) =>
      override.clear.landmarks &&
      (mapOverrideContains(override, x, z) ||
        (middle !== undefined && mapOverrideContains(override, middle[0], middle[1]))),
  );
}

function placements(
  overrides: readonly ResolvedMapOverride[],
  options: MapOverrideStructureOptions,
): StructurePlacement[] {
  return overrides.flatMap((override) =>
    override.models.map((model): StructurePlacement => {
      const catalog = options.isCatalogAsset?.(model.asset) ?? true;
      return {
        id: model.id,
        title: model.id,
        asset: model.asset,
        anchor: [model.anchor[0], model.anchor[1]],
        ...(model.rotation !== 0 ? { heading: model.rotation } : {}),
        ...(model.scale !== undefined ? { scale: [...model.scale] } : {}),
        datum: 'terrain',
        ...(model.elevation !== 0 ? { elevation: model.elevation } : {}),
        minLevel:
          model.minLevel ??
          (catalog
            ? override.minLevel
            : Math.max(override.minLevel, MAP_OVERRIDE_HOST_MODEL_MIN_LEVEL)),
        status: 'preview',
        source: 'molen:map-override',
      };
    }),
  );
}

/**
 * `index` as a view's map overrides leave it: without the catalogued landmarks anchored in a
 * rectangle that clears them, and with the overrides' own models, which come first so a distant
 * tile's cap on landmarks never drops them. It reads the set on every query, so a change to the
 * set shows the next time a tile is built. The base index stays the content's to dispose.
 */
export function withMapOverrideStructures<T extends MapOverride>(
  index: StructureIndex,
  set: MapOverrideSet<T>,
  options: MapOverrideStructureOptions = {},
): StructureIndex {
  const merge = (
    bounds: readonly [number, number, number, number],
    found: StructurePlacement[],
  ): StructurePlacement[] => {
    const overrides = set.query(bounds);
    if (overrides.length === 0) return found;
    return [
      ...placements(overrides, options).filter(
        ({ anchor }) =>
          // Inclusive: the renderer decides which tile owns a placement on its edge.
          anchor[1] >= bounds[1] &&
          anchor[1] <= bounds[3] &&
          (bounds[0] <= bounds[2]
            ? anchor[0] >= bounds[0] && anchor[0] <= bounds[2]
            : anchor[0] >= bounds[0] || anchor[0] <= bounds[2]),
      ),
      ...found.filter((entry) => !hidden(entry, overrides)),
    ];
  };
  const everywhere = (): readonly ResolvedMapOverride[] => set.query([-180, -85, 180, 85]);
  const wrapped: StructureIndex = {
    get entries(): readonly StructurePlacement[] {
      const overrides = everywhere();
      if (overrides.length === 0) return index.entries;
      return [
        ...placements(overrides, options),
        ...index.entries.filter((entry) => !hidden(entry, overrides)),
      ];
    },
    get cells(): ReadonlyMap<string, readonly StructurePlacement[]> {
      return index.cells;
    },
    get rules(): StructureIndex['rules'] {
      return index.rules;
    },
    query: (bounds, query) => merge(bounds, index.query(bounds, query)),
  };
  // Only when the base has them: their presence is how a caller knows the catalog loads lazily.
  if (index.queryAsync !== undefined) {
    const queryAsync = index.queryAsync.bind(index);
    wrapped.queryAsync = async (bounds, query) => merge(bounds, await queryAsync(bounds, query));
  }
  if (index.isLoaded !== undefined) {
    const isLoaded = index.isLoaded.bind(index);
    wrapped.isLoaded = (bounds) => isLoaded(bounds);
  }
  return wrapped;
}
