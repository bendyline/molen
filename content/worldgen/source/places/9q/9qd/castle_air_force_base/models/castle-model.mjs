/** Complete surviving former-base campus, using each individual native footprint. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  normalFor,
  cross,
  beam,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.12 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.08 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.08 },
  door: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.08 },
};
const C = {
    wall: rgb('b9b6a9'),
    foundation: rgb('8f9186'),
    roof: rgb('9c9d94'),
    trim: rgb('777c74'),
    glass: rgb('3d514f'),
    door: rgb('70827b'),
  },
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  sub = (a, b) => a.map((v, i) => v - b[i]),
  area = (a) =>
    a.reduce((s, q, i) => {
      const r = a[(i + 1) % a.length];
      return s + q[0] * r[1] - r[0] * q[1];
    }, 0) / 2;
function T(o, k, q, v, col = C[k]) {
  q = q.map((x) => x.map(Math.fround));
  let n = normalFor(...q);
  if (n.every((x) => x === 0)) return;
  if (v && dot(cross(sub(q[1], q[0]), sub(q[2], q[0])), v) < 0) [q[1], q[2]] = [q[2], q[1]];
  n = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    n,
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
function cap(o, k, ring, y, up = true) {
  for (const t of ShapeUtils.triangulateShape(
    ring.map((q) => new Vector2(...q)),
    [],
  ))
    T(
      o,
      k,
      t.map((i) => [ring[i][0], typeof y === 'function' ? y(ring[i]) : y, ring[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, k, ring, lo, hi, bottom = true) {
  const sign = area(ring) > 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])];
    Q(
      o,
      k,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      n,
    );
  }
  cap(o, k, ring, hi);
  if (bottom) cap(o, k, ring, lo, false);
}
const rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  world = (a, [x, z]) => [
    a.center[0] + a.u[0] * x + a.v[0] * z,
    a.center[1] + a.u[1] * x + a.v[1] * z,
  ];
function split(r, positive) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = positive ? a[1] >= -1e-8 : a[1] <= 1e-8,
      B = positive ? b[1] >= -1e-8 : b[1] <= 1e-8;
    if (A) out.push(a);
    if (A !== B) {
      const t = -a[1] / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), 0]);
    }
  }
  return out.filter(
    (q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-7,
  );
}
function roof(o, a, lod) {
  const y = a.floor + a.eave,
    r = a.outline;
  if (a.roof === 'gable') {
    const height = (q) => y + a.rise * Math.max(0, 1 - Math.abs(q[1]) / (a.depth / 2));
    for (const positive of [false, true]) {
      const q = split(r, positive);
      if (q.length >= 3) {
        const v = [0, 1, 0];
        for (const t of ShapeUtils.triangulateShape(
          q.map((p) => new Vector2(...p)),
          [],
        ))
          T(
            o,
            'roof',
            t.map((i) => {
              const w = world(a, q[i]);
              return [w[0], height(q[i]), w[1]];
            }),
            v,
          );
      }
    }
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        B = r[(i + 1) % r.length],
        cuts = [A];
      if (A[1] * B[1] < 0) {
        const t = -A[1] / (B[1] - A[1]);
        cuts.push([A[0] + t * (B[0] - A[0]), 0]);
      }
      cuts.push(B);
      for (let j = 1; j < cuts.length; j++) {
        const A = cuts[j - 1],
          B = cuts[j],
          wa = world(a, A),
          wb = world(a, B),
          n = [wb[1] - wa[1], 0, -(wb[0] - wa[0])].map((x) => x * (area(r) > 0 ? 1 : -1));
        Q(
          o,
          'wall',
          [
            [wa[0], y, wa[1]],
            [wb[0], y, wb[1]],
            [wb[0], height(B), wb[1]],
            [wa[0], height(A), wa[1]],
          ],
          n,
        );
      }
    }
  } else if (a.roof === 'tank-cap') {
    const c = a.center;
    for (let i = 0; i < r.length; i++) {
      const a0 = world(a, r[i]),
        b = world(a, r[(i + 1) % r.length]);
      T(
        o,
        'trim',
        [
          [a0[0], y, a0[1]],
          [b[0], y, b[1]],
          [c[0], y + a.rise, c[1]],
        ],
        [0, 1, 0],
      );
    }
  } else {
    cap(o, 'roof', a.nativeOutline, y);
    if (lod >= 2) {
      for (let i = 0; i < a.nativeOutline.length; i++) {
        const A = a.nativeOutline[i],
          B = a.nativeOutline[(i + 1) % a.nativeOutline.length];
        beam(o, 'trim', [A[0], y + 0.1, A[1]], [B[0], y + 0.1, B[1]], 0.16, 0.16, C.trim);
      }
    }
  }
}
export const buildingEvidence = [],
  apertureEvidence = [];
function wall(o, a, index, lod) {
  const A = a.nativeOutline[index],
    B = a.nativeOutline[(index + 1) % a.nativeOutline.length],
    dx = B[0] - A[0],
    dz = B[1] - A[1],
    len = Math.hypot(dx, dz);
  if (len < 0.001) return;
  const sign = area(a.nativeOutline) > 0 ? 1 : -1,
    n = [(sign * dz) / len, 0, (-sign * dx) / len],
    u = [dx / len, 0, dz / len],
    P = (q, depth = 0) => [
      A[0] + u[0] * q[0] - n[0] * depth,
      a.floor + q[1],
      A[1] + u[2] * q[0] - n[2] * depth,
    ],
    outer = [
      [0, 0],
      [len, 0],
      [len, a.eave],
      [0, a.eave],
    ],
    holes = [],
    front = a.kind === 'hangar' && index === a.doorEdge;
  if (front) {
    const count = a.way === 208651339 ? 3 : 1,
      usable = len * 0.85,
      unit = usable / count;
    for (let j = 0; j < count; j++) {
      const x = (len - usable) / 2 + unit * j + 0.32,
        w = unit - 0.64,
        h = Math.min(a.eave - 1.3, a.kind === 'hangar' ? 10 : 3);
      holes.push({
        kind: 'door',
        shape: [
          [x, 0.12],
          [x + w, 0.12],
          [x + w, h],
          [x, h],
        ],
        x,
        w,
        y: 0.12,
        h,
      });
    }
  } else if (lod >= 2 && a.kind !== 'tank' && len > 5.5) {
    const count = Math.floor((len - 2) / a.windowSpacing);
    for (let j = 0; j < count; j++) {
      const x = (len * (j + 0.5)) / count - 1.15,
        y = 1.15,
        h = Math.min(1.65, a.eave - 2),
        w = 2.3;
      if (h > 0.4)
        holes.push({
          kind: 'window',
          shape: [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ],
          x,
          w,
          y,
          h,
        });
    }
  }
  if (lod >= 3 || (front && lod >= 2)) {
    const all = [outer, ...holes.map((h) => h.shape)].flat(),
      ts = ShapeUtils.triangulateShape(
        outer.map((q) => new Vector2(...q)),
        holes.map((h) => h.shape.map((q) => new Vector2(...q))),
      );
    for (const t of ts)
      T(
        o,
        a.kind === 'tank' ? 'trim' : 'wall',
        t.map((i) => P(all[i])),
        n,
      );
  } else
    Q(
      o,
      a.kind === 'tank' ? 'trim' : 'wall',
      outer.map((q) => P(q)),
      n,
    );
  for (const h of holes) {
    const real = lod >= 3 || (front && lod >= 2),
      depth = real ? (front ? 0.28 : 0.16) : -0.025,
      k = h.kind === 'door' ? 'door' : 'glass';
    Q(
      o,
      k,
      h.shape.map((q) => P(q, depth)),
      n,
    );
    if (real) {
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        Q(o, 'trim', [P(h.shape[i]), P(h.shape[j]), P(h.shape[j], depth), P(h.shape[i], depth)]);
      }
      const z = depth - 0.025;
      if (h.kind === 'window') {
        const x = h.x + h.w / 2,
          y = h.y + h.h / 2;
        Q(
          o,
          'trim',
          [
            P([x - 0.035, h.y], z),
            P([x + 0.035, h.y], z),
            P([x + 0.035, h.y + h.h], z),
            P([x - 0.035, h.y + h.h], z),
          ],
          n,
        );
        Q(
          o,
          'trim',
          [
            P([h.x, y - 0.035], z),
            P([h.x + h.w, y - 0.035], z),
            P([h.x + h.w, y + 0.035], z),
            P([h.x, y + 0.035], z),
          ],
          n,
        );
      } else {
        for (let j = 1; j < 6; j++) {
          const x = h.x + (h.w * j) / 6;
          Q(
            o,
            'trim',
            [
              P([x - 0.035, h.y], z),
              P([x + 0.035, h.y], z),
              P([x + 0.035, h.h], z),
              P([x - 0.035, h.h], z),
            ],
            n,
          );
        }
        if (lod >= 3)
          for (const y of [h.h * 0.35, h.h * 0.68]) {
            Q(
              o,
              'glass',
              [
                P([h.x + 0.2, y], z),
                P([h.x + h.w - 0.2, y], z),
                P([h.x + h.w - 0.2, y + 0.45], z),
                P([h.x + 0.2, y + 0.45], z),
              ],
              n,
            );
          }
      }
    }
    apertureEvidence.push({
      building: a.id,
      edge: index,
      kind: h.kind,
      center: P([h.x + h.w / 2, h.y + h.h * 0.37]),
      normal: n,
      recess: real ? depth : 0,
      width: h.w,
      height: h.h,
    });
  }
}
function building(o, a, lod) {
  if (lod === 0) {
    const ring =
      a.kind === 'tank'
        ? Array.from({ length: 6 }, (_, i) => {
            const t = (i * Math.PI) / 3;
            return [
              a.center[0] + (a.width / 2) * Math.cos(t),
              a.center[1] + (a.depth / 2) * Math.sin(t),
            ];
          })
        : a.footprintArea / (a.width * a.depth) < 0.5
          ? a.nativeOutline
          : rect(0, 0, a.width, a.depth).map((q) => world(a, q));
    prism(
      o,
      a.kind === 'tank' ? 'trim' : 'wall',
      ring,
      a.floor - a.foundationDepth,
      a.floor + a.eave + a.rise,
      false,
    );
    return;
  }
  if (lod >= 2)
    prism(o, 'foundation', a.nativeOutline, a.floor - a.foundationDepth, a.floor - 0.01);
  for (let i = 0; i < a.nativeOutline.length; i++) wall(o, a, i, lod);
  cap(o, a.kind === 'tank' ? 'trim' : 'wall', a.nativeOutline, a.floor, false);
  roof(o, a, lod);
}
function lathe(o, k, center, rings, sides) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < sides; i++) {
      const a = (i * 2 * Math.PI) / sides,
        b = ((i + 1) * 2 * Math.PI) / sides,
        [y, r] = rings[j - 1],
        [Y, R] = rings[j],
        q = [
          [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)],
          [center[0] + r * Math.cos(b), y, center[1] + r * Math.sin(b)],
          [center[0] + R * Math.cos(b), Y, center[1] + R * Math.sin(b)],
          [center[0] + R * Math.cos(a), Y, center[1] + R * Math.sin(a)],
        ];
      Q(o, k, q, [Math.cos((a + b) / 2), 0.1, Math.sin((a + b) / 2)]);
    }
}
function tower(o, lod) {
  const t = p.tower,
    c = t.center,
    y = t.floor,
    ring = rect(c[0], c[1], t.stemWidth, t.stemWidth);
  prism(o, 'foundation', ring, y - 1.2, y + t.stemTop);
  lathe(
    o,
    'trim',
    c,
    [
      [y + t.cabBottom, 4.0],
      [y + t.cabGlassBottom, t.cabRadius],
    ],
    8,
  );
  lathe(
    o,
    'glass',
    c,
    [
      [y + t.cabGlassBottom, t.cabRadius],
      [y + t.cabGlassTop, t.cabRadius + 0.32],
    ],
    8,
  );
  lathe(
    o,
    'roof',
    c,
    [
      [y + t.cabGlassTop, t.cabRadius + 0.65],
      [y + t.roofTop, 2.5],
    ],
    8,
  );
  cap(
    o,
    'roof',
    Array.from({ length: 8 }, (_, i) => [
      c[0] + 2.5 * Math.cos((i * Math.PI) / 4),
      c[1] + 2.5 * Math.sin((i * Math.PI) / 4),
    ]),
    y + t.roofTop,
  );
  beam(o, 'trim', [c[0], y + t.roofTop, c[1]], [c[0], y + t.antennaTop, c[1]], 0.12, 0.12, C.trim);
  if (lod > 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        o,
        'trim',
        [c[0] + t.cabRadius * Math.cos(a), y + t.cabGlassBottom, c[1] + t.cabRadius * Math.sin(a)],
        [
          c[0] + (t.cabRadius + 0.32) * Math.cos(a),
          y + t.cabGlassTop,
          c[1] + (t.cabRadius + 0.32) * Math.sin(a),
        ],
        0.14,
        0.14,
        C.trim,
      );
    }
}
export function buildCastle(out, _frame, lod = 3) {
  buildingEvidence.length = apertureEvidence.length = 0;
  let count = 0;
  const o = {
    addTriangle(...a) {
      count++;
      out.addTriangle(...a);
    },
    addQuad(...a) {
      count += 2;
      out.addQuad(...a);
    },
    addConvexPolygon(...a) {
      count += a[2].length - 2;
      out.addConvexPolygon(...a);
    },
  };
  for (const a of p.buildings) {
    const n = count;
    building(o, a, lod);
    buildingEvidence.push({
      id: a.id,
      kind: a.kind,
      nativeControls: a.outline.length,
      triangles: count - n,
      floor: a.floor,
      eave: a.eave,
      rise: a.rise,
    });
  }
  const n = count;
  tower(o, lod);
  buildingEvidence.push({ id: p.tower.id, kind: 'aircraft-control-tower', triangles: count - n });
}
export const castleSkyline = (o) => buildCastle(o, null, 0),
  castleDistrict = (o) => buildCastle(o, null, 1),
  castleStreet = (o) => buildCastle(o, null, 2),
  castleCloseup = (o) => buildCastle(o, null, 3);
const focus = (id, distance, alt) => {
    const a = p.buildings.find((x) => x.way === id),
      A = a.nativeOutline[a.doorEdge],
      B = a.nativeOutline[(a.doorEdge + 1) % a.nativeOutline.length],
      s = area(a.nativeOutline) > 0 ? 1 : -1,
      len = Math.hypot(B[0] - A[0], B[1] - A[1]),
      n = [(s * (B[1] - A[1])) / len, (-s * (B[0] - A[0])) / len];
    return {
      position: [a.center[0] + n[0] * distance, a.floor + alt, a.center[1] + n[1] * distance],
      lookAt: [a.center[0], a.floor + a.eave * 0.45, a.center[1]],
    };
  },
  look = [0, 8, 100],
  outlines = [...p.buildings]
    .sort((a, b) => b.footprintArea - a.footprintArea)
    .slice(0, 64)
    .map((a) => a.nativeOutline),
  floorMin = Math.min(...p.buildings.map((x) => x.floor - x.foundationDepth));
export const castleModel = {
  id: 'castle_air_force_base',
  key: 'castle_air_force_base',
  cell: '9q/9qd',
  title: 'Former Castle Air Force Base — surviving built campus',
  wikidataId: 'Q472049',
  category: 'aviation-campus',
  recipe: 'castle-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCastle,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-whole-building-controls',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole current surviving former-base built campus:84 individually mapped building/tank footprints,10hangars, operations/training/support blocks and native aircraft-control tower. Open spatial gaps remain. Clear published Qualla USAF1982 parade-ground aerial guides older industrial character only; hidden/current roofs, sections/openings/colors/tower form original estimates. No site extrusion, runway, aircraft, detached housing, later prison or outside museum display.',
  camera: [2400, 1700, 2900],
  lookAt: look,
  mediumFiContext: {
    scale: 20,
    groundY: floorMin - 0.2,
    far: 16000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'metal_corrugated', 'metal_painted'],
  groundCutout: {
    outline: outlines[0],
    outlines,
    additionalOutlines: outlines.slice(1),
    basis:
      'The64 largest individual physical building/tank footprints respect the existing64-opening runtime limit; the20 smaller structures retain unmasked original terrain. All84 buildings remain modeled with original fixed floors. No airport/commercial membership parcel cutout; exact current contact unverified.',
  },
  qaCameras: [
    { name: 'whole-surviving-campus', position: [1800, 1250, 2200], lookAt: look },
    { name: 'main-maintenance-hangar', ...focus(208651339, 130, 26) },
    { name: 'three-flight-school-hangars', ...focus(208651707, 160, 32) },
    {
      name: 'control-tower-and-operations',
      position: [p.tower.center[0] + 85, p.tower.floor + 40, p.tower.center[1] + 90],
      lookAt: [p.tower.center[0], p.tower.floor + 16, p.tower.center[1]],
    },
    { name: 'southern-support-campus', position: [1100, 600, 2000], lookAt: [0, 8, 1100] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-campus-' + reviewLod,
    position: [1800, 1250, 2200],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/9q/9qd/castle_air_force_base/models/castle-model.mjs',
    level: 'skyline',
    export: 'castleSkyline',
    errorMeters: p.lodErrorBudgets.skyline,
    surfaces,
    authoredLevels: {
      district: { export: 'castleDistrict', errorMeters: p.lodErrorBudgets.district, surfaces },
      street: { export: 'castleStreet', errorMeters: p.lodErrorBudgets.street, surfaces },
      closeup: { export: 'castleCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    ...p.limits,
    'The existing renderer supports64 physical terrain openings per placement. The64 largest actual footprints receive cutouts;20 small structures retain the original field. All84 whole buildings remain in every LOD with unchanged floors and sections. No bridging of open campus space or fabricated site cutout.',
  ],
};
