/** The 1953 hospital and its single-yard historic outbuildings on Adelaide Street. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const data = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = data('plan-controls.json');
const grid = data('terrain-grid.json');
const { hospital, annex, ward, outbuildings, approach, tanks } = plan.dimensions;
const surfaces = {
  iron: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.78, metallic: 0.37 },
  paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.05 },
  ground: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.6, metallic: 0.03 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    iron: 'cac7b7',
    rim: 'e0d9c5',
    bright: 'ede7d5',
    shade: '5b6260',
    green: '7a8986',
    roof: 'a4aba6',
    roof2: '8e9793',
    roof3: 'b1b5ac',
    concrete: 'a79b86',
    porch: 'bcb19a',
    glass: '8d9d97',
    door: 'd9d7c5',
    skirt: '9a9d8c',
    tank: '9da49e',
    darkRoof: '7f8a86',
    darkGreen: '60736d',
  }).map(([k, v]) => [k, rgb(v)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  north = [0, 0, -1],
  south = [0, 0, 1],
  west = [-1, 0, 0],
  east = [1, 0, 0];
const mix = (a, b, t) => a + (b - a) * t;
const xz = ([x, , z]) => [x, z];
const at = ([x, z], y) => [x, y, z];
const pairs = (path) => path.slice(1).map((b, i) => [path[i], b]);
const loop = (ring) => [...ring, ring[0]];
const mean = (ring) => [0, 1].map((i) => ring.reduce((s, p) => s + p[i], 0) / ring.length);
function grade([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = grid.heightsMeters[j],
    b = grid.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function face(out, slot, points, toward, color) {
  const n = normalFor(...points);
  const dot = n.reduce((d, v, i) => d + v * toward[i], 0);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    points,
    dot < 0 ? n.map((v) => -v) : n,
    ([x, y, z]) => (Math.abs(n[1]) > 0.6 ? [x, z] : [x - z * 0.68, y]),
    color,
  );
}
function beam(out, slot, x, y, z, w, h, d, color) {
  box(out, slot, [x, y, z], [x + w, y + h, z + d], color);
}
function edge(a, b, normal) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    normal,
    p: (x, y, d = 0) => [a[0] + dx * x + normal[0] * d, y, a[1] + dz * x + normal[2] * d],
  };
}
function plinth(out, outline, y) {
  const signed = pairs(loop(outline)).reduce((s, [[a, b], [x, z]]) => s + a * z - x * b, 0);
  for (const [a, b] of pairs(loop(outline))) {
    const sign = Math.sign(signed);
    face(
      out,
      'ground',
      [at(a, grade(a) - 0.25), at(b, grade(b) - 0.25), at(b, y), at(a, y)],
      [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
      c.concrete,
    );
  }
}
function panel(out, slot, w, a, b, bottom, top, d, color) {
  face(
    out,
    slot,
    [w.p(a, bottom, d), w.p(b, bottom, d), w.p(b, top, d), w.p(a, top, d)],
    w.normal,
    color,
  );
}
function aperture(out, w, { from, to, bottom, top }, floor, eave, lod, door = false) {
  const side = door ? 'door' : 'glass';
  const deep = door ? -0.1 : -0.14,
    trim = 0.048;
  panel(out, side, w, from, to, bottom, top, deep, door ? c.door : c.glass);
  for (const u of [from, to]) {
    const n = [w.normal[2], 0, -w.normal[0]].map((v) => v * (u === from ? -1 : 1));
    face(
      out,
      'paint',
      [w.p(u, bottom, 0), w.p(u, bottom, deep), w.p(u, top, deep), w.p(u, top, 0)],
      n,
      c.green,
    );
  }
  face(
    out,
    'paint',
    [w.p(from, top, deep), w.p(to, top, deep), w.p(to, top, 0), w.p(from, top, 0)],
    down,
    c.green,
  );
  if (bottom > floor + 0.05)
    face(
      out,
      'paint',
      [w.p(from, bottom, deep), w.p(to, bottom, deep), w.p(to, bottom, 0), w.p(from, bottom, 0)],
      up,
      c.green,
    );
  if (lod < 2) return;
  for (const x of [from - trim, to])
    panel(out, 'paint', w, x, x + trim, bottom - trim, top + trim, 0.023, c.bright);
  for (const y of [bottom, top]) panel(out, 'paint', w, from, to, y - trim, y, 0.024, c.bright);
  if (!door) {
    const middle = (from + to) / 2;
    panel(out, 'paint', w, middle - 0.026, middle + 0.026, bottom, top, -0.052, c.rim);
    if (lod === 3) panel(out, 'paint', w, from, to, top - 0.32, top - 0.29, -0.054, c.rim);
  } else if (lod === 3) {
    const x = to - 0.14;
    panel(out, 'paint', w, x, x + 0.06, bottom + 0.92, bottom + 0.97, -0.073, c.darkGreen);
  }
}
function façade(out, w, floor, eave, holes, lod) {
  let x = 0;
  for (const opening of holes) {
    const { from, to, bottom, top } = opening;
    panel(out, 'iron', w, x, from, floor, eave, 0, c.iron);
    if (bottom > floor + 0.03) panel(out, 'iron', w, from, to, floor, bottom, 0, c.iron);
    panel(out, 'iron', w, from, to, top, eave, 0, c.iron);
    aperture(out, w, opening, floor, eave, lod, opening.door);
    x = to;
  }
  panel(out, 'iron', w, x, w.length, floor, eave, 0, c.iron);
}
const opening = (center, width, bottom, top, door = false) => ({
  from: center - width / 2,
  to: center + width / 2,
  bottom,
  top,
  door,
});
function wallRibbon(out, w, y, lod) {
  if (lod === 0) return;
  panel(out, 'paint', w, 0, w.length, y, y + 0.094, 0.06, c.bright);
}

function dutchGableRoof(out, x0, x1, z0, z1, eave, ridge, lod) {
  const e = eave + 0.02,
    zm = (z0 + z1) * 0.5;
  const rise = ridge - e;
  const hip = Math.min(2.45, (x1 - x0) * 0.135);
  const gableWidth = (z1 - z0) * 0.54,
    gl = zm - gableWidth / 2,
    gr = zm + gableWidth / 2;
  const shoulder = e + rise * 0.46;
  const a = [x0, e, z0],
    b = [x1, e, z0],
    c0 = [x1, e, z1],
    d = [x0, e, z1];
  const l0 = [x0 + hip, shoulder, gl],
    l1 = [x0 + hip, shoulder, gr],
    r0 = [x1 - hip, shoulder, gl],
    r1 = [x1 - hip, shoulder, gr];
  const lo = [x0 + hip, ridge, zm],
    hi = [x1 - hip, ridge, zm];
  face(out, 'roof', [a, b, r0, l0], up, c.roof);
  face(out, 'roof', [l0, r0, hi, lo], up, c.roof);
  face(out, 'roof', [d, c0, r1, l1], up, c.roof3);
  face(out, 'roof', [l1, r1, hi, lo], up, c.roof3);
  face(out, 'roof', [a, d, l1, l0], up, c.roof3);
  face(out, 'roof', [b, c0, r1, r0], up, c.roof2);
  face(out, 'iron', [l0, l1, lo], west, c.iron);
  face(out, 'iron', [r0, r1, hi], east, c.iron);
  if (lod === 0) return;
  beam(out, 'paint', x0 + hip, ridge - 0.01, zm - 0.055, x1 - x0 - 2 * hip, 0.064, 0.11, c.rim);
  for (const x of [x0 + hip - 0.015, x1 - hip + 0.015]) {
    const side = x < 0 ? -1 : 1;
    const w = edge([x, zm - 0.56], [x, zm + 0.56], side < 0 ? west : east);
    panel(out, 'paint', w, 0, w.length, shoulder + 0.2, shoulder + 0.62, 0, c.darkGreen);
    if (lod === 3)
      for (let i = 1; i < 5; i++)
        panel(
          out,
          'paint',
          w,
          0.05,
          w.length - 0.05,
          shoulder + 0.2 + i * 0.073,
          shoulder + 0.225 + i * 0.073,
          0.012,
          c.green,
        );
  }
}
const rectangle = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function hospitalBody(out, lod) {
  const { left: l, right: r, front: f, rear: b, floor: y, eave: h, ridge } = hospital;
  const northWall = edge([l, f], [r, f], north);
  const southWall = edge([r, b], [l, b], south);
  const westWall = edge([l, b], [l, f], west);
  const eastWall = edge([r, f], [r, b], east);
  plinth(out, rectangle(l, f, r, b), y);
  const mainDoor = opening(approach.center - l, 1.52, y, h - 0.8, true);
  const windows =
    lod === 0
      ? [opening(4.35, 3.5, y + 0.9, h - 0.73), mainDoor, opening(18.3, 3.9, y + 0.9, h - 0.73)]
      : [
          opening(2.4, 1.62, y + 0.82, h - 0.73),
          opening(5.6, 2.75, y + 0.91, h - 0.64),
          opening(9.05, 2.48, y + 0.91, h - 0.64),
          mainDoor,
          opening(14.9, 2.5, y + 0.91, h - 0.64),
          opening(18.19, 2.68, y + 0.91, h - 0.64),
          opening(21.33, 1.73, y + 0.85, h - 0.73),
        ];
  façade(out, northWall, y, h, windows, lod);
  façade(
    out,
    southWall,
    y,
    h,
    [3.0, 7.6, 12.3, 17.6, 21.15].map((u) =>
      opening(u, lod === 0 ? 0.96 : 1.26, y + 1.02, h - 0.79),
    ),
    lod,
  );
  for (const w of [westWall, eastWall])
    façade(
      out,
      w,
      y,
      h,
      [2.3, 5.55, 8.9, 11.95].map((u) => opening(u, lod === 0 ? 0.79 : 1.08, y + 0.89, h - 0.84)),
      lod,
    );
  for (const w of [northWall, southWall, westWall, eastWall]) {
    wallRibbon(out, w, h - 0.12, lod);
    if (lod > 1) wallRibbon(out, w, y + 0.16, lod);
  }
  dutchGableRoof(out, l - 0.45, r + 0.48, f - 0.42, b + 0.46, h + 0.04, ridge, lod);
  if (lod > 1) {
    beam(out, 'paint', 5.6, ridge - 0.2, -2.35, 0.067, 2.02, 0.067, c.green);
    beam(out, 'paint', 5.22, ridge + 1.6, -2.37, 0.82, 0.04, 0.035, c.green);
    beam(out, 'paint', 5.4, ridge + 1.32, -2.35, 0.42, 0.039, 0.035, c.green);
  }
}
function underPorch(out, a, b, c0, d) {
  face(out, 'ground', [a, b, c0, d], up, c.porch);
  for (const [p, q] of pairs([a, b, c0, d, a])) {
    const v = [q[2] - p[2], 0, p[0] - q[0]];
    face(
      out,
      'ground',
      [at(xz(p), grade(xz(p)) - 0.16), at(xz(q), grade(xz(q)) - 0.16), q, p],
      v,
      c.concrete,
    );
  }
}
function entrance(out, lod) {
  const { center, width, from, to, roofStart } = approach;
  const l = center - width / 2,
    r = center + width / 2,
    raised = hospital.floor;
  const split = from + 3.45;
  underPorch(
    out,
    [l, grade([l, from]) + 0.044, from],
    [r, grade([r, from]) + 0.044, from],
    [r, raised, split],
    [l, raised, split],
  );
  underPorch(out, [l, raised, split], [r, raised, split], [r, raised, to], [l, raised, to]);
  const roof = hospital.eave - 0.45;
  const wl = l - 0.23,
    wr = r + 0.23,
    z0 = roofStart,
    z1 = to + 0.04,
    h = roof + 0.29;
  face(
    out,
    'roof',
    [
      [wl, roof, z0],
      [center, h, z0],
      [center, h, z1],
      [wl, roof, z1],
    ],
    up,
    c.roof2,
  );
  face(
    out,
    'roof',
    [
      [center, h, z0],
      [wr, roof, z0],
      [wr, roof, z1],
      [center, h, z1],
    ],
    up,
    c.roof,
  );
  for (const z of [z0 + 0.14, z0 + 3.44, z1 - 0.25]) {
    for (const x of [l + 0.095, r - 0.17])
      beam(out, 'paint', x, raised, z, 0.085, roof - raised, 0.085, c.bright);
    if (lod > 0) beam(out, 'paint', l + 0.095, roof - 0.1, z, width - 0.17, 0.084, 0.075, c.green);
  }
  if (lod > 1)
    for (const x of [l - 0.02, r - 0.08])
      beam(out, 'paint', x, grade([x, from]), from, 0.1, 1.01, 0.1, c.green);
}
function simpleGable(out, item, lod, isWard = false) {
  const pts = item.footprint,
    { floor, eave, ridge } = item;
  const sign = Math.sign(pairs(loop(pts)).reduce((s, [[a, b], [x, z]]) => s + a * z - x * b, 0));
  const back = pts.reduce(
    (index, p, i) =>
      p[1] + pts[(i + 1) % 4][1] > pts[index][1] + pts[(index + 1) % 4][1] ? i : index,
    0,
  );
  const front = (back + 2) % 4;
  const center = (a, b) => [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
  plinth(out, pts, floor);
  let ends = [];
  for (const [[a, b], i] of pairs(loop(pts)).map((p, i) => [p, i])) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [((b[1] - a[1]) * sign) / length, 0, (-(b[0] - a[0]) * sign) / length];
    const w = edge(a, b, n);
    if (i === front && isWard) {
      const interior = pts.map(([x, z]) => [x, z + 1.35]);
      const deckFront = [at(a, floor), at(b, floor)];
      face(
        out,
        'ground',
        [...deckFront, at(interior[(i + 1) % 4], floor), at(interior[i], floor)],
        up,
        c.porch,
      );
      for (const u of [0.16, w.length * 0.5, w.length - 0.2]) {
        const p = w.p(u, floor, -0.12);
        beam(out, 'paint', p[0], floor, p[2], 0.085, eave - floor, 0.087, c.bright);
      }
      const inner = edge(xz(w.p(0, 0, -1.36)), xz(w.p(w.length, 0, -1.36)), n);
      façade(
        out,
        inner,
        floor,
        eave,
        [
          opening(inner.length * 0.25, 1.24, floor + 0.7, eave - 0.43),
          opening(inner.length * 0.52, item.openWidth, floor, eave - 0.3, true),
          opening(inner.length * 0.79, 1.12, floor + 0.7, eave - 0.43),
        ],
        lod,
      );
      wallRibbon(out, w, eave - 0.11, Math.max(1, lod));
    } else {
      façade(
        out,
        w,
        floor,
        eave,
        isWard
          ? [opening(w.length * 0.47, 1.22, floor + 0.65, eave - 0.49)]
          : i === front && lod > 0
            ? [opening(w.length * 0.48, 1.33, floor, eave - 0.32, true)]
            : [],
        lod,
      );
      if (isWard && lod > 1) {
        const x = w.length * 0.47 + 0.59;
        panel(out, 'iron', w, x, x + 0.52, floor + 0.68, eave - 0.51, 0.11, c.skirt);
      }
    }
    if (i !== front && i !== back) {
      const m = center(a, b);
      ends.push({ i, m });
      face(out, 'iron', [at(a, eave), at(b, eave), at(m, ridge)], n, c.iron);
      wallRibbon(out, w, eave - 0.04, lod);
    }
  }
  for (let i = 0; i < 4; i++) {
    if (i !== front && i !== back) continue;
    const a = pts[i],
      b = pts[(i + 1) % 4];
    const p = ends.find((e) => e.i === (i + 3) % 4).m;
    const q = ends.find((e) => e.i === (i + 1) % 4).m;
    const centerPt = mean(pts);
    const over = ([x, z], scale) => [mix(centerPt[0], x, scale), mix(centerPt[1], z, scale)];
    face(
      out,
      'roof',
      [
        at(over(a, 1.07), eave + 0.028),
        at(over(b, 1.07), eave + 0.028),
        at(over(q, 1.055), ridge + 0.02),
        at(over(p, 1.055), ridge + 0.02),
      ],
      up,
      i === front ? c.roof3 : c.roof2,
    );
  }
}
function tank(out, item, lod) {
  const pos = item.center;
  const y = grade(pos) - 0.13,
    h = y + item.height;
  const n = [8, 12, 20, 28][lod];
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return [pos[0] + item.radius * Math.cos(a), pos[1] + item.radius * Math.sin(a)];
  });
  for (const [a, b] of pairs(loop(points))) {
    const center = [at(pos, h + 0.12), at(a, h), at(b, h)];
    face(
      out,
      'iron',
      [at(a, y), at(b, y), at(b, h), at(a, h)],
      [b[1] - a[1], 0, a[0] - b[0]],
      c.tank,
    );
    face(out, 'roof', center, up, c.roof3);
  }
}
function draw(out, lod) {
  hospitalBody(out, lod);
  entrance(out, lod);
  simpleGable(out, annex, lod);
  simpleGable(out, ward, lod, true);
  for (const item of outbuildings) simpleGable(out, { ...item, footprint: item.points }, lod);
  for (const item of tanks) tank(out, item, lod);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const camera = [62, 38, -75],
  lookAt = [-2, 1, 1];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  category: 'historic-hospital',
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Historic Birdsville hospital with a low galvanized gabled hip, enclosed verandahs, a covered entrance and the distinct former Aboriginal ward.',
  camera,
  lookAt,
  sunDirection: [-220, 520, -700],
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.72,
    focus: { center: [-1, 1, -4] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'adelaide-street-covered-approach', position: [-17, 6.7, -36], lookAt: [-2, 2.1, -10] },
    { name: 'former-ward-and-yard-buildings', position: [29, 9, 39], lookAt: [3, 1.9, 12] },
    { name: 'hospital-and-tanks-from-rear', position: [-36, 9, 21], lookAt: [-4, 2.45, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.64, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent reconstruction from Queensland Heritage Register factual descriptions, OpenStreetMap site controls and original Terrarium elevations.',
};
