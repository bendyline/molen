import {
  cross,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97 },
  carved: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.95 },
  vault: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.97 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.99 },
  ground: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98 },
  bark: { slot: 'wall', graph: 'wood_log', roughness: 0.98 },
  canopy: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.98 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = (x, y, z) => F.P(x, y, z);
const xz = ([x, , z]) => [x, z];
const world = ([x, z]) => xz(P(x, 0, z));
const sand = rgb('948f7b');
const rubble = rgb('817e69');
const pale = rgb('a09a80');
const shaded = rgb('6b685c');
const moss = rgb('707e4f');
const ground = rgb('999377');
const bark = rgb('c6b99a');
const barkShade = rgb('a6997e');
const greens = ['55613d', '647147', '747c50', '4a5535'].map(rgb);
const tau = 2 * Math.PI;

function block(out, slot, ring, y, Y, color) {
  extrude(out, slot, ring, y, Y, color, { top: false });
  cap(out, slot, ring, Y, color);
}
function rect(f, u, U, d, D) {
  return [f.P(u, 0, d), f.P(U, 0, d), f.P(U, 0, D), f.P(u, 0, D)].map(xz);
}
function box(out, slot, u, U, y, Y, d, D, c) {
  fbox(out, slot, F, u, U, y, Y, d, D, c);
}

function roofPiece(out, f, u, U, g, w, detail, weathered) {
  const n = detail < 3 ? 3 : 5;
  const h = w * 0.48;
  const y = g + 2.67;
  const bump = weathered ? 0.14 : 0;
  const arc = Array.from({ length: n + 1 }, (_, i) => {
    const angle = (Math.PI * i) / n;
    return [(-(1 - Math.cos(angle)) * w) / 2, y + h * Math.sin(angle)];
  });
  for (let i = 1; i < arc.length; i++) {
    const [a, y] = arc[i - 1],
      [b, Y] = arc[i];
    const t = weathered && i % 3 !== 0 ? moss : i % 2 === 0 ? sand : shaded;
    quad4(out, 'vault', f.P(u, y, a), f.P(U, y, a), f.P(U, Y, b), f.P(u, Y, b), t);
    if (detail === 3) {
      quad4(
        out,
        'rock',
        f.P(u, Y - 0.26, b),
        f.P(U, Y - 0.26, b),
        f.P(U, y - 0.26, a),
        f.P(u, y - 0.26, a),
        shaded,
      );
      if (i === n || i === 1) {
        fbox(
          out,
          'carved',
          f,
          u,
          U,
          Math.min(y, Y) - 0.21 - bump,
          Math.min(y, Y) - 0.04,
          Math.min(a, b) + 0.018,
          Math.min(a, b) + 0.106,
          pale,
        );
      }
    }
  }
}

function gallery(out, f, u, U, g, w, detail, damage) {
  if (U - u < 1.04) return;
  fbox(out, 'rubble', f, u, U, g - 1.24, g + 0.34, -w - 0.12, 0.16, rubble);
  if (detail > 1) fbox(out, 'carved', f, u, U, g + 0.22, g + 0.47, -w - 0.16, 0.21, sand);
  if (detail < 2) {
    fbox(out, 'rock', f, u, U, g + 0.43, g + 2.65, -w, -0.14, shaded);
    roofPiece(out, f, u, U, g, w, detail, damage);
    return;
  }
  const count = Math.max(2, Math.round((U - u) / (detail === 3 ? 2.91 : 6.61)));
  const stride = (U - u) / count;
  for (let i = 0; i <= count; i++) {
    const x = u + i * stride;
    if (i < count) {
      const gap = damage && i % 7 === 2;
      if (!gap) roofPiece(out, f, x, x + stride, g, w, detail, damage && i % 3 !== 0);
      if (i % 6 !== 3)
        fbox(
          out,
          'rock',
          f,
          x + 0.025,
          x + stride - 0.02,
          g + 0.42,
          g + 2.73,
          -w,
          -w + 0.32,
          shaded,
        );
    }
    fbox(out, 'carved', f, x - 0.195, x + 0.196, g + 0.4, g + 2.69, -0.474, -0.091, pale);
    if (detail > 2) {
      fbox(out, 'carved', f, x - 0.258, x + 0.26, g + 0.39, g + 0.62, -0.536, -0.034, sand);
      fbox(out, 'carved', f, x - 0.247, x + 0.247, g + 2.43, g + 2.71, -0.526, -0.039, sand);
    }
  }
  fbox(out, 'carved', f, u, U, g + 2.64, g + 2.88, -0.29, 0.084, pale);
}

function wall(out, f, u, U, g, width, detail) {
  fbox(out, 'rubble', f, u, U, g - 2.44, g + 0.32, -width - 0.09, 0.065, rubble);
  fbox(out, 'rock', f, u, U, g + 0.26, g + 1.95, -width, 0, shaded);
  if (detail > 0) fbox(out, 'vault', f, u, U, g + 1.98, g + 2.34, -width - 0.04, 0.046, moss);
  if (detail === 3) {
    const count = Math.round((U - u) / 6.2);
    for (let i = 0; i < count; i++) {
      const a = u + ((i + 0.5) * (U - u)) / count;
      const dy = 0.15 + 0.08 * Math.sin(i * 1.37);
      fbox(
        out,
        'rubble',
        f,
        a - 0.48,
        a + 0.71,
        g + 2.22,
        g + 2.28 + dy,
        -width - 0.082,
        0.075,
        i % 3 === 0 ? moss : pale,
      );
    }
  }
}

function pediment(out, f, u, y, d, w, height, detail) {
  const slices = detail === 3 ? 6 : 3;
  const h = (t) => y + height * (0.1 + 0.9 * Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.71));
  for (let i = 0; i < slices; i++) {
    const t = i / slices,
      q = (i + 1) / slices;
    const a = u + (t - 0.5) * w,
      b = u + (q - 0.5) * w;
    const h0 = h(t),
      h1 = h(q);
    quad4(out, 'carved', f.P(a, y, d), f.P(b, y, d), f.P(b, h1, d), f.P(a, h0, d), pale);
    if (detail > 1) {
      quad4(
        out,
        'carved',
        f.P(a, h0 - 0.13, d + 0.051),
        f.P(b, h1 - 0.13, d + 0.051),
        f.P(b, h1 + 0.021, d + 0.05),
        f.P(a, h0 + 0.021, d + 0.05),
        moss,
      );
    }
  }
}

function prasatTop(out, f, u, d, g, half, height, detail) {
  const n = [2, 2, 4, 7][detail];
  const setback = (i) => half * (1 - 0.82 * Math.pow(i / n, 0.81));
  const rise = (i) => height * Math.pow(i / n, 0.85);
  for (let i = 0; i < n; i++) {
    const radius = setback(i) * (detail > 1 && i > 0 ? 1.075 : 1);
    const smaller = setback(i + 1) * 0.99;
    const y = g + rise(i);
    const deck = rise(i + 1) - rise(i);
    const eave = detail < 2 ? y : y + 0.34 * deck;
    if (detail > 1) {
      fbox(
        out,
        'rock',
        f,
        u - radius,
        u + radius,
        y - 0.07,
        eave,
        d - radius,
        d + radius,
        i % 3 === 1 ? moss : sand,
      );
    }
    const ramp = [
      f.P(u - radius, eave, d + radius),
      f.P(u + radius, eave, d + radius),
      f.P(u + smaller, y + deck, d + smaller),
      f.P(u - smaller, y + deck, d + smaller),
      f.P(u - radius, eave, d - radius),
      f.P(u + radius, eave, d - radius),
      f.P(u + smaller, y + deck, d - smaller),
      f.P(u - smaller, y + deck, d - smaller),
    ];
    const [a, b, c, e, A, B, C, E] = ramp;
    quad4(out, 'vault', a, b, c, e, i % 2 === 0 ? sand : shaded);
    quad4(out, 'vault', b, B, C, c, shaded);
    quad4(out, 'vault', B, A, E, C, i % 2 === 0 ? moss : sand);
    quad4(out, 'vault', A, a, e, E, sand);
    if (detail > 1 && i < n - 1) {
      for (const s of [-1, 1]) {
        const q = u + s * radius * 0.72;
        fbox(
          out,
          'carved',
          f,
          q - 0.153,
          q + 0.155,
          y + 0.13 * deck,
          y + 0.64 * deck,
          d + radius * 0.71,
          d + radius * 0.945,
          pale,
        );
      }
      pediment(
        out,
        f,
        u,
        y + deck * 0.32,
        d + radius * 0.94,
        radius * 0.99,
        deck * 0.51,
        detail === 3 ? 2 : 1,
      );
    }
  }
  const top = g + height;
  fbox(
    out,
    'rock',
    f,
    u - half * 0.183,
    u + half * 0.183,
    top - 0.13,
    top + 0.27,
    d - half * 0.183,
    d + half * 0.183,
    moss,
  );
}

function portal(out, f, u, y, w, height, depth, detail, ruin = false) {
  const half = w / 2;
  const open = w * 0.49;
  const h = height * 0.39;
  const d = depth * 0.55;
  for (const [a, b] of [
    [u - half, u - open / 2],
    [u + open / 2, u + half],
  ]) {
    fbox(out, 'rock', f, a, b, y - 0.72, y + h, -d, d * 0.36, sand);
    if (detail > 1)
      fbox(out, 'carved', f, a - 0.12, b + 0.12, y - 0.02, y + 0.24, -d - 0.08, d * 0.38, pale);
  }
  fbox(
    out,
    'carved',
    f,
    u - half - 0.1,
    u + half + 0.11,
    y + h - 0.08,
    y + h + 0.33,
    -d - 0.15,
    d * 0.41,
    pale,
  );
  if (detail > 0) {
    if (detail > 1) {
      for (const s of [-1, 1]) {
        const x = u + s * (open / 2 + 0.1);
        fbox(
          out,
          'carved',
          f,
          x - 0.087,
          x + 0.079,
          y + 0.2,
          y + h + 0.02,
          d * 0.31,
          d * 0.51,
          pale,
        );
      }
    }
    pediment(out, f, u, y + h + 0.21, d * 0.49, w * 0.98, height * 0.24, detail);
  }
  if (ruin && detail === 0) return;
  const offset = ruin ? 0.86 : 1;
  prasatTop(out, f, u, -d * 0.22, y + h + 0.23, half * 0.77, height * 0.59 * offset, detail);
}

function perimeter(out, stage, index, detail) {
  const { halfWidth: W, halfDepth: D, width, grade, gate, open } = stage;
  const lines = [
    [-W, -D],
    [W, -D],
    [W, D],
    [-W, D],
  ].map(world);
  const ring = outwardRing(lines);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]),
      m = f.length / 2;
    const half = open + 1.79;
    const outer = index === 0;
    if (detail === 0) {
      for (const [u, U] of [
        [0, m - half],
        [m + half, f.length],
      ]) {
        fbox(
          out,
          outer ? 'rubble' : 'vault',
          f,
          u,
          U,
          grade - 1.28,
          grade + (outer ? 1.85 : 3.13),
          -width,
          0.06,
          outer ? rubble : sand,
        );
      }
      if (index === 1 || (index === 0 && i % 2 === 1))
        portal(out, f, m, grade, open * 1.72, gate, width + 0.65, detail);
      continue;
    }
    for (const [j, [u, U]] of [
      [0, m - half],
      [m + half, f.length],
    ].entries()) {
      if (outer) wall(out, f, u, U, grade, width, detail);
      else gallery(out, f, u, U, grade, width, detail, (i + j + index) % 3 === 1);
    }
    portal(
      out,
      f,
      m,
      grade,
      open * 1.65,
      gate,
      width + 0.65,
      detail,
      !outer && i % 2 === 1 && index > 1,
    );
  }
}

function nativeMonuments(out, detail) {
  for (const { outline, kind, plan, grade } of site.monuments) {
    const w = Math.min(...plan.map((p) => p[0])),
      e = Math.max(...plan.map((p) => p[0]));
    const n = Math.min(...plan.map((p) => p[1])),
      s = Math.max(...plan.map((p) => p[1]));
    const u = (w + e) / 2,
      d = (n + s) / 2;
    if (detail > 0) block(out, 'rubble', outline, grade - 1.1, grade + 0.42, rubble);
    const footprint = (slot, low, high, color) =>
      detail === 0
        ? box(out, slot, w, e, low, high, n, s, color)
        : block(out, slot, outline, low, high, color);
    if (kind === 'hall') {
      if (detail === 0) {
        footprint('rock', grade - 1.1, grade + 2.6, sand);
        continue;
      }
      const pieces = [
        [w, e, n],
        [w, e, s - 3.75],
        [w + 1.48, w + 12.49, d - 1.52],
        [e - 10.19, e - 0.97, d - 1.52],
      ];
      for (const [j, [a, b, c]] of pieces.entries()) {
        const f = facade(world([a, c]), site.frame.along);
        if (detail < 2)
          fbox(out, 'rock', f, 0, b - a, grade + 0.42, grade + 3.23, -2.65, 0.068, sand);
        else gallery(out, f, 0, b - a, grade, 3.38, detail, j % 2 === 1);
      }
      const front = facade(world([e, d]), [site.frame.along[1], -site.frame.along[0]]);
      portal(out, front, 0, grade, 4.65, 6.77, 2.69, detail, true);
    } else {
      footprint('rock', detail === 0 ? grade - 1.1 : grade + 0.42, grade + 2.51, sand);
      if (detail > 1) {
        const f = facade(world([u, d]), site.frame.along);
        prasatTop(
          out,
          f,
          0,
          0,
          grade + 2.49,
          Math.min(e - w, s - n) * 0.35,
          detail > 1 ? 2.83 : 1.58,
          detail > 1 ? 2 : 1,
        );
      }
    }
  }
}

function sanctuary(out, detail) {
  const c = facade(world([0, 0]), site.frame.along);
  fbox(out, 'rubble', c, -3.16, 3.16, 0.03, 0.72, -3.22, 3.22, rubble);
  portal(out, c, 0, 0.67, 5.97, 14.68, 5.41, detail);
  for (const [i, [u, d]] of [
    [-6.43, -7.25],
    [6.41, -7.04],
    [-6.42, 7.26],
    [6.4, 7.04],
  ].entries()) {
    const f = facade(world([u, d]), site.frame.along);
    fbox(out, 'rock', f, -1.83, 1.83, 0.44, 2.75, -1.81, 1.81, i % 2 === 0 ? sand : shaded);
    if (detail > 0) prasatTop(out, f, 0, 0, 2.67, 1.77, 3.97 + i * 0.44, detail > 1 ? 2 : 1);
  }
}

function causeway(out, detail) {
  box(out, 'ground', -57.81, 58.03, -2.13, -0.79, -55.5, 55.53, ground);
  box(out, 'rubble', 57.03, 85.99, -2.44, -0.44, -1.88, 1.88, pale);
  box(out, 'rubble', -85.44, -56.26, -2.48, -0.58, -1.81, 1.81, sand);
  for (const d of [-1.94, 1.94]) {
    box(out, 'carved', 57.77, 84.34, -0.4, 0.28, d - 0.13, d + 0.13, pale);
    if (detail > 1)
      for (let i = 0; i < 8; i++) {
        const u = 58.55 + i * 3.46;
        box(out, 'carved', u - 0.16, u + 0.16, -0.56, 0.33, d - 0.23, d + 0.23, sand);
      }
  }
  if (detail > 1) {
    for (const [u, d] of [
      [-2.0, 4.66],
      [23.81, -9.3],
      [-21.84, 8.25],
      [24.27, 9.6],
      [59.23, -8.33],
    ]) {
      const count = detail === 3 ? 13 : detail === 2 ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const x = u + Math.sin(i * 3.88) * 1.96;
        const z = d + Math.cos(i * 1.25) * 1.73;
        const w = 0.41 + 0.1 * (i % 4),
          h = 0.35 + 0.14 * (i % 4);
        const rot = i * 1.395;
        const f = facade(world([x, z]), [Math.cos(rot), Math.sin(rot)]);
        fbox(
          out,
          'rubble',
          f,
          -w,
          w,
          -0.74,
          -0.66 + h,
          -w * 0.61,
          w * 0.71,
          i % 3 === 0 ? moss : sand,
        );
      }
    }
  }
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
function woodyTube(out, path, sides, tint) {
  const pts = path.map(([x, y, z, r]) => ({ p: P(x, y, z), r }));
  let up;
  const ring = pts.map(({ p, r }, i) => {
    const tangent = normalize(
      sub(pts[Math.min(pts.length - 1, i + 1)].p, pts[Math.max(0, i - 1)].p),
    );
    const guide = up ?? (Math.abs(tangent[2]) > 0.88 ? [1, 0, 0] : [0, 0, 1]);
    const right = normalize(cross(guide, tangent));
    up = cross(tangent, right);
    return Array.from({ length: sides }, (_, j) => {
      const a = (j * tau) / sides;
      const lump = 1 + 0.12 * Math.sin(a * 3.0 + i * 0.2);
      return p.map((v, k) => v + r * lump * (Math.cos(a) * right[k] + Math.sin(a) * up[k]));
    });
  });
  for (let i = 1; i < ring.length; i++) {
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      const a = ring[i - 1][j],
        b = ring[i - 1][k],
        c = ring[i][k],
        d = ring[i][j];
      tri(out, 'bark', a, b, c, tint);
      tri(out, 'bark', a, c, d, tint);
    }
  }
}

function rootedTree(out, t, detail) {
  const {
    center: [x, z],
    grade: g,
    roof,
    height: H,
    crown: c,
    drift: [dx, dz],
    wall: [wx, wz],
  } = t;
  const sides = [3, 5, 8, 9][detail];
  const trunk = [
    [x, g - 0.22, z, 0.73],
    [x + 0.25 * dx, g + 4.51, z + 0.3 * dz, 0.69],
    [x + 0.61 * dx, g + H * 0.57, z + 0.63 * dz, 0.53],
    [x + dx, g + H * 0.89, z + dz, 0.27],
    [x + dx * 1.21, g + H + 0.37, z + dz * 1.16, 0.095],
  ];
  woodyTube(out, detail === 0 ? [trunk[0], trunk[2], trunk[4]] : trunk, sides, bark);
  if (detail > 0) {
    const reachX = wx - x,
      reachZ = wz - z;
    const reach = Math.hypot(reachX, reachZ);
    const towardWall = Math.atan2(reachZ, reachX);
    const span = detail === 1 ? 2 : detail === 2 ? 4 : 6;
    for (let j = 0; j < span; j++) {
      const angle = towardWall + (j * tau) / span,
        s = Math.sin(angle),
        k = Math.cos(angle);
      const taper = j % 2 === 0 ? 0.44 : 0.33;
      const length = j === 0 ? reach + 2.43 : 2.9 + 0.39 * (j % 3);
      const shoulder = j === 0 ? Math.max(roof + 0.68, g + 3.15) : g + 2.46 + 0.22 * (j % 3);
      const at = (t, y, r) => [x + k * length * t, y, z + s * length * t, r];
      const root = [
        [x + dx * 0.14, g + 5.88 + 0.27 * (j % 3), z + dz * 0.17, taper * 0.86],
        at(0.19, shoulder + 0.52, taper),
        at(0.55, shoulder - 0.08, taper * 0.68),
        at(0.7, g + 0.77, taper * 0.53),
        at(0.84, g + 0.14, taper * 0.34),
        at(1, g - 0.19, 0.052),
      ];
      woodyTube(out, root, sides, j % 2 === 0 ? bark : barkShade);
      if (detail > 2) {
        const [u, y, d, r] = root.at(-3);
        woodyTube(
          out,
          [
            [u, y + 0.021, d, r * 0.66],
            [u + k * 1.5, g + 0.25, d + s * 1.66, r * 0.46],
            [u + k * 3.7 + s * 1.26, g - 0.055, d + s * 3.07 - k * 0.95, 0.05],
          ],
          6,
          barkShade,
        );
      }
    }
  }
  const count = [1, 2, 5, 8][detail];
  for (let i = 0; i < count; i++) {
    const a = i * 2.39;
    const h = H * (0.9 + 0.102 * Math.sin(a) + 0.035 * Math.cos(i));
    const r = c * (detail === 0 ? 1.02 : 0.55 + 0.19 * Math.cos(a));
    const x0 = x + dx + Math.cos(a) * c * (detail === 0 ? 0.05 : 0.62);
    const z0 = z + dz + Math.sin(a) * c * (detail === 0 ? 0.04 : 0.58);
    if (detail > 1) {
      woodyTube(
        out,
        [
          [x + dx * 0.65, g + H * 0.66, z + dz * 0.6, 0.24],
          [x0 - dx * 0.19, g + H * 0.8, z0 - dz * 0.17, 0.14],
          [x0, g + h - 0.39, z0, 0.032],
        ],
        6,
        barkShade,
      );
    }
    lathe(
      out,
      'canopy',
      world([x0, z0]),
      detail === 0
        ? [
            [g + h - r * 0.55, 0, 0],
            [g + h + r * 0.12, r, r * 0.88],
            [g + h + r * 0.66, 0, 0],
          ]
        : [
            [g + h - r * 0.55, 0, 0],
            [g + h - r * 0.21, r * 0.88, r * 0.73],
            [g + h + r * 0.14, r, r * 0.88],
            [g + h + r * 0.39, r * 0.53, r * 0.55],
            [g + h + r * 0.66, 0, 0],
          ],
      [4, 5, 8, 11][detail],
      greens[i % greens.length],
      { rotation: i * 0.56 },
    );
  }
}

function build(out, detail) {
  causeway(out, detail);
  for (const [i, stage] of site.enclosures.entries()) perimeter(out, stage, i, detail);
  nativeMonuments(out, detail);
  sanctuary(out, detail);
  for (const t of site.trees) rootedTree(out, t, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
