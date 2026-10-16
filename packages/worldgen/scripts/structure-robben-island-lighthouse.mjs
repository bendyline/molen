/** Robben Island Lighthouse: round masonry tower, two galleries and red sixteen-pane lantern. */
import './install-deterministic-math.mjs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const white = rgb('e2e0d6'),
  cream = rgb('d0c8b5'),
  stone = rgb('9a9c8a'),
  red = rgb('a74335'),
  edge = rgb('824037'),
  iron = rgb('6c7471'),
  black = rgb('262b29'),
  glass = rgb('526c75'),
  lightGlass = rgb('a8c5c8'),
  door = rgb('594237');
const ref = 'palette:#ffffff';
function facing(o, a) {
  const co = Math.cos(a),
    si = Math.sin(a),
    p = (v) => [co * v[0] + si * v[2], v[1], -si * v[0] + co * v[2]];
  return {
    addTriangle: (s, r, v, n, u, c) => o.addTriangle(s, r, v.map(p), p(n), u, c),
    addQuad: (s, r, v, n, u, c) => o.addQuad(s, r, v.map(p), p(n), u, c),
    addConvexPolygon: (s, r, v, n, u, c) => {
      const ps = v.map(p),
        uv = v.map(u);
      return o.addConvexPolygon(s, r, ps, p(n), (v) => uv[ps.indexOf(v)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function profile(o, s, levels, n, c) {
  loft(
    o,
    s,
    levels.map(([y, r]) => radialRing(y, r, r, n)),
    c,
  );
}
function band(o, s, y, r, h, n, c) {
  profile(
    o,
    s,
    [
      [y, r],
      [y + h, r],
    ],
    n,
    c,
  );
}
function ring(o, y, r, t, n, c) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r];
    quad(
      o,
      'metal',
      [p(a, y, r), p(b, y, r), p(b, y + t, r), p(a, y + t, r)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      c,
    );
    quad(
      o,
      'metal',
      [p(a, y, r - t), p(b, y, r - t), p(b, y + t, r - t), p(a, y + t, r - t)],
      [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
      c,
    );
    quad(
      o,
      'metal',
      [p(a, y + t, r), p(b, y + t, r), p(b, y + t, r - t), p(a, y + t, r - t)],
      [0, 1, 0],
      c,
    );
  }
}
const radius = (y) =>
  y < 2.25 ? 21.25 / (Math.PI * 2) : 3.15 - (Math.min(11.5, y) - 2.55) * 0.0559;
function window(o, a, y, h, d) {
  const q = facing(o, a),
    z = radius(y) + 0.025,
    w = 0.65;
  face(q, 'glass', 0, y, z, w, h, glass);
  if (!d) return;
  for (const x of [-w / 2 - 0.09, w / 2 + 0.09])
    B(q, 'wall', x, y - 0.08, z, 0.18, h + 0.15, 0.18, white);
  B(q, 'wall', 0, y - 0.12, z + 0.04, w + 0.5, 0.18, 0.32, cream);
  B(q, 'wall', 0, y + h, z, w + 0.35, 0.16, 0.23, white);
  if (d > 1) {
    for (const xx of [-w / 6, w / 6]) face(q, 'metal', xx, y, z + 0.12, 0.035, h, cream);
    for (let i = 1; i < (h > 1 ? 4 : 3); i++)
      face(q, 'metal', 0, y + (h * i) / (h > 1 ? 4 : 3), z + 0.13, w, 0.04, cream);
    B(q, 'wall', 0, y + h + 0.06, z + 0.08, 0.2, 0.22, 0.27, white);
  }
}
function railing(o, y, r, d, curved = false) {
  const n = d > 2 ? (curved ? 96 : 32) : d > 1 ? (curved ? 48 : 24) : 16;
  ring(o, y + (curved ? 1.08 : 0.85), r + (curved ? 0.38 : 0), 0.055, n, iron);
  if (!d) return;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      profile = curved
        ? [
            [0, r],
            [0.3, r + 0.15],
            [0.65, r + 0.4],
            [1.08, r + 0.38],
          ]
        : [
            [0, r],
            [0.85, r],
          ],
      p = ([h, r]) => [Math.cos(a) * r, y + h, Math.sin(a) * r];
    for (let j = 1; j < profile.length; j++) {
      const aa = p(profile[j - 1]),
        bb = p(profile[j]);
      if (d > 1) beam(o, 'metal', aa, bb, 0.035, 0.035, iron);
      else {
        const dx = -Math.sin(a) * 0.025,
          dz = Math.cos(a) * 0.025;
        quad(
          o,
          'metal',
          [
            [aa[0] - dx, aa[1], aa[2] - dz],
            [aa[0] + dx, aa[1], aa[2] + dz],
            [bb[0] + dx, bb[1], bb[2] + dz],
            [bb[0] - dx, bb[1], bb[2] - dz],
          ],
          [Math.cos(a), 0, Math.sin(a)],
          iron,
        );
      }
    }
    if (d > 2 && curved && i % 12 === 0)
      sphere(o, 'metal', p([1.16, r + 0.38]), [0.075, 0.075, 0.075], iron, 8, 4);
  }
  if (!curved && d > 1) ring(o, y + 0.42, r, 0.035, n, iron);
}
function lighthouse(output, _f, d = 3) {
  // Photo-derived height controls, preserving the approximately 18 m total height.
  const levels = [
    [0, 0],
    [2.55, 2.55],
    [11.5, 10.3],
    [12.45, 11.25],
    [13.85, 12.95],
    [16.25, 15.85],
    [17.74, 17.64],
    [18.23, 18.23],
    [18.75, 18.75],
  ];
  const yAt = (y) => {
    if (y <= 0) return y;
    for (let i = 1; i < levels.length; i++) {
      const [a, b] = levels[i - 1],
        [c, e] = levels[i];
      if (y <= c) return b + ((y - a) * (e - b)) / (c - a);
    }
    return y;
  };
  const p = (v) => [v[0], yAt(v[1]), v[2]];
  const normal = (v, n) => {
    const a = p(v[0]),
      b = p(v[1]),
      c = p(v[2]);
    const u = b.map((x, i) => x - a[i]),
      w = c.map((x, i) => x - a[i]);
    let q = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const length = Math.hypot(...q);
    if (!length) return n;
    if (q.reduce((s, x, i) => s + x * n[i], 0) < 0) q = q.map((x) => -x);
    return q.map((x) => x / length);
  };
  const o = {
    addTriangle: (s, r, v, n, u, c) => output.addTriangle(s, r, v.map(p), normal(v, n), u, c),
    addQuad: (s, r, v, n, u, c) => output.addQuad(s, r, v.map(p), normal(v, n), u, c),
    addConvexPolygon: (s, r, v, n, u, c) => {
      const ps = v.map(p),
        uv = v.map(u);
      return output.addConvexPolygon(s, r, ps, normal(v, n), (v) => uv[ps.indexOf(v)], c);
    },
  };
  const n = d > 2 ? 64 : d > 1 ? 40 : d ? 24 : 12,
    baseR = 21.25 / (Math.PI * 2);
  profile(
    o,
    'foundation',
    [
      [-0.8, 4.2],
      [0, 4.2],
      [0.12, 3.7],
    ],
    n,
    cream,
  );
  profile(
    o,
    'wall',
    [
      [0, baseR],
      [2.25, baseR],
      [2.55, 3.15],
      [11.5, 2.65],
    ],
    n,
    white,
  );
  profile(
    o,
    'foundation',
    [
      [11.5, 2.65],
      [11.7, 2.73],
      [11.95, 3.05],
      [12.12, 3.4],
      [12.3, 3.48],
    ],
    n,
    stone,
  );
  band(o, 'metal', 12.3, 3.58, 0.15, n, red);
  profile(
    o,
    'metal',
    [
      [12.45, 2.13],
      [13.85, 2.13],
    ],
    16,
    red,
  );
  band(o, 'metal', 13.82, 2.48, 0.14, n, edge);
  // East daymark follows the taper. It is an orientation cue rather than a generic lighthouse stripe.
  const patches = d > 1 ? 4 : 2;
  for (let i = 0; i < patches; i++) {
    const a = -0.105 + (i * 0.21) / patches,
      b = -0.105 + ((i + 1) * 0.21) / patches;
    const p = (a, y) => [Math.sin(a) * (radius(y) + 0.023), y, Math.cos(a) * (radius(y) + 0.023)];
    quad(o, 'metal', [p(a, 2.55), p(b, 2.55), p(b, 11.5), p(a, 11.5)], [0, 0, 1], black);
  }
  // Double timber entrance on the east, plus one opposite ground-floor sash.
  face(o, 'wood', 0, 0.15, baseR + 0.025, 1.35, 2.12, door);
  if (d) {
    for (const x of [-0.78, 0.78]) B(o, 'wall', x, 0.05, baseR, 0.2, 2.5, 0.28, white);
    B(o, 'wall', 0, 2.35, baseR, 1.8, 0.25, 0.3, white);
    B(o, 'foundation', 0, -0.02, baseR + 0.35, 1.85, 0.2, 0.85, stone);
    if (d > 1) {
      face(o, 'wood', 0, 0.15, baseR + 0.08, 0.06, 2.1, black);
      for (const x of [-0.34, 0.34])
        for (const y of [0.35, 1.25])
          face(o, 'wood', x, y, baseR + 0.09, 0.48, 0.64, rgb('6f5544'));
      for (let i = 0; i < 7; i++)
        face(o, 'wood', (i - 3) * 0.17, 2.09, baseR + 0.1, 0.13, 0.15, rgb('8b7660'));
    }
  }
  window(o, Math.PI, 0.7, 1.2, d);
  for (const [a, ys] of [
    [0, [5.8, 10.15]],
    [Math.PI, [5.8, 10.15]],
    [Math.PI / 2, [4.2, 8.6]],
    [-Math.PI / 2, [4.2, 8.6]],
  ])
    for (const y of ys) window(o, a, y, y > 10 ? 0.85 : 1.3, d);
  if (d > 2) {
    // Subtle masonry courses retain a painted-stone shaft, without photo textures.
    for (let i = 1; i < 28; i++) {
      const y = 2.55 + (i * (11.5 - 2.55)) / 28,
        r = radius(y) + 0.025;
      for (let j = 0; j < n; j++) {
        const a = (j * Math.PI * 2) / n,
          b = ((j + 1) * Math.PI * 2) / n;
        quad(
          o,
          'wall',
          [
            [r * Math.cos(a), y, r * Math.sin(a)],
            [r * Math.cos(b), y, r * Math.sin(b)],
            [r * Math.cos(b), y + 0.009, r * Math.sin(b)],
            [r * Math.cos(a), y + 0.009, r * Math.sin(a)],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
          rgb('d9d8cc'),
        );
      }
    }
  }
  // Sixteen alternating tapered glazing divisions and visible lens; the optical system is simplified.
  const pane = (i, top) => {
    const a = (i * Math.PI * 2) / 16 + (i % 2 ? 1 : -1) * (top ? 0.025 : -0.025),
      r = top ? 2.04 : 2.1;
    return [r * Math.cos(a), top ? 16.25 : 13.96, r * Math.sin(a)];
  };
  for (let i = 0; i < 16; i++) {
    const a = pane(i, false),
      b = pane(i + 1, false),
      c = pane(i + 1, true),
      e = pane(i, true),
      ang = ((i + 0.5) * Math.PI * 2) / 16;
    quad(
      o,
      d ? 'lantern' : 'glass',
      [a, b, c, e],
      [Math.cos(ang), 0, Math.sin(ang)],
      d ? lightGlass : glass,
    );
    if (d) {
      beam(o, 'metal', a, e, 0.045, 0.045, iron);
      if (d > 1) {
        for (const t of [1 / 3, 2 / 3])
          beam(
            o,
            'metal',
            a.map((v, k) => v + (e[k] - v) * t),
            b.map((v, k) => v + (c[k] - v) * t),
            0.035,
            0.035,
            iron,
          );
      }
    }
  }
  if (d > 1) {
    profile(
      o,
      'metal',
      [
        [13.96, 0.3],
        [14.3, 0.3],
        [14.6, 0.65],
        [15.2, 0.85],
        [15.9, 0.55],
      ],
      24,
      rgb('9ba99c'),
    );
    for (const y of [14.65, 14.9, 15.15, 15.4, 15.65])
      ring(o, y, y < 15.2 ? 0.83 : 0.75, 0.04, 24, iron);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      beam(
        o,
        'metal',
        [Math.cos(a) * 2.14, 12.5, Math.sin(a) * 2.14],
        [Math.cos(a) * 2.14, 13.8, Math.sin(a) * 2.14],
        0.025,
        0.025,
        edge,
      );
    }
  }
  const roofProfile = [
    [16.25, 2.2],
    [16.6, 2.15],
    [17, 1.9],
    [17.35, 1.36],
    [17.58, 0.65],
    [17.74, 0.24],
    [17.92, 0.36],
    [18.16, 0.19],
    [18.23, 0.06],
  ];
  profile(
    o,
    'metal',
    d
      ? roofProfile
      : [roofProfile[0], roofProfile[2], roofProfile[4], roofProfile[6], roofProfile[8]],
    d > 1 ? 36 : 12,
    red,
  );
  band(o, 'metal', 16.22, 2.24, 0.09, n, edge);
  if (d > 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      for (let j = 1; j < 6; j++)
        beam(
          o,
          'metal',
          [
            Math.cos(a) * (roofProfile[j - 1][1] + 0.015),
            roofProfile[j - 1][0],
            Math.sin(a) * (roofProfile[j - 1][1] + 0.015),
          ],
          [
            Math.cos(a) * (roofProfile[j][1] + 0.015),
            roofProfile[j][0],
            Math.sin(a) * (roofProfile[j][1] + 0.015),
          ],
          0.018,
          0.018,
          edge,
        );
    }
    // Interpreted access ladder on the east of the lantern, plus two narrow external drains.
    for (const x of [-0.24, 0.24])
      beam(o, 'metal', [x, 13.83, 2.28], [x, 16.3, 2.34], 0.035, 0.035, edge);
    for (let y = 14; y < 16.3; y += 0.27)
      beam(o, 'metal', [-0.24, y, 2.31], [0.24, y, 2.31], 0.035, 0.035, edge);
    for (const sign of [-1, 1])
      beam(o, 'metal', [sign * 2.2, 12.45, 0], [sign * 2.2, 16.24, 0], 0.045, 0.045, edge);
  }
  if (d) {
    B(o, 'metal', 0, 18.15, 0, 0.035, 0.6, 0.035, iron);
    beam(o, 'metal', [-0.45, 18.55, 0], [0.45, 18.55, 0], 0.025, 0.025, iron);
    const p = [
      [0.3, 18.42, 0],
      [0.65, 18.55, 0],
      [0.3, 18.68, 0],
    ];
    o.addTriangle(
      'metal',
      ref,
      p,
      [0, 0, 1],
      p.map((p) => [p[0], p[1]]),
      iron,
    );
    o.addTriangle(
      'metal',
      ref,
      p,
      [0, 0, -1],
      p.map((p) => [p[0], p[1]]),
      iron,
    );
  }
  railing(o, 12.46, 3.52, d, true);
  railing(o, 13.98, 2.43, d, false);
}
export function robbenLighthouseSkyline(o) {
  lighthouse(o, undefined, 0);
}
export function robbenLighthouseDistrict(o) {
  lighthouse(o, undefined, 1);
}
export function robbenLighthouseStreet(o) {
  lighthouse(o, undefined, 2);
}
const surfaces = {
  wall: { ...landmarkSurfaces.stone, slot: 'wall', graph: 'plaster_lime' },
  foundation: { ...landmarkSurfaces.stone, slot: 'foundation' },
  metal: { ...landmarkSurfaces.metal, slot: 'trim' },
  wood: { ...landmarkSurfaces.stone, slot: 'trim', graph: 'wood_painted_lap' },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  lantern: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.22,
    metallic: 0.08,
    baseColorFactor: [1, 1, 1, 0.3],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
};
export const robbenLighthouseModel = {
  id: 'robben_island_lighthouse',
  recipe: 'structure-robben-island-lighthouse.mjs',
  key: 'robben_island_lighthouse',
  cell: 'k3/k3v',
  title: 'Robben Island Lighthouse',
  brief:
    'White tapered masonry lighthouse on Minto Hill, with black east daymark, red service drum and curved dome, two metal galleries and the sixteen-part glazed lantern.',
  camera: [24, 15, 28],
  lookAt: [0, 9, 0],
  qaCameras: [
    { name: 'front', position: [0, 10, 32], lookAt: [0, 9, 0] },
    { name: 'back', position: [-23, 16, -27], lookAt: [0, 9, 0] },
  ],
  build: lighthouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 1.6 },
  groundContactBasis:
    'East doorway apron at [0,4.2], outside the masonry base. Independent terrain is preserved; foundation reaches -0.8 m.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-robben-island-lighthouse.mjs',
    level: 'skyline',
    export: 'robbenLighthouseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'robbenLighthouseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'robbenLighthouseStreet', errorMeters: 0.06, surfaces },
    },
  },
  limitations: [
    "Original medium-fi surviving tower exterior, based on an individually inspected 2012 Qualla image and the architect's 2019 northeast photograph; not a surveyed reconstruction.",
    'Published 21.25 m base circumference controls the base diameter. Approximately 18 m tower height excludes the small interpreted weather vane. Other heights, window levels, ladder orientation and ornament are photographic estimates; upper proportions were adjusted against the long-lens Qualla photograph.',
    'Map circle controls the actual Minto Hill location, independently of the island story point. Published coordinates and focal-plane heights differ and are not treated as precise geometry.',
    'Round as-built shaft, staggered sash windows, east door and stripe, curved gallery rails and red lantern/dome are retained. Lens and glazing are visual approximations, not a working navigation light or optical simulation.',
    'Office, engine room, demolished keeper house, paths, shell bollards and vegetation are excluded. No interior stairs or reference image pixels are embedded.',
    'Independent terrain remains unmodified; other runtime elevation datasets can differ at the small foundation.',
  ],
};
