/** Coastal authority references drive the distinct exterior construction of these three towers. */
import { beam } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import {
  lantern,
  lathe,
  panel,
  piercedFacade,
  railRing,
  transformed,
} from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const gray = [0.58, 0.55, 0.46],
  pale = [0.77, 0.76, 0.69],
  dark = [0.07, 0.085, 0.09],
  red = [0.55, 0.12, 0.075];
function cagedLadder(out, y0, y1, r, angle) {
  const o = transformed(out, angle);
  for (const x of [-0.29, 0.29]) tube(o, 'metal', [x, y0, r], [x, y1, r], 0.025, dark, 8);
  for (let y = y0 + 0.15; y < y1; y += 0.29)
    tube(o, 'metal', [-0.29, y, r], [0.29, y, r], 0.025, dark, 8);
}
function buildEddystone(out) {
  lathe(
    out,
    'ashlar',
    [
      [0, 6.9],
      [3.8, 6.9],
      [4.1, 6.55],
    ],
    [0.34, 0.32, 0.25],
    128,
  );
  const profile = [
    [4.1, 5.52],
    [7, 5.15],
    [11, 4.62],
    [16, 4.05],
    [22, 3.62],
    [29, 3.26],
    [36, 3.1],
    [40.45, 3.18],
  ];
  const holes = [
    { angle: 0, y: 18.8, w: 1.12, h: 2.05, grid: true },
    { angle: 0, y: 25.2, w: 0.77, h: 1.3, grid: true },
    { angle: 0, y: 31.6, w: 0.72, h: 1.3, grid: true },
    { angle: 0, y: 37.4, w: 0.7, h: 1.15, grid: true },
    { angle: 1.2, y: 22.4, w: 0.68, h: 1.15, grid: true },
    { angle: 1.2, y: 28.6, w: 0.68, h: 1.15, grid: true },
    { angle: 1.2, y: 34.9, w: 0.68, h: 1.15, grid: true },
  ];
  shell(out, {
    profile,
    holes,
    slot: 'ashlar',
    color: (y) => (y < 8 ? [0.35, 0.34, 0.26] : y < 12 ? [0.5, 0.48, 0.36] : gray),
    segments: 144,
  });
  lathe(
    out,
    'granite',
    [
      [40.35, 3.2],
      [40.75, 3.7],
      [41, 3.9],
      [41.28, 3.9],
    ],
    gray,
    128,
  );
  ring(out, 'metal', 41.25, 2.4, 4.05, 0.2, [0.19, 0.18, 0.14], 128);
  lantern(out, {
    bottom: 41.45,
    radius: 2.72,
    height: 4.05,
    color: [0.35, 0.08, 0.045],
    segments: 24,
    roofHeight: 0.75,
  });
  // Photographed dark solar apron wraps the gallery, divided into actual panel modules.
  for (let i = 0; i < 32; i++) {
    const o = transformed(out, (i * Math.PI) / 16),
      r = 3.77,
      w = 0.35;
    panel(o, 'glass', -w, w, 41.48, 43.14, r, [0.055, 0.105, 0.17]);
    for (const x of [-w, w])
      beam(o, 'metal', [x, 41.45, r + 0.03], [x, 43.18, r + 0.03], 0.045, 0.035, pale);
    for (const y of [41.47, 42.3, 43.16])
      beam(o, 'metal', [-w, y, r + 0.03], [w, y, r + 0.03], 0.035, 0.035, pale);
  }
  railRing(out, 41.4, 3.96, 1.86, dark, 48);
  // Modern above-lantern helideck with eight legs and crossed supporting steelwork.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4;
    const p = (r, y, t) => [Math.sin(t) * r, y, Math.cos(t) * r];
    beam(out, 'metal', p(3.25, 43.2, a), p(4.15, 48.5, a), 0.15, 0.15, red);
    beam(out, 'metal', p(3.25, 43.2, a), p(4.15, 48.5, b), 0.085, 0.085, red);
    beam(out, 'metal', p(3.25, 43.2, b), p(4.15, 48.5, a), 0.085, 0.085, red);
    beam(out, 'metal', p(4.15, 48.4, a), p(6.8, 48.77, a), 0.17, 0.24, dark);
  }
  lathe(
    out,
    'metal',
    [
      [48.55, 6.25],
      [48.8, 6.25],
    ],
    [0.24, 0.3, 0.26],
    64,
  );
  ring(out, 'metal', 48.8, 6.18, 6.3, 0.08, pale, 96);
  ring(out, 'metal', 48.81, 4.2, 4.32, 0.012, [0.85, 0.78, 0.2], 96);
  // H marking uses thin mesh strips, retaining a normal GLB without texture duplication.
  for (const x of [-0.85, 0.85])
    box(out, 'metal', [x - 0.14, 48.81, -1.3], [x + 0.14, 48.825, 1.3], pale);
  box(out, 'metal', [-0.85, 48.81, -0.14], [0.85, 48.825, 0.14], pale);
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI) / 32,
      b = ((i + 1) * Math.PI) / 32,
      p = (r, y, t) => [Math.sin(t) * r, y, Math.cos(t) * r];
    tube(out, 'metal', p(6.3, 48.77, a), p(7.3, 49, a), 0.02, dark, 6);
    tube(out, 'metal', p(7.3, 49, a), p(7.3, 49, b), 0.025, dark, 6);
    if (i % 2 === 0) tube(out, 'metal', p(6.75, 48.88, a), p(6.75, 48.88, b), 0.016, dark, 6);
  }
  cagedLadder(out, 0.3, 4.2, 6.95, 0);
  // The upper door's boat-hoist attachment is separately modeled.
  const o = transformed(out, 0);
  beam(o, 'metal', [0, 20.9, 3.9], [0, 22.1, 5.8], 0.1, 0.13, dark);
  tube(o, 'metal', [0, 22.1, 5.8], [0, 18.6, 5.8], 0.015, dark, 6);
}
function buildThridrangar(out) {
  // OSM 7.4m/5.7m envelope agrees with the authority maintenance photo; cached4m does not.
  box(out, 'concrete', [-2.9, 0, -2.9], [2.9, 0.45, 2.9], [0.47, 0.47, 0.4]);
  for (let f = 0; f < 4; f++) {
    const holes =
      f === 0
        ? [
            { x: -0.82, y: 0.68, w: 0.98, h: 2.4, trim: 0 },
            { x: 1.02, y: 1.67, w: 0.9, h: 1.2, trim: 0, blind: true },
          ]
        : [{ x: 0, y: 1.65, w: 0.75, h: 1.2, trim: 0, blind: true }];
    piercedFacade(transformed(out, (f * Math.PI) / 2), {
      half: 2.48,
      y0: 0.45,
      y1: 4.14,
      z: 2.48,
      holes,
      slot: 'plaster',
      color: [0.87, 0.88, 0.84],
    });
  }
  box(out, 'concrete', [-2.8, 4.04, -2.8], [2.8, 4.29, 2.8], [0.8, 0.82, 0.78]);
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2),
      holes = f === 0 ? [{ x: 1.25, y: 4.52, w: 1.05, h: 0.95, trim: 0, depth: 0.35 }] : [];
    piercedFacade(o, {
      half: 2.72,
      y0: 4.29,
      y1: 5.72,
      z: 2.72,
      holes,
      slot: 'plaster',
      color: [0.87, 0.88, 0.84],
    });
    // Inside of roof parapet remains separate, leaving an open lantern terrace.
    panel(transformed(o, Math.PI), 'plaster', -2.42, 2.42, 4.29, 5.72, -2.38, [0.87, 0.88, 0.84]);
    box(o, 'concrete', [-2.76, 5.72, 2.37], [2.76, 5.81, 2.76], pale);
  }
  box(out, 'concrete', [-2.5, 4.28, -2.5], [2.5, 4.38, 2.5], pale);
  // Red lantern has diagonal diamond glazing, a defining detail of this small square lighthouse.
  lantern(out, {
    bottom: 5.27,
    radius: 1.42,
    height: 1.28,
    color: red,
    segments: 12,
    roofHeight: 0.53,
  });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6,
      p = (t, y) => [Math.sin(t) * 1.43, y, Math.cos(t) * 1.43];
    beam(out, 'metal', p(a, 5.5), p(b, 6.55), 0.035, 0.04, red);
    beam(out, 'metal', p(b, 5.5), p(a, 6.55), 0.035, 0.04, red);
  }
  tube(out, 'metal', [0, 7.2, 0], [0, 7.4, 0], 0.026, red, 8);
  // Current photovoltaic panel, bracket and recessed maintenance door visible in owner photo.
  panel(out, 'glass', -2.08, -0.82, 4.53, 5.62, 2.79, [0.045, 0.08, 0.09]);
  for (const x of [-2.1, -1.45, -0.8])
    box(out, 'metal', [x - 0.025, 4.49, 2.77], [x + 0.025, 5.65, 2.83], pale);
  for (const y of [4.5, 5.07, 5.64])
    box(out, 'metal', [-2.1, y - 0.025, 2.77], [-0.8, y + 0.025, 2.83], pale);
  for (let i = 1; i < 16; i++) {
    const x = -2.08 + (i * 1.26) / 16;
    box(out, 'metal', [x - 0.003, 4.54, 2.796], [x + 0.003, 5.61, 2.804], [0.23, 0.29, 0.28]);
  }
  for (let i = 1; i < 12; i++) {
    const y = 4.53 + (i * 1.09) / 12;
    box(out, 'metal', [-2.08, y - 0.003, 2.796], [-0.82, y + 0.003, 2.804], [0.19, 0.24, 0.23]);
  }
  for (let i = 0; i < 3; i++)
    box(
      out,
      'concrete',
      [-1.43, 0, 2.75 + i * 0.38],
      [-0.23, 0.65 - i * 0.19, 3.13 + i * 0.38],
      gray,
    );
}
function buildSorve(out) {
  const profile = [
    [0, 4.12],
    [0.5, 4.08],
    [9, 3.5],
    [17.4, 3.04],
    [30, 2.65],
    [45.9, 2.27],
  ];
  const holes = [
    { angle: 0, y: 0.65, w: 0.64, h: 1.5, trimSlot: 'concrete', trimColor: pale },
    { angle: 0, y: 11.4, w: 0.68, h: 1.25, trimSlot: 'concrete', trimColor: pale },
    { angle: 0, y: 21, w: 0.62, h: 1.25, trimSlot: 'concrete', trimColor: dark },
    { angle: 0, y: 30.9, w: 0.59, h: 1.25, trimSlot: 'concrete', trimColor: dark },
    { angle: 0, y: 40.1, w: 0.58, h: 1.25, trimSlot: 'concrete', trimColor: dark },
    { angle: Math.PI, y: 0.4, w: 1.12, h: 2.45, trimSlot: 'concrete', trimColor: pale },
  ];
  shell(out, {
    profile: [profile[0], profile[1], profile[2], profile[3]],
    holes: holes.filter((h) => h.y < 17.4),
    slot: 'concrete',
    color: [0.83, 0.84, 0.81],
    segments: 128,
  });
  shell(out, {
    profile: [profile[3], profile[4], profile[5]],
    holes: holes.filter((h) => h.y > 17.4),
    slot: 'concrete',
    color: [0.055, 0.065, 0.067],
    segments: 128,
  });
  // Fine casting joints are physical rings with matching paint; no masonry texture on concrete.
  for (let y = 1.1; y < 45.7; y += 1.1) {
    if (holes.some((h) => y >= h.y - 0.1 && y <= h.y + h.h + 0.1)) continue;
    const i = profile.findIndex(([h]) => h >= y),
      a = profile[i - 1],
      b = profile[i],
      r = a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
    ring(
      out,
      'concrete',
      y,
      r - 0.015,
      r + 0.012,
      0.018,
      y < 17.4 ? [0.71, 0.72, 0.69] : [0.075, 0.085, 0.087],
      128,
    );
  }
  lathe(
    out,
    'concrete',
    [
      [45.85, 2.27],
      [46.2, 2.52],
      [46.72, 3.37],
      [46.9, 3.53],
      [47.2, 3.53],
    ],
    dark,
    128,
  );
  railRing(out, 47.22, 3.43, 0.98, dark, 64);
  shell(out, {
    profile: [
      [47.19, 2.27],
      [48.65, 2.27],
    ],
    holes: [{ angle: 0, y: 47.24, w: 0.7, h: 1.36, trimSlot: 'metal', trimColor: dark }],
    slot: 'metal',
    color: dark,
    segments: 96,
  });
  lantern(out, {
    bottom: 48.6,
    radius: 2.21,
    height: 2.22,
    color: dark,
    segments: 16,
    roofHeight: 1.2,
  });
  railRing(out, 48.7, 2.6, 2.5, dark, 40);
  cagedLadder(out, 47.23, 49.1, 2.32, 2.4);
  tube(out, 'metal', [0, 52.3, 0], [0, 53, 0], 0.025, dark, 8);
}

export const lighthouseOffshoreStudies = [
  lighthouseStudy({
    id: 'N0646',
    key: 'eddystone_lighthouse',
    title: 'Eddystone Lighthouse',
    wikidataId: 'Q546122',
    build: buildEddystone,
    size: [14.6, 49, 14.6],
    visualBrief:
      '1882 curved granite sea tower with staggered recessed windows, dark photovoltaic gallery apron, red lantern support cage and modern above-lantern helideck with radial safety net.',
    sourceFacts: {
      heightMeters: 49,
      year: 1882,
      automation:
        'Above-lantern helipad added for the 1982 automation; operator current photograph shows solar apron.',
      basis: 'Trinity House live lighthouse page and operator photograph.',
    },
    referencePages: [
      'https://www.trinityhouse.co.uk/lighthouses-and-lightvessels/eddystone-lighthouse',
      'https://www.trinityhouse.co.uk/asset/952/view/1200',
      'https://trinityhouse.co.uk/asset/5623/download?1746607918=',
    ],
    geographicProposal: {
      anchor: [-4.2656, 50.180716666667],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://trinityhouse.co.uk/asset/5623/download?1746607918=',
      notes:
        'Trinity House2025-30 Aids to Navigation Review p73 gives WGS84 50deg10.843min N,004deg15.936min W, superseding coarse catalog reference. Round tower and circular helideck have no principal plan axis. Sparse opening azimuth remains photo-reconstructed; ground is local reef contact, not a claimed mean-sea-level datum.',
    },
    limitations: [
      'Current granite tower exterior and modern service deck are included. Old Smeaton stump and surrounding rocks are separate site features and are not included in this asset. Intermediate radii, glazing, panel subdivisions and helideck members are photo-proportioned.',
    ],
    qaCameras: [
      { name: 'near-helideck', position: [14, 49, 17], lookAt: [0, 45.5, 0] },
      { name: 'near-deck-top', position: [13, 59, 15], lookAt: [0, 48.3, 0] },
      { name: 'near-windows', position: [12, 29, 17], lookAt: [0, 28, 0] },
      { name: 'near-foundation', position: [18, 9, 24], lookAt: [0, 6, 0] },
      { name: 'far-silhouette', position: [55, 36, 74], lookAt: [0, 25, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0647',
    key: 'thridrangaviti_lighthouse',
    title: 'Thridrangaviti Lighthouse',
    wikidataId: 'Q28375893',
    build: buildThridrangar,
    size: [5.8, 7.4, 7],
    visualBrief:
      'Small white square coastal service building with projecting roof terrace, solid pierced parapet, red diamond-framed lantern and exterior photovoltaic panel above a recessed maintenance entrance.',
    sourceFacts: {
      heightMeters: 7.4,
      baseMeters: [5.7, 5.7],
      basis:
        'Exact-QID OSM building envelope supports 7.4m, unlike cached unreferenced4m. Coastal authority maintenance photograph dated22July2015 establishes the proportions and distinctive fixtures.',
      referenceAppearanceYear: 2015,
    },
    referencePages: [
      'https://www.vegagerdin.is/media/2023/09/arsskyrsla_vegagerdarinnar_2015.pdf',
      'https://www.openstreetmap.org/way/1002414326',
    ],
    geographicProposal: {
      anchor: [-20.51327785, 63.48870655],
      heading: 0.192807138777,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/1002414326',
      notes:
        'Square platform centered and aligned to mapped building. +Z door/PV facade faces the mapped helicopter approach on the south side (helipad node8645377489 at[-20.5133282,63.4886035]), selecting the south-facing square quadrant. Authority maintenance photo shows the door toward that approach. Terrain must contain the sea stack summit; base is summit contact.',
    },
    limitations: [
      'Tower exterior, red diagonal glazing frame and photovoltaic cell grid follow the authority maintenance image, with site-facing axis from mapped approach. Natural rock stack and adjacent helicopter landing area are terrain/site features beyond this lighthouse building; the building is authored at its summit contact.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [6, 7, 7], lookAt: [0, 5.8, 0] },
      { name: 'near-door', position: [7, 3.6, 9], lookAt: [0, 2.8, 0] },
      { name: 'near-roof', position: [-6, 9, 7], lookAt: [0, 4.7, 0] },
      { name: 'far-building', position: [12, 8, 16], lookAt: [0, 3.4, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0648',
    key: 'sorve_lighthouse',
    title: 'Sõrve Lighthouse',
    wikidataId: 'Q3376479',
    build: buildSorve,
    size: [8.24, 53, 8.24],
    visualBrief:
      'Tall black-over-white tapered concrete shaft with subtle casting rings, sparse narrow windows, flared gallery and black double-caged lantern.',
    sourceFacts: {
      heightMeters: 53,
      operatorCoordinate: [22.05536033, 57.909826],
      year: 1960,
      basis:
        'Estonian navigation-aid935 record publishes53.0m abovebase, superseding cached52m;52.5m focalheight is a different datum.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2632/',
      'https://nma.transpordiamet.ee/view_file/2400',
      'https://www.openstreetmap.org/way/1199536561',
    ],
    geographicProposal: {
      anchor: [22.05536033, 57.909826],
      heading: 0.505986351887,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://nma.transpordiamet.ee/aton/2632/',
      notes:
        'Authority coordinate identifies tower center. Authored entrance faces -Z; mapped access path1199536561 ends at[22.0553305,57.9098546], 3.64m northwest of the center, resolving entrance heading0.505986351887rad. Circular lantern remains rotationally symmetric.',
    },
    limitations: [
      'Shaft radii, paint boundary height, opening elevations and casting seams are photo-proportioned. Navigation optics are static exterior glazing rather than an operational light simulation.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [9, 51, 13], lookAt: [0, 49.2, 0] },
      { name: 'near-paint-boundary', position: [11, 20, 15], lookAt: [0, 17.5, 0] },
      { name: 'near-base', position: [12, 6, 17], lookAt: [0, 4, 0] },
      { name: 'far-silhouette', position: [48, 35, 66], lookAt: [0, 26, 0] },
    ],
  }),
];
