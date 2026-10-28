// Deterministic, data-only authoring source. Runtime families live in molen-worldgen; these
// presets and habitat associations belong to this downloadable content pack.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  agricultureCrops,
  agricultureForHabitat,
  agricultureOverrides,
  agriculturePlants,
} from './agriculture-presets.mjs';
import { brushComposition, brushPlants } from './brush-presets.mjs';
import { plantVariants } from './plant-variants.mjs';

const root = new URL('../', import.meta.url);
const deciduous = new Set([
  'oak',
  'beech',
  'birch',
  'maple',
  'alder',
  'willow',
  'poplar',
  'larch',
  'fruit_tree',
  'grapevine',
]);
const taxa = {
  oak: ['quercus'],
  cork_oak: ['quercus suber'],
  beech: ['fagus'],
  birch: ['betula'],
  maple: ['acer'],
  alder: ['alnus'],
  willow: ['salix'],
  poplar: ['populus'],
  eucalyptus: ['eucalyptus'],
  southern_beech: ['nothofagus'],
  olive: ['olea europaea'],
  spruce: ['picea'],
  fir: ['abies'],
  pine: ['pinus'],
  stone_pine: ['pinus pinea'],
  cedar: ['thuja plicata'],
  larch: ['larix'],
  cypress: ['cupressus'],
  coconut: ['cocos nucifera', 'cocos'],
  date_palm: ['phoenix dactylifera', 'phoenix'],
};
const plant = (name, title, family, form, height, width, foliage, extra = {}) => ({
  id: `molen.ecology.plant.${name}`,
  version: 1,
  title,
  family,
  form,
  height,
  width,
  crownBase: family === 'conifer' ? 0.15 : 0.42,
  stemRadius: Math.max(0.03, height * 0.027),
  lean: 0.025,
  foliage,
  bark: '#75634c',
  ...(taxa[name] ? { taxa: taxa[name] } : {}),
  ...(deciduous.has(name)
    ? {
        phenology: {
          spring: '#9baa62',
          // Each species turns its own way: maples orange-red, birch and larch gold, beech
          // copper, oak russet, while alders barely color before they drop.
          autumn: AUTUMN[name] ?? '#a58d58',
        },
      }
    : {}),
  ...extra,
});
const AUTUMN = {
  maple: '#bd6a36',
  birch: '#c2a744',
  larch: '#c2a744',
  beech: '#ad7b3f',
  oak: '#946a40',
  alder: '#9fa04f',
};
const plants = [
  plant('oak', 'Spreading temperate oak form', 'broadleaf', 'round', 13, 12, '#688647'),
  plant('beech', 'Temperate beech form', 'broadleaf', 'round', 18, 11, '#73934e'),
  plant('birch', 'Boreal birch form', 'broadleaf', 'columnar', 13, 6, '#90a45d', {
    bark: '#c6c7af',
    crownBase: 0.28,
  }),
  plant('maple', 'East Asian maple form', 'broadleaf', 'round', 9, 9, '#719245'),
  plant(
    'warm_evergreen',
    'East Asian warm evergreen broadleaf',
    'broadleaf',
    'round',
    16,
    11,
    '#466b4a',
    { crownBase: 0.36 },
  ),
  // Neem, jamun and arjun along Delhi's avenues and in its compounds: dense, dark crowns that a
  // Sentinel-2 frame of the Central Vista reads as near-black canopy.
  plant(
    'avenue_evergreen',
    'South Asian avenue evergreen broadleaf',
    'broadleaf',
    'round',
    15,
    13,
    '#2c4630',
    { crownBase: 0.34 },
  ),
  plant('alder', 'Pacific coastal alder form', 'broadleaf', 'round', 15, 9, '#5f7f5a'),
  plant(
    'podocarp',
    'Southern evergreen conifer canopy form',
    'broadleaf',
    'columnar',
    24,
    12,
    '#5e8060',
    { crownBase: 0.55, leafType: 'needleleaved' },
  ),
  plant('willow', 'Riparian willow form', 'broadleaf', 'round', 10, 11, '#829967', {
    crownBase: 0.23,
  }),
  plant('poplar', 'Upright riparian broadleaf', 'broadleaf', 'columnar', 17, 6, '#859455', {
    crownBase: 0.2,
  }),
  plant(
    'tropical_canopy',
    'Wet tropical canopy broadleaf',
    'broadleaf',
    'umbrella',
    24,
    18,
    '#447549',
    { crownBase: 0.68 },
  ),
  plant(
    'tropical_emergent',
    'Tropical emergent broadleaf',
    'broadleaf',
    'umbrella',
    35,
    24,
    '#668449',
    { crownBase: 0.78, stemRadius: 1.1 },
  ),
  plant(
    'tropical_understory',
    'Tropical understory broadleaf',
    'broadleaf',
    'round',
    8,
    7,
    '#4c814a',
    { crownBase: 0.2 },
  ),
  plant(
    'dry_tropical',
    'Seasonally dry tropical broadleaf',
    'broadleaf',
    'umbrella',
    12,
    11,
    '#435230',
    { crownBase: 0.56 },
  ),
  plant(
    'acacia',
    'African savanna umbrella thorn form',
    'broadleaf',
    'umbrella',
    8,
    13,
    '#77915f',
    { crownBase: 0.65 },
  ),
  plant(
    'miombo',
    'Southern African open woodland broadleaf',
    'broadleaf',
    'round',
    13,
    11,
    '#88915e',
  ),
  // Desert crowns read dark olive in half-meter NAIP of Yuma's yards and the Colorado's banks
  // (about #5f6444 lit); the earlier sage tones rendered as pale lawn green from the air.
  plant('mesquite', 'American desert low woodland form', 'broadleaf', 'umbrella', 6, 9, '#5f6644', {
    crownBase: 0.42,
  }),
  plant(
    'eucalyptus',
    'Australian open eucalypt canopy',
    'broadleaf',
    'umbrella',
    22,
    14,
    '#6d8564',
    { bark: '#b9b4a1', crownBase: 0.65 },
  ),
  plant('mallee', 'Australian mallee form', 'broadleaf', 'round', 5, 6, '#91a08b', {
    bark: '#aca88f',
    crownBase: 0.15,
  }),
  plant(
    'southern_beech',
    'Southern temperate rainforest broadleaf',
    'broadleaf',
    'round',
    21,
    14,
    '#537d55',
    { crownBase: 0.4 },
  ),
  plant('olive', 'Mediterranean olive form', 'broadleaf', 'round', 6, 8, '#96a17c', {
    bark: '#8b8070',
    crownBase: 0.33,
  }),
  plant(
    'cork_oak',
    'Mediterranean evergreen oak form',
    'broadleaf',
    'umbrella',
    11,
    13,
    '#75855c',
    { bark: '#8c6f58', crownBase: 0.55 },
  ),
  plant('fruit_tree', 'Cultivated fruit tree form', 'broadleaf', 'round', 4.5, 4.5, '#7d9853', {
    crownBase: 0.3,
  }),
  plant('spruce', 'Boreal spruce form', 'conifer', 'columnar', 17, 5, '#426b56'),
  plant('fir', 'Mountain fir form', 'conifer', 'columnar', 20, 6, '#1f393a'),
  plant('pine', 'Temperate pine form', 'conifer', 'round', 18, 7, '#69844e', { crownBase: 0.32 }),
  plant('cedar', 'Pacific coastal conifer form', 'conifer', 'columnar', 29, 9, '#1a3436', {
    crownBase: 0.12,
  }),
  plant('larch', 'Boreal larch form', 'conifer', 'columnar', 16, 5, '#8b9b60'),
  plant('cypress', 'Mediterranean columnar cypress form', 'conifer', 'columnar', 17, 3, '#536f49', {
    crownBase: 0.04,
  }),
  plant(
    'stone_pine',
    'Mediterranean umbrella pine form',
    'broadleaf',
    'umbrella',
    16,
    15,
    '#647c49',
    { crownBase: 0.77, bark: '#a17a5d', leafType: 'needleleaved' },
  ),
  plant('coconut', 'Tropical coastal coconut palm form', 'palm', 'feather', 17, 10, '#7e974d', {
    stemRadius: 0.21,
    lean: 0.16,
    bark: '#a58e70',
  }),
  plant('date_palm', 'Cultivated date palm form', 'palm', 'feather', 13, 9, '#6b7652', {
    stemRadius: 0.42,
    lean: 0.015,
  }),
  plant('fan_palm', 'Warm climate fan palm form', 'palm', 'fan', 14, 7, '#5f6e44', {
    stemRadius: 0.28,
    lean: 0.01,
  }),
  plant('forest_palm', 'Tropical understory feather palm', 'palm', 'feather', 7, 6, '#5b8a52', {
    stemRadius: 0.12,
    lean: 0.08,
  }),
  plant('saguaro', 'Sonoran saguaro form', 'cactus', 'branching', 8, 4.5, '#839a76', {
    stemRadius: 0.42,
    lean: 0,
  }),
  plant(
    'column_cactus',
    'American columnar cactus form',
    'cactus',
    'columnar',
    4.8,
    0.85,
    '#88a17e',
    { stemRadius: 0.38, lean: 0 },
  ),
  plant('prickly_pear', 'American prickly pear form', 'cactus', 'paddle', 1.8, 2.7, '#8fa681', {
    stemRadius: 0.11,
    lean: 0,
  }),
  plant('barrel_cactus', 'American barrel cactus form', 'cactus', 'round', 0.9, 0.8, '#91a16d', {
    stemRadius: 0.35,
    lean: 0,
  }),
  plant('agave', 'American agave rosette form', 'succulent', 'round', 1.2, 2, '#a1b2a0'),
  plant('aloe', 'African aloe rosette form', 'succulent', 'round', 1.1, 1.6, '#99aa89'),
  plant('bamboo', 'Clumping Asian bamboo form', 'bamboo', 'columnar', 8, 4.8, '#839b51', {
    bark: '#9ba76c',
    stemRadius: 0.065,
  }),
  plant('mangrove', 'Tropical mangrove with prop roots', 'mangrove', 'round', 8, 9, '#5c8553', {
    crownBase: 0.47,
    stemRadius: 0.36,
  }),
  plant('scrub', 'Temperate scrub canopy', 'shrub', 'round', 1.8, 2.5, '#7b915b', {
    crownBase: 0.1,
    stemRadius: 0.06,
  }),
  plant('dry_scrub', 'Sparse dryland shrub', 'shrub', 'branching', 1.2, 1.8, '#a1a17c', {
    crownBase: 0.08,
    stemRadius: 0.04,
  }),
  plant('heath', 'Low heath and tundra shrub', 'shrub', 'round', 0.6, 1.3, '#8d9570', {
    crownBase: 0.02,
    stemRadius: 0.025,
  }),
  plant('chaparral', 'Mediterranean sclerophyll shrub', 'thicket', 'round', 2.5, 3.5, '#859075', {
    crownBase: 0.08,
    stemRadius: 0.09,
  }),
  plant('grass', 'Temperate meadow grass patch', 'grass', 'round', 0.65, 2.8, '#93a66a', {
    patch: true,
    bark: '#ada87b',
  }),
  plant('dry_grass', 'Dry grass tussock patch', 'grass', 'round', 0.75, 2.8, '#b6ae78', {
    patch: true,
    bark: '#b6a17c',
  }),
  plant('savanna_grass', 'Tall savanna grass patch', 'grass', 'round', 1.5, 3.6, '#c0b479', {
    patch: true,
    bark: '#b6a17c',
  }),
  plant('alpine_grass', 'Low alpine grass patch', 'grass', 'round', 0.3, 1.8, '#9ba57e', {
    patch: true,
    bark: '#a6a17d',
  }),
  plant('fern', 'Humid forest fern clump', 'fern', 'round', 0.85, 1.4, '#679454'),
  plant('reeds', 'Wetland reed patch', 'reed', 'columnar', 1.9, 3, '#9aa465', {
    patch: true,
    bark: '#b5a47b',
  }),
  plant('banana', 'Cultivated banana broad leaves', 'banana', 'paddle', 4.5, 4.5, '#78a052', {
    bark: '#a4ab72',
    stemRadius: 0.18,
  }),
  plant('oil_palm', 'Cultivated oil palm crown', 'palm', 'feather', 8, 8, '#60834b', {
    bark: '#756345',
    stemRadius: 0.4,
  }),
  plant('coffee', 'Cultivated coffee shrub', 'broadleaf', 'round', 2.5, 2.2, '#567b46', {
    crownBase: 0.1,
    stemRadius: 0.06,
  }),
  plant('tea', 'Clipped tea hedge', 'broadleaf', 'round', 1, 1.4, '#82a25f', {
    crownBase: 0.1,
    stemRadius: 0.025,
  }),
  plant('grapevine', 'Trained vineyard vine', 'broadleaf', 'umbrella', 1.4, 1.6, '#859951', {
    crownBase: 0.55,
    stemRadius: 0.045,
  }),
  plant('rubber', 'Cultivated rubber canopy', 'broadleaf', 'round', 17, 10, '#64874b', {
    crownBase: 0.55,
  }),
  plant('snag', 'Standing weathered deadwood', 'deadwood', 'branching', 7, 3.5, '#8d8271', {
    bark: '#948877',
    stemRadius: 0.3,
    lean: 0.08,
  }),
  ...brushPlants(plant),
  ...agriculturePlants(plant),
];

const basePlants = [...plants];
plants.splice(0, plants.length, ...basePlants.flatMap(plantVariants));
const refs = new Set(plants.map((entry) => entry.id));
const population = (name, weight = 1) => {
  const model = `molen.ecology.plant.${name}`;
  if (!refs.has(model)) throw new Error(`Unknown plant ${name}`);
  return {
    model,
    variants: ['', '.spreading', '.slender'].map((suffix) => ({
      model: `${model}${suffix}`,
      weight: 1,
    })),
    weight,
    scale: { min: 0.75, max: 1.2 },
    widthScale: { min: 0.85, max: 1.15 },
    yaw: 'random',
    align: 'up',
    // Enough per-plant drift that a stand is not one swatch: autumn crowns range yellow to
    // russet, conifers yellow- to blue-green, and some trees stand in deeper shade.
    tint: { hue: 0.025, saturation: 0.07, lightness: 0.08 },
  };
};
const populations = (names) =>
  names.map((entry) => (Array.isArray(entry) ? population(...entry) : population(entry)));
const colors = (ground, forest, grass) => ({
  default: ground,
  colors: {
    open_ground: ground,
    forest,
    wood: forest,
    scrub: ground,
    grassland: grass,
    grass,
    meadow: grass,
    park: grass,
    garden: grass,
    cemetery: grass,
    recreation_ground: grass,
    village_green: grass,
    golf_course: grass,
    pitch: grass,
    gravel: '#b6b0a2',
    bare_rock: '#aaa395',
    pedestrian: '#aaa79e',
    pavement: '#aaa79e',
    // Unmapped ground between a dense block's buildings: lanes, alleys, forecourts and parking,
    // a step darker than a mapped concrete plaza (matched Kyoto and Seattle frames).
    urban_ground: '#96948d',
    parking: '#747575',
    retail: '#aaa59a',
    civic: '#aaa59a',
    residential: grass,
    wetland: '#7f9272',
    farmland: '#b0a475',
    crop: '#b8ad7f',
    orchard: grass,
    vineyard: '#aaa078',
    barren: '#aca28c',
    sand: '#d0bb8c',
    beach: '#dac99e',
    snow: '#e4e9e7',
    glacier: '#d4dfe0',
    urban_area: '#a5a296',
    commercial: '#aaa59a',
    industrial: '#9d978b',
  },
});
const scatters = [],
  profiles = [];
const crops = [
  ['olive', ['olives', 'olive_trees'], 8, 7],
  ['date_palm', ['dates', 'date_palms'], 9, 9],
  ['coconut', ['coconuts', 'coconut_palms'], 9, 9],
  ['oil_palm', ['oil_palms', 'oil_palm'], 9, 8],
  ['coffee', ['coffee', 'coffea'], 3, 2.5],
  ['tea', ['tea'], 2.4, 1.8],
  ['banana', ['bananas', 'banana_plants'], 4, 4],
  ['rubber', ['rubber_trees', 'rubber'], 8, 6],
  ['grapevine', ['grapes', 'grapevines'], 3, 2],
];
const cropLabels = (aliases) => aliases.flatMap((alias) => [`crop:${alias}`, `trees:${alias}`]);
const knownCrops = crops.flatMap(([, aliases]) => cropLabels(aliases));
function habitat(name, title, match, trees, shrubs, cover, settings = {}) {
  const id = `molen.ecology.scatter.${name}`;
  const {
    priority = 10,
    forestDensity = 145,
    scrubDensity = 55,
    openDensity = 1.4,
    surface = colors('#929f73', '#53734f', '#97a46a'),
    // A regional color refinement must not change the habitat's brush/density selection.
    surfacePalette = surface,
    parkTrees = trees,
    homeTrees = parkTrees,
    parkDensity = 19,
    crownScale = 1,
    orchard = ['fruit_tree'],
    wetland = ['reeds'],
    grasslandTrees = 0,
    // Street, common-area and greenbelt canopy inside mapped residential land, beyond the
    // yard patches inferred around each home. Zero (the default) leaves it to the yards.
    residentialTrees = 0,
    // Clearance of open and residential canopy from road edges; avenue trees overhang them.
    treeRoadClearance = 5,
    openTrees = surface === desert || surface === dry || surface === cold ? 0 : 14,
    groundDensity = surface === desert ? 110 : surface === dry ? 2200 : 4200,
  } = settings;
  const brush = brushComposition(
    name,
    surface === desert ? 'desert' : surface === dry ? 'dry' : surface === wet ? 'wet' : 'temperate',
  );
  const rules = [];
  const add = (ruleId, classes, names, density, layer = 'canopy', extra = {}) => {
    if (!names.length || density <= 0) return;
    rules.push({
      id: ruleId,
      classes,
      densityPerHectare: density,
      minSpacing: layer === 'groundcover' ? 0.35 : 1.8,
      slopeMax: layer === 'groundcover' ? 0.7 : 0.85,
      populations: populations(names).map((p) =>
        layer === 'canopy'
          ? {
              ...p,
              widthScale: { min: 0.85 * crownScale, max: 1.15 * crownScale },
            }
          : p,
      ),
      layer,
      clustering: {
        scale: layer === 'groundcover' ? 35 : 135,
        threshold: 0.18,
        contrast: 1.8,
        seedOffset: 7,
      },
      ...extra,
    });
  };
  const mangrove = name === 'mangrove';
  const wildExclusions = ['orchard', 'vineyard', 'plantation', 'mangrove', ...knownCrops];
  add('forest', ['forest', 'wood'], trees, forestDensity, 'canopy', {
    notClasses: wildExclusions,
    ...(mangrove ? { nearWater: { maxDistance: 250 } } : {}),
  });
  add('scrub', ['scrub', 'heath'], shrubs, scrubDensity, 'canopy', {
    notClasses: wildExclusions,
    ...(mangrove ? { nearWater: { maxDistance: 250 } } : {}),
  });
  add('park', ['park', 'garden', 'cemetery'], parkTrees, parkDensity, 'canopy', {
    notClasses: knownCrops,
  });
  // Yards are planted lot by lot, not in forest-scale stands: denser than a park, with clustering
  // fine enough to vary between neighbours instead of blanking whole blocks. Only regions whose
  // atlas sets a tree fill factor infer yards at all.
  add('home_canopy', ['home_canopy'], homeTrees, 120, 'canopy', {
    clustering: { scale: 55, threshold: 0.12, contrast: 2.2, seedOffset: 11 },
  });
  add('residential_trees', ['residential'], homeTrees, residentialTrees, 'canopy', {
    clustering: { scale: 70, threshold: 0.2, contrast: 2.4, seedOffset: 17 },
    avoid: { buildings: 6, roads: treeRoadClearance },
  });
  add('open', ['open_ground'], shrubs, openDensity);
  // In temperate and wet habitats, unmapped ground (verges, institutional lawns, rough lots) keeps
  // a few groves of the park trees, broken up by clustering so most of it still reads as open.
  add('open_trees', ['open_ground'], parkTrees, openTrees, 'canopy', {
    clustering: { scale: 70, threshold: 0.22, contrast: 2.4, seedOffset: 13 },
    // A grown park tree's crown reaches 5–6 m; keep it clear of walls and roofs.
    avoid: { buildings: 7, roads: treeRoadClearance },
  });
  add('orchard', ['orchard'], orchard, 156.25, 'canopy', {
    rows: { spacing: 8, interval: 8, angle: 0, jitter: 0.04 },
    clustering: undefined,
    notClasses: knownCrops,
    slopeMax: 0.45,
  });
  // Observed crop tags outrank habitat; greenhouse/irrigated cultivation can be introduced.
  for (const [crop, aliases, spacing, interval] of crops) {
    add(`crop_${crop}`, cropLabels(aliases), [crop], 10_000 / (spacing * interval), 'canopy', {
      rows: { spacing, interval, angle: 0, jitter: 0.04 },
      clustering: undefined,
      minSpacing: 0.8,
      slopeMax: 0.45,
      populations: [
        {
          ...population(crop),
          scale: { min: 0.85, max: 1.05 },
          widthScale: { min: 0.9, max: 1.05 },
        },
      ],
    });
  }
  if (name !== 'ice' && name !== 'tundra' && name !== 'montane_grassland') {
    add('vineyard', ['vineyard'], ['grapevine'], 1600, 'canopy', {
      rows: { spacing: 3, interval: 2, angle: 0, jitter: 0.03 },
      minSpacing: 0.8,
      clustering: undefined,
      notClasses: knownCrops,
      slopeMax: 0.5,
    });
  }
  add('open_woodland', ['grassland', 'savanna'], trees, grasslandTrees);
  const brushClustering = {
    scale: 48,
    threshold: 0.22,
    contrast: 2,
    seedOffset: 7,
    sharedSeed: 71,
    detailScale: 7,
  };
  const naturalClasses = ['forest', 'wood', 'scrub', 'heath'];
  add('brush_layer', naturalClasses, brush.shrubs, brush.density, 'understory', {
    notClasses: wildExclusions,
    minSpacing: 0.5,
    avoid: { roads: 2, buildings: 2, water: 0.6 },
    clustering: brushClustering,
  });
  add('open_brush', ['grassland', 'savanna'], brush.shrubs, brush.density * 0.12, 'understory', {
    notClasses: wildExclusions,
    minSpacing: 0.5,
    avoid: { roads: 2, buildings: 2, water: 0.6 },
    clustering: { ...brushClustering, threshold: 0.38 },
  });
  if (brush.climbers)
    add('supported_climbers', ['forest', 'wood'], ['liana_canopy'], 14, 'canopy', {
      notClasses: wildExclusions,
    });
  add('understory', ['forest', 'wood', 'scrub'], cover, groundDensity, 'groundcover', {
    notClasses: wildExclusions,
    avoid: { roads: 0.35, buildings: 0.5, water: 0.25 },
    clustering: { ...brushClustering, detailScale: 3 },
  });
  add('herb_patches', naturalClasses, brush.herbs, groundDensity * 0.45, 'groundcover', {
    notClasses: wildExclusions,
    avoid: { roads: 0.35, buildings: 0.5, water: 0.25 },
    clustering: { ...brushClustering, detailScale: 3 },
  });
  add(
    'forest_floor',
    ['forest', 'wood'],
    brush.floor.filter((p) => p !== 'fallen_log'),
    1000,
    'groundcover',
    {
      notClasses: wildExclusions,
      avoid: { roads: 1, buildings: 1, water: 0.4 },
      clustering: { ...brushClustering, detailScale: 5 },
    },
  );
  if (brush.floor.includes('fallen_log'))
    add('forest_debris', ['forest', 'wood'], ['fallen_log'], 12, 'understory', {
      notClasses: wildExclusions,
      minSpacing: 0.5,
      avoid: { roads: 3, buildings: 3, water: 1 },
      clustering: brushClustering,
    });
  add(
    'meadow',
    ['grass', 'grassland', 'meadow'],
    [...cover, ...brush.herbs],
    surface === desert ? 180 : 4800,
    'groundcover',
    {
      avoid: { roads: 0.35, buildings: 0.5, water: 0.25 },
      clustering: { ...brushClustering, detailScale: 3 },
    },
  );
  add('wetland', ['wetland', 'marsh', 'reedbed'], wetland, 210, 'groundcover');
  if (name !== 'ice')
    add('wetland_floor', ['wetland', 'marsh', 'reedbed'], ['sedge_patch'], 1600, 'groundcover', {
      avoid: { roads: 0.35, buildings: 0.5, water: 0.25 },
      clustering: { ...brushClustering, detailScale: 3 },
    });
  // Ecological geography permits mangroves; actual mapped water/wetland constrains their belt.
  if (mangrove)
    add('mangrove_wetland', ['wetland', 'marsh'], ['mangrove'], 110, 'canopy', {
      notClasses: ['mangrove'],
    });
  add('mapped_mangrove', ['mangrove'], ['mangrove'], 120);
  const riparian =
    settings.riparian ??
    trees.filter((entry) =>
      ['willow', 'alder', 'poplar'].includes(Array.isArray(entry) ? entry[0] : entry),
    );
  add('riparian', ['forest', 'wood', 'grassland', 'scrub', 'open_ground'], riparian, 70, 'canopy', {
    nearWater: {
      maxDistance: 30,
      classes: ['river', 'stream', 'canal', 'lake', 'reservoir', 'water'],
    },
    notClasses: wildExclusions,
    slopeMax: 0.35,
  });
  scatters.push({
    format: 'molen/scatter@1',
    id,
    version: 1,
    title,
    doc: 'Representative habitat forms. Actual mapped land cover controls placement; this is not a species occurrence map.',
    surface: surfacePalette,
    defaults: {
      avoid: { roads: 5, buildings: 3, water: 1.5 },
      slopeMax: 0.8,
      // Thinned distant crowns widen so canopy still covers the ground seen from the air.
      lod: { keepByTier: [1, 0.5, 0.2, 0.065], maxInstancesPerBatch: 9000, coverGrowth: 2.2 },
    },
    rules,
  });
  profiles.push({
    id: `molen.ecology.habitat.${name}`,
    title,
    priority,
    match,
    scatter: id,
    agriculture: agricultureForHabitat(name),
  });
}

const wet = colors('#6e8065', '#406047', '#7b8b63');
// Aerial review of Bellevue's open lawn: the shared wet grass was pale yellow-green
// under the Earth sun. Cooler, deeper turf belongs to this coastal region; rough ground
// stays lighter and woodland keeps its own dark green without adding trees to open lawns.
// Matched NAIP frames of Bellevue and Sammamish: lawns, verges and woodland floor all read
// darker and bluer than the earlier palette, under near-continuous conifer canopy.
const pacificCoastal = colors('#344947', '#1a3132', '#2f5440');
Object.assign(pacificCoastal.colors, {
  scrub: '#354a40',
  grassland: '#3f5448',
  meadow: '#3f5448',
  garden: '#30523e',
  residential: '#4a6150',
  wetland: '#38524a',
});
// Matched orthophotos (Yuma NAIP, Delhi Sentinel-2): dry soil, gravel yards and scrub read a
// warm mid brown, not pale sand; daylight-balanced, the earlier palette rendered grey-cream.
const dry = colors('#8e836a', '#56664a', '#968f6b');
const desert = colors('#887b63', '#4f5a3c', '#8c8562');
// Managed planting is not the potential dry biome. Keep verges dry and parks irrigated.
for (const surface of [dry, desert]) {
  Object.assign(surface.colors, {
    park: '#6d784e',
    garden: '#6a7650',
    cemetery: '#757d58',
    grass: '#7c8059',
    residential: '#867b64',
    sand: '#ad9f84',
    barren: '#958a74',
    // Dry-country wetland is riparian thicket (tamarisk, mesquite, willow): the Colorado's
    // banks at Yuma read dark olive canopy in NAIP, not the shared pale marsh green.
    wetland: '#4f5a3c',
  });
}
// Irrigated city lawns and paler concrete in dry coastal cities (matched Sydney frames).
Object.assign(dry.colors, {
  park: '#6f8256',
  garden: '#6c7f55',
  grass: '#7a875f',
  urban_ground: '#a5a5a0',
});
// Matched Yuma frames: desert parks and grass read olive-tan, mostly unwatered scrub.
Object.assign(desert.colors, {
  park: '#77724f',
  garden: '#6d7350',
  cemetery: '#7a7a58',
  grass: '#7f7a57',
});
// Ground detail, [brush, bare]: the shrub speckle and worn bare patches orthophotos show where
// placing every creosote or saltbush is impossible, plus vacant and dirt lots between yards.
desert.detail = {
  open_ground: [0.6, 0.45],
  scrub: [0.85, 0.2],
  heath: [0.7, 0.2],
  grassland: [0.45, 0.3],
  meadow: [0.3, 0.2],
  barren: [0.25, 0.35],
  sand: [0.12, 0.25],
  park: [0.35, 0.15],
  residential: [0.12, 0.55],
  industrial: [0.05, 0.45],
  commercial: [0.02, 0.3],
};
dry.detail = {
  open_ground: [0.4, 0.35],
  scrub: [0.75, 0.15],
  heath: [0.6, 0.15],
  grassland: [0.25, 0.25],
  barren: [0.2, 0.3],
  residential: [0.1, 0.35],
  industrial: [0.04, 0.4],
};
// Delhi under Sentinel-2: dusty dark-brown ground and olive lawns between dense canopy.
// Surface reflectance there is low (about 0.08 across the Central Vista frame): dust, smog-dulled
// paving and dark canopy, so the palette sits a step darker than other dry cities.
const aravalli = colors('#625741', '#45523a', '#716a4e');
Object.assign(aravalli.colors, {
  park: '#525935',
  garden: '#525935',
  cemetery: '#595b39',
  grass: '#5b5a38',
  residential: '#5f5543',
  // Buff sandstone, red gravel and dust: Central Vista's paving reads warm, not grey.
  pedestrian: '#8a765a',
  pavement: '#8a765a',
  urban_ground: '#6b5c46',
  civic: '#86735d',
  commercial: '#837562',
  retail: '#837562',
  industrial: '#787061',
  urban_area: '#797061',
  parking: '#69635a',
  sand: '#8f8268',
  barren: '#736a57',
});
aravalli.detail = {
  open_ground: [0.3, 0.35],
  scrub: [0.7, 0.15],
  grassland: [0.25, 0.25],
  barren: [0.15, 0.3],
  residential: [0.08, 0.35],
};
const cold = colors('#929b81', '#57745d', '#9eaa85');
habitat('ice', 'Bare rock and ice', { biomes: [0] }, [], [], [], {
  forestDensity: 0,
  openDensity: 0,
  orchard: [],
  wetland: [],
  surface: colors('#b8bab0', '#8c9784', '#a6af99'),
});
habitat(
  'rainforest',
  'Tropical moist forest',
  { biomes: [1] },
  [['tropical_canopy', 5], 'tropical_emergent', 'forest_palm'],
  ['tropical_understory'],
  ['fern'],
  { surface: wet, forestDensity: 190 },
);
habitat(
  'dry_forest',
  'Tropical seasonally dry forest',
  { biomes: [2] },
  ['dry_tropical'],
  ['scrub'],
  ['dry_grass'],
  { surface: dry, crownScale: 1.25 },
);
habitat(
  'tropical_conifers',
  'Tropical conifer forest',
  { biomes: [3] },
  ['pine'],
  ['scrub'],
  ['grass'],
  { forestDensity: 145 },
);
habitat(
  'temperate',
  'Temperate broadleaf and mixed forest',
  { biomes: [4] },
  [['oak', 3], ['beech', 2], 'birch'],
  ['scrub'],
  ['grass', 'fern'],
);
habitat(
  'temperate_conifers',
  'Temperate conifer forest',
  { biomes: [5] },
  [
    ['pine', 2],
    ['fir', 2],
  ],
  ['scrub'],
  ['fern'],
  { surface: cold },
);
habitat(
  'boreal',
  'Boreal forest',
  { biomes: [6] },
  [['spruce', 4], 'birch', 'larch'],
  ['heath'],
  ['alpine_grass'],
  { surface: cold, forestDensity: 125, parkTrees: ['birch', 'spruce'] },
);
habitat(
  'savanna',
  'Tropical grassland and open woodland',
  { biomes: [7] },
  ['dry_tropical'],
  ['scrub'],
  ['savanna_grass'],
  { surface: dry, forestDensity: 90, openDensity: 0.8, grasslandTrees: 6 },
);
habitat(
  'steppe',
  'Temperate grassland and steppe',
  { biomes: [8] },
  ['poplar'],
  ['dry_scrub'],
  ['dry_grass'],
  { surface: dry, forestDensity: 80, openDensity: 0.3 },
);
habitat(
  'flooded_grassland',
  'Flooded grassland',
  { biomes: [9] },
  ['willow'],
  ['scrub'],
  ['reeds'],
  { surface: wet, forestDensity: 65, openDensity: 0.4 },
);
habitat(
  'montane_grassland',
  'Montane grassland and shrubland',
  { biomes: [10] },
  [],
  ['heath'],
  ['alpine_grass'],
  { surface: cold, forestDensity: 0, openDensity: 0.25, parkTrees: [], orchard: [] },
);
habitat('tundra', 'Tundra', { biomes: [11] }, [], ['heath'], ['alpine_grass'], {
  surface: cold,
  forestDensity: 0,
  scrubDensity: 28,
  openDensity: 0.25,
  parkTrees: [],
  orchard: [],
  wetland: ['alpine_grass'],
});
habitat(
  'mediterranean',
  'Mediterranean woodland and scrub',
  { biomes: [12] },
  ['cork_oak', 'pine'],
  ['chaparral'],
  ['dry_grass'],
  { surface: dry, forestDensity: 90, orchard: ['olive'] },
);
habitat(
  'desert',
  'Desert and xeric scrub',
  { biomes: [13] },
  ['dry_scrub'],
  ['dry_scrub'],
  ['dry_grass'],
  {
    surface: desert,
    forestDensity: 15,
    scrubDensity: 18,
    openDensity: 0.65,
    parkTrees: ['dry_tropical'],
    orchard: [],
  },
);
habitat('mangrove', 'Mangrove habitat', { biomes: [14] }, ['mangrove'], ['mangrove'], ['reeds'], {
  surface: wet,
  forestDensity: 120,
  scrubDensity: 65,
  openDensity: 0,
  parkTrees: ['tropical_understory'],
  orchard: [],
});

habitat(
  'african_savanna',
  'African savanna and open woodland',
  { biomes: [7], realms: ['Afrotropic'] },
  [['acacia', 3], 'miombo'],
  ['dry_scrub'],
  ['savanna_grass'],
  { priority: 20, surface: dry, forestDensity: 65, openDensity: 0.55, grasslandTrees: 6 },
);
habitat(
  'african_desert',
  'African arid shrubland',
  { biomes: [13], realms: ['Afrotropic'] },
  ['acacia'],
  [['dry_scrub', 6], 'aloe'],
  ['dry_grass'],
  {
    priority: 20,
    surface: desert,
    forestDensity: 30,
    scrubDensity: 20,
    openDensity: 0.5,
    orchard: [],
  },
);
habitat(
  'australian_woodland',
  'Australian eucalypt woodland',
  { ecoregions: [168, 176, 177, 178, 181, 182, 183, 184, 185, 186, 187, 189, 191, 192] },
  [['eucalyptus', 4], 'mallee'],
  ['mallee'],
  ['dry_grass'],
  {
    priority: 40,
    surface: dry,
    forestDensity: 100,
    grasslandTrees: 4,
    parkTrees: [['eucalyptus', 4], 'warm_evergreen'],
    crownScale: 1.25,
  },
);
habitat(
  'southern_beech_forest',
  'Southern beech and wet temperate forest',
  { ecoregions: [167, 169, 170, 172, 174, 175, 179, 180] },
  [['southern_beech', 4], 'podocarp'],
  ['scrub'],
  ['fern'],
  { priority: 40, surface: wet, forestDensity: 170 },
);
habitat(
  'nz_northern_forest',
  'Northern New Zealand evergreen forest',
  { ecoregions: [171, 173] },
  ['podocarp', 'southern_beech'],
  ['scrub'],
  ['fern'],
  { priority: 40, surface: wet, forestDensity: 170 },
);
habitat(
  'nz_tussock',
  'New Zealand tussock grassland',
  { ecoregions: [190] },
  [],
  ['heath'],
  ['dry_grass'],
  { priority: 40, surface: cold, openDensity: 0.3, orchard: [], parkTrees: [] },
);
habitat(
  'pacific_coastal',
  'Pacific coastal conifer rainforest',
  { ecoregions: [349, 351, 352, 358, 359, 360, 364, 365] },
  [['cedar', 5], ['fir', 2], 'alder'],
  ['scrub'],
  ['fern'],
  {
    priority: 40,
    surface: wet,
    surfacePalette: pacificCoastal,
    forestDensity: 175,
    // Eastside yards and greenbelts are mostly Douglas-fir and cedar under a few maples.
    parkTrees: [['cedar', 3], ['fir', 2], ['alder', 2], 'maple'],
    homeTrees: [['cedar', 5], ['fir', 4], 'alder', 'maple'],
    residentialTrees: 80,
    openTrees: 90,
    crownScale: 1.4,
  },
);
habitat(
  'atacama',
  'Atacama sparse desert',
  { ecoregions: [598] },
  ['mesquite'],
  ['dry_scrub'],
  ['dry_grass'],
  {
    priority: 40,
    surface: desert,
    forestDensity: 20,
    scrubDensity: 5,
    openDensity: 0,
    orchard: [],
  },
);
habitat(
  'australian_arid',
  'Australian arid scrub',
  { biomes: [13], realms: ['Australasia'] },
  ['mallee'],
  [['dry_scrub', 5], 'mallee'],
  ['dry_grass'],
  {
    priority: 20,
    surface: desert,
    forestDensity: 30,
    scrubDensity: 20,
    openDensity: 0.5,
    orchard: [],
  },
);
habitat(
  'australian_heath',
  'Australian Mediterranean heath',
  { biomes: [12], realms: ['Australasia'] },
  ['eucalyptus', 'mallee'],
  ['chaparral'],
  ['dry_grass'],
  { priority: 20, surface: dry, forestDensity: 80 },
);
habitat(
  'fynbos',
  'Southern African fynbos',
  { biomes: [12], realms: ['Afrotropic'] },
  ['dry_tropical'],
  ['heath', 'chaparral'],
  ['dry_grass'],
  { priority: 20, surface: dry, forestDensity: 30, scrubDensity: 100 },
);
habitat(
  'american_desert',
  'American xeric scrub',
  { biomes: [13], realms: ['Nearctic', 'Neotropic'] },
  ['mesquite'],
  [['dry_scrub', 5], 'prickly_pear', 'agave'],
  ['dry_grass'],
  {
    priority: 20,
    surface: desert,
    forestDensity: 45,
    scrubDensity: 32,
    openDensity: 0.8,
    orchard: [],
  },
);
habitat(
  'sonoran',
  'Sonoran desert cactus community',
  { ecoregions: [435] },
  ['mesquite'],
  [['dry_scrub', 5], ['saguaro', 2], 'prickly_pear'],
  [['dry_grass', 8], 'barrel_cactus'],
  {
    priority: 40,
    surface: desert,
    forestDensity: 40,
    scrubDensity: 38,
    openDensity: 1.2,
    parkTrees: ['mesquite'],
    // Irrigated yards: mesquite and palo verde-like crowns, fan and date palms, citrus, pine.
    homeTrees: [['mesquite', 3], ['fan_palm', 2], 'date_palm', ['fruit_tree', 2], 'pine'],
    riparian: [
      ['willow', 3],
      ['mesquite', 2],
    ],
    crownScale: 1.2,
    orchard: [],
  },
);
habitat(
  'aravalli_thorn',
  'Aravalli thorn woodland and managed broadleaf parks',
  { ecoregions: [314] },
  ['dry_tropical'],
  ['dry_scrub'],
  ['dry_grass'],
  {
    priority: 40,
    surface: dry,
    surfacePalette: aravalli,
    forestDensity: 65,
    scrubDensity: 32,
    openDensity: 0.8,
    // Delhi's compounds, verges and avenues sit under neem, jamun and arjun canopy.
    openTrees: 130,
    residentialTrees: 100,
    treeRoadClearance: 1.5,
    parkTrees: [['avenue_evergreen', 4], 'dry_tropical'],
    parkDensity: 70,
    crownScale: 1.5,
    orchard: [],
  },
);
habitat(
  'california_chaparral',
  'California oak woodland and chaparral',
  { ecoregions: [422, 423, 424] },
  ['oak', 'pine'],
  ['chaparral'],
  ['dry_grass'],
  { priority: 40, surface: dry, forestDensity: 80 },
);
habitat(
  'mediterranean_basin',
  'Mediterranean basin woodland',
  { biomes: [12], realms: ['Palearctic'] },
  [['cork_oak', 3], 'stone_pine', 'cypress'],
  ['chaparral'],
  ['dry_grass'],
  {
    priority: 20,
    surface: dry,
    forestDensity: 90,
    parkTrees: ['olive', 'stone_pine', 'cypress'],
    orchard: ['olive'],
  },
);
habitat(
  'asian_moist_forest',
  'Asian moist tropical forest',
  { biomes: [1], realms: ['Indomalayan'] },
  [['tropical_canopy', 5], 'forest_palm', 'tropical_emergent'],
  ['tropical_understory', 'bamboo'],
  ['fern'],
  { priority: 20, surface: wet, forestDensity: 190 },
);
habitat(
  'oceanic_tropical',
  'Oceanic tropical forest',
  { biomes: [1, 2], realms: ['Oceania'] },
  [['tropical_canopy', 4], 'forest_palm'],
  ['tropical_understory'],
  ['fern'],
  { priority: 20, surface: wet, parkTrees: ['coconut', 'tropical_understory'] },
);
habitat(
  'southern_rainforest',
  'Southern temperate rainforest',
  { biomes: [4], realms: ['Neotropic'] },
  ['southern_beech'],
  ['scrub'],
  ['fern'],
  { priority: 20, surface: wet, forestDensity: 170 },
);
habitat(
  'siberian_boreal',
  'Eurasian boreal forest',
  { biomes: [6], realms: ['Palearctic'] },
  [['larch', 3], ['spruce', 3], 'birch'],
  ['heath'],
  ['alpine_grass'],
  { priority: 20, surface: cold, forestDensity: 120 },
);
habitat(
  'east_asian_evergreen',
  'East Asian warm evergreen forest',
  { ecoregions: [642, 643, 657, 670, 680, 681, 682] },
  [['warm_evergreen', 5], 'maple'],
  ['scrub', 'bamboo'],
  ['fern'],
  {
    priority: 40,
    surface: { ...wet, colors: { ...wet.colors, residential: '#999b91', garden: '#6f8059' } },
    forestDensity: 155,
    parkTrees: [
      ['warm_evergreen', 3],
      ['maple', 2],
    ],
    crownScale: 1.2,
  },
);
habitat(
  'east_asian_deciduous',
  'East Asian deciduous and mixed forest',
  { ecoregions: [655, 666, 667, 669, 671, 677, 683] },
  [['oak', 3], ['beech', 2], ['maple', 2], 'birch'],
  ['scrub'],
  ['fern', 'grass'],
  { priority: 40, forestDensity: 145, parkTrees: ['maple', 'oak'] },
);

const agriculturalProfiles = agricultureOverrides(
  JSON.parse(await readFile(new URL('ecoregions.json', root), 'utf8')).regions,
);
const doc = {
  format: 'molen/regional-catalog@1',
  id: 'molen.ecology.regional',
  version: 1,
  title: 'Global habitat and procedural plant foundation',
  requires: [],
  overrides: [],
  profiles: [...profiles, ...agriculturalProfiles],
  scatters,
  plants,
  crops: agricultureCrops(),
};
// This generated download is read through its authoring source; keep the existing data budget.
const bytes = `${JSON.stringify(doc)}\n`;
const destination = new URL('regional.catalog.json', root);
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')) !== bytes)
    throw new Error('Regional catalog is stale; run content/ecology/source/build-catalog.mjs');
} else await writeFile(destination, bytes);
console.log(
  JSON.stringify({
    file: fileURLToPath(destination),
    plants: plants.length,
    habitats: profiles.length,
    bytes: Buffer.byteLength(bytes),
  }),
);
