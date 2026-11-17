import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  pavilion,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  wall: surface('wall', 'stone_ashlar', 0.94),
  footing: surface('foundation', 'stone_basalt_raw', 0.94),
  trim: surface('trim', 'stone_granite', 0.91),
  roof: surface('roof', 'concrete_plain', 0.94),
  door: surface('door', 'wood_plain', 0.86),
  iron: surface('trim', 'metal_painted', 0.78, 0.16),
};
const colors = palette({
  granite: '9b9581',
  cap: 'aba38f',
  apron: '8d897b',
  base: '797a70',
  iron: '4f5953',
  wood: '59635a',
  dark: '40443e',
});

function platform(out, lod, outline, top, grade) {
  const sign = areaSign(outline);
  for (const [i, [a, b]] of pairs(closed(outline)).entries()) {
    // The exposed arch and its returns replace these three curved front panels.
    if (i >= 5 && i <= 7) continue;
    const wall = edge(a, b, sign);
    const baseA = Math.min(grade(a) - 0.42, top - 0.8);
    const baseB = Math.min(grade(b) - 0.42, top - 0.8);
    face(
      out,
      'footing',
      [at(a, baseA), at(b, baseB), at(b, top - 0.19), at(a, top - 0.19)],
      wall.normal,
      colors.base,
    );
    face(
      out,
      'trim',
      [at(a, top - 0.19), at(b, top - 0.19), at(b, top), at(a, top)],
      wall.normal,
      colors.cap,
    );
    if (lod > 1) {
      face(
        out,
        'wall',
        [at(a, top - 0.29), at(b, top - 0.29), at(b, top - 0.22), at(a, top - 0.22)],
        wall.normal,
        colors.granite,
      );
    }
  }
  cap(out, 'roof', outline, top, colors.apron);
}

function intakePortal(out, lod, top, { faceX, clearWidth, springY, crownY, footY }, outline) {
  const x = faceX - 0.21;
  const radius = clearWidth / 2,
    rise = crownY - springY;
  const high = outline[5][1],
    low = outline[8][1];
  const thickness = 0.19;
  const crown = (z) => springY + rise * Math.sqrt(Math.max(0, 1 - (z / radius) ** 2));
  const p = (z, y, d = 0) => [x + d, y, z],
    normal = [-1, 0, 0];
  const wall = (slot, z0, z1, base, height, color) =>
    face(out, slot, [p(z0, base), p(z1, base), p(z1, height), p(z0, height)], normal, color);
  wall('wall', low, -radius, footY, top, colors.granite);
  wall('wall', radius, high, footY, top, colors.granite);
  for (const tip of [outline[5], outline[8]]) {
    const h = tip[1];
    face(
      out,
      'wall',
      [p(h, footY), at(tip, footY), at(tip, top), p(h, top)],
      [0, 0, Math.sign(h)],
      colors.granite,
    );
  }
  const pieces = [5, 8, 12, 16][lod];
  const arch = Array.from({ length: pieces + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / pieces);
    return [radius * Math.cos(a), springY + rise * Math.sin(a)];
  });
  for (const [[z0, y0], [z1, y1]] of pairs(arch)) {
    face(out, 'wall', [p(z0, y0), p(z1, y1), p(z1, top), p(z0, top)], normal, colors.granite);
    face(
      out,
      'footing',
      [p(z0, y0), p(z1, y1), p(z1, y1, 0.96), p(z0, y0, 0.96)],
      [0, -1, 0],
      colors.base,
    );
    if (lod > 0) {
      const trimA = mix(z0, z1, 0.03),
        trimB = mix(z0, z1, 0.967);
      face(
        out,
        'trim',
        [
          p(trimA, y0, -0.032),
          p(trimB, y1, -0.032),
          p(trimB, Math.min(top, y1 + thickness), -0.032),
          p(trimA, Math.min(top, y0 + thickness), -0.032),
        ],
        normal,
        colors.cap,
      );
    }
  }
  for (const z of [-radius, radius]) {
    face(
      out,
      'footing',
      [p(z, footY), p(z, footY, 1.01), p(z, springY, 1.01), p(z, springY)],
      [0, 0, -Math.sign(z)],
      colors.base,
    );
  }
  block(
    out,
    'footing',
    x + 0.98,
    footY,
    -radius - 0.05,
    0.16,
    rise + springY - footY + 0.01,
    clearWidth + 0.1,
    colors.dark,
  );
  const bars = [5, 9, 13, 17][lod];
  for (let i = 0; i < bars; i++) {
    const z = mix(-radius + 0.1, radius - 0.1, i / (bars - 1));
    block(
      out,
      'iron',
      x + 0.14,
      footY + 0.06,
      z - 0.025,
      0.046,
      crown(z) - footY - 0.065,
      0.05,
      colors.iron,
    );
  }
  for (const y of [-1.96, -1.03]) {
    block(out, 'iron', x + 0.102, y, -radius, 0.065, 0.057, clearWidth, colors.iron);
  }
  const plaqueY = top + 0.08;
  block(out, 'trim', x - 0.1, plaqueY, -0.56, 0.2, 0.31, 1.12, colors.cap);
  face(
    out,
    'trim',
    [p(-0.63, plaqueY + 0.3, -0.106), p(0.63, plaqueY + 0.3, -0.106), p(0, plaqueY + 0.63, -0.106)],
    normal,
    colors.cap,
  );
  if (lod === 3) {
    const glyphs = [
      [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    ];
    for (const [i, glyph] of glyphs.entries())
      for (const [j, used] of glyph.entries()) {
        if (used)
          block(
            out,
            'iron',
            x - 0.112,
            plaqueY + 0.073 + (4 - Math.floor(j / 3)) * 0.031,
            -0.49 + i * 0.16 + (j % 3) * 0.032,
            0.018,
            0.027,
            0.026,
            colors.dark,
          );
      }
  }
}

function house(out, lod, top, dimensions) {
  const { west, east, near, far, height } = dimensions;
  block(out, 'wall', west, top, near, east - west, height, far - near, colors.granite);
  const roof = top + height;
  block(
    out,
    'roof',
    west - 0.08,
    roof,
    near - 0.08,
    east - west + 0.16,
    0.17,
    far - near + 0.16,
    colors.apron,
  );
  const rim = 0.19;
  for (const z of [near - 0.13, far - 0.07])
    block(out, 'trim', west - 0.13, roof + 0.12, z, east - west + 0.26, 0.14, rim, colors.cap);
  for (const x of [west - 0.13, east - 0.06])
    block(out, 'trim', x, roof + 0.12, near, rim, 0.14, far - near, colors.cap);
  const wall = { normal: [-1, 0, 0], p: (z, y, d = 0) => [west - d, y, z] };
  opening(
    out,
    wall,
    -1.66,
    -0.36,
    top + 0.12,
    top + 2.34,
    'trim',
    colors.wood,
    'door',
    colors.cap,
    Math.max(0, lod - 1),
    0.041,
  );
  opening(
    out,
    wall,
    0.86,
    1.97,
    top + 1.29,
    top + 2.19,
    'trim',
    colors.iron,
    'iron',
    colors.cap,
    Math.max(0, lod - 1),
    0.05,
  );
  if (lod > 0) block(out, 'trim', west - 0.53, top, -1.78, 0.56, 0.15, 1.55, colors.cap);
}

function catwalk(out, lod, top, houseWest) {
  if (!lod) return;
  const start = -2.9,
    end = houseWest - 0.2;
  for (const z of [-2.61, 2.61]) {
    block(out, 'roof', start, top - 0.015, z - 0.36, end - start, 0.1, 0.72, colors.apron);
    block(out, 'iron', start, top + 0.94, z - 0.023, end - start, 0.049, 0.046, colors.iron);
    if (lod > 1)
      block(out, 'iron', start, top + 0.56, z - 0.019, end - start, 0.047, 0.038, colors.iron);
    const count = lod === 1 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const x = mix(start, end, i / (count - 1));
      block(out, 'iron', x - 0.023, top + 0.079, z - 0.023, 0.046, 0.91, 0.046, colors.iron);
    }
  }
}

function draw(out, lod, dims, grade) {
  const { outline, platformY, house: building, intake } = dims;
  platform(out, lod, outline, platformY, grade);
  intakePortal(out, lod, platformY, intake, outline);
  house(out, lod, platformY, building);
  catwalk(out, lod, platformY, building.west);
}

const intake = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-23, 12, 14],
    lookAt: [2, 0.7, 0],
    yaw: -1.1,
    brief:
      'Tai Tam Upper Reservoir Recorder House and Tunnel Inlet, with a small granite instrument house, curved intake platform, dated pediment and iron grille.',
    views: [
      { name: 'inlet-grate-and-stone-pediment', position: [-15, 3, -4], lookAt: [-3.7, -0.55, 0] },
      { name: 'recorder-house-and-catwalks', position: [-17, 9, 9], lookAt: [2, 1.4, 0] },
      { name: 'upper-reservoir-recorder-platform', position: [-10, 22, -10], lookAt: [2, 0.9, 0] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = intake;
model.category = 'industrial';
model.mediumFiContext.scale = 0.28;
model.sourceLicense =
  'Independent geographic model from the native OpenStreetMap outline, original Lands Department terrain and written heritage descriptions.';
