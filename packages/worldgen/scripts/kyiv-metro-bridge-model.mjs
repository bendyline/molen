/** Kyiv Metro Bridge: original permanent arch-cantilever exterior, with mapped rail approach. */
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const anchor = [30.56443405, 50.442658675];
const heading = 0.411477488755;
const half = 347.3;
const concrete = [0.67, 0.65, 0.59],
  pale = [0.79, 0.77, 0.7],
  granite = [0.46, 0.46, 0.42];
const paint = [0.48, 0.57, 0.55],
  dark = [0.18, 0.2, 0.21],
  metal = [0.41, 0.43, 0.43];
const spans = [40, 80, 99, 117, 117, 99, 80, 40];
const stations = [-336];
for (const s of spans) stations.push(stations.at(-1) + s);
const deckY = (x) => 20.6 - 4.4 * (Math.min(half, Math.abs(x)) / half) ** 2;
const profile = (x) => (x <= half ? deckY(x) + 5.1 : deckY(half) + 5.1 - (x - half) * 0.033);
const local = (lon, lat) => {
  const e = (lon - anchor[0]) * 111195 * Math.cos((anchor[1] * Math.PI) / 180);
  const n = (lat - anchor[1]) * 111195;
  return [
    e * Math.cos(heading) + n * Math.sin(heading),
    e * Math.sin(heading) - n * Math.cos(heading),
  ];
};
// Midpoints of the two mapped edges of the elevated rail approach, rather than its rectangle.
const approach = [
  [half, 0],
  local((30.5692633 + 30.5693215) / 2, (50.4440281 + 50.4439407) / 2),
  local((30.5700179 + 30.5700571) / 2, (50.4441822 + 50.4440834) / 2),
  local((30.5715648 + 30.5716097) / 2, (50.4443962 + 50.4442804) / 2),
];
const railEnd = approach.at(-1)[0];
const railZ = (x) => {
  if (x <= half) return 0;
  for (let i = 1; i < approach.length; i++)
    if (x <= approach[i][0]) {
      const [a, b] = [approach[i - 1], approach[i]];
      const t = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  return approach.at(-1)[1];
};
function cell(out, slot, x0, x1, z0, z1, y0, y1, color, height = deckY, lateral = () => 0) {
  const a = [x0, height(x0) + y0, lateral(x0) + z0],
    b = [x1, height(x1) + y0, lateral(x1) + z0];
  const c = [x1, height(x1) + y0, lateral(x1) + z1],
    d = [x0, height(x0) + y0, lateral(x0) + z1];
  const A = [a[0], a[1] + y1 - y0, a[2]],
    B = [b[0], b[1] + y1 - y0, b[2]];
  const C = [c[0], c[1] + y1 - y0, c[2]],
    D = [d[0], d[1] + y1 - y0, d[2]];
  for (const p of [
    [a, A, B, b],
    [b, B, C, c],
    [c, C, D, d],
    [d, D, A, a],
    [A, D, C, B],
    [a, b, c, d],
  ])
    quad(out, slot, p, normalFor(...p), color);
}
function pierRing(x, y, w, length) {
  // Blunt cutwaters on both faces, in original stone-clad reinforced-concrete piers.
  return [
    [-w / 2, -length / 2 + 2],
    [0, -length / 2],
    [w / 2, -length / 2 + 2],
    [w / 2, length / 2 - 2],
    [0, length / 2],
    [-w / 2, length / 2 - 2],
  ]
    .reverse()
    .map(([a, b]) => [x + a, y, b]);
}
function pier(out, x) {
  loft(out, 'stone', [pierRing(x, 0, 8, 31), pierRing(x, 3.15, 7.4, 30)], granite);
  loft(out, 'concrete', [pierRing(x, 3.15, 7.8, 30.3), pierRing(x, 3.6, 7.8, 30.3)], pale);
  for (let y = 0.5; y < 3.1; y += 0.54) {
    const r = pierRing(x, y, 8 - (y / 3.15) * 0.6 + 0.014, 31 - y / 3.15 + 0.014);
    for (let i = 0; i < r.length; i++)
      tube(out, 'stone', r[i], r[(i + 1) % r.length], 0.018, [0.58, 0.57, 0.52], 4);
  }
  for (const z of [-10.6, -3.5, 3.5, 10.6]) {
    box(out, 'concrete', [x - 1.05, 3.6, z - 1.05], [x + 1.05, deckY(x) - 0.9, z + 1.05], concrete);
    box(
      out,
      'concrete',
      [x - 1.22, deckY(x) - 1.5, z - 1.2],
      [x + 1.22, deckY(x) - 0.7, z + 1.2],
      pale,
    );
    for (const sign of [-1, 1]) {
      box(
        out,
        'iron',
        [x - 0.5, deckY(x) - 0.65, z + sign * 0.88 - 0.1],
        [x + 0.5, deckY(x) - 0.49, z + sign * 0.88 + 0.1],
        dark,
      );
    }
  }
}
function arch(out, a, b, z) {
  const span = b - a,
    mid = (a + b) / 2;
  const bottom = (t) => 3.15 + 4 * t * (1 - t) * (deckY(mid) - 6.1);
  const thick = (t) => 1.6 + 1.75 * (2 * t - 1) ** 2;
  const sample = (t) => {
    const x = a + span * t,
      y = bottom(t);
    return [
      [x, y, z - 1],
      [x, y, z + 1],
      [x, y + thick(t), z + 1],
      [x, y + thick(t), z - 1],
    ].reverse();
  };
  const count = Math.ceil(span / 1.4),
    rings = Array.from({ length: count + 1 }, (_, i) => sample(i / count));
  loft(out, 'concrete', rings, concrete);
  // Dry-jointed precast segments; restrained seams do not bake illumination into the surface.
  for (let t = 0.045; t < 0.98; t += 4.2 / span) {
    const x = a + span * t,
      y = bottom(t),
      h = thick(t);
    for (const sign of [-1, 1])
      tube(
        out,
        'concrete',
        [x, y + 0.035, z + sign * 1.011],
        [x, y + h - 0.03, z + sign * 1.011],
        0.014,
        [0.51, 0.5, 0.46],
        4,
      );
  }
  const divisions = Math.round(span / 7.5);
  for (let i = 1; i < divisions; i++) {
    const t = i / divisions,
      x = a + span * t,
      base = bottom(t) + thick(t),
      top = deckY(x) - 0.72;
    if (top - base < 0.12) continue;
    box(out, 'concrete', [x - 0.38, base, z - 0.46], [x + 0.38, top, z + 0.46], pale);
    box(out, 'concrete', [x - 0.7, top - 0.2, z - 0.64], [x + 0.7, top + 0.12, z + 0.64], concrete);
  }
  // Narrow hinge face plates and bolt heads identify the center connection.
  for (const sign of [-1, 1]) {
    const y = bottom(0.5);
    box(
      out,
      'iron',
      [mid - 0.2, y + 0.15, z + sign * 1.012 - 0.016],
      [mid + 0.2, y + 1.4, z + sign * 1.012 + 0.016],
      paint,
    );
    for (const yy of [y + 0.32, y + 1.17])
      tube(out, 'iron', [mid, yy, z + sign * 1.02], [mid, yy, z + sign * 1.085], 0.045, dark, 8);
  }
}
function railing(out, from, to, z, height, lateral = () => 0, solidBase = true) {
  for (let x = from; x < to; x += 2.25) {
    const end = Math.min(to, x + 2.25),
      y = height(x),
      zz = lateral(x) + z;
    box(out, 'iron', [x - 0.047, y + 0.19, zz - 0.045], [x + 0.047, y + 1.2, zz + 0.045], paint);
    for (const h of [0.35, 1.18])
      cell(out, 'iron', x, end, z - 0.035, z + 0.035, h - 0.035, h + 0.035, paint, height, lateral);
    for (let xx = x + 0.2; xx < end; xx += 0.22) {
      const yy = height(xx),
        zz2 = lateral(xx) + z;
      box(
        out,
        'iron',
        [xx - 0.018, yy + 0.35, zz2 - 0.018],
        [xx + 0.018, yy + 1.17, zz2 + 0.018],
        paint,
      );
    }
    if (solidBase)
      cell(out, 'concrete', x, end, z - 0.17, z + 0.17, 0.08, 0.29, pale, height, lateral);
  }
}
function railSection(out, x0, x1, z) {
  // Rail head, web and foot remain separate at 1,520 mm gauge; no overhead catenary.
  for (const sign of [-1, 1]) {
    const zz = z + sign * 0.76;
    cell(out, 'steel', x0, x1, zz - 0.075, zz + 0.075, 0.29, 0.32, metal, profile, railZ);
    cell(out, 'steel', x0, x1, zz - 0.012, zz + 0.012, 0.32, 0.435, metal, profile, railZ);
    cell(
      out,
      'steel',
      x0,
      x1,
      zz - 0.035,
      zz + 0.035,
      0.435,
      0.47,
      [0.63, 0.65, 0.65],
      profile,
      railZ,
    );
  }
  // Covered third rail and insulators beside each track, as mapped electrified:rail.
  const third = z + 1.2;
  cell(
    out,
    'iron',
    x0,
    x1,
    third - 0.055,
    third + 0.055,
    0.39,
    0.5,
    [0.52, 0.54, 0.51],
    profile,
    railZ,
  );
}
export const kyivMetroStudy = {
  id: 'N0008',
  mapFrameDocument: 'map-frame.json',
  wikidataId: 'Q2475012',
  key: 'kyiv_metro_bridge',
  title: 'Kyiv Metro Bridge',
  brief:
    'The six dry-jointed concrete arch-cantilever spans of Kyiv’s two-level Metro Bridge: lower flanking roadways, elevated central dual railway, cutwater piers, open spandrels, segment joints, footways and the separately mapped curving eastern rail viaduct.',
  refs: [
    'https://mostobud-group.com/projects/mist-metro-dnipro/',
    'https://journal.museum.kpi.ua/archive/2016-vol-23/RHT-issue-23-title-03-Konstantinov.pdf',
    'https://dnipr-2023.kyivcity.gov.ua/content/mennyu-1.html',
    'https://kyivcity.gov.ua/news/na_mostu_metro_vikonuyut_unikalniy_etap_remontu__vstanovlyuyut_pidtrimuyuchi_arochni_konstruktsi/',
    'https://davr.gov.ua/protokol-zasidannya-mizhvidomchoi-komisii-po-uzgodzhennyu-rezhimiv-roboti-dniprovskih-vodoshovitsh-na-cherven-2021-roku',
    'https://www.openstreetmap.org/way/887624269',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X ENE toward Hydropark',
    transverse: '+Z SSE downstream',
    origin:
      'Midpoint of the main mapped road crossing; native Y0 is a provisional normal water reference at91.5m, not a surveyed datum transformation.',
  },
  sourceFacts: {
    opening: '1965-11-05',
    contractorSpanScheme: spans,
    contractorLengthMeters: 672,
    municipalRoundedLengthMeters: 700,
    mainMappedEnvelopeMeters: 694.601,
    publishedWidthMeters: 29,
    publishedMetroDeckWidthMeters: 9.4,
    roadLanes: 4,
    railTracks: 2,
    railGaugeMeters: 1.52,
    railElectrification: 'Third rail,825VDC; OSM tagged',
    originalForm: 'Precast reinforced-concrete thrust-free arch-cantilever on dry joints',
    ongoingWorks:
      'City reports160support piles and installation of temporary metal support arches beginning2024–2025. April2026 contractor photos show the work in progress. This permanent original exterior omits the temporary works; it does not depict completed future restoration.',
  },
  reconstruction: {
    roadCrestAboveReferenceWaterMeters: 20.6,
    roadEndsAboveReferenceWaterMeters: 16.2,
    upperMetroDeckAboveRoadMeters: 5.1,
    archRibCentersZ: [-10.6, -3.5, 3.5, 10.6],
    pierStationing: stations,
    approachCenterline: approach,
    approachGrade: 0.033,
    basis:
      'Published spans and widths constrain the permanent structure; vertical profile, detailed rib/post sections, pier exposure, joint/rivet patterns, rail support spacing and eastern viaduct support stations are photographic reconstruction.',
  },
  geographic: () => ({
    anchor,
    heading,
    elevationMode: 'sea-level',
    elevationMeters: 91.5,
    featureIds: [
      'way/887624269',
      'way/23260778',
      'way/37558185',
      'way/160683803',
      'way/160684852',
      'way/266169022',
    ],
    notes:
      'Exact-QID outline decomposed into694.601m main crossing plus narrow curving elevated rail approach.672m published span scheme centered inside the main road envelope; extra abutment ends are reconstructed. Native+X ENE,+Z downstream SSE.91.5m is the published Kaniv reservoir normal pool used as a provisional viewer water reference; local water-stage slope, Baltic-datum conversion, deck survey and shore fit remain host-dependent.',
  }),
  limitations: [
    'Detailed permanent original exterior, informed by contractor photographs. Active2024–2026temporary support piles, jack towers, steel reinforcement arches, barges and construction equipment are omitted; no future completed restoration is claimed.',
    'The contractor’s672m span sum, general700m description and694.601m mapped road envelope describe different extents. The mapped889m overall area also includes the eastern elevated rail approach and must not stretch the six river arches.',
    'Vertical profile, pier exposure, rib/post cross sections, rail-support spacing, detailed fittings and bank transitions are photographic reconstruction, not an engineering model.91.5m reference elevation is provisional and local water/terrain alignment needs host data.',
    'Dnipro station, its sculptures, subway trains, the separate Rusanivskyi bridge and roads beyond the mapped bridge are separate assets. Submerged foundations and maintenance interiors are excluded.',
  ],
  camera: { position: [170, 160, 800], lookAt: [90, 11, 6], fov: 44 },
  qaCameras: [
    { name: 'arch-and-spandrels', position: [75, 10, 54], lookAt: [58.5, 10, 4] },
    { name: 'pier-and-hinge', position: [133, 8, 33], lookAt: [117, 9, 0] },
    { name: 'two-level-road', position: [-55, 23, 12], lookAt: [5, 22, 4] },
    { name: 'rail-and-third-rail', position: [18, 28, 8], lookAt: [40, 26, 0] },
    { name: 'under-deck', position: [35, 6, 18], lookAt: [50, 19, 0] },
    { name: 'east-rail-approach', position: [450, 31, 90], lookAt: [443, 15, railZ(443)] },
    { name: 'far-crossing', position: [130, 170, 720], lookAt: [70, 12, 0] },
  ],
  build(out) {
    for (const x of stations.slice(1, -1)) pier(out, x);
    for (let i = 1; i < 7; i++)
      for (const z of [-10.6, -3.5, 3.5, 10.6]) arch(out, stations[i], stations[i + 1], z);
    for (const sign of [-1, 1]) {
      const girderFrom = sign < 0 ? -336 : 296;
      for (let x = girderFrom; x < girderFrom + 40; x += 4)
        for (const z of [-10.6, -3.5, 3.5, 10.6])
          cell(out, 'concrete', x, x + 4, z - 0.65, z + 0.65, -3.05, -0.72, concrete);
      box(
        out,
        'concrete',
        [sign * 336 - 3.5, 0, -14.5],
        [sign * 336 + 3.5, deckY(336) - 0.6, 14.5],
        concrete,
      );
      for (let x = sign < 0 ? -half : 336; x < (sign < 0 ? -336 : half); x += 2)
        cell(
          out,
          'concrete',
          x,
          Math.min(x + 2, sign < 0 ? -336 : half),
          -14.5,
          14.5,
          -2.2,
          -0.3,
          concrete,
        );
    }
    for (let x = -half; x < half; x += 3.25) {
      const end = Math.min(x + 3.25, half);
      cell(out, 'concrete', x, end, -14.5, 14.5, -0.74, -0.12, concrete);
      for (const sign of [-1, 1]) {
        const a = sign < 0 ? -12.75 : 5.2,
          b = sign < 0 ? -5.2 : 12.75;
        cell(out, 'road', x, end, a, b, -0.1, 0, [0.18, 0.19, 0.19]);
        cell(
          out,
          'concrete',
          x,
          end,
          sign < 0 ? -14.5 : 12.95,
          sign < 0 ? -12.95 : 14.5,
          -0.03,
          0.16,
          pale,
        );
        cell(
          out,
          'concrete',
          x,
          end,
          sign < 0 ? -13.05 : 12.75,
          sign < 0 ? -12.75 : 13.05,
          0,
          0.21,
          pale,
        );
        for (const zz of [sign * 5.25, sign * 12.5])
          cell(out, 'marking', x, end, zz - 0.05, zz + 0.05, 0.008, 0.009, [0.85, 0.84, 0.75]);
      }
      // The concrete crossheads and longitudinal beams stay visible beneath the road deck.
      cell(out, 'concrete', x, x + 0.3, -13.7, 13.7, -1.24, -0.74, pale);
      for (const z of [-10.6, -3.5, 3.5, 10.6])
        cell(out, 'concrete', x, end, z - 0.43, z + 0.43, -1.15, -0.65, concrete);
    }
    for (let x = -half + 1; x < half; x += 9)
      for (const sign of [-1, 1])
        cell(
          out,
          'marking',
          x,
          Math.min(x + 3, half),
          sign * 8.9 - 0.065,
          sign * 8.9 + 0.065,
          0.012,
          0.014,
          [0.82, 0.82, 0.74],
        );
    for (const sign of [-1, 1]) railing(out, -half, half, sign * 14.3, (x) => deckY(x) + 0.15);
    for (let x = -half + 8; x < half; x += 31.5)
      for (const sign of [-1, 1]) {
        const z = sign * 13.85,
          y = deckY(x) + 0.16;
        tube(out, 'iron', [x, y, z], [x, y + 7.6, z], 0.064, paint, 12);
        tube(out, 'iron', [x, y + 7.6, z], [x, y + 8, z - sign * 2.7], 0.038, paint, 10);
        box(
          out,
          'iron',
          [x - 0.27, y + 7.91, z - sign * 2.7 - 0.2],
          [x + 0.27, y + 8.07, z - sign * 2.7 + 0.2],
          dark,
        );
        box(
          out,
          'marking',
          [x - 0.22, y + 7.905, z - sign * 2.7 - 0.16],
          [x + 0.22, y + 7.914, z - sign * 2.7 + 0.16],
          [0.83, 0.86, 0.81],
        );
      }
    // Elevated central railway continues into the accurately mapped narrow island approach.
    for (let x = -half; x < railEnd; x += 3) {
      const end = Math.min(x + 3, railEnd);
      cell(out, 'concrete', x, end, -4.7, 4.7, -0.78, -0.06, pale, profile, railZ);
      cell(out, 'road', x, end, -3.75, 3.75, -0.02, 0.09, [0.4, 0.41, 0.39], profile, railZ);
      for (const z of [-2, 2]) railSection(out, x, end, z);
      for (const z of [-3.9, 3.9])
        cell(out, 'concrete', x, end, z - 0.23, z + 0.23, -1.48, -0.76, concrete, profile, railZ);
    }
    for (let x = -half + 0.3; x < railEnd; x += 0.65)
      for (const z of [-2, 2]) {
        cell(
          out,
          'concrete',
          x,
          x + 0.22,
          z - 1.15,
          z + 1.15,
          0.08,
          0.27,
          [0.58, 0.59, 0.56],
          profile,
          railZ,
        );
        for (const side of [-1, 1]) {
          const yy = profile(x),
            zz = railZ(x) + z + side * 0.76;
          box(
            out,
            'iron',
            [x + 0.02, yy + 0.26, zz - 0.12],
            [x + 0.17, yy + 0.32, zz + 0.12],
            dark,
          );
        }
      }
    for (const sign of [-1, 1]) railing(out, -half, railEnd, sign * 4.5, profile, railZ);
    for (let x = -half + 7.5; x < half; x += 7.5) {
      for (const z of [-2.8, 2.8])
        box(
          out,
          'concrete',
          [x - 0.45, deckY(x) - 0.12, z - 0.48],
          [x + 0.45, profile(x) - 1.1, z + 0.48],
          concrete,
        );
      cell(out, 'concrete', x - 0.75, x + 0.75, -4.55, 4.55, -1.1, -0.78, pale, profile, railZ);
    }
    for (let x = half + 13; x < railEnd - 8; x += 24) {
      const z = railZ(x),
        y = profile(x);
      for (const zz of [-3.2, 3.2])
        box(
          out,
          'concrete',
          [x - 0.55, 0, z + zz - 0.6],
          [x + 0.55, y - 1.3, z + zz + 0.6],
          concrete,
        );
      cell(out, 'concrete', x - 0.8, x + 0.8, -4.5, 4.5, -1.35, -0.75, pale, profile, railZ);
    }
    // Drain runs, scuppers and navigation marker plates are small but readable near the crossing.
    for (let x = -half + 10; x < half; x += 12)
      for (const sign of [-1, 1]) {
        const z = sign * 13.5,
          y = deckY(x);
        tube(out, 'iron', [x, y - 0.15, z], [x, y - 2.3, z], 0.066, [0.4, 0.44, 0.42], 10);
        tube(
          out,
          'iron',
          [x, y - 2.3, z],
          [x, y - 2.55, z + sign * 0.45],
          0.066,
          [0.4, 0.44, 0.42],
          10,
        );
      }
    for (const x of [-58.5, 58.5])
      for (const sign of [-1, 1]) {
        const y = deckY(x),
          z = sign * 14.57;
        box(
          out,
          'marking',
          [x - 0.85, y - 0.8, z - 0.035],
          [x + 0.85, y + 0.65, z + 0.035],
          [0.8, 0.83, 0.77],
        );
        for (const p of [
          [
            [x - 0.75, y - 0.65, z + sign * 0.041],
            [x + 0.75, y - 0.65, z + sign * 0.041],
            [x, y + 0.55, z + sign * 0.041],
          ],
        ])
          out.addTriangle(
            'marking',
            'palette:#ffffff',
            sign > 0 ? p : [...p].reverse(),
            [0, 0, sign],
            [
              [0, 0],
              [1, 0],
              [0.5, 1],
            ],
            [0.7, 0.12, 0.07],
          );
      }
  },
};
