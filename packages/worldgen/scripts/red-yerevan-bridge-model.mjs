/** Yerevan's Red Bridge as restored in November2025, preserving unlike historical layers. */

import { readFileSync } from 'node:fs';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('n0017_red_bridge', 'map-frame.json')));
const centerZ = -1.92,
  deckY = 9.9;
const red = [0.44, 0.205, 0.105],
  gray = [0.165, 0.18, 0.176],
  mortar = [0.4, 0.359, 0.291];
const rnd = (s) => {
  const n = Math.sin(s * 77.813 + 41.9) * 43971.183;
  return n - Math.floor(n);
};
const color = (s, old = false) =>
  (old || rnd(s) < 0.27 ? gray : red).map((v) => v + (rnd(s * 17) - 0.5) * (old ? 0.07 : 0.13));
const arches = [
  { c: -29.2, rx: 1.56, sy: 1.82, ry: 1.3, floor: 0.58, small: true },
  { c: -11.3, rx: 8.15, sy: 0.85, ry: 7.66, floor: 0 },
  { c: 8.25, rx: 8.55, sy: 0.85, ry: 8.14, floor: 0 },
  { c: 25.15, rx: 1.24, sy: 1.9, ry: 1.09, floor: 0.6, small: true },
  { c: 34.25, rx: 1.66, sy: 1.7, ry: 1.34, floor: 0.45, small: true },
];
function archY(a, x, expand = 0) {
  const rx = a.rx + expand,
    rise = a.ry + expand,
    k = rx * 0.75;
  return (
    a.sy +
    (rise * Math.sqrt(Math.max(0, (rx + k) ** 2 - (Math.abs(x - a.c) + k) ** 2))) /
      Math.sqrt((rx + k) ** 2 - k ** 2)
  );
}
function clip(poly, value) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = value(a),
      db = value(b);
    if (da >= 0) result.push(a);
    if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return result;
}
function prism(out, poly, z0, z1, col, slot = 'sandstone', relief = false) {
  poly = poly
    .map((p) => p.map(Math.fround))
    .filter(
      (p, i, all) =>
        Math.hypot(...p.map((v, k) => v - all[(i + all.length - 1) % all.length][k])) > 1e-5,
    );
  for (let i = poly.length - 1; i >= 0 && poly.length >= 3; i--) {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[i],
      c = poly[(i + 1) % poly.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-7)
      poly.splice(i, 1);
  }
  if (poly.length < 3) return;
  const area = poly.reduce(
    (s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - p[1] * poly[(i + 1) % poly.length][0],
    0,
  );
  if (Math.abs(area) < 1e-8) return;
  if (area < 0) poly.reverse();
  const aa = poly.map(([x, y]) => [x, y, z0]),
    bb = poly.map(([x, y]) => [x, y, z1]);
  for (const face of [aa.toReversed(), bb]) {
    const n = normalFor(...face),
      mid = face[0].map((_, k) => face.reduce((sum, p) => sum + p[k], 0) / face.length),
      seed = mid[0] * 29 + mid[1] * 17;
    const inner = relief
      ? face.map((p) =>
          p.map(
            (v, k) =>
              mid[k] +
              (v - mid[k]) * (0.93 + rnd(seed) * 0.03) +
              n[k] * (0.014 + rnd(seed * 3) * 0.018),
          ),
        )
      : face;
    out.addConvexPolygon(slot, 'palette:#ffffff', inner, n, (p) => [p[0], p[1]], col);
    if (relief)
      for (let i = 0; i < face.length; i++) {
        const j = (i + 1) % face.length,
          q = [face[i], face[j], inner[j], inner[i]];
        quad(out, slot, q, normalFor(...q), col);
      }
  }
  for (let i = 0; i < aa.length; i++) {
    const j = (i + 1) % aa.length,
      q = [aa[i], aa[j], bb[j], bb[i]];
    quad(out, slot, q, normalFor(...q), col);
  }
}
function masonryParts(out, polygon, z0, z1, col, slot = 'sandstone', relief = false) {
  const left = Math.min(...polygon.map((p) => p[0])),
    right = Math.max(...polygon.map((p) => p[0]));
  const xs = [
    left,
    right,
    ...arches.flatMap((a) => [a.c - a.rx, a.c, a.c + a.rx]).filter((x) => x > left && x < right),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1],
      x1 = xs[i],
      a = arches.find((a) => Math.abs((x0 + x1) / 2 - a.c) < a.rx),
      p = clip(
        clip(polygon, (v) => v[0] - x0),
        (v) => x1 - v[0],
      );
    if (p.length < 3) continue;
    if (a?.floor > 0)
      prism(
        out,
        clip(p, (v) => a.floor - v[1]),
        z0,
        z1,
        col,
        slot,
        relief,
      );
    const lo0 = a ? archY(a, x0) : 0,
      lo1 = a ? archY(a, x1) : 0;
    prism(
      out,
      clip(p, (v) => v[1] - lo0 - ((lo1 - lo0) * (v[0] - x0)) / (x1 - x0)),
      z0,
      z1,
      col,
      slot,
      relief,
    );
  }
}
function archRings(out, a) {
  const count = a.small ? 50 : 140,
    thick = a.small ? 0.24 : 0.55;
  const p = (t, expand) => {
    const x = a.c - (a.rx + expand) + 2 * (a.rx + expand) * t;
    return [x, archY(a, x, expand)];
  };
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 1) / count;
    prism(
      out,
      [p(t0, 0), p(t1, 0), p(t1, thick), p(t0, thick)],
      centerZ - 3.21,
      centerZ + 3.21,
      mortar,
      a.small ? 'brick' : 'sandstone',
    );
    for (const side of [-1, 1]) {
      const z = centerZ + side * 3.265;
      prism(
        out,
        [
          p((i + 0.02) / count, -0.005),
          p((i + 0.98) / count, -0.005),
          p((i + 0.98) / count, thick),
          p((i + 0.02) / count, thick),
        ],
        z - 0.035,
        z + 0.035,
        color(a.c + i * 13),
        a.small ? 'brick' : 'sandstone',
        true,
      );
      if (!a.small)
        prism(
          out,
          [p(t0, thick + 0.075), p(t1, thick + 0.075), p(t1, thick + 0.21), p(t0, thick + 0.21)],
          z - 0.06,
          z + 0.06,
          color(i * 7 + a.c),
          'sandstone',
          true,
        );
    }
    for (let lane = 0; lane < 16; lane++) {
      const z0 = centerZ - 3.2 + lane * 0.4;
      prism(
        out,
        [
          p((i + 0.012) / count, -0.025),
          p((i + 0.988) / count, -0.025),
          p((i + 0.988) / count, 0.035),
          p((i + 0.012) / count, 0.035),
        ],
        z0,
        z0 + 0.39,
        color(i * 31 + lane * 53 + a.c),
        a.small ? 'brick' : 'sandstone',
      );
    }
  }
}
function roundedFooting(out, x, radius) {
  const plan = [];
  for (let i = 0; i <= 40; i++) {
    const a = (Math.PI * i) / 40;
    plan.push([x + radius * Math.cos(a), centerZ + 3.25 + radius * Math.sin(a)]);
  }
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (Math.PI * i) / 40;
    plan.push([x + radius * Math.cos(a), centerZ - 3.25 + radius * Math.sin(a)]);
  }
  plan.reverse();
  const rings = [
    { y: 0, r: 1 },
    { y: 0.55, r: 1 },
    { y: 0.85, r: 0.91 },
    { y: 0.86, r: 0.77 },
    { y: 1.14, r: 0.65 },
  ].map(({ y, r }) => plan.map(([xx, z]) => [x + (xx - x) * r, y, centerZ + (z - centerZ) * r]));
  loft(
    out,
    'basalt',
    rings,
    gray.map((v) => v + 0.05),
  );
}
function wallDrain(out, x, side) {
  const z = centerZ + side * 3.34,
    y = 9.4;
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * i) / 24,
      b = (Math.PI * (i + 1)) / 24;
    prism(
      out,
      [
        [x - 0.2 * Math.cos(a), y + 0.25 * Math.sin(a)],
        [x - 0.2 * Math.cos(b), y + 0.25 * Math.sin(b)],
        [x - 0.3 * Math.cos(b), y + 0.37 * Math.sin(b)],
        [x - 0.3 * Math.cos(a), y + 0.37 * Math.sin(a)],
      ],
      z - 0.16,
      z + 0.16,
      red,
    );
  }
  box(out, 'sandstone', [x - 0.3, y - 0.08, z - 0.19], [x + 0.3, y + 0.02, z + 0.19], red);
}
function walkway(out) {
  // Preserve the mapped bent landings, joining them to the published6.5m bridge body.
  const poly = [
    [-40, centerZ + 3.25],
    [40, centerZ + 3.25],
    ...frame.geometry.outline.slice(1, 4),
    [40, centerZ - 3.25],
    [-40, centerZ - 3.25],
    ...frame.geometry.outline.slice(4, 9),
  ];
  out.addCap(
    'sandstone',
    'palette:#ffffff',
    poly,
    [],
    () => deckY,
    [0, 1, 0],
    (p) => p,
    mortar,
  );
  for (let x = -46.4; x < 46.4; x += 0.36)
    for (let j = 0, z = -5.8; z < 5.6; j++) {
      const width = 0.21 + rnd(x * 19 + j * 47) * 0.2,
        end = z + width - 0.008;
      let q = clip(poly, (p) => p[0] - x);
      q = clip(q, (p) => x + 0.35 - p[0]);
      q = clip(q, (p) => p[1] - z);
      q = clip(q, (p) => end - p[1]);
      if (q.length > 2)
        out.addCap(
          'sandstone',
          'palette:#ffffff',
          q,
          [],
          () => deckY + 0.025,
          [0, 1, 0],
          (p) => p,
          (rnd(x * 13 + j) < 0.24 ? [0.31, 0.195, 0.13] : [0.32, 0.295, 0.263]).map(
            (v) => v + (rnd(x * 17 + j * 31) - 0.5) * 0.055,
          ),
        );
      z += width;
    }
  for (let x = -40; x < 40; x += 0.54)
    for (const side of [-1, 1]) {
      const z = centerZ + side * 3.0;
      for (let row = 0; row < 3; row++)
        box(
          out,
          'sandstone',
          [x + 0.006, deckY + row * 0.33, z - 0.245],
          [x + 0.528, deckY + (row + 1) * 0.33 - 0.008, z + 0.245],
          color(x * 31 + row * 71),
        );
      box(
        out,
        'sandstone',
        [x, deckY + 0.99, z - 0.27],
        [x + 0.534, deckY + 1.08, z + 0.27],
        color(x * 43),
      );
    }
  // Bank approach masonry reaches the same base datum as the bridge; terrain buries
  // its lower courses. The real landings are supported retaining walls, not slabs.
  for (const side of [-1, 1]) {
    const plan = clip(poly, (p) => side * p[0] - 40).filter(
      (p, i, all) =>
        Math.hypot(
          p[0] - all[(i + all.length - 1) % all.length][0],
          p[1] - all[(i + all.length - 1) % all.length][1],
        ) > 1e-5,
    );
    for (const y of [0, deckY - 0.01])
      out.addCap(
        'sandstone',
        'palette:#ffffff',
        plan,
        [],
        () => y,
        [0, y === 0 ? -1 : 1, 0],
        (p) => p,
        mortar,
      );
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      const q = [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], deckY, b[1]],
        [a[0], deckY, a[1]],
      ];
      quad(out, 'sandstone', q, normalFor(...q), mortar);
      if (Math.abs(a[0]) <= 40.001 && Math.abs(b[0]) <= 40.001) continue;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      for (let row = 0; row < 37; row++)
        for (let t = -(row % 2) * 0.26; t < length; t += 0.53) {
          const t0 = Math.max(0, t + 0.006),
            t1 = Math.min(length, t + 0.524);
          if (t1 <= t0) continue;
          const ring = (y) =>
            [
              [t0, -0.006],
              [t0, 0.045],
              [t1, 0.045],
              [t1, -0.006],
            ].map(([u, v]) => [a[0] + dx * u - dz * v, y, a[1] + dz * u + dx * v]);
          loft(
            out,
            'sandstone',
            [ring(row * 0.27), ring(Math.min(deckY, row * 0.27 + 0.258))],
            color(t * 29 + row * 17 + i * 11),
          );
        }
    }
  }
  // Leave both walking entrances open: +X at the north end and +Z at the south bend.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (Math.max(Math.abs(a[0]), Math.abs(b[0])) < 39.9) continue;
    if (Math.min(a[0], b[0]) > 46 || Math.min(a[1], b[1]) > 5) continue;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(length / 0.48);
    for (let j = 0; j < n; j++) {
      const t0 = j / n,
        t1 = (j + 0.97) / n,
        p = a.map((v, k) => v + (b[k] - v) * t0),
        q = a.map((v, k) => v + (b[k] - v) * t1);
      if (Math.abs((p[0] + q[0]) / 2) < 40) continue;
      const dx = (q[0] - p[0]) / Math.hypot(q[0] - p[0], q[1] - p[1]),
        dz = (q[1] - p[1]) / Math.hypot(q[0] - p[0], q[1] - p[1]);
      loft(
        out,
        'sandstone',
        [
          [deckY, 0.22],
          [deckY + 1.05, 0.22],
        ].map(([y, w]) => [
          [p[0] - dz * w, y, p[1] + dx * w],
          [q[0] - dz * w, y, q[1] + dx * w],
          [q[0] + dz * w, y, q[1] - dx * w],
          [p[0] + dz * w, y, p[1] - dx * w],
        ]),
        color(i * 23 + j * 17),
      );
    }
  }
}
export function buildRedYerevan(out) {
  for (let x = -40; x < 40; x += 0.12)
    masonryParts(
      out,
      [
        [x, 0],
        [Math.min(40, x + 0.12), 0],
        [Math.min(40, x + 0.12), deckY],
        [x, deckY],
      ],
      centerZ - 3.2,
      centerZ + 3.2,
      mortar,
    );
  for (const a of arches) archRings(out, a);
  for (const a of arches)
    for (const side of [-1, 1])
      for (let y = a.floor; y < a.sy; y += 0.26)
        for (let z = centerZ - 3.2; z < centerZ + 3.2; z += 0.41) {
          const x = a.c + side * a.rx;
          box(
            out,
            'sandstone',
            [x - 0.026, y + 0.005, z + 0.005],
            [x + 0.026, Math.min(a.sy, y + 0.255), Math.min(centerZ + 3.2, z + 0.402)],
            color(y * 59 + z * 23 + a.c),
          );
        }
  for (const side of [-1, 1])
    for (let row = 0, y = 0; y < deckY; row++, y += 0.27) {
      const isBrick = row % 4 === 3;
      for (let x = -40 - (row % 2) * 0.25; x < 40; ) {
        const width = isBrick ? 0.24 : 0.39 + rnd(x * 17 + row * 19) * 0.3,
          left = Math.max(-40, x + 0.006),
          right = Math.min(40, x + width - 0.006),
          old = (x < -20.1 && x > -27.8) || (side === -1 && x > 19 && x < 23.3);
        x += width;
        if (right <= left) continue;
        if (old && row % 5 === 0 && Math.floor((left + 40) / 1.3) % 3 === 0) continue;
        const height = isBrick && !old ? 0.084 : 0.258,
          rows = isBrick && !old ? 3 : 1;
        for (let k = 0; k < rows; k++) {
          const y0 = y + k * 0.09,
            y1 = Math.min(deckY, y0 + height);
          masonryParts(
            out,
            [
              [left, y0],
              [right, y0],
              [right, y1],
              [left, y1],
            ],
            centerZ + side * 3.24 - 0.025,
            centerZ + side * 3.24 + 0.025,
            color(left * 31 + row * 53 + k, old),
            old ? 'basalt' : isBrick ? 'brick' : 'sandstone',
            true,
          );
        }
      }
    }
  roundedFooting(out, -1.6, 2.3);
  for (const x of [-20.4, 18.8]) roundedFooting(out, x, 1.5);
  for (let x = -35; x < 37; x += 7.2) for (const side of [-1, 1]) wallDrain(out, x, side);
  walkway(out);
}
export const redYerevanStudy = {
  id: 'N0017',
  key: 'red_bridge',
  title: 'Red Bridge, Yerevan — restored crossing',
  wikidataId: 'Q3107472',
  build: buildRedYerevan,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Current2025 restoration with unequal pointed central vaults, lower historic pedestrian passages, red/charcoal tuff, retained basalt abutment repairs, thin brick levelling bands, double arch mouldings, rounded stepped cutwaters, restored low parapets, cobbled deck and bent south approach.',
  refs: [
    'https://escs.am/am/news/32750',
    'https://www.yerevan.am/en/news/verakangnman-ashkhatank-nerits-heto-erewani-17-rd-darowm-karhowts-vats-patmakan-karmir-kamowrje-pash/',
    'https://commons.wikimedia.org/wiki/File:Red_Bridge,_Yerevan,_after_reconstruction._01.jpg',
    'https://commons.wikimedia.org/wiki/File:Red_Bridge_in_Yerevan,_2026_april.jpg',
    'https://commons.wikimedia.org/wiki/File:Renovated_Red_Bridge,_Yerevan_03.jpg',
    'https://www.openstreetmap.org/way/1166072142',
  ],
  sourceFacts: {
    reopened: '2025-11-17',
    publishedLengthMeters: 80,
    publishedWidthMeters: 6.5,
    publishedHeightMeters: 11,
    mappedFullApproachExtentMeters: 92.429,
    materials: 'Red tuff with preserved later basalt repairs and brick levelling bands',
  },
  reconstruction: {
    mainArchSpansMeters: [16.3, 17.1],
    mainArchCrownHeightsMeters: [8.51, 8.99],
    baseDatum: 'Reconstructed lowest pier footing; river/approach fit still pending',
    basis:
      'Photo-scaled current exterior, ministry dimensions and exact current map perimeter. The separate small north bank chamber and passage are retained as visible in2026 references; historical four-arch descriptions do not describe every present doorway.',
  },
  nativeAxes: {
    x: 'north-northeast toward Noy/Wine Factory bank',
    y: 'up from reconstructed river pier datum',
    z: 'east-southeast toward downstream Hrazdan',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/1166072142', 'way/825354382'],
    source: frame.sourceUrl,
    elevationMode: 'terrain-contact',
    notes:
      'OSM historic=ruins is superseded by primary city/ministry restoration evidence and2026 photos. Mapped extended approaches are92.429m while published bridge is80m; current bent south approach retained. Riverbed and bank terrain fit unapproved.',
  }),
  limitations: [
    'Arch stations, minor surface details and footing elevations are interpreted from primary photographs, not engineering survey or photogrammetry.',
    'Historic and restored stone positions are reconstructed; shared raw mineral textures establish library consistency while geometry carries actual joints.',
    'Adjacent hotel, river landscaping and stairs up the distant cliff are separate scenery.',
    'Real terrain fitting and final placement approval remain pending.',
  ],
  camera: { position: [44, 23, 44], lookAt: [0, 5, centerZ], fov: 46 },
  qaCameras: [
    { name: 'downstream-elevation', position: [0, 6, 66], lookAt: [0, 5, centerZ], fov: 57 },
    { name: 'pointed-vaults', position: [19, 7, 19], lookAt: [0, 5, centerZ], fov: 48 },
    { name: 'round-cutwater', position: [4, 2.9, 8], lookAt: [-1.6, 1, centerZ + 3], fov: 49 },
    { name: 'historic-basalt', position: [-23, 6, 9], lookAt: [-23, 5, centerZ + 3], fov: 47 },
    { name: 'brick-passage', position: [25.2, 2.2, 5], lookAt: [25.2, 2.2, centerZ], fov: 52 },
    { name: 'cobbled-walkway', position: [-37, 13, centerZ], lookAt: [15, 10.4, centerZ], fov: 52 },
    { name: 'south-bend', position: [-49, 21, 13], lookAt: [-39, 10, 0], fov: 53 },
    { name: 'arch-soffit', position: [7, 1.5, 8], lookAt: [8, 6, centerZ], fov: 64 },
  ],
};
