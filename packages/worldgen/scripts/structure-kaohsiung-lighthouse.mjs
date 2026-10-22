/** Kaohsiung's white octagonal tower and complete attached principal station. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ws/wsj/kaohsiung_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('e7e8df'),
    base: rgb('26302f'),
    paint: rgb('293638'),
    roof: rgb('a3a89e'),
    glass: rgb('577276'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
    base: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95, metallic: 0 },
    paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.16 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.31, metallic: 0.08 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
const area = (r) =>
  r.reduce((a, q, i) => a + q[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * q[1], 0);
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function F(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sign = Math.sign(area(r)),
    n = [sign * u[1], 0, -sign * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return;
  Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function opening(o, f, h, d) {
  if (d === 0) {
    rect(o, 'glass', f, h.x0, h.y0, h.x1, h.y1, 0, h.door ? rgb('425955') : C.glass);
    return;
  }
  const depth = 0.24,
    q = [
      [h.x0, h.y0],
      [h.x1, h.y0],
      [h.x1, h.y1],
      [h.x0, h.y1],
    ];
  for (let k = 0; k < 4; k++) {
    const a = q[k],
      b = q[(k + 1) % 4];
    Q(o, 'wall', [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)]);
  }
  rect(o, 'glass', f, h.x0, h.y0, h.x1, h.y1, -depth, h.door ? rgb('425955') : C.glass);
  if (d) {
    const m = (h.x0 + h.x1) / 2;
    rect(o, 'paint', f, m - 0.025, h.y0, m + 0.025, h.y1, -0.205, C.wall);
    const rows = h.door ? 5 : d > 1 ? 3 : 1;
    for (let k = 1; k <= rows; k++) {
      const y = h.y0 + ((h.y1 - h.y0) * k) / (rows + 1);
      rect(o, 'paint', f, h.x0, y - 0.025, h.x1, y + 0.025, -0.205, C.wall);
    }
    if (d > 1) {
      Q(
        o,
        'wall',
        [
          f.P(h.x0 - 0.12, h.y0 - 0.1),
          f.P(h.x1 + 0.12, h.y0 - 0.1),
          f.P(h.x1 + 0.12, h.y0 - 0.1, 0.15),
          f.P(h.x0 - 0.12, h.y0 - 0.1, 0.15),
        ],
        [0, 1, 0],
      );
      if (d > 2)
        for (const x of [h.x0, h.x1])
          rect(o, 'paint', f, x - 0.04, h.y0, x + 0.04, h.y1, -0.1, C.wall);
    }
  }
}
function facade(o, f, top, holes, d) {
  const ys = [-0.12, 0.72, top, ...holes.flatMap((h) => [h.y0, h.y1])].sort((a, b) => a - b),
    xx = [0, f.len, ...holes.flatMap((h) => [h.x0, h.x1])].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < xx.length; i++) {
      const x = (xx[i] + xx[i - 1]) / 2,
        y = (ys[j] + ys[j - 1]) / 2;
      if (!holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1))
        rect(o, y < 0.72 ? 'base' : 'wall', f, xx[i - 1], ys[j - 1], xx[i], ys[j]);
    }
  for (const h of holes) opening(o, f, h, d);
}
const back = p.outline[5],
  far = p.outline[4],
  xCut = p.parameters.stationPartitionX,
  t = (xCut - far[0]) / (back[0] - far[0]),
  split = [xCut, far[1] + (back[1] - far[1]) * t],
  high = [...p.outline.slice(0, 3), split, back],
  low = [p.outline[2], p.outline[3], p.outline[4], split],
  tc = p.towerCenter;
function station(o, d) {
  for (const [hi, r, top] of [
    [true, high, 7.9],
    [false, low, 4.75],
  ]) {
    cap(o, 'base', r, -0.12, false);
    cap(o, 'roof', r, top - 0.18);
    for (let i = 0; i < r.length; i++) {
      const f = F(r, i),
        internal = hi ? i === 2 : i === 3;
      if (internal) continue;
      let holes = [];
      if (f.len > 2.6) {
        const count = hi ? (f.len < 4.2 ? 1 : f.len > 9 ? 3 : 2) : f.len > 12 ? 4 : 2,
          step = f.len / count;
        for (let k = 0; k < count; k++) {
          const x = (k + 0.5) * step,
            w = hi ? 1.2 : 1.08,
            q = f.P(x, 0),
            behindTower = !hi && Math.hypot(q[0] - tc[0], q[2] - tc[1]) < 3.2;
          if (behindTower) continue;
          holes.push({ x0: x - w / 2, x1: x + w / 2, y0: hi ? 1.05 : 0.85, y1: hi ? 3.2 : 3.8 });
          if (hi) holes.push({ x0: x - w / 2, x1: x + w / 2, y0: 4.8, y1: 6.85 });
        }
        if (hi && i === 0 && d >= 0) {
          holes = holes.filter((h) => h.y0 < 4);
          const x = f.len * 0.52;
          holes.push({ x0: x - 0.55, x1: x + 0.55, y0: 4.05, y1: 7.15, door: true });
        }
      }
      facade(o, f, top - 0.18, holes, d);
      rect(o, 'wall', f, 0, top - 0.32, f.len, top, 0.18);
      Q(
        o,
        'wall',
        [f.P(0, top, 0.18), f.P(f.len, top, 0.18), f.P(f.len, top, -0.25), f.P(0, top, -0.25)],
        [0, 1, 0],
      );
      if (d > 0)
        Q(
          o,
          'wall',
          [
            f.P(0, top - 0.32),
            f.P(f.len, top - 0.32),
            f.P(f.len, top - 0.32, 0.18),
            f.P(0, top - 0.32, 0.18),
          ],
          [0, -1, 0],
        );
      // Photograph shows an open upper balcony at the seaward end room, not a glazed balcony box.
      if (hi && i === 0) {
        const a = 0.18,
          b = f.len - 0.18,
          yy = 4.1,
          depth = 1.12;
        Q(
          o,
          'wall',
          [f.P(a, yy, 0.03), f.P(b, yy, 0.03), f.P(b, yy, depth), f.P(a, yy, depth)],
          [0, 1, 0],
        );
        Q(
          o,
          'wall',
          [
            f.P(a, yy - 0.18, 0.03),
            f.P(a, yy - 0.18, depth),
            f.P(b, yy - 0.18, depth),
            f.P(b, yy - 0.18, 0.03),
          ],
          [0, -1, 0],
        );
        rect(o, 'wall', f, a, yy - 0.18, b, yy, depth);
        const count = [3, 5, 8, 12][d];
        for (let k = 0; k <= count; k++)
          beam(
            o,
            'paint',
            f.P(a + ((b - a) * k) / count, yy, depth - 0.05),
            f.P(a + ((b - a) * k) / count, yy + 1.02, depth - 0.05),
            0.035,
            0.035,
            C.paint,
          );
        beam(
          o,
          'paint',
          f.P(a, yy + 1.02, depth - 0.05),
          f.P(b, yy + 1.02, depth - 0.05),
          0.055,
          0.055,
          C.paint,
        );
        if (d > 0)
          for (const x of [a, b]) {
            beam(o, 'paint', f.P(x, yy, 0.03), f.P(x, yy + 1.02, 0.03), 0.04, 0.04, C.paint);
            beam(
              o,
              'paint',
              f.P(x, yy + 1.02, 0.03),
              f.P(x, yy + 1.02, depth - 0.05),
              0.05,
              0.05,
              C.paint,
            );
            beam(o, 'wall', f.P(x, yy - 0.7), f.P(x, yy - 0.18, 0.8), 0.17, 0.2, C.wall);
          }
      }
      if (hi && d > 1 && i === r.length - 1) {
        const q = f.P(0.55, 0, 0.12);
        beam(o, 'paint', [q[0], 0.28, q[2]], [q[0], 7.65, q[2]], 0.095, 0.095, rgb('a7aca6'));
      }
      if (d > 2 && f.len > 8)
        for (let x = 2; x < f.len; x += 3.2) {
          const a = f.P(x, top - 0.12, -0.05),
            b = f.P(x, top - 0.12, -0.7);
          beam(o, 'paint', a, b, 0.025, 0.025, C.wall);
        }
    }
    // The shared internal partition is hidden; roof levels remain different, with a real exposed high endwall.
    if (hi) {
      const f = F(r, 2);
      rect(o, 'wall', f, 0, 4.75, f.len, 7.72);
    }
  }
}
function tower(o, d) {
  const ring = (y, r, n = 8) => radialRing(y, r, r, n, tc, Math.PI / 8),
    oct = ring(0, 2.55).map((q) => [q[0], q[2]]);
  cap(o, 'base', oct, -0.12, false);
  for (let i = 0; i < 8; i++) {
    const f = F(oct, i),
      holes = i === 2 ? [{ x0: f.len / 2 - 0.24, x1: f.len / 2 + 0.24, y0: 3.65, y1: 6.45 }] : [];
    facade(o, f, 8.05, holes, d);
  }
  loft(
    o,
    'wall',
    (d === 0
      ? [
          [8.04, 2.55],
          [8.65, 3.55],
        ]
      : [
          [8.04, 2.55],
          [8.22, 2.75],
          [8.5, 3.55],
          [8.65, 3.55],
        ]
    ).map(([y, r]) => ring(y, r)),
    C.wall,
  );
  if (d)
    for (let i = 0; i < [8, 8, 16, 24][d]; i++) {
      const a = (i * Math.PI * 2) / [8, 8, 16, 24][d],
        P = (r, y) => [tc[0] + Math.cos(a) * r, y, tc[1] + Math.sin(a) * r];
      beam(o, 'wall', P(2.54, 7.7), P(3.35, 8.48), d === 1 ? 0.24 : 0.18, 0.22, C.wall);
    }
  const n = [6, 16, 32, 48][d],
    P = (a, r, y) => [tc[0] + Math.cos(a) * r, y, tc[1] + Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    beam(o, 'paint', P(a, 3.38, 8.65), P(a, 3.38, 9.65), d < 2 ? 0.05 : 0.035, 0.035, C.paint);
    for (const y of d === 0 ? [9.65] : [8.72, 9.4, 9.65])
      beam(o, 'paint', P(a, 3.38, y), P(b, 3.38, y), 0.04, 0.04, C.paint);
  }
  loft(o, 'wall', [ring(8.64, 1.95, n), ring(9.8, 1.95, n)], C.wall);
  loft(o, 'paint', [ring(9.72, 2.18, n), ring(9.8, 2.18, n)], C.paint);
  const panes = [8, 12, 24, 32][d];
  for (let i = 0; i < panes; i++)
    for (let j = 0; j < 2; j++) {
      const a = (i * Math.PI * 2) / panes,
        b = ((i + 1) * Math.PI * 2) / panes,
        y0 = 9.8 + j * 1.225,
        y1 = y0 + 1.225,
        q = [P(a, 1.98, y0), P(b, 1.98, y0), P(b, 1.98, y1), P(a, 1.98, y1)],
        opaque = i / panes > 0.51 && i / panes < 0.86;
      Q(
        o,
        opaque ? 'paint' : 'glass',
        q,
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        opaque ? C.wall : C.glass,
      );
      if (d) {
        beam(o, 'paint', q[0], q[2], 0.045, 0.045, C.wall);
        beam(o, 'paint', q[1], q[3], 0.045, 0.045, C.wall);
        if (d > 2) {
          const m = q[0].map((v, k) => (v + q[2][k]) / 2);
          B(o, 'paint', m[0], m[1] - 0.025, m[2], 0.05, 0.05, 0.05, C.wall);
        }
      }
    }
  for (const y of d === 0 ? [9.8, 12.25] : [9.8, 11.025, 12.25])
    loft(o, 'wall', [ring(y - 0.04, 2.04, panes), ring(y + 0.04, 2.04, panes)], C.wall);
  const steps = [3, 5, 8, 12][d],
    dome = [];
  for (let k = 0; k <= steps; k++) {
    const a = (k * Math.PI) / 2 / steps;
    dome.push(ring(12.35 + Math.sin(a) * 1.4, Math.max(0.1, Math.cos(a) * 2.15), n));
  }
  loft(o, 'paint', dome, C.paint);
  loft(
    o,
    'paint',
    [
      [13.73, 0.15],
      [13.85, 0.33],
      [14.12, 0.38],
      [14.31, 0.23],
      [14.35, 0.08],
    ]
      .filter((_, i) => d > 0 || (i !== 1 && i !== 3))
      .map(([y, r]) => ring(y, r, [6, 8, 12, 16][d])),
    C.paint,
  );
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(o, 'paint', P(a, 2.06, 12.55), P(a, 1.0, 13.6), 0.025, 0.025, C.paint);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(o, 'paint', P(a, 0.3, 13.89), P(a, 0.35, 14.17), 0.025, 0.025, C.wall);
    }
  }
  beam(o, 'paint', [tc[0], 14.3, tc[1]], [tc[0], 15.2, tc[1]], 0.04, 0.04, C.paint);
  if (d) {
    for (const a of [0, Math.PI / 2]) {
      const u = P(a, 0.64, 14.88),
        v = P(a + Math.PI, 0.64, 14.88);
      beam(o, 'paint', u, v, 0.025, 0.025, C.paint);
      const x = P(a, 0.48, 15.02);
      T(o, 'paint', [u, P(a, 0.32, 14.88), x], [0, 0, 1]);
    }
    beam(
      o,
      'paint',
      [tc[0] - 0.3, 15.08, tc[1]],
      [tc[0] + 0.45, 15.08, tc[1]],
      0.03,
      0.03,
      C.paint,
    );
  }
  // External access ladder with open space between rungs and hooks over the lantern rim.
  if (d) {
    const z = tc[1] - 2.2;
    for (const x of [tc[0] - 0.34, tc[0] + 0.34]) {
      beam(o, 'paint', [x, 9.2, z], [x, 12.5, z], 0.045, 0.045, C.paint);
      beam(o, 'paint', [x, 12.5, z], [x, 12.67, z + 0.18], 0.045, 0.045, C.paint);
      beam(o, 'paint', [x, 12.67, z + 0.18], [x, 12.5, z + 0.36], 0.045, 0.045, C.paint);
    }
    for (let j = 0; j < [0, 6, 10, 13][d]; j++) {
      const y = 9.35 + (j * 3) / [0, 6, 10, 13][d];
      beam(o, 'paint', [tc[0] - 0.34, y, z], [tc[0] + 0.34, y, z], 0.04, 0.04, C.paint);
    }
    if (d > 1)
      for (const y of [9.35, 11.9])
        for (const x of [tc[0] - 0.34, tc[0] + 0.34])
          beam(o, 'paint', [x, y, z], [x, y, tc[1] - 1.95], 0.04, 0.04, C.paint);
  }
}
function build(o, _f, d = 3) {
  station(o, d);
  tower(o, d);
}
export const kaohsiungLighthouseSkyline = (o, f) => build(o, f, 0),
  kaohsiungLighthouseDistrict = (o, f) => build(o, f, 1),
  kaohsiungLighthouseStreet = (o, f) => build(o, f, 2),
  kaohsiungLighthouseCloseup = (o, f) => build(o, f, 3);
export const kaohsiungLighthouseModel = {
  id: 'kaohsiung_lighthouse',
  key: 'kaohsiung_lighthouse',
  cell: 'ws/wsj',
  recipe: 'structure-kaohsiung-lighthouse.mjs',
  title: 'Kaohsiung Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [30, 22, -35],
  lookAt: [-5, 6, 2],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.6, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-octagonal-lighthouse-and-complete-attached-station',
      position: [-28, 18, -34],
      lookAt: [-6, 6.5, 2],
      reviewLod: 'skyline',
    },
    {
      name: 'corbelled-gallery-diamond-glazing-black-dome-and-access-ladder',
      position: [7, 12, -16],
      lookAt: [0, 10.6, -3.45],
    },
    {
      name: 'two-storey-endroom-open-balcony-and-low-window-connector',
      position: [-25, 9, -19],
      lookAt: [-12, 4.5, -3],
    },
    {
      name: 'whole-landward-station-flat-roofs-and-octagonal-tower',
      position: [23, 10, 27],
      lookAt: [-5, 6, 2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256mfield frozen before geometry at fixed landward approach; raw coastal pits/actual hilltop threshold and live host grade agreement unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kaohsiung-lighthouse.mjs',
    level: 'skyline',
    export: 'kaohsiungLighthouseSkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'kaohsiungLighthouseDistrict', errorMeters: 0.28, surfaces },
      street: { export: 'kaohsiungLighthouseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'kaohsiungLighthouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole original6-vertex coarse principal attached station retained, split at original collinear west-room vertex into higher two-storey room and lower connector. Station7.9/4.75m roofs and partition/white window census/hidden landward facade are bounded original photo interpretation. Octagonal shaft radius2.55m/white gallery3.55m/glazing/drum/dome/ladder/finial intermediate heights estimated against official15.2m overall structural height, not official58.2m light elevation or native50m landmark tag. Named native point is identity proxy; photo-derived shaft centre3.451m seaward on coarse station facade, not a surveyed octagonal footprint.',
    'Three exact2025/2026TheNatureBox own/self-cc-zero whole/lantern/rear originals individually inspected/nativeSHA1matched/item-specific grants bound; Qualla-first80families/zero conflicts. Published lighthousePD-self has no clear named source/author and is unused. Samecreatorfourthnight view inspected but distant duplicate/unused, never claimed as a close landward photograph. No restricted pixels/photo textures/generated bitmap/downloaded mesh/metadata repair.',
    'White octagonal shaft/black plinth, actual recessed narrow shaft/room windows and upper door, projecting corbelled gallery with physically open black rails, white drum/diamond-framed glass/representative opaque white shutters, black dome/vent finial/open weather vane and access ladder. Exact shutter/pane/bracket/rung/vent census and current patina bounded; skyline windows flatten their0.24m recess within0.65m error while detailed openings have physical reveals; original fine fittings simplify at distance, full station/tower/black crown survive. No compass text/signletters/flags/people/interiors.',
    'Independent museum683896246/signal891000539/fort/other detached compound buildings not included. No invented hill/harbor/tree/whole visitor compound or city ground/paving slab. Intrinsic station body only, thresholds/plinth/upper balcony photo estimates; hidden foundation/actual steep hillside support unknown.',
    'Independent256m129x129field/all16641values/two raw tilebytes frozen before geometry and unchanged.40.3312m provider-relative approach datum/absolute-357.0477..43.6849m contains implausible coastal composite pits, not bathymetry/foundation control; official58.2m light elevation and native50m landmark heights not terrain-fit constraints. Portable/shared/context flat fixtures separate; ordinary native preview/replaceFootprint=false, true hilltop entry grade and host contact unverified.',
  ],
};
