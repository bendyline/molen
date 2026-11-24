import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
  timber: { slot: 'door', graph: 'wood_vertical', roughness: 0.86 },
  lead: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
};

const ochre = rgb('d3ab68'),
  cream = rgb('c9c3b5'),
  light = rgb('d7cdb8');
const sill = rgb('b4a598'),
  slate = rgb('4f5057'),
  glass = rgb('657177');
const green = rgb('4f5b50'),
  iron = rgb('646155'),
  copper = rgb('9a855f');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [
  Math.fround(c * x - s * z),
  Math.fround(y),
  Math.fround(s * x + c * z),
];
const eaves = site.buildHeight - site.mansardHeight;
const courtyardZ = 11.601;
const middleX = 1.15;
const yFloor = -1.22;
const uv = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const up = [0, 1, 0];
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const point = ([x, z], y) => [x, y, z];
const area = (r) =>
  r.reduce(
    (sum, [x, z], i) => sum + x * r[(i + 1) % r.length][1] - z * r[(i + 1) % r.length][0],
    0,
  );
const clockwise = (r) => (area(r) < 0 ? r : r.toReversed());

function polygon(out, slot, points, tint, expected) {
  const raw = points.map(world),
    ref = expected && world(expected);
  for (let i = 1; i < raw.length - 1; i++) {
    let p = [raw[0], raw[i], raw[i + 1]],
      n = normalFor(...p);
    if (Math.hypot(...n) < 0.98) continue;
    if (ref && n.reduce((sum, v, j) => sum + v * ref[j], 0) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', p, n, uv, tint);
  }
}

function walls(out, slot, raw, base, top, tint) {
  const ring = clockwise(raw);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    polygon(out, slot, [point(a, base), point(b, base), point(b, top), point(a, top)], tint);
  }
}

function stoneBox(out, slot, x, X, z, Z, base, top, tint) {
  const r = rect(x, X, z, Z);
  walls(out, slot, r, base, top, tint);
  polygon(
    out,
    slot,
    r.map((p) => point(p, top)),
    tint,
    up,
  );
}

function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [-dz / length, 0, dx / length];
  return {
    length,
    normal,
    at: (t, y, d = 0) => [
      a[0] + (dx * t) / length + d * normal[0],
      y,
      a[1] + (dz * t) / length + d * normal[2],
    ],
  };
}

function panel(out, e, slot, color, a, b, y, h, d) {
  polygon(out, slot, [e.at(a, y, d), e.at(b, y, d), e.at(b, h, d), e.at(a, h, d)], color, e.normal);
}

function relief(out, e, slot, color, a, b, y, h, front, back = 0.014) {
  const p = e.at;
  panel(out, e, slot, color, a, b, y, h, front);
  for (const t of [a, b])
    polygon(
      out,
      slot,
      [p(t, y, back), p(t, y, front), p(t, h, front), p(t, h, back)],
      color,
      p(t === a ? a - 1 : b + 1, 0).map((v, i) => v - p(t, 0)[i]),
    );
  polygon(out, slot, [p(a, h, back), p(b, h, back), p(b, h, front), p(a, h, front)], color, up);
}

function glazing(out, e, u, y, h, w, arched, detail, door = false, depth = 0.025) {
  const a = u - w / 2,
    b = u + w / 2,
    t = e.at,
    fill = door ? 'timber' : 'glass',
    color = door ? green : glass;
  const spring = arched ? y + h - Math.min(0.8, w * 0.49) : y + h;
  panel(out, e, fill, color, a, b, y, spring, depth);
  if (arched) {
    const n = detail === 1 ? 4 : 8;
    const p = Array.from({ length: n + 1 }, (_, i) => [
      u - (w / 2) * Math.cos((i * Math.PI) / n),
      spring + (y + h - spring) * Math.sin((i * Math.PI) / n),
    ]);
    polygon(
      out,
      fill,
      p.map(([x, y]) => t(x, y, depth)),
      color,
      e.normal,
    );
    for (let i = 1; detail >= 2 && i < p.length; i++) {
      const [a, y] = p[i - 1],
        [b, Y] = p[i];
      polygon(
        out,
        'stone',
        [
          t(a, y, depth + 0.05),
          t(b, Y, depth + 0.05),
          t(b + (b - u) * 0.125, Y + 0.125, depth + 0.05),
          t(a + (a - u) * 0.125, y + 0.125, depth + 0.05),
        ],
        cream,
        e.normal,
      );
    }
  } else {
    panel(out, e, 'stone', cream, a - 0.11, b + 0.11, y + h, y + h + 0.13, depth + 0.053);
  }
  for (const [l, r] of [
    [a - 0.12, a],
    [b, b + 0.12],
  ])
    panel(out, e, 'stone', cream, l, r, y, spring, depth + 0.053);
  panel(out, e, 'stone', cream, a - 0.22, b + 0.22, y - 0.175, y, depth + 0.128);
  if (detail < 2 || door) return;
  const columns = detail === 2 ? 2 : 3;
  for (let i = 1; i <= columns; i++) {
    const x = a + ((b - a) * i) / (columns + 1);
    panel(out, e, 'stone', cream, x - 0.027, x + 0.027, y, spring, depth + 0.062);
  }
  for (const portion of detail === 2 ? [0.56] : [0.27, 0.53, 0.79]) {
    const Y = y + (spring - y) * portion;
    panel(out, e, 'stone', cream, a, b, Y - 0.028, Y + 0.028, depth + 0.063);
  }
}

function segmentedFront(out, e, detail, count, kind) {
  const width = e.length / count;
  if (detail === 0) {
    for (const yy of [0.33, 4.67, 15.5])
      panel(out, e, 'stone', cream, 0, e.length, yy, yy + 0.44, 0.077);
    return;
  }
  relief(out, e, 'stone', sill, 0, e.length, -0.12, 0.58, 0.128);
  for (const [y, h] of [
    [4.61, 0.28],
    [10.03, 0.23],
    [15.18, 0.45],
    [15.75, 0.43],
  ])
    relief(out, e, 'stone', cream, 0, e.length, y, y + h, 0.14);
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * width,
      isMain = i === Math.floor(count / 2);
    const bay = kind === 'passage' && isMain;
    const w = Math.min(2.38, width * 0.44) * (bay ? 1.32 : 1);
    const feature = kind === 'pavilion' && isMain;
    glazing(out, e, u, 0.85, bay ? 3.65 : 2.72, w, true, detail, bay, 0.05);
    glazing(out, e, u, 5.33, 4.19, w, feature || bay, detail, false, 0.048);
    glazing(out, e, u, 10.48, 3.39, w, feature, detail, false, 0.048);
    if (detail < 2) continue;
    const left = i * width + 0.19;
    const t = kind === 'garden' ? 0.27 : 0.39;
    relief(out, e, 'stone', cream, left, left + t, 4.9, 15.21, 0.167);
    relief(out, e, 'stone', light, left - 0.095, left + t + 0.095, 14.6, 15.16, 0.258);
    relief(out, e, 'stone', cream, left - 0.045, left + t + 0.045, 4.87, 5.16, 0.196);
    panel(out, e, 'stone', sill, u - 0.83, u + 0.83, 9.76, 9.93, 0.1);
  }
  if (kind === 'passage' || kind === 'pavilion') {
    const u = e.length / 2;
    for (const side of [-1, 1]) {
      const a = u + side * (kind === 'passage' ? 4.3 : 2.61);
      relief(out, e, 'stone', light, a - 0.31, a + 0.31, 4.85, 15.61, 0.31);
      relief(out, e, 'stone', cream, a - 0.49, a + 0.49, 14.97, 15.57, 0.41);
    }
  }
}

function roof(out, detail, x, X, z, Z, height, dir, n) {
  const sw = X - x,
    sd = Z - z,
    inset = Math.min(sw, sd);
  const footprint = rect(x, X, z, Z),
    base = eaves + 0.07;
  const breakY = base + (height - base) * 0.66;
  const ledge = inset * 0.091,
    l = x + ledge,
    r = X - ledge,
    f = z + ledge,
    b = Z - ledge;
  const mid = rect(l, r, f, b),
    capInset = inset * 0.238;
  const crown =
    dir === 'x'
      ? rect(l + capInset, r - capInset, (z + Z) / 2 - 0.19, (z + Z) / 2 + 0.19)
      : rect((x + X) / 2 - 0.19, (x + X) / 2 + 0.19, f + capInset, b - capInset);
  const rings = [
    [base, footprint],
    [breakY, mid],
    [height, crown],
  ].map(([y, r]) => r.map((p) => world(point(p, y))));
  loft(out, 'roof', rings, slate, { cap: true });
  if (!detail) return;
  const span = (breakY - base) * 0.47;
  const sides = [
    [X, x, z, 'x'],
    [x, X, Z, 'x'],
    [Z, z, X, 'z'],
    [z, Z, x, 'z'],
  ];
  for (const [a, b, rest, axis] of sides) {
    const count = axis === dir ? n : 2;
    if (count < 3 && detail === 1) continue;
    const spanStart = axis === 'x' ? [a, rest] : [rest, a],
      spanEnd = axis === 'x' ? [b, rest] : [rest, b];
    const e = edge(spanStart, spanEnd);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * e.length) / count;
      const w = Math.min(1.44, (e.length / count) * 0.37),
        low = base + 0.32;
      const faceDepth = 0.11;
      relief(
        out,
        e,
        'stone',
        cream,
        u - w * 0.62,
        u + w * 0.62,
        low,
        low + span,
        faceDepth,
        -ledge * 0.91,
      );
      glazing(out, e, u, low + 0.17, span - 0.37, w, false, detail, false, faceDepth + 0.025);
      const top = low + span,
        p = e.at;
      polygon(
        out,
        'stone',
        [p(u - w * 0.81, top, 0.19), p(u + w * 0.81, top, 0.19), p(u, top + 0.62, 0.19)],
        cream,
        e.normal,
      );
      polygon(
        out,
        'roof',
        [p(u, top + 0.64, 0.23), p(u + w * 0.8, top, 0.23), p(u, top + 0.56, -ledge)],
        slate,
        up,
      );
      polygon(
        out,
        'roof',
        [p(u - w * 0.8, top, 0.23), p(u, top + 0.64, 0.23), p(u, top + 0.56, -ledge)],
        slate,
        up,
      );
    }
  }
  if (detail < 2) return;
  const [start, end] = dir === 'x' ? [l, r] : [f, b];
  const count = dir === 'x' ? 4 : 2;
  for (let i = 0; i < count; i++) {
    const t = start + ((end - start) * (i + 0.65)) / count;
    const [u, v] = dir === 'x' ? [t, (z + Z) / 2 + 0.85] : [(x + X) / 2 + 0.83, t];
    stoneBox(
      out,
      'stone',
      u - 0.43,
      u + 0.43,
      v - 0.54,
      v + 0.54,
      height - 1.65,
      height + 1.37,
      sill,
    );
    stoneBox(
      out,
      'stone',
      u - 0.51,
      u + 0.51,
      v - 0.62,
      v + 0.62,
      height + 1.33,
      height + 1.48,
      cream,
    );
  }
}

function pediment(out, detail, e, top, u, width) {
  const p = e.at,
    d = 0.55;
  const l = u - width / 2,
    r = u + width / 2;
  polygon(out, 'stone', [p(l, top, d), p(r, top, d), p(u, top + 2.86, d)], cream, e.normal);
  for (const side of [-1, 1]) {
    const x = u + side * width * 0.53;
    beam(
      out,
      'stone',
      world(p(x, top - 0.045, d + 0.08)),
      world(p(u, top + 3.05, d + 0.08)),
      0.21,
      0.32,
      light,
    );
    if (detail < 2) continue;
    for (const letter of [1.05, 2.05, 3.1]) {
      const x = u + letter * side,
        y = top + 2.36 * (1 - letter / (width * 0.54));
      relief(out, e, 'stone', sill, x - 0.16, x + 0.16, y - 0.3, y + 0.2, d + 0.28, d);
    }
  }
  if (detail) {
    const [x, y, z] = p(u, top + 0.51, d + 0.15);
    const rings = [
      [0, 0.63],
      [0.21, 0.71],
      [0.85, 0.44],
      [1.05, 0.23],
    ].map(([H, r]) => radialRing(y + H, r, 0.16, 8, [x, z]).map(world));
    loft(out, 'stone', rings, light);
  }
}

function terrace(out, detail) {
  const [a, , b] = site.gardenTerrace;
  stoneBox(out, 'stone', a[0], b[0], a[1], b[1], -0.47, 1.28, sill);
  const e = edge([b[0], b[1]], [a[0], b[1]]);
  const steps = detail >= 2 ? 8 : 3,
    landing = 33.55;
  for (const side of [-1, 1])
    for (let i = 0; i < steps; i++) {
      const u = i / steps,
        v = (i + 1) / steps,
        z = landing + v * 4.31,
        t = 1.25 * (1 - u),
        x = middleX + side * (3.57 + 0.98 * u);
      stoneBox(out, 'stone', x - 1.68, x + 1.68, landing + u * 4.31, z + 0.014, -0.33, t, sill);
    }
  if (!detail) return;
  const middle = e.length / 2;
  for (const [a, b] of [
    [0, middle - 6.8],
    [middle + 6.8, e.length],
  ]) {
    relief(out, e, 'stone', cream, a, b, 2.18, 2.31, 0.15, -0.12);
    for (let u = a + 0.17; u < b; u += detail === 1 ? 3.1 : 1.11)
      relief(out, e, 'stone', cream, u - 0.086, u + 0.086, 1.24, 2.22, 0.095, -0.096);
  }
}

function build(out, detail) {
  walls(out, 'plaster', site.plan, yFloor, eaves, ochre);
  const faces = [
    [edge([-30.306, 28.705], [31.9, 28.705]), 13, 'garden'],
    [edge([14.445, courtyardZ - 0.022], [-12.145, courtyardZ - 0.022]), 5, 'passage'],
    [edge([-12.148, -22.868], [-30.304, -22.868]), 3, 'pavilion'],
    [edge([31.906, -22.398], [14.436, -22.398]), 3, 'pavilion'],
    [edge([-30.31, -22.868], [-30.31, 28.693]), 10, 'outer'],
    [edge([31.905, 28.693], [31.905, -22.39]), 10, 'outer'],
    [edge([-12.144, courtyardZ], [-12.148, -22.868]), 7, 'wing'],
    [edge([14.436, -22.385], [14.445, courtyardZ]), 7, 'wing'],
  ];
  for (const [e, n, kind] of faces) segmentedFront(out, e, detail, n, kind);
  const back = faces[0][0],
    front = faces[1][0];
  pediment(out, detail, back, 15.65, back.length * 0.54, 12.65);
  pediment(out, detail, front, 15.85, front.length * 0.5, 10.42);
  for (const [e] of faces.slice(2, 4)) pediment(out, detail, e, 17.25, e.length * 0.5, 8.3);
  roof(out, detail, -30.81, 32.41, 11.15, 29.27, 25.75, 'x', 9);
  roof(out, detail, -30.83, -11.69, -23.36, 13.55, site.buildHeight, 'z', 6);
  roof(out, detail, 13.99, 32.42, -22.93, 14.11, site.buildHeight, 'z', 6);
  terrace(out, detail);
  if (detail >= 2) {
    for (const [x, z] of [
      [middleX, 16.1],
      [-24.15, -18.8],
      [26.58, -18.8],
    ]) {
      beam(out, 'lead', world([x, 24.13, z]), world([x, 28.45, z]), 0.1, 0.1, iron);
      const flag = [
        [x, 28.39, z],
        [x + 0.9, 28.39, z + 0.08],
        [x + 0.92, 27.94, z + 0.092],
        [x, 27.9, z],
      ];
      polygon(out, 'lead', flag, copper, [0, 0, 1]);
      polygon(out, 'lead', flag, copper, [0, 0, -1]);
    }
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
