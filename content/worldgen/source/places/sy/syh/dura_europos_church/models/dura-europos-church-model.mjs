import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  adobe: surface('wall', 'earth_adobe', 0.96),
  plaster: surface('trim', 'plaster_lime', 0.94),
  base: surface('foundation', 'stone_ashlar', 0.94),
  earth: surface('roof', 'earth_rammed', 0.97),
  timber: surface('door', 'wood_plain', 0.94),
};
const C = palette({
  adobe: 'b19776',
  clay: 'a68a6a',
  edge: 'bdab8e',
  earth: 'a08d73',
  sand: 'beb29c',
  gypsum: 'b5a78e',
  plaster: 'd0c1a7',
  light: 'd9c8af',
  wood: '81715e',
  trim: '665649',
  rose: '986b58',
  paleRose: 'b38973',
  blue: '536170',
  stars: 'c9bbc0',
  niche: 'a29b84',
});
const floor = 1.39;
const roofLevel = floor + 5.31;
const court = { l: -3.32, r: 4.14, n: -5.05, s: 2.72 };
const baptism = { l: -8.92, r: -2.96, n: -8.61, s: -5.05 };
const invert = (v) => v.map((n) => -n);
const down = [0, -1, 0];

function prism(out, slot, shape, low, high, tone) {
  shell(out, shape, () => low, high, { wall: slot, roof: slot, color: tone, roofColor: tone });
}

function masonry(out, lod, a, b, low, high, depth, apertures, outside = 1, inside = 'plaster') {
  const w = edge(a, b, outside);
  if (w.length < 0.11) return;
  const outer = (x, y) => w.p(x, y);
  const inner = (x, y) => w.p(x, y, -depth);
  const panelPair = (l, r, f, t) => {
    if (r - l < 0.006 || t - f < 0.006) return;
    panel(out, 'adobe', w, l, r, f, t, 0, C.adobe);
    face(
      out,
      inside,
      [inner(l, f), inner(r, f), inner(r, t), inner(l, t)],
      invert(w.normal),
      C.plaster,
    );
  };
  let left = 0;
  for (const { l, r, sill, head, shutter = false } of apertures) {
    panelPair(left, l, low, high);
    panelPair(l, r, low, sill);
    panelPair(l, r, head, high);
    const forward = [w.normal[2], 0, -w.normal[0]];
    face(
      out,
      'plaster',
      [outer(l, sill), inner(l, sill), inner(l, head), outer(l, head)],
      invert(forward),
      C.edge,
    );
    face(
      out,
      'plaster',
      [outer(r, sill), inner(r, sill), inner(r, head), outer(r, head)],
      forward,
      C.edge,
    );
    face(
      out,
      'timber',
      [outer(l, head), outer(r, head), inner(r, head), inner(l, head)],
      down,
      C.wood,
    );
    if (sill - low > 0.1) {
      face(
        out,
        'base',
        [outer(l, sill), inner(l, sill), inner(r, sill), outer(r, sill)],
        up,
        C.gypsum,
      );
      if (lod > 1 && shutter) {
        const mid = (l + r) * 0.5;
        for (const [x, q] of [
          [l + 0.024, mid - 0.019],
          [mid + 0.02, r - 0.025],
        ])
          panel(out, 'timber', w, x, q, sill + 0.024, head - 0.024, -depth + 0.09, C.wood);
      }
    }
    if (lod > 1) {
      panel(out, 'timber', w, l - 0.09, r + 0.09, head, head + 0.14, 0.036, C.wood);
      if (sill - low < 0.1) {
        for (const p of [l - 0.037, r + 0.037])
          panel(out, 'plaster', w, p - 0.04, p + 0.04, sill, head, 0.042, C.gypsum);
      }
    }
    left = r;
  }
  panelPair(left, w.length, low, high);
  face(
    out,
    'plaster',
    [outer(0, high), outer(w.length, high), inner(w.length, high), inner(0, high)],
    up,
    C.gypsum,
  );
}

function door(x, width, head = 2.28) {
  return { l: x - width / 2, r: x + width / 2, sill: floor, head: floor + head };
}

function window(x, width, y, h, shutter = false) {
  return { l: x - width / 2, r: x + width / 2, sill: floor + y, head: floor + y + h, shutter };
}

function perimeter(out, lod, outline, grade) {
  const dir = areaSign(outline);
  shell(out, outline, (p) => Math.min(1.15, grade(p) - 0.29), floor + 0.005, {
    wall: 'base',
    roof: 'base',
    color: C.gypsum,
    roofColor: C.sand,
  });
  const openings = new Map([
    [0, [window(13.38, 0.65, 2.35, 0.86), window(15.24, 0.64, 2.35, 0.87)]],
    [3, [window(0.92, 0.46, 3.51, 0.55)]],
    [5, [window(2.27, 0.48, 3.25, 0.54)]],
    [13, [door(2.74, 1.29, 2.35)]],
  ]);
  for (const [[a, b], i] of pairs(closed(outline)).map((pair, i) => [pair, i])) {
    const w = edge(a, b, dir);
    const openingsHere = openings.get(i) ?? [];
    masonry(out, lod, a, b, floor, roofLevel + 0.35, 0.54, openingsHere, dir);
    if (lod < 2) continue;
    panel(out, 'plaster', w, 0, w.length, roofLevel + 0.18, roofLevel + 0.32, 0.021, C.edge);
    if (lod === 3 && w.length > 2.6 && i !== 13) {
      const ends = Math.round(w.length / 0.76);
      for (let j = 1; j < ends; j++) {
        const u = (j * w.length) / ends;
        panel(
          out,
          'timber',
          w,
          u - 0.057,
          u + 0.057,
          roofLevel - 0.37,
          roofLevel - 0.272,
          0.027,
          C.wood,
        );
      }
    }
  }
}

function roof(out, lod, d) {
  const [nw, sw, , se, , , east, , guard, ne, eave1, eave2, rise, mid, northWest] = d.outline;
  const section = [
    {
      points: [nw, northWest, mid, [court.r, court.n], [court.l, court.n], [-8.92, court.n]],
      h: roofLevel,
    },
    {
      points: [
        mid,
        rise,
        eave2,
        eave1,
        ne,
        guard,
        east,
        [9.04, court.s],
        [court.r, court.s],
        [court.r, court.n],
      ],
      h: roofLevel - 0.22,
    },
    {
      points: [
        [-9.452, court.s],
        [9.1, court.s],
        [d.outline[4][0], d.outline[4][1]],
        se,
        d.outline[2],
        sw,
      ],
      h: roofLevel + 0.02,
    },
    {
      points: [
        [-9.393, court.n],
        [court.l, court.n],
        [court.l, court.s],
        [-9.452, court.s],
      ],
      h: roofLevel - 0.05,
    },
  ];
  for (const { points, h } of section) {
    prism(out, 'earth', points, h - d.roofThicknessMeters, h, C.earth);
    const underside = h - d.roofThicknessMeters - 0.015;
    const indices = earcut(points.flat());
    for (let i = 0; i < indices.length; i += 3)
      face(
        out,
        'plaster',
        indices.slice(i, i + 3).map((k) => at(points[k], underside)),
        down,
        C.gypsum,
      );
  }
  const ledges = [
    [
      [court.l, court.n],
      [court.r, court.n],
    ],
    [
      [court.r, court.n],
      [court.r, court.s],
    ],
    [
      [court.r, court.s],
      [court.l, court.s],
    ],
    [
      [court.l, court.s],
      [court.l, court.n],
    ],
  ];
  for (const [a, b] of ledges) {
    const w = edge(a, b);
    const level = roofLevel - 0.22;
    panel(out, 'plaster', w, 0, w.length, level - 0.24, level + 0.38, -0.018, C.edge);
    if (lod > 1)
      beamPath(
        out,
        'earth',
        [w.p(0, level + 0.34), w.p(w.length, level + 0.34)],
        0.19,
        0.14,
        C.clay,
      );
  }
}

function courtAndRooms(out, lod) {
  const { l, r, n, s } = court;
  const high = roofLevel - 0.08;
  masonry(
    out,
    lod,
    [l, n],
    [r, n],
    floor,
    high,
    0.53,
    [door(0.78, 0.87, 2.02), door(5.64, 1.23, 2.27)],
    -1,
  );
  masonry(
    out,
    lod,
    [r, n],
    [r, s],
    floor,
    high,
    0.52,
    [door(1.37, 1.13, 2.24), door(5.33, 0.95, 2.18)],
    -1,
  );
  masonry(
    out,
    lod,
    [l, s],
    [r, s],
    floor,
    high + 0.1,
    0.51,
    [window(1.11, 0.59, 0.95, 1.02, true), door(2.42, 1.23, 2.3)],
    1,
  );
  masonry(
    out,
    lod,
    [l, n],
    [l, s],
    floor,
    high + 0.04,
    0.5,
    [window(3.1, 0.55, 0.91, 0.9, true), door(4.71, 1.03, 2.21)],
    1,
  );
  masonry(
    out,
    lod,
    [baptism.l, baptism.s],
    [l, baptism.s],
    floor,
    high,
    0.45,
    [door(3.24, 1.18, 2.16)],
    1,
  );
  masonry(out, lod, [baptism.r, baptism.n], [baptism.r, baptism.s], floor, high, 0.43, [], 1);
  masonry(out, lod, [-9.4, s], [l, s], floor, high, 0.49, [door(4.31, 1.03, 2.11)], 1);
  masonry(out, lod, [r, s], [9.08, s], floor, high, 0.53, [door(2.16, 0.99, 2.21)], 1);
  masonry(out, lod, [r, -0.9], [9.12, -0.9], floor, high, 0.48, [], 1);
  masonry(out, lod, [0.67, -9.78], [0.67, n], floor, high, 0.46, [], 1);
  for (const [x, z, w, d] of [
    [l + 0.09, n + 0.15, 1.98, 0.52],
    [l + 0.12, s - 0.64, 1.38, 0.47],
    [r - 0.69, n + 0.21, 0.48, 1.37],
  ]) {
    block(out, 'base', x, floor, z, w, 0.44, d, C.gypsum);
    if (lod > 1)
      block(out, 'plaster', x - 0.049, floor + 0.43, z - 0.034, w + 0.098, 0.09, d + 0.07, C.light);
  }
  prism(
    out,
    'base',
    rect(l + 0.035, n + 0.033, r - 0.037, s - 0.037),
    floor + 0.016,
    floor + 0.047,
    C.gypsum,
  );
  if (lod > 1) {
    for (let j = 0; j < 9; j++) {
      const z = mix(n + 0.18, s - 0.18, j / 8);
      const count = j % 2 ? 7 : 6;
      for (let i = 0; i < count; i++) {
        const x = l + 0.18 + (i + (j % 2) * 0.38) * 1.02;
        const width = Math.min(0.95, r - x - 0.06);
        face(
          out,
          'base',
          [
            [x, floor + 0.053, z],
            [x + width, floor + 0.053, z],
            [x + width, floor + 0.053, z + 0.67],
            [x, floor + 0.053, z + 0.67],
          ],
          up,
          (i + j) % 3 ? C.gypsum : C.edge,
        );
      }
    }
  }
  const nSteps = lod === 0 ? 4 : 11;
  for (let i = 0; i < nSteps; i++) {
    const z = n - 0.42 - (3.75 * (i + 1)) / nSteps;
    const height = mix(0.16, 4.89, (i + 1) / nSteps);
    block(out, 'base', 0.92, floor, z, 1.05, height, 3.75 / nSteps + 0.011, C.gypsum);
  }
  block(out, 'base', 7.56, floor, 6.58, 0.97, 0.2, 1.47, C.light);
}

function font(out, lod, d) {
  const { l, r, n, s } = baptism;
  const z = (n + s) * 0.5;
  const x = l + 1.12;
  const base = floor + 0.06;
  const lip = base + 0.55;
  prism(out, 'base', rect(l - 0.08, z - 0.97, x + 0.5, z + 0.97), base - 0.14, base, C.gypsum);
  for (const [a, b, w, q] of [
    [l - 0.08, z - 0.95, 1.72, 0.24],
    [l - 0.08, z + 0.71, 1.72, 0.24],
    [x + 0.28, z - 0.71, 0.23, 1.42],
    [l - 0.08, z - 0.71, 0.26, 1.42],
  ])
    block(out, 'plaster', a, base, b, w, lip - base, q, C.light);
  prism(
    out,
    'base',
    rect(l + 0.16, z - 0.59, x + 0.27, z + 0.59),
    base - 0.08,
    base + 0.03,
    C.niche,
  );
  block(out, 'plaster', x + 0.49, base - 0.06, z - 0.48, 0.4, 0.2, 0.96, C.edge);
  for (const k of [-1, 1]) {
    const u = z + k * 0.93;
    ring(
      out,
      'plaster',
      [x + 0.21, u],
      [
        [lip, 0.21],
        [lip + 0.17, 0.19],
        [lip + 1.39, 0.18],
        [lip + 1.53, 0.24],
      ],
      lod > 1 ? 9 : 5,
      C.gypsum,
    );
    if (lod === 3) {
      const z0 = u - 0.09;
      for (let i = 0; i < 4; i++) {
        const y = lip + 0.18 + i * 0.24;
        face(
          out,
          'plaster',
          [
            [x + 0.4, y, z0],
            [x + 0.42, y + 0.2, u],
            [x + 0.4, y, u + 0.09],
            [x + 0.43, y + 0.04, u],
          ],
          [1, 0, 0],
          C.rose,
        );
      }
    }
  }
  const spring = lip + 1.51;
  const steps = [5, 8, 12, 18][lod];
  const arch = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i * Math.PI) / steps;
    return [spring + 0.86 * Math.sin(t), z + 0.93 * Math.cos(t)];
  });
  for (const [[f, a], [g, b]] of pairs(arch)) {
    face(
      out,
      'plaster',
      [
        [x + 0.25, f, a],
        [x + 0.25, g, b],
        [l + 0.08, g, b],
        [l + 0.08, f, a],
      ],
      down,
      C.blue,
    );
  }
  beamPath(
    out,
    'plaster',
    arch.map(([y, u]) => [x + 0.27, y, u]),
    0.17,
    0.16,
    C.paleRose,
  );
  const behind = l + 0.063;
  face(
    out,
    'plaster',
    [
      [behind, lip + 0.45, z + 0.918],
      ...arch.map(([y, u]) => [behind, y, u]),
      [behind, lip + 0.45, z - 0.918],
    ],
    [1, 0, 0],
    C.niche,
  );
  if (lod > 1) {
    const stroke = [
      [z - 0.74, 0.55],
      [z - 0.43, 0.64],
      [z - 0.06, 0.58],
      [z + 0.47, 0.68],
      [z + 0.78, 0.56],
    ];
    beamPath(
      out,
      'plaster',
      stroke.map(([u, y]) => [behind + 0.012, lip + y, u]),
      0.085,
      0.022,
      C.paleRose,
    );
    const roofY = floor + d.baptisteryCeilingMeters;
    const ceiling = rect(l - 0.07, n, r - 0.03, s - 0.04);
    prism(out, 'earth', ceiling, roofY, roofY + 0.27, C.earth);
    face(
      out,
      'plaster',
      ceiling.map((p) => at(p, roofY - 0.004)),
      down,
      C.blue,
    );
    const wall = edge([l + 0.09, n + 0.016], [r - 0.05, n + 0.016], -1);
    for (const y of [base + 0.15, base + 1.31, base + 2.42])
      panel(out, 'plaster', wall, 0, wall.length, y, y + 0.083, 0.038, C.rose);
    if (lod === 3) {
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 8; i++) {
          const a = l + 0.27 + 0.71 * i;
          const b = n + 0.31 + 0.73 * j;
          const y = roofY - 0.012;
          face(
            out,
            'plaster',
            [
              [a, y, b],
              [a + 0.026, y, b + 0.018],
              [a, y, b + 0.036],
              [a - 0.026, y, b + 0.018],
            ],
            down,
            C.stars,
          );
        }
    }
  }
}

function build(out, lod, d, grade) {
  perimeter(out, lod, d.outline, grade);
  roof(out, lod, d);
  if (lod > 0) {
    courtAndRooms(out, lod);
    font(out, lod, d);
  }
}

const place = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'A reconstruction around 250 CE of the converted mudbrick house at Dura-Europos. Surveyed trapezoidal perimeter, open court, earthen roofs, south assembly hall and the painted baptismal niche.',
    camera: [23, 19, -30],
    lookAt: [0, 2.3, 0],
    yaw: -0.47,
    sun: [350, 690, -485],
    views: [
      { name: 'surveyed-exterior-and-vestibule', position: [16, 8.6, -25], lookAt: [0, 3.4, -2] },
      {
        name: 'open-paved-courtyard-and-roof',
        position: [-0.4, 14, 4.3],
        lookAt: [0.1, 2.1, -1.8],
      },
      {
        name: 'west-baptistery-and-font',
        position: [-3.84, 3.02, -6.71],
        lookAt: [-8.2, 2.68, -6.88],
      },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = place;
model.category = 'church';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Use the excavated M8-A church outline alone for the historical reconstruction.',
};
