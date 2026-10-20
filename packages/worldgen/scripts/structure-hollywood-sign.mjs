/** Current steel Hollywood Sign: individually mapped panels, custom photo-derived letterforms. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/9q/9q5/hollywood_sign/',
  import.meta.url,
);
const white = rgb('eeefeb'),
  back = rgb('bec3c2'),
  steel = rgb('a3adac'),
  concrete = rgb('aca99d'),
  rib = rgb('d9dcd9');
const ref = 'palette:#ffffff',
  height = 13.716;
const shapes = {
  H: [
    [
      [0, 0],
      [0.32, 0],
      [0.32, 0.4],
      [0.68, 0.4],
      [0.68, 0],
      [1, 0],
      [1, 1],
      [0.68, 1],
      [0.68, 0.62],
      [0.32, 0.62],
      [0.32, 1],
      [0, 1],
    ],
  ],
  O: [
    [
      [0.28, 0],
      [0.72, 0],
      [1, 0.16],
      [1, 0.84],
      [0.72, 1],
      [0.28, 1],
      [0, 0.84],
      [0, 0.16],
    ],
    [
      [0.34, 0.24],
      [0.34, 0.76],
      [0.44, 0.81],
      [0.57, 0.81],
      [0.66, 0.76],
      [0.66, 0.24],
      [0.56, 0.19],
      [0.44, 0.19],
    ],
  ],
  L: [
    [
      [0, 0],
      [1, 0],
      [1, 0.2],
      [0.32, 0.2],
      [0.32, 1],
      [0, 1],
    ],
  ],
  Y: [
    [
      [0.34, 0],
      [0.66, 0],
      [0.66, 0.36],
      [1, 1],
      [0.68, 1],
      [0.5, 0.56],
      [0.32, 1],
      [0, 1],
      [0.34, 0.36],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.24, 1],
      [0.34, 0.36],
      [0.43, 1],
      [0.64, 1],
      [0.72, 0.36],
      [0.8, 1],
      [1, 1],
      [0.85, 0],
      [0.61, 0],
      [0.51, 0.38],
      [0.4, 0],
      [0.18, 0],
    ],
  ],
  D: [
    [
      [0, 0],
      [0.68, 0],
      [1, 0.16],
      [1, 0.84],
      [0.68, 1],
      [0, 1],
    ],
    [
      [0.34, 0.22],
      [0.34, 0.8],
      [0.57, 0.8],
      [0.67, 0.73],
      [0.67, 0.29],
      [0.57, 0.22],
    ],
  ],
};
function transform(o, c, dir) {
  const v = (p) => [dir[0] * p[0] - dir[1] * p[2], p[1], dir[1] * p[0] + dir[0] * p[2]],
    q = (p) => {
      const a = v(p);
      return [a[0] + c[0], a[1], a[2] + c[1]];
    };
  return {
    addTriangle: (s, r, p, n, uv, col) => o.addTriangle(s, r, p.map(q), v(n), uv, col),
    addQuad: (s, r, p, n, uv, col) => o.addQuad(s, r, p.map(q), v(n), uv, col),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      const pp = p.map(q),
        uu = p.map(uv);
      o.addConvexPolygon(s, r, pp, v(n), (p) => uu[pp.indexOf(p)], col);
    },
  };
}
function oriented(r, positive) {
  const a = r.reduce(
    (v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
  return a > 0 === positive ? r : [...r].reverse();
}
function panel(o, rings, y, width) {
  const loops = rings.map((r, i) =>
    oriented(
      r.map((p) => [(p[0] - 0.5) * width, y + p[1] * height]),
      i === 0,
    ),
  );
  const pts = loops.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < loops.length; i++) {
    if (i) holes.push(count);
    count += loops[i].length;
  }
  const ii = earcut(pts.flat(), holes);
  for (const [z, n, col] of [
    [0.08, [0, 0, 1], white],
    [-0.08, [0, 0, -1], back],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [pts[j][0], pts[j][1], z]);
      o.addTriangle(
        'metal',
        ref,
        p,
        n,
        p.map((a) => [a[0], a[1]]),
        col,
      );
    }
  for (const r of loops)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        'metal',
        [
          [a[0], a[1], -0.08],
          [b[0], b[1], -0.08],
          [b[0], b[1], 0.08],
          [a[0], a[1], 0.08],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
        back,
      );
    }
  return loops;
}
function spans(loops, x) {
  const ys = [];
  for (const r of loops)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        ys.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
  return ys.sort((a, b) => a - b);
}
function outerSpanAtHeight(outer, y) {
  const xs = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
      xs.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
}
function terrainSampler(t) {
  return (x, z) => {
    const u = (x - t.origin[0]) / t.stepMeters,
      v = (z - t.origin[1]) / t.stepMeters,
      i = Math.floor(u),
      j = Math.floor(v),
      a = u - i,
      b = v - j,
      h = t.heightsMeters;
    return (
      h[j][i] * (1 - a) * (1 - b) +
      h[j][i + 1] * a * (1 - b) +
      h[j + 1][i] * (1 - a) * b +
      h[j + 1][i + 1] * a * b -
      t.modelDatumElevationMeters
    );
  };
}
function build(o, detail) {
  const frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', base))),
    terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', base))),
    ground = terrainSampler(terrain);
  for (const f of frame.features) {
    const [a, b] = f.line,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      mappedWidth = Math.hypot(dx, dz),
      dir = [dx / mappedWidth, dz / mappedWidth],
      center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // Two short OSM lines understate the visible panel widths. Centers and headings
    // remain mapped; widths are conservative photographic corrections within gaps.
    const width = f.letterOrder === 2 ? 9.5 : f.letterOrder === 4 ? 9.2 : mappedWidth;
    const at = (x, z = 0) => [
      center[0] + dir[0] * x - dir[1] * z,
      center[1] + dir[1] * x + dir[0] * z,
    ];
    // Panel edges follow the inspected front photograph. The supporting legs,
    // rather than the panels, follow the independent USGS terrain below them.
    const bottom = 1.8 + [-1.35, -1.35, -0.35, -0.15, 0, 0.2, 0.3, 0.55, 0.3][f.letterOrder - 1];
    const fo = transform(o, center, dir),
      loops = panel(fo, shapes[f.name], bottom, width);
    const posts = f.name === 'W' ? [-0.43, -0.15, 0.15, 0.43] : [-0.39, 0.39];
    for (const fraction of posts) {
      const x = width * fraction,
        z = -0.38,
        foot = ground(...at(x, z)) - 0.8,
        top = Math.max(...spans(loops, x)) + 0.18;
      B(fo, 'concrete', x, foot, z, 0.65, 0.85, 0.75, concrete);
      if (detail > 1) {
        B(fo, 'metal', x, foot, z, 0.075, top - foot, 0.38, steel);
        for (const zz of [-0.58, -0.18])
          B(fo, 'metal', x, foot, zz, 0.28, top - foot, 0.045, steel);
      } else B(fo, 'metal', x, foot, z, 0.25, top - foot, 0.4, steel);
      if (detail > 1) {
        for (const yy of [bottom + 0.1, bottom + 4.55, bottom + 9.1].filter((y) => y < top - 0.2)) {
          B(fo, 'metal', x, yy, z, 0.38, 0.38, 0.5, steel);
          if (detail > 2)
            for (const xx of [-0.12, 0.12])
              B(fo, 'metal', x + xx, yy + 0.07, -0.65, 0.035, 0.22, 0.06, back);
        }
      }
    }
    if (detail) {
      for (let i = 0; i < 6; i++) {
        const y = bottom + 0.18 + (i * (height - 0.36)) / 5,
          extent = outerSpanAtHeight(loops[0], y);
        if (extent)
          B(
            fo,
            'metal',
            (extent[0] + extent[1]) / 2,
            y,
            -0.2,
            extent[1] - extent[0],
            0.16,
            0.16,
            steel,
          );
      }
      if (detail > 1) {
        if (f.name === 'L') {
          const bays = [
            [-width * 0.46, -width * 0.22, bottom + 0.2, bottom + height - 0.2],
            [-width * 0.46, width * 0.46, bottom + 0.2, bottom + height * 0.2 - 0.2],
          ];
          for (const [left, right, low, high] of bays) {
            beam(fo, 'metal', [left, low, -0.65], [right, high, -0.65], 0.07, 0.07, steel);
            beam(fo, 'metal', [right, low, -0.66], [left, high, -0.66], 0.07, 0.07, steel);
          }
        } else {
          const left = -width * 0.39,
            right = width * 0.39,
            l = spans(loops, left),
            r = spans(loops, right);
          beam(
            fo,
            'metal',
            [left, l[0] + 0.12, -0.65],
            [right, r.at(-1) - 0.12, -0.65],
            0.07,
            0.07,
            steel,
          );
          beam(
            fo,
            'metal',
            [right, r[0] + 0.12, -0.66],
            [left, l.at(-1) - 0.12, -0.66],
            0.07,
            0.07,
            steel,
          );
        }
      }
    }
    if (detail > 1) {
      // Corrugation follows the actual letter silhouette and stops at every cutout.
      for (let x = -width / 2 + 0.1; x < width / 2; x += detail > 2 ? 0.28 : 0.56) {
        const ys = spans(loops, x);
        for (let j = 0; j < ys.length; j += 2)
          if (ys[j + 1] - ys[j] > 0.05)
            B(fo, 'metal', x, ys[j], 0.092, 0.025, ys[j + 1] - ys[j], 0.02, rib);
      }
    }
    if (detail > 2) {
      // Rear access ladder on one main post, kept behind the sheet and ground anchored.
      const x = -width * 0.39,
        z = -0.78,
        foot = ground(...at(x, z)),
        top = Math.max(...spans(loops, x));
      for (const xx of [-0.2, 0.2])
        B(fo, 'metal', x + xx, foot, z, 0.035, top - foot, 0.035, steel);
      for (let y = foot + 0.25; y < top; y += 0.33)
        B(fo, 'metal', x, y, z, 0.43, 0.025, 0.04, steel);
    }
  }
}
export function hollywood(o) {
  build(o, 3);
}
export function hollywoodSkyline(o) {
  build(o, 0);
}
export function hollywoodDistrict(o) {
  build(o, 1);
}
export function hollywoodStreet(o) {
  build(o, 2);
}
const surfaces = { metal: landmarkSurfaces.metal, concrete: landmarkSurfaces.concrete };
export const hollywoodModel = {
  id: 'hollywood_sign',
  recipe: 'structure-hollywood-sign.mjs',
  key: 'hollywood_sign',
  cell: '9q/9q5',
  title: 'Hollywood Sign',
  brief:
    'Nine custom faceted white metal letter panels on individually mapped alignments, terrain-specific feet, twenty steel support posts, rear girts, bracing, ladders and restrained corrugated surfaces.',
  camera: [90, 50, 120],
  lookAt: [2, 3, 0],
  qaCameras: [
    { name: 'front', position: [2, 14, 155], lookAt: [2, 3, 0] },
    { name: 'back', position: [-12, 85, -110], lookAt: [2, 4, 0] },
    { name: 'l-supports-rear', position: [-19, 32, -30], lookAt: [-19, 7, 2.5] },
    { name: 'low-l-post-detail', position: [-6, 20, -16], lookAt: [-8, 5.3, 1.5] },
  ],
  build: hollywood,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 1.6 },
  groundContactBasis:
    'Ground beneath the Y defines the common datum. Panel edges use photo-derived offsets from Y at 1.8 m; twenty post feet sample the independent USGS 3DEP terrain and penetrate by 0.8 m. Terrain is not flattened or fitted. Elevation, panel lines and inferred panel heights are not an engineering survey; another host DEM may differ.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hollywood-sign.mjs',
    level: 'skyline',
    export: 'hollywoodSkyline',
    errorMeters: 0.5,
    authoredLevels: {
      district: { export: 'hollywoodDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'hollywoodStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    'Started with cleared Qualla imagery. Current support construction uses the exact inspected Blake Everett CC0 rear original; older attribution-licensed or additionally restricted imagery is excluded as a current control. Individual OSM letter lines and source ground retained. Not an engineering survey.',
    'Post tops and girt lengths follow letter profiles. The L framework has separate tall-stem and low-foot braces instead of a full rectangle beyond the panel. Member sections, attachment details and hidden engineering remain approximate.',
    'Letter height is 13.716 m (45 ft). The Trust booklet reports 450 ft overall length, while mapped endpoints span about 105 m; mapped positions are retained and this discrepancy remains unresolved.',
    'First O and second L widths are adjusted from short mapped lines to match the photographic proportions; all centers and angles remain mapped. Corrugation, beam sections, joints and ladders are simplified.',
    'Photographic comparison sets approximate panel heights independently of USGS terrain-sampled feet. Native DEM resolution and vertical accuracy are unknown; exact ground contact remains host-terrain dependent.',
    'Earlier HOLLYWOODLAND extension, mountaintop broadcast buildings, fences, surveillance equipment and landscape vegetation are outside this model. Reference photographs are not embedded or redistributed.',
  ],
};
