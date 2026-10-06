/** Millennium Tower, Vienna: original reconstruction from primary references and OSM plan. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, tube as meshTube, quad } from './structure-mesh.mjs';

function tube(out, slot, a, b, radius, color, sides = 6) {
  meshTube(out, slot, a, b, radius, color, out.detail === 'street' ? Math.min(sides, 6) : sides);
}

const silver = [0.67, 0.72, 0.75];
const glass = [0.27, 0.42, 0.49];
const spandrel = [0.39, 0.49, 0.53];
const dark = [0.22, 0.27, 0.3];
const floorHeight = 3.25;
const bodyBottom = 7.25;
// Least-squares circle fits to the two exposed arcs of OSM way/105310525.
// Coordinates stay in its signed local frame; no scaling to a generic tower template.
const circles = [
  { x: 6.929062122565541, z: -3.0088255330872755, r: 14.561976003512664 },
  { x: -6.963934100335889, z: -3.2039184928407964, r: 14.44876302388983 },
];
function frontIntersection(circles) {
  const dx = circles[1].x - circles[0].x,
    dz = circles[1].z - circles[0].z;
  const distance = Math.hypot(dx, dz);
  const along = (circles[0].r ** 2 - circles[1].r ** 2 + distance ** 2) / (2 * distance);
  const across = Math.sqrt(circles[0].r ** 2 - along ** 2);
  return [
    circles[0].x + (along * dx - across * dz) / distance,
    circles[0].z + (along * dz + across * dx) / distance,
  ];
}
const intersection = frontIntersection(circles);
const point = (c, a, y, offset = 0) => [
  c.x + (c.r + offset) * Math.cos(a),
  y,
  c.z + (c.r + offset) * Math.sin(a),
];
function exposedArcs(circles) {
  const intersection = frontIntersection(circles);
  return [
    {
      ...circles[0],
      start: Math.atan2(intersection[1] - circles[0].z, intersection[0] - circles[0].x),
      end: Math.acos((5.6 - circles[0].x) / circles[0].r),
    },
    {
      ...circles[1],
      start: Math.acos((-5.3 - circles[1].x) / circles[1].r),
      end: 2 * Math.PI + Math.atan2(intersection[1] - circles[1].z, intersection[0] - circles[1].x),
    },
  ];
}
const arcs = exposedArcs(circles);
const hoodArcs = exposedArcs(circles.map((c) => ({ ...c, r: c.r - 1.8 })));
const face = (o, slot, points, color) => quad(o, slot, points, normalFor(...points), color);
function shifted(out, translation = [0, 0, 0]) {
  return {
    detail: out.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
        name,
        (slot, ref, points, normal, uv, color) =>
          out[name](
            slot,
            ref,
            points.map((p) => p.map((v, i) => v + translation[i])),
            normal,
            uv,
            color,
          ),
      ]),
    ),
  };
}
function arcPoints(arc, y, offset = 0, pitch = 1.4) {
  const count = Math.ceil(((arc.end - arc.start) * arc.r) / pitch);
  return Array.from({ length: count + 1 }, (_, i) =>
    point(arc, arc.start + ((arc.end - arc.start) * i) / count, y, offset),
  );
}
function outline(y, curved = arcs, pitch = 1.4) {
  return [
    ...arcPoints(curved[0], y, 0, pitch),
    [5.6, y, 17.48],
    [-5.3, y, 17.32],
    ...arcPoints(curved[1], y, 0, pitch),
  ];
}
function deck(o, y, color = dark, curved = arcs, pitch = 1.4) {
  const p = outline(y, curved, pitch);
  // This non-convex outline is star-shaped about the central lift core.
  for (let i = 0; i < p.length - 1; i++) {
    const t = [[0, y, 0], p[i + 1], p[i]];
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      t,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}
function panel(o, a, b, y0, y1, color = glass, detailed = true) {
  const aa = [a[0], y0, a[2]],
    bb = [b[0], y0, b[2]],
    cc = [b[0], y1, b[2]],
    dd = [a[0], y1, a[2]];
  face(o, 'glass', [bb, aa, dd, cc], color);
  if (!detailed) return;
  const n = normalFor(bb, aa, dd);
  const lifted = (p) => p.map((v, i) => v + n[i] * 0.07);
  if (o.detail) {
    if (o.detail === 'district') return;
    if (o.detail === 'street' && y1 - y0 <= 1.12) return;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const along = (p) => [
      p[0] + ((b[0] - a[0]) * 0.06) / length,
      p[1],
      p[2] + ((b[2] - a[2]) * 0.06) / length,
    ];
    face(o, 'metal', [along(aa), aa, dd, along(dd)].map(lifted), silver);
    if (o.detail === 'street') return;
    face(
      o,
      'metal',
      [[cc[0], cc[1] - 0.045, cc[2]], [dd[0], dd[1] - 0.045, dd[2]], dd, cc].map(lifted),
      silver,
    );
    return;
  }
  beam(o, 'metal', lifted(aa), lifted(dd), 0.06, 0.095, silver);
  beam(o, 'metal', lifted(dd), lifted(cc), 0.045, 0.085, silver);
}
function curvedFloor(o) {
  for (const arc of arcs) {
    const p = arcPoints(
      arc,
      0,
      0,
      o.detail === 'district' ? 4.2 : o.detail === 'street' ? 5.6 : 1.4,
    );
    for (let i = 1; i < p.length; i++) {
      panel(o, p[i - 1], p[i], 0, 0.78, spandrel);
      panel(
        o,
        p[i - 1],
        p[i],
        0.78,
        floorHeight,
        glass.map((v) => v * (0.985 + (i % 3) * 0.0075)),
      );
      // Narrow projecting nose on the floor transom; distinct from the glass spandrel.
      const a = [...p[i - 1]],
        b = [...p[i]];
      a[1] = 0.79;
      b[1] = 0.79;
      if (!o.detail) beam(o, 'metal', a, b, 0.065, 0.13, silver);
    }
  }
  // Precisely emphasized concave front seam observed in the architect's close photographs.
  box(
    o,
    'metal',
    [intersection[0] - 0.07, 0, intersection[1] - 0.08],
    [intersection[0] + 0.07, floorHeight, intersection[1] + 0.08],
    silver,
  );
}
function spineFloor(o) {
  const right = point(arcs[0], arcs[0].end, 0),
    left = point(arcs[1], arcs[1].start, 0);
  const path = [right, [5.6, 0, 17.48], [-5.3, 0, 17.32], left];
  for (let side = 1; side < path.length; side++) {
    const a = path[side - 1],
      b = path[side];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.4);
    for (let j = 0; j < count; j++) {
      const p = (t) => a.map((v, k) => v + (b[k] - v) * t);
      const aa = p(j / count),
        bb = p((j + 1) / count);
      panel(o, aa, bb, 0, 1.12, dark);
      panel(o, aa, bb, 1.12, floorHeight, side === 2 ? glass : [0.33, 0.42, 0.47]);
    }
  }
  for (const x of [-5.31, 5.61])
    box(o, 'metal', [x - 0.18, 0, 11.0], [x + 0.18, floorHeight, 17.49], dark);
}
function base(o) {
  // Tower-only pavement edge; adjoining mall, housing and footbridge are independent structures.
  deck(o, 0, [0.55, 0.57, 0.57]);
  for (const arc of arcs) {
    const p = arcPoints(arc, 0);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1].map((v, k) => (k === 1 ? v : v * 0.96));
      const b = p[i].map((v, k) => (k === 1 ? v : v * 0.96));
      for (const [lo, hi] of [
        [0.2, 3.5],
        [3.5, bodyBottom],
      ])
        panel(o, a, b, lo, hi, [0.21, 0.32, 0.37]);
      if (i % 5 === 1) {
        const mid = a.map((v, k) => (v + b[k]) / 2);
        tube(o, 'stainless', [mid[0], 0, mid[2]], [mid[0], bodyBottom, mid[2]], 0.24, silver, 20);
        tube(o, 'stainless', [mid[0], 0.06, mid[2]], [mid[0], 0.15, mid[2]], 0.4, silver, 20);
      }
    }
  }
  box(o, 'metal', [-5.3, 0, 11], [5.6, bodyBottom, 17.32], dark);
  // Recessed entrance into the tower core and double doors, not the separate plaza roof.
  box(o, 'recess', [-2.9, 0.05, -14.5], [2.9, 3.9, -12], [0.13, 0.17, 0.19]);
  for (const x of [-1.45, 1.45]) {
    box(o, 'glass', [x - 1.36, 0.12, -14.57], [x + 1.36, 3.6, -14.52], glass);
    for (const xx of [x - 1.35, x, x + 1.35])
      beam(o, 'stainless', [xx, 0.1, -14.64], [xx, 3.65, -14.64], 0.07, 0.08, silver);
    for (const xx of [x - 0.2, x + 0.2])
      tube(o, 'stainless', [xx, 1.0, -14.75], [xx, 1.9, -14.75], 0.018, silver, 8);
  }
  deck(o, bodyBottom);
}
function crown(o) {
  deck(o, 140.5);
  // Reconstructed concentric glass hood; main cylinder height follows the cached map tag.
  for (const c of hoodArcs) {
    // Only exposed outer arcs: no hidden intersecting cylinder walls inside the service core.
    const { start, end } = c;
    const count = o.detail === 'district' ? 16 : o.detail === 'street' ? 24 : 52;
    for (let i = 0; i < count; i++) {
      const a = start + ((end - start) * i) / count,
        b = start + ((end - start) * (i + 1)) / count;
      for (const [y0, y1] of [
        [140.5, 143.8],
        [143.8, 147.1],
        [147.1, 150.4],
      ])
        panel(o, point(c, a, 0), point(c, b, 0), y0, y1, glass);
      // Hood's solar screen has separate horizontal fins and radial brackets.
      for (
        let y = 150.6;
        y <= 153.0;
        y += o.detail === 'district' || o.detail === 'street' ? 0.8 : 0.3
      ) {
        const p = [
          point(c, b, y + 0.08, 0.16),
          point(c, a, y + 0.08, 0.16),
          point(c, a, y, -0.14),
          point(c, b, y, -0.14),
        ];
        face(o, 'metal', p, silver);
        face(o, 'metal', [...p].reverse(), silver);
      }
      if (i % 2 === 0) beam(o, 'metal', point(c, a, 150.4), point(c, a, 153.4), 0.06, 0.08, silver);
    }
  }
  deck(o, 150.4, dark, hoodArcs);
  // Taller service spine and oblique glass canopy rising toward the rear mast support.
  box(o, 'metal', [-5.3, 140.5, 11.1], [5.6, 172, 17.32], dark);
  const heightAt = (z) => 153.4 + (z + 1) * (18.6 / 18.32);
  for (const x of [-5.31, 5.61]) {
    for (let z = -1; z < 17.32; z += 1.4) {
      const zz = Math.min(z + 1.4, 17.32);
      const p = [
        [x, 140.5, z],
        [x, 140.5, zz],
        [x, heightAt(zz), zz],
        [x, heightAt(z), z],
      ];
      face(o, 'glass', x < 0 ? p : [...p].reverse(), glass);
      beam(o, 'metal', [x, 140.5, z], [x, heightAt(z), z], 0.075, 0.13, silver);
    }
  }
  for (let z = -1; z < 17.32; z += 1.4) {
    const zz = Math.min(17.32, z + 1.4);
    for (let x = -5.3; x < 5.6; x += 1.4) {
      const xx = Math.min(5.6, x + 1.4);
      face(
        o,
        'glass',
        [
          [x, heightAt(z), z],
          [x, heightAt(zz), zz],
          [xx, heightAt(zz), zz],
          [xx, heightAt(z), z],
        ],
        glass,
      );
    }
    beam(o, 'metal', [-5.38, heightAt(z), z], [5.68, heightAt(z), z], 0.12, 0.18, silver);
  }
  for (const x of [-5.3, -3.9, -2.5, -1.1, 0.3, 1.7, 3.1, 4.5, 5.6])
    beam(o, 'metal', [x, 153.4, -1], [x, 172, 17.32], 0.1, 0.18, silver);
  // Back elevation continues its visible grid above the cylindrical office floors.
  for (let y = 140.5; y < 171.9; y += floorHeight) {
    const hi = Math.min(y + floorHeight, 172);
    for (let x = -4.8; x < 4.8; x += 1.38) {
      const xx = Math.min(x + 1.38, 5.1);
      panel(o, [xx, 0, 17.34], [x, 0, 17.34], y + 0.12, Math.min(y + 1.12, hi), dark);
      if (hi > y + 1.12) panel(o, [xx, 0, 17.34], [x, 0, 17.34], y + 1.12, hi, glass);
    }
  }
  // Paired aerial masts and open bracing, matching the architect's side photograph.
  for (const x of [-3.1, 3.1]) {
    for (const [lo, hi, r] of [
      [172, 182, 0.25],
      [182, 192, 0.18],
      [192, 202, 0.11],
    ])
      tube(o, 'stainless', [x, lo, 16.1], [x, hi, 16.1], r, silver, 16);
    box(o, 'metal', [x - 0.5, 171.5, 15.6], [x + 0.5, 172.25, 16.6], dark);
  }
  for (const y of [173, 178, 183]) {
    tube(o, 'stainless', [-3.1, y, 16.1], [3.1, y, 16.1], 0.095, silver, 10);
    tube(o, 'stainless', [-3.1, y, 16.1], [3.1, y + 5, 16.1], 0.075, silver, 10);
  }
  for (const x of [-3.1, 3.1])
    tube(o, 'metal', [x, 184, 16.1], [x, 184.4, 16.1], 0.27, [0.58, 0.11, 0.08], 12);
}
const parts = [
  { name: 'tower-entry-and-columns', build: base, instances: [{}] },
  {
    name: 'twin-cylinder-floor',
    build: curvedFloor,
    gpuInstances: true,
    instances: Array.from({ length: 41 }, (_, i) => ({
      translation: [0, bodyBottom + i * floorHeight, 0],
    })),
  },
  {
    name: 'rear-spine-floor',
    build: spineFloor,
    gpuInstances: true,
    instances: Array.from({ length: 41 }, (_, i) => ({
      translation: [0, bodyBottom + i * floorHeight, 0],
    })),
  },
  { name: 'stepped-hood-sloping-roof-and-masts', build: crown, instances: [{}] },
];

export function buildMillenniumRuntime(out, detail) {
  if (detail === 'district') {
    buildMillenniumSkyline(out);
    // Readable floor rhythm at distance, without thousands of subpixel mullion faces.
    for (let floor = 0; floor < 41; floor++) {
      const y = bodyBottom + floor * floorHeight;
      for (const arc of arcs) {
        // Match the underlying skyline facets so the overlay never falls behind a chord.
        const p = arcPoints(arc, 0, 0.035, 4);
        for (let i = 1; i < p.length; i++) panel(out, p[i - 1], p[i], y, y + 0.78, spandrel, false);
      }
      panel(out, [5.6, 0, 17.5], [-5.3, 0, 17.34], y, y + 1.12, spandrel, false);
    }
    return;
  }
  for (const p of parts)
    for (const instance of p.instances) p.build(shifted({ ...out, detail }, instance.translation));
}

export function buildMillenniumSkyline(o) {
  for (const arc of arcs) {
    const p = arcPoints(arc, 0, 0, 4);
    for (let i = 1; i < p.length; i++) panel(o, p[i - 1], p[i], 0, 140.5, glass, false);
  }
  deck(o, 140.5);
  box(o, 'metal', [-5.3, 0, 11.1], [5.6, 172, 17.32], dark);
  for (const arc of hoodArcs) {
    const p = arcPoints(arc, 0, 0, 4);
    for (let i = 1; i < p.length; i++) panel(o, p[i - 1], p[i], 140.5, 153.4, glass, false);
  }
  deck(o, 153.4, dark, hoodArcs, 4);
  face(
    o,
    'glass',
    [
      [-5.3, 153.4, -1],
      [-5.3, 172, 17.32],
      [5.6, 172, 17.32],
      [5.6, 153.4, -1],
    ],
    glass,
  );
  for (const x of [-5.3, 5.6]) {
    const p = [
      [x, 140.5, -1],
      [x, 140.5, 17.32],
      [x, 172, 17.32],
      [x, 153.4, -1],
    ];
    face(o, 'glass', x < 0 ? p : [...p].reverse(), glass);
  }
  for (const x of [-3.1, 3.1]) tube(o, 'metal', [x, 172, 16.1], [x, 202, 16.1], 0.25, silver, 5);
}

export const millenniumTowerStudy = {
  id: 'N0235',
  key: 'millennium_tower',
  title: 'Millennium Tower, Vienna',
  wikidataId: 'Q80495',
  build(out) {
    for (const p of parts)
      for (const instance of p.instances) p.build(shifted(out, instance.translation));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Millennium Tower Vienna exterior',
    );
  },
  brief:
    'Two interlocking cylindrical glazed office volumes, projecting service spine, narrow silver mullions and glass spandrels, recessed entry columns, stepped lamella-screened hood, sloping glass crown and paired braced antenna masts.',
  sourceFacts: {
    overallHeightMeters: 202,
    antennaHeightMeters: 30,
    upperFloors: 50,
    completed: 1999,
    officeGridMeters: 1.4,
    officeClearHeightMeters: [2.75, 2.8],
    ownerFloorAreaSquareMeters: [840, 900],
    mappedHeightTagMeters: 140.5,
  },
  reconstruction: {
    basis:
      'Individual deterministic reconstruction from owner architecture and office plan, Podrecca exterior and facade photographs, architect descriptions and exact-QID OSM footprint. Floor elevations, crown tiers, mullion dimensions, entrance layout and mast sections are reconstructed, not measured construction drawings.',
    fittedCirclesXZRadius: circles.map((c) => [c.x, c.z, c.r]),
    circleFitRmsMeters: [0.18850531230706732, 0.12856047447901986],
    bodyHeightMeters: 140.5,
    bodyHeightBasis:
      'OSM height tag interpreted as cylindrical body based on photographed stepped profile; requires an elevation drawing.',
    reconstructedSpineHeightMeters: 172,
    reconstructedHoodTopMeters: 153.4,
    reconstructedOfficeFloorPitchMeters: floorHeight,
  },
  refs: [
    'https://www.millenniumtower.at/en/architecture/',
    'https://www.millenniumtower.at/en/office/',
    'https://www.podrecca.com/projects/millenium-tower',
    'https://www.atp.ag/en/projects/millennium-tower-vienna/',
    'https://ifgroup.org/en/project/millennium-tower-vienna',
    'https://www.tandfonline.com/doi/abs/10.2749/101686699780481961',
    'https://www.openstreetmap.org/way/105310525',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X between cylindrical lobes in cached map frame',
    front: '-Z at the concave facade seam; +Z toward projecting rear service spine',
    origin: 'Cached mapped envelope center at ground datum',
  },
  geographic: () => ({
    reviewStatus:
      'map-outline registration; signed crown orientation and real-world visual fit pending',
    notes:
      'Native local coordinates directly fit both mapped curved arcs and the projecting rear spine of exact-QID way/105310525. Retain its signed anchor and heading, with no generic height or envelope stretching. Ground and neighboring mall interfaces remain unverified.',
  }),
  geographicNote:
    'Map-derived placement preview with asymmetric rear spine retained. Signed crown direction, terrain contact and mall interfaces still need a contextual visual review.',
  limitations: [
    'Maximum exterior fidelity is pending. Main-body 140.5 m map tag is provisionally distinguished from the taller crown/spine and 202 m antenna; surveyed tier elevations are unavailable.',
    'Upper hood radii, concentric setbacks, sloping roof boundaries, lamella profiles and mast geometry are photographic reconstructions. Photographs do not resolve all roof service equipment.',
    'The reconstructed entrance and support spacing need as-built verification, including the 2017 renovated lobby. No claim is made to model its sculptural interior.',
    'Adjacent Millennium City mall, housing and footbridge are separate buildings and are outside this tower asset. Terrain, mall connection and signed roof orientation have not passed geographic fit review.',
    'No third-party mesh, photograph or floor-plan image is embedded. Glass is local PBR; painted metal and stainless steel use shared canonical material definitions.',
  ],
  camera: { position: [-180, 145, -280], lookAt: [0, 98, 0], fov: 40 },
  qaCameras: [
    { name: 'front-double-cylinder', position: [0, 112, -245], lookAt: [0, 98, 0] },
    { name: 'curtain-wall-seam', position: [0, 78, -30], lookAt: [0, 78, -15] },
    { name: 'facade-spandrel-and-fins', position: [33, 61, -19], lookAt: [17, 60, -10] },
    { name: 'rear-spine', position: [40, 126, 190], lookAt: [0, 106, 13] },
    { name: 'stepped-hood', position: [-51, 165, -61], lookAt: [0, 147, -1] },
    { name: 'sloping-glass-crown', position: [43, 180, 48], lookAt: [0, 159, 9] },
    { name: 'paired-antenna', position: [-20, 188, 43], lookAt: [0, 187, 16] },
    { name: 'tower-entry-columns', position: [-27, 5, -40], lookAt: [-2, 4, -12] },
    { name: 'footprint-from-above', position: [5, 255, 25], lookAt: [0, 100, -1] },
  ],
};
