/** Kyoto's present nine-span bridge with the completed January 2024 timber renewal. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const length = 73.3,
  half = length / 2,
  width = 16.7;
const wood = [0.8, 0.71, 0.56],
  iron = [0.12, 0.105, 0.09];
const bronze = [0.24, 0.43, 0.36],
  concrete = [0.35, 0.34, 0.29];
const rand = (s) => {
  const n = Math.sin(s * 41.19 + 3.8) * 71613;
  return n - Math.floor(n);
};
const tint = (c, s, amount = 0.07) => c.map((v) => v + (rand(s) - 0.5) * amount);
const deck = (x) => 4.55 + 0.52 * Math.cos((x * Math.PI) / length);

function slab(out, slot, x0, x1, z0, z1, bottom, top, color) {
  loft(
    out,
    slot,
    [bottom, top].map((h) => [
      [x0, h(x0), z0],
      [x0, h(x0), z1],
      [x1, h(x1), z1],
      [x1, h(x1), z0],
    ]),
    color,
  );
}
function lathe(out, slot, x, y, z, profile, color, sides = 64) {
  loft(
    out,
    slot,
    profile.map(([h, r]) => radialRing(y + h, r, r, sides, [x, z])),
    color,
  );
}
function girder(out, x0, x1, z) {
  for (const [low, high, breadth] of [
    [-0.85, -0.8, 0.22],
    [-0.8, -0.35, 0.035],
    [-0.35, -0.3, 0.22],
  ])
    slab(
      out,
      'iron',
      x0,
      x1,
      z - breadth / 2,
      z + breadth / 2,
      (x) => deck(x) + low,
      (x) => deck(x) + high,
      iron,
    );
  for (let x = x0 + 0.25; x < x1; x += 1.55)
    slab(
      out,
      'iron',
      x - 0.025,
      x + 0.025,
      z - 0.1,
      z + 0.1,
      (s) => deck(s) - 0.8,
      (s) => deck(s) - 0.35,
      tint(iron, x),
    );
}
function substructure(out) {
  for (let row = 1; row < 9; row++) {
    const x = -half + (length * row) / 9,
      cap = deck(x) - 0.87;
    for (let column = 0; column < 7; column++) {
      const z = -6.9 + column * 2.3;
      // Circular granite shoes with individually recessed course joints.
      for (let course = 0; course < 3; course++) {
        const y = course * 0.36;
        for (let k = 0; k < 12; k++) {
          const start = ((k + (course % 2) / 2) * Math.PI) / 6 + 0.004;
          const end = start + Math.PI / 6 - 0.008;
          const ring = (h) => [
            [x, y + h, z],
            ...Array.from({ length: 7 }, (_, i) => {
              const a = end - ((end - start) * i) / 6;
              return [x + Math.cos(a) * 0.64, y + h, z + Math.sin(a) * 0.64];
            }),
          ];
          loft(
            out,
            'paving',
            [ring(0.008), ring(0.352)],
            tint([0.36, 0.35, 0.3], row * 31 + column * 7 + course * 3 + k),
          );
        }
      }
      lathe(
        out,
        'concrete',
        x,
        1.08,
        z,
        [
          [0, 0.47],
          [0.15, 0.46],
          [cap - 1.08, 0.42],
        ],
        tint(concrete, row * 17 + column),
      );
      // Fine mineral streaks follow the shaft, with no photographed texture baked in.
      for (let k = 0; k < 20; k++) {
        const a = (k * Math.PI) / 10,
          low = 1.15 + rand(row * column + k) * 0.5;
        const high = Math.min(cap - 0.05, low + 0.6 + rand(k * 7) * 1.3);
        const radius = (y) => 0.46 - ((y - 1.23) / (cap - 1.23)) * 0.04;
        const points = [
          [low, a],
          [low, a + 0.016],
          [high, a + 0.016],
          [high, a],
        ].map(([y, t]) => [
          x + (radius(y) + 0.002) * Math.cos(t),
          y,
          z + (radius(y) + 0.002) * Math.sin(t),
        ]);
        quad(out, 'concrete', points, normalFor(...points), tint([0.24, 0.25, 0.19], k, 0.035));
      }
    }
    box(
      out,
      'concrete',
      [x - 0.42, cap - 0.22, -7.1],
      [x + 0.42, cap + 0.08, 7.1],
      tint(concrete, row),
    );
    box(out, 'concrete', [x - 0.26, 1.12, -6.9], [x + 0.26, 1.49, 6.9], tint(concrete, row + 50));
  }
  for (const x of [-half, half])
    box(
      out,
      'concrete',
      [x - 0.65, 0, -width / 2],
      [x + 0.65, deck(x) - 0.32, width / 2],
      concrete,
    );
}
function finial(out, x, z, radius, seed) {
  const y = deck(x) + 0.16;
  lathe(
    out,
    'timber',
    x,
    y,
    z,
    [
      [0, radius],
      [1.12, radius],
    ],
    tint(wood, seed),
    64,
  );
  const scale = radius / 0.24;
  const profile = [
    [0, 0.24],
    [0.025, 0.249],
    [0.045, 0.249],
    [0.06, 0.235],
    [0.11, 0.235],
    [0.13, 0.248],
    [0.15, 0.248],
    [0.17, 0.235],
    [0.48, 0.235],
    [0.5, 0.248],
    [0.52, 0.248],
    [0.54, 0.228],
    [0.56, 0.22],
    [0.61, 0.21],
    [0.66, 0.16],
    [0.69, 0.14],
    [0.73, 0.19],
    [0.77, 0.235],
    [0.83, 0.275],
    [0.9, 0.284],
    [0.97, 0.257],
    [1.03, 0.216],
    [1.09, 0.155],
    [1.15, 0.095],
    [1.21, 0.056],
    [1.28, 0.012],
  ];
  lathe(
    out,
    'bronze',
    x,
    y + 1.1,
    z,
    profile.map(([h, r]) => [h * scale * 0.64, r * scale]),
    tint(bronze, seed, 0.09),
    96,
  );
  for (const h of [0.22, 0.43])
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = radius + 0.008;
      tube(
        out,
        'bronze',
        [x + Math.cos(a) * r, y + 1.1 + h * scale * 0.64, z + Math.sin(a) * r],
        [x + Math.cos(a) * (r + 0.023), y + 1.1 + h * scale * 0.64, z + Math.sin(a) * (r + 0.023)],
        0.025 * scale,
        bronze,
        12,
      );
    }
}
function timberRailing(out, side) {
  const z = side * (width / 2 - 0.21),
    pitch = (length - 0.6) / 36;
  for (let i = 0; i <= 36; i++) {
    const x = -half + 0.3 + i * pitch,
      y = deck(x) + 0.16;
    if (i % 6 === 0) finial(out, x, z, i === 0 || i === 36 ? 0.21 : 0.24, i + side * 39);
    else {
      box(out, 'timber', [x - 0.115, y, z - 0.12], [x + 0.115, y + 0.84, z + 0.12], tint(wood, i));
      lathe(
        out,
        'timber',
        x,
        y + 0.83,
        z,
        [
          [0, 0.12],
          [0.11, 0.12],
          [0.15, 0.084],
        ],
        wood,
        32,
      );
      // Traditional black clamping ornaments on the outward face of the small posts.
      box(
        out,
        'iron',
        [x - 0.04, y + 0.39, z + side * 0.124 - 0.009],
        [x + 0.04, y + 0.66, z + side * 0.124 + 0.009],
        iron,
      );
      box(
        out,
        'iron',
        [x - 0.17, y + 0.49, z + side * 0.127 - 0.009],
        [x + 0.17, y + 0.56, z + side * 0.127 + 0.009],
        iron,
      );
      for (const dx of [-0.12, 0, 0.12])
        tube(
          out,
          'iron',
          [x + dx, y + 0.525, z + side * 0.13],
          [x + dx, y + 0.525, z + side * 0.145],
          0.017,
          iron,
          12,
        );
    }
    if (i === 36) continue;
    const end = x + pitch;
    tube(
      out,
      'timber',
      [x, y + 1.02, z],
      [end, deck(end) + 1.18, z],
      0.105,
      tint(wood, i + 53),
      32,
    );
    slab(
      out,
      'timber',
      x,
      end,
      z - 0.09,
      z + 0.09,
      (s) => deck(s) + 0.62,
      (s) => deck(s) + 0.76,
      tint(wood, i + 37),
    );
    slab(
      out,
      'timber',
      x,
      end,
      z - 0.13,
      z + 0.13,
      (s) => deck(s) + 0.18,
      (s) => deck(s) + 0.39,
      tint(wood, i + 91),
    );
    // Shallow joinery sleeves, with the short grain transition visible around each meeting.
    tube(
      out,
      'timber',
      [x - 0.06, y + 1.02, z],
      [x + 0.06, y + 1.02, z],
      0.109,
      tint(wood, i + 66),
      32,
    );
  }
}
function asanohaEdges(cx, cy, r) {
  const points = Array.from({ length: 6 }, (_, i) => [
    cx + r * Math.cos((i * Math.PI) / 3),
    cy + r * Math.sin((i * Math.PI) / 3),
  ]);
  const edges = [];
  for (let i = 0; i < 6; i++) {
    const a = points[i],
      b = points[(i + 1) % 6],
      center = [cx, cy],
      m = a.map((v, k) => (v + b[k] + center[k]) / 3);
    edges.push([center, a], [a, b], [center, m], [a, m], [b, m]);
  }
  return edges;
}
function barrierPattern(out, x0, x1, z) {
  const r = 0.16,
    high = 0.75,
    low = 0.22,
    xMin = x0 + 0.1,
    xMax = x1 - 0.1,
    seen = new Set();
  for (let col = -1; col < 12; col++)
    for (let row = -1; row < 4; row++) {
      const cx = xMin + col * 1.5 * r,
        cy = low + (row + (Math.abs(col) % 2) / 2) * Math.sqrt(3) * r;
      for (const [a, b] of asanohaEdges(cx, cy, r)) {
        let t0 = 0,
          t1 = 1;
        const delta = b.map((v, k) => v - a[k]);
        for (const [axis, min, max] of [
          [0, xMin, xMax],
          [1, low, high],
        ]) {
          if (Math.abs(delta[axis]) < 1e-10) {
            if (a[axis] < min || a[axis] > max) t1 = -1;
          } else {
            const ts = [(min - a[axis]) / delta[axis], (max - a[axis]) / delta[axis]].sort(
              (a, b) => a - b,
            );
            t0 = Math.max(t0, ts[0]);
            t1 = Math.min(t1, ts[1]);
          }
        }
        if (t1 <= t0 || Math.hypot(...delta) * (t1 - t0) < 0.004) continue;
        const p = a.map((v, k) => v + delta[k] * t0),
          q = a.map((v, k) => v + delta[k] * t1);
        const key = [p, q]
          .map((p) => p.map((v) => v.toFixed(6)).join(','))
          .sort()
          .join(':');
        if (seen.has(key)) continue;
        seen.add(key);
        const point = ([x, y]) => [x, deck(x) + 0.17 + y, z];
        beam(out, 'steel', point(p), point(q), 0.006, 0.012, [0.49, 0.49, 0.46]);
      }
    }
}
function roadRailing(out, side) {
  const z = side * 4.46,
    pitch = (length - 0.8) / 32;
  for (let i = 0; i <= 32; i++) {
    const x = -half + 0.4 + i * pitch,
      y = deck(x) + 0.17;
    box(out, 'iron', [x - 0.065, y, z - 0.07], [x + 0.065, y + 0.9, z + 0.07], iron);
    box(out, 'iron', [x - 0.09, y + 0.88, z - 0.09], [x + 0.09, y + 0.94, z + 0.09], iron);
    if (i === 32) continue;
    const end = x + pitch;
    for (const h of [0.18, 0.78, 0.94])
      beam(out, 'iron', [x, y + h, z], [end, deck(end) + 0.17 + h, z], 0.055, 0.055, iron);
    barrierPattern(out, x, end, z);
    for (const px of [x + 0.14, end - 0.14])
      for (const h of [0.19, 0.77]) {
        box(
          out,
          'iron',
          [px - 0.032, deck(px) + 0.17 + h - 0.03, z - 0.03],
          [px + 0.032, deck(px) + 0.17 + h + 0.03, z + 0.03],
          iron,
        );
      }
    // Continuous light channel beneath the top rail, a pale lens rather than baked light.
    slab(
      out,
      'marking',
      x + 0.08,
      end - 0.08,
      z - 0.021,
      z + 0.021,
      (s) => deck(s) + 1.067,
      (s) => deck(s) + 1.074,
      [0.57, 0.52, 0.4],
    );
  }
}
export function buildSanjoOhashi(out) {
  substructure(out);
  for (let span = 0; span < 9; span++) {
    const x0 = -half + (length * span) / 9,
      x1 = -half + (length * (span + 1)) / 9;
    for (let g = 0; g < 13; g++) girder(out, x0 + 0.045, x1 - 0.045, -7.35 + g * 1.225);
    slab(
      out,
      'concrete',
      x0 + 0.025,
      x1 - 0.025,
      -width / 2,
      width / 2,
      (s) => deck(s) - 0.3,
      deck,
      concrete,
    );
    for (let x = x0 + 0.5; x < x1; x += 2)
      beam(out, 'iron', [x, deck(x) - 0.59, -7.4], [x, deck(x) - 0.59, 7.4], 0.07, 0.29, iron);
    slab(
      out,
      'road',
      x0 + 0.03,
      x1 - 0.03,
      -4.35,
      4.35,
      deck,
      (s) => deck(s) + 0.025,
      [0.15, 0.16, 0.155],
    );
  }
  for (const side of [-1, 1]) {
    timberRailing(out, side);
    roadRailing(out, side);
    for (let x = -half; x < half; x += 0.6) {
      const end = Math.min(half, x + 0.594);
      slab(
        out,
        'paving',
        x,
        end,
        side > 0 ? 4.3 : -4.62,
        side > 0 ? 4.62 : -4.3,
        deck,
        (s) => deck(s) + 0.18,
        tint([0.43, 0.32, 0.33], x),
      );
      // Shingled-looking pieces are individual sloped timber girder covers, not a masonry face.
      const z = side * (width / 2 - 0.035),
        a = [x, deck(x) - 0.02, z],
        b = [end, deck(end) - 0.02, z],
        c = [end, deck(end) - 0.62, z - side * 0.21],
        d = [x, deck(x) - 0.62, z - side * 0.21];
      const back = [a, b, c, d].map((p) => [p[0], p[1], p[2] - side * 0.055]);
      loft(
        out,
        'timber',
        side > 0 ? [[a, b, c, d], back] : [back, [a, b, c, d]],
        tint(wood, x * 17),
      );
    }
    // The renewed pavement has fine checks within larger jointed slabs, not
    // individual large checkerboard blocks (owner's completed2024 photograph).
    for (let x = -half + 0.01, i = 0; x < half; x += 0.6, i++)
      for (let k = 0; k < 6; k++) {
        const za = 4.63 + k * 0.59,
          zb = za + 0.584,
          end = Math.min(half, x + 0.594);
        slab(
          out,
          'paving',
          x,
          end,
          side > 0 ? za : -zb,
          side > 0 ? zb : -za,
          (s) => deck(s) + 0.1,
          (s) => deck(s) + 0.165,
          [0.39, 0.4, 0.375],
        );
        for (let ix = 0; ix < 6; ix++)
          for (let iz = 0; iz < 6; iz++) {
            const x0 = x + ((end - x) * ix) / 6,
              x1 = x + ((end - x) * (ix + 1)) / 6,
              a = za + ((zb - za) * iz) / 6,
              b = za + ((zb - za) * (iz + 1)) / 6,
              z0 = side > 0 ? a : -b,
              z1 = side > 0 ? b : -a;
            quad(
              out,
              'paving',
              [
                [x0, deck(x0) + 0.166, z1],
                [x1, deck(x1) + 0.166, z1],
                [x1, deck(x1) + 0.166, z0],
                [x0, deck(x0) + 0.166, z0],
              ],
              [0, 1, 0],
              tint(
                (ix + iz) % 2 ? [0.44, 0.445, 0.42] : [0.56, 0.565, 0.535],
                i * 157 + k * 47 + ix * 7 + iz,
                0.025,
              ),
            );
          }
      }
  }
  for (let x = -half + 0.15; x < half; x += 3) {
    slab(
      out,
      'marking',
      x,
      Math.min(half, x + 2),
      -0.055,
      0.055,
      (s) => deck(s) + 0.03,
      (s) => deck(s) + 0.036,
      [0.8, 0.79, 0.72],
    );
  }
}
function approachBounds({ anchor, heading }) {
  const radius = 6378137,
    factor = Math.cos((anchor[1] * Math.PI) / 180);
  const center = [
    ((anchor[0] * Math.PI) / 180) * radius * factor,
    -radius * Math.asinh(Math.tan((anchor[1] * Math.PI) / 180)) * factor,
  ];
  const corners = [
    [-137, -109],
    [137, -109],
    [137, 109],
    [-137, 109],
  ].map(([x, z]) => {
    const wx = center[0] + Math.cos(heading) * x + Math.sin(heading) * z;
    const wz = center[1] - Math.sin(heading) * x + Math.cos(heading) * z;
    return [
      ((wx / factor / radius) * 180) / Math.PI,
      (Math.atan(Math.sinh(-wz / factor / radius)) * 180) / Math.PI,
    ];
  });
  return [
    Math.min(...corners.map((p) => p[0])),
    Math.min(...corners.map((p) => p[1])),
    Math.max(...corners.map((p) => p[0])),
    Math.max(...corners.map((p) => p[1])),
  ];
}
export const sanjoOhashiStudy = {
  id: 'N0021',
  key: 'sanjo_ohashi_bridge',
  title: 'Sanjō Ōhashi Bridge',
  wikidataId: 'Q3087620',
  build: buildSanjoOhashi,
  brief:
    'Present steel nine-span bridge with the completed2024 hinoki railings, fourteen retained bronze giboshi, timber girder covers, circular stone shoes and multi-column frames, renewed silver-gray checker paving and modeled asanoha-pattern pedestrian barriers.',
  refs: [
    'https://www.hido.or.jp/wp-content/uploads/2024/10/2410chiiki-kyoto_city.pdf',
    'https://www.city.kyoto.lg.jp/kensetu/cmsfiles/contents/0000149/149842/hashishirube22.pdf',
    'https://www.city.kyoto.lg.jp/kensetu/cmsfiles/contents/0000149/149842/hashishirube15.pdf',
    'https://www.openstreetmap.org/way/571549175',
    'https://maps.gsi.go.jp/development/hyokochi.html',
    'https://maps.gsi.go.jp/development/demtile.html',
  ],
  sourceFacts: {
    lengthMeters: 73.3,
    widthMeters: 16.7,
    spans: 9,
    structuralType:
      'Simply supported steel I-girder spans on multi-column rigid-frame piers and direct foundations',
    railingPosts: { total: 14, diameter480mm: 10, diameter420mm: 4 },
    railingWood: 'Kyoto-grown hinoki',
    retainedFinials: 'Bronze giboshi, largely dating to1590',
    renewalCompleted: 'January2024',
    ownerSource: 'Kyoto City Construction Bureau, October2024 Roads Administration Seminar report',
  },
  reconstruction: {
    pierRows: 8,
    columnsPerRow: 7,
    deckCamberMeters: 0.52,
    notes:
      'Published structure dimensions and main-post counts govern this model. Span spacing, girder and pier sections, rail spacing, road layout, detailed bronze profile and foundation depth are reconstructed from owner photographs. Fine historical inscriptions are not yet sculpted.',
  },
  nativeAxes: {
    x: 'east-northeast toward Higashiyama',
    y: 'up from visible river-pier footings',
    z: 'south-southeast downstream',
  },
  geographic: (mapped) => ({
    anchor: mapped.anchor,
    heading: mapped.heading,
    elevationMode: 'terrain-contact',
    bounds: approachBounds(mapped),
    replaceRoads: { length: 73.3, width: 16.7, deckHeight: 4.58 },
    terrainReference: {
      anchor: [135.77128497337176, 35.00900175953759],
      modelHeight: 4.55,
      basis:
        'West road plateau at native X=-40 m, 3.35 m beyond the 73.3 m bridge endpoint. Align the authored endpoint road height of 4.55 m to valid ground here. Current GSI DEM1A gives 41.714 m, producing an approximately 37.164 m model origin. Use a host terrain sampler that preserves river no-data and resolves this bank reference; coarse river-center terrain must not replace it.',
    },
    notes:
      'Exact mapped bridge polygon identifies the east-northeast axis. Official width 16.7 m and length 73.3 m supersede coarse mapped dimensions 15.94×74.429 m. Ground contact uses the independently measured west road bank; GSI DEM1A upper banks are approximately 41.6–41.8 m. Its water cells are explicitly unknown, not a surveyed riverbed. Fine-terrain approach review is recorded separately.',
  }),
  limitations: [
    'Fine historic finial inscriptions and individual sword scars require additional close photographic evidence.',
    'Pier footings remain a photographic reconstruction. GSI DEM1A resolves the road banks but does not measure submerged riverbed or validate foundation embedment.',
    'Adjacent statues, street signs, temporary furniture and vegetation are outside this bridge asset.',
  ],
  camera: { position: [64, 33, 64], lookAt: [0, 3, 0], fov: 48 },
  qaCameras: [
    { name: 'south-elevation', position: [4, 8, 73], lookAt: [0, 3, 0] },
    { name: 'north-elevation', position: [-16, 11, -57], lookAt: [0, 3, 0] },
    { name: 'timber-joinery', position: [-22.4, 7.6, 13], lookAt: [-23.5, 6.1, 8] },
    { name: 'bronze-giboshi', position: [-24.03, 7.5, 9.8], lookAt: [-24.23, 7.0, 8.14] },
    { name: 'asanoha-barrier', position: [-8, 6.4, 7.5], lookAt: [-6.5, 5.85, 4.46] },
    { name: 'checker-paving', position: [11, 10, 12], lookAt: [8, 5.1, 6] },
    { name: 'pier-frame', position: [-20, 2.3, 17], lookAt: [-20.36, 2, 0] },
    { name: 'steel-soffit', position: [6, 1.2, 2], lookAt: [8, 4.6, 0] },
    { name: 'east-bank', position: [46, 8, 24], lookAt: [31, 4.4, 0] },
  ],
};
