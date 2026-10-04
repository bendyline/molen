/** Original China World Tower A exterior, with surveyed facts separate from reconstruction. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const silver = [0.72, 0.74, 0.72],
  pale = [0.82, 0.84, 0.8];
const glass = [0.25, 0.36, 0.4],
  dark = [0.1, 0.14, 0.16];
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

// Dimensions between the mapped base and photographed crown are working reconstructions.
const sections = [
  [0, 28.65, 25.8],
  [24, 28.65, 25.8],
  [130, 26.3, 23.5],
  [247, 23.8, 21.1],
  [294, 22.3, 19.65],
  [330, 21.1, 18.5],
];
function section(y) {
  let i = 1;
  while (i < sections.length - 1 && y > sections[i][0]) i++;
  const a = sections[i - 1],
    b = sections[i],
    t = (y - a[0]) / (b[0] - a[0]);
  return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}
function plan(y) {
  const [a, b] = section(y),
    c = 2.1;
  return [
    [-a + c, y, -b],
    [a - c, y, -b],
    [a, y, -b + c],
    [a, y, b - c],
    [a - c, y, b],
    [-a + c, y, b],
    [-a, y, b - c],
    [-a, y, -b + c],
  ];
}
const floors = [
  0.1,
  6,
  12,
  18,
  24,
  ...Array.from({ length: 70 }, (_, i) => 24 + ((i + 1) * 270) / 70),
];
const serviceBands = [
  [122.6, 134.9],
  [238.8, 251.3],
];
const serviceAt = (y) => serviceBands.some(([lo, hi]) => y >= lo && y < hi);

function glassPanel(o, a, b, c, d, { clear = false, color = glass, frame = 0.055 } = {}) {
  face(o, clear ? 'clear_glass' : 'glass', [b, a, d, c], color);
  beam(o, 'metal', a, b, frame, frame, silver);
  beam(o, 'metal', a, d, frame, frame, silver);
  beam(o, 'metal', d, c, frame, frame, silver);
}
function slab(o, y, t, color = pale, slot = 'concrete') {
  const ring = plan(y).reverse();
  loft(o, slot, [ring, ring.map(([x, yy, z]) => [x, yy + t, z])], color);
}

function wall(o, short = false) {
  const dimensions = (y) => {
    const [a, b] = section(y);
    return short ? [b, a] : [a, b];
  };
  const point = (u, y, depth = 0) => {
    const [a, b] = dimensions(y);
    return [u * (a - 2.1), y, -b - depth];
  };
  const bays = short ? 32 : 36;
  for (let j = 4; j < floors.length - 1; j++) {
    const y = floors[j],
      yy = floors[j + 1];
    const d = j % 2 ? 0.23 : -0.13,
      dd = j % 2 ? -0.13 : 0.23;
    const service = serviceAt((y + yy) / 2);
    for (let i = 0; i < bays; i++) {
      const u = -1 + (2 * i) / bays,
        v = -1 + (2 * (i + 1)) / bays;
      const a = point(u, y, d),
        b = point(v, y, d),
        c = point(v, yy, dd),
        e = point(u, yy, dd);
      const h = yy - y;
      const aa = mix(a, e, 0.08),
        bb = mix(b, c, 0.08);
      const tint = (i + j) % 7 === 0 ? 0.92 : 1;
      glassPanel(o, aa, bb, c, e, { color: glass.map((v) => v * tint) });
      face(o, 'glass', [b, a, aa, bb], [0.34, 0.39, 0.4]);
      // A full-height glass fin projects 600 mm from the undulating glazed plane.
      const p = a.map((v, k) => v - (k === 2 ? 0.6 : 0)),
        q = e.map((v, k) => v - (k === 2 ? 0.6 : 0));
      face(o, 'clear_glass', [a, p, q, e], [0.77, 0.8, 0.77]);
      beam(o, 'stainless', p, q, 0.026, 0.035, silver);
      for (const t of [0.13, 0.87]) {
        const a0 = mix(a, e, t),
          b0 = mix(p, q, t);
        beam(o, 'stainless', a0, b0, 0.05, 0.05, silver);
      }
      if (service) {
        // Service zones retain outer fins; fine dark louvres sit behind them.
        for (let yy0 = y + 0.32; yy0 < yy - 0.2; yy0 += 0.29) {
          const t = (yy0 - y) / h,
            r = mix(a, e, t),
            s = mix(b, c, t);
          beam(o, 'metal', r, s, 0.075, 0.16, [0.32, 0.36, 0.37]);
        }
      }
    }
    beam(o, 'metal', point(-1, y, d + 0.05), point(1, y, d + 0.05), 0.085, 0.11, silver);
  }
  // Transparent double-height lobby behind the base's large diamond-shaped shading fins.
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < bays; i++) {
      const u = -1 + (2 * i) / bays,
        v = -1 + (2 * (i + 1)) / bays;
      glassPanel(
        o,
        point(u, floors[j]),
        point(v, floors[j]),
        point(v, floors[j + 1]),
        point(u, floors[j + 1]),
        { clear: true, color: [0.5, 0.55, 0.54], frame: 0.08 },
      );
    }
  for (let i = 0; i < bays; i += 2) {
    const u = -1 + (2 * i) / bays,
      v = -1 + (2 * (i + 2)) / bays,
      m = (u + v) / 2;
    const a = point(m, 0.18, 0.15),
      b = point(v, 12, 1.7),
      c = point(m, 23.95, 0.15),
      d = point(u, 12, 1.7);
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      beam(o, 'metal', p, q, 0.23, 0.18, pale);
    const inner = point(m, 12, 0.05);
    for (const p of [b, d]) {
      face(o, 'clear_glass', [a, p, c, inner], [0.79, 0.81, 0.78]);
      beam(o, 'stainless', inner, p, 0.075, 0.075, silver);
    }
  }
  // Broad top screen with individual blade supports and cross-braced openings.
  const crownBays = short ? 12 : 14;
  for (let i = 0; i < crownBays; i++) {
    const u = -1 + (2 * i) / crownBays,
      v = -1 + (2 * (i + 1)) / crownBays;
    const a = point(u, 294, 0.36),
      b = point(u, 329.8, 0.36);
    beam(o, 'metal', a, b, 0.23, 0.52, pale);
    const aa = point(u, 294, 1.35),
      bb = point(u, 330, 1.35);
    face(o, 'clear_glass', [a, aa, bb, b], [0.79, 0.82, 0.78]);
    beam(o, 'stainless', aa, bb, 0.028, 0.04, silver);
    for (const y of [294.5, 303, 311.5, 320]) {
      const yy = y + 8.3;
      const p = point(u, y, -0.45),
        q = point(v, y, -0.45),
        r = point(v, yy, -0.45),
        s = point(u, yy, -0.45);
      beam(o, 'metal', p, q, 0.18, 0.25, pale);
      beam(o, 'metal', p, r, 0.12, 0.12, silver);
      beam(o, 'metal', q, s, 0.12, 0.12, silver);
      glassPanel(o, p, q, r, s, { clear: true, color: [0.48, 0.55, 0.55], frame: 0.045 });
    }
  }
  beam(o, 'metal', point(1, 294, 0.36), point(1, 329.8, 0.36), 0.23, 0.52, pale);
  for (const u of [-1, 1]) beam(o, 'metal', point(u, 0.16), point(u, 24), 0.13, 0.25, silver);
}

const parts = [
  {
    name: 'east-west-undulating-curtain-walls',
    gpuInstances: true,
    instances: [{ angle: 0 }, { angle: Math.PI }],
    build: (o) => wall(o),
  },
  {
    name: 'north-south-undulating-curtain-walls',
    gpuInstances: true,
    instances: [{ angle: Math.PI / 2 }, { angle: (3 * Math.PI) / 2 }],
    build: (o) => wall(o, true),
  },
];
parts.push({
  name: 'recessed-corners-and-floor-plates',
  instances: [{}],
  build(o) {
    for (let j = 0; j < floors.length - 1; j++) {
      const y = floors[j],
        yy = floors[j + 1],
        shifted = (p, index) => {
          const depth = index < 4 ? 0 : index % 2 ? 0.23 : -0.13;
          const [a, b] = section(p[1]);
          return p.map((v, axis) =>
            axis === 0 && Math.abs(Math.abs(v) - a) < 0.001
              ? v + Math.sign(v) * depth
              : axis === 2 && Math.abs(Math.abs(v) - b) < 0.001
                ? v + Math.sign(v) * depth
                : v,
          );
        },
        lower = plan(y).map((p) => shifted(p, j)),
        upper = plan(yy).map((p) => shifted(p, j + 1));
      for (const i of [1, 3, 5, 7]) {
        const k = (i + 1) % 8,
          a = lower[i],
          b = lower[k],
          c = upper[k],
          d = upper[i];
        const n = normalFor(b, a, d),
          inset = (p) => p.map((v, i) => v - n[i] * 0.4);
        glassPanel(o, inset(a), inset(b), inset(c), inset(d), {
          color: [0.22, 0.32, 0.35],
          clear: y < 24,
        });
        // Close each return between the undulating main wall and recessed corner glass.
        for (const points of [
          [a, inset(a), inset(d), d],
          [inset(b), b, c, inset(c)],
        ]) {
          const normal = normalFor(...points),
            center = points.reduce((s, p) => s.map((v, k) => v + p[k] / 4), [0, 0, 0]);
          face(
            o,
            'glass',
            normal[0] * center[0] + normal[2] * center[2] < 0 ? [...points].reverse() : points,
            dark,
          );
        }
        beam(o, 'stainless', a, d, 0.1, 0.12, silver);
        beam(o, 'stainless', b, c, 0.1, 0.12, silver);
      }
    }
    for (const y of [0, 6, 12, 18, 24, 122.6, 134.9, 238.8, 251.3, 294]) slab(o, y, 0.15);
    // Roof plant and helipad are original, schematic equipment rather than claimed construction drawings.
    box(o, 'recess', [-13, 294.2, -11], [13, 323, 11], [0.29, 0.32, 0.31]);
    box(o, 'metal', [-13.2, 323, -11.2], [13.2, 323.3, 11.2], silver);
    for (const x of [-9, -3, 3, 9]) {
      box(o, 'metal', [x - 2, 323.3, -6], [x + 2, 325, 6], [0.5, 0.53, 0.51]);
      for (let z = -5; z <= 5; z += 1)
        box(o, 'recess', [x - 1.6, 325.01, z - 0.27], [x + 1.6, 325.08, z + 0.27], dark);
    }
    box(o, 'concrete', [-14, 327, -14], [14, 327.22, 14], [0.5, 0.52, 0.49]);
    const ring = Array.from({ length: 65 }, (_, i) => [
      12 * Math.cos((i * Math.PI) / 32),
      327.235,
      12 * Math.sin((i * Math.PI) / 32),
    ]);
    for (let i = 1; i < ring.length; i++)
      beam(o, 'metal', ring[i - 1], ring[i], 0.16, 0.014, [0.86, 0.84, 0.69]);
    for (const x of [-2.2, 2.2])
      box(o, 'metal', [x - 0.16, 327.23, -3.5], [x + 0.16, 327.245, 3.5], [0.88, 0.86, 0.71]);
    box(o, 'metal', [-2.2, 327.23, -0.16], [2.2, 327.245, 0.16], [0.88, 0.86, 0.71]);
    box(o, 'stone', [-9, 0, -8], [9, 12, 8], [0.53, 0.48, 0.4]);
    for (const x of [-20, -10, 10, 20])
      for (const z of [-18, 18])
        box(o, 'metal', [x - 0.36, 0, z - 0.36], [x + 0.36, 11.9, z + 0.36], pale);
  },
});

function entrance(o, { hotel }) {
  const wall = -25.8,
    span = hotel ? 22.4 : 19.3,
    front = wall - (hotel ? 12.3 : 7.2),
    y = 9.2;
  // The deep canopy includes glass panels, steel ribs, edge fascia and suspension rods.
  const bays = hotel ? 16 : 14;
  for (let i = 0; i < bays; i++) {
    const x = -span + (i * 2 * span) / bays,
      xx = -span + ((i + 1) * 2 * span) / bays;
    for (let j = 0; j < 5; j++) {
      const z = wall + ((front - wall) * j) / 5,
        zz = wall + ((front - wall) * (j + 1)) / 5;
      face(
        o,
        'clear_glass',
        [
          [x, y, z],
          [xx, y, z],
          [xx, y, zz],
          [x, y, zz],
        ],
        [0.67, 0.73, 0.7],
      );
      beam(o, 'stainless', [x, y - 0.1, z], [xx, y - 0.1, z], 0.05, 0.12, silver);
      box(o, 'metal', [x - 0.045, y - 0.22, zz - 0.1], [x + 0.045, y - 0.12, zz + 0.1], silver);
    }
    beam(o, 'metal', [x, y - 0.2, wall], [x, y - 0.2, front], 0.15, 0.38, silver);
    tube(o, 'stainless', [x, 14.9, wall], [x, y + 0.1, front + 0.5], 0.032, silver, 8);
  }
  beam(o, 'metal', [-span, y - 0.12, front], [span, y - 0.12, front], 0.48, 0.42, silver);
  for (const x of [-span, span])
    beam(o, 'metal', [x, y - 0.16, wall], [x, y - 0.16, front], 0.26, 0.4, silver);
  // Two curved glass vestibules beneath each canopy.
  for (const x of [-9, 9]) {
    const z = wall - 1.5,
      r = 2.2;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12;
      const p = [x + r * Math.cos(a), 0.1, z + r * Math.sin(a)],
        q = [x + r * Math.cos(b), 0.1, z + r * Math.sin(b)];
      glassPanel(o, p, q, [q[0], 5.2, q[2]], [p[0], 5.2, p[2]], {
        clear: true,
        color: [0.52, 0.56, 0.54],
        frame: 0.035,
      });
      if (i % 3 === 0) tube(o, 'stainless', p, [p[0], 5.1, p[2]], 0.03, silver, 8);
      beam(o, 'stainless', [p[0], 5.2, p[2]], [q[0], 5.2, q[2]], 0.21, 0.22, silver);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      face(
        o,
        'clear_glass',
        [
          [x, 0.1, z],
          [x + r * Math.cos(a), 0.1, z + r * Math.sin(a)],
          [x + r * Math.cos(a), 3.1, z + r * Math.sin(a)],
          [x, 3.1, z],
        ],
        [0.52, 0.56, 0.54],
      );
    }
    tube(o, 'stainless', [x, 0.1, z], [x, 3.2, z], 0.06, silver, 12);
  }
  box(o, 'stone', [-span - 0.5, 0, front - 0.8], [span + 0.5, 0.08, wall], [0.53, 0.54, 0.5]);
}
parts.push({
  name: 'east-hotel-entrance',
  instances: [{}],
  build: (o) => entrance(o, { hotel: true }),
});
parts.push({
  name: 'west-office-entrance',
  instances: [{ angle: Math.PI }],
  build: (o) => entrance(o, { hotel: false }),
});

/** A small first download retaining taper, corner recesses, canopy and an open crown. */
export function buildChinaWorldSkyline(o) {
  loft(
    o,
    'glass',
    [0, 24, 130, 247, 294].map((y) => plan(y).reverse()),
    glass,
  );
  for (let side = 0; side < 4; side++) {
    const out = rotated(o, (side * Math.PI) / 2),
      short = side % 2 === 1;
    const p = (u, y) => {
      const [a, b] = section(y);
      return short ? [u * (b - 2.1), y, -a] : [u * (a - 2.1), y, -b];
    };
    for (const u of [-1, -0.5, 0, 0.5, 1])
      beam(out, 'metal', p(u, 294), p(u, 329.8), 0.35, 0.35, pale);
    for (const y of [294, 310, 329.6]) beam(out, 'metal', p(-1, y), p(1, y), 0.25, 0.25, pale);
  }
  box(o, 'metal', [-13, 295, -11], [13, 327.2, 11], [0.43, 0.49, 0.49]);
  box(o, 'metal', [-22.4, 9, -38.1], [22.4, 9.4, -25.8], silver);
  box(o, 'metal', [-19.3, 9, 25.8], [19.3, 9.4, 33], silver);
}

export const chinaWorldTowerStudy = {
  id: 'N0233',
  key: 'china_world_trade_center_tower_iii',
  title: 'China World Trade Center Tower III',
  wikidataId: 'Q2006129',
  build(out) {
    for (const p of parts)
      for (const instance of p.instances) p.build(rotated(out, instance.angle ?? 0));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original China World Tower A modular exterior',
    );
  },
  brief:
    'Tapered rectangular tower with recessed glazed corners, alternating-floor curtain-wall slopes, 600 mm external glass fins, service louvre belts, diamond-pattern lobby fins, tall cross-braced crown, rooftop helipad, east hotel and west office canopies and curved glass vestibules.',
  sourceFacts: {
    architecturalHeightMeters: 330,
    architectProjectStories: 74,
    openingReleaseStoryLabels: 81,
    facadeConsultantAboveGroundFloors: 80,
    externalGlassFinProjectionMeters: 0.6,
    facadeBehavior:
      'Curtain wall undulates on alternating floors; full-height external glass fins.',
    hotelLevelLabels: [64, 80],
    entryDirections: { office: 'west', hotel: 'east' },
  },
  reconstruction: {
    sectionEnvelope: sections,
    sectionMeaning: 'height, half-length, half-width; footprint-scaled photographic reconstruction',
    facadeFloors: floors,
    serviceBands,
    crownBaseMeters: 294,
    roofEquipment: 'Schematic plant, supports and helipad inside the crown',
    basis:
      'SOM exterior/base/corner photos and Meinhardt facade brochure pages 10–11. Taper dimensions, bay counts, intermediate heights, crown braces, entrance widths and roof equipment are inferred, not surveyed.',
  },
  refs: [
    'https://www.som.com/projects/china-world-trade-center-3a/',
    'https://www.som.com/news/som-celebrates-grand-opening-of-china-world-trade-tower/',
    'https://www.mfacade.com/wp-content/uploads/2013/07/Art_Wrok_14Oct.pdf',
    'https://www.wongtung.com/en/projects/china-world-tower-a/',
    'https://www.wongtung.com/en/projects/china-world-summit-wing/',
    'https://www.aiahk.org/portfolio-item/china-world-trade-center-beijing/',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X toward north with the cached signed frame',
    front: '-Z toward east hotel entrance',
    origin: 'Tower footprint center at pavement datum',
  },
  geographic: () => ({
    notes:
      'Exact Q2006129 map identity supplies the 58.465 by 52.803 m tower frame. Cached heading near -pi/2 maps native -Z to east, matching SOM hotel entry; opposite +Z faces west office entry. This cardinal facing is supported, but entrance extents, real terrain and neighboring site boundaries require visual review.',
  }),
  limitations: [
    'Geographic fit and maximum exterior fidelity remain pending. Cardinal entrance sides are documented; exact facade yaw, ground contact and canopy extent need real-site review.',
    'Published floor totals conflict (74, 80, 81); the model does not claim a surveyed floor schedule. Intermediate floor divisions, taper, crown base and service belts are reconstructions.',
    'Crown braces, helipad, roof plant, revolving vestibules, canopy structure and lobby details follow visible forms but lack construction drawings.',
    'The large adjoining shopping mall, ballroom annex, skywalks, landscaped water courts and neighboring Tower B are separate structures and remain outside this individual tower asset.',
    'Fins use transparent local PBR with modeled metal edges; their exact frit pattern and programmable night lighting remain unauthored. No reference photography or third-party mesh is embedded.',
  ],
  camera: { position: [-300, 190, -400], lookAt: [0, 161, 0], fov: 39 },
  qaCameras: [
    { name: 'alternating-curtain-wall', position: [-10, 66, -32], lookAt: [-7, 66, -24] },
    { name: 'glass-fin-brackets', position: [5, 43, -29], lookAt: [3.5, 43, -25.7] },
    { name: 'recessed-corner', position: [-37, 106, -36], lookAt: [-26, 106, -23] },
    { name: 'service-belt', position: [-9, 128, -36], lookAt: [0, 128, -23.5] },
    { name: 'base-diamonds', position: [-12, 12, -40], lookAt: [-14, 12, -25.8] },
    { name: 'hotel-canopy', position: [-37, 12, -51], lookAt: [0, 7, -31] },
    { name: 'hotel-vestibule', position: [-12, 3, -33], lookAt: [-9, 2.5, -27.3] },
    { name: 'office-entrance', position: [35, 11, 46], lookAt: [0, 7, 28] },
    { name: 'crown-lattice', position: [-54, 325, -56], lookAt: [0, 314, 0] },
    { name: 'roof-helipad', position: [0, 380, 0.1], lookAt: [0, 323, 0] },
    { name: 'far-silhouette', position: [-700, 300, -810], lookAt: [0, 160, 0] },
  ],
};
