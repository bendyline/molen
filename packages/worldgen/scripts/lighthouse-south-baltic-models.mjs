/** Individually referenced Klaipėda, Kołobrzeg and Skagen lighthouse exteriors. */
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.86, 0.87, 0.82],
  black = [0.038, 0.045, 0.047],
  orange = [0.8, 0.205, 0.135];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
function path(out, points, slot, color, r = 0.016) {
  for (let i = 1; i < points.length; i++) tube(out, slot, points[i - 1], points[i], r, color, 8);
}
function roofSeams(out, profile, n, color) {
  for (let i = 0; i < n; i++)
    path(
      out,
      profile.map(([y, r]) => P(r + 0.012, y, (i * TAU) / n)),
      'metal',
      color,
      0.014,
    );
}
function rectangleRail(out, half, y, h, color) {
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    for (const dy of [0, h * 0.48, h])
      tube(o, 'metal', [-half, y + dy, half], [half, y + dy, half], 0.027, color, 10);
    for (let x = -half; x <= half + 0.01; x += half / 12)
      tube(o, 'metal', [x, y, half], [x, y + h, half], 0.017, color, 8);
  }
}
function roundRail(out, r, y, h, n, color) {
  for (let i = 0; i < n; i++)
    tube(out, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.018, color, 8);
  for (const dy of [0, h * 0.48, h])
    ring(out, 'metal', y + dy - 0.016, r - 0.022, r + 0.022, 0.032, color, 128);
}
function recessShell(out, options) {
  shell(
    {
      addQuad(s, r, ...a) {
        if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
      },
      addTriangle(...a) {
        out.addTriangle(...a);
      },
    },
    { ...options, holes: (options.holes ?? []).map((h) => ({ ...h, grid: false })) },
  );
  const radius = (y) => {
    let j = 1;
    while (j < options.profile.length - 1 && options.profile[j][0] < y) j++;
    const [a, r] = options.profile[j - 1],
      [b, t] = options.profile[j];
    return r + ((t - r) * (y - a)) / (b - a);
  };
  for (const h of options.holes ?? []) {
    const o = transformed(out, h.angle ?? 0),
      w = h.w / 2,
      z = Math.sqrt(radius(h.y + h.h / 2) ** 2 - w * w),
      t = h.trim ?? 0.045,
      c = h.trimColor ?? white,
      s = h.trimSlot ?? 'metal';
    for (const x of [-w, w])
      box(o, s, [x - t, h.y - t, z - h.depth], [x + t, h.y + h.h + t, z + 0.025], c);
    for (const y of [h.y, h.y + h.h])
      box(o, s, [-w - t, y - t, z - h.depth], [w + t, y + t, z + 0.03], c);
    if (h.grid) {
      box(
        o,
        'metal',
        [-0.018, h.y, z - h.depth + 0.014],
        [0.018, h.y + h.h, z - h.depth + 0.05],
        c,
      );
      box(
        o,
        'metal',
        [-w, h.y + h.h * 0.49 - 0.018, z - h.depth + 0.014],
        [w, h.y + h.h * 0.49 + 0.018, z - h.depth + 0.05],
        c,
      );
    }
  }
}
function archHead(
  out,
  { y, w, h, z, depth, color, slot = 'plaster', rise = w / 2, trim = 0.08, frame = white },
) {
  const spring = y + h - rise;
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 32,
      b = ((i + 1) * Math.PI) / 32,
      p = [w * 0.5 * Math.cos(a), spring + rise * Math.sin(a), z],
      q = [w * 0.5 * Math.cos(b), spring + rise * Math.sin(b), z];
    quad(out, slot, [p, [p[0], y + h + 0.018, z], [q[0], y + h + 0.018, z], q], [0, 0, 1], color);
    const ps = [p, q, [q[0], q[1], z - depth], [p[0], p[1], z - depth]];
    quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
    if (trim) tube(out, 'metal', p, q, trim, frame, 8);
  }
}
function roundel(out, a, y, r, bodyR, color) {
  const o = transformed(out, a);
  for (let i = 0; i < 48; i++) {
    const p = (i * TAU) / 48,
      q = ((i + 1) * TAU) / 48;
    const ps = [
      [0, y, bodyR + 0.013],
      [r * Math.cos(p), y + r * Math.sin(p), bodyR + 0.013],
      [r * Math.cos(q), y + r * Math.sin(q), bodyR + 0.013],
    ];
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      ps,
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color,
    );
  }
  path(
    o,
    Array.from({ length: 49 }, (_, i) => [
      r * Math.cos((i * TAU) / 48),
      y + r * Math.sin((i * TAU) / 48),
      bodyR + 0.025,
    ]),
    'metal',
    black,
    0.025,
  );
}
export function buildKlaipeda(out) {
  // Broad surviving plinth, with a double folded-metal shoulder below the slim stair shaft.
  lathe(
    out,
    'concrete',
    [
      [0, 4.24],
      [0.22, 4.24],
      [0.3, 4.12],
    ],
    black,
    160,
  );
  const baseHoles = [
    {
      angle: 0,
      y: 0.36,
      w: 1.36,
      h: 2.75,
      depth: 0.23,
      trimSlot: 'plaster',
      trimColor: white,
      trim: 0.13,
    },
    ...[-Math.PI / 2, Math.PI / 2, Math.PI].map((angle) => ({
      angle,
      y: 3.31,
      w: 1.15,
      h: 0.53,
      depth: 0.18,
      trimSlot: 'plaster',
      trimColor: white,
      trim: 0.09,
    })),
  ];
  recessShell(out, {
    profile: [
      [0.3, 4.12],
      [4.57, 4.12],
    ],
    holes: baseHoles,
    slot: 'plaster',
    color: black,
    segments: 160,
  });
  archHead(out, { y: 0.36, w: 1.36, h: 2.75, z: 4.08, depth: 0.23, color: black, trim: 0.105 });
  panel(out, 'wood', -0.57, 0.57, 0.4, 2.93, 3.89, [0.17, 0.16, 0.14]);
  for (let x = -0.5; x <= 0.51; x += 0.2)
    box(out, 'wood', [x - 0.009, 0.43, 3.9], [x + 0.009, 2.64, 3.914], [0.1, 0.095, 0.083]);
  box(out, 'metal', [0.4, 1.25, 3.919], [0.47, 1.53, 3.969], white);
  for (let i = 0; i < 2; i++)
    box(
      out,
      'concrete',
      [-1.16, 0, 3.98],
      [1.16, 0.36 - i * 0.18, 4.62 + i * 0.38],
      [0.38, 0.39, 0.37],
    );
  for (const y of [3.02, 4.52]) ring(out, 'plaster', y, 4.07, 4.19, 0.1, black, 160);
  const collar = [
    [4.57, 4.43],
    [4.92, 4.43],
    [5.7, 3.26],
    [6.15, 3.26],
    [6.66, 2.58],
  ];
  lathe(out, 'metal', collar, black, 128);
  roofSeams(out, collar, 112, [0.075, 0.084, 0.083]);
  const band0 = 6.66,
    bandH = 2.63,
    shaftTop = 32.96;
  const h = [];
  for (let i = 0; i < 6; i++)
    h.push({
      angle: 0,
      y: 7.2 + i * 4.52,
      w: 0.48,
      h: 1.16,
      depth: 0.16,
      trim: 0.045,
      trimSlot: 'metal',
      trimColor: i % 2 ? black : white,
      grid: true,
    });
  // Preserve band boundaries in the mesh so each daymark is a true continuous colored surface.
  const profile = Array.from({ length: 11 }, (_, i) => [band0 + i * bandH, 2.58]);
  const bandColor = (y, a) => {
    const k = Math.min(9, Math.floor((y - band0) / bandH));
    const strip =
      Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.125;
    return strip || k % 2 === 0 ? black : white;
  };
  recessShell(out, {
    profile,
    holes: h.filter((v) => v.y + v.h < shaftTop),
    slot: 'plaster',
    color: bandColor,
    segments: 192,
  });
  lathe(
    out,
    'plaster',
    [
      [shaftTop, 2.58],
      [33.2, 2.72],
      [33.49, 2.72],
      [33.62, 2.66],
    ],
    black,
    160,
  );
  recessShell(out, {
    profile: [
      [33.62, 2.66],
      [34.1, 2.66],
    ],
    slot: 'plaster',
    color: black,
    holes: [],
    segments: 160,
  });
  for (let i = 0; i < 4; i++) roundel(out, (i * TAU) / 4, 33.87, 0.12, 2.66, [0.55, 0.57, 0.55]);
  const capital = [
    [34.1, 2.65],
    [34.21, 2.8],
    [34.33, 3.05],
    [34.5, 3.27],
    [34.69, 3.39],
    [34.86, 3.38],
    [35.03, 3.18],
    [35.16, 2.97],
  ];
  lathe(out, 'plaster', capital, [0.11, 0.12, 0.12], 192);
  box(out, 'metal', [-3.78, 35.15, -3.78], [3.78, 35.44, 3.78], black);
  rectangleRail(out, 3.7, 35.46, 1.03, orange);
  // Seaward half of lantern glazed; landward half has solid orange weather panels.
  lathe(
    out,
    'metal',
    [
      [35.44, 1.84],
      [36.72, 1.84],
    ],
    orange,
    128,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16,
      b = ((i + 1) * TAU) / 16,
      glass = Math.sin((a + b) / 2) < -0.1,
      ps = [P(1.84, 36.72, a), P(1.84, 36.72, b), P(1.84, 38.54, b), P(1.84, 38.54, a)];
    quad(
      out,
      glass ? 'glassClear' : 'metal',
      ps,
      normalFor(...ps.slice(0, 3)),
      glass ? [0.74, 0.85, 0.84] : orange,
    );
    tube(out, 'metal', P(1.863, 35.5, a), P(1.863, 38.57, a), 0.038, orange, 10);
  }
  for (const y of [36.72, 37.32, 37.93, 38.54])
    ring(out, 'metal', y, 1.8, 1.89, 0.047, orange, 128);
  const cap = [
    [38.56, 2.02],
    [38.65, 2.03],
    [38.87, 1.61],
    [39.16, 0.83],
    [39.32, 0.19],
  ];
  lathe(out, 'metal', cap, orange, 128);
  roofSeams(
    out,
    cap,
    16,
    orange.map((v) => v * 0.75),
  );
  lathe(
    out,
    'metal',
    [
      [39.3, 0.19],
      [39.45, 0.19],
    ],
    orange,
    48,
  );
  sphere(out, 'metal', [0, 39.57, 0], [0.15, 0.15, 0.15], orange, 32, 16);
  tube(out, 'metal', [0, 39.69, 0], [0, 40, 0], 0.014, black, 8);
  roundRail(out, 1.98, 38.65, 0.27, 24, black);
  // Published modern exterior shows a small dish, paired aerials and gallery-mounted lights.
  for (const x of [-2.6, 2.6]) {
    tube(out, 'metal', [x, 35.44, 2.9], [x, 37.57, 2.9], 0.021, black, 8);
    for (const y of [36.6, 37.05])
      tube(out, 'metal', [x - 0.36, y, 2.9], [x + 0.36, y, 2.9], 0.014, black, 8);
  }
  for (const x of [-3.32, 3.32]) {
    beam(out, 'metal', [x, 35.67, 3.35], [x, 36.08, 4.28], 0.065, 0.065, black);
    box(out, 'metal', [x - 0.2, 35.94, 4.12], [x + 0.2, 36.2, 4.64], [0.53, 0.54, 0.5]);
    panel(out, 'glass', x - 0.155, x + 0.155, 35.985, 36.155, 4.648, [0.65, 0.71, 0.68]);
  }
  const dish = transformed(out, 0.42);
  // Compact lamp/pedestal silhouette visible behind the seaward sector glazing.
  // External photographs constrain the silhouette, not the internal optical prescription.
  lathe(
    out,
    'metal',
    [
      [35.46, 0.34],
      [36.86, 0.34],
      [36.94, 0.47],
    ],
    [0.48, 0.51, 0.48],
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [36.94, 0.32],
      [37.07, 0.47],
      [37.62, 0.47],
      [37.75, 0.31],
    ],
    [0.66, 0.83, 0.74],
    80,
  );
  for (let y = 37.06; y < 37.65; y += 0.085)
    ring(out, 'metal', y, 0.45, 0.48, 0.014, [0.46, 0.54, 0.48], 80);
  lathe(
    out,
    'metal',
    [
      [37.75, 0.34],
      [37.8, 0.34],
    ],
    [0.25, 0.29, 0.26],
    64,
  );
  sphere(dish, 'metal', [0, 36.95, 1.96], [0.34, 0.34, 0.075], [0.8, 0.81, 0.77], 48, 24);
  beam(dish, 'metal', [0, 36.5, 1.9], [0, 36.8, 2.03], 0.07, 0.07, black);
}
export const lighthouseSouthBalticStudies = [
  lighthouseStudy({
    id: 'N0676',
    key: 'klaipeda_lighthouse',
    title: 'Klaipėda Lighthouse',
    wikidataId: 'Q5764622',
    build: buildKlaipeda,
    metricTriangleUv: true,
    size: [8.9, 40, 9.2],
    visualBrief:
      'Black and white banded stair cylinder rising from a broad older plinth and stepped folded-metal collar; molded rounded capital beneath a square iron gallery, narrow shaft windows, arched entry, orange partly enclosed lantern, circular roof guard, optic-side glazing and published gallery hardware.',
    sourceFacts: {
      heightMeters: 40,
      focalElevationMeters: 44,
      mappedBaseDiameterMeters: 8.46,
      photoApproxShaftDiameterMeters: 5.16,
      basis:
        'LTSA repair announcement supplies 40m structural height. The city tourism page identifies the 44m value as elevation above sea level. Exact-QID OSM footprint fixes the broad base. Public library contemporary photos and historic aerial control the separate plinth/collar, square gallery, rounded capital and orange lantern; minor dimensions are reconstructed from their proportions.',
    },
    referencePages: [
      'https://ltsa.lrv.lt/lt/naujienos/netrukus-prasides-klaipedos-svyturio-remonto-darbai/',
      'https://ltsa.lrv.lt/lt/naujienos/klaipedos-svyturi-siekiama-atverti-lankytojams-ieskoma-saugaus-patekimo-sprendimo-qx4/',
      'https://klaipedatravel.lt/place/svyturys/',
      'https://klaipedatravel.lt/wp-content/uploads/2023/07/svyturys-KEPA.jpg',
      'https://www.krastogidas.lt/en/objects/klaipedos-svyturys-klaipeda-lighthouse?route=17595',
      'https://wp.krastogidas.lt/wp-content/uploads/media/public/klaipedos_svyturys/vidunofoto.lt-11.jpg',
      'https://wp.krastogidas.lt/wp-content/uploads/media/public/klaipedos_svyturys/svyturys_1.jpg',
      'https://wp.krastogidas.lt/wp-content/uploads/media/public/klaipedos_svyturys/svyturys_9.jpg',
      'https://www.openstreetmap.org/way/350070453',
    ],
    geographicProposal: {
      anchor: [21.095725009, 55.727682701],
      heading: 1.06,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/350070453',
      notes:
        'Exact-QID base center corrects the catalog coordinate approximately58m southwest. Entry faces the southeastern/eastern station forecourt, reconstructed from the public-library aerial and present mapped service court. Square gallery and the seaward glazed lantern share this station axis; facade angle is a photographed quadrant, not a survey bearing.',
    },
    limitations: [
      'Component proportions below the 40m total are reference-photo reconstructions. The exact restored2025 paint tone and movable communications equipment may change; temporary flags, cables spanning the site and detached service buildings remain outside this tower model. The preserved broad base is modeled separately from the modern shaft. No claim of optical-sector navigational accuracy.',
    ],
    previewCamera: { position: [27, 24, 40], lookAt: [0, 20, 0], fov: 47 },
    qaCameras: [
      { name: 'near-historic-base', position: [9, 5.3, 12], lookAt: [0, 3.6, 0] },
      { name: 'near-capital', position: [10, 34.8, 13], lookAt: [0, 34.7, 0] },
      { name: 'near-lantern', position: [-7.5, 38.8, 8], lookAt: [0, 37.7, 0] },
      { name: 'near-daymark', position: [-10, 22, 12], lookAt: [0, 22, 0] },
      { name: 'far-silhouette', position: [38, 24, 52], lookAt: [0, 20, 0] },
    ],
  }),
];
// Romanesque circular fort supporting the1945 lighthouse, rather than the prewar timber tower.
const fortBrick = [0.48, 0.225, 0.17],
  towerBrick = [0.58, 0.285, 0.21],
  sand = [0.79, 0.75, 0.64];
function kolobrzegWindow(out, a, y) {
  const o = transformed(out, a),
    z = Math.sqrt(4.16 ** 2 - 0.36 ** 2);
  archHead(o, {
    y,
    w: 0.72,
    h: 1.54,
    z,
    depth: 0.28,
    color: towerBrick,
    slot: 'brick',
    frame: sand,
    trim: 0.09,
  });
  for (const x of [-0.36, 0.36])
    box(o, 'limestone', [x - 0.07, y - 0.06, z - 0.27], [x + 0.07, y + 1.18, z + 0.025], sand);
  box(o, 'limestone', [-0.48, y - 0.09, z - 0.27], [0.48, y + 0.03, z + 0.07], sand);
  box(o, 'metal', [-0.018, y + 0.04, z - 0.23], [0.018, y + 1.43, z - 0.19], sand);
  box(o, 'metal', [-0.3, y + 0.65, z - 0.23], [0.3, y + 0.685, z - 0.19], sand);
}
function digit(out, d, x, y, z, scale = 0.6) {
  const paths = {
    0: [
      [0.15, 0],
      [0.8, 0],
      [1, 0.22],
      [1, 0.8],
      [0.8, 1],
      [0.15, 1],
      [0, 0.8],
      [0, 0.22],
      [0.15, 0],
    ],
    1: [
      [0.17, 0.8],
      [0.5, 1],
      [0.5, 0],
    ],
    3: [
      [0, 0.9],
      [0.2, 1],
      [0.8, 1],
      [1, 0.85],
      [1, 0.67],
      [0.6, 0.5],
      [1, 0.35],
      [1, 0.15],
      [0.8, 0],
      [0.1, 0],
      [0, 0.1],
    ],
    4: [
      [0.85, 0],
      [0.85, 1],
      [0, 0.27],
      [1, 0.27],
    ],
    5: [
      [1, 1],
      [0.03, 1],
      [0.03, 0.55],
      [0.78, 0.55],
      [1, 0.4],
      [1, 0.15],
      [0.8, 0],
      [0.1, 0],
      [0, 0.1],
    ],
    8: [
      [0.2, 0.5],
      [0, 0.68],
      [0, 0.85],
      [0.2, 1],
      [0.8, 1],
      [1, 0.85],
      [1, 0.68],
      [0.8, 0.5],
      [0.2, 0.5],
      [0, 0.32],
      [0, 0.15],
      [0.2, 0],
      [0.8, 0],
      [1, 0.15],
      [1, 0.32],
      [0.8, 0.5],
    ],
    9: [
      [0.02, 0.1],
      [0.22, 0],
      [0.77, 0.02],
      [1, 0.28],
      [1, 0.81],
      [0.8, 1],
      [0.2, 1],
      [0, 0.81],
      [0, 0.6],
      [0.2, 0.44],
      [0.78, 0.44],
      [1, 0.6],
    ],
    '-': [
      [0, 0.5],
      [1, 0.5],
    ],
  };
  const ps = paths[d];
  if (ps)
    path(
      out,
      ps.map(([u, v]) => [x + u * scale * 0.53, y + v * scale, z]),
      'metal',
      black,
      0.028,
    );
}
function dateOnDrum(out, text, angle, y, r) {
  const step = 0.42,
    start = -(text.length * step) / 2;
  for (let i = 0; i < text.length; i++) {
    const a = angle + (start + i * step) / r,
      o = transformed(out, a);
    digit(o, text[i], 0, y, r + 0.06, 0.59);
  }
}
function kolobrzegRelief(out) {
  const o = transformed(out, Math.PI / 2),
    z = 4.24,
    c = [0.18, 0.19, 0.15];
  // Raised maritime memorial: anchor, wreath and folded flag planes, reconstructed from the operator's lit facade.
  tube(o, 'metal', [0, 15.85, z], [0, 17.75, z], 0.075, c, 12);
  tube(o, 'metal', [-0.7, 17.2, z], [0.7, 17.2, z], 0.06, c, 10);
  path(
    o,
    Array.from({ length: 25 }, (_, i) => {
      const a = Math.PI + (i * Math.PI) / 24;
      return [0.95 * Math.cos(a), 16.67 + 0.91 * Math.sin(a), z + 0.035];
    }),
    'metal',
    c,
    0.1,
  );
  for (const side of [-1, 1]) {
    path(
      o,
      [
        [0, 16.02, z],
        [side * 0.88, 16.17, z],
        [side * 1.02, 16.62, z],
      ],
      'metal',
      c,
      0.08,
    );
    for (let i = 0; i < 6; i++)
      sphere(
        o,
        'metal',
        [side * (0.25 + i * 0.105), 15.65 + i * 0.09, z + 0.1],
        [0.13, 0.07, 0.045],
        c,
        10,
        6,
      );
  }
  path(
    o,
    Array.from({ length: 33 }, (_, i) => [
      0.26 * Math.cos((i * TAU) / 32),
      17.8 + 0.26 * Math.sin((i * TAU) / 32),
      z,
    ]),
    'metal',
    c,
    0.055,
  );
  for (const side of [-1, 1]) {
    const ps = [
      [side * 0.16, 17.62, z + 0.04],
      [side * 1.02, 17.23, z + 0.12],
      [side * 0.91, 16.68, z + 0.16],
      [side * 0.29, 17.02, z + 0.1],
    ];
    if (normalFor(...ps.slice(0, 3))[2] < 0) ps.reverse();
    quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), c);
  }
}
export function buildKolobrzeg(out) {
  lathe(
    out,
    'granite',
    [
      [0, 8.45],
      [0.18, 8.45],
    ],
    [0.42, 0.4, 0.36],
    192,
  );
  const openings = [
    {
      angle: 0,
      y: 0.18,
      w: 1.65,
      h: 2.18,
      depth: 0.38,
      trim: 0.03,
      trimColor: fortBrick,
      trimSlot: 'brick',
    },
    ...Array.from({ length: 10 }, (_, i) => ({
      angle: (i * TAU) / 10,
      y: 3.15,
      w: 1.36,
      h: 0.74,
      depth: 0.48,
      trim: 0.04,
      trimColor: fortBrick,
      trimSlot: 'brick',
    })),
    ...[-1.15, 1.15, Math.PI].map((angle) => ({
      angle,
      y: 0.65,
      w: 1.58,
      h: 0.6,
      depth: 0.45,
      trim: 0.04,
      trimColor: fortBrick,
      trimSlot: 'brick',
    })),
  ];
  recessShell(out, {
    profile: [
      [0.18, 8.38],
      [5.69, 8.38],
    ],
    holes: openings,
    slot: 'brick',
    color: fortBrick,
    segments: 240,
  });
  for (const h of openings) {
    const o = transformed(out, h.angle),
      z = Math.sqrt(8.38 ** 2 - (h.w / 2) ** 2);
    archHead(o, { ...h, z, slot: 'brick', color: fortBrick, rise: h.w * 0.16, trim: 0 });
    if (h.w > 1.5 && h.y > 0.2) {
      for (let x = -h.w * 0.42; x < h.w * 0.45; x += 0.23)
        tube(o, 'metal', [x, h.y, z - 0.33], [x, h.y + h.h - 0.06, z - 0.33], 0.018, black, 8);
    }
  }
  // Radial brick buttresses remain proud of the round fort walls.
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) * TAU) / 8,
      o = transformed(out, a);
    box(o, 'brick', [-0.22, 0.17, 8.18], [0.22, 5.65, 8.58], fortBrick);
  }
  ring(out, 'limestone', 5.69, 4.12, 8.58, 0.19, [0.51, 0.5, 0.44], 192);
  ring(out, 'granite', 5.87, 4.12, 8.43, 0.06, [0.48, 0.47, 0.41], 192);
  for (let i = 0; i < 16; i++) {
    const o = transformed(out, (i * TAU) / 16);
    box(o, 'limestone', [-0.38, 5.92, 8.06], [0.38, 6.12, 8.43], sand);
  }
  const shaftHoles = [];
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (const y of [7.05, 10.23, 13.41])
      shaftHoles.push({
        angle: a,
        y,
        w: 0.72,
        h: 1.54,
        depth: 0.28,
        trim: 0,
        trimColor: towerBrick,
        trimSlot: 'brick',
      });
  // Filter default rectangles; arched stone surrounds are added below.
  shell(
    {
      addQuad(s, r, ...a) {
        if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
      },
      addTriangle(...a) {
        out.addTriangle(...a);
      },
    },
    {
      profile: [
        [5.87, 4.16],
        [19.32, 4.16],
      ],
      slot: 'brick',
      color: towerBrick,
      holes: shaftHoles,
      segments: 224,
    },
  );
  for (const h of shaftHoles) kolobrzegWindow(out, h.angle, h.y);
  // Thirty-two pale blind-arcade moldings are an essential part of the tower silhouette.
  for (let i = 0; i < 32; i++) {
    const a = ((i + 0.5) * TAU) / 32,
      o = transformed(out, a),
      w = 0.65,
      z = 4.19,
      y = 17.2;
    for (const x of [-w / 2, w / 2])
      box(o, 'limestone', [x - 0.045, y, z - 0.025], [x + 0.045, y + 0.25, z + 0.035], sand);
    path(
      o,
      Array.from({ length: 25 }, (_, j) => [
        (w / 2) * Math.cos((j * Math.PI) / 24),
        y + 0.25 + (w / 2) * Math.sin((j * Math.PI) / 24),
        z + 0.028,
      ]),
      'limestone',
      sand,
      0.052,
    );
    box(
      o,
      'limestone',
      [-w / 2 - 0.045, y - 0.035, z - 0.025],
      [w / 2 + 0.045, y + 0.035, z + 0.035],
      sand,
    );
  }
  ring(out, 'brick', 18.98, 3.95, 4.22, 0.28, towerBrick, 192);
  ring(out, 'limestone', 19.26, 1.4, 4.47, 0.17, sand, 192);
  ring(out, 'metal', 19.43, 1.43, 4.51, 0.065, [0.35, 0.34, 0.29], 192);
  roundRail(out, 4.22, 19.5, 1.02, 120, sand);
  // Eight white pillars encircle the glazed watch room and carry the upper lantern balcony.
  const c = sand;
  for (let i = 0; i < 8; i++) {
    const p = P(2.94, 0, ((i + 0.5) * TAU) / 8),
      o = transformed(out, 0, p);
    lathe(
      o,
      'plaster',
      [
        [19.49, 0.25],
        [19.67, 0.25],
        [19.77, 0.18],
        [22.11, 0.18],
        [22.18, 0.26],
      ],
      c,
      40,
    );
  }
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16,
      b = ((i + 1) * TAU) / 16,
      ps = [P(1.89, 19.51, a), P(1.89, 19.51, b), P(1.89, 22.2, b), P(1.89, 22.2, a)];
    quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.65, 0.78, 0.78]);
    tube(out, 'metal', P(1.92, 19.51, a), P(1.92, 22.2, a), 0.028, c, 8);
  }
  for (const y of [19.55, 20.47, 21.41, 22.17]) ring(out, 'metal', y, 1.86, 1.94, 0.037, c, 128);
  // Watch-room access stair is visible through the transparent enclosure.
  for (let i = 0; i < 14; i++) {
    const a = i * 0.34,
      p = P(0.85, 19.54 + i * 0.17, a),
      o = transformed(out, a);
    box(o, 'metal', [-0.32, p[1], 0.4], [0.32, p[1] + 0.07, 1.27], [0.35, 0.37, 0.34]);
  }
  ring(out, 'plaster', 22.18, 1.47, 3.23, 0.17, c, 144);
  ring(out, 'metal', 22.34, 1.47, 3.27, 0.075, c, 144);
  roundRail(out, 3.03, 22.42, 0.99, 84, c);
  lathe(
    out,
    'metal',
    [
      [22.4, 1.68],
      [23.35, 1.68],
    ],
    white,
    128,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      b = ((i + 1) * TAU) / 12,
      open = Math.cos((a + b) / 2) < 0.5,
      ps = [P(1.68, 23.35, a), P(1.68, 23.35, b), P(1.68, 24.51, b), P(1.68, 24.51, a)];
    quad(
      out,
      open ? 'glassClear' : 'metal',
      ps,
      normalFor(...ps.slice(0, 3)),
      open ? [0.7, 0.84, 0.82] : white,
    );
    tube(out, 'metal', P(1.705, 22.45, a), P(1.705, 24.53, a), 0.035, c, 8);
  }
  ring(out, 'metal', 24.48, 1.63, 1.9, 0.1, c, 128);
  const roof = [
    [24.55, 2.06],
    [24.63, 1.99],
    [25.07, 1.26],
    [25.79, 0.15],
    [25.91, 0.08],
  ];
  lathe(out, 'metal', roof, [0.28, 0.3, 0.28], 128);
  roofSeams(out, roof, 12, [0.39, 0.4, 0.36]);
  tube(out, 'metal', [0, 25.9, 0], [0, 26, 0], 0.018, black, 8);
  lathe(
    out,
    'metal',
    [
      [22.43, 0.26],
      [23.54, 0.26],
    ],
    c,
    48,
  );
  lathe(
    out,
    'glassClear',
    [
      [23.54, 0.48],
      [24.13, 0.48],
    ],
    [0.65, 0.87, 0.85],
    80,
  );
  for (let y = 23.55; y < 24.12; y += 0.065) ring(out, 'metal', y, 0.45, 0.49, 0.012, c, 64);
  // Main mapped entrance, curved canopy and small brick guard booth adjoining the fort.
  panel(out, 'wood', -0.76, 0.76, 0.22, 2.28, 7.98, black);
  for (const x of [-0.75, 0.75])
    box(out, 'brick', [x - 0.18, 0.18, 8.12], [x + 0.18, 2.48, 8.57], fortBrick);
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 20,
      b = -Math.PI / 2 + ((i + 1) * Math.PI) / 20,
      p = [1.33 * Math.sin(a), 2.48 + 0.36 * Math.cos(a), 8.18],
      q = [1.33 * Math.sin(b), 2.48 + 0.36 * Math.cos(b), 8.18];
    const ps = [p, q, [q[0], q[1], 9.66], [p[0], p[1], 9.66]];
    if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
    quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.73, 0.79, 0.72]);
    if (i % 4 === 0) tube(out, 'metal', p, [p[0], p[1], 9.66], 0.021, black, 8);
  }
  for (const z of [8.18, 9.66])
    path(
      out,
      Array.from({ length: 33 }, (_, i) => [
        1.33 * Math.sin(-Math.PI / 2 + (i * Math.PI) / 32),
        2.48 + 0.36 * Math.cos(-Math.PI / 2 + (i * Math.PI) / 32),
        z,
      ]),
      'metal',
      black,
      0.025,
    );
  const booth = transformed(out, 0, [2.33, 0, 8.23]);
  box(booth, 'brick', [-0.68, 0, -0.64], [0.68, 2.59, 0.64], fortBrick);
  for (const sign of [-1, 1]) {
    const ps = [
      [0, 3.2, -0.79],
      [0, 3.2, 0.79],
      [sign * 0.84, 2.57, 0.79],
      [sign * 0.84, 2.57, -0.79],
    ];
    if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
    quad(booth, 'tiles', ps, normalFor(...ps.slice(0, 3)), [0.49, 0.23, 0.15]);
  }
  for (const z of [-0.64, 0.64]) {
    const ps = [
      [-0.68, 2.58, z],
      [0.68, 2.58, z],
      [0, 3.13, z],
    ];
    if (normalFor(...ps)[2] * z < 0) ps.reverse();
    booth.addTriangle(
      'brick',
      'metric:uv',
      ps,
      normalFor(...ps),
      ps.map((p) => [p[0], p[1]]),
      fortBrick,
    );
  }
  panel(booth, 'glass', -0.17, 0.17, 0.85, 1.47, 0.653, [0.15, 0.19, 0.16]);
  dateOnDrum(out, '1939-1945', 0, 16.14, 4.16);
  dateOnDrum(out, '1000-1945', Math.PI, 16.14, 4.16);
  kolobrzegRelief(out);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const o = transformed(out, a);
    beam(o, 'metal', [0, 19.36, 4.25], [0, 19.36, 5.0], 0.065, 0.065, black);
    sphere(o, 'metal', [0, 19.24, 5.0], [0.2, 0.15, 0.2], sand, 20, 10);
  }
}
lighthouseSouthBalticStudies.push(
  lighthouseStudy({
    id: 'N0677',
    key: 'kolobrzeg_lighthouse',
    title: 'Kołobrzeg Lighthouse',
    wikidataId: 'Q11309665',
    build: buildKolobrzeg,
    metricTriangleUv: true,
    size: [18, 26, 19],
    visualBrief:
      'Current red-brick lighthouse rising from a broad circular Fort Ujście redoubt, with recessed gun ports, buttresses, stone-capped roof terrace, narrow round-headed tower windows, blind arcade, two raised wartime date inscriptions, maritime memorial relief, white open colonnade, two galleries and a pointed metal lantern cap.',
    sourceFacts: {
      heightMeters: 26,
      mappedRedoubtDiameterMeters: 16.85,
      mappedShaftDiameterMeters: 8.32,
      basis:
        'Municipal operator publishes26m total and1945 construction on the1770–1774fort. Exact-QID tower and underlying redoubt outlines supply plan sizes. Operator current close and aerial photographs control the colonnade, arcaded frieze, date lettering, entrance canopy, booth and fort openings; internal tier heights and small relief details are photo-proportioned.',
    },
    referencePages: [
      'https://latarnia.kolobrzeg.eu/kontaktlatarnia',
      'https://latarnia.kolobrzeg.eu/historia',
      'https://latarnia.kolobrzeg.eu/',
      'https://latarnia.kolobrzeg.eu/media/photos/10800/xxl.jpg',
      'https://latarnia.kolobrzeg.eu/media/photos/10790/xxl.jpg',
      'https://latarnia.kolobrzeg.eu/media/photos/10798/xxl.jpg',
      'https://www.openstreetmap.org/way/300384923',
      'https://www.openstreetmap.org/way/294823599',
      'https://www.openstreetmap.org/node/4426764796',
    ],
    geographicProposal: {
      anchor: [15.554236107, 54.186390113],
      heading: Math.atan2(
        (15.5542969 - 15.554236107) * Math.cos((54.186390113 * Math.PI) / 180),
        -(54.1863252 - 54.186390113),
      ),
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/4426764796',
      notes:
        'Exact-QID lighthouse circle and central fort redoubt share the model origin. Explicit main-entry node4426764796 fixes native+Z toward south-southeast; booth and canopy follow the operator entry photograph. Ground datum is the surrounding fort terrace, not the lower quay. Wider fort retaining walls and the river remain map/site context.',
    },
    limitations: [
      'Published26m total and mapped diameters constrain a component reconstruction. Brick course tint, minor restored masonry, service lights and relief linework use shared Molen material style; the maritime memorial is original simplified raised geometry, not a scan. Outer fort landscape terraces, market stalls and detached harbor buildings are not duplicated. Navigational lens performance and historic light bearings are not simulated.',
    ],
    previewCamera: { position: [32, 21, 37], lookAt: [0, 12, 0], fov: 44 },
    qaCameras: [
      { name: 'near-fort-entry', position: [14, 6.2, 20], lookAt: [0, 3.6, 5] },
      { name: 'near-arcade-dates', position: [9, 17, 13], lookAt: [0, 16.5, 0] },
      { name: 'near-colonnade', position: [9, 22, 11], lookAt: [0, 21.3, 0] },
      { name: 'near-lantern', position: [-7, 25, 8], lookAt: [0, 24, 0] },
      { name: 'far-silhouette', position: [41, 24, 45], lookAt: [0, 12, 0] },
    ],
  }),
);
const skagenBrick = [0.51, 0.38, 0.265],
  skagenWall = [0.82, 0.81, 0.735],
  skagenFrame = [0.18, 0.24, 0.19],
  skagenMetal = [0.39, 0.415, 0.4];
function skagenPane(out, h, z) {
  const c = skagenFrame,
    o = transformed(out, 0, [h.x, 0, 0]),
    w = h.w / 2,
    d = h.depth ?? 0.24;
  archHead(o, {
    y: h.y,
    w: h.w,
    h: h.h,
    z: z + 0.007,
    depth: d,
    color: skagenWall,
    rise: 0.13,
    trim: 0.025,
    frame: c,
  });
  for (const x of [-w, w])
    box(
      o,
      'wood',
      [x - 0.035, h.y, z - d + 0.008],
      [x + 0.035, h.y + h.h - 0.11, z - d + 0.075],
      c,
    );
  for (const y of [h.y, h.y + h.h * 0.48, h.y + h.h * 0.78])
    box(o, 'wood', [-w, y - 0.025, z - d + 0.008], [w, y + 0.025, z - d + 0.072], c);
  box(o, 'wood', [-0.025, h.y, z - d + 0.008], [0.025, h.y + h.h - 0.02, z - d + 0.072], c);
  box(o, 'limestone', [-w - 0.11, h.y - 0.1, z - 0.12], [w + 0.11, h.y - 0.025, z + 0.11], sand);
  if (h.door) panel(o, 'wood', -w + 0.04, w - 0.04, h.y + 0.03, h.y + 0.75, z - d + 0.09, c);
}
function skagenHouse(out, { cx = 0, cz = 0, rx, rz, eave, ridge, gable = false, windows }) {
  const o = transformed(out, 0, [cx, 0, cz]);
  box(o, 'granite', [-rx, 0, -rz], [rx, 0.29, rz], [0.14, 0.155, 0.14]);
  for (let f = 0; f < 4; f++) {
    const face = transformed(o, (f * Math.PI) / 2),
      z = f % 2 ? rx : rz,
      half = f % 2 ? rz : rx,
      hs = windows.filter((h) => h.face === f).map((h) => ({ ...h, trim: 0, depth: 0.24 }));
    piercedFacade(face, {
      half,
      z,
      y0: 0.29,
      y1: eave,
      holes: hs,
      slot: 'plaster',
      color: skagenWall,
    });
    for (const h of hs) skagenPane(face, h, z);
  }
  for (const y of [eave - 0.14, eave]) {
    box(o, 'plaster', [-rx - 0.09, y, -rz - 0.09], [rx + 0.09, y + 0.08, rz + 0.09], skagenWall);
  }
  const X = rx + 0.22,
    Z = rz + 0.22;
  if (ridge - eave < 0.5) {
    box(o, 'metal', [-X, eave, -Z], [X, eave + 0.11, Z], skagenMetal);
    for (let x = -X + 0.4; x < X; x += 0.45)
      tube(o, 'metal', [x, eave + 0.125, -Z], [x, eave + 0.125, Z], 0.014, skagenMetal, 6);
  } else if (gable) {
    for (const side of [-1, 1]) {
      const ps = [
        [0, ridge, -Z],
        [0, ridge, Z],
        [side * X, eave, Z],
        [side * X, eave, -Z],
      ];
      if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
      quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), skagenMetal);
      for (let z = -Z; z < Z; z += 0.45)
        tube(o, 'metal', [0, ridge + 0.015, z], [side * X, eave + 0.015, z], 0.014, skagenMetal, 6);
    }
    for (const side of [-1, 1]) {
      const ps = [
        [-rx, eave, side * rz],
        [rx, eave, side * rz],
        [0, ridge - 0.07, side * rz],
      ];
      if (normalFor(...ps)[2] * side < 0) ps.reverse();
      o.addTriangle(
        'plaster',
        'metric:uv',
        ps,
        normalFor(...ps),
        ps.map((p) => [p[0], p[1]]),
        skagenWall,
      );
      const face = transformed(o, side < 0 ? Math.PI : 0);
      panel(face, 'glass', -0.27, 0.27, eave + 0.33, eave + 1.14, rz + 0.012, [0.18, 0.22, 0.2]);
      for (const x of [-0.28, 0.28])
        box(
          face,
          'wood',
          [x - 0.03, eave + 0.3, rz + 0.018],
          [x + 0.03, eave + 1.16, rz + 0.07],
          skagenFrame,
        );
      for (const y of [eave + 0.31, eave + 0.73, eave + 1.14])
        box(
          face,
          'wood',
          [-0.29, y - 0.025, rz + 0.018],
          [0.29, y + 0.025, rz + 0.07],
          skagenFrame,
        );
    }
  } else {
    const ridgeX = rx - rz + 0.3,
      faces = [
        [
          [-X, eave, -Z],
          [X, eave, -Z],
          [ridgeX, ridge, 0],
          [-ridgeX, ridge, 0],
        ],
        [
          [X, eave, Z],
          [-X, eave, Z],
          [-ridgeX, ridge, 0],
          [ridgeX, ridge, 0],
        ],
        [
          [-X, eave, Z],
          [-X, eave, -Z],
          [-ridgeX, ridge, 0],
        ],
        [
          [X, eave, -Z],
          [X, eave, Z],
          [ridgeX, ridge, 0],
        ],
      ];
    for (const ps of faces) {
      if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
      if (ps.length === 4) quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), skagenMetal);
      else
        o.addTriangle(
          'metal',
          'metric:uv',
          ps,
          normalFor(...ps),
          ps.map((p) => [p[0], p[2]]),
          skagenMetal,
        );
    }
    for (let x = -X + 0.12; x < X - 0.08; x += 0.45) {
      const yEnd =
          Math.abs(x) <= ridgeX
            ? ridge
            : eave + ((ridge - eave) * (X - Math.abs(x))) / (X - ridgeX),
        zEnd = Math.abs(x) <= ridgeX ? 0 : (Z * (Math.abs(x) - ridgeX)) / (X - ridgeX);
      for (const side of [-1, 1])
        tube(
          o,
          'metal',
          [x, eave + 0.018, side * Z],
          [x, yEnd + 0.018, side * zEnd],
          0.013,
          skagenMetal,
          6,
        );
    }
    for (const x of [-5.05, 5.05]) {
      box(o, 'plaster', [x - 0.46, ridge - 0.25, -0.4], [x + 0.46, ridge + 1.15, 0.4], skagenWall);
      box(o, 'limestone', [x - 0.53, ridge + 1.12, -0.47], [x + 0.53, ridge + 1.25, 0.47], sand);
      box(o, 'metal', [x - 0.28, ridge + 1.251, -0.23], [x + 0.28, ridge + 1.27, 0.23], black);
    }
  }
  // Gutters and downpipes follow the renovated standing-seam roof edges.
  for (const side of [-1, 1]) {
    tube(
      o,
      'metal',
      [-rx - 0.1, eave + 0.035, side * (rz + 0.17)],
      [rx + 0.1, eave + 0.035, side * (rz + 0.17)],
      0.047,
      skagenMetal,
      10,
    );
    for (const x of [-rx + 0.13, rx - 0.13])
      path(
        o,
        [
          [x, eave, side * (rz + 0.17)],
          [x, eave - 0.33, side * (rz + 0.07)],
          [x, 0.19, side * (rz + 0.07)],
          [x, 0.08, side * (rz + 0.42)],
        ],
        'metal',
        skagenMetal,
        0.037,
      );
  }
}
function skagenMonogram(out) {
  const o = transformed(out, Math.PI),
    z = 3.765,
    red = [0.53, 0.065, 0.047],
    gold = [0.61, 0.45, 0.16];
  // Original cast-letter curves reproduce the visible FR VII /1858 badge without a bitmap decal.
  const bez = (a, b, c, d, n = 20) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        s = 1 - t;
      return [
        a[0] * s * s * s + 3 * b[0] * s * s * t + 3 * c[0] * s * t * t + d[0] * t * t * t,
        a[1] * s * s * s + 3 * b[1] * s * s * t + 3 * c[1] * s * t * t + d[1] * t * t * t,
        z,
      ];
    });
  path(
    o,
    [
      [-0.35, 3.32, z],
      [-0.35, 5.04, z],
      [0.8, 5.04, z],
    ],
    'metal',
    red,
    0.055,
  );
  path(
    o,
    [
      [-0.35, 4.32, z],
      [0.55, 4.32, z],
    ],
    'metal',
    red,
    0.047,
  );
  path(o, bez([-0.35, 5.04], [1.03, 5.14], [0.68, 4.13], [-0.35, 4.3]), 'metal', red, 0.058);
  path(o, bez([-0.31, 4.3], [0.91, 4.4], [0.52, 2.9], [1.02, 3.38]), 'metal', red, 0.058);
  path(o, bez([-0.35, 3.34], [-1.0, 2.92], [-0.8, 3.45], [-0.64, 3.6]), 'metal', red, 0.051);
  path(o, bez([-0.35, 5.02], [-0.98, 5.5], [-1.12, 4.45], [-0.45, 4.73]), 'metal', red, 0.05);
  for (const [x, letter] of [
    [-0.13, 'V'],
    [0.1, 'I'],
    [0.27, 'I'],
  ]) {
    if (letter === 'V')
      path(
        o,
        [
          [x - 0.07, 3.52, z + 0.03],
          [x + 0.02, 3.14, z + 0.03],
          [x + 0.12, 3.52, z + 0.03],
        ],
        'metal',
        black,
        0.025,
      );
    else tube(o, 'metal', [x, 3.16, z + 0.03], [x, 3.5, z + 0.03], 0.025, black, 8);
  }
  const crownY = 5.63;
  path(
    o,
    [
      [-0.56, crownY, z],
      [-0.65, crownY + 0.45, z],
      [-0.36, crownY + 0.25, z],
      [0, crownY + 0.66, z],
      [0.36, crownY + 0.25, z],
      [0.65, crownY + 0.45, z],
      [0.56, crownY, z],
      [-0.56, crownY, z],
    ],
    'metal',
    gold,
    0.049,
  );
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    path(
      o,
      Array.from({ length: 21 }, (_, j) => {
        const t = (j * Math.PI) / 20;
        return [
          Math.cos(t) * 0.65 * Math.cos(angle),
          crownY + 0.3 + Math.sin(t) * 0.51,
          z + 0.08 + Math.cos(t) * 0.09 * Math.sin(angle),
        ];
      }),
      'metal',
      gold,
      0.028,
    );
  }
  tube(o, 'metal', [0, 6.28, z], [0, 6.65, z], 0.025, gold, 8);
  tube(o, 'metal', [-0.12, 6.51, z], [0.12, 6.51, z], 0.022, gold, 8);
  for (let i = 0; i < 4; i++) digit(o, '1858'[i], -0.74 + i * 0.39, 2.47, z, 0.53);
}
export function buildSkagen(out) {
  lathe(
    out,
    'granite',
    [
      [0, 4.15],
      [0.16, 4.15],
      [0.43, 3.96],
      [0.98, 3.96],
      [1.22, 3.75],
    ],
    [0.55, 0.54, 0.48],
    192,
  );
  // Visible foundation block joints are separate thin grooves rather than overscaled wall courses.
  for (let i = 0; i < 24; i++)
    path(
      out,
      [P(3.97, 0.43, (i * TAU) / 24), P(3.97, 1.02, (i * TAU) / 24)],
      'granite',
      [0.35, 0.35, 0.32],
      0.009,
    );
  const radius = (y) => (y <= 7.4 ? 3.75 : 3.75 - ((y - 7.4) * 0.82) / (37.55 - 7.4)),
    hs = [];
  for (let i = 0; i < 4; i++) {
    for (const a of [Math.PI - 0.55, -0.55])
      hs.push({
        angle: a,
        y: 8.0 + i * 7.12,
        w: 0.58,
        h: 1.26,
        depth: 0.28,
        trim: 0,
        trimSlot: 'brick',
        trimColor: skagenBrick,
      });
    for (const a of [Math.PI + 0.58, 0.58])
      hs.push({
        angle: a,
        y: 11.4 + i * 7.12,
        w: 0.58,
        h: 1.26,
        depth: 0.28,
        trim: 0,
        trimSlot: 'brick',
        trimColor: skagenBrick,
      });
  }
  const wrapper = {
    addQuad(s, r, ...a) {
      if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
    },
    addTriangle(...a) {
      out.addTriangle(...a);
    },
  };
  shell(wrapper, {
    profile: [
      [1.22, 3.75],
      [7.4, 3.75],
      [37.55, 2.93],
    ],
    holes: hs,
    slot: 'brick',
    color: skagenBrick,
    segments: 240,
  });
  for (const h of hs) {
    const o = transformed(out, h.angle),
      z = Math.sqrt(radius(h.y + h.h / 2) ** 2 - (h.w / 2) ** 2);
    archHead(o, { ...h, z, slot: 'brick', color: skagenBrick, trim: 0.032, frame: skagenFrame });
    for (const x of [-0.29, 0.29])
      box(
        o,
        'brick',
        [x - 0.065, h.y, z - 0.27],
        [x + 0.065, h.y + 0.97, z + 0.055],
        skagenBrick.map((v) => v * 1.17),
      );
    for (const y of [h.y + 0.41, h.y + 0.82])
      box(o, 'metal', [-0.27, y - 0.021, z - 0.24], [0.27, y + 0.021, z - 0.195], skagenFrame);
    box(o, 'limestone', [-0.39, h.y - 0.095, z - 0.2], [0.39, h.y - 0.035, z + 0.15], sand);
  }
  ring(out, 'limestone', 7.25, 3.7, 3.88, 0.16, sand, 192);
  // Fine external iron hoops, with small tie plates visible in the owner elevations.
  for (let y = 9.1; y < 36.8; y += 2.3) {
    const r = radius(y);
    ring(out, 'metal', y, r - 0.009, r + 0.026, 0.042, [0.35, 0.32, 0.26], 192);
    for (const a of [0.08, Math.PI + 0.08])
      box(
        transformed(out, a),
        'metal',
        [-0.12, y - 0.1, r + 0.025],
        [0.12, y + 0.13, r + 0.044],
        [0.34, 0.3, 0.245],
      );
  }
  skagenMonogram(out);
  lathe(
    out,
    'limestone',
    [
      [37.48, 2.96],
      [37.73, 3.07],
      [37.94, 3.38],
      [38.2, 3.61],
      [38.37, 3.75],
      [38.69, 3.75],
      [38.82, 3.9],
    ],
    sand,
    192,
  );
  ring(out, 'limestone', 38.8, 1.91, 3.91, 0.21, [0.72, 0.71, 0.64], 192);
  roundRail(out, 3.8, 39.03, 1.06, 144, [0.3, 0.23, 0.16]);
  lathe(
    out,
    'plaster',
    [
      [39.01, 2.59],
      [39.73, 2.59],
    ],
    skagenWall,
    144,
  );
  for (let i = 0; i < 24; i++)
    tube(
      out,
      'metal',
      P(2.6, 39.06, (i * TAU) / 24),
      P(2.6, 39.72, (i * TAU) / 24),
      0.019,
      skagenMetal,
      8,
    );
  const y0 = 39.77,
    y1 = 43.13,
    r = 2.08,
    n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      ps = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
    quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.67, 0.82, 0.8]);
  }
  // Three stacked diamond tiers, matching the exceptionally clear authority lantern photo.
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12,
        b = ((i + 1) * TAU) / 12,
        yy = y0 + (j * (y1 - y0)) / 3,
        dy = (y1 - y0) / 3;
      path(
        out,
        Array.from({ length: 9 }, (_, k) => P(r + 0.026, yy + (dy * k) / 8, a + ((b - a) * k) / 8)),
        'metal',
        skagenMetal,
        0.031,
      );
      path(
        out,
        Array.from({ length: 9 }, (_, k) => P(r + 0.026, yy + (dy * k) / 8, b - ((b - a) * k) / 8)),
        'metal',
        skagenMetal,
        0.031,
      );
    }
  for (const y of [y0, y0 + (y1 - y0) / 3, y0 + (2 * (y1 - y0)) / 3, y1])
    ring(out, 'metal', y - 0.018, r - 0.015, r + 0.085, 0.045, skagenMetal, 144);
  const dome = [
    [43.15, 2.46],
    [43.26, 2.36],
    [43.39, 2.08],
    [43.62, 1.91],
    [43.97, 1.79],
    [44.3, 1.56],
    [44.55, 1.26],
    [44.73, 0.87],
    [44.85, 0.39],
    [45.01, 0.28],
    [45.13, 0.23],
  ];
  lathe(out, 'metal', dome, skagenMetal, 192);
  roofSeams(out, dome, 12, [0.48, 0.49, 0.45]);
  sphere(out, 'metal', [0, 45.43, 0], [0.32, 0.32, 0.32], skagenMetal, 48, 24);
  tube(out, 'metal', [0, 45.73, 0], [0, 46, 0], 0.013, black, 8);
  // Large rotating lens visible through the published diamond glazing.
  lathe(
    out,
    'metal',
    [
      [39.74, 0.55],
      [40.42, 0.55],
    ],
    white,
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [40.44, 0.55],
      [40.68, 0.89],
      [41.25, 1.14],
      [41.62, 1.14],
      [42.3, 0.64],
      [42.68, 0.25],
    ],
    [0.58, 0.84, 0.77],
    96,
  );
  for (let y = 40.6; y < 42.55; y += 0.12) {
    const r = y < 41.25 ? 0.89 + (y - 40.68) * 0.44 : y < 41.62 ? 1.14 : 1.14 - (y - 41.62) * 0.77;
    ring(out, 'metal', y, Math.max(0.24, r - 0.024), r + 0.015, 0.013, [0.56, 0.64, 0.54], 96);
  }
  // Exact mapped ensemble: connector, two-storey keeper house and two rear side wings.
  const main = [];
  for (const face of [0, 2])
    for (const y of [0.76, 4.32])
      for (let i = 0; i < 7; i++) {
        const x = -8.13 + i * 2.71;
        if (face === 2 && y < 1 && Math.abs(x) < 2.1) continue;
        main.push({ face, x, y, w: 1.07, h: 1.92, door: face === 0 && i === 3 && y < 1 });
      }
  for (const face of [1, 3])
    for (const y of [0.76, 4.32])
      for (const x of [-2.65, 2.65]) main.push({ face, x, y, w: 1.05, h: 1.92 });
  skagenHouse(out, { cz: 17.28, rx: 10.47, rz: 5.47, eave: 7.2, ridge: 10.06, windows: main });
  skagenHouse(out, {
    cz: 7.56,
    rx: 2.07,
    rz: 4.3,
    eave: 3.66,
    ridge: 3.95,
    gable: false,
    windows: [
      ...[-2.55, 0, 2.55].flatMap((x) =>
        [1, 3].map((face) => ({
          face,
          x,
          y: x === 0 ? 0.24 : 0.83,
          w: x === 0 ? 1.22 : 1.12,
          h: x === 0 ? 2.66 : 2.06,
          door: x === 0,
        })),
      ),
    ],
  });
  for (const cx of [-17.04, 16.91]) {
    const ws = [];
    for (const face of [0, 2])
      for (const x of [-2.46, 0, 2.46])
        ws.push({ face, x, y: 0.36, w: x === 0 ? 1.19 : 0.88, h: 2.44, door: true });
    for (const face of [1, 3])
      for (const x of [-3.62, -1.2, 1.2, 3.62]) ws.push({ face, x, y: 0.78, w: 0.91, h: 1.48 });
    skagenHouse(out, {
      cx,
      cz: 28.31,
      rx: 4.11,
      rz: 5.57,
      eave: 3.55,
      ridge: 6.3,
      gable: true,
      windows: ws,
    });
  }
  // Courtyard enclosure ends at the two wing backs; it does not include surrounding dunes.
  for (const x of [-11.65, 11.6])
    box(out, 'plaster', [x - 0.85, 0.12, 22.69], [x + 0.85, 2.68, 23.12], skagenWall);
  box(out, 'plaster', [-12.93, 0.12, 33.56], [12.8, 1.29, 34.0], skagenWall);
  box(out, 'limestone', [-13, 1.29, 33.5], [12.9, 1.38, 34.06], sand);
  for (let x = -11.8; x < 13; x += 3.9)
    box(out, 'plaster', [x - 0.15, 0.13, 33.38], [x + 0.15, 1.49, 34.03], skagenWall);
}
lighthouseSouthBalticStudies.push(
  lighthouseStudy({
    id: 'N0678',
    key: 'skagen_lighthouse',
    title: 'Skagen Lighthouse',
    wikidataId: 'Q12000806',
    build: buildSkagen,
    metricTriangleUv: true,
    size: [43, 46, 39],
    visualBrief:
      'Unpainted tapered Dutch-clinker tower on a dressed-granite foot, external iron hoops, staggered round-headed windows, FrederickVII crown/monogram and1858 date, molded stone gallery, diamond-braced clear lantern with visible large optic, bell-shaped metal roof; restored white keeper house, attached glazed entrance corridor and two rear service wings.',
    sourceFacts: {
      heightMeters: 46,
      mappedBaseDiameterMeters: 7.49,
      mainHousePlanMeters: [20.94, 10.94],
      sideWingPlanMeters: [8.22, 11.14],
      basis:
        'Owner Realdania and operator publish46m height. Owner restoration photographs identify bare clinker, granite footing, diamond lantern bars, current white facades/green frames and standing-seam roofs; the owner monograph supplies historical material/ensemble facts. OSM exact-identity circle and attached-house/wing footprints control all building centers and axes. Tier heights and smaller fenestration dimensions are photo-proportioned.',
    },
    referencePages: [
      'https://realdania.dk/projekter/skagen-graa-fyr',
      'https://realdania.dk/viden-og-laering/vidensbibliotek/publikationer/realdania-by-og-byg/skagen-graa-fyr',
      'https://realdania.dk/-/media/realdaniadk/publikationer/by-og-byg/by-og-byg-publikationer/skagen-graa-fyr.pdf',
      'https://detgraafyr.dk/english/about-us',
      'https://www.visitdenmark.com/denmark/plan-your-trip/det-gra-fyr-lighthouse-gdk600368',
      'https://files.guidedanmark.org/files/483/311561_Det_Gr_Fyr_i_Skagen.jpg',
      'https://cdn.realdania.dk/media/tgcbpxug/4-fyrmesterbolig-og-sidebygninger.jpg',
      'https://cdn.realdania.dk/media/kgydvdix/frederik-7-monogramjpg.jpg',
      'https://cdn.realdania.dk/media/tzmddmte/foden-af-fyretjpg.jpg',
      'https://www.openstreetmap.org/way/288783225',
      'https://www.openstreetmap.org/way/484406023',
      'https://www.openstreetmap.org/way/211634779',
      'https://www.openstreetmap.org/way/211634781',
    ],
    geographicProposal: {
      anchor: [10.630184735, 57.735496379],
      heading: 2.0471309816113354,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/484406023',
      notes:
        'Native+Z follows the mapped tower-to-keeper-house connector northeast; +X spans the keeper-house long facade. Mapped main house and both side wings resolve the axis and quadrant without circular-tower ambiguity. Tower origin remains the exact-QID circle center. Tower monogram faces the exposed southwest side; ordinary site-grade terrain contact is used.',
    },
    limitations: [
      'Owner restoration photographs control current white walls, dark-green frames and metal roofs; older yellow paint and slate-roof views are used only for structural proportions. Monogram/crown are original raised curves at exterior viewing scale, not a scanned casting. Small lens/prism and roof-joint dimensions are photograph reconstructions. Detached dunes, groynes, paths, observation structures and seasonal café furniture remain map context.',
    ],
    previewCamera: { position: [61, 34, -60], lookAt: [0, 20, 10], fov: 46 },
    qaCameras: [
      { name: 'near-crown-monogram', position: [5, 5, -8], lookAt: [0, 4.6, -3.6] },
      { name: 'near-keeper-house', position: [30, 12, 43], lookAt: [0, 4, 20] },
      { name: 'near-lantern', position: [9, 43, -11], lookAt: [0, 41.8, 0] },
      { name: 'near-entrance-corridor', position: [-13, 5, 5], lookAt: [0, 2.2, 7.5] },
      { name: 'far-ensemble', position: [66, 46, 71], lookAt: [0, 16, 15] },
    ],
  }),
);
