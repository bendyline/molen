import { readFileSync } from 'node:fs';
/** Reviewed Luxor exterior LODs. Original signature-tower-luxor-model remains unchanged. */
import {
  beam,
  loft,
  normalFor,
  sphere as originalSphere,
  radialRing,
} from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rotatedBuilder,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const bronze = [0.095, 0.108, 0.115],
  black = [0.045, 0.053, 0.06],
  pale = [0.7, 0.68, 0.61],
  sand = [0.72, 0.58, 0.35],
  blue = [0.055, 0.21, 0.34];
const half = 91.44,
  height = 106.68,
  datum = 0.4;
const rect = (a, b, c, d) =>
  clockwise([
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function pyramid(out) {
  mappedSolid(out, 'stone', rect(-half, -half, half, half), 0, datum, [0.34, 0.34, 0.32]);
  const span = (y) => (half * (height - y)) / (height - datum),
    d = out.detail;
  for (let side = 0; side < 4; side++) {
    const local = Object.assign(rotatedBuilder(out, (side * Math.PI) / 2), { detail: d }),
      p = (x, y, z = 0) => [x, y, span(y) + z];
    face(
      local,
      'glass',
      [p(-half, datum), p(half, datum), p(span(105.7), 105.7), p(-span(105.7), 105.7)],
      bronze,
    );
    if (!d.skyline) {
      for (let row = 1; row < d.pyramidRows; row++) {
        const y = datum + ((103.6 - datum) * row) / d.pyramidRows;
        face(
          local,
          'metal',
          [
            p(-span(y), y, 0.028),
            p(span(y), y, 0.028),
            p(span(y + 0.045), y + 0.045, 0.028),
            p(-span(y + 0.045), y + 0.045, 0.028),
          ],
          black,
        );
      }
      for (let k = -Math.floor(half / d.pyramidBay); k <= Math.floor(half / d.pyramidBay); k++) {
        const x = k * d.pyramidBay,
          y1 = Math.min(103.6, height - (Math.abs(x) * (height - datum)) / half);
        if (y1 - datum > 0.1)
          face(
            local,
            'metal',
            [
              p(x - 0.018, datum, 0.025),
              p(x + 0.018, datum, 0.025),
              p(x + 0.018, y1, 0.025),
              p(x - 0.018, y1, 0.025),
            ],
            black,
          );
      }
    }
    if (!d.skyline)
      beam(
        local,
        'metal',
        p(-span(105.7), 105.7, 0.04),
        p(span(105.7), 105.7, 0.04),
        0.08,
        0.08,
        [0.4, 0.41, 0.39],
      );
    if (!d.skyline)
      beam(
        local,
        'metal',
        p(-half, datum, 0.02),
        p(-span(105.7), 105.7, 0.02),
        0.095,
        0.1,
        [0.49, 0.49, 0.43],
      );
  }
  mappedSolid(out, 'metal', rect(-0.78, -0.78, 0.78, 0.78), 104.8, 105.35, black);
  if (!d.skyline)
    for (let x = -d.lampHalf; x <= d.lampHalf; x++)
      for (let z = -d.lampHalf; z <= d.lampHalf; z++) {
        loft(
          out,
          'metal',
          [
            radialRing(105.36, 0.12, 0.12, 6, [x * 0.25, z * 0.25]),
            radialRing(105.6, 0.12, 0.12, 6, [x * 0.25, z * 0.25]),
          ],
          [0.48, 0.48, 0.43],
        );
        mappedCap(
          out,
          'glass',
          clockwise(radialRing(0, 0.105, 0.105, 6, [x * 0.25, z * 0.25]).map((p) => [p[0], p[2]])),
          105.61,
          [0.74, 0.77, 0.7],
        );
      }
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      beam(
        out,
        'metal',
        [x * 0.84, 105.7, z * 0.84],
        [x * 0.03, height, z * 0.03],
        0.08,
        0.08,
        [0.43, 0.44, 0.4],
      );
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return {
        len,
        at: (t, y, d = 0) => [
          a[0] + ((b[0] - a[0]) * t) / len - ((b[1] - a[1]) * d) / len,
          y,
          a[1] + ((b[1] - a[1]) * t) / len + ((b[0] - a[0]) * d) / len,
        ],
      };
    })
    .filter((e) => e.len > 0.05);
}
function northernTowers(out, m) {
  const parts = partsEvidence('luxor_resort_casino'),
    base = parts.find((p) => p.id === 136520122),
    plan = out.detail.level === 'skyline' ? coarsePlan(partPlan(m, base)) : partPlan(m, base),
    baseHeight = 7.2,
    d = out.detail;
  mappedSolid(out, 'concrete', plan, 0, baseHeight, pale);
  if (!d.skyline)
    for (const { len, at } of edges(plan)) {
      grid(
        out,
        [at(0, 0.25, 0.025), at(len, 0.25, 0.025), at(len, 5.8, 0.025), at(0, 5.8, 0.025)],
        [0.17, 0.2, 0.2],
        d.towerBay,
        5.55,
        0.1,
        pale,
      );
      for (let x = 1; x < len; x += d.towerBay)
        face(
          out,
          'concrete',
          [
            at(x, 0.25, 0.16),
            at(x + 0.28, 0.25, 0.16),
            at(x + 0.28, baseHeight - 0.1, 0.16),
            at(x, baseHeight - 0.1, 0.16),
          ],
          pale,
        );
    }
  const high = parts.filter((p) => p.tags?.['building:part'] && Number(p.tags.height) > 20);
  for (const part of high) {
    const p = partPlan(m, part),
      top = Number(part.tags.height);
    mappedSolid(out, 'glass', p, baseHeight, top, bronze);
    for (const { len, at } of edges(p)) {
      if (!d.skyline) {
        for (let y = baseHeight + 3.1; y < top - 0.2; y += d.towerCourse)
          face(
            out,
            'metal',
            [
              at(0, y, 0.065),
              at(len, y, 0.065),
              at(len, y + 0.105, 0.065),
              at(0, y + 0.105, 0.065),
            ],
            [0.17, 0.18, 0.18],
          );
        for (let t = 0.9; t < len - 0.1; t += d.towerBay)
          face(
            out,
            'metal',
            [
              at(t, baseHeight, 0.055),
              at(t + 0.045, baseHeight, 0.055),
              at(t + 0.045, top, 0.055),
              at(t, top, 0.055),
            ],
            black,
          );
      }
      if (!d.skyline && d.level !== 'district')
        for (const t of [0.2, len - 0.2])
          face(
            out,
            'concrete',
            [
              at(t - 0.24, baseHeight, 0.17),
              at(t + 0.24, baseHeight, 0.17),
              at(t + 0.24, top, 0.17),
              at(t - 0.24, top, 0.17),
            ],
            pale,
          );
    }
    mappedCap(out, 'concrete', p, top + 0.22, pale);
  }
}
function tubePath(out, slot, pts, r, color) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (Math.hypot(...a.map((v, k) => v - b[k])) > 0.001) beam(out, slot, a, b, r, r, color);
  }
}
function profileValue(profile, y) {
  for (let i = 1; i < profile.length; i++)
    if (y <= profile[i][0])
      return profile[i - 1]
        .slice(1)
        .map(
          (v, k) =>
            v +
            ((profile[i][k + 1] - v) * (y - profile[i - 1][0])) /
              (profile[i][0] - profile[i - 1][0]),
        );
  return profile.at(-1).slice(1);
}
function head(out, scale = 1, offset = [0, 0, 0]) {
  const ob = { detail: out.detail };
  for (const fn of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    ob[fn] = (slot, ref, p, n, uv, c) =>
      out[fn](
        slot,
        ref,
        p.map((p) => p.map((v, k) => offset[k] + v * scale)),
        n,
        uv,
        c,
      );
  const profile = [
    [17, 3.5, 3.3, -0.8],
    [19.2, 3.6, 3.5, -0.5],
    [20.8, 3.75, 3.8, 0.4],
    [22, 4.3, 4.1, 0.25],
    [25.2, 4.8, 4.35, 0],
    [28, 4.65, 4.2, -0.05],
    [30, 4.5, 4, -0.2],
    [31.7, 3.2, 3, -0.5],
    [32.2, 0.3, 0.3, -0.5],
  ];
  const skinProfile = (y) => {
    const k = Math.max(
      1,
      profile.findIndex((p) => p[0] >= y),
    );
    const a = profile[k - 1],
      b = profile[k],
      before = profile[Math.max(0, k - 2)],
      after = profile[Math.min(profile.length - 1, k + 1)];
    const t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))),
      t2 = t * t,
      t3 = t2 * t;
    return a.slice(1).map((v, i) => {
      const m0 = ((b[i + 1] - before[i + 1]) / (b[0] - before[0])) * (b[0] - a[0]);
      const m1 = ((after[i + 1] - a[i + 1]) / (after[0] - a[0])) * (b[0] - a[0]);
      return (
        (2 * t3 - 3 * t2 + 1) * v +
        (t3 - 2 * t2 + t) * m0 +
        (-2 * t3 + 3 * t2) * b[i + 1] +
        (t3 - t2) * m1
      );
    });
  };
  const rings = [];
  for (let y = 17; y < 32.2; y += out.detail.skinPitch) {
    const [rx, rz, cz] = skinProfile(y);
    rings.push(
      Array.from({ length: out.detail.skinSides }, (_, i) => {
        const a = (-i * Math.PI * 2) / out.detail.skinSides;
        return [
          rx * Math.cos(a),
          y,
          cz + rz * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / 2.6),
        ];
      }),
    );
  }
  rings.push(radialRing(32.2, 0.3, 0.3, out.detail.skinSides, [0, -0.5]));
  loft(ob, 'concrete', rings, sand);
  const frontZ = (x, y) => {
    const [rx, rz, cz] = skinProfile(y);
    return cz + rz * Math.pow(Math.max(0, 1 - (x / rx) ** 2), 1 / 2.6);
  };
  const frontPoint = (x, y, d = 0.09) => [x, y, frontZ(x, y) + d];
  // Nose: a continuous narrowing bridge, projecting rounded tip and separate alae/nostril recesses.
  loft(
    ob,
    'concrete',
    [
      [24, 1, 0.68, 4.6],
      [24.5, 1.13, 0.95, 4.9],
      [25.1, 0.83, 1.1, 4.95],
      [27.8, 0.4, 0.43, 4.18],
      [28.5, 0.3, 0.28, 4.03],
    ].map(([y, rx, rz, z]) => radialRing(y, rx, rz, 48, [0, z])),
    sand,
  );
  for (const side of [-1, 1]) {
    sphere(ob, 'concrete', [side * 0.82, 24.65, 4.65], [0.6, 0.4, 0.55], sand, 48, 24);
    sphere(
      ob,
      'recess',
      [side * 0.68, 24.32, 4.97],
      [0.28, 0.09, 0.16],
      [0.25, 0.17, 0.08],
      32,
      12,
    );
    // The painted almond and cosmetic lines conform to the sculpted face, including their outer ends.
    const cx = side * 2.18,
      cy = 27.1;
    const eyePoint = (a, r) => {
      const x = cx + 1.38 * Math.cos(a) * r;
      const y = cy + 0.56 * Math.sin(a) * (1 - 0.18 * side * Math.cos(a)) * r;
      return frontPoint(x, y, 0.075 + 0.11 * (1 - r * r));
    };
    const eyeRing = Array.from({ length: out.detail.eyeSides }, (_, i) =>
      eyePoint((i * Math.PI * 2) / out.detail.eyeSides, 1),
    );
    for (let j = 0; j < out.detail.eyeRings; j++)
      for (let i = 0; i < out.detail.eyeSides; i++) {
        const a = (i * Math.PI * 2) / out.detail.eyeSides,
          b = ((i + 1) * Math.PI * 2) / out.detail.eyeSides;
        if (j === 0)
          tri(
            ob,
            'concrete',
            [
              frontPoint(cx, cy, 0.185),
              eyePoint(a, 1 / out.detail.eyeRings),
              eyePoint(b, 1 / out.detail.eyeRings),
            ],
            [0.79, 0.79, 0.63],
          );
        else
          face(
            ob,
            'concrete',
            [
              eyePoint(a, j / out.detail.eyeRings),
              eyePoint(a, (j + 1) / out.detail.eyeRings),
              eyePoint(b, (j + 1) / out.detail.eyeRings),
              eyePoint(b, j / out.detail.eyeRings),
            ],
            [0.79, 0.79, 0.63],
          );
      }
    tubePath(ob, 'concrete', [...eyeRing, eyeRing[0]], 0.115, blue);
    const iris = Array.from({ length: out.detail.irisSides }, (_, i) => {
      const a = (i * Math.PI * 2) / out.detail.irisSides;
      return frontPoint(cx + 0.31 * Math.cos(a), cy + 0.39 * Math.sin(a), 0.2);
    });
    for (let i = 0; i < out.detail.irisSides; i++)
      tri(
        ob,
        'concrete',
        [frontPoint(cx, cy, 0.2), iris[i], iris[(i + 1) % out.detail.irisSides]],
        [0.045, 0.12, 0.16],
      );
    sphere(
      ob,
      'concrete',
      frontPoint(cx, cy, 0.22),
      [0.14, 0.2, 0.018],
      [0.016, 0.022, 0.022],
      32,
      16,
    );
    const brow = Array.from({ length: out.detail.pathSteps }, (_, i) => {
      const t = i / (out.detail.pathSteps - 1);
      return frontPoint(
        side * (0.6 + 3.6 * t),
        28.1 + 0.42 * Math.sin(t * Math.PI) - 0.18 * t,
        0.11,
      );
    });
    tubePath(ob, 'concrete', brow, 0.24, blue);
    tubePath(
      ob,
      'concrete',
      Array.from({ length: out.detail.pathSteps }, (_, i) => {
        const t = i / (out.detail.pathSteps - 1);
        return frontPoint(side * (3.48 + 0.95 * t), 27.0 - 0.26 * t, 0.09);
      }),
      0.13,
      blue,
    );
    // Ear shell and concha remain sculpted separate forms behind the eye plane.
    sphere(ob, 'concrete', [side * 4.7, 26.2, 0.6], [0.65, 1.65, 1.0], sand, 64, 32);
    sphere(ob, 'concrete', [side * 5.05, 26.3, 1.09], [0.15, 1.04, 0.49], [0.53, 0.4, 0.2], 48, 24);
  }
  sphere(ob, 'concrete', [0, 22.7, 4.12], [1.65, 0.29, 0.35], [0.72, 0.54, 0.3], 64, 24);
  sphere(ob, 'concrete', [0, 22.23, 4.09], [1.45, 0.27, 0.34], sand, 64, 24);
  tubePath(
    ob,
    'recess',
    Array.from({ length: out.detail.pathSteps }, (_, i) => {
      const x = -1.45 + (2.9 * i) / (out.detail.pathSteps - 1);
      return [x, 22.51 + 0.055 * Math.cos(x * 2), 4.43 - 0.2 * (x / 1.45) ** 2];
    }),
    0.055,
    [0.4, 0.29, 0.15],
  );
  // Closed striped crown: the maker's photo shows cloth continuing over the forehead,
  // rather than separate side curtains framing an exposed scalp.
  const crownProfile = [
    [29.55, 4.83, 4.4, -0.4],
    [30.5, 4.9, 4.6, -0.55],
    [31.5, 4.55, 4.45, -0.8],
    [32.45, 3.65, 3.6, -1.1],
    [33.05, 2.0, 2.1, -1.2],
    [33.15, 0.15, 0.2, -1.2],
  ];
  const crownRing = (y) => {
    const [rx, rz, cz] = profileValue(crownProfile, y);
    return Array.from({ length: out.detail.skinSides }, (_, i) => {
      const a = (-i * Math.PI * 2) / out.detail.skinSides;
      return [
        rx * Math.cos(a),
        y,
        cz + rz * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / 2.6),
      ];
    });
  };
  for (let j = 0; j < out.detail.crownRows; j++) {
    const lo = crownRing(29.55 + (3.6 * j) / out.detail.crownRows),
      hi = crownRing(29.55 + (3.6 * (j + 1)) / out.detail.crownRows);
    for (let i = 0; i < out.detail.skinSides; i++) {
      const k = (i + 1) % out.detail.skinSides,
        front = (lo[i][2] + lo[k][2]) / 2 > -1.15;
      face(
        ob,
        'concrete',
        [lo[i], lo[k], hi[k], hi[i]],
        front ? (Math.floor((i * 24) / out.detail.skinSides) % 2 ? blue : [0.8, 0.63, 0.24]) : sand,
      );
    }
  }
  mappedCap(
    ob,
    'concrete',
    crownRing(33.15).map((p) => [p[0], p[2]]),
    33.15,
    sand,
  );
  // Nemes side cloth: bands follow a curved sculpted sheet and turn around its thick outer edge.
  const cloth = [
    [10.2, 4.2, 6.0, 2.0],
    [16, 3.7, 9.8, 2.6],
    [18.6, 2.95, 11.6, 2.5],
    [21, 3.2, 10.8, 2],
    [25, 5.05, 9.1, 1.4],
    [28.9, 4.75, 7.5, 0.6],
    [31.8, 3.1, 5.8, -0.4],
    [33.05, 0.05, 2.2, -1.15],
  ];
  for (const side of [-1, 1]) {
    const steps = out.detail.clothRows;
    for (let j = 0; j < steps; j++) {
      const y0 = 10.2 + ((33.05 - 10.2) * j) / steps,
        y1 = 10.2 + ((33.05 - 10.2) * (j + 1)) / steps;
      const point = (y, t, back = false) => {
        const [inner, outer, v] = profileValue(cloth, y);
        return [side * (inner + (outer - inner) * t), y, v - 4.9 * t * t - (back ? 1.2 : 0)];
      };
      for (let i = 0; i < out.detail.clothColumns; i++) {
        let p = [
          point(y0, i / out.detail.clothColumns),
          point(y0, (i + 1) / out.detail.clothColumns),
          point(y1, (i + 1) / out.detail.clothColumns),
          point(y1, i / out.detail.clothColumns),
        ];
        if (side < 0) p = p.toReversed();
        face(ob, 'concrete', p, Math.floor((y0 - 10.2) / 0.62) % 2 ? blue : [0.8, 0.63, 0.24]);
        const back = p.map((p) => [p[0], p[1], p[2] - 1.2]).toReversed();
        face(ob, 'concrete', back, sand);
      }
      for (const t of [0, 1]) {
        let p = [point(y0, t), point(y1, t), point(y1, t, true), point(y0, t, true)];
        if (side > 0 === (t === 0)) p = p.toReversed();
        face(ob, 'concrete', p, sand);
      }
      if (j === 0 || j === steps - 1) {
        const y = j === 0 ? y0 : y1;
        for (let i = 0; i < out.detail.clothColumns; i++) {
          let p = [
            point(y, i / out.detail.clothColumns),
            point(y, (i + 1) / out.detail.clothColumns),
            point(y, (i + 1) / out.detail.clothColumns, true),
            point(y, i / out.detail.clothColumns, true),
          ];
          const ny =
            (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]);
          if (ny > 0 !== (j !== 0)) p = p.toReversed();
          face(ob, 'concrete', p, sand);
        }
      }
    }
  }
  // Central striped beard and raised cobra crest, reconstructed from the maker's public photograph.
  const beardRing = (y) => {
    const w = 1.05 + (y - 14.1) * 0.04;
    return [
      [-w, y, 3.45],
      [0, y - 0.25, 3.95],
      [w, y, 3.45],
      [w, y, 2.85],
      [-w, y, 2.85],
    ];
  };
  for (let j = 0; j < 12; j++) {
    const lo = beardRing(14.1 + j * 0.59),
      hi = beardRing(14.1 + (j + 1) * 0.59);
    for (let i = 0; i < 5; i++) {
      const k = (i + 1) % 5;
      face(ob, 'concrete', [lo[i], lo[k], hi[k], hi[i]], j % 2 ? blue : [0.76, 0.59, 0.22]);
    }
  }
  // End caps are planar fans using the front chevron, so there are no open strips between bands.
  for (const y of [14.1, 14.1 + 12 * 0.59]) {
    const pts = beardRing(y),
      center = [0, y - 0.1, 3.2];
    for (let i = 0; i < 5; i++) {
      let p = [center, pts[i], pts[(i + 1) % 5]];
      if (y === 14.1) p = p.toReversed();
      tri(ob, 'concrete', p, sand);
    }
  }
  const cobra = [
    [30.0, 0.23, 4.32],
    [30.7, 0.35, 4.48],
    [31.4, 0.66, 4.32],
    [32.2, 0.73, 3.85],
    [32.85, 0.6, 3.05],
    [33.35, 0.38, 2.85],
    [33.52, 0.33, 3.08],
  ];
  const cobraRings = [];
  for (let j = 0; j < out.detail.cobraRows; j++) {
    const y = 30 + ((33.52 - 30) * j) / (out.detail.cobraRows - 1),
      [w, z] = profileValue(cobra, y);
    cobraRings.push(radialRing(y, w, 0.19, out.detail.irisSides, [0, z]));
  }
  loft(ob, 'concrete', cobraRings, [0.8, 0.63, 0.24]);
  for (let j = 0; j < 14; j++) {
    const y = 30.5 + j * 0.17,
      [w, z] = profileValue(cobra, y);
    tubePath(
      ob,
      'concrete',
      [
        [-w * 0.65, y, z + 0.2],
        [0, y - 0.08, z + 0.215],
        [w * 0.65, y, z + 0.2],
      ],
      0.024,
      [0.51, 0.37, 0.12],
    );
  }
}
function sphinx(out) {
  // The mapped head center is X142m. Local sculpture +Z faces east after this transform.
  const sculpt = Object.assign(rotatedBuilder(out, Math.PI / 2, [142, 0, -0.9]), {
    detail: out.detail,
  });
  const sections = [
    [99.7, 1.5, 0.2, 5.5],
    [101.5, 10, 0.1, 10.5],
    [106, 13.4, 0.1, 14],
    [115, 13.7, 0.1, 16],
    [121, 13.2, 0.1, 17.5],
    [125, 12, 7.7, 18],
    [129, 11.1, 8.3, 18.8],
    [132, 11.1, 7.7, 19.3],
    [136, 12.8, 0.1, 19.4],
    [145, 12.6, 0.1, 17.2],
    [151, 10.3, 0.1, 10.5],
    [154, 4.6, 0.1, 6.5],
  ];
  const rings = [];
  for (let k = 1; k < sections.length; k++)
    for (let j = 0; j < out.detail.bodySteps; j++) {
      const [x, w, b, t] = mix(sections[k - 1], sections[k], j / out.detail.bodySteps);
      rings.push(
        Array.from({ length: out.detail.bodySides }, (_, i) => {
          const a = (-i * Math.PI * 2) / out.detail.bodySides;
          return [x, b + (t - b) * (0.5 + 0.5 * Math.sin(a)), -0.9 + w * Math.cos(a)];
        }),
      );
    }
  const [x, w, b, t] = sections.at(-1);
  rings.push(
    Array.from({ length: out.detail.bodySides }, (_, i) => {
      const a = (-i * Math.PI * 2) / out.detail.bodySides;
      return [x, b + (t - b) * (0.5 + 0.5 * Math.sin(a)), -0.9 + w * Math.cos(a)];
    }),
  );
  loft(out, 'concrete', rings, sand);
  // Long forepaws terminate in individually rounded toe pads on the mapped eastern toes.
  for (const side of [-1, 1]) {
    const z = -0.9 + side * 8.25;
    const r = [];
    for (let k = 0; k <= out.detail.pawSteps; k++) {
      const t = k / out.detail.pawSteps,
        x = 139 + 37.7 * t,
        wy = 3.45 - 1.55 * t - Math.max(0, t - 0.9) * 4,
        wz = 4.0 + 0.25 * Math.sin(t * Math.PI);
      r.push(
        Array.from({ length: out.detail.pawSides }, (_, i) => {
          const a = (-i * Math.PI * 2) / out.detail.pawSides;
          return [x, 0.2 + wy + wy * Math.sin(a), z + wz * Math.cos(a)];
        }),
      );
    }
    loft(out, 'concrete', r, sand);
    for (let j = 0; j < 4; j++)
      sphere(out, 'concrete', [176.3, 1.9, z - 3 + j * 2], [2.05, 1.7, 0.98], sand, 48, 24);
    for (let j = 1; j < 4; j++)
      tubePath(
        out,
        'recess',
        [
          [174, 2.55, z - 4 + j * 2],
          [176.5, 2.5, z - 4 + j * 2],
          [177.5, 1.65, z - 4 + j * 2],
        ],
        0.06,
        [0.49, 0.36, 0.19],
      );
  }
  head(sculpt);
  // Narrow statue between forepaws is part of the actual Egyptian entry composition.
  const small = Object.assign(rotatedBuilder(out, Math.PI / 2, [157, 0, -0.9]), {
    detail: out.detail,
  });
  box(small, 'concrete', [-1.1, 0, -0.8], [1.1, 1.1, 1.0], sand);
  loft(
    small,
    'concrete',
    [radialRing(1, 0.85, 0.65, 40), radialRing(4.4, 1.25, 0.75, 40), radialRing(5.4, 0.8, 0.6, 40)],
    sand,
  );
  if (out.detail.level === 'closeup') head(small, 0.22, [0, 1, 0]);
  else
    loft(small, 'concrete', [radialRing(4.7, 0.9, 0.65, 8), radialRing(8.3, 0.45, 0.4, 8)], sand);
  // Entry canopy reaches the pyramid; its side slots remain open as in the mapped roof outline.
  mappedSolid(out, 'concrete', rect(86.2, -17.7, 99, 16.5), 6.3, 7.0, pale);
  for (const z of [-15.5, 13.8])
    for (const x of [91.8, 98])
      box(out, 'concrete', [x - 0.25, 0, z - 0.25], [x + 0.25, 6.3, z + 0.25], pale);
  grid(
    out,
    [
      [91.8, 0.1, 14.6],
      [91.8, 0.1, -15.8],
      [91.8, 5.95, -15.8],
      [91.8, 5.95, 14.6],
    ],
    [0.14, 0.19, 0.18],
    2.6,
    3,
    0.09,
    black,
  );
}
function obelisk(out) {
  const center = [223.7, -1.45];
  const ring = (y, w) =>
    rect(center[0] - w, center[1] - w, center[0] + w, center[1] + w).map(([x, z]) => [x, y, z]);
  loft(out, 'concrete', [ring(0, 5.25), ring(2.5, 5.25), ring(3.2, 4.6), ring(38, 2.8)], sand);
  const base = ring(38, 2.8),
    tip = [center[0], 42.67, center[1]];
  for (let i = 0; i < 4; i++)
    tri(out, 'concrete', [base[i], base[(i + 1) % 4], tip], [0.77, 0.62, 0.39]);
  // Original line glyphs spell the actual vertical LUXOR sign; no invented hieroglyphic text.
  const glyphs = {
    L: [
      [
        [0, 1],
        [0, 0],
        [0.65, 0],
      ],
    ],
    U: [
      [
        [0, 1],
        [0, 0.2],
        [0.15, 0],
        [0.5, 0],
        [0.65, 0.2],
        [0.65, 1],
      ],
    ],
    X: [
      [
        [0, 0],
        [0.65, 1],
      ],
      [
        [0, 1],
        [0.65, 0],
      ],
    ],
    O: [
      [
        [0.15, 0],
        [0, 0.2],
        [0, 0.8],
        [0.15, 1],
        [0.5, 1],
        [0.65, 0.8],
        [0.65, 0.2],
        [0.5, 0],
        [0.15, 0],
      ],
    ],
    R: [
      [
        [0, 0],
        [0, 1],
        [0.5, 1],
        [0.65, 0.8],
        [0.5, 0.55],
        [0, 0.55],
      ],
      [
        [0.3, 0.55],
        [0.7, 0],
      ],
    ],
  };
  if (!out.detail.skyline)
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++)
        for (const line of glyphs['LUXOR'[j]])
          for (let k = 1; k < line.length; k++) {
            const p = (q) => {
              const y = 30.3 - j * 4.4 + q[1] * 3.3,
                w = 4.6 + ((2.8 - 4.6) * (y - 3.2)) / (38 - 3.2);
              return [center[0] + side * (w + 0.07), y, center[1] - side * (q[0] - 0.35) * 3.6];
            };
            beam(out, 'metal', p(line[k - 1]), p(line[k]), 0.24, 0.15, [0.78, 0.72, 0.5]);
          }
}
function detailed(out, m) {
  pyramid(out);
  northernTowers(out, m);
  if (['skyline', 'district'].includes(out.detail.level)) farSphinx(out);
  else sphinx(out);
  obelisk(out);
}

function sphere(out, slot, center, radii, color) {
  originalSphere(out, slot, center, radii, color, out.detail.sphereSides, out.detail.sphereRows);
}
function grid(out, p, color, dx, dy, frame, frameColor) {
  face(out, 'glass', p, color);
  if (out.detail.skyline) return;
  const n = normalFor(p[0], p[1], p[2]),
    w = Math.hypot(...p[1].map((v, i) => v - p[0][i])),
    h = Math.hypot(...p[3].map((v, i) => v - p[0][i])),
    at = (u, v) => p[0].map((q, i) => q + (p[1][i] - q) * u + (p[3][i] - q) * v + n[i] * 0.025),
    nx = Math.max(1, Math.round(w / Math.max(dx, out.detail.towerBay))),
    ny = Math.max(1, Math.round(h / dy));
  for (let k = 0; k <= nx; k++) {
    const a = Math.max(0, k / nx - frame / w / 2),
      b = Math.min(1, k / nx + frame / w / 2);
    face(out, 'metal', [at(a, 0), at(b, 0), at(b, 1), at(a, 1)], frameColor);
  }
  for (let k = 0; k <= ny; k++) {
    const a = Math.max(0, k / ny - frame / h / 2),
      b = Math.min(1, k / ny + frame / h / 2);
    face(out, 'metal', [at(0, a), at(1, a), at(1, b), at(0, b)], frameColor);
  }
}
const settings = {
  skyline: {
    skyline: true,
    skinPitch: 4,
    skinSides: 8,
    crownRows: 3,
    clothRows: 4,
    clothColumns: 1,
    eyeRings: 1,
    eyeSides: 8,
    irisSides: 6,
    pathSteps: 3,
    cobraRows: 3,
    bodySteps: 1,
    bodySides: 4,
    pawSteps: 3,
    pawSides: 4,
    sphereSides: 4,
    sphereRows: 2,
  },
  district: {
    pyramidRows: 4,
    pyramidBay: 30,
    lampHalf: 0,
    towerCourse: 20,
    towerBay: 24,
    skinPitch: 2,
    skinSides: 12,
    crownRows: 4,
    clothRows: 12,
    clothColumns: 2,
    eyeRings: 1,
    eyeSides: 8,
    irisSides: 6,
    pathSteps: 4,
    cobraRows: 3,
    bodySteps: 1,
    bodySides: 8,
    pawSteps: 5,
    pawSides: 8,
    sphereSides: 6,
    sphereRows: 3,
  },
  street: {
    pyramidRows: 20,
    pyramidBay: 9.15,
    lampHalf: 1,
    towerCourse: 6.6,
    towerBay: 6.4,
    skinPitch: 1,
    skinSides: 20,
    crownRows: 8,
    clothRows: 24,
    clothColumns: 4,
    eyeRings: 2,
    eyeSides: 12,
    irisSides: 8,
    pathSteps: 8,
    cobraRows: 8,
    bodySteps: 2,
    bodySides: 16,
    pawSteps: 9,
    pawSides: 12,
    sphereSides: 12,
    sphereRows: 6,
  },
  closeup: {
    pyramidRows: 60,
    pyramidBay: 4.575,
    lampHalf: 2,
    towerCourse: 3.3,
    towerBay: 3.2,
    skinPitch: 0.45,
    skinSides: 32,
    crownRows: 12,
    clothRows: 36,
    clothColumns: 6,
    eyeRings: 3,
    eyeSides: 24,
    irisSides: 16,
    pathSteps: 12,
    cobraRows: 12,
    bodySteps: 2,
    bodySides: 32,
    pawSteps: 15,
    pawSides: 20,
    sphereSides: 20,
    sphereRows: 10,
  },
};
function build(out, m, name) {
  const detail = { ...settings[name], level: name },
    means = {
      concrete: [0.710816, 0.710816, 0.681928],
      metal: [0.908889, 0.908889, 0.908889],
      stone: [0.701109, 0.701109, 0.701109],
    },
    t = {
      detail,
      ...Object.fromEntries(
        ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
          k,
          (slot, r, p, n, uv, c) => {
            slot = slot === 'recess' ? 'metal' : slot;
            return name === 'skyline'
              ? out[k](
                  'silhouette',
                  'palette:#ffffff',
                  p,
                  n,
                  uv,
                  means[slot] ? c.map((v, i) => v * means[slot][i]) : c,
                )
              : out[k](slot, r, p, n, uv, c);
          },
        ]),
      ),
    };
  detailed(
    t,
    m ?? JSON.parse(readFileSync(structureSourcePath('luxor_resort_casino', 'map-frame.json'))),
  );
}
export const buildLuxorReviewedMaster = (out, m) => build(out, m, 'closeup');
export const buildLuxorSkyline = (out, m) => build(out, m, 'skyline');
export const buildLuxorDistrict = (out, m) => build(out, m, 'district');
export const buildLuxorStreet = (out, m) => build(out, m, 'street');
export const buildLuxorCloseup = (out, m) => build(out, m, 'closeup');

/** Coarse exterior massing keeps the open transverse passage and two forepaws. */
function farSphinx(out) {
  const d = out.detail,
    n = d.level === 'skyline' ? 4 : 8;
  const sections = [
    [99.7, 1.5, 0.2, 5.5],
    [101.5, 10, 0.1, 10.5],
    [106, 13.4, 0.1, 14],
    [115, 13.7, 0.1, 16],
    [121, 13.2, 0.1, 17.5],
    [125, 12, 7.7, 18],
    [129, 11.1, 8.3, 18.8],
    [132, 11.1, 7.7, 19.3],
    [136, 12.8, 0.1, 19.4],
    [145, 12.6, 0.1, 17.2],
    [151, 10.3, 0.1, 10.5],
    [154, 4.6, 0.1, 6.5],
  ];
  loft(
    out,
    'concrete',
    sections.map(([x, w, b, t]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i * Math.PI * 2) / n;
        return [x, b + (t - b) * (0.5 + 0.5 * Math.sin(a)), -0.9 + w * Math.cos(a)];
      }),
    ),
    sand,
  );
  for (const side of [-1, 1]) {
    const z = -0.9 + side * 8.25;
    box(out, 'concrete', [139, 0.2, z - 4], [178.35, 6.8, z + 4], sand);
  }
  const local = Object.assign(rotatedBuilder(out, Math.PI / 2, [142, 0, -0.9]), { detail: d }),
    hn = d.level === 'skyline' ? 8 : 12;
  loft(
    local,
    'concrete',
    [
      [17, 3.5, 3.3, -0.8],
      [26, 4.8, 4.35, 0],
      [31.7, 3.2, 3, -0.5],
      [33.52, 0.33, 0.3, -0.5],
    ].map(([y, rx, rz, z]) => radialRing(y, rx, rz, hn, [0, z])),
    sand,
  );
  // Closed flared headcloth sides preserve the characteristic outline without tiny painted bands.
  const cloth = [
    [10.2, 4.2, 6, 2],
    [18.6, 2.95, 11.6, 2.5],
    [25, 5.05, 9.1, 1.4],
    [33.05, 0.05, 2.2, -1.15],
  ];
  for (const side of [-1, 1]) {
    const ring = ([y, inner, outer, z]) => [
      [side * inner, y, z],
      [side * outer, y, z - 4.9],
      [side * outer, y, z - 6.1],
      [side * inner, y, z - 1.2],
    ];
    loft(
      local,
      'concrete',
      cloth.map((v) => {
        const p = ring(v);
        return side < 0 ? p.toReversed() : p;
      }),
      sand,
    );
  }
  box(local, 'concrete', [-1.4, 14.1, 2.85], [1.4, 21.18, 3.95], blue);
  // Canopy and two coarse supports remain attached to the pyramid entrance.
  mappedSolid(out, 'concrete', rect(86.2, -17.7, 99, 16.5), 6.3, 7, pale);
  for (const z of [-15.5, 13.8])
    box(out, 'concrete', [97.75, 0, z - 0.25], [98.25, 6.3, z + 0.25], pale);
  box(out, 'concrete', [155.9, 0, -2], [158.1, 8.4, 0.1], sand);
  if (d.level === 'district') {
    for (const side of [-1, 1]) {
      const p = (x, y) => [x, y, 4.43],
        lo = Math.min(side * 1, side * 3.4),
        hi = Math.max(side * 1, side * 3.4);
      face(local, 'concrete', [p(lo, 26.65), p(hi, 26.65), p(hi, 27.6), p(lo, 27.6)], blue);
    }
    loft(
      local,
      'concrete',
      [
        radialRing(24, 1, 0.7, 8, [0, 4.6]),
        radialRing(25.1, 0.83, 1.1, 8, [0, 4.95]),
        radialRing(28.5, 0.3, 0.28, 8, [0, 4.03]),
      ],
      sand,
    );
  }
}

function coarsePlan(p) {
  const q = p.map((v) => [...v]);
  let change = true;
  while (change && q.length > 8) {
    change = false;
    for (let i = 0; i < q.length; i++) {
      const a = q[(i + q.length - 1) % q.length],
        b = q[i],
        c = q[(i + 1) % q.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz),
        t = len ? ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (len * len) : 0;
      if (t >= 0 && t <= 1 && Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 1) {
        q.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return clockwise(q);
}
