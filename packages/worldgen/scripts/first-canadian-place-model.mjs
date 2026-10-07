/** Original First Canadian Place reconstruction, in meters, with explicit survey limits. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(
  structureSourcePath('n0227_first_canadian_place', 'map-frame.json'),
);
const frame = JSON.parse(frameBytes);
const module = 3.048,
  interval = 3.8608;
const X = 28.956,
  Z = 27.432,
  A = 24.384,
  B = 22.86;
const top = 298.1,
  parapet = 289.9,
  occupied = 287.1;
const officeBase = occupied - 69 * interval;
const crownBase = occupied - 2 * interval + 1.75;
// Off-white frit (about 90% lightness): pure white spandrels over half the facade bloom in sun.
const white = [0.8, 0.81, 0.78],
  silver = [0.61, 0.64, 0.64];
const dark = [0.11, 0.115, 0.105],
  vision = [0.24, 0.255, 0.24];
const bronze = [0.31, 0.28, 0.23],
  granite = [0.48, 0.49, 0.46];
const plan = [
  [-A, -Z],
  [-A, -B],
  [-X, -B],
  [-X, B],
  [-A, B],
  [-A, Z],
  [A, Z],
  [A, B],
  [X, B],
  [X, -B],
  [A, -B],
  [A, -Z],
];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);

/** Local +Z is outward; the plan is clockwise in X/Z. */
function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const vector = ([x, y, z]) => [ux * x - uz * z, y, uz * x + ux * z];
  const point = (p) => {
    const q = vector(p);
    return [q[0] + a[0], q[1], q[2] + a[1]];
  };
  return {
    length,
    point,
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

function plate(out, y0, y1, slot = 'concrete', color = granite) {
  // Three disjoint rectangles preserve all four concave corners.
  box(out, slot, [-X, y0, -B], [X, y1, B], color);
  box(out, slot, [-A, y0, -Z], [A, y1, -B], color);
  box(out, slot, [-A, y0, B], [A, y1, Z], color);
}

/** Glass faces, metal closure strips and recessed continuous seals are distinct geometry. */
/**
 * A cladding or glazing face. The real panels' 1.6 cm seals, recess backing and 2.1 cm stainless
 * frames are below the closeup's error on a 298 m tower, so a panel is its face.
 */
function panel(o, x0, x1, y0, y1, slot, color, depth = 0) {
  if (y1 - y0 < 0.025 || x1 - x0 < 0.025) throw new Error('FCP: invalid panel');
  face(
    o,
    slot,
    [
      [x0, y0, depth],
      [x1, y0, depth],
      [x1, y1, depth],
      [x0, y1, depth],
    ],
    color,
  );
}

/**
 * One storey of an edge: a recessed band of vision glass over a white frit (or, at the corners,
 * bronze glass) spandrel band. The alternating stripes are the tower's identity; the window
 * divisions are 4 cm and are not modelled.
 */
function typical(o, row, _count, corner, baseY = officeBase) {
  const y = baseY + row * interval;
  panel(o, 0, o.length, y, y + 1.75, 'fcp_vision', vision, -0.085);
  const bandTop = Math.min(y + interval, corner ? parapet : crownBase);
  if (bandTop - y - 1.75 > 0.025)
    panel(
      o,
      0,
      o.length,
      y + 1.75,
      bandTop,
      corner ? 'bronze_glass' : 'frit',
      corner ? bronze : white,
    );
}

function tower(out, firstRow = 0) {
  plate(out, 0, 0.13, 'stone');
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    const corner = o.length < 10,
      count = corner ? 2 : Math.round(o.length / module);
    const w = o.length / count;
    for (let row = firstRow; row < 70; row++) {
      const y = officeBase + row * interval;
      if (corner || y < crownBase - 1.75 + 0.001) typical(o, row, count, corner);
    }
    if (!corner)
      for (let j = 0; j < count; j++)
        for (let r = 0; r < 3; r++)
          panel(
            o,
            j * w,
            (j + 1) * w,
            crownBase + (r * (parapet - crownBase)) / 3,
            crownBase + ((r + 1) * (parapet - crownBase)) / 3,
            'frit',
            white,
          );
    // The final corner storey is clipped at the parapet, retaining its bronze glazing.
    box(o, 'stainless', [0, parapet - 0.035, -0.12], [o.length, parapet, 0.025], silver);
  }
  plate(out, parapet - 0.22, parapet - 0.13, 'recess', [0.47, 0.46, 0.41]);
}

function swingDoors(o, center, y = 0.14, z = -3.25) {
  for (const sign of [-1, 1]) {
    const x = center + sign * 0.53;
    panel(o, x - 0.51, x + 0.51, y, y + 2.63, 'clear_glass', [0.68, 0.71, 0.67], z);
    tube(
      o,
      'stainless',
      [x - sign * 0.32, y + 0.78, z + 0.1],
      [x - sign * 0.32, y + 1.38, z + 0.1],
      0.017,
      silver,
      12,
    );
    for (const yy of [y + 0.24, y + 2.25])
      tube(
        o,
        'stainless',
        [x + sign * 0.47, yy, z + 0.014],
        [x + sign * 0.47, yy + 0.1, z + 0.014],
        0.022,
        silver,
        12,
      );
  }
  box(
    o,
    'stainless',
    [center - 1.1, y + 2.65, z - 0.08],
    [center + 1.1, y + 2.74, z + 0.04],
    silver,
  );
}

function base(out) {
  plate(out, 7.0104, 7.2, 'concrete', white);
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    const corner = o.length < 10,
      n = corner ? 2 : Math.round(o.length / module),
      w = o.length / n;
    // Tower-envelope lobby. The wider retail complex is a separately unresolved boundary.
    for (let j = 0; j < n; j++) {
      const door = !corner && j === Math.floor(n / 2);
      if (door) {
        swingDoors(o, (j + 0.5) * w);
        panel(o, j * w, (j + 1) * w, 2.9, 7.0104, 'clear_glass', [0.68, 0.71, 0.67], -3.25);
        const mid = (j + 0.5) * w;
        panel(o, j * w, mid - 1.1, 0.13, 2.9, 'clear_glass', [0.68, 0.71, 0.67], -3.25);
        panel(o, mid + 1.1, (j + 1) * w, 0.13, 2.9, 'clear_glass', [0.68, 0.71, 0.67], -3.25);
      } else {
        for (let r = 0; r < 3; r++)
          panel(
            o,
            j * w,
            (j + 1) * w,
            0.13 + r * 2.29,
            0.13 + (r + 1) * 2.29,
            corner ? 'bronze_glass' : 'clear_glass',
            corner ? bronze : [0.67, 0.71, 0.67],
            corner ? -0.04 : -3.25,
          );
      }
      if (!corner) {
        // Thin independent frit-clad colonnade piers, granite skirting and steel bollards.
        for (let r = 0; r < 4; r++) {
          panel(
            o,
            j * w,
            j * w + 0.42,
            0.35 + r * 1.675,
            0.35 + (r + 1) * 1.675,
            'frit',
            white,
            0.02,
          );
          box(
            o,
            'frit',
            [j * w, 0.35 + r * 1.675, -0.68],
            [j * w + 0.42, 0.35 + (r + 1) * 1.675, -0.03],
            white,
          );
        }
        box(o, 'stone', [j * w, 0.13, -0.72], [j * w + 0.44, 0.35, 0.05], granite);
        tube(
          o,
          'stainless',
          [j * w + 1.3, 0.13, 0.75],
          [j * w + 1.3, 1.05, 0.75],
          0.072,
          silver,
          20,
        );
        // Rectangular ceiling lights have metal rims and pale recessed lenses.
        box(o, 'stainless', [j * w + 0.55, 6.98, -2.76], [(j + 1) * w - 0.4, 7.01, -0.45], silver);
        box(
          o,
          'fcp_vision',
          [j * w + 0.6, 6.97, -2.71],
          [(j + 1) * w - 0.45, 6.975, -0.5],
          [0.88, 0.9, 0.87],
        );
      }
      // Two transitional bands are reconstructions; office datums above use owner spacing.
      for (let r = 0; r < 2; r++) {
        const y = 7.2 + (r * (officeBase - 7.2)) / 2,
          h = (officeBase - 7.2) / 2;
        panel(
          o,
          j * w,
          (j + 1) * w,
          y,
          y + h * 0.65,
          corner ? 'bronze_glass' : 'fcp_vision',
          corner ? bronze : vision,
          -0.07,
        );
        panel(
          o,
          j * w,
          (j + 1) * w,
          y + h * 0.65,
          y + h,
          corner ? 'bronze_glass' : 'frit',
          corner ? bronze : white,
        );
      }
    }
  }
  // Floor and ceiling in the recessed lobby; no opaque facade crosses an entrance.
  box(out, 'stone', [-X + 3.4, 0.13, -B + 0.1], [X - 3.4, 0.2, B - 0.1], granite);
  box(out, 'marble', [-11, 0.2, -9], [11, 7, -6], [0.8, 0.79, 0.74]);
  box(out, 'marble', [-11, 0.2, 6], [11, 7, 9], [0.8, 0.79, 0.74]);
}

function ovalStroke(o, cx, cy, rx, ry, width, color, z = 0.055, start = 0, end = Math.PI * 2) {
  const n = Math.ceil((end - start) * 12);
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n;
    const p = (t, d) => [cx + (rx + d) * Math.cos(t), cy + (ry + d) * Math.sin(t), z];
    face(o, 'metal', [p(a, width / 2), p(b, width / 2), p(b, -width / 2), p(a, -width / 2)], color);
  }
}

function sign(o, x, y) {
  const blue = [0.035, 0.22, 0.39],
    red = [0.73, 0.025, 0.035];
  const stroke = (a, b) =>
    beam(o, 'metal', [x + a[0], y + a[1], 0.1], [x + b[0], y + b[1], 0.1], 0.48, 0.1, blue);
  // Original vector construction of the photographed BMO wordmark and round emblem.
  stroke([0, 0], [0, 4.3]);
  for (const cy of [1.075, 3.225]) {
    stroke([0, cy - 1.075], [1.15, cy - 1.075]);
    stroke([0, cy + 1.075], [1.15, cy + 1.075]);
    ovalStroke(o, x + 1.15, y + cy, 1.13, 1.075, 0.48, blue, 0.16, -Math.PI / 2, Math.PI / 2);
  }
  stroke([3.3, 0], [3.3, 4.3]);
  stroke([3.3, 4.3], [5.0, 1.6]);
  stroke([5.0, 1.6], [6.7, 4.3]);
  stroke([6.7, 4.3], [6.7, 0]);
  for (const [sx, sy] of [
    [0, 0],
    [0, 4.3],
    [3.3, 0],
    [3.3, 4.3],
    [6.7, 0],
    [6.7, 4.3],
  ])
    stroke([sx - 0.38, sy], [sx + 0.38, sy]);
  ovalStroke(o, x + 9.5, y + 2.15, 1.85, 2.15, 0.43, blue, 0.16);
  const cx = x + 15,
    cy = y + 2.15,
    r = 2.55;
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI * 2) / 72,
      b = ((i + 1) * Math.PI * 2) / 72;
    const p = [
      [cx, cy, 0.16],
      [cx + r * Math.cos(a), cy + r * Math.sin(a), 0.16],
      [cx + r * Math.cos(b), cy + r * Math.sin(b), 0.16],
    ];
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      p,
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      red,
    );
  }
  face(
    o,
    'metal',
    [
      [cx - 1.65, cy - 0.9, 0.17],
      [cx + 1.65, cy - 0.9, 0.17],
      [cx + 1.65, cy - 0.15, 0.17],
      [cx - 1.65, cy - 0.15, 0.17],
    ],
    white,
  );
  for (const sign of [-1, 1]) {
    const p = [
      [cx + sign * 1.65, cy - 0.12, 0.17],
      [cx + sign * 0.83, cy + 1.24, 0.17],
      [cx, cy - 0.12, 0.17],
    ];
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      sign < 0 ? p.toReversed() : p,
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      white,
    );
  }
}

function louvre(o, x0, x1, y0, y1) {
  box(o, 'recess', [x0, y0, -0.1], [x1, y1, -0.07], dark);
  for (let y = y0 + 0.06; y < y1 - 0.06; y += 0.13)
    face(
      o,
      'stainless',
      [
        [x0, y, -0.07],
        [x1, y, -0.07],
        [x1, y + 0.07, 0.055],
        [x0, y + 0.07, 0.055],
      ],
      silver,
    );
}

function mast(out, x, z, height, whiteTop = false) {
  const bottom = parapet - 0.12,
    latticeTop = whiteTop ? height - 15.8 : height - 0.6;
  const side = 1.64,
    legs = [
      [-side / 2, -side / 2],
      [side / 2, -side / 2],
      [side / 2, side / 2],
      [-side / 2, side / 2],
    ];
  const stages = Math.ceil((latticeTop - bottom) / 1.8),
    step = (latticeTop - bottom) / stages;
  // A lattice as a few members: full-height legs, and a horizontal and one diagonal per face on
  // every other stage. The 2-3 cm bracing and the climbing ladder are sub-pixel from the street.
  const p = (a, yy) => [x + a[0], yy, z + a[1]];
  for (const a of legs) tube(out, 'stainless', p(a, bottom), p(a, latticeTop), 0.052, silver, 6);
  for (let j = 0; j < stages; j += 2) {
    const y = bottom + j * step,
      top = Math.min(latticeTop, y + 2 * step);
    for (let k = 0; k < 4; k++) {
      const a = legs[k],
        b = legs[(k + 1) % 4];
      tube(out, 'stainless', p(a, y), p(b, y), 0.032, silver, 3);
      tube(out, 'stainless', p(a, y), p(b, top), 0.025, silver, 3);
    }
  }
  if (whiteTop) {
    tube(out, 'metal', [x, latticeTop, z], [x, height - 0.3, z], 0.43, white, 12);
    for (let y = latticeTop + 0.2; y < height - 0.3; y += 1.24)
      tube(out, 'stainless', [x, y, z], [x, y + 0.06, z], 0.45, silver, 12);
  } else {
    for (let y = latticeTop - 19; y < latticeTop - 1; y += 2.35)
      for (const sign of [-1, 1]) {
        box(
          out,
          'metal',
          [x + sign * 1.18 - 0.19, y, z - 0.5],
          [x + sign * 1.18 + 0.19, y + 1.8, z + 0.5],
          [0.48, 0.48, 0.43],
        );
        tube(out, 'stainless', [x, y + 0.9, z], [x + sign * 1.18, y + 0.9, z], 0.032, silver, 8);
      }
  }
  tube(out, 'stainless', [x, height - 0.6, z], [x, height, z], 0.025, silver, 10);
  for (const y of [latticeTop - 4, bottom + 20])
    for (const [ax, az] of [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ]) {
      // All four anchor points remain within the roof outline.
      tube(out, 'stainless', [x, y, z], [ax, parapet - 0.08, az], 0.016, [0.38, 0.4, 0.4], 6);
      box(
        out,
        'metal',
        [ax - 0.2, parapet - 0.13, az - 0.2],
        [ax + 0.2, parapet + 0.12, az + 0.2],
        silver,
      );
    }
  for (let j = 0; j < 7; j++) {
    const y = bottom + 5 + j * 3.1;
    tube(
      out,
      'metal',
      [x - 0.5, y, z + 0.8],
      [x - 0.5, y, z + 1.02],
      0.22 + (j % 3) * 0.07,
      white,
      24,
    );
    tube(
      out,
      'stainless',
      [x - 0.5, y - 0.3, z + 0.8],
      [x - 0.5, y - 0.3, z + 1.0],
      0.035,
      silver,
      8,
    );
  }
}

function roof(out) {
  box(out, 'concrete', [-16, parapet - 0.13, -13], [16, top - 0.22, 13], white);
  box(out, 'metal', [-16.1, top - 0.22, -13.1], [16.1, top, 13.1], silver);
  const pp = [
    [-16, -13],
    [-16, 13],
    [16, 13],
    [16, -13],
  ];
  for (let k = 0; k < 4; k++) {
    const o = edge(out, pp[k], pp[(k + 1) % 4]);
    for (let x = 2; x < o.length - 2; x += 6) louvre(o, x, x + 2.4, parapet + 3.7, parapet + 6.1);
    panel(o, 0.3, 1.5, parapet + 0.15, parapet + 2.6, 'metal', [0.53, 0.56, 0.54]);
  }
  mast(out, -7, -19, 355);
  mast(out, -7, 19, 351, true);
  tube(out, 'stainless', [7, parapet, 0], [7, 331.5, 0], 0.16, silver, 18);
  for (let y = parapet + 2; y < 318; y += 2.05) {
    tube(out, 'stainless', [7, y, 0], [8, y, 0], 0.025, silver, 8);
    tube(out, 'metal', [8, y - 0.44, 0], [8, y + 0.44, 0], 0.042, white, 12);
  }
  for (let j = 0; j < 6; j++) {
    const x = -11 + j * 4.4;
    tube(out, 'stainless', [x, top, -3], [x, top + 3 + (j % 3) * 0.8, -3], 0.034, silver, 10);
  }
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    if (o.length > 10) {
      sign(o, 2.1, crownBase + 2.3);
      box(o, 'stainless', [0, parapet - 0.11, -1.0], [o.length, parapet - 0.02, -0.84], silver);
      for (let x = 0.5; x < o.length; x += 1.9)
        box(o, 'metal', [x, parapet - 0.13, -1.2], [x + 0.09, parapet + 0.07, -0.65], silver);
    }
  }
}

const parts = [
  { name: 'lobby-and-colonnade', build: base, instances: [{}] },
  { name: 'crown-and-floor-plates', build: (o) => tower(o, 67), instances: [{}] },
  { name: 'plant-and-three-masts', build: roof, instances: [{}] },
  {
    name: 'typical-glass-floor',
    build(o) {
      for (let k = 0; k < plan.length; k++) {
        const side = edge(o, plan[k], plan[(k + 1) % plan.length]);
        const corner = side.length < 10;
        typical(side, 0, corner ? 2 : Math.round(side.length / module), corner, 0);
      }
    },
    instances: Array.from({ length: 67 }, (_, i) => ({
      translation: [0, officeBase + i * interval, 0],
    })),
    gpuInstances: true,
  },
];

export const firstCanadianPlaceStudy = {
  id: 'N0227',
  key: 'first_canadian_place',
  title: 'First Canadian Place',
  wikidataId: 'Q1052475',
  mapFrame: 'map-frame.json',
  build(out) {
    base(out);
    tower(out);
    roof(out);
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((part) => ({ ...part, glb: encode(part.build, part.name) })),
      'Molen original First Canadian Place reusable facade assembly',
    );
  },
  brief:
    'First Canadian Place after the 2012 recladding: rectangular notched plan, individually jointed white fritted-glass spandrels, bronze corner returns, paired vision lights, recessed colonnade, BMO crown panels and three detailed rooftop masts.',
  sourceFacts: {
    architecturalHeightMeters: top,
    tipHeightMeters: 355,
    highestOccupiedMeters: occupied,
    aboveGroundFloors: 72,
    ownerAverageOfficeIntervalMeters: interval,
    ownerMullionModuleMeters: module,
    lobbyCeilingMeters: 7.0104,
  },
  reconstruction: {
    plan,
    bodyParapetMeters: parapet,
    officeBaseMeters: officeBase,
    crownBaseMeters: crownBase,
    planBasis:
      'Owner level-27 plan shows approximately sixteen 10ft modules on north/south faces, fifteen on east/west faces and 15ft corner recesses. The inferred 190ft x180ft outer plan is close to the independently cached map envelope; not a dimensioned as-built survey.',
    floorBasis:
      'Working office grid extrapolates the published average interval backwards from the highest occupied floor. Opaque crown replaces the upper main-face windows; corner glazing continues. Floor labels, roof/parapet datums and upper mechanical/occupied allocation are unverified.',
    materialBasis:
      'Reusable opaque backed-glass triangular ceramic frit, shared stainless, painted metal, concrete, granite and marble. Frit pitch 50mm is inferred. Smooth glass has no height relief or copied photo texture.',
    roofBasis:
      'Three-mast composition and guying follow original 2022 survey photographs. North tip uses the registry 355 m; other heights, positions, aerial details and roof plant are photograph reconstructions.',
  },
  refs: [
    'https://www.mdeas.com/first-canadian-place',
    'https://bharchitects.com/en/project/first-canadian-place-recladding/',
    'https://www.bharchitects.com/wp-content/uploads/2017/08/The-Second-Life-of-Tall-Bldgs-ENGLISH.pdf',
    'https://axiistenantapp.com/wp-content/uploads/2024/12/FCP-Building-Specs-2022.pdf',
    'https://gizmostorageprod.blob.core.windows.net/files/B2B%20Property%20Detail%20Page%20Files/First%20Canadian%20Place%20Web%20Final%20July%202021%20w%20Floor%20Plans.pdf',
    'https://buildingscience.com/sites/default/files/0103_First_Canadian_Place.pdf',
    'https://www.skyscrapercenter.com/building/wd/543',
    'https://necrat.us/fcp.html',
    'https://www.openstreetmap.org/way/27767627',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-northeast along the longer map axis',
    front: '+Z south-southeast',
    origin:
      'Cached tower footprint center at local ground contact; broader retail complex not yet registered.',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    notes:
      'Exact-QID tower footprint; independently inferred office rectangle is not stretched to the map. Signed entrance/podium registration and real street slope remain pending.',
  }),
  appearance: {
    period: 'Completed 2012 glass recladding, with 2022 rooftop photographic reference',
    excluded: 'Temporary construction platforms and original marble cladding.',
  },
  sourceDocuments: ['reference-metadata.json'],
  limitations: [
    'Wider three-level retail podium extends beyond the cached tower outline and is not yet reconstructed; only the tower-envelope colonnade/lobby is authored. Fresh site map requests failed; no extra podium boundary is invented.',
    'Maximum fidelity remains pending: inferred 190 ft x 180 ft plan, corner panel counts, frit pitch, seal sections, slab datums and crown/plant layout require dimensioned evidence. Published spandrel counts differ between references.',
    'Parapet 289.9 m is a working photographic datum distinct from 298.1 m architectural height. Highest occupied 287.1 m and opaque crown allocation require reconciliation; average floor intervals do not verify every slab.',
    'Mast positions, secondary tip heights, antenna details, BMO vector lettering, street doors and colonnade pier allocation are reconstructed. No transmitter identity or dimensional survey is claimed.',
    'Geographic approval requires signed site alignment, broader podium fit and terrain/pavement contact. The flat capture fixture cannot establish those facts.',
  ],
  camera: { position: [-290, 215, 350], lookAt: [0, 170, 0], fov: 36 },
  qaCameras: [
    { name: 'white-spandrels', position: [8, 152, 44], lookAt: [8, 151, Z] },
    { name: 'frit-closeup', position: [7, 154.8, 29.2], lookAt: [7, 154.8, Z] },
    { name: 'bronze-corner', position: [41, 174, 41], lookAt: [A, 171, B] },
    { name: 'window-pairs', position: [-35, 163, 5], lookAt: [-X, 163, 5] },
    { name: 'crown-lettering', position: [-14, 289, 68], lookAt: [-14, 285.5, Z] },
    { name: 'roof-equipment', position: [65, 337, 61], lookAt: [0, 296, 0] },
    { name: 'north-mast', position: [-29, 342, -37], lookAt: [-7, 330, -19] },
    { name: 'antenna-panels', position: [-21, 351, -33], lookAt: [-7, 344, -19] },
    { name: 'south-mast', position: [-28, 335, 42], lookAt: [-7, 328, 19] },
    { name: 'colonnade', position: [16, 4, 37], lookAt: [5, 3, 24] },
    { name: 'entrance-doors', position: [1.524, 3, 30], lookAt: [1.524, 2, 24] },
    { name: 'roof-plan', position: [0, 400, 1], lookAt: [0, 290, 0] },
    { name: 'far-silhouette', position: [-980, 500, 940], lookAt: [0, 170, 0] },
  ],
};
