import {
  block,
  mix,
  palette,
  pavilion,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.93),
  coping: surface('foundation', 'stone_granite', 0.93),
  concrete: surface('roof', 'concrete_plain', 0.93),
  rails: surface('trim', 'metal_painted', 0.75, 0.15),
};
const colors = palette({
  stone: '918c7d',
  footing: '777870',
  cap: 'a09b8b',
  deck: '928f80',
  bed: '777a6e',
  coping: '96988a',
  rail: '87938b',
});

function pier(out, lod, x, deck, width, grade, end) {
  const breadth = end ? 1.36 : 0.85;
  const depth = width - (end ? 0.13 : 0.48);
  const bottom = Math.min(
    deck - 1.14,
    ...[-depth * 0.45, depth * 0.45].map((z) => grade([x, z]) - 0.39),
  );
  const neck = deck - 0.71;
  block(
    out,
    'stone',
    x - breadth / 2,
    bottom,
    -depth / 2,
    breadth,
    neck - bottom,
    depth,
    colors.stone,
  );
  block(
    out,
    'coping',
    x - breadth / 2 - 0.13,
    neck,
    -depth / 2 - 0.105,
    breadth + 0.26,
    0.23,
    depth + 0.21,
    colors.cap,
  );
  if (lod > 0) {
    block(
      out,
      'coping',
      x - breadth / 2 - 0.08,
      bottom,
      -depth / 2 - 0.12,
      breadth + 0.16,
      0.25,
      depth + 0.24,
      colors.footing,
    );
  }
  if (lod > 1) {
    block(
      out,
      'coping',
      x - breadth / 2 - 0.075,
      neck - 0.12,
      -depth / 2 - 0.06,
      breadth + 0.15,
      0.12,
      depth + 0.12,
      colors.cap,
    );
  }
}

function rail(out, lod, left, right, z, deck) {
  const span = right - left;
  const count = [5, 10, 15, 18][lod];
  block(out, 'rails', left, deck + 0.94, z - 0.024, span, 0.048, 0.048, colors.rail);
  if (lod > 0) {
    block(out, 'rails', left, deck + 0.51, z - 0.018, span, 0.039, 0.036, colors.rail);
  }
  for (let j = 0; j < count; j++) {
    const x = mix(left, right, j / (count - 1));
    block(out, 'rails', x - 0.021, deck + 0.08, z - 0.021, 0.042, 0.91, 0.042, colors.rail);
    if (lod === 3) {
      block(out, 'coping', x - 0.055, deck + 0.078, z - 0.054, 0.11, 0.052, 0.108, colors.coping);
    }
  }
}

function draw(out, lod, { span, width, deckY, piers }, grade) {
  const [left, right] = span;
  const total = right - left,
    half = width / 2;
  block(out, 'concrete', left, deckY - 0.5, -half, total, 0.5, width, colors.deck);
  block(out, 'concrete', left, deckY + 0.005, -0.98, total, 0.078, 1.26, colors.bed);
  block(out, 'concrete', left, deckY + 0.005, 0.29, total, 0.162, 0.84, colors.deck);
  for (const z of [-half, 0.24, half - 0.14]) {
    block(out, 'coping', left, deckY, z, total, 0.225, 0.14, colors.coping);
    if (lod > 1) {
      block(out, 'coping', left, deckY + 0.206, z - 0.033, total, 0.064, 0.205, colors.cap);
    }
  }
  for (const x of piers) pier(out, lod, x, deckY, width, grade, false);
  for (const x of [left + 0.53, right - 0.53]) pier(out, lod, x, deckY, width, grade, true);
  for (const z of [-half + 0.077, half - 0.077])
    rail(out, lod, left + 0.14, right - 0.14, z, deckY);
}

const aqueduct = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [16, 14, 35],
    lookAt: [0, 0.8, 0],
    yaw: -0.24,
    brief:
      'Tai Tam Upper Reservoir Masonry Aqueduct. A narrow water channel carried across the former stream bed by a flat slab and repeated stone piers.',
    views: [
      { name: 'aqueduct-piers-across-byewash', position: [1, 8, 26], lookAt: [0, 0.8, 0] },
      { name: 'aqueduct-trough-and-walk', position: [19, 8, 12], lookAt: [-3, 1.4, 0] },
      { name: 'aqueduct-alignment-and-slope', position: [4, 29, 23], lookAt: [0, 1, 0] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = aqueduct;
model.category = 'industrial';
model.mediumFiContext.scale = 0.5;
model.sourceLicense =
  'Independent geometry from OpenStreetMap and original Lands Department terrain. The aqueduct appears in a verified public-domain Qualla reference.';
