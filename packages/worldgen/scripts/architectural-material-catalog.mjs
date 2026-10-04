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
  glass_frit_triangular: '#f3f4ed',
  metal_standing_seam: '#929f9b',
  metal_corrugated: '#a9b2b2',
  metal_copper: '#8db2a0',
  metal_painted: '#899b96',
  metal_bronze_cast: '#6c8675',
  metal_perforated_square: '#ef5e20',
  metal_perforated_round: '#e5e8e9',
  metal_perforated_round_open: '#e5e8e9',
  metal_expanded_diamond: '#e5e8e9',
  metal_stainless: '#e4e7e8',
  metal_stainless_polished: '#e4e7e8',
  metal_stainless_beadblasted: '#e4e7e8',
  stone: '#b4b09e',
  stone_ashlar: '#c7c1b0',
  stone_limestone: '#d2c8ae',
  stone_limestone_raw: '#c8bfaa',
  stone_limestone_weathered: '#c8bfaa',
  stone_sandstone: '#c6a981',
  stone_sandstone_raw: '#b19886',
  stone_basalt_raw: '#6e736d',
  stone_basalt: '#818b86',
  stone_drywall: '#aaa997',
  stone_granite: '#aaa9a1',
  stone_travertine: '#d4ccb4',
  clay_fired: '#b47554',
  stone_marble: '#e5e2d8',
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
  etfe_film: '#f5f5f3',
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
      'stone_limestone_raw',
      'stone_limestone_weathered',
      'stone_sandstone',
      'stone_sandstone_raw',
      'stone_basalt_raw',
      'stone_basalt',
      'stone_drywall',
      'stone_granite',
      'stone_travertine',
      'clay_fired',
      'stone_marble',
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
  ['polymer-film', ['etfe_film']],
  [
    'roofing',
    ['shingle_asphalt', 'slate', 'tile_ceramic', 'tile_flat', 'tile_glazed', 'membrane', 'gravel'],
  ],
  ['ceramic', ['tile_mosaic']],
  ['glass-surface', ['glass_frit_triangular']],
  [
    'metal',
    [
      'metal_standing_seam',
      'metal_corrugated',
      'metal_copper',
      'metal_painted',
      'metal_stainless',
      'metal_stainless_polished',
      'metal_stainless_beadblasted',
      'metal_perforated_square',
      'metal_perforated_round',
      'metal_perforated_round_open',
      'metal_expanded_diamond',
      'metal_bronze_cast',
    ],
  ],
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
  stone_marble: [
    { id: 'white_marble', label: 'Honed white marble', tint: '#e5e2d8' },
    { id: 'green_marble', label: 'Green marble', tint: '#6c8579' },
    { id: 'rose_marble', label: 'Rose marble', tint: '#c9a69c' },
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
      if (key === 'etfe_film') use.splice(0, use.length, 'inflated-cushion', 'facade', 'roof');
      if (key === 'stone_marble')
        use.splice(0, use.length, 'column', 'sculpture', 'cladding', 'trim');
      if (
        [
          'stone_limestone_raw',
          'stone_limestone_weathered',
          'stone_sandstone_raw',
          'stone_basalt_raw',
        ].includes(key)
      )
        use.splice(0, use.length, 'boulder', 'irregular-block', 'foundation', 'sculpture');
      if (key.startsWith('metal_stainless'))
        use.splice(0, use.length, 'bridge', 'structural-steel', 'rail', 'sculpture', 'trim');
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
      if (key === 'glass_frit_triangular')
        uvOrientation =
          'Metric U/V divided by 0.05m and 0.08660254m. Equilateral ceramic-frit triangles on opaque backed glass, with no baked lighting or relief normal. Pattern pitch is a photograph reconstruction; panel joints and retaining trims remain geometry.';
      if (key === 'etfe_film')
        uvOrientation =
          'Surface-aligned metric UVs; nondirectional smooth polymer film. Panel seams and inflation remain geometry. Transparent parts retain local PBR alpha instead of binding this opaque shared graph.';
      if (key === 'stone_marble')
        uvOrientation =
          'Surface-aligned metric UVs; continuous subtle mineral veins without masonry joints.';
      if (
        [
          'stone_travertine',
          'stone_limestone_raw',
          'stone_limestone_weathered',
          'stone_sandstone_raw',
          'stone_basalt_raw',
          'clay_fired',
        ].includes(key)
      )
        uvOrientation =
          'Surface-aligned metric UVs; fine continuous grain without mortar. Individual stone or brick joints are supplied by geometry.';
      if (key === 'metal_perforated_square')
        uvOrientation =
          'Surface-aligned U/V in meters divided by0.085m per repeat. Square65.5mm holes use base-color alpha cutouts; opaque cassette folds and fasteners remain geometry.';
      if (key === 'metal_perforated_round')
        uvOrientation =
          'Surface-aligned U/V meters divided by0.012m per repeat. Round4mm holes are actual alpha cutouts; surrounding plate, folded panel edges and fasteners use geometry.';
      if (key === 'metal_perforated_round_open')
        uvOrientation =
          'Surface-aligned U/V meters divided by0.012m per repeat. Round9mm alpha apertures provide approximately44% open area. The metric hole pattern is a reusable reconstruction, not a measured fabrication schedule.';
      if (key === 'metal_expanded_diamond')
        uvOrientation =
          'U follows the long diamond axis and repeats every0.12m; V repeats every0.04m. Staggered diamond alpha holes cover56% of the sheet. Aspect and pitch are photograph reconstructions;56% openness is supported by the Warsaw engineer facade manual. Physical strip weaving and edge thickness remain geometry.';
      if (key === 'metal_bronze_cast')
        uvOrientation =
          'Surface-aligned metric UVs on cast metal; fine nondirectional patination and pits without sheet joints.';
      if (key === 'metal_stainless')
        uvOrientation =
          'U follows the brushing direction; continuous fine grain without panel seams.';
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
        ...(doc.alphaTest === undefined ? {} : { alphaTest: doc.alphaTest }),
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
        'Neutral graph maps Ã— semantic vertex-color tint. Color variants reuse one shared material and texture set; they must not cause duplicate graph bakes or texture uploads.',
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
        '256Â² authored defaults with mipmapped sampling; maximum asset fidelity still requires correct geometry, UV orientation, metric scale and local material review.',
    },
    entries,
  };
}
