import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const outline = read('map-frame.json').geometry.outline;
const {
  groundBaseY: base,
  terraceY: terrace,
  churchFloorY: floor,
  aisleEavesY: aisleY,
  naveEavesY: naveY,
  naveRidgeY: navePeak,
  transeptEavesY: wingY,
  transeptRidgeY: wingPeak,
  campanileCenter: [towerX, towerZ],
  campanileWidth,
  campanileEavesY: towerY,
  campanilePeakY: towerPeak,
} = plan.dimensions;

const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.91 },
  cutStone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.85 },
  tiles: { slot: 'roof', graph: 'tile_glazed', roughness: 0.64, metallic: 0.08 },
  glazing: { slot: 'window', localRef: 'palette:#fff7ed', roughness: 0.44, metallic: 0.1 },
  fittings: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.71, metallic: 0.08 },
};
const c = {
  rubble: rgb('c6a378'),
  pink: rgb('bd9578'),
  dressed: rgb('d9bc94'),
  cream: rgb('d9c09d'),
  foundation: rgb('a98d6e'),
  roof: rgb('647e6c'),
  ridge: rgb('526d5c'),
  dusk: rgb('42362d'),
  glass: rgb('5b5559'),
  umber: rgb('674d37'),
  oak: rgb('72513c'),
  clock: rgb('d9c4a1'),
  copper: rgb('796445'),
};
const ref = 'palette:#ffffff';
const westX = outline[0][0];
const eastX = outline[6][0];
const naveZ = 0.405;
const centralWidth = 7.15;
const twoPi = Math.PI * 2;

function face(out, slot, a, b, d, e, color) {
  const points = [a, b, d, e];
  quad(out, slot, points, normalFor(...points), color);
}

function triangle(out, slot, points, direction, color) {
  const n = normalFor(...points);
  if (n.reduce((sum, value, index) => sum + value * direction[index], 0) < 0) points.reverse();
  out.addTriangle(
    slot,
    ref,
    points,
    normalFor(...points),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}

function deck(out, ring, y, slot, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => [ring[index][0], y, ring[index][1]]);
    triangle(out, slot, points, [0, 1, 0], color);
  }
}

function perimeter(out, y0, y1, slot, color) {
  const ring = [...outline].reverse();
  for (let i = 0; i < ring.length; ++i) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    face(out, slot, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], color);
  }
}

function roof(out, x0, x1, z0, z1, y, apex, turn = false, overhang = 0.18) {
  const p = (x, y, z) => (turn ? [z, y, x] : [x, y, z]);
  const mid = (z0 + z1) / 2;
  const near = [p(x0, y, z0), p(x0, apex, mid), p(x1, apex, mid), p(x1, y, z0)];
  const far = [p(x1, y, z1), p(x1, apex, mid), p(x0, apex, mid), p(x0, y, z1)];
  for (const side of [near, far]) {
    if (normalFor(...side)[1] < 0) side.reverse();
    face(out, 'tiles', ...side, c.roof);
  }
  const direction = turn ? [0, 0, 1] : [1, 0, 0];
  const start = x0 + overhang;
  const end = x1 - overhang;
  triangle(
    out,
    'masonry',
    [p(start, y, z0), p(start, y, z1), p(start, apex, mid)],
    direction.map((v) => -v),
    c.rubble,
  );
  triangle(out, 'masonry', [p(end, y, z0), p(end, y, z1), p(end, apex, mid)], direction, c.rubble);
  tube(out, 'tiles', p(x0, apex + 0.03, mid), p(x1, apex + 0.03, mid), 0.11, c.ridge, 5);
}

function leanTo(out, x0, x1, zLow, zHigh, yLow, yHigh) {
  const points = [
    [x0, yLow, zLow],
    [x0, yHigh, zHigh],
    [x1, yHigh, zHigh],
    [x1, yLow, zLow],
  ];
  if (normalFor(...points)[1] < 0) points.reverse();
  face(out, 'tiles', ...points, c.roof);
}

function wallsAndRoofs(out, detail) {
  perimeter(out, base, 1.64, 'cutStone', c.foundation);
  perimeter(out, 1.64, aisleY, 'masonry', c.rubble);
  deck(out, outline, aisleY, 'tiles', c.roof);
  const width = centralWidth / 2;
  const north = naveZ - width;
  const south = naveZ + width;
  box(out, 'masonry', [westX, floor, north], [eastX, naveY, south], c.rubble);
  roof(out, westX - 0.23, eastX + 0.23, north - 0.28, south + 0.28, naveY, navePeak, false, 0.23);
  const wings = [
    { x0: -6.0655, x1: 8.61, z0: -12.6664, z1: naveZ + 0.1 },
    { x0: -5.1718, x1: 10.1534, z0: naveZ - 0.1, z1: 12.0414 },
  ];
  for (const wing of wings) {
    const { x0, x1, z0, z1 } = wing;
    box(out, 'masonry', [x0, aisleY, z0], [x1, wingY, z1], c.pink);
    roof(out, z0 - 0.18, z1 + 0.18, x0 - 0.24, x1 + 0.24, wingY, wingPeak, true);
  }
  leanTo(out, westX - 0.2, -5.97, -4.6, north, aisleY, 7.36);
  leanTo(out, westX - 0.2, -5.1, 5.43, south, aisleY, 7.36);
  leanTo(out, 8.61, eastX + 0.2, -5.54, north, aisleY, 7.36);
  leanTo(out, 10.03, eastX + 0.2, 5.38, south, aisleY, 7.36);
  if (detail >= 1) {
    for (const [xa, xb, z] of [
      [westX, -6.3, -4.49],
      [westX, -5.4, 5.28],
      [8.95, eastX, -5.39],
      [10.38, eastX, 5.2],
    ])
      beam(out, 'cutStone', [xa, aisleY - 0.08, z], [xb, aisleY - 0.08, z], 0.13, 0.19, c.cream);
  }
}

function sectionPlane(origin, axis) {
  const [x, z] = origin;
  const [ux, uz] = axis;
  return (u, y, offset = 0) => [x + u * ux - offset * uz, y, z + u * uz + offset * ux];
}

function rectangularPanel(out, at, x0, x1, y0, y1, depth, slot, color) {
  face(
    out,
    slot,
    at(x0, y0, depth),
    at(x1, y0, depth),
    at(x1, y1, depth),
    at(x0, y1, depth),
    color,
  );
}

function fill(out, at, points, offset, slot, color) {
  const indices = earcut(points.flat());
  const normal = normalFor(at(0, 0), at(1, 0), at(1, 1));
  for (let i = 0; i < indices.length; i += 3)
    triangle(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => at(points[j][0], points[j][1], offset)),
      normal,
      color,
    );
}

function archProfile(center, bottom, half, spring, top, count, pointed) {
  const points = [
    [center - half, bottom],
    [center + half, bottom],
  ];
  for (let i = 0; i <= count; i++) {
    const angle = (Math.PI * i) / count;
    const u = Math.cos(angle);
    const arc = Math.abs(u) + 0.6;
    const height = pointed ? Math.sqrt(Math.max(0, (2.56 - arc * arc) / 2.2)) : Math.sin(angle);
    points.push([center + half * u, spring + (top - spring) * height]);
  }
  return points;
}

function arch(
  out,
  at,
  u,
  bottom,
  half,
  spring,
  top,
  width,
  count,
  color = c.glass,
  pointed = false,
) {
  const inner = archProfile(u, bottom, half, spring, top, count, pointed);
  const outer = archProfile(
    u,
    bottom - width * 0.6,
    half + width,
    spring,
    top + width,
    count,
    pointed,
  );
  fill(out, at, inner, 0.035, 'glazing', color);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    const [a, b, d, e] = [outer[i], outer[j], inner[j], inner[i]].map(([x, y]) => at(x, y, 0.09));
    face(out, 'cutStone', a, b, d, e, c.dressed);
  }
}

function circle(out, at, center, y, radius, ring, segments, detail, window = Boolean(ring)) {
  const outer = [],
    inner = [];
  const tone = ring ? c.dressed : c.clock;
  for (let i = 0; i < segments; i++) {
    const a = (twoPi * i) / segments;
    outer.push([center + radius * Math.cos(a), y + radius * Math.sin(a)]);
    inner.push([center + (radius - ring) * Math.cos(a), y + (radius - ring) * Math.sin(a)]);
  }
  fill(out, at, inner, 0.041, window ? 'glazing' : 'cutStone', window ? c.glass : c.clock);
  if (ring)
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const [a, b, d, e] = [inner[j], inner[i], outer[i], outer[j]].map(([x, y]) =>
        at(x, y, 0.085),
      );
      face(out, 'cutStone', a, b, d, e, tone);
    }
  if (ring && detail >= 2)
    for (let i = 0; i < 6; i++) {
      const angle = (twoPi * i) / 6;
      const length = radius - ring - 0.02;
      beam(
        out,
        'cutStone',
        at(center, y, 0.093),
        at(center + length * Math.cos(angle), y + length * Math.sin(angle), 0.093),
        Math.min(0.07, radius * 0.15),
        0.06,
        c.dressed,
      );
    }
}

function hood(out, at, u, y, width) {
  const a = at(u - width, y, 0.14);
  const b = at(u, y + 0.24, 0.17);
  const d = at(u + width, y, 0.14);
  beam(out, 'cutStone', a, b, 0.17, 0.27, c.cream);
  beam(out, 'cutStone', b, d, 0.17, 0.27, c.cream);
}

function westFront(out, detail) {
  const at = sectionPlane([westX - 0.012, naveZ], [0, 1]);
  const buttressHeight = 10.9;
  for (const z of [-3.51, 3.51]) {
    box(
      out,
      'cutStone',
      [westX - 0.57, floor, naveZ + z - 0.4],
      [westX + 0.44, buttressHeight, naveZ + z + 0.4],
      c.dressed,
    );
    box(
      out,
      'cutStone',
      [westX - 0.67, floor - 0.15, naveZ + z - 0.47],
      [westX + 0.52, floor + 0.41, naveZ + z + 0.47],
      c.foundation,
    );
    if (detail >= 2)
      for (let y = 2.74; y < 10.54; y += 0.74)
        box(
          out,
          'cutStone',
          [westX - 0.6, y, naveZ + z - 0.41],
          [westX - 0.55, y + 0.032, naveZ + z + 0.41],
          c.foundation,
        );
  }
  arch(out, at, 0, floor + 0.03, 1.12, 3.83, 5.47, 0.22, detail < 2 ? 8 : 14, c.dusk, true);
  rectangularPanel(out, at, -0.78, 0.78, floor + 0.05, 3.79, 0.11, 'fittings', c.oak);
  if (detail >= 1) {
    for (const u of [-0.61, -0.4, -0.18, 0, 0.18, 0.4, 0.61])
      rectangularPanel(out, at, u - 0.021, u + 0.021, floor + 0.1, 3.79, 0.14, 'fittings', c.umber);
    for (const u of [-0.27, 0.27])
      beam(out, 'fittings', at(u, 2.55, 0.155), at(u, 2.73, 0.155), 0.06, 0.065, c.copper);
    beam(out, 'cutStone', at(-3.05, 6.38, 0.14), at(3.05, 6.38, 0.14), 0.18, 0.19, c.cream);
  }
  for (const u of [-2.34, 2.34]) {
    arch(out, at, u, 4.02, 0.46, 4.23, 4.92, 0.11, detail < 2 ? 6 : 10);
    for (const offset of [-0.22, 0.22]) {
      arch(out, at, u + offset, 7.12, 0.15, 8.02, 8.31, 0.068, 6);
      if (detail >= 2) hood(out, at, u + offset, 8.34, 0.27);
    }
  }
  circle(out, at, 0, 10.78, 0.51, 0.1, detail === 0 ? 8 : 14, detail);
  for (let i = 0; i < 6; ++i) {
    const phi = (twoPi * i) / 6 + Math.PI / 6;
    circle(
      out,
      at,
      1.07 * Math.cos(phi),
      10.78 + 1.07 * Math.sin(phi),
      0.39,
      detail === 0 ? 0 : 0.085,
      detail < 2 ? 8 : 12,
      detail,
      true,
    );
  }
  box(out, 'cutStone', [westX - 3.65, base, -6.18], [westX + 0.025, terrace, 7.0], c.foundation);
  for (let i = 0; i < detail + 3; ++i) {
    const fraction = (i + 1) / (detail + 3);
    const x = westX - 1.71 + 1.72 * fraction;
    box(
      out,
      'cutStone',
      [x - 0.32, terrace, -1.8],
      [westX + 0.06, terrace + (floor - terrace) * fraction, 2.61],
      c.cream,
    );
  }
}

function naveAndTranseptLights(out, detail) {
  const light = (at, u, bottom, half, spring, top, trim, count) => {
    if (detail === 0)
      rectangularPanel(out, at, u - half, u + half, bottom, spring, 0.035, 'glazing', c.glass);
    else arch(out, at, u, bottom, half, spring, top, trim, count);
  };
  const bays = detail === 0 ? 3 : 5;
  for (const side of [-1, 1]) {
    const at = sectionPlane([0, naveZ + side * (centralWidth / 2 + 0.013)], [side, 0]);
    for (let i = 0; i < bays; i++) {
      const x = -29.65 + (i * 20.6) / (bays - 1);
      light(at, x * side, 7.68, 0.48, 9.16, 9.65, 0.085, detail < 2 ? 4 : 8);
      if (detail >= 2) hood(out, at, x * side, 9.72, 0.67);
    }
    const east = sectionPlane([0, naveZ + side * (centralWidth / 2 + 0.015)], [side, 0]);
    for (const x of [13.09, 17.9, 22.15])
      if (detail >= 1) arch(out, east, x * side, 7.6, 0.37, 9.05, 9.5, 0.075, 6);
  }
  for (const wing of [
    { z: -12.681, u: [-3.35, 1.3, 5.7], sign: -1 },
    { z: 12.054, u: [-2.58, 2.49, 7.35], sign: 1 },
  ]) {
    const at = sectionPlane([0, wing.z], [wing.sign, 0]);
    for (const x of wing.u)
      light(at, x * wing.sign, 5.54, 0.65, 7.72, 8.5, 0.15, detail < 2 ? 5 : 8);
    const u = wing.u[1] * wing.sign;
    if (detail >= 1) circle(out, at, u, 10.42, 0.62, 0.11, 12, detail);
  }
  const east = sectionPlane([eastX + 0.02, naveZ], [0, -1]);
  for (const z of [-1.65, 0, 1.65]) {
    light(east, z, 6.06, 0.56, 9.51, 10.19, 0.13, detail < 2 ? 6 : 10);
    if (detail >= 2) hood(out, east, z, 10.27, 0.75);
  }
}

function bellTower(out, detail) {
  const half = campanileWidth / 2;
  const l = towerX - half,
    r = towerX + half,
    n = towerZ - half,
    s = towerZ + half;
  const sill = 16.86;
  box(out, 'masonry', [l, base, n], [r, sill, s], c.pink);
  box(out, 'cutStone', [l - 0.09, 0.6, n - 0.09], [r + 0.09, 1.71, s + 0.09], c.foundation);
  box(
    out,
    'cutStone',
    [l - 0.07, sill - 0.18, n - 0.07],
    [r + 0.07, sill + 0.28, s + 0.07],
    c.dressed,
  );
  for (const x of [l, r - 0.64])
    for (const z of [n, s - 0.64]) {
      box(
        out,
        'cutStone',
        [x - 0.05, sill, z - 0.05],
        [x + 0.69, towerY + 0.35, z + 0.69],
        c.dressed,
      );
      box(
        out,
        'cutStone',
        [x - 0.115, towerY + 0.09, z - 0.115],
        [x + 0.76, towerY + 0.43, z + 0.76],
        c.cream,
      );
    }
  box(
    out,
    'cutStone',
    [l - 0.18, towerY - 0.38, n - 0.18],
    [r + 0.18, towerY + 0.06, s + 0.18],
    c.dressed,
  );
  const eaves = [
    [l - 0.27, towerY, n - 0.27],
    [r + 0.27, towerY, n - 0.27],
    [r + 0.27, towerY, s + 0.27],
    [l - 0.27, towerY, s + 0.27],
  ];
  for (let i = 0; i < 4; ++i)
    triangle(
      out,
      'tiles',
      [eaves[i], eaves[(i + 1) % 4], [towerX, towerPeak, towerZ]],
      [0, 1, 0],
      c.ridge,
    );
  const faces = [
    sectionPlane([l - 0.013, towerZ], [0, 1]),
    sectionPlane([r + 0.013, towerZ], [0, -1]),
    sectionPlane([towerX, n - 0.013], [-1, 0]),
    sectionPlane([towerX, s + 0.013], [1, 0]),
  ];
  for (const at of faces) {
    const clockY = 13.95;
    circle(out, at, 0, clockY, 0.99, 0, detail < 2 ? 12 : 24, detail);
    const ticks = 12;
    if (detail >= 1) {
      for (let i = 0; i < ticks; i++) {
        const a = (twoPi * i) / ticks;
        const [co, si] = [Math.cos(a), Math.sin(a)];
        beam(
          out,
          'fittings',
          at(0.73 * co, clockY + 0.73 * si, 0.06),
          at(0.89 * co, clockY + 0.89 * si, 0.06),
          0.055,
          0.055,
          c.umber,
        );
      }
    }
    beam(
      out,
      'fittings',
      at(0, clockY, 0.082),
      at(-0.25, clockY + 0.44, 0.082),
      0.05,
      0.052,
      c.dusk,
    );
    beam(out, 'fittings', at(0, clockY, 0.088), at(0.6, clockY - 0.18, 0.088), 0.04, 0.046, c.dusk);
    const mid = [-1.39, 0, 1.39];
    for (const u of mid) {
      rectangularPanel(
        out,
        at,
        u - 0.13,
        u + 0.13,
        sill + 0.08,
        towerY - 0.63,
        0.07,
        'cutStone',
        c.dressed,
      );
      if (detail >= 1) {
        beam(
          out,
          'cutStone',
          at(u - 0.64, towerY - 1.18, 0.115),
          at(u, towerY - 0.65, 0.115),
          0.18,
          0.19,
          c.dressed,
        );
        beam(
          out,
          'cutStone',
          at(u, towerY - 0.65, 0.115),
          at(u + 0.64, towerY - 1.18, 0.115),
          0.18,
          0.19,
          c.dressed,
        );
      }
    }
    arch(out, at, 0, 5.35, 0.55, 6.71, 7.32, 0.13, detail < 2 ? 6 : 9);
    if (detail >= 1) {
      arch(out, at, -0.34, 9.7, 0.2, 10.55, 10.86, 0.075, 6);
      arch(out, at, 0.34, 9.7, 0.2, 10.55, 10.86, 0.075, 6);
    }
    if (detail >= 2)
      for (const u of [-2.34, -0.7, 0.7, 2.34]) {
        rectangularPanel(
          out,
          at,
          u - 0.045,
          u + 0.045,
          sill + 0.45,
          sill + 1.38,
          0.14,
          'fittings',
          c.umber,
        );
      }
  }
  if (detail >= 1) {
    for (const [y, r0, r1] of [
      [17.12, 0.74, 0.55],
      [17.41, 0.55, 0.4],
      [17.75, 0.4, 0.31],
    ]) {
      const color = c.copper;
      const segments = detail === 1 ? 8 : 12;
      for (let i = 0; i < segments; ++i) {
        const a = (twoPi * i) / segments,
          b = (twoPi * (i + 1)) / segments;
        const p = (a, radius, h) => [
          towerX + radius * Math.cos(a),
          h,
          towerZ + radius * Math.sin(a),
        ];
        face(
          out,
          'fittings',
          p(b, r0, y),
          p(a, r0, y),
          p(a, r1, y + 0.32),
          p(b, r1, y + 0.32),
          color,
        );
      }
    }
  }
  box(out, 'masonry', [towerX - 1.48, base, 5.19], [towerX + 1.55, 5.65, n + 0.12], c.pink);
  roof(out, 5.09, n + 0.25, towerX - 1.61, towerX + 1.68, 5.65, 6.88, true);
  if (detail >= 1)
    arch(out, sectionPlane([towerX - 1.495, 7.83], [0, 1]), 0, 3.54, 0.35, 4.46, 4.85, 0.11, 6);
}

function draw(out, detail) {
  wallsAndRoofs(out, detail);
  westFront(out, detail);
  naveAndTranseptLights(out, detail);
  bellTower(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-66, 30, 62];
const lookAt = [-8, 8, 0];

export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: '2007-01-01',
    validUntil: '2008-01-01',
    currentWorldEligible: false,
  },
  brief:
    'The Republican Palace Museum occupies the former All Saints Cathedral in Khartoum. Its sandstone cruciform shell and glazed tile roofs flank a covered passage to the clock and bell tower.',
  camera,
  lookAt,
  sunDirection: [-58, 80, 44],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_ashlar', 'tile_glazed'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.87,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'west-portal-and-rose-lights',
      position: [-52, 6.45, 5.3],
      lookAt: [-30.35, 7.25, 2.05],
    },
    { name: 'clock-lantern-and-passage', position: [-46, 16, 37], lookAt: [-23.7, 11.9, 10.7] },
    { name: 'transepts-and-nave-roof', position: [-1, 41, 52], lookAt: [-1, 7, 1] },
    { name: 'east-end-and-north-aisle', position: [56, 22, -44], lookAt: [7, 7, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original exterior geometry informed by public-domain architectural plans and elevation, written period descriptions, and the mapped church footprint.',
};
