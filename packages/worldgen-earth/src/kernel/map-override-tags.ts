/**
 * What a map override leaves in a semantic tile, for the stages downstream of the edit (see
 * map-override-tile.ts). A host's buildings and props travel as ordinary tile features carrying
 * these tags, so they reach the worldgen worker with the tile and need no protocol of their own.
 */

/** On every feature a map override injects; the value is the override's id. */
export const MAP_OVERRIDE_TAG = 'molen:override';
/** On a host building: an archstyle id of the style pack, used when the pack has it. */
export const MAP_OVERRIDE_STYLE_TAG = 'molen:style';
/** On a host building: its wall color, `#rrggbb`. */
export const MAP_OVERRIDE_WALL_TAG = 'molen:wall';
/** On a host building: its trim color, `#rrggbb`. */
export const MAP_OVERRIDE_TRIM_TAG = 'molen:trim';
/** On a `MAP_OVERRIDE_PROP_CLASS` POI: the model ref to place. */
export const MAP_OVERRIDE_MODEL_TAG = 'molen:model';
/** On a `MAP_OVERRIDE_PROP_CLASS` POI: its scale, `"sx,sy,sz"` (default 1,1,1). */
export const MAP_OVERRIDE_SCALE_TAG = 'molen:scale';
/** On a `MAP_OVERRIDE_PROP_CLASS` POI: a tint, `#rrggbb`. */
export const MAP_OVERRIDE_COLOR_TAG = 'molen:color';

/** POI class of a host prop that names its own model (see `MAP_OVERRIDE_MODEL_TAG`). */
export const MAP_OVERRIDE_PROP_CLASS = 'molen_prop';
/**
 * Land cover class of the ground a map override cleared. Its look is the feature's subclass and
 * its `density` is 0: no plants are scattered on it, no parking, home canopy or synthetic homes
 * are inferred across it.
 */
export const MAP_OVERRIDE_COVER_CLASS = 'cleared';

/** Feature id prefix: `override:<override id>:<local id>`. */
export const MAP_OVERRIDE_ID_PREFIX = 'override:';

/** The id a map override gives the tile feature for one of its buildings, props or its ground. */
export function mapOverrideFeatureId(overrideId: string, localId: string): string {
  return `${MAP_OVERRIDE_ID_PREFIX}${overrideId}:${localId}`;
}

/** Whether a tile feature was injected by a map override. */
export function isMapOverrideFeature(feature: {
  tags?: Readonly<Record<string, string>>;
}): boolean {
  return feature.tags?.[MAP_OVERRIDE_TAG] !== undefined;
}
