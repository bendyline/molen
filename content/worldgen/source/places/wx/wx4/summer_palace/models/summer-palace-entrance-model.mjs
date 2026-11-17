import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  surfaces as courtSurfaces,
  dark,
  face,
  frame,
  gold,
  granite,
  indigo,
  levels,
  marble,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['east-entrance', 'north-entrance']);
export const surfaces = {
  ...courtSurfaces,
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.65, roughness: 0.58 },
};

const bronze = [0.183, 0.195, 0.147];
const stone = [0.52, 0.5, 0.47];

function panel(out, x, z, width, low, high, detail, tint) {
  box(out, 'timber', [x - width / 2, low, z - 0.06], [x + width / 2, high, z + 0.06], red);
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    const front = z + side * 0.077;
    const columns = detail >= 3 ? 12 : 6;
    for (let i = 1; i < columns; i++) {
      const u = x + width * (i / columns - 0.5);
      beam(out, 'timber', [u, low + 0.09, front], [u, high - 0.09, front], 0.036, 0.045, tint);
    }
    const rows = detail >= 3 ? 8 : 4;
    for (let i = 1; i < rows; i++) {
      const y = low + ((high - low) * i) / rows;
      beam(
        out,
        'timber',
        [x - width * 0.47, y, front],
        [x + width * 0.47, y, front],
        0.037,
        0.045,
        tint,
      );
    }
  }
}

function openDoor(out, x, z, width, top, side, direction, detail) {
  const leaf = frame(out, [x, z], 0.065, side * direction * 1.49);
  const start = Math.min(0, -side * width);
  const end = Math.max(0, -side * width);
  box(leaf, 'timber', [start, 0, -0.065], [end, top - 0.065, 0.065], red);
  if (detail < 2) return;
  for (const faceZ of [-0.088, 0.088]) {
    const center = (start + end) / 2;
    beam(
      leaf,
      'enamel',
      [center + side * width * 0.34, 1.3, faceZ],
      [center + side * width * 0.34, 1.51, faceZ],
      0.105,
      0.07,
      gold,
    );
    const rows = detail >= 3 ? 8 : 4;
    const columns = detail >= 3 ? 5 : 3;
    for (let i = 1; i <= columns; i++)
      for (let j = 1; j <= rows; j++) {
        const u = start + ((end - start) * i) / (columns + 1),
          y = (top * j) / (rows + 1);
        box(
          leaf,
          'enamel',
          [u - 0.023, y - 0.023, faceZ - 0.023],
          [u + 0.023, y + 0.023, faceZ + 0.023],
          gold,
        );
      }
  }
}

function gatePosts(out, posts, postDepth, y, lintel, detail) {
  const halfWidth = posts.at(-1);
  for (const sign of [-1, 1]) {
    const z = sign * postDepth;
    beam(
      out,
      'timber',
      [-halfWidth - 0.3, lintel, z],
      [halfWidth + 0.3, lintel, z],
      0.31,
      0.44,
      indigo,
    );
    if (detail >= 2)
      beam(
        out,
        'enamel',
        [-halfWidth - 0.24, lintel - 0.22, z],
        [halfWidth + 0.24, lintel - 0.22, z],
        0.065,
        0.08,
        gold,
      );
    for (const [i, x] of posts.entries()) {
      if (detail === 0) beam(out, 'timber', [x, y, z], [x, lintel, z], 0.37, 0.37, red);
      else {
        const spokes = detail >= 2 ? 10 : 6;
        loft(
          out,
          'timber',
          [
            radialRing(y, 0.208, 0.208, spokes, [x, z]),
            radialRing(lintel, 0.184, 0.184, spokes, [x, z]),
          ],
          red,
          { cap: false },
        );
        box(out, 'marble', [x - 0.25, y, z - 0.25], [x + 0.25, y + 0.19, z + 0.25], stone);
      }
      if (detail < 2) continue;
      for (const [top, reach, tint] of [
        [0.12, 0.28, red],
        [0.29, 0.43, turquoise],
        [0.46, 0.57, indigo],
      ])
        beam(
          out,
          'timber',
          [x, lintel + top, z - reach * 0.62],
          [x, lintel + top, z + reach],
          reach * 1.21,
          0.17,
          tint,
        );
      if (detail >= 3 && i < posts.length - 1) {
        const step = posts[i + 1] - x;
        const u = x + step * 0.5;
        const edge = z + sign * 0.235;
        face(
          out,
          'timber',
          [
            [u - step * 0.36, lintel - 0.19, edge],
            [u + step * 0.36, lintel - 0.19, edge],
            [u + step * 0.27, lintel + 0.12, edge],
            [u - step * 0.27, lintel + 0.12, edge],
          ],
          turquoise,
          [0, 0, sign],
        );
        const relief = edge + sign * 0.012;
        face(
          out,
          'enamel',
          [
            [u - 0.26, lintel - 0.03, relief],
            [u, lintel - 0.14, relief],
            [u + 0.26, lintel - 0.03, relief],
            [u, lintel + 0.078, relief],
          ],
          gold,
          [0, 0, sign],
        );
      }
    }
  }
}

function podium(out, { width, depth, toe, aprons, step, east }, detail) {
  box(out, 'stone', [-width / 2, toe, -depth / 2], [width / 2, 0, depth / 2], stone);
  for (const { side, bottom, run } of aprons) {
    const edge = (side * depth) / 2;
    if (bottom >= -0.03) continue;
    const landingHalf = step * 1.5 + 0.27;
    if (detail === 0) {
      const lip = edge + side * run;
      face(
        out,
        'stone',
        [
          [-landingHalf, 0, edge],
          [landingHalf, 0, edge],
          [landingHalf, bottom, lip],
          [-landingHalf, bottom, lip],
        ],
        stone,
        up,
      );
      for (const sign of [-1, 1]) {
        const x = sign * landingHalf;
        face(
          out,
          'stone',
          [
            [x, 0, edge],
            [x, bottom, lip],
            [x, Math.min(toe, bottom - 0.24), lip],
            [x, Math.min(toe, bottom - 0.24), edge],
          ],
          stone,
          [sign, 0, 0],
        );
      }
      continue;
    }
    const count = Math.max(2, Math.round(-bottom / 0.155));
    for (let i = 0; i < count; i++) {
      const a = edge + side * ((run * i) / count);
      const b = edge + side * ((run * (i + 1)) / count);
      const top = (bottom * i) / count;
      box(
        out,
        'stone',
        [-landingHalf, Math.min(toe, bottom - 0.24), Math.min(a, b)],
        [landingHalf, top, Math.max(a, b)],
        stone,
      );
    }
    if (east && side > 0) {
      const lip = edge + run;
      const half = step * 0.26;
      face(
        out,
        'marble',
        [
          [-half, 0.038, edge],
          [half, 0.038, edge],
          [half, bottom + 0.083, lip],
          [-half, bottom + 0.083, lip],
        ],
        marble,
        up,
      );
      if (detail >= 3) {
        const scroll = [
          [-0.31, 0.27],
          [-0.08, 0.38],
          [0.23, 0.48],
          [0.26, 0.59],
          [-0.15, 0.65],
          [-0.18, 0.75],
          [0.11, 0.79],
        ];
        for (let i = 1; i < scroll.length; i++) {
          const pos = ([x, t]) => [x, 0.085 + bottom * t, edge + run * t];
          beam(out, 'marble', pos(scroll[i - 1]), pos(scroll[i]), 0.076, 0.06, stone);
        }
      }
    }
  }
}

export function guardian(out, { x, z, grade, side, angle = 0 }, detail) {
  const base = frame(out, [x, z], grade, angle - side * 0.1);
  for (const [w, d, low, high] of [
    [1.68, 1.76, -0.39, 0.11],
    [1.44, 1.5, 0.11, 0.68],
    [1.64, 1.68, 0.68, 0.83],
  ])
    box(base, 'stone', [-w / 2, low, -d / 2], [w / 2, high, d / 2], marble);
  const segments = [5, 7, 9, 13, 16][detail];
  const lats = [3, 4, 5, 7, 8][detail];
  sphere(base, 'bronze', [0, 1.44, -0.12], [0.54, 0.63, 0.57], bronze, segments, lats);
  sphere(base, 'bronze', [0, 1.95, 0.19], [0.57, 0.56, 0.44], bronze, segments, lats);
  sphere(base, 'bronze', [0, 1.98, 0.55], [0.34, 0.24, 0.23], bronze, segments, lats);
  for (const sign of [-1, 1]) {
    sphere(base, 'bronze', [sign * 0.31, 0.94, 0.46], [0.22, 0.14, 0.27], bronze, segments, lats);
    if (detail === 0) continue;
    sphere(base, 'bronze', [sign * 0.41, 2.25, 0.25], [0.15, 0.24, 0.15], bronze, segments, lats);
    sphere(base, 'bronze', [sign * 0.29, 1.19, 0.31], [0.16, 0.37, 0.17], bronze, segments, lats);
    if (detail < 2) continue;
    sphere(base, 'bronze', [sign * 0.21, 2.11, 0.609], [0.115, 0.076, 0.055], bronze, 8, 4);
    for (const y of [1.66, 1.84, 2.01, 2.18, 2.36]) {
      const r = y > 2.18 ? 0.093 : 0.137;
      sphere(base, 'bronze', [sign * (y > 2.18 ? 0.34 : 0.49), y, 0.39], [r, r, r], bronze, 8, 5);
    }
  }
  if (detail >= 2) {
    if (side < 0)
      sphere(base, 'bronze', [-0.42, 1.08, 0.6], [0.19, 0.19, 0.19], bronze, segments, lats);
    else {
      sphere(base, 'bronze', [0.43, 0.99, 0.56], [0.26, 0.15, 0.25], bronze, segments, lats);
      sphere(base, 'bronze', [0.54, 1.13, 0.67], [0.12, 0.14, 0.13], bronze, 8, 5);
    }
  }
}

function balcony(out, width, depth, y, detail) {
  const half = width * 0.48,
    z = depth * 0.45;
  box(out, 'stone', [-half, y - 0.33, -z], [half, y, z], stone);
  for (const side of [-1, 1]) {
    const front = side * (z - 0.12);
    beam(
      out,
      'timber',
      [-half + 0.14, y + 0.67, front],
      [half - 0.14, y + 0.67, front],
      0.1,
      0.12,
      turquoise,
    );
    if (detail < 1) continue;
    const count = detail >= 2 ? 27 : 10;
    for (let i = 0; i <= count; i++) {
      const x = (half - 0.14) * ((2 * i) / count - 1);
      beam(out, 'timber', [x, y, front], [x, y + 0.67, front], 0.077, 0.086, turquoise);
      if (detail >= 3 && i < count) {
        const next = x + ((half - 0.14) * 2) / count;
        beam(out, 'timber', [x, y + 0.13, front], [next, y + 0.54, front], 0.043, 0.054, indigo);
        beam(out, 'timber', [x, y + 0.54, front], [next, y + 0.13, front], 0.043, 0.054, indigo);
      }
    }
  }
}

function entranceRoof(out, width, depth, base, east, detail) {
  const rise = east ? 2.78 : 2.26;
  const lift = east ? 0.61 : 0.92;
  const tint = east ? [0.276, 0.271, 0.251] : roofs.grey;
  const columns = detail < 1 ? [-1, -0.73, 0, 0.73, 1] : [-1, -0.87, -0.61, 0, 0.61, 0.87, 1];
  const tiers = detail === 0 ? [0, 1] : [0, 0.23, 0.53, 0.77, 1];
  const corner = (u) => Math.pow(Math.max(0, (Math.abs(u) - 0.55) / 0.45), 2);
  const eaves = (u) => base + lift * corner(u);
  const ridge = (u) => base + rise + (east ? 0.37 : 0.48) * corner(u);
  const point = (u, t, side) => [
    (u * width * (1 - t * 0.11)) / 2,
    eaves(u) * (1 - t) + ridge(u) * t - rise * 0.29 * t * (1 - t),
    side * depth * (1 - t * 0.989) * 0.5,
  ];
  const ring = (t) => [
    ...columns.map((u) => point(u, t, 1)),
    point(1, t, 0),
    ...columns.toReversed().map((u) => point(u, t, -1)),
    point(-1, t, 0),
  ];
  loft(out, 'tile', tiers.map(ring), tint, { cap: false });
  const rim = ring(0);
  for (const [i, a] of rim.entries()) {
    const b = rim[(i + 1) % rim.length];
    const c = [a[0], a[1] - 0.24, a[2]];
    const d = [b[0], b[1] - 0.24, b[2]];
    face(out, 'timber', [a, b, d, c], dark, [a[0] + b[0], 0, a[2] + b[2]]);
    face(out, 'timber', [c, d, [0, base - 0.24, 0]], dark, [0, -1, 0]);
  }
  for (let i = 1; i < columns.length; i++) {
    const a = columns[i - 1],
      b = columns[i];
    beam(out, 'tile', point(a, 1, 0), point(b, 1, 0), 0.23, 0.23, tint);
  }
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    for (let i = 1; i < columns.length; i++) {
      const a = columns[i - 1],
        b = columns[i];
      beam(out, 'tile', point(a, 0, side), point(b, 0, side), 0.13, 0.19, tint);
    }
    for (const end of [-1, 1]) {
      for (let i = 1; i < tiers.length; i++)
        beam(
          out,
          'tile',
          point(end, tiers[i - 1], side),
          point(end, tiers[i], side),
          0.17,
          0.26,
          tint,
        );
      if (detail >= 3) {
        const [x, y, z] = point(end, 0, side);
        beam(out, 'tile', [x, y, z], [x + end * 0.2, y + 0.24, z + side * 0.16], 0.15, 0.13, tint);
        const [u, v] = point(end, 1, 0);
        beam(out, 'tile', [u - end * 0.11, v, 0], [u + end * 0.15, v + 0.35, 0], 0.17, 0.18, tint);
      }
    }
    if (detail < 3) continue;
    const tileEnds = Math.floor(width / 0.32);
    for (let i = 1; i < tileEnds; i++) {
      const u = (2 * i) / tileEnds - 1;
      const [x, y, z] = point(u, 0, side);
      const tip = point(u, 0.034, side);
      beam(out, 'tile', [x, y + 0.016, z + side * 0.041], tip, 0.085, 0.085, tint);
    }
  }
}

function gatehouse(out, gate, detail) {
  const { width, depth, bays, step, lintel, grade, east, courtLions, portalShift } = gate;
  const body = frame(out, [0, 0], grade, 0);
  podium(body, gate, detail);
  const half = (step * bays) / 2;
  const posts = Array.from({ length: bays + 1 }, (_, i) => -half + step * i);
  const firstPortal = (bays - 3) / 2;
  const lastPortal = firstPortal + 3;
  const lowerPosts = posts.map((x, i) => (i > firstPortal && i < lastPortal ? x + portalShift : x));
  const postDepth = depth * 0.35;
  gatePosts(body, lowerPosts, postDepth, 0, lintel, detail);
  for (const zSign of [-1, 1]) {
    const z = zSign * (postDepth - 0.39);
    for (const xSign of [-1, 1]) {
      const start = 1.5 * step;
      box(
        body,
        'plaster',
        [Math.min(xSign * start, xSign * half), 0, z - 0.25],
        [Math.max(xSign * start, xSign * half), east ? 1.02 : lintel - 0.15, z + 0.25],
        east ? stone : red,
      );
      for (let i = 2; i < (bays + 1) / 2; i++)
        panel(
          body,
          xSign * step * i,
          z,
          step * 0.83,
          east ? 1.02 : 0.62,
          lintel - 0.41,
          detail,
          east ? gold : turquoise,
        );
    }
    if (east)
      for (let i = firstPortal; i < lastPortal; i++) {
        const a = lowerPosts[i],
          b = lowerPosts[i + 1];
        openDoor(body, a + 0.24, z, (b - a) * 0.39, lintel - 0.36, -1, zSign, detail);
        openDoor(body, b - 0.24, z, (b - a) * 0.39, lintel - 0.36, 1, zSign, detail);
      }
  }
  const sideY = east ? lintel - 0.22 : lintel - 0.08;
  for (const side of [-1, 1]) {
    const x = side * half;
    box(
      body,
      'plaster',
      [x - 0.18, 0, -postDepth],
      [x + 0.18, sideY, postDepth],
      east ? red : stone,
    );
  }
  let roofY = lintel + 0.58;
  if (!east) {
    const upper = lintel + 0.32;
    balcony(body, width, depth, upper, detail);
    const upperPosts = detail === 0 ? posts.filter((_, i) => i % 2 === 0 || i === bays) : posts;
    gatePosts(body, upperPosts, postDepth, upper, upper + 2.75, detail);
    for (const sign of [-1, 1]) {
      const z = sign * postDepth * 0.66;
      if (detail === 0)
        panel(body, 0, z, 2 * half - 0.13, upper + 0.06, upper + 2.66, detail, turquoise);
      else
        for (let i = 0; i < bays; i++) {
          const x = -half + (i + 0.5) * step;
          panel(body, x, z, step - 0.13, upper + 0.06, upper + 2.66, detail, turquoise);
        }
    }
    roofY = upper + 3.15;
  }
  const plaqueY = east ? lintel + 0.19 : roofY - 0.9;
  box(
    body,
    'enamel',
    [-0.94, plaqueY - 0.21, postDepth + 0.24],
    [0.94, plaqueY + 0.21, postDepth + 0.36],
    gold,
  );
  box(
    body,
    'timber',
    [-0.87, plaqueY - 0.147, postDepth + 0.35],
    [0.87, plaqueY + 0.147, postDepth + 0.384],
    east ? indigo : dark,
  );
  entranceRoof(body, width * 1.065, depth * 1.035, roofY, east, detail);
  for (const lion of courtLions) guardian(out, lion, detail);
}

function dutyWing(out, site, detail) {
  const { center, width, depth, angle } = site.frame;
  const body = frame(out, center, site.grade + 0.31, angle);
  solid(out, 'stone', site.outline, site.toe, site.grade + 0.31, granite);
  if (detail === 0)
    box(
      body,
      'plaster',
      [-width * 0.43, 0, -depth * 0.39],
      [width * 0.43, 2.67, depth * 0.39],
      red,
    );
  else
    courtBay(body, width, depth, 0, 2.6, Math.max(3, Math.round(width / 3)), detail, {
      wall: true,
      frontScreen: true,
    });
  courtRoof(body, width * 1.025, depth * 1.03, 2.82, 1.38, roofs.grey, detail, true, 0.25);
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  gatehouse(out, layout.entrance, detail);
  for (const site of layout.sites.filter((site) => site.role === 'duty-wing'))
    dutyWing(out, site, detail);
}
