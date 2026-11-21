import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  quartzite: surface('wall', 'stone_drywall'),
  dressed: surface('trim', 'stone_ashlar'),
  sandstone: surface('wall', 'stone_sandstone'),
  white: surface('roof', 'stone_marble', 0.91),
  ruin: surface('foundation', 'stone_granite'),
  shadow: surface('door', 'wood_plain'),
};
const C = palette({
  stone: '8a8374',
  grey: '858171',
  ochre: '958570',
  seam: '756f63',
  core: '716b60',
  facing: 'a2947c',
  ruin: '9b907c',
  bed: '9e8a6a',
  red: 'a2644e',
  redDark: '8f5543',
  marble: 'e1dbc5',
  trimWhite: 'd1c5ae',
  dark: '544a3b',
  bronze: '74594a',
});
const rubble = [C.stone, C.grey, C.ochre, C.seam, C.ruin];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const vMix = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const offset = (p, v, d) => [p[0] + v[0] * d, p[1] + v[1] * d];

function ringPosts(a, b, width, batter, grade, height, shape) {
  const length = distance(a, b);
  const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const outward = [along[1], -along[0]];
  const top = width * 0.5 - batter;
  const crown = (p) => grade(p) + (shape?.height(p) ?? height);
  const slice = (p, j) => {
    const across = shape?.ends[j] ?? outward;
    const outer = offset(p, across, width / 2);
    const inner = offset(p, across, -width / 2);
    const y = crown(p);
    return [
      at(outer, Math.min(grade(outer), grade(p)) - 0.48),
      at(offset(p, across, top), y),
      at(offset(p, across, -top), y - 0.055),
      at(inner, Math.min(grade(inner), grade(p)) - 0.48),
    ];
  };
  return { endpoints: [slice(a, 0), slice(b, 1)], length, outward, along };
}

function curtain(out, lod, a, b, grade, height, width, i, ornament, shape) {
  if (distance(a, b) < 0.4) return;
  const batter = shape ? width * 0.27 : Math.min(width * 0.31, height * 0.18);
  const {
    endpoints: [l, r],
    length,
    outward,
    along,
  } = ringPosts(a, b, width, batter, grade, height, shape);
  const n = [outward[0], 0, outward[1]];
  face(out, 'quartzite', [l[0], r[0], r[1], l[1]], n, rubble[i % rubble.length]);
  face(out, 'quartzite', [l[3], r[3], r[2], l[2]], [-n[0], 0, -n[2]], C.grey);
  face(out, 'ruin', [l[1], r[1], r[2], l[2]], up, C.core);
  if (lod < 2) return;
  for (const [points, sign] of [
    [l, -1],
    [r, 1],
  ])
    face(out, 'quartzite', points, [along[0] * sign, 0, along[1] * sign], C.stone);
  if (!ornament || height < 3.2) return;

  const wall = edge(a, b);
  const count = Math.floor(length / (lod === 3 ? 4.1 : 7.2));
  for (let j = 1; j <= count; j++) {
    const u = (length * j) / (count + 1);
    const ratio = u / length;
    const y = mix(l[1][1], r[1][1], ratio);
    const depth = width / 2 - batter;
    if ((i + j) % 5 < 3) {
      const p = wall.p(u, y, depth - 0.55);
      const h = 0.3 + ((i * 3 + j) % 5) * 0.19;
      const hw = 0.49 + ((j + i) % 3) * 0.14;
      block(
        out,
        'quartzite',
        p[0] - hw,
        y - 0.08,
        p[2] - 0.44,
        hw * 2,
        h,
        0.88,
        rubble[(i + j) % rubble.length],
      );
    }
    if (height > 5.1 && (i + j * 7) % 4 === 0) {
      const high = y - 1.13;
      panel(
        out,
        'shadow',
        wall,
        u - 0.1,
        u + 0.1,
        high - 0.63,
        high,
        depth + (1.43 / height) * batter + 0.19,
        C.dark,
      );
    }
  }
}

function bastion(out, lod, center, radius, height, grade, open = false) {
  const y = grade(center);
  const cut = y + height;
  if (lod === 0) {
    const polygon = Array.from({ length: 5 }, (_, i) => {
      const angle = (i * 2 * Math.PI) / 5;
      return offset(center, [Math.cos(angle), Math.sin(angle)], radius * 0.84);
    });
    shell(out, polygon, (p) => Math.min(grade(p), y) - 0.6, cut, {
      wall: 'quartzite',
      color: C.stone,
      roof: 'ruin',
      roofColor: C.core,
    });
    return;
  }
  const segments = [7, 10, 16, 22][lod];
  ring(
    out,
    'quartzite',
    center,
    [
      [y - 1.4, radius],
      [cut - 0.35, radius * 0.76],
    ],
    segments,
    C.stone,
  );
  ring(
    out,
    'dressed',
    center,
    [
      [cut - 0.35, radius * 0.76],
      [cut, radius * 0.74],
      [cut + 0.02, open ? radius * 0.54 : 0.1],
    ],
    segments,
    C.facing,
  );
  if (open)
    ring(
      out,
      'quartzite',
      center,
      [
        [cut - 2.45, radius * 0.55],
        [cut + 0.02, radius * 0.54],
      ],
      segments,
      C.core,
    );
  if (lod < 2) return;
  for (let i = 0; i < segments; i++) {
    if (open && i % 4 === 2) continue;
    const angle = (i * 2 * Math.PI) / segments;
    const mid = offset(center, [Math.cos(angle), Math.sin(angle)], radius * 0.67);
    const w = lod === 1 ? 0.58 : 0.74;
    block(
      out,
      'quartzite',
      mid[0] - w,
      cut - 0.06,
      mid[1] - w,
      w * 2,
      i % 3 ? 0.71 : 0.44,
      w * 2,
      rubble[i % rubble.length],
    );
  }
}

function projectedOn(a, b, p) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz);
  t = Math.max(0, Math.min(1, t));
  const nearest = vMix(a, b, t);
  return { point: nearest, t, distance: distance(p, nearest) };
}

function alignGate(circuit, center) {
  let best;
  for (const [a, b] of pairs([...circuit, circuit[0]])) {
    const span = distance(a, b);
    if (span < 4) continue;
    const projection = projectedOn(a, b, center);
    if (!best || projection.distance < best.distance)
      best = { ...projection, along: [(b[0] - a[0]) / span, (b[1] - a[1]) / span] };
  }
  return best;
}

function across(a, b) {
  const span = distance(a, b);
  return [(b[1] - a[1]) / span, (a[0] - b[0]) / span];
}

function joinAcross(before, after) {
  const x = before[0] + after[0];
  const z = before[1] + after[1];
  const span = Math.hypot(x, z);
  if (span < 0.2) return after;
  const miter = Math.min(1.5, 2 / span);
  return [(miter * x) / span, (miter * z) / span];
}

function pointArch(radius, spring, top, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = (2 * i) / segments - 1;
    return [radius * t, mix(spring, top, Math.sqrt((1 - Math.abs(t)) * (1 + Math.abs(t) * 0.28)))];
  });
}

function gate(out, lod, position, along, grade, width, depth, height) {
  const v = [along[1], -along[0]];
  const base = Math.max(grade(position), grade(offset(position, v, depth / 2))) - 0.32;
  const W = width / 2;
  const radius = width * 0.247;
  const spring = base + height * 0.46;
  const peak = base + height * 0.73;
  const Y = base + height;
  const arch = pointArch(radius, spring, peak, [4, 6, 10, 14][lod]);
  const faceAt = (x, y, d) => at(offset(offset(position, along, x), v, d), y);
  for (const sign of [-1, 1]) {
    const n = [v[0] * sign, 0, v[1] * sign];
    const d = sign * depth * 0.5;
    const f = (x, y) => faceAt(x, y, d);
    for (const [l, r] of [
      [-W, -radius],
      [radius, W],
    ])
      face(out, 'quartzite', [f(l, base), f(r, base), f(r, Y), f(l, Y)], n, C.stone);
    for (const [[x, y], [u, h]] of pairs(arch))
      face(out, 'quartzite', [f(x, y), f(u, h), f(u, Y), f(x, Y)], n, C.grey);
    if (lod > 1) {
      const g = (x, y) => faceAt(x, y, d + sign * 0.17);
      beamPath(
        out,
        'dressed',
        [g(-radius, base + 0.1), ...arch.map(([x, y]) => g(x, y)), g(radius, base + 0.1)],
        0.37,
        0.31,
        C.facing,
      );
    }
  }
  const front = depth * 0.5;
  for (const x of [-W, -radius, radius, W])
    face(
      out,
      'quartzite',
      [
        faceAt(x, base, -front),
        faceAt(x, base, front),
        faceAt(x, x === -W || x === W ? Y : spring, front),
        faceAt(x, x === -W || x === W ? Y : spring, -front),
      ],
      [along[0] * Math.sign(x), 0, along[1] * Math.sign(x)],
      C.seam,
    );
  for (const [[x, y], [u, h]] of pairs(arch))
    face(
      out,
      'dressed',
      [faceAt(x, y, -front), faceAt(u, h, -front), faceAt(u, h, front), faceAt(x, y, front)],
      [0, -1, 0],
      C.seam,
    );
  face(
    out,
    'ruin',
    [faceAt(-W, Y, -front), faceAt(W, Y, -front), faceAt(W, Y, front), faceAt(-W, Y, front)],
    up,
    C.core,
  );
}

function wallCircuit(out, lod, outline, gates, grade) {
  const turning = new Set([
    0, 2, 5, 9, 13, 18, 20, 24, 28, 32, 35, 39, 46, 49, 54, 56, 60, 63, 68, 72, 76, 80, 83, 89, 92,
    96, 99, 103, 110, 113, 118, 123, 130, 138, 141,
  ]);
  const distantTurns = new Set([
    0, 2, 9, 18, 24, 28, 32, 39, 46, 49, 56, 63, 72, 80, 89, 96, 103, 113, 123, 138,
  ]);
  const control = outline.filter((_, i) =>
    lod === 0 ? distantTurns.has(i) : lod >= 2 || turning.has(i) || i % 2 === 0,
  );
  const n = control.length;
  const directions = control.map((p, i) => across(p, control[(i + 1) % n]));
  const joints = directions.map((v, i) => joinAcross(directions[(i + n - 1) % n], v));
  const height = ([x, z]) =>
    4.37 +
    4.53 * Math.min(1, Math.max(0, (z + 17) / 125)) +
    0.48 * Math.sin(0.18 * x + 0.143 * z) +
    0.32 * Math.sin(0.071 * x - 0.19 * z);
  for (const [[a, b], i] of pairs([...control, control[0]]).map((line, i) => [line, i])) {
    const mid = vMix(a, b, 0.5);
    const tall = mid[1] > 88;
    const h = height(mid);
    const relevant = gates
      .map((g) => ({ ...g, cut: projectedOn(a, b, g.point) }))
      .find((g) => g.cut.distance < g.width * 0.35);
    const draw = (start, end) => {
      const p = vMix(a, b, start);
      const q = vMix(a, b, end);
      const steps = lod > 1 ? Math.max(1, Math.ceil(distance(p, q) / 16)) : 1;
      for (let j = 0; j < steps; j++) {
        const left = j === 0 && start === 0 ? joints[i] : directions[i];
        const right = j === steps - 1 && end === 1 ? joints[(i + 1) % n] : directions[i];
        curtain(
          out,
          lod,
          vMix(p, q, j / steps),
          vMix(p, q, (j + 1) / steps),
          grade,
          h,
          6.35,
          i + j,
          tall,
          { height, ends: [left, right] },
        );
      }
    };
    if (!relevant) {
      draw(0, 1);
      continue;
    }
    const gap = (relevant.width * 0.36) / distance(a, b);
    const { t } = relevant.cut;
    draw(0, Math.max(0, t - gap));
    draw(Math.min(1, t + gap), 1);
  }
  for (const i of lod === 0
    ? [18, 32, 80, 102, 138]
    : [18, 32, 62, 69, 80, 102, 110, 117, 123, 130, 138]) {
    const p = outline[i];
    const r = i === 18 || i === 32 ? 12.1 : 8.1 + (i % 4) * 0.5;
    bastion(out, lod, p, r, p[1] > 100 ? 10.65 : 6.7, grade, i === 18 || i === 117);
  }
}

function lowRuin(out, lod, line, grade, height, width, seed) {
  const points =
    lod === 0 && line.length > 6
      ? line.filter((_, i) => i % (line.length > 30 ? 6 : 3) === 0 || i === line.length - 1)
      : line;
  for (const [[a, b], i] of pairs(points).map((pair, i) => [pair, i]))
    curtain(out, lod, a, b, grade, height + ((i * 11) % 7) * 0.25, width, seed + i, lod > 1);
}

function tombChamber(out, lod, footprint, grade, domeHeight) {
  const poly = footprint.slice(0, -1);
  const center = planarMid(poly);
  const ground = grade(center);
  const base = ground - 0.45;
  const eave = ground + 12.7;
  const taper = (point, h) => at(vMix(point, center, ((h - base) / (eave - base)) * 0.195), h);
  for (const [[a, b], side] of pairs(footprint).map((pair, i) => [pair, i])) {
    const w = edge(a, b);
    const wPoint = (x, y, d = 0) => {
      const q = taper(vMix(a, b, x / w.length), y);
      return [q[0] + d * w.normal[0], q[1], q[2] + d * w.normal[2]];
    };
    const wall = { ...w, p: wPoint };
    face(
      out,
      'sandstone',
      [taper(a, base), taper(b, base), taper(b, eave), taper(a, eave)],
      w.normal,
      C.red,
    );
    for (const [lo, hi] of [
      [ground + 5.07, ground + 5.62],
      [eave - 0.8, eave - 0.42],
      [eave - 0.23, eave],
    ])
      panel(out, 'white', wall, 0, w.length, lo, hi, 0.12, C.trimWhite);

    const u = w.length / 2;
    const entrance = side !== 3;
    const r = 2.15;
    const spring = ground + 5.94;
    const arch = pointArch(r, spring, ground + 8.19, [4, 6, 10, 14][lod]);
    const p = (x, y, d) => wPoint(u + x, y, d);
    panel(out, 'white', wall, u - 3.37, u + 3.37, ground + 0.27, ground + 9.32, 0.162, C.marble);
    panel(
      out,
      'sandstone',
      wall,
      u - 3.07,
      u + 3.07,
      ground + 0.4,
      ground + 8.95,
      0.184,
      C.redDark,
    );
    panel(
      out,
      'shadow',
      wall,
      u - r,
      u + r,
      ground + 0.33,
      spring,
      0.23,
      entrance ? C.dark : C.facing,
    );
    face(
      out,
      'shadow',
      arch.map(([x, y]) => p(x, y, 0.228)),
      w.normal,
      entrance ? C.dark : C.facing,
    );
    if (lod > 0)
      beamPath(
        out,
        'white',
        [
          p(-r, ground + 0.36, 0.29),
          ...arch.map(([x, y]) => p(x, y, 0.29)),
          p(r, ground + 0.36, 0.29),
        ],
        0.26,
        0.17,
        C.marble,
      );
  }
  face(
    out,
    'sandstone',
    poly.map((p) => taper(p, eave)),
    up,
    C.redDark,
  );
  const crown = ground + domeHeight;
  const slopes = [8, 14, 22, 32][lod];
  ring(
    out,
    'sandstone',
    center,
    [
      [eave - 0.15, 7.35],
      [eave + 0.9, 7.35],
      [eave + 1.47, 6.73],
    ],
    12,
    C.redDark,
  );
  ring(
    out,
    'white',
    center,
    [
      [eave + 1.33, 6.67],
      [eave + 2.53, 6.49],
      [eave + 4.1, 6.13],
      [eave + 5.67, 5.32],
      [eave + 6.92, 4.03],
      [crown - 0.63, 2.21],
      [crown, 0.27],
    ],
    slopes,
    C.marble,
  );
  ring(
    out,
    'sandstone',
    center,
    [
      [crown - 0.09, 0.66],
      [crown + 0.47, 0.67],
      [crown + 0.82, 0.41],
      [crown + 1.43, 0.51],
      [crown + 1.88, 0.27],
      [crown + 2.8, 0.034],
    ],
    lod ? 10 : 6,
    C.bronze,
  );
}

function build(out, lod, d, grade) {
  const { outline, parts, points } = d;
  const gateControls = [
    ['khirki-gate', 11.2, 8.1, 7.1],
    ['dariba-gate', 10.0, 8.4, 8.4],
    ['hathi-gate', 12.8, 9.2, 8.5],
    ['east-gate-remains', 9.7, 6.5, 5.7],
    ['south-entrance-approach', 14.4, 10.8, 11.4],
  ].map(([key, width, depth, height]) => {
    const map = parts[key];
    const center = key === 'south-entrance-approach' ? map.at(-1) : planarMid(map.slice(0, -1));
    return { ...alignGate(outline, center), width, depth, height };
  });
  wallCircuit(out, lod, outline, gateControls, grade);
  for (const g of gateControls) gate(out, lod, g.point, g.along, grade, g.width, g.depth, g.height);
  for (const key of ['citadel-inner-wall', 'citadel-east-wall', 'citadel-south-wall'])
    lowRuin(out, lod, parts[key], grade, 4.4, 4.6, 13);
  bastion(
    out,
    lod,
    planarMid(parts['citadel-tower-footprint'].slice(0, -1)),
    9.2,
    8.15,
    grade,
    true,
  );
  lowRuin(out, lod, parts['palace-ruin-walls'], grade, 1.14, 1.37, 17);
  const [x, z] = points.Vijaymandal;
  const y = grade([x, z]);
  shell(out, rect(x - 11, z - 9, x + 11, z + 9), (p) => grade(p) - 0.6, y + 4.6, {
    wall: 'quartzite',
    color: C.stone,
    roof: 'ruin',
    roofColor: C.core,
  });
  lowRuin(
    out,
    lod,
    [
      [x - 10, z - 9],
      [x - 10, z + 7],
      [x + 8, z + 7],
    ],
    () => y + 4.1,
    1.4,
    2.8,
    25,
  );
  const [mx, mz] = points['Tughlakabad Mosque'];
  lowRuin(
    out,
    lod,
    [
      [mx - 8, mz - 5],
      [mx - 8, mz + 5],
      [mx + 6, mz + 5],
    ],
    grade,
    0.75,
    1.45,
    32,
  );

  lowRuin(out, lod, parts['tomb-causeway'].slice(2), grade, 1.38, 6.1, 41);
  const outwork = parts['tomb-outer-fortification'];
  lowRuin(out, lod, outwork, grade, 3.5, 2.73, 23);
  for (const i of lod === 0 ? [4, 22, 39] : [4, 12, 22, 30, 39])
    bastion(out, lod, outwork[i], 4.35, 4.25, grade);
  tombChamber(out, lod, parts['tomb-main-chamber'], grade, d.tombDomeHeightMeters);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Tughlaqabad’s long rubble curtain walls, gate passages, broken citadel crowns and low palace ruins, set against Delhi’s original rocky terrain. South of the modern road, the fortified tomb retains its red and pale stone chamber and white dome.',
    camera: [705, 555, 910],
    lookAt: [58, 18, 64],
    sun: [-509, 755, 1305],
    yaw: -0.65,
    views: [
      { name: 'citadel-and-south-gateway', position: [331, 32, 356], lookAt: [245, 13, 254] },
      { name: 'ruined-walls-and-bastions', position: [-47, 30, 244], lookAt: [-132, 22, 137] },
      { name: 'tughluq-tomb-and-outwork', position: [183, 28, 574], lookAt: [130, 13, 509] },
      { name: 'mapped-rampart-circuit', position: [0, 850, 605], lookAt: [0, 12, 25] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'fortification';
