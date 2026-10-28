/** Original dated riverfront reconstruction from the museum's CC0 Burke/Baker photograph. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.1 },
};
const C = {
    lime: rgb('c5c2b1'),
    stone: rgb('aaa695'),
    wood: rgb('655d50'),
    roof: rgb('83847b'),
    metal: rgb('343837'),
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
function T(o, k, q, v, col = C[k]) {
  q = q.map((a) => a.map(Math.fround));
  if (v && dot(cross(sub(q[1], q[0]), sub(q[2], q[0])), v) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
const B = (o, k, x, y, z, w, h, d, col = C[k]) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], col);
function hip(o, x, z, w, d, y, Y, k = 'roof') {
  const r = rect(x, z, w, d),
    ridge = Math.max(0, (w - d) / 2),
    a = [x - ridge, Y, z],
    b = [x + ridge, Y, z];
  if (ridge > 0.01) {
    Q(o, k, [[...r[0].slice(0, 1), y, r[0][1]], [r[1][0], y, r[1][1]], b, a], [0, 1, -1]);
    Q(o, k, [[r[2][0], y, r[2][1]], [r[3][0], y, r[3][1]], a, b], [0, 1, 1]);
    T(o, k, [[r[3][0], y, r[3][1]], [r[0][0], y, r[0][1]], a], [-1, 1, 0]);
    T(o, k, [[r[1][0], y, r[1][1]], [r[2][0], y, r[2][1]], b], [1, 1, 0]);
  } else {
    const h = [x, Y, z];
    for (let i = 0; i < 4; i++)
      T(o, k, [[r[i][0], y, r[i][1]], [r[(i + 1) % 4][0], y, r[(i + 1) % 4][1]], h], [0, 1, 0]);
  }
  Q(
    o,
    k,
    [
      [r[3][0], y, r[3][1]],
      [r[2][0], y, r[2][1]],
      [r[1][0], y, r[1][1]],
      [r[0][0], y, r[0][1]],
    ],
    [0, -1, 0],
  );
}
function arch(cx, y, w, h, n) {
  const r = w / 2,
    s = y + h - r,
    a = [
      [cx - r, y],
      [cx + r, y],
      [cx + r, s],
    ];
  for (let j = 1; j <= n; j++) {
    const t = (j * Math.PI) / n;
    a.push([cx + Math.cos(t) * r, s + Math.sin(t) * r]);
  }
  return a;
}
export const partEvidence = [],
  windowEvidence = [];
function facade(o, a, lod) {
  const { x, z, w, d, eave, rows, columns } = a,
    front = z - d / 2,
    n = [3, 4, 8, 10][lod],
    ww = Math.min(1.65, (w / columns) * 0.54),
    height = a.id === 'upper-rear-hall' ? 1.9 : 3.2,
    holes = [];
  for (const y of rows ?? [])
    for (let j = 0; j < columns; j++)
      holes.push({
        id: a.id + '/' + y + '/' + j,
        shape: arch(x - w / 2 + (w * (j + 0.5)) / columns, y, ww, height, n),
        depth: 0.28,
      });
  if (lod < 2) {
    B(o, 'lime', x, 5.5, z, w, eave - 5.5, d);
    for (const h of holes)
      for (let i = 1; i < h.shape.length - 1; i++)
        T(
          o,
          'metal',
          [h.shape[0], h.shape[i], h.shape[i + 1]].map((q) => [q[0], q[1], front - 0.025]),
          [0, 0, -1],
        );
  } else {
    // Five shell faces plus a triangulated front with genuine recess openings and return jambs.
    const lo = 5.5,
      hi = eave,
      x0 = x - w / 2,
      x1 = x + w / 2,
      z1 = z + d / 2;
    for (const [q, v] of [
      [
        [
          [x0, lo, z1],
          [x1, lo, z1],
          [x1, hi, z1],
          [x0, hi, z1],
        ],
        [0, 0, 1],
      ],
      [
        [
          [x0, lo, front],
          [x0, hi, front],
          [x0, hi, z1],
          [x0, lo, z1],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [x1, lo, z1],
          [x1, hi, z1],
          [x1, hi, front],
          [x1, lo, front],
        ],
        [1, 0, 0],
      ],
      [
        [
          [x0, hi, front],
          [x1, hi, front],
          [x1, hi, z1],
          [x0, hi, z1],
        ],
        [0, 1, 0],
      ],
      [
        [
          [x0, lo, z1],
          [x1, lo, z1],
          [x1, lo, front],
          [x0, lo, front],
        ],
        [0, -1, 0],
      ],
    ])
      Q(o, 'lime', q, v);
    const outer = [
        [x0, lo],
        [x1, lo],
        [x1, hi],
        [x0, hi],
      ],
      all = [outer, ...holes.map((h) => h.shape)].flat(),
      ts = ShapeUtils.triangulateShape(
        outer.map((q) => new Vector2(...q)),
        holes.map((h) => h.shape.map((q) => new Vector2(...q))),
      );
    for (const t of ts)
      T(
        o,
        'lime',
        t.map((i) => [...all[i], front]),
        [0, 0, -1],
      );
    for (const h of holes) {
      for (let j = 0; j < h.shape.length; j++) {
        const a = h.shape[j],
          b = h.shape[(j + 1) % h.shape.length];
        Q(
          o,
          'lime',
          [
            [...a, front],
            [...b, front],
            [b[0], b[1], front + h.depth],
            [a[0], a[1], front + h.depth],
          ],
          [b[1] - a[1], a[0] - b[0], 0],
        );
      }
      for (let i = 1; i < h.shape.length - 1; i++)
        T(
          o,
          'metal',
          [h.shape[0], h.shape[i], h.shape[i + 1]].map((q) => [q[0], q[1], front + h.depth]),
          [0, 0, -1],
        );
    }
  }
  windowEvidence.push(
    ...holes.map((h) => ({
      id: h.id,
      recessDepth: lod >= 2 ? h.depth : 0,
      outline: h.shape,
      front,
    })),
  );
  if (lod > 0)
    for (const y of rows ?? []) {
      B(o, 'wood', x, y - 0.1, front - 0.16, w, 0.18, 0.32);
      if (lod >= 2)
        for (let j = 0; j < columns; j++) {
          const xx = x - w / 2 + (w * (j + 0.5)) / columns;
          B(o, 'wood', xx, y, front - 0.03, 0.085, height - 0.8, 0.1);
        }
    }
}
function pavilion(o, a, lod) {
  const { x, z, w, d, eave } = a,
    base = a.id === 'domed-river-pavilion' ? 6.2 : 11.5;
  B(o, 'stone', x, a.base, z, w, base - a.base, d);
  B(o, 'wood', x, base, z, w + 0.4, 0.22, d + 0.4);
  const count = [3, 5, 7, 7][lod];
  for (let j = 0; j < count; j++)
    for (const zz of [z - d / 2 + 0.35, z + d / 2 - 0.35])
      B(
        o,
        'wood',
        x - w / 2 + 0.4 + ((w - 0.8) * j) / (count - 1),
        base,
        zz,
        0.24,
        eave - base,
        0.24,
      );
  for (const xx of [x - w / 2 + 0.35, x + w / 2 - 0.35])
    for (const zz of [z - d / 2 + d / 3, z + d / 2 - d / 3])
      B(o, 'wood', xx, base, zz, 0.22, eave - base, 0.22);
  B(o, 'wood', x, eave - 0.3, z, w + 0.5, 0.3, d + 0.5);
  hip(o, x, z, w + 1.6, d + 1.6, eave, a.ridge);
  if (lod > 0) {
    const front = z - d / 2 - 0.05;
    B(o, 'wood', x, base + 1.1, front, w, 0.12, 0.15);
    for (let j = 0; j < count * 3; j++)
      B(o, 'wood', x - w / 2 + (w * (j + 0.5)) / (count * 3), base + 0.2, front, 0.08, 0.9, 0.08);
  }
}
const domeProfile = [
    [13.2, 6.6],
    [15.1, 6.6],
    [15.7, 6.9],
    [17.5, 6.65],
    [20.2, 5.4],
    [22.4, 3.4],
    [24.3, 0.18],
  ],
  finialProfile = [
    [24.2, 0.2],
    [24.5, 0.55],
    [25, 0.18],
    [25.3, 0.4],
    [25.8, 0.12],
    [26.8, 0.025],
  ];
function lathe(o, x, z, profile, n) {
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const t = (i * 2 * Math.PI) / n,
        u = ((i + 1) * 2 * Math.PI) / n,
        a = profile[j - 1],
        b = profile[j],
        pt = (r, t) => [x + r[1] * Math.cos(t), r[0], z + r[1] * Math.sin(t)],
        q = [pt(a, t), pt(a, u), pt(b, u), pt(b, t)],
        v = [Math.cos((t + u) / 2), 0.2, Math.sin((t + u) / 2)];
      Q(o, 'metal', q, v, C.roof);
    }
}
export function buildSherGarhi(target, _frame, lod = 3) {
  partEvidence.length = 0;
  windowEvidence.length = 0;
  let count = 0;
  const o = {
    addTriangle(...a) {
      count++;
      target.addTriangle(...a);
    },
    addQuad(k, r, q, v, uv, c) {
      o.addTriangle(k, r, q.slice(0, 3), v, uv.slice(0, 3), c);
      o.addTriangle(k, r, [q[0], q[2], q[3]], v, [uv[0], uv[2], uv[3]], c);
    },
    addConvexPolygon(k, r, q, v, uv, c) {
      for (let j = 1; j < q.length - 1; j++)
        o.addTriangle(k, r, [q[0], q[j], q[j + 1]], v, [q[0], q[j], q[j + 1]].map(uv), c);
    },
  };
  for (const a of p.parts) {
    const before = count;
    if (a.openPavilion) pavilion(o, a, lod);
    else {
      const base = a.id === 'upper-rear-hall' ? a.base : 5.5;
      if (base === a.base) {
        B(o, 'lime', a.x, a.base, a.z, a.w, a.eave - a.base, a.d);
      } else {
        B(o, 'stone', a.x, a.base, a.z, a.w, 5.5 - a.base, a.d);
        facade(o, a, lod);
      }
      B(o, 'wood', a.x, a.eave - 0.22, a.z, a.w + 0.7, 0.22, a.d + 0.7);
      hip(o, a.x, a.z, a.w + 1.5, a.d + 1.5, a.eave, a.ridge);
    }
    if (a.id === 'north-projecting-arched-bay') {
      for (const y of [10.4, 14.8]) {
        B(o, 'wood', a.x, y, a.z - a.d / 2 - 0.65, a.w + 1.6, 0.22, 1.5);
        if (lod > 0) {
          B(o, 'wood', a.x, y + 1, a.z - a.d / 2 - 1.3, a.w + 1.6, 0.14, 0.12);
          for (let j = 0; j < 13; j++)
            B(
              o,
              'wood',
              a.x - (a.w + 1) / 2 + ((a.w + 1) * j) / 12,
              y,
              a.z - a.d / 2 - 1.3,
              0.1,
              1,
              0.1,
            );
        }
      }
      for (const xx of [a.x - 5, a.x + 5]) {
        B(o, 'wood', xx, 20.7, a.z, 5, 1.6, 7);
        hip(o, xx, a.z, 6, 8, 22.3, 23.1);
      }
    }
    partEvidence.push({ id: a.id, triangles: count - before });
  }
  const before = count;
  lathe(o, -27, -3, domeProfile, [8, 16, 28, 32][lod]);
  lathe(o, -27, -3, finialProfile, [6, 8, 12, 12][lod]);
  if (lod >= 2)
    for (let i = 0; i < 12; i++) {
      const t = (i * 2 * Math.PI) / 12;
      for (let j = 1; j < domeProfile.length; j++) {
        const a = domeProfile[j - 1],
          b = domeProfile[j];
        beam(
          o,
          'metal',
          [-27 + (a[1] + 0.03) * Math.cos(t), a[0], -3 + (a[1] + 0.03) * Math.sin(t)],
          [-27 + (b[1] + 0.03) * Math.cos(t), b[0], -3 + (b[1] + 0.03) * Math.sin(t)],
          0.09,
          0.09,
          C.roof,
        );
      }
    }
  partEvidence.push({ id: 'ribbed-dome-and-finial', triangles: count - before });
  if (lod > 0) {
    const before = count;
    for (let j = 0; j < 13; j++) {
      const x = -17 + j * 2.4;
      B(o, 'wood', x, -2.5, -10.25, 0.18, 11, 0.22);
      if (lod >= 2) beam(o, 'wood', [x, -1, -10.5], [x, 8.4, -12.8], 0.16, 0.16, C.wood);
    }
    partEvidence.push({ id: 'river-gallery-timber-supports', triangles: count - before });
  }
}
export const sherGarhiSkyline = (o) => buildSherGarhi(o, null, 0),
  sherGarhiDistrict = (o) => buildSherGarhi(o, null, 1),
  sherGarhiStreet = (o) => buildSherGarhi(o, null, 2),
  sherGarhiCloseup = (o) => buildSherGarhi(o, null, 3);
const outlines = p.parts
    .filter((a) => a.id !== 'upper-rear-hall')
    .map((a) => rect(a.x, a.z, a.w, a.d)),
  look = [0, 10, 5];
export const sherGarhiModel = {
  id: 'sher_garhi_palace',
  key: 'sher_garhi_palace',
  cell: 'tw/twj',
  title: 'Sher Garhi Palace — historic riverfront',
  wikidataId: 'Q7494618',
  category: 'historic-palace',
  recipe: 'sher-garhi-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildSherGarhi,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Historic Sher Garhi riverfront palace: projecting multistorey arched north bay and balconies, open domed pavilion/finial, long arched gallery/stone river revetment/timber supports, square south pavilion, terminal open veranda and stepped high rear hall with layered hip roofs. PrimaryGettyCC0Burke/Baker photograph1860s–1870s. Rear massing,107m riverfront/35mdepth and sections original visual estimates; no measured wholecompound or present-day palace claim.',
  appearance: {
    kind: 'historical',
    representedDate: p.representedDate,
    validFrom: '1860-01-01',
    validUntil: '1880-01-01',
    currentWorldEligible: false,
  },
  camera: [105, 70, -145],
  lookAt: look,
  portableGroundY: -2.9,
  mediumFiContext: {
    scale: 1.6,
    groundY: -3,
    far: 2200,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'wood_plain',
    'slate',
    'metal_painted',
  ],
  groundCutout: {
    outline: outlines[0],
    outlines,
    additionalOutlines: outlines.slice(1),
    basis:
      'Individual physical palace volumes only. No whole247mproperty cutout; original provider field unchanged; historic riverlevel and contact unverified.',
  },
  qaCameras: [
    { name: 'riverfront-palace', position: [90, 38, -135], lookAt: look },
    { name: 'north-bay-dome-gallery', position: [-75, 28, -75], lookAt: [-30, 13, -3] },
    { name: 'rear-tiered-halls', position: [70, 65, 100], lookAt: look },
    { name: 'dome-pavilion-and-arched-gallery', position: [-14, 15, -47], lookAt: [-27, 14, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'riverfront-' + reviewLod,
    position: [90, 45, -135],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/sher-garhi-runtime-overlay.mjs',
    level: 'skyline',
    export: 'sherGarhiSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'sherGarhiDistrict', errorMeters: 1, surfaces },
      street: { export: 'sherGarhiStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'sherGarhiCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [p.geometryBasis, p.sectionBasis, ...p.limits],
};
