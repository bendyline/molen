/** Skopje's bent, single-tier aqueduct: surveyed proportions and surviving mixed masonry. */

import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0018_skopje_aqueduct', 'map-frame.json')),
);
const line = frame.geometry.centerlines[0];
const stations = [0];
for (let i = 1; i < line.length; i++)
  stations.push(
    stations.at(-1) + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]),
  );
const length = stations.at(-1),
  pitch = length / 54,
  pierHalf = 1.1;
const ramp = (385.8 - length) / 2;
const rand = (n) => {
  const v = Math.sin(n * 17.721 + 69.32) * 46733.832;
  return v - Math.floor(v);
};
const stoneColor = (n) => {
  const base = [
    [0.36, 0.315, 0.245],
    [0.245, 0.255, 0.235],
    [0.48, 0.385, 0.255],
    [0.55, 0.5, 0.4],
  ][Math.floor(rand(n) * 4)];
  return base.map((v) => v + (rand(n + 76) - 0.5) * 0.06);
};
const brickColor = (n) => [0.38, 0.17, 0.092].map((v) => v + (rand(n) - 0.5) * 0.095);
const mortar = [0.35, 0.325, 0.277];
const grade = (s) => s / length;
function center(s) {
  let i = 1;
  while (i < stations.length - 1 && stations[i] < s) i++;
  const a = line[i - 1],
    b = line[i],
    t = (s - stations[i - 1]) / (stations[i] - stations[i - 1]);
  return a.map((v, k) => v + (b[k] - v) * t);
}
function point(p) {
  const [s, y, z] = p,
    a = center(s);
  let i = 1;
  while (i < stations.length - 1 && stations[i] < s) i++;
  const t = (s - stations[i - 1]) / (stations[i] - stations[i - 1]);
  const offset = miters[i - 1].map((v, k) => v + (miters[i][k] - v) * t);
  return [a[0] + offset[0] * z, y + grade(s), a[1] + offset[1] * z];
}
// Intersect adjacent parallel offsets at each bend; a rapidly changing tangent
// would fold the inside masonry back on itself near a mapped corner.
const segmentNormals = line.slice(1).map((b, i) => {
  const a = line[i],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    d = Math.hypot(dx, dz);
  return [-dz / d, dx / d];
});
const miters = line.map((_, i) => {
  const a = segmentNormals[Math.max(0, i - 1)],
    b = segmentNormals[Math.min(i, segmentNormals.length - 1)];
  const divisor = 1 + a[0] * b[0] + a[1] * b[1];
  return a.map((v, k) => (v + b[k]) / divisor);
});
function bend(out) {
  const polygon = (name, c, ref, ps, col) => {
    const split = stations
      .slice(1, -1)
      .find((s) => ps.some((p) => p[0] < s - 1e-8) && ps.some((p) => p[0] > s + 1e-8));
    if (split !== undefined) {
      polygon(
        'addConvexPolygon',
        c,
        ref,
        clip(ps, (p) => split - p[0]),
        col,
      );
      polygon(
        'addConvexPolygon',
        c,
        ref,
        clip(ps, (p) => p[0] - split),
        col,
      );
      return;
    }
    const points = ps.map(point),
      n = normalFor(...points);
    out[name](c, ref, points, n, (p) => [p[0], p[1]], col);
  };
  return {
    addQuad(c, r, p, _n, _uv, col) {
      polygon('addQuad', c, r, p, col);
    },
    addTriangle(c, r, p, _n, _uv, col) {
      polygon('addTriangle', c, r, p, col);
    },
    addConvexPolygon(c, r, p, _n, _uv, col) {
      polygon('addConvexPolygon', c, r, p, col);
    },
  };
}
function clip(poly, signed) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signed(a),
      db = signed(b);
    if (da >= 0) result.push(a);
    if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return result;
}
function prism(out, poly, z0, z1, color = mortar, slot = 'rawlimestone', rough = false) {
  poly = poly
    .map((p) => p.map(Math.fround))
    .filter(
      (p, i, all) =>
        Math.hypot(
          p[0] - all[(i + all.length - 1) % all.length][0],
          p[1] - all[(i + all.length - 1) % all.length][1],
        ) > 1e-5,
    );
  for (let i = poly.length - 1; i >= 0 && poly.length >= 3; i--) {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[i],
      c = poly[(i + 1) % poly.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6)
      poly.splice(i, 1);
  }
  if (poly.length < 3) return;
  const area = poly.reduce(
    (n, p, i) => n + p[0] * poly[(i + 1) % poly.length][1] - p[1] * poly[(i + 1) % poly.length][0],
    0,
  );
  if (Math.abs(area) < 1e-6) return;
  if (area < 0) poly.reverse();
  const aa = poly.map(([x, y]) => [x, y, z0]),
    bb = poly.map(([x, y]) => [x, y, z1]);
  for (const face of [aa.toReversed(), bb]) {
    const n = normalFor(...face),
      middle = face[0].map((_, k) => face.reduce((v, p) => v + p[k], 0) / face.length);
    const inner = rough
      ? face.map((p) =>
          p.map(
            (v, k) =>
              middle[k] +
              (v - middle[k]) * (0.62 + rand(middle[0] * 7 + middle[1]) * 0.2) +
              n[k] * (0.008 + rand(middle[0] + middle[1]) * 0.035),
          ),
        )
      : face;
    out.addConvexPolygon(slot, 'palette:#ffffff', inner, n, (p) => [p[0], p[1]], color);
    if (rough)
      for (let i = 0; i < face.length; i++) {
        const j = (i + 1) % face.length,
          q = [face[i], face[j], inner[j], inner[i]];
        quad(out, slot, q, normalFor(...q), color);
      }
  }
  for (let i = 0; i < aa.length; i++) {
    const j = (i + 1) % aa.length,
      q = [aa[i], aa[j], bb[j], bb[i]];
    quad(out, slot, q, normalFor(...q), color);
  }
}
const spans = Array.from({ length: 54 }, (_, i) => ({
  c: (i + 0.5) * pitch,
  rx: (pitch - pierHalf * 2) / 2,
  sy: 2.55,
  ry: 2.62,
}));
const reliefs = Array.from({ length: 42 }, (_, i) => ({
  c: (i + 6) * pitch,
  rx: 0.54,
  sy: 4.83,
  ry: 0.54,
  floor: 4.18,
  intact: i < 3 || i > 34,
}));
function vaultY(a, s) {
  return a.sy + a.ry * Math.sqrt(Math.max(0, 1 - ((s - a.c) / a.rx) ** 2));
}
function lower(s, openings = spans) {
  const a = openings.find((a) => Math.abs(s - a.c) < a.rx);
  return a ? vaultY(a, s) : 0;
}
function wallPieces(out, poly, z0, z1, col, slot, rough = false, dressed = false) {
  if (dressed && poly.some((p) => p[1] < 1.66)) {
    const bottom = clip(poly, (p) => 1.65 - p[1]);
    if (bottom.length >= 3) wallPieces(out, bottom, z0, z1, col, slot, rough);
    poly = clip(poly, (p) => p[1] - 1.66);
    if (poly.length < 3) return;
  }
  const openings = dressed ? spans.map((a) => ({ ...a, rx: a.rx + 0.53, ry: a.ry + 0.53 })) : spans;
  const holes = dressed
    ? reliefs.map((a) => ({ ...a, rx: a.rx + 0.28, ry: a.ry + 0.28 }))
    : reliefs;
  const left = Math.min(...poly.map((p) => p[0])),
    right = Math.max(...poly.map((p) => p[0]));
  const split = [
    left,
    right,
    ...openings.flatMap((a) => [a.c - a.rx, a.c, a.c + a.rx]),
    ...holes.flatMap((a) => [a.c - a.rx, a.c, a.c + a.rx]),
  ]
    .filter((x) => x >= left && x <= right)
    .sort((a, b) => a - b)
    .filter((v, i, all) => !i || v - all[i - 1] > 1e-5);
  for (let i = 1; i < split.length; i++) {
    const a = split[i - 1],
      b = split[i],
      lo0 = lower(a + 1e-7, openings),
      lo1 = lower(b - 1e-7, openings);
    let p = clip(
      clip(poly, (p) => p[0] - a),
      (p) => b - p[0],
    );
    p = clip(p, (p) => p[1] - lo0 - ((lo1 - lo0) * (p[0] - a)) / (b - a));
    const relief = holes.find((r) => Math.abs((a + b) / 2 - r.c) < r.rx);
    if (relief) {
      prism(
        out,
        clip(p, (p) => relief.floor - p[1]),
        z0,
        z1,
        col,
        slot,
        rough,
      );
      const h0 = vaultY(relief, a),
        h1 = vaultY(relief, b);
      p = clip(p, (p) => p[1] - h0 - ((h1 - h0) * (p[0] - a)) / (b - a));
    }
    prism(out, p, z0, z1, col, slot, rough);
  }
}
function archBricks(out, a, number) {
  const n = a.floor === undefined ? 104 : 34,
    thickness = a.floor === undefined ? 0.5 : 0.26;
  const p = (t, extra) => [a.c - (a.rx + extra) * Math.cos(t), a.sy + (a.ry + extra) * Math.sin(t)];
  for (let i = 0; i < n; i++) {
    const start = (Math.PI * i) / n,
      end = (Math.PI * (i + 1)) / n;
    prism(out, [p(start, 0), p(end, 0), p(end, thickness), p(start, thickness)], -1.065, 1.065);
    for (const side of [-1, 1]) {
      const z = side * 1.104,
        gap = a.intact === false ? 0.16 : 0.12;
      prism(
        out,
        [
          p(start + gap / n, -0.015),
          p(end - gap / n, -0.015),
          p(end - gap / n, thickness),
          p(start + gap / n, thickness),
        ],
        z - 0.02,
        z + 0.02,
        brickColor(number * 29 + i),
        'brick',
        !a.intact,
      );
    }
    for (let j = 0; j < 8; j++) {
      const z = -1.08 + j * 0.27;
      prism(
        out,
        [
          p(start + 0.09 / n, -0.03),
          p(end - 0.09 / n, -0.03),
          p(end - 0.09 / n, 0.018),
          p(start + 0.09 / n, 0.018),
        ],
        z,
        z + 0.254,
        brickColor(number * 13 + i * 5 + j),
        'brick',
      );
    }
  }
}
function rubble(poly, seed) {
  const [a, b, c] = poly,
    x0 = a[0],
    x1 = b[0],
    y0 = a[1],
    y1 = c[1],
    w = x1 - x0,
    h = y1 - y0;
  const k = 0.13 + rand(seed) * 0.25;
  const points = [
    [x0 + w * k, y0 + h * rand(seed + 1) * 0.1],
    [x1 - w * (0.12 + rand(seed + 2) * 0.15), y0 + h * 0.04],
    [x1, y0 + h * k],
    [x1 - w * (0.025 + rand(seed + 3) * 0.09), y1 - h * 0.2],
    [x1 - w * k, y1],
    [x0 + w * (0.12 + rand(seed + 4) * 0.12), y1 - h * 0.04],
    [x0, y1 - h * k],
    [x0 + w * 0.015, y0 + h * 0.2],
  ];
  const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const hullHalf = (ps) => {
    const result = [];
    for (const p of ps) {
      while (result.length > 1) {
        const a = result.at(-2),
          b = result.at(-1);
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 1e-8) break;
        result.pop();
      }
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...hullHalf(sorted), ...hullHalf(sorted.toReversed())];
}
export function buildSkopjeAqueduct(base) {
  const out = bend(base);
  for (let s = 0; s < length; s += 0.12)
    wallPieces(
      out,
      [
        [s, 0],
        [Math.min(length, s + 0.12), 0],
        [Math.min(length, s + 0.12), 6.12],
        [s, 6.12],
      ],
      -1.05,
      1.05,
      mortar,
      'rawlimestone',
    );
  for (const [i, a] of [...spans, ...reliefs].entries()) archBricks(out, a, i);
  for (const side of [-1, 1])
    for (let row = 0; row < 15; row++) {
      const y = row * 0.41,
        z = side * 1.092;
      for (let s = -(row % 2) * 0.23; s < length; ) {
        const w = 0.23 + rand(s * 31 + row) * 0.61,
          l = Math.max(0, s + 0.016),
          r = Math.min(length, s + w - 0.016);
        s += w;
        if (r <= l) continue;
        wallPieces(
          out,
          rubble(
            [
              [l, y + 0.015 + rand(l + row) * 0.04],
              [r, y + 0.015 + rand(l + row) * 0.04],
              [r, y + 0.27 + rand(l * 7 + row) * 0.068],
              [l, y + 0.27 + rand(l * 7 + row) * 0.068],
            ],
            l + row * 71,
          ),
          z - 0.035,
          z + 0.035,
          stoneColor(l + row * 17),
          'rawlimestone',
          true,
          true,
        );
        wallPieces(
          out,
          [
            [l, y + 0.352],
            [r, y + 0.352],
            [r, y + 0.402],
            [l, y + 0.402],
          ],
          z - 0.033,
          z + 0.033,
          brickColor(l * 43 + row),
          'brick',
          false,
          true,
        );
        if (rand(l + row * 18) < 0.32)
          wallPieces(
            out,
            [
              [r - 0.025, y + 0.035],
              [r + 0.011, y + 0.038],
              [r + 0.008, y + 0.31],
              [r - 0.026, y + 0.315],
            ],
            z - 0.025,
            z + 0.035,
            brickColor(l + row),
            'brick',
            false,
            true,
          );
      }
    }
  // Return masonry on the four sides of each pier below the brick springing.
  for (let j = 1; j < 54; j++)
    for (const side of [-1, 1]) {
      const x = j * pitch + side * pierHalf;
      for (let row = 0; row < 4; row++)
        for (let z = -1.04; z < 1.04; z += 0.41) {
          box(
            out,
            'rawlimestone',
            [x - 0.028, row * 0.41 + 0.015, z + 0.015],
            [x + 0.028, row * 0.41 + 0.337, Math.min(1.04, z + 0.398)],
            stoneColor(j * 71 + row + z),
          );
          box(
            out,
            'brick',
            [x - 0.032, row * 0.41 + 0.35, z],
            [x + 0.032, row * 0.41 + 0.402, Math.min(1.04, z + 0.397)],
            brickColor(j + row * 41),
          );
        }
      for (let y = 1.65; y < 2.55; y += 0.085)
        for (let z = -1.05; z < 1.05; z += 0.27)
          box(
            out,
            'brick',
            [x - 0.035, y, z + 0.014],
            [x + 0.035, Math.min(2.55, y + 0.063), Math.min(1.05, z + 0.253)],
            brickColor(j + y * 19 + z),
          );
    }
  for (const [i, a] of spans.entries())
    for (const end of [-1, 1])
      for (const side of [-1, 1])
        for (let y = 1.66; y < a.sy; y += 0.085) {
          const x = a.c + end * a.rx;
          box(
            out,
            'brick',
            [Math.min(x, x + end * 0.51), y, side * 1.1 - 0.025],
            [Math.max(x, x + end * 0.51), Math.min(a.sy, y + 0.065), side * 1.1 + 0.025],
            brickColor(i * 19 + y),
          );
        }
  // A real U-shaped water conduit, with an exposed bed and individually broken caps.
  for (let s = -ramp; s < length + ramp; s += 0.6) {
    const end = Math.min(length + ramp, s + 0.6),
      outside = s < 0 || s >= length;
    box(out, 'rawlimestone', [s, 5.99, -1.13], [end, 6.18, 1.13], mortar);
    for (const side of [-1, 1]) {
      const h = 6.32 + rand(s * 3 + side) * 0.27;
      const z0 = side < 0 ? -1.13 : 0.7,
        z1 = side < 0 ? -0.7 : 1.13;
      box(out, 'rawlimestone', [s, 6.18, z0], [end, 6.31, z1], mortar);
      prism(
        out,
        [
          [s + 0.009, 6.29],
          [end - 0.009, 6.29],
          [end - 0.02, h],
          [s + 0.024, Math.max(6.32, h - 0.045)],
        ],
        z0,
        z1,
        stoneColor(s + side),
        'rawlimestone',
        true,
      );
      if (rand(s + side * 11) > 0.24)
        prism(
          out,
          [
            [s + 0.018, h],
            [end - 0.038, h - 0.015],
            [end - 0.012, h + 0.038],
            [s + 0.026, h + 0.052],
          ],
          z0 - 0.02,
          z1 + 0.02,
          brickColor(s + side * 3),
          'brick',
          true,
        );
    }
    if (outside) {
      const depth = Math.min(
        5.98,
        Math.max(0.15, s < 0 ? (5.98 * (s + ramp)) / ramp : (5.98 * (length + ramp - s)) / ramp),
      );
      box(out, 'rawlimestone', [s, 5.98 - depth, -1.08], [end, 5.99, 1.08], mortar);
      for (const side of [-1, 1])
        for (let y = 5.98 - depth; y < 5.98; y += 0.32)
          box(
            out,
            'rawlimestone',
            [s + 0.01, y, side * 1.1 - 0.025],
            [end - 0.01, Math.min(5.98, y + 0.303), side * 1.1 + 0.025],
            stoneColor(s * 17 + y * 11),
          );
    }
  }
}
export const skopjeAqueductStudy = {
  id: 'N0018',
  key: 'skopje_aqueduct',
  title: 'Skopje Aqueduct',
  wikidataId: 'Q862032',
  build: buildSkopjeAqueduct,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Bent54-arch water conduit with53 square piers,42 distinct upper relief openings, mixed rounded stone and brick courses, individual radial brick rings and soffits, open water channel, broken cap courses and two end ramps.',
  refs: [
    'https://repository.ukim.mk/bitstream/20.500.12188/28646/1/5%20Sidnej%20-%2020ICSMGE%20-%20Akvadukt.pdf',
    'https://repository.ukim.mk/bitstream/20.500.12188/28652/1/MASE20%20-%20akvadukt.pdf',
    'https://karpos.gov.mk/wp-content/uploads/2017/08/turisticki-lokaliteti-Karpos.pdf',
    'https://commons.wikimedia.org/wiki/File:Skopje_Aqueduct_9.jpg',
    'https://commons.wikimedia.org/wiki/File:Skopje_Aqueduct_3.jpg',
    'https://commons.wikimedia.org/wiki/File:Skopje_Aqueduct_8.jpg',
    'https://www.openstreetmap.org/way/180360206',
    'https://pub-a8a09a2ee9454482a412c12c7e4f463e.r2.dev/Godisna%20programa%202026.pdf',
  ],
  sourceFacts: {
    mainArches: 54,
    piers: 53,
    reliefOpenings: 42,
    engineeringLengthMeters: 385.8,
    engineeringPierWidthMeters: [2.15, 2.24],
    surveyedPierPitchMeters: [6.5, 6.7],
    mappedCenterlineMeters: length,
  },
  reconstruction: {
    rampLengthMeters: ramp,
    elevationChangeMeters: 1,
    sourceDate: 'March2024 photographs;2023 conservation sections',
    notes:
      'The exact mapped channel line is350.77m. The model interprets the remaining35.03m of engineering overall length as two end ramps. Relief-opening station assignment, present stone repairs and conduit rim losses remain approximate pending further conservation-plan evidence.',
  },
  nativeAxes: {
    x: 'north-northwest between principal endpoints, with both mapped bends retained',
    y: 'up from reconstructed pier-ground datum',
    z: 'east-northeast across the conduit',
  },
  geographic: () => ({
    elevationMode: 'terrain-contact',
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/180360206'],
    source: frame.sourceUrl,
    notes:
      'Exact Wikidata identity. Narrow mapped outline locates the conduit rather than the full2.2m-wide pier bases. Approach lengths and actual terrain must be reviewed before geographic approval.',
  }),
  limitations: [
    'Conservation work continued after the dated photo set; exact2026 stone repairs require further confirmation.',
    'Unknown relief-opening stations and ramp lengths are reconstruction assumptions explicitly recorded in spec.json.',
    'Original geometry from visual and dimensional evidence, not a laser scan or measured stone-by-stone survey.',
    'Actual local ground contact and placement remain pending.',
  ],
  camera: { position: [125, 100, 300], lookAt: [0, 3.5, -22], fov: 60 },
  qaCameras: [
    { name: 'whole-bent-arcade', position: [0, 95, 345], lookAt: [0, 3, -22], fov: 68 },
    { name: 'southern-arches', position: [-131, 5, 5], lookAt: [-119, 3.2, -13], fov: 61 },
    { name: 'middle-bend', position: [19, 10, -9], lookAt: [30, 4.4, -41], fov: 53 },
    { name: 'rubble-and-brick', position: [-1, 2, -27], lookAt: [0, 1.8, -33], fov: 48 },
    { name: 'relief-openings', position: [58, 5, -23], lookAt: [55, 4.8, -37], fov: 50 },
    { name: 'brick-soffit', position: [54, 1.1, -29], lookAt: [54, 4.6, -38], fov: 60 },
    { name: 'water-conduit', position: [82, 9, -30], lookAt: [104, 6.6, -29], fov: 51 },
    { name: 'north-ramp', position: [182, 11, 25], lookAt: [172, 4.5, 3], fov: 54 },
  ],
};
