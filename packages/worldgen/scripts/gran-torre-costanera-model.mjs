/** Original Gran Torre Costanera exterior; primary dimensions and reconstruction kept separate. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const glass = [0.16, 0.36, 0.44],
  spandrel = [0.12, 0.27, 0.33];
const silver = [0.64, 0.69, 0.7],
  pale = [0.82, 0.83, 0.78],
  dark = [0.09, 0.13, 0.15];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const turn = ([x, y, z], angle) => [
  Math.cos(angle) * x + Math.sin(angle) * z,
  y,
  -Math.sin(angle) * x + Math.cos(angle) * z,
];
function rotated(out, angle) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (s, r, p, n, u, c) =>
        out[name](
          s,
          r,
          p.map((p) => turn(p, angle)),
          turn(n, angle),
          u,
          c,
        ),
    ]),
  );
}

// The datum at floor 60 is published. Intermediate facade allocations remain reconstructions.
const sections = [
  [0, 25.7, 22.1],
  [23.9, 25.7, 22.1],
  [90, 24.8, 20.7],
  [155, 23.4, 18.2],
  [204.5, 21.6, 15.2],
  [249.6, 19.7, 12.2],
  [261.8, 19.35, 11.9],
  [280, 18.8, 11.65],
  [300, 18.2, 11.2],
];
function section(y) {
  let i = 1;
  while (i < sections.length - 1 && y > sections[i][0]) i++;
  const a = sections[i - 1],
    b = sections[i],
    t = (y - a[0]) / (b[0] - a[0]);
  const r = a[1] + t * (b[1] - a[1]),
    end = a[2] + t * (b[2] - a[2]);
  return { r, end, b: r * 0.922, k: (end + r * 0.922) / 2 };
}
// Each quadrant contains a folded main wall and a three-face recessed corner.
function quadrant(y) {
  const { r, end: a, b, k } = section(y);
  return [
    [0, y, -r],
    [-a, y, -b],
    [-a, y, -k],
    [-k, y, -a],
    [-b, y, -a],
  ];
}
function plan(y) {
  return Array.from({ length: 4 }, (_, i) =>
    quadrant(y).map((p) => turn(p, (i * Math.PI) / 2)),
  ).flat();
}
function slab(o, y, thickness, color = pale, slot = 'concrete') {
  const lower = plan(y),
    upper = lower.map(([x, yy, z]) => [x, yy + thickness, z]);
  loft(o, slot, [lower, upper], color, { cap: false });
  for (let k = 0; k < lower.length; k++) {
    const j = (k + 1) % lower.length;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [[0, y + thickness, 0], upper[k], upper[j]],
      [0, 1, 0],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      color,
    );
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [[0, y, 0], lower[j], lower[k]],
      [0, -1, 0],
      [
        [0, 0],
        [1, 1],
        [0, 1],
      ],
      color,
    );
  }
}

function panel(o, a, b, c, d, { clear = false, heavy = false } = {}) {
  const n = normalFor(a, b, c),
    offset = (p, v) => p.map((x, i) => x + n[i] * v);
  const aa = mix(a, d, 0.017),
    bb = mix(b, c, 0.017),
    cc = mix(b, c, 0.983),
    dd = mix(a, d, 0.983);
  face(o, clear ? 'clear_glass' : 'glass', [aa, bb, cc, dd], glass);
  // A separate opaque spandrel and silver pressure plate; flat color is not a window atlas.
  if (!clear) face(o, 'glass', [mix(a, d, 0.73), mix(b, c, 0.73), cc, dd], spandrel);
  for (const [p, q] of [
    [a, d],
    [b, c],
  ])
    beam(o, 'metal', offset(p, 0.022), offset(q, 0.022), heavy ? 0.085 : 0.042, 0.075, silver);
  for (const t of [0, 0.73, 1]) {
    const p = mix(a, d, t),
      q = mix(b, c, t);
    beam(o, 'stainless', offset(p, 0.025), offset(q, 0.025), t === 1 ? 0.06 : 0.038, 0.055, silver);
  }
  // Recessed seals remain geometry for close-up use.
  for (const [p, q] of [
    [aa, dd],
    [bb, cc],
  ])
    beam(o, 'recess', offset(p, -0.018), offset(q, -0.018), 0.022, 0.025, dark);
}

// Keep the bottom pressure plate above the ground-aligned structural slab.
const floorHeights = [0.08, 5.4, 10.8, 16.2, 20, 23.9];
for (let i = 1; i <= 55; i++) floorHeights.push(23.9 + (i * (249.6 - 23.9)) / 55);
floorHeights.push(253.7, 261.8);
const parts = [];
const repetitions = Array.from({ length: 4 }, (_, i) => ({ angle: (i * Math.PI) / 2 }));
parts.push({
  name: 'folded-glass-walls-and-recessed-corners',
  gpuInstances: true,
  instances: repetitions,
  build(o) {
    for (let row = 0; row < floorHeights.length - 1; row++) {
      const y0 = floorHeights[row],
        y1 = floorHeights[row + 1];
      const p = quadrant(y0),
        q = quadrant(y1);
      p.push(turn(quadrant(y0)[0], Math.PI / 2));
      q.push(turn(quadrant(y1)[0], Math.PI / 2));
      for (let edge = 0; edge < p.length - 1; edge++) {
        const a = p[edge],
          b = p[edge + 1],
          c = q[edge + 1],
          d = q[edge];
        const length = Math.hypot(...b.map((v, i) => v - a[i]));
        const count = Math.max(1, Math.round(length / 1.48));
        for (let j = 0; j < count; j++)
          panel(
            o,
            mix(a, b, j / count),
            mix(a, b, (j + 1) / count),
            mix(d, c, (j + 1) / count),
            mix(d, c, j / count),
            { clear: row < 2 || y0 >= 253.7 },
          );
      }
    }
  },
});

parts.push({
  name: 'open-crown-glass-screens-and-lattice',
  gpuInstances: true,
  instances: repetitions,
  build(o) {
    // Four independent folded glass walls, with open corner slots at their highest levels.
    const heights = [261.8, 265.5, 269.8, 274.1, 278.4, 282.7, 287, 291.3, 295.65, 300];
    for (let row = 0; row < heights.length - 1; row++) {
      const y = heights[row],
        yy = heights[row + 1];
      const lower = quadrant(y),
        upper = quadrant(yy);
      for (let half = 0; half < 2; half++) {
        const a = half === 0 ? [section(y).end, y, -section(y).b] : lower[0];
        const b = half === 0 ? lower[0] : lower[1];
        const d = half === 0 ? [section(yy).end, yy, -section(yy).b] : upper[0];
        const c = half === 0 ? upper[0] : upper[1];
        const count = 8;
        for (let j = 0; j < count; j++)
          panel(
            o,
            mix(a, b, j / count),
            mix(a, b, (j + 1) / count),
            mix(d, c, (j + 1) / count),
            mix(d, c, j / count),
            { clear: true, heavy: true },
          );
        beam(
          o,
          'metal',
          a.map((v, i) => v + (i === 2 ? 0.55 : 0)),
          b.map((v, i) => v + (i === 2 ? 0.55 : 0)),
          0.3,
          0.22,
          pale,
        );
      }
      // Corner enclosure stops below the four glass fins, as visible in the architect's photo.
      if (yy <= 282.7)
        for (let edge = 1; edge < 4; edge++) {
          const a = lower[edge],
            b = lower[edge + 1],
            c = upper[edge + 1],
            d = upper[edge];
          const count = Math.max(1, Math.round(Math.hypot(...b.map((v, i) => v - a[i])) / 1.4));
          for (let j = 0; j < count; j++)
            panel(
              o,
              mix(a, b, j / count),
              mix(a, b, (j + 1) / count),
              mix(d, c, (j + 1) / count),
              mix(d, c, j / count),
              { clear: true },
            );
        }
    }
    const framePoint = (x, y) => {
      const s = section(y);
      return [x * s.end, y, -s.r + 1.2 + Math.abs(x) * (s.r - s.b)];
    };
    for (const x of [-0.95, 0, 0.95])
      beam(o, 'metal', framePoint(x, 261.8), framePoint(x, 299.85), 0.4, 0.38, pale);
    for (const y of [265.5, 274.1, 282.7, 291.3, 299.8])
      beam(o, 'metal', framePoint(-0.95, y), framePoint(0.95, y), 0.36, 0.32, pale);
    for (const y of [265.5, 282.7])
      for (const side of [-1, 1]) {
        beam(o, 'metal', framePoint(0, y), framePoint(side * 0.95, y + 17.2), 0.25, 0.23, pale);
        beam(o, 'metal', framePoint(side * 0.95, y), framePoint(0, y + 17.2), 0.25, 0.23, pale);
      }
    // Sparse opaque frit bands give the clear crown a shared visual rhythm without image copies.
    for (let y = 262.3; y < 299.5; y += 1.1) {
      const s = section(y),
        h = 0.15;
      face(
        o,
        'metal',
        [
          [s.end, y, -s.b - 0.01],
          [0, y, -s.r - 0.01],
          [0, y + h, -s.r - 0.01],
          [s.end, y + h, -s.b - 0.01],
        ],
        [0.65, 0.74, 0.75],
      );
      face(
        o,
        'metal',
        [
          [0, y, -s.r - 0.01],
          [-s.end, y, -s.b - 0.01],
          [-s.end, y + h, -s.b - 0.01],
          [0, y + h, -s.r - 0.01],
        ],
        [0.65, 0.74, 0.75],
      );
    }
  },
});

parts.push({
  name: 'floor-plates-observatory-and-service-core',
  instances: [{}],
  build(o) {
    for (const y of [0, 5.4, 10.8, 23.9, 90, 155, 204.5, 249.6, 253.7]) slab(o, y, 0.2);
    slab(o, 261.6, 0.2, [0.54, 0.39, 0.23], 'wood');
    box(o, 'recess', [-8, 253.9, -7], [8, 266, 7], [0.23, 0.25, 0.25]);
    box(o, 'metal', [-6.5, 266, -5.5], [6.5, 269.5, 5.5], pale);
    for (let x = -5.8; x < 6; x += 0.6)
      box(o, 'recess', [x, 266.5, -5.56], [x + 0.31, 269, -5.51], dark);
    // Slender observation railing and accessible viewing floor inside the open crown.
    const ring = plan(261.8).map(([x, y, z]) => [x * 0.91, y, z * 0.91]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      beam(
        o,
        'stainless',
        a.map((v, i) => v + (i === 1 ? 1.1 : 0)),
        b.map((v, i) => v + (i === 1 ? 1.1 : 0)),
        0.045,
        0.045,
        silver,
      );
      beam(
        o,
        'stainless',
        a,
        a.map((v, i) => v + (i === 1 ? 1.1 : 0)),
        0.045,
        0.045,
        silver,
      );
    }
    // Ground lobby: these are exterior-visible structural elements, not an authored office interior.
    box(o, 'stone', [-8, 0, -7], [8, 10.7, 7], [0.57, 0.58, 0.55]);
    for (const x of [-19, -9, 9, 19])
      for (const z of [-19, 19])
        box(o, 'metal', [x - 0.34, 0, z - 0.34], [x + 0.34, 10.7, z + 0.34], pale);
  },
});

parts.push({
  name: 'rod-supported-entrance-canopy-and-doors',
  instances: [{}],
  build(o) {
    // Front (-Z) is a provisional facing choice pending the signed geographic review.
    const wall = (x, y) => [
      x,
      y,
      -section(y).r + (Math.abs(x) * (section(y).r - section(y).b)) / section(y).end,
    ];
    const outer = (x, y) => [x, y, -32.9 + Math.abs(x) * 0.025];
    const span = 11.2;
    for (let i = 0; i < 8; i++) {
      const x = -span + (i * span) / 4,
        xx = x + span / 4;
      const a = wall(x, 5.15),
        b = wall(xx, 5.15),
        c = outer(xx, 5.15),
        d = outer(x, 5.15);
      face(o, 'clear_glass', [a, b, c, d], [0.55, 0.66, 0.68]);
      beam(o, 'stainless', a, d, 0.15, 0.32, silver);
      beam(o, 'stainless', wall(x, 14.5), outer(x, 5.35), 0.08, 0.08, silver);
      beam(o, 'stainless', wall(x, 0.1), wall(x, 15), 0.25, 0.23, silver);
      box(o, 'metal', [d[0] - 0.08, 4.8, d[2] + 0.4], [d[0] + 0.08, 4.98, d[2] + 0.57], dark);
    }
    beam(o, 'metal', outer(-span, 5.15), outer(span, 5.15), 0.28, 0.32, silver);
    for (let i = 0; i < 8; i++) {
      const x = -4.8 + i * 1.2;
      const a = wall(x, 0.12),
        b = wall(x + 1.16, 0.12),
        c = wall(x + 1.16, 3.2),
        d = wall(x, 3.2);
      const offset = (p) => p.map((v, i) => v - (i === 2 ? 0.08 : 0));
      panel(o, offset(b), offset(a), offset(d), offset(c), { clear: true, heavy: true });
      const lo = wall(x + 0.93, 0.9),
        hi = wall(x + 0.93, 1.75);
      tube(
        o,
        'stainless',
        lo.map((v, i) => v - (i === 2 ? 0.16 : 0)),
        hi.map((v, i) => v - (i === 2 ? 0.16 : 0)),
        0.021,
        silver,
        8,
      );
    }
  },
});

/** Keep the taper and open crown for the first, distant download. */
export function buildGranTorreSkyline(o) {
  const levels = [0, 23.9, 90, 155, 204.5, 249.6, 261.8];
  loft(o, 'glass', levels.map(plan), glass, { cap: false });
  slab(o, 261.6, 0.2, pale);
  for (let q = 0; q < 4; q++) {
    const out = rotated(o, (q * Math.PI) / 2);
    for (let i = 0; i < 2; i++) {
      const a = quadrant(261.8),
        b = quadrant(300);
      const lo = i === 0 ? [a[0], a[1]] : [[section(261.8).end, 261.8, -section(261.8).b], a[0]];
      const hi = i === 0 ? [b[0], b[1]] : [[section(300).end, 300, -section(300).b], b[0]];
      face(out, 'glass', [lo[0], lo[1], hi[1], hi[0]], [0.44, 0.61, 0.65]);
      face(out, 'glass', [lo[1], lo[0], hi[0], hi[1]], [0.44, 0.61, 0.65]);
    }
    for (const y of [266, 274, 282]) {
      const p = quadrant(y);
      beam(out, 'metal', p[1], p[4], 0.28, 0.28, pale);
    }
  }
}

export const granTorreCostaneraStudy = {
  id: 'N0232',
  key: 'gran_torre_costanera',
  title: 'Gran Torre Costanera',
  wikidataId: 'Q1542408',
  build(out) {
    for (const p of parts)
      for (const instance of p.instances) p.build(rotated(out, instance.angle ?? 0));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Gran Torre Costanera modular exterior',
    );
  },
  brief:
    'Four folded and tapering blue glass walls; deep recessed corner strips; four projecting clear crown screens with exposed diagonal steel lattice; enclosed and open observatory levels; repeated curtain-wall bays; rod-supported glass entrance canopy and doors.',
  sourceFacts: {
    architecturalHeightMeters: 300,
    aboveGroundFloors: 64,
    ownerOfficeFloors: 54,
    ownerFloor60Meters: 249.6,
    ownerFloor60SlabIntervalMeters: 4.1,
    ownerBrochureTypicalIntervalMeters: 3.95,
    observatoryFloorLabels: [61, 62],
  },
  reconstruction: {
    sectionEnvelope: sections,
    sectionMeaning:
      'height, facade ridge radius, facade wing half-width; original working reconstruction scaled to cached footprint and owner upper-floor plans',
    floorHeights,
    observatoryWorkingHeights: [253.7, 261.8],
    crownCornerClosureTop: 282.7,
    canopyWidthMeters: 22.4,
    canopyFrontZ: -32.9,
    basis:
      'Architect exterior/crown/observatory/entrance photos and owner floor plans. Intermediate dimensions, bay counts, floor datums, structural members and entrance extent are inferred, not a measured survey.',
  },
  refs: [
    'https://pcparch.com/work/gran-torre-santiago',
    'https://www.abwb.cl/proyecto/costanera-center/',
    'https://officehubcostanera.cl/sites/hubcostanera/files/master_plan/costanera/planos/ficha_oficina_TC_6000.pdf',
    'https://officehubcostanera.cl/sites/default/files/2024-01/Brochure%20Pisos%20Habilitados%20copia.pdf',
    'https://skycostanera.cl/en/rates-and-schedules',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X along one mapped facade axis',
    front: '-Z toward the provisional entrance side',
    origin: 'Centered tower footprint at local pavement datum',
  },
  geographic: () => ({
    notes:
      'Exact Q1542408 match to OSM way 1179710949 supplies an undirected footprint axis. Native -Z canopy side is provisional; the north arrow in the owner plan requires signed entrance confirmation. No mall complex is substituted for this individually identified tower.',
  }),
  limitations: [
    'Geographic fit and maximum exterior fidelity are pending. Cached map axis is undirected and the entrance side is not approved.',
    'Upper-floor drawings are marked illustrative. Envelope taper, corner depth, canopy dimensions, floor divisions and crown levels are working reconstructions.',
    'Do not equate the marketed 300 m observatory height with the owner drawing floor-60 datum. Floor 61/62 heights in this model are provisional.',
    'The surrounding mall and neighboring towers are separate structures. Plaza boundaries, planting, connecting walkways and actual terrain remain unauthored.',
    'Glazing uses local PBR color and alpha; steel, stone, concrete and wood use canonical shared graphs. No copied photographic textures or downloaded meshes.',
  ],
  camera: { position: [-280, 190, -345], lookAt: [0, 145, 0], fov: 39 },
  qaCameras: [
    { name: 'folded-wall', position: [-12, 116, -34], lookAt: [0, 116, -24] },
    { name: 'facade-bays', position: [-8, 42, -30], lookAt: [-8, 42, -25] },
    { name: 'recessed-corner', position: [-36, 230, -36], lookAt: [-16, 228, -16] },
    { name: 'crown-exterior', position: [-57, 290, -64], lookAt: [0, 279, 0] },
    { name: 'crown-lattice', position: [0, 270, 0], lookAt: [0, 279, -18] },
    { name: 'observatory', position: [10, 264, -10], lookAt: [-12, 266, -18] },
    { name: 'entrance-canopy', position: [-25, 10, -44], lookAt: [0, 7, -27] },
    { name: 'entrance-doors', position: [-7, 3, -34], lookAt: [0, 1.8, -25.7] },
    { name: 'roof-plan', position: [0, 353, 0.1], lookAt: [0, 261, 0] },
    { name: 'far-silhouette', position: [-630, 295, -690], lookAt: [0, 145, 0] },
  ],
};
