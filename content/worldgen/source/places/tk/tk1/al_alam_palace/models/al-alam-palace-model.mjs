import {
  arch,
  areaSign,
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
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('foundation', 'stone_ashlar'),
  wall: surface('wall', 'plaster_lime'),
  trim: surface('trim', 'stone_limestone_raw'),
  ceramic: surface('trim', 'metal_painted', 0.7, 0.18),
  roof: surface('roof', 'concrete_plain'),
  shadow: surface('window', 'window_grid', 0.57, 0.03),
};
const C = palette({
  plinth: 'bdb49e',
  white: 'ded3bd',
  pale: 'ebdfc9',
  edge: 'c8b995',
  trim: 'afa082',
  blue: '3b6994',
  lightBlue: '5d90ac',
  darkBlue: '366485',
  gold: 'c79436',
  yellow: 'dbc279',
  darkGold: 'ae7634',
  recess: '554e43',
  glass: '67757a',
  roof: 'c5bea9',
  red: 'a33e40',
  green: '526f50',
});
function clip(poly, x, sign) {
  const p = [];
  for (const [a, b] of pairs(closed(poly))) {
    const da = sign * (a[0] - x),
      db = sign * (b[0] - x);
    if (da >= 0) p.push(a);
    if (da * db < 0) p.push([x, mix(a[1], b[1], da / (da - db))]);
  }
  return p;
}
const walls = (p) => pairs(closed(p)).map(([a, b]) => ({ a, b, w: edge(a, b, areaSign(p)) }));
function solid(out, p, lo, hi, slot, color, roofColor = color) {
  shell(out, p, typeof lo === 'number' ? () => lo : lo, hi, {
    wall: slot,
    color,
    roof: 'roof',
    roofColor,
  });
}
function strip(out, w, y, h, depth, slot, color) {
  trimBlock(out, slot, w, 0, w.length, y, y + h, 0.003, depth, color);
}
function openingRow(out, w, floor, count, lod) {
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * w.length) / count;
    const radius = Math.min(0.82, (w.length / count) * 0.31);
    if (lod === 0) {
      panel(out, 'shadow', w, x - radius, x + radius, floor + 2.22, floor + 5.42, 0.045, C.recess);
      continue;
    }
    arch(
      out,
      w,
      x,
      floor + 1.96,
      floor + 4.41,
      radius,
      1.04,
      0.028,
      lod > 1 ? 1 : 0,
      { inner: C.recess, trim: C.edge, width: 0.145 },
      { inner: 'shadow', trim: 'trim' },
    );
    if (lod > 1) {
      const w2 = radius * 0.72;
      opening(
        out,
        w,
        x - w2,
        x + w2,
        floor + 5.95,
        floor + 7.2,
        'trim',
        C.glass,
        'shadow',
        C.edge,
        lod - 1,
        0.037,
      );
    }
  }
}
function wing(out, p, grade, lod) {
  const base = 0.26,
    upper = 9.45;
  solid(out, p, (q) => Math.min(grade(q) - 0.23, base - 0.3), base, 'stone', C.plinth);
  solid(out, p, base, upper, 'wall', C.white, C.roof);
  for (const { a, b, w } of walls(p)) {
    if (
      w.length < 1.7 ||
      (Math.abs(a[0] - b[0]) < 0.015 &&
        (Math.abs(a[0] + 15.25) < 0.02 || Math.abs(a[0] - 24.1) < 0.02))
    )
      continue;
    if (lod > 0) {
      strip(out, w, upper - 0.16, 0.38, 0.23, 'trim', C.pale);
      strip(out, w, 7.93, 0.28, 0.15, 'trim', C.edge);
      strip(out, w, base, 0.39, 0.09, 'trim', C.plinth);
    }
    if (w.length > 4.9)
      openingRow(out, w, base, Math.max(1, Math.floor(w.length / (lod === 0 ? 7.0 : 4.0))), lod);
    if (lod >= 2 && w.length > 6.6) {
      const merlons = Math.floor(w.length / 4.7);
      for (let i = 0; i < merlons; i++) {
        const x = ((i + 0.5) * w.length) / merlons;
        trimBlock(
          out,
          'wall',
          w,
          x - 0.53,
          x + 0.53,
          upper - 0.04,
          upper + 0.46,
          -0.32,
          0.1,
          C.pale,
        );
      }
    }
  }
}
function frontColumn(out, x, z, base, top, lod, gold) {
  const color = gold ? C.gold : C.blue,
    light = gold ? C.yellow : C.lightBlue,
    dark = gold ? C.darkGold : C.darkBlue;
  const segments = [8, 12, 18, 24][lod];
  const corners = (rx, rz, y) =>
    Array.from({ length: segments }, (_, i) => {
      const t = ((i + 0.5) * Math.PI * 2) / segments;
      return [x + rx * Math.cos(t), y, z + rz * Math.sin(t)];
    });
  const h = top - base;
  const profile = [
    [1.36, 1.07, base],
    [1.04, 0.8, base + 0.5],
    [1.09, 0.82, base + h * 0.34],
    [1.36, 0.99, base + h * 0.66],
    [1.88, 1.3, base + h * 0.85],
    [2.88, 1.83, top - 0.49],
    [2.88, 1.83, top],
  ];
  const rings = profile.map(([rx, rz, y]) => corners(rx, rz, y));
  for (const [j, [lo, hi]] of pairs(rings).entries()) {
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments,
        mid = [(lo[i][0] + lo[n][0]) * 0.5 - x, 0, (lo[i][2] + lo[n][2]) * 0.5 - z];
      const tone = j === 0 ? dark : j === 5 ? light : lod > 1 && i % 4 === 0 ? light : color;
      const pts = [lo[i], lo[n], hi[n], hi[i]];
      face(out, 'ceramic', [pts[0], pts[1], pts[2]], mid, tone);
      face(out, 'ceramic', [pts[0], pts[2], pts[3]], mid, tone);
    }
  }
}
function pavilionFront(out, p, grade, lod) {
  const ground = 0.27,
    floor = 1.45,
    roof = 16.36;
  const exactFront = clip(clip(p, -15.25, 1), 24.1, -1);
  solid(
    out,
    exactFront,
    (q) => Math.min(grade(q) - 0.23, ground - 0.34),
    ground,
    'stone',
    C.plinth,
  );
  const blockPlan = rect(-18.78, -24.75, 21.75, 11.3);
  solid(out, blockPlan, ground, roof, 'wall', C.white, C.roof);
  solid(out, rect(-14.76, 11.26, 23.82, 21.15), ground - 0.02, floor, 'stone', C.plinth, C.pale);
  const canopy = rect(-19.3, -25.2, 24.25, 22.55);
  solid(out, canopy, roof - 0.17, roof + 0.95, 'trim', C.pale, C.roof);
  const forecourt = edge([-18.65, 11.32], [21.68, 11.32], -1);
  const center = forecourt.length * 0.49;
  for (const [dx, rx] of [
    [-12.1, 2.12],
    [0, 3.24],
    [12.1, 2.12],
  ]) {
    const y = floor + 0.18,
      top = floor + (dx === 0 ? 7.92 : 6.29);
    const x = center + dx;
    arch(
      out,
      forecourt,
      x,
      y,
      top - rx * 0.64,
      rx,
      rx * 0.64,
      0.037,
      lod >= 2 ? 2 : 0,
      { inner: C.recess, trim: C.edge, width: 0.24 },
      { inner: 'shadow', trim: 'trim' },
    );
    if (lod > 0 && dx !== 0)
      opening(
        out,
        forecourt,
        x - 0.92,
        x + 0.92,
        top + 0.73,
        top + 2.31,
        'trim',
        C.glass,
        'shadow',
        C.edge,
        lod - 1,
        0.047,
      );
  }
  for (const [i, x] of [-11.9, -1.4, 13.0, 20.88].entries())
    frontColumn(out, x, 18.26, floor, roof - 0.14, lod, i === 1 || i === 2);
  for (const { w } of walls(canopy)) {
    if (lod > 0) strip(out, w, roof - 0.18, 0.25, 0.15, 'trim', C.edge);
    if (lod > 1) strip(out, w, roof + 0.41, 0.18, 0.33, 'trim', C.pale);
  }
  const stepCount = [2, 4, 6, 8][lod];
  const zStart = 21.0,
    zEnd = 26.45;
  for (let i = 0; i < stepCount; i++) {
    const a = mix(zStart, zEnd, i / stepCount),
      b = mix(zStart, zEnd, (i + 1) / stepCount);
    const y = mix(floor, ground + 0.11, i / (stepCount - 1));
    solid(
      out,
      rect(-9.1, a, 20.05, b),
      (q) => Math.min(grade(q) - 0.19, y - 0.22),
      y,
      'stone',
      C.plinth,
      C.pale,
    );
  }
  const poleX = 4.74,
    poleZ = -0.85;
  block(out, 'ceramic', poleX - 0.064, roof + 0.95, poleZ - 0.064, 0.128, 6.98, 0.128, C.edge);
  if (lod > 0) {
    const y = roof + 6.42;
    for (const side of [-1, 1]) {
      const flag = { normal: [0, 0, side], p: (x, v, d) => [poleX + x, v, poleZ + d * side] };
      for (const [i, color] of [C.pale, C.red, C.green].entries())
        panel(out, 'ceramic', flag, 0.54, 2.29, y - (i + 1) * 0.37, y - i * 0.37, 0.009, color);
      panel(out, 'ceramic', flag, 0.025, 0.54, y - 1.11, y, 0.012, C.red);
    }
  }
}
function draw(out, lod, { outline }, grade) {
  wing(out, clip(outline, -15.25, -1), grade, lod);
  wing(out, clip(outline, 24.1, 1), grade, lod);
  pavilionFront(out, outline, grade, lod);
}
const palace = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [113, 57, 139],
    lookAt: [5, 7, 1],
    yaw: 0.88,
    sun: [-330, 560, 410],
    brief:
      'The standing Al Alam ceremonial palace in Old Muscat, with the colorful flared columns, flat projecting roof and two white wings.',
    views: [
      { name: 'ceremonial-boulevard-palace-front', position: [39, 30, 137], lookAt: [4, 8, 4] },
      { name: 'gold-and-blue-flared-colonnade', position: [10, 15, 54], lookAt: [4, 8, 14] },
      { name: 'west-wing-and-central-pavilion', position: [-112, 42, 81], lookAt: [-19, 7, 1] },
      { name: 'east-wing-and-flat-roof', position: [130, 61, -44], lookAt: [21, 8, 2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = palace;
export const model = { ...palace.model, category: 'palace' };
