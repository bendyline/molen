/** Aesepus bridge ruins: detached hollow piers and bank arches; missing vaults stay open. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sx/sx5/aesepus_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = { stone: rgb('aaa594'), brick: rgb('986d53'), deck: rgb('b8b09d'), mortar: rgb('777768') },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
    brick: { slot: 'trim', graph: 'brick', roughness: 0.97, metallic: 0 },
    deck: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
    mortar: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  };
function tri(o, s, p, h, col = C[s]) {
  p = p.map((p) => p.map(Math.fround));
  const n = cross(
    p[1].map((v, i) => v - p[0][i]),
    p[2].map((v, i) => v - p[0][i]),
  );
  if (Math.hypot(...n) < 1e-9) return;
  if (h && n.reduce((s, v, i) => s + v * h[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  area = (p) =>
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) / 2,
  vary = (c, k) => c.map((v) => Math.min(1, Math.max(0, v * k)));
function cap(o, s, p, y, up = true, col = C[s]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, p, y0, y1, col = C[s]) {
  const sign = area(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      s,
      [
        [p[i][0], y0, p[i][1]],
        [p[j][0], y0, p[j][1]],
        [p[j][0], y1, p[j][1]],
        [p[i][0], y1, p[i][1]],
      ],
      [sign * (p[j][1] - p[i][1]), 0, sign * (p[i][0] - p[j][0])],
      col,
    );
  }
  cap(o, s, p, y0, false, col);
  cap(o, s, p, y1, true, col);
}
function extrusion(o, s, p, z0, z1, col = C[s]) {
  const ix = earcut(p.flat());
  for (const [z, sg] of [
    [z0, -1],
    [z1, 1],
  ])
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], z]),
        [0, 0, sg],
        col,
      );
  const sign = area(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      s,
      [
        [p[i][0], p[i][1], z0],
        [p[j][0], p[j][1], z0],
        [p[j][0], p[j][1], z1],
        [p[i][0], p[i][1], z1],
      ],
      [sign * (p[j][1] - p[i][1]), sign * (p[i][0] - p[j][0]), 0],
      col,
    );
  }
}
function pier(o, p, d) {
  const x = p.x,
    w = p.width,
    L = plan.estimatedLevels,
    base = [
      [x - w / 2, -2.8],
      [x, -6],
      [x + w / 2, -2.8],
      [x + w / 2, 2.8],
      [x, 6],
      [x - w / 2, 2.8],
    ],
    outer = base.map((v) => [x + (v[0] - x) * 1.08, v[1] * 1.05]);
  prism(o, 'deck', outer, L.footing, L.footing + 0.42);
  prism(o, 'stone', base, L.footing + 0.42, L.pierBaseTop);
  prism(o, 'stone', rect(x, 0, w, 5.6), L.pierBaseTop, L.hollowBottom);
  for (const sign of [-1, 1]) {
    const ps = [
        [x - w / 2, L.pierBaseTop, sign * 2.8],
        [x + w / 2, L.pierBaseTop, sign * 2.8],
        [x, L.pierBaseTop, sign * 6],
        [x, L.cutwaterPeak, sign * 2.8],
      ],
      c = [x, L.pierBaseTop + 0.6, sign * 3.6];
    for (const ids of [
      [0, 1, 3],
      [1, 2, 3],
      [2, 0, 3],
    ]) {
      const q = ids.map((i) => ps[i]);
      tri(o, 'stone', q, [
        0,
        q.reduce((s, p) => s + p[1] / 3, 0) - c[1],
        q.reduce((s, p) => s + p[2] / 3, 0) - c[2],
      ]);
    }
  }
  const tops = [2.85, 2.55, 2.78, 2.4, 2.65];
  for (let i = 0; i < 5; i++) {
    const z = -2.64 + i * 1.32,
      top = tops[i];
    prism(o, 'stone', rect(x, z, w + 0.28, 0.32), L.hollowBottom, top);
    if (d >= 2) {
      const count = d === 3 ? 4 : 2;
      for (let j = 0; j < count; j++) {
        const xx = x - w / 2 + ((j + 0.5) * w) / count,
          h = 0.14 + (j % 2) * 0.11;
        prism(o, 'deck', rect(xx, z, w / count - 0.04, 0.34), top, top + h);
      }
    }
  }
  // The four chambers remain open at their broken longitudinal faces.
  for (let i = 0; i < 4; i++) {
    const z = -1.98 + i * 1.32;
    prism(o, 'deck', rect(x + w * 0.21, z, w * 0.58, 1.34), 2.82, 3.08);
  }
  for (const sign of [-1, 1]) {
    const a = x + (sign * w) / 2,
      b = x + sign * (w / 2 + 1.3),
      q = [
        [a, -3],
        [b, -2.3],
        [b, -1.5],
        [a, 0.1],
      ];
    extrusion(o, 'stone', q, -2.8, 2.8);
  }
  if (d >= 1) {
    const rows = [0, 4, 8, 12][d];
    for (let j = 1; j <= rows; j++) {
      const y = L.footing + 0.42 + (j * (L.pierBaseTop - L.footing - 0.42)) / (rows + 1);
      for (let i = 0; i < base.length; i++) {
        const a = base[i],
          b = base[(i + 1) % base.length];
        Q(
          o,
          'mortar',
          [
            [a[0], y - 0.014, a[1]],
            [b[0], y - 0.014, b[1]],
            [b[0], y + 0.014, b[1]],
            [a[0], y + 0.014, a[1]],
          ],
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      }
      if (d === 3) {
        for (const z of [-2.805, 2.805])
          for (let k = 0; k < 4; k++) {
            const xx = x - w / 2 + ((k + 0.4 + (j % 2) * 0.5) * w) / 4;
            if (xx < x + w / 2)
              Q(
                o,
                'mortar',
                [
                  [xx, y - 0.45, z],
                  [xx + 0.025, y - 0.45, z],
                  [xx + 0.025, y + 0.025, z],
                  [xx, y + 0.025, z],
                ],
                [0, 0, Math.sign(z)],
              );
          }
      }
    }
    if (d === 3) {
      for (let i = 0; i < 5; i++) {
        const z = -2.64 + i * 1.32;
        for (let j = 0; j < 5; j++) {
          const y = -0.1 + j * 0.54;
          for (const side of [-1, 1])
            Q(
              o,
              'mortar',
              [
                [x + side * (w / 2 + 0.145), y - 0.012, z - 0.16],
                [x + side * (w / 2 + 0.145), y - 0.012, z + 0.16],
                [x + side * (w / 2 + 0.145), y + 0.012, z + 0.16],
                [x + side * (w / 2 + 0.145), y + 0.012, z - 0.16],
              ],
              [side, 0, 0],
            );
        }
      }
    }
  }
}
function bankTop(x, part) {
  return part === plan.eastern
    ? 2.9 - (2.65 * (x - part.start)) / (part.end - part.start)
    : 1.3 + (1.5 * (x - part.start)) / (part.end - part.start);
}
function bankBase(x, part) {
  return part === plan.eastern
    ? -10 + (9.65 * (x - part.start)) / (part.end - part.start)
    : -1.2 - (5.4 * (x - part.start)) / (part.end - part.start);
}
function vaultY(x, a) {
  const u = a.quarter ? (a.x + a.width / 2 - x) / a.width : (x - a.x) / (a.width / 2);
  return a.spring + a.rise * Math.sqrt(Math.max(0, 1 - u * u));
}
function atOpening(x, part) {
  return part.openings.find((a) => Math.abs(x - a.x) < a.width / 2 - 1e-6);
}
function bank(o, part, d) {
  const n = [3, 6, 12, 28][d],
    xs = [part.start, part.end];
  for (const a of part.openings) {
    xs.push(a.x - a.width / 2, a.x + a.width / 2);
    for (let i = 0; i <= n; i++)
      xs.push(
        a.quarter
          ? a.x + a.width / 2 - a.width * Math.cos((i * Math.PI) / 2 / n)
          : a.x + (a.width / 2) * Math.cos((i * Math.PI) / n),
      );
  }
  const xx = [
      ...new Set(xs.filter((x) => x >= part.start && x <= part.end).map((x) => +x.toFixed(8))),
    ].sort((a, b) => a - b),
    z0 = -2.8,
    z1 = 2.8;
  for (let i = 1; i < xx.length; i++) {
    const a = xx[i - 1],
      b = xx[i],
      mid = (a + b) / 2,
      hole = atOpening(mid, part);
    if (hole?.conjectural) continue;
    const lower = (x) => Math.max(bankBase(x, part), hole ? vaultY(x, hole) : bankBase(x, part)),
      la = lower(a),
      lb = lower(b),
      ta = bankTop(a, part),
      tb = bankTop(b, part);
    if (la > ta || lb > tb) continue;
    for (const [z, sg] of [
      [z0, -1],
      [z1, 1],
    ])
      Q(
        o,
        'stone',
        [
          [a, la, z],
          [b, lb, z],
          [b, tb, z],
          [a, ta, z],
        ],
        [0, 0, sg],
      );
    Q(
      o,
      'deck',
      [
        [a, ta, z0],
        [b, tb, z0],
        [b, tb, z1],
        [a, ta, z1],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      hole ? 'brick' : 'stone',
      [
        [a, la, z0],
        [b, lb, z0],
        [b, lb, z1],
        [a, la, z1],
      ],
      [0, -1, 0],
    );
    if (i === 1 || atOpening((xx[i - 2] + a) / 2, part)?.conjectural)
      Q(
        o,
        'stone',
        [
          [a, la, z0],
          [a, ta, z0],
          [a, ta, z1],
          [a, la, z1],
        ],
        [-1, 0, 0],
      );
    if (i === xx.length - 1 || atOpening((b + xx[i + 1]) / 2, part)?.conjectural)
      Q(
        o,
        'stone',
        [
          [b, lb, z0],
          [b, tb, z0],
          [b, tb, z1],
          [b, lb, z1],
        ],
        [1, 0, 0],
      );
  }
  // Individual contrasting voussoir groups line actual open arches, with red brick bands.
  if (d >= 1)
    for (const a of part.openings.filter((a) => !a.conjectural)) {
      const count = [0, 8, 16, 32][d],
        r = a.width / 2;
      for (let i = 0; i < count; i++) {
        const t0 = (i * Math.PI * (a.quarter ? 0.5 : 1)) / count,
          t1 = ((i + 1) * Math.PI * (a.quarter ? 0.5 : 1)) / count,
          s = i % 4 === 0 || i % 4 === 1 ? 'brick' : 'stone',
          P = (t, k, z) => [
            a.quarter
              ? a.x + a.width / 2 - (a.width + k) * Math.cos(t)
              : a.x + (r + k) * Math.cos(t),
            a.spring + (a.rise + k) * Math.sin(t),
            z,
          ];
        for (const [z, sign] of [
          [-2.82, -1],
          [2.82, 1],
        ]) {
          const q = [P(t0, 0, z), P(t1, 0, z), P(t1, 0.32, z), P(t0, 0.32, z)];
          if (
            Math.max(q[0][1], q[1][1]) < Math.min(bankBase(q[0][0], part), bankBase(q[1][0], part))
          )
            continue;
          Q(o, s, q, [0, 0, sign], vary(C[s], 0.91 + (i % 3) * 0.045));
          if (d === 3)
            Q(
              o,
              'mortar',
              [
                P(t0, 0, z + sign * 0.003),
                P(t0 + 0.006, 0, z + sign * 0.003),
                P(t0 + 0.006, 0.32, z + sign * 0.003),
                P(t0, 0.32, z + sign * 0.003),
              ],
              [0, 0, sign],
            );
        }
      }
    }
  if (d >= 2) {
    const courses = d === 3 ? 0.56 : 1.1;
    for (let y = -9.4; y < 2.5; y += courses) {
      const steps = Math.ceil((part.end - part.start) / 1.4);
      for (let i = 0; i < steps; i++) {
        const a = part.start + (i * (part.end - part.start)) / steps,
          b = part.start + ((i + 1) * (part.end - part.start)) / steps,
          mid = (a + b) / 2,
          hole = atOpening(mid, part);
        if (hole?.conjectural) continue;
        const lower = Math.max(bankBase(mid, part), hole ? vaultY(mid, hole) : bankBase(mid, part));
        if (y <= lower + 0.08 || y >= bankTop(mid, part) - 0.1) continue;
        for (const [z, sign] of [
          [-2.835, -1],
          [2.835, 1],
        ]) {
          Q(
            o,
            'mortar',
            [
              [a, y - 0.012, z],
              [b, y - 0.012, z],
              [b, y + 0.012, z],
              [a, y + 0.012, z],
            ],
            [0, 0, sign],
          );
          if (d === 3 && i % 2 === 0) {
            const x = (a + b) / 2;
            Q(
              o,
              'mortar',
              [
                [x - 0.012, y - courses + 0.06, z],
                [x + 0.012, y - courses + 0.06, z],
                [x + 0.012, y, z],
                [x - 0.012, y, z],
              ],
              [0, 0, sign],
            );
          }
        }
      }
    }
  }
  if (d === 3) {
    const len = part.end - part.start,
      nx = Math.ceil(len / 1.2),
      nz = 4;
    for (let i = 0; i < nx; i++) {
      const x = part.start + ((i + 0.5) * len) / nx,
        hole = atOpening(x, part);
      if (hole?.conjectural) continue;
      const y = bankTop(x, part);
      for (let j = 0; j < nz; j++) {
        const z = -2.4 + j * 1.6;
        if (z > 2.6) continue;
        const p = rect(x, z, len / nx - 0.07, 1.5);
        prism(o, 'deck', p, y + 0.015, y + 0.085, vary(C.deck, 0.91 + ((i + j) % 4) * 0.035));
      }
    }
  }
  // Conjectural ninth opening is represented only by low discontinuous ruin fragments.
  for (const a of part.openings.filter((a) => a.conjectural)) {
    for (const sign of [-1, 1]) {
      const x = a.x + sign * (a.width / 2 - 0.7),
        floor = bankBase(x, part);
      prism(o, 'stone', rect(x, 0, 1.1, 5.6), floor, floor + 0.65);
    }
    if (d >= 2)
      for (let k = 0; k < 3; k++) {
        const x = a.x + (k - 1) * 1.1,
          floor = bankBase(x, part);
        prism(o, 'stone', rect(x, (k % 2 ? 1 : -1) * 0.9, 0.75, 0.8), floor, floor + 0.3);
      }
  }
}
function exedra(o, d) {
  const e = plan.exedraEstimate,
    n = [4, 7, 12, 20][d];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      P = (r, t, y) => [e.x + r * Math.cos(t), y, e.z - r * Math.sin(t)],
      r = e.radius,
      h = e.height * (i === 0 || i === n - 1 ? 0.6 : 1);
    Q(
      o,
      'brick',
      [P(r, a, 0), P(r, b, 0), P(r, b, h), P(r, a, h)],
      [Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
    );
    Q(
      o,
      'brick',
      [P(r - 0.5, a, 0), P(r - 0.5, b, 0), P(r - 0.5, b, h), P(r - 0.5, a, h)],
      [-Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    Q(o, 'brick', [P(r, a, h), P(r, b, h), P(r - 0.5, b, h), P(r - 0.5, a, h)], [0, 1, 0]);
    if (i === 0 || i === n - 1)
      Q(
        o,
        'brick',
        [
          P(r, i === 0 ? a : b, 0),
          P(r - 0.5, i === 0 ? a : b, 0),
          P(r - 0.5, i === 0 ? a : b, h),
          P(r, i === 0 ? a : b, h),
        ],
        [i === 0 ? -1 : 1, 0, 0],
      );
  }
  const s = e.stoneColumn,
    p = Array.from({ length: [4, 6, 10, 16][d] }, (_, i) => {
      const a = (i * tau) / [4, 6, 10, 16][d];
      return [s.x + s.radius * Math.cos(a), s.z + s.radius * Math.sin(a)];
    });
  prism(o, 'stone', p, 0, s.height);
}
function build(o, _f, d = 3) {
  for (const p of plan.piers) pier(o, p, d);
  bank(o, plan.western, d);
  bank(o, plan.eastern, d);
  exedra(o, d);
}
export const aesepusSkyline = (o, f) => build(o, f, 0);
export const aesepusDistrict = (o, f) => build(o, f, 1);
export const aesepusStreet = (o, f) => build(o, f, 2);
export const aesepusModel = {
  id: 'aesepus_bridge',
  key: 'aesepus_bridge',
  recipe: 'structure-aesepus-bridge.mjs',
  cell: 'sx/sx5',
  title: 'Aesepus Bridge',
  category: 'bridge-ruins',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving ruined Aesepus/Güvercin bridge: two detached granite piers/pointed cutwaters and four true longitudinal hollow chambers between five upper masonry walls, broken deck/arch springers, western small bank arches and eastern58mramp with genuine open stone/brick vaults, partial arch9ruin, bounded paving and low intrinsic east brick exedra/stonecolumn. Four main vaults and conjectural third pier absent, no restored intact bridge or river terrain mesh.',
  camera: [-75, 54, 124],
  lookAt: [15, -1, 0],
  portableGroundY: -11.1,
  mediumFiContext: { scale: 1.1, groundY: -11.1 },
  qaCameras: [
    {
      name: 'full-ruined-crossing-and-missing-main-vaults',
      position: [-36, 65, 168],
      lookAt: [17, -1, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'two-granite-piers-open-four-chambers-and-cutwater-caps',
      position: [-53, 16, 24],
      lookAt: [-20, -2, 0],
    },
    {
      name: 'eastern-brick-stone-vaults-and-broken-ninth-opening',
      position: [67, 17, 38],
      lookAt: [62, -1, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed open east-bank approach[107,0]before raw terrain acquisition; source-relative approximate distributed bank/riverbed/foundation levels, no fitted natural valley mesh.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-aesepus-bridge.mjs',
    level: 'skyline',
    export: 'aesepusSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'aesepusDistrict', errorMeters: 1.3, surfaces },
      street: { export: 'aesepusStreet', errorMeters: 0.45, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.registrationLimitations,
    'Five1905/1906Hasluckphotographs and contemporary elevation are already published QuallaPD-old-100-expired originals, nativeSHA1matched/primaryrelease bound and all6actually inspected. Primary2020fieldstudy text only corroborates current surviving piers/arch/chambers and dimensions. Its restricted modern photos/figures and uncreditedManyas4were not used. No external bitmap generated or photo texture copied; original medium-fi geometry and shared material graphs.',
    'Two current native bridge polygons are aggregate crossing envelopes, not intact load-bearing road surfaces across the missing river arches. Four main spans and conjectural third pier remain genuinely absent at everyLOD. Arch9is explicitly uncertain/overgrown and retained only as low discontinuous fragments, not a completed invented vault. The low east exedra/80cmcolumn are intrinsic reported remains with approximate placement.',
    'Broad geometry follows the cleared surviving1906forms corroborated by2020fieldwork, but recent small losses, upper jagged courses, floor levels/riverbed depth, original stone/brick census, bank-arch spacing and detached-pier registration are estimates. Permanent nominal158mlength/5.6mwidth and58meastramp are coarse controls, not a full measured3Dsurvey. Natural river/ground/bank/valley and the nearby modern highway are excluded.',
    'Independent raw source terrain is preserved without flattening or fitting, fixed east-bank reference chosen before geometry. Exact dry-bank/river footing and compatible host water datum remain unverified approximate geographic preview; flat reviewY-11.1shows the intrinsic ruins.',
  ],
};
