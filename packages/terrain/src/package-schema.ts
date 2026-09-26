import { registerSchema, type ValidationIssue } from '@bendyline/molen-schema';
import { z } from 'zod';

const packagePath = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.startsWith('\\') &&
      !/^[a-zA-Z]:[\\/]/.test(path) &&
      !path.split(/[\\/]/).includes('..'),
    { message: 'expected a package-relative path without .. segments' },
  );

// Every field carries a `.describe()` so the emitted JSON Schema documents units and axes.
const bounds = z.array(z.number().finite()).length(4);
const archiveSource = z.union([
  z.strictObject({
    kind: z.literal('pmtiles').describe("Archive kind; always 'pmtiles'."),
    path: packagePath.describe('Package-relative path of the PMTiles archive.'),
  }),
  z.strictObject({
    kind: z.literal('pmtiles').describe("Archive kind; always 'pmtiles'."),
    url: z.url().describe('Absolute URL of the PMTiles archive.'),
  }),
  z.strictObject({
    kind: z
      .literal('pmtiles-set')
      .describe("Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."),
    path: packagePath.describe('Package-relative path of the archive-set document.'),
  }),
  z.strictObject({
    kind: z
      .literal('pmtiles-set')
      .describe("Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."),
    url: z.url().describe('Absolute URL of the archive-set document.'),
  }),
]);
const surfaceLayer = z.strictObject({
  name: z.string().min(1).describe("Layer name, e.g. 'grass' or 'rock'."),
  materialRef: z
    .string()
    .min(1)
    .describe('Material reference for the layer surface (project material doc id).')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .describe("Flat '#rrggbb' color used for vertex-color splat banding.")
    .optional(),
  tiling: z
    .number()
    .positive()
    .describe('Texture repeats per chunk edge for the layer material (default 8).')
    .default(8),
  auto: z
    .strictObject({
      heightMin: z
        .number()
        .finite()
        .describe('Lowest height in meters at which the layer applies.')
        .optional(),
      heightMax: z
        .number()
        .finite()
        .describe('Highest height in meters at which the layer applies.')
        .optional(),
      slopeMin: z
        .number()
        .min(0)
        .max(1)
        .describe('Minimum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies.')
        .optional(),
      slopeMax: z
        .number()
        .min(0)
        .max(1)
        .describe('Maximum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies.')
        .optional(),
    })
    .describe('Automatic height/slope banding that selects where the layer paints.')
    .optional(),
});

const coordinateSpace = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('local').describe('Invented world in a local metric frame.'),
    units: z.literal('meters').describe("Bounds units; always 'meters'."),
    bounds: bounds.describe('[minX, minZ, maxX, maxZ] in meters (world XZ, Y-up).'),
  }),
  z.strictObject({
    kind: z.literal('geospatial').describe('Real-Earth data in a geographic CRS.'),
    crs: z
      .enum(['EPSG:3857', 'EPSG:4326'])
      .describe(
        'Coordinate reference system: EPSG:3857 (Web Mercator) or EPSG:4326 (WGS84 lon/lat).',
      ),
    ellipsoid: z.literal('WGS84').describe("Reference ellipsoid; always 'WGS84'.").default('WGS84'),
    bounds: bounds.describe('[minLon, minLat, maxLon, maxLat] in degrees.'),
  }),
]);

const terrainPackageSchema = z.strictObject({
  format: z
    .literal('molen/terrain-package@1')
    .describe("Format envelope; always 'molen/terrain-package@1'."),
  name: z.string().min(1).describe('Package name.'),
  version: z.string().min(1).describe("Package version string, e.g. '2026.08'."),
  coordinateSpace: coordinateSpace.describe(
    'Coordinate space the package covers: local metric or geospatial.',
  ),
  tileMatrix: z
    .strictObject({
      scheme: z
        .enum(['xyz', 'tms'])
        .describe(
          "Tile row numbering: 'xyz' (row 0 at the top, default) or 'tms' (row 0 at the bottom).",
        )
        .default('xyz'),
      minLevel: z
        .int()
        .min(0)
        .max(30)
        .describe('Coarsest zoom level present (default 0).')
        .default(0),
      maxLevel: z.int().min(0).max(30).describe('Finest zoom level present.'),
      rootTiles: z
        .array(z.int().positive())
        .length(2)
        .describe('Tiles along [x, z] at level 0 (default [1, 1]).')
        .default([1, 1]),
      tileResolution: z
        .int()
        .min(2)
        .max(1025)
        .describe('Height samples per tile edge (default 257).')
        .default(257),
    })
    .describe('Tile pyramid layout shared by every archive in the package.'),
  elevation: z
    .strictObject({
      source: archiveSource.describe('Archive holding the elevation tiles.'),
      encoding: z
        .literal('png16')
        .describe("Tile encoding; always 'png16' (16-bit grayscale PNG)."),
      height: z
        .strictObject({
          min: z.number().finite().describe('Height in meters encoded by sample value 0.'),
          max: z.number().finite().describe('Height in meters encoded by sample value 65535.'),
        })
        .describe('Height range in meters the PNG16 samples map onto.'),
    })
    .describe('Elevation tiles.'),
  surface: z
    .strictObject({
      seaLevel: z
        .number()
        .finite()
        .describe('Sea level in meters within the elevation height range (default 0).')
        .default(0),
      layers: z
        .array(surfaceLayer)
        .describe('Surface layers painted by auto banding, in order.')
        .default([]),
    })
    .describe('Surface shading settings.')
    .optional(),
  landcover: z
    .strictObject({
      source: archiveSource.describe('Archive holding the landcover tiles.'),
      encoding: z
        .enum(['mvt', 'png8'])
        .describe("Tile encoding: 'mvt' (Mapbox vector tiles) or 'png8' (indexed PNG)."),
      layer: z
        .literal('landcover')
        .describe("MVT layer name; always 'landcover'.")
        .default('landcover'),
      profile: z
        .literal('protomaps-basemap@1')
        .describe("Attribute profile of the tiles; always 'protomaps-basemap@1' when set.")
        .optional(),
    })
    .describe('Optional semantic landcover classification tiles.')
    .optional(),
  features: z
    .strictObject({
      source: archiveSource.describe('Archive holding the feature tiles.'),
      encoding: z.literal('mvt').describe("Tile encoding; always 'mvt'."),
      layers: z
        .array(z.enum(['water', 'transportation', 'building', 'poi']))
        .min(1)
        .describe('MVT feature layers included (unique; at least one).'),
      profile: z
        .literal('protomaps-basemap@1')
        .describe("Attribute profile of the tiles; always 'protomaps-basemap@1' when set.")
        .optional(),
    })
    .describe('Optional vector feature tiles (water, roads, buildings).')
    .optional(),
  models: z
    .strictObject({
      index: packagePath.describe('Package-relative path of the model placement index.'),
    })
    .describe('Optional placed 3D models.')
    .optional(),
  preset: z
    .enum(['1gb', '5gb', '20gb'])
    .describe('Size preset the package was compiled with (drives default streaming budgets).')
    .optional(),
  attribution: z
    .array(
      z.strictObject({
        text: z.string().min(1).describe('Attribution text to display.'),
        license: z.string().min(1).describe("License identifier, e.g. 'CC-BY-4.0'."),
        sourceUrl: z.url().describe('URL of the data source.').optional(),
        licenseUrl: z.url().describe('URL of the license text.').optional(),
      }),
    )
    .min(1)
    .describe('Data attributions (at least one).'),
  provenance: z
    .strictObject({
      compiler: z.string().min(1).describe('Tool that compiled the package.'),
      compilerVersion: z.string().min(1).describe('Version of the compiler.'),
      sources: z
        .array(
          z.strictObject({
            id: z.string().min(1).describe('Source dataset id.'),
            release: z.string().min(1).describe('Source dataset release/version.'),
            sha256: z
              .string()
              .regex(/^[0-9a-f]{64}$/i)
              .describe('Hex sha256 of the source dataset.')
              .optional(),
          }),
        )
        .min(1)
        .describe('Source datasets the package was compiled from (at least one).'),
    })
    .describe('How and from what the package was built.'),
  files: z
    .array(
      z.strictObject({
        path: packagePath.describe('Package-relative file path.'),
        sha256: z
          .string()
          .regex(/^[0-9a-f]{64}$/i)
          .describe('Hex sha256 of the file.'),
        bytes: z.int().nonnegative().describe('File size in bytes.'),
      }),
    )
    .describe('Checksum/size records for every content file (paths unique).')
    .default([]),
});

function validateTerrainPackage(data: unknown): ValidationIssue[] {
  const pkg = data as {
    coordinateSpace: {
      kind: 'local' | 'geospatial';
      crs?: 'EPSG:3857' | 'EPSG:4326';
      bounds: number[];
    };
    tileMatrix: { minLevel: number; maxLevel: number };
    elevation: {
      height: { min: number; max: number };
      source: { path: string } | { url: string };
    };
    surface?: {
      seaLevel: number;
      layers: Array<{
        auto?: { heightMin?: number; heightMax?: number; slopeMin?: number; slopeMax?: number };
      }>;
    };
    landcover?: { source: { path: string } | { url: string } };
    features?: { source: { path: string } | { url: string }; layers: string[] };
    models?: { index: string };
    files: Array<{ path: string }>;
  };
  const issues: ValidationIssue[] = [];
  const [west, south, east, north] = pkg.coordinateSpace.bounds;
  if ((west as number) >= (east as number) || (south as number) >= (north as number)) {
    issues.push({
      path: '/coordinateSpace/bounds',
      code: 'bounds_order',
      message: 'bounds must be ordered [minX/minLon, minZ/minLat, maxX/maxLon, maxZ/maxLat]',
    });
  }
  if (pkg.coordinateSpace.kind === 'geospatial') {
    const latitudeLimit = pkg.coordinateSpace.crs === 'EPSG:3857' ? 85.0511287798066 : 90;
    if (
      (west as number) < -180 ||
      (east as number) > 180 ||
      (south as number) < -latitudeLimit ||
      (north as number) > latitudeLimit
    ) {
      issues.push({
        path: '/coordinateSpace/bounds',
        code: 'geospatial_bounds',
        message: `geospatial bounds must fit longitude [-180,180] and latitude [-${latitudeLimit},${latitudeLimit}] for ${pkg.coordinateSpace.crs}`,
      });
    }
  }
  if (pkg.tileMatrix.minLevel > pkg.tileMatrix.maxLevel) {
    issues.push({
      path: '/tileMatrix',
      code: 'level_order',
      message: 'tileMatrix.minLevel must be less than or equal to maxLevel',
    });
  }
  if (pkg.elevation.height.min >= pkg.elevation.height.max) {
    issues.push({
      path: '/elevation/height',
      code: 'height_range',
      message: 'elevation.height.min must be less than max',
    });
  }
  if (
    pkg.surface !== undefined &&
    (pkg.surface.seaLevel < pkg.elevation.height.min ||
      pkg.surface.seaLevel > pkg.elevation.height.max)
  ) {
    issues.push({
      path: '/surface/seaLevel',
      code: 'sea_level_range',
      message: 'surface.seaLevel must fit inside the elevation height range',
    });
  }
  for (let index = 0; index < (pkg.surface?.layers.length ?? 0); index++) {
    const auto = pkg.surface?.layers[index]?.auto;
    if (
      auto?.heightMin !== undefined &&
      auto.heightMax !== undefined &&
      auto.heightMin > auto.heightMax
    ) {
      issues.push({
        path: `/surface/layers/${index}/auto`,
        code: 'height_band_order',
        message: 'heightMin must be less than or equal to heightMax',
      });
    }
    if (
      auto?.slopeMin !== undefined &&
      auto.slopeMax !== undefined &&
      auto.slopeMin > auto.slopeMax
    ) {
      issues.push({
        path: `/surface/layers/${index}/auto`,
        code: 'slope_band_order',
        message: 'slopeMin must be less than or equal to slopeMax',
      });
    }
  }
  if (
    pkg.features !== undefined &&
    new Set(pkg.features.layers).size !== pkg.features.layers.length
  ) {
    issues.push({
      path: '/features/layers',
      code: 'duplicate_feature_layer',
      message: 'feature layer names must be unique',
    });
  }
  const declared = new Set(pkg.files.map((file) => file.path));
  const archiveSources = [pkg.elevation.source, pkg.landcover?.source, pkg.features?.source].filter(
    (source): source is { path: string } | { url: string } => source !== undefined,
  );
  const sources = [
    ...archiveSources.flatMap((source) => ('path' in source ? [source.path] : [])),
    pkg.models?.index,
  ].filter((path): path is string => path !== undefined);
  for (const path of sources) {
    if (!declared.has(path)) {
      issues.push({
        path: '/files',
        code: 'missing_file_record',
        message: `content source "${path}" needs a checksum/size record in files`,
      });
    }
  }
  if (declared.size !== pkg.files.length) {
    issues.push({
      path: '/files',
      code: 'duplicate_file_record',
      message: 'file record paths must be unique',
    });
  }
  return issues;
}

export function registerTerrainPackageSchema(): void {
  registerSchema('terrain-package', terrainPackageSchema, {
    id: 'molen/terrain-package@1',
    title: 'Terrain package manifest',
    description:
      'Installable tiled-world package: coordinate space, elevation, optional semantic layers, provenance, and checksums.',
    examples: [
      {
        format: 'molen/terrain-package@1',
        name: 'earth-lite',
        version: '2026.08',
        coordinateSpace: {
          kind: 'geospatial',
          crs: 'EPSG:3857',
          bounds: [-180, -85.05112878, 180, 85.05112878],
        },
        tileMatrix: { scheme: 'xyz', minLevel: 0, maxLevel: 8 },
        elevation: {
          source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
          encoding: 'png16',
          height: { min: -500, max: 9000 },
        },
        surface: {
          seaLevel: 0,
          layers: [
            { name: 'grass', color: '#527346', tiling: 24, auto: { heightMin: 2 } },
            { name: 'rock', color: '#77766e', tiling: 10, auto: { slopeMin: 0.1 } },
          ],
        },
        landcover: {
          source: { kind: 'pmtiles', path: 'world.pmtiles' },
          encoding: 'mvt',
          layer: 'landcover',
          profile: 'protomaps-basemap@1',
        },
        features: {
          source: { kind: 'pmtiles', path: 'world.pmtiles' },
          encoding: 'mvt',
          layers: ['water', 'transportation', 'building'],
          profile: 'protomaps-basemap@1',
        },
        preset: '1gb',
        attribution: [
          {
            text: 'Example terrain data',
            license: 'CC-BY-4.0',
            sourceUrl: 'https://example.com/terrain',
          },
        ],
        provenance: {
          compiler: 'example terrain compiler',
          compilerVersion: '0.1.0',
          sources: [{ id: 'example-dem', release: '2026-08' }],
        },
        files: [
          {
            path: 'elevation.pmtiles',
            sha256: '0000000000000000000000000000000000000000000000000000000000000000',
            bytes: 1024,
          },
          {
            path: 'world.pmtiles',
            sha256: '1111111111111111111111111111111111111111111111111111111111111111',
            bytes: 2048,
          },
        ],
      },
    ],
    docsRef: 'schemas/terrain-package.md',
    validate: validateTerrainPackage,
  });
}
