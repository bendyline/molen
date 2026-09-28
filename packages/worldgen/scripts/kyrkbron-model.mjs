/** The two separately curved concrete box decks and their northern ramps. */

import { readFileSync } from 'node:fs';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('n0010_kyrkbron', 'map-frame.json')));
const concrete = [0.63, 0.622, 0.584],
  edge = [0.69, 0.689, 0.649],
  metal = [0.52, 0.54, 0.53],
  dark = [0.2, 0.213, 0.219],
  white = [0.86, 0.86, 0.81];
const mix = (a, b, t) => a + (b - a) * t;
const grade = (x) =>
  x < -140 ? mix(5.75, 6.28, (x + 202) / 62) : x > 100 ? mix(6.28, 5.82, (x - 100) / 102) : 6.28;
const routes = new Map(map.routes.map((r) => [r.id, r.points]));
const north = [...routes.get(26930856), ...routes.get(4568304).slice(1)],
  south = [...routes.get(27429158)].reverse();
const pierStations = [-173, -131, -86, -41, 4, 49, 94, 139, 179];
function tangentPath(path) {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return {
      p,
      t: [(b[0] - a[0]) / d, (b[1] - a[1]) / d],
      n: [-(b[1] - a[1]) / d, (b[0] - a[0]) / d],
    };
  });
}
function sample(path, step = 1) {
  const result = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.ceil(d / step);
    for (let k = 0; k < count; k++)
      result.push([mix(a[0], b[0], k / count), mix(a[1], b[1], k / count)]);
  }
  result.push(path.at(-1));
  return result;
}
function atX(path, x) {
  for (let i = 1; i < path.length; i++)
    if (x >= path[i - 1][0] && x <= path[i][0]) {
      const a = path[i - 1],
        b = path[i],
        t = (x - a[0]) / (b[0] - a[0]),
        d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return {
        p: [x, mix(a[1], b[1], t)],
        n: [-(b[1] - a[1]) / d, (b[0] - a[0]) / d],
        t: [(b[0] - a[0]) / d, (b[1] - a[1]) / d],
      };
    }
  return undefined;
}
function curvedBeam(out, path, width) {
  const rows = tangentPath(sample(path, 2));
  const ring = ({ p, n }) => {
    const y = grade(p[0]);
    return [
      [-width * 0.5, y - 0.39],
      [width * 0.5, y - 0.39],
      [width * 0.42, y - 2.48],
      [-width * 0.42, y - 2.48],
    ].map(([u, h]) => [p[0] + n[0] * u, h, p[1] + n[1] * u]);
  };
  loft(out, 'concrete', rows.map(ring), concrete);
  // Exposed longitudinal seams and form-board lines are subtle physical relief.
  for (let j = 1; j < rows.length; j++)
    for (const side of [-1, 1])
      for (const dy of [0.78, 1.13, 1.48, 1.83, 2.17]) {
        const point = (r) => {
          const u = side * width * (0.5 - ((dy - 0.39) / 2.09) * 0.08);
          return [r.p[0] + r.n[0] * u, grade(r.p[0]) - dy, r.p[1] + r.n[1] * u];
        };
        beam(
          out,
          'concrete',
          point(rows[j - 1]),
          point(rows[j]),
          0.012,
          0.009,
          concrete.map((v) => v - 0.035),
        );
      }
}
function pillar(out, frame, width = 5.8) {
  const { p, n, t } = frame,
    y = grade(p[0]) - 2.49,
    r = 0.7,
    w = width / 2 - r;
  const plan = [];
  for (const side of [-1, 1])
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 20 + (side < 0 ? Math.PI : 0),
        u = side * w + r * Math.cos(a),
        v = r * Math.sin(a);
      plan.push([p[0] + n[0] * u + t[0] * v, p[1] + n[1] * u + t[1] * v]);
    }
  // Consistent clockwise plan winding for the vertically lofted capsule.
  if (
    plan.reduce(
      (s, a, i) =>
        s + a[0] * plan[(i + 1) % plan.length][1] - plan[(i + 1) % plan.length][0] * a[1],
      0,
    ) > 0
  )
    plan.reverse();
  const ring = (h) => plan.map(([x, z]) => [x, h, z]);
  loft(out, 'concrete', [ring(0), ring(y - 0.08)], concrete);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.23));
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count,
        x = mix(a[0], b[0], u),
        z = mix(a[1], b[1], u);
      tube(
        out,
        'concrete',
        [x, 0.05, z],
        [x, y - 0.13, z],
        0.006,
        concrete.map((v) => v - 0.055),
        4,
      );
    }
  }
  for (const side of [-1, 1]) {
    const x = p[0] + n[0] * side * 1.8,
      z = p[1] + n[1] * side * 1.8;
    box(
      out,
      'iron',
      [x - 0.3, y - 0.08, z - 0.3],
      [x + 0.3, y + 0.025, z + 0.3],
      [0.19, 0.2, 0.193],
    );
  }
}
function stripe(out, path, offset, width, dashed = false) {
  const rows = tangentPath(sample(path, 1));
  for (let i = 1; i < rows.length; i++) {
    if (dashed && i % 10 >= 4) continue;
    const a = rows[i - 1],
      b = rows[i],
      p = (r, d) => [
        r.p[0] + r.n[0] * (offset + d),
        grade(r.p[0]) + 0.012,
        r.p[1] + r.n[1] * (offset + d),
      ],
      ps = [p(a, -width / 2), p(b, -width / 2), p(b, width / 2), p(a, width / 2)];
    quad(out, 'marking', ps, [0, 1, 0], white);
  }
}
function railing(out, a, b, ends = false) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < 0.01) return;
  const n = [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
  const count = Math.max(1, Math.ceil(d / 2.2)),
    p = (t, h) => [mix(a[0], b[0], t), grade(mix(a[0], b[0], t)) + h, mix(a[1], b[1], t)];
  const ps = [p(0, -0.28), p(1, -0.28), p(1, 0.18), p(0, 0.18)];
  quad(out, 'concrete', ps, normalFor(...ps), edge);
  for (let i = 0; i < count; i++) {
    const t = i / count,
      pos = p(t, 0);
    box(
      out,
      'iron',
      [pos[0] - 0.07, pos[1] + 0.15, pos[2] - 0.07],
      [pos[0] + 0.07, pos[1] + 1.31, pos[2] + 0.07],
      metal,
    );
    box(
      out,
      'iron',
      [pos[0] - 0.13, pos[1] + 0.16, pos[2] - 0.13],
      [pos[0] + 0.13, pos[1] + 0.2, pos[2] + 0.13],
      metal,
    );
    for (const s of [-1, 1])
      tube(
        out,
        'iron',
        [pos[0] + s * 0.088, pos[1] + 0.2, pos[2] + 0.085],
        [pos[0] + s * 0.088, pos[1] + 0.22, pos[2] + 0.085],
        0.019,
        metal,
        8,
      );
  }
  for (const h of [0.43, 0.86, 1.32])
    tube(out, 'iron', p(0, h), p(1, h), h === 1.32 ? 0.035 : 0.023, metal, 8);
  // Upright infill below handrail; no opaque safety panels.
  if (!ends)
    for (let j = 1; j < Math.ceil(d / 0.18); j++) {
      const t = j / Math.ceil(d / 0.18);
      tube(out, 'iron', p(t, 0.2), p(t, 1.29), 0.009, metal, 6);
    }
  const q0 = [a[0] + n[0] * 0.2, grade(a[0]) + 0.18, a[1] + n[1] * 0.2],
    q1 = [b[0] + n[0] * 0.2, grade(b[0]) + 0.18, b[1] + n[1] * 0.2];
  quad(out, 'concrete', [p(0, 0.18), p(1, 0.18), q1, q0], [0, 1, 0], edge);
}
function lamp(out, frame) {
  const { p, n } = frame,
    x = p[0] + n[0] * 4.2,
    z = p[1] + n[1] * 4.2,
    y = grade(p[0]);
  tube(out, 'iron', [x, y, z], [x, y + 8.1, z], 0.055, metal, 12);
  tube(out, 'iron', [x, y + 8.1, z], [x - n[0] * 1.6, y + 8.3, z - n[1] * 1.6], 0.035, metal, 10);
  box(
    out,
    'iron',
    [x - n[0] * 1.65 - 0.33, y + 8.21, z - n[1] * 1.65 - 0.12],
    [x - n[0] * 1.65 + 0.33, y + 8.35, z - n[1] * 1.65 + 0.12],
    [0.37, 0.39, 0.39],
  );
}
export function buildKyrkbron(out) {
  let outline = map.geometry.outline.slice(0, -1);
  if (
    outline.reduce(
      (s, a, i) =>
        s +
        a[0] * outline[(i + 1) % outline.length][1] -
        outline[(i + 1) % outline.length][0] * a[1],
      0,
    ) > 0
  )
    outline = outline.reverse();
  if (
    !out.addCap(
      'road',
      'palette:#ffffff',
      outline,
      [],
      (p) => grade(p[0]),
      [0, 1, 0],
      (p) => p,
      dark,
    )
  )
    throw Error('Kyrkbron deck triangulation failed');
  if (
    !out.addCap(
      'concrete',
      'palette:#ffffff',
      outline,
      [],
      (p) => grade(p[0]) - 0.39,
      [0, -1, 0],
      (p) => p,
      concrete,
    )
  )
    throw Error('Kyrkbron soffit triangulation failed');
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      ps = [
        [a[0], grade(a[0]) - 0.39, a[1]],
        [b[0], grade(b[0]) - 0.39, b[1]],
        [b[0], grade(b[0]), b[1]],
        [a[0], grade(a[0]), a[1]],
      ];
    quad(out, 'concrete', ps, normalFor(...ps), edge);
    if (
      Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) * 0.6 &&
      Math.hypot(b[0] - a[0], b[1] - a[1]) > 3
    )
      railing(out, a, b);
  }
  curvedBeam(out, north, 7.8);
  curvedBeam(out, south, 7.4);
  const westRamp = [...routes.get(27145341)].reverse(),
    eastRamp = routes.get(26930872);
  curvedBeam(out, westRamp, 4.6);
  curvedBeam(out, eastRamp, 4.8);
  for (const route of [north, south])
    for (const x of pierStations) {
      const f = atX(route, x);
      if (f) pillar(out, f);
    }
  for (const route of [westRamp, eastRamp])
    for (const x of [80, 123, 153]) {
      const f = atX(route, x);
      if (f) pillar(out, f, 3.7);
    }
  for (const route of [north, south]) {
    stripe(out, route, 0, 0.13, true);
    for (const off of [-3.25, 3.25]) stripe(out, route, off, 0.12);
    for (const x of [-162, -122, -82, -42, -2, 38, 78, 118, 158]) {
      const f = atX(route, x);
      if (f) lamp(out, f);
    }
  }
  for (const route of [westRamp, eastRamp])
    for (const off of [-1.65, 1.65]) stripe(out, route, off, 0.12);
  // Separate shared walking/cycling strip follows the mapped deck rather than the world axis.
  const cycle = tangentPath(sample(routes.get(25877854), 1));
  for (let i = 1; i < cycle.length; i++) {
    const a = cycle[i - 1],
      b = cycle[i],
      p = (r, u) => [r.p[0] + r.n[0] * u, grade(r.p[0]) + 0.022, r.p[1] + r.n[1] * u];
    quad(
      out,
      'road',
      [p(a, -1.1), p(b, -1.1), p(b, 1.1), p(a, 1.1)],
      [0, 1, 0],
      [0.26, 0.27, 0.269],
    );
  }
  // Slender drains, capped outlets and expansion plates at the two bank ends.
  for (const route of [north, south])
    for (const x of [-150, -105, -60, -15, 30, 75, 120, 165]) {
      const f = atX(route, x);
      if (!f) continue;
      const px = f.p[0] + f.n[0] * 4.2,
        pz = f.p[1] + f.n[1] * 4.2,
        y = grade(x);
      tube(out, 'iron', [px, y - 0.15, pz], [px, y - 2.62, pz], 0.066, [0.37, 0.385, 0.37], 10);
      tube(
        out,
        'iron',
        [px, y - 2.62, pz],
        [px + f.n[0] * 0.4, y - 2.72, pz + f.n[1] * 0.4],
        0.066,
        [0.37, 0.385, 0.37],
        10,
      );
    }
  for (const route of [north, south])
    for (const x of [-188, 190]) {
      const f = atX(route, x);
      if (!f) continue;
      beam(
        out,
        'iron',
        [f.p[0] - f.n[0] * 4.8, grade(x) + 0.026, f.p[1] - f.n[1] * 4.8],
        [f.p[0] + f.n[0] * 4.8, grade(x) + 0.026, f.p[1] + f.n[1] * 4.8],
        0.16,
        0.022,
        [0.18, 0.2, 0.21],
      );
    }
}
export const kyrkbronStudy = {
  id: 'N0010',
  key: 'kyrkbron',
  title: 'Kyrkbron',
  wikidataId: 'Q3603778',
  build: buildKyrkbron,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Two separately curved low concrete box-girder decks with open central gap, independently branching northern ramps, capsule piers, steel bearings, shared cycleway, metal parapets, road markings, drain pipes and low-arm street lighting.',
  refs: [
    'https://lm.umea.se/namnkarta/poi/14076CF0/Kyrkbron',
    'https://www.umu.se/sidan-68/tema-2-uppror/kyrkbron/',
    'https://www.umea.se/upplevaochgora/idrottmotionochfriluftsliv/friluftslivochmotion/batarochhamnar.4.7d7d901172bb372c5d3c03.html',
    'https://commons.wikimedia.org/wiki/File:Kyrkbron_pelare_2011-08-31.jpg',
    'https://commons.wikimedia.org/wiki/File:Kyrkbron.jpg',
    'https://www.openstreetmap.org/way/454759226',
  ],
  sourceFacts: {
    opened: '1975-09-26',
    architect: 'Erik Thelaus',
    municipalNavigationClearanceMeters: 3.8,
    clearanceCondition: 'Normal water stage',
    mainDecks: 2,
    mappedEnvelopeMeters: [402.905, 91.196],
    reportedLengthMeters: 391,
    reportedLengthBasis:
      'Wikidata/secondary transcription of municipal drawing3310-07; actual drawing not accessed',
  },
  reconstruction: {
    pierStations,
    concreteBoxDepthMeters: 2.48,
    mainDeckTopAboveReferenceWaterMeters: 6.28,
    mainSoffitAboveReferenceWaterMeters: 3.8,
    notes:
      'Exact mapped outline and lane/cycleway/ramp centerlines constrain horizontal form. Piers, sections, shore grading, bearings, lights and fittings are photographic interpretations from original2010/2011field photos. Municipal3.8m normal-water navigation clearance establishes modeled central soffit; no surveyed normal water-to-host terrain conversion is claimed.',
  },
  nativeAxes: {
    x: 'NE toward church/city bank',
    y: 'up from provisional normal water reference',
    z: 'SE downstream',
  },
  geographic: () => ({
    anchor: map.anchor,
    heading: map.heading,
    featureIds: ['way/454759226'],
    source: 'https://www.openstreetmap.org/way/454759226',
    elevationMode: 'sea-level',
    elevationMeters: 0,
    notes:
      'Exact-QID exterior outline and signed road/ramp centerlines retain the twin decks and asymmetric northern ramps. NativeY0 is a provisional river reference; seasonal river level, shore approach grade and datum conversion remain host-dependent.',
  }),
  limitations: [
    'Original exterior reconstruction; the published municipal navigation clearance is distinguished from photographic deck depth and pier stationing.',
    'Map envelope includes branch ramps. It is not a91m-wide single deck; unrelated wooden bank footbridges and the separate upstream Tegsvägen crossings are omitted.',
    'Original field photographs by MikaelLindmark(2011,CCBYSA3.0) and DagLindgren(2010) were consulted for structure. No photographs or third-party mesh are embedded.',
    'Normal water level is represented at provisional sea level0; exact stage and bank integration require host terrain/water agreement.',
  ],
  camera: { position: [-130, 115, 410], lookAt: [0, 5, 6], fov: 44 },
  qaCameras: [
    { name: 'twin-box-soffits', position: [-155, 2.6, 31], lookAt: [70, 4.5, -6], fov: 61 },
    { name: 'river-piers', position: [-41, 11, 81], lookAt: [-41, 3.3, 19], fov: 48 },
    { name: 'northern-ramps', position: [134, 82, 89], lookAt: [105, 4, 4], fov: 55 },
    { name: 'road-and-cycle', position: [-75, 8.1, 29], lookAt: [14, 6.8, 16], fov: 59 },
    { name: 'bearing-and-drain', position: [-39, 3, 37], lookAt: [-41, 3.2, 33], fov: 55 },
    { name: 'full-crossing', position: [-10, 55, 475], lookAt: [0, 4, 1], fov: 46 },
  ],
};
