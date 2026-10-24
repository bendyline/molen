/** Great Mosque campus: mapped wings, Mataf and Kaaba, roof domes and thirteen minarets. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sg/sgu/al_masjid_al_haram/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction;
const palette = {
  wall: '#e4dfd2',
  roof: '#d7d4c9',
  trim: '#d9d1bc',
  metal: '#c8c9c2',
  cloth: '#4d4e50',
  glass: '#526373',
  gold: '#c9ad68',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((q) => q[k])) + Math.max(...r.map((q) => q[k]))) / 2);
const sign = (r) =>
  Math.sign(
    r.reduce((n, p, i) => {
      const q = r[(i + 1) % r.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const byId = (id) => rec.controls.find((b) => b.id === id);
const ring = (p, r, n, offset = Math.PI / 4) =>
  Array.from({ length: n }, (_, i) => {
    const a = offset + (i * Math.PI * 2) / n;
    return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
  });
const rectangle = (p, w) => [
  [p[0] - w / 2, p[1] - w / 2],
  [p[0] + w / 2, p[1] - w / 2],
  [p[0] + w / 2, p[1] + w / 2],
  [p[0] - w / 2, p[1] + w / 2],
];
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function coarse(r, d) {
  const epsilon = [11, 3, 1, 0, 0][d],
    a = r.slice();
  if (!epsilon) return a;
  const host = fit.excludedBuildings.find((b) => b.id === 35184992516762).polygons[0].outline;
  const box = [0, 1].map((k) => [
    Math.min(...host.map((p) => p[k])) - 35,
    Math.max(...host.map((p) => p[k])) + 35,
  ]);
  let changed = true;
  while (changed && a.length > 4) {
    changed = false;
    for (let i = 0; i < a.length; i++) {
      if (d > 0 && box.every((v, k) => a[i][k] >= v[0] && a[i][k] <= v[1])) continue;
      if (distance(a[i], a[(i + a.length - 1) % a.length], a[(i + 1) % a.length]) < epsilon) {
        a.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return a;
}
export function masjidHaramGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Great Mosque footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const footing = (floor) => (p) => Math.min(-0.35, floor - 0.35, masjidHaramGround(...p) - 0.35);
function writer(out, d) {
  return (slot, p, direction, colorOverride) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction && normalFor(p[0], p[1], p[2]).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const tint = colorOverride ?? colors[slot],
      color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const q = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            q[1].map((v, k) => v - q[0][k]),
            q[2].map((v, k) => v - q[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        q,
        normalFor(...q),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function prism(face, p, b, t, slot, roofSlot = slot) {
  sides(face, p.outline, b, t, slot);
  for (const h of p.holes ?? []) sides(face, h, b, t, slot, true);
  cap(face, p.outline, t, roofSlot, p.holes ?? []);
}
function radial(face, p, levels, n, slot) {
  for (let j = 1; j < levels.length; j++) {
    const [a, r] = levels[j - 1],
      [b, s] = levels[j],
      lo = ring(p, r, n),
      hi = ring(p, s, n);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(slot, [at(lo[k], a), at(lo[i], a), at(hi[i], b), at(hi[k], b)]);
    }
  }
  if (levels.at(-1)[1] > 0.001) cap(face, ring(p, levels.at(-1)[1], n), levels.at(-1)[0], slot);
}
function dome(face, p, r, b, t, d, slot = 'metal') {
  const n = [6, 8, 12, 20, 24][d],
    bands = [1, 2, 3, 5, 6][d],
    levels = Array.from({ length: bands + 1 }, (_, i) => {
      const a = ((i / bands) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(a), i === bands ? 0 : r * Math.cos(a)];
    });
  radial(face, p, levels, n, slot);
}

/** A real recessed arch: wall around a polygonal opening, reveal sides, then a back field. */
function archPanel(face, a, b, bottom, top, d, slot = 'wall', recess = true) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    normal = [-axis[1], axis[0]],
    width = Math.min(4.4, length * 0.65),
    h = Math.min((top - bottom) * 0.72, width * 1.3),
    low = bottom + (top - bottom - h) * 0.5,
    spring = low + h * 0.58,
    n = d === 2 ? 2 : d === 3 ? 4 : 6;
  const local = [
    [-width / 2, low],
    [width / 2, low],
    [width / 2, spring],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [width / 2 - width * t, spring + (low + h - spring) * Math.sin(Math.PI * t)];
    }),
    [-width / 2, spring],
  ];
  const mid = mix(a, b, 0.5),
    point = ([u, y], depth = 0) => [
      mid[0] + u * axis[0] - normal[0] * depth,
      y,
      mid[1] + u * axis[1] - normal[1] * depth,
    ];
  if (d === 1) {
    face(
      'glass',
      [
        [-width / 2, low],
        [width / 2, low],
        [width / 2, low + h],
        [-width / 2, low + h],
      ].map((p) => point(p, -0.08)),
      [normal[0], 0, normal[1]],
    );
    return;
  }
  if (!recess) {
    face(
      slot,
      [
        [-length / 2, bottom],
        [length / 2, bottom],
        [length / 2, top],
        [-length / 2, top],
      ].map((p) => point(p)),
      [normal[0], 0, normal[1]],
    );
    face(
      'glass',
      local.map((p) => point(p, -0.04)),
      [normal[0], 0, normal[1]],
    );
    return;
  }
  const rect = [
      [-length / 2, bottom],
      [length / 2, bottom],
      [length / 2, top],
      [-length / 2, top],
    ],
    all = [...rect, ...local],
    ids = earcut(all.flat(), [rect.length], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(all[k])),
      [normal[0], 0, normal[1]],
    );
  const depth = d >= 3 ? 0.65 : 0.45;
  for (let i = 0; i < local.length; i++) {
    const q = local[(i + 1) % local.length];
    face('trim', [point(local[i]), point(q), point(q, depth), point(local[i], depth)]);
  }
  face(
    'glass',
    local.map((p) => point(p, depth)),
    [normal[0], 0, normal[1]],
  );
  if (d >= 3) {
    const u = width * 0.08;
    face(
      'trim',
      [
        point([-u, low], depth - 0.06),
        point([u, low], depth - 0.06),
        point([u, spring + 0.1], depth - 0.06),
        point([-u, spring + 0.1], depth - 0.06),
      ],
      [normal[0], 0, normal[1]],
    );
  }
}
function facade(face, r, floor, height, d, inward = false) {
  const rSign = sign(r),
    ringOrder = (rSign === 1) !== inward ? r.toReversed() : r;
  for (let i = 0; i < ringOrder.length; i++) {
    const a = ringOrder[i],
      b = ringOrder[(i + 1) % ringOrder.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      normal = [-axis[1], 0, axis[0]];
    if (d === 0 || length < [0, 35, 12, 6, 6][d]) {
      face(
        'wall',
        [
          at(a, footing(floor)),
          at(b, footing(floor)),
          at(b, floor + height),
          at(a, floor + height),
        ],
        normal,
      );
      continue;
    }
    const spacing = [0, 65, 22, 7.5, 7.5][d],
      count = Math.max(1, Math.floor(length / spacing)),
      rows = d === 1 ? (height > 28 ? 2 : 1) : height > 28 ? 3 : height > 15 ? 2 : 1;
    if (d === 1) {
      face(
        'wall',
        [
          at(a, footing(floor)),
          at(b, footing(floor)),
          at(b, floor + height),
          at(a, floor + height),
        ],
        normal,
      );
    } else {
      face(
        'trim',
        [at(a, footing(floor)), at(b, footing(floor)), at(b, floor + 0.8), at(a, floor + 0.8)],
        normal,
      );
    }
    for (let k = 0; k < count; k++)
      for (let j = 0; j < rows; j++)
        archPanel(
          face,
          mix(a, b, k / count),
          mix(a, b, (k + 1) / count),
          floor + 0.8 + (j * (height - 0.8)) / rows,
          floor + 0.8 + ((j + 1) * (height - 0.8)) / rows,
          d,
          'wall',
          (i + k) % [1, 1, 6, 4, 4][d] === 0,
        );
  }
}
function hall(face, p, floor, height, d, decorate = true) {
  const r = coarse(p.outline, d),
    holes = (p.holes ?? []).map((h) => coarse(h, d));
  if (decorate && d > 0) {
    facade(face, r, floor, height, d);
    for (const h of holes) facade(face, h, floor, height, d, true);
  } else {
    sides(face, r, footing(floor), floor + height, 'wall');
    for (const h of holes) sides(face, h, footing(floor), floor + height, 'wall', true);
  }
  cap(face, r, floor + height, 'roof', holes);
  if (d >= 3) {
    sides(face, r, floor + height - 0.65, floor + height + 0.5, 'trim');
    for (const h of holes)
      sides(face, h, floor + height - 0.65, floor + height + 0.5, 'trim', true);
  }
}
function campus(face, d) {
  const floors = rec.wingFloors,
    main = rec.main;
  if (d === 0) {
    for (let i = 0; i < 3; i++) hall(face, main.polygons[i], floors[i], [21, 42, 21][i], d, false);
  } else {
    hall(face, main.polygons[0], floors[0], 21, d);
    for (const p of byId(52776571153907).polygons) hall(face, p, floors[1], 35.5, d);
    for (const p of byId(35185339634536).polygons) {
      prism(
        face,
        { outline: coarse(p.outline, d), holes: p.holes },
        floors[1] + 35.5,
        floors[1] + 42,
        'wall',
        'roof',
      );
      if (d >= 2) facade(face, coarse(p.outline, d), floors[1] + 35.5, 6.5, d);
    }
    hall(face, main.polygons[2], floors[2], 19.3, d, false);
    for (const p of byId(52776570928765).polygons) hall(face, p, floors[2], 21, d);
    for (const p of byId(52776570923921).polygons) hall(face, p, floors[2], 30, d);
    for (const p of byId(52776576986245).polygons) hall(face, p, floors[2], 21.7, d);
    for (const p of byId(35185297455928).polygons) hall(face, p, floors[2], 9.5, d);
    if (d >= 2)
      for (const b of rec.parts.filter(
        (b) =>
          b.properties.min_height === 42 &&
          b.properties.height === 46 &&
          b.polygons[0].outline.length <= 8,
      )) {
        const p = b.polygons[0];
        prism(face, p, floors[1] + 42, floors[1] + 45, 'wall', 'roof');
      }
    for (const id of [35185339634356, 35185339634357, 35185339634358])
      for (const p of byId(id).polygons)
        prism(face, p, floors[2] + 30, floors[2] + 34, 'wall', 'roof');
    for (const b of rec.parts.filter((b) => b.properties.kind_detail === 'bridge'))
      for (const p of b.polygons) {
        const floor = (q) => {
          const t = Math.max(0, Math.min(1, (q[0] - 75) / 90));
          return floors[1] * (1 - t) + floors[2] * t;
        };
        prism(
          face,
          p,
          (q) => floor(q) + 18.5,
          (q) => floor(q) + 21,
          'wall',
          'roof',
        );
      }
  }
  const court = rec.groundReplacement.outline;
  cap(face, coarse(court, d), floors[2] + 0.06, 'wall');
  for (const m of rec.domes) {
    const floor = floors[m.component];
    if (d > 0 && m.id === 35184928676666)
      radial(
        face,
        m.center,
        [
          [floor + 42, m.radius],
          [floor + 48, m.radius * 0.72],
        ],
        d === 1 ? 8 : d === 2 ? 12 : 20,
        'wall',
      );
    dome(
      face,
      m.center,
      m.id === 35184928676666 ? m.radius * 0.72 : m.radius,
      floor + (m.id === 35184928676666 ? 48 : m.bottom),
      floor + m.top,
      d,
      m.component === 2 ? 'gold' : 'metal',
    );
  }
}
function minarets(face, d) {
  for (const m of rec.minarets) {
    const p = m.center,
      f = rec.wingFloors[m.component],
      n = d === 2 ? (m.modern ? 10 : 8) : [4, 6, 12, 20, 24][d];
    if (d === 0) {
      const levels = m.modern
        ? [
            [0, 5],
            [59, 5],
            [61, 7.3],
            [71, 7.3],
            [71, 3.9],
            [107, 3.9],
            [109, 5.1],
            [115, 5.1],
            [137.5, 0],
          ]
        : [
            [0, 3.5],
            [50, 3.5],
            [52, 5],
            [52, 2],
            [78.8, 2],
            [84.3, 0],
          ];
      radial(
        face,
        p,
        levels.map(([y, r]) => [f + y, r]),
        4,
        'wall',
      );
      continue;
    }
    if (m.modern) {
      prism(face, { outline: rectangle(p, 10) }, footing(f), f + 35.5, 'wall');
      const levels =
        d === 1
          ? [
              [35.5, 5],
              [56.6, 5],
              [60.1, 7.3],
              [70.9, 7.3],
              [70.9, 3.87],
              [105.2, 3.87],
              [107.3, 5.14],
              [115.1, 5.14],
              [115.1, 2.46],
              [119.9, 2.46],
              [124.5, 2.1],
              [129.2, 2.2],
              [134, 0],
            ]
          : [
              [35.5, 5],
              [54.6, 5],
              [55.6, 5.14],
              [56.6, 5.14],
              [57.9, 5.7],
              [59.5, 7.2],
              [61.5, 7.2],
              [62.1, 3.87],
              [68.7, 3.87],
              [69.2, 7.2],
              [70.9, 7.2],
              [70.9, 3.87],
              [100, 3.87],
              [101.9, 3.36],
              [103.7, 3.87],
              [105.2, 4.12],
              [106.8, 5.14],
              [109.8, 5.14],
              [109.8, 2.46],
              [114.1, 2.46],
              [115.1, 5.06],
              [115.1, 2.46],
              [119.9, 2.46],
              [122.2, 2.6],
              [124.5, 2.0],
              [129.2, 2.2],
              [133.5, 0.4],
            ];
      radial(
        face,
        p,
        levels.map(([y, r]) => [f + y, r]),
        n,
        'wall',
      );
      if (d >= 2) {
        for (const [b, t, r] of [
          [62.1, 68.7, 6.1],
          [109.8, 114.1, 4.25],
        ])
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4,
              q = [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
            radial(
              face,
              q,
              [
                [f + b, 0.48],
                [f + t, 0.48],
              ],
              4,
              'trim',
            );
          }
      }
      radial(
        face,
        p,
        [
          [f + 133.3, 0.3],
          [f + 137.5, 0],
        ],
        d === 1 ? 4 : 8,
        'gold',
      );
    } else {
      prism(face, { outline: rectangle(p, 7.7) }, footing(f), f + 21, 'wall');
      const levels =
        d === 1
          ? [
              [21, 3.3],
              [39, 3.3],
              [43, 4.3],
              [49.7, 4.3],
              [51.2, 3],
              [71.2, 3],
              [72.9, 4.2],
              [75.9, 2],
              [78.8, 2.5],
              [84.3, 0],
            ]
          : [
              [21, 3.3],
              [36, 3.3],
              [39, 4.1],
              [41, 4.1],
              [43, 4.6],
              [47.5, 4.6],
              [49.7, 3.1],
              [51.2, 3.1],
              [51.2, 3],
              [71.2, 3],
              [72.9, 4.2],
              [72.9, 2],
              [75.9, 2],
              [76.9, 4.2],
              [78.8, 2.2],
              [80.4, 2.4],
              [82.3, 1.7],
              [84.3, 0],
            ];
      radial(
        face,
        p,
        levels.map(([y, r]) => [f + y, r]),
        n,
        'wall',
      );
      if (d >= 2) {
        for (const [y, r] of [
          [41, 4.3],
          [72, 4.1],
          [76.1, 4.1],
        ])
          radial(
            face,
            p,
            [
              [f + y, r],
              [f + y + 0.65, r],
            ],
            n,
            'trim',
          );
      }
    }
  }
}
function kaaba(face, d) {
  const f = rec.wingFloors[2],
    p = byId(35184476003401).polygons[0],
    r = p.outline;
  if (d === 0) prism(face, p, f + 0.08, f + 14.6, 'cloth');
  if (d >= 1) {
    sides(face, r, f + 0.08, f + 0.55, 'trim');
    sides(face, r, f + 0.55, f + 8.75, 'cloth');
    sides(face, r, f + 8.75, f + 10.3, 'gold');
    sides(face, r, f + 10.3, f + 14.6, 'cloth');
    sides(face, r, f + 14.6, f + 15, 'trim');
    cap(face, r, f + 14.6, 'roof');
    const c = center(r),
      inner = r.map((p) => mix(c, p, 0.93));
    sides(face, inner, f + 14.6, f + 15, 'trim', true);
    cap(face, r, f + 15, 'trim', [inner]);
    const door = byId(35185322107282).polygons[0].outline;
    sides(face, door, f + 2.22, f + 8.75, 'gold');
    cap(face, door, f + 8.75, 'gold');
  }
  if (d >= 2) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
        normal = [axis[1] * sign(r), -axis[0] * sign(r)];
      for (const t of [0.22, 0.5, 0.78]) {
        const p = mix(a, b, t),
          w = 0.5;
        face(
          'gold',
          [
            [
              p[0] - axis[0] * w + normal[0] * 0.035,
              f + 11.1,
              p[1] - axis[1] * w + normal[1] * 0.035,
            ],
            [
              p[0] + axis[0] * w + normal[0] * 0.035,
              f + 11.1,
              p[1] + axis[1] * w + normal[1] * 0.035,
            ],
            [
              p[0] + axis[0] * w + normal[0] * 0.035,
              f + 12.1,
              p[1] + axis[1] * w + normal[1] * 0.035,
            ],
            [
              p[0] - axis[0] * w + normal[0] * 0.035,
              f + 12.1,
              p[1] - axis[1] * w + normal[1] * 0.035,
            ],
          ],
          [normal[0], 0, normal[1]],
        );
      }
    }
  }
  if (d >= 1) {
    for (const q of byId(35184688000726).polygons) prism(face, q, f + 0.08, f + 1.23, 'wall');
    const mp = byId(35184845390211).polygons[0],
      c = center(mp.outline);
    prism(face, mp, f + 0.08, f + 1.8, 'gold');
    dome(face, c, 0.75, f + 1.8, f + 2.5, d, 'gold');
  }
}
function build(target, d) {
  // Keep broad roof triangle bounds clear of the four closest separate mapped hosts.
  // This affects content tessellation only; the viewer's replacement grid is unchanged.
  const clearanceIds = new Set([35184992516766, 35184992517720, 35185320919222, 35184992516762]);
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const world = ([x, z]) => [x * c + z * s, -x * s + z * c];
  const clearance = fit.excludedBuildings
    .filter((b) => clearanceIds.has(b.id))
    .map((b) => {
      const pts = b.polygons.flatMap((p) => p.outline.map(world));
      return [0, 1].map((k) => [
        Math.min(...pts.map((p) => p[k])),
        Math.max(...pts.map((p) => p[k])),
      ]);
    });
  const tightPoints = fit.excludedBuildings
    .find((b) => b.id === 35184992516762)
    .polygons.flatMap((p) => p.outline.map(world));
  const tightBox = [0, 1].map((k) => [
    Math.min(...tightPoints.map((p) => p[k])) - 16,
    Math.max(...tightPoints.map((p) => p[k])) + 16,
  ]);
  function nearHost(p) {
    if (d > 2) return false;
    const pts = p.map((q) => world([q[0], q[2]])),
      box = [0, 1].map((k) => [
        Math.min(...pts.map((q) => q[k])),
        Math.max(...pts.map((q) => q[k])),
      ]);
    if (d > 0 && tightBox.every((v, k) => v[0] <= box[k][1] && v[1] >= box[k][0])) return 2;
    return clearance.some((b) => b.every((v, k) => v[0] <= box[k][1] && v[1] >= box[k][0])) ? 1 : 0;
  }
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const l = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (l > longest) {
              longest = l;
              k = i;
            }
          }
          const near = nearHost(p);
          const limit = near === 2 ? 8 : near ? (d === 0 ? 40 : 16) : [350, 180, 90, 55, 45][d];
          if (longest > limit) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              mid = mix(p[k], p[j], 0.5).map(Math.fround),
              v = mix(uv[k], uv[j], 0.5);
            emit([p[k], mid, p[c]], [uv[k], v, uv[c]]);
            emit([mid, p[j], p[c]], [v, uv[j], uv[c]]);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                p[1].map((v, k) => v - p[0][k]),
                p[2].map((v, k) => v - p[0][k]),
              ),
            ) < 1e-7
          )
            return;
          target.addTriangle(a[0], a[1], p, normalFor(...p), uv, a[5]);
        }
        emit(p, a[4]);
      },
    },
    face = writer(out, d);
  campus(face, d);
  minarets(face, d);
  kaaba(face, d);
}
export const buildMasjidHaramSkyline = (o) => build(o, 0),
  buildMasjidHaramDistrict = (o) => build(o, 1),
  buildMasjidHaramStreet = (o) => build(o, 2),
  buildMasjidHaramCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const masjidHaramStudy = {
  id: 'al_masjid_al_haram',
  key: 'al_masjid_al_haram',
  title: 'Al-Masjid Al-Haram',
  category: 'mosque',
  wikidataId: 'Q428858',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² marble,limestone,painted metal,canvas and bronze graphs,seven merged material groups including local glazing. Linear tints,metric UVs,flat architectural normals;no embedded images,bespoke facade photographs or baked light. Kaaba gold bands are abstract fields without invented writing.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Pictures from2012/2022/2024 guide exterior recognition;latest construction/restoration finish is unverified. PMTiles supplies current expanded outline,not a verified detailed reconstruction of the newer wing. Fine carving,inscriptions,engineering/interiors,precise gallery plans,roof equipment,temporary cranes/scaffolds,people and construction are excluded or abstracted. Selected arcade fields are recessed;others are draw-limited opaque facade fields,not traversable galleries. Minaret lanterns have simplified columns and cores;far levels merge them. Separately authored Abraj Al Bait remains host content. Old-campus marble paving,Kaaba,Hatim and Maqam are intentionally modeled and included in replacement coverage;open sky does not mean an empty viewer footprint. The localized old-mosque ground cutout restores when the model unloads. Approximate terraced bases/coarse DEM fit and connector profiles do not establish exact ground levels or accessible walking. Physical phone/laptop timing remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('mataf-kaaba-and-inner-gallery', [340, 44, -58], [260, -15, -145]),
    cam('kaaba-gold-band-and-hatim', [286, -8, -178], [258, -21, -147]),
    cam('long-sai-gallery', [230, 105, -570], [170, 3, -285]),
    cam('central-expansion-domes-and-minarets', [0, 215, 360], [0, 42, -50]),
    cam('outer-expansion-and-terraces', [-700, 310, 190], [-220, 41, -15]),
    cam('roof-and-signed-campus-plan', [0, 1280, 0.1], [0, 25, -20]),
  ],
};
