/** Öland's two individually documented stone lighthouse exteriors. */
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.86, 0.86, 0.8],
  black = [0.055, 0.065, 0.06],
  stone = [0.43, 0.32, 0.23],
  red = [0.55, 0.08, 0.055];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];

/** Fill the upper corners of a real rectangular opening, leaving a curved intrados. */
function archHead(out, { y, w, h, z, depth, slot, color, rise = w / 2 }) {
  const spring = y + h - rise,
    n = 32;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (i * w) / n,
      x1 = -w / 2 + ((i + 1) * w) / n;
    const a = spring + rise * Math.sqrt(Math.max(0, 1 - ((2 * x0) / w) ** 2));
    const b = spring + rise * Math.sqrt(Math.max(0, 1 - ((2 * x1) / w) ** 2));
    // Slightly exceed the cut top so the two crown subdivisions remain nondegenerate.
    const p = [
      [x0, a, z],
      [x1, b, z],
      [x1, y + h + 0.015, z],
      [x0, y + h + 0.015, z],
    ];
    quad(out, slot, p, [0, 0, 1], color);
    const intrados = [
      [x0, a, z],
      [x0, a, z - depth],
      [x1, b, z - depth],
      [x1, b, z],
    ];
    quad(out, slot, intrados, normalFor(...intrados.slice(0, 3)), color);
  }
}
function glassDrum(out, y0, y1, r, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.24, 0.32, 0.32]);
    tube(out, 'metal', p[0], p[3], 0.027, color, 8);
  }
  for (const y of [y0, y0 + (y1 - y0) * 0.5, y1])
    ring(out, 'metal', y, r - 0.03, r + 0.03, 0.04, color, 96);
}
function shallowCap(out, y, r, h, color, n = 16) {
  lathe(
    out,
    'metal',
    [
      [y, r],
      [y + 0.08, r],
      [y + h * 0.83, r * 0.24],
      [y + h, r * 0.13],
    ],
    color,
    128,
  );
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n;
    tube(
      out,
      'metal',
      polar(r + 0.012, y + 0.07, a),
      polar(r * 0.24 + 0.012, y + h * 0.83, a),
      0.018,
      color,
      8,
    );
  }
}
function windowCross(out, angle, y, w, h, r, color = white) {
  const o = transformed(out, angle),
    z = Math.sqrt(r * r - (w / 2) ** 2) - 0.23;
  for (const yy of [y + h * 0.5])
    box(o, 'wood', [-w / 2, yy - 0.023, z], [w / 2, yy + 0.023, z + 0.05], color);
  box(o, 'wood', [-0.023, y, z], [0.023, y + h, z + 0.05], color);
}
function oculus(out, angle, y, radius, towerRadius) {
  const o = transformed(out, angle),
    z = towerRadius + 0.065,
    n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = (r, t) => [Math.cos(t) * r, y + Math.sin(t) * r, z];
    quad(
      o,
      'plaster',
      [p(radius, a), p(radius + 0.11, a), p(radius + 0.11, b), p(radius, b)],
      [0, 0, 1],
      white,
    );
    o.addTriangle(
      'glass',
      'palette:#fff',
      [
        [0, y, z - 0.025],
        p(radius, a).map((v, k) => (k === 2 ? v - 0.025 : v)),
        p(radius, b).map((v, k) => (k === 2 ? v - 0.025 : v)),
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
      [0.16, 0.23, 0.22],
    );
  }
  box(o, 'wood', [-radius, y - 0.023, z], [radius, y + 0.023, z + 0.045], white);
  box(o, 'wood', [-0.023, y - radius, z], [0.023, y + radius, z + 0.045], white);
}

export function buildLangeJan(out) {
  const radius = (y) => (y <= 8.4 ? 6 - (y * 1.5) / 8.4 : 4.5 - ((y - 8.4) * 0.18) / 26.2);
  const holes = [];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (const y of [12.2, 18.1, 28.5, 32.7])
      holes.push({
        angle,
        y,
        w: 0.62,
        h: 0.83,
        depth: 0.28,
        trimSlot: 'plaster',
        trimColor: white,
      });
  holes.push({
    angle: 0,
    y: 0.12,
    w: 2.05,
    h: 3.08,
    depth: 1.1,
    trimSlot: 'plaster',
    trimColor: white,
  });
  shell(out, {
    profile: [
      [0, 6],
      [8.4, 4.5],
      [20.65, 4.416],
      [27.15, 4.371],
      [34.6, 4.32],
    ],
    holes,
    slot: 'plaster',
    color: (y) => (y >= 20.65 && y < 27.15 ? black : white),
    segments: 192,
  });
  for (const h of holes.filter((h) => h.h < 1))
    windowCross(out, h.angle, h.y, h.w, h.h, radius(h.y + h.h / 2));
  const doorZ = Math.sqrt(radius(1.65) ** 2 - 1.025 ** 2);
  archHead(out, {
    y: 0.12,
    w: 2.05,
    h: 3.08,
    z: doorZ + 0.005,
    depth: 1.1,
    slot: 'plaster',
    color: white,
    rise: 0.35,
  });
  panel(out, 'wood', -0.89, 0.89, 0.14, 2.6, doorZ - 1.06, [0.32, 0.42, 0.38]);
  for (const x of [-0.62, -0.21, 0.21, 0.62])
    box(
      out,
      'wood',
      [x - 0.13, 0.42, doorZ - 1.04],
      [x + 0.13, 2.29, doorZ - 1.015],
      [0.29, 0.39, 0.35],
    );
  box(out, 'limestone', [-1.17, 0, doorZ - 1.15], [1.17, 0.12, 6.24], [0.62, 0.61, 0.54]);
  box(out, 'plaster', [-1.36, 3.28, doorZ - 0.25], [1.36, 3.45, doorZ + 0.17], white);
  box(out, 'limestone', [-0.79, 3.72, 5.28], [0.79, 4.32, 5.36], [0.74, 0.75, 0.68]);
  // Plaque relief: dated tablets are modeled, lettering remains part of the source brief.
  for (const a of [Math.PI / 2, Math.PI, Math.PI * 1.5]) oculus(out, a, 6.4, 0.32, radius(6.4));
  // Main molded gallery atop the nearly cylindrical shaft.
  lathe(
    out,
    'plaster',
    [
      [34.58, 4.32],
      [34.71, 4.54],
      [34.89, 4.67],
      [35.06, 4.82],
      [35.32, 4.82],
      [35.43, 4.67],
    ],
    white,
    192,
  );
  railRing(out, 35.42, 4.55, 1.02, [0.6, 0.65, 0.6], 64);
  shell(out, {
    profile: [
      [35.4, 2.12],
      [37.54, 2.12],
    ],
    holes: [
      { angle: 0, y: 35.46, w: 0.64, h: 1.69, depth: 0.17, trimSlot: 'metal', trimColor: white },
    ],
    slot: 'plaster',
    color: white,
    segments: 128,
  });
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    beam(
      out,
      'metal',
      polar(2.14, 35.7, a),
      polar(2.14, 37.34, a),
      0.027,
      0.036,
      [0.65, 0.67, 0.6],
    );
  }
  ring(out, 'metal', 37.47, 1.8, 2.36, 0.13, [0.25, 0.29, 0.28], 128);
  glassDrum(out, 37.6, 39.43, 1.67, [0.39, 0.43, 0.39], 16);
  railRing(out, 37.59, 2.22, 0.83, [0.36, 0.41, 0.39], 32);
  ring(out, 'metal', 39.4, 1.5, 1.93, 0.12, red, 128);
  shallowCap(out, 39.51, 1.93, 0.93, red, 16);
  lathe(
    out,
    'metal',
    [
      [40.42, 0.15],
      [40.73, 0.15],
    ],
    red,
    48,
  );
  sphere(out, 'metal', [0, 40.8, 0], [0.22, 0.25, 0.22], red, 32, 16);
  tube(out, 'metal', [0, 40.97, 0], [0, 41.6, 0], 0.022, black, 8);
  // Rear auxiliary sector-light housing retained separately from the main lantern.
  const sector = transformed(out, Math.PI * 0.73);
  box(sector, 'metal', [-0.46, 28.8, 4.14], [0.46, 29.78, 4.7], white);
  panel(sector, 'glass', -0.37, 0.37, 28.88, 29.7, 4.707, [0.18, 0.27, 0.28]);
}

export function buildLangeErik(out) {
  const baseR = 3.34,
    shaftR = (y) => 3.08 - ((y - 6.28) * 0.48) / 21.04;
  const baseHoles = [
    { angle: 0, y: 0.12, w: 1.72, h: 3.6, depth: 0.8, trimSlot: 'limestone', trimColor: stone },
  ];
  shell(out, {
    profile: [
      [0, baseR],
      [5.76, baseR],
    ],
    holes: baseHoles,
    slot: 'ashlar',
    color: stone,
    segments: 160,
  });
  const doorZ = Math.sqrt(baseR ** 2 - 0.86 ** 2) + 0.01;
  archHead(out, {
    y: 0.12,
    w: 1.72,
    h: 3.6,
    z: doorZ,
    depth: 0.8,
    slot: 'ashlar',
    color: stone,
    rise: 0.86,
  });
  // The arch opens into a dark recess above the timber door, not a glazed fanlight.
  panel(out, 'wood', -0.86, 0.86, 0.12, 3.72, doorZ - 0.775, [0.04, 0.034, 0.028]);
  panel(out, 'wood', -0.79, 0.79, 0.12, 2.72, doorZ - 0.77, [0.29, 0.18, 0.085]);
  for (let i = 0; i < 7; i++)
    box(
      out,
      'wood',
      [-0.76 + i * 0.23, 0.15, doorZ - 0.75],
      [-0.75 + i * 0.23, 2.68, doorZ - 0.72],
      [0.43, 0.28, 0.14],
    );
  lathe(
    out,
    'limestone',
    [
      [5.75, 3.34],
      [5.89, 3.49],
      [6.04, 3.49],
      [6.18, 3.33],
      [6.28, 3.08],
    ],
    stone,
    160,
  );
  const windows = [];
  for (const angle of [0, Math.PI])
    for (const y of [6.43, 10.65, 15.01, 19.42, 23.7])
      windows.push({
        angle,
        y,
        w: 0.69,
        h: 1.06,
        depth: 0.31,
        trimSlot: 'limestone',
        trimColor: stone,
      });
  shell(out, {
    profile: [
      [6.28, 3.08],
      [27.32, 2.6],
    ],
    holes: windows,
    slot: 'plaster',
    color: white,
    segments: 160,
  });
  for (const h of windows) windowCross(out, h.angle, h.y, h.w, h.h, shaftR(h.y + h.h / 2));
  for (const a of [0, Math.PI]) {
    const o = transformed(out, a),
      z = shaftR(7) + 0.09;
    beam(o, 'limestone', [-0.63, 7.65, z], [0, 8.16, z], 0.13, 0.15, stone);
    beam(o, 'limestone', [0, 8.16, z], [0.63, 7.65, z], 0.13, 0.15, stone);
    box(o, 'limestone', [-0.66, 7.57, z - 0.04], [0.66, 7.71, z + 0.1], stone);
    for (const x of [-0.45, 0.45])
      box(o, 'limestone', [x - 0.07, 7.35, z - 0.01], [x + 0.07, 7.57, z + 0.08], stone);
  }
  for (let i = 0; i < 24; i++) {
    const o = transformed(out, (i * Math.PI) / 12);
    beam(o, 'limestone', [0, 26.51, 2.57], [0, 27.65, 3.08], 0.22, 0.31, stone);
  }
  lathe(
    out,
    'limestone',
    [
      [27.32, 2.6],
      [27.65, 3.15],
      [27.82, 3.24],
      [27.97, 3.24],
      [28.08, 3.16],
    ],
    stone,
    160,
  );
  railRing(out, 28.07, 3.07, 1.06, [0.48, 0.53, 0.48], 56);
  lathe(
    out,
    'metal',
    [
      [28.07, 1.77],
      [29.01, 1.77],
    ],
    white,
    128,
  );
  for (let i = 0; i < 12; i++)
    tube(
      out,
      'metal',
      polar(1.783, 28.09, (i * Math.PI) / 6),
      polar(1.783, 28.99, (i * Math.PI) / 6),
      0.018,
      [0.61, 0.65, 0.6],
      8,
    );
  ring(out, 'metal', 28.97, 1.69, 2.06, 0.1, black, 96);
  railRing(out, 29.07, 1.98, 0.63, [0.36, 0.41, 0.39], 32);
  glassDrum(out, 29.07, 30.9, 1.54, [0.14, 0.19, 0.18], 12);
  shallowCap(out, 30.88, 1.75, 0.79, [0.19, 0.23, 0.22], 16);
  sphere(out, 'metal', [0, 31.79, 0], [0.16, 0.19, 0.16], black, 24, 12);
  tube(out, 'metal', [0, 31.92, 0], [0, 32.1, 0], 0.021, black, 8);
  // Present beacon is a compact ribbed Sabik stack outside the historic lantern.
  const light = transformed(out, -Math.PI * 0.32, [0, 0, 0]);
  tube(light, 'metal', [0, 28.07, 2.89], [0, 29.6, 2.89], 0.064, [0.47, 0.52, 0.46], 16);
  const beacon = transformed(light, 0, [0, 0, 2.89]);
  lathe(
    beacon,
    'metal',
    [
      [29.57, 0.18],
      [30.19, 0.18],
    ],
    black,
    48,
  );
  for (let i = 0; i < 6; i++) {
    ring(beacon, 'metal', 29.61 + i * 0.093, 0.14, 0.23, 0.025, [0.5, 0.55, 0.51], 48);
    lathe(
      beacon,
      'glass',
      [
        [29.64 + i * 0.093, 0.19],
        [29.681 + i * 0.093, 0.19],
      ],
      [0.47, 0.54, 0.44],
      48,
    );
  }
  for (const x of [-0.14, 0.14])
    tube(beacon, 'metal', [x, 30.17, 0], [x, 30.43, 0], 0.009, [0.5, 0.55, 0.51], 6);
  box(out, 'limestone', [-0.99, 0, doorZ - 0.83], [0.99, 0.12, 3.65], stone);
}

export const lighthouseSwedishStudies = [
  lighthouseStudy({
    id: 'N0664',
    key: 'lange_jan',
    title: 'Långe Jan',
    wikidataId: 'Q712299',
    build: buildLangeJan,
    size: [12, 41.6, 12.5],
    smoothNormalSlots: ['wall', 'trim'],
    visualBrief:
      'Broad flared limewashed base, deep segmental entrance portal, four ranks of small windows, low oculi, nearly cylindrical shaft with black central daymark, molded white gallery, raised watchroom and red-roofed lantern with exterior cleaning rail.',
    sourceFacts: {
      heightMeters: 41.6,
      baseDiameterApproxMeters: 12,
      basis:
        'Sjöfartsverket and the lighthouse-society brochure establish 41.6 m height and approximately 12 m base diameter. Original Göran Andersson and Esbjörn Hillberg photographs establish the flared lower stage, black band, recessed portal, gallery and red cap. Intermediate heights and fine detail are scaled to those photographs.',
    },
    referencePages: [
      'https://www.sjofartsverket.se/sv/om-oss/fyrar-och-kulturfastigheter/visningsfyrar/olands-sodra-udde--lange-jan/',
      'https://fyr.org/assets/pdf/broschyr/olands_sodra_udde.pdf',
      'https://www.oland.se/fyren-lange-jan-olands-sodra-udde',
      'https://www.openstreetmap.org/way/304266662',
      'https://www.openstreetmap.org/node/5866598197',
    ],
    geographicProposal: {
      anchor: [16.398528877, 56.196057454],
      heading: -2.2748968630941637,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/5866598197',
      notes:
        'Exact-QID mapped tower replaces the catalog coordinate about 214 m north. Mapped main entrance northwest of tower center fixes authored +Z portal. The approximately 9.7 m mapped circle is smaller than the operator’s approximately 12 m flared base; physical operator dimensions govern model size.',
    },
    limitations: [
      'Small facade details and the auxiliary sector-light housing are reconstructed from original photographs. Adjacent detached station buildings and site cannons remain separate features; the portal tablet is represented in relief without a copied inscription texture.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [12, 41, 14], lookAt: [0, 37.7, 0] },
      { name: 'near-portal', position: [9, 5, 12], lookAt: [0, 2.2, 4.9] },
      { name: 'near-daymark', position: [13, 27, 16], lookAt: [0, 25, 0] },
      { name: 'far-silhouette', position: [48, 27, 59], lookAt: [0, 20, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0665',
    key: 'lange_erik',
    title: 'Långe Erik',
    wikidataId: 'Q1024406',
    build: buildLangeErik,
    size: [7, 32.1, 7.3],
    smoothNormalSlots: ['wall', 'trim'],
    visualBrief:
      'Slender white limestone shaft on six-meter exposed brown stone drum, arched entrance, heavy belt molding, pedimented first window, inset rectangular windows, 24 gallery corbels, two levels of iron railing, dark shallow cap and small ribbed modern beacon on the gallery.',
    sourceFacts: {
      heightMeters: 32.1,
      unplasteredBaseHeightMeters: 6,
      galleryHeightApproxMeters: 28,
      baseDiameterMappedMeters: 6.664,
      basis:
        'Sjöfartsverket specifies 32.1 m total height, exposed lower six meters and gallery near 28 m. Exact-QID OSM circle gives about 6.66 m diameter. Original Carin Bäckström 2019 photograph provides arched entry, brown belt and pedimented first opening; the lighthouse-society brochure photographs the gallery-mounted Sabik LED 350.',
    },
    referencePages: [
      'https://www.sjofartsverket.se/sv/om-oss/fyrar-och-kulturfastigheter/visningsfyrar/olands-norra-udde--lange-erik/',
      'https://fyr.org/assets/pdf/broschyr/olands_norra_udde.pdf',
      'https://commons.wikimedia.org/wiki/File:L%C3%A5nge_Erik_20190718_01.jpg',
      'https://commons.wikimedia.org/wiki/File:L%C3%A5nge_Erik_fr%C3%A5n_luften.jpg',
      'https://www.openstreetmap.org/way/128130333',
    ],
    geographicProposal: {
      anchor: [17.09692995, 57.36703945],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/128130333',
      notes:
        'Exact-QID circle fixes origin and base width. Authored entrance faces south toward the island approach, reconstructed from the original entrance and aerial photographs; the circular footprint supplies no unique long axis. Natural shore and detached station buildings remain host features.',
    },
    limitations: [
      'Gallery components, window spacing and dark cap use photograph proportions between the operator’s dimensional controls. The modern external light is modeled as static visible equipment, not a certified navigation signal. Detached machine house north of the tower is outside this individual tower asset.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [9, 32, 11], lookAt: [0, 29.5, 0] },
      { name: 'near-entrance', position: [7, 5, 9], lookAt: [0, 3.6, 2.7] },
      { name: 'near-beacon', position: [-7, 31, 6], lookAt: [-2.4, 29.9, 1.55] },
      { name: 'far-silhouette', position: [38, 23, 46], lookAt: [0, 15, 0] },
    ],
  }),
];
