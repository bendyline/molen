/** Surviving Azuchi masonry; named map controls, estimated walls, unchanged raw relief. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/xn/xn0/azuchi_castle/',
    import.meta.url,
  ),
  plan = JSON.parse(fs.readFileSync(new URL('plan-controls.json', source))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', source))),
  ref = 'palette:#ffffff',
  C = { stone: rgb('99968a'), earth: rgb('aaa18a'), joint: rgb('706e63') },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    earth: { slot: 'foundation', localRef: ref, roughness: 1, metallic: 0 },
    joint: { slot: 'trim', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
  };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function height(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) +
    (h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}
function tri(o, s, p, outward, color = C[s]) {
  const fp = p.map((p) => p.map(Math.fround)),
    n = cross(
      fp[1].map((v, i) => v - fp[0][i]),
      fp[2].map((v, i) => v - fp[0][i]),
    );
  if (Math.hypot(...n) < 1e-8) return;
  if (n.reduce((v, x, i) => v + x * outward[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((v) => [v[0] + v[2], v[1]]),
    color,
  );
}
function quad(o, s, p, n, color = C[s]) {
  tri(o, s, p.slice(0, 3), n, color);
  tri(o, s, [p[0], p[2], p[3]], n, color);
}
function cap(o, poly, y, s = 'earth') {
  for (let i = 1; i < poly.length - 1; i++)
    tri(
      o,
      s,
      [poly[0], poly[i], poly[i + 1]].map(([x, z]) => [x, y, z]),
      [0, 1, 0],
    );
}
function corners(o, poly, top, base) {
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      previous = poly[(i + poly.length - 1) % poly.length],
      next = poly[(i + 1) % poly.length],
      normal = (a, b) => {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
      },
      a = normal(previous, p),
      b = normal(p, next),
      batter = (top[i] - base[i]) * 0.14;
    tri(
      o,
      'stone',
      [
        [p[0] + a[0] * batter, base[i], p[1] + a[1] * batter],
        [p[0] + b[0] * batter, base[i], p[1] + b[1] * batter],
        [p[0], top[i], p[1]],
      ],
      [a[0] + b[0], 0.14, a[1] + b[1]],
    );
  }
}
// Each retaining face descends only to the raw local hillside, never to the lower-gate datum.
function face(o, a, b, topA, topB, baseA, baseB, d, seed = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    point = (t, y, offset = 0) => [
      a[0] + u[0] * t + n[0] * offset,
      y,
      a[1] + u[1] * t + n[1] * offset,
    ],
    low = (t) => baseA + ((baseB - baseA) * t) / len,
    high = (t) => topA + ((topB - topA) * t) / len,
    outer = (t, y) => point(t, y, Math.max(0, high(t) - y) * 0.14);
  quad(
    o,
    'joint',
    [outer(0, baseA), outer(len, baseB), outer(len, topB), outer(0, topA)],
    [n[0], 0.15, n[1]],
  );
  if (d < 2) return;
  const course = d === 3 ? 1 : 3.2,
    cell = d === 3 ? 2.4 : 7.8,
    start = Math.min(baseA, baseB),
    end = Math.max(topA, topB);
  for (let row = 0, y = start; y < end - 0.04; row++, y += course) {
    const shift = ((row + seed) % 2) * cell * 0.5;
    for (let k = -1, x = -shift; x < len; k++, x += cell) {
      const x0 = Math.max(0.02, x + 0.025),
        x1 = Math.min(len - 0.02, x + cell - 0.025);
      if (x1 - x0 < 0.12) continue;
      const y0 = Math.max(y + 0.025, low(x0), low(x1)),
        y1 = Math.min(y + course - 0.025, high(x0), high(x1));
      if (y1 - y0 < 0.1) continue;
      const color = C.stone.map(
          (v) => v * (0.89 + ((row * 7 + k * 13 + seed * 11 + 5000) % 19) * 0.012),
        ),
        cut = Math.min(0.16, (x1 - x0) * 0.2, (y1 - y0) * 0.23),
        ring = [
          [x0, y0 + cut],
          [x0 + cut, y0],
          [x1 - cut, y0],
          [x1, y0 + cut],
          [x1, y1 - cut],
          [x1 - cut, y1],
          [x0 + cut, y1],
          [x0, y1 - cut],
        ],
        center = outer((x0 + x1) / 2, (y0 + y1) / 2).map((v, i) => v + [n[0], 0, n[1]][i] * 0.055);
      for (let j = 0; j < ring.length; j++) {
        const p = outer(...ring[j]),
          q = outer(...ring[(j + 1) % ring.length]);
        tri(o, 'stone', [p, q, center], [n[0], 0.15, n[1]], color);
      }
    }
  }
}
function wall(o, a, b, y0, y1, depth, d, seed) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len],
    c = b.map((v, i) => v - n[i] * depth),
    e = a.map((v, i) => v - n[i] * depth);
  face(o, a, b, y1, y1, y0, y0, d, seed);
  face(o, c, e, y1, y1, y0, y0, d, seed + 1);
  face(o, b, c, y1, y1, y0, y0, d, seed + 2);
  face(o, e, a, y1, y1, y0, y0, d, seed + 3);
  cap(o, [a, b, c, e], y1, 'stone');
  corners(o, [a, b, c, e], [y1, y1, y1, y1], [y0, y0, y0, y0]);
}
function terrace(o, p, d, index) {
  const [x, z] = p.center,
    w = p.width / 2,
    dep = p.depth / 2,
    cut = p.pillarGrid ? 2.8 : 1.3,
    poly = [
      [x - w + cut, z - dep],
      [x + w - cut, z - dep],
      [x + w, z - dep + cut],
      [x + w, z + dep - cut],
      [x + w - cut, z + dep],
      [x - w + cut, z + dep],
      [x - w, z + dep - cut],
      [x - w, z - dep + cut],
    ],
    floor = Math.max(...poly.map(([x, z]) => height(x, z))) + 0.15;
  cap(o, poly, floor);
  corners(
    o,
    poly,
    poly.map(() => floor),
    poly.map((p) => height(...p) - 0.55),
  );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    face(o, a, b, floor, floor, height(...a) - 0.55, height(...b) - 0.55, d, index * 11 + i);
  }
  if (p.pillarGrid) {
    // Broken low perimeter and pillar bases, not a complete vanished keep or a replica.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if (i === 3) continue; // Surviving open access at the eastern/southern edge.
      const pieces = d ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3)) : 1;
      for (let j = 0; j < pieces; j++)
        wall(
          o,
          mix(a, b, j / pieces),
          mix(a, b, (j + 1) / pieces),
          floor - 0.05,
          floor + 0.38 + ((i * 3 + j * 7) % 7) * 0.12,
          1.2,
          d,
          i + j,
        );
    }
    if (d)
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 5; col++) {
          if ((col * 5 + row * 3) % 11 === 0) continue;
          const px = x - 9 + col * 4.3 + ((row + col) % 3) * 0.18,
            pz = z - 8.7 + row * 4.1,
            radius = 0.65 + ((row * 2 + col) % 4) * 0.09,
            stone = Array.from({ length: 6 }, (_, j) => {
              const a = (j * Math.PI) / 3,
                r = radius * (0.88 + ((j + col) % 3) * 0.09);
              return [px + Math.cos(a) * r, pz + Math.sin(a) * r];
            });
          cap(o, stone, floor + 0.24, 'stone');
          for (let i = 0; i < stone.length; i++)
            face(
              o,
              stone[i],
              stone[(i + 1) % stone.length],
              floor + 0.24,
              floor + 0.24,
              floor,
              floor,
              0,
            );
        }
  } else if (p.gate) {
    const gateWidth = index === 3 ? 4.1 : 5.8,
      south = z + dep - 0.3;
    wall(
      o,
      [x - w + 1, south],
      [x - gateWidth / 2, south],
      floor - 0.1,
      floor + p.wallHeight,
      1.65,
      d,
      index,
    );
    wall(
      o,
      [x + gateWidth / 2, south],
      [x + w - 1, south],
      floor - 0.1,
      floor + p.wallHeight * 0.73,
      1.65,
      d,
      index + 1,
    );
    if (index === 3)
      for (const [a, b] of [
        [south - 6, south - 5],
        [south - 1, south],
      ])
        wall(
          o,
          [x - w + 1, a],
          [x - w + 1, b],
          floor - 0.1,
          floor + p.wallHeight,
          1.7,
          d,
          index + 2,
        );
  }
}
// Selected actual approach components. Omit the western temple detour and detached paths.
const routes = [
  ...plan.paths[0].lines,
  plan.paths[3].lines[1],
  plan.paths[3].lines[4],
  plan.paths[1].lines[15],
  ...plan.paths[3].lines.slice(5, 16),
  plan.paths[1].lines[18],
  plan.paths[1].lines[19],
  plan.paths[1].lines[20],
  plan.paths[1].lines[21],
  plan.paths[1].lines[22],
  plan.paths[1].lines[23],
  plan.paths[5].lines[0],
];
function approach(o, line, d, index) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len],
      width = Math.min(a[1], b[1]) > 100 ? 6 : 2.8,
      rise = Math.abs(height(...b) - height(...a)),
      count =
        d === 0
          ? 1
          : Math.max(1, Math.ceil(len / [0, 7, 2, 0.7][d]), Math.ceil(rise / [1, 3, 0.9, 0.24][d]));
    for (let j = 0; j < count; j++) {
      const p = mix(a, b, j / count),
        q = mix(a, b, (j + 1) / count),
        y = (height(...p) + height(...q)) / 2 + 0.22,
        corners = [
          [p[0] - (n[0] * width) / 2, p[1] - (n[1] * width) / 2],
          [q[0] - (n[0] * width) / 2, q[1] - (n[1] * width) / 2],
          [q[0] + (n[0] * width) / 2, q[1] + (n[1] * width) / 2],
          [p[0] + (n[0] * width) / 2, p[1] + (n[1] * width) / 2],
        ];
      if (d === 0)
        quad(
          o,
          'stone',
          corners.map(([x, z]) => [x, height(x, z) + 0.3, z]),
          [0, 1, 0],
        );
      else cap(o, corners, y, 'stone');
      if (d)
        for (let k = 0; k < 4; k += d === 1 ? 2 : 1) {
          const v = corners[k],
            w = corners[(k + 1) % 4];
          face(
            o,
            v,
            w,
            y,
            y,
            Math.min(y - 0.18, height(...v) - 0.25),
            Math.min(y - 0.18, height(...w) - 0.25),
            0,
          );
        }
      if (d === 3) {
        const midpoint = mix(p, q, 0.5);
        for (const side of [-1, 1]) {
          const f = width * 0.21 * side,
            u = [midpoint[0] + n[0] * f, midpoint[1] + n[1] * f];
          quad(
            o,
            'joint',
            [
              [u[0] - n[0] * 0.018, y + 0.008, u[1] - n[1] * 0.018],
              [q[0] + n[0] * (f - 0.018), y + 0.008, q[1] + n[1] * (f - 0.018)],
              [q[0] + n[0] * (f + 0.018), y + 0.008, q[1] + n[1] * (f + 0.018)],
              [u[0] + n[0] * 0.018, y + 0.008, u[1] + n[1] * 0.018],
            ],
            [0, 1, 0],
          );
        }
      }
    }
    if (d && index >= 4 && a[1] > 100 && a[1] < 330) {
      // Bounded battered approach walls; their estimated height follows the local hill.
      for (const side of [-1, 1]) {
        const pa = a.map((v, k) => v + n[k] * width * 0.55 * side),
          pb = b.map((v, k) => v + n[k] * width * 0.55 * side),
          parts = Math.ceil(len / (d === 1 ? 10 : 5));
        for (let k = 0; k < parts; k++) {
          const s = mix(pa, pb, k / parts),
            t = mix(pa, pb, (k + 1) / parts),
            bottomA = height(...s) - 0.4,
            bottomB = height(...t) - 0.4,
            topA = height(...s) + (side < 0 ? 1.8 : 0.7),
            topB = height(...t) + (side < 0 ? 1.8 : 0.7);
          face(o, s, t, topA, topB, bottomA, bottomB, d, index + k);
          const back = [s.map((v, j) => v - n[j] * 0.65), t.map((v, j) => v - n[j] * 0.65)];
          quad(
            o,
            'stone',
            [
              [...s.slice(0, 1), topA, s[1]],
              [t[0], topB, t[1]],
              [back[1][0], topB, back[1][1]],
              [back[0][0], topA, back[0][1]],
            ],
            [0, 1, 0],
          );
          face(o, back[1], back[0], topB, topA, bottomB, bottomA, d, index + k + 1);
        }
      }
    }
  }
}
function build(o, _frame, d = 3) {
  plan.estimatedMasonryComponents.forEach((p, i) => {
    terrace(o, p, d, i);
  });
  routes.forEach((line, i) => {
    approach(o, line, d, i);
  });
}
export const azuchiSkyline = (o, f) => build(o, f, 0);
export const azuchiDistrict = (o, f) => build(o, f, 1);
export const azuchiStreet = (o, f) => build(o, f, 2);
export const azuchiCastleModel = {
  id: 'azuchi_castle',
  key: 'azuchi_castle',
  recipe: 'structure-azuchi-castle.mjs',
  cell: 'xn/xn0',
  title: 'Azuchi Castle ruins',
  category: 'castle-ruins',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving Azuchi archaeological masonry: open main keep foundation with broken low rubble perimeter and exposed pillar-base field; Honmaru/Ninomaru terraces, breached turning Kuroganemon gate, retained residence courts, lower Otemon remnants and the long worn Otemichi stone stair/landing approach. Native named point and actual path controls; bounded wall footprints and architectural detail are photographic estimates. No reconstructed lost tower or replica.',
  camera: [350, 285, 560],
  lookAt: [-40, 53, 172],
  mediumFiContext: { scale: 1.15 },
  qaCameras: [
    {
      name: 'open-keep-foundation-pillar-stones-and-upper-terraces',
      position: [62, 150, 76],
      lookAt: [-7, 103, 15],
    },
    {
      name: 'kuroganemon-battered-rubble-and-breached-turning-gateway',
      position: [-112, 108, 83],
      lookAt: [-73, 90, 51],
    },
    {
      name: 'long-stone-otemichi-approach-and-retained-residence-courts',
      position: [54, 109, 304],
      lookAt: [-34, 37, 220],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed lower Otemon approach before terrain acquisition. Saved raw Terrarium relief drives distributed wall bottoms and stairs; bounded intrinsic terrace fill only. No whole hill slab/flattening or full-height foundations to the lower datum.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-azuchi-castle.mjs',
    level: 'skyline',
    export: 'azuchiSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'azuchiDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'azuchiStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Current surviving ruins only. The vanished 1579 keep, gilded upper rooms, complete roofs/palaces/gates and modern museum/Ise replicas are excluded, as are separate Sokenji temple/pagoda/gate, tomb/sculpture/tablet collections, interpretive sign artwork, people and forest. No photographic textures.',
    'Main keep/courtyard/residence/gateway footprints, widths, wall heights, battered sections, access gaps and individual pillar/stone counts are explicit medium-fi photographic estimates around named archaeological controls, not measured or surveyed ruin polygons. Exact stair landings, historical construction phases and concealed walls remain approximate.',
    'The saved unmodified coarse raw relief spans about100m of hillside. Distributed levels use that relief relative to the fixed lower-gate datum; bounded retained soil/platform caps are intrinsic architecture. Level court tops use the maximum sampled perimeter height, so terrace heights/precise thresholds may differ from actual surveyed remains. No whole natural hillside or vegetation is part of the GLB. Flat asset-library views therefore omit its supporting geographic hillside; portable and context scenes retain the raw review terrain. Host terrain/contact remains approximate.',
    'Four cleared published Qualla public-domain ruin originals and five Mont Blank rich own-work CC0 originals establish surviving rubble, pillar bases, worn steps, terraces and breached gateways. The photographed interpretive map/artwork and other licensed/historical/religious imagery are unused. Stone layouts/colors and hidden return faces are representative; no underlying artwork or exact photographic texture copied.',
  ],
};
