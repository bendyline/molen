/** The standing cathedral on Plaza León Alvarado, Comayagua. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const outline = read('map-frame').geometry.outline;
const {
  foundation,
  plazaThreshold,
  church,
  aisleDividers,
  wallTop,
  aisleCrown,
  naveSpring,
  naveCrown,
  frontCenter,
  frontTop,
  tower,
  towerStageTops,
  towerDomeCrown,
  chapterRange,
  sacristy,
  chapel,
  courtGate,
  courtyardRim,
} = plan.section;

const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.82, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.73, metallic: 0.19 },
  shade: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};

const tones = Object.fromEntries(
  Object.entries({
    lime: 'dfd5b6',
    stone: 'ece4cc',
    plaster: 'e9e2cd',
    step: 'a09277',
    roof: 'b4a38a',
    green: '6c7961',
    moss: '7d8668',
    amber: 'aa9560',
    wood: '514338',
    grain: '806148',
    metal: '786947',
    gold: 'c1a371',
    shade: '383431',
    recess: 'a3987c',
    stripe: 'c9b995',
    black: '2d2d29',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function face(out, material, vertices, toward, color = tones[material]) {
  let points = vertices;
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, material, points, normal, color);
  else
    out.addTriangle(
      material,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function block(out, material, [x0, x1, z0, z1], low, high, color = tones[material]) {
  box(out, material, [x0, low, z0], [x1, high, z1], color);
}

function expand([x0, x1, z0, z1], distance) {
  return [x0 - distance, x1 + distance, z0 - distance, z1 + distance];
}

function facadeFrame(x, z, dx, dz) {
  return {
    at: (u, y, depth = 0) => [x + dx * u - dz * depth, y, z + dz * u + dx * depth],
    forward: [-dz, 0, dx],
  };
}

function panel(out, material, frame, left, right, low, high, depth = 0, color = tones[material]) {
  if (right - left < 0.001 || high - low < 0.001) return;
  face(
    out,
    material,
    [
      frame.at(left, low, depth),
      frame.at(right, low, depth),
      frame.at(right, high, depth),
      frame.at(left, high, depth),
    ],
    frame.forward,
    color,
  );
}

function reliefBlock(out, material, frame, left, right, low, high, depth, color = tones[material]) {
  const a = frame.at(left, low, -0.07);
  const b = frame.at(right, high, depth);
  block(
    out,
    material,
    [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2])],
    low,
    high,
    color,
  );
}

function archCurve(center, width, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const theta = Math.PI * (1 - i / segments);
    const height = i === 0 || i === segments ? spring : spring + rise * Math.sin(theta);
    return [center + 0.5 * width * Math.cos(theta), height];
  });
}

function doorFace(out, frame, { u, w, bottom, spring, rise }, lod) {
  const depth = 0.022;
  panel(out, 'wood', frame, u - w / 2, u + w / 2, bottom, spring, depth);
  const curve = archCurve(u, w, spring, rise, lod === 3 ? 12 : 8);
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = curve[i - 1];
    const [c, d] = curve[i];
    face(
      out,
      'wood',
      [frame.at(u, spring, depth), frame.at(a, b, depth), frame.at(c, d, depth)],
      frame.forward,
    );
  }
}

/** Open façade surface with actual reveals. A backplane is optional for the bell openings. */
function openings(out, frame, width, low, high, bays, lod, wallColor = tones.lime) {
  let cursor = 0;
  for (const { u, w, bottom, spring, rise, fill = 'shade', depth = 0.36 } of bays) {
    const curve = archCurve(u, w, spring, rise, [4, 6, 8, 12][lod]);
    const left = u - w / 2;
    const right = u + w / 2;
    panel(out, 'lime', frame, cursor, left, low, high, 0, wallColor);
    panel(out, 'lime', frame, left, right, low, bottom, 0, wallColor);
    const inner = [[left, bottom], ...curve, [right, bottom], [left, bottom]];
    for (let i = 1; i < inner.length; i++) {
      const [x0, y0] = inner[i - 1],
        [x1, y1] = inner[i];
      const across = (y1 - y0) * frame.forward[2];
      const down = x0 - x1;
      const other = -(y1 - y0) * frame.forward[0];
      face(
        out,
        'lime',
        [frame.at(x0, y0), frame.at(x1, y1), frame.at(x1, y1, -depth), frame.at(x0, y0, -depth)],
        [across, down, other],
        tones.recess,
      );
    }
    for (let i = 1; i < curve.length; i++) {
      const [x0, y0] = curve[i - 1],
        [x1, y1] = curve[i];
      face(
        out,
        'lime',
        [frame.at(x0, y0), frame.at(x1, y1), frame.at(x1, high), frame.at(x0, high)],
        frame.forward,
        wallColor,
      );
      if (fill)
        face(
          out,
          fill,
          [frame.at(u, spring, -depth), frame.at(x0, y0, -depth), frame.at(x1, y1, -depth)],
          frame.forward,
        );
    }
    if (fill) panel(out, fill, frame, left, right, bottom, spring, -depth);
    cursor = right;
  }
  panel(out, 'lime', frame, cursor, width, low, high, 0, wallColor);
}

function archTrim(out, frame, { u, w, bottom, spring, rise }, thickness, projection, lod) {
  const segments = [4, 6, 8, 12][lod];
  const inner = archCurve(u, w, spring, rise, segments);
  const outer = archCurve(u, w + 2 * thickness, spring, rise + thickness, segments);
  for (let i = 1; i < inner.length; i++) {
    const [a, b] = inner[i - 1],
      [c, d] = inner[i],
      [e, f] = outer[i],
      [g, h] = outer[i - 1];
    const foot = (x, y, depth) => frame.at(x, y, depth);
    face(
      out,
      'stone',
      [
        foot(a, b, projection),
        foot(c, d, projection),
        foot(e, f, projection),
        foot(g, h, projection),
      ],
      frame.forward,
    );
    if (lod >= 2) {
      const rim = [foot(g, h, 0), foot(e, f, 0), foot(e, f, projection), foot(g, h, projection)];
      const tangent = (g + e) / 2 - u;
      face(out, 'stone', rim, [
        tangent * frame.forward[2],
        Math.max(0.02, (h + f) / 2 - spring),
        -tangent * frame.forward[0],
      ]);
    }
  }
  for (const side of [u - w / 2 - thickness, u + w / 2]) {
    reliefBlock(out, 'stone', frame, side, side + thickness, bottom, spring, projection);
  }
}

function roundel(out, material, frame, u, y, r, depth, segments, color, hole = 0) {
  for (let i = 0; i < segments; i++) {
    const point = (idx, radius) => {
      const angle = (idx * 2 * Math.PI) / segments;
      return frame.at(u + radius * Math.cos(angle), y + radius * Math.sin(angle), depth);
    };
    face(
      out,
      material,
      hole
        ? [point(i, hole), point(i, r), point(i + 1, r), point(i + 1, hole)]
        : [frame.at(u, y, depth), point(i, r), point(i + 1, r)],
      frame.forward,
      color,
    );
  }
}

function profile(out, material, center, rings, segments, color = tones[material], cap = true) {
  loft(
    out,
    material,
    rings.map(([y, radius]) => radialRing(y, radius, radius, segments, center)),
    color,
    { cap },
  );
}

function crossFinial(out, x, y, z, height, width) {
  beam(out, 'metal', [x, y, z], [x, y + height, z], 0.095, 0.095, tones.black);
  beam(
    out,
    'metal',
    [x - width / 2, y + height * 0.67, z],
    [x + width / 2, y + height * 0.67, z],
    0.085,
    0.085,
    tones.black,
  );
}

function dome(out, center, eave, crown, radius, lod, isGlazed) {
  const segments = [6, 10, 16, 24][lod];
  const count = [2, 5, 8, 11][lod];
  const at = (ring, side) => {
    const angle = (Math.PI * 0.5 * ring) / count;
    const azimuth = (Math.PI * 2 * side) / segments;
    const width = radius * Math.cos(angle) * (1 + 0.075 * Math.sin(2 * angle));
    return [
      center[0] + width * Math.cos(azimuth),
      eave + (crown - eave) * Math.sin(angle),
      center[1] + width * Math.sin(azimuth),
    ];
  };
  const crownTone = isGlazed ? tones.green : tones.plaster;
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < segments; i++) {
      const a = at(j, i),
        b = at(j, i + 1),
        c = at(j + 1, i + 1),
        d = at(j + 1, i);
      const color =
        isGlazed && lod >= 1
          ? j < count - 1 && (i + 2 * j) % 8 === 0
            ? tones.amber
            : (i + j) % 3
              ? tones.green
              : tones.moss
          : crownTone;
      face(
        out,
        isGlazed ? 'roof' : 'lime',
        j === count - 1 ? [a, b, c] : [a, b, c, d],
        [a[0] + b[0] - 2 * center[0], 0.55, a[2] + b[2] - 2 * center[1]],
        color,
      );
    }
  }
  profile(
    out,
    'stone',
    center,
    [
      [eave - 0.17, radius * 1.023],
      [eave + 0.04, radius * 1.025],
    ],
    segments,
    tones.stone,
  );
}

function vault(out, [left, right, back, front], spring, crown, lod, color = tones.plaster) {
  const segments = [4, 6, 10, 14][lod];
  const curve = archCurve((left + right) / 2, right - left, spring, crown - spring, segments);
  for (let i = 1; i < curve.length; i++) {
    const [x0, y0] = curve[i - 1],
      [x1, y1] = curve[i];
    face(
      out,
      'lime',
      [
        [x0, y0, front],
        [x1, y1, front],
        [x1, y1, back],
        [x0, y0, back],
      ],
      [0, 1, 0],
      color,
    );
    face(
      out,
      'lime',
      [
        [x0, spring, front],
        [x1, spring, front],
        [x1, y1, front],
        [x0, y0, front],
      ].filter((v, index, all) => all.findIndex((p) => p[0] === v[0] && p[1] === v[1]) === index),
      [0, 0, 1],
      color,
    );
    face(
      out,
      'lime',
      [
        [x0, spring, back],
        [x1, spring, back],
        [x1, y1, back],
        [x0, y0, back],
      ].filter((v, index, all) => all.findIndex((p) => p[0] === v[0] && p[1] === v[1]) === index),
      [0, 0, -1],
      color,
    );
  }
}

function pediment(out, frame, x, y, width, height, projection) {
  const half = width / 2;
  face(
    out,
    'stone',
    [
      frame.at(x - half, y, projection),
      frame.at(x + half, y, projection),
      frame.at(x, y + height, projection),
    ],
    frame.forward,
  );
  beam(
    out,
    'stone',
    frame.at(x - half, y, projection),
    frame.at(x, y + height, projection),
    0.12,
    0.14,
    tones.stone,
  );
  beam(
    out,
    'stone',
    frame.at(x, y + height, projection),
    frame.at(x + half, y, projection),
    0.12,
    0.14,
    tones.stone,
  );
}

function statue(out, frame, u, y, h, lod) {
  const [x, , z] = frame.at(u, y, 0.18);
  profile(
    out,
    'stone',
    [x, z],
    [
      [y, h * 0.21],
      [y + h * 0.11, h * 0.18],
      [y + h * 0.58, h * 0.12],
      [y + h * 0.7, h * 0.16],
      [y + h * 0.81, h * 0.084],
      [y + h * 0.94, h * 0.103],
      [y + h, h * 0.05],
    ],
    lod === 3 ? 8 : 4,
    tones.plaster,
  );
  if (lod === 3) {
    beam(
      out,
      'stone',
      frame.at(u - h * 0.13, y + h * 0.7, 0.21),
      frame.at(u + h * 0.035, y + h * 0.56, 0.28),
      h * 0.09,
      h * 0.1,
      tones.stone,
    );
  }
}

function niche(out, frame, u, y, w, h, lod, gable = false) {
  const spring = y + h * 0.75,
    rise = h * 0.25;
  const arch = { u, w, bottom: y, spring, rise };
  const curve = archCurve(u, w, spring, rise, lod === 3 ? 10 : 6);
  panel(out, 'shade', frame, u - w / 2, u + w / 2, y, spring, 0.022, tones.recess);
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = curve[i - 1],
      [c, d] = curve[i];
    face(
      out,
      'shade',
      [frame.at(u, spring, 0.022), frame.at(a, b, 0.022), frame.at(c, d, 0.022)],
      frame.forward,
      tones.recess,
    );
  }
  archTrim(out, frame, arch, 0.11, 0.15, lod);
  reliefBlock(out, 'stone', frame, u - w * 0.63, u + w * 0.63, y - 0.14, y + 0.025, 0.28);
  statue(out, frame, u, y + 0.09, h * 0.8, lod);
  if (gable) pediment(out, frame, u, y + h + 0.18, w * 1.48, h * 0.15, 0.21);
}

function column(out, frame, u, bottom, top, radius, lod) {
  if (lod === 1) {
    reliefBlock(out, 'stone', frame, u - radius, u + radius, bottom, top - 0.24, 0.27);
    reliefBlock(out, 'stone', frame, u - 1.23 * radius, u + 1.23 * radius, top - 0.24, top, 0.39);
    return;
  }
  const [x, , z] = frame.at(u, bottom, 0.11);
  reliefBlock(
    out,
    'stone',
    frame,
    u - 1.34 * radius,
    u + 1.34 * radius,
    bottom,
    bottom + 0.24,
    0.37,
  );
  profile(
    out,
    'stone',
    [x, z],
    [
      [bottom + 0.22, radius * 1.16],
      [bottom + 0.4, radius],
      [top - 0.42, radius * 0.76],
      [top - 0.24, radius * 1.06],
      [top - 0.12, radius * 1.1],
    ],
    [4, 6, 8, 12][lod],
    tones.stone,
    false,
  );
  reliefBlock(out, 'stone', frame, u - 1.22 * radius, u + 1.22 * radius, top - 0.23, top, 0.39);
}

function vase(out, frame, x, y, scale, lod) {
  const [worldX, , z] = frame.at(x, y, 0.04);
  profile(
    out,
    'stone',
    [worldX, z],
    [
      [y, 0.23 * scale],
      [y + 0.18 * scale, 0.2 * scale],
      [y + 0.45 * scale, 0.29 * scale],
      [y + 0.62 * scale, 0.15 * scale],
      [y + 0.79 * scale, 0.14 * scale],
      [y + 0.92 * scale, 0.04 * scale],
    ],
    [4, 6, 8, 10][lod],
  );
}

function rosette(out, frame, x, y, r, lod) {
  roundel(out, 'stone', frame, x, y, r, 0.093, lod === 3 ? 12 : 8, tones.stripe, r * 0.73);
  roundel(out, 'stone', frame, x, y, r * 0.24, 0.136, 6, tones.stone);
  const petals = lod === 3 ? 8 : 5;
  for (let i = 0; i < petals; i++) {
    const t = (i * 2 * Math.PI) / petals;
    const a = frame.at(x + Math.cos(t) * r * 0.25, y + Math.sin(t) * r * 0.25, 0.055);
    const b = frame.at(x + Math.cos(t) * r * 0.66, y + Math.sin(t) * r * 0.66, 0.111);
    beam(out, 'stone', a, b, r * 0.38, 0.057, tones.stone);
  }
}

function palmMedallion(out, frame, x, y, lod, r = 0.62) {
  roundel(out, 'stone', frame, x, y, r, 0.116, lod === 3 ? 18 : 10, tones.stone, r * 0.82);
  beam(
    out,
    'stone',
    frame.at(x - r * 0.12, y - r * 0.61, 0.12),
    frame.at(x, y + r * 0.28, 0.15),
    r * 0.105,
    0.09,
    tones.stone,
  );
  for (const direction of [-1, 1]) {
    for (const [run, rise] of [
      [0.28, 0.56],
      [0.54, 0.27],
      [0.48, -0.02],
    ]) {
      beam(
        out,
        'stone',
        frame.at(x, y + r * 0.28, 0.14),
        frame.at(x + direction * r * run, y + r * rise, 0.13),
        r * 0.1,
        0.09,
        tones.stone,
      );
    }
  }
}

function facadeCrown(out, frame, lod) {
  const z = 29.96476;
  const crown = [
    [-9.45, 16.65],
    [-7.98, 16.7],
    [-7.12, 17.1],
    [-6.34, 17.9],
    [-5.48, 18.45],
    [-4.4, 18.35],
    [-3.79, 18.62],
    [-3.1, 19.64],
    [-1.91, 19.96],
    [-0.88, 20.23],
    [0, frontTop],
    [0.88, 20.23],
    [1.91, 19.96],
    [3.1, 19.64],
    [3.79, 18.62],
    [4.4, 18.35],
    [5.48, 18.45],
    [6.34, 17.9],
    [7.12, 17.1],
    [7.98, 16.7],
    [9.45, 16.65],
  ];
  const step = lod === 0 ? 2 : 1;
  for (let i = step; i < crown.length; i += step) {
    const [a, y] = crown[i - step],
      [b, h] = crown[i];
    const x0 = frontCenter + a,
      x1 = frontCenter + b;
    face(
      out,
      'lime',
      [
        [x0, 16.3, z],
        [x1, 16.3, z],
        [x1, h, z],
        [x0, y, z],
      ],
      [0, 0, 1],
    );
    face(
      out,
      'lime',
      [
        [x0, 16.3, z - 1.46],
        [x1, 16.3, z - 1.46],
        [x1, h, z - 1.46],
        [x0, y, z - 1.46],
      ],
      [0, 0, -1],
    );
    face(
      out,
      'stone',
      [
        [x0, y, z + 0.15],
        [x1, h, z + 0.15],
        [x1, h, z - 1.53],
        [x0, y, z - 1.53],
      ],
      [0, 1, 0],
    );
    if (lod)
      beam(
        out,
        'stone',
        [x0, y - 0.16, z + 0.092],
        [x1, h - 0.16, z + 0.092],
        0.16,
        0.26,
        tones.stone,
      );
  }
  const urns = [
    [-9.08, 16.67, 1.06],
    [-4.44, 18.35, 0.9],
    [0, frontTop, 1.22],
    [4.44, 18.35, 0.9],
    [9.08, 16.67, 1.06],
  ];
  for (const [x, y, scale] of lod ? urns : [urns[2]]) {
    vase(out, frame, x, y, scale, lod);
  }
  if (lod) {
    niche(out, frame, 0, 17.02, 1.37, 2.08, lod);
    for (const x of [-1.75, 1.75]) {
      column(out, frame, x, 16.45, 19.38, 0.24, lod);
      palmMedallion(out, frame, x * 1.68, 17.9, lod, 0.45);
    }
  }
}

function westFront(out, lod) {
  const [left, right, , z] = church;
  const frame = facadeFrame(frontCenter, z, 1, 0);
  const wholeFront = facadeFrame(left, z, 1, 0);
  const faceDepth = 1.38;
  const opening = {
    u: frontCenter - left,
    w: 4.12,
    bottom: plazaThreshold,
    spring: 4.62,
    rise: 2.08,
    fill: 'wood',
    depth: 0.65,
  };
  openings(out, wholeFront, right - left, foundation, 8.12, [opening], lod);
  block(out, 'lime', [left, right, z - faceDepth, z - 0.68], foundation, 8.11);
  block(out, 'lime', [left, right, z - faceDepth, z - 0.005], 8.12, 16.46);
  panel(out, 'lime', wholeFront, 0, right - left, 8.12, 16.46);
  for (const [low, high, extent, depth] of [
    [0.53, 0.83, 11.65, 0.31],
    [7.84, 8.14, 9.34, 0.48],
    [11.62, 11.94, 9.36, 0.45],
    [15.95, 16.38, 9.35, 0.53],
  ]) {
    if (low < 1) {
      reliefBlock(out, 'stone', frame, -extent, -2.08, low, high, depth);
      reliefBlock(out, 'stone', frame, 2.08, extent, low, high, depth);
    } else reliefBlock(out, 'stone', frame, -extent, extent, low, high, depth);
  }
  for (const [i, depth] of [1.52, 1.03, 0.53].entries()) {
    block(
      out,
      'stone',
      [frontCenter - 2.74, frontCenter + 2.74, z - 0.13, z + depth],
      0.15,
      (i + 1) * 0.245 + 0.15,
      tones.step,
    );
  }
  archTrim(out, wholeFront, opening, 0.33, 0.25, lod);
  if (lod >= 1) {
    archTrim(out, wholeFront, { ...opening, w: 5.02, rise: 2.45 }, 0.23, 0.18, lod);
    for (const x of [-8.66, -3.33, 3.33, 8.66]) {
      for (const [low, high, radius] of [
        [1.17, 7.79, 0.43],
        [8.15, 11.56, 0.34],
        [11.99, 15.87, 0.29],
      ]) {
        column(out, frame, x, low, high, radius, lod);
      }
    }
    for (const x of [-5.97, 5.97]) {
      niche(out, frame, x, 3.03, 1.38, 2.7, lod, true);
      niche(out, frame, x, 8.61, 1.11, 2.19, lod, true);
      palmMedallion(out, frame, x, 13.81, lod, 0.93);
    }
    for (const [x, w, h] of [
      [-1.94, 0.99, 2.28],
      [0, 1.35, 2.81],
      [1.94, 0.99, 2.28],
    ]) {
      niche(out, frame, x, 12.3, w, h, lod);
    }
    reliefBlock(out, 'stone', frame, -1.45, 1.45, 8.51, 10.97, 0.103, tones.stripe);
    roundel(out, 'shade', frame, 0, 9.68, 0.73, 0.107, 14, tones.shade);
    roundel(out, 'stone', frame, 0, 9.68, 0.91, 0.17, 14, tones.stone, 0.7);
    if (lod >= 2) {
      for (const bay of [-5.97, 0, 5.97]) {
        for (const x of [-1.73, 1.73]) {
          for (const y of [8.65, 9.67, 10.69]) rosette(out, frame, bay + x, y, 0.19, lod);
        }
      }
      if (lod === 3) {
        for (const x of [-6.78, -4.95, 4.95, 6.78]) {
          for (const y of [2.03, 6.13, 7.24]) rosette(out, frame, x, y, 0.26, lod);
        }
      }
      palmMedallion(out, frame, 0, 7.22, lod, 0.42);
      for (let i = -8; i <= 8; i++) {
        const x = frontCenter + i * 0.224;
        block(
          out,
          'wood',
          [x - 0.018, x + 0.018, z - 0.648, z - 0.621],
          plazaThreshold + 0.075,
          4.64,
          tones.grain,
        );
      }
      for (const y of [1.39, 2.91, 4.43]) {
        block(
          out,
          'wood',
          [frontCenter - 2, frontCenter + 2, z - 0.646, z - 0.61],
          y,
          y + 0.065,
          tones.grain,
        );
      }
    }
  }
  facadeCrown(out, frame, lod);
  const edge = facadeFrame(right - 0.77, z - 0.12, 1, 0);
  if (lod) vase(out, edge, 0, 16.46, 1.43, lod);
}

function clockFace(out, frame, u, y, lod) {
  const r = 1.37;
  roundel(out, 'stone', frame, u, y, 1.61, 0.081, [10, 16, 24, 32][lod], tones.stone);
  roundel(out, 'shade', frame, u, y, r, 0.102, [10, 16, 24, 32][lod], tones.black);
  if (!lod) return;
  const at = (x, yy) => frame.at(x, yy, 0.137);
  const stroke = (a, b, width) => beam(out, 'metal', a, b, width, 0.035, tones.gold);
  for (let hour = 0; hour < 12; hour++) {
    const step = (hour * Math.PI) / 6;
    const [dx, dy] = [Math.sin(step), Math.cos(step)];
    const x = u + dx * 1.025,
      yy = y + dy * 1.025;
    if (lod === 1) stroke(at(x, yy), at(u + dx * 1.2, y + dy * 1.2), 0.062);
    else {
      const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][
        hour
      ];
      for (const [i, glyph] of [...roman].entries()) {
        const x0 = (i - (roman.length - 1) / 2) * 0.13;
        const point = (du, dv) => at(x + dy * (x0 + du) + dx * dv, yy - dx * (x0 + du) + dy * dv);
        if (glyph === 'I') stroke(point(0, -0.087), point(0, 0.087), 0.029);
        if (glyph === 'V') {
          stroke(point(-0.06, 0.087), point(0, -0.087), 0.029);
          stroke(point(0, -0.087), point(0.06, 0.087), 0.029);
        }
        if (glyph === 'X') {
          stroke(point(-0.054, -0.087), point(0.054, 0.087), 0.029);
          stroke(point(0.054, -0.087), point(-0.054, 0.087), 0.029);
        }
      }
    }
  }
  stroke(at(u + 0.43, y + 0.72), at(u, y), 0.068);
  stroke(at(u - 0.62, y + 0.35), at(u, y), 0.101);
  roundel(out, 'metal', frame, u, y, 0.092, 0.191, 10, tones.gold);
}

function buttress(out, frame, u, y, height, width, base, top) {
  const x0 = u - width / 2;
  const x1 = u + width / 2;
  const corner = (x, h, d) => frame.at(x, h, d);
  const a = corner(x0, y, base),
    b = corner(x1, y, base);
  const c = corner(x1, y + height * 0.7, base * 0.73),
    d = corner(x0, y + height * 0.7, base * 0.73);
  const e = corner(x0, y + height, top),
    f = corner(x1, y + height, top);
  const tangent = [frame.forward[2], 0, -frame.forward[0]];
  face(out, 'lime', [a, b, c, d], frame.forward);
  face(out, 'stone', [d, c, f, e], [0, 1, 0], tones.step);
  for (const [sign, x, aa, dd, ee] of [
    [-1, x0, a, d, e],
    [1, x1, b, c, f],
  ]) {
    face(
      out,
      'lime',
      [corner(x, y, -0.04), aa, dd, corner(x, y + height * 0.7, -0.04)],
      tangent.map((n) => n * sign),
    );
    face(
      out,
      'lime',
      [corner(x, y + height * 0.7, -0.04), dd, ee, corner(x, y + height, -0.04)],
      tangent.map((n) => n * sign),
    );
  }
}

function towerBody(out, lod) {
  const [left, right, back, front] = tower;
  const center = [(left + right) / 2, (back + front) / 2];
  const widths = [right - left, front - back];
  const faces = [
    [facadeFrame(left, front, 1, 0), widths[0]],
    [facadeFrame(right, front, 0, -1), widths[1]],
    [facadeFrame(right, back, -1, 0), widths[0]],
    [facadeFrame(left, back, 0, 1), widths[1]],
  ];
  for (const [sideIndex, [frame, width]] of faces.entries()) {
    const pair = (bottom, spring, w, rise, fill = 'shade', depth = 0.61) =>
      [0.29, 0.71].map((p) => ({ u: width * p, w, bottom, spring, rise, fill, depth }));
    const bays = [
      sideIndex === 0 || sideIndex === 3 ? pair(5.18, 6.24, 1.17, 0.56) : [],
      pair(8.82, 10.12, 1.22, 0.58),
      sideIndex === 0 ? [] : [{ u: width / 2, w: 1.49, bottom: 13.19, spring: 14.75, rise: 0.64 }],
      pair(17.78, 20.03, 1.73, 0.86, null, 0.72),
    ];
    for (const [stage, high] of towerStageTops.entries()) {
      openings(out, frame, width, towerStageTops[stage - 1] ?? foundation, high, bays[stage], lod);
      if (lod >= 1) {
        for (const arch of bays[stage]) {
          archTrim(out, frame, arch, stage === 3 ? 0.17 : 0.11, 0.16, lod);
          if (stage === 3) {
            const [x, , z] = frame.at(arch.u, arch.bottom, -1.01);
            profile(
              out,
              'metal',
              [x, z],
              [
                [18.03, 0.61],
                [18.19, 0.58],
                [18.74, 0.39],
                [19.25, 0.35],
                [19.42, 0.12],
              ],
              lod >= 2 ? 12 : 6,
              tones.metal,
            );
            beam(
              out,
              'metal',
              frame.at(arch.u, 19.41, -1.01),
              frame.at(arch.u, 20.2, -1.01),
              0.092,
              0.092,
              tones.black,
            );
          }
        }
      }
    }
    if (sideIndex === 0) clockFace(out, frame, width / 2, 14.56, lod);
    if (sideIndex === 0 || sideIndex === 3) {
      for (const u of [width * 0.19, width * 0.79])
        buttress(out, frame, u, 0.17, 4.94, 1.12, 1.03, 0.08);
    }
  }
  for (const level of towerStageTops) {
    block(out, 'stone', expand(tower, 0.24), level - 0.19, level + 0.07);
    if (lod) block(out, 'stone', expand(tower, 0.36), level + 0.07, level + 0.23, tones.plaster);
  }
  block(out, 'lime', tower, foundation, 0.34, tones.recess);
  dome(out, center, towerStageTops.at(-1) + 0.21, towerDomeCrown, 4.3, lod, true);
  profile(
    out,
    'stone',
    center,
    [
      [towerDomeCrown - 0.07, 0.71],
      [26.92, 0.47],
      [27.15, 0.34],
      [27.37, 0.13],
    ],
    lod ? 10 : 6,
  );
  crossFinial(out, center[0], 27.25, center[1], 1.21, 0.77);
  if (lod) {
    for (const x of [left + 0.35, right - 0.35]) {
      for (const z of [back + 0.35, front - 0.35]) {
        vase(out, facadeFrame(x, z, 1, 0), 0, 22.25, 1.23, lod);
      }
    }
  }
}

function sanctuary(out, lod) {
  const [left, right, back, front] = church;
  const bodyFront = front - 1.36;
  const length = bodyFront - back;
  for (const [south, x, z, direction] of [
    [true, right, bodyFront, -1],
    [false, left, back, 1],
  ]) {
    const frame = facadeFrame(x, z, 0, direction);
    const bays = [0.13, 0.32, 0.51, 0.7, 0.89].map((p) => ({
      u: length * p,
      w: 1.65,
      bottom: 4.31,
      spring: 7.23,
      rise: 0.82,
      depth: 0.47,
    }));
    openings(out, frame, length, foundation, wallTop, bays, lod);
    reliefBlock(out, 'stone', frame, 0, length, 1.78, 2.04, 0.13, tones.stripe);
    reliefBlock(out, 'stone', frame, 0, length, 10.5, wallTop + 0.17, 0.28);
    if (lod >= 1) {
      for (const [index, opening] of bays.entries()) {
        archTrim(out, frame, opening, 0.16, 0.17, lod);
        pediment(out, frame, opening.u, opening.spring + opening.rise + 0.47, 3.11, 0.57, 0.16);
        if (south && index < bays.length - 1)
          buttress(out, frame, opening.u + length * 0.095, 1.52, 5.84, 0.77, 0.95, 0.17);
      }
      for (let i = 1; i < 8; i++) {
        const u = (i * length) / 8;
        const at = (offset, y) => frame.at(u + offset, y, 0.09);
        face(
          out,
          'stone',
          [at(-0.22, wallTop + 0.15), at(0.22, wallTop + 0.15), at(0, wallTop + 0.8)],
          frame.forward,
        );
        if (lod >= 2) {
          const [x0, , z0] = frame.at(u, wallTop + 0.13, -0.07);
          profile(
            out,
            'stone',
            [x0, z0],
            [
              [wallTop + 0.13, 0.25],
              [wallTop + 0.83, 0.025],
            ],
            4,
          );
        }
      }
    }
    if (!south && lod) {
      const portal = { u: length * 0.73, w: 2.0, bottom: 1.49, spring: 3.28, rise: 0.83 };
      doorFace(out, frame, portal, lod);
      archTrim(out, frame, portal, 0.15, 0.19, lod);
    }
  }
  block(out, 'lime', [left, right, back - 0.04, back + 0.64], foundation, wallTop);
  const [innerLeft, innerRight] = aisleDividers;
  for (const [x0, x1] of [
    [left, innerLeft],
    [innerRight, right],
  ]) {
    vault(out, [x0, x1, back, bodyFront + 0.11], wallTop, aisleCrown, lod);
  }
  block(out, 'lime', [innerLeft, innerRight, back, bodyFront + 0.12], wallTop - 0.04, naveSpring);
  vault(out, [innerLeft, innerRight, back, bodyFront + 0.12], naveSpring, naveCrown, lod);
  const mainDome = [frontCenter, back + 6.94];
  profile(
    out,
    'lime',
    mainDome,
    [
      [13.88, 4.93],
      [17.02, 4.93],
      [17.36, 5.03],
    ],
    8,
  );
  if (lod) {
    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) * Math.PI) / 4;
      const nx = Math.cos(angle),
        nz = Math.sin(angle);
      const rim = 4.93 * Math.cos(Math.PI / 8);
      const frame = facadeFrame(
        mainDome[0] + nx * (rim + 0.015),
        mainDome[1] + nz * (rim + 0.015),
        nz,
        -nx,
      );
      panel(out, 'shade', frame, -0.59, 0.59, 14.65, 16.0, 0.012);
      const curve = archCurve(0, 1.18, 16.0, 0.58, 6);
      for (let j = 1; j < curve.length; j++) {
        const [u, h] = curve[j - 1],
          [v, y] = curve[j];
        face(
          out,
          'shade',
          [frame.at(0, 16, 0.012), frame.at(u, h, 0.012), frame.at(v, y, 0.012)],
          frame.forward,
        );
      }
    }
  }
  dome(out, mainDome, 17.36, 21.58, 4.76, lod, true);
  profile(
    out,
    'stone',
    mainDome,
    [
      [21.43, 0.63],
      [21.72, 0.61],
      [22.26, 0.37],
      [22.38, 0.14],
    ],
    lod ? 10 : 6,
  );
  crossFinial(out, mainDome[0], 22.34, mainDome[1], 0.86, 0.46);
  for (const x of [(left + innerLeft) / 2, (right + innerRight) / 2]) {
    const center = [x, back + 7.03];
    profile(
      out,
      'lime',
      center,
      [
        [11.9, 2.64],
        [14.02, 2.64],
      ],
      lod ? 12 : 6,
    );
    dome(out, center, 14.02, 16.08, 2.51, lod, false);
    profile(
      out,
      'stone',
      center,
      [
        [15.98, 0.33],
        [16.26, 0.31],
        [16.62, 0.095],
      ],
      lod ? 8 : 4,
    );
  }
}

function courtyard(out, lod) {
  const [gateLeft, gateRight, gateBack, gateFront] = courtGate;
  const gate = facadeFrame(gateLeft, gateFront, 1, 0);
  const back = facadeFrame(gateRight, gateBack, -1, 0);
  const width = gateRight - gateLeft;
  const portal = { u: width / 2, w: 2.15, bottom: 0.15, spring: 2.61, rise: 1.07, fill: null };
  openings(out, gate, width, foundation, 5.75, [{ ...portal, depth: 0.52 }], lod);
  openings(out, back, width, foundation, 5.75, [{ ...portal, depth: 0.482 }], lod);
  block(out, 'stone', expand(courtGate, 0.13), 5.39, 5.79);
  archTrim(out, gate, portal, 0.18, 0.19, lod);
  pediment(out, gate, width / 2, 5.77, width * 0.82, 1.09, 0.0);
  if (lod) {
    palmMedallion(out, gate, width / 2, 5.0, lod, 0.39);
    for (const x of [0.37, width - 0.37]) vase(out, gate, x, 5.74, 0.57, lod);
  }
  for (let i = 1; i < courtyardRim.length; i++) {
    const [ax, az] = courtyardRim[i - 1];
    const [bx, bz] = courtyardRim[i];
    const length = Math.hypot(bx - ax, bz - az);
    const frame = facadeFrame(ax, az, (bx - ax) / length, (bz - az) / length);
    const reverse = facadeFrame(bx, bz, (ax - bx) / length, (az - bz) / length);
    for (const f of [frame, reverse]) {
      for (const [u, v, base, top] of [
        [0, length, foundation, 2.83],
        [0, length, 2.83, 3.06],
      ]) {
        panel(out, top > 3 ? 'stone' : 'lime', f, u, v, base, top, 0.19);
      }
    }
    face(
      out,
      'stone',
      [
        frame.at(0, 3.06, 0.19),
        frame.at(length, 3.06, 0.19),
        frame.at(length, 3.06, -0.19),
        frame.at(0, 3.06, -0.19),
      ],
      [0, 1, 0],
    );
  }
  // Back of the front gate's north shoulder.
  face(
    out,
    'lime',
    [
      [gateLeft, foundation, gateBack],
      [gateLeft, foundation, gateFront],
      [gateLeft, 5.75, gateFront],
      [gateLeft, 5.75, gateBack],
    ],
    [-1, 0, 0],
  );
}

function rearRanges(out, lod) {
  const [left, right, back, front] = chapterRange;
  block(out, 'lime', chapterRange, foundation, 6.62, tones.stripe);
  const chapterA = [left, -10.6, back, front];
  const chapterB = [-10.6, right, back, front];
  for (const [x0, x1, z0, z1] of [chapterA, chapterB]) {
    vault(out, [x0 - 0.13, x1 + 0.13, z0 - 0.12, z1 + 0.13], 6.62, 7.77, lod, tones.roof);
  }
  block(out, 'lime', [church[0], right, front - 0.04, church[2] + 0.08], foundation, 7.35);
  block(out, 'lime', sacristy, foundation, 7.79);
  vault(out, expand(sacristy, 0.09), 7.78, 9.58, lod);
  block(out, 'lime', chapel, foundation, 8.62);
  const chapelCenter = [(chapel[0] + chapel[1]) / 2 + 0.77, (chapel[2] + chapel[3]) / 2];
  profile(
    out,
    'lime',
    chapelCenter,
    [
      [8.58, 3.89],
      [10.0, 3.89],
    ],
    8,
  );
  dome(out, chapelCenter, 10, 13.87, 3.71, lod, false);
  profile(
    out,
    'stone',
    chapelCenter,
    [
      [13.7, 0.54],
      [14.08, 0.47],
      [14.58, 0.13],
    ],
    lod ? 10 : 6,
  );
  crossFinial(out, chapelCenter[0], 14.55, chapelCenter[1], 0.77, 0.37);
  if (lod) {
    const frame = facadeFrame(right, back, -1, 0);
    for (const [i, x] of [3.9, 10.8, 17.7, 25.6, 32.3, 39.3].entries()) {
      const bottom = i === 2 || i === 4 ? 1.94 : 3.77;
      const portal = { u: x, w: 1.52, bottom, spring: 5.48, rise: 0.65 };
      doorFace(out, frame, portal, lod);
      archTrim(out, frame, portal, 0.12, 0.17, lod);
    }
  }
}

function build(out, lod) {
  sanctuary(out, lod);
  westFront(out, lod);
  towerBody(out, lod);
  rearRanges(out, lod);
  courtyard(out, lod);
}

/** Keep the major masses and separately legible plaza, tower and domes in the distant levels. */
function distant(out, district) {
  const [left, right, back, front] = church;
  const [innerLeft, innerRight] = aisleDividers;
  const body = [left, right, back, front - 1.35];
  block(out, 'lime', body, foundation, wallTop);
  vault(out, [left, innerLeft, back, front - 1.3], wallTop, aisleCrown, 0);
  vault(out, [innerRight, right, back, front - 1.3], wallTop, aisleCrown, 0);
  block(out, 'lime', [innerLeft, innerRight, back, front - 1.3], wallTop, naveSpring);
  vault(out, [innerLeft, innerRight, back, front - 1.3], naveSpring, naveCrown, 0);
  const rearDomes = [
    [[frontCenter, back + 6.94], 17.36, 21.58, 4.76, true],
    [[(left + innerLeft) / 2, back + 7.03], 13.9, 16.08, 2.51, false],
    [[(right + innerRight) / 2, back + 7.03], 13.9, 16.08, 2.51, false],
    [[(chapel[0] + chapel[1]) / 2 + 0.77, (chapel[2] + chapel[3]) / 2], 9.46, 13.87, 3.71, false],
  ];
  for (const [center, eave, crown, radius, glazed] of rearDomes) {
    profile(
      out,
      'lime',
      center,
      [
        [eave - (glazed ? 3.8 : 1.5), radius],
        [eave, radius],
      ],
      6,
    );
    dome(out, center, eave, crown, radius, 0, glazed);
  }
  if (district) westFront(out, 1);
  else {
    block(out, 'lime', [left, right, front - 1.46, front], foundation, 16.46);
    const west = facadeFrame(frontCenter, front, 1, 0);
    const portal = { u: 0, w: 4.12, bottom: plazaThreshold, spring: 4.62, rise: 2.08 };
    panel(out, 'wood', west, -2.06, 2.06, plazaThreshold, 4.63, 0.02);
    const curve = archCurve(0, portal.w, portal.spring, portal.rise, 5);
    for (let i = 1; i < curve.length; i++) {
      const [u, y] = curve[i - 1],
        [v, h] = curve[i];
      face(
        out,
        'wood',
        [west.at(0, portal.spring, 0.02), west.at(u, y, 0.02), west.at(v, h, 0.02)],
        west.forward,
      );
    }
    archTrim(out, west, portal, 0.25, 0.22, 0);
    facadeCrown(out, west, 0);
    for (const y of [7.93, 11.75, 16.09])
      reliefBlock(out, 'stone', west, -9.2, 9.2, y, y + 0.25, 0.21);
  }

  const [tx0, tx1, tz0, tz1] = tower;
  const center = [(tx0 + tx1) / 2, (tz0 + tz1) / 2];
  block(out, 'lime', tower, foundation, towerStageTops[2]);
  const top = towerStageTops[3];
  const towerFaces = [
    [facadeFrame(tx0, tz1, 1, 0), tx1 - tx0],
    [facadeFrame(tx1, tz1, 0, -1), tz1 - tz0],
    [facadeFrame(tx1, tz0, -1, 0), tx1 - tx0],
    [facadeFrame(tx0, tz0, 0, 1), tz1 - tz0],
  ];
  for (const [frame, width] of towerFaces) {
    const bays = [0.3, 0.7].map((p) => ({
      u: width * p,
      w: 1.63,
      bottom: 17.8,
      spring: 20.03,
      rise: 0.84,
      fill: 'shade',
      depth: district ? 0.36 : 0.11,
    }));
    if (district) openings(out, frame, width, towerStageTops[2], top, bays, 0);
    else {
      panel(out, 'lime', frame, 0, width, towerStageTops[2], top);
      for (const slot of bays)
        panel(
          out,
          'shade',
          frame,
          slot.u - slot.w / 2,
          slot.u + slot.w / 2,
          slot.bottom,
          slot.spring + 0.17,
          0.024,
        );
    }
  }
  clockFace(out, towerFaces[0][0], (tx1 - tx0) / 2, 14.56, district ? 1 : 0);
  for (const stage of towerStageTops)
    block(out, 'stone', expand(tower, 0.22), stage - 0.16, stage + 0.14);
  dome(out, center, top + 0.13, towerDomeCrown, 4.3, 0, true);
  profile(
    out,
    'stone',
    center,
    [
      [26.46, 0.57],
      [27.29, 0.13],
    ],
    4,
  );
  crossFinial(out, center[0], 27.25, center[1], 1.21, 0.77);
  block(out, 'lime', chapterRange, foundation, 7.6, tones.stripe);
  block(out, 'lime', sacristy, foundation, 8.43);
  block(out, 'lime', chapel, foundation, 8.62);
  courtyard(out, 0);
}

export const comayaguaSkyline = (out) => distant(out, false);
export const comayaguaDistrict = (out) => distant(out, true);
export const comayaguaStreet = (out) => build(out, 2);
export const comayaguaCloseup = (out) => build(out, 3);

const recipe = 'comayagua-cathedral-model.mjs';
const camera = [37, 26, 81];
const lookAt = [-2.2, 10.7, 10];
export const comayaguaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  category: 'landmark',
  build: comayaguaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.994,
    basis:
      'The named cathedral and attached ranges in native way 310133177. The model retains the open north patio within the cadastral envelope.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Cathedral of the Immaculate Conception in Comayagua, with its carved west front, north clock tower, vaulted aisles and five domes.',
  camera,
  lookAt,
  sunDirection: [18, 43, 52],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.7,
    cameraYaw: 0.39,
    groundY: 0,
    focus: { center: [-3, 10, 5] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'plaza-and-carved-facade', position: [1, 15, 80], lookAt: [-2, 13.3, 30] },
    { name: 'clock-and-tower-bell-stage', position: [-30, 20.6, 56], lookAt: [-11.4, 17.3, 34] },
    {
      name: 'sanctuary-domes-and-south-aisle',
      position: [59, 32.5, -37],
      lookAt: [2.8, 10.5, -8.1],
    },
    { name: 'north-portal-and-open-patio', position: [-64, 23.4, 44], lookAt: [-15, 10.3, 11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `comayagua-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'comayaguaSkyline',
    errorMeters: 0.87,
    surfaces,
    authoredLevels: {
      district: { export: 'comayaguaDistrict', errorMeters: 0.44, surfaces },
      street: { export: 'comayaguaStreet', errorMeters: 0.22, surfaces },
      closeup: { export: 'comayaguaCloseup', errorMeters: 0.086, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on the public-domain October 1859 engraving, factual institutional research, ODbL OpenStreetMap geography, and openly attributed Terrarium elevation.',
};
