/** Pont Aval: four unequal skew spans, four variable-depth boxes and ribbed separate piers. */
import { beam, chamferedRectangle, loft, sphere } from './authored-structure-mesh.mjs';
import { tube } from './structure-mesh.mjs';

const concrete = [0.61, 0.595, 0.54],
  lighter = [0.73, 0.71, 0.65],
  steel = [0.42, 0.47, 0.455];
const half = 156.25,
  stations = [-half, -88.78, 3.22, 84.7, half];
const centers = [-12.5, -4.5, 4.5, 12.5];
// The surveyed road turns toward the city at the east end. Retain the mapped flare.
function plan(u, z) {
  const t = Math.max(0, (u - 70) / (half - 70));
  const c = -3.938 + (u + half) * 0.0315 - 6.426 * t * t;
  const width = 17.15 + 3.42 * t * t;
  const dz = (z * width) / 17.3;
  return [u - 1.182 - 0.56 * dz, c + dz];
}
const point = (u, y, z) => {
  const [x, zz] = plan(u, z);
  return [x, y, zz];
};
const roadY = (u, z = 0) => 12.86 + (3.55 * (u + half)) / (2 * half) - 0.02 * Math.abs(z);
function depth(u) {
  let d = 3.4;
  for (const support of stations.slice(1, -1)) {
    const t = Math.max(0, 1 - Math.abs(u - support) / 24);
    d = Math.max(d, 3.4 + 2.1 * t * t);
  }
  return d;
}
function strip(out, slot, start, end, ring, color, pitch = 1.25) {
  const n = Math.ceil((end - start) / pitch);
  loft(
    out,
    slot,
    Array.from({ length: n + 1 }, (_, i) => ring(start + ((end - start) * i) / n)),
    color,
  );
}
function slabRing(u, z0, z1, top, bottom) {
  return [
    point(u, top(u, z0), z0),
    point(u, top(u, z1), z1),
    point(u, bottom(u, z1), z1),
    point(u, bottom(u, z0), z0),
  ];
}
function boxSection(u, zc, inflate = 0) {
  const y = roadY(u, zc) - 0.33,
    d = depth(u) - 0.33;
  const yz = [
    [0, -2.78 - inflate],
    [0, 2.78 + inflate],
    [-0.2, 2.56 + inflate],
    [-0.49, 2.3 + inflate],
    [-d + 0.22, 1.83 + inflate],
    [-d, 1.75 + inflate],
    [-d, -1.75 - inflate],
    [-d + 0.22, -1.83 - inflate],
    [-0.49, -2.3 - inflate],
    [-0.2, -2.56 - inflate],
  ];
  return yz.map(([dy, dz]) => point(u, y + dy, zc + dz));
}
function deck(out) {
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -17.3 : 0.04,
      z1 = side < 0 ? -0.04 : 17.3;
    strip(
      out,
      'concrete',
      -half,
      half,
      (u) =>
        slabRing(
          u,
          z0,
          z1,
          (u, z) => roadY(u, z) - 0.13,
          (u, z) => roadY(u, z) - 0.36,
        ),
      concrete,
    );
    const a = side < 0 ? -15.5 : 1.5,
      b = side < 0 ? -1.5 : 15.5;
    strip(
      out,
      'road',
      -half,
      half,
      (u) => slabRing(u, a, b, roadY, (u, z) => roadY(u, z) - 0.13),
      [0.24, 0.25, 0.24],
    );
    for (const [edge0, edge1] of [
      [Math.min(side * 15.5, side * 17.3), Math.max(side * 15.5, side * 17.3)],
      [Math.min(side * 0.04, side * 1.5), Math.max(side * 0.04, side * 1.5)],
    ])
      strip(
        out,
        'concrete',
        -half,
        half,
        (u) =>
          slabRing(
            u,
            edge0,
            edge1,
            (u, z) => roadY(u, z) + 0.16,
            (u, z) => roadY(u, z) - 0.13,
          ),
        lighter,
      );
    for (const z of [a, b])
      strip(
        out,
        'paving',
        -half,
        half,
        (u) => slabRing(u, z - 0.13, z + 0.13, (u, zz) => roadY(u, zz) + 0.2, roadY),
        [0.55, 0.545, 0.5],
      );
    for (const offset of [3.5, 7, 10.5]) {
      const z = side * (1.5 + offset);
      for (let u = -half + 1; u < half - 1; u += 9)
        strip(
          out,
          'marking',
          u,
          Math.min(half, u + 3),
          (v) =>
            slabRing(
              v,
              z - 0.065,
              z + 0.065,
              (u, z) => roadY(u, z) + 0.018,
              (u, z) => roadY(u, z) + 0.014,
            ),
          [0.87, 0.87, 0.79],
          1,
        );
    }
    for (const z of [side * 1.7, side * 15.28])
      strip(
        out,
        'marking',
        -half,
        half,
        (u) =>
          slabRing(
            u,
            z - 0.065,
            z + 0.065,
            (u, z) => roadY(u, z) + 0.018,
            (u, z) => roadY(u, z) + 0.014,
          ),
        [0.85, 0.85, 0.77],
      );
    // The outer prefabricated cornice and solid parapet are continuous over the box haunches.
    strip(
      out,
      'concrete',
      -half,
      half,
      (u) =>
        slabRing(
          u,
          side * 17.05 - 0.12,
          side * 17.05 + 0.12,
          (u, z) => roadY(u, z) + 0.83,
          (u, z) => roadY(u, z) - 0.64,
        ),
      lighter,
    );
    for (let u = -half; u < half; u += 3.2) {
      const z = side * 17.05;
      beam(
        out,
        'concrete',
        point(u, roadY(u, z) - 0.62, z + side * 0.125),
        point(u, roadY(u, z) + 0.82, z + side * 0.125),
        0.014,
        0.012,
        [0.47, 0.46, 0.42],
      );
    }
    for (let u = -half + 0.1; u < half; u += 0.24) {
      const z = side * 17.06;
      beam(
        out,
        'iron',
        point(u, roadY(u, z) + 0.84, z),
        point(u, roadY(u, z) + 1.39, z),
        0.028,
        0.041,
        steel,
      );
    }
    for (const h of [0.85, 1.4]) {
      const z = side * 17.06;
      for (let u = -half; u < half; u += 2)
        beam(
          out,
          'iron',
          point(u, roadY(u, z) + h, z),
          point(Math.min(half, u + 2), roadY(Math.min(half, u + 2), z) + h, z),
          0.048,
          0.065,
          steel,
        );
    }
    // A reinforced median barrier, with the original narrow maintenance strip behind it.
    strip(
      out,
      'concrete',
      -half,
      half,
      (u) => {
        const ring = [
          point(u, roadY(u) + 0.03, side * 0.8),
          point(u, roadY(u) + 0.93, side * 1.08),
          point(u, roadY(u) + 0.93, side * 1.31),
          point(u, roadY(u) + 0.03, side * 1.49),
        ];
        return side > 0 ? ring : ring.reverse();
      },
      lighter,
    );
  }
  for (const zc of centers) {
    strip(out, 'concrete', -half, half, (u) => boxSection(u, zc), concrete, 0.7);
    // Narrow surface joints follow each precast segment around its actual variable section.
    for (let u = -half + 1.6; u < half - 0.1; u += 3.2)
      loft(
        out,
        'concrete',
        [boxSection(u, zc, 0.007), boxSection(u + 0.017, zc, 0.007)],
        [0.48, 0.47, 0.43],
      );
    // Slim longitudinal service conduits and separate hanger straps.
    for (let u = -half; u < half; u += 2.5) {
      const v = Math.min(half, u + 2.5),
        z = zc + 1.49;
      tube(
        out,
        'iron',
        point(u, roadY(u, z) - depth(u) - 0.1, z),
        point(v, roadY(v, z) - depth(v) - 0.1, z),
        0.033,
        [0.35, 0.37, 0.34],
        10,
      );
    }
    for (let u = -half + 2; u < half; u += 6.4) {
      const z = zc + 1.49,
        y = roadY(u, z) - depth(u);
      beam(out, 'iron', point(u, y, z - 0.1), point(u, y - 0.17, z - 0.1), 0.024, 0.025, steel);
      beam(
        out,
        'iron',
        point(u, y - 0.17, z - 0.1),
        point(u, y - 0.17, z + 0.1),
        0.024,
        0.025,
        steel,
      );
    }
  }
  // Asphalt expansion joints remain distinct from the much finer precast seams below.
  for (const u of [-half + 0.18, -55, 45, 125, half - 0.18]) {
    strip(
      out,
      'iron',
      u - 0.045,
      u + 0.045,
      (v) =>
        slabRing(
          v,
          -15.5,
          15.5,
          (u, z) => roadY(u, z) + 0.022,
          (u, z) => roadY(u, z) + 0.017,
        ),
      [0.15, 0.17, 0.16],
    );
    for (let z = -15.4; z < 15.5; z += 0.09)
      beam(
        out,
        'steel',
        point(u - 0.044, roadY(u, z) + 0.024, z),
        point(u + 0.044, roadY(u, z) + 0.024, z + 0.04),
        0.008,
        0.014,
        [0.48, 0.49, 0.46],
      );
  }
}
function pier(out, u, zc) {
  const h = roadY(u, zc) - depth(u) - 0.28;
  const ring = (y, w, d) =>
    chamferedRectangle(0, y, 0, w, d, 0.23).map(([x, yy, z]) => point(u + x, yy, zc + z));
  loft(
    out,
    'concrete',
    [ring(0, 4.45, 5.4), ring(0.42, 4.37, 5.28), ring(h - 0.15, 2.9, 3.74)],
    lighter,
  );
  // Fine vertical architectural ribs seen on each independent river and bank pier.
  for (const side of [-1, 1]) {
    for (let dz = -2.15; dz <= 2.15; dz += 0.22) {
      const a = point(u + side * 2.23, 0.35, zc + dz),
        b = point(u + side * 1.455, h - 0.23, zc + dz * 0.69);
      beam(out, 'concrete', a, b, 0.036, 0.034, [0.56, 0.55, 0.5]);
    }
    for (let dx = -1.72; dx <= 1.72; dx += 0.22) {
      const a = point(u + dx, 0.35, zc + side * 2.705),
        b = point(u + dx * 0.65, h - 0.23, zc + side * 1.875);
      beam(out, 'concrete', a, b, 0.036, 0.034, [0.56, 0.55, 0.5]);
    }
  }
  loft(out, 'concrete', [ring(h - 0.16, 3.14, 4.05), ring(h + 0.09, 3.14, 4.05)], concrete);
  for (const dz of [-0.85, 0.85]) {
    const a = point(u - 0.62, h + 0.1, zc + dz - 0.37),
      b = point(u + 0.62, h + 0.1, zc + dz + 0.37);
    beam(out, 'iron', a, b, 0.2, 0.19, [0.21, 0.23, 0.22]);
  }
}
function abutment(out, u) {
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -17.3 : 0.07,
      z1 = side < 0 ? -0.07 : 17.3;
    strip(
      out,
      'concrete',
      u - 0.55,
      u + 0.55,
      (v) =>
        slabRing(
          v,
          z0,
          z1,
          (u, z) => roadY(u, z) - 0.35,
          () => 4.9,
        ),
      lighter,
      0.3,
    );
    for (const zc of centers.filter((z) => Math.sign(z) === side)) {
      pier(out, u, zc);
    }
    for (const z of [side * 16.7]) {
      strip(
        out,
        'concrete',
        u - 1.4,
        u + 1.4,
        (v) =>
          slabRing(
            v,
            z - 0.32,
            z + 0.32,
            (u, z) => roadY(u, z) + 0.88,
            () => 4.8,
          ),
        lighter,
        0.3,
      );
    }
  }
}
function lights(out) {
  for (let u = -141; u <= 141; u += 35.25) {
    const y = roadY(u) + 0.45,
      z = 0;
    tube(out, 'steel', point(u, y, z), point(u, y + 12.5, z), 0.075, steel, 20);
    for (const side of [-1, 1]) {
      let a = point(u, y + 12.0, 0);
      for (let i = 1; i <= 22; i++) {
        const t = i / 22,
          b = point(u, y + 12 + 1.08 * Math.sin((t * Math.PI) / 2), side * 2.24 * t);
        tube(out, 'steel', a, b, 0.045, steel, 12);
        a = b;
      }
      sphere(out, 'iron', point(u, y + 13.05, side * 2.36), [0.17, 0.1, 0.47], steel, 24, 12);
      sphere(
        out,
        'marking',
        point(u, y + 12.99, side * 2.36),
        [0.135, 0.025, 0.39],
        [0.77, 0.79, 0.71],
        20,
        10,
      );
    }
    for (const dx of [-0.15, 0.15])
      for (const dz of [-0.15, 0.15])
        tube(
          out,
          'iron',
          point(u + dx, y - 0.1, dz),
          point(u + dx, y + 0.05, dz),
          0.018,
          [0.25, 0.26, 0.23],
          8,
        );
  }
}
function drains(out) {
  for (const side of [-1, 1])
    for (let u = -150; u < 150; u += 12.8) {
      const z = side * 16.12,
        y = roadY(u, z);
      for (let j = 0; j < 9; j++)
        beam(
          out,
          'iron',
          point(u - 0.25 + j * 0.06, y + 0.025, z - 0.17),
          point(u - 0.25 + j * 0.06, y + 0.025, z + 0.17),
          0.025,
          0.028,
          [0.28, 0.29, 0.27],
        );
      const zpipe = side * 15.9;
      tube(
        out,
        'iron',
        point(u, y - 0.08, zpipe),
        point(u, y - 1.8, zpipe),
        0.085,
        [0.44, 0.45, 0.41],
        20,
      );
      tube(
        out,
        'iron',
        point(u, y - 1.8, zpipe),
        point(u + 0.55, y - 2.2, zpipe),
        0.085,
        [0.44, 0.45, 0.41],
        20,
      );
      for (const h of [0.65, 1.3])
        beam(
          out,
          'iron',
          point(u - 0.14, y - h, zpipe - 0.14),
          point(u + 0.14, y - h, zpipe + 0.14),
          0.05,
          0.045,
          steel,
        );
    }
}

export function buildPontAval(out) {
  deck(out);
  for (const u of stations.slice(1, -1)) for (const z of centers) pier(out, u, z);
  abutment(out, -half);
  abutment(out, half);
  lights(out);
  drains(out);
}

function geographic(map) {
  const radius = 6378137,
    factor = Math.cos((map.anchor[1] * Math.PI) / 180);
  const centerX = ((map.anchor[0] * Math.PI) / 180) * radius * factor;
  const centerZ = -radius * Math.asinh(Math.tan((map.anchor[1] * Math.PI) / 180)) * factor;
  const c = Math.cos(map.heading),
    s = Math.sin(map.heading);
  // Include the structure plus the 100 m procedural-road transition in each resident tile.
  const corners = [
    [-270, -124],
    [-270, 124],
    [270, -124],
    [270, 124],
  ].map(([x, z]) => {
    const wx = centerX + c * x + s * z,
      wz = centerZ - s * x + c * z;
    return [
      ((wx / factor / radius) * 180) / Math.PI,
      (Math.atan(Math.sinh(-wz / factor / radius)) * 180) / Math.PI,
    ];
  });
  const outline = [
    ...Array.from({ length: 65 }, (_, i) => plan(-half + i * ((2 * half) / 64), -17.3)),
    ...Array.from({ length: 65 }, (_, i) => plan(half - i * ((2 * half) / 64), 17.3)),
  ];
  return {
    anchor: map.anchor,
    heading: map.heading,
    elevationMode: 'sea-level',
    elevationMeters: 26.34,
    bounds: [
      Math.min(...corners.map((p) => p[0])),
      Math.min(...corners.map((p) => p[1])),
      Math.max(...corners.map((p) => p[0])),
      Math.max(...corners.map((p) => p[1])),
    ],
    replaceRoads: {
      length: 312.5,
      width: 42.16,
      outline,
      deckHeights: [roadY(-half), roadY(half)],
    },
    notes:
      'The archival normal-water origin26.34m matches current IGN RGE ALTI at the crossing. Road39.2–42.75m follows the primary longitudinal section; official BD TOPO3D motorway axes independently confirm elevated approaches, with2.5m stated altitude accuracy. Host terrain must use the same NGF-IGN69 vertical frame or convert heights. The exact authored skew/curve polygon suppresses only loaded bridge road segments; two endpoint heights join the remaining motorway approaches. PositiveX is east from the67.5m end span toward the71.5m end span. Preserved terrain/road evidence is under content/earth/structures/evidence/bridge-terrain/ign/.',
  };
}
export const pontAvalStudy = {
  id: 'N0026',
  key: 'pont_aval',
  title: 'Pont Aval',
  wikidataId: 'Q2073282',
  mapFrameDocument: 'map-frame.json',
  build: buildPontAval,
  brief:
    'The Seine crossing of the western Paris périphérique: four unequal skew spans, paired carriageways carried by four separately haunched concrete box girders, ribbed independent piers, precast cornices and eight lanes.',
  refs: [
    'https://www.afgc.asso.fr/?p=39706',
    'https://www.afgc.asso.fr/app/uploads/2023/06/HistoireAdminPontsParis_Prade-1982b.pdf',
    'https://www.paris.fr/pages/paris-et-ses-ponts-toute-une-histoire-7466',
    'https://commons.wikimedia.org/wiki/File:P1080253_Paris_XVI_pont_aval_rwk.JPG',
    'https://commons.wikimedia.org/wiki/File:P1080254_Paris_XVI_pont_aval_rwk.JPG',
    'https://www.openstreetmap.org/way/433835333',
    'https://data.geopf.fr/altimetrie/resources/ign_rge_alti_wld',
    'https://data.geopf.fr/annexes/ressources/documentation/DC_RGEALTI_2-0.pdf',
    'https://geoservices.ign.fr/sites/default/files/2021-11/DC_BDTOPO_3-0_1.pdf',
  ],
  sourceFacts: {
    lengthMeters: 312.5,
    usefulWidthMeters: 34.6,
    carriagewayWidthsMeters: [14, 14],
    publishedSpansEastToWestMeters: [71.5, 81.5, 92, 67.5],
    boxGirders: 4,
    midspanDepthMeters: 3.4,
    pierDepthMeters: 5.5,
    boxSpacingMeters: [8, 9, 8],
    bottomBoxWidthMeters: 3.5,
    completedYear: 1968,
  },
  reconstruction: {
    skewShear: 0.56,
    precastSegmentPitchMeters: 3.2,
    lampPitchMeters: 35.25,
    notes:
      '1982 ministry drawing p81 guides elevations and cross section. Fine segment/lamp spacing, pier fluting and current median parapets are photograph-based. The east plan curve and flare follow mapped outline and aerial; these are retained separately from the nominal34.6m straight-section width.',
  },
  nativeAxes: {
    x: 'east to the left bank and Issy interchange',
    y: 'up from normal-water reference on the archival drawing',
    z: 'south/downstream side',
  },
  geographic,
  limitations: [
    'The absolute placement is consistent with current IGN NGF-IGN69 terrain/water and BD TOPO3D road evidence. Hosts using a different height reference need a datum conversion; official road coordinates have2.5m stated altitude accuracy.',
    'The exterior reflects photographs and available aerial; changes to traffic markings or lamps since those images require current reference verification.',
    'The crossing ends at its abutments; adjacent elevated motorway ramps remain separate map-driven structures.',
  ],
  camera: { position: [130, 80, 270], lookAt: [0, 11, 0], fov: 45 },
  qaCameras: [
    { name: 'south-elevation', position: [0, 25, 390], lookAt: [0, 10, 0] },
    { name: 'north-elevation', position: [0, 30, -390], lookAt: [0, 10, 0] },
    { name: 'box-soffits', position: [-54, 3, 32], lookAt: [-78, 9, 0] },
    { name: 'river-piers', position: [-71, 4, 29], lookAt: [-89, 4, 1] },
    { name: 'haunched-girders', position: [-59, 9, 28], lookAt: [-83, 9, 3] },
    { name: 'east-bank-piers', position: [106, 7, 40], lookAt: [84.7, 7, 1] },
    { name: 'skew-west-abutment', position: [-189, 15, 29], lookAt: [-155, 9, -1] },
    { name: 'skew-east-abutment', position: [180, 20, 30], lookAt: [154, 10, -1] },
    { name: 'precast-cornice', position: [-11, 13.2, 26], lookAt: [-17, 13.8, 17] },
    { name: 'road-and-median', position: [48, 19, 9], lookAt: [-55, 13, 7] },
    { name: 'lamp-arm', position: [13, 29, 11], lookAt: [0, 27, 0] },
    { name: 'drain-and-barrier', position: [-26, 13.1, 24], lookAt: [-28, 12.4, 16] },
    { name: 'mapped-deck-plan', position: [0, 400, 0.01], lookAt: [0, 10, 0] },
  ],
};
