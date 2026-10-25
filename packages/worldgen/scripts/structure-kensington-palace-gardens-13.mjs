/** Original medium-fi exterior of the separate residence at 13 Kensington Palace Gardens. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { B, c, cleanRing, landmarkSurfaces } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/gc/gcp/kensington_palace_gardens_13/map-frame.json',
  import.meta.url,
);
function edges(r) {
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    return { a, b, len, nx: dz / len, nz: -dx / len };
  });
}
function ring(points) {
  const r = cleanRing(points);
  if (
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) < 0
  )
    r.reverse();
  return r;
}
function prism(o, slot, points, y0, y1, color, top = 'roof') {
  const r = ring(points);
  for (const { a, b, nx, nz } of edges(r))
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [nx, 0, nz],
      c[color],
    );
  const ii = earcut(r.flat());
  for (const [y, n, col] of [
    [y0, [0, -1, 0], color],
    [y1, [0, 1, 0], top],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        'concrete',
        'palette:#ffffff',
        p,
        n,
        p.map((q) => [q[0], q[2]]),
        c[col],
      );
    }
}
function edgeBeam(o, a, b, y, width, height, col = 'cream') {
  beam(o, 'concrete', [a[0], y, a[1]], [b[0], y, b[1]], width, height, c[col]);
}
function opening(o, x, y, z, w, h, nx = 0, nz = 1, detail = 3) {
  const tangent = [nz, -nx],
    point = (u, v, d = 0.09) => [x + tangent[0] * u + nx * d, y + v, z + tangent[1] * u + nz * d];
  quad(
    o,
    'glass',
    [point(-w / 2, 0), point(w / 2, 0), point(w / 2, h), point(-w / 2, h)],
    [nx, 0, nz],
    c.glass,
  );
  if (detail < 2) return;
  for (const [u, v, uu, vv] of [
    [-w / 2 - 0.08, -0.08, -w / 2 - 0.08, h + 0.08],
    [w / 2 + 0.08, -0.08, w / 2 + 0.08, h + 0.08],
    [-w / 2 - 0.16, -0.1, w / 2 + 0.16, -0.1],
    [-w / 2 - 0.16, h + 0.1, w / 2 + 0.16, h + 0.1],
    [-w / 2, h * 0.49, w / 2, h * 0.49],
    [0, 0, 0, h],
  ])
    beam(o, 'concrete', point(u, v, 0.16), point(uu, vv, 0.16), 0.13, 0.13, c.cream);
  if (detail > 2)
    for (const u of [-w * 0.25, w * 0.25])
      beam(o, 'metal', point(u, 0, 0.16), point(u, h, 0.16), 0.035, 0.04, c.cream);
  if (detail > 2)
    for (const yy of [h * 0.24, h * 0.74])
      beam(o, 'metal', point(-w / 2, yy, 0.17), point(w / 2, yy, 0.17), 0.035, 0.04, c.cream);
  beam(
    o,
    'concrete',
    point(-w / 2 - 0.2, h + 0.25, 0.18),
    point(w / 2 + 0.2, h + 0.25, 0.18),
    0.16,
    0.2,
    c.cream,
  );
}
function parapet(o, points, y, detail) {
  for (const e of edges(ring(points))) {
    const { a, b, nx, nz, len } = e,
      tx = (b[0] - a[0]) / len,
      tz = (b[1] - a[1]) / len;
    if (detail < 2) {
      edgeBeam(o, a, b, y + 0.45, 0.2, 0.9);
      continue;
    }
    edgeBeam(o, a, b, y + 0.04, 0.28, 0.14);
    edgeBeam(o, a, b, y + 1, 0.32, 0.14);
    const count = Math.max(1, Math.round(len / 1.75));
    for (let j = 0; j <= count; j++) {
      const t = j / count;
      B(
        o,
        'concrete',
        a[0] + (b[0] - a[0]) * t,
        y,
        a[1] + (b[1] - a[1]) * t,
        0.17,
        1.05,
        0.17,
        'cream',
      );
    }
    for (let j = 0; j < count; j++) {
      const mx = a[0] + ((b[0] - a[0]) * (j + 0.5)) / count,
        mz = a[1] + ((b[1] - a[1]) * (j + 0.5)) / count;
      if (detail === 2) {
        const pp = (u, v) => [mx + tx * u, y + v, mz + tz * u];
        const pts = [
          [-0.42, 0.52],
          [0, 0.1],
          [0.42, 0.52],
          [0, 0.94],
        ];
        for (let k = 0; k < 4; k++)
          beam(o, 'concrete', pp(...pts[k]), pp(...pts[(k + 1) % 4]), 0.08, 0.08, c.cream);
        continue;
      }
      // Four connected lobes form open stone tracery; there is no opaque infill panel.
      for (const [u, v] of [
        [-0.22, 0],
        [0.22, 0],
        [0, -0.22],
        [0, 0.22],
      ])
        for (let k = 0; k < 8; k++) {
          const aa = (k / 8) * Math.PI * 2,
            bb = ((k + 1) / 8) * Math.PI * 2,
            pp = (t) => [
              mx + tx * (u + Math.cos(t) * 0.22) + nx * 0.02,
              y + 0.52 + v + Math.sin(t) * 0.22,
              mz + tz * (u + Math.cos(t) * 0.22) + nz * 0.02,
            ];
          beam(o, 'concrete', pp(aa), pp(bb), 0.065, 0.075, c.cream);
        }
    }
  }
}
const tower = [
  [-5.11, 9],
  [-5.11, 10.15],
  [-3.43, 12.23],
  [0.74, 11.99],
  [2.29, 10.14],
  [2.29, 9],
];
const conservatory = [
  [6.89, -16.27],
  [24.88, -16.47],
  [24.91, -7.89],
  [6.89, -7.75],
];
function residence(o, frame, detail) {
  const r = frame.features[0].rings[0],
    main = [...r.slice(0, 14), [6.89, -7.75], ...r.slice(16)];
  prism(o, 'stone', main, -1.5, 9.9, 'sand');
  prism(o, 'stone', tower, -1.5, 15.1, 'sand');
  if (detail >= 2)
    for (const points of [main, tower])
      for (const e of edges(ring(points))) {
        edgeBeam(o, e.a, e.b, 0, 0.3, 0.35, 'sand');
        edgeBeam(o, e.a, e.b, 5.05, 0.24, 0.24, 'cream');
        edgeBeam(o, e.a, e.b, points === tower ? 14.95 : 9.75, 0.34, 0.27, 'cream');
      }
  parapet(o, main, 10, detail);
  parapet(o, tower, 15.2, detail);
  // Paired windows project slightly from each wing, as visible in the street photograph.
  if (detail)
    for (const x of [-9.25, 8.25]) {
      B(o, 'stone', x, -1.5, 10.34, 4.7, 11.4, 0.9, 'sand');
      B(o, 'concrete', x, 5.02, 10.36, 4.84, 0.25, 1.04, 'cream');
      B(o, 'concrete', x, 9.78, 10.36, 4.96, 0.22, 1.12, 'cream');
    }
  for (const x of [-12.4, -10.3, -8.2, -6.1, 4.5, 7, 9.5, 12])
    for (const y of [0.75, 5.7])
      opening(
        o,
        x,
        y,
        detail && [-10.3, -8.2, 7, 9.5].includes(x) ? 10.82 : 10.03,
        1.48,
        y < 2 ? 3.7 : 3.6,
        0,
        1,
        detail,
      );
  if (detail) {
    // Conservative openings on secondary elevations, spaced within the mapped masonry wings.
    for (const e of edges(ring(main))) {
      if (e.nz > 0.7 || e.len < 5) continue;
      const n = Math.floor(e.len / 3.1);
      for (let i = 0; i < n; i++)
        for (const y of [0.85, 5.8])
          opening(
            o,
            e.a[0] + ((e.b[0] - e.a[0]) * (i + 0.5)) / n,
            y,
            e.a[1] + ((e.b[1] - e.a[1]) * (i + 0.5)) / n,
            1.4,
            3.3,
            e.nx,
            e.nz,
            detail,
          );
    }
    // The three outward tower faces carry bay windows; the central ground face is the entrance.
    const fronts = edges(ring(tower)).filter((e) => e.nz > 0.25);
    for (const e of fronts) {
      const x = (e.a[0] + e.b[0]) / 2,
        z = (e.a[1] + e.b[1]) / 2,
        w = Math.min(2.25, e.len - 0.75);
      for (const [y, h] of [
        [5.8, 3.5],
        [11.2, 2.7],
      ])
        opening(o, x, y, z, w, h, e.nx, e.nz, detail);
      if (e.nz < 0.9) opening(o, x, 0.9, z, w, 3.5, e.nx, e.nz, detail);
    }
    const x = -1.35,
      z = 12.28;
    B(o, 'metal', x, 0.1, z, 3.1, 3.8, 0.12, 'brick');
    for (const dx of [-1.65, 1.65]) B(o, 'concrete', x + dx, 0, z, 0.2, 4.3, 0.32, 'cream');
    for (const dx of [-0.95, 0, 0.95])
      for (const yy of [0.65, 2.15]) {
        B(o, 'concrete', x + dx, yy, z + 0.1, 0.66, 1.1, 0.08, 'sand');
        B(o, 'metal', x + dx, yy + 0.08, z + 0.15, 0.52, 0.94, 0.04, 'brick');
      }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI,
        b = Math.PI + ((i + 1) / 12) * Math.PI;
      beam(
        o,
        'concrete',
        [x + Math.cos(a) * 1.75, 3.4 - Math.sin(a) * 0.9, z + 0.25],
        [x + Math.cos(b) * 1.75, 3.4 - Math.sin(b) * 0.9, z + 0.25],
        0.2,
        0.26,
        c.cream,
      );
    }
    B(o, 'metal', x, 4.45, z + 0.5, 4.8, 0.14, 1.4, 'dark');
    for (let i = 0; i < 3; i++)
      B(o, 'concrete', x, -0.45 + i * 0.15, z + 0.9 - i * 0.28, 4.2, 0.15, 1.8 - i * 0.35, 'cream');
    for (const dx of [-2.05, 2.05]) {
      B(o, 'metal', x + dx, 2.7, z + 0.48, 0.22, 0.6, 0.24, 'dark');
      B(o, 'glass', x + dx, 2.82, z + 0.61, 0.12, 0.32, 0.025, 'curtain');
    }
    for (const dx of [-1.8, 1.8]) {
      B(o, 'concrete', x + dx, 4.6, z, 0.35, 0.65, 0.45, 'cream');
      B(o, 'concrete', x + dx, 9.4, z, 0.35, 0.6, 0.45, 'cream');
    }
    for (const [xx, zz] of [
      [-5.1, 10.1],
      [2.25, 10.1],
      [-3.4, 12.2],
      [0.74, 12],
    ]) {
      B(o, 'concrete', xx, 16.2, zz, 0.3, 0.55, 0.3, 'cream');
      loft(
        o,
        'concrete',
        [radialRing(16.75, 0.2, 0.2, 4, [xx, zz]), radialRing(17.4, 0.025, 0.025, 4, [xx, zz])],
        c.cream,
      );
    }
  } else {
    for (const y of [5.8, 11.2]) opening(o, -1.35, y, 12.2, 2.3, 2.7, 0, 1, false);
    B(o, 'metal', -1.35, 0.1, 12.28, 3.1, 3.8, 0.12, 'brick');
  }
  // South conservatory: a low glazed appendage within its mapped plan, not another tall masonry block.
  prism(o, 'concrete', conservatory, -1.5, 1, 'sand');
  prism(o, 'glass', conservatory, 1, 5.2, 'glass', 'roof');
  if (detail)
    for (const e of edges(ring(conservatory))) {
      const count = Math.max(1, Math.round(e.len / 1.8));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        B(
          o,
          'concrete',
          e.a[0] + (e.b[0] - e.a[0]) * t,
          1,
          e.a[1] + (e.b[1] - e.a[1]) * t,
          0.12,
          4.3,
          0.12,
          'cream',
        );
      }
      edgeBeam(o, e.a, e.b, 3.1, 0.12, 0.12);
      edgeBeam(o, e.a, e.b, 5.25, 0.2, 0.2);
    }
  for (const [x, z] of [
    [-11, -9],
    [9, -4],
    [-9, -16],
    [3, -15],
  ]) {
    B(o, 'stone', x, 9.9, z, 0.85, 2.1, 0.75, 'sand');
    B(o, 'concrete', x, 11.95, z, 1.1, 0.2, 1, 'cream');
    if (detail)
      for (const dx of [-0.22, 0.22]) B(o, 'roof', x + dx, 12.15, z, 0.19, 0.65, 0.22, 'brick');
  }
}
export function kensington13(o, frame) {
  residence(o, frame, 3);
}
export function kensington13Skyline(o) {
  residence(o, JSON.parse(fs.readFileSync(framePath)), 0);
}
export function kensington13District(o) {
  residence(o, JSON.parse(fs.readFileSync(framePath)), 1);
}
export function kensington13Street(o) {
  residence(o, JSON.parse(fs.readFileSync(framePath)), 2);
}
export const kensington13Model = {
  id: 'kensington_palace_gardens_13',
  recipe: 'structure-kensington-palace-gardens-13.mjs',
  key: 'kensington_palace_gardens_13',
  cell: 'gc/gcp',
  title: '13 Kensington Palace Gardens',
  brief:
    'Buff masonry residence with two-storey wings, projecting three-storey entrance bay, white sash surrounds, open quatrefoil parapets, flat roof, chimneys and lower glazed south conservatory.',
  camera: [45, 25, 64],
  build: kensington13,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Entrance reference [-1.35,13.2] defines the 27.931 m Terrarium datum. Preserved coarse terrain spans -1.088107..1.290926 m across the footprint; lower closures extend to -1.5 m. Terrain is not a surveyed pavement level.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kensington-palace-gardens-13.mjs',
    level: 'skyline',
    export: 'kensington13Skyline',
    errorMeters: 1.2,
    authoredLevels: {
      district: {
        export: 'kensington13District',
        errorMeters: 0.7,
        surfaces: {
          ...landmarkSurfaces,
          glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
        },
      },
      street: {
        export: 'kensington13Street',
        errorMeters: 0.25,
        surfaces: {
          ...landmarkSurfaces,
          glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
        },
      },
    },
  },
  limitations: [
    'Full surviving exterior reviewed with two original public-domain C.J.Richardson illustrations and independent primary Survey of London/heritage architectural descriptions. The earlier attribution-only photograph is excluded; no measured survey or interior.',
    'Buff masonry, white sash surrounds, entrance bay and open parapet rhythm are represented. Fine carvings, exact tracery and secondary elevation openings are simplified interpretations.',
    'The former bell turret is omitted following the primary1924alteration history. The documented sloping-to-flat roof change applies to the south conservatory. Exact main-roof slopes/drainage, conservatory glazing and hidden rear details remain medium-fi interpretations.',
    'Independent coarse terrain determines host contact. The ambassadorial flag, garden hedges, security fixtures, surrounding streets and interiors are omitted. Local reference photography is not embedded or redistributed.',
  ],
};
