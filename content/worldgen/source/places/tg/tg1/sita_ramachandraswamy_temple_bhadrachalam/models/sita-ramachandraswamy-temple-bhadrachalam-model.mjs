import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('foundation', 'stone_ashlar'),
  wall: surface('wall', 'plaster_lime'),
  crown: surface('trim', 'stone_limestone_raw'),
  roof: surface('roof', 'metal_corrugated', 0.78, 0.08),
  openings: surface('door', 'wood_vertical'),
  finial: surface('trim', 'metal_painted', 0.7, 0.23),
};
const C = palette({
  white: 'd5d1be',
  stone: 'aca594',
  chalk: 'edddbb',
  gold: 'c5af79',
  darkGold: 'aa8958',
  orange: 'b96b3a',
  warm: 'c77d45',
  red: '924e3a',
  pale: 'd4c2a1',
  joints: '827361',
  green: '5b8676',
  blue: '456671',
  roof: '696861',
  cavity: '514742',
  shade: '8d7a62',
  bright: 'cbb07a',
});
const angle = 0.168;
const cb = Math.cos(angle),
  sb = Math.sin(angle);
const frame =
  (center) =>
  ([x, z]) => [center[0] + x * cb - z * sb, center[1] + x * sb + z * cb];
const ringBox = (center, x, z) => rect(-x * 0.5, -z * 0.5, x * 0.5, z * 0.5).map(frame(center));
const walls = (p) => pairs(closed(p)).map(([a, b]) => ({ a, b, w: edge(a, b, areaSign(p)) }));
function solid(out, p, low, high, slot, color, topColor = color) {
  shell(out, p, typeof low === 'number' ? () => low : low, high, {
    wall: slot,
    color,
    roof: slot,
    roofColor: topColor,
  });
}
function band(out, w, y, h, depth, slot, color) {
  trimBlock(out, slot, w, 0, w.length, y, y + h, 0.007, depth, color);
}
function tier(out, center, width, depth, low, high, topScale, color) {
  const lower = ringBox(center, width, depth),
    upper = ringBox(center, width * topScale, depth * topScale);
  const ledge = mix(low, high, 0.17);
  for (const [i, { a, b, w }] of walls(lower).entries()) {
    const next = (i + 1) % 4;
    face(
      out,
      'crown',
      [at(a, low), at(b, low), at(upper[next], ledge), at(upper[i], ledge)],
      w.normal,
      color,
    );
  }
  solid(out, upper, ledge, high, 'crown', color);
  return upper;
}
function carvedBand(out, p, y, h, level, lod) {
  if (!lod) return;
  for (const { w } of walls(p)) {
    if (lod === 1) {
      panel(out, 'crown', w, 0, w.length, y, y + h * 0.2, 0.025, C.darkGold);
      panel(out, 'crown', w, 0, w.length, y + h * 0.72, y + h * 0.84, 0.026, C.chalk);
    } else {
      band(out, w, y, h * 0.2, 0.14, 'crown', C.darkGold);
      band(out, w, y + h * 0.72, h * 0.12, 0.21, 'crown', C.chalk);
    }
    const n = Math.max(2, Math.floor(w.length / (lod === 1 ? 2.6 : 1.44)));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * w.length) / n;
      const width = Math.min(0.37, (w.length / n) * 0.28);
      if (lod === 1)
        panel(out, 'crown', w, x - width, x + width, y + h * 0.25, y + h * 0.68, 0.035, C.shade);
      else {
        arch(
          out,
          w,
          x,
          y + h * 0.22,
          y + h * 0.58,
          width,
          h * 0.18,
          0.051,
          1,
          { inner: C.shade, trim: C.chalk, width: 0.082 },
          { inner: 'crown', trim: 'crown' },
        );
        if (lod === 3 && (i + level) % 2 === 0)
          trimBlock(
            out,
            'crown',
            w,
            x - 0.085,
            x + 0.085,
            y + h * 0.28,
            y + h * 0.54,
            0.064,
            0.146,
            C.bright,
          );
      }
    }
  }
}
function crest(out, center, y, width, depth, lod) {
  const p = ringBox(center, width, depth);
  solid(out, p, y - 0.02, y + 0.28, 'crown', C.chalk);
  const join = frame(center),
    count = lod === 0 ? 3 : 5;
  for (let i = 0; i < count; i++) {
    const f = join([mix(-width * 0.4, width * 0.4, i / (count - 1)), 0]);
    const base = ringBox(f, 0.22, 0.25),
      cap = ringBox(f, 0.14, 0.14);
    solid(out, base, y + 0.25, y + 0.43, 'finial', C.darkGold);
    solid(
      out,
      cap,
      y + 0.43,
      y + 0.63 + (i === Math.floor(count / 2) ? 0.17 : 0),
      'finial',
      C.bright,
    );
  }
}
function northTower(out, center, floor, lod) {
  const width = 11.2,
    depth = 6.7,
    base = ringBox(center, width, depth);
  const corners = frame(center),
    gatewayHalf = 1.48;
  for (const [l, r] of [
    [-width / 2, -gatewayHalf],
    [gatewayHalf, width / 2],
  ]) {
    const jamb = rect(l, -depth / 2, r, depth / 2).map(corners);
    solid(out, jamb, floor - 0.19, floor + 4.84, 'wall', C.warm);
    for (const { w } of walls(jamb))
      if (lod > 0) band(out, w, floor + 4.11, 0.34, 0.2, 'crown', C.white);
  }
  solid(out, base, floor + 3.35, floor + 5.0, 'wall', C.red);
  const w = walls(base)[0].w;
  if (lod > 0) {
    for (const dx of [-1.82, 1.82]) {
      const x = w.length / 2 + dx;
      trimBlock(
        out,
        'crown',
        w,
        x - 0.22,
        x + 0.22,
        floor + 0.05,
        floor + 3.68,
        0.035,
        0.36,
        C.pale,
      );
    }
    band(out, w, floor + 4.75, 0.28, 0.28, 'crown', C.white);
  }
  let y = floor + 5.0;
  for (let i = 0; i < 7; i++) {
    const scale = 1 - i * 0.098,
      h = 1.38 - i * 0.082;
    const lower = ringBox(center, width * scale, depth * scale);
    solid(out, lower, y - 0.025, y + 0.25, 'crown', i % 2 === 0 ? C.gold : C.chalk);
    const top = tier(
      out,
      center,
      width * scale * 0.96,
      depth * scale * 0.96,
      y + 0.25,
      y + h,
      0.91,
      i % 2 === 0 ? C.gold : C.chalk,
    );
    carvedBand(out, top, y + 0.36, h - 0.24, i, lod);
    y += h;
  }
  crest(out, center, y, 4.6, 2.1, lod);
}
function sanctuary(out, center, floor, lod) {
  const p = ringBox(center, 9.75, 8.25);
  solid(out, p, floor - 0.32, floor + 0.72, 'stone', C.stone);
  solid(out, p, floor + 0.7, floor + 5.04, 'wall', C.orange);
  if (lod > 0)
    for (const { w } of walls(p)) {
      band(out, w, floor + 4.51, 0.27, 0.24, 'crown', C.white);
      band(out, w, floor + 4.77, 0.21, 0.34, 'crown', C.gold);
    }
  let y = floor + 5.0;
  for (const [i, [width, depth, h, scale]] of [
    [8.9, 7.3, 1.63, 0.82],
    [7.25, 5.97, 1.38, 0.79],
    [5.84, 4.69, 1.18, 0.72],
    [4.12, 3.32, 1.47, 0.54],
  ].entries()) {
    const base = ringBox(center, width, depth);
    solid(out, base, y - 0.03, y + 0.31, 'crown', C.gold);
    const upper = tier(out, center, width * 0.95, depth * 0.95, y + 0.31, y + h, scale, C.chalk);
    if (i < 3) carvedBand(out, upper, y + 0.4, h - 0.28, i, lod);
    y += h;
  }
  const apex = ringBox(center, 1.28, 1.0);
  solid(out, apex, y - 0.1, y + 0.34, 'finial', C.bright);
  const post = ringBox(center, 0.15, 0.16);
  solid(out, post, y + 0.33, y + 1.13, 'finial', C.darkGold);
  // The chakra above the sanctuary is a small wheel silhouette.
  if (lod > 0) {
    const [x, z] = center;
    const points = Array.from({ length: lod === 1 ? 8 : 12 }, (_, i) => {
      const a = (i * Math.PI * 2) / (lod === 1 ? 8 : 12);
      return [x + 0.32 * Math.cos(a), y + 1.11 + 0.32 * Math.sin(a), z];
    });
    for (const side of [-1, 1])
      face(out, 'finial', side < 0 ? [...points].reverse() : points, [0, 0, side], C.bright);
  }
}
function hall(out, p, grade, lod, profile) {
  const baseY = grade(planarMid(p)) + 0.3,
    top = baseY + profile.wall;
  const footing = baseY + 0.63;
  solid(out, p, (q) => Math.min(grade(q) - 0.22, footing - 0.45), footing, 'stone', C.stone);
  solid(out, p, footing, top, 'wall', profile.color);
  solid(out, p, top - 0.025, top + 0.34, 'roof', C.roof);
  if (!lod) return;
  for (const { w } of walls(p)) {
    if (w.length < 3.3) continue;
    band(out, w, top - 0.55, 0.26, 0.16, 'wall', C.red);
    band(out, w, top - 0.29, 0.17, 0.23, 'crown', C.white);
    const n = Math.floor(w.length / (lod === 1 ? 5.8 : 4.3));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * w.length) / n,
        win = 0.43;
      opening(
        out,
        w,
        x - win,
        x + win,
        top - 2.32,
        top - 1.16,
        'wall',
        C.cavity,
        'openings',
        C.pale,
        lod - 1,
        0.026,
      );
      if (lod > 1)
        trimBlock(
          out,
          'crown',
          w,
          x - win - 0.24,
          x + win + 0.24,
          top - 1.16,
          top - 1.02,
          0.048,
          0.28,
          C.white,
        );
    }
  }
}
function canopy(out, p, grade, lod) {
  const [a, b, c, d] = p;
  const y = Math.max(...p.map(grade)) + 3.65;
  const l = planarMid([a, d]),
    r = planarMid([b, c]);
  face(out, 'roof', [at(a, y), at(b, y), at(r, y + 0.98), at(l, y + 0.98)], up, C.roof);
  face(out, 'roof', [at(c, y), at(d, y), at(l, y + 0.98), at(r, y + 0.98)], up, C.roof);
  for (const [first, last] of [
    [a, b],
    [c, d],
  ]) {
    const w = edge(first, last);
    const columns = lod === 0 ? 2 : 5;
    for (let i = 0; i <= columns; i++) {
      const t = i / columns,
        q = first.map((v, k) => mix(v, last[k], t)),
        low = grade(q);
      const post = ringBox(q, 0.26, 0.26);
      solid(out, post, low - 0.02, y, 'wall', C.green);
    }
    if (lod > 0) trimBlock(out, 'roof', w, 0, w.length, y - 0.18, y + 0.04, 0, 0.12, C.roof);
  }
}
function perimeter(out, outline, grade, lod) {
  for (const [a, b] of pairs(closed(outline))) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(length / (lod === 0 ? 22 : lod === 1 ? 12 : 7.4)));
    const path = (t) => a.map((v, i) => mix(v, b[i], t));
    for (let j = 0; j < n; j++) {
      const l = path(j / n),
        r = path((j + 1) / n),
        center = planarMid([l, r]);
      // The photographed stairs interrupt the wall at the northern approach and southwest entry.
      if (
        (center[1] < -25 && center[0] > -14 && center[0] < 4) ||
        (center[0] < -31 && center[1] > 15 && center[1] < 23)
      )
        continue;
      const w = edge(l, r, areaSign(outline));
      const roof = Math.max(grade(l), grade(r)) + 1.43;
      const strip = [
        [0, 0],
        [w.length, 0],
        [w.length, -0.66],
        [0, -0.66],
      ].map(([u, d]) => {
        const [x, , z] = w.p(u, 0, d);
        return [x, z];
      });
      solid(out, strip, (q) => Math.min(grade(q) - 0.29, roof - 0.53), roof, 'wall', C.white);
      wallAccent(out, w, roof, lod);
    }
  }
}
function wallAccent(out, w, top, lod) {
  if (!lod) return;
  band(out, w, top - 0.18, 0.17, 0.1, 'wall', C.white);
  if (w.length > 2.0) {
    const mid = w.length * 0.53;
    trimBlock(out, 'wall', w, mid - 0.15, mid + 0.15, top - 1.18, top - 0.015, 0.025, 0.1, C.red);
  }
}
function coveredApproach(out, grade, floor, lod) {
  const x = -8.2,
    top = -21.85,
    bottom = -42.6,
    width = 4.8;
  const ground = grade([x, bottom]),
    count = [5, 15, 24, 33][lod];
  for (let i = 0; i < count; i++) {
    const a = mix(bottom, top, i / count),
      b = mix(bottom, top, (i + 1) / count);
    const y = mix(ground + 0.04, floor, i / (count - 1));
    solid(
      out,
      rect(x - width / 2, a, x + width / 2, b),
      (q) => Math.min(grade(q) - 0.2, y - 0.2),
      y,
      'stone',
      C.pale,
    );
  }
  // A narrow curved metal cap over the lower stretch of the approach.
  const z0 = -43.1,
    z1 = -30.3,
    radius = 3.1,
    steps = [6, 9, 13, 19][lod],
    y = ground + 3.58,
    rise = 1.33;
  for (let i = 0; i < steps; i++) {
    const from = (Math.PI * i) / steps,
      to = (Math.PI * (i + 1)) / steps;
    const a = x + radius * Math.cos(from),
      b = x + radius * Math.cos(to);
    const c = y + rise * Math.sin(from),
      d = y + rise * Math.sin(to);
    face(
      out,
      'roof',
      [
        [a, c, z0],
        [b, d, z0],
        [b, d, z1],
        [a, c, z1],
      ],
      up,
      C.roof,
    );
  }
  for (const px of [x - radius + 0.17, x + radius - 0.17])
    for (const z of lod === 0 ? [-42.8, -30.6] : [-42.8, -38.1, -33.1, -30.6]) {
      const g = grade([px, z]);
      block(out, 'wall', px - 0.105, g - 0.06, z - 0.105, 0.21, y - g + 0.09, 0.21, C.green);
    }
}
function draw(out, lod, { outline, polygons }, grade) {
  perimeter(out, outline, grade, lod);
  const y = grade([0.0, 0.6]) + 0.46,
    gate = [-6.8, -19.05],
    gateY = grade(gate) + 0.46;
  northTower(out, gate, gateY, lod);
  coveredApproach(out, grade, gateY, lod);
  sanctuary(out, [-0.8, 0.5], y, lod);
  for (const [i, height] of [
    [0, 4.5],
    [1, 4.57],
    [3, 3.85],
    [5, 5.5],
    [6, 5.72],
  ])
    hall(out, polygons[i], grade, lod, { wall: height, color: i === 6 ? C.warm : C.orange });
  canopy(out, polygons[4], grade, lod);
}
const temple = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [113, 78, -132],
    lookAt: [15, 6, 0],
    yaw: 0.76,
    sun: [400, 590, -490],
    brief:
      'February 2024 exterior of Bhadrachalam’s hilltop Rama temple, with cream stepped towers, orange precinct walls and covered approach.',
    views: [
      { name: 'temple-precinct-on-original-hill', position: [129, 79, -128], lookAt: [13, 5, 2] },
      {
        name: 'north-gopuram-and-covered-approach',
        position: [-37, 12, -58],
        lookAt: [-6, 7, -14],
      },
      { name: 'sanctuary-crown-and-pavilions', position: [-44, 25, 33], lookAt: [0, 6, 0] },
      { name: 'orange-and-white-south-precinct', position: [52, 24, 78], lookAt: [13, 6, 19] },
      { name: 'entrance-tower-relief-and-colors', position: [5, 10, -41], lookAt: [-6, 8, -19] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = temple;
export const model = {
  ...temple.model,
  category: 'religious',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '2024-02-20',
    validFrom: '2024-02-20',
    validUntil: '2025-01-01',
  },
};
