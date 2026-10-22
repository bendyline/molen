/** Historic Mount Zion tomb/Upper Room exterior, retaining the original signed native plans. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sv/sv9/davids_tomb/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const stone = rgb('b5ad98'),
  edge = rgb('c4bdab'),
  roof = rgb('aaa696'),
  dark = rgb('58605a'),
  metal = rgb('778079');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
};
const ref = 'palette:#ffffff',
  area = (r) =>
    r.reduce((sum, p, i) => {
      const b = r[(i + 1) % r.length];
      return sum + p[0] * b[1] - b[0] * p[1];
    }, 0) / 2;
function tri(out, slot, p, c) {
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    c,
  );
}
function cap(out, slot, r, y, c, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3) {
    let ps = ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
    if (normalFor(...ps)[1] > 0 !== up) ps = [ps[0], ps[2], ps[1]];
    tri(out, slot, ps, c);
  }
}
function shell(out, slot, rings, c) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length,
        ps = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      quad(out, slot, ps, normalFor(...ps), c);
    }
}
function clean(r) {
  r = r.filter(
    (p, i) =>
      Math.hypot(
        p[0] - r[(i + r.length - 1) % r.length][0],
        p[1] - r[(i + r.length - 1) % r.length][1],
      ) > 0.01,
  );
  return area(r) < 0 ? r : [...r].reverse();
}
function facade(out, a, b, h, d, index, body) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]],
    p = (x, y, depth = 0) => [a[0] + u[0] * x + n[0] * depth, y, a[1] + u[1] * x + n[1] * depth],
    outer = [
      [0, -0.4],
      [len, -0.4],
      [len, h],
      [0, h],
    ],
    holes = [];
  if (d > 0 && len > 5) {
    const count = d === 1 ? 1 : Math.max(1, Math.floor(len / 5.1));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * len) / count,
        w = body === 2 ? 0.85 : 0.7,
        y = h - 2.7;
      holes.push({
        kind: 'window',
        ring: [
          [x - w / 2, y],
          [x + w / 2, y],
          [x + w / 2, y + 1.25],
          [x - w / 2, y + 1.25],
        ],
      });
      if (d > 1 && len > 10 && i % 2 === 0) {
        const y0 = 1.7;
        holes.push({
          kind: 'window',
          ring: [
            [x - w / 2, y0],
            [x + w / 2, y0],
            [x + w / 2, y0 + 0.95],
            [x - w / 2, y0 + 0.95],
          ],
        });
      }
    }
    if (body === 0 && n[1] > 0.3 && len > 10) {
      const x = len * 0.5,
        w = 1.7,
        spring = 2.0,
        nseg = d === 1 ? 6 : d === 2 ? 10 : 16,
        ring = [
          [x - w / 2, 0.2],
          [x + w / 2, 0.2],
          [x + w / 2, spring],
        ];
      for (let k = 1; k <= nseg; k++) {
        const t = (k / nseg) * Math.PI;
        ring.push([x + (Math.cos(t) * w) / 2, spring + (Math.sin(t) * w) / 2]);
      }
      holes.splice(
        0,
        holes.length,
        ...holes.filter((o) => o.ring[0][0] > x + w || o.ring[1][0] < x - w),
      );
      holes.push({ kind: 'door', ring });
    }
  }
  const rings = [outer, ...holes.map((o) => o.ring)],
    flat = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(flat.flat(), starts);
  const face = (q, slot, c) => {
    let ps = q;
    if (normalFor(...ps).reduce((v, x, k) => v + x * [n[0], 0, n[1]][k], 0) < 0)
      ps = [ps[0], ps[2], ps[1]];
    tri(out, slot, ps, c);
  };
  for (let i = 0; i < ix.length; i += 3)
    face(
      ix.slice(i, i + 3).map((j) => p(...flat[j])),
      'stone',
      stone,
    );
  for (const o of holes) {
    const back = o.ring.map((q) => p(q[0], q[1], -0.22)),
      ids = earcut(o.ring.flat());
    for (let i = 0; i < ids.length; i += 3)
      face(
        ids.slice(i, i + 3).map((j) => back[j]),
        'dark',
        dark,
      );
    for (let i = 0; i < o.ring.length; i++) {
      const a = o.ring[i],
        b = o.ring[(i + 1) % o.ring.length],
        ps = [p(...a), p(...b), p(b[0], b[1], -0.22), p(a[0], a[1], -0.22)];
      quad(out, 'trim', ps, normalFor(...ps), edge);
      if (d > 1)
        beam(
          out,
          'trim',
          p(a[0], a[1], 0.025),
          p(b[0], b[1], 0.025),
          o.kind === 'door' ? 0.17 : 0.1,
          0.11,
          edge,
        );
    }
    if (d === 3 && o.kind === 'window') {
      const x = (o.ring[0][0] + o.ring[1][0]) / 2;
      beam(out, 'dark', p(x, o.ring[0][1], -0.16), p(x, o.ring[2][1], -0.16), 0.045, 0.055, metal);
    }
  }
  if (d > 0) beam(out, 'trim', p(0, h + 0.33, -0.12), p(len, h + 0.33, -0.12), 0.44, 0.66, edge);
  if (d === 3 && index % 3 === 0 && len > 8)
    beam(out, 'trim', p(0, 0.25, 0.06), p(len, 0.25, 0.06), 0.22, 0.2, edge);
}
function roundBody(out, c, y, r, h, n) {
  const rings = [radialRing(y, r, r, n, c), radialRing(y + h, r, r, n, c)];
  shell(out, 'trim', rings, edge);
  cap(
    out,
    'trim',
    rings[0].map((p) => [p[0], p[2]]),
    y,
    edge,
    false,
  );
  cap(
    out,
    'trim',
    rings[1].map((p) => [p[0], p[2]]),
    y + h,
    edge,
  );
}
function dome(out, c, rx, rz, y, h, d) {
  const n = [8, 12, 24, 40][d],
    bands = [3, 4, 7, 10][d],
    rings = Array.from({ length: bands }, (_, j) => {
      const t = ((j / bands) * Math.PI) / 2;
      return radialRing(y + Math.sin(t) * h, rx * Math.cos(t), rz * Math.cos(t), n, c);
    });
  shell(out, 'roof', rings, roof);
  const last = rings.at(-1);
  for (let i = 0; i < n; i++)
    tri(out, 'roof', [last[i], last[(i + 1) % n], [c[0], y + h, c[1]]], roof);
  cap(
    out,
    'roof',
    rings[0].map((p) => [p[0], p[2]]),
    y,
    roof,
    false,
  );
}
function minaret(out, d) {
  const c = [-4.8, -18],
    n = [8, 12, 20, 32][d],
    base = 11.2;
  B(out, 'stone', c[0], base, c[1], 2.25, 2.2, 2.25, stone);
  roundBody(out, c, base + 2.2, 0.83, 5.0, n);
  roundBody(out, c, base + 7.1, 1.24, 0.42, n);
  roundBody(out, c, base + 7.52, 0.66, 2.2, n);
  const top = radialRing(base + 9.72, 0.75, 0.75, n, c);
  for (let i = 0; i < n; i++)
    tri(out, 'trim', [top[i], top[(i + 1) % n], [c[0], base + 12.0, c[1]]], edge);
  cap(
    out,
    'trim',
    top.map((p) => [p[0], p[2]]),
    base + 9.72,
    edge,
    false,
  );
  if (d > 0)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      beam(
        out,
        'trim',
        [c[0] + Math.cos(a) * 1.15, base + 8.3, c[1] + Math.sin(a) * 1.15],
        [c[0] + Math.cos(b) * 1.15, base + 8.3, c[1] + Math.sin(b) * 1.15],
        0.09,
        0.09,
        edge,
      );
      if (d > 1 && i % 2 === 0)
        beam(
          out,
          'trim',
          [c[0] + Math.cos(a) * 1.15, base + 7.45, c[1] + Math.sin(a) * 1.15],
          [c[0] + Math.cos(a) * 1.15, base + 8.35, c[1] + Math.sin(a) * 1.15],
          0.11,
          0.11,
          edge,
        );
    }
}
function build(out, _frame, d = 3) {
  for (let i = 0; i < plan.buildings.length; i++) {
    const b = plan.buildings[i],
      r = clean(b.outline),
      h = [7.6, 9.2, 11.2][i];
    for (let j = 0; j < r.length; j++) facade(out, r[j], r[(j + 1) % r.length], h, d, j, i);
    cap(out, 'roof', r, h, roof);
    cap(out, 'stone', r, -0.4, stone, false);
  }
  const r = plan.dome,
    x0 = Math.min(...r.map((p) => p[0])),
    x1 = Math.max(...r.map((p) => p[0])),
    z0 = Math.min(...r.map((p) => p[1])),
    z1 = Math.max(...r.map((p) => p[1]));
  dome(out, [(x0 + x1) / 2, (z0 + z1) / 2], (x1 - x0) / 2, (z1 - z0) / 2, 9.2, 2.3, d);
  minaret(out, d);
}
export const davidsTombSkyline = (o, f) => build(o, f, 0);
export const davidsTombDistrict = (o, f) => build(o, f, 1);
export const davidsTombStreet = (o, f) => build(o, f, 2);
export const davidsTombModel = {
  id: 'davids_tomb',
  key: 'davids_tomb',
  recipe: 'structure-davids-tomb.mjs',
  cell: 'sv/sv9',
  title: "David's Tomb",
  category: 'religious-structure',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Named Mount Zion tomb blocks and attached Upper Room on three complete native plans: irregular stepped pale limestone walls, deep courtyard recesses, flat roof terraces with physical parapets, small recessed window/arched-door openings, the native mapped roof dome and a slender historic roof minaret. Excludes neighboring Dormition Abbey, cemetery, sculpture and interiors.',
  camera: [62, 47, 80],
  lookAt: [0, 7, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 0.85 },
  qaCameras: [
    { name: 'tomb-courtyard-and-stonework', position: [-42, 12, 40], lookAt: [-6, 4, 18] },
    { name: 'mapped-dome-and-minaret', position: [30, 25, -28], lookAt: [1, 12, -12] },
    { name: 'upper-room-and-terraces', position: [-28, 19, -54], lookAt: [0, 7, -22] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Three original named building plans and a roof-dome polygon define the signed true-east frame. A fixed open western approach point outside all body plans defines the approximate terrain datum; no roof-return fitting or whole-compound platform.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-davids-tomb.mjs',
    level: 'skyline',
    export: 'davidsTombSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'davidsTombDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'davidsTombStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'Complete original named tomb and immediately attached Upper Room plans retain their signed shape and courtyard recesses. Native layer integers are not interpreted as measured elevations. Body heights7.6/9.2/11.2m, dome rise, minaret dimensions/attachment and small façade openings are photographic medium-fi estimates, not a measured architectural survey.',
    'The exact Qualla-published1878Bonfils exterior is the unambiguously public-domain visual control for stone, stepped massing, arches, low dome and slender minaret. Current native plans/roof dome are separate controls. Modern fittings, restored details and the survival of every1878roof item are not asserted; interiors/curtains and unrelated archaeological imagery are excluded.',
    'Exterior assembly only: no Tomb sarcophagus, religious textiles or inscriptions, Upper Room interior, neighboring Dormition Abbey/other monasteries, cemetery, memorial sculpture or landscape reconstruction. No photographic textures or exterior image links embedded in OSM tags were used.',
    'Host terrain/foundation and courtyard contact are approximate. Footings extend0.4m below a fixed western dry-approach datum; source terrain is preserved and no platform/blanket ground opening is introduced.',
  ],
};
