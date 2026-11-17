import {
  arch,
  block,
  mix,
  palette,
  pavilion,
  plane,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  trim: surface('trim', 'stone_granite', 0.91),
  base: surface('foundation', 'stone_basalt_raw', 0.97),
  roof: surface('roof', 'concrete_plain', 0.92),
  metal: surface('trim', 'metal_painted', 0.73, 0.15),
};
const colors = palette({
  stone: '898475',
  trim: 'a49b86',
  base: '767367',
  roof: '888877',
  iron: '56605a',
  opening: '414e48',
  blocking: '7e7d6d',
});

function mainHouse(out, lod, { outline, floor, wallHeight }, grade) {
  const left = Math.min(...outline.map(([x]) => x));
  const right = Math.max(...outline.map(([x]) => x));
  const front = Math.min(...outline.map(([, z]) => z));
  const back = Math.max(...outline.map(([, z]) => z));
  const width = right - left;
  const depth = back - front;
  const top = floor + wallHeight;
  const footing = Math.min(...outline.map((point) => grade(point))) - 5.3;
  block(
    out,
    'base',
    left - 0.14,
    footing,
    front - 0.13,
    width + 0.28,
    floor + 0.05 - footing,
    depth + 0.25,
    colors.base,
  );
  block(
    out,
    'trim',
    left - 0.19,
    floor - 0.12,
    front - 0.18,
    width + 0.38,
    0.26,
    depth + 0.36,
    colors.trim,
  );
  block(out, 'stone', left, floor, front, width, wallHeight, depth, colors.stone);
  if (lod > 0)
    block(
      out,
      'trim',
      left - 0.055,
      top - 0.43,
      front - 0.056,
      width + 0.111,
      0.12,
      depth + 0.112,
      colors.trim,
    );
  block(
    out,
    'trim',
    left - 0.22,
    top - 0.22,
    front - 0.21,
    width + 0.44,
    0.26,
    depth + 0.42,
    colors.trim,
  );
  block(
    out,
    'roof',
    left - 0.15,
    top + 0.03,
    front - 0.145,
    width + 0.3,
    0.13,
    depth + 0.29,
    colors.roof,
  );
  const arched = (wall, x, base, spring, radius, fill, tint) =>
    arch(
      out,
      wall,
      x,
      floor + base,
      floor + spring,
      radius,
      radius,
      0.022,
      lod,
      { inner: tint, trim: colors.trim, width: 0.105 },
      { inner: fill, trim: 'trim' },
    );
  const lakeside = plane(front, -1);
  arched(lakeside, 1.75, 0.14, 1.89, 0.58, 'metal', colors.opening);
  arched(lakeside, -1.47, 1.07, 2, 0.88, 'metal', colors.opening);
  for (const x of [-2.94, 0, 2.94])
    arched(plane(back, 1), x, 1.04, 1.86, 0.48, 'base', colors.blocking);
  if (lod > 1) {
    for (let i = 0; i < 7; i++) {
      const y = floor + 1.11 + i * 0.129;
      block(out, 'metal', -2.29, y, front - 0.065, 1.64, 0.039, 0.064, colors.iron);
    }
  }
}

function catwalk(out, lod, { floor, catwalkDepth }, grade) {
  const facade = -1.93;
  const outer = facade - catwalkDepth;
  const left = -4.79;
  const length = 9.58;
  block(out, 'metal', left, floor - 0.14, outer, length, 0.16, catwalkDepth, colors.iron);
  block(out, 'metal', left, floor + 0.99, outer + 0.03, length, 0.052, 0.05, colors.iron);
  if (lod > 0)
    block(out, 'metal', left, floor + 0.55, outer + 0.04, length, 0.039, 0.039, colors.iron);
  const posts = [5, 7, 9, 12][lod];
  for (let i = 0; i < posts; i++) {
    const x = mix(left + 0.04, left + length - 0.055, i / (posts - 1));
    block(out, 'metal', x, floor, outer + 0.032, 0.052, 1.02, 0.052, colors.iron);
    if (lod > 1 && i % 2 === 0) {
      const y = Math.max(floor - 1.08, grade([x, outer]) - 0.14);
      block(
        out,
        'metal',
        x - 0.017,
        Math.min(y, floor - 0.29),
        outer + 0.1,
        0.11,
        Math.max(floor - y - 0.14, 0.15),
        0.39,
        colors.iron,
      );
    }
  }
  for (const x of [left, left + length - 0.055])
    block(
      out,
      'metal',
      x,
      floor + 0.99,
      outer + 0.043,
      0.055,
      0.052,
      catwalkDepth - 0.043,
      colors.iron,
    );
}

function draw(out, lod, dims, grade) {
  mainHouse(out, lod, dims, grade);
  catwalk(out, lod, dims, grade);
}

const house = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [11, 8.3, -12.8],
    lookAt: [0, 1.33, -0.45],
    yaw: 2.5,
    brief:
      'Long granite Tai Tam Tuk Valve House with a water-side steel catwalk, moulded flat roof and blocked road-side openings.',
    views: [
      { name: 'lakeside-arches-and-catwalk', position: [2.7, 5.3, -8.5], lookAt: [0.2, 1.9, -1.9] },
      { name: 'blocked-road-side-openings', position: [-4.5, 5.5, 9.5], lookAt: [0, 2.45, 1.8] },
      {
        name: 'rectangular-valve-house-and-projecting-platform',
        position: [8.7, 11.5, -9],
        lookAt: [0, 1.1, -0.3],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = house;
model.category = 'industrial';
model.mediumFiContext.scale = 0.2;
model.sourceLicense =
  'Independent reconstruction from the original OpenStreetMap footprint, Hong Kong government terrain and heritage facts and boundary.';
