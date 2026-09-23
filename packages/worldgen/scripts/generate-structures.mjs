/** Generate the 120-entry default structure resource index and runtime archstyles.
 * Run with --check in CI. Each source lives in source/structures/<thing>/.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from './format-json.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { REFERENCES, STRUCTURE_ORDER, TAXONOMIES } from './structure-catalog-data.mjs';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/worldgen');
const sourceDir = resolve(packDir, 'source/structures');
const check = process.argv.includes('--check');
const root = JSON.parse(await readFile(resolve(packDir, 'stylepack.json'), 'utf8'));
const outputs = new Map();

async function loadStructureSources() {
  const structures = [];
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(sourceDir, entry.name);
    const manifest = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
    const catalog = JSON.parse(await readFile(resolve(directory, 'catalog.json'), 'utf8'));
    if (manifest.id !== catalog.style || manifest.kind !== 'worldgen-structure') {
      throw new Error(`${directory}: source manifest and catalog identity differ`);
    }
    const recipePath = resolve(directory, 'recipe.json');
    const archstylePath = resolve(directory, 'archstyle.json');
    const recipe = await readFile(recipePath, 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    const archstyle =
      recipe === undefined ? JSON.parse(await readFile(archstylePath, 'utf8')) : undefined;
    structures.push({ catalog, recipe, archstyle });
  }
  const order = new Map(STRUCTURE_ORDER.map((id, index) => [id, index]));
  structures.sort((a, b) => {
    const aId = a.recipe?.id;
    const bId = b.recipe?.id;
    return (
      (order.get(aId) ?? Number.MAX_SAFE_INTEGER) - (order.get(bId) ?? Number.MAX_SAFE_INTEGER) ||
      a.catalog.style.localeCompare(b.catalog.style)
    );
  });
  return structures;
}
const range = (value, spread = 0) => ({
  min: +(value - spread).toFixed(3),
  max: +(value + spread).toFixed(3),
});
const palette = (color) => ({
  entries: [{ color, weight: 1 }],
  jitter: { hue: 0.008, saturation: 0.025, lightness: 0.025 },
});
const material = (name, part, scale = MATERIAL_REPEAT_METERS[name] ?? [2, 2]) => ({
  choices: [
    {
      ref: name.startsWith('#') ? `palette:${name}` : `matgraph:molen.worldgen.material.${name}`,
      weight: 1,
    },
  ],
  ...(part ? { palette: part } : {}),
  tint: part ? 'multiply' : 'none',
  uv: 'meters',
  uvScale: scale,
  uvOffset: 'meters',
  uvMirror: false,
});
const roofColors = {
  tile_ceramic: '#b98668',
  tile_flat: '#a98a73',
  tile_glazed: '#717b77',
  tile_mosaic: '#aaa68c',
  shingle_cedar: '#9b8b6e',
  thatch: '#beab7f',
  slate: '#727b81',
  shingle_asphalt: '#747574',
  membrane: '#a2a69e',
  metal_corrugated: '#a2a9a3',
  metal_standing_seam: '#839390',
  metal_copper: '#8ba698',
  wood_vertical: '#9e8865',
};
const residential = new Set(['house', 'townhouse', 'farmhouse', 'bungalow', 'cabin', 'apartments']);

function classesFor(entry) {
  const classes = [entry.id, entry.type];
  if (residential.has(entry.type)) classes.push('residential');
  if (['house', 'farmhouse', 'bungalow', 'cabin'].includes(entry.type))
    classes.push('house', 'detached');
  if (entry.type === 'townhouse') classes.push('terrace');
  if (entry.type === 'retail') classes.push('shop');
  return [...new Set(classes)];
}

function makeStyle(entry) {
  const levelsLimit = Math.max(3, entry.levels);
  const floorHeight = entry.floorHeight ?? 2.95;
  const flat = { type: 'flat', weight: 1, parapet: { height: range(0.4), thickness: 0.24 } };
  const details = {
    ...(entry.shutters ? { shutters: true } : {}),
    ...(entry.balconies
      ? {
          balconies: {
            depth: entry.balconyDepth ?? 0.75,
            railing: entry.balconies,
            every: entry.balconyEvery ?? 1,
          },
        }
      : {}),
    ...(entry.framing
      ? {
          framing: {
            style: entry.framing,
            width: entry.frameWidth ?? (entry.framing === 'timber' ? 0.17 : 0.23),
          },
        }
      : {}),
    ...(entry.awnings ? { awnings: { depth: entry.awnings } } : {}),
    ...(entry.veranda ? { veranda: { depth: entry.veranda, columns: true } } : {}),
  };
  return {
    format: 'molen/archstyle@1',
    id: `molen.worldgen.catalog.${entry.id}`,
    title: entry.title,
    doc: `${entry.description} Parametric interpretation: outline, height, floor count and seed remain caller-controlled; large or unusually tall outlines use a compatible flat-roof fallback.`,
    version: 1,
    applicability: {
      classes: classesFor(entry),
      areaMin: 12,
      notes: 'Regional precedent is descriptive; explicit style requests work in every world.',
    },
    massing: {
      floorHeight: range(floorHeight, 0.1),
      heightFallback: [{ levels: range(entry.levels) }],
      groundFit: 'platform-average',
      foundation: { height: range(entry.foundation ?? 0.35, 0.05), exposeOnSlope: true },
      wings: {
        split: 'rectangles',
        maxWingSpan: Math.max(20, entry.depth + 2),
        minWingArea: 5,
        secondaryHeightScale: range(1),
      },
      setbacks: [],
      respectMinHeight: true,
    },
    roof: {
      perWing: true,
      ridge: entry.ridge ?? 'long-axis',
      overhang: range(entry.overhang ?? (entry.roof === 'flat' ? 0 : 0.45)),
      complexFootprint: 'wings',
      choices:
        entry.roof === 'flat'
          ? [flat]
          : [
              {
                type: entry.roof,
                weight: 1,
                pitchDeg: range(entry.pitch, 1),
                ...(entry.lowerPitch ? { lowerPitchDeg: range(entry.lowerPitch, 1) } : {}),
                when: { levelsMax: levelsLimit },
              },
              { ...flat, when: { levelsMin: levelsLimit + 1 } },
            ],
      fallback: 'flat',
      ...(entry.dormers
        ? {
            features: {
              dormers: {
                probability: 1,
                perRidgeMeters: entry.roof === 'mansard' ? 4.5 : 5.5,
                style: 'gable',
              },
            },
          }
        : {}),
    },
    facade: {
      bays: { width: range(entry.bay ?? 3, 0.08), cornerMargin: 0.5 },
      windows: {
        style: entry.windowStyle ?? 'punched',
        width: range(entry.windowWidth ?? 1.15, 0.03),
        height: range(entry.windowHeight ?? 1.35, 0.03),
        sill: range(0.82),
        probabilityPerBay: entry.windowProbability ?? 1,
        groundFloor: entry.groundWindows ?? (entry.store ? 'storefront' : 'same'),
      },
      bands: {
        base: { height: range(entry.foundation ?? 0.32) },
        floorLines: entry.floorLines ?? false,
        cornice: { height: entry.cornice ?? 0.16 },
      },
      ...(Object.keys(details).length ? { details } : {}),
    },
    materials: {
      wall: material(entry.wall, 'wall'),
      roof: material(entry.roofMaterial, 'roof'),
      trim: material('#ffffff', 'trim'),
      foundation: material('stone', 'foundation'),
      window: {
        choices: [
          {
            ref: `matgraph:molen.worldgen.material.${entry.windowStyle === 'grid' || entry.windowStyle === 'ribbon' ? 'window_grid' : 'window_punched'}`,
            weight: 1,
          },
        ],
        tint: 'none',
        uv: 'cell',
        uvOffset: 'none',
        uvMirror: false,
      },
    },
    palettes: {
      wall: palette(entry.color),
      roof: palette(roofColors[entry.roofMaterial] ?? '#8b887a'),
      trim: palette(entry.trim ?? (entry.framing === 'timber' ? '#70624e' : '#dfd7c2')),
      foundation: palette('#b4aa93'),
    },
    props: entry.chimney
      ? [
          {
            id: 'chimney',
            model: 'molen.worldgen.prop.chimney.brick',
            anchor: 'roof-ridge',
            probability: 1,
            count: range(1),
            roof: ['gable', 'hip'],
            spacing: 4,
            margin: 1,
            scale: range(0.9),
            yaw: 'align-wall',
            lodTier: 0,
          },
        ]
      : [],
    lod: {
      tiers: [
        {
          minTier: 0,
          keep: ['roof-shape', 'roof-features', 'facade-texture', 'facade-bands', 'props'],
        },
        { minTier: 1, keep: ['roof-shape', 'facade-texture', 'facade-bands'] },
        { minTier: 2, keep: ['roof-shape'] },
      ],
    },
  };
}

const entries = [];
const recipes = [];
for (const source of await loadStructureSources()) {
  const doc = source.recipe === undefined ? source.archstyle : makeStyle(source.recipe);
  if (doc.id !== source.catalog.style) {
    throw new Error(`${source.catalog.style}: generated archstyle id ${doc.id} differs`);
  }
  root.styles[doc.id] = source.catalog.output;
  outputs.set(source.catalog.output, doc);
  const { output: _output, ...catalogEntry } = source.catalog;
  entries.push(catalogEntry);
  if (source.recipe !== undefined) recipes.push(source.recipe);
}

const materialNames = new Set(recipes.flatMap((entry) => [entry.wall, entry.roofMaterial]));
// Keep all standard resources registered, including variants intended for caller-authored styles.
for (const name of [
  'brick_flemish',
  'brick_stack',
  'brick_longformat',
  'brick_glazed',
  'wood_board_batten',
  'wood_vertical',
  'wood_log',
  'wood_shou_sugi_ban',
  'wood_weatherboard',
  'bamboo',
  'slate',
  'shingle_cedar',
  'thatch',
  'tile_flat',
  'tile_glazed',
  'tile_mosaic',
  'metal_standing_seam',
  'metal_corrugated',
  'metal_copper',
  'stone_ashlar',
  'stone_limestone',
  'stone_sandstone',
  'stone_basalt',
  'stone_drywall',
  'earth_adobe',
  'earth_rammed',
  'plaster_lime',
  'plaster_tadelakt',
  'concrete_boardformed',
  'terracotta_screen',
])
  materialNames.add(name);
for (const name of [...materialNames].sort())
  root.materials[`molen.worldgen.material.${name}`] = `materials/${name}.matgraph.json`;
const directRules = recipes.map((entry) => ({
  when: { class: [entry.id] },
  style: `molen.worldgen.catalog.${entry.id}`,
}));
const namedClasses = [
  'boathouse',
  'fire_station',
  'library',
  'train_station',
  'workshop',
  'clinic',
  'marketplace',
];
for (const type of namedClasses) {
  const entry = entries.find((candidate) => !candidate.existing && candidate.type === type);
  directRules.push({ when: { class: [type] }, style: entry.style });
}
const managedRules = new Set(directRules.map((rule) => JSON.stringify(rule.when)));
root.defaults.rules = [
  ...directRules,
  ...root.defaults.rules.filter((rule) => !managedRules.has(JSON.stringify(rule.when))),
];
root.doc =
  '120 resizable real-world structure interpretations across 13 architectural taxonomies, with 45 reusable standard material graphs. Catalog metadata, dimensions and source references are in structures/catalog.json. Explicit structure labels and regional identity-based rules select the same shipped archstyles.';
entries.sort(
  (a, b) =>
    TAXONOMIES.findIndex((group) => group.id === a.taxonomy) -
      TAXONOMIES.findIndex((group) => group.id === b.taxonomy) ||
    a.title.localeCompare(b.title, 'en'),
);
if (entries.length !== 120 || new Set(entries.map((entry) => entry.style)).size !== 120)
  throw new Error('Structure catalog must contain exactly120 unique styles');
outputs.set('stylepack.json', root);
outputs.set('structures/catalog.json', {
  format: 'molen/structure-catalog@1',
  title: 'Molen default structure collection',
  count: entries.length,
  description:
    'Original parametric interpretations of real-world building types. Canonical dimensions are model-sheet examples in meters; runtime requests control their footprint, height, levels and seed. Detail is simplified and does not reproduce site-specific ornament.',
  taxonomies: TAXONOMIES,
  references: REFERENCES,
  entries,
});
let stale = false;
for (const [path, value] of outputs) {
  const expected = `${formatJson(value)}\n`;
  const target = resolve(packDir, path);
  const current = await readFile(target, 'utf8').catch(() => undefined);
  if (current === expected) continue;
  if (check) {
    console.error(`Stale generated structure resource: ${path}`);
    stale = true;
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, expected);
  }
}
if (stale) process.exitCode = 1;
else
  console.log(
    `${check ? 'Checked' : 'Generated'} 120 structure catalog entries (104 additional archstyles).`,
  );
