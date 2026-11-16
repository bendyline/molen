import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  footing: surface('foundation', 'stone_basalt_raw', 0.96),
  trim: surface('trim', 'stone_granite', 0.91),
  roof: surface('roof', 'concrete_plain', 0.96),
  door: surface('door', 'wood_plain', 0.86),
};
const colors = palette({
  stone: '918c79',
  foundation: '77776d',
  trim: 'a29e8d',
  roof: '898b80',
  entry: '515f57',
  closure: '858379',
});

function shell(out, lod, outline, floor, top, grade) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    face(
      out,
      'footing',
      [
        at(a, Math.min(floor - 0.38, grade(a) - 0.37)),
        at(b, Math.min(floor - 0.38, grade(b) - 0.37)),
        at(b, floor),
        at(a, floor),
      ],
      w.normal,
      colors.foundation,
    );
    face(
      out,
      'stone',
      [at(a, floor), at(b, floor), at(b, top), at(a, top)],
      w.normal,
      colors.stone,
    );
    if (lod > 0) {
      const count = lod > 1 ? 7 : 4;
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * w.length) / count;
        trimBlock(
          out,
          'trim',
          w,
          x - 0.082,
          x + 0.082,
          top - 0.37,
          top - 0.115,
          0,
          0.185,
          colors.trim,
        );
        if (lod === 3)
          trimBlock(
            out,
            'trim',
            w,
            x - 0.064,
            x + 0.064,
            top - 0.45,
            top - 0.351,
            0,
            0.104,
            colors.trim,
          );
      }
    }
  }
  block(out, 'trim', -2.27, top - 0.13, -2.27, 4.54, 0.265, 4.54, colors.trim);
  block(out, 'roof', -2.22, top + 0.127, -2.22, 4.44, 0.115, 4.44, colors.roof);
}

function openings(out, lod, floor) {
  const front = plane(2.06, 1),
    back = plane(-2.06, -1);
  opening(
    out,
    front,
    -0.65,
    0.65,
    floor + 0.09,
    floor + 2.24,
    'trim',
    colors.entry,
    'door',
    colors.trim,
    Math.max(0, lod - 1),
    0.019,
  );
  for (const x of [-1.07, 1.07]) {
    const low = floor + 1.17,
      high = floor + 1.91;
    panel(out, 'footing', back, x - 0.36, x + 0.36, low, high, 0.024, colors.closure);
    if (lod > 0) {
      panel(out, 'trim', back, x - 0.43, x + 0.43, high - 0.022, high + 0.115, 0.036, colors.trim);
      panel(out, 'trim', back, x - 0.43, x + 0.43, low - 0.097, low + 0.015, 0.036, colors.trim);
    }
  }
  if (lod > 1) {
    block(out, 'trim', -0.78, floor - 0.103, 2.035, 1.56, 0.213, 0.4, colors.trim);
  }
}

function draw(out, lod, { outline, floor, wallHeight }, grade) {
  shell(out, lod, outline, floor, floor + wallHeight, grade);
  openings(out, lod, floor);
}

const house = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [7, 8.6, 10],
    lookAt: [0, 3.8, 0],
    yaw: -0.46,
    brief:
      'The square Upper Reservoir Valve House on the crest of Tai Tam Dam, with rock-faced granite, a projecting corbelled roof and two blocked rear openings.',
    views: [
      { name: 'crest-side-door-and-corbels', position: [3.3, 7, 7.8], lookAt: [0, 3.75, 0] },
      { name: 'blocked-rear-openings', position: [-4.9, 6.8, -8.1], lookAt: [0, 3.7, 0] },
      {
        name: 'square-valve-house-and-crest-platform',
        position: [5.8, 13.4, 7.1],
        lookAt: [0, 2.9, 0],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = house;
model.category = 'industrial';
model.mediumFiContext.scale = 0.17;
model.sourceLicense =
  'Independent source reconstruction from the native dam platform, Hong Kong Lands Department elevations and written heritage facts.';
