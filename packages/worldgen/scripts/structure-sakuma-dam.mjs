/** Native Sakuma gravity dam, crest crossing and five-gate operating frame. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xn1/sakuma_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
    concrete: rgb('aaa89b'),
    road: rgb('686c69'),
    steel: rgb('9cc9bc'),
    dark: rgb('45514d'),
    mark: rgb('d5d2c2'),
  },
  stain = rgb('85857a'),
  joint = rgb('92958b');
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
  road: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
  steel: { slot: 'trim', localRef: ref, roughness: 0.74, metallic: 0.2 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.95, metallic: 0.1 },
  mark: { slot: 'trim', localRef: ref, roughness: 0.95, metallic: 0 },
};
function tri(o, s, p, h, col = C[s]) {
  const q = p.map((p) => p.map(Math.fround)),
    n = cross(
      q[1].map((v, i) => v - q[0][i]),
      q[2].map((v, i) => v - q[0][i]),
    );
  if (Math.hypot(...n) < 1e-9) return;
  if (n.reduce((v, x, i) => v + x * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1] + p[2]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const B = (o, s, x, y, z, w, h, d, col = C[s]) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], col);
const outline = plan.outline,
  up = plan.upstreamBoundary,
  down = plan.downstreamBoundary,
  lo = outline[0][0],
  hi = outline[2][0],
  center = plan.estimatedSections.spillwayCenterX,
  pitch = 20,
  piers = Array.from({ length: 6 }, (_, i) => center - 50 + i * pitch),
  gates = Array.from({ length: 5 }, (_, i) => center - 40 + i * pitch);
function linear(ps, x) {
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i];
    if (x <= b[0] + 1e-7) {
      const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return ps.at(-1)[1];
}
const maxSpread = Math.max(...down.map((p) => p[1] - linear(up, p[0])));
function section(x, channel = false) {
  const u = linear(up, x),
    z = linear(down, x),
    width = Math.max(0, z - u),
    height = 155.5 * Math.pow(Math.min(1, width / maxSpread), 0.85),
    front = Math.min(z, u + Math.min(12.5, width * 0.8)),
    head = Math.min(channel ? 16 : 10, height * 0.28);
  return { u, z, height, front, head, floor: channel ? -14 : 0 };
}
function frontPoint(x, t, channel = false, offset = 0) {
  const s = section(x, channel);
  return [
    x,
    -s.head - (s.height - s.head) * t,
    s.front + (s.z - s.front) * Math.pow(t, 1.18) + offset,
  ];
}
const isChannel = (x) => gates.some((g) => Math.abs(x - g) < 7);
function profile(x, n, channel) {
  const s = section(x, channel),
    pts = [
      [s.u, s.floor],
      [s.front, s.floor],
      [s.front, -s.head],
    ];
  for (let j = 1; j <= n; j++) {
    const p = frontPoint(x, j / n, channel);
    pts.push([p[2], p[1]]);
  }
  pts.push([s.u, -s.height]);
  return pts;
}
function crossCap(o, x, p, sign) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'concrete',
      ix.slice(i, i + 3).map((k) => [x, p[k][1], p[k][0]]),
      [sign, 0, 0],
    );
}
function body(o, d) {
  const stations = new Set(outline.map((p) => p[0]));
  for (const g of gates) for (const sign of [-1, 1]) stations.add(g + sign * 7);
  if (d > 0) for (let x = lo; x < hi; x += [0, 12, 6, 3][d]) stations.add(x);
  const xs = [...stations].filter((x) => x >= lo && x <= hi).sort((a, b) => a - b),
    n = [1, 3, 6, 12][d];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      ch = isChannel((a + b) / 2),
      pa = profile(a, n, ch),
      pb = profile(b, n, ch);
    for (let j = 0; j < pa.length; j++) {
      const k = (j + 1) % pa.length,
        p = [
          [a, pa[j][1], pa[j][0]],
          [b, pb[j][1], pb[j][0]],
          [b, pb[k][1], pb[k][0]],
          [a, pa[k][1], pa[k][0]],
        ];
      Q(
        o,
        'concrete',
        p,
        normalFor(...p).map((v) => -v),
      );
    }
    if (i === 1 || isChannel(a - 0.01) !== ch) crossCap(o, a, pa, -1);
    if (i === xs.length - 1 || isChannel(b + 0.01) !== ch) crossCap(o, b, pb, 1);
  }
}
function crest(o, d) {
  const ps = plan.crest;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], u[0]],
      p = (t, y, z) => [a[0] + u[0] * t + n[0] * z, y, a[1] + u[1] * t + n[1] * z];
    Q(o, 'road', [p(0, 0, -3.1), p(len, 0, -3.1), p(len, 0, 3.1), p(0, 0, 3.1)], [0, 1, 0]);
    if (d > 0) {
      Q(
        o,
        'concrete',
        [p(0, -0.8, -4.8), p(len, -0.8, -4.8), p(len, -0.8, 4.8), p(0, -0.8, 4.8)],
        [0, -1, 0],
      );
      for (const sign of [-1, 1]) {
        Q(
          o,
          'concrete',
          [
            p(0, -0.8, sign * 4.8),
            p(len, -0.8, sign * 4.8),
            p(len, 0.15, sign * 4.8),
            p(0, 0.15, sign * 4.8),
          ],
          [n[0] * sign, 0, n[1] * sign],
        );
      }
    }
    for (const sign of [-1, 1]) {
      const pts = [
        p(0, 0.15, sign * 4.8),
        p(len, 0.15, sign * 4.8),
        p(len, 1.4, sign * 4.8),
        p(0, 1.4, sign * 4.8),
      ];
      Q(o, 'concrete', pts, [n[0] * sign, 0, n[1] * sign]);
      if (d > 0) {
        const inside = pts.map((q) => [q[0] - n[0] * sign * 0.75, q[1], q[2] - n[1] * sign * 0.75]);
        Q(o, 'concrete', inside, [n[0] * -sign, 0, n[1] * -sign]);
        Q(o, 'concrete', [pts[2], pts[3], inside[3], inside[2]], [0, 1, 0]);
        Q(
          o,
          'concrete',
          [
            p(0, 0.15, sign * 3.1),
            p(len, 0.15, sign * 3.1),
            p(len, 0.15, sign * 4.05),
            p(0, 0.15, sign * 4.05),
          ],
          [0, 1, 0],
        );
      }
      if (d > 1) {
        const count = Math.ceil(len / 10);
        for (let j = 1; j < count; j++) {
          const x = (len * j) / count;
          Q(
            o,
            'dark',
            [
              p(x - 0.025, 0.15, sign * 4.808),
              p(x + 0.025, 0.15, sign * 4.808),
              p(x + 0.025, 1.4, sign * 4.808),
              p(x - 0.025, 1.4, sign * 4.808),
            ],
            [n[0] * sign, 0, n[1] * sign],
            joint,
          );
        }
      }
    }
  }
  // Native crossing ends extend beyond the body polygon into the rock abutments.
  if (d > 0)
    for (const sign of [-1, 1]) {
      const q = sign < 0 ? ps[0] : ps.at(-1);
      B(o, 'concrete', q[0] - sign * 2, -5, q[1], 5, 5, 9.5);
    }
}
function railing(o, a, b, d) {
  if (d === 0) return;
  const len = Math.hypot(...b.map((v, i) => v - a[i])),
    n = Math.ceil(len / (d === 1 ? 10 : 4));
  for (const y of d === 1 ? [1.15] : [0.55, 1.15]) {
    beam(
      o,
      'steel',
      a.map((v, i) => v + (i === 1 ? y : 0)),
      b.map((v, i) => v + (i === 1 ? y : 0)),
      0.075,
      0.075,
      C.steel,
    );
  }
  for (let j = 0; j <= n; j++) {
    const p = a.map((v, i) => v + ((b[i] - v) * j) / n);
    B(o, 'steel', p[0], p[1], p[2], 0.1, 1.25, 0.1);
  }
}
function operatingFrame(o, d) {
  const left = piers[0],
    right = piers.at(-1),
    z = 8.7;
  for (let i = 0; i < piers.length; i++) {
    const x = piers[i];
    B(o, 'concrete', x, -15, z, 4.8, 42, 10);
    if (d > 1) {
      for (const zz of [z - 5.02, z + 5.02]) {
        Q(
          o,
          'concrete',
          [
            [x - 1.8, 2, zz],
            [x + 1.8, 2, zz],
            [x + 1.55, 26, zz],
            [x - 1.55, 26, zz],
          ],
          [0, 0, zz < z ? -1 : 1],
          C.mark,
        );
        B(o, 'dark', x, 15, zz, 0.6, 0.7, 0.03);
      }
    }
  }
  B(o, 'concrete', (left + right) / 2, 27, z, right - left + 6, 2.6, 10.6);
  B(o, 'concrete', (left + right) / 2, -1.8, z + 5.6, right - left + 6, 1.5, 3);
  B(o, 'concrete', left - 1, 0, z, 9, 35, 12);
  if (d > 0) {
    for (const zz of [z - 3.8, z + 3.8]) {
      B(o, 'steel', (left + right) / 2, 29.7, zz, right - left + 5, 0.22, 0.22);
      railing(o, [left - 3, 29.65, zz], [right + 3, 29.65, zz], d);
    }
    railing(o, [left, 0, z + 7.1], [right, 0, z + 7.1], d);
    for (const x of gates) {
      B(o, 'steel', x, 30, z, 2.6, 0.7, 3);
      if (d > 1) {
        for (const sign of [-1, 1])
          beam(o, 'dark', [x + sign * 0.8, 27, z], [x + sign * 0.8, -1, z], 0.09, 0.09, C.dark);
        B(o, 'dark', x, 30.7, z, 1.2, 0.5, 1.5);
      }
    }
    // Small repeated windows establish the enclosed tower without copying signage or glyphs.
    for (let j = 0; j < (d === 1 ? 3 : 8); j++) {
      const yy = 2 + j * (d === 1 ? 9 : 4);
      for (const sign of [-1, 1])
        Q(
          o,
          'dark',
          [
            [left - 2, yy, z + sign * 6.02],
            [left + 0.2, yy, z + sign * 6.02],
            [left + 0.2, yy + 0.85, z + sign * 6.02],
            [left - 2, yy + 0.85, z + sign * 6.02],
          ],
          [0, 0, sign],
        );
      if (d > 1)
        Q(
          o,
          'dark',
          [
            [left - 5.52, yy, z - 1.7],
            [left - 5.52, yy, z + 0.6],
            [left - 5.52, yy + 0.85, z + 0.6],
            [left - 5.52, yy + 0.85, z - 1.7],
          ],
          [-1, 0, 0],
        );
    }
  }
  for (const x of gates) {
    B(o, 'steel', x, -15, 8.9, 14, 13, 1.3);
    if (d > 0) {
      for (let j = 0; j < (d === 1 ? 3 : 6); j++) {
        const yy = -14 + j * (d === 1 ? 5 : 2.25);
        B(o, 'steel', x, yy, 9.7, 14, 0.45, 0.5, C.mark);
      }
      for (const sign of [-1, 1]) B(o, 'steel', x + sign * 4.5, -15, 9.8, 0.36, 13, 0.55);
      if (d > 1) {
        for (const sign of [-1, 1])
          for (let j = 0; j < 5; j++)
            B(o, 'dark', x + sign * 6.5, -14 + j * 2.6, 9.75, 0.18, 0.18, 0.12);
      }
    }
  }
}
function chuteDividers(o, d) {
  const n = [2, 4, 8, 16][d];
  for (const x of piers) {
    const w = d === 0 ? 1.5 : 2;
    for (let j = 0; j < n; j++) {
      const t0 = j / n,
        t1 = (j + 1) / n,
        a = frontPoint(x, t0, true),
        b = frontPoint(x, t1, true),
        height = (t) => 2.0 + 7 * Math.pow(1 - t, 5),
        p = [
          [x - w / 2, a[1] + height(t0), a[2]],
          [x + w / 2, a[1] + height(t0), a[2]],
          [x + w / 2, b[1] + height(t1), b[2]],
          [x - w / 2, b[1] + height(t1), b[2]],
        ];
      Q(o, 'concrete', p, [0, 1, 0.2]);
      if (d > 0)
        for (const sign of [-1, 1]) {
          const xx = x + (sign * w) / 2;
          Q(
            o,
            'concrete',
            [
              [xx, a[1], a[2]],
              [xx, b[1], b[2]],
              [xx, b[1] + height(t1), b[2]],
              [xx, a[1] + height(t0), a[2]],
            ],
            [sign, 0, 0],
          );
        }
    }
  }
  if (d > 1) {
    for (const x of gates)
      for (const sign of [-1, 1]) {
        const xx = x + sign * 5.8;
        for (let j = 0; j < n; j++) {
          const a = frontPoint(xx, j / n, true, 0.055),
            b = frontPoint(xx, (j + 1) / n, true, 0.055);
          Q(
            o,
            'concrete',
            [
              [a[0] - 0.14, a[1] + 0.08, a[2]],
              [a[0] + 0.14, a[1] + 0.08, a[2]],
              [b[0] + 0.14, b[1] + 0.08, b[2]],
              [b[0] - 0.14, b[1] + 0.08, b[2]],
            ],
            [0, 1, 1],
            C.mark,
          );
        }
      }
  }
}
function concreteDetail(o, d) {
  if (d < 2) return;
  const dx = d === 2 ? 8 : 4;
  for (let y = -15; y > -150; y -= d === 2 ? 12 : 5) {
    for (let x = lo + 1; x < hi - 1; x += dx) {
      const x1 = Math.min(hi - 1, x + dx),
        ca = isChannel(x + 0.01),
        cb = isChannel(x1 - 0.01);
      if (ca !== cb) continue;
      const sa = section(x, ca),
        sb = section(x1, cb),
        point = (x, s, yy) =>
          frontPoint(x, (-yy - s.head) / (s.height - s.head), isChannel(x), 0.025);
      if (y > -Math.max(sa.head, sb.head) || y < -Math.min(sa.height, sb.height) + 1) continue;
      Q(
        o,
        'dark',
        [point(x, sa, y), point(x1, sb, y), point(x1, sb, y - 0.035), point(x, sa, y - 0.035)],
        [0, 1, 1],
        joint,
      );
    }
  }
  const n = d === 2 ? 8 : 18;
  for (let x = lo + 10; x < hi - 5; x += d === 2 ? 20 : 13) {
    const ch = isChannel(x),
      w = 0.045;
    for (let j = 0; j < n; j++) {
      const a = frontPoint(x, j / n, ch, 0.03),
        b = frontPoint(x, (j + 1) / n, ch, 0.03);
      Q(
        o,
        'dark',
        [
          [a[0] - w, a[1], a[2]],
          [a[0] + w, a[1], a[2]],
          [b[0] + w, b[1], b[2]],
          [b[0] - w, b[1], b[2]],
        ],
        [0, 1, 1],
        joint,
      );
    }
  }
  if (d === 3)
    for (let i = 0; i < 20; i++) {
      const x = lo + 8 + ((hi - lo - 16) * i) / 19;
      if (isChannel(x)) continue;
      const t0 = 0.02,
        t1 = 0.22 + (i % 4) * 0.025,
        a = frontPoint(x, t0, false, 0.018),
        b = frontPoint(x, t1, false, 0.018),
        w = 0.1 + (i % 3) * 0.09;
      Q(
        o,
        'concrete',
        [
          [a[0] - w, a[1], a[2]],
          [a[0] + w, a[1], a[2]],
          [b[0] + w * 0.4, b[1], b[2]],
          [b[0] - w * 0.4, b[1], b[2]],
        ],
        [0, 1, 1],
        stain,
      );
    }
}
function build(o, _frame, d = 3) {
  body(o, d);
  crest(o, d);
  chuteDividers(o, d);
  operatingFrame(o, d);
  concreteDetail(o, d);
}
export const sakumaSkyline = (o, f) => build(o, f, 0);
export const sakumaDistrict = (o, f) => build(o, f, 1);
export const sakumaStreet = (o, f) => build(o, f, 2);
export const sakumaDamModel = {
  id: 'sakuma_dam',
  key: 'sakuma_dam',
  recipe: 'structure-sakuma-dam.mjs',
  cell: 'xn/xn1',
  title: 'Sakuma Dam',
  category: 'infrastructure',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native Sakuma concrete gravity dam with original nine-vertex irregular body/toe plan and four-point crest crossing, five genuine lowered spillway slots/closed mint roller gates, six-pier open operating frame/enclosed northwest tower, tall downstream chute ribs, steep nonoverflow flanks, concrete lift/expansion seams, crest asphalt/sidewalks/solid parapets and bounded catwalk/hoist details. Crest/foundation section and hidden upstream/host contact are explicit photographic estimates; no gorge/river/reservoir or separate converter/power facilities.',
  camera: [390, 185, 430],
  lookAt: [0, -40, 22],
  portableGroundY: -160,
  mediumFiContext: { scale: 3, groundY: -160 },
  qaCameras: [
    {
      name: 'five-roller-gates-open-operating-frame-and-tower',
      position: [8, 22, 150],
      lookAt: [-8, 5, 8],
    },
    {
      name: 'ogee-chutes-concrete-lifts-and-native-toe',
      position: [160, -30, 220],
      lookAt: [-5, -65, 43],
    },
    {
      name: 'native-crest-road-parapets-and-tower-side',
      position: [-143, 8, 0],
      lookAt: [-25, 9, 5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed northwest approach before sampling. CrestY0; inspection stage below maximum foundation, not fitted actual gorge. No flattened reservoir/land slab.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-sakuma-dam.mjs',
    level: 'skyline',
    export: 'sakumaSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'sakumaDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'sakumaStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Raw Terrarium tiles contain implausible below-sea-level inland samples, including native-footprint relative minimum about-1655m at crest-reference281.8262m. Original bytes/grid are retained as diagnostic source evidence only; these anomalies do not control geometry, section height or acceptance of actual gorge/footing contact. Geographic shared review uses a flat inspection stage; precise terrain contact is unverified.',
    'The native four-point crest crossing is270.73m; all nine body polygon controls are preserved independently. Operator293.5mfull engineering crest includes abutment extent not established by this visible body/crossing. Do not stretch mapping to that scalar. Maximum155.5mheight bounds an original tapered width-dependent gravity-section estimate, not a survey or a claim that every exposed flank is that height. Exact buried core/foundation, upstream slope, crossfall, abutment profiles and host-gorge/toe/threshold contact remain unverified.',
    'Two exact3072x2304published Qualla photographs by河川一等兵were inspected first, with local SHA1matching original native Commons pages and explicit same-authorPD-userdedications. Main downstream face and crest road/tower side guide the model. Sakumadosuiro is a separately identified Toyogawa diversion, not the main dam; it and FDC/separate power stations, historical construction/portrait and other licensed photographs are unused. J-POWERoperator text supplies height/engineering length/five-gate count only; no operator image or photographic texture used.',
    'Five lowered full-width spillway slots/closed roller-gate panels, six-pier operating frame, enclosed northwest tower, mint steel stiffeners/hoist rails and downstream chute ribs retain the defining exterior. Gate/pier pitch/width, tower/frame heights, ogee/section curves, rib thickness, machinery/wire placement and exact weathering are medium-fi photographic estimates. Two operator-listed low-level discharge assemblies have concealed routing/exact openings unsupported by selected exterior; no invented exposed holes. Tower lettering/logo and fine bolts/tile/stain patterns are not reproduced exactly.',
    'Only intrinsic dam body/crest crossing, maintenance catwalks/rails and bounded near-end support blocks are included. Separate converter/power station, visitor museum, Toyogawa diversion, adjacent bridges/road tunnels, planters/people/forest, reservoir/water/riverbank/gorge landscape are excluded. Original DEM is preserved with a fixed northwest crest approach; portable ground below foundation is an inspection stage, not a surveyed riverbed.',
  ],
};
