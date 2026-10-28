/** Whole named cathedral, in the unmodified native geographic frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  n = JSON.parse(fs.readFileSync(new URL('../native-controls.json', import.meta.url))),
  { floorY: F, architecturalSections: A } = p.parameters;
const C = {
  lime: rgb('e8e5d6'),
  stone: rgb('706b59'),
  roof: rgb('b78059'),
  glaze: rgb('46765b'),
  wood: rgb('46342b'),
  metal: rgb('39403d'),
};
export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  glaze: { slot: 'roof', graph: 'tile_glazed', roughness: 0.5, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.2 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  lift = (q, y) => [q[0], y, q[1]],
  point = (x, t) => n.base.map((a, k) => a + n.u[k] * x + n.v[k] * t),
  world = (q) => {
    const x = point(q[0], q[2]);
    return [x[0], q[1] + F, x[1]];
  },
  vector = (q) => [n.u[0] * q[0] + n.v[0] * q[2], q[1], n.u[1] * q[0] + n.v[1] * q[2]];
function T(o, k, q, v, col = C[k]) {
  q = q.map(world).map((q) => q.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (v && dot(cr, vector(v)) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function cap(o, k, r, y, up = 1) {
  const tri = ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  );
  for (const t of tri)
    T(
      o,
      k,
      t.map((i) => lift(r[i], typeof y === 'function' ? y(r[i]) : y)),
      [0, up, 0],
    );
}
function walls(o, k, r, y, Y, omit = -1) {
  const s = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    if (i === omit) continue;
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [lift(a, y), lift(b, y), lift(b, Y), lift(a, Y)],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
}
function solid(o, k, r, y, Y) {
  walls(o, k, r, y, Y);
  cap(o, k, r, Y);
  cap(o, k, r, y, -1);
}
const rect = (x, t, w, d) => [
    [x - w / 2, t - d / 2],
    [x + w / 2, t - d / 2],
    [x + w / 2, t + d / 2],
    [x - w / 2, t + d / 2],
  ],
  R = n.architecturalOutline,
  main = [0, 1, 4, 5, 6, 7, 10].map((i) => R[i]),
  portico = [1, 2, 3, 4].map((i) => R[i]),
  tower = [7, 8, 9, 10].map((i) => R[i]);
function clip(r, t, keepBelow) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = (a[1] - t) * (keepBelow ? 1 : -1),
      db = (b[1] - t) * (keepBelow ? 1 : -1);
    if (da <= 1e-8) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(mix(a, b, (t - a[1]) / (b[1] - a[1])));
  }
  return out;
}
function roofStrip(o, lo, hi, fn) {
  const r = clip(clip(main, hi, true), lo, false);
  cap(o, 'roof', r, fn);
  walls(o, 'roof', r, A.eaves - 0.15, A.eaves);
}
function ring(o, k, x, t, r, y, sides) {
  const rr = Array.from({ length: sides }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / sides),
    t + r * Math.sin((i * 2 * Math.PI) / sides),
  ]);
  solid(o, k, rr, y, y + 0.18);
}
function dome(o, x, t, r, y, h, lod, col = C.glaze) {
  const sides = [12, 12, 28, 28][lod],
    rows = [3, 5, 10, 12][lod],
    q = (j, i) => {
      const a = (j * Math.PI) / 2 / rows,
        b = (i * 2 * Math.PI) / sides;
      return [
        x + r * Math.cos(a) * Math.cos(b),
        y + h * Math.sin(a),
        t + r * Math.cos(a) * Math.sin(b),
      ];
    };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < sides; i++)
      Q(
        o,
        'glaze',
        [q(j, i), q(j, i + 1), q(j + 1, i + 1), q(j + 1, i)],
        [
          Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
          0.7,
          Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
        ],
        i % 4 === 0 ? rgb('b5a65b') : col,
      );
}
function cylinder(o, k, x, t, r, y, Y, lod) {
  const sides = [6, 8, 12, 16][lod];
  solid(
    o,
    k,
    Array.from({ length: sides }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / sides),
      t + r * Math.sin((i * 2 * Math.PI) / sides),
    ]),
    y,
    Y,
  );
}
function crossMark(o, x, t, y, h) {
  solid(o, 'metal', rect(x, t, 0.11, 0.11), y, y + h);
  solid(o, 'metal', rect(x, t, 0.75, 0.1), y + h * 0.62, y + h * 0.62 + 0.1);
}
function lantern(o, x, t, r, y, lod) {
  if (!lod) {
    solid(o, 'lime', rect(x, t, r * 2, r * 2), y, y + 1.3);
    const q = rect(x, t, r * 2.5, r * 2.5);
    for (let i = 0; i < 4; i++)
      T(o, 'glaze', [lift(q[i], y + 1.3), lift(q[(i + 1) % 4], y + 1.3), [x, y + 2, t]], [0, 1, 0]);
    crossMark(o, x, t, y + 2, 1.1);
    return;
  }
  cylinder(o, 'lime', x, t, r, y, y + 1.2, lod);
  ring(o, 'lime', x, t, r * 1.22, y + 1.12, [8, 12, 16, 20][lod]);
  dome(o, x, t, r * 1.25, y + 1.3, 0.7, lod);
  crossMark(o, x, t, y + 2, 1.1);
}
export const partEvidence = [],
  doorEvidence = [],
  stairEvidence = [];
function porticoFace(o, lod) {
  let a = portico[1],
    b = portico[2],
    u = sub(b, a),
    L = Math.hypot(...u);
  u = u.map((x) => x / L);
  const inward = [-u[1], u[0]],
    q = (s, y, d = 0) => [a[0] + u[0] * s + inward[0] * d, y, a[1] + u[1] * s + inward[1] * d],
    normal = [-inward[0], 0, -inward[1]],
    half = A.doorWidth / 2,
    mid = L / 2,
    l = mid - half,
    r = mid + half,
    H = A.porticoHeight,
    steps = [6, 8, 14, 20][lod];
  for (const [s, S] of [
    [0, l],
    [r, L],
  ])
    Q(o, 'stone', [q(s, A.baseY), q(S, A.baseY), q(S, H), q(s, H)], normal);
  Q(o, 'stone', [q(l, A.baseY), q(r, A.baseY), q(r, 0), q(l, 0)], normal);
  const arch = [];
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI - (i * Math.PI) / steps;
    arch.push([mid + half * Math.cos(theta), A.doorSpring + A.doorRise * Math.sin(theta)]);
  }
  for (let i = 0; i < steps; i++) {
    const [s, y] = arch[i],
      [S, Y] = arch[i + 1];
    Q(o, 'stone', [q(s, y), q(S, Y), q(S, H), q(s, H)], normal);
    Q(o, 'stone', [q(s, y), q(s, y, 0.65), q(S, Y, 0.65), q(S, Y)], [0, -1, 0]);
    const outerA = [s + ((s - mid) / half) * 0.23, y + 0.22],
      outerB = [S + ((S - mid) / half) * 0.23, Y + 0.22];
    Q(
      o,
      'lime',
      [q(s, y, -0.04), q(S, Y, -0.04), q(...outerB, -0.04), q(...outerA, -0.04)],
      normal,
    );
  }
  for (const s of [l, r])
    Q(
      o,
      'stone',
      [q(s, 0), q(s, A.doorSpring), q(s, A.doorSpring, 0.65), q(s, 0, 0.65)],
      [s === l ? u[0] : -u[0], 0, s === l ? u[1] : -u[1]],
    );
  doorEvidence.push({
    width: A.doorWidth,
    spring: A.doorSpring,
    rise: A.doorRise,
    segments: steps,
    depth: 0.65,
  });
  for (const x of [portico[1][0] + 0.55, portico[2][0] - 0.55]) {
    solid(o, 'stone', rect(x, A.porticoFront - 0.13, 0.38, 0.32), 0, H - 0.4);
    solid(o, 'lime', rect(x, A.porticoFront - 0.2, 0.65, 0.5), H - 0.5, H - 0.15);
  }
}
function accessSteps(o, lod) {
  const count = [3, 6, 12, 12][lod],
    sides = [12, 18, 28, 36][lod],
    X = A.porticoCenter,
    t = A.porticoFront;
  for (let j = 0; j < count; j++) {
    const ro = A.stairOuterRadius - ((A.stairOuterRadius - A.stairInnerRadius) * j) / count,
      ri = A.stairOuterRadius - ((A.stairOuterRadius - A.stairInnerRadius) * (j + 1)) / count,
      Y = -F + ((j + 1) * F) / count,
      y = -F + (j * F) / count;
    for (let i = 0; i < sides; i++) {
      const q = (r, k, h) => [
        X + r * Math.cos((k * Math.PI) / sides),
        h,
        t - r * Math.sin((k * Math.PI) / sides),
      ];
      Q(
        o,
        'stone',
        [q(ro, i, y), q(ro, i + 1, y), q(ro, i + 1, Y), q(ro, i, Y)],
        [Math.cos(((i + 0.5) * Math.PI) / sides), 0, -Math.sin(((i + 0.5) * Math.PI) / sides)],
      );
      Q(o, 'stone', [q(ro, i, Y), q(ro, i + 1, Y), q(ri, i + 1, Y), q(ri, i, Y)], [0, 1, 0]);
      if (j === count - 1) T(o, 'stone', [q(ri, i, Y), q(ri, i + 1, Y), [X, Y, t]], [0, 1, 0]);
    }
    stairEvidence.push({ count, radius: ro, height: Y + F });
  }
  for (const sign of [-1, 1]) {
    const r = [
      [X + sign * A.stairInnerRadius, t],
      [X + sign * A.stairOuterRadius, t],
      [X + sign * A.stairOuterRadius, t + 0.08],
      [X + sign * A.stairInnerRadius, t + 0.08],
    ];
    solid(o, 'stone', r, -F, 0);
  }
}
function towerBody(o, lod) {
  const cx = tower.reduce((s, q) => s + q[0] / 4, 0),
    ct = tower.reduce((s, q) => s + q[1] / 4, 0),
    w = 6.7,
    H = A.towerHeightAboveDatum - F;
  solid(o, 'lime', tower, A.baseY, 22.2);
  for (const Y of lod ? [5.1, 11.5, 17.3, 22.1] : [])
    solid(o, 'lime', rect(cx, ct, w + 0.45, w + 0.45), Y, Y + 0.3);
  solid(o, 'lime', rect(cx, ct, w, w), 22.2, 27.1);
  solid(o, 'lime', rect(cx, ct, w + 0.5, w + 0.5), 27, 27.4);
  // Open belfry between four corner piers, with a separate recessed bell volume.
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      solid(o, 'lime', rect(cx + a * (w / 2 - 0.5), ct + b * (w / 2 - 0.5), 1, 1), 27.4, 32.6);
  for (const a of [-1, 1]) {
    solid(o, 'lime', rect(cx, ct + a * (w / 2 - 0.35), w, 0.7), 31.7, 32.6);
    solid(o, 'lime', rect(cx + a * (w / 2 - 0.35), ct, 0.7, w), 31.7, 32.6);
  }
  if (lod) cylinder(o, 'metal', cx, ct, 0.9, 28.6, 30.2, lod);
  solid(o, 'lime', rect(cx, ct, w + 0.55, w + 0.55), 32.6, 33.15);
  dome(o, cx, ct, 3.35, 33.15, 2.6, lod);
  cylinder(o, 'lime', cx, ct, 0.48, 35.75, H - 0.85, lod);
  crossMark(o, cx, ct, H - 0.85, 0.85);
  for (let j = 0; lod && j < 4; j++) {
    const Y = 6.7 + j * 4.4;
    for (const s of [-1, 1]) {
      solid(o, 'wood', rect(cx, ct + s * (w / 2 + 0.015), 1.1, 0.04), Y, Y + 1.8);
      solid(o, 'wood', rect(cx + s * (w / 2 + 0.015), ct, 0.04, 1.1), Y, Y + 1.8);
    }
  }
}
export function buildQuitoCathedral(target, _frame, lod = 3) {
  for (const a of [partEvidence, doorEvidence, stairEvidence]) a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (name, fn) => {
      const q = count;
      fn();
      partEvidence.push({ name, triangles: count - q });
    };
  part('whole-native-cathedral-main-three-aisle-envelope', () => {
    solid(o, 'lime', main, A.baseY, A.eaves);
    for (const t of [7, 19]) {
      const r = clip(clip(main, t + 0.1, true), t - 0.1, false);
      solid(o, 'lime', r, A.aisleJoin, A.clerestory);
    }
    const mid = 13;
    roofStrip(o, -1, 7, (q) => A.eaves + ((A.aisleJoin - A.eaves) * q[1]) / 7);
    roofStrip(o, 19, 28, (q) => A.eaves + ((A.aisleJoin - A.eaves) * (26.1 - q[1])) / 7.1);
    roofStrip(o, 7, mid, (q) => A.clerestory + ((A.ridge - A.clerestory) * (q[1] - 7)) / 6);
    roofStrip(o, mid, 19, (q) => A.ridge - ((A.ridge - A.clerestory) * (q[1] - mid)) / 6);
    for (const x of [0.1, 78]) {
      const rr = [
        [x, 7],
        [x + 0.12, 7],
        [x + 0.12, 19],
        [x, 19],
      ];
      solid(o, 'lime', rr, A.eaves, A.clerestory);
      T(
        o,
        'lime',
        [
          [x, A.clerestory, 7],
          [x, A.clerestory, 19],
          [x, A.ridge, 13],
        ],
        [x < 1 ? -1 : 1, 0, 0],
      );
    }
  });
  part('mapped-lateral-stone-portico-true-open-arched-entry', () => {
    walls(o, 'stone', portico, A.baseY, A.porticoHeight, 1);
    cap(o, 'stone', portico, A.porticoHeight);
    porticoFace(o, lod);
    ring(o, 'lime', A.porticoCenter, -3.65, 4.5, A.porticoHeight, [8, 12, 20, 28][lod]);
    dome(o, A.porticoCenter, -3.65, 4.2, A.porticoHeight + 0.18, A.porticoDomeRise, lod);
    lantern(o, A.porticoCenter, -3.65, 0.65, A.porticoHeight + 0.18 + A.porticoDomeRise, lod);
    for (const x of lod ? [32.9, 41.2] : []) {
      cylinder(o, 'lime', x, -7.4, 0.22, A.porticoHeight, A.porticoHeight + 1.2, lod);
      dome(o, x, -7.4, 0.3, A.porticoHeight + 1.2, 0.5, lod);
    }
  });
  part('intrinsic-semicircular-stone-entry-stairs', () => accessSteps(o, lod));
  part('presbytery-hexagonal-drum-green-cupola-and-lantern-estimate', () => {
    const r = Array.from({ length: 6 }, (_, i) => [
      A.apseX + A.apseRadius * Math.cos((i * Math.PI) / 3),
      A.apseT + A.apseRadius * Math.sin((i * Math.PI) / 3),
    ]);
    solid(o, 'lime', r, 12, A.apseDrum);
    ring(o, 'lime', A.apseX, A.apseT, A.apseRadius + 0.1, A.apseDrum, 12);
    dome(o, A.apseX, A.apseT, A.apseRadius, A.apseDrum + 0.18, A.apseRise, lod);
    lantern(o, A.apseX, A.apseT, 0.9, A.apseDrum + 0.18 + A.apseRise, lod);
  });
  part('whole-intrinsic-western-bell-tower-and-open-belfry38.78m', () => towerBody(o, lod));
  part('bounded-street-facade-cornices-pilasters-closed-timber-panels', () => {
    for (const t of [0.03, 25.8]) {
      solid(o, 'lime', rect(39, t, 78, 0.22), A.eaves - 0.5, A.eaves);
      for (const x of lod ? [5, 13, 21, 29, 45, 53, 61, 72] : []) {
        solid(o, 'lime', rect(x, t, 0.4, 0.3), 0, A.eaves - 0.5);
        if (lod > 0) solid(o, 'wood', rect(x + 2.8, t - 0.12, 1.05, 0.1), 5.8, 8.0);
      }
    }
    for (const t of [7, 19])
      for (const x of [9, 19, 29, 39, 49, 59, 69]) {
        if (lod)
          solid(
            o,
            'wood',
            rect(x, t + (t < 13 ? -0.12 : 0.12), 1.5, 0.06),
            A.aisleJoin + 0.3,
            A.clerestory - 0.2,
          );
      }
    for (const x of lod ? [3.8, 17.8, 54.8, 74.8] : []) {
      cylinder(o, 'lime', x, 0.05, 0.24, A.eaves, A.eaves + 1, lod);
      dome(o, x, 0.05, 0.32, A.eaves + 1, 0.5, lod);
    }
    solid(o, 'stone', rect(0.02, 8, 0.24, 6.5), 0, 7);
    solid(o, 'wood', rect(-0.13, 8, 0.08, 3.6), 0, 5.3);
  });
}
export const quitoCathedralSkyline = (o) => buildQuitoCathedral(o, null, 0),
  quitoCathedralDistrict = (o) => buildQuitoCathedral(o, null, 1),
  quitoCathedralStreet = (o) => buildQuitoCathedral(o, null, 2),
  quitoCathedralCloseup = (o) => buildQuitoCathedral(o, null, 3);
const cam = (x, y, t) => world([x, y - F, t]),
  cutout = [
    R[0],
    R[1],
    R[2],
    ...Array.from({ length: 37 }, (_, i) => {
      const a = Math.PI - (i * Math.PI) / 36;
      return [
        A.porticoCenter + A.stairOuterRadius * Math.cos(a),
        A.porticoFront - A.stairOuterRadius * Math.sin(a),
      ];
    }),
    R[3],
    R[4],
    R[5],
    R[6],
    R[7],
    R[8],
    R[9],
    R[10],
  ].map((q) => point(...q));
export const quitoCathedralModel = {
  id: 'quito_metropolitan_cathedral',
  key: 'quito_metropolitan_cathedral',
  cell: '6r/6rb',
  title: 'Quito Metropolitan Cathedral',
  wikidataId: 'Q5758380',
  category: 'cathedral',
  recipe: 'quito-cathedral-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildQuitoCathedral,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole11-control surviving Quito cathedral: three-aisle tiled roof/clerestory, presbytery hexagonal drum/cupola/lantern, full38.78mwestern intrinsic tower/open belfry, exact mapped lateral stoneportico/openarchedentry/greenroof and intrinsic semicircular accesssteps. FirstsignedphotographerPD-self original documents limited2004lateralappearance; hidden vertical/roof/windowsections original explicit estimates. No neighboring ElSagrariochurch, NationalBasilica or cityplaza monument.',
  camera: cam(110, 86, -125),
  lookAt: cam(37, 12, 8),
  portableGroundY: -0.15,
  mediumFiContext: {
    scale: 1.5,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 2200,
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_weathered',
    'tile_ceramic',
    'tile_glazed',
    'wood_plain',
    'metal_painted',
  ],
  groundCutout: {
    outline: [...cutout, cutout[0]],
    basis:
      'Actualcathedral building footprint plus modeledintrinsicsemicircularaccesssteps only. Neighborchurch/plaza/streets remain outsidecutout; alloriginalsourceheights unchanged.',
  },
  qaCameras: [
    {
      name: 'whole-actual-cathedral-and-lateral-portico',
      position: cam(108, 77, -108),
      lookAt: cam(37, 10, 8),
    },
    { name: 'whole-native-plan', position: cam(36, 195, 9.1), lookAt: cam(36, 0, 9) },
    {
      name: 'lateral-open-arch-green-cupola-and-all-curved-treads',
      position: cam(48, 15, -35),
      lookAt: cam(37, 7, -6),
    },
    {
      name: 'western-tower-open-belfry-and-front',
      position: cam(-26, 37, -16),
      lookAt: cam(-2, 20, 20),
    },
    {
      name: 'whole-rear-roof-presbytery-cupola-and-aisles',
      position: cam(105, 77, 107),
      lookAt: cam(40, 12, 13),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cathedral-${reviewLod}`,
    position: cam(108, 77, -108),
    lookAt: cam(37, 10, 8),
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/quito-cathedral-runtime-overlay.mjs',
    level: 'skyline',
    export: 'quitoCathedralSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'quitoCathedralDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'quitoCathedralStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'quitoCathedralCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Accepted640x480nightphoto is limited/noisy and shows only lateralportico/partialbroadside. Wholeactualnativeplan and originalresearchtowerheight retained; hiddenpresbyteryroof/drums/towerstages/daylightcolors/windowcensus/finials andsemicircularstairs are explicitlyoriginalmedium-fiestimates. Sculpture/inscriptions/clockdetail/interiorchapels/museumdisplays not reproduced. No currentrestoration/survey/photogrammetry claim.',
    'Originalfield/frame/floor/mainsections frozen beforegeometry. UnclassifiedurbanDEM mayinclude roof/canopyartifact; actual thresholds/grade/contact remainunverified. Physicalcathedral/stepcutout only, geographicpreview/replacementfalse. No photographicpixels embedded.',
  ],
};
