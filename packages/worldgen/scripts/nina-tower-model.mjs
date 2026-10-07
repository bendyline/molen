/** Nina Tower: original exterior study. Published dimensions and reconstruction are separate. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const silver = [0.68, 0.71, 0.7];
const blue = [0.29, 0.43, 0.49];
const pale = [0.69, 0.7, 0.65];
const dark = [0.13, 0.17, 0.18];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const parts = [];

function transformed(out, translation = [0, 0, 0], angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

// Clockwise in X/Z: exterior is local +Z along each directed edge.
function roundedPlan(x, z, radius, segments = 8) {
  const points = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = Math.PI + (corner * Math.PI) / 2;
    const cx = corner === 0 || corner === 3 ? -x + radius : x - radius;
    const cz = corner < 2 ? z - radius : -z + radius;
    for (let i = 0; i <= segments; i++) {
      const a = angle + (i * Math.PI) / (2 * segments);
      points.push([cx + radius * Math.cos(a), cz - radius * Math.sin(a)]);
    }
  }
  return points;
}

function plate(o, plan, y, thickness, color = pale) {
  for (let k = 0; k < plan.length; k++) {
    const [x, z] = plan[k],
      [xx, zz] = plan[(k + 1) % plan.length];
    face(
      o,
      'concrete',
      [
        [x, y, z],
        [xx, y, zz],
        [xx, y + thickness, zz],
        [x, y + thickness, z],
      ],
      color,
    );
    o.addTriangle(
      'concrete',
      'palette:#ffffff',
      [
        [0, y + thickness, 0],
        [x, y + thickness, z],
        [xx, y + thickness, zz],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      color,
    );
    o.addTriangle(
      'concrete',
      'palette:#ffffff',
      [
        [0, y, 0],
        [xx, y, zz],
        [x, y, z],
      ],
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

/** One floor/bay; stored once for all equivalent facades, including curved corner facets. */
function bay(o, width, height, louver = false) {
  const t = 0.052;
  const color = louver ? dark : blue;
  face(
    o,
    louver ? 'recess' : 'glass',
    [
      [0.035, 0.06, -0.035],
      [width - 0.035, 0.06, -0.035],
      [width - 0.035, height - 0.15, -0.035],
      [0.035, height - 0.15, -0.035],
    ],
    color,
  );
  // Aluminum plates, transoms and seals are 4-9 cm, below the closeup's error on a 320 m tower:
  // flat strips proud of the glass keep the leading mullion and the pale drip edge (shared with
  // the neighbouring bay), and louvres are every other slat at twice the depth of face.
  const strip = (x0, x1, y0, y1, z, color, slot = 'metal') =>
    face(
      o,
      slot,
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      color,
    );
  strip(0, t, 0, height, 0.045, silver);
  strip(0, width, height - 0.12, height, 0.09, pale);
  if (louver) {
    for (let y = 0.12; y < height - 0.22; y += 0.38)
      strip(0.07, width - 0.07, y, y + 0.11, 0.13, [0.47, 0.49, 0.45]);
  } else {
    face(
      o,
      'glass',
      [
        [0.055, 0.07, -0.012],
        [width - 0.055, 0.07, -0.012],
        [width - 0.055, height * 0.26 - 0.018, -0.012],
        [0.055, height * 0.26 - 0.018, -0.012],
      ],
      [0.36, 0.44, 0.46],
    );
  }
}

const towers = [
  {
    name: 'teddy-tower',
    x: 21.3,
    z: 22.0,
    radius: 5.7,
    pos: [0, 0, 0],
    rows: 72,
    occupied: 301.1,
    top: 320.4,
    refuge: [22, 32, 53],
  },
  {
    name: 'nina-hotel-tower',
    x: 21.2,
    z: 16.8,
    radius: 7.2,
    pos: [-22.5, 0, 44],
    rows: 36,
    occupied: 153,
    top: 170,
    refuge: [13],
  },
];
const podiumTop = 32.8;

for (const tower of towers) {
  const plan = roundedPlan(tower.x, tower.z, tower.radius);
  const dy = (tower.occupied - podiumTop) / tower.rows;
  const units = new Map();
  const unit = (width, louver) => {
    const key = `${width.toFixed(6)}-${louver}`;
    if (!units.has(key))
      units.set(key, {
        name: `${tower.name}-bay-${units.size}`,
        build: (o) => bay(o, width, dy, louver),
        instances: [],
      });
    return units.get(key);
  };
  for (let edge = 0; edge < plan.length; edge++) {
    const a = plan[edge],
      b = plan[(edge + 1) % plan.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.round(length / 1.48));
    const width = length / count,
      angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let row = 0; row < tower.rows; row++) {
      for (let column = 0; column < count; column++) {
        const louver = tower.refuge.includes(row) || tower.refuge.includes(row - 1);
        unit(width, louver).instances.push({
          translation: [
            tower.pos[0] + a[0] + ((b[0] - a[0]) * column) / count,
            podiumTop + row * dy,
            tower.pos[2] + a[1] + ((b[1] - a[1]) * column) / count,
          ],
          angle,
        });
      }
    }
  }
  parts.push(...units.values());
  parts.push({
    name: `${tower.name}-slabs-roof-and-service-core`,
    instances: [{ translation: tower.pos }],
    build(o) {
      plate(o, plan, podiumTop - 0.22, 0.22);
      for (const row of [...tower.refuge, tower.rows])
        plate(o, plan, podiumTop + row * dy - 0.2, 0.2, [0.48, 0.5, 0.5]);
      // Curved sail roof rising from the glazed top storey; open screened crown below.
      const roof = (x) =>
        tower.occupied +
        (tower.top - tower.occupied) *
          Math.sqrt(Math.max(0, 1 - Math.pow((x + tower.x + 1.1) / (2 * tower.x + 2.2), 2)));
      for (let i = 0; i < 56; i++) {
        const x0 = -tower.x - 1.1 + (i * (2 * tower.x + 2.2)) / 56;
        const x1 = -tower.x - 1.1 + ((i + 1) * (2 * tower.x + 2.2)) / 56;
        const y0 = roof(x0),
          y1 = roof(x1);
        face(
          o,
          'metal',
          [
            [x0, y0, -tower.z - 1.1],
            [x0, y0, tower.z + 1.1],
            [x1, y1, tower.z + 1.1],
            [x1, y1, -tower.z - 1.1],
          ],
          silver,
        );
        face(
          o,
          'metal',
          [
            [x1, y1 - 0.3, -tower.z - 1.1],
            [x1, y1 - 0.3, tower.z + 1.1],
            [x0, y0 - 0.3, tower.z + 1.1],
            [x0, y0 - 0.3, -tower.z - 1.1],
          ],
          pale,
        );
        for (const z of [-tower.z - 1.1, tower.z + 1.1])
          beam(o, 'stainless', [x0, y0 - 0.18, z], [x1, y1 - 0.18, z], 0.36, 0.42, silver);
      }
      for (let x = -tower.x + 2; x < tower.x - 0.8; x += 5.7)
        for (const z of [-tower.z + 1.8, tower.z - 1.8]) {
          const top = roof(x) - 0.45;
          if (top > tower.occupied + 0.4)
            box(
              o,
              'stainless',
              [x - 0.18, tower.occupied, z - 0.18],
              [x + 0.18, top, z + 0.18],
              silver,
            );
        }
      box(o, 'recess', [-10, tower.occupied, -9], [10, tower.occupied + 5.2, 9], dark);
      for (let z = -8.7; z < 9; z += 1.8)
        box(
          o,
          'metal',
          [-10.12, tower.occupied + 0.4, z],
          [-9.98, tower.occupied + 4.7, z + 0.055],
          silver,
        );
      for (const x of [-12, 12])
        box(
          o,
          'concrete',
          [x - 2.5, tower.occupied + 0.15, -5],
          [x + 2.5, tower.occupied + 1.3, 5],
          pale,
        );
    },
  });
}

const podiumPlan = [
  [22.8, -22.8],
  [-15, -31],
  [-38, -29],
  [-55, -19],
  [-66, -2],
  [-70, 18],
  [-66, 38],
  [-56, 55],
  [-40, 66],
  [-17, 67],
  [4, 58],
  [10, 46],
  [2, 26],
  [22.8, 20],
];

parts.push({
  name: 'shared-podium-entrances-and-terrace',
  instances: [{}],
  build(o) {
    plate(o, podiumPlan, 0, 0.3, [0.59, 0.6, 0.56]);
    for (const y of [4.5, 9.0, 13.5, 18.0, 27.5, podiumTop]) plate(o, podiumPlan, y - 0.26, 0.26);
    for (let k = 0; k < podiumPlan.length; k++) {
      const a = podiumPlan[k],
        b = podiumPlan[(k + 1) % podiumPlan.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const wall = transformed(o, [a[0], 0, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0]));
      const bays = Math.max(1, Math.round(length / 2.4)),
        w = length / bays;
      for (let j = 0; j < bays; j++) {
        const x = j * w;
        for (const [y, h] of [
          [0.3, 4.2],
          [4.5, 4.5],
          [9, 4.5],
          [13.5, 4.5],
          [18, 9.5],
          [27.5, 5.3],
        ])
          bay(transformed(wall, [x, y, 0]), w, h);
        // Slender piers tie the public frontage to the tower's silver frame vocabulary.
        box(wall, 'cladding', [x, 0.3, -0.28], [x + 0.22, podiumTop, 0.15], pale);
      }
      for (let y = 18.3; y < 26.8; y += 0.36)
        if (k > 5 && k < 10)
          box(wall, 'metal', [0.1, y, 0.2], [length - 0.1, y + 0.09, 0.43], silver);
      for (let j = 0; j < bays; j++)
        box(
          wall,
          'metal',
          [j * w, podiumTop, -0.08],
          [j * w + 0.045, podiumTop + 1.15, 0.04],
          silver,
        );
      box(
        wall,
        'stainless',
        [0, podiumTop + 1.12, -0.08],
        [length, podiumTop + 1.17, 0.04],
        silver,
      );
    }
    // Door frames and pull handles at a working entrance location, pending signed site review.
    const entranceAngle = -Math.atan2(10, -17);
    const doors = transformed(
      o,
      [-40.55 + Math.sin(entranceAngle) * 0.08, 0, -27.5 + Math.cos(entranceAngle) * 0.08],
      entranceAngle,
    );
    for (let j = 0; j < 6; j++) {
      const x = j * 1.2;
      face(
        doors,
        'clear_glass',
        [
          [x, 0.3, 0],
          [x + 1.13, 0.3, 0],
          [x + 1.13, 3.25, 0],
          [x, 3.25, 0],
        ],
        [0.62, 0.72, 0.72],
      );
      box(doors, 'metal', [x, 0.3, -0.035], [x + 0.055, 3.3, 0.045], silver);
      tube(doors, 'stainless', [x + 0.91, 1.05, 0.1], [x + 0.91, 1.9, 0.1], 0.019, silver, 10);
    }
  },
});

parts.push({
  name: 'curved-enclosed-skybridge-and-triangular-trusses',
  instances: [{}],
  build(o) {
    const point = (t, y, side = 0) => {
      const x = -8 - 25 * t + 5 * Math.sin(Math.PI * t);
      const z = 21 + 9 * t;
      return [x, y, z + side];
    };
    const segments = 28;
    for (let i = 0; i < segments; i++) {
      const t = i / segments,
        u = (i + 1) / segments;
      const a = point(t, 151.7, -2.1),
        b = point(u, 151.7, -2.1);
      const c = point(u, 151.7, 2.1),
        d = point(t, 151.7, 2.1);
      face(o, 'concrete', [a, d, c, b], pale);
      face(
        o,
        'metal',
        [point(t, 155.3, -2.1), point(t, 155.3, 2.1), point(u, 155.3, 2.1), point(u, 155.3, -2.1)],
        silver,
      );
      for (const side of [-2.1, 2.1]) {
        const aa = point(t, 152, side),
          bb = point(u, 152, side);
        const cc = point(u, 155.1, side),
          dd = point(t, 155.1, side);
        face(o, 'clear_glass', side > 0 ? [bb, aa, dd, cc] : [aa, bb, cc, dd], [0.42, 0.65, 0.66]);
        beam(o, 'metal', aa, dd, 0.065, 0.09, silver);
        beam(o, 'stainless', point(t, 148.7, side), point(u, 148.7, side), 0.18, 0.18, silver);
        beam(o, 'stainless', point(t, 151.7, side), point(u, 151.7, side), 0.18, 0.18, silver);
        if (i % 4 === 0) {
          const v = Math.min(1, t + 4 / segments);
          beam(o, 'stainless', point(t, 148.7, side), point(v, 151.7, side), 0.14, 0.14, silver);
          beam(o, 'stainless', point(t, 151.7, side), point(v, 148.7, side), 0.14, 0.14, silver);
        }
      }
    }
  },
});

/** Deliberately authored distant silhouette; retain both open crowns and the bridge. */
export function buildNinaSkyline(out) {
  const walls = (o, plan, bottom, top, color) => {
    for (let k = 0; k < plan.length; k++) {
      const [x, z] = plan[k],
        [xx, zz] = plan[(k + 1) % plan.length];
      face(
        o,
        'glass',
        [
          [x, bottom, z],
          [xx, bottom, zz],
          [xx, top, zz],
          [x, top, z],
        ],
        color,
      );
    }
  };
  walls(out, podiumPlan, 0, podiumTop, blue);
  plate(out, podiumPlan, podiumTop - 0.2, 0.2);
  for (const tower of towers) {
    const o = transformed(out, tower.pos);
    const plan = roundedPlan(tower.x, tower.z, tower.radius, 3);
    const dy = (tower.occupied - podiumTop) / tower.rows;
    const breaks = [
      podiumTop,
      ...tower.refuge.flatMap((row) => [podiumTop + row * dy, podiumTop + (row + 2) * dy]),
      tower.occupied,
    ];
    for (let i = 0; i < breaks.length - 1; i++)
      walls(o, plan, breaks[i], breaks[i + 1], i % 2 ? dark : blue);
    plate(o, plan, tower.occupied - 0.2, 0.2, pale);
    const roof = (x) =>
      tower.occupied +
      (tower.top - tower.occupied) *
        Math.sqrt(Math.max(0, 1 - Math.pow((x + tower.x + 1.1) / (2 * tower.x + 2.2), 2)));
    for (let i = 0; i < 12; i++) {
      const x0 = -tower.x - 1.1 + (i * (2 * tower.x + 2.2)) / 12;
      const x1 = -tower.x - 1.1 + ((i + 1) * (2 * tower.x + 2.2)) / 12;
      const p = [
        [x0, roof(x0), -tower.z - 1.1],
        [x0, roof(x0), tower.z + 1.1],
        [x1, roof(x1), tower.z + 1.1],
        [x1, roof(x1), -tower.z - 1.1],
      ];
      face(o, 'metal', p, silver);
      face(
        o,
        'metal',
        [...p].reverse().map(([x, y, z]) => [x, y - 0.3, z]),
        pale,
      );
    }
    for (const x of [-tower.x, 0, tower.x * 0.8])
      for (const z of [-tower.z, tower.z])
        box(
          o,
          'metal',
          [x - 0.13, tower.occupied, z - 0.13],
          [x + 0.13, roof(x), z + 0.13],
          silver,
        );
  }
  // Follow the same curved plan as the detailed bridge, keeping its opening below.
  for (let i = 0; i < 6; i++) {
    const point = (t, y, side) => [
      -8 - 25 * t + 5 * Math.sin(t * Math.PI),
      y,
      21 + 9 * t + side * 2.1,
    ];
    const t = i / 6,
      u = (i + 1) / 6;
    for (const side of [-1, 1]) {
      const p = [
        point(t, 148.7, side),
        point(u, 148.7, side),
        point(u, 155.3, side),
        point(t, 155.3, side),
      ];
      face(out, 'glass', side > 0 ? p.reverse() : p, blue);
    }
    face(
      out,
      'metal',
      [point(t, 155.3, -1), point(t, 155.3, 1), point(u, 155.3, 1), point(u, 155.3, -1)],
      silver,
    );
  }
}

export const ninaTowerStudy = {
  id: 'N0230',
  key: 'nina_tower',
  title: 'Nina Tower',
  wikidataId: 'Q520839',
  mapFrame: 'map-frame.json',
  build(out) {
    for (const p of parts)
      for (const instance of p.instances)
        p.build(transformed(out, instance.translation, instance.angle));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Nina Tower modular exterior',
    );
  },
  brief:
    'Connected tall Teddy tower and lower Nina hotel tower, rounded glazed corners, silver horizontal transoms, refuge-floor louvres, asymmetric curved sail roofs, enclosed curved skybridge with separate triangular truss geometry, shared retail/convention podium, entrance glazing and terrace rails. Equivalent facade bays are reusable instances.',
  sourceFacts: {
    tallTowerArchitecturalHeightMeters: 320.4,
    tallTowerHighestOccupiedMeters: 301.1,
    registryAboveGroundFloors: 80,
    shortTowerRoundedRegistryHeightMeters: 170,
    planningPodiumStoreys: 8,
    planningTowerStoreys: [72, 36],
    hotelSkybridgeLabel: '41F',
    registryObservatoryMeters: 151.7,
    skybridgeTrussDepthMeters: 3,
  },
  reconstruction: {
    towerCentersXZ: [
      [0, 0],
      [-22.5, 44],
    ],
    tallEnvelopeMeters: [42.6, 44],
    shortEnvelopeMeters: [42.4, 33.6],
    podiumTopMeters: podiumTop,
    basis:
      'Published hotel diagram and 2018 planning plan/section, checked against the Sika exterior photograph. Roof curves, bay widths, refuge levels, small details, podium envelope and tower spacing are working reconstructions, not surveyed dimensions.',
    assembly: {
      uniqueParts: parts.length,
      instances: parts.reduce((n, p) => n + p.instances.length, 0),
    },
  },
  refs: [
    'https://www.skyscrapercenter.com/building/nina-tower/421',
    'https://www.skyscrapercenter.com/complex/249',
    'https://www.ninahotelgroup.com/media/iy4ffnai/240315-tww-fact-sheet-en.pdf',
    'https://www.tpb.gov.hk/en/papers/TPB/TWK/A_TW_497_RV/A_TW_497_RV_Annex%20b.pdf',
    'https://www.sika.com/dms/getdocument.get/dfedde96-0ea7-4344-97d8-59e1ff66e9a1/glo-sika-concrete-highrise-buildings-references.pdf',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X along the tall tower frontage',
    front: '-Z toward Yeung Uk Road',
    origin:
      'Working tall tower center at local pavement datum; geographic registration remains unapproved',
  },
  geographicNote:
    'The planning diagram supplies a working local frame. The catalog coordinate is only a reference point; no exact-QID OSM footprint or surveyed registration is claimed. Keep this model unplaced until its anchor, signed orientation and site envelope are reviewed.',
  geographic: () => ({
    status: 'research-only',
    reviewStatus: 'unresolved-anchor; no automatic placement approval',
    mapGeometryLicense:
      'Reference drawing linked to Hong Kong Planning Department; model geometry is an original reconstruction.',
    attribution: 'Hong Kong Planning Department A/TW/497; coordinate reference Wikidata CC0',
    notes:
      'Working heading and outline from the 2018 north-arrow plan. Anchor is the unverified catalog reference point. This is not OSM geometry or placement approval.',
  }),
  geometrySource:
    'Original deterministic reconstruction from linked primary references. No downloaded mesh, traced photographic texture or source publication is embedded.',
  sourceLicense:
    'Original reconstruction under repository license; publications are linked, not redistributed. Catalog coordinate: Wikidata CC0.',
  limitations: [
    'Geographic registration is pending. The OSM lookup was unavailable, and the catalog coordinate must not be treated as the tower-center anchor; the source frame and heading are provisional.',
    'This is an exterior reconstruction, not maximum-fidelity completion. Measured floor polygons, curvature radii, crown rib dimensions, roof plant, facade subdivisions and true bridge curvature need further evidence.',
    'The public podium and entrances are schematic reconstructions. Full mall frontage, signage, footbridge connections, loading/transport bays and real pavement levels remain to be authored.',
    'Registry and planning floor counts use different scopes; hotel marketing floor labels omit numbers. Facade rows are allocated geometrically and do not certify every named storey datum.',
  ],
  camera: { position: [-325, 211, 378], lookAt: [-15, 150, 15], fov: 39 },
  qaCameras: [
    { name: 'facade-bays', position: [27, 78, 3], lookAt: [21, 78, 3] },
    { name: 'rounded-corner', position: [34, 79, -34], lookAt: [18, 78, -19] },
    { name: 'refuge-louvres', position: [31, 118, 13], lookAt: [21, 118, 13] },
    { name: 'curved-skybridge', position: [-38, 157, 4], lookAt: [-24, 152, 26] },
    { name: 'tall-sail-roof', position: [-70, 335, 65], lookAt: [0, 308, 0] },
    { name: 'short-sail-roof', position: [-75, 191, 96], lookAt: [-22.5, 161, 44] },
    { name: 'podium-frontage', position: [-50, 5, -42], lookAt: [-43, 2, -26] },
    { name: 'site-plan', position: [-18, 395, 17], lookAt: [-18, 0, 18] },
    { name: 'far-silhouette', position: [-650, 340, 710], lookAt: [-15, 150, 15] },
  ],
};
