/** Luxor's actual glass pyramid, later stepped towers and sculpted eastern Sphinx entrance. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rotatedBuilder,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

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
function clipped(poly, signedDistance) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signedDistance(a),
      db = signedDistance(b);
    if (da >= -1e-8) result.push(a);
    if (da > 0 !== db > 0) result.push(mix(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i) =>
      Math.hypot(...p.map((v, k) => v - result[(i + result.length - 1) % result.length][k])) > 1e-6,
  );
}
function pyramid(out) {
  mappedSolid(out, 'stone', rect(-half, -half, half, half), 0, datum, [0.34, 0.34, 0.32]);
  const span = (y) => (half * (height - y)) / (height - datum);
  for (let side = 0; side < 4; side++) {
    const local = rotatedBuilder(out, (side * Math.PI) / 2);
    const p = (x, y, d = 0) => [x, y, span(y) + d];
    // Panes follow fixed vertical module lines; their outer ends are cut by the pyramid hips.
    const rows = 60,
      pitch = (103.6 - datum) / rows;
    for (let row = 0; row < rows; row++) {
      const a = datum + row * pitch,
        b = a + pitch;
      const n = Math.ceil(span(a) / 1.525);
      for (let k = -n; k < n; k++) {
        const x0 = k * 1.525,
          x1 = (k + 1) * 1.525;
        let polygon = [
          [x0, a],
          [x1, a],
          [x1, b],
          [x0, b],
        ];
        polygon = clipped(polygon, ([x, y]) => span(y) - x);
        polygon = clipped(polygon, ([x, y]) => span(y) + x);
        if (polygon.length < 3) continue;
        const tint = ((Math.abs(k * 19 + row * 7) % 13) - 6) * 0.0008;
        for (let i = 1; i < polygon.length - 1; i++)
          tri(
            local,
            'glass',
            [polygon[0], polygon[i], polygon[i + 1]].map(([x, y]) => p(x, y)),
            bronze.map((v) => v + tint),
          );
      }
      beam(local, 'metal', p(-span(a), a, 0.028), p(span(a), a, 0.028), 0.045, 0.045, black);
    }
    for (let k = -59; k <= 59; k++) {
      const x = k * 1.525,
        y1 = Math.min(103.6, height - (Math.abs(x) * (height - datum)) / half);
      if (y1 - datum > 0.1)
        beam(local, 'metal', p(x, datum, 0.025), p(x, y1, 0.025), 0.036, 0.044, black);
    }
    // Upper lighting chamber is an open square well, with a narrow inclined glazed skirt.
    face(
      local,
      'glass',
      [
        p(-span(103.6), 103.6),
        p(span(103.6), 103.6),
        p(span(105.7), 105.7),
        p(-span(105.7), 105.7),
      ],
      bronze,
    );
    beam(
      local,
      'metal',
      p(-span(105.7), 105.7, 0.04),
      p(span(105.7), 105.7, 0.04),
      0.08,
      0.08,
      [0.4, 0.41, 0.39],
    );
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
  mappedSolid(out, 'recess', rect(-0.78, -0.78, 0.78, 0.78), 104.8, 105.35, black);
  // Physical lamp heads only; an opaque white cone would falsely represent a volumetric night beam.
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      loft(
        out,
        'metal',
        [
          radialRing(105.36, 0.12, 0.12, 12, [x * 0.25, z * 0.25]),
          radialRing(105.6, 0.12, 0.12, 12, [x * 0.25, z * 0.25]),
        ],
        [0.48, 0.48, 0.43],
      );
      mappedCap(
        out,
        'glass',
        clockwise(radialRing(0, 0.105, 0.105, 16, [x * 0.25, z * 0.25]).map((p) => [p[0], p[2]])),
        105.61,
        [0.74, 0.77, 0.7],
      );
    }
  // Four peak edge housings retain the published architectural top without a fake solid beam.
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
  const parts = partsEvidence('n0204_luxor_resort_casino'),
    base = parts.find((p) => p.id === 136520122);
  const plan = partPlan(m, base);
  // The 1998 podium links both stepped wings to the northern pyramid frontage.
  const baseHeight = 7.2;
  mappedSolid(out, 'concrete', plan, 0, baseHeight, pale);
  for (const { len, at } of edges(plan)) {
    grid(
      out,
      [at(0, 0.25, 0.025), at(len, 0.25, 0.025), at(len, 5.8, 0.025), at(0, 5.8, 0.025)],
      [0.17, 0.2, 0.2],
      3.4,
      3.4,
      0.1,
      pale,
    );
    for (let x = 1; x < len; x += 3.4)
      beam(out, 'concrete', at(x, 0.25, 0.16), at(x, baseHeight - 0.1, 0.16), 0.28, 0.4, pale);
    beam(
      out,
      'concrete',
      at(0, baseHeight - 0.05, 0.08),
      at(len, baseHeight - 0.05, 0.08),
      0.3,
      0.35,
      pale,
    );
  }
  const high = parts.filter((p) => p.tags?.['building:part'] && Number(p.tags.height) > 20);
  for (const part of high) {
    const p = partPlan(m, part),
      h = Number(part.tags.height),
      top = h;
    mappedSolid(out, 'glass', p, baseHeight, top, bronze);
    for (const { len, at } of edges(p)) {
      // Fine horizontal hotel courses and pale solid end fascias express the stepped ziggurat wings.
      for (let y = baseHeight + 3.1; y < top - 0.2; y += 3.3)
        beam(out, 'metal', at(0, y, 0.065), at(len, y, 0.065), 0.105, 0.07, [0.17, 0.18, 0.18]);
      for (let t = 0.9; t < len - 0.1; t += 1.6)
        beam(out, 'metal', at(t, baseHeight, 0.055), at(t, top, 0.055), 0.045, 0.05, black);
      beam(out, 'concrete', at(0, top, 0.15), at(len, top, 0.15), 0.45, 0.35, pale);
      // The pale jambs at each exposed wing end continue down to the low casino roof.
      for (const t of [0.2, len - 0.2])
        beam(out, 'concrete', at(t, baseHeight, 0.17), at(t, top, 0.17), 0.48, 0.32, pale);
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
  const ob = {};
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
  for (let y = 17; y < 32.2; y += 0.15) {
    const [rx, rz, cz] = skinProfile(y);
    rings.push(
      Array.from({ length: 96 }, (_, i) => {
        const a = (-i * Math.PI * 2) / 96;
        return [
          rx * Math.cos(a),
          y,
          cz + rz * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / 2.6),
        ];
      }),
    );
  }
  rings.push(radialRing(32.2, 0.3, 0.3, 96, [0, -0.5]));
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
    const eyeRing = Array.from({ length: 64 }, (_, i) => eyePoint((i * Math.PI * 2) / 64, 1));
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 64; i++) {
        const a = (i * Math.PI * 2) / 64,
          b = ((i + 1) * Math.PI * 2) / 64;
        if (j === 0)
          tri(
            ob,
            'concrete',
            [frontPoint(cx, cy, 0.185), eyePoint(a, 1 / 8), eyePoint(b, 1 / 8)],
            [0.79, 0.79, 0.63],
          );
        else
          face(
            ob,
            'concrete',
            [
              eyePoint(a, j / 8),
              eyePoint(a, (j + 1) / 8),
              eyePoint(b, (j + 1) / 8),
              eyePoint(b, j / 8),
            ],
            [0.79, 0.79, 0.63],
          );
      }
    tubePath(ob, 'concrete', [...eyeRing, eyeRing[0]], 0.115, blue);
    const iris = Array.from({ length: 48 }, (_, i) => {
      const a = (i * Math.PI * 2) / 48;
      return frontPoint(cx + 0.31 * Math.cos(a), cy + 0.39 * Math.sin(a), 0.2);
    });
    for (let i = 0; i < 48; i++)
      tri(
        ob,
        'concrete',
        [frontPoint(cx, cy, 0.2), iris[i], iris[(i + 1) % 48]],
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
    const brow = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
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
      Array.from({ length: 18 }, (_, i) => {
        const t = i / 17;
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
    Array.from({ length: 33 }, (_, i) => {
      const x = -1.45 + (2.9 * i) / 32;
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
    return Array.from({ length: 96 }, (_, i) => {
      const a = (-i * Math.PI * 2) / 96;
      return [
        rx * Math.cos(a),
        y,
        cz + rz * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / 2.6),
      ];
    });
  };
  for (let j = 0; j < 36; j++) {
    const lo = crownRing(29.55 + (3.6 * j) / 36),
      hi = crownRing(29.55 + (3.6 * (j + 1)) / 36);
    for (let i = 0; i < 96; i++) {
      const k = (i + 1) % 96,
        front = (lo[i][2] + lo[k][2]) / 2 > -1.15;
      face(
        ob,
        'concrete',
        [lo[i], lo[k], hi[k], hi[i]],
        front ? (Math.floor(i / 4) % 2 ? blue : [0.8, 0.63, 0.24]) : sand,
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
    const steps = 72;
    for (let j = 0; j < steps; j++) {
      const y0 = 10.2 + ((33.05 - 10.2) * j) / steps,
        y1 = 10.2 + ((33.05 - 10.2) * (j + 1)) / steps;
      const point = (y, t, back = false) => {
        const [inner, outer, v] = profileValue(cloth, y);
        return [side * (inner + (outer - inner) * t), y, v - 4.9 * t * t - (back ? 1.2 : 0)];
      };
      for (let i = 0; i < 14; i++) {
        let p = [
          point(y0, i / 14),
          point(y0, (i + 1) / 14),
          point(y1, (i + 1) / 14),
          point(y1, i / 14),
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
        for (let i = 0; i < 14; i++) {
          let p = [
            point(y, i / 14),
            point(y, (i + 1) / 14),
            point(y, (i + 1) / 14, true),
            point(y, i / 14, true),
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
  for (let j = 0; j < 48; j++) {
    const y = 30 + ((33.52 - 30) * j) / 47,
      [w, z] = profileValue(cobra, y);
    cobraRings.push(radialRing(y, w, 0.19, 48, [0, z]));
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
  const sculpt = rotatedBuilder(out, Math.PI / 2, [142, 0, -0.9]);
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
    for (let j = 0; j < 8; j++) {
      const [x, w, b, t] = mix(sections[k - 1], sections[k], j / 8);
      rings.push(
        Array.from({ length: 96 }, (_, i) => {
          const a = (-i * Math.PI * 2) / 96;
          return [x, b + (t - b) * (0.5 + 0.5 * Math.sin(a)), -0.9 + w * Math.cos(a)];
        }),
      );
    }
  const [x, w, b, t] = sections.at(-1);
  rings.push(
    Array.from({ length: 96 }, (_, i) => {
      const a = (-i * Math.PI * 2) / 96;
      return [x, b + (t - b) * (0.5 + 0.5 * Math.sin(a)), -0.9 + w * Math.cos(a)];
    }),
  );
  loft(out, 'concrete', rings, sand);
  // Long forepaws terminate in individually rounded toe pads on the mapped eastern toes.
  for (const side of [-1, 1]) {
    const z = -0.9 + side * 8.25;
    const r = [];
    for (let k = 0; k <= 45; k++) {
      const t = k / 45,
        x = 139 + 37.7 * t,
        wy = 3.45 - 1.55 * t - Math.max(0, t - 0.9) * 4,
        wz = 4.0 + 0.25 * Math.sin(t * Math.PI);
      r.push(
        Array.from({ length: 64 }, (_, i) => {
          const a = (-i * Math.PI * 2) / 64;
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
  const small = rotatedBuilder(out, Math.PI / 2, [157, 0, -0.9]);
  box(small, 'concrete', [-1.1, 0, -0.8], [1.1, 1.1, 1.0], sand);
  loft(
    small,
    'concrete',
    [radialRing(1, 0.85, 0.65, 40), radialRing(4.4, 1.25, 0.75, 40), radialRing(5.4, 0.8, 0.6, 40)],
    sand,
  );
  head(small, 0.22, [0, 1.0, 0]);
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
export function buildLuxor(out, m) {
  pyramid(out);
  northernTowers(out, m);
  sphinx(out);
  obelisk(out);
}
export const luxorStudy = {
  id: 'N0204',
  key: 'luxor_resort_casino',
  title: 'Luxor Resort & Casino',
  wikidataId: 'Q637389',
  height,
  build: buildLuxor,
  smoothSlots: ['wall'],
  brief:
    'The actual black-bronze glazed pyramid with fine pane courses, hip lighting rails and open apex lamp well; separately mapped twin stepped hotel wings; eastern sculpted lion-bodied Sphinx with striped nemes, almond eyes, cobra and beard; and the roadside Luxor obelisk.',
  sourceFacts: {
    architect: 'Veldon Simpson with Klai Juba Architects',
    pyramidHeightMeters: 106.68,
    pyramidFloors: 30,
    modeledGlassBaseMeters: 182.88,
    contractorBaseFeet: 660,
    cornerInclinatorDegrees: 39,
    twinTowerFloors: 22,
    towerOpening: '1998-04',
    sphinxMaker: 'Western Architectural Services',
    sphinxMakerInterviewHeightFeet: 110,
    obeliskMakerInterviewHeightFeet: 140,
  },
  reconstruction: {
    geometry:
      'Current exact mapped pyramid glass perimeter is about183m square; the contractor gives660ft for the structure/base on a mat foundation. These differing extents are not conflated: visible skin follows the mapped183m envelope, consistent with the separately published39-degree diagonal inclinator, while buried foundation is excluded. Published106.7m architectural height supersedes map111m. Separately mapped northern steps set wing footprints; mapped80m crest and22-story operator description set their reconstructed elevation. Operator aerial fixes the low7.2m casino roof and pale corner fascias; coarse20m map podium height is not used as the visible west entry height.',
    sculpture:
      'Original polygonal sculpture reconstructed from the constructor close photograph, contractor aerial and operator map. Body, head, paws, striped headcloth, beard, cosmetic eyes, nose, ears and cobra are modeled volumes. The mapped Sphinx body/head outlines confirm eastward phase and scale; detailed facial contours remain photographic reconstruction.',
  },
  refs: [
    'https://www.tutorperini.com/projects/hospitality-gaming/luxor-las-vegas/',
    'https://www.skyscrapercenter.com/building/luxor-pyramid/13708',
    'https://luxor.mgmresorts.com/en/contact-us.html',
    'https://assets.contentstack.io/v3/assets/bltc6ce635bc4868eb2/blt5733301aa5cc771e/luxor-hotel-property-map.pdf',
    'https://filecache.mediaroom.com/mr5mr_mgmresorts/182111/download/Luxor%20Fact%20Sheet%202026.pdf',
    'https://www.deseret.com/1996/1/3/19218241/array-of-architectural-wonders-helps-statuemaker-gain-stature/',
    'https://www.openstreetmap.org/way/27858544',
    'https://www.openstreetmap.org/way/118344867',
    'https://www.openstreetmap.org/way/118344869',
    'https://www.openstreetmap.org/way/399368723',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X east to Sphinx and Strip obelisk',
    shortAxis: '+Z south; later twin wings lie north',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact-QID pyramid envelope fixes the anchor and almost-cardinal axes. Independently mapped northern tower steps and eastern Sphinx body/head/obelisk agree with operator plan and contractor aerial, resolving the signed phase. GroundY0 at pyramid/entrance datum; the sculpted body retains its transverse passage. Mapped pyramid111m and obelisk62/70m tags are rejected in favor of published106.7m and maker140ft. Fine sculptural and podium offsets remain reconstructed.',
  }),
  limitations: [
    commonLimit,
    'The183m visible pyramid skin and contractor660ft structural base differ; foundations are not modeled. Pane module, tower intermediate elevations, sculpture contours, canopy/door detail and obelisk lettering are reconstruction. Egyptian inscriptions are not fabricated. Pools, garages, neighboring Mandalay/Excalibur, connecting tram infrastructure and interiors are excluded. The apex contains physical lamps; dynamic atmospheric night-beam rendering is not embedded in the static GLB.',
  ],
  camera: { position: [465, 250, 395], lookAt: [55, 41, -35], fov: 44 },
  qaCameras: [
    { name: 'glass-pyramid', position: [-230, 160, 250], lookAt: [0, 43, 0] },
    { name: 'sloping-glass-grid', position: [-18, 36, 96], lookAt: [-15, 33, 62] },
    { name: 'hip-and-apex', position: [24, 119, 26], lookAt: [0, 104, 0] },
    { name: 'stepped-east-wing', position: [185, 103, -195], lookAt: [75, 42, -149] },
    { name: 'twin-north-wings', position: [-110, 139, -365], lookAt: [0, 46, -148] },
    { name: 'sphinx-front', position: [226, 34, 26], lookAt: [145, 19, -1] },
    { name: 'sculpted-face', position: [167, 28, 9], lookAt: [146, 26, -1] },
    { name: 'nemes-and-beard', position: [162, 20, -18], lookAt: [144, 22, -1] },
    { name: 'paws-and-statue', position: [196, 15, 23], lookAt: [162, 5, -1] },
    { name: 'sphinx-passage', position: [122, 7, 43], lookAt: [129, 6, -1] },
    { name: 'pyramid-entry', position: [107, 5, 26], lookAt: [93, 3, -1] },
    { name: 'obelisk', position: [264, 29, 28], lookAt: [224, 24, -1] },
    { name: 'far-resort', position: [655, 315, 530], lookAt: [48, 45, -40] },
  ],
};
