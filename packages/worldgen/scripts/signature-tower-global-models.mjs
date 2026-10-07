/** Independently researched exterior reconstructions N0164–N0175, meters, +Y up. */
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  axes,
  bandPlan,
  commonLimit,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const metal = [0.63, 0.68, 0.7],
  glass = [0.23, 0.31, 0.35];
const part = (key, id) => {
  const p = partsEvidence(key).find((p) => p.id === id);
  if (!p) throw Error(`Missing mapped part ${id}`);
  return p;
};
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function insidePlan([x, z], plan) {
  let inside = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
function curtain(
  out,
  plan,
  y0,
  y1,
  { dx = 1.5, dy = 3.6, tint = glass, frame = 0.08, trim = metal, slot = 'metal' } = {},
) {
  for (const { a, b } of edges(plan))
    grid(
      out,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      tint,
      dx,
      dy,
      frame,
      trim,
      slot,
    );
}
function planter(out, x, y, z) {
  box(out, 'stone', [x - 1, y, z - 1], [x + 1, y + 0.55, z + 1], [0.59, 0.59, 0.53]);
  tube(out, 'metal', [x, y + 0.5, z], [x, y + 3.8, z], 0.11, [0.22, 0.21, 0.16], 8);
  loft(
    out,
    'recess',
    [
      [y + 1.3, 1.25],
      [y + 3.2, 1.45],
      [y + 4.3, 0.1],
    ].map(([h, r]) => radialRing(h, r, r, 9, [x, z])),
    [0.22, 0.36, 0.16],
  );
}

function buildMesseturm(out, m) {
  const key = 'n0170_messeturm',
    granite = [0.52, 0.335, 0.285],
    dark = [0.2, 0.29, 0.3],
    trim = [0.55, 0.56, 0.53];
  const base = cleanPlan(partPlan(m, part(key, 930215227))),
    lobby = cleanPlan(partPlan(m, part(key, 927655685)));
  mappedSolid(out, 'stone', base, 0, 0.25, granite);
  curtain(out, lobby, 0.25, 17, {
    dx: 2.3,
    dy: 5.55,
    tint: [0.31, 0.44, 0.46],
    frame: 0.045,
    trim,
  });
  mappedCap(out, 'glass', lobby, 17, [0.28, 0.36, 0.37]);
  // Four substantial corner piers expose the new curved glazed lobby on each face.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      box(
        out,
        'cladding',
        [Math.min(sx * 14, sx * 20.6), 0, Math.min(sz * 14, sz * 20.6)],
        [Math.max(sx * 14, sx * 20.6), 17, Math.max(sz * 14, sz * 20.6)],
        granite,
      );
    }
  curtain(out, base, 17, 30, {
    dx: 3.5,
    dy: 3.25,
    tint: dark,
    frame: 0.36,
    trim: granite,
    slot: 'cladding',
  });
  mappedCap(out, 'cladding', base, 30, granite);
  const cylinder = cleanPlan(partPlan(m, part(key, 183063659)), 0.025);
  curtain(out, cylinder, 30, 210, { dx: 1.8, dy: 3.6, tint: dark, frame: 0.085, trim });
  mappedCap(out, 'metal', cylinder, 210, trim);
  // The signed OSM cross-shaped steles recede separately at188,194 and200 m.
  for (const [id, lo, hi] of [
    [927655688, 30, 188],
    [927655687, 188, 194],
    [927655686, 194, 200],
  ]) {
    const p = cleanPlan(partPlan(m, part(key, id)), 0.025);
    curtain(out, p, lo, hi, {
      dx: 3.5,
      dy: 3.3,
      tint: dark,
      frame: 0.4,
      trim: granite,
      slot: 'cladding',
    });
    mappedCap(out, 'cladding', p, hi, granite);
    bandPlan(out, p, hi, 0.16, 0.17, granite, 'cladding');
  }
  const upper = cleanPlan(partPlan(m, part(key, 183063661)), 0.03);
  curtain(out, upper, 210, 220, { dx: 1.65, dy: 3.3, tint: [0.24, 0.33, 0.34], frame: 0.11, trim });
  mappedCap(out, 'metal', upper, 220, trim);
  const diamond = partPlan(m, part(key, 183063660));
  const center = diamond.reduce(
    (s, p) => [s[0] + p[0] / diamond.length, s[1] + p[1] / diamond.length],
    [0, 0],
  );
  const scaled = (s) =>
    diamond.map((p) => [center[0] + (p[0] - center[0]) * s, center[1] + (p[1] - center[1]) * s]);
  // Three sloping roof stages, separated by narrow recessed glazed belts.
  const roofs = [
    [220, 232, 0.995, 0.68],
    [233.1, 244.1, 0.65, 0.345],
    [245.2, 256.5, 0.32, 0.002],
  ];
  for (const [lo, hi, s0, s1] of roofs) {
    const a = scaled(s0),
      b = scaled(s1);
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length,
        q = [
          [a[i][0], lo, a[i][1]],
          [a[k][0], lo, a[k][1]],
          [b[k][0], hi, b[k][1]],
          [b[i][0], hi, b[i][1]],
        ];
      face(out, 'metal', q, [0.18, 0.225, 0.24]);
      const count = Math.ceil(Math.hypot(a[k][0] - a[i][0], a[k][1] - a[i][1]) / 0.62);
      for (let j = 0; j <= count; j++)
        beam(
          out,
          'metal',
          lerp(q[0], q[1], j / count),
          lerp(q[3], q[2], j / count),
          0.055,
          0.075,
          [0.44, 0.5, 0.5],
        );
    }
    mappedCap(out, 'metal', b, hi, metal);
    bandPlan(out, a, lo, 0.22, 0.18, [0.54, 0.56, 0.5], 'metal');
    if (hi < 256) {
      const next = scaled(s1 * 0.955);
      curtain(out, next, hi, hi + 1.1, {
        dx: 1.2,
        dy: 1.2,
        tint: [0.21, 0.29, 0.29],
        frame: 0.055,
        trim,
      });
      mappedCap(out, 'metal', next, hi + 1.1, metal);
    }
  }
  // Four signed pointed glass bays continue the facade centerlines up the steles.
  for (let a = 0; a < 4; a++) {
    const theta = (a * Math.PI) / 2,
      c = Math.cos(theta),
      s = Math.sin(theta),
      P = (x, y, z) => [x * c - z * s, y, x * s + z * c];
    for (let y = 17; y < 30; y += 3.25)
      for (const sign of [-1, 1]) {
        const q = [
          P(sign * 2.15, y, 20.6),
          P(0, y, 22.7),
          P(0, Math.min(30, y + 3.25), 22.7),
          P(sign * 2.15, Math.min(30, y + 3.25), 20.6),
        ];
        if (sign < 0) q.reverse();
        panel(out, q, [0.27, 0.36, 0.36], 0.06, trim);
      }
  }
}

function buildAon(out, m) {
  const key = 'n0172_aon_center',
    plan = cleanPlan(localOutline(m), 0.14),
    white = [0.85, 0.86, 0.83],
    shadowGlass = [0.095, 0.15, 0.18];
  mappedSolid(out, 'stone', plan, 0, 0.22, white);
  curtain(out, plan, 0.22, 10.4, {
    dx: 2.5,
    dy: 5.1,
    tint: [0.16, 0.24, 0.26],
    frame: 0.07,
    trim: [0.55, 0.58, 0.56],
  });
  const floors = 80,
    lo = 10.4,
    hi = 340;
  for (const { a, b, len, n } of edges(plan)) {
    const count = len > 35 ? 15 : Math.max(1, Math.round(len / 3));
    for (let i = 0; i < count; i++) {
      const pitch = len / count,
        halfPier = Math.min(0.69, pitch * 0.3),
        u0 = (i + halfPier / pitch) / count,
        u1 = (i + 1 - halfPier / pitch) / count;
      const p = lerp(a, b, u0),
        q = lerp(a, b, u1);
      for (let f = 0; f < floors; f++) {
        const y = lo + ((hi - lo) * f) / floors,
          h = lo + ((hi - lo) * (f + 1)) / floors;
        const pp = [
          [p[0], y, p[1]],
          [q[0], y, q[1]],
          [q[0], h, q[1]],
          [p[0], h, p[1]],
        ];
        panel(out, pp, shadowGlass, 0.055, [0.24, 0.28, 0.29]);
        beam(
          out,
          'metal',
          shift([p[0], y + 0.38, p[1]], n, -0.01),
          shift([q[0], y + 0.38, q[1]], n, -0.01),
          0.23,
          0.13,
          [0.12, 0.17, 0.19],
        );
      }
    }
    // Individual V-faced granite piers, with real depth and narrow stone joints.
    for (let i = 0; i <= count; i++) {
      const u = i / count,
        mid = lerp(a, b, u),
        w = Math.min(0.69, (len / count) * 0.3),
        tx = (b[0] - a[0]) / len,
        tz = (b[1] - a[1]) / len;
      const l = [mid[0] - tx * w, mid[1] - tz * w],
        r = [mid[0] + tx * w, mid[1] + tz * w],
        v = [mid[0] + n[0] * 0.58, mid[1] + n[2] * 0.58];
      const bottom = 0;
      for (let f = 0; f < 83; f++) {
        const y = bottom + ((hi - bottom) * f) / 83 + 0.012,
          h = bottom + ((hi - bottom) * (f + 1)) / 83 - 0.012;
        for (const [aa, bb] of [
          [l, v],
          [v, r],
        ])
          face(
            out,
            'cladding',
            [
              [aa[0], y, aa[1]],
              [bb[0], y, bb[1]],
              [bb[0], h, bb[1]],
              [aa[0], h, aa[1]],
            ],
            white,
          );
      }
    }
  }
  mappedCap(out, 'concrete', plan, 340, [0.69, 0.7, 0.66]);
  bandPlan(out, plan, 339.6, 0.27, 0.4, white, 'cladding');
  const roof = partPlan(m, part(key, 284775635));
  mappedSolid(out, 'cladding', roof, 340, 346.3, [0.71, 0.73, 0.7]);
  for (const { a, b, len, n } of edges(roof)) {
    for (let y = 341; y < 345.9; y += 0.3)
      beam(
        out,
        'metal',
        shift([a[0], y, a[1]], n, 0.025),
        shift([b[0], y, b[1]], n, 0.025),
        0.09,
        0.12,
        [0.34, 0.4, 0.4],
      );
    const count = Math.ceil(len / 2.8);
    for (let i = 0; i <= count; i++) {
      const q = lerp(a, b, i / count);
      beam(out, 'cladding', [q[0], 340, q[1]], [q[0], 346.3, q[1]], 0.3, 0.3, white);
    }
  }
  // Service forms remain within the flat roof, below the published architectural top.
  for (const z of [-22.5, 20.5])
    for (const x of [-15, -5, 5, 15])
      box(out, 'metal', [x - 2, 340, z - 1.3], [x + 2, 342.2, z + 1.3], [0.5, 0.55, 0.54]);
}

function buildKingdom(out, m) {
  const key = 'n0166_kingdom_centre',
    podium = cleanPlan(partPlan(m, part(key, 264745917))),
    plan = cleanPlan(partPlan(m, part(key, 264745922)), 0.055);
  mappedSolid(out, 'stone', podium, 0, 0.35, [0.69, 0.63, 0.5]);
  curtain(out, podium, 0.35, 15.75, {
    dx: 3.1,
    dy: 5.1,
    tint: [0.32, 0.36, 0.32],
    frame: 0.35,
    trim: [0.7, 0.63, 0.51],
    slot: 'cladding',
  });
  mappedCap(out, 'stone', podium, 15.75, [0.74, 0.67, 0.52]);
  bandPlan(out, podium, 15.75, 0.5, 0.3, [0.76, 0.69, 0.53], 'cladding');
  const min = Math.min(...plan.map((p) => p[0])),
    max = Math.max(...plan.map((p) => p[0])),
    cx = (min + max) / 2,
    rx = (max - min) / 2;
  const roof = (x) =>
    205 + ((302.3 - 205) * (Math.cosh((2.1 * (x - cx)) / rx) - 1)) / (Math.cosh(2.1) - 1);
  for (const { a, b, len, n } of edges(plan)) {
    const cols = Math.max(1, Math.ceil(len / 1.8));
    for (let j = 0; j < cols; j++) {
      const p = lerp(a, b, j / cols),
        q = lerp(a, b, (j + 1) / cols),
        hp = roof(p[0]),
        hq = roof(q[0]);
      // Independent wall cells clip to the catenary instead of filling the opening.
      for (let f = 0; f < 90; f++) {
        const y = 0.35 + ((302.3 - 0.35) * f) / 90,
          h = 0.35 + ((302.3 - 0.35) * (f + 1)) / 90;
        if (y >= Math.max(hp, hq)) break;
        const rectangle = [
            [0, y],
            [1, y],
            [1, h],
            [0, h],
          ],
          clipped = [];
        const distance = (uv) => uv[1] - (hp + (hq - hp) * uv[0]);
        // Clip the entire rectangular cell. A steep cut may cross both horizontal
        // edges, leaving a trapezoid rather than the former incomplete triangle.
        for (let k = 0; k < rectangle.length; k++) {
          const a = rectangle[k],
            b = rectangle[(k + 1) % rectangle.length],
            da = distance(a),
            db = distance(b);
          if (da <= 0) clipped.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) clipped.push(lerp(a, b, da / (da - db)));
        }
        const poly = clipped.map(([u, v]) => {
          const xz = lerp(p, q, u);
          return [xz[0], v, xz[1]];
        });
        if (poly.length < 3) continue;
        if (h <= Math.min(hp, hq) && y < 180)
          panel(out, poly, [0.38, 0.5, 0.56], 0.026, [0.59, 0.67, 0.7]);
        else {
          for (let k = 1; k < poly.length - 1; k++)
            tri(
              out,
              y >= 180 ? 'metal' : 'glass',
              [poly[0], poly[k], poly[k + 1]],
              [0.38, 0.5, 0.56],
            );
          for (let k = 0; k < poly.length; k++) {
            const aa = poly[k],
              bb = poly[(k + 1) % poly.length];
            if (Math.hypot(...aa.map((v, i) => v - bb[i])) > 0.05)
              beam(out, 'metal', aa, bb, 0.025, 0.035, [0.59, 0.67, 0.7]);
          }
        }
      }
      beam(
        out,
        'metal',
        shift([p[0], hp, p[1]], n, 0.02),
        shift([q[0], hq, q[1]], n, 0.02),
        0.12,
        0.18,
        [0.64, 0.71, 0.73],
      );
    }
  }
  // Exposed curved metal roof traverses the full thickness of the opening.
  const extent = (x) => {
    const hits = [];
    for (const { a, b } of edges(plan))
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    return [Math.min(...hits), Math.max(...hits)];
  };
  const slices = 160;
  for (let i = 0; i < slices; i++) {
    const x0 = min + 0.0005 + ((max - min - 0.001) * i) / slices,
      x1 = min + 0.0005 + ((max - min - 0.001) * (i + 1)) / slices,
      a = extent(x0),
      b = extent(x1),
      h0 = roof(x0),
      h1 = roof(x1);
    for (let j = 0; j < 8; j++) {
      const q = [
        [x0, h0, a[0] + ((a[1] - a[0]) * j) / 8],
        [x0, h0, a[0] + ((a[1] - a[0]) * (j + 1)) / 8],
        [x1, h1, b[0] + ((b[1] - b[0]) * (j + 1)) / 8],
        [x1, h1, b[0] + ((b[1] - b[0]) * j) / 8],
      ];
      face(out, 'metal', q, [0.55, 0.64, 0.67]);
      if (i % 3 === 0) beam(out, 'metal', q[0], q[1], 0.035, 0.05, [0.64, 0.71, 0.73]);
    }
  }
  const bridge = partPlan(m, part(key, 984443070));
  mappedSolid(out, 'metal', bridge, 296.5, 297.2, [0.61, 0.67, 0.68]);
  curtain(out, bridge, 297.2, 301.85, {
    dx: 2.25,
    dy: 4.7,
    tint: [0.23, 0.37, 0.44],
    frame: 0.06,
    trim: [0.67, 0.73, 0.75],
  });
  mappedSolid(out, 'metal', bridge, 301.85, 302.3, [0.66, 0.72, 0.73]);
  // Short ends use their independent mapped plans to connect roof and bridge.
  for (const id of [264745924, 264745925]) {
    const p = partPlan(m, part(key, id));
    curtain(out, p, 296.3, 302.3, {
      dx: 1.5,
      dy: 3,
      tint: [0.45, 0.57, 0.61],
      frame: 0.03,
      trim: metal,
    });
    mappedCap(out, 'metal', p, 302.3, [0.64, 0.7, 0.72]);
  }
  for (const [x, z] of [
    [-100, -70],
    [-102, 0],
    [-100, 69],
    [94, -65],
    [94, 65],
  ])
    planter(out, x, 16.05, z);
}

function buildShunHing(out, m) {
  const key = 'n0167_shun_hing_square',
    body = cleanPlan(partPlan(m, part(key, 279950100))),
    whole = localOutline(m),
    white = [0.76, 0.79, 0.73],
    green = [0.16, 0.39, 0.38];
  mappedSolid(out, 'stone', whole, 0, 0.25, [0.52, 0.47, 0.39]);
  const podium = partPlan(m, part(key, 1145586647));
  curtain(out, podium, 0.25, 22, {
    dx: 3.2,
    dy: 4.3,
    tint: [0.23, 0.34, 0.33],
    frame: 0.42,
    trim: [0.7, 0.66, 0.57],
    slot: 'cladding',
  });
  mappedCap(out, 'stone', podium, 22, [0.68, 0.65, 0.56]);
  // Rectangular main volume has curved side cutouts for the two glass cylinders.
  for (const { a, b, len, n } of edges(body)) {
    for (let f = 0; f < 69; f++) {
      const lo = 0.25 + ((302 - 0.25) * f) / 69,
        hi = 0.25 + ((302 - 0.25) * (f + 1)) / 69;
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi - 1.4, b[1]],
          [a[0], hi - 1.4, a[1]],
        ],
        green,
        1.5,
        4.5,
        0.045,
        [0.62, 0.68, 0.64],
      );
      face(
        out,
        'metal',
        [
          [a[0], hi - 1.4, a[1]],
          [b[0], hi - 1.4, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ].map((p) => shift(p, n, 0.035)),
        white,
      );
      beam(
        out,
        'metal',
        shift([a[0], hi, a[1]], n, 0.1),
        shift([b[0], hi, b[1]], n, 0.1),
        0.09,
        0.15,
        [0.69, 0.72, 0.64],
      );
    }
    if (len > 35) {
      // An inset vertical green center panel interrupts the upper horizontal bands.
      const aa = lerp(a, b, 0.41),
        bb = lerp(a, b, 0.59);
      grid(
        out,
        [
          [aa[0], 220, aa[1]],
          [bb[0], 220, bb[1]],
          [bb[0], 301.9, bb[1]],
          [aa[0], 301.9, aa[1]],
        ].map((p) => shift(p, n, 0.13)),
        [0.16, 0.38, 0.37],
        1.5,
        3.8,
        0.04,
        [0.48, 0.6, 0.56],
      );
      for (let j = 1; j < 8; j++) {
        const q = lerp(a, b, j / 8);
        beam(
          out,
          'metal',
          shift([q[0], 0.25, q[1]], n, 0.075),
          shift([q[0], 301.9, q[1]], n, 0.075),
          0.12,
          0.15,
          [0.56, 0.55, 0.45],
        );
      }
    }
  }
  mappedCap(out, 'metal', body, 302, [0.58, 0.65, 0.62]);
  for (const id of [188388373, 188388378]) {
    const mp = partPlan(m, part(key, id)),
      c = mp.reduce((s, p) => [s[0] + p[0] / mp.length, s[1] + p[1] / mp.length], [0, 0]),
      radius = 12.06;
    const cyl = radialRing(0, radius, radius, 96, c).map((p) => [p[0], p[2]]);
    curtain(out, cyl, 0.25, 313, {
      dx: 1.6,
      dy: 4.4,
      tint: [0.13, 0.37, 0.38],
      frame: 0.052,
      trim: [0.58, 0.66, 0.63],
    });
    for (let i = 1; i < 71; i++)
      bandPlan(out, cyl, 0.25 + (312.75 * i) / 71, 0.12, 0.14, [0.68, 0.73, 0.68], 'metal');
    const profile = [
      [313, 12.06],
      [315, 12.06],
      [318, 11.7],
      [320, 10.5],
      [321.5, 8.6],
      [322.2, 6.55],
      [329.3, 6.55],
      [331, 6.1],
      [332.5, 4.8],
      [333.5, 2.7],
      [334, 0.68],
    ];
    loft(
      out,
      'glass',
      profile.map(([y, r]) => radialRing(y, r, r, 96, c)),
      [0.15, 0.4, 0.4],
    );
    for (const [y, r] of profile.slice(0, -1))
      bandPlan(
        out,
        radialRing(y, r, r, 96, c).map((p) => [p[0], p[2]]),
        y,
        0.15,
        0.11,
        [0.65, 0.72, 0.69],
        'metal',
      );
    for (let a = 0; a < 24; a++) {
      const theta = (a * Math.PI) / 12;
      for (let i = 1; i < profile.length; i++) {
        const [y0, r0] = profile[i - 1],
          [y1, r1] = profile[i];
        tube(
          out,
          'metal',
          [c[0] + Math.cos(theta) * r0, y0, c[1] + Math.sin(theta) * r0],
          [c[0] + Math.cos(theta) * r1, y1, c[1] + Math.sin(theta) * r1],
          0.048,
          [0.56, 0.66, 0.65],
          6,
        );
      }
    }
    loft(
      out,
      'metal',
      [
        [333.8, 0.68],
        [359, 0.45],
        [375, 0.22],
        [384, 0.035],
      ].map(([y, r]) => radialRing(y, r, r, 16, c)),
      [0.76, 0.78, 0.75],
    );
    for (const y of [340, 350, 360, 370, 380])
      bandPlan(
        out,
        radialRing(y, 0.72, 0.72, 16, c).map((p) => [p[0], p[2]]),
        y,
        0.085,
        0.12,
        white,
        'metal',
      );
  }
  const roofBlock = [
    [-9, -8],
    [-9, 8],
    [9, 8],
    [9, -8],
  ];
  mappedSolid(out, 'metal', roofBlock, 302, 307, [0.52, 0.6, 0.56]);
  for (const z of [-7.8, 7.8])
    for (let y = 302.5; y < 306.8; y += 0.4)
      beam(out, 'metal', [-8.5, y, z], [8.5, y, z], 0.13, 0.16, [0.34, 0.42, 0.38]);
}

function facetedGlazing(
  out,
  polygon,
  { dx = 1.52, dy = 4.4196, tint = [0.43, 0.55, 0.59], trim = [0.66, 0.71, 0.72] } = {},
) {
  const normal = normalFor(polygon[0], polygon[1], polygon[2]),
    horizontal = Math.hypot(normal[0], normal[2]);
  if (horizontal < 0.0001) {
    const plan = polygon.map((p) => [p[0], p[2]]);
    mappedCap(out, 'metal', plan, polygon[0][1], [0.46, 0.5, 0.5]);
    return;
  }
  const u = [normal[2] / horizontal, 0, -normal[0] / horizontal],
    d = polygon[0].reduce((s, v, i) => s + v * normal[i], 0);
  const uv = polygon.map((p) => [p[0] * u[0] + p[2] * u[2], p[1]]);
  const world = ([a, b]) => {
    const t = (d - normal[1] * b) / (horizontal * horizontal);
    return [a * u[0] + t * normal[0], b, a * u[2] + t * normal[2]];
  };
  const clip = (poly, axis, bound, sign) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = (a[axis] - bound) * sign,
        db = (b[axis] - bound) * sign;
      if (da >= -1e-8) result.push(a);
      if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
        result.push(lerp(a, b, da / (da - db)));
    }
    return result.filter(
      (p, i, a) =>
        Math.hypot(p[0] - a[(i + 1) % a.length][0], p[1] - a[(i + 1) % a.length][1]) > 1e-5,
    );
  };
  const x0 = Math.floor(Math.min(...uv.map((p) => p[0])) / dx),
    x1 = Math.ceil(Math.max(...uv.map((p) => p[0])) / dx);
  const y0 = Math.floor(Math.min(...uv.map((p) => p[1])) / dy),
    y1 = Math.ceil(Math.max(...uv.map((p) => p[1])) / dy);
  const safeTri = (slot, p, color) => {
    const f = p.map((q) => q.map(Math.fround)),
      a = f[1].map((v, i) => v - f[0][i]),
      b = f[2].map((v, i) => v - f[0][i]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) >
      1e-6
    )
      tri(out, slot, f, color);
  };
  // One glass facet and its frames as strips clipped to it, just proud of the glass, instead of
  // an inset pane and frame ring per cell. Strip widths match the old 0.957 / 0.978 cell insets.
  const fill = (poly, slot, color, lift = 0) => {
    if (poly.length < 3) return;
    const points = poly.map((v) => world(v).map((x, i) => x + normal[i] * lift));
    for (const ids of ShapeUtils.triangulateShape(
      poly.map((v) => new Vector2(...v)),
      [],
    )) {
      let t = ids.map((i) => points[i]);
      if (normalFor(...t).reduce((s, v, i) => s + v * normal[i], 0) < 0) t = t.toReversed();
      safeTri(slot, t, color);
    }
  };
  fill(uv, 'glass', tint);
  const wx = dx * 0.0215,
    wy = dy * 0.011;
  for (let x = x0; x <= x1; x++)
    fill(clip(clip(uv, 0, x * dx - wx, 1), 0, x * dx + wx, -1), 'metal', trim, 0.02);
  for (let y = y0; y <= y1; y++)
    fill(clip(clip(uv, 1, y * dy - wy, 1), 1, y * dy + wy, -1), 'metal', trim, 0.02);
  // The facet's own edges carry the frame of the cells they cut.
  const winding = Math.sign(
    uv.reduce(
      (s, p, i) => s + p[0] * uv[(i + 1) % uv.length][1] - p[1] * uv[(i + 1) % uv.length][0],
      0,
    ),
  );
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i],
      b = uv[(i + 1) % uv.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-5) continue;
    const across = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? wy : wx;
    const inward = [
      (-(b[1] - a[1]) / length) * winding * across,
      ((b[0] - a[0]) / length) * winding * across,
    ];
    fill(
      [a, b, [b[0] + inward[0], b[1] + inward[1]], [a[0] + inward[0], a[1] + inward[1]]],
      'metal',
      trim,
      0.02,
    );
  }
}

function clipPolygonPlane(poly, distance, sign = 1) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = distance(a) * sign,
      db = distance(b) * sign;
    if (da >= -1e-7) result.push(a);
    if ((da > 1e-7 && db < -1e-7) || (da < -1e-7 && db > 1e-7))
      result.push(lerp(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i, a) => Math.hypot(...p.map((v, k) => v - a[(i + 1) % a.length][k])) > 1e-5,
  );
}
function subtractConvexVolume(poly, planes) {
  const outside = [];
  let inside = poly;
  for (const distance of planes) {
    const piece = clipPolygonPlane(inside, distance, -1);
    if (piece.length > 2) outside.push(piece);
    inside = clipPolygonPlane(inside, distance);
    if (inside.length < 3) break;
  }
  return outside;
}
function validPolygon(poly) {
  if (poly.length < 3) return false;
  let area = 0;
  for (let i = 1; i < poly.length - 1; i++) {
    const a = poly[i].map((v, k) => v - poly[0][k]),
      b = poly[i + 1].map((v, k) => v - poly[0][k]);
    area += Math.hypot(
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    );
  }
  return area > 0.0001;
}
function buildMercury(out, m) {
  const key = 'n0169_mercury_city_tower',
    gold = [0.66, 0.29, 0.085],
    dark = [0.15, 0.12, 0.095],
    white = [0.84, 0.86, 0.85];
  const blocks = partsEvidence(key)
    .filter((p) => p.tags['building:part'])
    .map((p) => {
      const plan = cleanPlan(partPlan(m, p), 0.02),
        height = +p.tags.height + (p.id === 547413255 ? 0.824 : 0),
        rise = +(p.tags['roof:height'] ?? 0);
      const theta = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
      const e = Math.sin(theta),
        s = -Math.cos(theta),
        d = [
          e * Math.cos(m.heading) - s * Math.sin(m.heading),
          e * Math.sin(m.heading) + s * Math.cos(m.heading),
        ];
      const values = plan.map((q) => q[0] * d[0] + q[1] * d[1]),
        lo = Math.min(...values),
        span = Math.max(...values) - lo;
      const roof = (q) => height - (rise ? (rise * (q[0] * d[0] + q[1] * d[1] - lo)) / span : 0);
      const triangles = ShapeUtils.triangulateShape(
        plan.map((q) => new Vector2(...q)),
        [],
      ).map((ids) => {
        let ring = ids.map((i) => plan[i]);
        if (
          (ring[1][0] - ring[0][0]) * (ring[2][1] - ring[0][1]) -
            (ring[1][1] - ring[0][1]) * (ring[2][0] - ring[0][0]) >
          0
        )
          ring = ring.toReversed();
        return ring;
      });
      return { id: p.id, plan, roof, height, rise, triangles };
    });
  // Subtract neighboring mapped solids before glazing their exposed planes. This avoids
  // coplanar walls fighting at the nested setbacks and keeps the sloped roofs closed.
  const exposed = (polygon, owner) => {
    const n = normalFor(polygon[0], polygon[1], polygon[2]);
    let pieces = [polygon];
    for (let index = 0; index < blocks.length; index++) {
      if (index === owner) continue;
      const b = blocks[index],
        bias = index > owner ? -0.0005 : 0.0005;
      for (const ring of b.triangles) {
        const planes = edges(ring).map(
          ({ a, n: outward }) =>
            (q) =>
              -(
                (q[0] + n[0] * bias - a[0]) * outward[0] +
                (q[2] + n[2] * bias - a[1]) * outward[2]
              ),
        );
        planes.push((q) => b.roof([q[0], q[2]]) - q[1] - 0.001);
        pieces = pieces.flatMap((p) => subtractConvexVolume(p, planes)).filter(validPolygon);
      }
    }
    return pieces;
  };
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.22, [0.27, 0.25, 0.22]);
  blocks.forEach((b, index) => {
    for (const { a, c: unused, b: end, n } of edges(b.plan)) {
      void unused;
      const wall = [
        [a[0], 0.22, a[1]],
        [end[0], 0.22, end[1]],
        [end[0], b.roof(end), end[1]],
        [a[0], b.roof(a), a[1]],
      ];
      for (const p of exposed(wall, index))
        facetedGlazing(out, p, { dx: 1.42, dy: 4.05, tint: gold, trim: dark });
      // White folded-aluminum bands follow the actual three-dimensional setback edge.
      for (const p of exposed(
        [
          [a[0], b.roof(a) - 1.2, a[1]],
          [end[0], b.roof(end) - 1.2, end[1]],
          [end[0], b.roof(end), end[1]],
          [a[0], b.roof(a), a[1]],
        ],
        index,
      )) {
        for (let j = 1; j < p.length - 1; j++)
          tri(
            out,
            'metal',
            [p[0], p[j], p[j + 1]].map((q) => shift(q, n, 0.035).map(Math.fround)),
            white,
          );
      }
      const mid = lerp(a, end, 0.025),
        corner = [
          [a[0], 0.23, a[1]],
          [mid[0], 0.23, mid[1]],
          [mid[0], b.roof(mid), mid[1]],
          [a[0], b.roof(a), a[1]],
        ];
      for (const p of exposed(corner, index))
        for (let j = 1; j < p.length - 1; j++)
          tri(
            out,
            'metal',
            [p[0], p[j], p[j + 1]].map((q) => shift(q, n, 0.045).map(Math.fround)),
            white,
          );
    }
    for (const t of b.triangles) {
      const polygon = t.map((q) => [q[0], b.roof(q), q[1]]);
      for (const p of exposed(polygon, index)) {
        if (b.id === 547413255)
          facetedGlazing(out, p, { dx: 1.42, dy: 4.05, tint: [0.58, 0.27, 0.09], trim: dark });
        else
          for (let j = 1; j < p.length - 1; j++)
            tri(
              out,
              'metal',
              [p[0], p[j], p[j + 1]].map((q) => q.map(Math.fround)),
              [0.76, 0.78, 0.76],
            );
      }
    }
  });
  const top = blocks.find((p) => p.id === 547413255);
  // The owner identifies the four dark LED faces on floors67–68, total1350 m².
  for (const { a, b, n, len } of edges(top.plan)) {
    if (len < 7) continue;
    const aa = lerp(a, b, 0.035),
      bb = lerp(a, b, 0.965);
    const p = [
      [aa[0], 294, aa[1]],
      [bb[0], 294, bb[1]],
      [bb[0], 304.5, bb[1]],
      [aa[0], 304.5, aa[1]],
    ].map((q) => shift(q, n, 0.075));
    for (const poly of exposed(p, blocks.indexOf(top)))
      facetedGlazing(out, poly, {
        dx: 1.42,
        dy: 3.5,
        tint: [0.055, 0.065, 0.064],
        trim: [0.17, 0.19, 0.18],
      });
  }
  // Bronze street glazing and the pointed eastern entrance follow the mapped nose.
  const nose = blocks.find((p) => p.id === 1279791780);
  for (const { a, b, n } of edges(nose.plan)) {
    if (Math.max(a[0], b[0]) < 39) continue;
    grid(
      out,
      [
        [a[0], 0.24, a[1]],
        [b[0], 0.24, b[1]],
        [b[0], 7.1, b[1]],
        [a[0], 7.1, a[1]],
      ].map((q) => shift(q, n, 0.09)),
      [0.32, 0.22, 0.14],
      1.6,
      3.45,
      0.11,
      white,
    );
  }
}

function buildAlmas(out, m) {
  const silver = [0.76, 0.79, 0.8],
    blue = [0.27, 0.38, 0.42];
  const ellipse = (cx, cz, side) => {
    const ring = Array.from({ length: 160 }, (_, i) => {
      const a = (-i * Math.PI * 2) / 160;
      return [cx + 27 * Math.cos(a), 0, cz + 12.5 * Math.sin(a)];
    });
    return clipPolygonPlane(ring, (p) => (side < 0 ? p[0] + 32 : 32 - p[0])).map((p) => [
      p[0],
      p[2],
    ]);
  };
  const north = ellipse(-9, -8.5, -1),
    south = ellipse(9, 8.5, 1);
  const nRoof = ([x]) => 232 + ((18 - x) * 8) / 50,
    sRoof = ([x]) => 279 + ((x + 18) * 21) / 50;
  const splitEdge = (a, b, other) => {
    const v = [b[0] - a[0], b[1] - a[1]],
      ts = [0, 1];
    for (const { a: c, b: d } of edges(other)) {
      const w = [d[0] - c[0], d[1] - c[1]],
        den = v[0] * w[1] - v[1] * w[0];
      if (Math.abs(den) < 1e-9) continue;
      const q = [c[0] - a[0], c[1] - a[1]],
        t = (q[0] * w[1] - q[1] * w[0]) / den,
        u = (q[0] * v[1] - q[1] * v[0]) / den;
      if (t > 1e-7 && t < 1 - 1e-7 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    return ts.slice(0, -1).map((t, i) => [lerp(a, b, t), lerp(a, b, ts[i + 1])]);
  };
  const slopedCap = (plan, height, color) => {
    for (const ids of ShapeUtils.triangulateShape(
      plan.map((p) => new Vector2(...p)),
      [],
    )) {
      let p = ids.map((i) => [plan[i][0], height(plan[i]), plan[i][1]]);
      if (normalFor(...p)[1] < 0) p = p.toReversed();
      tri(out, 'metal', p, color);
    }
  };
  for (const [plan, other, isNorth] of [
    [north, south, true],
    [south, north, false],
  ]) {
    const ceiling = isNorth ? 232 : 279,
      roof = isNorth ? nRoof : sRoof;
    for (const { a, b } of edges(plan))
      for (const [aa, bb] of splitEdge(a, b, other)) {
        const midpoint = lerp(aa, bb, 0.5),
          covered = insidePlan(midpoint, other);
        if (isNorth && covered) continue;
        const bottomA = covered ? nRoof(aa) : 0.22,
          bottomB = covered ? nRoof(bb) : 0.22;
        const flat = Math.abs(aa[0] - bb[0]) < 1e-5;
        const poly = [
          [aa[0], bottomA, aa[1]],
          [bb[0], bottomB, bb[1]],
          [bb[0], ceiling, bb[1]],
          [aa[0], ceiling, aa[1]],
        ];
        if (flat) {
          face(out, 'metal', poly, silver);
          const n = normalFor(...poly);
          for (let z = Math.min(aa[1], bb[1]) + 1.35; z < Math.max(aa[1], bb[1]) - 1.3; z += 2.65) {
            const x = aa[0] + n[0] * 0.025;
            let inset = [
              [x, Math.max(bottomA, bottomB), z - 0.2],
              [x, Math.max(bottomA, bottomB), z + 0.2],
              [x, ceiling - 1, z + 0.2],
              [x, ceiling - 1, z - 0.2],
            ];
            if (normalFor(...inset)[0] * n[0] < 0) inset = inset.toReversed();
            face(out, 'recess', inset, [0.17, 0.24, 0.27]);
          }
        } else {
          facetedGlazing(out, poly, { dx: 1.35, dy: 4, tint: blue, trim: silver });
          const n = normalFor(...poly);
          for (let y = 4; y < ceiling; y += 4) {
            if (y <= Math.max(bottomA, bottomB) + 0.4) continue;
            beam(
              out,
              'metal',
              shift([aa[0], y, aa[1]], n, 0.035),
              shift([bb[0], y, bb[1]], n, 0.035),
              0.16,
              0.57,
              silver,
            );
          }
          for (const level of [42, 121, 212, 279]) {
            if (level >= ceiling || level <= Math.max(bottomA, bottomB) + 2) continue;
            for (let y = level - 0.9; y <= level + 0.9; y += 0.3)
              beam(
                out,
                'metal',
                shift([aa[0], y, aa[1]], n, 0.12),
                shift([bb[0], y, bb[1]], n, 0.12),
                0.15,
                0.095,
                [0.47, 0.53, 0.55],
              );
          }
        }
        const topA = roof(aa),
          topB = roof(bb);
        if (topA > ceiling + 0.001 && topB > ceiling + 0.001)
          face(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], ceiling, bb[1]],
              [bb[0], topB, bb[1]],
              [aa[0], topA, aa[1]],
            ],
            silver,
          );
        else if (topA > ceiling + 0.001)
          tri(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], topB, bb[1]],
              [aa[0], topA, aa[1]],
            ],
            silver,
          );
        else if (topB > ceiling + 0.001)
          tri(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], ceiling, bb[1]],
              [bb[0], topB, bb[1]],
            ],
            silver,
          );
        beam(out, 'metal', [aa[0], topA, aa[1]], [bb[0], topB, bb[1]], 0.16, 0.2, silver);
      }
    slopedCap(plan, roof, [0.59, 0.65, 0.67]);
  }
  // The published81 m mast is elliptical, with a58 m lower tube and a23 m upper tube.
  // Its lower21 m is integrated into the high flat-ended concrete blade.
  const mast = [31.9, 8.5];
  loft(
    out,
    'metal',
    [radialRing(279, 1.7, 3.7, 64, mast), radialRing(337, 1.0, 2.5, 64, mast)],
    silver,
  );
  loft(
    out,
    'metal',
    [radialRing(337, 0.75, 2.15, 64, mast), radialRing(360, 0.12, 0.3, 64, mast)],
    [0.83, 0.85, 0.85],
  );
  for (let y = 301; y < 359; y += 2.4) {
    const upper = y >= 337,
      t = upper ? (y - 337) / 23 : (y - 279) / 58;
    const rx = upper ? 0.75 - 0.63 * t : 1.7 - 0.7 * t,
      rz = upper ? 2.15 - 1.85 * t : 3.7 - 1.2 * t;
    loft(
      out,
      'metal',
      [
        radialRing(y, rx + 0.014, rz + 0.014, 64, mast),
        radialRing(y + 0.055, rx + 0.014, rz + 0.014, 64, mast),
      ],
      silver,
    );
  }
  // The source-local frame is registered to the eight primary-plan tips. Keep the
  // full mapped podium distinct from the engineer's64×42 m tower plan above.
  const outline = localOutline(m);
  mappedSolid(out, 'foundation', outline, 0, 0.3, [0.49, 0.49, 0.46]);
  const center = Array.from({ length: 128 }, (_, i) => {
    const a = (-i * Math.PI * 2) / 128;
    return [40 * Math.cos(a), 35 * Math.sin(a)];
  });
  curtain(out, center, 0.3, 12.5, {
    dx: 1.65,
    dy: 4.05,
    tint: [0.22, 0.29, 0.31],
    frame: 0.08,
    trim: silver,
  });
  mappedCap(out, 'stone', center, 12.5, [0.67, 0.65, 0.59]);
  const raw = m.geometry.outline;
  const wings = [
    [0, 1, 2],
    [2, 3, 5],
    [6, 7, 8],
    [9, 11, 12],
    [14, 15, 16],
    [19, 20, 21],
    [23, 24, 25],
    [27, 29, 0],
  ];
  wings.forEach(([li, ti, ri], index) => {
    const plan = [raw[li], raw[ti], raw[ri]].map((p) => p.slice());
    if (
      plan.reduce((s, p, i) => s + p[0] * plan[(i + 1) % 3][1] - p[1] * plan[(i + 1) % 3][0], 0) > 0
    )
      plan.reverse();
    const tip = raw[ti],
      tipDistance = Math.hypot(...tip),
      long = index === 0;
    const radial = (p) => Math.min(1, Math.max(0, (Math.hypot(...p) - 35) / (tipDistance - 35)));
    const top = (p) => (long ? 18.6 : 16 - radial(p) * 3.5),
      bottom = (p) => 4.1 + radial(p) * (long ? 6 : 3.1);
    for (const { a, b, len, n } of edges(plan)) {
      const p = [
        [a[0], bottom(a), a[1]],
        [b[0], bottom(b), b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ];
      facetedGlazing(out, p, { dx: 1.4, dy: 1.45, tint: [0.22, 0.32, 0.35], trim: silver });
      for (const high of [false, true])
        beam(
          out,
          'metal',
          shift([a[0], high ? top(a) : bottom(a), a[1]], n, 0.1),
          shift([b[0], high ? top(b) : bottom(b), b[1]], n, 0.1),
          0.5,
          0.45,
          silver,
        );
      const bays = Math.max(2, Math.round(len / (long ? 12 : 8)));
      for (let i = 0; i < bays; i++) {
        const a1 = lerp(a, b, i / bays),
          b1 = lerp(a, b, (i + 1) / bays);
        beam(
          out,
          'metal',
          shift([a1[0], i % 2 ? top(a1) - 0.2 : bottom(a1) + 0.2, a1[1]], n, 0.25),
          shift([b1[0], i % 2 ? bottom(b1) + 0.2 : top(b1) - 0.2, b1[1]], n, 0.25),
          0.4,
          0.43,
          silver,
        );
      }
    }
    // The deep roof feature sits on a continuous folded steel fascia above the
    // glazing head; its published20.85 m datum is not an unsupported floating cap.
    for (const { a, b } of edges(plan)) {
      const highA = long ? 20.85 : top(a) + 0.65,
        highB = long ? 20.85 : top(b) + 0.65;
      face(
        out,
        'metal',
        [
          [a[0], top(a), a[1]],
          [b[0], top(b), b[1]],
          [b[0], highB, b[1]],
          [a[0], highA, a[1]],
        ],
        [0.61, 0.67, 0.69],
      );
    }
    // Triangular glazed roofs, framed along their real outer edges and transverse grid.
    const roof = plan.map((p) => [p[0], long ? 20.85 : top(p) + 0.65, p[1]]);
    let p = roof;
    if (normalFor(...p)[1] < 0) p = p.toReversed();
    tri(out, 'glass', p, [0.42, 0.54, 0.56]);
    for (let i = 0; i < 3; i++) beam(out, 'metal', roof[i], roof[(i + 1) % 3], 0.5, 0.34, silver);
    const tipIndex = plan.findIndex((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1]) < 0.01);
    const a = roof[(tipIndex + 1) % 3],
      b = roof[(tipIndex + 2) % 3],
      c = roof[tipIndex];
    const rows = Math.max(
      3,
      Math.ceil(Math.hypot(...c.map((v, i) => v - (a[i] + b[i]) / 2)) / 2.5),
    );
    for (let j = 1; j < rows; j++)
      beam(out, 'metal', lerp(a, c, j / rows), lerp(b, c, j / rows), 0.13, 0.15, silver);
    for (let j = 1; j < 7; j++) beam(out, 'metal', lerp(a, b, j / 7), c, 0.12, 0.13, silver);
    // Closed cantilever soffit follows the inclined lower chord, separate from ground.
    const underside = plan.map((p) => [p[0], bottom(p), p[1]]);
    if (normalFor(...underside)[1] > 0) underside.reverse();
    tri(out, 'metal', underside, [0.48, 0.53, 0.54]);
    for (const end of [raw[li], raw[ri]]) {
      const q = end.map((v) => v * 0.82);
      tube(
        out,
        'concrete',
        [q[0], 0.55, q[1]],
        [end[0], bottom(end) + 0.2, end[1]],
        0.5,
        [0.69, 0.68, 0.64],
        12,
      );
    }
  });
  // Two circular glazed rooflights are identifiable in the published podium plan.
  for (const [x, z] of [
    [-26, 11],
    [26, -11],
  ]) {
    loft(
      out,
      'metal',
      [radialRing(12.5, 3.45, 3.45, 48, [x, z]), radialRing(13.2, 3.45, 3.45, 48, [x, z])],
      silver,
    );
    const ring = radialRing(13.25, 3.2, 3.2, 48, [x, z]);
    for (let i = 0; i < 48; i++)
      tri(out, 'glass', [[x, 13.25, z], ring[i], ring[(i + 1) % 48]], [0.4, 0.53, 0.55]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        out,
        'metal',
        [x, 13.3, z],
        [x + 3.2 * Math.cos(a), 13.3, z + 3.2 * Math.sin(a)],
        0.1,
        0.1,
        silver,
      );
    }
  }
}

function buildTrumpChicago(out, m) {
  const key = 'n0174_trump_international_hotel_and_tower';
  const silver = [0.73, 0.76, 0.77],
    blue = [0.32, 0.43, 0.49];
  const blocks = [
    [64594680, 0.22, 60, 16],
    [188338549, 60, 120, 13],
    [188338550, 120, 200, 22],
    [188338548, 200, 345, 41],
  ].map(([id, lo, hi, floors]) => ({
    id,
    lo,
    hi,
    floors,
    plan: cleanPlan(partPlan(m, part(key, id)), 0.02),
  }));
  mappedSolid(out, 'foundation', blocks[0].plan, 0, 0.22, [0.4, 0.43, 0.42]);
  for (const { plan, lo, hi, floors, id } of blocks) {
    const pitch = (hi - lo) / floors;
    // Rounded plan corners, three asymmetric setbacks and dense unitized vision panels.
    for (const { a, b, n, len } of edges(plan)) {
      const bays = Math.max(1, Math.round(len / 1.48));
      for (let f = 0; f < floors; f++) {
        const y = lo + f * pitch,
          top = lo + (f + 1) * pitch;
        const lobby = id === 64594680 && y < 11;
        const service = f >= floors - 1 && hi < 345;
        for (let j = 0; j < bays; j++) {
          const aa = lerp(a, b, j / bays),
            bb = lerp(a, b, (j + 1) / bays);
          const tint = blue.map(
            (v, c) => v * (0.95 + ((j * 17 + f * 3) % 5) * 0.013) + (lobby && c > 0 ? 0.02 : 0),
          );
          // Vision glass with its slight tint; the 4.5 cm unit frames are below every runtime
          // level's error, while the floor spandrels and major column lines below carry the grid.
          face(
            out,
            'glass',
            [
              [aa[0], y, aa[1]],
              [bb[0], y, bb[1]],
              [bb[0], top, bb[1]],
              [aa[0], top, aa[1]],
            ],
            service ? [0.23, 0.28, 0.29] : tint,
          );
        }
        if (!lobby)
          beam(
            out,
            'stainless',
            [a[0], top - 0.32, a[1]],
            [b[0], top - 0.32, b[1]],
            0.12,
            0.3,
            silver,
          );
        if (service)
          for (let h = y + 0.55; h < top - 0.3; h += 0.84)
            beam(
              out,
              'stainless',
              shift([a[0], h, a[1]], n, 0.07),
              shift([b[0], h, b[1]], n, 0.07),
              0.065,
              0.08,
              [0.49, 0.54, 0.56],
            );
      }
      // Wider stainless-covered major column lines remain separate from fine mullions.
      for (let j = 0; j <= bays; j += 4) {
        const p = lerp(a, b, j / bays);
        beam(
          out,
          'stainless',
          shift([p[0], lo + 0.15, p[1]], n, 0.045),
          shift([p[0], hi - 0.2, p[1]], n, 0.045),
          0.13,
          0.19,
          silver,
        );
      }
    }
    mappedCap(out, 'metal', plan, hi, [0.46, 0.5, 0.51]);
    bandPlan(out, plan, hi - 0.25, 0.4, 0.25, silver, 'stainless');
    if (hi < 345) {
      const inset = plan.map(([x, z]) => [x * 0.992, z * 0.982]);
      for (const { a, b, len } of edges(inset)) {
        beam(
          out,
          'stainless',
          [a[0], hi + 1.05, a[1]],
          [b[0], hi + 1.05, b[1]],
          0.055,
          0.055,
          silver,
        );
        for (let j = 0; j <= Math.floor(len / 1.45); j++) {
          const p = lerp(a, b, j / Math.max(1, Math.floor(len / 1.45)));
          tube(out, 'stainless', [p[0], hi, p[1]], [p[0], hi + 1.04, p[1]], 0.025, silver, 6);
        }
      }
    }
  }
  // Individually mapped roof plant and three stepped circular spire sections.
  const crown = cleanPlan(partPlan(m, part(key, 188338859)), 0.02);
  curtain(out, crown, 345, 357, {
    dx: 1.3,
    dy: 3,
    tint: [0.29, 0.36, 0.39],
    frame: 0.055,
    trim: silver,
    slot: 'stainless',
  });
  mappedCap(out, 'metal', crown, 357, [0.39, 0.45, 0.47]);
  for (const [id, y0, y1, fraction] of [
    [188356529, 357, 380, 0.92],
    [284773992, 380, 400, 0.88],
    [284773991, 400, 423.2, 0.1],
  ]) {
    const plan = partPlan(m, part(key, id));
    const c = plan.reduce((s, p) => [s[0] + p[0] / plan.length, s[1] + p[1] / plan.length], [0, 0]);
    const radius = Math.max(...plan.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
    loft(
      out,
      'stainless',
      [
        radialRing(y0, radius, radius, 48, c),
        radialRing(y1, radius * fraction, radius * fraction, 48, c),
      ],
      [0.76, 0.79, 0.8],
    );
    for (let y = y0 + 1; y < y1; y += 2.3) {
      const r = radius * (1 - ((1 - fraction) * (y - y0)) / (y1 - y0));
      loft(
        out,
        'stainless',
        [
          radialRing(y, r + 0.035, r + 0.035, 48, c),
          radialRing(y + 0.1, r + 0.035, r + 0.035, 48, c),
        ],
        silver,
      );
    }
  }
  // Restaurant terrace on the first eastern setback, with glass rails and planted edge.
  for (const x of [38, 43, 48])
    for (const z of [-10, 9]) {
      const p = [x, z];
      // Keep the full planter/canopy inside the rounded terrace, outside the next shaft.
      if (
        insidePlan(p, blocks[0].plan) &&
        !insidePlan(p, blocks[1].plan) &&
        edges(blocks[0].plan).every(({ a, b, len }) => {
          const t = Math.max(
            0,
            Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (len * len)),
          );
          return Math.hypot(x - a[0] - t * (b[0] - a[0]), z - a[1] - t * (b[1] - a[1])) > 1.8;
        })
      )
        planter(out, x, 60, z);
    }
  // Cantilevered glazed Wabash entrance canopy: original radial steel ribs under glass.
  const canopyCenter = [-45.5, -9.5];
  for (let i = 0; i < 24; i++) {
    const a = Math.PI * 0.35 + (i / 24) * Math.PI * 1.3,
      b = Math.PI * 0.35 + ((i + 1) / 24) * Math.PI * 1.3;
    const P = (angle, r, y) => [
      canopyCenter[0] + Math.cos(angle) * r,
      y,
      canopyCenter[1] + Math.sin(angle) * r,
    ];
    face(
      out,
      'clear_glass',
      [P(a, 3.3, 9.2), P(a, 10, 9.8), P(b, 10, 9.8), P(b, 3.3, 9.2)],
      [0.7, 0.84, 0.87],
    );
    beam(out, 'stainless', P(a, 3.3, 9.16), P(a, 10, 9.76), 0.13, 0.18, silver);
  }
  // Original serif stroke geometry for the installer-documented140ft-wide riverfront sign.
  const glyphs = [
    [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
      [
        [0.2, 0],
        [0.8, 0],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.62, 1],
        [0.86, 0.9],
        [0.95, 0.76],
        [0.87, 0.58],
        [0.62, 0.5],
        [0, 0.5],
      ],
      [
        [0.48, 0.5],
        [1, 0],
      ],
      [
        [-0.1, 0],
        [0.25, 0],
      ],
      [
        [0.78, 0],
        [1.12, 0],
      ],
    ],
    [
      [
        [0, 1],
        [0, 0.25],
        [0.1, 0.09],
        [0.3, 0],
        [0.65, 0],
        [0.9, 0.1],
        [1, 0.28],
        [1, 1],
      ],
      [
        [-0.15, 1],
        [0.2, 1],
      ],
      [
        [0.8, 1],
        [1.15, 1],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.5, 0.28],
        [1, 1],
        [1, 0],
      ],
      [
        [-0.15, 0],
        [0.18, 0],
      ],
      [
        [0.82, 0],
        [1.15, 0],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.64, 1],
        [0.88, 0.88],
        [1, 0.69],
        [0.87, 0.52],
        [0.63, 0.45],
        [0, 0.45],
      ],
      [
        [-0.1, 0],
        [0.28, 0],
      ],
    ],
  ];
  const width = 42.672,
    letter = 6.7,
    gap = (width - letter * 5) / 4;
  glyphs.forEach((paths, index) => {
    for (const path of paths)
      for (let i = 0; i < path.length - 1; i++) {
        const P = (p) => [
          -9.5 - width / 2 + index * (letter + gap) + p[0] * letter,
          51.8 + p[1] * 6.2,
          21.83,
        ];
        beam(out, 'stainless', P(path[i]), P(path[i + 1]), 0.26, 0.5, [0.78, 0.8, 0.81]);
      }
  });
}

function buildGlories(out, m) {
  const rx = m.plan.length / 2,
    rz = m.plan.width / 2,
    height = 144.4,
    start = 76.4,
    n = 132;
  const scale = (y) =>
    y <= start ? 1 : Math.sqrt(Math.max(0.0000001, 1 - ((y - start) / (height - start)) ** 2));
  const at = (i, y, inset = 0) => {
    const a = (i * 2 * Math.PI) / n,
      s = scale(y);
    return [(rx * s - inset) * Math.cos(a), y, -(rz * s - inset) * Math.sin(a)];
  };
  const hash = (x, y) => {
    let v = Math.imul(x + 119, 374761393) ^ Math.imul(y + 71, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const rows = 125,
    top = 115,
    step = (top - 0.25) / rows;
  const cells = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) cells.push({ i, j, score: hash(i, j) });
  const windows = new Set(
    cells
      .toSorted((a, b) => a.score - b.score)
      .slice(0, 4500)
      .map((p) => `${p.i}:${p.j}`),
  );
  const palette = [
    [0.62, 0.06, 0.035],
    [0.74, 0.075, 0.04],
    [0.56, 0.13, 0.095],
    [0.79, 0.15, 0.08],
    [0.57, 0.2, 0.16],
    [0.38, 0.09, 0.11],
    [0.51, 0.19, 0.2],
    [0.65, 0.28, 0.22],
    [0.39, 0.28, 0.27],
    [0.54, 0.37, 0.33],
    [0.28, 0.24, 0.33],
    [0.42, 0.29, 0.4],
    [0.36, 0.36, 0.4],
    [0.48, 0.44, 0.46],
    [0.49, 0.49, 0.5],
    [0.08, 0.2, 0.36],
    [0.12, 0.29, 0.47],
    [0.19, 0.36, 0.53],
    [0.26, 0.43, 0.6],
    [0.22, 0.33, 0.44],
    [0.33, 0.43, 0.52],
    [0.38, 0.49, 0.59],
    [0.47, 0.55, 0.59],
    [0.56, 0.62, 0.64],
    [0.65, 0.67, 0.66],
  ];
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.25, [0.35, 0.36, 0.34]);
  for (const { i, j } of cells) {
    const lo = 0.25 + j * step,
      hi = lo + step - 0.016;
    const wave = Math.sin(i * 0.125 + j * 0.038) * 0.14 + Math.cos(i * 0.33 - j * 0.08) * 0.07;
    const t = Math.max(
      0,
      Math.min(0.999, j / rows + wave + (hash(Math.floor(i / 3), Math.floor(j / 4)) - 0.5) * 0.31),
    );
    const color = palette[Math.min(24, Math.floor(t * 25))];
    const p = [
      at(i + 0.012, lo, 0.74),
      at(i + 0.988, lo, 0.74),
      at(i + 0.988, hi, 0.74),
      at(i + 0.012, hi, 0.74),
    ];
    if (windows.has(`${i}:${j}`)) {
      const q = [
        at(i + 0.095, lo + 0.07, 0.88),
        at(i + 0.905, lo + 0.07, 0.88),
        at(i + 0.905, hi - 0.07, 0.88),
        at(i + 0.095, hi - 0.07, 0.88),
      ];
      face(out, 'glass', q, [0.095, 0.16, 0.2]);
      for (let k = 0; k < 4; k++)
        face(out, 'metal', [p[k], p[(k + 1) % 4], q[(k + 1) % 4], q[k]], color);
    } else face(out, 'pink', p, color);
  }
  // Tilted laminated-glass louvres stand forward of the pixelated metal skin. At medium-fi they
  // are one band per 1.2 m (four real louvre rows) without their 2.5 cm edges and clips, which
  // were 1.4 million triangles of sub-pixel members.
  const pitch = 1.2;
  for (let y = 0.42; y < height - 0.18; y += pitch) {
    const s = scale(y),
      sections = Math.max(12, Math.round(n * Math.max(0.24, s)));
    for (let i = 0; i < sections; i++) {
      const a = (i * n) / sections,
        b = ((i + 1) * n) / sections,
        theta = ((a + b) * Math.PI) / n;
      const tilt = 0.12 + 0.085 * (0.5 + 0.5 * Math.cos(theta + m.heading));
      const p = [
        at(a + 0.012, y, 0),
        at(b - 0.012, y, 0),
        at(b - 0.012, Math.min(height - 0.015, y + pitch * 0.85), tilt),
        at(a + 0.012, Math.min(height - 0.015, y + pitch * 0.85), tilt),
      ];
      face(out, 'clear_glass', p, [0.82, 0.94, 0.95]);
    }
  }
  // The upper dome has no colored concrete shell: framed pale glazing sits behind the slats.
  for (let y = 115; y < 144.3; y += 1.2) {
    const hi = Math.min(144.3, y + 1.2);
    for (let i = 0; i < 66; i++)
      panel(
        out,
        [at(i * 2, y, 0.23), at(i * 2 + 2, y, 0.23), at(i * 2 + 2, hi, 0.23), at(i * 2, hi, 0.23)],
        [0.3, 0.45, 0.52],
        0.025,
        [0.54, 0.6, 0.61],
      );
  }
  for (let i = 0; i < 28; i++)
    for (let y = 114.5; y < 144; y += 1.2) {
      const hi = Math.min(144, y + 1.2);
      beam(
        out,
        'metal',
        at((i * n) / 28, y, 0.38),
        at((i * n) / 28, hi, 0.38),
        0.18,
        0.3,
        [0.63, 0.68, 0.69],
      );
    }
  for (let y = 115; y < 143.7; y += 1.88) {
    const ring = Array.from({ length: 44 }, (_, i) => at(i * 3, y, 0.36));
    for (let i = 0; i < 44; i++)
      beam(out, 'metal', ring[i], ring[(i + 1) % 44], 0.14, 0.18, [0.58, 0.64, 0.65]);
  }
  // Small glazed oculus seals the crown instead of leaving a pinched open pole.
  const capPlan = Array.from({ length: 64 }, (_, i) => {
    const p = at((i * n) / 64, 144.3, 0.05);
    return [p[0], p[2]];
  });
  mappedCap(out, 'glass', capPlan, 144.3, [0.45, 0.58, 0.62]);
  loft(
    out,
    'metal',
    [radialRing(144.3, 0.3, 0.28, 32), radialRing(144.4, 0.19, 0.17, 32)],
    [0.66, 0.71, 0.71],
  );
  // Continuous service rails remain aligned to the facade and explain its large-scale rhythm.
  for (let y = 4.7; y < 114; y += 4.05) {
    const p = Array.from({ length: n / 4 }, (_, i) => at(i * 4, y, -0.055));
    for (let i = 0; i < n / 4; i++)
      beam(out, 'metal', p[i], p[(i + 1) % (n / 4)], 0.065, 0.09, [0.59, 0.64, 0.65]);
  }
}

function buildHancock(out, m) {
  const key = 'n0171_875_north_michigan_avenue',
    bronze = [0.125, 0.11, 0.095],
    glazing = [0.145, 0.18, 0.18],
    roofY = 337.4136;
  const base = cleanPlan(localOutline(m)),
    upper = cleanPlan(partPlan(m, part(key, 232905283)));
  const bounds = (p) => [
    Math.min(...p.map((q) => q[0])),
    Math.max(...p.map((q) => q[0])),
    Math.min(...p.map((q) => q[1])),
    Math.max(...p.map((q) => q[1])),
  ];
  const b = bounds(base),
    u = bounds(upper);
  const ring = (y) => {
    const t = y / roofY,
      x0 = lerp(b, u, t);
    return [
      [x0[0], y, x0[2]],
      [x0[0], y, x0[3]],
      [x0[1], y, x0[3]],
      [x0[1], y, x0[2]],
    ];
  };
  mappedSolid(out, 'foundation', base, 0, 0.24, [0.2, 0.19, 0.17]);
  const stations = [
    [0, 0.24],
    [6, 23],
    [12, 46],
    [44, 164],
    [92, 304.8],
    [94, 313.8],
    [96, 321.3],
    [100, roofY],
  ];
  const floorHeight = (f) => {
    for (let i = 1; i < stations.length; i++)
      if (f <= stations[i][0])
        return (
          stations[i - 1][1] +
          ((stations[i][1] - stations[i - 1][1]) * (f - stations[i - 1][0])) /
            (stations[i][0] - stations[i - 1][0])
        );
    return roofY;
  };
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4,
      r0 = ring(0.24),
      r1 = ring(roofY),
      normal = normalFor(r0[side], r0[next], r1[next]);
    const columns = side % 2 === 0 ? 6 : 8,
      panes = columns * 4;
    const at = (t, y, offset = 0) => shift(lerp(ring(y)[side], ring(y)[next], t), normal, offset);
    for (let f = 0; f < 100; f++) {
      const lo = floorHeight(f),
        hi = floorHeight(f + 1),
        spandrel = Math.min(0.9, (hi - lo) * 0.27);
      for (let j = 0; j < panes; j++) {
        const a = j / panes,
          z = (j + 1) / panes;
        const color = [44, 45, 92, 93, 98, 99].includes(f)
          ? [0.075, 0.084, 0.083]
          : glazing.map((v, k) => v + (k === 0 ? 1 : 0.7) * (((j + f * 3) % 9) - 4) * 0.003);
        panel(
          out,
          [at(a, lo + spandrel), at(z, lo + spandrel), at(z, hi - 0.055), at(a, hi - 0.055)],
          color,
          0.055,
          bronze,
        );
        face(
          out,
          'metal',
          [at(a, lo), at(z, lo), at(z, lo + spandrel), at(a, lo + spandrel)],
          bronze,
        );
      }
    }
    // Wide perimeter columns and primary ties remain separate from the dark window mullions.
    for (let j = 0; j <= columns; j++)
      beam(
        out,
        'metal',
        at(j / columns, 0.55, 0.19),
        at(j / columns, roofY, 0.19),
        j === 0 || j === columns ? 1.18 : 0.62,
        0.42,
        bronze,
      );
    const joints = [0.65, 36, 107, 176, 242, 304, roofY - 0.3];
    const brace = (a, z) => {
      const p = at(a[0], a[1], 0.53),
        q = at(z[0], z[1], 0.53);
      beam(out, 'metal', p, q, 1.05, 0.54, bronze);
      // Narrow raised cover flanges make the built-up member legible in the close view.
      for (const offset of [-0.4, 0.4]) {
        const direction = q.map((v, k) => v - p[k]),
          l = Math.hypot(direction[0], direction[1], direction[2]);
        const v = [
          normal[1] * direction[2] - normal[2] * direction[1],
          normal[2] * direction[0] - normal[0] * direction[2],
          normal[0] * direction[1] - normal[1] * direction[0],
        ].map((x) => x / l);
        beam(
          out,
          'metal',
          shift(shift(p, v, offset), normal, 0.3),
          shift(shift(q, v, offset), normal, 0.3),
          0.12,
          0.08,
          [0.18, 0.16, 0.135],
        );
      }
    };
    brace([0.5, joints[0]], [0, joints[1]]);
    brace([0.5, joints[0]], [1, joints[1]]);
    for (let k = 1; k < joints.length - 2; k++) {
      brace([0, joints[k]], [1, joints[k + 1]]);
      brace([1, joints[k]], [0, joints[k + 1]]);
    }
    brace([0, joints.at(-2)], [0.5, joints.at(-1)]);
    brace([1, joints.at(-2)], [0.5, joints.at(-1)]);
    for (const y of joints.slice(1, -1))
      beam(out, 'metal', at(0, y, 0.29), at(1, y, 0.29), 0.72, 1.5, bronze);
  }
  mappedCap(
    out,
    'metal',
    ring(roofY).map((q) => [q[0], q[2]]),
    roofY,
    [0.26, 0.27, 0.25],
  );
  const house = cleanPlan(partPlan(m, part(key, 1282265474)));
  curtain(out, house, roofY, 343.7, {
    dx: 1.5,
    dy: 2.8,
    tint: [0.065, 0.082, 0.08],
    frame: 0.095,
    trim: bronze,
  });
  mappedCap(out, 'metal', house, 343.7, [0.21, 0.23, 0.21]);
  for (const id of [279951771, 279951772]) {
    const plan = partPlan(m, part(key, id)),
      c = plan.reduce((s, p) => [s[0] + p[0] / plan.length, s[1] + p[1] / plan.length], [0, 0]);
    loft(
      out,
      'metal',
      [
        [337.4, 1.65],
        [360, 1.65],
        [382, 1.38],
        [412, 0.89],
        [443, 0.42],
        [456.9, 0.22],
      ].map(([y, r]) => radialRing(y, r, r, 32, c)),
      [0.8, 0.81, 0.77],
    );
    for (let i = 0; i < 12; i++) {
      const lo = 346 + i * 8.9,
        hi = Math.min(456.9, lo + 4.45),
        radius = (y) =>
          y < 382
            ? 1.7 - (y - 360) * 0.011
            : y < 412
              ? 1.39 - (y - 382) * 0.0163
              : y < 443
                ? 0.9 - (y - 412) * 0.0152
                : 0.43 - (y - 443) * 0.014;
      if (lo >= 456.9) continue;
      loft(
        out,
        'metal',
        [
          radialRing(lo, radius(lo), radius(lo), 32, c),
          radialRing(hi, radius(hi), radius(hi), 32, c),
        ],
        [0.52, 0.135, 0.09],
      );
    }
    for (const y of [354, 371, 389, 408]) {
      const r = y < 382 ? 2.4 : 1.9;
      bandPlan(
        out,
        radialRing(y, r, r, 24, c).map((p) => [p[0], p[2]]),
        y,
        0.15,
        0.16,
        [0.65, 0.67, 0.62],
        'metal',
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          p = [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)],
          q = [p[0], y + 1.1, p[2]];
        tube(out, 'metal', p, q, 0.045, [0.58, 0.61, 0.58], 8);
      }
    }
    for (let y = 344; y < 423; y += 3.5)
      for (const dx of [-0.3, 0.3])
        beam(
          out,
          'metal',
          [c[0] + dx, y, c[1] - 1.8],
          [c[0] + dx, y + 3.5, c[1] - 1.8],
          0.045,
          0.045,
          [0.43, 0.46, 0.44],
        );
  }
  // Fixed neutral/rest position of the south-facing94th-floor TILT assembly.
  const south = ring(313.8)[1][2];
  box(
    out,
    'recess',
    [-5.4, 313.8, south - 0.05],
    [5.4, 317.15, south + 0.15],
    [0.045, 0.05, 0.045],
  );
  for (let i = 0; i < 8; i++)
    panel(
      out,
      [
        [-5.2 + i * 1.3, 313.95, south + 0.18],
        [-3.96 + i * 1.3, 313.95, south + 0.18],
        [-3.96 + i * 1.3, 316.98, south + 0.18],
        [-5.2 + i * 1.3, 316.98, south + 0.18],
      ],
      [0.23, 0.3, 0.29],
      0.08,
      bronze,
    );
}

function theatreFrontage(out, cx) {
  const w = 85.9 * 0.3048,
    z = -31.1,
    clay = [0.48, 0.23, 0.17],
    cream = [0.83, 0.78, 0.65],
    dark = [0.07, 0.09, 0.09];
  box(out, 'stone', [cx - w / 2, 0, z], [cx + w / 2, 0.4, z + 0.55], [0.38, 0.4, 0.38]);
  box(out, 'concrete', [cx - w / 2, 0.4, z], [cx + w / 2, 4.15, z + 0.55], cream);
  box(out, 'brick', [cx - w / 2, 4.15, z], [cx + w / 2, 13.1, z + 0.55], clay);
  const arch = (x, y, width, height, glazed) => {
    const r = width / 2,
      spring = y + height - r;
    box(
      out,
      glazed ? 'glass' : 'recess',
      [x - r, y, z - 0.05],
      [x + r, spring, z - 0.015],
      glazed ? [0.13, 0.17, 0.17] : [0.21, 0.12, 0.1],
    );
    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * i) / 20,
        b = (Math.PI * (i + 1)) / 20;
      tri(
        out,
        glazed ? 'glass' : 'recess',
        [
          [x, spring, z - 0.06],
          [x + r * Math.cos(b), spring + r * Math.sin(b), z - 0.06],
          [x + r * Math.cos(a), spring + r * Math.sin(a), z - 0.06],
        ],
        [0.14, 0.17, 0.17],
      );
      beam(
        out,
        'concrete',
        [x + (r + 0.11) * Math.cos(a), spring + (r + 0.11) * Math.sin(a), z - 0.13],
        [x + (r + 0.11) * Math.cos(b), spring + (r + 0.11) * Math.sin(b), z - 0.13],
        0.15,
        0.17,
        cream,
      );
    }
    box(
      out,
      'concrete',
      [x - r - 0.22, y - 0.14, z - 0.17],
      [x + r + 0.22, y + 0.04, z - 0.04],
      cream,
    );
    box(
      out,
      'concrete',
      [x - 0.14, y + height - 0.12, z - 0.25],
      [x + 0.14, y + height + 0.28, z - 0.03],
      cream,
    );
    if (glazed) {
      for (const dx of [-0.5, 0, 0.5])
        beam(
          out,
          'metal',
          [x + dx, y, z - 0.09],
          [x + dx, spring + 0.72, z - 0.09],
          0.04,
          0.055,
          dark,
        );
      for (let hy = y + 0.6; hy < spring + 0.1; hy += 0.55)
        beam(out, 'metal', [x - r, hy, z - 0.09], [x + r, hy, z - 0.09], 0.04, 0.055, dark);
    }
  };
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * 3.45;
    box(out, 'recess', [x - 1.12, 0.42, z - 0.035], [x + 1.12, 3.55, z - 0.01], dark);
    for (const dx of [-1.04, 0, 1.04])
      beam(
        out,
        'metal',
        [x + dx, 0.43, z - 0.08],
        [x + dx, 3.5, z - 0.08],
        0.07,
        0.07,
        [0.32, 0.33, 0.28],
      );
    box(out, 'concrete', [x - 1.35, 3.55, z - 0.22], [x + 1.35, 3.83, z - 0.02], cream);
    panel(
      out,
      [
        [x + 1, 4.75, z - 0.08],
        [x - 1, 4.75, z - 0.08],
        [x - 1, 7.06, z - 0.08],
        [x + 1, 7.06, z - 0.08],
      ],
      [0.13, 0.17, 0.17],
      0.07,
      dark,
    );
    for (const dx of [-0.5, 0, 0.5])
      beam(out, 'metal', [x + dx, 4.75, z - 0.11], [x + dx, 7.06, z - 0.11], 0.04, 0.055, dark);
    for (const y of [5.33, 5.9, 6.48])
      beam(out, 'metal', [x - 1, y, z - 0.11], [x + 1, y, z - 0.11], 0.04, 0.055, dark);
    arch(x, 8.05, 2.05, 3.25, Math.abs(i) < 2);
    for (const y of [4.43, 5.18])
      beam(out, 'metal', [x - 1.45, y, z - 0.45], [x + 1.45, y, z - 0.45], 0.05, 0.055, dark);
    for (let dx = -1.4; dx <= 1.41; dx += 0.23)
      beam(out, 'metal', [x + dx, 4.43, z - 0.45], [x + dx, 5.18, z - 0.45], 0.028, 0.033, dark);
  }
  for (const dx of [-8.625, -5.175, -1.725, 1.725, 5.175, 8.625]) {
    box(out, 'brick', [cx + dx - 0.21, 4.2, z - 0.17], [cx + dx + 0.21, 12.8, z - 0.02], clay);
    box(out, 'concrete', [cx + dx - 0.37, 4.05, z - 0.3], [cx + dx + 0.37, 4.45, z + 0.01], cream);
    box(
      out,
      'concrete',
      [cx + dx - 0.42, 12.65, z - 0.35],
      [cx + dx + 0.42, 13.15, z + 0.01],
      cream,
    );
    for (let x = -0.32; x < 0.33; x += 0.16)
      tube(
        out,
        'concrete',
        [cx + dx + x, 12.6, z - 0.35],
        [cx + dx + x, 13.13, z - 0.35],
        0.046,
        cream,
        8,
      );
  }
  for (const sign of [-1, 1]) {
    const x = cx + sign * 10.85;
    arch(x, 0.48, 2.85, 3.2, false);
    arch(x, 5.25, 2.1, 3.7, false);
    loft(
      out,
      'concrete',
      [
        [5.32, 0.3],
        [5.55, 0.28],
        [5.65, 0.18],
        [6.25, 0.52],
        [6.58, 0.37],
        [6.73, 0.43],
        [6.85, 0.23],
        [7.15, 0.1],
      ].map(([y, r]) => radialRing(y, r, r, 24, [x, z - 0.31])),
      cream,
    );
    tube(out, 'concrete', [x, 10.95, z - 0.15], [x, 10.95, z - 0.28], 0.69, cream, 40);
    for (const sx of [-1, 1])
      box(
        out,
        'metal',
        [x + sx * 1.75 - 0.13, 2.8, z - 0.35],
        [x + sx * 1.75 + 0.13, 3.45, z - 0.1],
        dark,
      );
    for (let i = 0; i < 2; i++)
      beam(
        out,
        'concrete',
        [x + (i === 0 ? -1.9 : 0), 14.35 + (i === 0 ? 0 : 1.13), z - 0.22],
        [x + (i === 0 ? 0 : 1.9), 14.35 + (i === 0 ? 1.13 : 0), z - 0.22],
        0.3,
        0.35,
        cream,
      );
  }
  for (const [y, h, projection] of [
    [13.12, 0.65, 0.22],
    [13.77, 0.16, 0.41],
    [13.93, 0.13, 0.48],
    [14.06, 0.22, 0.31],
  ])
    box(out, 'concrete', [cx - w / 2, y, z - projection], [cx + w / 2, y + h, z + 0.05], cream);
  for (let x = cx - w / 2 + 0.12; x < cx + w / 2; x += 0.28)
    box(out, 'concrete', [x, 13.57, z - 0.32], [x + 0.14, 13.78, z - 0.12], cream);
  box(out, 'brick', [cx - w / 2, 14.28, z], [cx + w / 2, 14.95, z + 0.45], clay);
  box(out, 'concrete', [cx - w / 2, 14.95, z - 0.08], [cx + w / 2, 15.11, z + 0.5], cream);
  box(out, 'metal', [cx - 5.55, 3.38, z - 2.1], [cx + 5.55, 3.86, z - 0.15], [0.18, 0.21, 0.2]);
  for (const x of [cx - 5, cx + 5])
    tube(out, 'metal', [x, 3.72, z - 1.9], [x, 5.1, z - 0.08], 0.028, [0.33, 0.34, 0.3], 8);
}

function buildBankAmerica(out, m) {
  const key = 'n0165_bank_of_america_tower',
    tint = [0.42, 0.54, 0.59],
    trim = [0.7, 0.75, 0.75],
    features = partsEvidence(key);
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.2, [0.35, 0.38, 0.38]);
  for (const p of features.filter(
    (p) => p.tags['building:part'] === 'yes' && p.tags.height && p.id !== 260153997,
  )) {
    const plan = cleanPlan(partPlan(m, p), 0.015),
      height = +p.tags.height,
      rise = +(p.tags['roof:height'] ?? 0),
      theta = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
    const e = Math.sin(theta),
      s = -Math.cos(theta),
      dir = [
        e * Math.cos(m.heading) - s * Math.sin(m.heading),
        e * Math.sin(m.heading) + s * Math.cos(m.heading),
      ];
    const projections = plan.map((q) => q[0] * dir[0] + q[1] * dir[1]),
      lo = Math.min(...projections),
      span = Math.max(...projections) - lo;
    const roof = (q) => height - (rise ? (rise * (q[0] * dir[0] + q[1] * dir[1] - lo)) / span : 0);
    for (const { a, b } of edges(plan)) {
      facetedGlazing(
        out,
        [
          [a[0], 0.2, a[1]],
          [b[0], 0.2, b[1]],
          [b[0], roof(b), b[1]],
          [a[0], roof(a), a[1]],
        ],
        { tint, trim },
      );
      beam(out, 'metal', [a[0], roof(a), a[1]], [b[0], roof(b), b[1]], 0.12, 0.14, trim);
    }
    if (rise) {
      const polygon = plan.map((q) => [q[0], roof(q), q[1]]).toReversed();
      facetedGlazing(out, polygon, { tint: tint.map((v) => v + 0.04), trim });
    } else mappedCap(out, 'metal', plan, height, [0.45, 0.5, 0.48]);
  }
  // Published welded-pipe mast diameters: 5 ft 10 in at the base to 2 ft 2 in at the tip.
  const mastPlan = partPlan(m, part(key, 260153997)),
    center = [0, 0];
  for (const q of mastPlan) {
    center[0] += q[0] / mastPlan.length;
    center[1] += q[1] / mastPlan.length;
  }
  loft(
    out,
    'metal',
    [
      [246, 0.889],
      [279, 0.889],
      [311, 0.67],
      [342, 0.46],
      [365.8, 0.3302],
    ].map(([y, r]) => radialRing(y, r, r, 32, center)),
    [0.8, 0.81, 0.78],
  );
  for (let y = 280; y < 364; y += 8.5)
    loft(
      out,
      'metal',
      [
        radialRing(y, 1.01 - (y - 280) * 0.006, 1.01 - (y - 280) * 0.006, 24, center),
        radialRing(y + 0.16, 1.01 - (y - 280) * 0.006, 1.01 - (y - 280) * 0.006, 24, center),
      ],
      trim,
    );
  for (const x of [center[0] - 1.4, center[0] + 1.4])
    beam(out, 'metal', [x, 241, center[1] - 1.3], [center[0], 278, center[1]], 0.19, 0.22, trim);
  // Mechanical plant sits inside the two mapped roof wells below the surrounding crystal screen.
  for (const [x, z, y] of [
    [15, 3, 240],
    [31, 5, 240],
    [15, -13, 236],
    [35, -12, 236],
  ]) {
    box(out, 'metal', [x - 3, y, z - 2], [x + 3, y + 3, z + 2], [0.44, 0.48, 0.48]);
    for (let h = y + 0.3; h < y + 2.9; h += 0.3)
      beam(
        out,
        'metal',
        [x - 2.9, h, z + 2.01],
        [x + 2.9, h, z + 2.01],
        0.085,
        0.08,
        [0.27, 0.31, 0.31],
      );
  }
  // Seventh-floor planted terrace adjoining the retained theatre volume.
  for (const [x, z] of [
    [-52, 18],
    [-39, 18],
    [-25, 18],
    [-50, -16],
    [-35, -16],
  ])
    planter(out, x, 30, z);
  // Transparent ground-level entry canopy on the Avenue of the Americas frontage.
  box(out, 'glass', [65.2, 4.9, -10], [68.5, 5.15, 11], [0.56, 0.66, 0.66]);
  for (const z of [-8, 0, 8]) tube(out, 'metal', [68, 0, z], [68, 4.9, z], 0.11, trim, 12);
  theatreFrontage(out, -35);
}

function roundedOutline(plan, radius = 2.7, subdivisions = 6) {
  const result = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[(i + plan.length - 1) % plan.length],
      q = plan[i],
      r = plan[(i + 1) % plan.length];
    const d0 = Math.hypot(p[0] - q[0], p[1] - q[1]),
      d1 = Math.hypot(r[0] - q[0], r[1] - q[1]);
    const a = lerp(q, p, Math.min(0.4, radius / d0)),
      b = lerp(q, r, Math.min(0.4, radius / d1));
    for (let j = 0; j <= subdivisions; j++) {
      const t = j / subdivisions;
      result.push(
        [0, 1].map((k) => (1 - t) * (1 - t) * a[k] + 2 * t * (1 - t) * q[k] + t * t * b[k]),
      );
    }
  }
  return result;
}

function buildZifeng(out, m) {
  const key = 'n0168_zifeng_tower',
    plan = roundedOutline(localOutline(m)),
    trim = [0.7, 0.73, 0.73],
    tint = [0.39, 0.51, 0.58];
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.22, [0.32, 0.35, 0.36]);
  const perimeter = edges(plan),
    total = perimeter.reduce((s, e) => s + e.len, 0);
  const roofCells = [],
    seamCells = [];
  let base = 0;
  for (const { a, b, len, n } of perimeter) {
    const nx = Math.max(1, Math.ceil(len / 2.15));
    for (let i = 0; i < nx; i++) {
      const u0 = i / nx,
        u1 = (i + 1) / nx,
        A = lerp(a, b, u0),
        B = lerp(a, b, u1),
        phase = (base + (len * (i + 0.5)) / nx) / total;
      // Dark seams separate the two wrapped glass forms seen in the architect's exterior photographs.
      const vertical = phase > 0.39 && phase < 0.425;
      const top = phase < 0.425 ? 339.25 : 327;
      roofCells.push({ A, B, top });
      if (vertical) seamCells.push({ A, B });
      const ny = Math.ceil(top / 4.05);
      for (let j = 0; j < ny; j++) {
        const y0 = 0.22 + ((top - 0.22) * j) / ny,
          y1 = 0.22 + ((top - 0.22) * (j + 1)) / ny,
          yc = (y0 + y1) / 2;
        const atrium =
          (phase < 0.425 && yc > 156 && yc < 172) ||
          (phase >= 0.425 && yc > 268 && yc < 284) ||
          (yc > 41 && yc < 49);
        const inset = vertical || atrium ? 2.1 : 0;
        const p = [
          [A[0] - n[0] * inset, y0, A[1] - n[2] * inset],
          [B[0] - n[0] * inset, y0, B[1] - n[2] * inset],
          [B[0] - n[0] * inset, y1, B[1] - n[2] * inset],
          [A[0] - n[0] * inset, y1, A[1] - n[2] * inset],
        ];
        if (inset) {
          panel(out, p, [0.15, 0.21, 0.23], 0.075, [0.45, 0.51, 0.53]);
          face(out, 'metal', [p[0], p[1], [B[0], y0, B[1]], [A[0], y0, A[1]]], trim);
          face(out, 'metal', [p[3], [A[0], y1, A[1]], [B[0], y1, B[1]], p[2]], trim);
          if (atrium && i === 0)
            beam(out, 'metal', shift(p[0], n, 1.8), shift(p[3], n, 1.8), 0.38, 0.45, trim);
        } else {
          // Each scale is a genuinely angled glass panel, alternating left/right relief by storey.
          const raised = (i + j) % 2 ? [0, 3] : [1, 2],
            q = p.map((v, k) => shift(v, n, raised.includes(k) ? 0.23 : 0));
          panel(
            out,
            q,
            tint.map((v) => v + ((i + j) % 5 === 0 ? 0.025 : 0)),
            0.055,
            trim,
          );
          for (let k = 0; k < 4; k++) {
            const l = (k + 1) % 4;
            if (raised.includes(k) !== raised.includes(l))
              tri(out, 'metal', raised.includes(k) ? [p[k], p[l], q[k]] : [p[k], p[l], q[l]], trim);
          }
        }
      }
      mappedCap(out, 'metal', [A, B, [0, 0]], top, [0.36, 0.4, 0.42]);
    }
    base += len;
  }
  for (let i = 0; i < roofCells.length; i++) {
    const a = roofCells[(i + roofCells.length - 1) % roofCells.length],
      b = roofCells[i];
    if (a.top === b.top) continue;
    let p = [
      [0, a.top, 0],
      [b.A[0], a.top, b.A[1]],
      [b.A[0], b.top, b.A[1]],
      [0, b.top, 0],
    ];
    if (a.top < b.top) p = p.toReversed();
    face(out, 'metal', p, trim);
  }
  // Exposed vertical mechanical seam: repeated braces with visible separation from the glazing.
  const seamA = seamCells[0].A,
    seamB = seamCells.at(-1).B;
  for (let y = 52; y < 323; y += 16) {
    const a = [seamA[0] * 0.975, y, seamA[1] * 0.975],
      b = [seamB[0] * 0.975, Math.min(y + 13, 326), seamB[1] * 0.975];
    beam(out, 'metal', a, b, 0.3, 0.34, trim);
  }
  // Offset crown: two rounded, open-ended metal fins around a separate spire service mast.
  for (const [cx, cz, r, baseY, topY, phase] of [[-11, -9, 9.3, 327, 381.25, 0.6]]) {
    const count = 48,
      ring = [];
    for (let i = 0; i <= count; i++) {
      const t = phase - (i / count) * Math.PI * 1.65;
      ring.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]);
    }
    for (let i = 0; i < count; i++) {
      const a = ring[i],
        b = ring[i + 1],
        ta = topY - 7 * (1 - Math.sin((i / count) * Math.PI)),
        tb = topY - 7 * (1 - Math.sin(((i + 1) / count) * Math.PI));
      const h = Math.min(ta, tb);
      grid(
        out,
        [
          [a[0], baseY, a[1]],
          [b[0], baseY, b[1]],
          [b[0], h, b[1]],
          [a[0], h, a[1]],
        ],
        [0.38, 0.44, 0.47],
        1.4,
        2,
        0.065,
        trim,
      );
      if (Math.abs(ta - tb) > 0.001)
        tri(
          out,
          'metal',
          ta > tb
            ? [
                [a[0], h, a[1]],
                [b[0], h, b[1]],
                [a[0], ta, a[1]],
              ]
            : [
                [a[0], h, a[1]],
                [b[0], h, b[1]],
                [b[0], tb, b[1]],
              ],
          trim,
        );
      beam(out, 'metal', [a[0], ta, a[1]], [b[0], tb, b[1]], 0.28, 0.32, trim);
      const ia = [cx + (a[0] - cx) * 0.96, cz + (a[1] - cz) * 0.96],
        ib = [cx + (b[0] - cx) * 0.96, cz + (b[1] - cz) * 0.96];
      face(
        out,
        'metal',
        [
          [ia[0], baseY, ia[1]],
          [ia[0], ta, ia[1]],
          [ib[0], tb, ib[1]],
          [ib[0], baseY, ib[1]],
        ],
        [0.35, 0.41, 0.43],
      );
      face(
        out,
        'metal',
        [
          [a[0], ta, a[1]],
          [b[0], tb, b[1]],
          [ib[0], tb, ib[1]],
          [ia[0], ta, ia[1]],
        ],
        trim,
      );
      if (i === 0)
        face(
          out,
          'metal',
          [
            [a[0], baseY, a[1]],
            [a[0], ta, a[1]],
            [ia[0], ta, ia[1]],
            [ia[0], baseY, ia[1]],
          ],
          trim,
        );
      if (i === count - 1)
        face(
          out,
          'metal',
          [
            [b[0], baseY, b[1]],
            [ib[0], baseY, ib[1]],
            [ib[0], tb, ib[1]],
            [b[0], tb, b[1]],
          ],
          trim,
        );
    }
    for (let y = baseY + 1; y < topY - 7; y += 1.25)
      for (let i = 0; i < count; i++)
        beam(
          out,
          'metal',
          [ring[i][0], y, ring[i][1]],
          [ring[i + 1][0], y, ring[i + 1][1]],
          0.045,
          0.06,
          trim,
        );
  }
  const bladeA = [-7, -18],
    bladeB = [21, 0],
    theta = Math.atan2(bladeB[1] - bladeA[1], bladeB[0] - bladeA[0]),
    blade = [];
  for (const [center, start] of [
    [bladeB, theta + Math.PI / 2],
    [bladeA, theta - Math.PI / 2],
  ])
    for (let i = 0; i <= 16; i++) {
      const t = start - (Math.PI * i) / 16;
      blade.push([center[0] + 2.45 * Math.cos(t), center[1] + 2.45 * Math.sin(t)]);
    }
  curtain(out, blade, 327, 370.5, {
    dx: 1.45,
    dy: 4.04,
    tint: [0.47, 0.57, 0.62],
    trim,
    frame: 0.055,
  });
  mappedCap(out, 'metal', blade, 370.5, trim);
  const c = [-5, -7];
  loft(
    out,
    'metal',
    [
      [327, 1.35],
      [384, 1.35],
      [405, 0.95],
      [424, 0.58],
      [449.9, 0.13],
      [450, 0.09],
    ].map(([y, r]) => radialRing(y, r, r, 24, c)),
    [0.76, 0.77, 0.73],
  );
  for (const y of [344, 358, 373]) {
    loft(
      out,
      'metal',
      [radialRing(y, 2.4, 2.4, 32, c), radialRing(y + 0.45, 2.4, 2.4, 32, c)],
      trim,
    );
    beam(out, 'metal', [-11, y, -9], [c[0], y, c[1]], 0.4, 0.45, trim);
  }
  for (let y = 406; y < 426; y += 2.1)
    loft(
      out,
      'metal',
      [radialRing(y, 1.27, 1.27, 24, c), radialRing(y + 0.28, 1.27, 1.27, 24, c)],
      trim,
    );
  const podium = partPlan(m, part(key, 951598027));
  mappedSolid(out, 'foundation', podium, 0, 0.22, [0.32, 0.35, 0.36]);
  curtain(out, podium, 0.22, 44, {
    dx: 2.2,
    dy: 4.4,
    tint: [0.28, 0.34, 0.35],
    frame: 0.28,
    trim: [0.38, 0.4, 0.39],
    slot: 'stone',
  });
  mappedCap(out, 'stone', podium, 44, [0.38, 0.41, 0.39]);
  for (const [x, z] of [
    [-68, 23],
    [-54, 31],
    [-36, 43],
    [8, 38],
  ])
    planter(out, x, 44, z);
}

function buildCitic(out, m) {
  const key = 'n0164_citic_plaza',
    white = [0.83, 0.85, 0.81],
    blue = [0.39, 0.59, 0.62],
    teal = [0.2, 0.44, 0.46];
  const outline = localOutline(m);
  mappedSolid(out, 'foundation', outline, 0, 0.18, [0.38, 0.4, 0.39]);
  curtain(out, outline, 0.18, 17.7, {
    dx: 2.2,
    dy: 5.84,
    tint: [0.17, 0.25, 0.27],
    frame: 0.09,
    trim: [0.28, 0.31, 0.32],
  });
  for (const id of [1548063154, 1548063155, 1548063156, 1548063157]) {
    const p = partPlan(m, part(key, id));
    mappedSolid(out, 'stone', p, 0, 17.7, [0.11, 0.13, 0.14]);
    for (let y = 1.8; y < 17.6; y += 1.8)
      bandPlan(out, p, y, 0.026, 0.015, [0.2, 0.22, 0.22], 'metal');
  }
  const lower = partPlan(m, part(key, 1548063165));
  curtain(out, lower, 17.7, 27, {
    dx: 1.5,
    dy: 3.1,
    tint: [0.14, 0.2, 0.21],
    frame: 0.13,
    trim: [0.3, 0.34, 0.34],
  });
  for (const id of [1548063152, 1548063153]) {
    const p = cleanPlan(partPlan(m, part(key, id)), 0.012);
    curtain(out, p, 27, 321.9, {
      dx: 1.33,
      dy: 3.6,
      tint: blue,
      frame: 0.16,
      trim: white,
      slot: 'cladding',
    });
    for (let i = 0; i <= 82; i++)
      bandPlan(out, p, 27 + (294.9 * i) / 82, 0.27, 0.06, white, 'cladding');
    mappedCap(out, 'metal', p, 321.9, [0.55, 0.61, 0.6]);
  }
  const middle = partPlan(m, part(key, 1548063158));
  curtain(out, middle, 27, 297, {
    dx: 1.32,
    dy: 3.6,
    tint: teal,
    frame: 0.055,
    trim: [0.6, 0.75, 0.73],
  });
  mappedCap(out, 'metal', middle, 297, [0.48, 0.58, 0.57]);
  const crown = partPlan(m, part(key, 1548063159));
  curtain(out, crown, 297, 310.8, { dx: 1.35, dy: 3.45, tint: teal, frame: 0.07, trim: white });
  mappedCap(out, 'metal', crown, 310.8, [0.55, 0.61, 0.6]);
  for (const id of [1548063163, 1548063164]) {
    const p = partPlan(m, part(key, id));
    curtain(out, p, 321.9, 344, { dx: 1.0, dy: 3.68, tint: teal, frame: 0.075, trim: white });
    mappedCap(out, 'metal', p, 344, white);
  }
  // Mapped mast centers and the official architectural top; one OSM tip is 0.9 m too high.
  for (const id of [1548063161, 1548063162]) {
    const p = partPlan(m, part(key, id)),
      c = [0, 0];
    for (const q of p) {
      c[0] += q[0] / p.length;
      c[1] += q[1] / p.length;
    }
    loft(
      out,
      'metal',
      [
        [321.9, 0.73],
        [344, 0.73],
        [358, 0.5],
        [375, 0.28],
        [389.8, 0.065],
        [390.2, 0.035],
      ].map(([y, r]) => radialRing(y, r, r, 20, c)),
      white,
    );
    for (let y = 346; y < 375; y += 4.8)
      loft(
        out,
        'metal',
        [radialRing(y, 0.58, 0.58, 16, c), radialRing(y + 0.13, 0.58, 0.58, 16, c)],
        white,
      );
  }
  // Original solid-stroke geometry for the mapped 中信 rooftop sign, not a copied image.
  const stroke = (x1, y1, x2, y2, w = 0.9) =>
    beam(out, 'metal', [x1, y1, 0], [x2, y2, 0], w, 0.36, white);
  for (const [x1, y1, x2, y2] of [
    [-14, 333.5, -14, 341],
    [-14, 341, -5.3, 341],
    [-5.3, 341, -5.3, 333.5],
    [-5.3, 333.5, -14, 333.5],
    [-9.7, 330, -9.7, 344],
  ])
    stroke(x1, y1, x2, y2);
  for (const [x1, y1, x2, y2] of [
    [3.1, 343.7, -0.4, 337.9],
    [1.2, 340, 1.2, 330],
    [8.6, 344, 10, 342.8],
    [4.7, 341.1, 15.2, 341.1],
    [5.5, 338.9, 14.4, 338.9],
    [5.5, 336.7, 14.4, 336.7],
    [5.5, 334.7, 14.4, 334.7],
    [5.5, 334.7, 5.5, 330.5],
    [14.4, 334.7, 14.4, 330.5],
    [5.5, 330.5, 14.4, 330.5],
  ])
    stroke(x1, y1, x2, y2, 0.75);
  beam(out, 'metal', [-16.7, 330, 0], [16.7, 330, 0], 0.23, 0.25, [0.39, 0.47, 0.47]);
  for (const z of [-23.96, 23.96]) {
    box(out, 'metal', [-6, 4.3, z - 1.5], [6, 4.55, z + 1.5], white);
    for (const x of [-5.5, 5.5])
      tube(
        out,
        'metal',
        [x, 0, z + Math.sign(z) * 1.2],
        [x, 4.3, z + Math.sign(z) * 1.2],
        0.11,
        white,
        10,
      );
  }
}

export const skylineGlobal = [
  {
    id: 'N0175',
    key: 'almas_tower',
    wikidataId: 'Q838780',
    title: 'Almas Tower',
    height: 360,
    build: buildAlmas,
    mapFrame: 'map-frame.json',
    brief:
      'Dubai’s paired clipped-ellipse tower, with two different-height curved glazed shafts, broad silver end blades, sloping crowns, a measured81 m elliptical spire and eight individually framed projecting diamond-shaped podium wings.',
    sourceFacts: {
      heightMeters: 360,
      typicalFloorplateMeters: [64, 42],
      floorToFloorMeters: 4,
      plantFloorHeightsMeters: [42, 121, 212, 279],
      spireHeightMeters: 81,
      spireLowerSectionMeters: 58,
      spireUpperSectionMeters: 23,
      spireLowerEllipseMeters: [3.4, 7.4],
      spireUpperEllipseMeters: [1.5, 4.3],
      spireConcreteUpstandMeters: 21,
      podiumPetals: 8,
      diamondExchangeRoofFeatureMeters: 20.85,
      diamondExchangeFourthFloorMeters: 18.6,
      architectAndEngineer: 'Atkins',
      contractor: 'Arabian Construction Company',
    },
    reconstruction: {
      tower:
        'Published64×42 m plan reconstructed as two offset parallel clipped ellipses. The poorly traced map shaft does not override the engineer’s actual plan.',
      podium:
        'Eight primary figure9 tips fitted without reflection to the full mapped podium. Primary-plan orientation is retained; overall tip registration RMS is2.09 m per coordinate.',
      heights:
        '232 m lower occupied shaft with240 m sloping crown;279 m upper plant floor and21 m blade upstand. Measured81 m elliptical mast reaches360 m.',
      facade:
        '4 m floor bands, individual glass panes, mechanical levels, end blade slots and triangulated projecting podium glazing.',
    },
    refs: [
      'https://www.atkinsrealisusn.com/~/media/Files/R/Renaissance/download-centre/en/technical-journals/technical-journal-06.pdf',
      'https://accgroup.com/our_projects/almas-towers-dubai/',
      'https://www.skyscrapercenter.com/building/almas-tower/298',
      'https://www.openstreetmap.org/way/1137607706',
    ],
    nativeAxes: {
      up: '+Y',
      longitudinal: '+X is image-right in Atkins figures2 and9',
      front: '+Z is image-down in those plans',
      origin:
        'Ground-level tower center derived by a signed eight-petal primary-plan/map registration',
    },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Source-local map frame binds the primary plan to eight mapped podium tips. The largest diamond-exchange petal points northeast, the lower ellipse lies north, and the tall southern ellipse carries the mast at its clipped right end. Published64×42 m shaft dimensions override the malformed map shaft outline. GroundY0 is the tower/podium entry datum; below-grade cascading landscape is outside this model.',
    }),
    limitations: [
      commonLimit,
      'Ellipse radii, individual glazing bay widths, sloping crown planes and secondary petal elevations are reconstructed from engineer drawings and exterior photographs. The signed podium fit has2.09 m per-coordinate RMS and approximately5% drawing/map scale disagreement. Below-entry landscape terraces, basement parking and fine signage are excluded.',
    ],
    camera: { position: [305, 237, 490], lookAt: [0, 158, 0], fov: 44 },
    qaCameras: [
      { name: 'paired-ellipse-curtain-wall', position: [93, 165, 139], lookAt: [0, 145, 0] },
      { name: 'sloping-crowns-and-mast', position: [105, 332, 104], lookAt: [7, 292, 0] },
      { name: 'diamond-exchange', position: [92, 36, -158], lookAt: [0, 11, -55] },
      { name: 'podium-petals', position: [130, 62, 146], lookAt: [0, 12, 5] },
      { name: 'far-silhouette', position: [-418, 311, 665], lookAt: [0, 155, 0] },
    ],
  },
  {
    id: 'N0174',
    key: 'trump_international_hotel_and_tower',
    wikidataId: 'Q546221',
    title: 'Trump International Hotel and Tower Chicago',
    height: 423.2,
    build: buildTrumpChicago,
    brief:
      'Chicago’s asymmetrically stepped blue-glass tower, with rounded mapped corners, detailed stainless-steel spandrels, three setbacks, terrace rails, radial glass canopy, original riverfront sign lettering and a423.2 m stepped spire.',
    sourceFacts: {
      heightMeters: 423.2,
      occupiedHeightMeters: 340.1,
      marketedStoreys: 92,
      setbackLevels: [16, 29, 51],
      facadeCladding: 'ALPOLIC/fr hairline stainless metal on columns, spandrels and soffits',
      signWidthMeters: 42.672,
      signLevel: 15,
    },
    reconstruction: {
      plan: 'Exact signed whole-building and seven independent upper/antenna outlines',
      floors:
        'Published92 marketed storeys distributed through mapped60/120/200/345 m stages; intermediate map heights are approximate',
      sign: 'Original serif strokes approximate the installed stainless lettering, using the installer’s140ft overall span',
    },
    refs: [
      'https://www.smithgill.com/work/trump_international_hote/',
      'https://www.skyscrapercenter.com/building/building/203',
      'https://store.ctbuh.org/PDF_Previews/Journal/CTBUHJournal_2009-3.pdf',
      'https://alpolic-americas.com/blog/alpolic-used-on-high-rise-high-profile-hotel-in-chicago-by-som/',
      'https://www.spiderstaging.com/casestudies/sign-installation-trump-international-hotel-tower/',
      'https://www.openstreetmap.org/way/64594680',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed ground and upper-part outlines preserve the asymmetric river-facing setbacks and offset mast. Riverfront lettering lies on the mapped southeastern long facade; entrance canopy is on the western Wabash end. Source groundY0 represents the tower entrance datum; the separate descending public riverwalk is outside this asset.',
    }),
    limitations: [
      commonLimit,
      'Fine glazing schedule, canopy ribs, sign letter shapes and restaurant planting are reconstructed. Separate lower riverwalk terraces and circular parking ramp below the entrance datum are excluded. Shared stainless materials require the viewer’s sky reflections for their intended appearance.',
    ],
    camera: { position: [310, 260, 540], lookAt: [0, 190, 0], fov: 44 },
    qaCameras: [
      { name: 'curtain-wall-and-setbacks', position: [125, 186, 157], lookAt: [0, 130, 0] },
      { name: 'riverfront-sign', position: [-5, 59, 122], lookAt: [-9, 54, 0] },
      { name: 'rounded-crown-and-spire', position: [76, 386, 103], lookAt: [0, 370, 0] },
      { name: 'wabash-canopy', position: [-91, 22, -7], lookAt: [-44, 8, -8] },
      { name: 'far-silhouette', position: [-420, 341, 720], lookAt: [0, 193, 0] },
    ],
  },
  {
    id: 'N0173',
    key: 'torre_glories',
    wikidataId: 'Q336246',
    title: 'Torre Glòries',
    height: 144.4,
    build: buildGlories,
    brief:
      'Barcelona’s elliptical glazed tower with a curved crown, individually colored metal pixels,4,500 recessed window cells, separate tilted glass sunshades and a framed pale-glass dome.',
    sourceFacts: {
      heightMeters: 144.4,
      windowOpenings: 4500,
      claddingModuleApproxMeters: [0.9, 0.9],
      claddingColors: 25,
      architect: 'Ateliers Jean Nouvel with b720',
      facadeFinish: 'Polyester-coated aluminum and stainless steel',
      upperStructure: 'Steel meridians and parallels carrying a glazed dome',
    },
    reconstruction: {
      plan: 'Exact-QID elliptical footprint fixes center, major/minor diameter and signed plan heading',
      facade:
        'Twenty-five tint families progress irregularly from red to blue behind separate glass louvres; original deterministic layout reconstructs the composition rather than reproducing a facade photograph',
      profile:
        'Vertical lower cylinder transitions continuously into an elliptical crown; upper concrete shell ends at115 m',
    },
    refs: [
      'https://www.jeannouvel.com/en/projects/tour-agbar/',
      'https://www.prepaintedmetal.eu/en/collection/torre-agbar',
      'https://www.pedelta.com/structural-review-of-the-dome-of-agbar-tower-p-45-en',
      'https://www.openstreetmap.org/way/44213122',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed elliptical footprint controls center and the long axis, with source groundY0. Reconstructed pixel art and solar louvre angles preserve the facade character; these small-scale distributions do not claim an exact as-built panel schedule. External pavilion and below-grade auditorium are excluded.',
    }),
    limitations: [
      commonLimit,
      'Individual color/window placement, intermediate dome curvature, glass angles and support schedules are reconstructed from architect and supplier references. The4,500 modeled window cells preserve the published quantity but are not a surveyed opening map. Night lighting, below-grade auditorium and external entrance pavilion are excluded.',
    ],
    camera: { position: [133, 100, 204], lookAt: [0, 68, 0], fov: 44 },
    qaCameras: [
      { name: 'red-pixels-and-louvres', position: [37, 26, 48], lookAt: [0, 24, 0] },
      { name: 'blue-facade', position: [34, 87, 47], lookAt: [0, 80, 0] },
      { name: 'glazed-crown', position: [44, 154, 63], lookAt: [0, 126, 0] },
      { name: 'ground-contact', position: [61, 14, 65], lookAt: [0, 9, 0] },
      { name: 'far-silhouette', position: [-181, 146, 322], lookAt: [0, 67, 0] },
    ],
  },
  {
    id: 'N0171',
    key: '875_north_michigan_avenue',
    wikidataId: 'Q217727',
    title: '875 North Michigan Avenue',
    height: 456.9,
    build: buildHancock,
    brief:
      'Chicago’s tapering dark-bronze trussed tube with individually framed windows, projecting perimeter columns, continuous large diagonal diamonds, mapped roof plant and twin red-white broadcast masts.',
    sourceFacts: {
      architecturalHeightMeters: 343.7,
      tipHeightMeters: 456.9,
      mainRoofMeters: 337.4136,
      structuralBaseMeters: [80.772, 50.292],
      structuralRoofMeters: [48.768, 30.48],
      floors: 100,
      architect: 'Bruce Graham / SOM',
      engineer: 'Fazlur Khan / SOM',
    },
    reconstruction: {
      plan: 'Exact signed ground and top outlines retain the gentle four-face taper; independent penthouse and antenna parts fix the roof arrangement',
      structure:
        'Separate deep diagonals, raised flange strips, corner columns and ties follow the built closed-diamond exterior',
      heightDatum:
        'Published1,107 ft main roof,343.7 m architectural top and456.9 m highest broadcast tip replace contradictory OSM roof-height tags',
    },
    refs: [
      'https://www.som.com/projects/875-north-michigan-avenue-formerly-john-hancock-center/',
      'https://www.bscesjournal.org/wp-content/uploads/CEP-Vol-19-No-2-02.pdf',
      'https://www.skyscrapercenter.com/building/john-hancock-center/345',
      'https://360chicago.com/articles/news-and-press/360-chicago-announces-the-debut-of-tilt',
      'https://www.openstreetmap.org/way/31064573',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed ground and upper plans preserve the east-west long axis. Separate penthouse and antenna footprints locate both masts; the operator identifies TILT on the south facade. SourceY0. Structural dimensions are slightly inside the mapped outer cladding envelope.',
    }),
    limitations: [
      commonLimit,
      'Intermediate floor heights, bracing joint heights, member widths and broadcast-platform equipment are reconstructed from published diagrams/photos. TILT is static in its resting position; below-grade plaza and planned future observation alterations are excluded.',
    ],
    camera: { position: [302, 283, 498], lookAt: [0, 203, 0], fov: 44 },
    qaCameras: [
      { name: 'exterior-diagonals', position: [99, 160, 114], lookAt: [0, 137, 0] },
      { name: 'upper-diamond', position: [103, 345, 107], lookAt: [0, 307, 0] },
      { name: 'broadcast-masts', position: [87, 404, 97], lookAt: [0, 392, 0] },
      { name: 'ground-contact', position: [117, 26, 130], lookAt: [0, 18, 0] },
      { name: 'far-silhouette', position: [-422, 372, 755], lookAt: [0, 213, 0] },
    ],
  },
  {
    id: 'N0169',
    key: 'mercury_city_tower',
    wikidataId: 'Q59483',
    title: 'Mercury City Tower',
    height: 338.824,
    build: buildMercury,
    brief:
      'Moscow’s copper-gold stepped tower with seven individually mapped sloped volumes, white folded edge bands, dense unitized glass, upper media screens and its pointed street entrance.',
    sourceFacts: {
      heightMeters: 338.824,
      floors: 75,
      facadeAreaSquareMeters: 75000,
      facadeFabricator: 'Shenyang Yuanda',
      architect: 'Frank Williams with Mikhail Posokhin',
      metalFinish: 'RAL9016 PVDF aluminum',
      mediaFacadeFloors: [67, 68],
      mediaFacadeAreaSquareMeters: 1350,
    },
    reconstruction: {
      plan: 'Exact-QID tower outline and seven signed building parts determine each setback, angled roof and eastern nose',
      facade:
        'Individual copper glazing cells with dark joints and white aluminum perimeter bands, reconstructed from four owner photos',
      roof: 'Mapped roof compass directions330/150 degrees retain each opposing slope',
    },
    refs: [
      'https://www.mercury-city.com/en/about/architecture/',
      'https://www.mercury-city.com/en/mediafacade/',
      'https://www.yuandacn.com/index.php/en/projects-cn-2/146-overseas/europe/russia/337-mercury-city-tower-2.html',
      'https://www.skyscrapercenter.com/building/wd/265',
      'https://www.openstreetmap.org/way/52929368',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed exact-QID outline plus seven separately mapped heights, stepped plan boundaries and roof directions retain the west-to-east rise and pointed eastern end. SourceY0; architectural top338.824 m follows the facade fabricator.',
    }),
    limitations: [
      commonLimit,
      'Individual glazing pitch, white-band widths and LED screen vertical datum are reconstructed from owner photographs. Screens show an unlit neutral face; advertisements, interiors and temporary entrance decorations are excluded.',
    ],
    camera: { position: [258, 234, 394], lookAt: [0, 153, 0], fov: 44 },
    qaCameras: [
      { name: 'copper-glazing', position: [87, 142, 111], lookAt: [6, 120, 0] },
      { name: 'sloped-setbacks', position: [-112, 227, 129], lookAt: [-18, 176, 0] },
      { name: 'crown-and-media', position: [89, 344, 103], lookAt: [15, 307, 0] },
      { name: 'pointed-entrance', position: [94, 18, 44], lookAt: [40, 8, 0] },
      { name: 'far-silhouette', position: [-351, 300, 601], lookAt: [0, 157, 0] },
    ],
  },
  {
    id: 'N0165',
    key: 'bank_of_america_tower',
    wikidataId: 'Q328505',
    title: 'Bank of America Tower',
    height: 365.8,
    build: buildBankAmerica,
    brief:
      'One Bryant Park’s asymmetric crystalline glass tower with individually mapped tapered corner planes and sloping crown screens, planted lower roof, long welded-pipe spire and retained neo-Georgian Stephen Sondheim Theatre frontage.',
    sourceFacts: {
      heightMeters: 365.8,
      floors: 55,
      architect: 'COOKFOX',
      engineer: 'Severud Associates',
      typicalFloorHeightMeters: 4.4196,
      spirePipeBaseDiameterMeters: 1.778,
      spirePipeTipDiameterMeters: 0.6604,
      retainedTheatreFrontageMeters: 26.18232,
    },
    reconstruction: {
      plan: 'Exact-QID whole-building outline plus individually mapped glazed wedge facets, roof wells, podium wings and offset spire',
      facade:
        'Horizontal4.4196 m storey grid is clipped independently to each mapped sloping facade plane',
      heightDatum: '365.8 m CTBUH architectural height overrides rounded366 m map tag',
    },
    refs: [
      'https://www.durst.org/properties/one-bryant-park',
      'https://www.durst.org/pdf/obp.pdf',
      'https://www.skyscrapercenter.com/building/bank-of-america-tower/291',
      'https://www.openstreetmap.org/way/86121621',
      'https://s-media.nyc.gov/agencies/lpc/lp/1357.pdf',
      'https://rerecord.library.columbia.edu/pdf_files/ldpd_7031148_058_57.pdf',
      'https://www.roundabouttheatre.org/theatre/stephen-sondheim-theatre/',
      'https://michaelminn.net/newyork/theatres/broadway-theatres/henry-millers-theatre/index.html',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed whole-block outline and fourteen mapped parts define the tower at the eastern end, each tapered corner roof direction, independent crown screens and offset spire. The theatre frontage faces43rd Street at localX−35 m, corroborated by exact-QID venue node1752843998 and an independent on-site photographer coordinate. SourceY0; roof wells and terrace equipment remain inside their mapped volume.',
    }),
    limitations: [
      commonLimit,
      'Curtain-wall bay pitch, exposed service equipment and small entry canopy are reconstructed. The retained theatre models five central bays, side pavilions, arches, urns, brick pilasters and projecting cornices; figure reliefs and lettering are excluded, and the shared brick graph approximates the historic bond.',
    ],
    camera: { position: [316, 243, 445], lookAt: [8, 160, 0], fov: 44 },
    qaCameras: [
      { name: 'crystal-facets', position: [143, 193, 125], lookAt: [26, 157, 0] },
      { name: 'crown-screens', position: [139, 309, 116], lookAt: [26, 255, 0] },
      { name: 'spire', position: [90, 337, 99], lookAt: [27, 308, 6] },
      { name: 'terrace-and-lobby', position: [146, 58, 134], lookAt: [-2, 21, 0] },
      { name: 'retained-theatre', position: [-29, 12, -69], lookAt: [-35, 8, -31] },
      { name: 'far-silhouette', position: [-373, 312, 661], lookAt: [8, 168, 0] },
    ],
  },
  {
    id: 'N0168',
    key: 'zifeng_tower',
    wikidataId: 'Q382121',
    title: 'Zifeng Tower',
    height: 450,
    build: buildZifeng,
    brief:
      'The Nanjing tower’s rounded triangular shaft with individually angled glass scales, staggered deep atrium bands, exposed seam braces, two curved crown fins and its separate ringed450 m spire.',
    sourceFacts: {
      heightMeters: 450,
      occupiedHeightMeters: 316.6,
      observatoryHeightMeters: 271.8,
      architect: 'Adrian Smith at SOM',
      facade:
        'Two interlocking dragon forms with staggered angled glass panes and clear-glass atria',
    },
    reconstruction: {
      plan: 'Exact-QID signed ground outline, rounded corner interpolation and independently mapped44 m podium',
      exterior:
        'Architect photographs nanjing_01 through04 establish staggered reflective scales, deep horizontal seams, curved crown and offset ringed mast',
      heightDatum: 'Built450 m CTBUH height replaces the earlier458 m design text',
    },
    refs: [
      'https://www.smithgill.com/work/zifeng_tower/',
      'https://www.skyscrapercenter.com/building/zifeng-tower/165',
      'https://www.swagroup.com/projects/zifeng-tower-nanjing/',
      'https://swacdn.s3.amazonaws.com/1/41a6271b_zifengtower-nanjinggreenland.pdf',
      'https://www.openstreetmap.org/way/140809508',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID signed triangular tower and separately mapped podium retain site alignment and groundY0. The facade seam and crown compass phase are reconstructed from street photographs and remain a specific verification item.',
    }),
    limitations: [
      commonLimit,
      'Horizontal seam heights, corner radii, crown profile and facade/crown compass phase are reconstructed from the architect photo set. Fine lettering, nighttime lighting and the separate office annex are excluded.',
    ],
    camera: { position: [319, 285, 532], lookAt: [0, 202, 0], fov: 44 },
    qaCameras: [
      { name: 'angled-glass-scales', position: [70, 149, 75], lookAt: [0, 129, 0] },
      { name: 'atrium-seam', position: [86, 183, -116], lookAt: [0, 165, 0] },
      { name: 'curved-crown', position: [69, 394, 99], lookAt: [0, 361, 0] },
      { name: 'podium', position: [111, 72, 133], lookAt: [-24, 30, 7] },
      { name: 'far-silhouette', position: [-438, 367, 780], lookAt: [0, 208, 0] },
    ],
  },
  {
    id: 'N0164',
    key: 'citic_plaza',
    wikidataId: 'Q245246',
    title: 'CITIC Plaza',
    height: 390.2,
    build: buildCitic,
    mapFrame: 'map-frame.json',
    brief:
      'Guangzhou’s square pale-glass office tower with a teal central slot, independently mapped split crown, round inner roof drum, original geometric 中信 sign and paired390.2 m white masts.',
    sourceFacts: {
      heightMeters: 390.2,
      occupiedHeightMeters: 296.9,
      floors: 80,
      architect: 'Dennis Lau & Ng Chun Man',
      structure: 'Reinforced concrete',
      primaryPhoto: 'Project quantity surveyor Davis Langdon & Seah, company profile page63',
    },
    reconstruction: {
      plan: 'Source-local signed47.65 m tower outline and fourteen independent mapped facade/crown components',
      roof: 'Mapped297 m inner office roof,310.8 m round crown,321.9 m split facade tips,344 m sign and mast supports',
      scope:
        'Main office tower; separate apartment towers and retail arcade remain outside this asset',
    },
    refs: [
      'https://www.skyscrapercentre.com/building/citic-plaza/242',
      'https://www.building.com.hk/comprofile/20090813dls.pdf',
      'https://www.hkexnews.hk/listedco/listconews/sehk/2010/0826/ltn20100826271.pdf',
      'https://www.openstreetmap.org/way/926228208',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Source-local tower frame uses the office outline and independent split facade, sign and east/west masts. The south-facing Sports Centre photo corroborates the central teal opening between pale sides. OSM has no exact-QID tag; identity is reviewed by unique component geometry and the mapped 中信 inscription. BaseY0.',
    }),
    limitations: [
      commonLimit,
      'Curtain-wall subdivisions, small canopy dimensions and sign stroke outlines are reconstructed. One OSM mast says391.1 m; both follow the published390.2 m architectural top. Two apartment towers and retail podium are excluded.',
    ],
    camera: { position: [292, 252, 472], lookAt: [0, 176, 0], fov: 44 },
    qaCameras: [
      { name: 'split-crown', position: [71, 344, 99], lookAt: [0, 318, 0] },
      { name: 'mast-and-sign', position: [44, 357, 96], lookAt: [0, 351, 0] },
      { name: 'pale-curtain-wall', position: [65, 155, 76], lookAt: [0, 137, 0] },
      { name: 'dark-base', position: [63, 21, 69], lookAt: [0, 14, 0] },
      { name: 'far-silhouette', position: [-386, 310, 660], lookAt: [0, 181, 0] },
    ],
  },
  {
    id: 'N0167',
    key: 'shun_hing_square',
    wikidataId: 'Q236201',
    title: 'Shun Hing Square',
    height: 384,
    build: buildShunHing,
    brief:
      'The green-glazed Shenzhen tower with two full-height cylindrical side shafts, cream horizontal bands on a rectangular center, vertical inset upper panels, rounded stepped syringe crowns and twin slender384 m spires.',
    sourceFacts: {
      heightMeters: 384,
      occupiedHeightMeters: 298,
      floors: 69,
      structuralFacade:
        'Rectangular center with circular side cylinders and twin syringe-like crowns',
      primaryPhotographicReference: 'Nippon Steel engineering brochure pages8–9',
    },
    reconstruction: {
      plans:
        'Exact whole-tower and separately mapped curved central volume; two independent mast outlines establish cylinder centers and crown axis',
      crown:
        'Photographed rounded stepped crowns reconstructed to334 m mast start;50 m upper spires use mapped height datum',
      scope: 'Main tower and attached short entrance podium; separate35-storey annex excluded',
    },
    refs: [
      'https://www.skyscrapercenter.com/building/shun-hing-square/258',
      'https://www.eng.nipponsteel.com/files_publish/page/131/Special%20Steel%20Structure.pdf',
      'https://www.rlb.com/wp-content/uploads/sites/5/2020/09/RLB-Tall-Buildings-Global1.pdf',
      'https://www.openstreetmap.org/way/64601041',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed rectangular/cylindrical footprint and separately mapped twin masts retain center, long axis and front/back phase. The low entrance footprint attaches on its mapped side. GroundY0.',
    }),
    limitations: [
      commonLimit,
      'Rounded crown layer heights, stripe widths and inset upper glazing schedule are reconstructed from the fabricator exterior photo. Corporate signs, nighttime lasers and the separate apartment annex are excluded.',
    ],
    camera: { position: [294, 255, 470], lookAt: [0, 176, 0], fov: 44 },
    qaCameras: [
      { name: 'twin-crowns', position: [90, 344, 102], lookAt: [0, 321, 0] },
      { name: 'horizontal-bands', position: [71, 171, 87], lookAt: [0, 152, 17] },
      { name: 'cylinder-glazing', position: [94, 87, 70], lookAt: [23, 80, 0] },
      { name: 'entrance-podium', position: [96, 18, 99], lookAt: [0, 13, 15] },
      { name: 'far-silhouette', position: [-416, 314, 675], lookAt: [0, 181, 0] },
    ],
  },
  {
    id: 'N0166',
    key: 'kingdom_centre',
    wikidataId: 'Q656743',
    title: 'Kingdom Centre',
    height: 302.3,
    build: buildKingdom,
    brief:
      'Riyadh’s elliptical mirrored tower with a true through-opening bounded by a curved catenary roof, glass skybridge, clipped end piers and the independently mapped spreading shopping and event podium.',
    sourceFacts: {
      architects: ['Ellerbe Becket', 'Omrania'],
      structuralEngineer: 'Arup',
      heightMeters: 302.3,
      concreteStructureHeightMeters: 180,
      podiumLevels: 3,
      skybridgePublishedLengthFeet: 200,
    },
    reconstruction: {
      tower:
        'Exact signed elliptical shaft and independent crown end/skybridge map parts; continuous catenary reconstructed from the205 m opening datum',
      podium:
        'Exact mapped ground plan with three-storey facade; fine roof equipment and landscaping simplified',
      heightDatum:
        'Published302 m Arup height and302.3 m catalog architectural height override the inconsistent OSM bridge min_height302 plus height4',
    },
    refs: [
      'https://www.arup.com/en-us/projects/kingdom-centre/',
      'https://omrania.com/project/kingdom-center/',
      'https://www.architectmagazine.com/project-gallery/kingdom-centre/',
      'https://www.openstreetmap.org/way/264745922',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact whole-site datum with separately mapped elliptical tower, two narrow end piers and skybridge preserves the long crown axis. Source baseY0. The large podium is included at its actual mapped extent.',
    }),
    limitations: [
      commonLimit,
      'Catenary parameters and curtain-wall panel schedule are reconstructed. The unobstructed void, inner curved roof and skybridge are modeled; interior uses, signs and individual rooftop equipment are excluded.',
    ],
    camera: { position: [349, 246, 526], lookAt: [0, 138, 0], fov: 44 },
    qaCameras: [
      { name: 'catenary-opening', position: [88, 260, 173], lookAt: [0, 251, 0] },
      { name: 'skybridge', position: [80, 320, 99], lookAt: [0, 294, 2] },
      { name: 'curved-glazing', position: [60, 113, 94], lookAt: [0, 94, 3] },
      { name: 'podium-wings', position: [242, 69, 271], lookAt: [0, 12, 0] },
      { name: 'far-silhouette', position: [-497, 342, 799], lookAt: [0, 139, 0] },
    ],
  },
  {
    id: 'N0170',
    key: 'messeturm',
    wikidataId: 'Q156198',
    title: 'Messeturm',
    height: 256.5,
    build: buildMesseturm,
    brief:
      'Jahn’s red-granite skyscraper with four stepped steles around an exposed glass cylinder, pointed central window bays, reconstructed2022 curved-glass lobby and the distinctive three-stage diamond-oriented pyramid.',
    sourceFacts: {
      heightMeters: 256.5,
      architect: 'Helmut Jahn',
      planWidthMeters: 41,
      lobbyFacadeHeightMeters: 17,
      facade: 'Polished red granite and recessed glazing',
      roof: 'Three stepped pyramid stages, corners centered on facade sides',
    },
    reconstruction: {
      geometry:
        'Independently mapped square base, glass lobby, pointed cylinder, three cross-shaped granite steles, upper cylinder and diamond pyramid',
      heightDatum:
        '256.5 m CTBUH/HOCHTIEF datum; owner rounds257 m and current architect page lists251 m',
      crown:
        'Mapped220 m crown base with three photographed sloping tiers; individual tier heights reconstructed',
    },
    refs: [
      'https://jahn.studio/work/messeturm/',
      'https://messeturm.com/en/',
      'https://messeturm.com/fileadmin/user_upload/MESSETURM_Image_Book_25082022.pdf',
      'https://www.hochtief.de/ueber-hochtief/geschichte/messeturm-in-frankfurt-am-main',
      'https://www.skyscrapercenter.com/building/messeturm/796',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed independent facade steles, curved lobby and diamond-shaped pyramid retain the exact mapped center and phase. Fourfold symmetry means180 degree ambiguity does not alter the exterior. BaseY0.',
    }),
    limitations: [
      commonLimit,
      'Individual granite panel joints, curtain-wall bay pitch and pyramid tier datums are reconstructed from the owner brochure and architect description. The separate Hammering Man sculpture and surrounding exhibition halls are excluded.',
    ],
    camera: { position: [210, 176, 332], lookAt: [0, 118, 0], fov: 44 },
    qaCameras: [
      { name: 'granite-steles', position: [64, 174, 90], lookAt: [0, 157, 0] },
      { name: 'stepped-pyramid', position: [62, 254, 86], lookAt: [0, 226, 0] },
      { name: 'cylinder-and-bays', position: [60, 210, 75], lookAt: [0, 195, 0] },
      { name: 'glass-lobby', position: [57, 14, 63], lookAt: [0, 11, 0] },
      { name: 'far-silhouette', position: [-312, 220, 491], lookAt: [0, 121, 0] },
    ],
  },
  {
    id: 'N0172',
    key: 'aon_center',
    wikidataId: 'Q271695',
    title: 'Aon Center',
    height: 346.3,
    build: buildAon,
    brief:
      'Chicago’s tall white granite shaft with individually modeled V-faced vertical piers, recessed charcoal window bands, signed notched corner geometry, glazed lobby and its separately mapped rooftop mechanical block.',
    sourceFacts: {
      heightMeters: 346.3,
      floors: 83,
      architects: ['Edward Durell Stone & Associates', 'Perkins+Will'],
      currentCladding: 'White granite replacing the original Carrara marble',
      structure: 'Tube-in-tube with V-shaped perimeter columns',
    },
    reconstruction: {
      plan: 'Signed exact outline with separate32 m roof service block',
      facade:
        'Repeated V-shaped piers and individual window panes; small corner returns preserve mapped plan',
      heightDatum: '340 m main roof and346.3 m architectural mechanical top',
    },
    refs: [
      'https://www.skyscrapercenter.com/chicago/aon-center/339',
      'https://www.architecture.org/online-resources/buildings-of-chicago/aon-center',
      'https://www.aoncenter.info/toc.cfm',
      'https://www.openstreetmap.org/way/64388609',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed notched footprint and independent rooftop block retain map alignment and groundY0. The main tower is included; the two-level landscaped plaza remains terrain/map context.',
    }),
    limitations: [
      commonLimit,
      'Individual pier dimensions and glazing pitch are reconstructed. Granite joints and roof ventilation are modeled, while corporate lettering, plaza fountains and proposed observation-deck alterations are excluded.',
    ],
    camera: { position: [278, 240, 438], lookAt: [0, 163, 0], fov: 44 },
    qaCameras: [
      { name: 'granite-piers', position: [77, 156, 85], lookAt: [0, 135, 0] },
      { name: 'notched-corners', position: [73, 69, 73], lookAt: [17, 59, 17] },
      { name: 'roof-mechanical', position: [80, 375, 93], lookAt: [0, 337, 0] },
      { name: 'ground-lobby', position: [75, 14, 81], lookAt: [0, 8, 0] },
      { name: 'far-silhouette', position: [-382, 288, 643], lookAt: [0, 166, 0] },
    ],
  },
];
