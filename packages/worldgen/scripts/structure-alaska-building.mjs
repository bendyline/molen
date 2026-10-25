/** Alaska Building: preserved street elevations and an explicitly estimated upper rear court. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/c2/c23/alaska_building/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  brick: rgb('bca784'),
  stone: rgb('d8d2bd'),
  roof: rgb('616661'),
  glass: rgb('566e73'),
  trim: rgb('d7d1ba'),
  dark: rgb('697168'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.33, metallic: 0.08 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
};
function tri(o, s, ps, n, col = C[s]) {
  if (n && normalFor(...ps).reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, ps, n, col = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, col);
  tri(o, s, [ps[0], ps[2], ps[3]], n, col);
}
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
const clockwise = (r) => (area(r) < 0 ? r : [...r].reverse());
function cap(o, s, ring, y, up = true) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      s,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
const circle = (x, y, r, n) =>
  Array.from({ length: n }, (_, i) => [
    x + Math.cos((i / n) * Math.PI * 2) * r,
    y + Math.sin((i / n) * Math.PI * 2) * r,
  ]);
function panel(o, s, outer, holes, f, depth = 0) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ids = earcut(pts.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      s,
      ids.slice(i, i + 3).map((j) => f.p(...pts[j], depth)),
      [f.n[0], 0, f.n[1]],
    );
}
function strip(o, s, f, x, y, w, h, depth = 0.035) {
  panel(o, s, rect(x, y, w, h), [], f, depth);
}
function block(o, s, f, x, y, w, h, front, back) {
  const r = rect(x, y, w, h),
    n = [f.n[0], 0, f.n[1]];
  panel(o, s, r, [], f, front);
  panel(o, s, [...r].reverse(), [], { ...f, n: f.n.map((v) => -v) }, back);
  for (let j = 0; j < 4; j++) {
    const a = r[j],
      b = r[(j + 1) % 4],
      ps = [f.p(...a, front), f.p(...b, front), f.p(...b, back), f.p(...a, back)];
    Q(o, s, ps, normalFor(...ps));
  }
  return n;
}
function glazed(o, f, h, d, ornamental = false) {
  const r = h.r,
    depth = d === 0 ? 0.02 : d > 1 ? -0.17 : -0.07;
  panel(o, 'glass', r, [], f, depth);
  if (d === 0) return;
  for (let j = 0; j < r.length; j++) {
    const a = r[j],
      b = r[(j + 1) % r.length],
      ps = [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)];
    if (d > 1 || j % 2 === 0) Q(o, 'trim', ps, normalFor(...ps));
  }
  if (h.round) {
    if (d < 2) return;
    const rr = h.radius + 0.15,
      n = r.length,
      outer = circle(h.x, h.y, rr, n);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      Q(
        o,
        'trim',
        [f.p(...r[j], 0.06), f.p(...r[k], 0.06), f.p(...outer[k], 0.06), f.p(...outer[j], 0.06)],
        [f.n[0], 0, f.n[1]],
      );
      if (d === 3)
        Q(
          o,
          'trim',
          [f.p(...outer[j], 0.06), f.p(...outer[k], 0.06), f.p(...outer[k]), f.p(...outer[j])],
          normalFor(f.p(...outer[j], 0.06), f.p(...outer[k], 0.06), f.p(...outer[k])),
        );
    }
    return;
  }
  if (d > 1) {
    strip(o, 'trim', f, h.x, h.y + h.height * 0.52, h.width, 0.065, -0.07);
    if (h.width > 2.05) strip(o, 'trim', f, h.x, h.y, 0.065, h.height, -0.07);
  }
  if (d === 3 || (ornamental && d > 1)) {
    for (const sg of [-1, 1])
      strip(
        o,
        'trim',
        f,
        h.x + sg * (h.width / 2 + 0.035),
        h.y - 0.06,
        0.08,
        h.height + 0.12,
        0.03,
      );
    block(o, 'trim', f, h.x, h.y - 0.11, h.width + 0.22, 0.12, 0.15, 0);
    if (ornamental) block(o, 'trim', f, h.x, h.y + h.height, h.width + 0.19, 0.11, 0.1, 0);
  }
}
function band(o, f, y, height, depth, s = 'stone') {
  block(o, s, f, f.len / 2, y, f.len, height, depth, -0.012);
}
function regularWall(o, s, a, b, low, high, d, principal = false) {
  const f = frame(a, b),
    holes = [],
    bayCount = principal ? (f.n[0] < -0.8 ? 8 : 7) : Math.max(2, Math.floor(f.len / 3.65));
  if (d === 0) {
    panel(o, s, rect(f.len / 2, low, f.len, high - low), [], f);
    if (principal)
      for (let i = 0; i < bayCount; i++)
        strip(
          o,
          'glass',
          f,
          ((i + 0.5) / bayCount) * f.len,
          low + 1.2,
          1.6,
          high - low - 2.5,
          0.02,
        );
    return;
  }
  const rows = d === 1 ? (principal ? 6 : 4) : 11,
    span = (51.8 - 9.8) / 11;
  for (let j = 0; j < rows; j++) {
    const y =
      d === 1 ? low + 1 + (j * (high - low - 3.9)) / Math.max(1, rows - 1) : 10.55 + j * span;
    for (let i = 0; i < bayCount; i++) {
      const x = ((i + 0.5) / bayCount) * f.len,
        paired = principal && i > 0 && i < bayCount - 1 && d > 1,
        width = paired ? 1.25 : principal ? 2.5 : 1.35,
        height = principal ? 2.65 : 2.45;
      for (const offset of paired ? [-0.79, 0.79] : [0])
        holes.push({ x: x + offset, y, width, height, r: rect(x + offset, y, width, height) });
    }
  }
  panel(
    o,
    s,
    rect(f.len / 2, low, f.len, high - low),
    holes.map((h) => h.r),
    f,
  );
  for (const h of holes) glazed(o, f, h, d);
  if (principal && d > 1) {
    for (const sg of [-1, 1])
      strip(o, 'stone', f, sg < 0 ? 0.35 : f.len - 0.35, 9.8, 0.7, high - 9.8, 0.035);
    // The photographed paired openings form vertical bays; no invented full curtain wall.
    if (d === 3)
      for (let i = 1; i < bayCount - 1; i++) {
        const x = ((i + 0.5) / bayCount) * f.len;
        for (let j = 1; j < 11; j++)
          block(o, 'brick', f, x, 10.55 + j * span - 0.42, 3.12, 0.23, 0.045, 0);
      }
  }
}
function baseWall(o, a, b, d, principal) {
  const f = frame(a, b),
    holes = [];
  if (!principal) {
    panel(o, 'brick', rect(f.len / 2, -1.3, f.len, 11.1), [], f);
    return;
  }
  const count = f.n[0] < -0.8 ? 8 : 7,
    step = f.len / count;
  for (let i = 0; i < count; i++)
    for (const [y, height] of [
      [0.22, 4.75],
      [6.16, 2.1],
    ]) {
      const x = (i + 0.5) * step,
        width = step * 0.72;
      holes.push({ x, y, width, height, r: rect(x, y, width, height) });
    }
  panel(o, 'stone', rect(f.len / 2, -1.3, f.len, 11.1), d === 0 ? [] : holes.map((h) => h.r), f);
  for (const h of holes) glazed(o, f, h, d, true);
  band(o, f, -0.05, 0.28, 0.15);
  band(o, f, 5.45, 0.27, 0.19);
  band(o, f, 9.2, 0.3, 0.28);
  band(o, f, 9.57, 0.23, 0.4);
  if (d > 1) {
    for (let i = 0; i <= count; i++) {
      const x = Math.max(0.24, Math.min(f.len - 0.24, i * step));
      block(o, 'stone', f, x, 0.25, 0.37, 8.85, 0.13, 0);
      if (d === 3)
        for (let j = 1; j < 12; j++) strip(o, 'brick', f, x, j * 0.72, 0.37, 0.025, 0.136);
    }
    if (f.n[0] < -0.8) {
      const x = step * 4.5;
      block(o, 'trim', f, x, 4.7, step * 0.93, 0.4, 0.61, 0.1);
      block(o, 'trim', f, x, 5.1, step * 1.06, 0.21, 0.72, 0.09);
      for (const sg of [-1, 1]) {
        block(o, 'trim', f, x + sg * step * 0.39, 3.5, 0.35, 1.2, 0.38, 0.05);
        if (d === 3) block(o, 'trim', f, x + sg * step * 0.39, 4.2, 0.48, 0.35, 0.54, 0.1);
      }
    }
  }
}
function capital(o, a, b, d, principal) {
  const f = frame(a, b),
    holes = [],
    count = principal ? (f.n[0] < -0.8 ? 8 : 7) : Math.max(2, Math.floor(f.len / 4.7)),
    n = [6, 8, 12, 16][d];
  if (!principal) {
    if (d > 0)
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * f.len) / count;
        for (const y of [53.2, 57.1])
          holes.push({ x, y, width: 1.35, height: 2.2, r: rect(x, y, 1.35, 2.2) });
      }
    panel(
      o,
      'brick',
      rect(f.len / 2, 51.8, f.len, 9),
      holes.map((h) => h.r),
      f,
    );
    for (const h of holes) glazed(o, f, h, d);
    return;
  }
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * f.len) / count,
      paired = d > 1 && i > 0 && i < count - 1,
      width = paired ? 1.25 : 2.5;
    for (const off of paired ? [-0.79, 0.79] : [0])
      holes.push({ x: x + off, y: 53, width, height: 2.65, r: rect(x + off, 53, width, 2.65) });
    holes.push({ x, y: 58.6, radius: 0.52, r: circle(x, 58.6, 0.52, n), round: true });
  }
  panel(
    o,
    'stone',
    rect(f.len / 2, 51.8, f.len, 9),
    holes.map((h) => h.r),
    f,
  );
  for (const h of holes) glazed(o, f, h, d, true);
  band(o, f, 51.8, 0.25, 0.26);
  band(o, f, 56.2, 0.18, 0.22);
  band(o, f, 60.15, 0.23, 0.37);
  band(o, f, 60.48, 0.32, 0.63);
  if (d > 1) {
    for (let i = 0; i <= count; i++) {
      const x = Math.max(0.3, Math.min(f.len - 0.3, (i * f.len) / count));
      block(o, 'trim', f, x, 52.1, 0.45, 3.8, 0.15, 0);
      if (d === 3) {
        for (const y of [52.5, 53.25, 54, 54.75]) block(o, 'trim', f, x, y, 0.24, 0.28, 0.2, 0.1);
        block(o, 'trim', f, x, 59.65, 0.25, 0.5, 0.42, 0.05);
      }
    }
    if (d === 3)
      for (let i = 0; i < count * 3; i++)
        block(o, 'trim', f, ((i + 0.5) * f.len) / (count * 3), 59.9, 0.13, 0.22, 0.48, 0.12);
  }
}
function upperRing() {
  const raw = plan.outline,
    [xc, zc] = plan.upperCourt.min,
    out = [];
  // Exact original outer vertices persist until the explicitly estimated rear notch.
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i],
      b = raw[(i + 1) % raw.length],
      ain = a[0] > xc && a[1] > zc,
      bin = b[0] > xc && b[1] > zc;
    if (!ain) out.push(a);
    if (!ain && bin) {
      const t = (zc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, zc], [xc, zc]);
    }
    if (ain && !bin) {
      const t = (xc - a[0]) / (b[0] - a[0]);
      out.push([xc, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return clockwise(out);
}
const isPrincipal = (f) => f.n[0] < -0.98 || f.n[1] < -0.98;
function build(o, _frame, d = 3) {
  const base = clockwise(plan.outline),
    upper = upperRing();
  cap(o, 'stone', base, -1.3, false);
  cap(o, 'roof', base, 9.8);
  for (let i = 0; i < base.length; i++) {
    const a = base[i],
      b = base[(i + 1) % base.length];
    baseWall(o, a, b, d, isPrincipal(frame(a, b)));
  }
  for (let i = 0; i < upper.length; i++) {
    const a = upper[i],
      b = upper[(i + 1) % upper.length],
      f = frame(a, b),
      principal = isPrincipal(f) && (Math.min(a[0], b[0]) < -19 || Math.min(a[1], b[1]) < -20);
    regularWall(o, 'brick', a, b, 9.8, 51.8, d, principal);
    capital(o, a, b, d, principal);
    // Real parapet walls around the L roof, including court edges; no courtyard roof at tower height.
    block(o, principal ? 'stone' : 'brick', f, f.len / 2, 60.8, f.len, 1.2, 0, -0.32);
    band(o, f, 61.82, 0.18, 0.04, principal ? 'stone' : 'brick');
  }
  cap(o, 'roof', upper, 60.8);
}
export const alaskaSkyline = (o, f) => build(o, f, 0);
export const alaskaDistrict = (o, f) => build(o, f, 1);
export const alaskaStreet = (o, f) => build(o, f, 2);
export const alaskaBuildingModel = {
  id: 'alaska_building',
  key: 'alaska_building',
  recipe: 'structure-alaska-building.mjs',
  cell: 'c2/c23',
  title: 'Alaska Building',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Preserved Seattle corner skyscraper with exact native base perimeter, pale two-level terra-cotta base, buff-brick paired-window shaft, ornate pale capital/rectangular sash and round attic windows, bracketed Second Avenue entrance and flat L-shaped roof/open estimated rear court. Clear published1909Qualla book scans and municipal preservation facts control exterior; inner court/hidden hotel brace and minor roof sections approximate.',
  camera: [-91, 63, -90],
  lookAt: [-2, 29, -2],
  portableGroundY: -1.6,
  mediumFiContext: { scale: 1.4, groundY: -1.6 },
  qaCameras: [
    {
      name: 'two-preserved-street-facades-and-corner',
      position: [-77, 34, -80],
      lookAt: [-4, 30, -3],
    },
    {
      name: 'rectangular-capital-portholes-and-cornice',
      position: [-42, 64, -44],
      lookAt: [-9, 56.5, -11],
    },
    {
      name: 'second-avenue-base-and-bracketed-entry',
      position: [-48, 9, 2],
      lookAt: [-19.3, 5.2, -0.2],
    },
    { name: 'open-upper-rear-court-and-l-roof', position: [55, 86, 63], lookAt: [2, 30, 4] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent raw urban terrain frozen before geometry at original Second Avenue dry approach; source native perimeter/street edge governs placement, with unsurveyed threshold/basement and hill grade approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alaska-building.mjs',
    level: 'skyline',
    export: 'alaskaSkyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'alaskaDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'alaskaStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    'Exact native named Alaska Buildingway240874271/Q4708507 supplies original six-vertex full base plan and62mheight. Original Cherry Street edge and perimeter mean establish heading/anchor; story point and neighboring footprints do not replace these controls.',
    'Both accepted images are already-published Qualla native mechanical scans of1909publications with explicit PD-scan/PD-1923primary records and nativeSHA1matches. GeneralHistorypage66shows full corner facades/capital/base; AsahelCurtis1908parade in Argus1909shows southeast side/step-back. Historic awnings/flags/lettering/parade/traffic and all hotel branding/artwork are excluded. No copied photograph or generated bitmap texture.',
    'Municipal text documents preserved original windows, buff brick/pale terra cotta, two-level base, eleven-row shaft and L-shaped upper plan. Precise rear-court position/width/roof levels and hidden2010seismic brace are not surveyed or photographically resolved. Rear court is an explicitly estimated notch behind both intact photographed street facades. Official74x50ftfootprint and southwest-court wording conflict with native plan/primary elevations and are not adopted as exact controls.',
    'Native14levels and other15floor conventions differ with basement/attic. Two base rows, eleven shaft rows, rectangular capital and small porthole row form a bounded photographic exterior section within62m. Exact ornament, window census, contemporary storefront/roof services and concealed structure are medium-fi estimates; no interior or engineering replica claim.',
    'Independent180mrawTerrariumfield and fixed dry Second Avenue datum remain unchanged, with1.3mdeep base. Uphill street, basement/sidewalk threshold and host-DEM attachment are approximate. No terrain flattening, fitted grade, generic site platform, neighboring building or landscape included.',
  ],
};
