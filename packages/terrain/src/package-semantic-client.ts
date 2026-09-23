/** Convenience wiring from optional terrain-package sidecars to adaptive semantic layers. */

import { createProtomapsTerrainMvtDecoder } from './mvt-semantic-decoder';
import {
  createTerrainPackageCombinedSemanticSource,
  type OpenTerrainPackageSemantics,
  type OpenTerrainPackageSemanticsOptions,
  openTerrainPackageSemantics,
  type TerrainPackageSemanticSource,
  terrainPackageArchiveSourceLocation,
} from './package-client';
import type { TerrainPackageDescriptor } from './package-types';
import type { TerrainPyramidTileLayer } from './pyramid-stream';
import {
  createDefaultTerrainSemanticRenderer,
  createTerrainSemanticPyramidLayer,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticTileRenderer,
} from './semantic-client';

export interface TerrainPackageSemanticLayerStyle {
  id?: string;
  visible?: boolean;
  minLevel?: number;
  maxLevel?: number;
  renderer?: TerrainSemanticTileRenderer;
  mesh?: TerrainSemanticMeshOptions;
}

export interface CreateTerrainPackageSemanticLayersOptions
  extends OpenTerrainPackageSemanticsOptions {
  landcoverLayer?: TerrainPackageSemanticLayerStyle;
  waterLayer?: TerrainPackageSemanticLayerStyle;
  featuresLayer?: TerrainPackageSemanticLayerStyle;
}

export interface TerrainPackageSemanticLayers {
  package: TerrainPackageDescriptor;
  semantics: OpenTerrainPackageSemantics;
  layers: TerrainPyramidTileLayer[];
}

export type CreateProfiledTerrainPackageSemanticLayersOptions = Omit<
  CreateTerrainPackageSemanticLayersOptions,
  'decoder'
>;

function defaultMinimumLevel(minLevel: number, maxLevel: number, detailLevels: number): number {
  return Math.max(minLevel, maxLevel - detailLevels + 1);
}

/**
 * Open declared sidecars and create conservative, detail-bounded adaptive layers.
 *
 * The defaults decorate the finest three landcover levels and finest two built-feature levels.
 * Hydrology spans every available sidecar level so distant lakes retain mapped shorelines.
 * A caller can override bounds or replace a renderer without changing package/archive code.
 */
export async function createTerrainPackageSemanticLayers(
  pkg: TerrainPackageDescriptor,
  options: CreateTerrainPackageSemanticLayersOptions,
): Promise<TerrainPackageSemanticLayers> {
  const { landcoverLayer, waterLayer, featuresLayer, ...openOptions } = options;
  const semantics = await openTerrainPackageSemantics(pkg, openOptions);
  const layers: TerrainPyramidTileLayer[] = [];
  let landcoverSource = semantics.landcover?.source;
  let featuresSource = semantics.features?.source;
  if (
    semantics.landcover !== undefined &&
    semantics.features !== undefined &&
    semantics.landcover.archive === semantics.features.archive &&
    pkg.landcover?.encoding === 'mvt' &&
    pkg.features?.encoding === 'mvt' &&
    terrainPackageArchiveSourceLocation(pkg.landcover.source) ===
      terrainPackageArchiveSourceLocation(pkg.features.source)
  ) {
    const sharedMinLevel = Math.max(semantics.landcover.minLevel, semantics.features.minLevel);
    const sharedMaxLevel = Math.min(semantics.landcover.maxLevel, semantics.features.maxLevel);
    if (sharedMinLevel <= sharedMaxLevel) {
      const shared = createTerrainPackageCombinedSemanticSource(
        pkg,
        semantics.landcover.archive,
        openOptions.decoder,
        { minLevel: sharedMinLevel, maxLevel: sharedMaxLevel },
      );
      const route = (primary: TerrainPackageSemanticSource): TerrainPackageSemanticSource => ({
        load: (address, signal) =>
          address.level >= sharedMinLevel && address.level <= sharedMaxLevel
            ? shared.load(address, signal)
            : primary.load(address, signal),
      });
      landcoverSource = route(semantics.landcover.source);
      featuresSource = route(semantics.features.source);
    }
  }
  if (semantics.landcover !== undefined) {
    const style = landcoverLayer ?? {};
    const landSource = landcoverSource as TerrainPackageSemanticSource;
    const pointsSource = featuresSource;
    const classificationSource: TerrainPackageSemanticSource = {
      async load(address, signal) {
        const tile = await landSource.load(address, signal);
        if (
          !tile ||
          tile.pois !== undefined ||
          !pointsSource ||
          !semantics.features ||
          !pkg.features?.layers.includes('poi') ||
          address.level < semantics.features.minLevel ||
          address.level > semantics.features.maxLevel
        )
          return tile;
        const features = await pointsSource.load(address, signal);
        return features?.pois ? { ...tile, pois: features.pois } : tile;
      },
    };
    layers.push(
      createTerrainSemanticPyramidLayer({
        id: style.id ?? 'land-classification',
        category: 'classification',
        source: classificationSource,
        renderer:
          style.renderer ??
          createDefaultTerrainSemanticRenderer({
            ...style.mesh,
            renderWater: false,
            renderTransportation: false,
            renderBuildings: false,
          }),
        visible: style.visible ?? false,
        minLevel:
          style.minLevel ??
          defaultMinimumLevel(semantics.landcover.minLevel, semantics.landcover.maxLevel, 3),
        maxLevel: style.maxLevel ?? semantics.landcover.maxLevel,
      }),
    );
  }
  if (semantics.features !== undefined) {
    if (pkg.features?.layers.includes('water') === true) {
      const style = waterLayer ?? {};
      layers.push(
        createTerrainSemanticPyramidLayer({
          id: style.id ?? 'water-features',
          category: 'hydrology',
          source: featuresSource as TerrainPackageSemanticSource,
          renderer:
            style.renderer ??
            createDefaultTerrainSemanticRenderer({
              ...style.mesh,
              renderLandcover: false,
              renderTransportation: false,
              renderBuildings: false,
            }),
          visible: style.visible ?? false,
          minLevel: style.minLevel ?? semantics.features.minLevel,
          maxLevel: style.maxLevel ?? semantics.features.maxLevel,
        }),
      );
    }
  }
  if (
    semantics.features !== undefined &&
    pkg.features?.layers.some(
      (layer) => layer === 'transportation' || layer === 'building' || layer === 'poi',
    ) === true
  ) {
    const style = featuresLayer ?? {};
    const featureSource = featuresSource as TerrainPackageSemanticSource;
    const landSource = landcoverSource;
    // Surface areas often live in a separate land-use sidecar. Join them for Human mode,
    // retaining already-combined source tiles and leaving hydrology reads independent.
    const surfaceSource: TerrainPackageSemanticSource = {
      async load(address, signal) {
        const tile = await featureSource.load(address, signal);
        if (
          !tile ||
          tile.landcover.length ||
          !landSource ||
          !semantics.landcover ||
          address.level < semantics.landcover.minLevel ||
          address.level > semantics.landcover.maxLevel
        )
          return tile;
        const land = await landSource.load(address, signal);
        return land ? { ...tile, landcover: land.landcover } : tile;
      },
    };
    layers.push(
      createTerrainSemanticPyramidLayer({
        id: style.id ?? 'human-features',
        category: 'human-feature',
        source: surfaceSource,
        renderer:
          style.renderer ??
          createDefaultTerrainSemanticRenderer({
            ...style.mesh,
            renderLandcover: false,
            renderWater: false,
          }),
        visible: style.visible ?? false,
        minLevel:
          style.minLevel ??
          defaultMinimumLevel(semantics.features.minLevel, semantics.features.maxLevel, 2),
        maxLevel: style.maxLevel ?? semantics.features.maxLevel,
      }),
    );
  }
  return { package: pkg, semantics, layers };
}

/** Select a built-in decoder only from an explicit package profile declaration. */
export async function createProfiledTerrainPackageSemanticLayers(
  pkg: TerrainPackageDescriptor,
  options: CreateProfiledTerrainPackageSemanticLayersOptions = {},
): Promise<TerrainPackageSemanticLayers> {
  const declared = [pkg.landcover, pkg.features].filter((section) => section !== undefined);
  if (
    declared.some(
      (section) => section.encoding !== 'mvt' || section.profile !== 'protomaps-basemap@1',
    )
  ) {
    throw new Error(
      'terrain package semantic sidecars need a supported profile or an explicit decoder',
    );
  }
  return createTerrainPackageSemanticLayers(pkg, {
    ...options,
    decoder: createProtomapsTerrainMvtDecoder(),
  });
}
