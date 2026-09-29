/** Individually researched American/Caribbean lighthouses, with original exterior geometry. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const ivory = [0.85, 0.83, 0.73],
  pink = [0.82, 0.75, 0.7],
  green = [0.035, 0.25, 0.21],
  dark = [0.075, 0.09, 0.085];
const P = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function windowFrame(out, a, y, w, h, r, { pediment = true, color = ivory } = {}) {
  const o = transformed(out, a),
    z = Math.sqrt(r * r - (w * w) / 4) - 0.1;
  for (const x of [-w / 2, 0, w / 2])
    box(o, 'wood', [x - 0.018, y, z], [x + 0.018, y + h, z + 0.045], green);
  for (const yy of [y, y + h / 2, y + h])
    box(o, 'wood', [-w / 2, yy - 0.021, z], [w / 2, yy + 0.021, z + 0.045], green);
  if (!pediment) return;
  const zz = r + 0.015,
    yy = y + h + 0.16;
  for (const [offset, width, height, depth] of [
    [0, w + 0.37, 0.13, 0.23],
    [0.15, w + 0.48, 0.09, 0.29],
  ])
    box(
      o,
      'plaster',
      [-width / 2, yy + offset, zz - depth],
      [width / 2, yy + offset + height, zz + 0.08],
      color,
    );
  for (const s of [-1, 1]) {
    box(
      o,
      'plaster',
      [s * (w / 2 + 0.11) - 0.065, yy - 0.28, zz - 0.11],
      [s * (w / 2 + 0.11) + 0.065, yy + 0.04, zz + 0.05],
      color,
    );
    beam(
      o,
      'plaster',
      [s * (w / 2 + 0.3), yy + 0.26, zz + 0.05],
      [0, yy + 0.57, zz + 0.05],
      0.08,
      0.13,
      color,
    );
  }
  const points = [
    [-w / 2 - 0.18, yy + 0.27, zz - 0.014],
    [w / 2 + 0.18, yy + 0.27, zz - 0.014],
    [0, yy + 0.5, zz - 0.014],
  ];
  outTriangle(o, 'plaster', points, color);
  box(
    o,
    'plaster',
    [-w / 2 - 0.13, y - 0.09, zz - 0.22],
    [w / 2 + 0.13, y + 0.015, zz + 0.08],
    color,
  );
}
function outTriangle(out, slot, p, color) {
  out.addTriangle(
    slot,
    'palette:#fff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    color,
  );
}
function lanternGlass(out, y0, y1, r, color, segments = 16) {
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments,
      b = ((i + 1) * Math.PI * 2) / segments,
      p = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.17, 0.26, 0.25]);
    tube(out, 'metal', p[0], p[3], 0.026, color, 8);
  }
  for (const y of [y0, y1]) ring(out, 'metal', y, r - 0.035, r + 0.055, 0.055, color, 96);
}
function roundedCap(out, y, r, h, color) {
  const profile = Array.from({ length: 17 }, (_, i) => {
    const a = ((i / 16) * Math.PI) / 2;
    return [y + h * Math.sin(a), Math.max(0.035, r * Math.cos(a))];
  });
  lathe(out, 'metal', profile, color, 144);
  for (let i = 0; i < 16; i++)
    for (let j = 1; j < profile.length - 1; j++)
      tube(
        out,
        'metal',
        P(profile[j - 1][1] + 0.013, profile[j - 1][0], (i * Math.PI) / 8),
        P(profile[j][1] + 0.013, profile[j][0], (i * Math.PI) / 8),
        0.012,
        color,
        6,
      );
}

export function buildCalifornia(out) {
  const baseR = 2.65,
    apothem = baseR * Math.cos(Math.PI / 8),
    half = baseR * Math.sin(Math.PI / 8);
  loft(
    out,
    'plaster',
    [
      radialRing(0, 2.79, 2.79, 8, [0, 0], Math.PI / 8),
      radialRing(0.5, 2.79, 2.79, 8, [0, 0], Math.PI / 8),
    ],
    ivory,
  );
  for (let f = 0; f < 8; f++) {
    const o = transformed(out, (f * Math.PI) / 4);
    piercedFacade(o, {
      half,
      z: apothem,
      y0: 0.5,
      y1: 3.39,
      holes: f === 0 ? [{ x: 0, y: 0.51, w: 0.92, h: 2.19, depth: 0.42, trim: 0.1 }] : [],
      slot: 'plaster',
      color: pink,
    });
  }
  // Layered octagonal cornice around the pedestal.
  loft(
    out,
    'plaster',
    [
      [3.38, 2.65],
      [3.52, 2.79],
      [3.68, 2.88],
      [3.79, 2.81],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    ivory,
  );
  const r = (y) => 2.11 - ((y - 3.79) * 0.68) / (23.88 - 3.79),
    holes = [];
  // Four stair-facing ranks alternate three and four openings, as shown by the owner's opposing views.
  for (let f = 0; f < 4; f++)
    for (const y of f % 2 ? [4.38, 9.58, 14.78, 19.98] : [7, 12.2, 17.4])
      holes.push({
        angle: (f * Math.PI) / 2,
        y,
        w: 0.53,
        h: 1.14,
        depth: 0.14,
        trimSlot: 'plaster',
        trimColor: ivory,
      });
  for (let f = 0; f < 4; f++)
    holes.push({
      angle: (f * Math.PI) / 2,
      y: 22.45,
      w: 0.61,
      h: 0.7,
      depth: 0.14,
      trimSlot: 'plaster',
      trimColor: ivory,
    });
  shell(out, {
    profile: [
      [3.79, 2.11],
      [23.88, 1.43],
    ],
    holes,
    slot: 'plaster',
    color: pink,
    segments: 192,
  });
  for (const h of holes)
    windowFrame(out, h.angle, h.y, h.w, h.h, r(h.y + h.h / 2), { pediment: h.y < 22 });
  panel(out, 'wood', -0.43, 0.43, 0.52, 2.7, apothem - 0.385, [0.025, 0.045, 0.035]);
  const entry = transformed(out, 0, [0, 0, apothem]);
  for (const x of [-0.57, 0.57])
    box(entry, 'plaster', [x - 0.075, 0.5, -0.2], [x + 0.075, 2.8, 0.11], ivory);
  box(entry, 'plaster', [-0.81, 2.74, -0.1], [0.81, 2.88, 0.16], ivory);
  for (const s of [-1, 1])
    beam(entry, 'plaster', [s * 0.83, 2.91, 0.13], [0, 3.29, 0.13], 0.085, 0.13, ivory);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'limestone',
      [-0.82, i / 6, apothem + 0.92 - i * 0.31],
      [0.82, (i + 1) / 6, apothem + 1.25 - i * 0.31],
      ivory,
    );
  lathe(
    out,
    'plaster',
    [
      [23.87, 1.43],
      [24.04, 1.52],
      [24.32, 1.6],
      [24.67, 1.85],
      [24.79, 2.02],
      [24.96, 2.03],
      [25.08, 1.94],
    ],
    ivory,
    192,
  );
  shell(out, {
    profile: [
      [25.03, 1],
      [27.12, 1],
    ],
    holes: [
      {
        angle: 0,
        y: 25.08,
        w: 0.52,
        h: 1.66,
        depth: 0.15,
        trimSlot: 'metal',
        trimColor: [0.56, 0.6, 0.51],
      },
    ],
    slot: 'metal',
    color: [0.67, 0.68, 0.56],
    segments: 128,
  });
  ring(out, 'metal', 25.02, 0.96, 1.96, 0.11, [0.55, 0.58, 0.53], 128);
  railRing(out, 25.14, 1.87, 1.06, [0.54, 0.58, 0.53], 40);
  for (const y of [25.38, 26.72]) ring(out, 'metal', y, 0.99, 1.025, 0.045, [0.38, 0.43, 0.36], 96);
  ring(out, 'metal', 27.1, 0.9, 1.96, 0.1, [0.46, 0.5, 0.43], 128);
  // Small upper gallery and narrow cream drum below the green lantern.
  lathe(
    out,
    'metal',
    [
      [27.2, 1.04],
      [27.91, 1.04],
    ],
    [0.68, 0.68, 0.57],
    128,
  );
  for (let i = 0; i < 8; i++)
    box(
      transformed(out, (i * Math.PI) / 4),
      'metal',
      [-0.12, 27.35, 1.035],
      [0.12, 27.44, 1.071],
      [0.42, 0.47, 0.4],
    );
  lanternGlass(out, 27.91, 29.04, 1.04, green, 16);
  ring(out, 'metal', 29.01, 0.97, 1.22, 0.09, green, 128);
  roundedCap(out, 29.1, 1.19, 0.53, green);
  lathe(
    out,
    'metal',
    [
      [29.6, 0.19],
      [29.89, 0.19],
    ],
    green,
    48,
  );
  sphere(out, 'metal', [0, 29.97, 0], [0.13, 0.13, 0.13], green, 32, 16);
  // Published30m structure height excludes the thin vane assembly above the cap.
  tube(out, 'metal', [0, 29.86, 0], [0, 30.83, 0], 0.014, dark, 8);
  for (const y of [30.33, 30.64]) beam(out, 'metal', [-0.4, y, 0], [0.4, y, 0], 0.018, 0.022, dark);
  for (const [x, y] of [
    [-0.32, 30.3],
    [0.32, 30.59],
  ])
    box(out, 'metal', [x - 0.05, y - 0.09, -0.017], [x + 0.05, y + 0.08, 0.017], dark);
  const ladder = transformed(out, Math.PI / 2);
  for (const x of [-0.18, 0.18])
    tube(ladder, 'metal', [x, 25.18, 1.75], [x, 27.16, 1.56], 0.026, [0.45, 0.49, 0.44], 8);
  for (let y = 25.27; y < 27.12; y += 0.23)
    tube(
      ladder,
      'metal',
      [-0.18, y, 1.75 - (y - 25.18) * 0.096],
      [0.18, y, 1.75 - (y - 25.18) * 0.096],
      0.021,
      [0.45, 0.49, 0.44],
      8,
    );
}

export const lighthouseAmericasStudies = [
  lighthouseStudy({
    id: 'N0668',
    key: 'california_lighthouse',
    title: 'California Lighthouse',
    wikidataId: 'Q2279321',
    build: buildCalifornia,
    size: [6, 30.83, 7.3],
    smoothNormalSlots: ['wall', 'trim'],
    visualBrief:
      'Restored pale-rose taper over an octagonal cream-trimmed pedestal, fourteen staggered pedimented windows and four upper vents, projecting gallery cup, narrow service drum, two metal gallery decks, green domed lantern, vane and southwest entrance steps.',
    sourceFacts: {
      structureHeightMeters: 30,
      focalHeightMeters: 55,
      structureHeightExcludesVane: true,
      baseDiameterPhotoApproxMeters: 5.3,
      basis:
        'Royal Netherlands Navy2026 HP2B light4000/J6330 lists30m stone structure and55m focal elevation. Owner Monuments Fund Aruba publishes restoration history and opposed daylight/night/aerial facade photographs. Those photographs govern the14 staggered stair windows, octagonal pedestal, light-pink plaster, gallery stack and green cap; small dimensions are photograph-proportioned.',
    },
    referencePages: [
      'https://www.defensie.nl/site/binaries/site-content/collections/documents/2026/04/30/hp2b/hp2b-lichtenlijst-2026-01.pdf',
      'https://monumentenfondsaruba.org/california-lighthouse-1915/',
      'https://monumentenfondsaruba.org/the-restoration-of-the-california-lighthouse-has-been-finished/',
      'https://monumentenfondsaruba.org/wp-content/uploads/2024/10/Ligthhouse-1.jpg',
      'https://monumentenfondsaruba.org/wp-content/uploads/2024/10/Lighthouse-shot-scaled-1.jpg',
      'https://www.openstreetmap.org/node/540121391',
    ],
    geographicProposal: {
      anchor: [-70.0513486, 12.6137665],
      heading: -1.2,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/540121391',
      notes:
        'Exact-QID OSM node540121391 locates the actual tower, approximately124m northeast of the catalog coordinate near the restaurant. Local+Z entrance faces southwest toward the former keeper house/restaurant and road approach, as reconstructed from the owner aerial and entrance photographs. The octagonal base and four window ranks constrain rotation; facade bearing is photograph-derived rather than surveyed.',
    },
    limitations: [
      'The owner’s restored2016 exterior is modeled, including pale rose rather than the earlier strongly yellow paint. Diameter, moldings and trim are photo-proportioned; no secondary claim of a7.5m lantern diameter is accepted because it conflicts with the owner photographs. The30m navigation-list height excludes the thin weather-vane extension. Detached restaurant and site landscaping remain map features.',
    ],
    qaCameras: [
      { name: 'near-pediments', position: [6.2, 12.5, 8.1], lookAt: [0, 12.6, 0] },
      { name: 'near-entry', position: [6.3, 4.8, 8.4], lookAt: [0, 1.8, 1.2] },
      { name: 'near-lantern', position: [5.6, 28.2, 7.2], lookAt: [0, 27.3, 0] },
      { name: 'far-silhouette', position: [24, 19, 35], lookAt: [0, 15.4, 0] },
    ],
  }),
];
