import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedSolid,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const planByRole = new Map(
  frame.parts.map(({ role, polygons }) => [role, polygons.map(([p]) => clockwise(p))]),
);
const plan = (role) => planByRole.get(role)[0];
const stone = [0.8, 0.74, 0.63];
const trim = [0.94, 0.88, 0.75];
const granite = [0.36, 0.29, 0.25];
const slate = [0.35, 0.38, 0.36];
const glass = [0.083, 0.126, 0.156];
const copper = [0.19, 0.39, 0.31];
const bronze = [0.51, 0.43, 0.28];
const gold = [0.86, 0.67, 0.19];

export const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite' },
  ashlar: { slot: 'wall', graph: 'stone_limestone' },
  roof: { slot: 'roof', graph: 'metal_painted' },
  copper: { slot: 'trim', graph: 'metal_copper' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', name: 'Inset gray-blue window glass' },
};

const edges = (p) => p.map((a, i) => [a, p[(i + 1) % p.length]]);
const middle = (p) => [0, 1].map((i) => p.reduce((sum, a) => sum + a[i] / p.length, 0));
function scalePlan(p, ratio) {
  const center = middle(p);
  return p.map((a) => a.map((v, i) => center[i] + (v - center[i]) * ratio));
}
const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];

function elevation(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  const at = (x, y, d = 0) => [a[0] + x * dx - d * dz, y, a[1] + x * dz + d * dx];
  const panel = (out, slot, x0, y0, x1, y1, d, color) =>
    face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
  return { length, at, panel };
}

function archPane(out, f, x, y, w, h, level) {
  const spring = y + h - w;
  const segments = level >= 4 ? 9 : level === 3 ? 5 : 3;
  f.panel(out, 'glass', x - w, y, x + w, spring, 0.15, glass);
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * i) / segments,
      b = (Math.PI * (i + 1)) / segments;
    const p = (q, r, d) => f.at(x + Math.cos(q) * r, spring + Math.sin(q) * r, d);
    tri(out, 'glass', [f.at(x, spring, 0.15), p(a, w, 0.15), p(b, w, 0.15)], glass);
    face(
      out,
      'ashlar',
      [p(a, w, 0.22), p(a, w + 0.16, 0.22), p(b, w + 0.16, 0.22), p(b, w, 0.22)],
      trim,
    );
  }
}

function cornice(out, p, y, width, level) {
  mappedSolid(out, 'ashlar', scalePlan(p, 1 + width), y, y + 0.81, trim);
  if (level >= 3)
    mappedSolid(out, 'ashlar', scalePlan(p, 1 + width * 1.34), y + 0.45, y + 0.76, trim);
}

function fenestration(
  out,
  p,
  { lo, hi, floors, pitch = 3.75, arches = false, pilasters = false, balconies = false },
  level,
) {
  const stepY = (hi - lo) / floors;
  for (const [side, [a, b]] of edges(p).entries()) {
    const f = elevation(a, b);
    if (f.length < 2.4) continue;
    const streetPitch = level === 2 && balconies ? pitch * 1.35 : pitch;
    const bays = Math.max(1, Math.round(f.length / streetPitch));
    const pitchX = f.length / bays;
    for (let bay = 0; bay < bays; bay++) {
      const x = (bay + 0.5) * pitchX,
        w = Math.min(pitchX * 0.24, 0.95);
      if (pilasters)
        f.panel(out, 'ashlar', x - w - 0.53, lo - 0.35, x - w - 0.19, hi + 0.25, 0.27, trim);
      for (let floor = 0; floor < floors; floor++) {
        const y = lo + stepY * (floor + 0.18),
          h = stepY * 0.64;
        const archedRow = floor === floors - 1 || (level >= 4 && floor % 3 === 1);
        if (arches && archedRow && (level >= 3 || (pilasters && bay % 2 === 0))) {
          archPane(out, f, x, y, w, h, level);
        } else {
          const tint = 0.018 * ((floor + 2 * bay + 3 * side) % 4);
          f.panel(
            out,
            'glass',
            x - w,
            y,
            x + w,
            y + h,
            0.14,
            glass.map((c) => c + tint),
          );
          if (level >= 3) f.panel(out, 'copper', x - 0.035, y, x + 0.035, y + h, 0.2, bronze);
        }
        if (level >= 3)
          f.panel(out, 'ashlar', x - w - 0.08, y - 0.12, x + w + 0.08, y - 0.01, 0.25, trim);
        if (level >= 3 && balconies && floor > 0 && floor % 2 === 0 && bay % 3 === 1) {
          face(
            out,
            'ashlar',
            [
              f.at(x - w - 0.35, y - 0.19, 0.025),
              f.at(x - w - 0.35, y - 0.19, 0.7),
              f.at(x + w + 0.35, y - 0.19, 0.7),
              f.at(x + w + 0.35, y - 0.19, 0.025),
            ],
            trim,
          );
          f.panel(out, 'roof', x - w - 0.35, y - 0.19, x + w + 0.35, y - 0.065, 0.7, slate);
          if (level === 3) {
            f.panel(out, 'copper', x - w - 0.35, y + 0.54, x + w + 0.35, y + 0.59, 0.7, bronze);
            for (const dx of [-w, 0, w])
              f.panel(
                out,
                'copper',
                x + dx - 0.025,
                y - 0.17,
                x + dx + 0.025,
                y + 0.54,
                0.7,
                bronze,
              );
          } else {
            beam(
              out,
              'copper',
              f.at(x - w - 0.35, y + 0.58, 0.7),
              f.at(x + w + 0.35, y + 0.58, 0.7),
              0.045,
              0.045,
              bronze,
            );
            for (const dx of [-w, -w / 2, 0, w / 2, w]) {
              beam(
                out,
                'copper',
                f.at(x + dx, y - 0.17, 0.7),
                f.at(x + dx, y + 0.58, 0.7),
                0.04,
                0.04,
                bronze,
              );
            }
          }
        }
      }
    }
  }
}

function roofFinial(out, x, y, z, h, level) {
  const stages =
    level <= 2
      ? [
          [0, 0.93],
          [1, 0.1],
        ]
      : [
          [0, 0.93],
          [0.09, 0.93],
          [0.1, 0.75],
          [0.26, 0.73],
          [0.33, 0.58],
          [0.62, 0.37],
          [0.88, 0.16],
          [0.95, 0.24],
          [1, 0.095],
        ];
  const radius = h * 0.145;
  loft(
    out,
    'ashlar',
    stages.map(([t, r]) =>
      radialRing(
        y + h * t,
        radius * r,
        radius * r,
        level >= 4 ? 8 : level === 3 ? 6 : 4,
        [x, z],
        Math.PI / 4,
      ),
    ),
    trim,
  );
}

function battlements(out, p, y, level, { step = 4.5, peak = 3.8 } = {}) {
  const inset = scalePlan(p, 0.91);
  const ring = (plan, y) => plan.map(([x, z]) => [x, y, z]);
  loft(out, 'ashlar', [ring(p, y), ring(p, y + 0.86)], trim, { cap: false });
  loft(out, 'ashlar', [ring(inset.toReversed(), y), ring(inset.toReversed(), y + 0.86)], stone, {
    cap: false,
  });
  for (const [[a, b], [innerA, innerB]] of edges(p).map((pair, i) => [pair, edges(inset)[i]])) {
    face(
      out,
      'ashlar',
      [
        [a[0], y + 0.86, a[1]],
        [b[0], y + 0.86, b[1]],
        [innerB[0], y + 0.86, innerB[1]],
        [innerA[0], y + 0.86, innerA[1]],
      ],
      trim,
    );
    if (level < 1) continue;
    const count =
      level === 2 ? 1 : Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < count; j++) {
      const t = j / count;
      roofFinial(
        out,
        a[0] + (b[0] - a[0]) * t,
        y + 0.66,
        a[1] + (b[1] - a[1]) * t,
        peak * (j === 0 ? 1 : 0.59),
        level,
      );
    }
  }
}

function endPavilion(out, p, lo, hi, level) {
  const head = scalePlan(p, 0.92);
  mappedSolid(out, 'ashlar', p, lo, hi - 4, stone);
  cornice(out, p, hi - 4.45, 0.037, level);
  mappedSolid(out, 'ashlar', head, hi - 4, hi, trim);
  if (level >= 1)
    fenestration(
      out,
      head,
      { lo: hi - 3.64, hi: hi - 0.48, floors: 1, pitch: 2.8, arches: true },
      level,
    );
  cornice(out, head, hi - 0.52, 0.055, level);
  battlements(out, scalePlan(head, 0.98), hi + 0.14, level, { step: 4.2, peak: 3.55 });
}

function wing(out, role, top, level) {
  const p = plan(role);
  const plinth = role === 'moskva-range' ? 8.8 : 6.2;
  mappedSolid(out, 'granite', p, -14, plinth, granite);
  cornice(out, p, plinth - 0.54, 0.008, level);
  mappedSolid(out, 'ashlar', p, plinth, top, stone);
  fenestration(
    out,
    p,
    {
      lo: plinth + 0.25,
      hi: top - 1.3,
      floors: role === 'moskva-range' ? 7 : 8,
      arches: true,
      balconies: true,
    },
    level,
  );
  cornice(out, p, top - 0.55, 0.008, level);
  mappedSolid(out, 'roof', scalePlan(p, 0.995), top + 0.22, top + 0.4, slate);
}

function residence(out, level) {
  wing(out, 'moskva-range', 31.4, level);
  wing(out, 'yauza-range', 32.4, level);
  const end = plan('moskva-south-end');
  mappedSolid(out, 'ashlar', end, 31.4, 33.3, stone);
  cornice(out, end, 33, 0.018, level);
  for (const [role, top] of [
    ['moskva-north-corner', 41.6],
    ['moskva-middle-pavilion', 44.8],
  ]) {
    const p = plan(role);
    endPavilion(out, p, 30.85, top, level);
    fenestration(
      out,
      p,
      { lo: 32, hi: top - 4.2, floors: 2, pilasters: true, arches: true },
      level,
    );
  }
  const link = plan('riverside-link');
  // The angled link rises behind the downstream residential range at the tower junction.
  mappedSolid(out, 'ashlar', scalePlan(link, 0.985), 31.2, 33.25, stone);
  fenestration(out, link, { lo: 31.3, hi: 33.15, floors: 1, pitch: 4.1, arches: true }, level);
  const northCorner = [
    [-65, 55.3],
    [-77.6, 45.7],
    [-67.1, 37.8],
    [-54.6, 44.1],
  ];
  endPavilion(out, clockwise(northCorner), 31.8, 39.6, level);
}

function forecourt(out, level) {
  const x = [-6, 0, 6],
    rows = frame.arrivalProfile;
  const elevations = rows.map(({ z, grade }, i) =>
    grade.map((y, j) => [x[j], y + (i === 0 ? 0.13 : 0.095), z]),
  );
  for (let j = 1; j < elevations.length; j++)
    for (let i = 1; i < x.length; i++)
      face(
        out,
        'granite',
        [elevations[j - 1][i - 1], elevations[j][i - 1], elevations[j][i], elevations[j - 1][i]],
        [0.59, 0.55, 0.5],
      );
  for (const [y, z] of [
    [0.8, 17.15],
    [1.03, 16.65],
    [1.26, 16.15],
  ])
    mappedSolid(out, 'granite', rectangle(-6.16, 6.16, 15.33, z), 0.36, y, granite);
  const front = edges(plan('core-hexagon'))
    .map(([a, b]) => ({ a, b, z: (a[1] + b[1]) / 2 }))
    .sort((a, b) => b.z - a.z)[0];
  const f = elevation(front.a, front.b);
  for (const dx of [-3.75, 0, 3.75]) {
    const center = f.length / 2 + dx;
    f.panel(out, 'copper', center - 1.23, 1.26, center + 1.23, 4.75, 0.11, bronze);
    if (level >= 2) archPane(out, f, center, 1.48, 0.9, 3.1, level);
    else f.panel(out, 'glass', center - 0.9, 1.44, center + 0.9, 4.71, 0.18, glass);
  }
}

function arcGallery(out, a, b, y, level) {
  const f = elevation(a, b);
  const bays = 3,
    pitch = f.length / bays,
    d = 0.68;
  const top = y + 4.58;
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * pitch,
      w = pitch * 0.4,
      start = y + 2.66;
    const count = level >= 3 ? 8 : 4;
    for (let j = 0; j < count; j++) {
      const angle = (i) => Math.PI * (1 - i / count);
      const u = (q) => x + w * Math.cos(q),
        h = (q) => start + w * 0.73 * Math.sin(q);
      const aa = angle(j),
        bb = angle(j + 1);
      const ft = [
        f.at(u(aa), h(aa), d),
        f.at(u(bb), h(bb), d),
        f.at(u(bb), top, d),
        f.at(u(aa), top, d),
      ];
      const bk = [
        f.at(u(aa), h(aa), -d),
        f.at(u(bb), h(bb), -d),
        f.at(u(bb), top, -d),
        f.at(u(aa), top, -d),
      ];
      face(out, 'ashlar', ft, trim);
      face(out, 'ashlar', bk.toReversed(), stone);
      face(out, 'ashlar', [ft[0], bk[3], bk[2], ft[1]], trim);
    }
  }
  for (let j = 0; j <= bays; j++) {
    const x = j * pitch,
      w = pitch * 0.114;
    loft(
      out,
      'ashlar',
      [y, top].map((h) => [
        f.at(x - w, h, -d),
        f.at(x - w, h, d),
        f.at(x + w, h, d),
        f.at(x + w, h, -d),
      ]),
      trim,
    );
  }
  beam(out, 'ashlar', f.at(0, top, 0), f.at(f.length, top, 0), 0.46, 1.42, trim);
}

function tower(out, level) {
  const plinth = plan('tower-plinth'),
    hex = plan('core-hexagon'),
    lantern = plan('lantern');
  mappedSolid(out, 'granite', plinth, -12, 12.3, granite);
  cornice(out, plinth, 11.25, 0.018, level);
  if (level >= 2) fenestration(out, plinth, { lo: 5.2, hi: 10.63, floors: 2, pitch: 4.2 }, level);
  forecourt(out, level);
  for (const [arm, shoulder] of [
    ['north-arm', 'north-shoulder'],
    ['east-arm', 'east-shoulder'],
    ['west-arm', 'west-shoulder'],
  ]) {
    const body = plan(arm),
      tip = plan(shoulder);
    mappedSolid(out, 'ashlar', body, 12.29, 59.2, stone);
    fenestration(
      out,
      body,
      { lo: 12.8, hi: 57.9, floors: 13, pilasters: true, arches: true },
      level,
    );
    cornice(out, body, 58.6, 0.025, level);
    endPavilion(out, tip, 58.8, 79.4, level);
    fenestration(out, tip, { lo: 60, hi: 74.8, floors: 4, pilasters: true }, level);
    if (level >= 1) {
      const [a, b] = edges(body)
        .filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= 8)
        .sort(([a, b], [c, d]) => Math.hypot(...middle([a, b])) - Math.hypot(...middle([c, d])))[1];
      const towardTip = middle(tip),
        len = Math.hypot(...towardTip);
      arcGallery(
        out,
        [a[0] + (0.8 * towardTip[0]) / len, a[1] + (0.8 * towardTip[1]) / len],
        [b[0] + (0.8 * towardTip[0]) / len, b[1] + (0.8 * towardTip[1]) / len],
        59.4,
        level,
      );
    }
  }
  mappedSolid(out, 'ashlar', hex, 12.29, 103.7, stone);
  fenestration(out, hex, { lo: 13.1, hi: 102.7, floors: 23, pitch: 3.4, pilasters: true }, level);
  cornice(out, hex, 79.32, 0.022, level);
  cornice(out, hex, 102.75, 0.041, level);
  const top = scalePlan(hex, 0.94);
  mappedSolid(out, 'ashlar', top, 103.55, 116.4, stone);
  fenestration(
    out,
    top,
    { lo: 104.12, hi: 115.36, floors: 2, arches: true, pilasters: true },
    level,
  );
  cornice(out, top, 114.82, 0.058, level);
  battlements(out, scalePlan(top, 0.94), 116, level, { peak: 9.35, step: 6.1 });
  if (level >= 2) {
    // Bronze figure groups and their plinths sit along the central crown.
    for (const [x, z, sign] of [
      [-4, 12.9, -1],
      [0, 13.2, 1],
      [4, 12.9, 1],
      [-9.1, -6.1, -1],
      [9.1, -6.1, 1],
    ]) {
      box(out, 'ashlar', [x - 0.67, 116.3, z - 0.61], [x + 0.67, 117.2, z + 0.61], trim);
      loft(
        out,
        'copper',
        [
          [117.2, 0.72],
          [118.6, 0.56],
          [119.38, 0.37],
        ].map(([y, r]) => radialRing(y, r, r * 0.64, level >= 4 ? 9 : 6, [x, z])),
        bronze,
      );
      beam(out, 'copper', [x, 118.8, z], [x + sign * 0.65, 119.8, z - 0.08], 0.21, 0.21, bronze);
      sphere(out, 'copper', [x, 119.75, z], [0.26, 0.32, 0.24], bronze, 8, 5);
    }
  }
  mappedSolid(out, 'ashlar', scalePlan(lantern, 1.06), 115.95, 120.15, trim);
  mappedSolid(out, 'ashlar', lantern, 119.98, 140.65, stone);
  fenestration(
    out,
    lantern,
    { lo: 121.2, hi: 139.66, floors: 5, pitch: 2.66, arches: true, pilasters: true },
    level,
  );
  cornice(out, lantern, 139.85, 0.086, level);
  battlements(out, scalePlan(lantern, 1.055), 140.6, level, { peak: 4.8, step: 4.3 });
}

function spire(out, level) {
  const stages = [
    [139.95, 3.7],
    [141.3, 3.95],
    [143.2, 3.02],
    [145.9, 2.35],
    [149.3, 1.52],
    [169.4, 0.74],
    [171.1, 0.61],
    [172.3, 0.31],
    [173.62, 0.17],
  ];
  loft(
    out,
    'copper',
    stages.map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    copper,
  );
  if (level >= 1)
    for (let side = 0; side < 8; side++) {
      const a = Math.PI / 8 + (Math.PI * side) / 4;
      const points = stages.map(([y, r]) => [r * Math.cos(a), y, r * Math.sin(a)]);
      for (let j = 1; j < points.length; j++)
        beam(out, 'copper', points[j - 1], points[j], 0.13, 0.11, side % 2 === 0 ? gold : bronze);
    }
  const y = 174.02,
    radius = 1.98;
  const rays = Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? radius * 0.435 : radius;
    return [r * Math.cos(angle), y + r * Math.sin(angle)];
  });
  for (let i = 0; i < rays.length; i++) {
    const [a, b] = [rays[i], rays[(i + 1) % rays.length]];
    const d = 0.16;
    tri(
      out,
      'copper',
      [
        [0, y, 0.25],
        [...a, d],
        [...b, d],
      ],
      gold,
    );
    tri(
      out,
      'copper',
      [
        [0, y, -0.25],
        [...b, -d],
        [...a, -d],
      ],
      gold,
    );
    face(
      out,
      'copper',
      [
        [...a, -d],
        [...b, -d],
        [...b, d],
        [...a, d],
      ],
      bronze,
    );
  }
  if (level >= 2) {
    for (const z of [-0.27, 0.27])
      sphere(out, 'copper', [0, y, z], [0.38, 0.38, 0.13], gold, 12, 6);
    for (const [x, dir] of [
      [-0.72, -1],
      [0.72, 1],
    ])
      tube(out, 'copper', [0, 170.85, 0], [x + dir * 0.64, 172.73, 0], 0.087, gold, 6);
  }
}

function simplifyOutline(points, tolerance) {
  const simplified = [...points];
  for (let i = simplified.length - 1; i >= 0 && simplified.length > 4; i--) {
    const a = simplified[(i + simplified.length - 1) % simplified.length];
    const b = simplified[i];
    const c = simplified[(i + 1) % simplified.length];
    const [x, z] = [c[0] - a[0], c[1] - a[1]];
    const chord = Math.hypot(x, z);
    const offset = Math.abs(x * (b[1] - a[1]) - z * (b[0] - a[0]));
    if (offset < tolerance * chord) simplified.splice(i, 1);
  }
  return simplified;
}

function distant(out, district) {
  const tolerance = district ? 0.35 : 2.05;
  const mass = (role, lo, hi, slot = 'ashlar', color = stone) => {
    const p = simplifyOutline(plan(role), tolerance);
    mappedSolid(out, slot, p, lo, hi, color);
    return p;
  };
  const rows = [
    ['moskva-range', 8.8, 31.4],
    ['yauza-range', 6.2, 32.4],
    ['east-arm', 12.3, 59.2],
    ['north-arm', 12.3, 59.2],
    ['west-arm', 12.3, 59.2],
    ['core-hexagon', 12.3, 116.4],
  ];
  mass('tower-plinth', -12, 12.3, 'granite', granite);
  for (const [role, lo, hi] of rows) {
    if (lo < 10) mass(role, -14, lo, 'granite', granite);
    const p = mass(role, lo, hi);
    if (district) {
      for (const [a, b] of edges(p)) {
        const f = elevation(a, b);
        const count = Math.floor(f.length / 5.65);
        for (let bay = 0; bay < count; bay++) {
          const x = ((bay + 0.5) / count) * f.length;
          f.panel(out, 'roof', x - 0.66, lo + 1.1, x + 0.66, hi - 1.7, 0.12, [0.48, 0.44, 0.39]);
        }
      }
    }
  }
  const pavilions = [
    ['east-shoulder', 58.8, 79.4],
    ['north-shoulder', 58.8, 79.4],
    ['west-shoulder', 58.8, 79.4],
    ['moskva-north-corner', 30.85, 41.6],
    ['moskva-middle-pavilion', 30.85, 44.8],
    ['lantern', 116.2, 140.65],
  ];
  for (const [role, lo, hi] of pavilions) {
    const p = mass(role, lo, hi, 'ashlar', trim);
    if (district) {
      cornice(out, p, hi - 0.72, 0.025, 1);
      for (const [x, z] of p) roofFinial(out, x, hi, z, 3.38, 1);
    }
  }
  mass('moskva-south-end', 31.4, 33.3);
  if (district) {
    const hex = plan('core-hexagon');
    cornice(out, hex, 102.75, 0.041, 1);
    for (const [x, z] of scalePlan(hex, 0.88)) roofFinial(out, x, 116.2, z, 9.12, 1);
  } else {
    for (const [x, z] of scalePlan(plan('core-hexagon'), 0.88).filter((_, i) => i % 2 === 0))
      roofFinial(out, x, 116.2, z, 9.12, 0);
  }
  forecourt(out, 0);
  spire(out, district ? 1 : 0);
}

function build(out, level) {
  residence(out, level);
  tower(out, level);
  spire(out, level);
}

export const buildSkyline = (out) => distant(out, false);
export const buildDistrict = (out) => distant(out, true);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
