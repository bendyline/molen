/** Umeda Sky Building's two towers, open crown and inclined escalators in April 2011. */
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

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const { mappedParts, local } = read('native-map/tower-controls');
const parts = mappedParts
  .filter((p) => Object.hasOwn(plan.partHeights, p.id))
  .map((p) => ({ ...p, height: plan.partHeights[p.id] }));
const surfaces = {
  cladding: { slot: 'wall', graph: 'metal_stainless_beadblasted', roughness: 0.75, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.67, metallic: 0.21 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.24 },
  tube: {
    slot: 'window',
    localRef: 'palette:#dbe8ef',
    roughness: 0.25,
    metallic: 0.06,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.33],
    doubleSided: true,
  },
  detail: { slot: 'trim', localRef: 'palette:#fefefe', roughness: 0.79, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    silver: 'c1bdad',
    pale: 'd2cfc2',
    soft: 'aaa9a0',
    alloy: '9b9c96',
    seam: '777e7d',
    black: '46585f',
    blue: '738b97',
    blueSun: '859ba3',
    blueShade: '647b88',
    bluePanel: '7c95a2',
    darkPane: '59747e',
    brightPane: '91a4a9',
    gallery: '627a80',
    soffit: '96968a',
    roof: '9b9b92',
    deck: 'a9a7a0',
    concrete: 'b8b5a9',
    steel: '626e70',
    rail: '8f9692',
    under: '596a72',
    glass: 'a9c1ca',
    deep: '424d4f',
    white: 'dddace',
    paver: 'a3a39b',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const mean = (points) => [0, 1].map((i) => points.reduce((s, p) => s + p[i], 0) / points.length);

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2,
    normal = [-uz, 0, ux];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function oriented(out, slot, p, normal, color) {
  const n = normalFor(...p),
    points = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function band(out, s, slot, a, b, d, color) {
  oriented(
    out,
    slot,
    rect(...a, ...b).map((p) => s.p(...p, d)),
    s.normal,
    color,
  );
}

function cap(out, slot, outer, y, color, normal = [0, 1, 0], holes = []) {
  const positions = [...outer],
    starts = [];
  for (const h of holes) {
    starts.push(positions.length);
    positions.push(...h);
  }
  const mesh = earcut(positions.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3) {
    const p = mesh.slice(i, i + 3).map((j) => [positions[j][0], y, positions[j][1]]);
    oriented(out, slot, p, normal, color);
  }
}

function outwardEdges(points) {
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    return area > 0 ? [b, a] : [a, b];
  });
}

const shaftEdges = new Map();
for (const part of parts)
  for (const [a, b] of outwardEdges(part.points)) {
    const key = [a, b]
      .map((p) => p.map((n) => n.toFixed(4)).join(','))
      .sort()
      .join('/');
    const list = shaftEdges.get(key) ?? [];
    list.push({ a, b, part });
    shaftEdges.set(key, list);
  }

function windowField(out, s, from, to, low, high, lod, tone, seed) {
  band(out, s, 'glass', [from, low], [to, high], 0, tone);
  if (lod === 0) return;
  const spacing = lod === 1 ? 3.7 : 1.82,
    columns = Math.max(1, Math.round((to - from) / spacing));
  const dy = plan.officeFloorRise,
    rows = Math.ceil((high - low) / dy);
  for (let j = 1; j < columns; j++) {
    const x = mix(from, to, j / columns),
      w = lod === 1 ? 0.031 : 0.044;
    band(out, s, 'detail', [x - w, low], [x + w, high], 0.037, tint.seam);
  }
  for (let i = 1; i < rows; i++) {
    const y = low + i * dy;
    if (y + 0.06 >= high) break;
    const w = lod === 1 ? 0.06 : 0.067;
    band(out, s, 'detail', [from, y - w], [to, y + w], 0.042, tint.seam);
    if (lod < 2) continue;
    for (let j = 0; j < columns; j++) {
      const value = (i * 37 + j * 17 + seed) % 19;
      if (value > (lod === 2 ? 2 : 4)) continue;
      const x0 = mix(from, to, j / columns) + 0.085,
        x1 = mix(from, to, (j + 1) / columns) - 0.082;
      band(
        out,
        s,
        'glass',
        [x0, y - dy + 0.12],
        [x1, y - 0.11],
        0.026,
        value < 2 ? tint.bluePanel : value === 2 ? tint.darkPane : tint.brightPane,
      );
    }
  }
}

function shaftFacade(out, s, base, high, lod, part, seed) {
  const h = s.length / 2;
  const eastOrWest = Math.abs(s.normal[0]) > 0.8;
  const shade =
    s.normal[2] > 0.68 ? tint.blueSun : s.normal[2] < -0.68 ? tint.blueShade : tint.blue;
  const margin = Math.min(eastOrWest ? 2.68 : 1.67, s.length * 0.18);
  band(out, s, 'cladding', [-h, base], [-h + margin, high], 0.023, tint.silver);
  band(out, s, 'cladding', [h - margin, base], [h, high], 0.023, tint.pale);
  if (eastOrWest && s.length > 30) {
    const c = part.id === 252485324 ? 4.27 : -5.16;
    const w = 4.44;
    windowField(out, s, -h + margin, c - w / 2, base, high, lod, shade, seed);
    windowField(out, s, c + w / 2, h - margin, base, high, lod, shade, seed + 8);
    band(out, s, 'cladding', [c - w / 2, base], [c + w / 2, high], 0.038, tint.silver);
    if (lod >= 1)
      for (let y = base + 1.63; y < high - 2.38; y += plan.officeFloorRise)
        band(out, s, 'glass', [c - 1.31, y], [c + 1.31, y + 1.33], 0.054, tint.blueShade);
  } else {
    windowField(out, s, -h + margin, h - margin, base, high, lod, shade, seed);
  }
  const capY = high - 0.58;
  if (capY > base) band(out, s, 'cladding', [-h, capY], [h, high], 0.079, tint.pale);
  if (base < 18 && lod >= 1) {
    for (const y of [base + 3.87, base + 8.2, 118.8]) {
      if (y + 0.2 >= high) continue;
      band(out, s, 'cladding', [-h, y], [h, y + 0.32], 0.067, tint.soft);
    }
  }
}

function shafts(out, lod) {
  for (const part of parts) cap(out, 'roof', part.points, part.height, tint.roof);
  let seed = 1;
  for (const group of shaftEdges.values()) {
    const [low, high] = group.toSorted((a, b) => a.part.height - b.part.height);
    const visible = high ?? low,
      base = high ? low.part.height : plan.baseEaves;
    if (visible.part.height - base < 0.01) continue;
    const s = section(visible.a, visible.b);
    shaftFacade(out, s, base, visible.part.height, lod, visible.part, seed++);
  }
  for (const foot of [local.westFoot, local.eastFoot]) {
    const [cx, cz] = mean(foot),
      inset = foot.map(([x, z]) => [mix(cx, x, 0.77), mix(cz, z, 0.78)]);
    cap(out, 'concrete', foot, plan.baseEaves - 0.015, tint.concrete, [0, -1, 0]);
    for (const [a, b] of outwardEdges(inset)) {
      const s = section(a, b),
        h = s.length / 2,
        low = Math.min(grade(...a), grade(...b)) - 0.55;
      band(
        out,
        s,
        'concrete',
        [-h, low],
        [h, Math.max(grade(...a), grade(...b)) + 0.63],
        0.028,
        tint.concrete,
      );
      band(
        out,
        s,
        'glass',
        [-h, Math.max(grade(...a), grade(...b)) + 0.63],
        [h, plan.baseEaves],
        0,
        tint.darkPane,
      );
      if (lod >= 1) {
        const n = Math.floor(s.length / 3.6);
        for (let i = 1; i < n; i++) {
          const x = mix(-h, h, i / n);
          band(out, s, 'steel', [x - 0.07, low], [x + 0.07, plan.baseEaves], 0.045, tint.alloy);
        }
      }
    }
    for (const [a, b] of outwardEdges(foot)) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 35) continue;
      for (const t of [0.07, 0.3, 0.53, 0.76, 0.93]) {
        const p = [mix(a[0], b[0], t), mix(a[1], b[1], t)],
          x = mix(p[0], cx, 0.06),
          z = mix(p[1], cz, 0.05),
          y = grade(x, z) - 0.26;
        beam(
          out,
          'concrete',
          [x, y, z],
          [mix(x, cx, 0.056), plan.baseEaves + 0.05, mix(z, cz, 0.034)],
          lod === 0 ? 1.39 : 1.13,
          lod === 0 ? 1.4 : 1.21,
          tint.concrete,
        );
        if (lod >= 2)
          box(out, 'concrete', [x - 0.69, y, z - 0.68], [x + 0.69, y + 0.62, z + 0.68], tint.soft);
      }
    }
  }
  const lowWing = plan.crown.bottom - 0.24;
  box(
    out,
    'cladding',
    [-29.36, lowWing, -26.36],
    [-25.93, plan.crown.deck - 0.85, 26.62],
    tint.silver,
  );
}

function guard(out, ring, level, lod, inner) {
  const top = plan.height;
  const edges = outwardEdges(ring);
  for (const [a, b] of edges) {
    const s = inner ? section(b, a) : section(a, b),
      h = s.length / 2;
    band(out, s, 'cladding', [-h, level], [h, top], 0.022, tint.silver);
    if (lod >= 2) {
      const n = Math.max(1, Math.round(s.length / 2.42));
      for (let i = 1; i < n; i++) {
        const x = mix(-h, h, i / n);
        band(out, s, 'detail', [x - 0.035, level], [x + 0.035, top], 0.045, tint.seam);
      }
    }
  }
}

function crown(out, lod) {
  const { bottom, deck, oculusRadius } = plan.crown;
  const n = [16, 24, 40, 56][lod],
    r = oculusRadius;
  const opening = Array.from({ length: n }, (_, i) => {
    const angle = (i * 2 * Math.PI) / n;
    return [r * Math.sin(angle), -r * Math.cos(angle)];
  });
  cap(out, 'cladding', local.crown, bottom, tint.soffit, [0, -1, 0], [opening]);
  cap(out, 'roof', local.crown, deck, tint.deck, [0, 1, 0], [opening]);
  for (const [a, b] of outwardEdges(local.crown)) {
    const s = section(a, b),
      h = s.length / 2;
    band(out, s, 'cladding', [-h, bottom], [h, deck], 0, tint.silver);
    if (s.length > 4.1) {
      for (const [y0, y1] of [
        [160.0, 163.65],
        [165.28, 169.92],
      ]) {
        band(out, s, 'glass', [-h + 0.3, y0], [h - 0.3, y1], 0.056, tint.gallery);
        if (lod >= 1) {
          const c = Math.round(s.length / (lod === 1 ? 4.2 : 2.38));
          for (let i = 1; i < c; i++) {
            const x = mix(-h + 0.3, h - 0.3, i / c);
            band(out, s, 'detail', [x - 0.043, y0], [x + 0.043, y1], 0.071, tint.rail);
          }
        }
      }
    }
    band(out, s, 'steel', [-h, deck - 0.55], [h, deck - 0.28], 0.088, tint.alloy);
  }
  for (const [a, b] of outwardEdges(opening)) {
    const s = section(b, a),
      h = s.length / 2;
    band(out, s, 'cladding', [-h, bottom], [h, deck], 0, tint.soft);
    band(out, s, 'steel', [-h, bottom + 0.31], [h, bottom + 0.96], 0.074, tint.alloy);
    band(out, s, 'glass', [-h, 164.01], [h, 168.74], 0.055, tint.gallery);
    if (lod >= 2) band(out, s, 'steel', [-0.043, 164.01], [0.043, 168.74], 0.081, tint.rail);
  }
  guard(out, opening, deck, lod, true);
  guard(out, local.crown, deck, lod, false);
  if (lod >= 2) {
    for (let i = 0; i < n; i++) {
      const a = opening[i],
        b = opening[(i + 1) % n],
        outScale = 1.115;
      const points = [
        [a[0], deck + 0.018, a[1]],
        [b[0], deck + 0.018, b[1]],
        [b[0] * outScale, deck + 0.018, b[1] * outScale],
        [a[0] * outScale, deck + 0.018, a[1] * outScale],
      ];
      oriented(out, 'concrete', points, [0, 1, 0], i % 2 === 0 ? tint.paver : tint.deck);
    }
  }
}

function escalator(out, offset, lod) {
  const { east, west, zSkew, halfWidth: h } = plan.escalators;
  const [x0, y0] = east,
    [x1, y1] = west,
    z0 = offset - zSkew * 0.5,
    z1 = offset + zSkew * 0.5;
  const dx = x1 - x0,
    dz = z1 - z0,
    length = Math.hypot(dx, dz),
    tx = -dz / length,
    tz = dx / length;
  const p = (t, u, v) => [mix(x0, x1, t) + u * tx, mix(y0, y1, t) + v, mix(z0, z1, t) + u * tz];
  const profile = [
    [-h, 0],
    [h, 0],
    [h, 1.84],
    [h - 0.29, 2.4],
    [-h + 0.29, 2.4],
    [-h, 1.84],
  ];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(
      out,
      i === 0 ? 'steel' : lod < 2 ? 'glass' : 'tube',
      [p(0, ...b), p(0, ...a), p(1, ...a), p(1, ...b)],
      i === 0 ? tint.under : lod < 2 ? tint.bluePanel : tint.glass,
    );
  }
  for (const [u, v] of lod === 0 ? profile.slice(0, 2) : profile)
    beam(
      out,
      'steel',
      p(0, u, v),
      p(1, u, v),
      lod === 0 ? 0.175 : 0.12,
      lod === 0 ? 0.18 : 0.13,
      tint.steel,
    );
  const supports = [1, 4, 12, 17][lod];
  for (let i = 0; lod > 0 && i <= supports; i++) {
    const t = i / supports;
    for (let j = 0; j < profile.length; j++) {
      const a = profile[j],
        b = profile[(j + 1) % profile.length];
      beam(out, 'steel', p(t, ...a), p(t, ...b), 0.112, 0.116, tint.rail);
    }
    if (lod >= 2 && i < supports) {
      const next = (i + 1) / supports;
      for (const side of [-1, 1]) {
        beam(
          out,
          'steel',
          p(t, side * h, -0.11),
          p(next, side * h, 0.91),
          0.088,
          0.092,
          tint.steel,
        );
        beam(out, 'steel', p(t, side * h, 0.91), p(next, side * h, -0.11), 0.08, 0.083, tint.steel);
      }
    }
  }
  box(out, 'steel', [-18.89, y1 - 0.4, z1 - h], [-9.52, y1 + 0.09, z1 + h], tint.under);
  box(out, 'steel', [25.35, y0 - 0.35, z0 - h], [28.13, y0 + 0.1, z0 + h], tint.steel);
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      const u = side * (h - 0.12);
      beam(out, 'steel', p(0, u, 0.79), p(1, u, 0.79), 0.075, 0.076, tint.deep);
      beam(
        out,
        'steel',
        [-18.65, y1 + 1.05, z1 + u],
        [-9.73, y1 + 1.05, z1 + u],
        0.072,
        0.079,
        tint.rail,
      );
    }
  }
}

function build(out, lod) {
  shafts(out, lod);
  crown(out, lod);
  for (const offset of plan.escalators.offsets) escalator(out, offset, lod);
}
export const umedaSkyline = (out) => build(out, 0);
export const umedaDistrict = (out) => build(out, 1);
export const umedaStreet = (out) => build(out, 2);
export const umedaCloseup = (out) => build(out, 3);
const recipe = 'umeda-sky-building-model.mjs';
const camera = [-181, 94, 262],
  lookAt = [0, 86, 0];
export const umedaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: umedaCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Osaka’s 173-metre twin towers with their open circular Floating Garden Observatory and paired inclined escalators.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-56, 88, 115],
  mediumFiContext: {
    scale: 1.08,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: local.outer,
    outlines: [local.outer],
    minimumCoverage: 0.92,
    basis: 'Mapped Umeda Sky Building relation with both shafts and the linked crown.',
  },
  embeddedCanonicalGraphs: ['metal_stainless_beadblasted', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'south-plaza-and-twin-towers', position: [-29, 18, 216], lookAt: [0, 81, 0] },
    {
      name: 'floating-garden-aperture-and-escalators',
      position: [-48, 198, 88],
      lookAt: [0, 158, 0],
    },
    { name: 'plaza-columns-and-tower-bases', position: [-21, 11, 94], lookAt: [0, 20, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-towers-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'umedaSkyline',
    errorMeters: 1.19,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'umedaDistrict', 0.57],
        ['street', 'umedaStreet', 0.19],
        ['closeup', 'umedaCloseup', 0.062],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped contours are ODbL. The three exact Qualla photographs are CC0.',
};
