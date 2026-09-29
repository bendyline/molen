/** Cayan: SOM's stepped helical hexagon, recessed balconies and shaded curtain wall. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const silver = [0.71, 0.735, 0.74],
  dark = [0.14, 0.185, 0.205],
  blue = [0.2, 0.31, 0.37],
  pale = [0.62, 0.63, 0.6];
// The architect's typical floor is a faint chevron, not a regular hexagon or a square.
// This trace retains its opposed kinks within the mapped tower envelope; fine offsets are reconstructed.
const plan = clockwise([
  [-17.6, -18.48],
  [17.6, -18.48],
  [16.7, 0],
  [19.96, 18.48],
  [-15.24, 18.48],
  [-19.96, 0],
]);
const base = 6.7,
  pitch = 3.8,
  rows = 75,
  roof = base + pitch * rows;
const yaw = (y) => (Math.max(0, Math.min(1, (y - base) / (roof - base))) * Math.PI) / 2;
const spin = (p, y, d = 0) => {
  const a = yaw(y),
    c = Math.cos(a),
    s = Math.sin(a),
    r = Math.hypot(...p);
  const f = r ? (r + d) / r : 1;
  return [(p[0] * c - p[1] * s) * f, y, (p[0] * s + p[1] * c) * f];
};
const at = (p, y) => [p[0], y, p[1]];
let faceFloor;
function point(i, t, y, depth = 0) {
  const a = plan[i],
    b = plan[(i + 1) % plan.length];
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  const local = [a[0] + dx * t - (dz / l) * depth, a[1] + dz * t + (dx / l) * depth];
  const result = spin(local, y);
  if (faceFloor !== undefined) {
    // SOM's columns lean normal to the face but do not lean sideways within each storey.
    // Their lateral rotation is taken up by a small step hidden in the next floor slab.
    const start = spin(local, faceFloor),
      a = yaw(faceFloor + pitch / 2);
    const tangent = [
      (dx * Math.cos(a) - dz * Math.sin(a)) / l,
      (dx * Math.sin(a) + dz * Math.cos(a)) / l,
    ];
    const slide = (result[0] - start[0]) * tangent[0] + (result[2] - start[2]) * tangent[1];
    result[0] -= tangent[0] * slide;
    result[2] -= tangent[1] * slide;
  }
  return result;
}
function patch(out, slot, i, t0, t1, y0, y1, col, depth = 0) {
  face(
    out,
    slot,
    [
      point(i, t0, y0, depth),
      point(i, t1, y0, depth),
      point(i, t1, y1, depth),
      point(i, t0, y1, depth),
    ],
    col,
  );
}
function closedStrip(out, i, t0, t1, y0, y1, col, depth = 0.16, slot = 'metal') {
  const f = [
    point(i, t0, y0, depth),
    point(i, t1, y0, depth),
    point(i, t1, y1, depth),
    point(i, t0, y1, depth),
  ];
  const b = [
    point(i, t0, y0, -0.48),
    point(i, t1, y0, -0.48),
    point(i, t1, y1, -0.48),
    point(i, t0, y1, -0.48),
  ];
  face(out, slot, f, col);
  face(out, slot, b.toReversed(), col);
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    face(out, slot, [f[j], b[j], b[k], f[k]], col);
  }
}
function facade(out) {
  for (let row = 0; row < rows; row++) {
    const y0 = base + row * pitch,
      y1 = y0 + pitch;
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const bays = Math.round(length / 2.7),
        edge = 0.24 / length;
      faceFloor = undefined;
      closedStrip(out, i, 0, 1, y0, y0 + 0.4, silver, 0.28);
      faceFloor = y0;
      for (let bay = 0; bay < bays; bay++) {
        const t0 = bay / bays,
          t1 = (bay + 1) / bays;
        const balcony = (bay === Math.floor(bays / 2) || bay === bays - 2) && row > 5 && row < 67;
        const depth = balcony ? -1.5 : -0.3;
        patch(out, 'glass', i, t0 + edge, t1 - edge, y0 + 0.4, y1, blue, depth);
        // Continuous opaque jamb returns, deep sills and the glazing transom enclose each opening.
        closedStrip(out, i, t0, t0 + edge, y0 + 0.4, y1, silver, 0.12);
        closedStrip(out, i, t1 - edge, t1, y0 + 0.4, y1, silver, 0.12);
        for (const t of [t0 + edge, t1 - edge]) {
          const points = [
            point(i, t, y0 + 0.4, depth),
            point(i, t, y1, depth),
            point(i, t, y1, 0.12),
            point(i, t, y0 + 0.4, 0.12),
          ];
          face(out, 'metal', t === t1 - edge ? points.toReversed() : points, silver);
        }
        for (const [y, reverse] of [
          [y0 + 0.4, true],
          [y1, false],
        ]) {
          const pts = [
            point(i, t0 + edge, y, depth),
            point(i, t1 - edge, y, depth),
            point(i, t1 - edge, y, 0.12),
            point(i, t0 + edge, y, 0.12),
          ];
          face(out, 'metal', reverse ? pts.toReversed() : pts, silver);
        }
        beam(
          out,
          'metal',
          point(i, (t0 + t1) / 2, y0 + 0.4, depth + 0.035),
          point(i, (t0 + t1) / 2, y1, depth + 0.035),
          0.045,
          0.045,
          silver,
        );
        beam(
          out,
          'metal',
          point(i, t0 + edge, y0 + 1.08, depth + 0.035),
          point(i, t1 - edge, y0 + 1.08, depth + 0.035),
          0.045,
          0.045,
          silver,
        );
        const screenWidth = ((row + bay * 3 + i) % 5 === 0 ? 1.15 : 0.72) / length;
        const start = (row + bay + i) % 2 === 0 ? t0 + edge : t1 - edge - screenWidth;
        const sy0 = y0 + 0.44,
          sy1 = y1 - 0.08,
          sd = depth + 0.1016;
        if (!balcony || row % 3 !== 0) {
          patch(out, 'screen', i, start, start + screenWidth, sy0, sy1, silver, sd);
          for (const t of [start, start + screenWidth])
            beam(out, 'metal', point(i, t, sy0, sd), point(i, t, sy1, sd), 0.035, 0.06, silver);
          for (const y of [sy0, sy1])
            beam(
              out,
              'metal',
              point(i, start, y, sd),
              point(i, start + screenWidth, y, sd),
              0.04,
              0.05,
              silver,
            );
        }
        if (balcony) {
          patch(
            out,
            'clear_glass',
            i,
            t0 + edge,
            t1 - edge,
            y0 + 0.43,
            y0 + 1.52,
            [0.65, 0.75, 0.78],
            -0.08,
          );
          beam(
            out,
            'metal',
            point(i, t0 + edge, y0 + 1.52, -0.08),
            point(i, t1 - edge, y0 + 1.52, -0.08),
            0.045,
            0.055,
            silver,
          );
        }
      }
      faceFloor = undefined;
      // Separate fine ACP seams across the stepped floor slab.
      for (let k = 1; k < bays; k++)
        beam(
          out,
          'recess',
          point(i, k / bays, y0 + 0.07, 0.293),
          point(i, k / bays, y0 + 0.34, 0.293),
          0.013,
          0.012,
          dark,
        );
    }
  }
  mappedCap(
    out,
    'recess',
    plan.map((p) => {
      const q = spin(p, roof);
      return [q[0], q[2]];
    }),
    roof,
    [0.25, 0.27, 0.27],
  );
}
function crown(out) {
  // The open metal crown continues the last facade frame; no opaque box fills its void.
  for (let i = 0; i < plan.length; i++) {
    const length = Math.hypot(plan[(i + 1) % 6][0] - plan[i][0], plan[(i + 1) % 6][1] - plan[i][1]);
    const n = Math.round(length / 2.7);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const a = point(i, t, roof),
        height = 306.1 + 0.3 * Math.cos(t * Math.PI * 2);
      beam(out, 'metal', a, [a[0], height, a[2]], 0.31, 0.42, silver);
      const d = point(i, t, roof, -2.1);
      beam(out, 'metal', [a[0], roof + 9, a[2]], [d[0], roof, d[2]], 0.12, 0.12, silver);
    }
    for (const y of [roof + 4.0, roof + 8.0, roof + 12.0]) {
      const a = point(i, 0, roof),
        b = point(i, 1, roof);
      beam(out, 'metal', [a[0], y, a[2]], [b[0], y, b[2]], 0.12, 0.18, silver);
    }
  }
  // Set-back mechanical core and rooftop gantry are visible through the open lattice.
  loft(
    out,
    'concrete',
    [radialRing(roof, 6.5, 6.5, 64), radialRing(roof + 6.5, 6.5, 6.5, 64)],
    pale,
  );
  box(out, 'metal', [-5, roof + 6.5, -1], [5, roof + 7.8, 1], silver);
  for (const x of [-4, 4])
    beam(out, 'metal', [x, roof + 7.7, 0], [x, roof + 11, 0], 0.2, 0.25, silver);
  beam(out, 'metal', [-5, roof + 11, 0], [7, roof + 11, 0], 0.3, 0.35, silver);
}
function podiumPlan() {
  const result = [
    [34, -24],
    [34, 35],
    [23, 35],
  ];
  for (let k = 0; k <= 24; k++) {
    const a = Math.PI / 2 + ((k / 24) * Math.PI) / 2;
    result.push([20 + 43 * Math.cos(a), -7 + 42 * Math.sin(a)]);
  }
  result.push([-23, -24]);
  return clockwise(result);
}
function baseAndPodium(out) {
  const full = podiumPlan();
  mappedSolid(out, 'stone', full, 0, 0.18, [0.52, 0.53, 0.5]);
  // Tower lobby follows its own six-sided foot, independent of the neighboring parking wing.
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % 6];
    grid(out, [at(a, 0.18), at(b, 0.18), at(b, base), at(a, base)], blue, 2.1, 3.3, 0.09, silver);
    for (let k = 0; k <= 4; k++) {
      const p = [a[0] + ((b[0] - a[0]) * k) / 4, a[1] + ((b[1] - a[1]) * k) / 4];
      beam(out, 'metal', at(p, 0.18), at(p, base), 0.4, 0.5, silver);
    }
  }
  const podium = clockwise([
    [15, -24],
    [34, -24],
    [34, 35],
    [18, 35],
    [11, 31],
    [12, 19],
    [19, 10],
    [18, -10],
  ]);
  mappedCap(out, 'recess', podium, 0.18, dark, [], true);
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i],
      b = podium[(i + 1) % podium.length];
    grid(out, [at(a, 0.2), at(b, 0.2), at(b, 20.7), at(a, 20.7)], blue, 1.5, 3.4, 0.1, silver);
  }
  mappedSolid(out, 'stone', podium, 20.7, 21.1, pale);
  // Roof pool and planted terrace are confirmed by the owner; their fine plan is reconstructed.
  box(out, 'concrete', [22, 21.1, -16], [31, 21.5, 5], pale);
  box(out, 'glass', [22.5, 21.49, -15.5], [30.5, 21.53, 4.5], [0.1, 0.45, 0.58]);
  box(out, 'concrete', [23, 21.1, 8], [29, 21.45, 13], pale);
  box(out, 'glass', [23.4, 21.44, 8.4], [28.6, 21.48, 12.6], [0.17, 0.49, 0.6]);
  for (const z of [-20, 17, 27]) {
    box(out, 'stone', [30, 21.1, z - 1], [32.8, 21.8, z + 1], pale);
    for (let k = 0; k < 3; k++)
      sphere(out, 'foliage', [30.5 + k * 0.8, 22, z], [0.6, 0.5, 0.8], [0.18, 0.3, 0.12], 16, 8);
  }
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i],
      b = podium[(i + 1) % podium.length];
    if (a[0] < 16 && b[0] < 16) continue;
    face(
      out,
      'clear_glass',
      [at(a, 21.1), at(b, 21.1), at(b, 22.2), at(a, 22.2)],
      [0.65, 0.76, 0.78],
    );
    beam(out, 'metal', at(a, 22.2), at(b, 22.2), 0.05, 0.07, silver);
  }
  // Street retail arcade: canopy, glazing and actual supports around the curved own-site edge.
  for (let k = 1; k < 23; k++) {
    const a = Math.PI / 2 + ((k / 24) * Math.PI) / 2,
      b = Math.PI / 2 + (((k + 1) / 24) * Math.PI) / 2;
    const p = [20 + 41.2 * Math.cos(a), -7 + 40.2 * Math.sin(a)],
      q = [20 + 41.2 * Math.cos(b), -7 + 40.2 * Math.sin(b)];
    const inside = (v) => [20 + (v[0] - 20) * 0.91, -7 + (v[1] + 7) * 0.91];
    if (p[0] < -18 || q[0] < -18 || p[1] < 21 || q[1] < 21) continue;
    const r = inside(p),
      s = inside(q);
    mappedSolid(out, 'metal', clockwise([p, q, s, r]), 4.7, 5.0, silver);
    beam(out, 'metal', at(p, 0.18), at(p, 4.7), 0.2, 0.24, silver);
    grid(out, [at(r, 0.18), at(s, 0.18), at(s, 4.7), at(r, 4.7)], blue, 1.3, 3.6, 0.07, silver);
  }
  const portal = clockwise([
    [-19.7, -5],
    [-23, -5],
    [-23, 5],
    [-18.9, 5],
  ]);
  mappedSolid(out, 'metal', portal, 4.2, 4.55, silver);
  for (const z of [-5, 5])
    beam(out, 'metal', [-22.8, 0.18, z], [-22.8, 4.2, z], 0.15, 0.18, silver);
  grid(
    out,
    [
      [-22.7, 0.18, 5],
      [-22.7, 0.18, -5],
      [-22.7, 4.2, -5],
      [-22.7, 4.2, 5],
    ],
    blue,
    1.3,
    3.4,
    0.075,
    silver,
  );
  for (const z of [-5, 5])
    grid(
      out,
      [
        [-22.7, 0.18, z],
        [-18.8, 0.18, z],
        [-18.8, 4.2, z],
        [-22.7, 4.2, z],
      ],
      blue,
      1.3,
      3.4,
      0.075,
      silver,
    );
}
export function buildCayan(out) {
  baseAndPodium(out);
  facade(out);
  crown(out);
}
export const cayanStudy = {
  id: 'N0202',
  key: 'cayan_tower',
  title: 'Cayan Tower',
  wikidataId: 'Q391648',
  height: 306.4,
  build: buildCayan,
  embeddedCanonicalGraphs: ['metal_perforated_round_open'],
  brief:
    'SOM helical residential tower with a shallow chevron floorplate,90-degree clockwise twist,73 nominal residential levels and two upper mechanical courses, deeply recessed balconies,30–60% open round-metal shading screens, open steel crown, glazed six-level podium and rooftop pools.',
  sourceFacts: {
    architect: 'Skidmore, Owings & Merrill',
    heightMeters: 306.4,
    totalTwistDegrees: 90,
    ownerFloorCount: 73,
    architectFloorCount: 75,
    curtainPanelInches: [82, 124],
    screenOffsetMeters: 0.1016,
    screenOpenAreaRange: [0.3, 0.6],
    completionYear: 2013,
  },
  reconstruction: {
    plan: 'SOM typical hexagonal chevron and cylindrical-core drawing reproduced in Architect November2013 p185, with the exact mapped tower rectangle used as registration envelope. The primary site plan places an independent attached parking/retail podium on the northeast side; its metric outline is reconstructed from the printed scale.',
    facade:
      'SOM completed Tim Griffith photos and engineer interviews establish deep sills, staggered screens, recessed balcony bays and stepped floor slabs. Fine repeated bay schedules, intermediate datums, panel modules and roof equipment are exterior reconstruction.',
  },
  refs: [
    'https://www.som.com/projects/cayan-tower/',
    'https://www.som.com/news/soms-cayan-tower-opens/',
    'https://www.cayan.net/projects/cayantower/',
    'https://www.cayan.net/live/wp-content/uploads/2022/03/cayantower-floor-plans.pdf',
    'https://www.cayan.net/live/wp-content/uploads/2022/03/cayantower-brochure.pdf',
    'https://www.architectmagazine.com/design/buildings/cayan-tower-designed-by-skidmore-owings-merrill_o/',
    'https://www.usmodernist.org/AJ/A-2013-11.pdf',
    'https://www.skyscrapercenter.com/building/cayan-tower/464',
    'https://www.openstreetmap.org/way/195527255',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X northeast toward attached parking podium',
    shortAxis: '+Z southeast; clockwise shaft twist viewed from above',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact mapped tower center and signed rectangle are retained. The primary site north arrow points upper-right: page-right/northeast is the attached podium. GroundY0 is the public entrance apron; the rectangle is a registration envelope and the detailed chevron and podium are primary-plan reconstruction.',
  }),
  limitations: [
    commonLimit,
    'Intermediate floor elevations and bay schedules, chevron kink depth, crown equipment, ground door offsets and landscaped podium pool dimensions are exterior reconstruction. Source73/75-storey counts differ and are retained. Round9mm holes/12mm pitch are a reusable44% open pattern within the architect30–60% range, not a measured screen fabrication schedule. Neighboring towers, bridge, promenades beyond the own-site arcade and interiors are excluded.',
  ],
  camera: { position: [-315, 195, 330], lookAt: [0, 151, 0], fov: 42 },
  qaCameras: [
    { name: 'clockwise-helix', position: [360, 240, -415], lookAt: [0, 147, 0] },
    { name: 'chevron-facade', position: [-83, 129, 47], lookAt: [-17, 122, 0] },
    { name: 'recessed-balconies', position: [-58, 69, 41], lookAt: [-18, 61, 6] },
    { name: 'perforated-sunshades', position: [-23.6, 39.0, 6.9], lookAt: [-20.55, 39.0, 6.2] },
    { name: 'deep-sill-step', position: [25, 151, 48], lookAt: [11, 150, 23] },
    { name: 'open-crown', position: [58, 310, 48], lookAt: [0, 299, 0] },
    { name: 'roof-gantry', position: [34, 326, -40], lookAt: [0, 291, 0] },
    { name: 'podium-pools', position: [72, 52, 20], lookAt: [25, 21, 0] },
    { name: 'retail-arcade', position: [-3, 12, 78], lookAt: [4, 4, 30] },
    { name: 'ground-entry', position: [-59, 11, 4], lookAt: [-21, 3, 0] },
    { name: 'far-twisted-silhouette', position: [-630, 245, 610], lookAt: [0, 148, 0] },
  ],
};
