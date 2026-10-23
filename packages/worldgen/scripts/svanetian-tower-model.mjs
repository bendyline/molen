/** 'N0594': reusable Svanetian defensive tower; never a unique-site reconstruction. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { box } from './khmer-structure-geometry.mjs';

const source = new URL(
  '../../../content/worldgen/source/map-structures/n0594_svanetian_tower/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source), 'utf8'));
const scope = read('review-scope.json'),
  means = read('surface-means.json');
const linear = (hex) =>
  hex.match(/../g).map((s) => {
    const v = parseInt(s, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: linear('c7b49a'),
  trim: linear('c5b29a'),
  roof: linear('77756a'),
  wood: linear('82705a'),
};

function build(out, detail) {
  const face = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    if (normalFor(...ps).reduce((n, v, i) => n + v * target[i], 0) < 0) ps = ps.toReversed();
    const color =
      detail === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        role,
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
  // Ground attachment is Y=0. A bounded subgrade footing seats the type on
  // coarse terrain without adding an apron or modifying the terrain surface.
  box(face, 'trim', 0, -1.5, 0, 5.6, 1.82, 5.6);
  const half = (y) => 2.76 - (y - 0.32) * 0.034;
  const arc = (x, y, w, h, round = true) => {
    const r = w / 2,
      spring = round ? y + h - r : y + h;
    const ps = [
      [x - r, y],
      [x + r, y],
      [x + r, spring],
    ];
    if (round)
      for (let i = 1; i <= (detail < 2 ? 4 : 8); i++) {
        const a = (i * Math.PI) / (detail < 2 ? 4 : 8);
        ps.push([x + r * Math.cos(a), spring + r * Math.sin(a)]);
      }
    else ps.push([x - r, spring]);
    return ps;
  };
  const facade = (angle, y0, y1, width, holes, role = 'wall', zfn = half) => {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      point = ([x, y], inset = 0) => [
        x * c + (zfn(y) - inset) * s,
        y,
        -x * s + (zfn(y) - inset) * c,
      ],
      normal = [s, 0, c],
      outer = [
        [-width(y0), y0],
        [width(y0), y0],
        [width(y1), y1],
        [-width(y1), y1],
      ],
      rings = [outer, ...holes.map((h) => h.outline)],
      flat = rings.flat(),
      indices = [];
    let count = outer.length;
    for (const ring of rings.slice(1)) {
      indices.push(count);
      count += ring.length;
    }
    const triangles = earcut(flat.flat(), indices);
    for (let i = 0; i < triangles.length; i += 3)
      face(
        role,
        triangles.slice(i, i + 3).map((k) => point(flat[k])),
        normal,
      );
    for (const hole of holes) {
      const ring = hole.outline;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        const target = [-(b[1] - a[1]) * c, b[0] - a[0], (b[1] - a[1]) * s];
        face('trim', [point(a), point(b), point(b, hole.depth), point(a, hole.depth)], target);
      }
      const triangles = earcut(ring.flat());
      for (let i = 0; i < triangles.length; i += 3)
        face(
          hole.role ?? 'wall',
          triangles.slice(i, i + 3).map((k) => point(ring[k], hole.depth)),
          normal,
        );
    }
  };
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      holes = [];
    if (side === 0) holes.push({ outline: arc(0, 3.15, 0.94, 1.85), depth: 0.36, role: 'wood' });
    // Sparse arrow slits rather than a regular modern window grid.
    if (detail > 0)
      for (const [x, y] of side % 2
        ? [
            [0.34, 10.3],
            [-0.34, 15.9],
          ]
        : [
            [0, 8.6],
            [0.48, 14.7],
          ])
        holes.push({ outline: arc(x, y, 0.19, 0.72, false), depth: 0.32 });
    facade(a, 0.32, 19.9, half, holes);
    // A slightly projecting crown with three real, deep arched recesses per side.
    const mouths = [-1.56, 0, 1.56].map((x) => ({
      outline: arc(x, 20.12, 0.86, 1.2),
      depth: 0.46,
    }));
    facade(
      a,
      19.9,
      21.85,
      () => 2.58,
      mouths,
      'trim',
      () => 2.58,
    );
    // Sloping exposed underside connects crown projection back into the shaft.
    const c = Math.cos(a),
      s = Math.sin(a),
      p = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
    face(
      'trim',
      [
        p(-2.58, 19.9, 2.58),
        p(2.58, 19.9, 2.58),
        p(half(19.42), 19.42, half(19.42)),
        p(-half(19.42), 19.42, half(19.42)),
      ],
      [s, -1, c],
    );
    if (detail >= 2) {
      // Sparse alternating corner dressings stay on the tapered body, with broad facets.
      for (let j = 1; j < 19; j++) {
        const y = j + 0.1,
          w = half(y),
          dy = 0.38;
        for (const sign of [-1, 1]) {
          const x = sign * (w - 0.26),
            z = half(y) + 0.018;
          const ps = [
            [x - 0.25, y, z],
            [x + 0.25, y, z],
            [x + 0.25, y + dy, half(y + dy) + 0.018],
            [x - 0.25, y + dy, half(y + dy) + 0.018],
          ].map((v) => p(...v));
          face('trim', ps, [s, 0, c]);
        }
      }
    }
  }
  // Shallow stone roof with closed gable ends and real underside; no open disk caps.
  const w = 2.76,
    e = 21.85,
    ridge = 23;
  face(
    'roof',
    [
      [-w, e, -w],
      [0, ridge, -w],
      [0, ridge, w],
      [-w, e, w],
    ],
    [-1, 1, 0],
  );
  face(
    'roof',
    [
      [0, ridge, -w],
      [w, e, -w],
      [w, e, w],
      [0, ridge, w],
    ],
    [1, 1, 0],
  );
  for (const z of [-w, w])
    face(
      'trim',
      [
        [-w, e, z],
        [w, e, z],
        [0, ridge, z],
      ],
      [0, 0, Math.sign(z)],
    );
  face(
    'roof',
    [
      [-w, e, -w],
      [w, e, -w],
      [w, e, w],
      [-w, e, w],
    ],
    [0, -1, 0],
  );
  if (detail >= 1) {
    // A few chunky roof courses, not modeled shingles or a per-building atlas.
    for (let i = 1; i <= (detail === 1 ? 2 : 4); i++) {
      const x = (w * i) / (detail === 1 ? 3 : 5),
        y = ridge - ((ridge - e) * x) / w;
      for (const sign of [-1, 1]) box(face, 'roof', sign * x, y - 0.025, 0, 0.1, 0.06, 5.56);
    }
    box(face, 'roof', 0, 22.97, 0, 0.22, 0.1, 5.58);
  }
  if (detail === 3) {
    // Broad lintel/sill and a few timber planks on the recessed elevated entry.
    box(face, 'trim', 0, 3.05, half(3.05) - 0.08, 1.22, 0.16, 0.36);
    for (const x of [-0.27, 0, 0.27])
      box(face, 'wood', x, 3.22, half(3.22) - 0.345, 0.04, 1.05, 0.024);
  }
}
export const buildSvanetianSkyline = (o) => build(o, 0),
  buildSvanetianDistrict = (o) => build(o, 1),
  buildSvanetianStreet = (o) => build(o, 2),
  buildSvanetianCloseup = (o) => build(o, 3);
export const svanetianStudy = {
  id: 'N0594',
  key: 'svanetian_tower',
  title: 'Svanetian tower',
  category: 'tower',
  wikidataId: 'Q16375698',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  fidelityTarget: 'medium-fi',
  build: buildSvanetianCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  reusableMapRules: ['map.svanetian-tower.label', 'map.svanetian-tower.tags'],
  brief: scope.brief,
  reconstruction: scope.reconstruction,
  sourceFacts: scope.sourceFacts,
  scaleBasis: scope.scaleBasis,
  refs: read('reference-metadata.json').pictures.map((p) => p.page),
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Ground attachment plane Y=0; bounded footing reaches Y=-1.5m. No unique geographic anchor.',
  },
  sourceDocuments: scope.sourceDocuments,
  limitations: scope.limitations,
  geographic: () => ({ anchor: [0, 0], heading: 0 }),
  geographicNote:
    'Reusable type only. Map rules establish individual instance locations; this preview has no geographic placement.',
  camera: scope.camera,
  qaCameras: [],
};
