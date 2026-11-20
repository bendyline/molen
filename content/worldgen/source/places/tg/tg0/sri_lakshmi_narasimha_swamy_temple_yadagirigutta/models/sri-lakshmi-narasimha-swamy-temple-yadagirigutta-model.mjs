import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  pairs,
  panel,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const deck = d.deck;
const colors = palette({
  stone: '626263',
  base: '575750',
  trim: '83817a',
  cap: '75756d',
  weather: '6c6a63',
  dark: '30312f',
  court: 'aa9e8b',
  gold: 'bda051',
  goldenTrim: 'ddba62',
});
const surfaces = {
  stone: surface('wall', 'stone_granite', 0.91),
  moulding: surface('trim', 'stone_limestone_weathered', 0.91),
  base: surface('foundation', 'stone_ashlar', 0.95),
  court: surface('foundation', 'stone_sandstone_raw', 0.91),
  gold: surface('trim', 'metal_bronze_cast', 0.63, 0.28),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const allGates = [d.mainGate, ...d.smaller];
const directions = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
const rectangle = (x, z, wide, deep) =>
  rect(x - wide / 2, z - deep / 2, x + wide / 2, z + deep / 2);

function gateTransform(p) {
  const [a, b] = directions[p.heading];
  return (u, y, v) => [p.x + a * v - b * u, y, p.z + b * v + a * u];
}

function gateBlock(out, gate, slot, u, v, w, l, bottom, top, tint) {
  const point = gateTransform(gate);
  const a = point(u - w / 2, bottom, v - l / 2);
  const b = point(u + w / 2, top, v + l / 2);
  block(
    out,
    slot,
    Math.min(a[0], b[0]),
    bottom,
    Math.min(a[2], b[2]),
    Math.abs(a[0] - b[0]),
    top - bottom,
    Math.abs(a[2] - b[2]),
    tint,
  );
}

function deckWall(out, shellHeight, i) {
  const points = d.outline;
  const [a, b] = [points[i], points[(i + 1) % points.length]];
  const wall = edge(a, b, areaSign(points));
  const nearFace = ([x, z]) => {
    const [u, , v] = wall.p(0, 0);
    const [j, , k] = wall.p(1, 0);
    return (x - u) * (j - u) + (z - v) * (k - v);
  };
  const cut = [
    { edge: 2, gate: 0 },
    { edge: 6, gate: 1 },
    { edge: 0, gate: 2 },
    { edge: 5, gate: 3 },
  ].find((entry) => entry.edge === i);
  let segments = [[0, wall.length]];
  if (cut) {
    const portal = allGates[cut.gate];
    const offset = Math.max(2.5, Math.min(wall.length - 2.5, nearFace([portal.x, portal.z])));
    const half = portal.width * 0.2;
    segments = [
      [0, Math.max(0, offset - half)],
      [Math.min(wall.length, offset + half), wall.length],
    ];
  }
  for (const [l, r] of segments) {
    if (r - l < 0.1) continue;
    panel(out, 'stone', wall, l, r, deck - 0.03, shellHeight, 0, colors.stone);
    panel(out, 'moulding', wall, l, r, shellHeight - 0.29, shellHeight, 0.062, colors.trim);
    const offset = -0.68;
    face(
      out,
      'moulding',
      [
        wall.p(l, shellHeight, 0.08),
        wall.p(r, shellHeight, 0.08),
        wall.p(r, shellHeight, offset),
        wall.p(l, shellHeight, offset),
      ],
      up,
      colors.cap,
    );
    panel(out, 'stone', wall, l, r, deck - 0.03, shellHeight, offset, colors.weather);
  }
}

function precinct(out, lod) {
  const dashes = lod < 2 ? 2 : 8;
  const poly = d.outline;
  const sign = areaSign(poly);
  const crest = deck + 4.15;
  cap(out, 'court', poly, deck, colors.court);
  for (const [[a, b], i] of pairs(closed(poly)).map((pair, i) => [pair, i])) {
    const wall = edge(a, b, sign);
    for (let j = 0; j < dashes; j++) {
      const l = (wall.length * j) / dashes;
      const r = (wall.length * (j + 1)) / dashes;
      const la = mix(a[0], b[0], j / dashes),
        lb = mix(a[1], b[1], j / dashes);
      const ra = mix(a[0], b[0], (j + 1) / dashes),
        rb = mix(a[1], b[1], (j + 1) / dashes);
      const p = Math.min(deck - 0.38, grade([la, lb]) - 0.68);
      const q = Math.min(deck - 0.38, grade([ra, rb]) - 0.68);
      face(
        out,
        'base',
        [wall.p(l, p), wall.p(r, q), wall.p(r, deck - 0.01), wall.p(l, deck - 0.01)],
        wall.normal,
        colors.base,
      );
    }
    deckWall(out, crest, i);
  }
}

function tierFace(out, p, lo, hi, w, l, hTier, lod) {
  const point = gateTransform(p);
  const dark = colors.dark;
  const count = lod > 2 ? 5 : 3;
  for (const side of [-1, 1]) {
    const wall = {
      normal: [side * directions[p.heading][0], 0, side * directions[p.heading][1]],
      p: (u, y, off) => point(u, y, side * (l * 0.5 + off)),
    };
    for (let n = 0; n < count; n++) {
      const u = ((n + 0.5) / count - 0.5) * w * 0.85;
      const cy = lo + hTier * 0.22;
      const width = w * 0.07;
      panel(out, 'dark', wall, u - width, u + width, cy, hi - 0.43, 0.025, dark);
      gateBlock(
        out,
        p,
        'moulding',
        u - width - 0.13,
        side * (l / 2 + 0.073),
        0.11,
        0.15,
        cy,
        hi - 0.37,
        colors.weather,
      );
      gateBlock(
        out,
        p,
        'moulding',
        u + width + 0.13,
        side * (l / 2 + 0.073),
        0.11,
        0.15,
        cy,
        hi - 0.37,
        colors.weather,
      );
      if (lod > 2) {
        face(
          out,
          'moulding',
          [
            wall.p(u - width - 0.21, hi - 0.37, 0.14),
            wall.p(u + width + 0.21, hi - 0.37, 0.14),
            wall.p(u, hi - 0.11, 0.14),
          ],
          wall.normal,
          colors.trim,
        );
      }
    }
  }
}

function crown(out, p, start, end, w, l, lod) {
  const point = gateTransform(p);
  const arc =
    lod === 0
      ? [
          [-1, 0],
          [0, 1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-0.84, 0.36],
          [-0.57, 0.73],
          [0, 1],
          [0.57, 0.73],
          [0.84, 0.36],
          [1, 0],
        ];
  for (const [[a, h], [b, k]] of pairs(arc)) {
    const va = a * l * 0.5,
      vb = b * l * 0.5,
      ha = mix(start, end, h),
      hb = mix(start, end, k);
    face(
      out,
      'stone',
      [point(-w / 2, ha, va), point(w / 2, ha, va), point(w / 2, hb, vb), point(-w / 2, hb, vb)],
      up,
      colors.cap,
    );
    for (const s of [-1, 1]) {
      const normal = [-s * directions[p.heading][1], 0, s * directions[p.heading][0]];
      face(
        out,
        'stone',
        [
          point((s * w) / 2, start - 0.06, va),
          point((s * w) / 2, start - 0.06, vb),
          point((s * w) / 2, hb, vb),
          point((s * w) / 2, ha, va),
        ],
        normal,
        colors.weather,
      );
    }
  }
  if (lod === 0) return;
  for (const u of [-0.41, -0.269, -0.133, 0, 0.133, 0.269, 0.41]) {
    const [x, , z] = point(w * u, 0, 0);
    ring(
      out,
      'moulding',
      [x, z],
      [
        [end - 0.1, 0.18],
        [end + 0.23, 0.22],
        [end + 0.49, 0.063],
      ],
      lod > 1 ? 6 : 4,
      colors.trim,
    );
  }
}

function gate(out, p, lod) {
  const mouth = p.width * 0.31,
    piers = (p.width - mouth) / 2;
  const lintel = deck + p.height * 0.285;
  for (const s of [-1, 1]) {
    const u = (s * (p.width - piers)) / 2;
    gateBlock(out, p, 'stone', u, 0, piers, p.depth, deck - 0.08, lintel, colors.stone);
    if (lod === 0) continue;
    gateBlock(
      out,
      p,
      'base',
      u,
      0,
      piers + 0.28,
      p.depth + 0.25,
      deck + 0.08,
      deck + 0.87,
      colors.base,
    );
    for (const dir of [-1, 1]) {
      for (const n of [-0.29, 0.29]) {
        gateBlock(
          out,
          p,
          'moulding',
          u + piers * n,
          dir * (p.depth / 2 + 0.15),
          0.39,
          0.34,
          deck + 0.79,
          lintel - 0.35,
          colors.trim,
        );
      }
    }
  }
  gateBlock(out, p, 'stone', 0, 0, p.width, p.depth, lintel - 0.13, lintel + 0.52, colors.stone);
  const body = lintel + 0.52;
  const crownStart = deck + p.height * 0.885;
  const top = deck + p.height - (lod === 0 ? 0 : 0.49);
  const count = lod === 0 ? 3 : p.tiers;
  const hTier = (crownStart - body) / count;
  for (let k = 0; k < count; k++) {
    const t = k / count,
      low = body + k * hTier,
      high = low + hTier;
    const w = mix(p.width * 0.95, p.width * 0.49, t);
    const l = mix(p.depth * 0.91, p.depth * 0.53, t);
    gateBlock(out, p, 'stone', 0, 0, w, l, low, high, colors.stone);
    if (lod > 0)
      gateBlock(
        out,
        p,
        'moulding',
        0,
        0,
        w + 0.31,
        l + 0.32,
        high - 0.24,
        high + 0.025,
        colors.trim,
      );
    if (lod > 1) tierFace(out, p, low, high, w, l, hTier, lod);
  }
  crown(out, p, crownStart, top, p.width * 0.49, p.depth * 0.54, lod);
}

function sanctuary(out, lod) {
  const { x, z, width, depth, eave } = d.hall;
  const plan = rectangle(x, z, width, depth);
  const roof = deck + eave;
  const skirt = rectangle(x, z, width + 0.27, depth + 0.27);
  shell(out, skirt, () => deck - 0.03, deck + 0.97, { wall: 'base', color: colors.base });
  shell(out, plan, () => deck + 0.98, roof - 0.35, { wall: 'stone', color: colors.stone });
  shell(out, rectangle(x, z, width + 0.69, depth + 0.69), () => roof - 0.35, roof + 0.09, {
    wall: 'moulding',
    color: colors.trim,
    roof: 'stone',
    roofColor: colors.cap,
  });
  for (const [a, b] of pairs(closed(plan))) {
    const w = edge(a, b, areaSign(plan));
    const count = lod === 0 ? 3 : Math.max(4, Math.round(w.length / (lod < 3 ? 4.9 : 3.9)));
    for (let k = 0; k < count; k++) {
      const p = ((k + 0.5) * w.length) / count;
      const half = lod < 2 ? 0.6 : 0.79;
      opening(
        out,
        w,
        p - half,
        p + half,
        deck + 1.5,
        roof - 1.48,
        'moulding',
        colors.dark,
        'dark',
        colors.weather,
        lod,
        0.045,
      );
      if (lod > 1) {
        const [px, , pz] = w.p((k * w.length) / count + 0.3, deck, 0.17);
        block(
          out,
          'moulding',
          px - 0.19,
          deck + 1.07,
          pz - 0.2,
          0.38,
          eave - 1.12,
          0.4,
          colors.trim,
        );
      }
    }
  }
  const v = d.vimana;
  const top = deck + v.height;
  const slots = lod === 0 ? 3 : v.tiers;
  const vBase = roof - 0.7;
  shell(out, rectangle(v.x, v.z, v.width, v.depth), () => vBase, vBase + 1.1, {
    wall: 'gold',
    color: colors.gold,
  });
  for (let k = 0; k < slots; k++) {
    const t = k / slots,
      f = mix(1, 0.33, t);
    const y = vBase + 0.98 + ((top - vBase - 1.99) * k) / slots;
    const ring = rectangle(v.x, v.z, v.width * f, v.depth * f);
    const rise = (top - vBase - 1.99) / slots;
    shell(out, ring, () => y, y + rise, { wall: 'gold', color: colors.gold });
    if (lod > 0)
      shell(
        out,
        rectangle(v.x, v.z, v.width * f + 0.45, v.depth * f + 0.43),
        () => y + rise - 0.17,
        y + rise + 0.05,
        { wall: 'gold', color: colors.goldenTrim },
      );
  }
  ring(
    out,
    'gold',
    [v.x, v.z],
    [
      [top - 1.15, 0.77],
      [top - 0.82, 0.92],
      [top - 0.44, 0.44],
      [top, 0.045],
    ],
    [6, 8, 12, 16][lod],
    colors.goldenTrim,
  );
}

function eastApproach(out, lod) {
  const p = d.mainGate;
  const start = p.x + p.depth / 2 - 0.21;
  const end = start + 8.2;
  const width = p.width * 0.33;
  const lower = Math.min(deck - 0.56, grade([end, p.z]) + 0.16);
  const levels = [3, 5, 7, 9][lod];
  for (let i = 0; i < levels; i++) {
    const far = mix(end, start, i / levels);
    const near = mix(end, start, (i + 1) / levels);
    const top = mix(lower, deck + 0.024, (i + 1) / levels);
    const bottom = Math.min(
      top - 0.27,
      grade([far, p.z - width / 2]) - 0.43,
      grade([far, p.z + width / 2]) - 0.43,
    );
    block(out, 'base', near, bottom, p.z - width / 2, far - near, top - bottom, width, colors.base);
  }
}

function build(out, lod) {
  precinct(out, lod);
  eastApproach(out, lod);
  sanctuary(out, lod);
  for (const p of allGates) gate(out, p, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [125, 70, 87];
const lookAt = [-9, 6, 1];
const terrain = {
  descriptor: 'terrain-review.terrain.json',
  heightmap: 'terrain-review.height.png',
};
const recipe = 'sri-lakshmi-narasimha-swamy-temple-yadagirigutta-model.mjs';
export const yadagiriguttaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Original terrain controls the hill profile and east approach. The summit platform grade and placement of individual architectural components are estimates.',
  brief:
    'The rebuilt black-stone Lakshmi Narasimha Swamy Temple at Yadagirigutta, with a seven-tier eastern gate, broad stone hall, upper enclosure and the gilded vimana over the sacred cave.',
  camera,
  lookAt,
  sunDirection: [65, 55, 31],
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.91,
    basis: 'Named hilltop shrine envelope suppresses generic volumes across the modeled core.',
  },
  mediumFiContext: { scale: 1, groundY: -0.18, terrain },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'east-gateway-on-the-hill', position: [113, 44, 76], lookAt: [-11, 7, 0] },
    { name: 'seven-tiered-main-gateway', position: [72, 13, 18], lookAt: [34, 11, 4] },
    { name: 'sanctuary-and-gilded-vimana', position: [-79, 52, 58], lookAt: [-19, 8, 0] },
    { name: 'upper-temple-enclosure', position: [-20, 109, -21], lookAt: [-4, 0, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'yadagirigutta-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.4,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.11, surfaces },
      street: { export: 'street', errorMeters: 0.45, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.16, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. Written engineering measurements and OpenStreetMap footprint data. No reference photographs or drawings used for geometry.',
};
