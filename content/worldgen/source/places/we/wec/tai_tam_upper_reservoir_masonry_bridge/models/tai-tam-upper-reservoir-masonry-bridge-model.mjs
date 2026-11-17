import {
  block,
  face,
  mix,
  palette,
  pavilion,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.95),
  plinth: surface('foundation', 'stone_granite', 0.93),
  road: surface('roof', 'concrete_plain', 0.93),
  rail: surface('trim', 'metal_painted', 0.75, 0.19),
};
const colors = palette({
  stone: '9e9480',
  plinth: '918979',
  cap: 'aba28e',
  deck: 'a29e90',
  fascia: '969080',
  girder: '4f514b',
  rail: '838e88',
});

function slopedSection(out, slot, deck, x0, x1, z0, z1, base, top, color) {
  const p = (x, dy, z) => [x, deck(x) + dy, z];
  const a = p(x0, base, z0),
    b = p(x1, base, z0),
    c = p(x1, base, z1),
    d = p(x0, base, z1);
  const e = p(x0, top, z0),
    f = p(x1, top, z0),
    g = p(x1, top, z1),
    h = p(x0, top, z1);
  face(out, slot, [a, b, f, e], [0, 0, -1], color);
  face(out, slot, [d, c, g, h], [0, 0, 1], color);
  face(out, slot, [a, d, h, e], [-1, 0, 0], color);
  face(out, slot, [b, c, g, f], [1, 0, 0], color);
  face(out, slot, [e, f, g, h], up, color);
  face(out, slot, [a, b, c, d], [0, -1, 0], color);
}

function support(out, lod, x, depth, thickness, deck, grade) {
  const y = deck(x) - 0.45;
  const half = depth / 2,
    w = thickness / 2;
  const lower =
    Math.min(...[x - w, x + w].flatMap((u) => [-half, half].map((z) => grade([u, z]))), y - 0.5) -
    0.46;
  const cap = lod > 0 ? 0.27 : 0.16;
  if (lod > 0) {
    block(
      out,
      'plinth',
      x - w - 0.09,
      lower,
      -half - 0.11,
      thickness + 0.18,
      0.24,
      depth + 0.22,
      colors.plinth,
    );
  }
  block(
    out,
    'stone',
    x - w,
    lower + 0.06,
    -half,
    thickness,
    y - lower - cap - 0.06,
    depth,
    colors.stone,
  );
  if (lod > 1) {
    block(
      out,
      'plinth',
      x - w - 0.13,
      y - cap,
      -half - 0.13,
      thickness + 0.26,
      0.11,
      depth + 0.26,
      colors.cap,
    );
    block(
      out,
      'plinth',
      x - w - 0.24,
      y - cap + 0.105,
      -half - 0.25,
      thickness + 0.48,
      0.11,
      depth + 0.5,
      colors.cap,
    );
  }
  block(
    out,
    'plinth',
    x - w - 0.28,
    y - 0.082,
    -half - 0.29,
    thickness + 0.56,
    0.123,
    depth + 0.58,
    colors.cap,
  );
  if (lod > 2) {
    for (const z of [-half - 0.18, half + 0.09]) {
      block(out, 'plinth', x - w - 0.07, y - 0.24, z, 0.34, 0.2, 0.1, colors.plinth);
      block(out, 'plinth', x + w - 0.27, y - 0.24, z, 0.34, 0.2, 0.1, colors.plinth);
    }
  }
}

function safetyRails(out, lod, span, width, deck) {
  const [left, right] = span;
  for (const z of [-width / 2 + 0.07, width / 2 - 0.07]) {
    slopedSection(
      out,
      'rail',
      deck,
      left + 0.19,
      right - 0.19,
      z - 0.028,
      z + 0.028,
      0.99,
      1.048,
      colors.rail,
    );
    const posts = [5, 10, 15, 19][lod];
    for (let j = 0; j < posts; j++) {
      const x = mix(left + 0.22, right - 0.22, j / (posts - 1));
      block(out, 'rail', x - 0.023, deck(x) - 0.04, z - 0.023, 0.047, 1.061, 0.047, colors.rail);
      if (lod > 2)
        block(out, 'rail', x - 0.054, deck(x), z - 0.052, 0.107, 0.044, 0.104, colors.rail);
    }
    if (lod > 1)
      slopedSection(
        out,
        'rail',
        deck,
        left + 0.19,
        right - 0.19,
        z - 0.019,
        z + 0.019,
        0.52,
        0.563,
        colors.rail,
      );
  }
}

function draw(out, lod, { span, width, deckEnds, pierXs }, grade) {
  const [left, right] = span;
  const deck = (x) => mix(...deckEnds, (x - left) / (right - left));
  const half = width / 2;
  slopedSection(out, 'road', deck, left, right, -half, half, -0.31, 0, colors.deck);
  for (const z of [-half + 0.28, half - 0.28]) {
    slopedSection(
      out,
      'rail',
      deck,
      left + 0.32,
      right - 0.32,
      z - 0.1,
      z + 0.1,
      -0.47,
      -0.29,
      colors.girder,
    );
    if (lod > 1) {
      const edge = z < 0 ? -half : half;
      slopedSection(
        out,
        'plinth',
        deck,
        left,
        right,
        edge - 0.055,
        edge + 0.055,
        -0.13,
        0.032,
        colors.fascia,
      );
    }
  }
  for (const x of pierXs) support(out, lod, x, width - 0.51, 1.38, deck, grade);
  for (const x of [left + 0.52, right - 0.52]) support(out, lod, x, width - 0.17, 1.2, deck, grade);
  safetyRails(out, lod, span, width, deck);
}

const bridge = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [28, 18, 37],
    lookAt: [0, 1.2, 0],
    yaw: 0.1,
    brief:
      'Tai Tam Upper Reservoir Masonry Bridge. A long, low flat concrete slab carried by dressed masonry piers and corbels, with a dark soffit and light metal safety rails.',
    views: [
      { name: 'masonry-piers-and-flat-deck', position: [9, 6.7, 20], lookAt: [-2, 0.2, 0] },
      { name: 'road-and-abutments', position: [-24, 9, 13], lookAt: [2, 1, 0] },
      { name: 'upper-reservoir-bridge-from-above', position: [8, 26, 24], lookAt: [0, 0.6, 0] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = bridge;
model.category = 'bridge';
model.mediumFiContext.scale = 0.54;
model.sourceLicense =
  'Independent model from OpenStreetMap, original Hong Kong Lands Department terrain and one published public-domain Qualla photo.';
