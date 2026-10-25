/** Ajanta's continuous cliff frontage; retained site boundary is not a building extrusion. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingShape, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/te/tet/ajanta_caves/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  rec = frame.reconstruction;
const palette = {
  rock: '#a39e91',
  carved: '#b8aa95',
  interior: '#827c6e',
  ledge: '#aaa493',
  metal: '#78858b',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
export function ajantaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ajanta grade outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, p, n, tint) => {
    p = p.map((v) => v.map(Math.fround));
    if (n) {
      for (let i = 1; i < p.length - 1; i++) {
        const q = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...q) < 0.5) continue;
        if (q.reduce((s, v, k) => s + v * n[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const col = tint ?? colors[slot],
      color = d === 0 ? col.map((v, k) => v * means[slot][k]) : col;
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
// Skip distant cutters before clipping. A nonintersecting aperture must not fragment
// unrelated cliff panels merely because their projected half planes cross.
function cliffOpenings(out, holes) {
  const cutters = holes.map((h) => {
    const points = h.ring.flatMap(([u, y]) =>
      [-h.depth / 2, h.depth / 2].map((v) => h.point(u, y, v)),
    );
    return {
      hole: h,
      min: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))),
      max: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))),
    };
  });
  return {
    addTriangle(slot, ref, points, normal, uv, color) {
      const min = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))),
        max = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
      const nearby = cutters.filter((h) =>
        min.every((v, k) => v <= h.max[k] + 1e-6 && max[k] >= h.min[k] - 1e-6),
      );
      openingBuilder(
        out,
        nearby.map((h) => h.hole),
      ).addTriangle(slot, ref, points, normal, uv, color);
    },
  };
}
export const ajantaPoint = (p, u, y, v = 0) => [
  p.center[0] + p.axis[0] * u + p.normal[0] * v,
  p.floorY + y,
  p.center[1] + p.axis[1] * u + p.normal[1] * v,
];
const holesFor = (p, d) => {
  const holes = [],
    add = (name, u, bottom, width, height, shape = 'rect', spring = 0) =>
      holes.push({
        name,
        center: p.center.map((v, k) => v + p.axis[k] * u),
        axis: p.axis,
        normal: p.normal,
        bottom: p.floorY + bottom,
        width,
        height,
        shape,
        spring,
        depth: 24,
      });
  if (p.type === 'chaitya' && d > 0) {
    for (const u of [-0.31 * p.width, 0, 0.31 * p.width])
      add(`door-${u}`, u, 0, p.width * 0.18, 3.7);
    add('chaitya-window', 0, 5.0, p.width * 0.48, 5.6, 'round', 1.6);
  } else {
    add('portico', 0, 0, p.width * 0.92, 5.4);
    if (p.stories === 2 && d > 0) add('upper-portico', 0, 6.1, p.width * 0.88, 3.5);
  }
  return holes;
};
export const ajantaOpenings = (d = 3) => rec.caves.flatMap((p) => holesFor(p, d));
const localFace = (face, p, slot, points, n = [p.normal[0], 0, p.normal[1]]) =>
  face(
    slot,
    points.map((q) => ajantaPoint(p, ...q)),
    n,
  );
function block(face, p, u0, u1, y0, y1, v0, v1, slot) {
  const P = (u, y, v) => ajantaPoint(p, u, y, v),
    n = [p.normal[0], 0, p.normal[1]],
    a = [p.axis[0], 0, p.axis[1]];
  face(slot, [P(u0, y0, v1), P(u1, y0, v1), P(u1, y1, v1), P(u0, y1, v1)], n);
  face(
    slot,
    [P(u1, y0, v0), P(u0, y0, v0), P(u0, y1, v0), P(u1, y1, v0)],
    n.map((v) => -v),
  );
  face(
    slot,
    [P(u0, y0, v0), P(u0, y0, v1), P(u0, y1, v1), P(u0, y1, v0)],
    a.map((v) => -v),
  );
  face(slot, [P(u1, y0, v1), P(u1, y0, v0), P(u1, y1, v0), P(u1, y1, v1)], a);
  face(slot, [P(u0, y1, v1), P(u1, y1, v1), P(u1, y1, v0), P(u0, y1, v0)], [0, 1, 0]);
}
function column(face, p, u, b, h, d) {
  if (d <= 1) {
    block(face, p, u - 0.25, u + 0.25, b, b + h, -0.4, 0.1, 'carved');
    return;
  }
  const n = d === 2 ? 8 : d === 3 ? 12 : 16,
    levels =
      d === 2
        ? [
            [b, 0.42],
            [b + 0.5, 0.42],
            [b + h - 0.6, 0.26],
            [b + h, 0.48],
          ]
        : [
            [b, 0.5],
            [b + 0.3, 0.5],
            [b + 0.55, 0.28],
            [b + h - 0.8, 0.26],
            [b + h - 0.45, 0.46],
            [b + h, 0.46],
          ],
    P = (i, y, r) =>
      ajantaPoint(
        p,
        u + Math.cos((i / n) * Math.PI * 2) * r,
        y,
        -0.12 + Math.sin((i / n) * Math.PI * 2) * r,
      );
  for (let k = 1; k < levels.length; k++)
    for (let j = 0; j < n; j++) {
      const a = levels[k - 1],
        b = levels[k];
      face(
        'carved',
        [P(j, a[0], a[1]), P(j + 1, a[0], a[1]), P(j + 1, b[0], b[1]), P(j, b[0], b[1])],
        [
          p.axis[0] * Math.cos(((j + 0.5) / n) * Math.PI * 2) +
            p.normal[0] * Math.sin(((j + 0.5) / n) * Math.PI * 2),
          0,
          p.axis[1] * Math.cos(((j + 0.5) / n) * Math.PI * 2) +
            p.normal[1] * Math.sin(((j + 0.5) / n) * Math.PI * 2),
        ],
      );
    }
}
function room(face, p, h, d) {
  const u = h.center.map((v, k) => (v - p.center[k]) * p.axis[k]).reduce((a, b) => a + b, 0),
    w = h.width / 2,
    b = h.bottom - p.floorY,
    t = b + h.height,
    depth = p.depth;
  const frontAt = (x) => {
    const hits = [];
    for (let i = 1; i < rec.sections.length; i++) {
      const a = rec.sections[i - 1].center.map((v, k) => v - p.center[k]),
        b = rec.sections[i].center.map((v, k) => v - p.center[k]),
        ua = a.reduce((n, v, k) => n + v * p.axis[k], 0),
        ub = b.reduce((n, v, k) => n + v * p.axis[k], 0);
      if (Math.abs(ub - ua) < 1e-8) continue;
      const t = (x - ua) / (ub - ua);
      if (t < -1e-7 || t > 1 + 1e-7) continue;
      hits.push(a.reduce((n, v, k) => n + (v + (b[k] - v) * t) * p.normal[k], 0));
    }
    if (!hits.length) throw Error(`Cave ${p.number}: recess edge has no cliff join`);
    return hits.toSorted((a, b) => Math.abs(a) - Math.abs(b))[0] + 0.03;
  };
  const leftFront = frontAt(u - w),
    rightFront = frontAt(u + w),
    front = [
      [u + w, rightFront],
      ...(u - w < 0 && u + w > 0 ? [[0, frontAt(0)]] : []),
      [u - w, leftFront],
    ];
  localFace(face, p, 'interior', [
    [u - w, b, -depth],
    [u + w, b, -depth],
    [u + w, t, -depth],
    [u - w, t, -depth],
  ]);
  localFace(
    face,
    p,
    'carved',
    [[u + w, b, -depth], [u - w, b, -depth], ...front.toReversed().map(([x, v]) => [x, b, v])],
    [0, 1, 0],
  );
  localFace(
    face,
    p,
    'carved',
    [[u - w, t, -depth], [u + w, t, -depth], ...front.map(([x, v]) => [x, t, v])],
    [0, -1, 0],
  );
  localFace(
    face,
    p,
    'carved',
    [
      [u - w, b, leftFront],
      [u - w, b, -depth],
      [u - w, t, -depth],
      [u - w, t, leftFront],
    ],
    [p.axis[0], 0, p.axis[1]],
  );
  localFace(
    face,
    p,
    'carved',
    [
      [u + w, b, -depth],
      [u + w, b, rightFront],
      [u + w, t, rightFront],
      [u + w, t, -depth],
    ],
    [-p.axis[0], 0, -p.axis[1]],
  );
  if (p.type !== 'chaitya' || h.name.includes('portico')) {
    const count =
      d === 1 ? Math.max(2, Math.floor(h.width / 4)) : Math.max(2, Math.floor(h.width / 3));
    for (let i = 1; i < count; i++) column(face, p, u - w + (h.width * i) / count, b, h.height, d);
    block(face, p, u - w - 0.2, u + w + 0.2, t, t + 0.45, -0.5, 0.35, 'carved');
  }
}
function arch(face, p, h, d) {
  const v = prepareOpening(h, 0, d),
    inner = openingShape(h, d),
    outer = openingShape(
      {
        ...h,
        width: h.width + 0.9,
        bottom: h.bottom - 0.4,
        height: h.height + 0.9,
        spring: h.spring + 0.4,
      },
      d,
    );
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      'carved',
      [
        v.point(...outer[i], 0.4),
        v.point(...outer[j], 0.4),
        v.point(...inner[j], 0.4),
        v.point(...inner[i], 0.4),
      ],
      [p.normal[0], 0, p.normal[1]],
    );
    face(
      'carved',
      [
        v.point(...inner[i], 0.4),
        v.point(...inner[j], 0.4),
        v.point(...inner[j], -p.depth),
        v.point(...inner[i], -p.depth),
      ],
      [p.normal[0], 0, p.normal[1]],
    );
  }
  localFace(face, p, 'carved', [
    [-0.55, 10.5, 0.45],
    [0.55, 10.5, 0.45],
    [0, 12.2, 0.45],
  ]);
  if (d >= 2) {
    const P = (u, y) => ajantaPoint(p, u, y, 0.55),
      b = h.bottom - p.floorY;
    face(
      'metal',
      [P(-0.2, b + 0.2), P(0.2, b + 0.2), P(0.2, b + h.height - 0.2), P(-0.2, b + h.height - 0.2)],
      [p.normal[0], 0, p.normal[1]],
    );
    for (const sg of [-1, 1])
      face(
        'metal',
        [
          P(sg * h.width * 0.43, b + h.height * 0.7),
          P(sg * h.width * 0.43 + 0.3, b + h.height * 0.7),
          P(0.15, b + h.height * 0.36),
          P(-0.15, b + h.height * 0.36),
        ],
        [p.normal[0], 0, p.normal[1]],
      );
  }
}
function facade(face, out, p, d) {
  const hs = holesFor(p, d);
  if (d === 0) {
    localFace(face, p, 'interior', [
      [-p.width * 0.44, 0.2, 0.45],
      [p.width * 0.44, 0.2, 0.45],
      [p.width * 0.44, 4.9, 0.45],
      [-p.width * 0.44, 4.9, 0.45],
    ]);
    if (p.type === 'chaitya') {
      const h = {
        ...hs[0],
        bottom: p.floorY + 5,
        width: p.width * 0.48,
        height: 5.6,
        shape: 'round',
        spring: 1.6,
      };
      localFace(
        face,
        p,
        'interior',
        openingShape({ ...h, bottom: 5 }, 0).map((q) => [q[0], q[1], 0.5]),
      );
      arch(face, p, h, 0);
    }
    return;
  }
  for (const h of hs) room(face, p, h, d);
  if (p.type === 'chaitya') {
    const f = writer(
      openingBuilder(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
    localFace(f, p, 'carved', [
      [-p.width * 0.53, 0, 0.2],
      [p.width * 0.53, 0, 0.2],
      [p.width * 0.53, 13, 0.2],
      [-p.width * 0.53, 13, 0.2],
    ]);
    const h = hs.find((h) => h.name === 'chaitya-window');
    arch(face, p, h, d);
    for (const y of [4.2, 10.9, 12.4])
      block(face, p, -p.width * 0.55, p.width * 0.55, y, y + 0.45, -0.3, 0.65, 'carved');
    for (const sg of [-1, 1])
      block(
        face,
        p,
        sg * p.width * 0.45 - 0.35,
        sg * p.width * 0.45 + 0.35,
        0,
        12.7,
        -0.2,
        0.65,
        'carved',
      );
    if (d >= 2) {
      for (let k = 0; k < 5; k++)
        for (const y of [4.6, 11.5]) {
          const x = -p.width * 0.4 + p.width * 0.2 * k;
          block(face, p, x - 0.38, x + 0.38, y, y + 0.55, 0.2, 0.7, 'carved');
        }
    }
    if (p.number === 19 && d >= 2)
      for (const u of [-p.width * 0.2, p.width * 0.2]) column(face, p, u, 0, 4, d);
  } else
    for (const y of [5.7, ...(p.stories === 2 ? [10] : [])])
      block(face, p, -p.width * 0.51, p.width * 0.51, y, y + 0.4, -0.5, 0.55, 'carved');
}
function build(out, d) {
  const rawFace = writer(out, d),
    holes = d === 0 ? [] : ajantaOpenings(d).map((h) => prepareOpening(h, 0, d)),
    face = writer(cliffOpenings(out, holes), d),
    sections = rec.sections;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i],
      b = sections[i + 1],
      n = [(a.normal[0] + b.normal[0]) / 2, 0, (a.normal[1] + b.normal[1]) / 2],
      P = (s, y) => [s.center[0], y, s.center[1]],
      R = (s, y) => [s.back[0], y, s.back[1]],
      F = (s, y) => [s.front[0], y, s.front[1]],
      rows = d <= 1 ? [0, 1] : [0, 0.32, 0.66, 1];
    for (let j = 1; j < rows.length; j++) {
      const lo = rows[j - 1],
        hi = rows[j],
        tint = colors.rock.map((v) => v * (j % 2 ? 0.96 : 1.035));
      face(
        'rock',
        [
          P(a, a.bottom + (a.top - a.bottom) * lo),
          P(b, b.bottom + (b.top - b.bottom) * lo),
          P(b, b.bottom + (b.top - b.bottom) * hi),
          P(a, a.bottom + (a.top - a.bottom) * hi),
        ],
        n,
        tint,
      );
    }
    rawFace('rock', [P(a, a.top), P(b, b.top), R(b, b.backTop), R(a, a.backTop)], [0, 1, 0]);
    rawFace(
      'rock',
      [R(b, b.bottom), R(a, a.bottom), R(a, a.backTop), R(b, b.backTop)],
      n.map((v) => -v),
    );
    rawFace('rock', [F(a, a.bottom), F(b, b.bottom), P(b, b.bottom), P(a, a.bottom)], [0, -1, 0]);
    rawFace('rock', [F(a, a.bottom), F(b, b.bottom), F(b, b.floorY), F(a, a.floorY)], n);
    rawFace('ledge', [F(a, a.floorY), F(b, b.floorY), P(b, b.floorY), P(a, a.floorY)], [0, 1, 0]);
    if (d >= 2) {
      const q = (s, v, y) => [
        s.center[0] + s.normal[0] * v,
        s.floorY + y,
        s.center[1] + s.normal[1] * v,
      ];
      rawFace('carved', [q(a, 5.7, 0), q(b, 5.7, 0), q(b, 5.7, 0.9), q(a, 5.7, 0.9)], n);
      rawFace(
        'carved',
        [q(a, 5.2, 0.9), q(b, 5.2, 0.9), q(b, 5.7, 0.9), q(a, 5.7, 0.9)],
        [0, 1, 0],
      );
      rawFace(
        'carved',
        [q(a, 5.2, 0.9), q(b, 5.2, 0.9), q(b, 5.2, 0), q(a, 5.2, 0)],
        n.map((v) => -v),
      );
    }
  }
  for (const [s, adjacent] of [
    [sections[0], sections[1]],
    [sections.at(-1), sections.at(-2)],
  ]) {
    const endNormal = [s.center[0] - adjacent.center[0], 0, s.center[1] - adjacent.center[1]];
    rawFace(
      'rock',
      [
        [s.center[0], s.bottom, s.center[1]],
        [s.back[0], s.bottom, s.back[1]],
        [s.back[0], s.backTop, s.back[1]],
        [s.center[0], s.top, s.center[1]],
      ],
      endNormal,
    );
    rawFace(
      'rock',
      [
        [s.front[0], s.bottom, s.front[1]],
        [s.center[0], s.bottom, s.center[1]],
        [s.center[0], s.floorY, s.center[1]],
        [s.front[0], s.floorY, s.front[1]],
      ],
      endNormal,
    );
  }
  for (const p of rec.caves) facade(rawFace, out, p, d);
}
export const buildAjantaSkyline = (o) => build(o, 0),
  buildAjantaDistrict = (o) => build(o, 1),
  buildAjantaStreet = (o) => build(o, 2),
  buildAjantaCloseup = (o) => build(o, 3);
const cam = (name, p, distance, y, lookY) => ({
    name,
    position: [
      p.center[0] + p.normal[0] * distance,
      p.floorY + y,
      p.center[1] + p.normal[1] * distance,
    ],
    lookAt: [p.center[0], p.floorY + lookY, p.center[1]],
    fov: 48,
  }),
  cave = (n) => rec.caves.find((p) => p.number === n);
export const ajantaStudy = {
  id: 'ajanta_caves',
  key: 'ajanta_caves',
  title: 'Ajanta Caves',
  category: 'temple',
  wikidataId: 'Q184427',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Three existing shared256² basalt,concrete and painted-metal graphs across five roles. Metric UVs,linear tints,no embedded images or unique atlas. Original coarse arch,portico and frieze abstractions;no historic artwork or sculptures copied.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'The main connected horseshoe frontage is a medium-fi exterior reconstruction. Inferred gap/end positions,terrain grades,cave proportions,rock profiles and present condition remain approximate;upper excavations29/30 and deep/interior artwork are not reconstructed. Physical-device/full-city performance remains pending.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('cave-19-chaitya', cave(19), 27, 12, 6.5),
    cam('cave-26-chaitya', cave(26), 25, 12, 6),
    cam('cave-10-early-chaitya', cave(10), 25, 10, 5),
    cam('pillared-portico', cave(16), 25, 8, 3),
    cam('double-height-gallery', cave(6), 25, 10, 5),
    { name: 'horseshoe-plan', position: [-20, 420, 0.1], lookAt: [-20, 0, 0], fov: 48 },
  ],
};
