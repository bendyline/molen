import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng16, writePmtilesArchive } from '@bendyline/molen-terrain/kernel';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const exampleDirectory = resolve(scriptDirectory, '..');
const defaultOutputDirectory = resolve(exampleDirectory, 'public/terrain/sammamish');
const defaultDetailBounds = [-122.12, 47.55, -121.95, 47.7];
const defaultCoverageBounds = [-123.15, 46.95, -120.9, 48.3];
const defaultVectorUrl = 'https://build.protomaps.com/20260906.pmtiles';
const defaultElevationTemplate =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const heightRange = { min: -6000, max: 5000 };

function formatJson(value, indent = 0) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  const indentation = ' '.repeat(indent);
  const childIndentation = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((item) => item === null || typeof item !== 'object')) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (indent + inline.length <= 100) return inline;
    }
    return `[\n${value
      .map((item) => `${childIndentation}${formatJson(item, indent + 2)}`)
      .join(',\n')}\n${indentation}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  return `{\n${entries
    .map(
      ([key, item]) => `${childIndentation}${JSON.stringify(key)}: ${formatJson(item, indent + 2)}`,
    )
    .join(',\n')}\n${indentation}}`;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function integerArgument(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 0 || value > 26) {
    throw new Error(`${name} must be an integer from 0 through 26`);
  }
  return value;
}

function parseBounds(value) {
  const parsed = value.split(',').map(Number);
  if (
    parsed.length !== 4 ||
    parsed.some((part) => !Number.isFinite(part)) ||
    parsed[0] >= parsed[2] ||
    parsed[1] >= parsed[3]
  ) {
    throw new Error('--bbox must be west,south,east,north');
  }
  return parsed;
}

function lonToTileX(longitude, level) {
  const count = 2 ** level;
  return Math.max(0, Math.min(count - 1, Math.floor(((longitude + 180) / 360) * count)));
}

function latToTileY(latitude, level) {
  const radians = (latitude * Math.PI) / 180;
  const count = 2 ** level;
  const normalized = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
  return Math.max(0, Math.min(count - 1, Math.floor(normalized * count)));
}

function tileAddresses(coverageBounds, detailBounds, minLevel, maxLevel, overviewMaxLevel) {
  const addresses = [];
  for (let level = minLevel; level <= maxLevel; level++) {
    const bounds = level <= overviewMaxLevel ? coverageBounds : detailBounds;
    const minX = lonToTileX(bounds[0], level);
    const maxX = lonToTileX(bounds[2], level);
    const minY = latToTileY(bounds[3], level);
    const maxY = latToTileY(bounds[1], level);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) addresses.push({ level, x, y });
    }
  }
  return addresses;
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'molen-terrain-compiler/1' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * attempt));
    }
  }
  throw lastError;
}

function decodeTerrariumPixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return image.data[offset] * 256 + image.data[offset + 1] + image.data[offset + 2] / 256 - 32768;
}

async function buildElevation(
  coverageBounds,
  detailBounds,
  minLevel,
  maxLevel,
  overviewMaxLevel,
  sourceTemplate,
) {
  const addresses = tileAddresses(
    coverageBounds,
    detailBounds,
    minLevel,
    maxLevel,
    overviewMaxLevel,
  );
  const sourceCache = new Map();
  let observedMin = Number.POSITIVE_INFINITY;
  let observedMax = Number.NEGATIVE_INFINITY;

  const loadSource = (level, x, y) => {
    const key = `${level}/${x}/${y}`;
    let pending = sourceCache.get(key);
    if (pending === undefined) {
      const url = sourceTemplate
        .replace('{z}', String(level))
        .replace('{x}', String(x))
        .replace('{y}', String(y));
      pending = fetchWithRetry(url).then((bytes) => {
        const image = PNG.sync.read(bytes);
        if (image.width !== 256 || image.height !== 256) {
          throw new Error(`${url} returned ${image.width}x${image.height}; expected 256x256`);
        }
        return image;
      });
      sourceCache.set(key, pending);
    }
    return pending;
  };

  const output = new Array(addresses.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < addresses.length) {
      const index = nextIndex++;
      const address = addresses[index];
      const [center, east, south, southeast] = await Promise.all([
        loadSource(address.level, address.x, address.y),
        loadSource(address.level, address.x + 1, address.y),
        loadSource(address.level, address.x, address.y + 1),
        loadSource(address.level, address.x + 1, address.y + 1),
      ]);
      const normalized = new Float32Array(257 * 257);
      for (let y = 0; y <= 256; y++) {
        for (let x = 0; x <= 256; x++) {
          const image = y === 256 ? (x === 256 ? southeast : south) : x === 256 ? east : center;
          const sourceX = x === 256 ? 0 : x;
          const sourceY = y === 256 ? 0 : y;
          const height = decodeTerrariumPixel(image, sourceX, sourceY);
          observedMin = Math.min(observedMin, height);
          observedMax = Math.max(observedMax, height);
          normalized[y * 257 + x] = Math.max(
            0,
            Math.min(1, (height - heightRange.min) / (heightRange.max - heightRange.min)),
          );
        }
      }
      output[index] = {
        z: address.level,
        x: address.x,
        y: address.y,
        data: encodePng16({ width: 257, height: 257, data: normalized }),
      };
      if ((index + 1) % 20 === 0 || index + 1 === addresses.length) {
        console.log(`  elevation ${index + 1}/${addresses.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, addresses.length) }, () => worker()));
  if (observedMin < heightRange.min || observedMax > heightRange.max) {
    throw new Error(
      `observed elevation ${observedMin.toFixed(1)}..${observedMax.toFixed(1)}m exceeds configured range`,
    );
  }
  return { entries: output, observedMin, observedMax, tileCount: addresses.length };
}

async function run(command, arguments_) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, { stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolveRun() : reject(new Error(`${command} exited with code ${code}`)),
    );
  });
}

async function hashFile(path) {
  const bytes = await readFile(path);
  return { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function replaceFile(path, bytes) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, bytes);
  await rm(path, { force: true });
  await rename(temporaryPath, path);
}

const outputDirectory = resolve(argument('--output', defaultOutputDirectory));
const pmtilesCli = argument('--pmtiles-cli', process.env.PMTILES_CLI);
if (pmtilesCli === undefined) {
  throw new Error('--pmtiles-cli or PMTILES_CLI must point to the pinned go-pmtiles executable');
}
const detailBounds = parseBounds(argument('--bbox', defaultDetailBounds.join(',')));
const coverageBounds = parseBounds(argument('--coverage-bbox', defaultCoverageBounds.join(',')));
const minLevel = integerArgument('--min-level', 8);
const maxLevel = integerArgument('--max-level', 15);
const elevationMaxLevel = integerArgument('--elevation-max-level', Math.min(maxLevel, 14));
if (elevationMaxLevel < minLevel || elevationMaxLevel > maxLevel) {
  throw new Error('--elevation-max-level must be between min-level and max-level');
}
const overviewMaxLevel = integerArgument('--overview-max-level', 10);
if (minLevel > maxLevel) throw new Error('--min-level cannot exceed --max-level');
if (overviewMaxLevel < minLevel || overviewMaxLevel >= elevationMaxLevel) {
  throw new Error('--overview-max-level must be at least min-level and below elevation-max-level');
}
const vectorUrl = argument('--vector-url', defaultVectorUrl);
const elevationTemplate = argument('--elevation-template', defaultElevationTemplate);

await mkdir(outputDirectory, { recursive: true });
const vectorPath = resolve(outputDirectory, 'world.pmtiles');
const vectorTemporaryPath = `${vectorPath}.tmp`;
console.log(`Extracting Protomaps vectors for ${detailBounds.join(',')}...`);
if (process.argv.includes('--skip-vector')) {
  await readFile(vectorPath);
  console.log('  using existing world.pmtiles');
} else {
  await rm(vectorTemporaryPath, { force: true });
  // `pmtiles extract` has no --minzoom, so the output keeps every zoom from 0 to --maxzoom.
  // That is more than the app reads: the Protomaps `landcover` layer only exists at zoom 0-7,
  // and `earth`/`boundaries`/`places` are low-zoom context layers. They come with their own
  // licenses (landcover is CC-BY 4.0, not ODbL), so LICENSES.md, SOURCES.json and the manifest's
  // attribution[] below credit what the archive actually contains, not just what is rendered.
  // If you ever narrow the extract, narrow those three lists in the same commit.
  await run(pmtilesCli, [
    'extract',
    vectorUrl,
    vectorTemporaryPath,
    `--bbox=${detailBounds.join(',')}`,
    `--maxzoom=${maxLevel}`,
  ]);
  await rm(vectorPath, { force: true });
  await rename(vectorTemporaryPath, vectorPath);
}

console.log(
  `Compiling Mapzen Terrarium elevation at levels ${minLevel}-${elevationMaxLevel} (overview through ${overviewMaxLevel})...`,
);
const elevation = await buildElevation(
  coverageBounds,
  detailBounds,
  minLevel,
  elevationMaxLevel,
  overviewMaxLevel,
  elevationTemplate,
);
// The shared molen writer emits leaf directories as needed, so larger regions stay readable.
const elevationArchive = writePmtilesArchive(elevation.entries, {
  tileType: 'png',
  bounds: coverageBounds,
  center: [
    (coverageBounds[0] + coverageBounds[2]) / 2,
    (coverageBounds[1] + coverageBounds[3]) / 2,
    Math.min(elevationMaxLevel, minLevel + 2),
  ],
  metadata: {
    name: 'Sammamish elevation',
    type: 'baselayer',
    format: 'png',
    bounds: coverageBounds.join(','),
    minzoom: String(minLevel),
    maxzoom: String(elevationMaxLevel),
    attribution: 'Mapzen; terrain data courtesy of the U.S. Geological Survey',
  },
});
const elevationPath = resolve(outputDirectory, 'elevation.pmtiles');
await replaceFile(elevationPath, elevationArchive);

const sourceLock = {
  format: 'molen/terrain-sources@1',
  coverageBounds,
  detailBounds,
  elevation: {
    id: 'mapzen-terrain-tiles',
    urlTemplate: elevationTemplate,
    encoding: 'terrarium',
    minLevel,
    maxLevel: elevationMaxLevel,
    overviewMaxLevel,
    outputEncoding: 'png16',
    outputHeightRange: heightRange,
    observedHeightRange: [elevation.observedMin, elevation.observedMax],
    attribution: 'Mapzen; terrain data courtesy of the U.S. Geological Survey',
    licenseReference: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
  },
  features: {
    id: 'protomaps-basemap',
    release: '2026-09-06T09:11:11.176Z',
    url: vectorUrl,
    profile: 'protomaps-basemap@1',
    maxLevel,
    attribution: '© OpenStreetMap contributors',
    extractMinLevel: 0,
    layersPresent: [
      'boundaries',
      'buildings',
      'earth',
      'landcover',
      'landuse',
      'places',
      'pois',
      'roads',
      'water',
    ],
    note: 'The extract keeps zooms 0-maxLevel, so the archive also carries layers the app never reads: landcover (zoom 0-7), earth, boundaries and places.',
    dataLicenses: [
      {
        source: 'OpenStreetMap',
        license: 'ODbL-1.0',
        attribution: '© OpenStreetMap contributors',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        appliesTo: 'roads, buildings, water, landuse, earth, boundaries, places, pois',
      },
      {
        source: 'Daylight Landcover, derived from ESA WorldCover',
        license: 'CC-BY-4.0',
        attribution:
          '© ESA WorldCover project; contains modified Copernicus Sentinel data processed by the ESA WorldCover consortium',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        appliesTo: 'landcover layer, zoom 0-7',
      },
      {
        source: 'Natural Earth',
        license: 'public domain',
        attribution: 'Natural Earth',
        licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
        appliesTo:
          'low-zoom context attributes in boundaries/places and the places minzoom configuration',
      },
    ],
    licenseReference: 'https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md',
  },
};
const sourcePath = resolve(outputDirectory, 'SOURCES.json');
await replaceFile(sourcePath, `${formatJson(sourceLock)}\n`);

// Keep this text and `examples/world-explorer/public/terrain/sammamish/LICENSES.md` identical:
// the committed package is verified byte-for-byte by `molen validate --verify-files`, so a drift
// here shows up as a checksum failure rather than as a silent attribution regression.
const licenseText = `# Data attribution

This package redistributes third-party open data. It is **not** covered by the repository's MIT
license: each dataset below keeps its own terms, and the OpenStreetMap-derived tiles are share-alike.
The repository root [NOTICE](../../../../../NOTICE.md) carries the full inventory.

- **Elevation** (\`elevation.pmtiles\`): Mapzen Terrain Tiles. United States 3DEP, GMTED2010, and
  SRTM terrain data courtesy of the U.S. Geological Survey.
- **Roads, buildings, water, land use, earth and boundaries** (\`world.pmtiles\`):
  © OpenStreetMap contributors, distributed in the Protomaps Basemap under ODbL 1.0. ODbL is a
  share-alike license; a Derivative Database of these tiles must itself be offered under ODbL 1.0.
- **Landcover, zoom 0-7** (\`world.pmtiles\`, layer \`landcover\`): Daylight Landcover, derived from
  the ESA WorldCover dataset. © ESA WorldCover project; contains modified Copernicus Sentinel data
  processed by the ESA WorldCover consortium. Available under CC BY 4.0
  (<https://creativecommons.org/licenses/by/4.0/>). This layer is present at zoom 0-7 because the
  bbox extract keeps every zoom; the app does not render it.
- **Natural Earth**: public domain, no permission or credit required. The archive's own metadata
  describes its contents as "Basemap layers derived from OpenStreetMap and Natural Earth", and the
  \`boundaries\` layer carries Natural Earth's \`brk_a3\` attribute.

The producers document the per-source terms and the exact credit strings: Protomaps
[LICENSE_DATA.md](https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md) for the vector
layers, Tilezen joerd
[docs/attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) for the
elevation tiles. \`SOURCES.json\` records which layers this archive actually contains.

The elevation tiles were converted from Terrarium RGB into molen PNG16 tiles and given one shared
border sample on the east and south edges. They are not suitable for navigation.
`;
const licensePath = resolve(outputDirectory, 'LICENSES.md');
await replaceFile(licensePath, licenseText);

const files = await Promise.all(
  ['elevation.pmtiles', 'world.pmtiles', 'SOURCES.json', 'LICENSES.md'].map(async (path) => ({
    path,
    ...(await hashFile(resolve(outputDirectory, path))),
  })),
);
const manifest = {
  format: 'molen/terrain-package@1',
  name: 'Sammamish, Washington',
  version: '2026-09-06',
  coordinateSpace: {
    kind: 'geospatial',
    crs: 'EPSG:3857',
    ellipsoid: 'WGS84',
    bounds: coverageBounds,
  },
  tileMatrix: {
    scheme: 'xyz',
    minLevel,
    maxLevel,
    rootTiles: [1, 1],
    tileResolution: 257,
  },
  elevation: {
    source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
    encoding: 'png16',
    height: heightRange,
  },
  surface: {
    seaLevel: 0,
    layers: [
      { name: 'soil', color: '#655b49', tiling: 10 },
      { name: 'lowland', color: '#668354', tiling: 14, auto: { heightMin: 0, heightMax: 900 } },
      { name: 'alpine', color: '#7c786d', tiling: 18, auto: { heightMin: 900, heightMax: 2300 } },
      { name: 'snow', color: '#dce5e4', tiling: 22, auto: { heightMin: 1900 } },
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
    layers: ['water', 'transportation', 'building', 'poi'],
    profile: 'protomaps-basemap@1',
  },
  // One entry per license the archives actually carry. The explorer renders the head of each
  // `text` (up to the first ';') as an always-visible corner credit and the full list in the HUD,
  // so keep the source name first. See LICENSES.md for the reasoning and the producers' sources.
  attribution: [
    {
      text: 'Mapzen/USGS terrain tiles; Mapzen Terrain Tiles, with United States 3DEP, GMTED2010, and SRTM terrain data courtesy of the U.S. Geological Survey',
      license: 'US public domain and source-specific open-data terms',
      licenseUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    },
    {
      text: '© OpenStreetMap contributors; Protomaps Basemap',
      license: 'ODbL-1.0',
      sourceUrl: 'https://www.openstreetmap.org/copyright',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    },
    {
      text: 'Daylight Landcover; © ESA WorldCover project, modified Copernicus Sentinel data',
      license: 'CC-BY-4.0',
      sourceUrl: 'https://esa-worldcover.org/en',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    {
      text: 'Natural Earth; public domain',
      license: 'Public domain (Natural Earth terms of use)',
      sourceUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    },
  ],
  provenance: {
    compiler: 'world-explorer-sammamish-fixture',
    compilerVersion: '1',
    sources: [
      { id: 'mapzen-terrain-tiles', release: 'AWS open-data snapshot accessed 2026-08-30' },
      { id: 'protomaps-basemap', release: '2026-09-06T09:11:11.176Z' },
    ],
  },
  files,
};
await replaceFile(resolve(outputDirectory, 'terrain-package.json'), `${formatJson(manifest)}\n`);

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(
  `Built ${outputDirectory}: ${elevation.tileCount} elevation tiles, ${(totalBytes / 1_048_576).toFixed(1)} MiB, observed ${elevation.observedMin.toFixed(1)}..${elevation.observedMax.toFixed(1)}m`,
);
