/** Original Rạch Miễu: A-pylon northern span, southern box viaduct and island ramp. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import controls from './rach-mieu-controls.json' with { type: 'json' };
export const rachControls = controls;
export const rachSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.35 },
};
const C = rachControls;
const interpolate = (points, x) => {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return points.at(-1)[1];
};
export const rachDeckY = (x) => interpolate(C.deckProfile, x);
export const rachCenterZ = (x) => interpolate(C.spine, x);
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('d2c5b4'),
  shade: linear('b0b1a7'),
  road: linear('717b79'),
  metal: linear('9b9f96'),
  cable: linear('a9aca4'),
  line: linear('ddd9b9'),
  white: linear('dfd9c5'),
  dark: linear('5b6460'),
};
const configs = {
  skyline: { far: true, pier: 4, stays: 2, post: 0, rail: 0, light: 0, marking: 0, detail: false },
  district: { pier: 1, stays: 5, post: 180, rail: 1, light: 0, marking: 0, detail: false },
  street: { pier: 1, stays: 12, post: 45, rail: 2, light: 90, marking: 40, detail: false },
  closeup: { pier: 1, stays: 24, post: 7, rail: 3, light: 45, marking: 16, detail: true },
  master: { pier: 1, stays: 28, post: 5, rail: 3, light: 45, marking: 16, detail: true },
};
function writer(target, far) {
  function emit(slot, _ref, points, hint, _uv, tint) {
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]];
      if (hint && normalFor(...t).reduce((s, v, j) => s + v * hint[j], 0) < 0)
        t = [t[0], t[2], t[1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
const b = (o, slot, x0, x1, y0, y1, z0, z1, c) => box(o, slot, [x0, y0, z0], [x1, y1, z1], c);
function rect(x, y, z, dx, dz) {
  return [
    [x - dx / 2, y, z - dz / 2],
    [x - dx / 2, y, z + dz / 2],
    [x + dx / 2, y, z + dz / 2],
    [x + dx / 2, y, z - dz / 2],
  ];
}
function column(o, x, z, y0, y1, dx0, dz0, dx1, dz1, c) {
  loft(o, 'concrete', [rect(x, y0, z, dx0, dz0), rect(x, y1, z, dx1, dz1)], c);
}
function strip(o, slot, xs, lo, hi, z0, z1, c) {
  loft(
    o,
    slot,
    xs.map((x) => {
      const y = rachDeckY(x),
        z = rachCenterZ(x);
      return [
        [x, y + lo, z + z0],
        [x, y + hi, z + z0],
        [x, y + hi, z + z1],
        [x, y + lo, z + z1],
      ];
    }),
    c,
  );
}
function deckDepth(x) {
  if (x > -950 && x < -390)
    return 2.2 + 3.6 * Math.max(0, 1 - Math.min(Math.abs(x + 830), Math.abs(x + 520)) / 115);
  return 2.2;
}
function pylon(o, x, cfg) {
  const deck = rachDeckY(x),
    z = rachCenterZ(x),
    top = C.pylonTopY;
  for (const side of [-1, 1]) {
    loft(
      o,
      'concrete',
      [
        rect(x, 0.1, z + side * 12.7, 5.4, 4.2),
        rect(x, deck, z + side * 9.2, 4.5, 3.3),
        rect(x, top - 4, z + side * 1.55, 3.2, 2.1),
      ],
      color.concrete,
    );
  }
  b(o, 'concrete', x - 2, x + 2, top - 4, top, z - 2.65, z + 2.65, color.concrete);
  b(o, 'concrete', x - 3.1, x + 3.1, deck - 7.3, deck - 4.4, z - 11.5, z + 11.5, color.shade);
  if (cfg.detail) {
    b(o, 'concrete', x - 7.3, x + 7.3, -1, 2.3, z - 17, z + 17, color.shade);
    for (const side of [-1, 1])
      for (const dx of [-6, 6]) column(o, x + dx, z + side * 16, -1, 3.7, 2, 2, 2, 2, color.shade);
  }
  for (const direction of [-1, 1])
    for (let i = 1; i <= cfg.stays; i++)
      for (const side of [-1, 1]) {
        const t = i / cfg.stays,
          reach = direction < 0 ? (x === C.pylons[0] ? 111 : 128) : x === C.pylons[1] ? 111 : 128,
          ax = x + direction * (13 + t * (reach - 13)),
          h = top - 4 - (1 - t) * 25;
        const zz = 9.2 + ((h - deck) / (top - 4 - deck)) * (1.55 - 9.2),
          a = [ax, rachDeckY(ax) + (cfg.far ? 0 : 0.27), rachCenterZ(ax) + side * 6.95],
          end = [x + direction * 1.35, h, z + side * zz];
        beam(o, 'metal', a, end, cfg.far ? 0.8 : 0.19, cfg.far ? 0.8 : 0.19, color.cable);
        if (cfg.detail) {
          const distance = Math.hypot(...end.map((v, j) => v - a[j]));
          beam(
            o,
            'metal',
            a,
            a.map((v, j) => v + ((end[j] - v) * 2.3) / distance),
            0.29,
            0.29,
            color.white,
          );
        }
      }
}
function wallPier(o, p, cfg) {
  const y = rachDeckY(p.x),
    depth = cfg.far || cfg === configs.district ? 2.2 : deckDepth(p.x),
    base = Math.min(p.baseY, y - depth - 3);
  if (cfg.far || cfg === configs.district) {
    column(o, p.x, p.z, base, y - depth, 2.3, 7, 2.3, 7, color.shade);
    return;
  }
  column(o, p.x, p.z, base, y - depth - 1.7, 2.3, 5.7, 1.8, 5.7, color.shade);
  column(o, p.x, p.z, y - depth - 1.7, y - depth + 0.04, 1.8, 5.7, 3.2, 13.5, color.concrete);
  if (cfg.detail)
    for (const side of [-1, 1])
      b(
        o,
        'metal',
        p.x - 0.7,
        p.x + 0.7,
        y - depth - 0.12,
        y - depth + 0.2,
        p.z + side * 4.8 - 0.75,
        p.z + side * 4.8 + 0.75,
        color.dark,
      );
}
function railings(o, xs, cfg) {
  if (!cfg.rail) return;
  for (const side of [-1, 1]) {
    for (let k = 0; k < cfg.rail; k++) {
      const y = 0.72 + k * 0.26;
      for (const part of sideSections(xs, side))
        strip(
          o,
          'metal',
          part,
          y,
          y + 0.075,
          side * 7.28 - 0.045,
          side * 7.28 + 0.045,
          color.metal,
        );
    }
    for (let x = C.ends[0][0] + 2; x < C.ends[1][0]; x += cfg.post) {
      if (side > 0 && x > -400 && x < -338) continue;
      const y = rachDeckY(x),
        z = rachCenterZ(x) + side * 7.28;
      b(o, 'concrete', x - 0.095, x + 0.095, y + 0.2, y + 1.34, z - 0.1, z + 0.1, color.shade);
    }
  }
}
function sideSections(xs, side) {
  return side < 0
    ? [xs]
    : [
        [...xs.filter((x) => x < -400), -400],
        [-338, ...xs.filter((x) => x > -338)],
      ];
}
export function rachRampPath() {
  const B = C.branch,
    source = [...B[0].line.slice(0, 3), ...B[1].line, ...B[2].line.slice(1)],
    lengths = source.slice(1).map((p, i) => Math.hypot(p[0] - source[i][0], p[1] - source[i][1])),
    total = lengths.reduce((s, v) => s + v, 0);
  let distance = 0;
  const groundY = C.rampGroundY ?? 4,
    stations = [0];
  for (const length of lengths) stations.push(stations.at(-1) + length);
  const mergeIndex = source.findIndex((p) => Math.abs(p[1] - rachCenterZ(p[0])) <= 14),
    mergeDistance = stations[mergeIndex],
    targetY = rachDeckY(source[mergeIndex][0]);
  const path = source.map((p, i) => {
    if (i) distance += lengths[i - 1];
    const t = distance / total;
    return {
      p,
      y:
        i >= mergeIndex
          ? rachDeckY(p[0])
          : groundY + ((targetY - groundY) * distance) / mergeDistance,
      t,
    };
  });
  return path;
}
function islandRamp(o, cfg) {
  const path = rachRampPath(),
    lengths = path.slice(1).map((p, i) => Math.hypot(p.p[0] - path[i].p[0], p.p[1] - path[i].p[1])),
    mergeIndex = path.findIndex((row) => Math.abs(row.p[1] - rachCenterZ(row.p[0])) <= 14),
    railPath = path.slice(0, mergeIndex + 1);
  const ring = (row, i, lo, hi, half) => {
    const a = path[Math.max(0, i - 1)].p,
      b = path[Math.min(path.length - 1, i + 1)].p,
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L],
      p = row.p;
    return [
      [p[0] - normal[0] * half, row.y + lo, p[1] - normal[1] * half],
      [p[0] - normal[0] * half, row.y + hi, p[1] - normal[1] * half],
      [p[0] + normal[0] * half, row.y + hi, p[1] + normal[1] * half],
      [p[0] + normal[0] * half, row.y + lo, p[1] + normal[1] * half],
    ];
  };
  // Path runs counterclockwise toward the main deck; the ring convention matches its tangent.
  loft(
    o,
    'road',
    path.map((p, i) => ring(p, i, -1, 0, i === 0 ? 6.2 : 3.8)),
    color.road,
  );
  if (!cfg.far) {
    for (const side of [-1, 1])
      for (let k = 0; k < cfg.rail; k++)
        loft(
          o,
          'metal',
          railPath.map((row, i) => {
            const a = path[Math.max(0, i - 1)].p,
              b = path[Math.min(path.length - 1, i + 1)].p,
              L = Math.hypot(b[0] - a[0], b[1] - a[1]),
              n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L],
              q = row.p,
              y = row.y + 0.7 + k * 0.26,
              at = (w, h) => [
                q[0] + n[0] * (side * 3.6 + w),
                y + h,
                q[1] + n[1] * (side * 3.6 + w),
              ];
            return [at(-0.045, 0), at(-0.045, 0.08), at(0.045, 0.08), at(0.045, 0)];
          }),
          color.metal,
        );
    let traveled = 0,
      next = cfg.post;
    for (let i = 1; i < railPath.length; i++) {
      const a = path[i - 1],
        b = path[i],
        L = lengths[i - 1],
        n = [-(b.p[1] - a.p[1]) / L, (b.p[0] - a.p[0]) / L];
      while (next < traveled + L) {
        const t = (next - traveled) / L,
          x = a.p[0] + t * (b.p[0] - a.p[0]),
          z = a.p[1] + t * (b.p[1] - a.p[1]),
          y = a.y + t * (b.y - a.y);
        for (const side of [-1, 1])
          column(
            o,
            x + side * n[0] * 3.6,
            z + side * n[1] * 3.6,
            y,
            y + 1.35,
            0.14,
            0.14,
            0.14,
            0.14,
            color.shade,
          );
        next += cfg.post;
      }
      traveled += L;
    }
  }
  for (let i = 2; i < path.length - 1; i += cfg.far ? 4 : 2) {
    const p = path[i];
    column(o, p.p[0], p.p[1], C.rampBaseY ?? 1, p.y - 1, 1.6, 3.8, 1.6, 3.8, color.shade);
  }
}
export function buildRachLevel(target, level) {
  const cfg = configs[level];
  if (!cfg) throw Error(`Unknown Rach Mieu level ${level}`);
  const o = writer(target, cfg.far),
    stride = cfg.far ? 6 : cfg === configs.district ? 4 : 1,
    xs = [
      ...new Set([
        ...C.spine.filter((_, i) => i % stride === 0).map((p) => p[0]),
        ...C.deckProfile.map((p) => p[0]),
        ...(cfg.far || cfg === configs.district
          ? []
          : C.piers.filter((p) => p.x > -950 && p.x < -390).map((p) => p.x)),
      ]),
    ].sort((a, b) => a - b);
  if (cfg.far) strip(o, 'road', xs, -2.2, 0, -7.5, 7.5, color.road);
  else {
    loft(
      o,
      'concrete',
      xs.map((x) => {
        const y = rachDeckY(x),
          z = rachCenterZ(x);
        return [
          [x, y - (cfg === configs.district ? 2.2 : deckDepth(x)), z - 6.5],
          [x, y - 0.14, z - 7.5],
          [x, y - 0.14, z + 7.5],
          [x, y - (cfg === configs.district ? 2.2 : deckDepth(x)), z + 6.5],
        ];
      }),
      color.concrete,
    );
    strip(o, 'road', xs, -0.14, 0, -7.5, 7.5, color.road);
    for (const side of [-1, 1])
      for (const part of sideSections(xs, side))
        strip(
          o,
          'concrete',
          part,
          0,
          0.27,
          side < 0 ? -7.5 : 6.5,
          side < 0 ? -6.5 : 7.5,
          color.concrete,
        );
  }
  C.piers.forEach((p, i) => {
    if (i % cfg.pier === 0 || i === C.piers.length - 1) wallPier(o, p, cfg);
  });
  for (const x of C.pylons) pylon(o, x, cfg);
  railings(o, xs, cfg);
  islandRamp(o, cfg);
  for (const [index, end] of C.ends.entries()) {
    const _sign = index ? 1 : -1,
      x = end[0];
    strip(o, 'road', [x - 7, x + 7], -0.2, 0, -8.2, 8.2, color.road);
  }
  if (cfg.light)
    for (let x = C.ends[0][0] + 15; x < C.ends[1][0] - 12; x += cfg.light)
      for (const side of [-1, 1]) {
        if (side > 0 && x > -400 && x < -338) continue;
        const y = rachDeckY(x),
          z = rachCenterZ(x) + side * 7.05,
          points = [
            [x, y + 0.27, z],
            [x, y + 10, z],
            [x, y + 11.2, z - side * 1.4],
            [x, y + 11.5, z - side * 2.5],
          ];
        for (let i = 1; i < points.length; i++)
          beam(o, 'metal', points[i - 1], points[i], 0.13, 0.13, color.metal);
        b(
          o,
          'metal',
          x - 0.7,
          x + 0.7,
          y + 11.43,
          y + 11.6,
          z - side * 2.5 - 0.18,
          z - side * 2.5 + 0.18,
          color.dark,
        );
      }
  if (cfg.marking) {
    strip(o, 'road', xs, 0.012, 0.022, -0.09, 0.09, color.line);
    for (let x = C.ends[0][0] + 3; x < C.ends[1][0] - 6; x += cfg.marking)
      for (const z of [-4.4, 4.4])
        strip(o, 'road', [x, x + 5], 0.012, 0.022, z - 0.065, z + 0.065, color.white);
  }
  if (cfg.detail)
    for (let x = C.mainEnds[0] + 6; x < C.mainEnds[1]; x += 8) {
      const y = rachDeckY(x),
        z = rachCenterZ(x);
      b(o, 'concrete', x - 0.17, x + 0.17, y - 2.75, y - 2.05, z - 6.4, z + 6.4, color.shade);
    }
}
export const buildRachSkyline = (b) => buildRachLevel(b, 'skyline');
export const buildRachDistrict = (b) => buildRachLevel(b, 'district');
export const buildRachStreet = (b) => buildRachLevel(b, 'street');
export const buildRachCloseup = (b) => buildRachLevel(b, 'closeup');
