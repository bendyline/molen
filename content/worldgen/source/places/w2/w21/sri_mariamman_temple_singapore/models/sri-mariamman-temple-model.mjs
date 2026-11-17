/** Sri Mariamman Temple's South Bridge Road frontage and mapped Chinatown compound. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const { components, gate } = read('site-components');
const polygons = new Map(components.map(({ id, vertices }) => [id, vertices]));
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
  clay: { slot: 'roof', graph: 'clay_fired', roughness: 0.93, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  enamel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    cream: 'd8c9a5',
    ivory: 'e3d9bd',
    buff: 'b7a98a',
    stone: '867e6e',
    plaster: 'd5cba9',
    clay: 'a05f4e',
    red: 'a45a4e',
    redShade: '824f4c',
    jade: '579186',
    green: '73916a',
    aqua: '6fbcb5',
    ice: '8baeca',
    blue: '4f729e',
    rose: 'c67a79',
    gold: 'cfad65',
    peach: 'cea18a',
    brown: '774d3b',
    dark: '3d413e',
    bronze: '877155',
    grout: '9b917d',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const dress = [c.rose, c.gold, c.aqua, c.blue, c.green, c.ivory];
const skins = [c.peach, c.ivory, c.ice, c.gold];
const mix = (a, b, t) => a + (b - a) * t;
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = mix(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = mix(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return mix(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function center(poly) {
  return poly.reduce(([x, z], p) => [x + p[0] / poly.length, z + p[1] / poly.length], [0, 0]);
}

function signedArea(poly) {
  return (
    poly.reduce((sum, [x, z], i) => {
      const [u, v] = poly[(i + 1) % poly.length];
      return sum + x * v - z * u;
    }, 0) / 2
  );
}

function outsideFrame(out, polygon, a, b) {
  const [from, to] = signedArea(polygon) < 0 ? [a, b] : [b, a];
  return transform(out, Math.atan2(from[1] - to[1], to[0] - from[0]), [from[0], 0, from[1]]);
}

function polygonShell(out, poly, floor, cap, slot, color, underside = false) {
  const loop = signedArea(poly) > 0 ? poly.slice().reverse() : poly;
  const at = ([x, z], y) => [x, typeof y === 'function' ? y(x, z) : y, z];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    face(out, slot, [at(a, floor), at(b, floor), at(b, cap), at(a, cap)], color);
  }
  const tris = earcut(loop.flat());
  for (let i = 0; i < tris.length; i += 3) {
    const a = loop[tris[i]],
      b = loop[tris[i + 1]],
      d = loop[tris[i + 2]];
    triangle(out, slot, [at(d, cap), at(b, cap), at(a, cap)], color);
    if (underside) triangle(out, slot, [at(a, floor), at(b, floor), at(d, floor)], color);
  }
}

function balancedRoof(out, localBounds, y, rise, slot = 'clay', tint = c.clay) {
  const [x0, x1, z0, z1] = localBounds;
  const x = (x0 + x1) / 2;
  const ridge = (x1 - x0) * 0.22;
  const a = [x, y + rise, z0 + ridge],
    b = [x, y + rise, z1 - ridge];
  face(out, slot, [[x0, y, z0], [x0, y, z1], b, a], tint);
  face(out, slot, [[x1, y, z1], [x1, y, z0], a, b], tint);
  triangle(out, slot, [[x1, y, z0], [x0, y, z0], a], tint);
  triangle(out, slot, [[x0, y, z1], [x1, y, z1], b], tint);
}

function enclosure(out, path, lod, street = false) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const wall = transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
    const count = Math.ceil(run / 6);
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count;
      const y = street
        ? Math.min(0.1, grade(mix(a[0], b[0], t), mix(a[1], b[1], t)))
        : grade(mix(a[0], b[0], t), mix(a[1], b[1], t));
      const x0 = (j * run) / count,
        x1 = ((j + 1) * run) / count;
      box(wall, 'wall', [x0, y - 0.7, -0.17], [x1, y + 1.99, 0.17], c.ivory);
      box(wall, 'enamel', [x0, y + 1.99, -0.23], [x1, y + 2.14, 0.23], c.buff);
      if (lod === 3 && count > 2 && j % 2 === 1) cattle(wall, (x0 + x1) / 2, y + 2.16, 0, 0.6, lod);
    }
  }
}

function cattle(out, x, y, z, scale, lod) {
  const stretch = (dx, dy, dz) => [x + dx * scale, y + dy * scale, z + dz * scale];
  const sides = lod === 3 ? 7 : 5;
  sphere(
    out,
    'enamel',
    stretch(0, 0.38, 0),
    [0.51 * scale, 0.23 * scale, 0.19 * scale],
    c.ivory,
    sides,
    4,
  );
  beam(
    out,
    'enamel',
    stretch(0.29, 0.47, 0),
    stretch(0.48, 0.66, 0),
    scale * 0.23,
    scale * 0.24,
    c.ivory,
  );
  sphere(
    out,
    'enamel',
    stretch(0.57, 0.63, 0),
    [0.19 * scale, 0.13 * scale, 0.12 * scale],
    c.ivory,
    sides,
    3,
  );
  for (const dx of [-0.33, 0.32])
    for (const dz of [-0.105, 0.105])
      beam(
        out,
        'enamel',
        stretch(dx, 0.34, dz),
        stretch(dx - 0.05, 0, dz),
        scale * 0.081,
        scale * 0.079,
        c.ivory,
      );
  for (const dz of [-0.075, 0.075])
    beam(
      out,
      'enamel',
      stretch(0.49, 0.69, dz),
      stretch(0.48, 0.85, dz * 1.38),
      scale * 0.04,
      scale * 0.039,
      c.buff,
    );
}

function moulding(out, x, y, z, width, depth, height, color) {
  box(
    out,
    'enamel',
    [x - width / 2, y, z - depth / 2],
    [x + width / 2, y + height, z + depth / 2],
    color,
  );
}

/** The relief figures follow the reference's group rhythm. Their identities are left unspecified. */
function figure(out, x, y, z, h, index, lod, seated = false) {
  if (lod <= 1) {
    face(
      out,
      'enamel',
      [
        [x - 0.15 * h, y, z],
        [x + 0.15 * h, y, z],
        [x + 0.12 * h, y + h * 0.66, z],
        [x - 0.12 * h, y + h * 0.66, z],
      ],
      dress[index % dress.length],
    );
    face(
      out,
      'enamel',
      [
        [x - 0.086 * h, y + h * 0.66, z],
        [x + 0.086 * h, y + h * 0.66, z],
        [x + 0.065 * h, y + h * 0.97, z],
        [x - 0.065 * h, y + h * 0.97, z],
      ],
      c.gold,
    );
    return;
  }
  const robe = dress[index % dress.length];
  const skin = skins[index % skins.length];
  const sides = lod === 3 ? 8 : lod === 2 ? 6 : 4;
  const radius = seated ? 0.25 : 0.15;
  const ring = (height, rx, rz) => radialRing(y + height * h, rx * h, rz * h, sides, [x, z]);
  loft(
    out,
    'enamel',
    [ring(0, radius, 0.129), ring(0.38, 0.11, 0.104), ring(0.66, 0.17, 0.107)],
    robe,
    { cap: false },
  );
  sphere(
    out,
    'enamel',
    [x, y + h * 0.77, z + h * 0.014],
    [h * 0.097, h * 0.116, h * 0.085],
    skin,
    sides,
    lod === 3 ? 5 : 3,
  );
  loft(out, 'enamel', [ring(0.84, 0.104, 0.083), ring(1, 0.044, 0.036)], c.gold);
  if (lod < 3) return;
  for (const s of [-1, 1]) {
    const shoulder = [x + s * h * 0.124, y + h * 0.63, z];
    const elbow = [x + s * h * 0.235, y + h * (seated ? 0.36 : 0.51), z + 0.047];
    const palm = [
      x + s * h * (index % 3 === 0 ? 0.1 : 0.275),
      y + h * (index % 2 ? 0.71 : 0.38),
      z + 0.08,
    ];
    beam(out, 'enamel', shoulder, elbow, h * 0.073, h * 0.067, skin);
    beam(out, 'enamel', elbow, palm, h * 0.063, h * 0.058, skin);
  }
}

function semicircle(out, x, y, z, rx, ry, thick, color, lod, pane = false) {
  const steps = lod === 3 ? 14 : lod === 2 ? 6 : 5;
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    const at = (t, offset) => [x + (rx + offset) * Math.cos(t), y + (ry + offset) * Math.sin(t), z];
    face(out, 'enamel', [at(a, thick), at(b, thick), at(b, 0), at(a, 0)], color);
    if (pane) triangle(out, 'enamel', [[x, y, z - 0.01], at(a, 0), at(b, 0)], c.dark);
  }
}

function barrel(out, x, y, z, halfW, halfD, rise, color, lod) {
  const steps = lod < 2 ? 7 : 14;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i * Math.PI) / steps;
    return [y + rise * Math.sin(a), z + halfD * Math.cos(a)];
  });
  for (let i = 0; i < steps; i++) {
    const [a, q] = points[i],
      [b, r] = points[i + 1];
    face(
      out,
      'enamel',
      [
        [x - halfW, a, q],
        [x + halfW, a, q],
        [x + halfW, b, r],
        [x - halfW, b, r],
      ],
      color,
    );
    triangle(
      out,
      'enamel',
      [
        [x + halfW, y, z],
        [x + halfW, a, q],
        [x + halfW, b, r],
      ],
      c.gold,
    );
    triangle(
      out,
      'enamel',
      [
        [x - halfW, y, z],
        [x - halfW, b, r],
        [x - halfW, a, q],
      ],
      c.gold,
    );
  }
}

function gateTier(out, y, top, halfW, halfD, n, lod) {
  const span = top - y;
  moulding(out, 0, y, 0, 2 * halfW + 0.23, 2 * halfD + 0.17, 0.1, c.ivory);
  moulding(
    out,
    0,
    y + 0.1,
    0,
    2 * halfW + 0.1,
    2 * halfD + 0.07,
    0.09,
    dress[(n + 2) % dress.length],
  );
  box(
    out,
    'enamel',
    [-halfW + 0.13, y + 0.19, -halfD + 0.14],
    [halfW - 0.13, top, halfD - 0.14],
    c.buff,
  );
  for (const orientation of [0, Math.PI]) {
    const facade = transform(out, orientation);
    const z = halfD - 0.09;
    const door = halfW * 0.175;
    box(facade, 'enamel', [-door, y + 0.25, z - 0.08], [door, top - 0.12, z], c.dark);
    for (const s of [-1, 1]) {
      moulding(facade, s * (door + 0.045), y + 0.2, z, 0.09, 0.19, span - 0.28, c.ivory);
      if (lod === 0 && orientation !== 0) continue;
      const count = lod === 1 || (lod === 2 && orientation !== 0) ? 1 : lod === 3 && n < 3 ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const x = s * mix(door + 0.14, halfW - 0.19, (i + 0.49) / count);
        const h = span * (i % 2 ? 0.55 : 0.7);
        if (lod >= 2 && i % 2 === 0)
          semicircle(
            facade,
            x,
            y + 0.28 + h * 0.4,
            z + 0.03,
            0.16,
            h * 0.42,
            0.045,
            c.jade,
            lod,
            true,
          );
        figure(facade, x, y + 0.2, z + 0.135, h, n * 3 + i + (s > 0 ? 2 : 0), lod, i % 2 === 1);
      }
    }
    if (lod >= 2) {
      const mark = top - 0.16;
      const segments = lod === 3 ? 13 - n : 7 - n;
      for (let i = 0; i < segments; i++)
        moulding(
          facade,
          mix(-halfW + 0.12, halfW - 0.12, (i + 0.5) / segments),
          mark,
          halfD + 0.018,
          0.065,
          0.09,
          0.095,
          i % 3 ? c.ivory : c.red,
        );
    }
  }
  if (lod === 3)
    for (const orientation of [-Math.PI / 2, Math.PI / 2]) {
      const side = transform(out, orientation);
      for (const d of [-1, 1])
        figure(
          side,
          d * halfD * 0.49,
          y + 0.19,
          halfW - 0.01,
          span * 0.65,
          n + (d > 0 ? 1 : 0),
          lod,
        );
    }
}

function frontage(out, lod, width, depth) {
  const front = depth / 2;
  const opening = 1.05;
  for (const s of [-1, 1]) {
    const x = s * (width / 4 + opening / 2);
    moulding(out, x, -0.38, 0, width / 2 - opening, depth, 4.28, c.cream);
    for (const [y, w, d, h, color] of [
      [-0.48, 1.65, 2.79, 0.78, c.stone],
      [0.3, 1.46, 2.73, 0.16, c.buff],
      [0.46, 1.36, 2.62, 0.22, c.ivory],
      [3.47, 1.27, 2.7, 0.25, c.buff],
    ])
      moulding(out, x, y, 0, w, d, h, color);
    if (lod >= 2) {
      for (let i = 1; i < 9; i++) {
        const y = 0.63 + i * 0.329;
        moulding(out, x, y, front + 0.006, 1.19, 0.026, 0.014, c.grout);
        const offset = i % 2 ? -0.25 : 0.25;
        moulding(out, x + offset, y - 0.32, front + 0.007, 0.012, 0.03, 0.32, c.grout);
      }
    }
    const centerX = s * (opening / 2 - 0.02);
    box(
      out,
      'timber',
      [centerX - 0.505, 0.05, front - 0.19],
      [centerX + 0.505, 3.28, front - 0.09],
      c.brown,
    );
    if (lod >= 1) {
      for (const side of [-1, 1])
        moulding(out, centerX + side * 0.47, 0.07, front - 0.06, 0.064, 0.075, 3.18, c.bronze);
      for (let i = 0; i < (lod === 1 ? 5 : 10); i++) {
        const y = 0.24 + (lod === 1 ? 0.609 : 0.299) * i;
        for (const dx of lod === 1 ? [0] : [-0.297, 0, 0.297]) {
          const plateX = centerX + dx;
          moulding(out, plateX, y - 0.106, front - 0.063, 0.224, 0.041, 0.212, c.bronze);
          moulding(out, plateX, y - 0.09, front - 0.04, 0.183, 0.036, 0.18, c.brown);
          if (lod === 3)
            sphere(out, 'enamel', [plateX, y, front - 0.006], [0.046, 0.045, 0.032], c.gold, 6, 3);
        }
      }
    }
  }
  box(out, 'stone', [-1.22, -0.26, front - 0.33], [1.22, 0.06, front + 0.37], c.stone);
  moulding(out, 0, 3.27, 0, 2.26, depth - 0.05, 0.48, c.cream);
  moulding(out, 0, 3.72, 0, width + 0.12, depth + 0.19, 0.17, c.ivory);
  moulding(out, 0, 3.89, 0, width + 0.43, depth + 0.38, 0.14, c.buff);
  moulding(out, 0, 4.03, 0, width + 0.31, depth + 0.29, 0.13, c.ivory);
}

function lowerStreetWing(out, lod, side, front) {
  const outer = side < 0 ? 7.06 : 4.51;
  const inner = 2.25;
  const x = (side * (outer + inner)) / 2;
  const w = outer - inner;
  const z = front - 0.22;
  box(out, 'wall', [x - w / 2, -1.7, z - 0.31], [x + w / 2, 2.64, z], c.ivory);
  for (const [y, rise, over, tint] of [
    [0.0, 0.17, 0.05, c.buff],
    [2.38, 0.2, 0.1, c.buff],
    [2.73, 0.15, 0.13, c.ivory],
    [2.87, 0.13, 0.08, c.redShade],
    [3.0, 0.17, 0, c.cream],
  ])
    moulding(out, x, y, z - 0.15, w + 0.04, 0.42 + over, rise, tint);
  const wx = side * 3.12;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8;
    const at = (angle, r) => [wx + r * Math.cos(angle), 1.31 + r * Math.sin(angle), z + 0.019];
    triangle(out, 'enamel', [[wx, 1.31, z + 0.017], at(a, 0.265), at(b, 0.265)], c.dark);
    face(out, 'enamel', [at(a, 0.313), at(b, 0.313), at(b, 0.265), at(a, 0.265)], c.buff);
  }
  if (lod >= 2)
    for (const d of [-0.18, -0.09, 0, 0.09, 0.18]) {
      const r = Math.sqrt(0.253 * 0.253 - d * d);
      moulding(out, wx + d, 1.31 - r, z + 0.029, 0.021, 0.022, 2 * r, c.bronze);
      moulding(out, wx, 1.31 + d - 0.009, z + 0.028, 2 * r, 0.024, 0.02, c.bronze);
    }
  semicircle(out, wx, 3.46, z + 0.035, 0.52, 0.69, 0.089, c.rose, lod, true);
  moulding(out, wx, 3.14, z, 1.13, 0.38, 0.23, c.buff);
  figure(out, wx, 3.29, z + 0.13, 0.8, side < 0 ? 4 : 2, lod, true);
  if (lod >= 2) cattle(out, side * 4.25, 3.18, z + 0.04, 0.47, lod);
}

function skylineTower(out, width, depth) {
  const ring = (y, w, d) => [
    [-w, y, d],
    [w, y, d],
    [w, y, -d],
    [-w, y, -d],
  ];
  moulding(out, 0, -0.38, 0, width, depth, 4.54, c.cream);
  moulding(out, 0, 3.91, 0, width + 0.45, depth + 0.39, 0.25, c.ivory);
  box(out, 'timber', [-1.02, 0.05, depth / 2 - 0.08], [1.02, 3.31, depth / 2 + 0.03], c.brown);
  for (let i = 0; i < 5; i++) {
    const y = levels[i];
    const w = width / 2 - 0.235 * i,
      d = depth / 2 - 0.15 * i;
    moulding(out, 0, y, 0, 2 * w + 0.2, 2 * d + 0.17, 0.14, dress[i]);
    loft(out, 'enamel', [ring(y + 0.14, w, d), ring(levels[i + 1], w - 0.196, d - 0.124)], c.buff, {
      cap: false,
    });
    for (const side of [-1, 1])
      figure(out, side * w * 0.55, y + 0.14, d, (levels[i + 1] - y) * 0.72, i, 0);
  }
  for (const side of [-1, 1])
    moulding(out, side * 4.29, -0.95, depth / 2 - 0.21, 4.35, 0.42, 4.05, c.ivory);
  barrel(out, 0, 9, 0, 1.15, 0.537, 0.4, c.jade, 0);
}

const levels = [4.16, 5.38, 6.46, 7.44, 8.2, 8.9];

function gopuram(out, lod) {
  const { gopuramWidth: width, gopuramDepth: depth, gopuramHeight } = plan.dimensions;
  const [a, , , d] = polygons.get(692228319);
  const angle = Math.atan2(d[1] - a[1], a[0] - d[0]);
  const local = transform(out, angle, [
    gate[0] - (Math.sin(angle) * depth) / 2,
    0,
    gate[1] - (Math.cos(angle) * depth) / 2,
  ]);
  if (lod === 0) {
    skylineTower(local, width, depth);
    return;
  }
  frontage(local, lod, width, depth);
  for (const side of [-1, 1]) lowerStreetWing(local, lod, side, depth / 2);
  for (let i = 0; i < 5; i++)
    gateTier(local, levels[i], levels[i + 1], width / 2 - 0.235 * i, depth / 2 - 0.15 * i, i, lod);
  const capW = 1.15,
    capD = 0.537;
  moulding(local, 0, 8.9, 0, capW * 2 + 0.15, capD * 2 + 0.19, 0.1, c.ivory);
  barrel(local, 0, 9.0, 0, capW, capD, 0.4, c.jade, lod);
  const pins = lod < 2 ? [-0.95, 0, 0.95] : [-1.02, -0.62, 0, 0.62, 1.02];
  for (const x of pins)
    sphere(
      local,
      'enamel',
      [x, gopuramHeight - 0.14 - Math.abs(x) * 0.068, 0],
      [0.095, 0.14, 0.085],
      c.gold,
      7,
      4,
    );
  for (const a of [0, Math.PI]) {
    const f = transform(local, a);
    semicircle(f, 0, 9.19, capD + 0.035, 0.3, 0.35, 0.073, c.gold, lod, true);
    if (lod >= 2) figure(f, 0, 9.06, capD + 0.1, 0.47, 3, lod, true);
  }
}

function vimanam(out, polygon, height, n, lod) {
  const [x, z] = center(polygon);
  const r = polygon.reduce((sum, p) => sum + Math.hypot(p[0] - x, p[1] - z), 0) / polygon.length;
  const y = Math.max(0.45, grade(x, z) + 0.22);
  const sides = [6, 7, 12, 18][lod];
  if (lod === 0) {
    loft(
      out,
      'wall',
      [radialRing(y - 1.1, r, r, 6, [x, z]), radialRing(y + 2.86, r, r, 6, [x, z])],
      c.cream,
    );
    loft(
      out,
      'enamel',
      [
        ringAt(2.86, 0.95),
        ringAt(3.24, 0.8),
        ringAt(3.24 + height * 0.76, 0.31),
        ringAt(3.74 + height * 0.76, 0.13),
      ],
      dress[n + 1],
    );
    return;
  }
  function ringAt(h, rScale) {
    return radialRing(y + h, r * rScale, r * rScale, 6, [x, z]);
  }
  polygonShell(out, polygon, (x, z) => grade(x, z) - 0.2, y + 2.82, 'wall', c.cream);
  const ring = (dy, rr) => radialRing(y + dy, r * rr, r * rr, sides, [x, z]);
  loft(out, 'enamel', [ring(2.8, 1), ring(3.02, 1), ring(3.15, 0.83)], c.buff);
  for (let i = 0; i < 3; i++) {
    const h = 3.1 + i * height * 0.255;
    const rr = 0.83 - 0.19 * i;
    loft(
      out,
      'enamel',
      [ring(h, rr), ring(h + 0.16, rr + 0.036), ring(h + height * 0.31, rr - 0.19)],
      dress[(n + i + 2) % dress.length],
    );
    if (lod >= 2)
      for (const a of lod === 3 ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5] : [0, Math.PI])
        figure(
          transform(out, a, [x, 0, z]),
          0,
          y + h + 0.11,
          r * rr * 0.95,
          height * 0.23,
          n + i,
          lod,
          true,
        );
  }
  const start = 3.1 + height * 0.76;
  loft(
    out,
    'enamel',
    [ring(start, 0.37), ring(start + 0.26, 0.35), ring(start + 0.58, 0.08)],
    c.jade,
  );
  sphere(out, 'enamel', [x, y + start + 0.62, z], [0.125, 0.187, 0.125], c.gold, sides, 4);
}

function clippedOutline(poly, limit) {
  const clipped = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (a[1] < limit) clipped.push(a);
    if (a[1] < limit !== b[1] < limit)
      clipped.push([mix(a[0], b[0], (limit - a[1]) / (b[1] - a[1])), limit]);
  }
  return clipped;
}

function hallBay(out, x, y, width, lod) {
  const z = 0.055;
  box(out, 'timber', [x - width, y + 0.12, z - 0.09], [x + width, y + 1.74, z], c.dark);
  for (const s of [-1, 1]) {
    moulding(out, x + s * (width + 0.11), y, z, 0.2, 0.23, 2.41, c.buff);
    semicircle(
      out,
      x + s * width * 0.58,
      y + 1.74,
      z + 0.012,
      width * 0.41,
      0.31,
      0.067,
      c.ivory,
      lod,
      true,
    );
  }
  semicircle(out, x, y + 1.86, z + 0.02, width * 0.36, 0.47, 0.073, c.ivory, lod, true);
}

function mandapam(out, lod) {
  const shell = clippedOutline(polygons.get(300380459), 18.85);
  if (lod === 0) {
    box(out, 'wall', [-12.5, -0.8, -15.2], [8.37, 4.14, 18.8], c.plaster);
    balancedRoof(out, [-12.5, 8.37, -15.2, 18.8], 4.14, 1.81);
    return;
  }
  const floor = (x, z) => grade(x, z) - 0.36;
  polygonShell(out, shell, floor, 4.12, 'wall', c.plaster);
  polygonShell(out, shell, 3.98, 4.27, 'clay', c.redShade, true);
  balancedRoof(out, [-10.75, 1.25, -13.25, 18.98], 4.17, 1.95);
  balancedRoof(transform(out, Math.PI / 2, [-1.2, 0, -10.1]), [-2.6, 2.6, -9.15, 6.55], 4.16, 1.52);
  box(out, 'stone', [-8.92, -0.55, 18.86], [-0.19, 0.16, 22.96], c.buff);
  const porch = transform(out, 0, [-4.3, 0, 20.05]);
  balancedRoof(porch, [-2.98, 2.98, -1.28, 2.26], 3.12, 0.69);
  for (const x of [-2.68, 2.68])
    for (const z of [-0.73, 1.92]) moulding(porch, x, -0.29, z, 0.32, 0.32, 3.47, c.ivory);
  if (lod < 2) return;
  // Repeat the trefoil openings only along walls surrounding the standing main hall.
  for (let i = 0; i < shell.length; i++) {
    const a = shell[i],
      b = shell[(i + 1) % shell.length];
    const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (run < 5.3 || Math.max(a[1], b[1]) < -12.6) continue;
    const wall = outsideFrame(out, shell, a, b);
    const count = Math.floor(run / (lod === 3 ? 3.4 : 5));
    for (let k = 0; k < count; k++) hallBay(wall, ((k + 0.5) * run) / count, 0.77, 0.63, lod);
  }
}

function serviceRange(out, id, height, lod) {
  const poly = polygons.get(id);
  const [x, z] = center(poly);
  const y = Math.max(grade(x, z) + height, ...poly.map(([px, pz]) => grade(px, pz) + 0.82));
  const roof = y + (id === 47298566 ? 0.8 : 0.43);
  polygonShell(out, poly, (x, z) => grade(x, z) - 0.4, y, 'wall', c.plaster);
  polygonShell(out, poly, y - 0.05, roof, 'clay', id === 47298566 ? c.red : c.clay);
  if (lod < 2) return;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.floor(length / 4.6);
    if (!count) continue;
    const facade = outsideFrame(out, poly, a, b);
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * length) / count;
      moulding(facade, x, y - 1.74, 0.025, 1.61, 0.084, 0.99, c.buff);
      moulding(facade, x, y - 1.65, 0.068, 1.43, 0.044, 0.83, c.dark);
      if (lod === 3) moulding(facade, x, y - 1.66, 0.097, 0.071, 0.035, 0.85, c.stone);
    }
  }
}

function build(out, lod) {
  gopuram(out, lod);
  mandapam(out, lod);
  for (const [id, height] of [
    [47298566, 7.8],
    [692228306, 3.2],
    [692228327, 3.3],
    [692228328, 4.1],
    [692228329, 3.4],
  ])
    serviceRange(out, id, height, lod);
  const shrines = [
    [692228313, 3.25],
    [692228316, 2.74],
    [692228322, 2.54],
    [692228325, 2.79],
  ];
  for (const [n, [id, height]] of shrines.entries()) vimanam(out, polygons.get(id), height, n, lod);
  if (lod >= 1) vimanam(out, polygons.get(692228330), 1.97, 2, lod);
  if (lod >= 2) {
    enclosure(out, polygons.get(692228309).slice(0, -1), lod);
    enclosure(out, polygons.get(692228311), lod, true);
  }
}

export const sriMariammanSkyline = (out) => build(out, 0);
export const sriMariammanDistrict = (out) => build(out, 1);
export const sriMariammanStreet = (out) => build(out, 2);
export const sriMariammanCloseup = (out) => build(out, 3);

const recipe = 'sri-mariamman-temple-model.mjs';
const camera = [27, 28, 69],
  lookAt = [-8, 3.2, -4];
const near = [-3.54, 3.6, 40.4],
  towerFocus = [-4.55, 4.63, 23.9];
const outlines = [300380459, 47298566, 692228306, 692228327, 692228328, 692228329].map((id) =>
  polygons.get(id),
);

export const sriMariammanModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: sriMariammanCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: outlines[0],
    outlines,
    minimumCoverage: 0.91,
    basis:
      'Individually traced historic temple and service roofs. Public street and courtyards remain outside the building outlines.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The temple’s sculpted five-tier gateway and carved wooden entrance face South Bridge Road. Four temple shrines, tiled roofs and a walled compound stand behind the gate.',
  camera,
  lookAt,
  sunDirection: [-11, 24, 23],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.64,
    cameraYaw: 0.06,
    focus: { center: [-7, 2.4, -6] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'five-tier-gopuram-and-round-grilles', position: near, lookAt: towerFocus },
    {
      name: 'gopuram-piers-and-carved-timber-doors',
      position: [-12.2, 4.65, 36.3],
      lookAt: [-4.2, 4.1, 23.9],
    },
    {
      name: 'compound-roofs-and-western-shrines',
      position: [34, 39, -30],
      lookAt: [-9.2, 2.66, 1.9],
    },
    {
      name: 'west-court-and-shrine-silhouettes',
      position: [-28, 13, -27],
      lookAt: [-6.6, 4.3, -13.4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gateway-' + reviewLod,
    position: near,
    lookAt: towerFocus,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'sriMariammanSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'sriMariammanDistrict', 0.59],
        ['street', 'sriMariammanStreet', 0.21],
        ['closeup', 'sriMariammanCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by the public-domain Simon Fieldhouse drawing. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
