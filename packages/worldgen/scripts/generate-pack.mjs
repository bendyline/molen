/**
 * Deterministically generate the default pack's derived content: procedural material documents
 * (`molen/matgraph@1`, authored light so palette tints multiply cleanly) and the roof prop models
 * (core glTF 2.0 GLBs with `molen/asset@1` sidecars). Runs after `tsdown` (imports the built
 * kernel for the mesh builder and GLB encoder).
 *
 *   node scripts/generate-pack.mjs            write packs/default/{materials,assets}
 *   node scripts/generate-pack.mjs --check    fail when any generated file is missing or stale
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { formatJson } from './format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = resolve(root, 'packs/default');
const propSourceDir = resolve(root, 'source/props');
const check = process.argv.includes('--check');

// ------------------------------------------------------------------ materials

const noise = (id, scale, octaves, seedOffset, kind = 'simplex') => ({
  id,
  type: 'noise',
  params: { kind, octaves, scale, seedOffset },
});
const ramp = (id, input, stops) => ({
  id,
  type: 'ramp',
  input,
  params: { stops: stops.map(([t, color]) => ({ t, color })) },
});
const levels = (id, input, outMin, outMax) => ({
  id,
  type: 'levels',
  input,
  params: { outMin, outMax },
});
const multiply = (id, a, b) => ({
  id,
  type: 'blend',
  inputs: { a, b },
  params: { mode: 'multiply', factor: 1 },
});
const bricks = (id, rows, cols, mortarWidth, offset = 0.5) => ({
  id,
  type: 'bricks',
  params: { rows, cols, mortarWidth, offset },
});
const twoTone = (id, input, mortar, face) =>
  ramp(id, input, [
    [0, mortar],
    [0.5, mortar],
    [0.56, face],
    [1, face],
  ]);
/** Fine multiplicative grain in [low, 1]. */
const grain = (scale, low, seedOffset) => [
  noise('grain-noise', scale, 3, seedOffset),
  levels('grain', 'grain-noise', low, 1),
];

/** Repeat stops explicitly: uv-transform transforms coordinates, not an upstream pattern. */
function profile(id, count, angleDeg, stops) {
  const repeated = [];
  for (let repeat = 0; repeat < count; repeat++) {
    for (const [t, color] of stops) {
      if (repeat > 0 && t === 0 && color === stops.at(-1)[1]) continue;
      repeated.push([(repeat + t) / count, color]);
    }
  }
  return [
    { id: `${id}-axis`, type: 'gradient', params: { kind: 'linear', angleDeg } },
    ramp(id, `${id}-axis`, repeated),
  ];
}

const blend = (id, a, b, mode, factor = 1) => ({
  id,
  type: 'blend',
  inputs: { a, b },
  params: { mode, factor },
});

/** Mirrored coordinates meet exactly at texture borders; anisotropy follows construction. */
function fibers(xScale, yScale, low = 0.9) {
  const scale = Math.max(xScale, yScale);
  return [
    { id: 'u', type: 'gradient', params: { kind: 'linear', angleDeg: 0 } },
    { id: 'v', type: 'gradient', params: { kind: 'linear', angleDeg: 90 } },
    ramp('u-fold', 'u', [
      [0, '#000000'],
      [0.5, '#ff0000'],
      [1, '#000000'],
    ]),
    ramp('v-fold', 'v', [
      [0, '#000000'],
      [0.5, '#00ff00'],
      [1, '#000000'],
    ]),
    blend('fold', 'u-fold', 'v-fold', 'add'),
    { id: 'stretch', type: 'const', params: { value: [xScale / scale, yScale / scale, 0, 1] } },
    multiply('fiber-uv', 'fold', 'stretch'),
    { ...noise('fiber-noise', scale, 2, 31), input: 'fiber-uv' },
    levels('fiber', 'fiber-noise', low, 1),
  ];
}

function finishSurface(nodes, roughness, height = undefined, metalness = undefined) {
  const outputs = { baseColor: 'out', roughness: 'rough' };
  nodes.push({ id: 'rough', type: 'const', params: { value: roughness } });
  if (height !== undefined) {
    nodes.push({
      id: 'normal',
      type: 'height-to-normal',
      input: height,
      params: { strength: 0.009 },
    });
    outputs.normal = 'normal';
  }
  if (metalness !== undefined) {
    nodes.push({ id: 'metalness', type: 'const', params: { value: metalness } });
    outputs.metalness = 'metalness';
  }
  return { nodes, outputs };
}

function masonry(rows, cols, mortarWidth, offset, mortar, face, roughness, low = 0.92) {
  return finishSurface(
    [
      bricks('bond', rows, cols, mortarWidth, offset),
      twoTone('face', 'bond', mortar, face),
      ...fibers(18, 18, low),
      multiply('out', 'face', 'fiber'),
    ],
    roughness,
    'bond',
  );
}

function boards(count, vertical, stops, roughness = 0.86, low = 0.91) {
  return finishSurface(
    [
      ...profile('board', count, vertical ? 0 : 90, stops),
      ...fibers(vertical ? 44 : 3, vertical ? 3 : 44, low),
      multiply('out', 'board', 'fiber'),
    ],
    roughness,
    'board',
  );
}

function renderSurface(low, high, roughness, xScale = 12, yScale = 12) {
  return finishSurface(
    [
      ...fibers(xScale, yScale),
      ramp('out', 'fiber-noise', [
        [0, low],
        [1, high],
      ]),
    ],
    roughness,
  );
}

const glass = (rows, cols, mortarWidth, frame, pane, roughness) => ({
  nodes: [
    bricks('frame', rows, cols, mortarWidth, 0),
    twoTone('panes', 'frame', frame, pane),
    { id: 'sheen', type: 'gradient', params: { kind: 'linear', angleDeg: 55 } },
    levels('sheen-soft', 'sheen', 0.82, 1),
    multiply('out', 'panes', 'sheen-soft'),
    { id: 'rough', type: 'const', params: { value: roughness } },
  ],
  outputs: { baseColor: 'out', roughness: 'rough' },
});

const MATERIALS = {
  siding_lap: {
    doc: 'Horizontal lap siding: eight boards per repeat with a shadow line under each board.',
    seed: 11,
    nodes: [
      ...profile('lap', 8, 90, [
        [0, '#9a9a9a'],
        [0.12, '#e4e4e4'],
        [0.9, '#f3f3f3'],
        [1, '#9a9a9a'],
      ]),
      ...grain(5, 0.86, 1),
      multiply('out', 'lap', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  siding_shingle: {
    doc: 'Staggered wood shingles.',
    seed: 12,
    nodes: [
      bricks('courses', 8, 5, 0.08),
      twoTone('shingles', 'courses', '#8e8e8e', '#ebebeb'),
      ...grain(7, 0.8, 2),
      multiply('out', 'shingles', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  stucco: {
    doc: 'Soft mottled stucco.',
    seed: 13,
    nodes: [
      noise('mottle', 6, 5, 3),
      ramp('out', 'mottle', [
        [0, '#d8d1c5'],
        [1, '#f8f4ed'],
      ]),
    ],
    outputs: { baseColor: 'out' },
  },
  brick: {
    doc: 'Running-bond brick, light so a palette supplies the brick color.',
    seed: 14,
    nodes: [
      bricks('bond', 12, 8, 0.1),
      twoTone('courses', 'bond', '#b8b2aa', '#f2e4dc'),
      ...grain(12, 0.84, 4),
      multiply('out', 'courses', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  concrete_panel: {
    doc: 'Precast panels with narrow joints.',
    seed: 15,
    nodes: [
      bricks('joints', 1, 1, 0.03, 0),
      twoTone('panels', 'joints', '#a6a6a4', '#e8e8e6'),
      ...grain(9, 0.9, 5),
      multiply('out', 'panels', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  concrete_plain: {
    doc: 'Plain poured concrete.',
    seed: 16,
    nodes: [
      { id: 'cells', type: 'worley', params: { scale: 8, jitter: 1, output: 'f1' } },
      noise('speckle', 14, 3, 6),
      {
        id: 'mix',
        type: 'blend',
        inputs: { a: 'cells', b: 'speckle' },
        params: { mode: 'mix', factor: 0.5 },
      },
      ramp('out', 'mix', [
        [0, '#cdcdc9'],
        [1, '#ecece8'],
      ]),
    ],
    outputs: { baseColor: 'out' },
  },
  shingle_asphalt: {
    doc: 'Asphalt shingle courses.',
    seed: 17,
    nodes: [
      bricks('courses', 14, 6, 0.05),
      twoTone('shingles', 'courses', '#8c8c8c', '#d9d9d9'),
      ...grain(16, 0.78, 7),
      multiply('out', 'shingles', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  tile_ceramic: {
    doc: 'Barrel tiles: aligned courses with a rounded shading profile.',
    seed: 18,
    nodes: [
      bricks('courses', 8, 8, 0.06, 0),
      twoTone('tiles', 'courses', '#9d9a94', '#efeeea'),
      ...profile('curve', 8, 0, [
        [0, '#bdbdbd'],
        [0.5, '#ffffff'],
        [1, '#bdbdbd'],
      ]),
      multiply('out', 'tiles', 'curve'),
    ],
    outputs: { baseColor: 'out' },
  },
  membrane: {
    doc: 'Flat-roof membrane.',
    seed: 19,
    nodes: [
      noise('sheet', 10, 4, 8),
      ramp('out', 'sheet', [
        [0, '#d3d3d1'],
        [1, '#ebebe8'],
      ]),
    ],
    outputs: { baseColor: 'out' },
  },
  gravel: {
    doc: 'Ballast gravel.',
    seed: 20,
    nodes: [
      { id: 'stones', type: 'worley', params: { scale: 24, jitter: 1, output: 'f1' } },
      ramp('out', 'stones', [
        [0, '#ebe9e3'],
        [1, '#bfbdb6'],
      ]),
    ],
    outputs: { baseColor: 'out' },
  },
  stone: {
    doc: 'Rubble stone with mortar joints.',
    seed: 21,
    nodes: [
      { id: 'cells', type: 'worley', params: { scale: 7, jitter: 1, output: 'f2-f1' } },
      { id: 'joints', type: 'threshold', input: 'cells', params: { edge: 0.12, smoothness: 0.04 } },
      ramp('blocks', 'joints', [
        [0, '#a29d94'],
        [1, '#e2ded5'],
      ]),
      ...grain(9, 0.82, 9),
      multiply('out', 'blocks', 'grain'),
    ],
    outputs: { baseColor: 'out' },
  },
  window_punched: {
    doc: 'One framed pane per window.',
    seed: 22,
    ...glass(1, 1, 0.1, '#e9e7e2', '#5b768e', 0.3),
  },
  window_grid: {
    doc: 'One storey of paired commercial panes; no horizontal subdivision suggesting extra floors.',
    seed: 23,
    ...glass(1, 2, 0.045, '#b8bcbf', '#5b768e', 0.3),
  },
  window_sliding: {
    doc: 'Two sliding panes.',
    seed: 24,
    ...glass(1, 2, 0.07, '#ebe9e4', '#5f7a8f', 0.3),
  },
  storefront: {
    doc: 'Full-height storefront glazing.',
    seed: 25,
    ...glass(1, 1, 0.04, '#4b4e52', '#6a8196', 0.22),
  },
  brick_flemish: {
    doc: 'Flemish bond: alternating broad stretchers and short headers in every course.',
    seed: 101,
    ...finishSurface(
      [
        ...profile('a', 4, 0, [
          [0, '#000000'],
          [0.035, '#ffffff'],
          [0.63, '#ffffff'],
          [0.66, '#000000'],
          [0.695, '#ffffff'],
          [0.965, '#ffffff'],
          [1, '#000000'],
        ]),
        ...profile('b', 4, 0, [
          [0, '#ffffff'],
          [0.145, '#ffffff'],
          [0.18, '#000000'],
          [0.215, '#ffffff'],
          [0.795, '#ffffff'],
          [0.83, '#000000'],
          [0.865, '#ffffff'],
          [1, '#ffffff'],
        ]),
        ...profile('rows', 4, 90, [
          [0, '#ffffff'],
          [0.495, '#ffffff'],
          [0.505, '#000000'],
          [1, '#000000'],
        ]),
        { id: 'rows-inverse', type: 'invert', input: 'rows', params: {} },
        multiply('even', 'a', 'rows'),
        multiply('odd', 'b', 'rows-inverse'),
        blend('headers', 'even', 'odd', 'add'),
        bricks('courses', 8, 1, 0.045, 0),
        multiply('bond', 'headers', 'courses'),
        twoTone('face', 'bond', '#bcb7ae', '#f0e4da'),
        ...fibers(18, 18),
        multiply('out', 'face', 'fiber'),
      ],
      0.9,
      'bond',
    ),
  },
  brick_stack: {
    doc: 'Stack-bond face brick with continuous vertical joints for modern facades.',
    seed: 102,
    ...masonry(10, 6, 0.045, 0, '#c5bdb4', '#eee3d9', 0.88),
  },
  brick_longformat: {
    doc: 'Slender long-format Roman brick with fine staggered joints.',
    seed: 103,
    ...masonry(16, 4, 0.055, 0.5, '#c5bfb3', '#efe3d5', 0.88),
  },
  brick_glazed: {
    doc: 'Smooth glazed brick with crisp recessed mortar; palette supplies glaze hue.',
    seed: 104,
    ...masonry(10, 6, 0.035, 0.5, '#aaaeb0', '#f5f5f1', 0.28, 0.98),
  },
  wood_board_batten: {
    doc: 'Vertical wide boards with raised narrow battens and directional fibers.',
    seed: 105,
    ...boards(6, true, [
      [0, '#b7b4ad'],
      [0.07, '#efebe3'],
      [0.16, '#efebe3'],
      [0.2, '#b7b4ad'],
      [0.24, '#ddd8ce'],
      [0.95, '#e8e2d7'],
      [1, '#b7b4ad'],
    ]),
  },
  wood_vertical: {
    doc: 'Tongue-and-groove vertical timber boards with narrow seams.',
    seed: 106,
    ...boards(10, true, [
      [0, '#b4b0a6'],
      [0.045, '#e9e4d7'],
      [0.955, '#e9e4d7'],
      [1, '#b4b0a6'],
    ]),
  },
  wood_log: {
    doc: 'Horizontal rounded log courses; pale base receives species or paint tint.',
    seed: 107,
    ...boards(
      7,
      false,
      [
        [0, '#b5aa96'],
        [0.12, '#d4c8b1'],
        [0.5, '#f1e7d2'],
        [0.88, '#d4c8b1'],
        [1, '#b5aa96'],
      ],
      0.92,
      0.9,
    ),
  },
  wood_shou_sugi_ban: {
    doc: 'Charred cedar crackle on vertical boards; use charcoal palette tint.',
    seed: 108,
    ...finishSurface(
      [
        bricks('boards', 1, 8, 0.025, 0),
        { id: 'crackle', type: 'worley', params: { scale: 18, jitter: 0.9, output: 'f2-f1' } },
        ramp('char', 'crackle', [
          [0, '#a8a9a7'],
          [0.045, '#d7d8d5'],
          [0.25, '#eeeeea'],
          [1, '#eeeeea'],
        ]),
        twoTone('face', 'boards', '#a2a3a1', '#eeeeeb'),
        multiply('out', 'face', 'char'),
      ],
      0.97,
      'crackle',
    ),
  },
  wood_weatherboard: {
    doc: 'Wide horizontal weathered boards with silver grain and small beveled seams.',
    seed: 109,
    ...boards(
      5,
      false,
      [
        [0, '#aaa9a4'],
        [0.07, '#d4d5cd'],
        [0.18, '#f0eee5'],
        [0.94, '#dbdcd4'],
        [1, '#aaa9a4'],
      ],
      0.94,
      0.83,
    ),
  },
  bamboo: {
    doc: 'Vertical bamboo poles with alternating nodes and fine longitudinal fibers.',
    seed: 110,
    ...finishSurface(
      [
        ...profile('poles', 12, 0, [
          [0, '#b2af96'],
          [0.16, '#dbd7bb'],
          [0.45, '#f1ecd0'],
          [0.84, '#d5d1b6'],
          [1, '#b2af96'],
        ]),
        bricks('nodes', 3, 12, 0.035, 0.5),
        twoTone('rings', 'nodes', '#b8b69e', '#ffffff'),
        multiply('stalks', 'poles', 'rings'),
        ...fibers(42, 3, 0.95),
        multiply('out', 'stalks', 'fiber'),
      ],
      0.78,
      'poles',
    ),
  },
  slate: {
    doc: 'Broad staggered slate plates with subtle cleavage across their faces.',
    seed: 111,
    ...finishSurface(
      [
        bricks('courses', 8, 5, 0.035, 0.5),
        twoTone('slates', 'courses', '#a9b0b6', '#e0e6e9'),
        ...fibers(3, 24, 0.86),
        multiply('out', 'slates', 'fiber'),
      ],
      0.82,
      'courses',
    ),
  },
  shingle_cedar: {
    doc: 'Cedar roof shakes with broad exposures, staggered seams and vertical grain.',
    seed: 112,
    ...finishSurface(
      [
        bricks('courses', 7, 9, 0.04, 0.5),
        twoTone('shakes', 'courses', '#b3ab98', '#eae2cd'),
        ...fibers(46, 3, 0.86),
        multiply('out', 'shakes', 'fiber'),
      ],
      0.96,
      'courses',
    ),
  },
  thatch: {
    doc: 'Layered reed bundles with dense longitudinal strands and broad tying courses.',
    seed: 113,
    ...finishSurface(
      [
        ...profile('bundles', 4, 90, [
          [0, '#b7af95'],
          [0.14, '#e4dabe'],
          [0.8, '#eee3c7'],
          [1, '#b7af95'],
        ]),
        ...fibers(64, 3, 0.77),
        multiply('out', 'bundles', 'fiber'),
      ],
      0.99,
      'bundles',
    ),
  },
  tile_flat: {
    doc: 'Small flat clay tiles laid in overlapping staggered courses.',
    seed: 114,
    ...masonry(12, 8, 0.035, 0.5, '#bdb2a5', '#f0e5d8', 0.78),
  },
  tile_glazed: {
    doc: 'Glossy aligned barrel tiles with a rounded cross-section and recessed lap joints.',
    seed: 115,
    ...finishSurface(
      [
        bricks('courses', 7, 9, 0.035, 0),
        twoTone('tiles', 'courses', '#b4babe', '#f5f5ef'),
        ...profile('curve', 9, 0, [
          [0, '#c7cdcd'],
          [0.2, '#e0e5e3'],
          [0.5, '#ffffff'],
          [0.8, '#e0e5e3'],
          [1, '#c7cdcd'],
        ]),
        multiply('out', 'tiles', 'curve'),
      ],
      0.25,
      'curve',
    ),
  },
  tile_mosaic: {
    doc: 'Small alternating ceramic mosaic squares with fine pale grout.',
    seed: 116,
    ...finishSurface(
      [
        { id: 'squares', type: 'checker', params: { scale: 12 } },
        twoTone('enamel', 'squares', '#d4e1e2', '#f4f1e4'),
        bricks('grout', 12, 12, 0.035, 0),
        twoTone('joints', 'grout', '#b9b6ae', '#ffffff'),
        multiply('out', 'enamel', 'joints'),
      ],
      0.32,
      'grout',
    ),
  },
  metal_standing_seam: {
    doc: 'Standing-seam metal pans with narrow folded ribs; coated matte metal response.',
    seed: 117,
    ...finishSurface(
      [
        ...profile('seams', 5, 0, [
          [0, '#b9c0c4'],
          [0.04, '#eef0f0'],
          [0.075, '#bcc3c7'],
          [0.11, '#e2e6e7'],
          [0.95, '#e2e6e7'],
          [1, '#b9c0c4'],
        ]),
        ...fibers(4, 24, 0.97),
        multiply('out', 'seams', 'fiber'),
      ],
      0.5,
      'seams',
      0.45,
    ),
  },
  metal_corrugated: {
    doc: 'Galvanized corrugated sheets with narrow rounded vertical flutes.',
    seed: 118,
    ...finishSurface(
      [
        ...profile('flutes', 16, 0, [
          [0, '#bfc6c8'],
          [0.25, '#dce1e1'],
          [0.5, '#f4f5f2'],
          [0.75, '#dce1e1'],
          [1, '#bfc6c8'],
        ]),
        ...fibers(12, 12, 0.96),
        multiply('out', 'flutes', 'fiber'),
      ],
      0.56,
      'flutes',
      0.62,
    ),
  },
  metal_copper: {
    doc: 'Broad copper sheets with soldered seams and soft patination; tint copper or verdigris.',
    seed: 119,
    ...finishSurface(
      [
        bricks('panels', 3, 3, 0.025, 0.5),
        twoTone('copper', 'panels', '#a5b8b2', '#e4eae0'),
        ...fibers(6, 6, 0.87),
        multiply('out', 'copper', 'fiber'),
      ],
      0.63,
      'panels',
      0.58,
    ),
  },
  stone_ashlar: {
    doc: 'Dressed ashlar blocks in staggered courses with narrow recessed joints.',
    seed: 120,
    ...masonry(5, 4, 0.035, 0.5, '#bbb7ae', '#eae6dd', 0.9, 0.89),
  },
  stone_limestone: {
    doc: 'Large pale limestone blocks with restrained fossil-like pores.',
    seed: 121,
    ...finishSurface(
      [
        bricks('joints', 4, 3, 0.025, 0.5),
        twoTone('blocks', 'joints', '#c7bfb0', '#f0eadc'),
        { id: 'pores', type: 'worley', params: { scale: 28, jitter: 0.85, output: 'f1' } },
        levels('pitting', 'pores', 0.92, 1),
        multiply('out', 'blocks', 'pitting'),
      ],
      0.91,
      'joints',
    ),
  },
  stone_sandstone: {
    doc: 'Coursed sandstone with horizontal sediment bands; tint ochre, pink or rust.',
    seed: 122,
    ...finishSurface(
      [
        bricks('joints', 6, 3, 0.04, 0.5),
        twoTone('blocks', 'joints', '#bdb09b', '#f0e3cb'),
        ...fibers(3, 38, 0.85),
        multiply('out', 'blocks', 'fiber'),
      ],
      0.96,
      'joints',
    ),
  },
  stone_basalt: {
    doc: 'Tightly coursed split volcanic masonry with granular faces; use dark basalt tint.',
    seed: 123,
    ...masonry(7, 4, 0.045, 0.5, '#aab0ad', '#dce0db', 0.97, 0.83),
  },
  stone_drywall: {
    doc: 'Unmortared irregular fieldstone with dark open joints and broad weathered faces.',
    seed: 124,
    ...finishSurface(
      [
        { id: 'cells', type: 'worley', params: { scale: 7, jitter: 0.9, output: 'f2-f1' } },
        ramp('stones', 'cells', [
          [0, '#a09e93'],
          [0.045, '#b0afa3'],
          [0.09, '#dedbd0'],
          [0.3, '#ebe8dc'],
          [1, '#dbd9ce'],
        ]),
        ...fibers(14, 14, 0.9),
        multiply('out', 'stones', 'fiber'),
      ],
      0.98,
      'cells',
    ),
  },
  earth_adobe: {
    doc: 'Broad hand-formed adobe blocks with soft earth joints and fibrous faces.',
    seed: 125,
    ...masonry(5, 3, 0.055, 0.5, '#c2b295', '#eedfc0', 0.99, 0.87),
  },
  earth_rammed: {
    doc: 'Compacted earth lifts with subtle alternating sediment strata.',
    seed: 126,
    ...finishSurface(
      [
        ...profile('lifts', 6, 90, [
          [0, '#d5c7ac'],
          [0.06, '#e9dbc0'],
          [0.42, '#e4d5b7'],
          [0.7, '#eee1c8'],
          [1, '#d5c7ac'],
        ]),
        ...fibers(8, 36, 0.94),
        multiply('out', 'lifts', 'fiber'),
      ],
      0.99,
    ),
  },
  plaster_lime: {
    doc: 'Fine limewash with broad overlapping brush-like clouding.',
    seed: 127,
    ...renderSurface('#e2dfd2', '#faf6e9', 0.94, 6, 12),
  },
  plaster_tadelakt: {
    doc: 'Smooth burnished lime plaster with soft broad trowel mottling.',
    seed: 128,
    ...renderSurface('#ddd8ca', '#f5eedf', 0.48, 4, 5),
  },
  concrete_boardformed: {
    doc: 'Horizontal timber formwork impressions on poured concrete.',
    seed: 129,
    ...boards(
      8,
      false,
      [
        [0, '#b4b5af'],
        [0.045, '#dedfd7'],
        [0.12, '#ebebe2'],
        [0.95, '#e0e1da'],
        [1, '#b4b5af'],
      ],
      0.94,
      0.93,
    ),
  },
  terracotta_screen: {
    doc: 'Ventilated terracotta block screen: square recesses within thick ceramic webs.',
    seed: 130,
    ...finishSurface(
      [
        bricks('openings', 6, 6, 0.17, 0),
        twoTone('ceramic', 'openings', '#eee0cc', '#a9a295'),
        ...fibers(16, 16, 0.96),
        multiply('out', 'ceramic', 'fiber'),
      ],
      0.88,
      'openings',
    ),
  },
};

function materialDocument(entry) {
  // A physical response travels with the shared material instead of depending on a wall/roof slot.
  const roughness = entry.outputs.roughness === undefined;
  return {
    format: 'molen/matgraph@1',
    size: [256, 256],
    seed: entry.seed,
    nodes: roughness
      ? [...entry.nodes, { id: 'rough', type: 'const', params: { value: 0.88 } }]
      : entry.nodes,
    outputs: roughness ? { ...entry.outputs, roughness: 'rough' } : entry.outputs,
  };
}

// ------------------------------------------------------------------ prop models

const SLOT = 'wall';
const REF = 'palette:#ffffff';

function box(out, [x0, y0, z0], [x1, y1, z1], color) {
  const faces = [
    {
      n: [0, 0, -1],
      p: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
    },
    {
      n: [0, 0, 1],
      p: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      n: [-1, 0, 0],
      p: [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
    },
    {
      n: [1, 0, 0],
      p: [
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
    },
    {
      n: [0, 1, 0],
      p: [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      n: [0, -1, 0],
      p: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
    },
  ];
  const uv = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  for (const face of faces) out.addQuad(SLOT, REF, face.p, face.n, uv, color);
}

function cylinder(out, cx, cz, radius, y0, y1, segments, color) {
  const ring = [];
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    ring.push([cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius]);
  }
  for (let index = 0; index < segments; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % segments];
    const mid = [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cz];
    const length = Math.hypot(mid[0], mid[1]) || 1;
    out.addQuad(
      SLOT,
      REF,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [mid[0] / length, 0, mid[1] / length],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      color,
    );
  }
  out.addConvexPolygon(
    SLOT,
    REF,
    ring.map(([x, z]) => [x, y1, z]),
    [0, 1, 0],
    (p) => [p[0], p[2]],
    color,
  );
  out.addConvexPolygon(
    SLOT,
    REF,
    ring.map(([x, z]) => [x, y0, z]),
    [0, -1, 0],
    (p) => [p[0], p[2]],
    color,
  );
}

async function loadProps() {
  const props = [];
  for (const entry of await readdir(propSourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const model = JSON.parse(
      await readFile(resolve(propSourceDir, entry.name, 'models/model.json'), 'utf8'),
    );
    props.push(model);
  }
  return props.sort((a, b) => a.id.localeCompare(b.id));
}

function buildProp(out, model) {
  for (const part of model.parts) {
    if (part.shape === 'box') box(out, part.min, part.max, part.color);
    else if (part.shape === 'cylinder') {
      cylinder(
        out,
        part.center[0],
        part.center[1],
        part.radius,
        part.y[0],
        part.y[1],
        part.segments,
        part.color,
      );
    } else throw new Error(`${model.id}: unknown prop shape ${part.shape}`);
  }
}

const PROPS = await loadProps();

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

function sidecar(id, buffers, glb) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const positions = buffers.positions;
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  const lo = min.map(round);
  const hi = max.map(round);
  const center = lo.map((value, axis) => round((value + hi[axis]) / 2));
  let radius = 0;
  for (let index = 0; index < positions.length; index += 3) {
    radius = Math.max(
      radius,
      Math.hypot(
        positions[index] - center[0],
        positions[index + 1] - center[1],
        positions[index + 2] - center[2],
      ),
    );
  }
  const corners = [
    [lo[0], lo[1], lo[2]],
    [hi[0], lo[1], lo[2]],
    [hi[0], lo[1], hi[2]],
    [lo[0], lo[1], hi[2]],
    [lo[0], hi[1], lo[2]],
    [hi[0], hi[1], lo[2]],
    [hi[0], hi[1], hi[2]],
    [lo[0], hi[1], hi[2]],
  ].flat();
  return {
    format: 'molen/asset@1',
    id,
    kind: 'model',
    files: { main: 'model.glb', variants: {} },
    hash: `sha256:${createHash('sha256').update(glb).digest('hex')}`,
    bounds: { aabb: { min: lo, max: hi }, sphere: { center, radius: round(radius) } },
    stats: {
      triangles: buffers.triangleCount,
      vertices: buffers.vertexCount,
      meshes: 1,
      primitives: buffers.groups.length,
      materials: buffers.groups.length,
      textures: 0,
      animations: 0,
      sizeBytes: glb.byteLength,
    },
    nodes: [{ name: id, triangles: buffers.triangleCount }],
    nodesTruncated: false,
    animations: [],
    materials: buffers.groups.map((group) => ({
      name: `${group.slot}`,
      slots: ['baseColor'],
      doubleSided: false,
      alphaMode: 'OPAQUE',
    })),
    collision: { hulls: [{ node: id, points: corners }] },
    extensionsUsed: [],
  };
}

// ------------------------------------------------------------------ emit

let stale = 0;
async function emit(relativePath, bytes) {
  const destination = resolve(packDir, relativePath);
  if (check) {
    let current;
    try {
      current = await readFile(destination);
    } catch {
      throw new Error(
        `packs/default/${relativePath} is missing; run node scripts/generate-pack.mjs`,
      );
    }
    if (!current.equals(bytes)) {
      stale++;
      console.error(`stale: packs/default/${relativePath}`);
    }
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

for (const [name, entry] of Object.entries(MATERIALS)) {
  await emit(
    `materials/${name}.matgraph.json`,
    Buffer.from(`${formatJson(materialDocument(entry))}\n`),
  );
}
for (const model of PROPS) {
  const id = model.id;
  const name = id.replace('molen.worldgen.prop.', '');
  const out = new MeshBufferBuilder();
  buildProp(out, model);
  const buffers = out.finalize();
  const glb = Buffer.from(encodeGlb(buffers, [{ name: 'prop', roughness: 0.85, metallic: 0 }]));
  await emit(`assets/prop/${name}/model.glb`, glb);
  await emit(
    `assets/prop/${name}/asset.json`,
    Buffer.from(`${formatJson(sidecar(id, buffers, glb))}\n`),
  );
}
if (stale > 0) {
  console.error(`${stale} generated pack file(s) are stale; run node scripts/generate-pack.mjs`);
  process.exit(1);
}
console.log(
  `${check ? 'Verified' : 'Generated'} ${Object.keys(MATERIALS).length} materials and ${PROPS.length} prop models.`,
);
