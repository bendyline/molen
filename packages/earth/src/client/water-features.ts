import {
  clipTerrainPolygonToTile,
  partitionTerrainPolygon,
  subtractTerrainPolygon,
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticTileRenderer,
  type TerrainWaterFeatureStyle,
  unionTerrainPolygons,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  isDegenerateRing,
  pointInPolygon,
  polygonBounds,
  type TerrainPackageDescriptor,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticRing,
  type TerrainWaterFeature,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import {
  isStructureViewingDateInRange,
  isStructureViewingDateRange,
} from '@bendyline/molen-worldgen-earth/kernel';

interface WaterStageSplit {
  anchor: [number, number];
  heading: number;
  negativeZ: number;
  positiveZ: number;
}

type EarthWaterFeature = TerrainWaterFeatureStyle & {
  split?: WaterStageSplit;
  stageOutline?: TerrainSemanticRing;
  shoreline?: TerrainSemanticRing;
  exclude?: TerrainSemanticRing;
  join?: number;
  clearSurfaceRoads?: true;
  validFrom?: string;
  validUntil?: string;
};
export type EarthWaterFeatures = ReadonlyMap<string, EarthWaterFeature>;

// A tile can contain both sides of a pool boundary under the same source feature ID.
const insideStageOutline = new WeakMap<TerrainSemanticPolygon, boolean>();

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function readStageSplit(value: unknown): WaterStageSplit {
  if (!value || typeof value !== 'object') throw new Error('Invalid water stage split');
  const { anchor, heading, negativeZ, positiveZ } = value as Record<string, unknown>;
  if (
    !Array.isArray(anchor) ||
    anchor.length !== 2 ||
    !finite(anchor[0]) ||
    !finite(anchor[1]) ||
    Math.abs(anchor[0]) > 180 ||
    Math.abs(anchor[1]) > 85 ||
    !finite(heading) ||
    !finite(negativeZ) ||
    !finite(positiveZ)
  )
    throw new Error('Invalid water stage split');
  return { anchor: [anchor[0], anchor[1]], heading, negativeZ, positiveZ };
}

function readShoreline(value: unknown): TerrainSemanticRing {
  if (!Array.isArray(value) || value.length < 3 || value.length > 512)
    throw new Error('Invalid Earth water shoreline');
  const ring: TerrainSemanticRing = value.map((point: unknown) => {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !finite(point[0]) ||
      !finite(point[1]) ||
      Math.abs(point[0]) > 180 ||
      Math.abs(point[1]) > 85
    )
      throw new Error('Invalid Earth water shoreline coordinate');
    return [point[0], point[1]];
  });
  const [west, , east] = polygonBounds({ outer: ring });
  if (east - west > 180 || isDegenerateRing(ring))
    throw new Error('Invalid local Earth water shoreline');
  return ring;
}

/** Read stock stages and local shorelines from the Earth pack. */
export function readEarthWaterFeatures(value: unknown): EarthWaterFeatures {
  const document = value as { format?: unknown; features?: unknown } | null;
  if (document?.format !== 'molen/earth-water-features@1' || !Array.isArray(document.features))
    throw new Error('Invalid Earth water features document');
  const styles = new Map<string, EarthWaterFeature>();
  for (const item of document.features as unknown[]) {
    if (item === null || typeof item !== 'object') throw new Error('Invalid Earth water feature');
    const {
      id,
      elevation,
      hideLines,
      hidePolygons,
      split,
      stageOutline,
      shoreline,
      join,
      exclude,
      clearSurfaceRoads,
      validFrom,
      validUntil,
    } = item as Record<string, unknown>;
    if (typeof id !== 'number' || !Number.isSafeInteger(id))
      throw new Error('An Earth water feature requires a Protomaps feature ID');
    if (
      (elevation === undefined &&
        hideLines !== true &&
        hidePolygons !== true &&
        split === undefined &&
        exclude === undefined) ||
      (elevation !== undefined && (!finite(elevation) || split !== undefined)) ||
      (stageOutline !== undefined && (id < 0 || !finite(elevation) || hidePolygons === true)) ||
      (hideLines !== undefined && hideLines !== true) ||
      (hidePolygons !== undefined && hidePolygons !== true) ||
      (shoreline !== undefined && (id >= 0 || !finite(elevation) || hidePolygons === true)) ||
      (clearSurfaceRoads !== undefined &&
        (clearSurfaceRoads !== true || shoreline === undefined)) ||
      (exclude !== undefined && (id < 0 || hidePolygons === true)) ||
      (join !== undefined &&
        (shoreline === undefined ||
          typeof join !== 'number' ||
          !Number.isSafeInteger(join) ||
          join < 0)) ||
      ((validFrom !== undefined || validUntil !== undefined) &&
        !isStructureViewingDateRange(validFrom, validUntil)) ||
      styles.has(String(id))
    )
      throw new Error(`Invalid or duplicate Earth water feature ${id}`);
    styles.set(String(id), {
      ...(elevation === undefined ? {} : { elevation }),
      ...(hideLines === true ? { hideLines } : {}),
      ...(hidePolygons === true ? { hidePolygons } : {}),
      ...(split === undefined ? {} : { split: readStageSplit(split) }),
      ...(stageOutline === undefined ? {} : { stageOutline: readShoreline(stageOutline) }),
      ...(shoreline === undefined ? {} : { shoreline: readShoreline(shoreline) }),
      ...(exclude === undefined ? {} : { exclude: readShoreline(exclude) }),
      ...(typeof join === 'number' ? { join } : {}),
      ...(clearSurfaceRoads === true ? { clearSurfaceRoads } : {}),
      ...(typeof validFrom === 'string' && typeof validUntil === 'string'
        ? { validFrom, validUntil }
        : {}),
    });
  }
  return styles;
}

/** Select shoreline and stage edits for a single viewer mount. */
export function selectEarthWaterFeatures(
  features: EarthWaterFeatures | undefined,
  viewingDate?: string,
): EarthWaterFeatures | undefined {
  return features
    ? new Map(
        [...features].filter(
          ([, { validFrom, validUntil }]) =>
            (validFrom === undefined && validUntil === undefined) ||
            isStructureViewingDateInRange(viewingDate, validFrom, validUntil),
        ),
      )
    : undefined;
}

function usesProtomaps(terrain: TerrainPackageDescriptor): boolean {
  return (
    terrain.coordinateSpace.kind === 'geospatial' &&
    terrain.features?.profile === 'protomaps-basemap@1'
  );
}

function waterStage(
  style: EarthWaterFeature | undefined,
  polygon: TerrainSemanticPolygon,
  context: TerrainPyramidTileLayerContext,
): number | undefined {
  if (style?.stageOutline) {
    const inRegion = insideStageOutline.get(polygon);
    if (inRegion !== undefined) return inRegion ? style.elevation : undefined;
    // Observers of decoded water can use the polygon's representative position.
    const ring = polygon.outer;
    const [x, z] = ring.reduce(([x, z], [u, v]) => [x + u, z + v], [0, 0]);
    return pointInPolygon(
      [x / ring.length, z / ring.length],
      projectWaterOutline(style.stageOutline, context),
    )
      ? style.elevation
      : undefined;
  }
  if (!style?.split) return style?.elevation;
  // One map relation may contain different bodies on opposite sides of a dam.
  const { anchor, heading, negativeZ, positiveZ } = style.split;
  const [x, z] = wgs84ToWorld(context.pyramid.metersPerUnit ?? 1, ...anchor);
  const [ox, oz] = context.origin;
  const sine = Math.sin(heading);
  const cosine = Math.cos(heading);
  let localZ = 0;
  for (const [u, v] of polygon.outer) {
    localZ += sine * (ox + u * context.tileSize - x) + cosine * (oz + v * context.tileSize - z);
  }
  return localZ < 0 ? negativeZ : positiveZ;
}

function projectWaterOutline(
  ring: TerrainSemanticRing,
  context: TerrainPyramidTileLayerContext,
): TerrainSemanticPolygon {
  const [x, z] = context.origin;
  const size = context.tileSize;
  const scale = context.pyramid.metersPerUnit ?? 1;
  const outer = ring.map(([lon, lat]): [number, number] => {
    const [px, pz] = wgs84ToWorld(scale, lon, lat);
    return [(px - x) / size, (pz - z) / size];
  });
  return { outer };
}

/** Keep the continuous pieces of a mapped waterway outside a local exclusion. */
function subtractWaterLine(
  line: TerrainSemanticLine,
  mask: TerrainSemanticPolygon,
): TerrainSemanticLine[] {
  const kept: TerrainSemanticLine[] = [];
  let piece: TerrainSemanticLine = [];
  for (let index = 1; index < line.length; index++) {
    const a = line[index - 1] as TerrainSemanticPoint;
    const b = line[index] as TerrainSemanticPoint;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const cuts = [0, 1];
    for (let edge = 0; edge < mask.outer.length; edge++) {
      const p = mask.outer[edge] as TerrainSemanticPoint;
      const q = mask.outer[(edge + 1) % mask.outer.length] as TerrainSemanticPoint;
      const ex = q[0] - p[0];
      const ez = q[1] - p[1];
      const determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 1e-16) continue;
      const px = p[0] - a[0];
      const pz = p[1] - a[1];
      const t = (px * ez - pz * ex) / determinant;
      const u = (px * dz - pz * dx) / determinant;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    }
    cuts.sort((left, right) => left - right);
    const at = (t: number): TerrainSemanticPoint => [a[0] + t * dx, a[1] + t * dz];
    for (let i = 1; i < cuts.length; i++) {
      const start = cuts[i - 1] as number;
      const end = cuts[i] as number;
      if (end - start < 1e-10) continue;
      if (pointInPolygon(at((start + end) / 2), mask)) {
        if (piece.length > 1) kept.push(piece);
        piece = [];
        continue;
      }
      if (!piece.length) piece.push(start === 0 ? a : at(start));
      piece.push(end === 1 ? b : at(end));
    }
  }
  if (piece.length > 1) kept.push(piece);
  return kept;
}

/** Clip grade-level roads in reclaimed land covered by a replacement shoreline. */
export function withEarthShorelineRoadMask(
  renderer: TerrainSemanticTileRenderer,
  waterFeatures: EarthWaterFeatures | undefined,
  terrain: TerrainPackageDescriptor,
): TerrainSemanticTileRenderer {
  if (!usesProtomaps(terrain)) return renderer;
  const shorelines = [...(waterFeatures?.values() ?? [])].flatMap(
    ({ clearSurfaceRoads, shoreline }) => (clearSurfaceRoads && shoreline ? [shoreline] : []),
  );
  if (!shorelines.length) return renderer;
  return {
    ...renderer,
    createTile(tile, context) {
      const masks = shorelines
        .map((ring) => projectWaterOutline(ring, context))
        .filter((polygon) => {
          const [left, top, right, bottom] = polygonBounds(polygon);
          return right > 0 && left < 1 && bottom > 0 && top < 1;
        });
      if (!masks.length) return renderer.createTile(tile, context);
      const transportation = tile.transportation.flatMap((feature) => {
        if (feature.bridge || feature.tunnel) return [feature];
        const lines = masks.reduce(
          (parts, mask) => parts.flatMap((line) => subtractWaterLine(line, mask)),
          feature.lines,
        );
        return lines.length ? [{ ...feature, lines }] : [];
      });
      return renderer.createTile({ ...tile, transportation }, context);
    },
  };
}

/** Correct local water areas in the decoded tile before the stock renderer samples it. */
export function withEarthWaterShorelines(
  renderer: TerrainSemanticTileRenderer,
  waterFeatures: EarthWaterFeatures | undefined,
  terrain: TerrainPackageDescriptor,
): TerrainSemanticTileRenderer {
  if (!usesProtomaps(terrain)) return renderer;
  const edits = [...(waterFeatures ?? [])].flatMap(([id, { shoreline, exclude, stageOutline }]) =>
    (['shoreline', 'exclude', 'stageOutline'] as const).flatMap((kind) => {
      const ring = { shoreline, exclude, stageOutline }[kind];
      return ring ? [{ id, ring, kind, bounds: polygonBounds({ outer: ring }) }] : [];
    }),
  );
  if (!edits.length) return renderer;
  const joinShoreline = (
    water: TerrainWaterFeature[],
    shore: TerrainWaterFeature,
    context: TerrainPyramidTileLayerContext,
  ): void => {
    const style = waterFeatures?.get(String(shore.id));
    if (style?.join === undefined) {
      water.push(shore);
      return;
    }
    const target = waterFeatures?.get(String(style.join));
    const joined = [...(shore.polygons ?? [])];
    for (const [index, feature] of water.entries()) {
      if (String(feature.id) !== String(style.join) || !feature.polygons || target?.hidePolygons)
        continue;
      const remaining = feature.polygons.filter((polygon) => {
        if (waterStage(target, polygon, context) !== style.elevation) return true;
        joined.push(polygon);
        return false;
      });
      if (remaining.length !== feature.polygons.length)
        water[index] = { ...feature, polygons: remaining };
    }
    water.push({ ...shore, polygons: unionTerrainPolygons(joined) });
  };
  const waterEditsForTile = (context: TerrainPyramidTileLayerContext) => {
    const [x, z] = context.origin;
    const size = context.tileSize;
    const scale = context.pyramid.metersPerUnit ?? 1;
    const features: {
      id: string;
      kind: (typeof edits)[number]['kind'];
      polygon: TerrainSemanticPolygon;
    }[] = [];
    for (const {
      id,
      ring,
      kind,
      bounds: [west, south, east, north],
    } of edits) {
      const [left, top] = wgs84ToWorld(scale, west, north);
      const [right, bottom] = wgs84ToWorld(scale, east, south);
      if (right <= x || left >= x + size || bottom <= z || top >= z + size) continue;
      features.push({ id, kind, polygon: projectWaterOutline(ring, context) });
    }
    return features;
  };
  return {
    createTile(tile, context) {
      const localEdits = waterEditsForTile(context);
      if (!localEdits.length) return renderer.createTile(tile, context);
      const masks = new Map(
        localEdits
          .filter((edit) => edit.kind === 'exclude')
          .map(({ id, polygon }) => [id, polygon]),
      );
      const stages = new Map(
        localEdits
          .filter((edit) => edit.kind === 'stageOutline')
          .map(({ id, polygon }) => [id, polygon]),
      );
      const water = tile.water.map((feature) => {
        const id = String(feature.id);
        const mask = masks.get(id);
        const stage = stages.get(id);
        if (!mask && !stage) return feature;
        const remaining =
          mask && feature.polygons
            ? feature.polygons.flatMap((polygon) => subtractTerrainPolygon(polygon, mask))
            : feature.polygons;
        const polygons =
          stage && remaining
            ? remaining.flatMap((polygon) => {
                const { inside, outside } = partitionTerrainPolygon(polygon, stage);
                for (const area of inside) insideStageOutline.set(area, true);
                const unstaged = outside.map((area) => {
                  const originalLevel = area === polygon ? { ...area } : area;
                  insideStageOutline.set(originalLevel, false);
                  return originalLevel;
                });
                return [...inside, ...unstaged];
              })
            : remaining;
        const lines =
          mask && feature.lines
            ? feature.lines.flatMap((line) => subtractWaterLine(line, mask))
            : feature.lines;
        return { ...feature, polygons, lines };
      });
      for (const { id, kind, polygon } of localEdits) {
        if (kind !== 'shoreline') continue;
        const polygons = clipTerrainPolygonToTile(polygon);
        if (polygons.length) joinShoreline(water, { id, class: 'river', polygons }, context);
      }
      return renderer.createTile(
        {
          ...tile,
          water: water.filter((feature) => feature.polygons?.length || feature.lines?.length),
        },
        context,
      );
    },
    createEmptyTile(context) {
      const water: TerrainWaterFeature[] = waterEditsForTile(context).flatMap(
        ({ id, kind, polygon }) => {
          if (kind !== 'shoreline') return [];
          const polygons = clipTerrainPolygonToTile(polygon);
          return polygons.length ? [{ id, class: 'river', polygons }] : [];
        },
      );
      return water.length
        ? renderer.createTile({ ...createEmptyTerrainSemanticTile(), water }, context)
        : renderer.createEmptyTile?.(context);
    },
    disposeTile: (object) => renderer.disposeTile?.(object),
  };
}

/** A non-Protomaps host can supply its own settings to the terrain renderer. */
export function earthWaterMeshOptions(
  waterFeatures: EarthWaterFeatures | undefined,
  terrain: TerrainPackageDescriptor,
): Pick<TerrainSemanticMeshOptions, 'waterFeatureStyle'> {
  if (!usesProtomaps(terrain) || !waterFeatures?.size) return {};
  return {
    waterFeatureStyle: (feature, surface) => {
      const style = feature.id === undefined ? undefined : waterFeatures.get(String(feature.id));
      if (style?.shoreline) return { elevation: style.elevation };
      if (style?.stageOutline)
        return {
          ...style,
          elevation: surface ? waterStage(style, surface.polygon, surface.context) : undefined,
        };
      if (!style?.split || !surface) return style;

      return { ...style, elevation: waterStage(style, surface.polygon, surface.context) };
    },
  };
}
