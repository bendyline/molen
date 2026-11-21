import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const colors = palette({
  rock: '838074',
  ashlar: 'a8a59a',
  gray: '969388',
  darkStone: '737166',
  battlement: 'a09b8a',
  pave: 'a9a596',
  plaster: 'e0dfd0',
  cream: 'cfcbb9',
  antiqueWhite: 'cfccba',
  wood: '655347',
  aged: '776151',
  darkTimber: '4a433a',
  dark: '45473e',
  roof: '5c6765',
  ridge: '51635d',
  tile: '74817b',
  mellow: '978572',
  terraceGround: '888775',
});
const surfaces = {
  rock: surface('foundation', 'stone_granite', 0.96),
  ashlar: surface('trim', 'stone_ashlar', 0.92),
  plaster: surface('wall', 'plaster_lime', 0.93),
  wood: surface('trim', 'wood_weatherboard', 0.89),
  tile: surface('roof', 'clay_fired', 0.91),
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94 },
};
const mean = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
const blend = ([x, z], [u, v], t) => [mix(x, u, t), mix(z, v, t)];
const along = ([x, z], [a, b], v) => [x + a * v, z + b * v];
const len = ([x, z], [a, b]) => Math.hypot(x - a, z - b);
const center = (points) =>
  points.reduce(([x, z], [a, b]) => [x + a / points.length, z + b / points.length], [0, 0]);
const sample = (value, p) => (typeof value === 'number' ? value : value(p));
const fujimiLowerGround = [
  [115, 324],
  [125, 334],
  [121, 355],
  [109, 360],
  [93, 346],
  [95, 334],
];
const fujimiClearanceHeight = -20;

function frame(outline) {
  const spans = pairs(closed(outline));
  const [a, b] = spans.reduce(
    (best, edge) => (len(...edge) > len(...best) ? edge : best),
    spans[0],
  );
  const length = len(a, b),
    cx = (b[0] - a[0]) / length,
    sx = (b[1] - a[1]) / length;
  const basis = ([x, z]) => [x * cx + z * sx, z * cx - x * sx];
  const world = ([u, v]) => [u * cx - v * sx, u * sx + v * cx];
  const points = outline.map(basis);
  const r = [0, 1].map((i) => [
    Math.min(...points.map((p) => p[i])),
    Math.max(...points.map((p) => p[i])),
  ]);
  const mid = [(r[0][0] + r[0][1]) * 0.5, (r[1][0] + r[1][1]) * 0.5];
  return {
    center: world(mid),
    w: r[0][1] - r[0][0],
    d: r[1][1] - r[1][0],
    p: (u, v) => world([u + mid[0], v + mid[1]]),
    normal: [-sx, cx],
  };
}

const corners = (f, w, l) => [
  f.p(-w / 2, l / 2),
  f.p(w / 2, l / 2),
  f.p(w / 2, -l / 2),
  f.p(-w / 2, -l / 2),
];
function envelope(out, ring, low, high, slot, color) {
  const winding = areaSign(ring);
  for (const [a, b] of pairs(closed(ring))) {
    if (len(a, b) < 0.035) continue;
    const normal = edge(a, b, winding).normal;
    face(
      out,
      slot,
      [at(a, sample(low, a)), at(b, sample(low, b)), at(b, high), at(a, high)],
      normal,
      color,
    );
  }
}
function capped(out, ring, low, high, slot, color) {
  envelope(out, ring, low, high, slot, color);
  cap(out, slot, ring, high, color);
}

function slopedStone(out, level, lower, upper, bottom, top, tint = colors.rock) {
  const sign = areaSign(lower);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length,
      a = lower[i],
      b = lower[j],
      c = upper[j],
      d = upper[i];
    const normal = edge(a, b, sign).normal;
    const bottomA = sample(bottom, a),
      bottomB = sample(bottom, b);
    const y = (t, u) => mix(mix(bottomA, bottomB, u), top, t);
    const q = (t, u) => at(blend(blend(a, b, u), blend(d, c, u), t), y(t, u));
    if (level < 2) {
      face(out, 'rock', [q(0, 0), q(0, 1), q(1, 1), q(1, 0)], normal, tint);
      continue;
    }
    const rows = Math.ceil((top - Math.min(bottomA, bottomB)) / (level === 2 ? 1.8 : 1.28));
    const columns = Math.max(1, Math.ceil(len(a, b) / (level === 2 ? 5.4 : 3.4)));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const u0 = c / columns,
          u1 = (c + 1) / columns,
          t = r / rows,
          s = (r + 1) / rows;
        const d = (r * 19 + c * 13 + i * 11) % 7;
        face(
          out,
          'rock',
          [q(t, u0), q(t, u1), q(s, u1), q(s, u0)],
          normal,
          d < 2 ? colors.darkStone : d > 5 ? colors.gray : tint,
        );
      }
  }
}

function donjon(out, level) {
  const source = d.outline,
    main = [source[8], source[11], source[12], source[0]];
  const focus = center(main);
  const base = Math.max(0.67, grade([focus[0], focus[1] + 26]) - 0.11);
  const crest = base + d.keepHeight;
  const upper = main.map((p) => blend(p, focus, 0.14));
  slopedStone(
    out,
    level,
    main,
    upper,
    (p) => Math.min(base - 0.37, grade(p) - 0.35),
    crest,
    colors.ashlar,
  );
  cap(out, 'ashlar', upper, crest, colors.pave);
  const rim = upper.map((p) => blend(p, focus, 0.042));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (i === 3) continue;
    face(
      out,
      'ashlar',
      [
        at(upper[i], crest + 0.25),
        at(upper[j], crest + 0.25),
        at(rim[j], crest + 0.25),
        at(rim[i], crest + 0.25),
      ],
      up,
      colors.gray,
    );
    const normal = edge(upper[i], upper[j], areaSign(upper)).normal;
    face(
      out,
      'rock',
      [
        at(upper[i], crest - 0.04),
        at(upper[j], crest - 0.04),
        at(upper[j], crest + 0.25),
        at(upper[i], crest + 0.25),
      ],
      normal,
      colors.darkStone,
    );
  }
  const outer = [source[1], source[2], source[6], source[7], source[10], source[8]];
  const terrace = base + 3.2;
  capped(out, outer, (p) => Math.min(grade(p) - 0.4, base - 0.2), terrace, 'rock', colors.ashlar);
  const turn = [
    [-78.6, -86.2],
    [-60.5, -92.4],
    [-57.25, -101.4],
    [-65.5, -119.3],
  ];
  for (let seg = 0; seg < turn.length - 1; seg++) {
    const a = turn[seg],
      b = turn[seg + 1],
      n = [1, 4, 7, 11][level];
    const w = edge(a, b),
      across = [w.normal[0], w.normal[2]];
    const y0 = [base + 0.22, terrace - 0.16, base + 5.56][seg],
      y1 = [terrace - 0.16, base + 5.56, crest - 0.04][seg];
    for (let i = 0; i < n; i++) {
      const p = blend(a, b, i / n),
        q = blend(a, b, (i + 1) / n),
        y = mix(y0, y1, (i + 1) / n),
        prev = mix(y0, y1, i / n);
      const aa = along(p, across, 1.11),
        bb = along(q, across, 1.11),
        cc = along(q, across, -1.11),
        dd = along(p, across, -1.11);
      face(out, 'ashlar', [at(aa, y), at(bb, y), at(cc, y), at(dd, y)], up, colors.pave);
      face(
        out,
        'ashlar',
        [at(aa, prev), at(dd, prev), at(dd, y), at(aa, y)],
        w.normal,
        colors.gray,
      );
    }
  }
}

function curvedRoof(out, level, f, w, l, y, rise, hip, gableColor = colors.cream) {
  const across = [-0.5, -0.28, 0, 0.28, 0.5];
  const ranks = level === 0 ? [0, 1] : level === 1 ? [0, 0.55, 1] : [0, 0.24, 0.55, 0.83, 1];
  const xCoords = level === 0 ? [-0.5, 0.5] : across;
  const h = (u, t) =>
    y + rise * (0.7 * t + 0.3 * t * t) + 0.82 * (Math.abs(u) * 2) * (Math.abs(u) * 2) * (1 - t);
  const foot = (u, t, sign) => at(f.p(w * u * (1 - hip * t), l * 0.5 * (1 - t) * sign), h(u, t));
  for (const sign of [-1, 1])
    for (let q = 0; q < xCoords.length - 1; q++) {
      const a = xCoords[q],
        b = xCoords[q + 1];
      for (const [t, u] of pairs(ranks)) {
        face(
          out,
          'tile',
          [foot(a, t, sign), foot(b, t, sign), foot(b, u, sign), foot(a, u, sign)],
          up,
          q % 3 === 1 ? colors.tile : colors.roof,
        );
        if (level > 1 && u < 1 && Math.abs(a) > 0.19)
          beam(
            out,
            'tile',
            foot(a, t, sign).map((x, i) => x + (i === 1 ? 0.043 : 0)),
            foot(a, u, sign).map((x, i) => x + (i === 1 ? 0.047 : 0)),
            0.076,
            0.07,
            colors.tile,
          );
      }
    }
  for (const corner of [-0.5, 0.5]) {
    const tip = foot(corner, 1, 1);
    const view = [f.p(corner, 0)[0] - f.center[0], 0, f.p(corner, 0)[1] - f.center[1]];
    const shell = [foot(corner, 0, 1), tip, foot(corner, 0, -1)];
    face(out, 'plaster', shell, view, gableColor);
    if (level > 1) {
      beam(out, 'tile', shell[0], tip, 0.18, 0.25, colors.ridge);
      beam(out, 'tile', shell[2], tip, 0.18, 0.25, colors.ridge);
    }
  }
  const a = foot(-0.5, 1, 1),
    b = foot(0.5, 1, 1);
  beam(out, 'tile', a, b, 0.36, 0.32, colors.ridge);
  if (level > 0)
    for (const sign of [-1, 1])
      for (const [a, b] of pairs(xCoords))
        beam(
          out,
          'wood',
          foot(a, 0, sign).map((p, i) => (i === 1 ? p - 0.15 : p)),
          foot(b, 0, sign).map((p, i) => (i === 1 ? p - 0.15 : p)),
          0.14,
          0.19,
          colors.darkTimber,
        );
}

function windows(out, level, outline, lo, hi, mark, narrow = false) {
  if (level === 0) return;
  const winding = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    if (len(a, b) < 2.1) continue;
    const e = edge(a, b, winding),
      n = Math.max(1, Math.round(e.length / (level === 1 ? 5.7 : 3.4)));
    const u = e.length / n;
    for (let i = 0; i < n; i++) {
      const mid = (i + 0.5) * u,
        width = Math.min(narrow ? 0.33 : 0.57, u * 0.2);
      panel(out, 'accent', e, mid - width, mid + width, lo, hi, 0.055, mark);
      if (level > 1) {
        panel(
          out,
          'wood',
          e,
          mid - width - 0.081,
          mid + width + 0.081,
          lo - 0.105,
          lo,
          0.109,
          colors.aged,
        );
        panel(out, 'wood', e, mid - 0.063, mid + 0.061, lo, hi, 0.098, colors.wood);
      }
    }
  }
}

function fujimi(out, level) {
  const f = frame(d.turret),
    base = grade(f.center) + 0.48;
  const upper = corners(f, f.w * 1.05, f.d * 1.07),
    under = corners(f, f.w * 1.55, f.d * 1.55);
  slopedStone(
    out,
    level,
    under,
    upper,
    (p) => Math.min(grade(p) - 0.34, base - d.towerFoundation),
    base,
    colors.darkStone,
  );
  cap(out, 'accent', fujimiLowerGround, fujimiClearanceHeight + 0.07, colors.terraceGround);
  cap(out, 'rock', upper, base, colors.gray);
  for (const [w, l, start, end, rise, hip] of [
    [1.02, 1.02, 0, 4.2, 2.25, 0.19],
    [0.79, 0.8, 4.28, 8.51, 2.05, 0.2],
    [0.61, 0.63, 8.54, 12.6, 3.4, 0.27],
  ]) {
    const body = corners(f, f.w * w, f.d * l);
    envelope(out, body, base + start, base + end, 'plaster', colors.plaster);
    windows(out, level, body, base + start + 1.04, base + end - 0.63, colors.antiqueWhite, true);
    curvedRoof(out, level, f, f.w * w + 3.11, f.d * l + 3.02, base + end, rise, hip);
  }
  if (level > 0)
    for (const sign of [-1, 1]) {
      const f0 = (u, y, v = 0) => at(f.p(u, f.d * 0.5 * sign + v * sign), base + y);
      const bottom = [f0(-2.88, 3.7, 0.22), f0(2.88, 3.7, 0.22)],
        top = f0(0, 6.58, 0.36);
      const norm = [f.normal[0] * sign, 0, f.normal[1] * sign];
      face(out, 'wood', [bottom[0], bottom[1], top], norm, colors.ridge);
      for (const p of bottom) beam(out, 'tile', p, top, 0.235, 0.29, colors.tile);
      if (level > 1)
        for (const x of [-2.9, -1.48, 1.48, 2.9])
          beam(out, 'wood', f0(x, 0.04, 0.21), f0(x, 0.65, 0.51), 0.31, 0.41, colors.cream);
    }
}

function guardhouse(out, level, record, config) {
  const f = frame(record.outline);
  const { plaster = false, floor, height = 2.77, rise = 2.22, deck = true, front = 1 } = config;
  const base = floor ?? grade(f.center) + 0.13;
  const { w, d } = f;
  const foundation = corners(f, w * 1.013, d * 1.032);
  capped(
    out,
    foundation,
    (p) => Math.min(grade(p) - 0.23, base - 0.33),
    base,
    'ashlar',
    colors.gray,
  );
  const house = corners(f, w * 0.96, d * 0.87),
    y = base + height;
  envelope(
    out,
    house,
    base,
    y,
    plaster ? 'plaster' : 'wood',
    plaster ? colors.plaster : colors.wood,
  );
  curvedRoof(
    out,
    level,
    f,
    w * 1.01 + 0.73,
    d + 1.17,
    y,
    rise,
    0,
    plaster ? colors.plaster : colors.darkTimber,
  );
  windows(
    out,
    level,
    house,
    base + 0.64,
    base + height - 0.43,
    plaster ? colors.aged : colors.darkTimber,
    plaster,
  );
  if (!deck) return;
  const n = level === 0 ? 2 : Math.max(2, Math.round(w / (level === 1 ? 6.1 : 3.8)));
  const z = d * 0.58 * front,
    zBack = d * 0.397 * front;
  const point = (u, v, y) => at(f.p(u, v), y);
  const [low, high] = [-w / 2 + 0.27, w / 2 - 0.27];
  face(
    out,
    'tile',
    [
      point(low, z, y - 0.76),
      point(high, z, y - 0.76),
      point(high, zBack, y - 0.06),
      point(low, zBack, y - 0.06),
    ],
    up,
    colors.roof,
  );
  for (let i = 0; i <= n; i++) {
    const x = mix(low + 0.17, high - 0.14, i / n);
    beam(out, 'wood', point(x, z, base), point(x, z, y - 0.76), 0.16, 0.18, colors.aged);
  }
}

function woodenBuildings(out, level) {
  for (const g of d.guardhouses) {
    const wide = g.id === 176109786;
    guardhouse(out, level, g, {
      height: wide ? 3.34 : 2.7,
      rise: wide ? 2.62 : 2.15,
      front: wide ? -1 : 1,
    });
  }
  const f = frame(d.longDefence),
    base = grade(f.center) + 0.45;
  const bottom = corners(f, f.w + 9, f.d + 10),
    top = corners(f, f.w + 0.35, f.d + 0.46);
  slopedStone(
    out,
    level,
    bottom,
    top,
    (p) => Math.min(grade(p) - 0.26, base - d.longDefenceFoundation),
    base,
    colors.darkStone,
  );
  cap(out, 'rock', top, base, colors.gray);
  guardhouse(
    out,
    level,
    { outline: d.longDefence },
    { plaster: true, floor: base, height: 3.54, rise: d.longDefenceHeight - 3.54, deck: false },
  );
}

function gate(out, level, record) {
  const f = frame(record.outline),
    x = f.w,
    l = f.d,
    base = grade(f.center) + 0.36;
  const portal = record.id === 184221911 ? 3.18 : 4.55;
  const entry = record.id === 617118937 ? -7.0 : 0;
  const y = base + (record.id === 184221911 ? 3.4 : 4.15);
  const gateRange = [
    [-x / 2, -portal / 2 + entry],
    [portal / 2 + entry, x / 2],
  ];
  for (const [lo, hi] of gateRange) {
    if (hi - lo < 0.2) continue;
    const g = [f.p(lo, l / 2), f.p(hi, l / 2), f.p(hi, -l / 2), f.p(lo, -l / 2)];
    capped(out, g, (p) => Math.min(grade(p) - 0.22, base - 0.36), y - 0.05, 'rock', colors.ashlar);
  }
  const top = corners(f, x * 0.98, l * 0.89),
    h = record.id === 184221911 ? 2.15 : 3.13;
  envelope(out, top, y, y + h, 'plaster', colors.plaster);
  windows(out, level, top, y + 0.58, y + h - 0.44, colors.dark, true);
  curvedRoof(out, level, f, x + 1.31, l + 1.64, y + h, record.id === 184221911 ? 1.05 : 2.16, 0.11);
  if (level > 0)
    for (const v of [-l * 0.4, l * 0.4]) {
      for (const s of [-0.7, 0.7]) {
        const p = f.p(entry + s * portal * 0.7, v);
        beam(out, 'wood', at(p, base), at(p, y), 0.38, 0.4, colors.darkTimber);
      }
      beam(
        out,
        'wood',
        at(f.p(entry - portal * 0.65, v), y - 0.41),
        at(f.p(entry + portal * 0.65, v), y - 0.41),
        0.24,
        0.47,
        colors.wood,
      );
    }
}

function wallTraces(out, level) {
  const interior = [-36, -32];
  for (const spec of d.wallTraces) {
    const points =
      level === 0
        ? spec.points.filter((_, i) => i % 2 === 0 || i === spec.points.length - 1)
        : spec.points;
    for (const [a, b] of pairs(points)) {
      const length = len(a, b);
      if (length < 0.2) continue;
      const mid = mean(a, b),
        tx = (b[0] - a[0]) / length,
        tz = (b[1] - a[1]) / length;
      const side = (interior[0] - mid[0]) * tz - (interior[1] - mid[1]) * tx < 0 ? -1 : 1,
        inward = [tz * side, -tx * side];
      const topA = Math.max(grade(a) + 0.36, grade(along(a, inward, 5.8)) + 0.25);
      const topB = Math.max(grade(b) + 0.36, grade(along(b, inward, 5.8)) + 0.25);
      const top = (u) => mix(topA, topB, u);
      const ground = (p, u) => Math.min(grade(along(p, inward, -4.3)) - 0.18, top(u) - spec.height);
      const foot = (p) => along(p, inward, -2.8);
      const alongWall = (u, t) => {
        const p = blend(a, b, u);
        return at(blend(foot(p), p, t), mix(ground(p, u), top(u), t));
      };
      const normal = [-inward[0], 0, -inward[1]];
      const cols = level < 2 ? 1 : Math.ceil(length / (level === 2 ? 13.65 : 7.7));
      const rows = level < 2 ? 1 : level === 2 ? 4 : 7;
      for (let u = 0; u < cols; u++)
        for (let v = 0; v < rows; v++) {
          const t = v / rows,
            s = (v + 1) / rows,
            r = u / cols,
            p = (u + 1) / cols;
          face(
            out,
            'rock',
            [alongWall(r, t), alongWall(p, t), alongWall(p, s), alongWall(r, s)],
            normal,
            (u * 11 + v * 7 + spec.id) % 9 < 2 ? colors.gray : colors.rock,
          );
        }
      face(
        out,
        'rock',
        [
          at(a, topA),
          at(b, topB),
          at(along(b, inward, 3.25), topB + 0.1),
          at(along(a, inward, 3.25), topA + 0.1),
        ],
        up,
        colors.battlement,
      );
    }
  }
  if (level === 0) return;
  for (const [a, b] of pairs(d.bridge)) {
    const w = edge(a, b);
    const y = Math.max(grade(a), grade(b), -6.9) + 0.45;
    const quad = [w.p(0, y, -2.7), w.p(w.length, y, -2.7), w.p(w.length, y, 2.7), w.p(0, y, 2.7)];
    face(out, 'wood', quad, up, colors.mellow);
    if (level > 1)
      for (const side of [-1, 1])
        beam(
          out,
          'wood',
          w.p(0, y + 0.67, 2.57 * side),
          w.p(w.length, y + 0.67, 2.57 * side),
          0.12,
          0.13,
          colors.aged,
        );
  }
}

function build(out, level) {
  donjon(out, level);
  fujimi(out, level);
  woodenBuildings(out, level);
  for (const g of d.gates) gate(out, level, g);
  wallTraces(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'edo-castle-model.mjs',
  camera = [648, 416, 571],
  lookAt = [144, -1, 15];
const lods = { district: 1.23, street: 0.48, closeup: 0.16 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'The original East Gardens terrain and nine precise footprints set the stone platform, gates, guardhouses and watchtowers.',
  brief:
    'Standing Edo Castle remains, including a granite keep foundation, Fujimi tower roofs, timber guardhouses, three gates and battered stone moat walls.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [150, 220, 195],
  mediumFiContext: {
    scale: 1,
    groundY: -1.66,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.allFootprints,
    minimumCoverage: 0.88,
    basis:
      'Replacement uses individual outlines of the nine modeled historic structures and leaves the grounds between them available.',
  },
  groundCutout: {
    outline: fujimiLowerGround,
    minHeight: fujimiClearanceHeight,
    basis:
      'Bounded clearance on the lower southwest side of Fujimi-yagura keeps the original terrain samples and exposes the documented 15-meter stone foundation.',
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'stone_ashlar',
    'plaster_lime',
    'wood_weatherboard',
    'clay_fired',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'east-gardens-and-moat-walls', position: [630, 525, 486], lookAt },
    { name: 'tenshudai-terraces', position: [-18, 33, -35], lookAt: [-76, 5, -117] },
    { name: 'fujimi-turret-and-stone-base', position: [65, 14, 379], lookAt: [118, -3, 335] },
    { name: 'doshin-and-hyakunin-guardhouses', position: [324, 24, 216], lookAt: [240, -8, 142] },
    { name: 'ote-mon-and-eastern-moat', position: [543, 24, 154], lookAt: [470, -15, 92] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'edo-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
