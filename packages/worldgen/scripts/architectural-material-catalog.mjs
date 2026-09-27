/** Shared metadata and semantic finishes for the shipped architectural texture graphs. */
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';

export const MATERIAL_PREVIEW_TINTS = {
  brick: '#b5785c',
  brick_flemish: '#b78168',
  brick_stack: '#bd8c6b',
  brick_longformat: '#a9795e',
  brick_glazed: '#7daba1',
  wood_board_batten: '#bca27a',
  wood_vertical: '#c6a476',
  wood_log: '#c3a274',
  wood_shou_sugi_ban: '#626766',
  wood_weatherboard: '#a5ada5',
  wood_painted_lap: '#eeeae0',
  wood_painted_shingle: '#486a56',
  wood_plain: '#b7a17b',
  fabric_canvas: '#e5ddc6',
  bamboo: '#c6b881',
  slate: '#8c9ba7',
  shingle_cedar: '#b19a76',
  thatch: '#c0ae77',
  tile_flat: '#c78f70',
  tile_glazed: '#7c9d8f',
  tile_ceramic: '#bf8a6c',
  tile_mosaic: '#9eb8ba',
  metal_standing_seam: '#929f9b',
  metal_corrugated: '#a9b2b2',
  metal_copper: '#8db2a0',
  metal_painted: '#899b96',
  stone: '#b4b09e',
  stone_ashlar: '#c7c1b0',
  stone_limestone: '#d2c8ae',
  stone_sandstone: '#c6a981',
  stone_basalt: '#818b86',
  stone_drywall: '#aaa997',
  stone_granite: '#aaa9a1',
  earth_adobe: '#d0b38b',
  earth_rammed: '#c8b293',
  plaster_lime: '#e4dfce',
  plaster_tadelakt: '#ccbaa3',
  concrete_boardformed: '#b6b7ac',
  terracotta_screen: '#c68e6c',
  siding_lap: '#acb8ae',
  siding_shingle: '#bda990',
  shingle_asphalt: '#858e93',
  concrete_panel: '#c2c4ba',
  concrete_plain: '#b9bcb5',
  stucco: '#e4d8be',
  membrane: '#99a19e',
  gravel: '#c1b8a5',
};

const families = [
  [
    'masonry',
    [
      'brick',
      'brick_flemish',
      'brick_stack',
      'brick_longformat',
      'brick_glazed',
      'stone',
      'stone_ashlar',
      'stone_limestone',
      'stone_sandstone',
      'stone_basalt',
      'stone_drywall',
      'stone_granite',
      'terracotta_screen',
    ],
  ],
  ['earth', ['earth_adobe', 'earth_rammed']],
  [
    'wood',
    [
      'siding_lap',
      'siding_shingle',
      'wood_board_batten',
      'wood_vertical',
      'wood_log',
      'wood_shou_sugi_ban',
      'wood_weatherboard',
      'wood_painted_lap',
      'wood_painted_shingle',
      'wood_plain',
      'shingle_cedar',
    ],
  ],
  ['plant-fiber', ['bamboo', 'thatch']],
  ['fabric', ['fabric_canvas']],
  [
    'roofing',
    ['shingle_asphalt', 'slate', 'tile_ceramic', 'tile_flat', 'tile_glazed', 'membrane', 'gravel'],
  ],
  ['ceramic', ['tile_mosaic']],
  ['metal', ['metal_standing_seam', 'metal_corrugated', 'metal_copper', 'metal_painted']],
  ['render', ['stucco', 'plaster_lime', 'plaster_tadelakt']],
  ['concrete', ['concrete_plain', 'concrete_panel', 'concrete_boardformed']],
  ['glazing', ['window_punched', 'window_grid', 'window_sliding', 'storefront']],
];
const familyByKey = new Map(families.flatMap(([family, keys]) => keys.map((key) => [key, family])));
const variants = {
  brick: [
    { id: 'red_brick', label: 'Warm red face brick', tint: '#b5785c' },
    { id: 'buff_brick', label: 'Buff face brick', tint: '#c5ad82' },
    { id: 'dark_brick', label: 'Dark fired brick', tint: '#67534c' },
  ],
  wood_painted_lap: [
    { id: 'white_painted_wood', label: 'White painted lap wood', tint: '#eeeae0' },
    { id: 'cream_painted_wood', label: 'Cream painted lap wood', tint: '#ded0ae' },
    { id: 'blue_painted_wood', label: 'Muted blue painted lap wood', tint: '#698798' },
  ],
  wood_painted_shingle: [
    { id: 'green_shingled_wood', label: 'Green painted wood shingles', tint: '#486a56' },
    { id: 'white_shingled_wood', label: 'White painted wood shingles', tint: '#eeeae0' },
    { id: 'gray_shingled_wood', label: 'Gray painted wood shingles', tint: '#8d9690' },
  ],
  metal_painted: [
    { id: 'bridge_gray_green_paint', label: 'Gray green painted steel', tint: '#899b96' },
    { id: 'bridge_orange_paint', label: 'Orange painted steel', tint: '#ba5b39' },
    { id: 'white_painted_metal', label: 'White painted metal', tint: '#eeeae0' },
  ],
  stone_granite: [
    { id: 'gray_granite', label: 'Gray dressed granite', tint: '#aaa9a1' },
    { id: 'pink_granite', label: 'Pink dressed granite', tint: '#b99e91' },
  ],
  wood_plain: [
    { id: 'natural_timber', label: 'Natural timber', tint: '#b7a17b' },
    { id: 'weathered_timber', label: 'Weathered gray timber', tint: '#999b90' },
  ],
  fabric_canvas: [
    { id: 'cream_canvas', label: 'Cream sail canvas', tint: '#e5ddc6' },
    { id: 'white_canvas', label: 'White sail canvas', tint: '#f0eee5' },
  ],
};
const horizontalWood = new Set(['siding_lap', 'wood_weatherboard', 'wood_painted_lap', 'wood_log']);
const verticalWood = new Set([
  'wood_board_batten',
  'wood_vertical',
  'wood_shou_sugi_ban',
  'bamboo',
]);
const shingles = new Set([
  'siding_shingle',
  'shingle_cedar',
  'wood_painted_shingle',
  'shingle_asphalt',
  'slate',
  'tile_flat',
]);
const roofs = new Set([
  'shingle_cedar',
  'thatch',
  'shingle_asphalt',
  'slate',
  'tile_ceramic',
  'tile_flat',
  'tile_glazed',
  'membrane',
  'gravel',
  'metal_standing_seam',
  'metal_corrugated',
  'metal_copper',
]);

export function architecturalMaterialCatalog(materialDocuments, descriptions) {
  const entries = Object.entries(materialDocuments)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, doc]) => {
      const family = familyByKey.get(key);
      if (!family || !MATERIAL_REPEAT_METERS[key])
        throw new Error(`Missing architectural material metadata: ${key}`);
      const glazing = family === 'glazing';
      const painted = key.startsWith('wood_painted') || key === 'metal_painted';
      const use = glazing
        ? ['window', 'storefront']
        : roofs.has(key)
          ? ['roof']
          : key === 'metal_painted'
            ? ['bridge', 'structural-steel', 'trim']
            : key === 'stone_granite'
              ? ['pier', 'foundation', 'facade', 'paving']
              : ['facade', 'wall'];
      if (['wood_painted_shingle', 'siding_shingle'].includes(key)) use.push('roof');
      if (key === 'wood_plain') use.splice(0, use.length, 'timber', 'beam', 'deck', 'trim');
      if (key === 'fabric_canvas') use.splice(0, use.length, 'sail', 'awning', 'cloth');
      if (['stone', 'stone_ashlar', 'stone_basalt', 'concrete_plain'].includes(key))
        use.push('foundation', 'pier');
      let uvOrientation =
        'U along the horizontal construction course; V upwards on walls. Surface-aligned local metric UVs.';
      if (verticalWood.has(key))
        uvOrientation = 'U across boards or stalks; V along their vertical grain.';
      if (horizontalWood.has(key))
        uvOrientation = 'U along horizontal boards and grain; V across courses.';
      if (shingles.has(key))
        uvOrientation =
          'U across staggered shingles; V along grain and across exposure courses. On roofs V follows the roof slope.';
      if (roofs.has(key) && !shingles.has(key))
        uvOrientation = 'U across ribs or roof field; V along the roof slope/drainage direction.';
      if (glazing)
        uvOrientation =
          'One cell-space repeat per modeled pane or bay; repeatMeters is only a metric fallback.';
      if (key === 'wood_plain')
        uvOrientation =
          'U along the timber grain/long axis; V across it. No board seams in this surface.';
      if (key === 'fabric_canvas')
        uvOrientation =
          'U and V follow the woven fabric yarn directions. Fold, seam and hem geometry keeps its own surface-aligned UVs.';
      const channels = Object.keys(doc.outputs);
      const resolution = doc.size;
      return {
        id: `molen.worldgen.material.${key}`,
        key,
        materialRef: `matgraph:molen.worldgen.material.${key}`,
        path: `materials/${key}.matgraph.json`,
        family,
        construction: descriptions[key],
        finish: painted
          ? 'painted'
          : key.includes('glazed')
            ? 'glazed'
            : glazing
              ? 'glass-and-frame'
              : 'construction-surface',
        use,
        repeatMeters: MATERIAL_REPEAT_METERS[key],
        uvMode: glazing ? 'cell' : 'meters',
        uvOrientation,
        defaultTint: MATERIAL_PREVIEW_TINTS[key] ?? '#ffffff',
        tintMode: glazing ? 'preserve' : 'multiply',
        variants: variants[key] ?? [],
        resolution,
        channels,
        textureMemory: {
          uncompressedRgba8Bytes: resolution[0] * resolution[1] * 4 * channels.length,
          withMipmapsUpperBoundBytes: Math.ceil(
            (resolution[0] * resolution[1] * 4 * channels.length * 4) / 3,
          ),
        },
      };
    });
  return {
    format: 'molen/architectural-material-catalog@1',
    version: 1,
    authoring: {
      uvConvention:
        'Meters per repeat. Worldgen: uv:"meters", uvScale:repeatMeters. Metric GLBs: divide local surface coordinates by repeatMeters exactly once.',
      colorConvention:
        'Neutral graph maps × semantic vertex-color tint. Color variants reuse one shared material and texture set; they must not cause duplicate graph bakes or texture uploads.',
      normalConvention:
        'Tangent-space height-derived microstructure; construction edges and silhouettes remain geometry.',
      uniqueArt:
        'Keep unique facade artwork, signage, murals and material islands when present. Only explicitly identified reusable surfaces bind to this library.',
    },
    reuse: {
      textureIdentity: 'Canonical materialRef; color variants share identical texture objects.',
      lifetime:
        'The current world viewer prepares registered style-pack surfaces after the first frame and retains shared material textures until viewer disposal. Model eviction releases model geometry and its private fallback materials; it does not dispose shared library textures. Per-surface demand loading and LRU eviction are future work.',
      quality:
        '256² authored defaults with mipmapped sampling; maximum asset fidelity still requires correct geometry, UV orientation, metric scale and local material review.',
    },
    entries,
  };
}
