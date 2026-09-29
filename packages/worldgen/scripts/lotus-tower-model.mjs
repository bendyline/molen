/** Colombo Lotus Tower: original measured exterior, not a reused observation-tower primitive. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { annulus, face, tau, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const profile = [
  [198, 8],
  [201, 8.3],
  [205, 9.6],
  [210, 13.3],
  [215, 16.7],
  [219.8, 19.3],
  [224.6, 21.0],
  [229.4, 21.75],
  [234.2, 21.55],
  [239, 20.3],
  [243.8, 18.1],
  [248.2, 15.4],
  [252, 13.3],
  [255.2, 11.0],
];
function radius(y) {
  for (let i = 1; i < profile.length; i++)
    if (y <= profile[i][0]) {
      const [a, r] = profile[i - 1],
        [b, s] = profile[i];
      return r + ((s - r) * (y - a)) / (b - a);
    }
  return profile.at(-1)[1];
}
const point = (r, y, a) => [r * Math.cos(a), y, r * Math.sin(a)];
function rail(out, r, y, posts, color) {
  for (const h of [0.3, 0.78, 1.14])
    annulus(out, 'metal', r - 0.033, r + 0.033, y + h, y + h + 0.055, color, 128);
  for (let i = 0; i < posts; i++) {
    const a = (i * tau) / posts;
    beam(out, 'metal', point(r, y, a), point(r, y + 1.2, a), 0.065, 0.065, color);
  }
}
function petal(out, angle, y0, y1, half, offset, color, slot = 'glass', grid = true) {
  const nu = 12,
    nt = 24;
  // Each leaf has a broad concealed root and a pointed free tip. Lower courses sit
  // outside the roots of the higher course; drawing complete coincident oval
  // outlines here produced false double grids in the first visual review.
  const p = (u, t, lift = 0) => {
    const y = y0 + (y1 - y0) * t,
      spread = half * Math.cos((Math.PI * t) / 2),
      a = angle - u * spread;
    return point(radius(y) + offset + 0.3 * Math.sin(Math.PI * t) * (1 - u * u) + lift, y, a);
  };
  for (let j = 0; j < nt; j++)
    for (let i = 0; i < nu; i++) {
      const u = -1 + (2 * i) / nu,
        v = -1 + (2 * (i + 1)) / nu,
        a = j / nt,
        b = (j + 1) / nt;
      if (j === nt - 1) triangle(out, slot, [p(u, a), p(v, a), p(0, 1)], color);
      else face(out, slot, [p(u, a), p(v, a), p(v, b), p(u, b)], color);
    }
  const edge = [0.61, 0.47, 0.4],
    mullion = [0.28, 0.23, 0.24];
  if (grid)
    for (const u of [-1, 1])
      for (let j = 0; j < nt; j++)
        beam(out, 'metal', p(u, j / nt, 0.055), p(u, (j + 1) / nt, 0.055), 0.14, 0.09, edge);
  if (grid) {
    for (let i = 1; i < nu; i++) {
      const u = -1 + (2 * i) / nu;
      for (let j = 0; j < nt - 1; j++)
        beam(out, 'metal', p(u, j / nt, 0.045), p(u, (j + 1) / nt, 0.045), 0.052, 0.045, mullion);
    }
    for (let j = 2; j < nt; j += 2) {
      const t = j / nt;
      for (let i = 0; i < nu; i++)
        beam(
          out,
          'metal',
          p(-1 + (2 * i) / nu, t, 0.045),
          p(-1 + (2 * (i + 1)) / nu, t, 0.045),
          0.045,
          0.045,
          mullion,
        );
    }
  }
}
function buildLotus(out) {
  const green = [0.065, 0.35, 0.18],
    greenShade = [0.09, 0.29, 0.17],
    cream = [0.86, 0.84, 0.73],
    frame = [0.41, 0.45, 0.43],
    blue = [0.17, 0.26, 0.28],
    floor = [0.59, 0.6, 0.54];
  // The 83.1 m mapped circular podium pinches at its first floor and widens to the roof terrace.
  const podium = [
    [0, 41.52],
    [0.3, 41.52],
    [4.6, 38.8],
    [5.0, 38.8],
    [15.4, 41.52],
    [16, 41.52],
  ];
  loft(
    out,
    'glass',
    podium.map(([y, r]) => radialRing(y, r, r, 192)),
    blue,
  );
  for (const [y, r] of [
    [0, 41.53],
    [4.95, 38.84],
    [10.0, 40.2],
    [15.7, 41.6],
  ])
    annulus(out, 'metal', r - 0.14, r + 0.07, y, y + 0.15, frame, 192);
  for (let i = 0; i < 192; i++) {
    const a = (i * tau) / 192;
    for (let j = 1; j < podium.length; j++) {
      const [y0, r0] = podium[j - 1],
        [y1, r1] = podium[j];
      beam(out, 'metal', point(r0 + 0.04, y0, a), point(r1 + 0.04, y1, a), 0.085, 0.065, frame);
    }
  }
  // Forty-eight modeled white lotus-leaf fascia panels and a continuous safe terrace railing.
  for (let i = 0; i < 48; i++) {
    const a = (i * tau) / 48,
      wall = transform(out, Math.PI / 2 - a, [41.6 * Math.cos(a), 0, 41.6 * Math.sin(a)]),
      w = 2.62;
    const rim = [
      [-w, 14.95, 0.04],
      [-2.3, 14.25, 0.2],
      [-1.45, 13.95, 0.29],
      [0, 13.82, 0.33],
      [1.45, 13.95, 0.29],
      [2.3, 14.25, 0.2],
      [w, 14.95, 0.04],
      [2.22, 15.7, 0.3],
      [1.2, 16.18, 0.53],
      [0.35, 16.8, 0.37],
      [0, 17.25, 0.12],
      [-0.35, 16.8, 0.37],
      [-1.2, 16.18, 0.53],
      [-2.22, 15.7, 0.3],
    ];
    const center = [0, 15.2, 0.91],
      rings = 8,
      segments = 84;
    const boundary = (t) => {
      const f = t * rim.length,
        i = Math.floor(f),
        u = f - i,
        idx = (k) => rim[(k + rim.length) % rim.length];
      const p = idx(i - 1),
        q = idx(i),
        r = idx(i + 1),
        s = idx(i + 2);
      return q.map(
        (v, k) =>
          0.5 *
          (2 * v +
            (-p[k] + r[k]) * u +
            (2 * p[k] - 5 * v + 4 * r[k] - s[k]) * u * u +
            (-p[k] + 3 * v - 3 * r[k] + s[k]) * u * u * u),
      );
    };
    const panel = (r, t) => {
      const p = boundary(t);
      return [
        center[0] + (p[0] - center[0]) * r,
        center[1] + (p[1] - center[1]) * r,
        p[2] * r + 0.91 * Math.sqrt(Math.max(0, 1 - r * r)),
      ];
    };
    for (let j = 0; j < rings; j++)
      for (let k = 0; k < segments; k++) {
        const a = k / segments,
          b = (k + 1) / segments;
        if (j === 0)
          triangle(wall, 'concrete', [center, panel(1 / rings, a), panel(1 / rings, b)], cream);
        else
          face(
            wall,
            'concrete',
            [
              panel(j / rings, a),
              panel((j + 1) / rings, a),
              panel((j + 1) / rings, b),
              panel(j / rings, b),
            ],
            cream,
          );
      }
  }
  loft(
    out,
    'concrete',
    [radialRing(15.88, 41.4, 41.4, 192), radialRing(16.04, 41.4, 41.4, 192)],
    floor,
  );
  rail(out, 40.8, 16.1, 144, frame);
  // The operator's roof photograph shows the occupied ring pavilion under a
  // shallow conical roof, with the existing three service pods beside it.
  loft(out, 'glass', [radialRing(16.06, 18.4, 18.4, 144), radialRing(20.2, 18.4, 18.4, 144)], blue);
  loft(
    out,
    'metal',
    [radialRing(20.2, 19.0, 19.0, 144), radialRing(23.3, 10.48, 10.48, 144)],
    [0.32, 0.4, 0.35],
    { cap: false },
  );
  annulus(out, 'metal', 18.25, 19.03, 20.12, 20.28, cream, 144);
  for (let i = 0; i < 72; i++) {
    const a = (i * tau) / 72;
    beam(out, 'metal', point(18.44, 16.08, a), point(18.44, 20.2, a), 0.09, 0.065, cream);
    beam(
      out,
      'metal',
      point(19, 20.24, a),
      point(10.5, 23.32, a),
      0.035,
      0.035,
      [0.31, 0.36, 0.32],
    );
  }
  // Four entrance axes agree with the regulator ground plan and separately mapped entrance nodes.
  for (let k = 0; k < 4; k++) {
    const gate = transform(out, (k * Math.PI) / 2);
    box(gate, 'metal', [-6.0, 4.24, 36.7], [6.0, 4.46, 43.0], cream);
    for (let j = 0; j < 8; j++)
      box(
        gate,
        'glass',
        [-5.86 + j * 1.48, 0.18, 41.56],
        [-4.46 + j * 1.48, 4.23, 41.61],
        [0.2, 0.28, 0.29],
      );
    for (const x of [-5.9, -2.94, 0, 2.94, 5.9])
      box(gate, 'metal', [x - 0.052, 0.1, 41.6], [x + 0.052, 4.3, 41.76], frame);
    for (let j = 0; j < 3; j++)
      box(
        gate,
        'concrete',
        [-6.1, 0, 41.53 + j * 0.5],
        [6.1, 0.45 - j * 0.15, 42.03 + j * 0.5],
        [0.75, 0.74, 0.67],
      );
  }
  // Smooth, gently tapered green stem; real anti-collision fixtures and paired maintenance collars.
  loft(
    out,
    'concrete',
    [
      [0, 13],
      [16, 10.7],
      [42, 9.9],
      [90, 9.0],
      [145, 8.35],
      [185, 8.0],
      [198, 8.0],
    ].map(([y, r]) => radialRing(y, r, r, 192)),
    green,
  );
  for (const y of [60, 105, 150, 187])
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        r = y < 100 ? 9.2 : y < 160 ? 8.5 : 8.13;
      sphere(out, 'metal', point(r + 0.14, y, a), [0.13, 0.17, 0.13], [0.66, 0.06, 0.04], 12, 8);
    }
  for (const y of [192.0, 199.0]) {
    annulus(out, 'concrete', 7.8, 10.15, y, y + 0.45, cream, 128);
    rail(out, 9.86, y + 0.45, 72, frame);
    for (let i = 0; i < 16; i++) {
      const a = (i * tau) / 16;
      box(
        transform(out, Math.PI / 2 - a, point(9.63, y + 0.5, a)),
        'metal',
        [-0.26, 0, -0.2],
        [0.26, 0.43, 0.2],
        cream,
      );
    }
  }
  // Supporting green calyx, then a glazed body whose ribs form thirty-two overlapping petals.
  loft(
    out,
    'concrete',
    profile.filter(([y]) => y <= 215).map(([y, r]) => radialRing(y, r, r, 192)),
    greenShade,
  );
  loft(
    out,
    'glass',
    profile
      .filter(([y]) => y >= 210 && y <= 248.2)
      .map(([y, r]) => radialRing(y, r - 0.2, r - 0.2, 192)),
    [0.46, 0.28, 0.34],
    { cap: false },
  );
  for (let i = 0; i < 8; i++)
    petal(out, (i * tau) / 8, 203, 218, Math.PI / 8, 0.92, greenShade, 'concrete', false);
  const tiers = [
    { lo: 209, hi: 231, phase: Math.PI / 8, c: [0.6, 0.27, 0.42] },
    { lo: 219, hi: 241.5, phase: 0, c: [0.7, 0.4, 0.52] },
    { lo: 229.4, hi: 250.5, phase: Math.PI / 8, c: [0.77, 0.55, 0.62] },
    { lo: 239, hi: 255.2, phase: 0, c: [0.79, 0.65, 0.69] },
  ];
  for (let row = 0; row < tiers.length; row++) {
    const t = tiers[row];
    for (let i = 0; i < 8; i++)
      petal(out, t.phase + (i * tau) / 8, t.lo, t.hi, Math.PI / 8, 0.72 - row * 0.2, t.c);
  }
  // Occupied-floor spandrels stay behind the petals; the observation terrace occupies the open top.
  for (const y of [215, 219.8, 224.6, 229.4, 234.2, 239, 243.8])
    annulus(out, 'metal', radius(y) - 0.25, radius(y) + 0.05, y, y + 0.15, [0.37, 0.3, 0.32], 128);
  annulus(out, 'concrete', 9.0, 15.25, 248.15, 248.3, cream, 128);
  rail(out, 15.0, 248.3, 96, frame);
  // Visible stacked white antenna plinths, slim tapering mast, service platforms and access ladder.
  loft(
    out,
    'concrete',
    [
      [248.3, 9.5],
      [252, 9.5],
      [252, 8.0],
      [260, 8.0],
      [261, 7.6],
      [263.1, 7.6],
    ].map(([y, r]) => radialRing(y, r, r, 96)),
    cream,
  );
  for (const y of [252, 260.8]) rail(out, y === 252 ? 9.4 : 7.7, y, 64, frame);
  const mast = [
    [263.1, 2.38],
    [291.3, 2.1],
    [291.7, 1.22],
    [322, 1.12],
    [322.4, 0.7],
    [341, 0.6],
    [341.4, 0.34],
    [351.5, 0.2],
  ];
  loft(
    out,
    'metal',
    mast.map(([y, r]) => radialRing(y, r, r, 48)),
    cream,
  );
  for (const [y, r] of [
    [291.3, 3.4],
    [322, 2.4],
    [341, 1.7],
    [350.5, 1.1],
  ]) {
    annulus(out, 'metal', Math.max(0.15, r - 0.8), r, y, y + 0.24, cream, 48);
    rail(out, r - 0.1, y + 0.24, 24, frame);
  }
  loft(
    out,
    'metal',
    [radialRing(351.5, 0.1, 0.1, 16), radialRing(356.3, 0.06, 0.06, 16)],
    [0.43, 0.43, 0.41],
  );
  for (let y = 263.3; y < 341; y += 0.42)
    beam(
      out,
      'metal',
      [2.42 - (y - 263.3) * 0.022, y, -0.25],
      [2.42 - (y - 263.3) * 0.022, y, 0.25],
      0.035,
      0.035,
      frame,
    );
  for (const z of [-0.25, 0.25])
    beam(out, 'metal', [2.43, 263.3, z], [0.71, 341, z], 0.055, 0.055, frame);
  // Three mapped service pods are retained around the stem on the roof terrace.
  const h = -2.071738355594,
    c = Math.cos(h),
    s = Math.sin(h),
    local = ([east, north]) => [east * c + north * s, east * s - north * c];
  const pods = [
    [
      [5.841, -7.473],
      [9.123, -13.384],
      [7.742, -14.152],
      [6.283, -14.954],
      [2.979, -8.987],
    ],
    [
      [8.858, 3.625],
      [14.627, 5.084],
      [15.002, 3.67],
      [15.444, 1.989],
      [9.543, 0.386],
    ],
    [
      [-8.801, -3.521],
      [-14.602, -6.75],
      [-13.928, -7.952],
      [-13.265, -9.143],
      [-7.464, -5.826],
    ],
  ];
  for (const raw of pods) {
    const p = raw.map(local);
    const signed = p.reduce((sum, a, i) => {
      const b = p[(i + 1) % p.length];
      return sum + a[0] * b[1] - a[1] * b[0];
    }, 0);
    if (signed > 0) p.reverse();
    loft(
      out,
      'concrete',
      [p.map(([x, z]) => [x, 16.05, z]), p.map(([x, z]) => [x, 20.1, z])],
      [0.65, 0.66, 0.62],
    );
  }
}

export const lotusTower = {
  id: 'n0583_lotus_tower',
  planId: 'N0583',
  title: 'Lotus Tower',
  wikidata: 'Q3449463',
  build: buildLotus,
  authoringFile: 'lotus-tower-model.mjs',
  brief:
    'Colombo’s green stem and thirty-two overlapping pink glazed lotus petals, individually modeled mullion grids, white lotus podium fascia, roof terrace, four entrances and antenna mast with service platforms.',
  size: [87, 356.3, 87],
  front: '+Z is the west-northwest mapped podium entrance; four entrances repeat at quarter turns',
  origin: 'Exact-QID circular podium center, ground contact Y=0',
  refs: [
    'https://colombolotustower.lk/',
    'https://colombolotustower.lk/tower',
    'https://www.trc.gov.lk/content/files/reports/AnnualReport2019-E.pdf',
    'https://www.trc.gov.lk/content/files/reports/AR2020_E.pdf',
    'https://kingsview.lk/img/pdf/Profile.pdf',
    'https://www.skyscrapercenter.com/building/id/13823',
    'https://www.openstreetmap.org/way/728831229',
    'https://www.openstreetmap.org/node/13680101733',
  ],
  facts: {
    operatorRoundedHeight: 350,
    architecturalHeightMeters: 351.5,
    tipHeightMeters: 356.3,
    podiumDiameterMeters: 83.1,
    petalCount: 32,
    upperOccupiedFloorElevationsMeters: [229.4, 234.2, 239, 243.8, 248.2],
    podiumFloorElevationsMeters: [0, 5, 10, 16],
    mappedHeadDiameterMeters: 44.4,
  },
  scaleBasis:
    'Operator floor elevations and regulator construction sections set vertical massing; exact-QID mapped podium and nearby tower parts set circular diameters. CVU distinguishes 351.5 m architectural height from 356.3 m tip; the operator’s commonly rounded 350 m is retained as a conflicting rounded description. Regulator and operator photos establish the overlapping lotus petals, two maintenance rings, white leaf fascia and mast platforms.',
  geographicProposal: {
    anchor: [79.85831454, 6.927025933],
    heading: -2.071738355594,
    source: 'https://www.openstreetmap.org/way/728831229',
    evidence:
      'Circular exact-QID podium center plus mapped west-northwest entrance node 13680101733 set the signed native +Z axis. The other three entrance nodes confirm quarter-turn repetition, matching the regulator ground-floor plan. Nearby mapped service pods are transformed into this same native frame.',
    orientationConfidence: 'exact-mapped-center-and-entrance-node',
    limitations:
      'The full-radius podium is a roof overhang; upper petals are reconstructed within the independently mapped 44.4 m head envelope. Petal seam phase follows fourfold entrance symmetry, with small individual panel widths reconstructed from the operator photographs.',
  },
  limits: [
    'Architectural 351.5 m and highest-tip 356.3 m are distinct CVU values; the operator commonly rounds height to 350 m. The model retains explicit floor elevations from the operator rather than uniformly stretching the body.',
    'Petal curvature, individual glazing modules and service-rail spacing are photographic reconstructions. Nighttime programmable LED animations and changing terrace furniture are not baked into the daytime exterior.',
    'The surrounding lakefront promenade, parking and separate service buildings are outside the tower asset.',
  ],
  cameras: [
    { name: 'podium-and-entrance', position: [65, 25, 72], lookAt: [0, 11, 10] },
    { name: 'green-stem-collars', position: [35, 202, 43], lookAt: [0, 198, 0] },
    { name: 'lotus-petals', position: [65, 234, 78], lookAt: [0, 231, 0] },
    { name: 'antenna-platforms', position: [55, 299, 60], lookAt: [0, 299, 0] },
    { name: 'far-silhouette', position: [410, 196, 520], lookAt: [0, 174, 0] },
  ],
};
