/** Original 4 WTC exterior, with separate office plans and unitized flush glazing. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(
  structureSourcePath('n0218_4_world_trade_center', 'map-frame.json'),
);
const frame = JSON.parse(frameBytes);
const glass = [0.44, 0.555, 0.595],
  clear = [0.67, 0.76, 0.77];
const silver = [0.66, 0.71, 0.73],
  dark = [0.115, 0.155, 0.17];
const roof = [0.42, 0.45, 0.46],
  pale = [0.72, 0.72, 0.69];
const interval = 4.0894,
  top = 297.7,
  lobbyCeiling = 14.0208;
const upperBase = 279.9 - 15 * interval;
const lowerTop = upperBase - 2 * interval,
  lowerBase = lowerTop - 40 * interval;
const upperTop = upperBase + 16 * interval;
const offset = [2.6, 2.7];
const shift = ([x, z]) => [x + offset[0], z + offset[1]];
const lowerRaw = [
  [-37.56, -28.12],
  [20.352, -28.12],
  [20.352, -22.36],
  [24.52, -23.66],
  [37.49, 28.06],
  [-19.99, 28.06],
  [-19.99, 22.52],
  [-24.3, 23.6],
].map(shift);
const upperRaw = [shift([-7.1, -28.12]), ...lowerRaw.slice(1)];
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const clockwise = (p) => (area(p) < 0 ? p : p.toReversed());
const lower = clockwise(lowerRaw),
  upper = clockwise(upperRaw);
const base = clockwise(frame.geometry.outline.slice(0, -1));
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const tint = (n) =>
  glass.map((v) => v + (((Math.imul(n + 71, 48271) >>> 0) % 67) / 66 - 0.5) * 0.025);

function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / length,
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

/** Concave floor plates retain corner recesses; ear clipping never fills their notches. */
function cap(out, plan, y, slot, color, down = false) {
  const p = clockwise(plan),
    ids = p.map((_, i) => i),
    triangles = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[(i + ids.length - 1) % ids.length],
        b = ids[i],
        c = ids[(i + 1) % ids.length];
      if (cross(p[a], p[b], p[c]) >= -1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross(p[a], p[b], p[k]) < 1e-8 &&
            cross(p[b], p[c], p[k]) < 1e-8 &&
            cross(p[c], p[a], p[k]) < 1e-8,
        )
      )
        continue;
      triangles.push([a, b, c]);
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw new Error('4 WTC: floor plate cannot be triangulated');
  }
  triangles.push(ids);
  for (const t of triangles) {
    let q = t.map((i) => [p[i][0], y, p[i][1]]);
    if (down) q = q.toReversed();
    out.addTriangle(
      slot,
      'palette:#ffffff',
      q,
      normalFor(...q),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}
function slab(out, plan, y0, y1, slot = 'concrete', color = pale) {
  const p = clockwise(plan);
  loft(out, slot, [p.map(([x, z]) => [x, y0, z]), p.map(([x, z]) => [x, y1, z])], color, {
    cap: false,
  });
  cap(out, p, y0, slot, color, true);
  cap(out, p, y1, slot, color);
}
function pane(o, x0, x1, y0, y1, serial, transparent = false, z = 0) {
  if (!transparent) {
    // A flush pane keeps its slight tint; its 1.3 cm joints and 4 mm bevels are below every
    // runtime level's error. Neighbouring panes share edges, so a facade is one surface.
    face(
      o,
      'glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      tint(serial),
    );
    return;
  }
  const gap = 0.013,
    bevel = 0.004;
  const ring = (g, d) => [
    [x0 + g, y0 + g, d],
    [x1 - g, y0 + g, d],
    [x1 - g, y1 - g, d],
    [x0 + g, y1 - g, d],
  ];
  const front = ring(gap + bevel, z),
    rim = ring(gap, z - bevel),
    seal = ring(0, z - bevel);
  face(o, 'clear_glass', front, clear);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, 'metal', [rim[i], rim[j], front[j], front[i]], dark);
    // Join the seal to the bevel exactly. An unconnected recessed strip lets the
    // sky through at oblique angles; overlapping corner strips also fight in depth.
    face(o, 'recess', [seal[i], seal[j], rim[j], rim[i]], dark);
  }
}
function curtain(out, plan, y0, rows, step = interval, serial = 0) {
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    const count = Math.max(1, Math.round(o.length / 1.524)),
      w = o.length / count;
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < count; i++)
        pane(
          o,
          i * w,
          (i + 1) * w,
          y0 + row * step,
          y0 + (row + 1) * step,
          serial + row * 173 + k * 997 + i,
        );
  }
}
function louvres(o, x0, x1, y0, y1) {
  face(
    o,
    'recess',
    [
      [x0, y0, -0.08],
      [x1, y0, -0.08],
      [x1, y1, -0.08],
      [x0, y1, -0.08],
    ],
    dark,
  );
  // Folded fins at four times the real 9 cm pitch: the same ribbed band, a quarter of the faces.
  const count = Math.max(2, Math.round((x1 - x0) / 0.36)),
    w = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const x = x0 + i * w;
    // Folded vertical weather fins supply actual depth and return edges.
    face(
      o,
      'metal',
      [
        [x, y0, -0.06],
        [x + w * 0.57, y0, 0.035],
        [x + w * 0.57, y1, 0.035],
        [x, y1, -0.06],
      ],
      silver,
    );
    face(
      o,
      'metal',
      [
        [x + w * 0.57, y0, 0.035],
        [x + w * 0.83, y0, -0.015],
        [x + w * 0.83, y1, -0.015],
        [x + w * 0.57, y1, 0.035],
      ],
      silver,
    );
  }
  box(o, 'metal', [x0, y0, -0.02], [x1, y0 + 0.055, 0.045], silver);
  box(o, 'metal', [x0, y1 - 0.055, -0.02], [x1, y1, 0.045], silver);
}
function plantBand(out, plan, y0, y1) {
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]),
      n = Math.max(1, Math.round(o.length / 1.524)),
      w = o.length / n;
    for (let i = 0; i < n; i++) {
      pane(o, i * w, i * w + w * 0.52, y0, y1, k * 503 + i);
      louvres(o, i * w + w * 0.54, (i + 1) * w - 0.02, y0 + 0.025, y1 - 0.025);
    }
  }
}
function rail(out, a, b, y) {
  const o = edge(out, a, b),
    n = Math.max(1, Math.round(o.length / 1.5));
  for (let i = 0; i < n; i++)
    pane(o, (i * o.length) / n, ((i + 1) * o.length) / n, y + 0.08, y + 1.1, i, true, -0.15);
  tube(o, 'stainless', [0, y + 1.12, -0.15], [o.length, y + 1.12, -0.15], 0.032, silver, 10);
  for (let i = 0; i <= n; i++)
    box(
      o,
      'stainless',
      [(i * o.length) / n - 0.021, y, -0.2],
      [(i * o.length) / n + 0.021, y + 1.12, -0.1],
      silver,
    );
}
function revolving(out, x, z) {
  const r = 1.42,
    h = 3.32;
  for (const [y0, y1] of [
    [0.08, 0.12],
    [h, h + 0.23],
  ])
    loft(
      out,
      'stainless',
      [
        radialRing(y0, r + 0.08, r + 0.08, 64, [x, z]),
        radialRing(y1, r + 0.08, r + 0.08, 64, [x, z]),
      ],
      silver,
    );
  tube(out, 'stainless', [x, 0.12, z], [x, h, z], 0.065, silver, 16);
  for (const start of [-Math.PI * 0.3, Math.PI * 0.7])
    for (let i = 0; i < 30; i++) {
      const a = start + (i * Math.PI * 0.6) / 30,
        b = start + ((i + 1) * Math.PI * 0.6) / 30;
      const p = (t, y) => [x + r * Math.cos(t), y, z + r * Math.sin(t)];
      face(out, 'clear_glass', [p(b, 0.13), p(a, 0.13), p(a, h), p(b, h)], clear);
      if (i % 10 === 0) tube(out, 'stainless', p(a, 0.12), p(a, h), 0.023, silver, 10);
    }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3,
      o = edge(out, [x, z], [x + (r - 0.06) * Math.cos(a), z + (r - 0.06) * Math.sin(a)]);
    pane(o, 0.05, o.length, 0.15, h - 0.04, i, true);
    tube(o, 'stainless', [0.09, 1.15, 0.04], [o.length - 0.08, 1.15, 0.04], 0.019, silver, 8);
  }
  torus(out, 'stainless', [x, 0.135, z], r, 0.025, silver, 64, 8);
}
function lobby(out) {
  slab(out, base, 0, 0.12, 'marble');
  slab(out, base, lobbyCeiling, lobbyCeiling + 0.35, 'marble');
  // A restrained visible lobby interior; tenant rooms and sculpture are not invented.
  box(out, 'stone', [-17, 0.12, -11], [22, lobbyCeiling, 10], [0.08, 0.09, 0.09]);
  for (const x of [-11, 1, 13]) {
    box(out, 'wood', [x - 2.6, 0.12, 10.01], [x + 2.6, 5.6, 10.13], [0.55, 0.37, 0.17]);
    box(out, 'recess', [x - 1.75, 0.14, 10.14], [x + 1.75, 4.5, 10.17], dark);
    for (const side of [-1, 1])
      box(
        out,
        'stainless',
        [x + side * 1.68 - 0.024, 0.15, 10.18],
        [x + side * 1.68 + 0.024, 4.51, 10.23],
        silver,
      );
  }
  for (let k = 0; k < base.length; k++) {
    const o = edge(out, base[k], base[(k + 1) % base.length]);
    const n = Math.max(1, Math.round(o.length / 1.524)),
      w = o.length / n;
    const doors = o.length > 45 ? [Math.floor(n * 0.35), Math.floor(n * 0.67)] : [];
    const openings = doors.map((col) => [(col + 0.5) * w - 2.55, (col + 0.5) * w + 2.55]);
    for (let i = 0; i < n; i++) {
      let segments = [[i * w, (i + 1) * w]];
      for (const [a, b] of openings)
        segments = segments.flatMap(([lo, hi]) =>
          hi <= a || lo >= b
            ? [[lo, hi]]
            : [
                [lo, Math.min(hi, a)],
                [Math.max(lo, b), hi],
              ].filter(([l, h]) => h - l > 0.04),
        );
      for (const [lo, hi] of segments) pane(o, lo, hi, 0.14, 3.6, i, true, -0.11);
      for (let row = 0; row < 3; row++)
        pane(
          o,
          i * w,
          (i + 1) * w,
          3.6 + (row * (lobbyCeiling - 3.6)) / 3,
          3.6 + ((row + 1) * (lobbyCeiling - 3.6)) / 3,
          i + row * 97,
          true,
          -0.11,
        );
    }
    for (let i = 0; i <= n; i++) {
      const overDoor = openings.some(([a, b]) => i * w >= a - 0.04 && i * w <= b + 0.04);
      box(
        o,
        'stainless',
        [i * w - 0.036, overDoor ? 3.6 : 0.12, -0.27],
        [i * w + 0.036, lobbyCeiling, 0.015],
        silver,
      );
    }
    for (const col of doors) {
      const x = (col + 0.5) * w;
      revolving(o, x, -0.55);
      // Balanced swing door beside the revolving drum, with visible pull hardware.
      for (const sign of [-1, 1]) {
        const xx = x + sign * 1.98;
        pane(o, xx - 0.5, xx + 0.5, 0.15, 3.3, col, true, -0.09);
        tube(o, 'stainless', [xx + 0.32, 1.02, 0], [xx + 0.32, 1.5, 0], 0.018, silver, 8);
        for (const side of [-1, 1])
          box(
            o,
            'stainless',
            [xx + side * 0.52 - 0.025, 0.12, -0.18],
            [xx + side * 0.52 + 0.025, 3.6, 0],
            silver,
          );
      }
      pane(o, x - 2.55, x + 2.55, 3.32, 3.6, col, true, -0.11);
      box(o, 'stainless', [x - 3, 3.62, -0.15], [x + 3, 3.73, 0.85], silver);
    }
    if (o.length > 35)
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const p = o.point([o.length * t, 0, -1.65]);
        box(
          out,
          'stainless',
          [p[0] - 0.29, 0.12, p[2] - 0.29],
          [p[0] + 0.29, lobbyCeiling, p[2] + 0.29],
          silver,
        );
      }
  }
  curtain(out, base, lobbyCeiling + 0.35, 2, 5.7, 10000);
  slab(out, base, 25.7708, 25.95, 'recess', roof);
  slab(out, lower, 25.95, 26.16, 'metal', silver);
  curtain(out, lower, 26.16, 3, (lowerBase - 26.16) / 4, 20000);
  plantBand(out, lower, lowerBase - (lowerBase - 26.16) / 4, lowerBase);
}
function build(out) {
  lobby(out);
  curtain(out, lower, lowerBase, 40, interval, 30000);
  plantBand(out, lower, lowerTop, upperBase - 0.18);
  const terrace = clockwise([lowerRaw[0], upperRaw[0], lowerRaw.at(-1)]);
  slab(out, terrace, upperBase - 0.18, upperBase, 'stone', [0.57, 0.59, 0.58]);
  rail(out, lowerRaw[0], lowerRaw.at(-1), upperBase);
  rail(out, upperRaw[0], lowerRaw[0], upperBase);
  // Fine paving joints are clipped to the triangular terrace, not extended through the tower.
  for (let t = 0.04; t < 0.98; t += 0.035) {
    const a = mix(lowerRaw[0], upperRaw[0], t),
      b = mix(lowerRaw[0], lowerRaw.at(-1), t);
    beam(
      out,
      'metal',
      [a[0], upperBase + 0.007, a[1]],
      [b[0], upperBase + 0.007, b[1]],
      0.014,
      0.007,
      [0.32, 0.35, 0.36],
    );
  }
  curtain(out, upper, upperBase, 16, interval, 50000);
  curtain(out, upper, upperTop, 1, 3.85, 70000);
  plantBand(out, upper, upperTop + 3.85, top - 0.55);
  curtain(out, upper, top - 0.55, 1, 0.55, 80000);
  cap(out, upper, top - 0.32, 'recess', roof);
  for (let k = 0; k < upper.length; k++) {
    const o = edge(out, upper[k], upper[(k + 1) % upper.length]);
    box(o, 'stainless', [0, top - 0.05, -0.15], [o.length, top, 0.025], silver);
  }
}

export const fourWorldTradeCenterStudy = {
  id: 'N0218',
  key: '4_world_trade_center',
  title: '4 World Trade Center',
  wikidataId: 'Q1351208',
  mapFrame: 'map-frame.json',
  build,
  brief:
    '4 World Trade Center: separate notched parallelogram and upper trapezoid, northwest triangular terrace, finely jointed silver glass, vertical mechanical louvres, clear tall lobby, revolving entrances and independent mapped retail envelope.',
  sourceFacts: {
    architecturalHeightMeters: 297.7,
    highestOccupiedMeters: 279.9,
    lobbyFinishedCeilingMeters: lobbyCeiling,
    ownerFloorIntervalMeters: interval,
    architectUnitMeters: [1.524, 4.1148],
    lowerOfficeLabels: [15, 54],
    upperOfficeLabels: [57, 72],
    physicalFloorsCouncil: 65,
    marketedFloorLabels: 72,
  },
  reconstruction: {
    lowerPlan: lowerRaw,
    upperPlan: upperRaw,
    officeOffsetXZ: offset,
    lowerBase,
    lowerTop,
    upperBase,
    upperTop,
    tip: top,
    planBasis:
      'Owner level-28 plan has 38 visible nominal five-foot units along the north edge, giving 57.912 m. Remaining edges and recesses are inferred from drawing proportions. Translation [2.6,2.7] is provisional within the separate map envelope.',
    verticalBasis:
      'The level-72 occupied-floor datum and owner interval place level 57 at 218.559 m. Two transfer intervals and forty lower offices determine the lower stack. Mechanical/floor-label conventions and the one-inch glass-unit/slab difference remain unresolved.',
    materials:
      'Canonical stone, marble, wood, painted metal and stainless graphs; individual PBR panes and geometric joints without reference-photo textures.',
  },
  refs: [
    'https://www.maki-and-associates.co.jp/projects/WTC?lang=en',
    'https://www.tozai-as.or.jp/mytech/19/19-maki15.html',
    'https://www.silversteinproperties.com/portfolio-properties/4-world-trade-center',
    'https://d2y2r48zu7mp3w.cloudfront.net/properties/828ee848-28fb-433a-a8bc-784260f45c15/2232a3a2-f658-437e-8f4c-aa66accd4649.pdf',
    'https://www.lera.com/world-trade-center-tower-4-more-descrip',
    'https://www.permasteelisagroup.com/historic-project/four-world-trade-center/',
    'https://www.skyscrapercenter.com/building/4-world-trade-center/545',
    'https://www.openstreetmap.org/way/278033587',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-southeast along local map frame',
    front: '+Z south-southwest',
    origin:
      'Mapped ground-envelope center at terrain contact. Independent office plan has an explicit inferred offset.',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    notes:
      'Exact-QID OSM base, independently corroborated by NYC BIN footprint. Office plan dimensions and translation are independent reconstructions. Northwest terrace faces the memorial side; signed site fit and street datum remain pending.',
  }),
  geometrySource:
    'Original procedural exterior from linked architect/owner plans and photos. No third-party mesh or photo texture is rendered; the municipal 3D archive contained no usable geometry for this tower.',
  sourceLicense:
    'Original Molen recipe under repository MIT license. Map evidence © OpenStreetMap contributors, ODbL-1.0. Public NYC metadata is retained as attributed reference facts. Reference photos/drawings are linked, not redistributed.',
  sourceDocuments: ['reference-metadata.json'],
  limitations: [
    'Maximum-fidelity approval is pending: office plan scale and recess measurements, northwest diagonal endpoints and relative translation require a dimensioned as-built plan.',
    'The lower office datum and transfer-floor heights are inferred. The 65 physical/72 marketed floor convention and one-inch unit/slab discrepancy remain unresolved.',
    'Entrance allocation, revolving-door sizes, retail-floor glazing, plant louvre spacing and parapet details are photo-informed working reconstructions, not surveyed quantities. Interiors beyond the visible lobby, the hanging sculpture, tenant signage and neighbouring structures are excluded.',
    'Geographic approval requires signed current facade alignment and actual pavement elevation/contact; the flat placement fixture alone is insufficient.',
  ],
  camera: { position: [-245, 186, 285], lookAt: [0, 146, 0], fov: 36 },
  qaCameras: [
    { name: 'upper-trapezoid', position: [-91, 291, -97], lookAt: [-3, 253, 0] },
    { name: 'northwest-terrace', position: [-53, 241, -58], lookAt: [-17, upperBase, -7] },
    {
      name: 'terrace-junction',
      position: [-37, upperBase + 8, -26],
      lookAt: [-12, upperBase + 2, -15],
    },
    { name: 'flush-glass-detail', position: [10, 145, 45], lookAt: [10, 145, 30.76] },
    { name: 'northeast-recess', position: [54, 95, -44], lookAt: [25, 90, -23] },
    { name: 'southwest-recess', position: [-51, 95, 43], lookAt: [-19, 90, 27] },
    { name: 'mechanical-louvres', position: [58, 293, 48], lookAt: [34, 292, 20] },
    { name: 'memorial-lobby', position: [-73, 10, 0], lookAt: [-28, 6, 0] },
    { name: 'south-entrances', position: [0, 8, 62], lookAt: [0, 5, 31] },
    { name: 'revolving-doors', position: [-4, 4, 40], lookAt: [-4, 2, 30] },
    { name: 'roof-plan', position: [0, 446, 1], lookAt: [0, 0, 0] },
    { name: 'far-silhouette', position: [-810, 430, 860], lookAt: [0, 148, 0] },
  ],
};
