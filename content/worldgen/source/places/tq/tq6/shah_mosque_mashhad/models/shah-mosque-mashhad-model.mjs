import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  stone: surface('foundation', 'stone_ashlar'),
  roof: surface('roof', 'stone_sandstone'),
  glaze: surface('trim', 'tile_glazed', 0.65, 0.05),
  shadow: surface('door', 'wood_plain'),
};
const C = palette({
  brick: 'b48f65',
  relief: 'c0a478',
  stone: 'ac977b',
  roof: 'b5a07f',
  muted: '507b7d',
  blue: '2f647b',
  indigo: '38516f',
  teal: '4f9190',
  bone: 'd2c49b',
  dark: '655b4e',
  wood: '5e4a3b',
});

const TAU = 2 * Math.PI;

function diamond(out, wall, x, y, width, height, depth, tint) {
  face(
    out,
    'glaze',
    [
      wall.p(x - width, y, depth),
      wall.p(x, y + height, depth),
      wall.p(x + width, y, depth),
      wall.p(x, y - height, depth),
    ],
    wall.normal,
    tint,
  );
}

function tiledBand(out, wall, left, right, y, height, depth, lod) {
  panel(out, 'glaze', wall, left, right, y, y + height, depth, C.indigo);
  if (lod < 1) return;
  const border = height * 0.12;
  for (const edge of [y, y + height - border])
    panel(out, 'glaze', wall, left, right, edge, edge + border, depth + 0.014, C.teal);
  const count = Math.max(2, Math.round((right - left) / (lod > 2 ? 0.33 : 0.68)));
  const step = (right - left) / count;
  for (let i = 0; i < count; i++) {
    const x = left + (i + 0.5) * step;
    diamond(out, wall, x, y + height * 0.5, step * 0.34, height * 0.26, depth + 0.02, C.bone);
    if (lod > 1)
      diamond(out, wall, x, y + height * 0.5, step * 0.128, height * 0.116, depth + 0.028, C.teal);
  }
}

function archProfile(radius, spring, crown, segments) {
  const offset = radius * 0.4;
  const circle = radius + offset;
  const rise = (crown - spring) / Math.sqrt(circle * circle - offset * offset);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const x = mix(-radius, radius, i / segments);
    const d = Math.min(circle, Math.abs(x) + offset);
    return [x, spring + rise * Math.sqrt(Math.max(0, circle * circle - d * d))];
  });
}

function archedBay(out, lod, bay) {
  const { x, z, left, right, low, spring, peak, top, radius, depth, principal } = bay;
  const wall = plane(z, -1);
  const p = (a, y, d = 0) => wall.p(x + a, y, d);
  const arch = archProfile(
    radius,
    spring,
    peak,
    principal ? [6, 10, 14, 22][lod] : [4, 6, 10, 14][lod],
  );
  if (lod === 0) {
    panel(out, 'brick', wall, left, right, low - 0.4, top, 0, C.brick);
    panel(out, 'shadow', wall, x - radius, x + radius, low, spring, 0.025, C.dark);
    face(
      out,
      'shadow',
      arch.map(([u, y]) => p(u, y, 0.025)),
      wall.normal,
      C.dark,
    );
    const band = principal ? 0.68 : 0.21;
    panel(
      out,
      'glaze',
      wall,
      left + 0.06,
      right - 0.06,
      top - band - 0.17,
      top - 0.17,
      0.04,
      C.muted,
    );
    return;
  }
  const back = -depth;
  panel(out, 'brick', wall, left, x - radius, low - 0.35, top, 0, C.brick);
  panel(out, 'brick', wall, x + radius, right, low - 0.35, top, 0, C.brick);
  panel(out, 'shadow', wall, x - radius, x + radius, low - 0.1, spring + 0.025, back, C.dark);
  for (const [[a, y], [b, h]] of pairs(arch)) {
    face(out, 'brick', [p(a, y), p(b, h), p(b, top), p(a, top)], wall.normal, C.brick);
    face(
      out,
      principal ? 'glaze' : 'brick',
      [p(a, y), p(b, h), p(b, h, back), p(a, y, back)],
      [0, -1, 0],
      principal ? C.muted : C.relief,
    );
    face(
      out,
      'shadow',
      [p(a, peak + 0.07, back), p(b, peak + 0.07, back), p(b, spring, back), p(a, spring, back)],
      wall.normal,
      C.dark,
    );
  }
  for (const sign of [-1, 1])
    face(
      out,
      principal ? 'glaze' : 'brick',
      [
        p(sign * radius, low, back),
        p(sign * radius, low),
        p(sign * radius, spring),
        p(sign * radius, spring, back),
      ],
      [-sign, 0, 0],
      principal ? C.indigo : C.relief,
    );
  const contour = (arc, r, d) => [p(-r, low, d), ...arc.map(([u, y]) => p(u, y, d)), p(r, low, d)];
  const tint = principal ? C.blue : C.relief;
  beamPath(
    out,
    principal ? 'glaze' : 'brick',
    contour(arch, radius, 0.044),
    principal ? 0.26 : 0.12,
    0.13,
    tint,
  );
  if (principal || lod > 1) {
    const r = radius + (principal ? 0.39 : 0.16);
    const outer = archProfile(r, spring, peak + (principal ? 0.48 : 0.18), arch.length - 1);
    beamPath(out, 'glaze', contour(outer, r, 0.065), principal ? 0.18 : 0.066, 0.105, C.teal);
  }
  block(out, 'stone', x - radius, low - 0.1, z - 0.07, radius * 2, 0.13, depth + 0.11, C.stone);
  if (lod > 0) {
    const divisions = principal ? 7 : 4;
    const aperture = principal ? radius * 0.76 : radius * 0.93;
    const lintel = spring - (principal ? 0.41 : 0.17);
    for (let i = 0; i <= divisions; i++) {
      const t = mix(-aperture, aperture, i / divisions);
      const thickness = lod === 3 ? 0.024 : 0.039;
      panel(
        out,
        'shadow',
        wall,
        x + t - thickness,
        x + t + thickness,
        low + 0.03,
        lintel,
        back + 0.068,
        C.wood,
      );
    }
    for (const y of [low + 0.11, low + (lintel - low) * 0.59, lintel - 0.08])
      panel(out, 'brick', wall, x - aperture, x + aperture, y, y + 0.1, back + 0.093, C.wood);
  }
  tiledBand(
    out,
    wall,
    left + 0.06,
    right - 0.06,
    top - (principal ? 0.92 : 0.42),
    principal ? 0.67 : 0.23,
    0.04,
    lod,
  );
}

function barrelFront(out, lod, d, grade) {
  const { northFront, centralIwan } = d;
  const mainZ = northFront - 0.31;
  const top = centralIwan.height;
  const left = -3.58;
  const right = 3.58;
  archedBay(out, lod, {
    x: 0,
    z: mainZ,
    left,
    right,
    low: 0.39,
    spring: 4.48,
    peak: 7.34,
    top,
    radius: centralIwan.width / 2,
    depth: centralIwan.depth,
    principal: true,
  });
  for (const x of [left + 0.11, right - 0.25])
    block(out, 'glaze', x, 0.39, mainZ - 0.09, 0.16, top - 0.46, 0.19, C.blue);
  for (const x of [left, right - 0.19])
    block(out, 'brick', x, 0.24, mainZ, 0.19, top - 0.24, centralIwan.depth + 0.25, C.brick);
  block(
    out,
    'roof',
    left - 0.09,
    top - 0.17,
    mainZ - 0.11,
    right - left + 0.18,
    0.17,
    centralIwan.depth + 0.43,
    C.roof,
  );
  stairs(
    out,
    grade,
    'stone',
    -2.62,
    2.62,
    mainZ - 1.22,
    mainZ - 0.04,
    0.4,
    lod > 1 ? 3 : 2,
    C.stone,
  );

  for (const sign of [-1, 1])
    for (const [center, edge0, edge1, radius, peak] of [
      [4.92, 3.58, 6.22, 0.91, 4.25],
      [7.52, 6.22, 10.22, 0.89, 4.03],
    ]) {
      const x = sign * center;
      const bounds = sign > 0 ? [edge0, edge1] : [-edge1, -edge0];
      archedBay(out, lod, {
        x,
        z: northFront + 0.015,
        left: bounds[0],
        right: bounds[1],
        low: 0.4,
        spring: 2.62,
        peak,
        top: 5.64,
        radius,
        depth: 1.29,
        principal: false,
      });
    }
  const wall = plane(northFront, -1);
  for (const [l, r] of [
    [-10.22, left],
    [right, 10.22],
  ])
    panel(out, 'brick', wall, l, r, 5.59, 5.76, 0.055, C.relief);
}

function littleVault(out, lod, x, z, rx, rz, base, rise) {
  const segments = [5, 8, 12, 16][lod];
  const arch = archProfile(rx, base, base + rise, segments);
  for (const [[a, y], [b, h]] of pairs(arch)) {
    const side = Math.sign(a + b);
    face(
      out,
      'roof',
      [
        [x + a, y, z - rz],
        [x + b, h, z - rz],
        [x + b, h, z + rz],
        [x + a, y, z + rz],
      ],
      [side, 1, 0],
      C.roof,
    );
    for (const direction of [-1, 1]) {
      const end = z + direction * rz;
      const tau = base - 0.13;
      face(
        out,
        'brick',
        [
          [x + a, y, end],
          [x + b, h, end],
          [x + b, tau, end],
          [x + a, tau, end],
        ],
        [0, 0, direction],
        C.relief,
      );
    }
  }
}

function mainDome(out, lod, d) {
  const center = [0.18, -1.38];
  const [x, z] = center;
  shell(out, rect(x - 4.3, z - 4.46, x + 4.3, z + 4.46), () => 5.51, 8.45, {
    wall: 'brick',
    color: C.brick,
    roof: 'roof',
    roofColor: C.roof,
  });
  ring(
    out,
    'brick',
    center,
    [
      [8.26, 4.49],
      [8.59, 4.69],
      [9.08, 4.64],
      [11.27, 4.55],
    ],
    8,
    C.brick,
  );
  const n = [12, 16, 24, 36][lod];
  ring(
    out,
    'glaze',
    center,
    [
      [10.92, 4.48],
      [11.06, 4.71],
      [11.34, 4.71],
      [11.5, 4.58],
    ],
    16,
    C.indigo,
  );
  ring(
    out,
    'glaze',
    center,
    [
      [11.46, 4.57],
      [12.09, 4.72],
      [12.8, 4.72],
      [13.64, 4.55],
      [14.51, 4.04],
      [15.54, 3.26],
      [16.46, 2.14],
      [d.outerDomeHeight, 0.03],
    ],
    n,
    C.teal,
  );
  if (lod < 1) return;
  ring(
    out,
    'glaze',
    center,
    [
      [11.61, 4.64],
      [11.72, 4.67],
      [11.86, 4.705],
      [11.93, 4.716],
    ],
    n,
    C.muted,
  );
  const drum = Array.from({ length: 8 }, (_, i) => {
    const a = (i * TAU) / 8;
    return [x + Math.cos(a) * 4.57, z + Math.sin(a) * 4.57];
  });
  for (let i = 0; i < drum.length; i++) {
    const [a, b] = [drum[i], drum[(i + 1) % drum.length]];
    const normal = [(a[0] + b[0]) * 0.5 - x, 0, (a[1] + b[1]) * 0.5 - z];
    const w = {
      normal,
      p: (u, y, distance = 0) => [
        mix(a[0], b[0], u) + distance * normal[0],
        y,
        mix(a[1], b[1], u) + distance * normal[2],
      ],
    };
    const arch = archProfile(0.14, 10.11, 10.62, lod > 1 ? 10 : 6);
    panel(out, 'shadow', w, 0.356, 0.644, 9.01, 10.13, 0.052, C.dark);
    face(
      out,
      'shadow',
      arch.map(([u, y]) => w.p(u + 0.5, y, 0.053)),
      normal,
      C.dark,
    );
    for (const u of [0.22, 0.78]) diamond(out, w, u, 10.45, 0.092, 0.34, 0.045, C.blue);
    if (lod > 1)
      for (const y of [9.23, 9.5, 9.77, 10.04]) {
        panel(out, 'glaze', w, 0.361, 0.639, y, y + 0.045, 0.065, C.muted);
        for (const u of [0.22, 0.78]) diamond(out, w, u, y, 0.059, 0.103, 0.047, C.muted);
      }
  }
}

function minaret(out, lod, x, z, top, grade) {
  const ground = grade([x, z]) - 0.24;
  const center = [x, z];
  const n = [8, 12, 18, 26][lod];
  const belt = top - 3.38;
  ring(
    out,
    'brick',
    center,
    [
      [ground, 1.39],
      [1.52, 1.39],
      [2.02, 1.26],
      [belt - 0.84, 0.99],
    ],
    n,
    C.brick,
  );
  ring(
    out,
    'stone',
    center,
    [
      [ground, 1.43],
      [0.52, 1.43],
      [0.72, 1.38],
    ],
    n,
    C.stone,
  );
  ring(
    out,
    'glaze',
    center,
    [
      [belt - 0.84, 0.995],
      [belt - 0.52, 1.06],
    ],
    n,
    C.indigo,
  );
  ring(
    out,
    'brick',
    center,
    [
      [belt - 0.52, 1.06],
      [belt - 0.14, 1.34],
      [belt + 0.08, 1.37],
      [belt + 0.12, 0.75],
    ],
    n,
    C.relief,
  );
  const crest = Array.from({ length: n }, (_, i) => {
    const angle = (i * TAU) / n;
    const y = top - (i === 2 ? 0 : 0.035 * (1 + ((i * 5) % 7)) + (i % 4) * 0.074);
    return [x + 0.68 * Math.cos(angle), y, z + 0.68 * Math.sin(angle)];
  });
  for (let i = 0; i < n; i++) {
    const a = crest[i];
    const b = crest[(i + 1) % n];
    const floor = ([px, , pz]) => [x + (px - x) * 1.1, belt + 0.09, z + (pz - z) * 1.1];
    const axial = [(a[0] + b[0]) * 0.5 - x, 0, (a[2] + b[2]) * 0.5 - z];
    face(out, 'brick', [floor(a), floor(b), b, a], axial, C.relief);
    face(out, 'roof', [a, b, [x, top - 0.41, z]], [0, 1, 0], C.dark);
  }
  if (lod < 1) return;
  const rows = lod === 3 ? 12 : lod === 2 ? 8 : 5;
  const around = lod === 3 ? 12 : lod === 2 ? 9 : 6;
  for (let j = 0; j < rows; j++) {
    const y = mix(2.23, belt - 1.1, j / rows);
    const r = mix(1.25, 0.99, (y - 2.02) / (belt - 2.86)) + 0.026;
    for (let i = 0; i < around; i++) {
      const a = ((i + (j % 2) / 2) * TAU) / around;
      const n = [Math.cos(a), 0, Math.sin(a)];
      const w = {
        normal: n,
        p: (u, y, depth = 0) => [
          x + (r + depth) * n[0] + u * n[2],
          y,
          z + (r + depth) * n[2] - u * n[0],
        ],
      };
      diamond(out, w, 0, y, 0.13, 0.245, 0.02, j % 3 ? C.muted : C.indigo);
      if (lod > 2) diamond(out, w, 0, y, 0.058, 0.105, 0.026, C.bone);
    }
  }
}

function build(out, lod, d, grade) {
  const front = d.northFront;
  const recess = [
    [-3.58, front],
    [-3.58, front + 4.12],
    [3.58, front + 4.12],
    [3.58, front],
  ];
  const roofOutline = [...d.outline.slice(0, 2), ...recess, ...d.outline.slice(2)];
  shell(
    out,
    roofOutline,
    (p) => grade(p) - 0.36,
    5.75,
    { wall: 'brick', color: C.brick, roof: 'roof', roofColor: C.roof },
    (i) => i === 0 || i >= 6,
  );
  barrelFront(out, lod, d, grade);
  mainDome(out, lod, d);
  littleVault(out, lod, 5.42, 11.72, 2.32, 4.68, 5.69, 1.45);
  littleVault(out, lod, -3.45, 5.82, 2.43, 3.05, 5.69, 1.22);
  minaret(out, lod, -9.27, -11.19, d.minaretHeights[0], grade);
  minaret(out, lod, 9.26, -11.34, d.minaretHeights[1], grade);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Standing 15th-century tomb and mosque in Mashhad, with an open pointed north iwan, two pairs of recessed arches, strongly projecting minarets, and a turquoise bulbous double-shell dome.',
    camera: [-29, 18, -40],
    lookAt: [0, 9, -4.5],
    sun: [-270, 425, -555],
    yaw: -0.52,
    views: [
      { name: 'north-iwan-and-twin-minarets', position: [-9.8, 9.9, -35], lookAt: [0, 10, -8.7] },
      {
        name: 'tile-bands-and-pointed-vault',
        position: [5.8, 5.5, -24],
        lookAt: [0.2, 4.85, -11.9],
      },
      { name: 'dome-drum-and-rear-vaults', position: [29, 25, 20], lookAt: [0.3, 8.4, 1.3] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'religious';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis:
    'Replace the original mapped mosque mass within the named outline. The separate neighboring hammam keeps its own representation.',
};
