import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const colors = palette({
  timber: '664e42',
  redWood: '874d3a',
  timberLight: 'a16d4d',
  darker: '483d35',
  coral: 'a55243',
  deepCoral: '874737',
  flash: 'c88b62',
  cream: 'ddd1b7',
  tower: 'cec4ae',
  towerWing: 'b9a991',
  gray: '8d887a',
  deck: 'aa8f75',
  bronze: 'a6714d',
  glass: '536564',
  shadow: '4b5150',
  thatch: '9a7452',
  lava: '5e5b52',
  lavaLight: '797265',
  pool: '5eb6b2',
  foam: 'a4cec1',
});
const surfaces = {
  cedar: surface('wall', 'wood_board_batten', 0.91),
  tin: surface('roof', 'metal_standing_seam', 0.72, 0.15),
  plaster: surface('wall', 'plaster_lime', 0.89),
  concrete: surface('foundation', 'concrete_plain', 0.94),
  stone: surface('trim', 'stone_basalt_raw', 0.95),
  finish: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8 },
  glazing: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.34 },
};
const midpoint = (a, b) => [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const limits = (points, axis) => [
  Math.min(...points.map((p) => p[axis])),
  Math.max(...points.map((p) => p[axis])),
];
const center = (points) => [0, 1].map((i) => limits(points, i).reduce((a, b) => (a + b) / 2));
const rectBounds = (p) => {
  const [l, r] = limits(p, 0),
    [b, f] = limits(p, 1);
  return rect(l, f, r, b);
};
const inset = (shape, ratio) => {
  const at = center(shape);
  return shape.map((p) => p.map((v, i) => mix(v, at[i], ratio)));
};

function cleaner(points, tolerance) {
  return points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length],
      b = points[(i + 1) % points.length];
    if (distance(a, p) < 0.08) return false;
    const area = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]));
    return area / Math.max(distance(a, b), 0.1) > tolerance;
  });
}

function mass(out, footprint, slot, floor, top, color) {
  const sign = areaSign(footprint);
  for (const [a, b] of pairs(closed(footprint))) {
    if (distance(a, b) < 0.04) continue;
    const w = edge(a, b, sign);
    panel(out, slot, w, 0, w.length, floor, top, 0, color);
  }
}

function frameFor(footprint) {
  let result;
  for (const [a, b] of pairs(closed(footprint))) {
    const length = distance(a, b);
    if (length < 0.5) continue;
    const c = (b[0] - a[0]) / length,
      s = (b[1] - a[1]) / length;
    const forward = ([x, z]) => [x * c + z * s, -x * s + z * c];
    const inverse = ([u, v]) => [u * c - v * s, u * s + v * c];
    const polygon = footprint.map(forward);
    const u = limits(polygon, 0),
      v = limits(polygon, 1);
    const area = (u[1] - u[0]) * (v[1] - v[0]);
    if (!result || area < result.area) result = { forward, inverse, polygon, u, v, area };
  }
  return result;
}

function coarseRoof(out, footprint, eave, rise, pitchColor, roofSlot) {
  const frame = frameFor(footprint);
  const longAxis = frame.u[1] - frame.u[0] >= frame.v[1] - frame.v[0] ? 0 : 1;
  const [long, short] = longAxis === 0 ? [frame.u, frame.v] : [frame.v, frame.u];
  const point = (a, b, y) => at(frame.inverse(longAxis === 0 ? [a, b] : [b, a]), y);
  const low = point(long[0], short[0], eave),
    high = point(long[1], short[0], eave);
  const p = point(long[0], short[1], eave),
    q = point(long[1], short[1], eave);
  const center = mix(...short, 0.5);
  const ridgeA = point(long[0], center, eave + rise),
    ridgeB = point(long[1], center, eave + rise);
  face(out, roofSlot, [low, high, ridgeB, ridgeA], up, pitchColor);
  face(out, roofSlot, [ridgeA, ridgeB, q, p], up, colors.deepCoral);
  const heading = [ridgeB[0] - ridgeA[0], 0, ridgeB[2] - ridgeA[2]];
  face(
    out,
    'cedar',
    [low, ridgeA, p],
    heading.map((v) => -v),
    colors.redWood,
  );
  face(out, 'cedar', [high, q, ridgeB], heading, colors.redWood);
}

function gabled(
  out,
  footprint,
  eave,
  rise,
  pitchColor,
  level,
  { axis, heightOffset = 0, edging = colors.flash, roofSlot = 'tin' } = {},
) {
  if (level === 0) {
    coarseRoof(out, footprint, eave + heightOffset, rise, pitchColor, roofSlot);
    return;
  }
  const frame = frameFor(footprint);
  const short = axis ?? (frame.u[1] - frame.u[0] > frame.v[1] - frame.v[0] ? 1 : 0);
  const crossRange = short === 0 ? frame.u : frame.v;
  const pivot = mix(...crossRange, 0.5);
  const width = Math.max(crossRange[1] - pivot, 0.2);
  const height = (q) =>
    eave + heightOffset + rise * Math.max(0, 1 - Math.abs(q[short] - pivot) / width);
  const indices = earcut(frame.polygon.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const polygon = indices.slice(i, i + 3).map((index) => frame.polygon[index]);
    for (const side of [-1, 1]) {
      const clipped = [];
      for (const [a, b] of pairs(closed(polygon))) {
        const av = side * (a[short] - pivot),
          bv = side * (b[short] - pivot);
        if (av >= -1e-8) clipped.push(a);
        if (av * bv < -1e-10) clipped.push(a.map((v, j) => mix(v, b[j], av / (av - bv))));
      }
      const area = Math.abs(
        clipped.reduce((sum, p, j) => {
          const t = clipped[(j + 1) % clipped.length];
          return sum + p[0] * t[1] - p[1] * t[0];
        }, 0),
      );
      if (area > 1e-5)
        face(
          out,
          roofSlot,
          clipped.map((p) => at(frame.inverse(p), height(p))),
          up,
          side > 0 ? pitchColor : colors.deepCoral,
        );
    }
  }
  const winding = areaSign(footprint);
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i],
      b = footprint[(i + 1) % footprint.length];
    const qa = frame.forward(a),
      qb = frame.forward(b);
    const aa = qa[short] - pivot,
      bb = qb[short] - pivot;
    const segments =
      aa * bb < 0 ? [qa, qa.map((v, k) => mix(v, qb[k], aa / (aa - bb))), qb] : [qa, qb];
    const normal = edge(a, b, winding).normal;
    for (const [p, q] of pairs(segments)) {
      const l = height(p),
        r = height(q),
        z = frame.inverse(p),
        w = frame.inverse(q);
      const lowH = eave + heightOffset - 0.1;
      face(out, 'cedar', [at(z, lowH), at(w, lowH), at(w, r), at(z, l)], normal, colors.redWood);
      if (level > 1 && distance(z, w) > 0.22)
        beam(out, 'finish', at(z, l + 0.01), at(w, r + 0.01), 0.155, 0.165, edging);
    }
  }
}

function balconies(out, footprint, level, floor, storeys, spacing, tower = false) {
  if (level === 0) return;
  const sign = areaSign(footprint),
    slot = tower ? 'plaster' : 'cedar';
  for (const [a, b] of pairs(closed(footprint))) {
    const w = edge(a, b, sign);
    if (w.length < 3.1) continue;
    const bays = Math.max(
      1,
      Math.round(w.length / (level === 1 ? 13.5 : level === 2 ? 10.6 : tower ? 5.55 : 3.6)),
    );
    const size = w.length / bays;
    for (let storey = 0; storey < storeys; storey += tower && level === 1 ? 2 : 1) {
      const y = floor + storey * spacing;
      for (let i = 0; i < bays; i++) {
        const near = size * i + size * 0.14,
          far = size * (i + 1) - size * 0.13;
        const tint = (i + storey) % 7 === 3 ? colors.shadow : colors.glass;
        panel(out, 'glazing', w, near, far, y + 0.41, y + spacing * 0.82, 0.052, tint);
        if (level > 1 && (tower ? storey > 0 : true)) {
          const depth = tower ? 1.34 : 0.81;
          face(
            out,
            slot,
            [
              w.p(near, y + 0.24),
              w.p(far, y + 0.24),
              w.p(far, y + 0.24, depth),
              w.p(near, y + 0.24, depth),
            ],
            up,
            tower ? colors.cream : colors.deck,
          );
          panel(
            out,
            'finish',
            w,
            near + 0.03,
            far - 0.03,
            y + 0.55,
            y + 1.11,
            depth,
            tower ? colors.cream : colors.redWood,
          );
          if (level === 3 && !tower && i % 2 === 0)
            for (const x of [near + 0.21, far - 0.2])
              beam(
                out,
                'finish',
                w.p(x, y + 0.23, depth + 0.04),
                w.p(x, y + 1.18, depth + 0.04),
                0.08,
                0.09,
                colors.bronze,
              );
        }
      }
    }
  }
}

function lodge(out, level) {
  const floor = 0.22,
    eave = 7.55;
  const outline = cleaner(d.outline, level === 0 ? 1.02 : 0.12);
  mass(out, outline, 'concrete', -0.34, floor, colors.cream);
  mass(out, outline, 'cedar', floor, eave, colors.timber);
  cap(out, 'tin', outline, eave + 0.035, colors.deepCoral);
  const volumes = [
    [rect(-55.9, 109.3, 13.5, 70.9), eave, 8.43],
    [rect(-43.95, 73.8, 3.0, 36.3), eave + 0.45, 6.9],
    [rect(12.95, 109.3, 36.0, 67.08), eave - 0.8, 4.7],
    [rect(-70.2, 107.12, -53.9, 83.62), eave - 0.65, 3.23],
    [rect(-22.5, 121.0, 7.05, 109.5), eave - 0.24, 2.8],
  ];
  for (const [region, y, h] of volumes) gabled(out, region, y, h, colors.coral, level);
  balconies(out, outline, level, floor + 0.36, 2, 3.23);
  if (level > 1) {
    for (const [x, z, length] of [
      [-39, 36.77, 36],
      [-46, 71, 24],
      [35.44, 69, 35],
    ]) {
      for (let i = 0; i < 7; i++) {
        const p = x === 35.44 ? [x + 0.33, z + (length * i) / 7] : [x + (length * i) / 7, z - 0.29];
        beam(out, 'cedar', at(p, floor), at(p, 7.55), 0.4, 0.46, colors.redWood);
      }
    }
  }
}

function monorail(out, level) {
  const pad = cleaner(d.stationOutline, level === 0 ? 1 : 0.15);
  cap(out, 'concrete', pad, 0.1, colors.gray);
  const passengerRoof = rect(-20.2, 142.35, 38.65, 124.98);
  const porch = rect(0.74, 152.95, 19.13, 138.28);
  gabled(out, passengerRoof, 8.85, 4.1, colors.coral, level);
  gabled(out, porch, 5.5, 5.02, colors.thatch, level, { roofSlot: 'finish', edging: colors.cream });
  for (const [shape, h, barrier] of [
    [passengerRoof, 8.85, 5.0],
    [porch, 5.5, 0.12],
  ]) {
    const [x0, x1] = limits(shape, 0),
      [z0, z1] = limits(shape, 1);
    const step = level === 0 ? 1 : level === 1 ? 3 : 7;
    for (const z of [z0 + 0.62, z1 - 0.62])
      for (let i = 0; i <= step; i++) {
        const x = mix(x0 + 0.66, x1 - 0.66, i / step);
        beam(out, 'cedar', [x, barrier, z], [x, h, z], 0.52, 0.5, colors.redWood);
        if (level > 1 && i % 2 === 1) {
          const top = barrier < 1 ? h - 2.55 : h - 0.2;
          beam(out, 'finish', [x, top - 0.8, z], [x + 1.2, top, z], 0.16, 0.16, colors.timberLight);
          beam(
            out,
            'finish',
            [x + 1.2, top, z],
            [x + 2.18, top - 0.8, z],
            0.16,
            0.16,
            colors.bronze,
          );
        }
      }
  }
  if (level > 0) {
    for (const track of d.rails) {
      for (const [a, b] of pairs(track))
        beam(out, 'concrete', at(a, 6.55), at(b, 6.55), 0.98, 1.08, colors.cream);
      const support = track[1];
      beam(out, 'concrete', at(support, 0.05), at(support, 6.55), 0.8, 0.84, colors.gray);
    }
  }
}

function lowBuildings(out, level) {
  for (const item of [...d.longhouses, ...d.amenities]) {
    const polygon = cleaner(item.outline, level === 0 ? 0.96 : 0.085);
    const localY = Math.max(-0.12, grade(center(item.outline)));
    const amenity = item.id === 557550251 || item.id === 343064235;
    const storeys = amenity ? 1 : item.name === 'Niue' ? 2 : 3;
    const height = localY + 0.33 + storeys * 2.91;
    mass(out, polygon, 'cedar', localY - 0.33, height, colors.timber);
    const shortSide = Math.min(...[0, 1].map((i) => limits(polygon, i).reduce((a, b) => b - a)));
    gabled(
      out,
      polygon,
      height,
      Math.min(4.9, Math.max(1.85, shortSide * 0.195)),
      colors.coral,
      level === 1 ? 0 : level,
    );
    balconies(out, polygon, level, localY + 0.25, storeys, 2.84);
  }
}

function bungalows(out, level) {
  for (const item of d.bungalows) {
    const polygon = cleaner(item.outline, 0.09);
    const base = d.lagoon + 1.72,
      top = base + 2.95;
    const contour = level === 0 ? rectBounds(polygon) : polygon;
    mass(out, contour, 'cedar', base, top, colors.timberLight);
    gabled(out, contour, top, 2.65, colors.coral, level < 3 ? 0 : 1, { edging: colors.cream });
    if (level > 0) {
      const columns =
        level === 1 ? [center(contour)] : inset(contour, 0.13).filter((_, i) => i % 2 === 0);
      for (const p of columns)
        beam(out, 'cedar', at(p, d.lagoon - 0.48), at(p, base + 0.07), 0.32, 0.32, colors.darker);
      if (level > 1) {
        balconies(out, contour, level === 3 ? 2 : 1, base + 0.02, 1, 2.7);
        const [xl, xr] = limits(contour, 0),
          [zl] = limits(contour, 1);
        const deck = rect(xl - 0.33, zl + 0.24, xr + 0.23, zl - 2.5);
        cap(out, 'cedar', deck, base + 0.03, colors.deck);
        for (const [a, b] of pairs(closed(deck)))
          beam(out, 'finish', at(a, base + 0.94), at(b, base + 0.94), 0.102, 0.121, colors.redWood);
      }
    }
  }
  if (level > 0) {
    const top = d.lagoon + 1.52;
    for (const walk of d.boardwalks) {
      const boundary = cleaner(walk.outline, level === 1 ? 0.15 : 0.052);
      if (boundary.length < 3) continue;
      cap(out, 'cedar', boundary, top, colors.deck);
      if (level > 1)
        for (const p of boundary.filter((_, i) => i % 6 === 0))
          beam(out, 'cedar', at(p, d.lagoon - 0.52), at(p, top + 0.085), 0.24, 0.24, colors.darker);
    }
  }
}

function islandTower(out, level) {
  const outline = cleaner(d.towerOutline, level === 0 ? 2.15 : level === 1 ? 0.46 : 0.13);
  const floor = 0.21,
    height = 32.85;
  const lowerY = 7.0;
  if (level > 0) {
    mass(out, outline, 'plaster', floor, lowerY, colors.towerWing);
    cap(out, 'concrete', outline, lowerY, colors.cream);
  }
  const upper = inset(outline, 0.057);
  mass(out, upper, 'plaster', level === 0 ? floor : lowerY - 0.1, height, colors.tower);
  cap(out, 'concrete', upper, height, colors.gray);
  if (level > 0) {
    balconies(out, upper, level, lowerY - 0.17, d.towerStoreys - 2, 3.0, true);
    const rim = inset(upper, -0.014);
    mass(out, rim, 'finish', height - 0.34, height + 0.27, colors.cream);
    if (level > 1) {
      for (const [x, z] of [
        [-199, 76],
        [-206, 20],
        [-224, -29],
        [-252, -67],
      ]) {
        const roof = rect(x - 5, z + 4.6, x + 5, z - 3.9);
        mass(out, roof, 'plaster', height, height + 1.66, colors.towerWing);
        gabled(out, roof, height + 1.66, 1.74, colors.thatch, 1, { roofSlot: 'finish' });
      }
    }
  }
}

function poolside(out, level) {
  for (const { name, outline: shape } of d.pools) {
    const outline = cleaner(shape, level < 2 ? 0.43 : level === 2 ? 0.15 : 0.045);
    const water = Math.max(0.02, grade(center(outline)) + 0.27);
    cap(out, 'finish', outline, water, colors.pool);
    if (level > 1)
      for (const [a, b] of pairs(closed(outline)))
        if (distance(a, b) > 0.09)
          beam(out, 'concrete', at(a, water + 0.11), at(b, water + 0.11), 0.68, 0.24, colors.cream);
    if (name !== 'Lava Pool') continue;
    const peak = [-10.8, -19.2],
      n = [5, 8, 11, 13][level];
    const rings =
      level === 0
        ? [
            [0.08, 1],
            [6.4, 0.56],
            [9.5, 0.18],
          ]
        : [
            [0.08, 1],
            [1.7, 0.96],
            [4.2, 0.73],
            [7.8, 0.39],
            [9.5, 0.18],
          ];
    const ring = (a, j) => {
      const [y, s] = rings[j],
        angle = (2 * Math.PI * a) / n;
      const variation = 0.85 + ((a * 17 + j * 7) % 13) * 0.025;
      return [
        peak[0] + 6.95 * s * Math.cos(angle) * variation,
        water + y,
        peak[1] + 8.65 * s * Math.sin(angle) * variation,
      ];
    };
    for (let j = 0; j < rings.length - 1; j++)
      for (let a = 0; a < n; a++) {
        const b = (a + 1) % n;
        face(
          out,
          'stone',
          [ring(a, j), ring(b, j), ring(b, j + 1), ring(a, j + 1)],
          [Math.cos((2 * Math.PI * a) / n), 0.28, Math.sin((2 * Math.PI * a) / n)],
          a % 3 === 1 ? colors.lavaLight : colors.lava,
        );
      }
    if (level > 1)
      face(
        out,
        'finish',
        [
          [peak[0] + 3.5, water + 3.8, peak[1] - 0.73],
          [peak[0] + 3.5, water + 3.8, peak[1] + 0.77],
          [peak[0] + 6.5, water + 0.03, peak[1] + 1.29],
          [peak[0] + 6.5, water + 0.03, peak[1] - 1.04],
        ],
        [1, 0.7, 0],
        colors.foam,
      );
  }
}

function build(out, level) {
  lodge(out, level);
  monorail(out, level);
  lowBuildings(out, level);
  islandTower(out, level);
  bungalows(out, level);
  poolside(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'disney-s-polynesian-village-resort-model.mjs';
const camera = [-384, 325, -486],
  lookAt = [0, 8, -7];
const lods = { district: 1.35, street: 0.56, closeup: 0.17 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'The fixed model frame uses the mapped arrival, the mapped shore and the independent original Seven Seas Lagoon terrain.',
  brief:
    'Seven Seas Lagoon resort with red-roofed longhouses and a timber lodge, a covered monorail station, three linked hospitality areas and a stilt village of overwater bungalows.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-170, 260, -130],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.structureFootprints,
    minimumCoverage: 0.88,
    basis:
      'Distinct mapped resort footprints preserve the spaces between buildings and neighboring Disney facilities.',
  },
  embeddedCanonicalGraphs: [
    'wood_board_batten',
    'metal_standing_seam',
    'plaster_lime',
    'concrete_plain',
    'stone_basalt_raw',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'lakefront-and-resort-campus', position: [-335, 292, -403], lookAt: [5, 4, -6] },
    { name: 'ceremonial-lodge-and-arrival', position: [-72, 23, 204], lookAt: [0, 7, 96] },
    { name: 'lava-pool-and-resort-lodge', position: [-32, 15, -46], lookAt: [-5, 5, 50] },
    { name: 'overwater-bungalows', position: [221, 51, -214], lookAt: [203, 4, -115] },
    {
      name: 'island-tower-and-western-longhouses',
      position: [-376, 58, -142],
      lookAt: [-191, 15, 15],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'polynesian-resort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.15,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
