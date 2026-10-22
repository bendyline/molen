/** Photo-guided Bayt Nasseef exterior; identity point and estimated plan remain distinct. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sg/sgg/nasseef_house/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const colors = {
  plaster: rgb('dedbd0'),
  stone: rgb('b6ac91'),
  trim: rgb('c7b58d'),
  wood: rgb('514b3c'),
  dark: rgb('32382f'),
  roof: rgb('4d4b3e'),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'wood_weatherboard', roughness: 0.97, metallic: 0 },
};
const area = (r) =>
    r.reduce(
      (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) / 2,
  clockwise = (r) => (area(r) < 0 ? r : [...r].reverse());
function tri(out, slot, ps, target = null) {
  if (target && normalFor(...ps).reduce((s, v, i) => s + v * target[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  out.addTriangle(
    slot,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    colors[slot],
  );
}
function cap(out, r, y, slot, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function arch(x, bottom, w, spring, n) {
  const r = [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    [x + w / 2, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    r.push([x + (Math.cos(t) * w) / 2, spring + (Math.sin(t) * w) / 2]);
  }
  return r;
}
function circle(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [x + Math.cos(t) * r, y + Math.sin(t) * r];
  });
}
function panel(out, r, holes, f, slot, depth = 0) {
  const pts = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => f.p(...pts[j], depth)),
      [f.n[0], 0, f.n[1]],
    );
}
function facade(out, a, b, d) {
  const f = frame(a, b),
    { len, p } = f,
    holes = [],
    north = f.n[1] < -0.9 && a[1] < -10.5,
    west = f.n[0] < -0.9 && a[0] < -11.5,
    n = [4, 6, 10, 16][d];
  if (d > 0 && len > 4) {
    const count =
      d > 1 && len >= 6.8 && len < 9 ? 3 : Math.max(1, Math.floor(len / (d === 1 ? 6.0 : 3.8)));
    for (let j = 0; j < count; j++) {
      const x = (len * (j + 0.5)) / count;
      for (const [bottom, spring] of [
        [1.65, 4.1],
        [6.25, 8.8],
        [11.05, 13.3],
      ])
        holes.push({ r: arch(x, bottom, 1.25, spring, n), kind: 'shutter', x, bottom, spring });
      if (d > 1) holes.push({ r: circle(x, 14.27, 0.18, 12), kind: 'vent', x });
    }
  }
  if (north || west) {
    const center = len / 2;
    for (let i = holes.length - 1; i >= 0; i--)
      if (holes[i].r[0][1] < 5.2 && Math.abs(holes[i].x - center) < 1.9) holes.splice(i, 1);
    holes.push({
      r: arch(center, 1.05, north ? 2.7 : 2.2, 3.45, n),
      kind: 'door',
      x: center,
      bottom: 1.05,
      spring: 3.45,
    });
  }
  panel(
    out,
    [
      [0, -0.4],
      [len, -0.4],
      [len, 14.8],
      [0, 14.8],
    ],
    holes.map((h) => h.r),
    f,
    'plaster',
  );
  for (const h of holes) {
    panel(out, h.r, [], f, h.kind === 'shutter' ? 'wood' : 'dark', -0.22);
    for (let i = 0; i < h.r.length; i++) {
      const a = h.r[i],
        b = h.r[(i + 1) % h.r.length],
        ps = [p(...a), p(...b), p(...b, -0.22), p(...a, -0.22)];
      quad(out, 'trim', ps, normalFor(...ps), colors.trim);
      if (d === 3 || (d === 2 && (i === 0 || i === 1 || i === h.r.length - 1)))
        beam(
          out,
          h.kind === 'shutter' ? 'wood' : 'trim',
          p(a[0], a[1], 0.025),
          p(b[0], b[1], 0.025),
          h.kind === 'door' ? 0.18 : 0.075,
          0.08,
          colors[h.kind === 'shutter' ? 'wood' : 'trim'],
        );
    }
    if (d > 1 && h.kind === 'shutter') {
      beam(
        out,
        'wood',
        p(h.x, h.bottom, -0.11),
        p(h.x, h.spring + 0.51, -0.11),
        0.07,
        0.07,
        colors.wood,
      );
      const count = d === 2 ? 3 : 8;
      for (let i = 1; i <= count; i++) {
        const y = h.bottom + ((h.spring - h.bottom) * i) / (count + 1);
        beam(
          out,
          'wood',
          p(h.x - 0.59, y, -0.11),
          p(h.x + 0.59, y, -0.11),
          0.045,
          0.045,
          colors.wood,
        );
      }
    }
    if (d === 3 && h.kind === 'door') {
      beam(
        out,
        'wood',
        p(h.x, h.bottom, -0.14),
        p(h.x, h.spring + 0.7, -0.14),
        0.1,
        0.09,
        colors.wood,
      );
      for (const side of [-1, 1])
        beam(
          out,
          'trim',
          p(h.x + side * 1.65, 1.05, 0.07),
          p(h.x + side * 1.65, 3.2, 0.07),
          0.2,
          0.22,
          colors.trim,
        );
    }
  }
  for (const y of [0.8, 5.25, 10.1, 14.75])
    beam(
      out,
      y === 0.8 ? 'stone' : 'trim',
      p(0, y, 0.025),
      p(len, y, 0.025),
      0.14,
      y === 0.8 ? 0.38 : 0.28,
      colors[y === 0.8 ? 'stone' : 'trim'],
    );
  if (d > 0) beam(out, 'trim', p(0, 15.15, -0.08), p(len, 15.15, -0.08), 0.2, 0.75, colors.trim);
}
function woodScreen(out, f, width, bottom, height, depth, d) {
  const p = f.p;
  // Recessed backing makes the open carved lattice legible without an invented room interior.
  panel(
    out,
    [
      [-width / 2, bottom],
      [width / 2, bottom],
      [width / 2, bottom + height],
      [-width / 2, bottom + height],
    ],
    [],
    f,
    'dark',
    depth - 0.2,
  );
  const borders = [
    [-width / 2, bottom, width / 2, bottom],
    [-width / 2, bottom + height, width / 2, bottom + height],
    [-width / 2, bottom, -width / 2, bottom + height],
    [width / 2, bottom, width / 2, bottom + height],
  ];
  for (const [x0, y0, x1, y1] of borders)
    beam(out, 'wood', p(x0, y0, depth), p(x1, y1, depth), 0.15, 0.18, colors.wood);
  const bays = 3;
  for (let i = 1; i < bays; i++)
    beam(
      out,
      'wood',
      p(-width / 2 + (width * i) / bays, bottom, depth),
      p(-width / 2 + (width * i) / bays, bottom + height, depth),
      0.12,
      0.16,
      colors.wood,
    );
  if (d === 0) return;
  for (const y of [bottom + 0.35, bottom + height * 0.62, bottom + height - 0.3])
    beam(
      out,
      'wood',
      p(-width / 2, y, depth + 0.04),
      p(width / 2, y, depth + 0.04),
      0.095,
      0.16,
      colors.wood,
    );
  const nv = d === 1 ? 4 : d === 2 ? 12 : 30,
    nh = d === 1 ? 2 : d === 2 ? 6 : 15;
  for (let i = 1; i < nv; i++) {
    const x = -width / 2 + (width * i) / nv;
    beam(
      out,
      'wood',
      p(x, bottom + 0.1, depth),
      p(x, bottom + height - 0.1, depth),
      d === 3 ? 0.035 : 0.05,
      0.07,
      colors.wood,
    );
  }
  for (let i = 1; i < nh; i++) {
    const y = bottom + (height * i) / nh;
    beam(
      out,
      'wood',
      p(-width / 2 + 0.08, y, depth + 0.025),
      p(width / 2 - 0.08, y, depth + 0.025),
      d === 3 ? 0.035 : 0.05,
      0.07,
      colors.wood,
    );
  }
}
function rawashin(out, d) {
  const f = { n: [0, -1], p: (x, y, z = 0) => [x, y, -11.22 - z] },
    width = 5.7,
    depth = 1.05;
  for (const [bottom, height] of [
    [5.75, 4.1],
    [10.15, 4.4],
  ]) {
    if (d === 0) {
      B(out, 'wood', 0, bottom, -11.22 - depth / 2, width, height, depth, colors.wood);
      continue;
    }
    woodScreen(out, f, width, bottom, height, depth, d);
    for (const side of [-1, 1]) {
      const x = (side * width) / 2,
        ps = [
          [x, bottom, -11.22],
          [x, bottom, -12.27],
          [x, bottom + height, -12.27],
          [x, bottom + height, -11.22],
        ];
      if (side < 0) ps.reverse();
      quad(out, 'wood', ps, normalFor(...ps), colors.wood);
      for (const y of [bottom, bottom + height])
        beam(out, 'wood', [x, y, -11.22], [x, y, -12.27], 0.15, 0.15, colors.wood);
      for (let i = 1; i < 4; i++)
        beam(
          out,
          'wood',
          [x, bottom + (height * i) / 4, -11.22],
          [x, bottom + (height * i) / 4, -12.27],
          0.065,
          0.07,
          colors.wood,
        );
    }
    B(out, 'wood', 0, bottom - 0.12, -11.8, width + 0.28, 0.16, 1.5, colors.wood);
    B(out, 'wood', 0, bottom + height, -11.8, width + 0.32, 0.18, 1.5, colors.wood);
    if (d > 1)
      for (const x of [-2.2, -0.75, 0.75, 2.2])
        beam(
          out,
          'wood',
          [x, bottom - 0.52, -11.24],
          [x, bottom - 0.02, -12.13],
          0.12,
          0.12,
          colors.wood,
        );
  }
}
function pavilion(out, d) {
  const {
      center: [cx, cz],
      width: w,
      depth: dp,
      base,
      height: h,
    } = plan.pavilion,
    r = clockwise([
      [cx - w / 2, cz - dp / 2],
      [cx + w / 2, cz - dp / 2],
      [cx + w / 2, cz + dp / 2],
      [cx - w / 2, cz + dp / 2],
    ]);
  B(out, 'wood', cx, base, cz, w + 0.4, 0.18, dp + 0.4, colors.wood);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]),
      g = { ...f, p: (x, y, z = 0) => f.p(x + f.len / 2, y, z) };
    if (d === 0)
      panel(
        out,
        [
          [-w / 2, base],
          [w / 2, base],
          [w / 2, base + h],
          [-w / 2, base + h],
        ],
        [],
        g,
        'wood',
      );
    else woodScreen(out, g, f.len, base + 0.18, h - 0.18, 0.03, d);
  }
  const roof = clockwise([
    [cx - w / 2 - 0.65, cz - dp / 2 - 0.65],
    [cx + w / 2 + 0.65, cz - dp / 2 - 0.65],
    [cx + w / 2 + 0.65, cz + dp / 2 + 0.65],
    [cx - w / 2 - 0.65, cz + dp / 2 + 0.65],
  ]);
  cap(out, roof, base + h, 'roof', false);
  for (let i = 0; i < 4; i++)
    tri(
      out,
      'roof',
      [
        [roof[i][0], base + h, roof[i][1]],
        [roof[(i + 1) % 4][0], base + h, roof[(i + 1) % 4][1]],
        [cx, base + h + 0.75, cz],
      ],
      [0, 1, 0],
    );
  if (d > 0)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      beam(
        out,
        'wood',
        [roof[i][0], base + h, roof[i][1]],
        [roof[j][0], base + h, roof[j][1]],
        0.18,
        0.2,
        colors.wood,
      );
    }
}
function steps(out, d) {
  const count = d === 0 ? 2 : 5;
  for (let i = 0; i < count; i++) {
    const z = -14.2 + ((i + 0.5) / count) * 3.0;
    B(
      out,
      'stone',
      0,
      -0.35,
      z,
      3.5,
      0.35 + ((i + 1) / count) * 1.05,
      3.0 / count + 0.03,
      colors.stone,
    );
  }
  const westCount = d === 0 ? 2 : 4;
  for (let i = 0; i < westCount; i++) {
    const x = -14.2 + ((i + 0.5) / westCount) * 2.4;
    B(
      out,
      'stone',
      x,
      -0.35,
      0,
      2.4 / westCount + 0.03,
      0.35 + ((i + 1) / westCount) * 1.05,
      3.1,
      colors.stone,
    );
  }
  if (d > 1)
    for (const side of [-1, 1]) {
      const x = side * 1.8;
      beam(out, 'dark', [x, 0.9, -14.2], [x, 1.95, -11.2], 0.05, 0.05, colors.dark);
      for (const t of [0, 0.5, 1])
        beam(
          out,
          'dark',
          [x, t * 1.05, -14.2 + t * 3],
          [x, 0.9 + t * 1.05, -14.2 + t * 3],
          0.05,
          0.05,
          colors.dark,
        );
    }
}
function build(out, _frame, d = 3) {
  const r = clockwise(plan.outline);
  for (let i = 0; i < r.length; i++) facade(out, r[i], r[(i + 1) % r.length], d);
  cap(out, r, -0.4, 'stone', false);
  cap(out, r, 14.8, 'plaster');
  rawashin(out, d);
  pavilion(out, d);
  steps(out, d);
}
export const nasseefSkyline = (o, f) => build(o, f, 0);
export const nasseefDistrict = (o, f) => build(o, f, 1);
export const nasseefStreet = (o, f) => build(o, f, 2);
export const nasseefHouseModel = {
  id: 'nasseef_house',
  key: 'nasseef_house',
  recipe: 'structure-nasseef-house.mjs',
  cell: 'sg/sgg',
  title: 'Nasseef House',
  category: 'historic-residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Photo-guided full stepped white coral/plaster merchant house with pale ochre floor bands, grouped tall round-headed wood shutters and upper circular vents, two stacked projecting carved-wood rawashin above the north entrance, terrace parapets, central dark wooden lattice roof pavilion/overhanging hip roof and own short entry steps. Native named point verifies identity nearby; the plan, dimensions and hidden elevations are expressly estimated.',
  camera: [-46, 32, -50],
  lookAt: [0, 8, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 0.85 },
  qaCameras: [
    { name: 'stacked-rawashin-and-north-entry', position: [20, 12, -34], lookAt: [0, 9, -11] },
    { name: 'roof-pavilion-and-terraces', position: [-24, 27, -22], lookAt: [0, 16, 0] },
    { name: 'west-arched-shutters-and-bands', position: [-31, 12, -7], lookAt: [-11, 8, -1] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'The local story coordinate locates the authored house; independent named native OSM/ProtomapsPOIs verify identity nearby. No current containing roof polygon is available, so the full stepped plan and fixed open northern-approach datum are explicitly photographic/approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-nasseef-house.mjs',
    level: 'skyline',
    export: 'nasseefSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'nasseefDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'nasseefStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Named OSM node2520141053 and independently decoded ProtomapsPOI17594706185469 match the story nearby. Neither current extract provides a containing house roof polygon; unrelated generic building footprints40+maway are not adopted. Full stepped22x21mplan, anchor attachment, setbacks and hidden elevations are photographic estimates at the story coordinate, not a survey or native roof plan.',
    'The exact cleared Qualla-published434x640UserCyb3r1998PD-selforiginal controls white stepped wall masses, pale ochre floor bands, tall round-headed wood shutters/upper vents, two stacked projecting north-door rawashin, terraces and wooden roof pavilion. Body14.8m, pavilion/roof19.35m, row openings, lattice sections, roof form and entry steps are medium-fi estimates at this limited image detail. Offset internal levels are not asserted as seven identical visible exterior storeys.',
    'Complete exterior assembly only. Wood screens have physical posts/rails/fine lattice with recessed dark backing; panes, ordinary shutters/doors and hidden rooms are closed. Fine lattice, shutter slats, vent rims and handles retire in lower LODs. Interiors/cisterns/kitchen, inscriptions, temporary restoration works/foreground barriers, tree, neighboring houses and street landscape excluded.',
    'Foundations extend.4m below a fixed northern dry-approach datum; own short steps rise1.05m. Exact house footprint, doorstep/ground attachment and host terrain are approximate, with source terrain preserved and no whole-square platform or blanket ground opening.',
  ],
};
