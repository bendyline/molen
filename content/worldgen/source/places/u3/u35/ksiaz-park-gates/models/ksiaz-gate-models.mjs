/** Source-specific park gates; ornamental forms are medium-fi interpretations, not sculpture scans. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const ksiazGateModels = [
  {
    id: 'KSI_G01',
    key: 'ksiaz_jezdziecka_park_gate',
    title: 'Książ Jeździecka park gate',
    node: 2858843981,
    component: 'park-gates',
    brief:
      'Chamfered sandstone pillars and urns supporting a curved iron opening, crowned scroll crest, open leaves and tall wing railings.',
    references: ['https://www.flickr.com/photos/124589265@N07/13998711268/'],
  },
  {
    id: 'KSI_G02',
    key: 'ksiaz_hochberg_alley_gate',
    title: 'Książ Hochberg avenue park gate',
    node: 2858843969,
    component: 'park-gates',
    brief:
      'Chamfered sandstone pillars and urns, curved iron opening and low curved wing walls ending in simplified sphinx-like sculptures.',
    references: [
      'https://www.flickr.com/photos/124589265@N07/14182699172/',
      'https://www.ksiaz.walbrzych.pl/turystyka/aktualnosci/renowacja-drugiej-bramy-w-parku',
    ],
  },
  {
    id: 'KSI_G03',
    key: 'ksiaz_lion_gate',
    title: 'Książ Lion Gate at Świebodzice',
    node: 2618881852,
    component: 'park-gates',
    fitAppearance:
      'The restored exterior follows photographs from both approaches. The iron leaves are shown open.',
    brief:
      'Pale sandstone piers with shield-bearing lions, curved terracotta wall panels, urn-topped outer posts and open wrought-iron leaves.',
    primaryDescription:
      'Independent Brama Lwów heritage gate node and adjoining path. Irena Goderska’s park-side photograph and the linked restored views establish the profile, materials and signed approach.',
    ornamentNote:
      'Seated lions, manes, paws, shields and tails are original simplified medium-fi forms without facial likeness, carved heraldry or sculptural microdetail.',
    references: [
      'https://commons.wikimedia.org/wiki/File:PL,_%C5%9Awiebodzice_brama_do_parku_Ksi%C4%85%C5%BC_DSC_0008-001.JPG',
      'https://www.labiryntarium.pl/7gmin/gminaswiebodzice/698-spacerkiemdoksiaza.html',
    ],
    sourceDocuments: ['reference-metadata.json'],
    cameras: [
      { name: 'lion-piers-and-clear-opening', position: [0, 8, -29], lookAt: [0, 3.8, 0] },
      { name: 'park-side-and-open-leaves', position: [-13, 10, 23], lookAt: [0, 3.8, 0] },
      { name: 'rising-wing-wall-plan', position: [0, 30, 5], lookAt: [0, 2.8, 0] },
      { name: 'lion-shield-and-cornice', position: [7, 8, -10], lookAt: [3.2, 5.4, 0] },
    ],
  },
].map((m) => ({
  ...m,
  cameras: m.cameras ?? [
    { name: 'approach-and-clear-opening', position: [0, 7, 27], lookAt: [0, 3, 0] },
    { name: 'reverse-and-open-leaves', position: [-13, 10, -21], lookAt: [0, 3, 0] },
    { name: 'wing-wall-plan', position: [0, 28, 4], lookAt: [0, 2, 0] },
    { name: 'pillar-urn-and-ironwork', position: [8, 7, 11], lookAt: [2.6, 3.4, 0] },
  ],
}));
export const ksiazGateSurfaces = {
  carvedStone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.92, metallic: 0 },
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.65 },
};
export const ksiazGatePalette = { stone: '#e5d8bd', trim: '#ece1ca', metal: '#72828a' };
export const ksiazLionGatePalette = {
  ...ksiazGatePalette,
  wallPanel: '#bf7850',
  plinth: '#aaa79f',
};
const colors = Object.fromEntries(
  Object.entries(ksiazLionGatePalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const frames = new Map(
  ksiazGateModels.map((m) => [
    m.key,
    JSON.parse(readFileSync(new URL(`../../${m.key}/map-frame.json`, import.meta.url))),
  ]),
);
const means = JSON.parse(
  readFileSync(new URL('../../ksiaz_hochberg_mausoleum/surface-means.json', import.meta.url)),
);
const lionMeans = JSON.parse(
  readFileSync(new URL('../../ksiaz_lion_gate/surface-means.json', import.meta.url)),
);
function face(o, p, color = 'stone', surface = 'sandstone', target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let triangle = [p[0], p[i], p[i + 1]],
      n = normalFor(...triangle);
    const a = triangle[1].map((v, k) => v - triangle[0][k]),
      b = triangle[2].map((v, k) => v - triangle[0][k]),
      area = Math.hypot(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      );
    if (area < 1e-10) continue;
    if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) {
      triangle = [...triangle].reverse();
      n = normalFor(...triangle);
    }
    o.addTriangle(
      surface,
      'palette:#ffffff',
      triangle,
      n,
      triangle.map((v) => [v[0], v[1]]),
      colors[color],
    );
  }
}
function box(o, x, y, z, w, h, depth, color = 'stone', surface = 'sandstone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, color, surface, n);
}
function tube(o, a, b, r, color = 'metal', surface = 'metal') {
  const delta = b.map((v, i) => v - a[i]),
    length = Math.hypot(...delta);
  if (length < 1e-5) return;
  const axis = delta.map((v) => v / length),
    seed = Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    u0 = cross(axis, seed),
    u = u0.map((v) => v / Math.hypot(...u0)),
    v = cross(axis, u),
    rings = [a, b].map((p) =>
      Array.from({ length: 4 }, (_, i) =>
        p.map(
          (x, k) =>
            x + r * (u[k] * Math.cos((i * Math.PI) / 2) + v[k] * Math.sin((i * Math.PI) / 2)),
        ),
      ),
    );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], color, surface);
  }
  // End caps make freestanding metalwork and carved limbs complete solid pieces.
  face(
    o,
    rings[0],
    color,
    surface,
    axis.map((v) => -v),
  );
  face(o, rings[1], color, surface, axis);
}
function path(o, points, r, color = 'metal', surface = 'metal') {
  for (let i = 1; i < points.length; i++) tube(o, points[i - 1], points[i], r, color, surface);
}
function lathe(o, x, z, levels, n = 8, color = 'trim', footprint) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const [u, v] = footprint?.[i] ?? [
        Math.cos((i * 2 * Math.PI) / n),
        Math.sin((i * 2 * Math.PI) / n),
      ];
      return [x + r * u, y, z + r * v];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = rings[j - 1][i],
        b = rings[j - 1][k];
      const target =
        levels[j - 1][0] === levels[j][0]
          ? [0, Math.sign(levels[j - 1][1] - levels[j][1]), 0]
          : [(a[0] + b[0]) / 2 - x, 0, (a[2] + b[2]) / 2 - z];
      face(o, [a, b, rings[j][k], rings[j][i]], color, 'sandstone', target);
    }
  face(o, rings.at(-1), color, 'sandstone', [0, 1, 0]);
}
function ellipsoid(o, c, size, d = 2) {
  const n = d >= 2 ? 8 : 6,
    count = d === 0 ? 2 : 4,
    rings = Array.from({ length: count + 1 }, (_, j) => {
      const phi = -Math.PI / 2 + (j * Math.PI) / count;
      return Array.from({ length: n }, (_, i) => [
        c[0] + size[0] * Math.cos(phi) * Math.cos((i * 2 * Math.PI) / n),
        c[1] + size[1] * Math.sin(phi),
        c[2] + size[2] * Math.cos(phi) * Math.sin((i * 2 * Math.PI) / n),
      ]);
    });
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        o,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        'trim',
        'sandstone',
        rings[j][i].map((v, k) => v - c[k]),
      );
    }
}
function scroll(o, x, y, z, r, d, color = 'metal', surface = 'metal') {
  const count = d >= 3 ? 12 : 8,
    points = Array.from({ length: count + 1 }, (_, i) => {
      const a = (i / count) * Math.PI * 2.1,
        rr = r * (1 - (i / count) * 0.72);
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr, z];
    });
  path(o, points, surface === 'metal' ? 0.045 : 0.09, color, surface);
}
function statue(o, x, y, z, d) {
  // Reclining lion body, upright human torso, head and draped forearms: identity silhouette only.
  ellipsoid(o, [x, y + 0.32, z], [0.95, 0.32, 0.42], d);
  ellipsoid(o, [x - 0.42, y + 0.78, z], [0.28, 0.58, 0.25], d);
  ellipsoid(o, [x - 0.48, y + 1.45, z], [0.24, 0.29, 0.25], d);
  for (const zz of [-0.25, 0.25]) {
    tube(o, [x - 0.52, y + 0.96, z + zz], [x - 0.1, y + 0.62, z + zz], 0.12, 'trim', 'sandstone');
    tube(o, [x - 0.1, y + 0.62, z + zz], [x + 0.32, y + 0.63, z + zz], 0.1, 'trim', 'sandstone');
  }
  if (d >= 2) {
    scroll(o, x + 0.65, y + 0.27, z + 0.43, 0.3, d, 'trim', 'sandstone');
    ellipsoid(o, [x - 0.48, y + 1.73, z], [0.22, 0.16, 0.23], d);
  }
}
function archY(x, half) {
  const t = Math.min(1, Math.abs(x) / half);
  return 3.0 + 1.0 * Math.pow(Math.max(0, 1 - t * t), 2);
}
function ironOpening(o, half, d, crest) {
  const count = d >= 2 ? 16 : 8,
    curve = (offset) =>
      Array.from({ length: count + 1 }, (_, i) => {
        const x = -half + (2 * half * i) / count;
        return [x, archY(x, half) + offset, 0];
      });
  for (const y of [0, 0.46]) path(o, curve(y), 0.075);
  if (d >= 1) {
    for (const x of [-half, half]) tube(o, [x, 0, 0], [x, 3.48, 0], 0.07);
    for (let i = 0; i < count; i++) {
      const x = -half + ((i + 0.5) * 2 * half) / count;
      tube(o, [x, archY(x, half) + 0.03, 0], [x, archY(x, half) + 0.43, 0], 0.04);
    }
  }
  if (d >= 2)
    for (const x of [-half * 0.7, -half * 0.3, half * 0.3, half * 0.7])
      scroll(o, x, archY(x, half) + 0.22, 0.02, 0.16, d);
  if (crest) {
    const top = Array.from({ length: count + 1 }, (_, i) => {
      const x = -half + (2 * half * i) / count;
      const t = 1 - Math.abs(x) / half;
      return [x, 3.48 + 1.99 * Math.pow(Math.sin((t * Math.PI) / 2), 0.78), 0];
    });
    path(o, top, 0.065);
    if (d >= 1) {
      path(
        o,
        [
          [-half, 3.48, 0],
          [-half * 0.8, 3.9, 0],
        ],
        0.07,
      );
      path(
        o,
        [
          [half, 3.48, 0],
          [half * 0.8, 3.9, 0],
        ],
        0.07,
      );
      for (const sign of [-1, 1])
        path(
          o,
          [
            [sign * half * 0.65, 4.215, 0],
            [0, 4.8, 0],
            [sign * half * 0.35, 4.845, 0],
          ],
          0.045,
        );
    }
    if (d >= 2) {
      for (const sign of [-1, 1]) {
        for (const [x, y, radius] of [
          [0.49, 4.85, 0.32],
          [1.06, 4.64, 0.31],
          [1.58, 4.32, 0.22],
        ])
          scroll(o, sign * x, y, 0.025, radius, d);
        path(
          o,
          [
            [0, 4.62, 0.03],
            [sign * 0.57, 5.16, 0.03],
            [sign * 1.06, 5.04, 0.03],
          ],
          0.044,
        );
      }
    }
    if (d >= 1)
      ellipsoid(
        {
          addTriangle: (_s, r, p, n, uv, _col) => o.addTriangle('metal', r, p, n, uv, colors.metal),
        },
        [0, 5.6, 0],
        [0.28, 0.17, 0.25],
        d,
      );
  }
  // Leaves are folded behind the pillars, preserving a clear navigable center.
  if (d >= 1)
    for (const sign of [-1, 1]) {
      const hinge = sign * half,
        zEnd = -half * 0.94,
        xEnd = sign * (half - half * 0.342),
        bars = d === 1 ? 4 : 9;
      for (const y of [0.18, 1.0, 2.7]) tube(o, [hinge, y, 0], [xEnd, y, zEnd], 0.055);
      for (let i = 0; i <= bars; i++) {
        const t = i / bars,
          x = hinge + (xEnd - hinge) * t,
          z = zEnd * t;
        tube(o, [x, 0.12, z], [x, 2.8, z], 0.04);
      }
    }
}

function localGate(o, center, angle = 0) {
  const rotate = ([x, y, z]) => [
    x * Math.cos(angle) + z * Math.sin(angle),
    y,
    -x * Math.sin(angle) + z * Math.cos(angle),
  ];
  return {
    addTriangle: (s, r, p, n, uv, col) =>
      o.addTriangle(
        s,
        r,
        p.map((v) => {
          const q = rotate(v);
          return q.map((x, i) => x + center[i]);
        }),
        rotate(n),
        uv,
        col,
      ),
  };
}
function squarePier(o, x, c, bottom) {
  box(
    o,
    x,
    bottom,
    0,
    c.pillarWidth + 0.12,
    0.36 - bottom,
    c.pillarDepth + 0.12,
    'plinth',
    'carvedStone',
  );
  const half = c.pillarWidth / 2,
    z = c.pillarDepth / 2,
    bevel = 0.14,
    loop = [
      [-half + bevel, -z],
      [half - bevel, -z],
      [half, -z + bevel],
      [half, z - bevel],
      [half - bevel, z],
      [-half + bevel, z],
      [-half, z - bevel],
      [-half, -z + bevel],
    ];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    face(
      o,
      [
        [x + a[0], 0.36, a[1]],
        [x + b[0], 0.36, b[1]],
        [x + b[0], c.pillarHeight - 0.5, b[1]],
        [x + a[0], c.pillarHeight - 0.5, a[1]],
      ],
      'stone',
      'sandstone',
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  const cornice = [
    [0.5, 0.2, 0.1, 0.1, 'trim'],
    [0.3, 0.22, 0.5, 0.48, 'stone'],
    [0.08, 0.08, 0.62, 0.6, 'trim'],
  ];
  for (const [offset, height, spreadX, spreadZ, color] of cornice) {
    const y = c.pillarHeight - offset;
    const w = half + spreadX / 2,
      depth = z + spreadZ / 2;
    box(o, x, y, 0, 2 * w, height, 2 * depth, color, 'carvedStone');
    face(
      o,
      [
        [x - w, y, -depth],
        [x + w, y, -depth],
        [x + w, y, depth],
        [x - w, y, depth],
      ],
      color,
      'carvedStone',
      [0, -1, 0],
    );
  }
  for (const sign of [-1, 1])
    box(o, x, 0.44, sign * (z + 0.01), 1.04, 3.45, 0.025, 'stone', 'carvedStone');
}
function shield(o, d) {
  const profile = [
    [-0.34, 0.35],
    [0, 0.12],
    [0.34, 0.35],
    [0.4, 1.08],
    [-0.4, 1.08],
  ];
  for (const z of [0.49, 0.66])
    face(
      o,
      profile.map(([x, y]) => [x, y, z]),
      'trim',
      'sandstone',
      [0, 0, z > 0.5 ? 1 : -1],
    );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(
      o,
      [
        [a[0], a[1], 0.49],
        [b[0], b[1], 0.49],
        [b[0], b[1], 0.66],
        [a[0], a[1], 0.66],
      ],
      'stone',
      'sandstone',
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
  if (d === 3) {
    const bead = [...profile, profile[0]].map(([x, y]) => [
      x * 0.82,
      0.66 + (y - 0.66) * 0.85,
      0.67,
    ]);
    path(o, bead, 0.025, 'trim', 'sandstone');
  }
}
function seatedLion(o, d) {
  box(o, 0, 0, 0.04, 0.87, 0.095, 1.08, 'trim');
  ellipsoid(o, [0, 0.51, -0.17], [0.48, 0.51, 0.41], d);
  ellipsoid(o, [0, 1.05, 0.02], [0.34, 0.54, 0.33], d);
  // Mane and projecting muzzle carry recognition even at skyline distance.
  ellipsoid(o, [0, 1.5, 0.04], [0.42, 0.41, 0.4], d);
  ellipsoid(o, [0, 1.55, 0.4], [0.23, 0.2, 0.23], d);
  shield(o, d);
  if (d >= 1) {
    for (const sign of [-1, 1]) {
      ellipsoid(o, [sign * 0.35, 0.26, -0.18], [0.24, 0.26, 0.3], d);
      tube(o, [sign * 0.24, 1.12, 0.18], [sign * 0.27, 0.84, 0.59], 0.13, 'trim', 'sandstone');
      ellipsoid(o, [sign * 0.28, 0.91, 0.63], [0.17, 0.12, 0.13], d);
      if (d >= 2) ellipsoid(o, [sign * 0.27, 1.81, -0.02], [0.12, 0.11, 0.1], d);
    }
    path(
      o,
      [
        [0.4, 0.47, -0.4],
        [0.53, 0.25, -0.44],
        [0.46, 0.13, -0.11],
        [0.48, 0.16, 0.2],
        [0.35, 0.23, 0.34],
      ],
      0.08,
      'trim',
      'sandstone',
    );
  }
  if (d >= 2) {
    // Broad lobes are faceted mane sculpture, not hair strands.
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ellipsoid(o, [0.33 * Math.cos(a), 1.49 + 0.3 * Math.sin(a), 0.21], [0.13, 0.16, 0.13], 1);
    }
  }
  if (d === 3) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = 1.21 + i * 0.17;
        path(
          o,
          [
            [side * 0.2, y + 0.25, -0.26],
            [side * 0.32, y + 0.13, -0.22],
            [side * 0.32, y - 0.03, -0.1],
          ],
          0.072,
          'trim',
          'sandstone',
        );
      }
      ellipsoid(o, [side * 0.13, 1.55, 0.585], [0.12, 0.11, 0.06], 1);
    }
  }
}
function lionWing(o, sign, px, c, grades, d) {
  const count = d >= 2 ? 8 : 4,
    points = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count;
      return [
        sign * (px + c.pillarWidth / 2 + c.sideWidth * t),
        -1.3 * Math.sin((t * Math.PI) / 2),
        c.sideHeight +
          (c.pillarHeight - 0.85 - c.sideHeight) * Math.pow(1 - t, 3) +
          t * grades[(i * 8) / count],
      ];
    });
  const normals = points.slice(1).map((b, i) => {
      const a = points[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz);
      return [dz / l, -dx / l];
    }),
    miters = points.map((_, i) => {
      const a = normals[Math.max(0, i - 1)],
        b = normals[Math.min(i, normals.length - 1)],
        sum = [a[0] + b[0], a[1] + b[1]],
        l = Math.hypot(...sum),
        unit = sum.map((v) => v / l),
        dot = unit[0] * b[0] + unit[1] * b[1];
      return unit.map((v) => v / dot);
    }),
    vertex = (i, s, width, y) => [
      points[i][0] + miters[i][0] * s * width,
      y,
      points[i][1] + miters[i][1] * s * width,
    ];
  function band(width, low, high, color, material = 'sandstone') {
    for (let i = 1; i < points.length; i++) {
      const target = normals[i - 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            vertex(i - 1, s, width, low(i - 1)),
            vertex(i, s, width, low(i)),
            vertex(i, s, width, high(i)),
            vertex(i - 1, s, width, high(i - 1)),
          ],
          color,
          material,
          [s * target[0], 0, s * target[1]],
        );
      face(
        o,
        [
          vertex(i - 1, -1, width, high(i - 1)),
          vertex(i, -1, width, high(i)),
          vertex(i, 1, width, high(i)),
          vertex(i - 1, 1, width, high(i - 1)),
        ],
        color,
        material,
        [0, 1, 0],
      );
    }
    for (const i of [0, points.length - 1]) {
      const direction = i === 0 ? -1 : 1,
        n = normals[i === 0 ? 0 : normals.length - 1];
      face(
        o,
        [
          vertex(i, -1, width, low(i)),
          vertex(i, 1, width, low(i)),
          vertex(i, 1, width, high(i)),
          vertex(i, -1, width, high(i)),
        ],
        color,
        material,
        [-direction * n[1], 0, direction * n[0]],
      );
    }
  }
  // Shared mitered vertices join every wall/coping segment without open tangent-block gaps.
  const base = (i) => grades[(i * 8) / count];
  band(
    0.34,
    (i) => base(i) - 0.22,
    (i) => points[i][2],
    'trim',
    'plaster',
  );
  band(
    0.38,
    (i) => base(i) - 0.22,
    (i) => base(i) + 0.3,
    'plinth',
    'carvedStone',
  );
  band(
    0.4,
    (i) => points[i][2],
    (i) => points[i][2] + 0.13,
    'trim',
    'carvedStone',
  );
  for (let i = 1; i <= count; i++) {
    const start = i === 1 ? 0.32 : 0;
    const end = i === count ? 0.87 : 1;
    const normal = normals[i - 1];
    for (const side of [-1, 1]) {
      const panel = (t, y0, y1) => {
        const a = vertex(i - 1, side, 0.346, y0),
          b = vertex(i, side, 0.346, y1);
        return a.map((v, axis) => v + (b[axis] - v) * t);
      };
      face(
        o,
        [
          panel(start, base(i - 1) + 0.58, base(i) + 0.58),
          panel(end, base(i - 1) + 0.58, base(i) + 0.58),
          panel(end, points[i - 1][2] - 0.21, points[i][2] - 0.21),
          panel(start, points[i - 1][2] - 0.21, points[i][2] - 0.21),
        ],
        'wallPanel',
        'plaster',
        [side * normal[0], 0, side * normal[1]],
      );
    }
  }
  const [x, z] = points.at(-1),
    ground = base(count),
    top = ground + c.sideHeight + 0.3;
  box(o, x, ground - 0.2, z, 0.76, 0.54, 0.82, 'plinth', 'carvedStone');
  box(o, x, ground + 0.34, z, 0.65, top - ground - 0.34, 0.69, 'trim', 'plaster');
  box(o, x, top, z, 0.89, 0.16, 0.91, 'trim', 'carvedStone');
  const urn = {
    addTriangle: (_s, ref, positions, normal, uv, color) =>
      o.addTriangle('carvedStone', ref, positions, normal, uv, color),
  };
  lathe(
    urn,
    x,
    z,
    [
      [top + 0.16, 0.24],
      [top + 0.25, 0.24],
      [top + 0.28, 0.12],
      [top + 0.43, 0.17],
      [top + 0.63, 0.31],
      [top + 0.75, 0.24],
      [top + 0.85, 0.14],
      [top + 0.91, 0.05],
    ],
    d < 2 ? 6 : 10,
  );
}
function lionLeaves(o, half, d) {
  if (d === 0) return;
  for (const sign of [-1, 1]) {
    // Open by about 80 degrees: leaves lie beside the passage toward the park.
    const hinge = sign * half,
      endX = sign * (half - 0.35),
      endZ = half * 0.97,
      q = (t) => [hinge + (endX - hinge) * t, endZ * t],
      count = d === 1 ? 5 : 11;
    for (const y of [0.2, 0.9]) tube(o, [hinge, y, 0], [endX, y, endZ], 0.055);
    const top = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count,
        p = q(t);
      return [p[0], 3.55 - 0.65 * Math.sin((t * Math.PI) / 2), p[1]];
    });
    path(o, top, 0.065);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        p = q(t),
        top = 3.55 - 0.65 * Math.sin((t * Math.PI) / 2);
      tube(o, [p[0], 0.14, p[1]], [p[0], top, p[1]], 0.035);
      if (d >= 2) tube(o, [p[0], top, p[1]], [p[0], top + 0.15, p[1]], 0.055);
    }
    if (d === 3) {
      const span = Math.hypot(endX - hinge, endZ);
      const frame = localGate(o, [hinge, 0, 0], -Math.atan2(endZ, endX - hinge));
      for (const y of [0.35, 1.06])
        for (let i = 0; i < 7; i++) scroll(frame, ((i + 0.5) * span) / 7, y, 0.012, 0.102, 2);
    }
  }
}
function buildLionGate(o, c, fit, d) {
  const half = c.clearWidth / 2,
    px = half + c.pillarWidth / 2;
  for (const sign of [-1, 1]) {
    const x = sign * px;
    const { pierBase, grades } = fit.wings[(sign + 1) / 2];
    squarePier(o, x, c, pierBase);
    box(o, x, c.pillarHeight, 0, 1.38, 0.2, 1.35, 'stone');
    box(o, x, c.pillarHeight + 0.2, 0, 1.22, 0.1, 1.2, 'trim');
    const carving = localGate(o, [x, c.pillarHeight + 0.3, 0], -sign * Math.PI * 0.75);
    seatedLion(
      {
        addTriangle: (_s, r, p, n, uv, col) =>
          carving.addTriangle(
            'carvedStone',
            r,
            p.map((v) => v.map((x) => (x * c.lionHeight) / 1.92)),
            n,
            uv,
            col,
          ),
      },
      d,
    );
    lionWing(o, sign, px, c, grades, d);
    if (d >= 1) {
      for (const z of [-c.pillarDepth / 2 - 0.015, c.pillarDepth / 2 + 0.015]) {
        for (const offset of [-0.53, 0.53]) box(o, x + offset, 0.5, z, 0.09, 3.42, 0.08, 'trim');
        box(o, x, 3.9, z, 1.15, 0.085, 0.09, 'trim', 'carvedStone');
      }
    }
  }
  lionLeaves(o, half, d);
}

export function buildKsiazGate(o, key, level = 'closeup') {
  const f = frames.get(key),
    d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (!f || d === undefined) throw Error('Unknown gate or level');
  if (key === 'ksiaz_lion_gate') return buildLionGate(o, f.controls, f.siteFit, d);
  const c = f.controls,
    half = c.clearWidth / 2,
    px = half + c.pillarWidth / 2;
  const carving = {
    addTriangle: (_surface, ref, points, normal, uv, color) =>
      o.addTriangle('carvedStone', ref, points, normal, uv, color),
  };
  const pier = [
    [-0.75, -1],
    [0.75, -1],
    [1, -0.75],
    [1, 0.75],
    [0.75, 1],
    [-0.75, 1],
    [-1, 0.75],
    [-1, -0.75],
  ];
  for (const sign of [-1, 1]) {
    const x = sign * px;
    const grades = f.siteFit.wings[(sign + 1) / 2];
    const shaft = [[0.41, 0.67]];
    if (d >= 2) {
      for (let course = 1; course <= 7; course++) {
        const y = 0.41 + course * 0.47;
        shaft.push([y - 0.023, 0.67], [y, 0.651], [y + 0.023, 0.67]);
      }
    }
    shaft.push([3.74, 0.67], [3.74, 0.76], [3.91, 0.83], [4.02, 0.98], [4.1, 0.98]);
    lathe(
      o,
      x,
      0,
      [[grades.pierBase, 0.82], [0.29, 0.82], [0.41, 0.71], ...shaft],
      8,
      'stone',
      pier,
    );
    lathe(
      carving,
      x,
      0,
      [
        [4.1, 0.55],
        [4.45, 0.4],
        [4.7, 0.22],
        [4.8, 0.22],
        [5.12, 0.46],
        [5.33, 0.55],
        [5.45, 0.58],
        [5.48, 0.49],
        [5.59, 0.44],
        [5.7, 0.25],
        [5.84, 0.1],
      ],
      d === 0 ? 6 : d === 1 ? 8 : 12,
    );
    if (d >= 2) {
      for (const yy of [4.3, 4.55])
        for (const xx of [-0.45, 0.45])
          scroll(carving, x + xx, yy, -0.52, 0.22, d, 'trim', 'sandstone');
      ellipsoid(carving, [x - sign * 0.52, 4.55, -0.35], [0.18, 0.34, 0.18], d);
      ellipsoid(carving, [x - sign * 0.52, 4.91, -0.35], [0.15, 0.17, 0.15], d);
    }
    const stations = d >= 2 ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 2, 4, 7];
    const wing = stations.map((i) => [
      sign * (px + 0.7 + (c.sideWidth * i) / 7),
      grades.grades[i],
      -1.4 * Math.sin((i * Math.PI) / 14),
    ]);
    for (let i = 1; i < wing.length; i++) {
      const a = wing[i - 1],
        b = wing[i],
        mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2],
        len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      // Small overlapping tangent blocks form a continuous curved wall and coping.
      const slope = (b[1] - a[1]) / len,
        grade = (a[1] + b[1]) / 2,
        angle = -Math.atan2(b[2] - a[2], b[0] - a[0]),
        rotate = ([x, y, z]) => [
          x * Math.cos(angle) + z * Math.sin(angle),
          y,
          -x * Math.sin(angle) + z * Math.cos(angle),
        ],
        q = {
          addTriangle: (s, r, p, n, uv, col) =>
            o.addTriangle(
              s,
              r,
              p.map((v) => {
                const a = rotate(v);
                return [a[0] + mid[0], a[1] + grade + slope * v[0], a[2] + mid[1]];
              }),
              normalize(rotate([n[0] - slope * n[1], n[1], n[2]])),
              uv,
              col,
            ),
        };
      box(q, 0, -0.25, 0, len + 0.04, c.sideHeight + 0.25, 0.45);
      box(q, 0, c.sideHeight, 0, len + 0.06, 0.16, 0.6, 'trim');
      if (d >= 1 && c.crest) {
        const bars = d === 1 ? 2 : 4;
        for (let j = 0; j < bars; j++) {
          const bar = -len / 2 + ((j + 0.5) * len) / bars;
          box(q, bar, 1.36, 0, 0.045, 1.25, 0.054, 'metal', 'metal');
          if (d === 3) {
            box(q, bar, 2.62, 0, 0.021, 0.11, 0.028, 'metal', 'metal');
            if (j % 2 === 0) scroll(q, bar + len / (4 * bars), 2.36, -0.028, 0.075, d);
          }
        }
        if (d >= 2) box(q, 0, 1.48, 0, len + 0.04, 0.045, 0.053, 'metal', 'metal');
        box(q, 0, 2.58, 0, len + 0.04, 0.06, 0.06, 'metal', 'metal');
      }
    }
    if (!c.crest) {
      const end = wing.at(-1);
      box(o, end[0], c.sideHeight - 0.17 + end[1], end[2], 1.6, 0.44, 1.05, 'trim');
      const pedestal = c.sideHeight + 0.27 + end[1];
      if (d >= 1)
        statue(localGate(carving, [end[0], pedestal, end[2]], sign < 0 ? 0 : Math.PI), 0, 0, 0, d);
      else ellipsoid(carving, [end[0], pedestal + 0.6, end[2]], [0.9, 0.6, 0.4], 1);
    }
  }
  ironOpening(o, half, d, c.crest);
}
export function buildKsiazGateSkyline(o, key) {
  buildKsiazGate(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * ((s === 'carvedStone' ? lionMeans : means)[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
