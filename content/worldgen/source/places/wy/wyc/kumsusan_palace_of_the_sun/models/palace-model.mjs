/** Kumsusan's six mapped stone masses and north forecourt. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_marble', roughness: 0.83 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.89 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.16 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.63, metallic: 0.43 },
  garden: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.94 },
  water: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.3 },
};
const palette = {
  marble: 'b8bfc3',
  lightStone: 'd0d2cb',
  shadowStone: '9aa4a7',
  niche: '8f9da2',
  border: 'bbc6c8',
  granite: 'a7aba4',
  paver: 'b7b7ae',
  dark: '576166',
  door: '4e6368',
  black: '4b4a45',
  grass: '758b50',
  hedge: '526d36',
  leaf: '70864b',
  leafDark: '556b3e',
  bark: '77634c',
  redFlower: 'ba584c',
  pinkFlower: 'c57c84',
  creamFlower: 'e0ceaa',
  pool: '739eae',
  spray: 'b1c8ca',
  gold: 'bd9353',
  darkBronze: '80604a',
  bronze: '986c4e',
  redStone: '97594c',
  portraitBackground: 'b9c9c2',
  suit: '4f5b70',
  jacket: '888572',
  hair: '4e4c46',
  skin: 'c2a68a',
  skinLight: 'd2b79d',
  skinShade: '9e7d6a',
  tie: '8c4d48',
  white: 'e2ded3',
  flagBlue: '53729f',
  flagRed: 'ab5552',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    hex.match(/../g).map((s) => {
      const x = parseInt(s, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  north = [0, 0, -1],
  mix = (a, b, t) => a + (b - a) * t;
const lift = ([x, z], y) => [x, y, z];
function tri(out, slot, tint, points, want) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((acc, v, i) => acc + v * want[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, colors[tint]);
}
function quad(out, slot, tint, [a, b, c, d], want) {
  tri(out, slot, tint, [a, b, c], want);
  tri(out, slot, tint, [a, c, d], want);
}
function block(out, slot, tint, x, y, z, w, h, d) {
  box(out, slot, [x, y, z], [x + w, y + h, z + d], colors[tint]);
}
function elevation(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((n, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (n - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return mix(
    mix(heights[k], heights[k + 1], a),
    mix(heights[k + size[0]], heights[k + size[0] + 1], a),
    b,
  );
}
function roof(out, slot, tint, outline, y) {
  const indices = earcut(outline.flat(), undefined, 2);
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => lift(outline[k], y)),
      up,
    );
}
function pavingWithOpenings(out, outline, holes, y) {
  const points = [...outline, ...holes.flat()],
    starts = [];
  let offset = outline.length;
  for (const hole of holes) {
    starts.push(offset);
    offset += hole.length;
  }
  const indices = earcut(points.flat(), starts, 2);
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      'stone',
      'paver',
      indices.slice(i, i + 3).map((k) => lift(points[k], y)),
      up,
    );
}
function frame(outline, i) {
  const a = outline[i],
    b = outline[(i + 1) % outline.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  const area = outline.reduce((s, [x, z], j) => {
    const [u, v] = outline[(j + 1) % outline.length];
    return s + x * v - z * u;
  }, 0);
  const sign = Math.sign(area),
    normal = [(sign * dz) / l, 0, (-sign * dx) / l];
  const at = (u, y, depth = 0) => [
    a[0] + (u * dx) / l + normal[0] * depth,
    y,
    a[1] + (u * dz) / l + normal[2] * depth,
  ];
  return { at, normal, l };
}
function panel(out, edge, slot, tint, x, y, w, h, depth = 0) {
  const { at, normal } = edge;
  quad(
    out,
    slot,
    tint,
    [at(x, y, depth), at(x + w, y, depth), at(x + w, y + h, depth), at(x, y + h, depth)],
    normal,
  );
}
function projectingPanel(out, edge, slot, tint, x, y, w, h, depth) {
  panel(out, edge, slot, tint, x, y, w, h, depth);
  const { at } = edge,
    across = at(1, y).map((v, i) => v - at(0, y)[i]);
  for (const s of [-1, 1]) {
    const a = s < 0 ? x : x + w;
    quad(
      out,
      slot,
      tint,
      [at(a, y), at(a, y, depth), at(a, y + h, depth), at(a, y + h)],
      across.map((v) => s * v),
    );
  }
  quad(
    out,
    slot,
    tint,
    [at(x, y + h), at(x + w, y + h), at(x + w, y + h, depth), at(x, y + h, depth)],
    up,
  );
}
function niche(out, edge, x, y, w, h, d) {
  const rise = Math.min(w * 0.36, h * 0.31),
    base = y + h - rise,
    n = d === 1 ? 4 : d === 2 ? 6 : 10;
  const arch = (i, pad = 0) => [
    x + w / 2 + Math.cos((i * Math.PI) / n) * (w / 2 + pad),
    base + Math.sin((i * Math.PI) / n) * (rise + pad),
  ];
  const at = (p, z) => edge.at(p[0], p[1], z);
  panel(out, edge, 'wall', 'niche', x, y, w, h - rise, 0.022);
  const center = edge.at(x + w / 2, base, 0.023);
  for (let i = 0; i < n; i++) {
    const a = arch(i),
      b = arch(i + 1);
    tri(out, 'wall', 'niche', [center, at(a, 0.023), at(b, 0.023)], edge.normal);
    quad(
      out,
      'wall',
      'border',
      [at(a, 0.12), at(b, 0.12), at(arch(i + 1, 0.18), 0.12), at(arch(i, 0.18), 0.12)],
      edge.normal,
    );
  }
  for (const k of [x - 0.17, x + w]) panel(out, edge, 'wall', 'border', k, y, 0.17, h - rise, 0.12);
  if (d >= 3) {
    panel(out, edge, 'wall', 'border', x - 0.12, y - 0.16, w + 0.24, 0.14, 0.16);
    projectingPanel(
      out,
      edge,
      'wall',
      'shadowStone',
      x + w * 0.45,
      base - 0.24,
      w * 0.1,
      0.5,
      0.16,
    );
  }
}
function envelope(out, shell, i, d) {
  const { outline, base, height } = shell,
    y0 = i === 0 ? -15.6 : base;
  const color = i === 0 ? 'granite' : 'marble',
    roofColor = i === 0 ? 'granite' : 'lightStone';
  roof(out, i === 0 ? 'stone' : 'wall', roofColor, outline, height);
  for (let j = 0; j < outline.length; j++) {
    const edge = frame(outline, j),
      { l, normal, at } = edge;
    const portico = i === 0 && l > 73 && normal[2] < -0.98 && at(l * 0.5, 0)[2] < -90;
    const plinth = i === 0 ? y0 : base;
    if (portico) {
      panel(out, edge, 'wall', 'shadowStone', 0, plinth, l, height - plinth, -6.65);
      const tangent = at(1, 0).map((v, k) => v - at(0, 0)[k]);
      for (const s of [-1, 1]) {
        const a = s < 0 ? 0 : l;
        quad(
          out,
          'wall',
          'marble',
          [at(a, plinth), at(a, plinth, -6.65), at(a, height, -6.65), at(a, height)],
          tangent.map((v) => -s * v),
        );
      }
      panel(out, edge, 'wall', 'lightStone', 0, 7.5, l, height - 7.5);
      if (d === 0) continue;
      for (let a = 0; a <= 12; a++) {
        const x = 2.7 + ((l - 5.4) * a) / 12;
        const p = at(x, 0.32, -0.48);
        block(out, 'wall', 'marble', p[0] - 0.6, 0.32, p[2] - 0.58, 1.2, 7.2, 1.16);
        if (d >= 2) {
          block(out, 'wall', 'lightStone', p[0] - 0.79, 0.32, p[2] - 0.75, 1.58, 0.42, 1.5);
          block(out, 'wall', 'border', p[0] - 0.84, 7.11, p[2] - 0.75, 1.68, 0.4, 1.5);
        }
      }
      for (const a of [0.27, 0.5, 0.73]) {
        panel(out, edge, 'metal', 'door', l * a - 2.0, 0.35, 4.0, 5.72, -6.62);
        if (d >= 2) panel(out, edge, 'stone', 'border', l * a - 0.1, 0.35, 0.2, 5.72, -6.56);
      }
      continue;
    }
    panel(out, edge, i === 0 ? 'stone' : 'wall', color, 0, plinth, l, height - plinth);
    if (d === 0 || l < 2.8) continue;
    panel(out, edge, 'wall', 'shadowStone', 0, height - 1.35, l, 0.5, 0.029);
    panel(out, edge, 'wall', 'lightStone', 0, height - 0.82, l, 0.68, 0.04);
    if (d < 2 || l < 4.7) continue;
    const count = Math.max(1, Math.round(l / (i === 0 ? 6.1 : 5.6))),
      bay = l / count;
    const blind = i === 1 || i === 3 || i === 5;
    for (let k = 0; k < count; k++) {
      const x = (k + 0.5) * bay;
      if (i === 4 && normal[2] < -0.98 && l > 47) continue;
      if (i === 0 && normal[2] > 0.25 && at(x, 0)[2] > 15) continue;
      if (blind)
        niche(
          out,
          edge,
          x - bay * 0.3,
          base + 1.0,
          bay * 0.6,
          Math.max(2.1, (height - base) * 0.68),
          d,
        );
      else if (i === 0) {
        panel(out, edge, 'wall', 'border', x - bay * 0.3, 2.04, bay * 0.6, 4.85, 0.055);
        panel(out, edge, 'metal', 'door', x - bay * 0.26, 2.24, bay * 0.52, 4.36, 0.062);
        if (d >= 3) panel(out, edge, 'wall', 'border', x - 0.08, 2.24, 0.16, 4.36, 0.074);
      } else
        panel(
          out,
          edge,
          'wall',
          'shadowStone',
          x - bay * 0.32,
          base + 0.85,
          bay * 0.64,
          height - base - 2.9,
          0.037,
        );
      if (d >= 3 && k < count - 1)
        projectingPanel(
          out,
          edge,
          'wall',
          'border',
          (k + 1) * bay - 0.22,
          base + 0.28,
          0.44,
          height - base - 1.52,
          0.37,
        );
    }
  }
  if (d >= 1 && (i !== 0 || d >= 3)) {
    beamPath(
      out,
      'wall',
      outline.map((p) => lift(p, height - 0.34)),
      0.78,
      0.57,
      colors.lightStone,
      true,
    );
    if (d >= 3)
      beamPath(
        out,
        'wall',
        outline.map((p) => lift(p, height - 0.93)),
        0.5,
        0.27,
        colors.shadowStone,
        true,
      );
  }
  if (d >= 3 && i !== 0)
    for (let j = 0; j < outline.length; j++) {
      const edge = frame(outline, j);
      if (edge.l < 3) continue;
      const n = Math.max(1, Math.floor(edge.l / (d === 4 ? 1.18 : 2.4)));
      for (let k = 0; k < n; k++)
        projectingPanel(
          out,
          edge,
          'wall',
          'border',
          ((k + 0.5) * edge.l) / n - 0.19,
          height - 1.59,
          0.38,
          0.54,
          0.43,
        );
    }
}
function stair(out, d) {
  const { x0, x1, front, back, landingY } = layout.forecourt.stair;
  const start = layout.forecourt.terrace.height + 0.05;
  const count = d < 2 ? 4 : Math.max(5, Math.ceil((landingY - start) / 0.19));
  const span = back - front;
  for (let i = 0; i < count; i++) {
    const y = mix(start, landingY, (i + 1) / count);
    const z = front + (span * i) / count;
    block(
      out,
      'stone',
      i % 3 === 0 ? 'lightStone' : 'paver',
      x0,
      y - 0.28,
      z,
      x1 - x0,
      0.28,
      span / count + 0.028,
    );
    if (d >= 2)
      for (const x of [x0 - 0.8, x1]) {
        block(out, 'wall', 'marble', x, y - 0.33, z, 0.8, 0.91, span / count + 0.035);
      }
  }
  block(out, 'stone', 'paver', x0, landingY - 0.35, back, x1 - x0, 0.35, 7.15);
}
function terrace(out, d) {
  const { terrace, portals } = layout.forecourt;
  roof(out, 'stone', 'paver', terrace.outline, terrace.height);
  for (let i = 0; i < terrace.outline.length; i++) {
    const edge = frame(terrace.outline, i),
      { l, at, normal } = edge;
    const floor = (u) => {
      const [x, , z] = at(u, 0);
      return Math.min(terrace.height - 0.29, elevation(x, z) - 0.21);
    };
    quad(
      out,
      'stone',
      'granite',
      [at(0, floor(0)), at(l, floor(l)), at(l, terrace.height), at(0, terrace.height)],
      normal,
    );
  }
  for (const { outline } of portals) {
    roof(out, 'wall', 'lightStone', outline, 1.08);
    for (let i = 0; i < outline.length; i++) {
      const edge = frame(outline, i);
      panel(out, edge, 'wall', 'marble', 0, terrace.height, edge.l, 4.2);
      if (d >= 2 && edge.l > 20) {
        panel(out, edge, 'wall', 'border', 0, 0.8, edge.l, 0.22, 0.055);
        panel(out, edge, 'stone', 'granite', 0, terrace.height, edge.l, 0.34, 0.048);
        for (let x = 2.15; x < edge.l - 1.1; x += 4.25)
          panel(out, edge, 'wall', 'shadowStone', x, terrace.height + 0.38, 0.16, 3.34, 0.052);
      }
    }
  }
  if (d > 0) {
    const x = 46.2,
      w = 15.8,
      z0 = -136.0,
      z1 = -119.03;
    const low = elevation(x, z0) + 0.12,
      high = terrace.height;
    const count = d === 1 ? 5 : Math.max(8, Math.ceil((high - low) / 0.23));
    for (let i = 0; i < count; i++) {
      const y = mix(low, high, (i + 1) / count),
        z = mix(z0, z1, i / count),
        len = (z1 - z0) / count;
      block(out, 'stone', 'paver', x - w * 0.5, y - 0.28, z, w, 0.28, len + 0.043);
    }
  }
}
function portraits(out, d) {
  if (d < 1) return;
  const shell = layout.shells[4];
  const edges = shell.outline.map((_, i) => frame(shell.outline, i));
  const edge = edges.find((e) => e.l > 46 && e.normal[2] < -0.96);
  if (!edge) throw Error('Could not identify the north portrait wall');
  for (const [i, x] of [edge.l * 0.4, edge.l * 0.6].entries()) {
    const y = 17.76,
      w = 5.1,
      h = 6.2;
    projectingPanel(
      out,
      edge,
      'bronze',
      'darkBronze',
      x - w / 2 - 0.24,
      y - 0.24,
      w + 0.48,
      h + 0.48,
      0.35,
    );
    panel(out, edge, 'metal', 'portraitBackground', x - w / 2, y, w, h, 0.369);
    const silhouette = (coords, tint, depth) => {
      const points = coords.map(([u, v]) => edge.at(x + u * w, y + v * h, depth));
      const flat = earcut(coords.flat(), undefined, 2);
      for (let k = 0; k < flat.length; k += 3)
        tri(
          out,
          'metal',
          tint,
          flat.slice(k, k + 3).map((j) => points[j]),
          edge.normal,
        );
    };
    silhouette(
      [
        [-0.47, 0.02],
        [0.47, 0.02],
        [0.43, 0.17],
        [0.26, 0.28],
        [0.11, 0.34],
        [-0.14, 0.35],
        [-0.28, 0.28],
        [-0.44, 0.17],
      ],
      i === 0 ? 'suit' : 'jacket',
      0.379,
    );
    silhouette(
      [
        [-0.14, 0.35],
        [0.13, 0.35],
        [0.16, 0.24],
        [-0.1, 0.17],
        [-0.16, 0.25],
      ],
      i === 0 ? 'white' : 'jacket',
      0.385,
    );
    if (i === 0)
      silhouette(
        [
          [-0.03, 0.29],
          [0.06, 0.29],
          [0.1, 0.25],
          [0.04, 0.18],
          [-0.025, 0.1],
          [-0.05, 0.23],
        ],
        'tie',
        0.392,
      );
    silhouette(
      [
        [-0.12, 0.35],
        [-0.14, 0.52],
        [0.12, 0.53],
        [0.13, 0.35],
        [0.03, 0.31],
      ],
      'skinShade',
      0.395,
    );
    silhouette(
      [
        [-0.21, 0.69],
        [-0.18, 0.83],
        [-0.055, 0.89],
        [0.104, 0.855],
        [0.19, 0.76],
        [0.19, 0.62],
        [0.145, 0.53],
        [0.06, 0.455],
        [-0.075, 0.47],
        [-0.17, 0.535],
        [-0.205, 0.61],
      ],
      'skin',
      0.398,
    );
    silhouette(
      [
        [-0.21, 0.68],
        [-0.24, 0.81],
        [-0.17, 0.895],
        [-0.06, 0.928],
        [0.08, 0.913],
        [0.17, 0.87],
        [0.22, 0.8],
        [0.19, 0.74],
        [0.145, 0.81],
        [0.05, 0.826],
        [-0.14, 0.8],
      ],
      'hair',
      0.406,
    );
    if (d < 2) continue;
    silhouette(
      [
        [-0.13, 0.72],
        [-0.05, 0.72],
        [-0.04, 0.696],
        [-0.128, 0.69],
      ],
      'black',
      0.41,
    );
    silhouette(
      [
        [0.046, 0.712],
        [0.135, 0.706],
        [0.139, 0.682],
        [0.05, 0.683],
      ],
      'black',
      0.41,
    );
    silhouette(
      [
        [-0.027, 0.691],
        [0.04, 0.678],
        [0.063, 0.601],
        [0.022, 0.587],
        [-0.037, 0.598],
      ],
      'skinLight',
      0.41,
    );
    silhouette(
      [
        [-0.077, 0.55],
        [0.079, 0.552],
        [0.051, 0.528],
        [-0.037, 0.524],
      ],
      'skinShade',
      0.41,
    );
    if (i === 1) {
      for (const u of [-0.095, 0.095])
        panel(
          out,
          edge,
          'metal',
          'hair',
          x + (u - 0.062) * w,
          y + 0.704 * h,
          0.124 * w,
          0.023 * h,
          0.412,
        );
      panel(out, edge, 'metal', 'hair', x - 0.047 * w, y + 0.702 * h, 0.094 * w, 0.017 * h, 0.413);
    }
  }
}
function paths(out, d) {
  const step = d === 1 ? 20 : d === 2 ? 16 : 4;
  for (const [x, z, w, l] of layout.forecourt.walkways) {
    const nx = Math.ceil(w / step),
      nz = Math.ceil(l / step);
    const at = (i, j) => {
      const a = x + (w * i) / nx,
        b = z + (l * j) / nz;
      return [a, elevation(a, b) + 0.125, b];
    };
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        quad(out, 'stone', 'paver', [at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)], up);
  }
}
function cylinder(out, slot, tint, x, z, y, profile, sides, cap = true) {
  loft(
    out,
    slot,
    profile.map(([h, r]) => radialRing(y + h, r, r, sides, [x, z])),
    colors[tint],
    { cap },
  );
}
function statue(out, x, y, z, a, scale, d) {
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const p = (x0, y0, z0) => [
    x + scale * (x0 * c - z0 * s),
    y + scale * y0,
    z + scale * (x0 * s + z0 * c),
  ];
  const limb = (a, b, w, t) =>
    beam(out, 'bronze', p(...a), p(...b), w * scale, t * scale, colors.darkBronze);
  for (const sign of [-1, 1]) {
    limb([sign * 0.16, 0.2, 0], [sign * 0.15, 1.1, 0], 0.26, 0.28);
    limb([sign * 0.16, 0.12, -0.055], [sign * 0.16, 0.12, 0.23], 0.26, 0.16);
  }
  const sides = d === 4 ? 12 : d === 3 ? 8 : 6,
    bands = d === 2 ? 3 : 5;
  sphere(
    out,
    'bronze',
    p(0, 1.45, 0),
    [0.34 * scale, 0.48 * scale, 0.21 * scale],
    colors.bronze,
    sides,
    bands,
  );
  sphere(
    out,
    'bronze',
    p(0, 2.1, 0.018),
    [0.174 * scale, 0.225 * scale, 0.153 * scale],
    colors.bronze,
    sides,
    bands,
  );
  for (const sign of [-1, 1]) {
    limb([sign * 0.28, 1.67, 0.02], [sign * 0.38, 1.37, 0.17], 0.175, 0.175);
    limb([sign * 0.38, 1.37, 0.17], [sign * 0.23, 1.65, 0.36], 0.14, 0.14);
  }
  limb([-0.14, 1.7, 0.35], [0.42, 1.88, 0.52], 0.08, 0.08);
}
function fountain(out, f, d) {
  const { x, z, pools, ornate, outer } = f,
    segments = d < 2 ? 12 : d === 2 ? 20 : 32;
  const grade = pools
    .flat()
    .map((p) => elevation(...p))
    .sort((a, b) => a - b);
  const y = grade[Math.floor(grade.length / 2)] + 0.11,
    level = y - 0.12;
  const edge = radialRing(y, 16.25, 16.25, outer.length, [x, z]);
  pavingWithOpenings(
    out,
    edge.map(([x, , z]) => [x, z]),
    pools,
    y,
  );
  const outerGrade = outer.map((p) => lift(p, elevation(...p) + 0.03));
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length,
      dx = (outer[i][0] + outer[j][0]) / 2 - x,
      dz = (outer[i][1] + outer[j][1]) / 2 - z;
    const paved = Math.min(Math.abs(dx), Math.abs(dz)) < 3.25;
    quad(
      out,
      paved ? 'stone' : 'garden',
      paved ? 'paver' : 'grass',
      [edge[i], edge[j], outerGrade[j], outerGrade[i]],
      up,
    );
  }
  for (const ring of pools) {
    roof(out, 'water', 'pool', ring, level);
    if (d === 0) continue;
    const upper = y + 0.13;
    for (let i = 0; i < ring.length; i++) {
      const edge = frame(ring, i),
        { at, l, normal } = edge;
      quad(
        out,
        'stone',
        'lightStone',
        [at(0, y, 0.25), at(l, y, 0.25), at(l, upper, 0.25), at(0, upper, 0.25)],
        normal,
      );
      quad(
        out,
        'stone',
        'lightStone',
        [at(0, upper), at(l, upper), at(l, upper, 0.25), at(0, upper, 0.25)],
        up,
      );
      panel(out, edge, 'stone', 'paver', 0, level, l, upper - level, 0);
    }
    const count = d === 1 ? 0 : d === 2 ? 3 : 7;
    for (let i = 0; i < count; i++) {
      const step = Math.max(1, Math.floor(ring.length / count));
      const [a, b] = [ring[i * step], ring[(i * step + 1) % ring.length]],
        u = mix(a[0], b[0], 0.4),
        v = mix(a[1], b[1], 0.4);
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length,
        cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const points = Array.from({ length: d >= 3 ? 5 : 3 }, (_, i) => i);
      beamPath(
        out,
        'water',
        points.map((j) => {
          const t = j / (points.length - 1),
            r = 0.19 + 0.4 * t;
          return [mix(u, cx, r), level + 0.05 + 0.74 * Math.sin(t * Math.PI), mix(v, cz, r)];
        }),
        0.042,
        0.042,
        colors.spray,
      );
    }
  }
  if (d === 0) return;
  const sizes = ornate
    ? [
        [0, 3.95],
        [0.35, 3.95],
        [0.49, 3.52],
        [1.0, 3.25],
      ]
    : [
        [0, 3.25],
        [0.3, 3.25],
        [0.45, 2.64],
      ];
  cylinder(out, 'stone', 'lightStone', x, z, y - 0.39, sizes, segments);
  if (ornate) {
    cylinder(
      out,
      'bronze',
      'redStone',
      x,
      z,
      y + 0.55,
      [
        [0, 1.9],
        [0.3, 1.9],
        [0.33, 1.54],
        [1.12, 1.46],
        [1.25, 1.62],
      ],
      d >= 3 ? 24 : 12,
    );
    cylinder(
      out,
      'bronze',
      'gold',
      x,
      z,
      y + 1.7,
      [
        [0, 0.92],
        [0.45, 0.68],
        [1.46, 0.63],
        [1.65, 1.15],
        [2.24, 1.42],
        [2.39, 1.42],
        [2.58, 0.5],
        [3.18, 0.31],
        [3.34, 0.53],
        [3.49, 0.44],
      ],
      d >= 3 ? 24 : 10,
    );
    cylinder(
      out,
      'bronze',
      'gold',
      x,
      z,
      y + 5.17,
      [
        [0, 0.47],
        [0.21, 0.53],
        [0.66, 0.36],
        [1.02, 0.08],
      ],
      d >= 3 ? 14 : 8,
    );
    if (d >= 2)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          rr = i % 2 === 0 ? 2.44 : 3.03;
        statue(
          out,
          x + rr * Math.cos(a),
          y + 0.31,
          z + rr * Math.sin(a),
          a + Math.PI * 0.5,
          0.84,
          d,
        );
      }
  } else
    cylinder(
      out,
      'stone',
      'lightStone',
      x,
      z,
      y + 0.15,
      [
        [0, 1.51],
        [0.22, 1.22],
        [0.52, 0.66],
        [0.82, 0.51],
        [1.1, 0.81],
      ],
      segments,
    );
}
function planting(out, d) {
  if (d < 2) return;
  for (const f of layout.forecourt.fountains) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const x = f.x + a * 33.0,
          z = f.z + b * 33.2,
          y = elevation(x, z);
        cylinder(
          out,
          'stone',
          'paver',
          x,
          z,
          y - 0.15,
          [
            [0, 3.23],
            [0.37, 3.23],
            [0.37 + 0.023, 3.0],
          ],
          12,
        );
        sphere(
          out,
          'garden',
          [x, y + 0.47, z],
          [2.85, 0.55, 2.85],
          colors[a === b ? 'redFlower' : 'pinkFlower'],
          12,
          4,
        );
        if (d >= 3) {
          beam(out, 'metal', [x, y - 0.02, z], [x + 0.17, y + 2.89, z], 0.21, 0.2, colors.bark);
          sphere(out, 'garden', [x + 0.17, y + 3.72, z], [2.54, 1.56, 2.33], colors.leaf, 10, 5);
        }
      }
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const x = f.x + a * 13.8,
          z = f.z + b * 13.2,
          y = elevation(x, z);
        sphere(out, 'garden', [x, y + 0.26, z], [1.2, 0.6, 1.24], colors.hedge, 8, 4);
      }
  }
  for (const [x0, x1, z] of layout.forecourt.lampLines)
    for (let x = x0; x < x1; x += d === 2 ? 30 : 13) {
      const y = elevation(x, z);
      beam(out, 'metal', [x, y - 0.1, z], [x, y + 4.68, z], 0.17, 0.17, colors.white);
      if (d === 2) {
        beam(
          out,
          'metal',
          [x - 0.55, y + 4.28, z],
          [x + 0.55, y + 4.28, z],
          0.08,
          0.1,
          colors.white,
        );
        for (const s of [-1, 0, 1])
          block(out, 'metal', 'white', x + s * 0.52 - 0.1, y + 4.32, z - 0.1, 0.2, 0.33, 0.2);
        continue;
      }
      for (const s of [-1, 1]) {
        beamPath(
          out,
          'metal',
          [
            [x, y + 3.87, z],
            [x + s * 0.4, y + 3.89, z],
            [x + s * 0.63, y + 4.27, z],
          ],
          0.075,
          0.08,
          colors.white,
        );
        sphere(out, 'metal', [x + s * 0.64, y + 4.53, z], [0.2, 0.29, 0.2], colors.white, 8, 4);
      }
      sphere(out, 'metal', [x, y + 4.8, z], [0.19, 0.26, 0.19], colors.white, 8, 4);
    }
}
function banner(out, d) {
  if (d < 2) return;
  const x = 46.0,
    y = 34.94,
    z = -27.6;
  beam(out, 'metal', [x, y, z], [x, y + 6.8, z], 0.081, 0.081, colors.white);
  const wave = (u, v) => [x + u, y + v + 0.12 * Math.sin(u * 1.7), z + 0.18 * Math.sin(u * 2.9)];
  const bands = [
    [4.3, 4.58, 'flagBlue'],
    [4.58, 4.68, 'white'],
    [4.68, 5.48, 'flagRed'],
    [5.48, 5.58, 'white'],
    [5.58, 5.88, 'flagBlue'],
  ];
  for (const [lo, hi, tint] of bands)
    for (let i = 0; i < 6; i++) {
      const a = i * 0.53,
        b = (i + 1) * 0.53;
      const points = [wave(a, lo), wave(b, lo), wave(b, hi), wave(a, hi)];
      quad(out, 'metal', tint, points, north);
      quad(out, 'metal', tint, points, [0, 0, 1]);
    }
}
export function buildPalaceLevel(out, level) {
  const d = tiers[level];
  if (d === undefined) throw Error(`Unknown palace detail level ${level}`);
  for (const [i, shell] of layout.shells.entries()) envelope(out, shell, i, d);
  terrace(out, d);
  if (d > 0) {
    stair(out, d);
    portraits(out, d);
    paths(out, d);
  }
  for (const f of layout.forecourt.fountains) fountain(out, f, d);
  planting(out, d);
  banner(out, d);
}
export const buildMaster = (out) => buildPalaceLevel(out, 'master');
export const buildSkyline = (out) => buildPalaceLevel(out, 'skyline');
export const buildDistrict = (out) => buildPalaceLevel(out, 'district');
export const buildStreet = (out) => buildPalaceLevel(out, 'street');
export const buildCloseup = (out) => buildPalaceLevel(out, 'closeup');
