/** Whole Brisbane Planetarium: native multi-lobed exterior, two distinct domes and open access spiral. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r7/r7h/sir_thomas_brisbane_planetarium/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  r = plan.outline,
  ref = 'palette:#ffffff';
const C = {
    wall: rgb('cecdbb'),
    dome: rgb('d1d6ce'),
    observatory: rgb('c6cfca'),
    metal: rgb('c6ccc2'),
    concrete: rgb('b2b3a3'),
    dark: rgb('4a5a51'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.94, metallic: 0.08 },
    dome: { slot: 'roof', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
    observatory: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9, metallic: 0.16 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.12 },
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
    dark: { slot: 'window', localRef: ref, roughness: 0.8, metallic: 0 },
  };
function tri(o, s, p, n, color = C[s]) {
  p = p.map((q) => q.map(Math.fround));
  const a = p[1].map((v, i) => v - p[0][i]),
    b = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
    1e-10
  )
    return;
  if (n && normalFor(...p).reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    color,
  );
}
function Q(o, s, p, n, color) {
  tri(o, s, [p[0], p[1], p[2]], n, color);
  tri(o, s, [p[0], p[2], p[3]], n, color);
}
const area = (q) =>
    q.reduce((v, p, i) => v + p[0] * q[(i + 1) % q.length][1] - p[1] * q[(i + 1) % q.length][0], 0),
  cw = (q) => (area(q) < 0 ? q : [...q].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
function circle(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])),
    sq = (p) => p[0] * p[0] + p[1] * p[1];
  return [
    (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d,
    (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d,
  ];
}
const main = circle(r[11], r[16], r[20]),
  foyer = circle(r[25], r[30], r[36]),
  obs = [8.4, 5.3],
  mainRing = cw([...r.slice(9, 25), [-1, 0]]),
  foyerRing = cw([...r.slice(24, 39), [2, -4], [3, 1], [-1, 0]]),
  serviceRing = cw([...r.slice(38, 50), [11.3, 5.2], [11.2, 1], [3, 1], [2, -4]]),
  entryRing = cw([...r.slice(7, 10), [-1, 0], [3, 1], [5.2, 3], [5.1, 5.3]]);
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = b.map((v, k) => (v - a[k]) / len),
    sign = area(r) < 0 ? 1 : -1,
    n = [-u[1] * sign, 0, u[0] * sign];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, ring, holes, f, z = 0) {
  const all = [ring, ...holes].flat(),
    starts = holes.map((_, i) => ring.length + holes.slice(0, i).reduce((v, q) => v + q.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
function reveal(o, s, ring, f, front, back) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(o, s, [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
function cap(o, s, ring, y, up = true) {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function shell(o, s, ring, lo, hi) {
  ring = cw(ring);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, s, ring, lo, false);
  cap(o, s, ring, hi);
}
function radial(c, n, radius) {
  return Array.from({ length: n }, (_, i) => [
    c[0] + radius * Math.sin((i * 2 * Math.PI) / n),
    c[1] + radius * Math.cos((i * 2 * Math.PI) / n),
  ]);
}
function dome(o, s, c, base, radius, height, n, rows) {
  for (let j = 0; j < rows; j++) {
    const t0 = ((j / rows) * Math.PI) / 2,
      t1 = (((j + 1) / rows) * Math.PI) / 2;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        P = (a, t) => [
          c[0] + radius * Math.cos(t) * Math.sin(a),
          base + height * Math.sin(t),
          c[1] + radius * Math.cos(t) * Math.cos(a),
        ],
        target = [Math.sin((a + b) / 2), 0.5, Math.cos((a + b) / 2)];
      if (j === rows - 1) tri(o, s, [P(a, t0), P(b, t0), [c[0], base + height, c[1]]], target);
      else Q(o, s, [P(a, t0), P(b, t0), P(b, t1), P(a, t1)], target);
    }
  }
}
function roof(o, ring, eave, peak, c, s = 'metal') {
  if (peak === eave) {
    cap(o, s, ring, eave);
    cap(o, s, ring, eave - 0.08, false);
    return;
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    tri(
      o,
      s,
      [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [c[0], peak, c[1]],
      ],
      [0, 1, 0],
    );
  }
  cap(o, s, ring, eave - 0.08, false);
}
function floor(o, ring, y, d) {
  cap(o, 'concrete', ring, y);
  if (d) cap(o, 'concrete', ring, y - 0.2, false);
}
const top = (i) =>
  i <= 6
    ? 1.1 + (i / 7) * 4.3
    : i <= 8
      ? 5.4
      : i === 9
        ? 5.35
        : i <= 23
          ? 5.35
          : i <= 37
            ? 4.2
            : i <= 47
              ? 3.8
              : i === 48
                ? 2.5
                : i === 49
                  ? 1.45
                  : 1.1;
function wall(o, d) {
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      f = frame(r[i], r[j]),
      lo = i >= 10 && i <= 23 ? 0 : -3.2,
      h0 = top(i),
      h1 = top(j),
      outline = [
        [0, lo],
        [f.len, lo],
        [f.len, h1],
        [0, h0],
      ],
      holes = [],
      door = i === 7 || i === 8 ? { x: i === 7 ? f.len : 0, w: 1.75, y: 0.1, h: 2.55 } : null,
      vent =
        i >= 24 && i <= 37 && f.len > 2.8 && i % 3 === 0
          ? { x: f.len * 0.5, w: 0.75, y: 2.8, h: 0.38 }
          : null,
      serviceDoor = i === 45 ? { x: f.len * 0.5, w: 1.0, y: 0.05, h: 2.15 } : null;
    for (const w of [door, vent, serviceDoor].filter(Boolean)) {
      const a = Math.max(0, w.x - w.w / 2),
        b = Math.min(f.len, w.x + w.w / 2);
      if (d > 1)
        holes.push([
          [a, w.y],
          [b, w.y],
          [b, w.y + w.h],
          [a, w.y + w.h],
        ]);
    }
    panel(o, 'wall', outline, holes, f);
    if (d) {
      panel(o, 'wall', outline, holes, { ...f, n: f.n.map((v) => -v) }, -0.16);
      Q(
        o,
        'metal',
        [f.P(0, h0, 0.025), f.P(f.len, h1, 0.025), f.P(f.len, h1, -0.18), f.P(0, h0, -0.18)],
        [0, 1, 0],
      );
    }
    for (const w of [door, vent, serviceDoor].filter(Boolean)) {
      const a = Math.max(0, w.x - w.w / 2),
        b = Math.min(f.len, w.x + w.w / 2),
        opening = [
          [a, w.y],
          [b, w.y],
          [b, w.y + w.h],
          [a, w.y + w.h],
        ];
      if (d > 1) {
        reveal(o, 'metal', opening, f, 0, -0.3);
        panel(o, w === vent ? 'dark' : 'dark', opening, [], f, -0.3);
      } else if (d) panel(o, 'dark', opening, [], f, 0.012);
      if (d > 1 && w === vent)
        for (let y = w.y + 0.04; y < w.y + w.h; y += 0.08)
          beam(o, 'metal', f.P(a, y, -0.18), f.P(b, y, -0.18), 0.027, 0.045, C.metal);
    }
    if (d > 1 && door) {
      const x = door.x + (i === 7 ? -0.82 : 0.82);
      beam(o, 'metal', f.P(x, 0.1, -0.2), f.P(x, 2.65, -0.2), 0.07, 0.07, C.metal);
      beam(
        o,
        'metal',
        f.P(Math.max(0, door.x - 0.87), 2.65, -0.2),
        f.P(Math.min(f.len, door.x + 0.87), 2.65, -0.2),
        0.075,
        0.07,
        C.metal,
      );
    }
    if (d > 2) {
      for (let x = 0.1; x < f.len; x += 0.2) {
        const h = h0 + ((h1 - h0) * x) / f.len;
        if (
          [door, vent, serviceDoor]
            .filter(Boolean)
            .some((w) => x > w.x - w.w / 2 - 0.04 && x < w.x + w.w / 2 + 0.04)
        )
          continue;
        panel(o, 'metal', rect(x, Math.max(lo, 0), 0.018, h - Math.max(lo, 0)), [], f, 0.018);
      }
    }
  }
}
function auditorium(o, d) {
  floor(o, mainRing, 0, d);
  roof(o, mainRing, 5.3, 5.3, main, 'dome');
  dome(o, 'dome', main, 5.3, 6.8, 6.2, [10, 24, 48, 72][d], [4, 8, 12, 18][d]);
  const core = radial(main, d ? 16 : 6, 3.1);
  shell(o, 'concrete', core, -3.2, -0.2);
  for (const [a, b] of [
    [
      [-4.2, -3.2, 4.0],
      [-4.2, -0.2, 4.0],
    ],
    [
      [-6.2, -3.2, 0],
      [-6.2, -0.2, 0],
    ],
    [
      [4.0, -3.2, 3.5],
      [4.0, -0.2, 3.5],
    ],
  ])
    beam(
      o,
      'concrete',
      [main[0] + a[0], a[1], main[1] + a[2]],
      [main[0] + b[0], b[1], main[1] + b[2]],
      0.42,
      0.48,
      C.concrete,
    );
  if (d > 1)
    for (const i of [12, 14, 16]) {
      const f = frame(r[i], r[i + 1]),
        x = f.len / 2,
        P = f.P(x, 3.35, 0.16);
      beam(o, 'metal', [P[0], P[1] - 0.2, P[2]], [P[0], P[1] + 0.2, P[2]], 0.45, 0.3, C.metal);
      panel(o, 'dark', rect(x, 3.22, 0.19, 0.18), [], f, 0.325);
    }
}
function accessRamp(o, d) {
  const ramp = r.slice(0, 8),
    inner = ramp.map((p) => {
      const a = [obs[0] - p[0], obs[1] - p[1]],
        l = Math.hypot(...a);
      return [p[0] + (a[0] / l) * 1.25, p[1] + (a[1] / l) * 1.25];
    });
  for (let i = 0; i < ramp.length - 1; i++) {
    const a = ramp[i],
      b = ramp[i + 1],
      c = inner[i],
      e = inner[i + 1],
      y0 = 0.15 + (i / 7) * 4.3,
      y1 = 0.15 + ((i + 1) / 7) * 4.3;
    Q(
      o,
      'concrete',
      [
        [a[0], y0, a[1]],
        [b[0], y1, b[1]],
        [e[0], y1, e[1]],
        [c[0], y0, c[1]],
      ],
      [0, 1, 0],
    );
    if (d)
      Q(
        o,
        'concrete',
        [
          [a[0], y0 - 0.16, a[1]],
          [b[0], y1 - 0.16, b[1]],
          [e[0], y1 - 0.16, e[1]],
          [c[0], y0 - 0.16, c[1]],
        ],
        [0, -1, 0],
      );
    Q(o, 'wall', [
      [c[0], y0 - 0.16, c[1]],
      [e[0], y1 - 0.16, e[1]],
      [e[0], y1 + 0.82, e[1]],
      [c[0], y0 + 0.82, c[1]],
    ]);
    if (d > 1)
      beam(o, 'metal', [c[0], y0 + 0.83, c[1]], [e[0], y1 + 0.83, e[1]], 0.07, 0.075, C.metal);
  }
  // Own lower stair flight within the mapped access termination, never a filled courtyard.
  const a = r[50],
    b = r[49],
    dx = (b[0] - a[0]) * 0.8,
    dz = (b[1] - a[1]) * 0.8,
    n = d ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / n,
      tn = (i + 1) / n,
      P = (x, z) => [a[0] + dx * x - 0.3, a[1] + dz * x + z];
    const ring = cw([P(t, -0.4), P(t, 0.4), P(tn, 0.4), P(tn, -0.4)]);
    cap(o, 'concrete', ring, 0.12 + ((i + 1) / n) * 0.65);
    if (d) shell(o, 'concrete', ring, 0.1 + (i / n) * 0.65, 0.12 + ((i + 1) / n) * 0.65);
  }
}
function observatory(o, d) {
  const n = [10, 24, 48, 64][d],
    body = radial(obs, n, 3.2);
  shell(o, 'wall', body, -0.1, 5.5);
  dome(o, 'observatory', obs, 5.5, 3.2, 3.2, [8, 20, 40, 64][d], [3, 6, 10, 16][d]);
  const rows = [5, 10, 16, 24][d],
    P = (x, t, rad = 3.35) => [obs[0] + x, 5.5 + rad * Math.cos(t), obs[1] + rad * Math.sin(t)];
  for (let j = 0; j < rows; j++) {
    const a = -Math.PI / 2 + (j / rows) * Math.PI,
      b = -Math.PI / 2 + ((j + 1) / rows) * Math.PI;
    Q(o, 'observatory', [P(-0.72, a), P(0.72, a), P(0.72, b), P(-0.72, b)], [0, 1, 0]);
    if (d > 1)
      for (const x of [-0.73, 0.73]) {
        Q(o, 'dark', [P(x, a, 3.23), P(x, a, 3.35), P(x, b, 3.35), P(x, b, 3.23)]);
        beam(o, 'metal', P(x, a, 3.37), P(x, b, 3.37), 0.035, 0.04, C.metal);
      }
  }
  if (d) {
    const count = d === 1 ? 12 : d === 2 ? 24 : 32,
      steps = d === 1 ? 5 : d === 2 ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count;
      for (let j = 0; j < steps; j++) {
        const t = ((j / steps) * Math.PI) / 2,
          u = (((j + 1) / steps) * Math.PI) / 2,
          P = (t) => [
            obs[0] + 3.22 * Math.cos(t) * Math.sin(a),
            5.5 + 3.22 * Math.sin(t),
            obs[1] + 3.22 * Math.cos(t) * Math.cos(a),
          ];
        if (d > 1) beam(o, 'metal', P(t), P(u), 0.025, 0.025, C.metal);
        else {
          const v = [Math.cos(a) * 0.018, 0, -Math.sin(a) * 0.018],
            p = P(t),
            q = P(u);
          Q(o, 'metal', [
            p.map((w, k) => w - v[k]),
            p.map((w, k) => w + v[k]),
            q.map((w, k) => w + v[k]),
            q.map((w, k) => w - v[k]),
          ]);
        }
      }
    }
  }
  if (d > 1)
    beam(
      o,
      'metal',
      [obs[0] - 0.8, 8.87, obs[1] - 0.03],
      [obs[0] + 0.8, 8.87, obs[1] - 0.03],
      0.2,
      0.23,
      C.metal,
    );
}
function build(o, _f, d = 3) {
  wall(o, d);
  auditorium(o, d);
  floor(o, foyerRing, -3.2, d);
  floor(o, serviceRing, -3.2, d);
  floor(o, entryRing, -3.2, d);
  roof(o, foyerRing, 4.16, 5.1, foyer);
  roof(o, serviceRing, 3.76, 3.76, [12, 0]);
  roof(o, entryRing, 3.78, 3.78, [2, 3]);
  observatory(o, d);
  accessRamp(o, d);
}
export const brisbanePlanetariumSkyline = (o, f) => build(o, f, 0);
export const brisbanePlanetariumDistrict = (o, f) => build(o, f, 1);
export const brisbanePlanetariumStreet = (o, f) => build(o, f, 2);
export const brisbanePlanetariumModel = {
  id: 'sir_thomas_brisbane_planetarium',
  key: 'sir_thomas_brisbane_planetarium',
  recipe: 'structure-sir-thomas-brisbane-planetarium.mjs',
  cell: 'r7/r7h',
  title: 'Sir Thomas Brisbane Planetarium',
  category: 'planetarium',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole native multilobed planetarium: white main Cosmic Skydome/curved fluted auditorium/cantilevered underside and supports, smaller cylindrical telescope observatory/ribbed dome/raised shutter, eastern low-roof foyer and native service jags, open sweeping access ramp and own stairs, real entry/vents. Native51-vertex boundary and mapped entrance; no site pad or garden/statue/parking/interior.',
  camera: [45, 27, 53],
  lookAt: [1, 4, -2],
  portableGroundY: -3.25,
  mediumFiContext: { scale: 1.4, groundY: -3.25 },
  qaCameras: [
    {
      name: 'whole-native-three-region-building-and-both-domes',
      position: [48, 34, 54],
      lookAt: [1, 4, -2],
    },
    {
      name: 'curved-auditorium-and-open-cantilever-undercroft',
      position: [-22, 1.5, 31],
      lookAt: [-10, 1.2, 9],
    },
    {
      name: 'ribbed-observatory-raised-shutter-and-open-curved-access',
      position: [26, 12, 24],
      lookAt: [10, 4.5, 8],
    },
    {
      name: 'mapped-entrance-foyer-roof-and-complete-service-jogs',
      position: [32, 18, -32],
      lookAt: [5, 2.2, -6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Original128m field frozen before geometry. Common entry floor0, auditorium underside/supports-3.2 and own access grade are photo estimates; flat fixture cannot prove host contact.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-sir-thomas-brisbane-planetarium.mjs',
    level: 'skyline',
    export: 'brisbanePlanetariumSkyline',
    errorMeters: 1.35,
    surfaces,
    authoredLevels: {
      district: { export: 'brisbanePlanetariumDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'brisbanePlanetariumStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Whole native51-vertex multilobed exterior and mapped entrance retained. Main broad dome/curved auditorium is NW, lower foyer is east, smaller telescope observatory and open spiral access occupy SW region; full native southern service jags retained. Internal partition/roof centres and small observatory centre[8.4,5.3] are photo estimates inside the original outline, not separately mapped building parts. No whole-site floor/pad, gardens/statues/parking/cars/fences/lamps/sign text, visitor neighbours, sundial or interior/exhibits.',
    'Three exact already-published Figaro2008 public-domain originals inspected; native SHA1/named own photographer/PD-self matched. Seven source families inventoried; attribution images unused. No supplemental photographs, copied pixels or generated bitmap. Main white hemisphere, vertically fluted curved walls/cantilevered underside, smaller ribbed telescope dome/raised shutter, low pale foyer roof and sweeping curved access walls follow the retained views.',
    'Approximate exterior heights, roof partitions/ridge locations, rear details, shutter closed state and seam count, curved ramp grade/step census, underside/core/support positions and finish after2008 are accepted medium-fi estimates. Main Cosmic Skydome12.5m is the internal theatre diameter, not the full external auditorium width. Exterior dome base6.8m radius/top11.5m, small telescope dome3.2m radius/eave5.5m, common entry floor0/own underside near-3.2m are visualization controls.',
    'Independent128m129x129at1m field/raw source tile/grid/PNG frozen before model. Fixed entry approach[1.8233977585460464,12.141578029876964], provider41.0421m and full relative field[-6.0421,4.6758] unchanged without fitting or flattening. Own building floors/foundations and ramp are structure geometry, not a site pad; exact threshold/host terrain contact and floor survey remain unverified. Geographic preview/replaceFootprint=false; flat review ground-3.25 exposes the actual model underside.',
  ],
};
