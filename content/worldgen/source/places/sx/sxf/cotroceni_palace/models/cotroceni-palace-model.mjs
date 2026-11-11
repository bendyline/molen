/** Cotroceni Palace's attached wings and two open courts in April 2018. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid');
const {
  polygons: [outline],
  holes,
} = read('map-frame').geometry;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  limestone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.84, metallic: 0.01 },
  terracotta: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51, metallic: 0.11 },
};
const tint = Object.fromEntries(
  Object.entries({
    royal: 'dcccb3',
    north: 'ddd8c7',
    presidential: 'd4c4aa',
    service: 'ccc5b1',
    plinth: '9f917f',
    sandstone: 'b9a086',
    course: 'c8af92',
    molding: 'ddceb6',
    whiteTrim: 'e5ddc9',
    reveal: 'a99b86',
    glass: '57615e',
    basement: '44413a',
    wood: '806d58',
    fascia: '4c4035',
    roof: '706863',
    red: '886c5f',
    terrace: '9e9484',
  }).map(([name, value]) => [name, rgb(value)]),
);

const up = [0, 1, 0];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rectangle = (a, b, low, high) => [
  [a, low],
  [b, low],
  [b, high],
  [a, high],
];
const signedArea = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
const eave = (x) => {
  const { westernEave, royalEave } = plan.elevations;
  return westernEave + (royalEave - westernEave) * clamp((x + 27) / 54, 0, 1);
};

function directed(out, material, vertices, normal, color) {
  const wound = dot(normalFor(...vertices), normal) >= 0 ? vertices : vertices.toReversed();
  if (vertices.length === 3) triangle(out, material, wound, color);
  else face(out, material, wound, color);
}

function surface(out, material, exterior, project, normal, color, openings = []) {
  const points = [...exterior];
  const offsets = openings.map((hole) => {
    const index = points.length;
    points.push(...hole);
    return index;
  });
  const indices = earcut(points.flat(), offsets);
  for (let i = 0; i < indices.length; i += 3)
    directed(
      out,
      material,
      indices.slice(i, i + 3).map((j) => project(...points[j])),
      normal,
      color,
    );
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const row = terrain.heightsMeters[j],
    next = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function section(a, b, side) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [(side * dz) / length, 0, (-side * dx) / length];
  return {
    length,
    normal,
    p: (u, y, depth = 0) => [
      a[0] + (dx * u) / length + normal[0] * depth,
      y,
      a[1] + (dz * u) / length + normal[2] * depth,
    ],
  };
}

function splitEaves(ring) {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length],
      t = [-27, 27].map((x) => (x - a[0]) / (b[0] - a[0]));
    return [
      a,
      ...t
        .filter((p) => p > 1e-7 && p < 1 - 1e-7)
        .sort((u, v) => u - v)
        .map((p) => mix(a, b, p)),
    ];
  });
}
const rings = [outline, ...holes].map(splitEaves);
const edges = rings.flatMap((ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]));

function windowShape({ center, sill, width, height, arch }, steps) {
  const r = width / 2;
  if (!arch) return rectangle(center - r, center + r, sill, sill + height);
  return [
    [center - r, sill],
    [center + r, sill],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const a = (Math.PI * i) / steps;
      return [center + Math.cos(a) * r, sill + height - arch + Math.sin(a) * arch];
    }),
  ];
}

function band(out, s, material, a, b, heightA, heightB, height, depth, color) {
  if (b - a < 0.06) return;
  const p = s.p;
  directed(
    out,
    material,
    [
      p(a, heightA - height, depth),
      p(b, heightB - height, depth),
      p(b, heightB, depth),
      p(a, heightA, depth),
    ],
    s.normal,
    color,
  );
  directed(
    out,
    material,
    [p(a, heightA, 0), p(b, heightB, 0), p(b, heightB, depth), p(a, heightA, depth)],
    up,
    color,
  );
}

function openings(out, s, windows, rings, lod, deep, lightTrim) {
  const { p, normal } = s;
  const depth = deep ? -0.23 : 0.028;
  for (const [i, w] of windows.entries()) {
    const ring = rings[i];
    surface(
      out,
      'glazing',
      ring,
      (u, y) => p(u, y, depth),
      normal,
      w.sill < 2 ? tint.basement : tint.glass,
    );
    if (deep) {
      const target = p(w.center, w.sill + w.height * 0.47);
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        const mid = p(...mix(a, b, 0.5));
        directed(
          out,
          'limestone',
          [p(...a), p(...b), p(...b, depth), p(...a, depth)],
          target.map((v, k) => v - mid[k]),
          tint.reveal,
        );
      }
    }
    if (lod < 2 || w.sill < 2) continue;
    const [a, b] = [w.center - w.width * 0.63, w.center + w.width * 0.63];
    band(out, s, 'limestone', a, b, w.sill + 0.02, w.sill + 0.02, 0.15, 0.21, lightTrim);
    if (w.arch && deep) {
      const inner = ring.slice(2),
        spring = w.sill + w.height - w.arch;
      const outer = inner.map(([x, y]) => [
        w.center + (x - w.center) * (1 + 0.39 / w.width),
        y + (y - spring) * 0.29,
      ]);
      for (let j = 1; j < inner.length; j++)
        directed(
          out,
          'limestone',
          [
            p(...inner[j - 1], 0.045),
            p(...inner[j], 0.045),
            p(...outer[j], 0.045),
            p(...outer[j - 1], 0.045),
          ],
          normal,
          lightTrim,
        );
    } else if (lod === 3) {
      const y = w.sill + w.height + 0.18;
      band(out, s, 'limestone', a, b, y, y, 0.14, 0.15, lightTrim);
    }
    if (lod === 3 && w.arch >= 0.6 && w.width >= 1.65 && w.sill < 6 && i % 6 === 1) {
      const base = w.sill + 0.03;
      band(out, s, 'limestone', a, b, base, base, 0.19, 0.48, lightTrim);
      const u = a + 0.1,
        v = b - 0.1;
      beam(
        out,
        'limestone',
        p(u, base + 0.72, 0.44),
        p(v, base + 0.72, 0.44),
        0.18,
        0.13,
        lightTrim,
      );
      for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        const x = u + (v - u) * t;
        beam(out, 'limestone', p(x, base, 0.44), p(x, base + 0.66, 0.44), 0.09, 0.1, lightTrim);
      }
    }
    if (lod === 3 || (deep && w.arch)) {
      const bar = depth + 0.045;
      directed(
        out,
        'timber',
        rectangle(
          w.center - 0.034,
          w.center + 0.034,
          w.sill + 0.035,
          w.sill + w.height - 0.055,
        ).map(([u, y]) => p(u, y, bar)),
        normal,
        tint.wood,
      );
      const h = w.sill + w.height * 0.58;
      directed(
        out,
        'timber',
        rectangle(w.center - w.width * 0.48, w.center + w.width * 0.48, h - 0.035, h + 0.035).map(
          ([u, y]) => p(u, y, bar),
        ),
        normal,
        tint.wood,
      );
    }
  }
}

function wall(out, a, b, side, zone, lod, showcase) {
  const s = section(a, b, side),
    { length: L, p, normal } = s;
  const topA = eave(a[0]),
    topB = eave(b[0]),
    top = Math.min(topA, topB);
  const y = plan.elevations,
    low = lod ? y.plinth : -0.28;
  const isRoyal = zone === 'royal',
    neo = zone === 'north',
    texturedBase = lod > 0 && (isRoyal || neo);
  const deep = lod === 3 || (lod === 2 && showcase);
  const n =
    lod && L >= (lod === 3 ? 2.45 : 3.45)
      ? Math.max(1, Math.round(L / (lod === 3 ? 3.6 : 4.25)))
      : 0;
  const bays = [];
  for (let j = 0; j < n; j++) {
    const center = (L * (j + 0.5)) / n,
      width = Math.min(isRoyal ? 1.72 : 1.48, (L / n) * 0.57);
    if (texturedBase && L / n > 3.0 && deep)
      bays.push({ center, sill: 1.13, width: width * 0.82, height: 1.66, arch: 0.28 });
    if (neo && deep && j % 3 === 1 && L / n > 3.35) {
      for (const dx of [-0.53, 0.53])
        bays.push({ center: center + dx, sill: 5.35, width: 0.76, height: 2.33, arch: 0.4 });
    } else {
      bays.push({
        center,
        sill: texturedBase ? 5.19 : 3.82,
        width,
        height: 2.86,
        arch: texturedBase && deep ? 0.66 : 0,
      });
    }
    const upper = texturedBase ? 10.55 : 8.08;
    const upperHeight = Math.min(texturedBase ? 2.26 : 1.86, top - upper - 0.48);
    if (upperHeight >= 0.92 && (lod >= 2 || L >= 5.5))
      bays.push({
        center,
        sill: upper,
        width: width * 0.76,
        height: upperHeight,
        arch: neo && deep ? 0.3 : 0,
      });
  }
  const cutouts = bays.map((w) => windowShape(w, lod === 3 ? 5 : lod === 2 ? 4 : 2));
  const lower = texturedBase ? y.rustication : low;
  const body = [
    [0, lower],
    [L, lower],
    [L, topB],
    [0, topA],
  ];
  const base = rectangle(0, L, low, y.rustication);
  surface(
    out,
    'plaster',
    body,
    (u, v) => p(u, v),
    normal,
    tint[zone],
    deep ? cutouts.filter((r) => r[0][1] > lower) : [],
  );
  if (texturedBase)
    surface(
      out,
      'limestone',
      base,
      (u, v) => p(u, v),
      normal,
      tint.sandstone,
      deep ? cutouts.filter((r) => r[0][1] < lower) : [],
    );
  if (lod) {
    const pieces = Math.ceil(L / 9);
    for (let j = 0; j < pieces; j++) {
      const start = (L * j) / pieces,
        end = (L * (j + 1)) / pieces;
      const basePoint = (u) => {
        const [x, , z] = p(u, 0);
        return p(u, Math.min(y.plinth - 0.15, grade(x, z) - 0.25));
      };
      directed(
        out,
        'limestone',
        [basePoint(start), basePoint(end), p(end, y.plinth), p(start, y.plinth)],
        normal,
        tint.plinth,
      );
    }
    const trim = neo ? tint.whiteTrim : tint.molding;
    if (texturedBase && (lod >= 2 || L >= 7))
      band(out, s, 'limestone', 0, L, y.rustication, y.rustication, 0.24, 0.2, trim);
    if (lod >= 2 || L >= 6)
      band(
        out,
        s,
        neo ? 'timber' : 'limestone',
        0,
        L,
        topA,
        topB,
        neo ? 0.29 : 0.24,
        neo ? 0.39 : 0.22,
        neo ? tint.fascia : trim,
      );
    if (lod >= 2 && texturedBase && (lod === 3 || showcase || L >= 7)) {
      band(out, s, 'limestone', 0, L, 9.91, 9.91, 0.15, 0.2, trim);
      for (const h of [1.08, 3.19, 3.78])
        band(out, s, 'limestone', 0, L, h, h, 0.12, 0.15, tint.course);
      if (isRoyal && L > 4.8 && (lod === 3 || showcase)) {
        for (const u of [0.33, L - 0.33]) {
          for (let h = 4.63; h < Math.min(top - 0.32, 9.77); h += 0.54) {
            const d = 0.23 + (Math.round(h * 2) % 2) * 0.12;
            band(out, s, 'limestone', u - d, u + d, h, h, 0.4, 0.082, tint.molding);
          }
        }
      }
    }
    openings(out, s, bays, cutouts, lod, deep, trim);
  }
}

const roofLevels = read('roof-sections').levels;

function distanceToSegmentSquared(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
  const u = x - a[0] - dx * t,
    v = z - a[1] - dz * t;
  return u * u + v * v;
}

function roofHeight(x, z) {
  let eaveDistance = Infinity;
  for (const [a, b] of edges)
    eaveDistance = Math.min(eaveDistance, distanceToSegmentSquared(x, z, a, b));
  let ridgeProfile = 0;
  for (const { a, b, height } of plan.roofRidges) {
    const distance = Math.sqrt(distanceToSegmentSquared(x, z, a, b));
    ridgeProfile = Math.max(ridgeProfile, height - distance * 0.37);
  }
  return eave(x) + Math.min(Math.sqrt(eaveDistance) * 0.53, ridgeProfile);
}

function roofs(out, lod) {
  const cache = new Map();
  const project = (x, z) => {
    const key = x + '/' + z;
    if (!cache.has(key)) cache.set(key, [x, roofHeight(x, z), z]);
    return cache.get(key);
  };
  for (const {
    finish,
    rings: [exterior, ...voids],
  } of roofLevels[lod]) {
    surface(out, finish, exterior, project, up, finish === 'slate' ? tint.roof : tint.red, voids);
  }
}

function roundedBay(out, lod) {
  const {
    center: [x, z],
    radius: r,
    bodyTop,
    roofTop,
  } = plan.roundedBay;
  const n = [5, 7, 9, 11][lod];
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [x + Math.cos(a) * r, z + Math.sin(a) * r];
  });
  const roof = ring.map(([u, v]) => [x + (u - x) * 1.12, z + (v - z) * 1.12]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[i + 1],
      s = section(a, b, 1),
      { p, length: L, normal } = s;
    const lower = Math.min(grade(...a), grade(...b)) - 0.22;
    const bay =
      i % 2 === 1 ? [{ center: L / 2, sill: 6.46, width: L * 0.82, height: 3.29, arch: 0.49 }] : [];
    const windowRings = bay.map((w) => windowShape(w, 4));
    const recess = lod >= 2;
    surface(
      out,
      'plaster',
      rectangle(0, L, lower, bodyTop),
      (u, y) => p(u, y),
      normal,
      tint.north,
      recess ? windowRings : [],
    );
    if (lod) {
      openings(out, s, bay, windowRings, lod, recess, tint.whiteTrim);
      for (const y of [2.16, 6.31, 10.58, 11.9])
        band(out, s, 'limestone', 0, L, y, y, 0.2, 0.17, tint.whiteTrim);
    }
    const eaveA = [roof[i][0], bodyTop - 0.13, roof[i][1]],
      eaveB = [roof[i + 1][0], bodyTop - 0.13, roof[i + 1][1]];
    const topA = [x + (a[0] - x) * 0.53, roofTop, z + (a[1] - z) * 0.53];
    const topB = [x + (b[0] - x) * 0.53, roofTop, z + (b[1] - z) * 0.53];
    const fascia = (p) => [p[0], p[1] + 0.18, p[2]];
    directed(out, 'timber', [eaveA, eaveB, fascia(eaveB), fascia(eaveA)], normal, tint.fascia);
    directed(out, 'slate', [eaveA, eaveB, topB, topA], up, tint.roof);
    directed(out, 'slate', [topA, topB, [x, roofTop, z]], up, tint.roof);
  }
}

function belvedere(out, spec, lod) {
  const {
    center: [x, z],
    width: w,
    depth: d,
    floor,
    ceiling,
    ridge,
  } = spec;
  const a = x - w / 2,
    b = x + w / 2,
    c = z - d / 2,
    e = z + d / 2;
  box(out, 'plaster', [a, 13.9, c], [b, floor - 0.44, e], tint.north);
  box(out, 'limestone', [a, floor - 0.44, c], [b, floor, e], tint.whiteTrim);
  box(
    out,
    'timber',
    [a - 0.17, ceiling - 0.13, c - 0.17],
    [b + 0.17, ceiling, e + 0.17],
    tint.fascia,
  );
  const pts = [
    [a, c],
    [b, c],
    [b, e],
    [a, e],
  ];
  for (let i = 0; i < pts.length; i++) {
    const [u, v] = pts[i];
    const next = pts[(i + 1) % 4];
    const columns = lod ? [0, 0.33, 0.67] : [0];
    for (const t of columns) {
      const [px, pz] = mix([u, v], next, t),
        r = t === 0 ? 0.24 : 0.145;
      box(out, 'plaster', [px - r, floor, pz - r], [px + r, ceiling - 0.09, pz + r], tint.north);
      if (lod >= 2)
        box(
          out,
          'limestone',
          [px - r - 0.09, ceiling - 0.39, pz - r - 0.09],
          [px + r + 0.09, ceiling - 0.16, pz + r + 0.09],
          tint.whiteTrim,
        );
    }
    if (lod) {
      beam(
        out,
        'limestone',
        [u, floor + 0.82, v],
        [next[0], floor + 0.82, next[1]],
        0.2,
        0.15,
        tint.whiteTrim,
      );
      if (lod >= 2) {
        for (const t of [0.15, 0.23, 0.4, 0.51, 0.6, 0.76, 0.84]) {
          const [px, pz] = mix([u, v], next, t);
          box(
            out,
            'limestone',
            [px - 0.06, floor, pz - 0.06],
            [px + 0.06, floor + 0.78, pz + 0.06],
            tint.whiteTrim,
          );
        }
      }
    }
  }
  const mid = (c + e) / 2,
    p = [a + w * 0.31, ridge, mid],
    q = [b - w * 0.31, ridge, mid];
  const roof = [
    [a - 0.43, ceiling, c - 0.43],
    [b + 0.43, ceiling, c - 0.43],
    [b + 0.43, ceiling, e + 0.43],
    [a - 0.43, ceiling, e + 0.43],
  ];
  directed(out, 'slate', [roof[0], roof[1], q, p], up, tint.roof);
  directed(out, 'slate', [roof[2], roof[3], p, q], up, tint.roof);
  directed(out, 'slate', [roof[0], p, roof[3]], up, tint.roof);
  directed(out, 'slate', [roof[1], roof[2], q], up, tint.roof);
}

function build(out, lod) {
  for (const [j, ring] of rings.entries()) {
    const side = (j === 0 ? 1 : -1) * Math.sign(signedArea(ring));
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length],
        [x, z] = mix(a, b, 0.5);
      const zone =
        x < -24 ? 'presidential' : z < -27 ? 'north' : z > 32 && x < 12 ? 'service' : 'royal';
      const showcase = (j === 0 && x >= 75) || (j === 2 && z < -30);
      wall(out, a, b, side, zone, lod, showcase);
    }
  }
  roofs(out, lod);
  roundedBay(out, lod);
  for (const spec of plan.belvederes) belvedere(out, spec, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);

const recipe = 'cotroceni-palace-model.mjs',
  camera = [144, 73, -176],
  lookAt = [1, 6, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'palaceDistrict', 0.43],
    ['street', 'palaceStreet', 0.18],
    ['closeup', 'palaceCloseup', 0.055],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: palaceCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Rusticated Venetian Classical royal residence, pale Neo-Romanian northern additions and the presidential wing, with two open courts.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [21, 26, -11],
  mediumFiContext: {
    scale: 2.4,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: plan.occupiedBuildingOutlines[0],
    outlines: plan.occupiedBuildingOutlines,
    minimumCoverage: 0.94,
    basis:
      'Two occupied parts of OpenStreetMap relation 2272921, leaving both mapped courtyards and the separate church untouched.',
  },
  embeddedCanonicalGraphs: ['stucco', 'stone_limestone_raw', 'slate', 'tile_flat', 'wood_plain'],
  qaCameras: [
    { name: 'royal-garden-facade', position: [109, 10, 39], lookAt: [77, 7.3, 14] },
    {
      name: 'rounded-neo-romanian-courtyard-bay',
      position: [18, 10, -11],
      lookAt: [5.5, 7.7, -36],
    },
    { name: 'two-courtyards-and-presidential-wing', position: [-93, 130, 118], lookAt: [-3, 1, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-cotroceni-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 1.29,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped exterior and courts are ODbL. All three exact Qualla reference images are CC0.',
};
