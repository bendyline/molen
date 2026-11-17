import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  granite: surface('wall', 'stone_ashlar', 0.94),
  plinth: surface('foundation', 'stone_granite', 0.95),
  coping: surface('roof', 'concrete_plain', 0.91),
  door: surface('door', 'wood_plain', 0.86),
  window: surface('window', 'window_punched', 0.36),
  iron: surface('trim', 'metal_painted', 0.74, 0.12),
};
const colors = palette({
  granite: '888676',
  dressed: 'a8a18c',
  coping: '959384',
  door: '45514e',
  glass: '4b5350',
  paint: '57615a',
  pipe: '434a45',
});

function enlarged(outline, factor) {
  return outline.map(([x, z]) => [x * factor, (z - 0.65) * factor + 0.65]);
}

function masonryBand(out, outline, bottom, top, slot, color) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    face(
      out,
      slot,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      edge(a, b, sign).normal,
      color,
    );
  }
  cap(out, slot, outline, top, color);
}

function envelope(out, lod, outline, floor, top) {
  masonryBand(out, enlarged(outline, 1.035), floor - 3.55, floor - 0.26, 'plinth', colors.dressed);
  masonryBand(out, enlarged(outline, 1.067), floor - 0.27, floor, 'plinth', colors.dressed);
  masonryBand(out, outline, floor, top, 'granite', colors.granite);
  if (lod > 0)
    masonryBand(out, enlarged(outline, 1.026), top - 0.36, top - 0.29, 'plinth', colors.dressed);
  masonryBand(out, enlarged(outline, 1.062), top - 0.16, top + 0.045, 'plinth', colors.dressed);
  masonryBand(out, enlarged(outline, 1.038), top + 0.045, top + 0.11, 'coping', colors.coping);
}

function openings(out, lod, outline, floor) {
  const sign = areaSign(outline);
  const entrance = edge(outline[0], outline[1], sign);
  const side = edge(outline[1], outline[2], sign);
  const opposite = edge(outline[11], outline[0], sign);
  arch(
    out,
    entrance,
    entrance.length * 0.5,
    floor + 0.06,
    floor + 1.52,
    0.49,
    0.49,
    0.038,
    lod,
    { inner: colors.door, trim: colors.dressed, width: 0.105 },
    { inner: 'door', trim: 'plinth' },
  );
  for (const wall of [side, opposite]) {
    const mid = wall.length * 0.55;
    arch(
      out,
      wall,
      mid,
      floor + 0.94,
      floor + 1.52,
      0.31,
      0.31,
      0.024,
      lod,
      { inner: colors.glass, trim: colors.dressed, width: 0.08 },
      { inner: 'window', trim: 'plinth' },
    );
    if (lod > 0)
      panel(
        out,
        'plinth',
        wall,
        mid - 0.41,
        mid + 0.41,
        floor + 0.875,
        floor + 0.96,
        0.087,
        colors.dressed,
      );
    if (lod > 1)
      panel(
        out,
        'iron',
        wall,
        mid - 0.019,
        mid + 0.019,
        floor + 0.96,
        floor + 1.77,
        0.05,
        colors.pipe,
      );
  }
  if (lod < 2) return;
  const [x, z] = outline[1];
  block(out, 'iron', x - 0.115, floor + 0.02, z - 0.065, 0.086, 2.42, 0.092, colors.pipe);
  block(out, 'iron', x - 0.18, floor + 2.31, z - 0.106, 0.22, 0.145, 0.185, colors.pipe);
  if (lod === 3) {
    block(out, 'iron', x - 0.225, floor + 2.411, z - 0.071, 0.31, 0.045, 0.121, colors.pipe);
    for (const elevation of [0.35, 1.29, 2.13])
      block(
        out,
        'iron',
        x - 0.127,
        floor + elevation,
        z - 0.079,
        0.108,
        0.035,
        0.122,
        colors.paint,
      );
  }
}

function footbridge(out, lod, floor, bridge, grade) {
  const { approachX, centerX, centerZ, width } = bridge;
  const inside = centerZ - width / 2;
  const outside = centerZ + width / 2;
  const end = centerX + width / 2;
  const entranceZ = 2.49;
  block(
    out,
    'coping',
    approachX,
    floor - 0.18,
    inside,
    end - approachX,
    0.18,
    width,
    colors.coping,
  );
  block(
    out,
    'coping',
    centerX - width / 2,
    floor - 0.18,
    entranceZ,
    width,
    0.18,
    inside - entranceZ,
    colors.coping,
  );
  for (const x of [approachX + 0.45, -14.2, -6.8, centerX]) {
    const bed = Math.min(floor - 0.42, grade([x, centerZ]) - 0.24);
    block(
      out,
      'plinth',
      x - 0.21,
      bed,
      centerZ - 0.36,
      0.42,
      floor - 0.16 - bed,
      0.72,
      colors.dressed,
    );
  }
  for (const [z, right] of [
    [inside + 0.04, centerX - width / 2],
    [outside - 0.07, end],
  ]) {
    const length = right - approachX;
    block(out, 'iron', approachX, floor + 0.86, z, length, 0.047, 0.04, colors.paint);
    if (lod > 0)
      block(out, 'iron', approachX, floor + 0.48, z + 0.004, length, 0.032, 0.032, colors.paint);
    const posts = [5, 8, 11, 15][lod];
    for (let post = 0; post < posts; post++) {
      const x = mix(approachX + 0.04, right - 0.02, post / (posts - 1));
      block(out, 'iron', x - 0.019, floor, z - 0.004, 0.038, 0.89, 0.047, colors.paint);
    }
  }
  const length = outside - entranceZ - 0.04;
  block(out, 'iron', end - 0.04, floor + 0.86, entranceZ, 0.04, 0.047, length, colors.paint);
  block(out, 'iron', end - 0.04, floor, entranceZ, 0.04, 0.896, 0.043, colors.paint);
}

function draw(out, lod, { outline, floor, wallHeight, bridge }, grade) {
  envelope(out, lod, outline, floor, floor + wallHeight);
  openings(out, lod, outline, floor);
  footbridge(out, lod, floor, bridge, grade);
}

const house = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [11, 20, 21],
    lookAt: [-8.2, 7.3, 2.1],
    yaw: -0.47,
    brief:
      'Rounded granite Intermediate Reservoir Valve House with a projecting plinth, semicircular openings, iron downpipe and footbridge along the crest.',
    views: [
      { name: 'arched-entrance-and-landing', position: [3.9, 12.6, 12.1], lookAt: [0, 8.8, 1.2] },
      {
        name: 'curved-lakeward-wall-and-ashlar-base',
        position: [-4.4, 12.3, -10.6],
        lookAt: [0.15, 8.3, 0.6],
      },
      {
        name: 'crest-footbridge-and-rounded-plan',
        position: [-12.8, 21.1, 9.9],
        lookAt: [-9.1, 7.7, 2.3],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = house;
model.category = 'industrial';
model.mediumFiContext.scale = 0.28;
model.sourceLicense =
  'Independent reconstruction from the Hong Kong government heritage boundary, original Lands Department terrain and written heritage facts.';
