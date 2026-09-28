/** Rodsher: component reconstruction controlled by the RGO/Fertoing survey and photographs. */
import earcut from 'earcut';
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  red = [0.46, 0.11, 0.085],
  iron = [0.24, 0.07, 0.055],
  grey = [0.41, 0.42, 0.38];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const oct = (r, y) => Array.from({ length: 8 }, (_, i) => P(r, y, ((i + 0.5) * TAU) / 8));
function octLoft(out, profiles, slot = 'plaster', color = red) {
  loft(
    out,
    slot,
    profiles.map(([y, r]) => oct(r, y)),
    color,
  );
}
function archFace(out, half, y0, y1, z, holes) {
  const outer = [
      [-half, y0],
      [half, y0],
      [half, y1],
      [-half, y1],
    ],
    loops = [];
  for (const h of holes) {
    const shape = [
      [-h.w / 2, h.y],
      [h.w / 2, h.y],
      [h.w / 2, h.y + h.h - h.w / 2],
    ];
    for (let i = 1; i <= 32; i++) {
      const a = (i * Math.PI) / 32;
      shape.push([(Math.cos(a) * h.w) / 2, h.y + h.h - h.w / 2 + (Math.sin(a) * h.w) / 2]);
    }
    loops.push(shape);
  }
  const ps = [...outer, ...loops.flat()],
    starts = [];
  let start = outer.length;
  for (const l of loops) {
    starts.push(start);
    start += l.length;
  }
  const ix = earcut(ps.flat(), starts, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const p = ix.slice(i, i + 3).map((k) => [ps[k][0], ps[k][1], z]);
    if (normalFor(...p)[2] < 0) p.reverse();
    out.addTriangle(
      'plaster',
      'metric:uv',
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      red,
    );
  }
  for (let j = 0; j < holes.length; j++) {
    const h = holes[j],
      shape = loops[j],
      deep = z - 0.3;
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i],
        b = shape[(i + 1) % shape.length],
        p = [
          [a[0], a[1], z],
          [a[0], a[1], deep],
          [b[0], b[1], deep],
          [b[0], b[1], z],
        ];
      quad(
        out,
        'plaster',
        p,
        normalFor(...p.slice(0, 3)),
        red.map((v) => v * 0.85),
      );
    }
    const ids = earcut(shape.flat());
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((k) => [shape[k][0], shape[k][1], deep]);
      if (normalFor(...p)[2] < 0) p.reverse();
      out.addTriangle(
        h.door ? 'wood' : 'glass',
        'metric:uv',
        p,
        [0, 0, 1],
        p.map((v) => [v[0], v[1]]),
        h.door ? [0.12, 0.13, 0.1] : [0.11, 0.2, 0.19],
      );
    }
    if (!h.door) {
      for (const y of [h.y + 0.34, h.y + 0.79])
        box(
          out,
          'wood',
          [-h.w / 2 + 0.025, y - 0.019, deep + 0.015],
          [h.w / 2 - 0.025, y + 0.019, deep + 0.06],
          [0.38, 0.42, 0.33],
        );
      box(
        out,
        'wood',
        [-0.02, h.y + 0.04, deep + 0.02],
        [0.02, h.y + h.h - 0.07, deep + 0.06],
        [0.38, 0.42, 0.33],
      );
    } else {
      for (let x = -0.48; x < 0.5; x += 0.145)
        box(
          out,
          'wood',
          [x - 0.009, h.y + 0.04, deep + 0.018],
          [x + 0.009, h.y + h.h - 0.22, deep + 0.04],
          [0.18, 0.17, 0.12],
        );
      box(out, 'metal', [0.34, h.y + 0.9, deep + 0.02], [0.39, h.y + 1.07, deep + 0.085], grey);
    }
  }
}
function octWalls(out, y0, y1, r, openings) {
  const ap = r * Math.cos(Math.PI / 8),
    half = r * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++)
    archFace(
      transformed(out, (i * TAU) / 8),
      half,
      y0,
      y1,
      ap,
      openings.filter((h) => h.face === i),
    );
}
function circularRails(out, y, r, h, n = 24) {
  for (const yy of [y + h * 0.48, y + h])
    for (let i = 0; i < n; i++)
      tube(out, 'metal', P(r, yy, (i * TAU) / n), P(r, yy, ((i + 1) * TAU) / n), 0.017, grey, 8);
  for (let i = 0; i < n; i++)
    tube(out, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.021, grey, 8);
}
function panelArray(out, y) {
  const o = transformed(out, 0),
    z = 2.92;
  for (const x of [-0.66, 0.66]) {
    box(o, 'metal', [x - 0.58, y, z - 0.09], [x + 0.58, y + 1.44, z], [0.55, 0.58, 0.53]);
    panel(o, 'glass', x - 0.54, x + 0.54, y + 0.04, y + 1.4, z + 0.006, [0.038, 0.12, 0.21]);
    for (let i = 1; i < 6; i++)
      tube(
        o,
        'metal',
        [x - 0.54 + (i * 1.08) / 6, y + 0.04, z + 0.012],
        [x - 0.54 + (i * 1.08) / 6, y + 1.4, z + 0.012],
        0.004,
        [0.48, 0.52, 0.56],
        6,
      );
    for (let j = 1; j < 10; j++)
      tube(
        o,
        'metal',
        [x - 0.54, y + 0.04 + (j * 1.36) / 10, z + 0.012],
        [x + 0.54, y + 0.04 + (j * 1.36) / 10, z + 0.012],
        0.004,
        [0.48, 0.52, 0.56],
        6,
      );
    for (const yy of [y + 0.18, y + 1.26])
      beam(o, 'metal', [x, yy, 2.36], [x, yy, z - 0.09], 0.05, 0.055, grey);
  }
  for (let yy = 0.8; yy < 6.6; yy += 0.46)
    box(out, 'metal', [-0.028, yy, 2.91], [0.028, yy + 0.22, 2.96], [0.18, 0.18, 0.15]);
}
function meshRail(out) {
  const y = 15.48,
    h = 1.14,
    r = 2.02;
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8,
      pa = P(r, y, a),
      pb = P(r, y, b),
      width = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
    const p = (u, v) => [
      pa[0] + ((pb[0] - pa[0]) * u) / width,
      y + v,
      pa[2] + ((pb[2] - pa[2]) * u) / width,
    ];
    tube(out, 'metal', p(0, 0), p(0, h), 0.023, iron, 8);
    tube(out, 'metal', p(0, 0), p(width, 0), 0.024, iron, 8);
    tube(out, 'metal', p(0, h), p(width, h), 0.024, iron, 8);
    for (const sign of [-1, 1])
      for (let offset = -h; offset < width + h; offset += 0.13) {
        const points = [];
        for (const u of [0, width]) {
          const v = sign * (u - offset);
          if (v >= 0 && v <= h) points.push([u, v]);
        }
        for (const v of [0, h]) {
          const u = offset + sign * v;
          if (u > 0 && u < width) points.push([u, v]);
        }
        if (points.length === 2)
          tube(out, 'metal', p(...points[0]), p(...points[1]), 0.0045, iron, 6);
      }
  }
}
function lantern(out) {
  lathe(
    out,
    'metal',
    [
      [13.18, 1.39],
      [15.37, 1.39],
    ],
    red,
    128,
  );
  for (let i = 0; i < 16; i++)
    tube(out, 'metal', P(1.4, 13.2, (i * TAU) / 16), P(1.4, 15.35, (i * TAU) / 16), 0.009, iron, 6);
  for (const y of [13.2, 13.94, 14.69, 15.34]) ring(out, 'metal', y, 1.36, 1.412, 0.025, iron, 128);
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    beam(out, 'metal', P(1.38, 14.93, a), P(2.05, 15.39, a), 0.05, 0.064, iron);
    const o = transformed(out, a);
    for (const y of [13.94, 14.69])
      sphere(o, 'metal', [0, y, 1.429], [0.025, 0.025, 0.013], red, 12, 6);
  }
  ring(out, 'metal', 15.37, 1.15, 2.06, 0.11, iron, 128);
  meshRail(out);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      b = ((i + 1) * TAU) / 12,
      p = [P(1.34, 15.5, a), P(1.34, 15.5, b), P(1.34, 17.49, b), P(1.34, 17.49, a)];
    quad(out, 'glassClear', p, normalFor(...p.slice(0, 3)), [0.91, 0.97, 0.96]);
    tube(out, 'metal', P(1.36, 15.49, a), P(1.36, 17.53, a), 0.03, [0.59, 0.6, 0.52], 10);
  }
  for (const y of [15.49, 16.54, 17.49]) ring(out, 'metal', y, 1.3, 1.4, 0.046, iron, 128);
  lathe(
    out,
    'metal',
    [
      [15.52, 0.32],
      [16.11, 0.32],
    ],
    grey,
    64,
  );
  lathe(
    out,
    'metal',
    [
      [16.11, 0.17],
      [16.22, 0.22],
      [16.53, 0.22],
      [16.65, 0.17],
    ],
    [0.15, 0.17, 0.15],
    48,
  );
  ring(out, 'glass', 16.23, 0.18, 0.226, 0.23, [0.52, 0.66, 0.48], 64);
  const profile = [
    [17.52, 1.46],
    [17.63, 1.46],
  ];
  for (let i = 1; i <= 22; i++) {
    const a = (i * Math.PI) / 2 / 22;
    profile.push([17.63 + 0.96 * Math.sin(a), Math.max(0.13, 1.46 * Math.cos(a))]);
  }
  lathe(out, 'metal', profile, red, 128);
  for (let j = 0; j < 12; j++) {
    const a = (j * TAU) / 12;
    for (let i = 2; i < profile.length; i++) {
      const [y0, r0] = profile[i - 1],
        [y1, r1] = profile[i];
      tube(out, 'metal', P(r0 + 0.009, y0, a), P(r1 + 0.009, y1, a), 0.009, iron, 6);
    }
  }
  lathe(
    out,
    'metal',
    [
      [18.54, 0.16],
      [18.66, 0.12],
    ],
    iron,
    40,
  );
  sphere(out, 'metal', [0, 18.85, 0], [0.2, 0.26, 0.2], red, 32, 16);
  tube(out, 'metal', [0, 19.06, 0], [0, 20.45, 0], 0.018, iron, 8);
  for (const a of [0, Math.PI / 2])
    beam(transformed(out, a), 'metal', [-0.46, 19.73, 0], [0.46, 19.73, 0], 0.024, 0.025, iron);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const o = transformed(out, a);
    box(o, 'metal', [-0.07, 19.65, 0.41], [0.07, 19.86, 0.43], iron);
  }
  box(out, 'metal', [-0.31, 20.02, -0.015], [-0.075, 20.14, 0.015], iron);
}
export function buildRodsher(out) {
  octLoft(
    out,
    [
      [0, 3.19],
      [0.21, 3.19],
      [0.36, 3.1],
    ],
    'concrete',
    [0.44, 0.43, 0.38],
  );
  octWalls(out, 0.36, 4.76, 3.1, [{ face: 4, y: 0.48, w: 1.08, h: 2.27, door: true }]);
  octLoft(out, [
    [4.76, 3.1],
    [4.88, 3.15],
    [4.99, 2.69],
    [5.08, 2.58],
  ]);
  octWalls(out, 5.08, 12.05, 2.58, [
    { face: 0, y: 5.77, w: 0.7, h: 1.46 },
    { face: 0, y: 8.74, w: 0.7, h: 1.46 },
    { face: 4, y: 5.77, w: 0.7, h: 1.46 },
    { face: 4, y: 8.74, w: 0.7, h: 1.46 },
  ]);
  octLoft(out, [
    [12.05, 2.58],
    [12.79, 3.13],
    [13.08, 3.13],
    [13.18, 3.19],
  ]);
  ring(out, 'metal', 13.18, 1.25, 2.83, 0.04, iron, 128);
  circularRails(out, 13.22, 2.78, 1.06, 24);
  panelArray(out, 3.0);
  panelArray(out, 5.49);
  lantern(out);
  // Three shallow steps enter on the opposite face from the south-oriented solar banks.
  const o = transformed(out, Math.PI);
  for (let i = 0; i < 3; i++)
    box(
      o,
      'concrete',
      [-0.82, 0, 2.64],
      [0.82, (3 - i) * 0.16, 3.25 + i * 0.35],
      [0.51, 0.51, 0.43],
    );
  for (const x of [-0.88, 0.88]) {
    tube(o, 'metal', [x, 0.06, 3.92], [x, 1.1, 3.92], 0.017, iron, 8);
    tube(o, 'metal', [x, 0.48, 2.8], [x, 1.25, 2.8], 0.017, iron, 8);
    tube(o, 'metal', [x, 1.1, 3.92], [x, 1.25, 2.8], 0.019, iron, 8);
  }
}
export const rodsherStudies = [
  lighthouseStudy({
    id: 'N0672',
    key: 'rodsher',
    title: 'Rodsher Lighthouse',
    wikidataId: 'Q3366505',
    build: buildRodsher,
    size: [7, 20.5, 8],
    metricTriangleUv: true,
    visualBrief:
      'Red octagonal tower with broad lower pedestal, reduced upper shaft, two opposed pairs of deep arched windows, flared masonry gallery, circular railed watch room, two pairs of south-facing solar panels, wire-mesh lantern balcony, clear framed lantern, riveted domed roof, red ventilator and cardinal vane.',
    sourceFacts: {
      publishedStructureHeightMeters: 18.8976,
      publishedFocalHeightMeters: 20,
      modeledVaneTopMeters: 20.45,
      surveyControlHeightsMeters: {
        baseLedge: 4.9,
        shaftTop: 12.05,
        gallery: 13.18,
        lanternBalcony: 15.48,
        lanternEave: 17.52,
        roofGlobe: 19.11,
      },
      surveyMeasurementBasis:
        'RGO/Fertoing published GLB rawY span20.75m includes rough ground and vane. Intersections of its triangle mesh supply the pedestal, shaft, flared gallery, watch-room and lantern heights; original point offsets and small survey tilt are removed. Its two pairs of arched windows and solar-bank opposition determine local facade arrangement. Dimensions are reconstructed survey-model controls, not geodetic survey coordinates.',
      sourceSurveyHash: 'sha256:6f4e4ad71d894058cf3abe9cd068e4b7d7919139df2d800ae4d4e559ab25debc',
    },
    referencePages: [
      'https://rgo.ru/activity/project-list/mayak-rodsher/',
      'https://rgo.ru/upload/content_block/files/246a6930c50362071bf4979ef4a9fd86/67b2fdb8eb2f0694a33c4f35f3af859b6.glb',
      'https://rgo.ru/upload/content_block/images/2a4874030ffc83a09c95cfbd1b0facbc/679b960d61ef93e1dd48375b7b05fb951.jpg',
      'https://creativecommons.org/licenses/by/3.0/',
    ],
    reconstructionAttribution:
      'Survey model and site photographs: Russian Geographical Society maritime-heritage project with Fertoing and People of the Sea Foundation, published under CC BY3.0 unless otherwise marked. Model inspected as dimensional/reference evidence; source triangles and photographic texture atlases are not copied. This component reconstruction has new geometry, metric UVs and shared procedural materials.',
    geographicProposal: {
      anchor: [26.67976, 59.968681],
      heading: 0,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://rgo.ru/activity/project-list/mayak-rodsher/',
      notes:
        'Official project supplies the lighthouse coordinate, correcting the catalog island reference. Native+Z solar banks face the southern sea side; opposite door is landward/north. This quadrant follows the project site photographs and solar array configuration, while the survey model resolves internal180-degree opposition. A survey-north axis is not supplied; exact azimuth is photo-reconstructed. Footing contacts the mapped island terrain rather than forcing the20m focal elevation onto the base.',
    },
    limitations: [
      'Published survey/photographic exterior is modeled using clean shared red plaster/iron rather than retaining baked photographic shadows. Thin gallery wire, glass panes and roof hardware are reconstructed as real geometry; surrounding detached derelict houses and island rock terrain remain map features. Small optical hardware is represented only to the detail visible through the lantern. Current maintenance color may vary, but the red daymark and structural arrangement follow the maritime-heritage project.',
    ],
    qaCameras: [
      { name: 'near-solar-windows', position: [6.2, 7.2, 10], lookAt: [0, 6.9, 1.5] },
      { name: 'near-entry', position: [-7, 4, -9], lookAt: [0, 1.6, -2.7] },
      { name: 'near-gallery', position: [6, 14.3, 7], lookAt: [0, 14.3, 0] },
      { name: 'near-lantern', position: [4.8, 18.4, 5.4], lookAt: [0, 17.0, 0] },
      { name: 'far-silhouette', position: [21, 13, 28], lookAt: [0, 10.1, 0] },
    ],
  }),
];
