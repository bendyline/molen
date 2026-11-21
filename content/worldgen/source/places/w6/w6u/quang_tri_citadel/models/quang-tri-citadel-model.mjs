import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  closed,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  sandstone: 'a8a69b',
  limestone: 'c3bdab',
  stone: '969990',
  blocked: '797d73',
  moss: '777d60',
  brick: 'a37356',
  ruin: '867462',
  roof: '9b5c45',
  water: '607d80',
  pavers: 'a8907d',
  grass: '7f8958',
  soil: '928160',
  brass: 'a68d57',
  lamp: '867455',
  charcoal: '424748',
  inscription: 'bca46a',
  plaster: 'c6b391',
  shade: '766e5d',
  wood: '62584c',
  window: '4b514b',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone_weathered', 0.95),
  brick: surface('wall', 'brick_flemish', 0.93),
  roof: surface('roof', 'tile_ceramic', 0.82),
  footing: surface('foundation', 'stone_ashlar', 0.94),
  granite: surface('wall', 'stone_granite', 0.46),
  trim: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.72 },
  ground: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96 },
  water: { slot: 'foundation', localRef: 'palette:#f6ffff', roughness: 0.36 },
};
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const len = (p) => Math.hypot(...p);
const mul = (p, t) => p.map((v) => v * t);
const sum = (a, b) => a.map((v, i) => v + b[i]);
const vector = (a, b) => a.map((v, i) => b[i] - v);
const unit = (p) => mul(p, 1 / len(p));
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function alignment(point, direction) {
  const forward = unit(direction),
    right = [forward[1], -forward[0]];
  const locate = (x, z) => sum(point, sum(mul(right, x), mul(forward, z)));
  return { forward, right, point: (x, y, z) => at(locate(x, z), y), locate };
}
function orientedBlock(out, slot, loc, a, b, color) {
  const [x, y, z] = a,
    [r, top, end] = b;
  const p = (u, v, w) => loc.point(u, v, w);
  const { right, forward } = loc;
  const directions = [
    [[p(x, y, end), p(r, y, end), p(r, top, end), p(x, top, end)], [...at(forward, 0)]],
    [[p(r, y, z), p(x, y, z), p(x, top, z), p(r, top, z)], at(mul(forward, -1), 0)],
    [[p(r, y, end), p(r, y, z), p(r, top, z), p(r, top, end)], at(right, 0)],
    [[p(x, y, z), p(x, y, end), p(x, top, end), p(x, top, z)], at(mul(right, -1), 0)],
    [[p(x, top, z), p(r, top, z), p(r, top, end), p(x, top, end)], up],
  ];
  for (const [polygon, normal] of directions) face(out, slot, polygon, normal, color);
}
function cap(out, slot, outline, floor, color) {
  const t = earcut(outline.flat());
  for (let i = 0; i < t.length; i += 3) {
    face(
      out,
      slot,
      t.slice(i, i + 3).map((k) => at(outline[k], floor)),
      up,
      color,
    );
  }
}

function masonryRun(out, a, b, width, high, level, slot = 'footing', color = c.stone) {
  const dir = unit(vector(a, b)),
    normal = [dir[1], -dir[0]];
  const wide = width * 0.5;
  const distance = len(vector(a, b));
  const parts = level === 0 ? 1 : Math.max(1, Math.ceil(distance / (level === 1 ? 34 : 16)));
  const station = (i) => {
    const p = lerp(a, b, i / parts);
    const floor = grade(p);
    const points = [sum(p, mul(normal, wide)), sum(p, mul(normal, -wide))];
    const crest = points.map((pt) => at(lerp(pt, p, high > 1 ? 0.17 : 0), floor + high));
    return [points.map((pt) => at(pt, grade(pt) - 0.24)), crest];
  };
  for (let i = 0; i < parts; i++) {
    const [base, crest] = station(i),
      [end, top] = station(i + 1);
    if (level > 0 || high > 1)
      for (const side of [0, 1]) {
        face(
          out,
          slot,
          [base[side], end[side], top[side], crest[side]],
          at(mul(normal, side === 0 ? 1 : -1), 0),
          color,
        );
      }
    face(out, slot, [crest[0], top[0], top[1], crest[1]], up, high > 1 ? c.moss : color);
    if (level >= 2 && i === 0)
      face(out, slot, [base[0], base[1], crest[1], crest[0]], at(mul(dir, -1), 0), color);
    if (level >= 2 && i === parts - 1)
      face(out, slot, [end[1], end[0], top[0], top[1]], at(dir, 0), color);
  }
}
function enclosure(out, level) {
  for (const [a, b] of pairs(closed(d.outline))) {
    const p = at(a, 0),
      q = at(b, 0);
    if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 3) continue;
    const nearGate = d.gateCenters.some((g) => len(vector(g, lerp(a, b, 0.5))) < 11);
    if (!nearGate) masonryRun(out, a, b, 1.04, 0.39, level);
  }
  for (const [i, run] of d.wallRuns.entries()) {
    for (const [a, b] of pairs(run)) {
      const h = [2.73, 2.57, 1.6, 2.48, 2.82, 3.3, 1.89][i];
      masonryRun(out, a, b, i === 5 ? 4.5 : 3.3, h, level, 'brick', i === 5 ? c.brick : c.ruin);
    }
  }
  for (const moat of d.moats) {
    const pivot = moat.reduce(
      (sum, p) => [sum[0] + p[0] / moat.length, sum[1] + p[1] / moat.length],
      [0, 0],
    );
    const y = grade(pivot) + 0.04;
    cap(
      out,
      'water',
      moat.map((p) => lerp(p, pivot, 0.012)),
      y,
      c.water,
    );
  }
}

function bridge(out, line, level, index) {
  const [a, b] = line,
    base = len(a) < len(b) ? a : b,
    far = base === a ? b : a;
  const f = alignment(base, vector(base, far));
  const distance = len(vector(base, far));
  const y0 = grade(base) + 0.23,
    y1 = grade(far) + 0.26,
    height = Math.min(y0, y1) - 0.53;
  const w = index === 0 ? 4.8 : 3.05;
  orientedBlock(
    out,
    'footing',
    f,
    [-w / 2, height, 0],
    [w / 2, Math.max(y0, y1), distance],
    c.pavers,
  );
  for (const direction of [-1, 1]) {
    const x = direction * w * 0.5;
    beam(
      out,
      'stone',
      f.point(x, y0 + 0.72, 0.25),
      f.point(x, y1 + 0.72, distance - 0.24),
      0.3,
      0.36,
      c.stone,
    );
    if (level >= 1) {
      const n = Math.max(2, Math.round(distance / (level >= 2 ? 3.12 : 6.3)));
      for (let i = 0; i <= n; i++) {
        const t = i / n,
          z = 0.29 + (distance - 0.58) * t;
        const y = mix(y0, y1, t);
        orientedBlock(
          out,
          'stone',
          f,
          [x - 0.17, y - 0.03, z - 0.17],
          [x + 0.17, y + 0.82, z + 0.17],
          c.limestone,
        );
      }
    }
  }
}

function portalShell(
  out,
  f,
  y,
  diameter,
  wide,
  halfLength,
  spring,
  ceiling,
  level,
  material = 'stone',
) {
  const r = diameter * 0.5,
    rise = r * 0.79;
  const point = (a, z) => f.point(r * Math.cos(a), spring + Math.sin(a) * rise, z);
  const n = [3, 6, 10, 16][level];
  for (const z of [-halfLength, halfLength]) {
    const normal = at(mul(f.forward, Math.sign(z)), 0);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n;
      const A = point(a, z),
        B = point(b, z);
      const roof = (t) => f.point(r * Math.cos(t), ceiling, z);
      face(out, material, [B, A, roof(a), roof(b)], normal, c.sandstone);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    face(
      out,
      material,
      [point(a, -halfLength), point(a, halfLength), point(b, halfLength), point(b, -halfLength)],
      [0, -1, 0],
      c.blocked,
    );
  }
  orientedBlock(out, material, f, [-wide, y, -halfLength], [-r, ceiling, halfLength], c.sandstone);
  orientedBlock(out, material, f, [r, y, -halfLength], [wide, ceiling, halfLength], c.sandstone);
}
function curvedGateRoof(out, f, base, w, dpth, level) {
  const count = [4, 6, 9, 13][level];
  for (let i = 0; i < count; i++) {
    const left = mix(-w, w, i / count),
      right = mix(-w, w, (i + 1) / count);
    const shape = (x, t, sign) =>
      f.point(x, base + (Math.abs(x) / w) ** 2 * 0.54 + 1.26 * t, dpth * (1 - t) * sign);
    for (const z of [-1, 1]) {
      const a = shape(left, 0, z),
        b = shape(right, 0, z);
      const A = shape(left, 1, z),
        B = shape(right, 1, z);
      face(out, 'roof', [a, b, B, A], up, c.roof);
      if (level >= 1) beam(out, 'roof', a, b, 0.16, 0.14, c.brick);
      if (level >= 2) beam(out, 'roof', a, A, 0.07, 0.085, c.roof);
    }
    if (level >= 1) beam(out, 'roof', shape(left, 1, 1), shape(right, 1, 1), 0.16, 0.19, c.roof);
  }
  for (const sign of [-1, 1]) {
    const x = sign * w;
    face(
      out,
      'stone',
      [f.point(x, base + 0.54, -dpth), f.point(x, base + 1.8, 0), f.point(x, base + 0.54, dpth)],
      at(mul(f.right, sign), 0),
      c.sandstone,
    );
  }
  if (level >= 1) {
    for (const x of [-w, -0.51 * w, 0, 0.51 * w, w]) {
      const y = base + 1.24 + (Math.abs(x) / w) ** 2 * 0.44;
      orientedBlock(out, 'stone', f, [x - 0.12, y, -0.15], [x + 0.12, y + 0.41, 0.15], c.limestone);
    }
  }
}
function gate(out, index, level) {
  const p = d.gateCenters[index];
  const [a, b] = d.crossings[index];
  const far = len(a) < len(b) ? b : a;
  const frame = alignment(p, vector(p, far));
  const base = grade(p) + 0.17;
  const south = index === 0;
  const half = south ? 3.35 : 2.86;
  const wallHeight = south ? 5.34 : 4.47;
  portalShell(
    out,
    frame,
    base - 0.12,
    d.gateOpeningWidth,
    6.05,
    half,
    base + 2.01,
    base + wallHeight,
    level,
  );
  for (const direction of [-1, 1]) {
    const x = direction * 12.55;
    const from = frame.locate(x, 0),
      to = frame.locate(direction * 5.94, 0);
    masonryRun(out, from, to, south ? 4.06 : 2.9, south ? 4.14 : 2.44, level, 'stone', c.sandstone);
    const side = at(mul(frame.forward, direction), 0);
    const z = (half + 0.036) * direction;
    if (level >= 1) {
      for (const u of [-5.76, -3.64, 3.64, 5.76]) {
        orientedBlock(
          out,
          'footing',
          frame,
          [u - 0.165, base, z - 0.06],
          [u + 0.165, base + wallHeight - 0.13, z + 0.06],
          c.limestone,
        );
        orientedBlock(
          out,
          'stone',
          frame,
          [u - 0.26, base + wallHeight - 0.14, z - 0.1],
          [u + 0.27, base + wallHeight + 0.03, z + 0.105],
          c.limestone,
        );
      }
      const start = 2.21;
      for (const flip of [-1, 1]) {
        for (let r = 0; r < (level === 1 ? 4 : 9); r++) {
          const yy = base + 0.39 + r * (level === 1 ? 0.91 : 0.44);
          const x = flip * (start + 0.115 * r);
          const front = frame.point(x, yy, z + 0.037 * direction);
          const end = frame.point(x + flip * 0.33, yy + 0.39, z + 0.037 * direction);
          if (level >= 2) beam(out, 'trim', front, end, 0.025, 0.029, c.blocked);
        }
      }
      face(
        out,
        'footing',
        [
          frame.point(-6.11, base + wallHeight - 0.19, z),
          frame.point(6.11, base + wallHeight - 0.19, z),
          frame.point(6.11, base + wallHeight + 0.018, z),
          frame.point(-6.11, base + wallHeight + 0.018, z),
        ],
        side,
        c.limestone,
      );
    }
  }
  const tower = base + wallHeight;
  const crownWidth = south ? 1.97 : 1.83;
  portalShell(out, frame, tower - 0.025, 1.55, crownWidth, 1.06, tower + 0.98, tower + 2.54, level);
  curvedGateRoof(out, frame, tower + 2.51, crownWidth + 0.37, 1.64, level);
}

const moundBase = grade([0, 0]) + 0.15;
const topY = moundBase + 5.72;
function memorial(out, level) {
  const n = [10, 20, 32, 48][level];
  const outline = d.memorialFoot;
  const ring = (yy, ratio) =>
    Array.from({ length: n }, (_, i) => {
      const p = outline[Math.floor((i * outline.length) / n)];
      return at(mul(p, ratio), yy);
    });
  loft(
    out,
    'brick',
    [ring(moundBase - 0.16, 1), ring(moundBase + 0.34, 1), ring(moundBase + 0.52, 0.965)],
    c.pavers,
  );
  loft(
    out,
    'ground',
    [
      ring(moundBase + 0.36, 0.978),
      ring(moundBase + 1.68, 0.861),
      ring(moundBase + 3.03, 0.735),
      ring(topY - 0.4, 0.44),
      ring(topY, 0.392),
    ],
    c.grass,
  );
  cap(out, 'brick', d.memorialTop, topY + 0.025, c.pavers);
  if (level >= 1) {
    loft(out, 'brick', [ring(moundBase + 2.27, 0.793), ring(moundBase + 2.48, 0.773)], c.pavers, {
      cap: false,
    });
    loft(out, 'brick', [ring(topY - 0.28, 0.455), ring(topY - 0.095, 0.441)], c.pavers, {
      cap: false,
    });
  }
  for (const [i, line] of d.memorialStairs.entries()) {
    const outer = line.reduce((a, b) => (len(a) > len(b) ? a : b));
    const dir = unit(mul(outer, -1)),
      f = alignment(outer, dir);
    const clamped = grade(outer) - 0.22,
      length = len(outer) - 7.15;
    const count = [2, 8, 13, i === 0 ? 21 : 20][level];
    for (let j = 0; j < count; j++) {
      const z = (length * j) / count;
      const y = mix(grade(outer) + 0.16, topY + 0.093, (j + 1) / count);
      orientedBlock(
        out,
        'brick',
        f,
        [-1.26, clamped, z],
        [1.26, y, z + length / count + 0.017],
        c.pavers,
      );
    }
    if (level >= 2) {
      for (const x of [-1.36, 1.36]) {
        beam(
          out,
          'footing',
          f.point(x, grade(outer) + 0.45, 0.02),
          f.point(x, topY + 0.34, length),
          0.15,
          0.17,
          c.stone,
        );
      }
    }
  }
  const p = [0, 0],
    sides = [6, 12, 16, 24][level];
  const rescale = (y) => topY + y * d.memorialLampHeight;
  const bronze = [
    [0, 1.43],
    [0.053, 1.48],
    [0.084, 1.12],
    [0.127, 0.78],
    [0.41, 0.55],
    [0.66, 0.43],
    [0.69, 0.48],
    [0.715, 0.72],
    [0.773, 1.11],
    [0.818, 1.27],
    [0.86, 0.91],
    [0.91, 0.45],
    [1, 0.065],
  ];
  loft(
    out,
    'trim',
    (level === 0 ? bronze.filter((_, i) => i % 2 === 0) : bronze).map(([t, r]) =>
      radialRing(rescale(t), r, r, sides, p),
    ),
    c.lamp,
  );
  if (level >= 1) {
    for (let i = 0; i < sides; i += level === 1 ? 3 : 2) {
      const a = (2 * Math.PI * i) / sides;
      const q0 = polar(0.62, a),
        q1 = polar(0.47, a);
      beam(out, 'trim', at(q0, rescale(0.21)), at(q1, rescale(0.67)), 0.047, 0.048, c.brass);
    }
  }
}

function exhibition(out, level) {
  const p = d.museum;
  const pivot = p.reduce((c, pt) => [c[0] + pt[0] / p.length, c[1] + pt[1] / p.length], [0, 0]);
  const y = grade(pivot) + 0.12;
  shell(out, p, (q) => grade(q) - 0.32, y + 3.93, {
    wall: 'stone',
    roof: 'stone',
    color: c.plaster,
    roofColor: c.sandstone,
  });
  const f = alignment(pivot, [0, 1]);
  const height = y + 3.78;
  const roofVertices = p.map((q) => lerp(q, pivot, -0.03));
  for (const [a, b] of pairs(closed(roofVertices))) {
    const crest = (q) => at(lerp(q, pivot, 0.73), height + 1.86);
    face(out, 'roof', [at(a, height), at(b, height), crest(b), crest(a)], up, c.roof);
  }
  cap(
    out,
    'roof',
    roofVertices.map((q) => lerp(q, pivot, 0.73)),
    height + 1.86,
    c.roof,
  );
  const south = Math.max(...p.map((q) => q[1])) - pivot[1];
  const wide = Math.max(...p.map((q) => q[0])) - pivot[0];
  const bay = Math.max(1.81, wide / 5);
  for (const i of level === 0 ? [] : [-3, -2, -1, 0, 1, 2, 3]) {
    const x = i * bay;
    const half = i === 0 ? 0.94 : 0.7;
    orientedBlock(
      out,
      'trim',
      f,
      [x - half, y + 0.92 * (i !== 0), south - 0.31],
      [x + half, y + 2.78, south + 0.041],
      c.window,
    );
    if (level >= 1 && i !== 0) {
      beam(
        out,
        'trim',
        f.point(x, y + 1.0, south + 0.064),
        f.point(x, y + 2.76, south + 0.064),
        0.056,
        0.057,
        c.wood,
      );
    }
  }
}
function studentMemorial(out, level) {
  const p = d.studentMemorial,
    y = grade(p);
  const f = alignment(p, [-0.47, 0.88]);
  orientedBlock(out, 'footing', f, [-5.71, y - 0.25, -1.84], [5.71, y + 0.26, 2.08], c.stone);
  const cuts = [
    [-4.8, 3.08],
    [-2.65, 3.7],
    [0, 3.49],
    [2.39, 2.93],
    [4.78, 2.54],
  ];
  for (const [[a, h], [b, j]] of pairs(cuts)) {
    for (const s of [-1, 1]) {
      const z = 0.42 * s;
      face(
        out,
        'granite',
        [
          f.point(a, y + 0.22, z),
          f.point(b, y + 0.22, z),
          f.point(b, y + j, z),
          f.point(a, y + h, z),
        ],
        at(mul(f.forward, s), 0),
        c.charcoal,
      );
    }
    face(
      out,
      'granite',
      [
        f.point(a, y + h, -0.42),
        f.point(b, y + j, -0.42),
        f.point(b, y + j, 0.42),
        f.point(a, y + h, 0.42),
      ],
      up,
      c.charcoal,
    );
  }
  const z = 0.426,
    eye = [-3.17, y + 2.79];
  for (let i = 0; i < 10; i++) {
    const t = (i * Math.PI) / 5,
      h = ((i + 1) * Math.PI) / 5;
    const q = (a, r) => f.point(eye[0] + Math.sin(a) * r, eye[1] + Math.cos(a) * r, z);
    face(
      out,
      'trim',
      [
        f.point(eye[0], eye[1], z),
        q(t, i % 2 === 0 ? 0.37 : 0.153),
        q(h, i % 2 === 0 ? 0.153 : 0.37),
      ],
      at(f.forward, 0),
      c.inscription,
    );
  }
  if (level >= 2) {
    for (const x of [-2.6, -0.37, 1.88, 3.94]) {
      beam(
        out,
        'trim',
        f.point(x, y + 0.26, 0.423),
        f.point(x, y + 2.36, 0.426),
        0.025,
        0.023,
        c.shade,
      );
    }
  }
}
function build(out, level) {
  enclosure(out, level);
  for (const [i, line] of d.crossings.entries()) bridge(out, line, level, i);
  gate(out, 0, level);
  gate(out, 1, level);
  memorial(out, level);
  exhibition(out, level);
  studentMemorial(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'quang-tri-citadel-model.mjs';
const camera = [635, 545, 675],
  lookAt = [0, 4, 0];
const errors = { district: 1.25, street: 0.48, closeup: 0.14 };
export const quangTriAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'fort-castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Native citadel axes and the original terrain source immediately south of the memorial.',
  brief:
    'The present Quảng Trị Citadel with its surviving gates, wall fragments, crossings, circular memorial and student monument.',
  camera,
  lookAt,
  sunDirection: [92, 109, 103],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.museum,
    minimumCoverage: 0.92,
    basis:
      'The footprint of the exhibition building. The open citadel remains available around it.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'brick_flemish',
    'tile_ceramic',
    'stone_ashlar',
    'stone_granite',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'south-gate-and-bridge', position: [30, 16, 234], lookAt: [4, 4.6, 200] },
    { name: 'memorial-mound-stairs-and-lamp', position: [58, 32, 67], lookAt: [0, 6, 0] },
    { name: 'northeast-student-memorial', position: [108, 6, -89], lookAt: [114, 1.8, -115] },
    { name: 'remaining-walls-and-north-gate', position: [70, 25, -236], lookAt: [5, 4, -196] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'quang-tri-citadel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.46,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense: 'Original mesh under repository license. © OpenStreetMap contributors.',
};
