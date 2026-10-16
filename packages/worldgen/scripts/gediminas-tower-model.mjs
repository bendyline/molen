/** Original current Gediminas Tower; mapped octagons and photo-derived exterior sections. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingShape, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u9/u99/n0306_gediminas_tower/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
export const gediminasPalette = {
  brick: '#c48666',
  stone: '#c3bba8',
  metal: '#73766e',
  paving: '#b9b1a3',
  wood: '#967655',
  glass: '#4d6178',
  flag: '#ffffff',
};
export const gediminasSurfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0 },
  paving: { slot: 'roof', graph: 'gravel', roughness: 0.97, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', roughness: 0.25, metallic: 0.12 },
  flag: { slot: 'trim', roughness: 0.96, metallic: 0 },
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => {
      const c = parseInt(v, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(gediminasPalette).map(([s, c]) => [s, linear(c)]));
function face(o, p, slot, d, target, color = colors[slot]) {
  p = p.map((q) => q.map(Math.fround));
  const c = d === 0 && means[slot] ? color.map((v, i) => v * means[slot][i]) : color;
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((q) => [q[0], q[2]]),
      c,
    );
  }
}
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
const rawRing = (id) => frame.geometry.rawFeatures.find((w) => w.id === id).points.slice(0, -1);
const baseRing = rawRing(k.stories[0].way);
/** Match original ring direction/start only; never regularize the traced octagons. */
export function gediminasRing(story) {
  let p = rawRing(k.stories[story].way);
  if (Math.sign(area(p)) !== Math.sign(area(baseRing))) p = [...p].reverse();
  const index = p.reduce(
    (best, q, i) =>
      Math.hypot(q[0] - baseRing[0][0], q[1] - baseRing[0][1]) <
      Math.hypot(p[best][0] - baseRing[0][0], p[best][1] - baseRing[0][1])
        ? i
        : best,
    0,
  );
  return [...p.slice(index), ...p.slice(0, index)];
}
const center = (p) => [0, 1].map((i) => p.reduce((s, q) => s + q[i] / p.length, 0));
function inset(p, width) {
  const c = center(p);
  return p.map((q) => {
    const r = Math.hypot(q[0] - c[0], q[1] - c[1]);
    return q.map((v, i) => v - ((v - c[i]) * width) / r);
  });
}
function cap(o, p, y, slot, d, target = [0, 1, 0], color) {
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      slot,
      d,
      target,
      color,
    );
}
function prism(o, p, low, high, slot, d, color) {
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ],
      slot,
      d,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      color,
    );
  }
  cap(o, p, high, slot, d, [0, 1, 0], color);
}
function beam(o, a, b, low, high, width, d, color = colors.metal) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [((-(b[1] - a[1]) / length) * width) / 2, (((b[0] - a[0]) / length) * width) / 2];
  prism(
    o,
    [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ],
    low,
    high,
    'metal',
    d,
    color,
  );
}
function facade(o, a, b, low, high, slot, d, hole, sign) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    n = [sign * u[1], -sign * u[0]];
  const point = ([x, y], depth = 0) => [
    a[0] + x * u[0] + n[0] * depth,
    y,
    a[1] + x * u[1] + n[1] * depth,
  ];
  const arch = openingShape({ ...hole, shape: 'round' }, d),
    opening = arch.map(([x, y]) => [length / 2 + x, y]),
    rectangle = [
      [0, low],
      [length, low],
      [length, high],
      [0, high],
    ];
  if (d === 0) {
    face(
      o,
      rectangle.map((q) => point(q)),
      slot,
      d,
      [n[0], 0, n[1]],
    );
    face(
      o,
      opening.map((q) => point(q, 0.016)),
      hole.isDoor ? 'wood' : 'glass',
      d,
      [n[0], 0, n[1]],
    );
    return;
  }
  const points = [...rectangle, ...opening],
    ix = earcut(points.flat(), [4], 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => point(points[j])),
      slot,
      d,
      [n[0], 0, n[1]],
    );
  const depth = d === 1 ? 0.22 : 0.34;
  for (let i = 0; i < opening.length; i++) {
    const p = opening[i],
      q = opening[(i + 1) % opening.length],
      du = q[0] - p[0],
      dy = q[1] - p[1];
    face(o, [point(p), point(q), point(q, -depth), point(p, -depth)], slot, d, [
      -dy * u[0],
      du,
      -dy * u[1],
    ]);
  }
  face(
    o,
    opening.map((q) => point(q, -depth + 0.003)),
    hole.isDoor ? 'wood' : 'glass',
    d,
    [n[0], 0, n[1]],
  );
  if (d >= 2) {
    const middle = hole.bottom + hole.height / 2,
      rim = 0.12,
      tint = linear('#d19778');
    const outer = opening.map(([x, y]) => [
      length / 2 + (x - length / 2) * (1 + rim / (hole.width / 2)),
      Math.max(low + 0.002, middle + (y - middle) * (1 + rim / (hole.height / 2))),
    ]);
    for (let i = 0; i < opening.length; i++) {
      const j = (i + 1) % opening.length;
      face(
        o,
        [
          point(opening[i], 0.035),
          point(opening[j], 0.035),
          point(outer[j], 0.035),
          point(outer[i], 0.035),
        ],
        'brick',
        d,
        [n[0], 0, n[1]],
        tint,
      );
    }
    if (hole.isDoor) {
      const mid = point([length / 2, hole.bottom + 1.45], -depth + 0.016);
      beam(
        o,
        [mid[0] - u[0] * 0.035, mid[2] - u[1] * 0.035],
        [mid[0] + u[0] * 0.035, mid[2] + u[1] * 0.035],
        hole.bottom + 0.12,
        hole.bottom + hole.height - 0.75,
        0.035,
        d,
        linear('#625b4e'),
      );
    }
  }
}
function tower(o, d) {
  for (let story = 0; story < k.stories.length; story++) {
    const p = gediminasRing(story),
      c = k.stories[story],
      sign = Math.sign(area(p));
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        hole =
          story === 0 && i === k.entrance.face
            ? { ...k.entrance, isDoor: true }
            : k.windowFloors[story];
      facade(o, a, b, c.bottom, c.top, 'brick', d, hole, sign);
    }
    if (story < 2) {
      const upper = gediminasRing(story + 1);
      for (let i = 0; i < p.length; i++) {
        const j = (i + 1) % p.length;
        face(
          o,
          [
            [p[i][0], c.top, p[i][1]],
            [p[j][0], c.top, p[j][1]],
            [upper[j][0], c.top, upper[j][1]],
            [upper[i][0], c.top, upper[i][1]],
          ],
          'brick',
          d,
          [0, 1, 0],
        );
        if (d > 0) beam(o, p[i], p[j], c.top - 0.12, c.top + 0.015, 0.11, d, linear('#6d675d'));
      }
    }
  }
  cap(o, baseRing, 0, 'stone', d, [0, -1, 0]);
}
function foundation(o, d) {
  const p = baseRing,
    sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], -sign * u[0]],
      push = (q, y) => [q[0] + n[0] * 0.009, y, q[1] + n[1] * 0.009];
    const hole = prepareOpening(
      {
        ...k.entrance,
        shape: 'round',
        center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        axis: u,
        depth: 1,
      },
      0,
      d,
    );
    const cut = d > 0 && i === k.entrance.face ? openingBuilder(o, [hole]) : o;
    face(
      cut,
      [
        push(a, 0),
        push(b, 0),
        push(b, k.foundationHeights[(i + 1) % p.length]),
        push(a, k.foundationHeights[i]),
      ],
      'stone',
      d,
      [n[0], 0, n[1]],
    );
  }
}
function terrace(o, d) {
  const p = gediminasRing(2),
    inner = inset(p, k.parapetThickness / Math.cos(Math.PI / 8));
  cap(o, inner, k.deckY, 'paving', d);
  const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      a = p[i],
      b = p[j],
      ai = inner[i],
      bi = inner[j],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      half = k.parapetGapWidth / (2 * length);
    const band = (lo, hi, y, top) =>
      prism(
        o,
        [
          interpolate(a, b, lo),
          interpolate(a, b, hi),
          interpolate(ai, bi, hi),
          interpolate(ai, bi, lo),
        ],
        y,
        top,
        'brick',
        d,
      );
    band(0, 1, k.deckY, k.parapetBottom);
    band(0, 0.5 - half, k.parapetBottom, k.parapetTop);
    band(0.5 + half, 1, k.parapetBottom, k.parapetTop);
    if (d > 0) {
      for (const y of [19.62, 19.96])
        beam(
          o,
          interpolate(a, b, 0.5 - half),
          interpolate(a, b, 0.5 + half),
          y,
          y + 0.075,
          0.075,
          d,
          linear('#686b61'),
        );
    }
  }
}
function roofAccess(o, d) {
  const c = k.roofAccess,
    [x, z] = c.center,
    p = [
      [x - c.width / 2, z - c.depth / 2],
      [x + c.width / 2, z - c.depth / 2],
      [x + c.width / 2, z + c.depth / 2],
      [x - c.width / 2, z + c.depth / 2],
    ];
  prism(o, p, c.bottom, c.eave, 'glass', d);
  for (let i = 0; i < p.length; i++)
    face(
      o,
      [
        [p[i][0], c.eave, p[i][1]],
        [p[(i + 1) % p.length][0], c.eave, p[(i + 1) % p.length][1]],
        [x, c.ridge, z],
      ],
      'glass',
      d,
      [0, 1, 0],
    );
  if (d > 0) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      beam(o, a, b, c.eave - 0.05, c.eave + 0.05, 0.12, d, linear('#64766b'));
      beam(
        o,
        [a[0] - 0.03, a[1]],
        [a[0] + 0.03, a[1]],
        c.bottom,
        c.eave,
        0.12,
        d,
        linear('#64766b'),
      );
      const ridgeA = [a[0], c.eave, a[1]],
        ridgeB = [x, c.ridge, z],
        width = 0.065;
      for (const offset of [-width, width])
        face(
          o,
          [
            [ridgeA[0] + offset, ridgeA[1], ridgeA[2]],
            [ridgeB[0] + offset, ridgeB[1], ridgeB[2]],
            [ridgeB[0] + offset, ridgeB[1] + 0.075, ridgeB[2]],
            [ridgeA[0] + offset, ridgeA[1] + 0.075, ridgeA[2]],
          ],
          'metal',
          d,
          [1, 0, 0],
          linear('#64766b'),
        );
    }
  }
}
function nationalFlag(o, d) {
  const c = k.flagpole,
    [x, z] = c.point,
    count = d === 0 ? 6 : 12,
    r = d === 0 ? 0.105 : 0.07;
  const p = Array.from({ length: count }, (_, i) => [
    x + Math.cos((i * Math.PI * 2) / count) * r,
    z + Math.sin((i * Math.PI * 2) / count) * r,
  ]);
  prism(o, p, c.bottom, c.top, 'metal', d, linear('#e8e0ca'));
  const flag = k.flag,
    n = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 6;
  for (const [band, color] of [
    ['yellow', '#e7b52a'],
    ['green', '#2d8051'],
    ['red', '#b93429'],
  ].entries()) {
    const tint = linear(color[1]),
      low = flag.top - ((band + 1) * flag.height) / 3,
      high = flag.top - (band * flag.height) / 3;
    const point = (t, y) => [
      x + r + flag.width * t,
      y - 0.12 * t + 0.035 * Math.sin(t * Math.PI),
      z + Math.sin(t * Math.PI * 3) * 0.12 * t,
    ];
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n,
        q = [point(a, low), point(b, low), point(b, high), point(a, high)];
      face(o, q, 'flag', d, [0, 0, 1], tint);
      face(o, [...q].reverse(), 'flag', d, [0, 0, -1], tint);
    }
  }
}
export const gediminasParts = { tower, foundation, terrace, roofAccess, nationalFlag };
export function buildGediminasRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(gediminasParts)) fn(o, d);
}
export const buildGediminasSkyline = (o) => buildGediminasRuntime(o, 'skyline');
export const gediminasStudy = {
  id: 'N0306',
  key: 'gediminas_tower',
  title: "Gediminas' Tower",
  category: 'castle',
  wikidataId: 'Q1497616',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildGediminasRuntime(o),
  surfaceOverrides: gediminasSurfaces,
  brief:
    'Current Vilnius octagonal brick tower: three mapped storeys/setbacks, fieldstone ground cladding, arched windows, northeast courtyard doorway, open terrace/parapet, small glazed roof access and Lithuanian flag. Hill and wider castle ruins stay separate.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: gediminasPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Three-storey octagonal brick tower with two mapped floor setbacks',
      'Arched window rhythm and open brick-parapet observation terrace',
      'Lithuanian yellow/green/red flag at mapped center pole',
    ],
  },
  sourceFacts: {
    exactTowerWay: 24569542,
    upperPartWays: [90844046, 90844047],
    mappedDimensions: refs.publishedDimensions,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; attributed original map controls © OpenStreetMap contributors,ODbL-1.0. Museum/tourism facts attributed; photographs not redistributed.',
  sourceNotice:
    'Five existing shared256-square brick/stone/painted metal/gravel/timber graphs, metric repeats and linear tints; flat glazing and vertex-colored national flag. No embedded/new image or copied mesh.',
  dataAttribution:
    '© OpenStreetMap contributors; National Museum of Lithuania; GoVilnius; Lithuania Travel / Silvestras Samsonas / LNM.',
  geographic: () => ({
    status: 'preview-proposal',
    replaceFootprint: true,
    groundModelY: 0,
    reviewStatus:
      'Current tower placement proposal: review mapped octagons and terrain-attachment path; facade sections are photographic estimates and hill micrograde is not surveyed.',
  }),
  geographicNote:
    'Exact tower and two upper-part octagons remain native East/South heading0; broader same-QID Upper Castle node excluded. NativeY0 follows host terrain at the tower ground anchor; hill/curtain ruins remain separate.',
  limitations: refs.limitations,
  importReason:
    'Preserve mapped floor setbacks, facade apertures, open terrace/parapet and centered flag through four authored browser levels.',
  previewGround: true,
  mediumFiContext: { scale: '1', neighborStyle: 'molen.worldgen.regional.northern.detached' },
  camera: { position: [35, 29, 39], lookAt: [0, 11, 0], fov: 42 },
  qaCameras: [
    { name: 'northeast-courtyard-entrance', position: [26, 6, -18], lookAt: [1, 5, -1] },
    { name: 'south-brick-storeys', position: [3, 13, 37], lookAt: [0, 11, 0] },
    { name: 'northwest-foundation', position: [-26, 5, -18], lookAt: [0, 5, 0] },
    { name: 'arched-upper-windows', position: [18, 15, 16], lookAt: [3, 14.8, 3] },
    { name: 'open-terrace-and-flag', position: [19, 28, -18], lookAt: [0, 20, 0] },
    { name: 'mapped-octagon-overhead', position: [0, 54, 0], lookAt: [0, 0, -0.01] },
  ],
};
