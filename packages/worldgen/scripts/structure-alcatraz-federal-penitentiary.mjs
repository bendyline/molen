/** Native principal prison, photograph-directed concrete exterior and later solar roof. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const directory = new URL(
  '../../../content/worldgen/source/places/9q/9q8/alcatraz_federal_penitentiary/',
  import.meta.url,
);
const frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', directory)));
const ref = 'palette:#ffffff';
const concrete = rgb('ccc6b6'),
  trim = rgb('d8d1c0'),
  footing = rgb('9b9e95');
const dark = rgb('536568'),
  iron = rgb('697471'),
  roof = rgb('b9b9ad');
const solar = rgb('273f53'),
  rust = rgb('936b55');
const ring = (r) => r.slice(0, -1).map((p) => p.slice());
const outer = ring(frame.geometry.outline);
const tint = (c, f) => c.map((v) => Math.min(1, v * f));
const area = (r) =>
  r.reduce((s, p, i) => {
    const q = r[(i + 1) % r.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
const sign = area(outer) > 0 ? 1 : -1;

function tri(o, slot, p, color, desired) {
  p = p.map((q) => q.map(Math.fround));
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.5) return;
  if (desired && n.reduce((s, v, i) => s + v * desired[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    n = n.map((v) => -v);
  }
  o.addTriangle(
    slot,
    ref,
    p,
    n,
    p.map((q) => [q[0] + q[2], q[1]]),
    color,
  );
}
function quad(o, slot, p, color, n) {
  tri(o, slot, [p[0], p[1], p[2]], color, n);
  tri(o, slot, [p[0], p[2], p[3]], color, n);
}
function polygon(o, slot, p, color, normal, holes = []) {
  const axis = Math.abs(normal[1]) > 0.7 ? [0, 2] : Math.abs(normal[0]) > 0.7 ? [2, 1] : [0, 1];
  const all = p.concat(...holes),
    offsets = [];
  let count = p.length;
  for (const hole of holes) {
    offsets.push(count);
    count += hole.length;
  }
  const ids = earcut(
    all.flatMap((q) => axis.map((i) => q[i])),
    offsets,
  );
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      slot,
      ids.slice(i, i + 3).map((j) => all[j]),
      color,
      normal,
    );
}
function cap(o, slot, r, y, color) {
  polygon(
    o,
    slot,
    r.map((p) => [p[0], y, p[1]]),
    color,
    [0, 1, 0],
  );
}
function prism(o, slot, r, lo, hi, color) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      slot,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      color,
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
  cap(o, slot, r, hi, color);
}
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function arch(x, y, w, h, count = 10) {
  const r = w / 2,
    spring = y + h - r;
  const p = [
    [x - r, y],
    [x + r, y],
    [x + r, spring],
  ];
  for (let i = 1; i <= count; i++)
    p.push([x + r * Math.cos((Math.PI * i) / count), spring + r * Math.sin((Math.PI * i) / count)]);
  return p;
}
function faceSpace(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const u = [dx / length, 0, dz / length],
    n = [sign * u[2], 0, -sign * u[0]];
  const p = (x, y, depth = 0) => [
    a[0] + u[0] * x - n[0] * depth,
    y,
    a[1] + u[2] * x - n[2] * depth,
  ];
  return { length, u, n, p };
}
function strip(o, slot, f, x, y, w, h, color, depth = -0.015) {
  quad(
    o,
    slot,
    rect(x, y, w, h).map((q) => f.p(q[0], q[1], depth)),
    color,
    f.n,
  );
}
function bar(o, slot, a, b, w, h, color) {
  beam(o, slot, a, b, w, h, color);
}

export function alcatrazFacadeControls() {
  return outer.map((a, edge) => {
    const b = outer[(edge + 1) % outer.length],
      f = faceSpace(a, b);
    const front = edge === 5,
      dining = edge >= 11 && edge <= 17,
      admin = edge >= 4 && edge <= 6;
    const top = dining ? 14.4 : admin ? 16.4 : 17.2;
    const bays = front ? 9 : Math.max(1, Math.round(f.length / (dining ? 3.7 : 3.45)));
    return { edge, a, b, front, dining, admin, top, bays, length: f.length };
  });
}
function facade(o, c, d) {
  const f = faceSpace(c.a, c.b),
    openings = [];
  const pitch = f.length / c.bays;
  if (d)
    for (let bay = 0; bay < c.bays; bay++) {
      const x = pitch * (bay + 0.5),
        width = Math.min(c.front ? 2.1 : 1.8, pitch * 0.62);
      const rows = c.front
        ? [
            [5.15, 2.25],
            [10.0, 3.15],
          ]
        : c.dining
          ? [
              [-2.2, 1.6],
              [1.2, 4.2],
              [7.3, 4.2],
            ]
          : [
              [-1.8, 1.8],
              [2.2, 4.0],
              [8.8, 4.0],
            ];
      for (let row = d === 1 && !c.front ? 1 : 0; row < rows.length; row++) {
        const [y, h] = rows[row],
          door = c.front && bay === 4 && row === 0;
        const w = door ? 2.3 : row === 0 && !c.front ? width * 0.74 : width;
        const bottom = door ? 4.5 : y,
          height = door ? 3.15 : h;
        const outline = door
          ? arch(x, bottom, w, height, d === 1 ? 6 : 12)
          : rect(x, bottom, w, height);
        openings.push({ bay, row, x, y: bottom, w, h: height, door, outline });
      }
      if (c.front && d >= 2 && bay % 2 === 0)
        openings.push({
          bay,
          row: 3,
          x,
          y: 14.25,
          w: 1.7,
          h: 0.34,
          outline: rect(x, 14.25, 1.7, 0.34),
        });
    }
  polygon(
    o,
    'concrete',
    rect(f.length / 2, -8.2, f.length, c.top + 8.2).map((q) => f.p(...q)),
    concrete,
    f.n,
    openings.map((h) => h.outline.map((q) => f.p(...q))),
  );
  for (const h of openings) {
    const depth = h.door ? 0.7 : 0.36;
    for (let i = 0; i < h.outline.length; i++) {
      const a = h.outline[i],
        b = h.outline[(i + 1) % h.outline.length];
      quad(
        o,
        'concrete',
        [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)],
        tint(concrete, 0.82),
      );
    }
    polygon(
      o,
      'recess',
      h.outline.map((q) => f.p(...q, depth)),
      h.door ? rgb('394a49') : dark,
      f.n,
    );
    if (d < 2 || h.row === 3) continue;
    const col = h.door ? iron : rgb('8a938c');
    for (const sx of [-1, 1]) {
      const x = h.x + sx * (h.w / 2 + 0.045);
      if (d === 3)
        bar(
          o,
          'iron',
          f.p(x, h.y - 0.04, -0.015),
          f.p(x, h.y + h.h + 0.04, -0.015),
          0.08,
          0.08,
          col,
        );
      else strip(o, 'iron', f, x, h.y - 0.04, 0.08, h.h + 0.08, col);
    }
    for (const y of [h.y - 0.045, h.y + h.h]) strip(o, 'iron', f, h.x, y, h.w + 0.16, 0.09, col);
    if (!h.door) {
      const nx = d === 3 ? 6 : 2,
        ny = d === 3 ? Math.max(4, Math.round(h.h / 0.36)) : 3;
      for (let i = 1; i < nx; i++)
        strip(o, 'iron', f, h.x - h.w / 2 + (h.w * i) / nx, h.y, 0.028, h.h, col, 0.24);
      for (let i = 1; i < ny; i++)
        strip(o, 'iron', f, h.x, h.y + (h.h * i) / ny, h.w, 0.026, col, 0.24);
      if (d === 3)
        bar(
          o,
          'trim',
          f.p(h.x - h.w / 2 - 0.12, h.y - 0.12, -0.07),
          f.p(h.x + h.w / 2 + 0.12, h.y - 0.12, -0.07),
          0.2,
          0.13,
          tint(trim, 0.92),
        );
    } else {
      strip(o, 'iron', f, h.x, h.y, 0.055, h.h - h.w / 2, col, 0.61);
      for (let i = 0; i < h.outline.length - 1; i++)
        bar(
          o,
          'trim',
          f.p(...h.outline[i], -0.13),
          f.p(...h.outline[i + 1], -0.13),
          0.18,
          0.18,
          trim,
        );
    }
  }
  if (c.front) {
    // The central five bays rise above the two lower end pairs in the south photograph.
    bar(
      o,
      'concrete',
      f.p(pitch * 2, c.top + 0.4, 0.14),
      f.p(pitch * 7, c.top + 0.4, 0.14),
      0.32,
      0.8,
      concrete,
    );
    bar(
      o,
      'concrete',
      f.p(pitch * 3, c.top + 0.92, 0.14),
      f.p(pitch * 6, c.top + 0.92, 0.14),
      0.32,
      0.24,
      concrete,
    );
  }
  if (!d) return;
  // Projecting cornices remain visible at district scale; fine facade orders enter later.
  for (const [y, w, h] of [
    [c.top - 1.5, 0.26, 0.22],
    [c.top - 0.9, 0.42, 0.24],
  ])
    bar(o, 'trim', f.p(0, y, -0.08), f.p(f.length, y, -0.08), w, h, trim);
  if (d < 2) return;
  const base = c.front ? 4.45 : c.dining ? 0.5 : 1.6;
  for (let i = 0; i <= c.bays; i++) {
    const x = pitch * i,
      low = base,
      top = c.top - 1.65;
    bar(o, 'trim', f.p(x, low, -0.075), f.p(x, top, -0.075), 0.32, 0.15, trim);
    strip(o, 'trim', f, x, top - 0.28, 0.58, 0.23, trim, -0.17);
    strip(o, 'trim', f, x, low + 0.12, 0.52, 0.19, trim, -0.16);
    if (d === 3 && i < c.bays) {
      // Restrained original vertex colors suggest weathered concrete; no photographic pixels.
      const k = (i * 17 + c.edge * 13) % 7;
      const y = low + 0.6 + (k % 3) * 0.55,
        h = 0.9 + k * 0.17;
      strip(
        o,
        'concrete',
        f,
        x + 0.27,
        y,
        0.18 + k * 0.025,
        h,
        rgb(k % 2 ? 'b4b09f' : 'a9aba1'),
        -0.008,
      );
    }
  }
  if (!c.front)
    for (let y = base - 3; y < base; y += 0.55)
      strip(o, 'concrete', f, f.length / 2, y, f.length, 0.025, tint(footing, 0.9), -0.006);
  else {
    for (let i = 0; i < c.bays; i++) {
      const x = pitch * (i + 0.5);
      strip(o, 'trim', f, x, 8.5, 1.65, 0.13, trim, -0.035);
      strip(o, 'trim', f, x, 8.22, 0.18, 0.28, trim, -0.04);
    }
    const centre = f.length / 2;
    // Shallow armorial envelope: a shield, outstretched wings and scrolls, without tiny relief.
    polygon(
      o,
      'trim',
      [
        [-0.4, 8.95],
        [0.4, 8.95],
        [0.32, 8.35],
        [0, 8.12],
        [-0.32, 8.35],
      ].map(([x, y]) => f.p(centre + x, y, -0.27)),
      trim,
      f.n,
    );
    for (const s of [-1, 1])
      polygon(
        o,
        'trim',
        [
          [0.25, 8.82],
          [1.2, 9.23],
          [1.02, 8.62],
          [0.52, 8.45],
        ].map(([x, y]) => f.p(centre + s * x, y, -0.23)),
        trim,
        f.n,
      );
    bar(
      o,
      'trim',
      f.p(centre - 0.85, 8.18, -0.2),
      f.p(centre + 0.85, 8.18, -0.2),
      0.14,
      0.14,
      trim,
    );
    for (let i = 1; i < c.bays; i++) {
      const x = pitch * i,
        y = c.top - 1.13,
        count = d === 3 ? 10 : 6;
      const circle = Array.from({ length: count }, (_, j) =>
        f.p(
          x + 0.14 * Math.cos((2 * Math.PI * j) / count),
          y + 0.14 * Math.sin((2 * Math.PI * j) / count),
          -0.075,
        ),
      );
      polygon(o, 'trim', circle, trim, f.n);
    }
  }
  if (d === 3)
    for (let i = 1; i < c.bays; i += 2) {
      const x = pitch * i;
      bar(o, 'iron', f.p(x, c.top - 0.3, -0.13), f.p(x, c.top + 0.45, -1.1), 0.045, 0.045, iron);
    }
}

function monitor(o, x, z0, z1, y, width, d) {
  const half = width / 2,
    ridge = y + 1.25;
  for (const side of [-1, 1]) {
    quad(
      o,
      'recess',
      [
        [x + side * half, y, z0],
        [x + side * half, y, z1],
        [x, ridge, z1],
        [x, ridge, z0],
      ],
      rgb('779092'),
      [side, 1, 0],
    );
    if (d >= 2) {
      const count = Math.ceil((z1 - z0) / (d === 3 ? 0.55 : 2.2));
      for (let i = 0; i <= count; i++) {
        const z = z0 + ((z1 - z0) * i) / count;
        bar(o, 'iron', [x + side * half, y + 0.025, z], [x, ridge + 0.025, z], 0.04, 0.04, iron);
      }
    }
  }
  for (const z of [z0, z1])
    polygon(
      o,
      'concrete',
      [
        [x - half, y, z],
        [x + half, y, z],
        [x, ridge, z],
      ],
      trim,
      [0, 0, z === z0 ? -1 : 1],
    );
}
function contains(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      v = !v;
  return v;
}
function solarRoof(o, r, y, d, monitors = []) {
  if (!d) return;
  const low = [0, 1].map((k) => Math.min(...r.map((p) => p[k]))),
    high = [0, 1].map((k) => Math.max(...r.map((p) => p[k])));
  const dx = d === 1 ? 3.3 : 1.25,
    dz = d === 1 ? 7 : 1.85;
  for (let x = low[0] + 1; x + dx < high[0] - 0.5; x += dx + 0.23)
    for (let z = low[1] + 1; z + dz < high[1] - 0.5; z += dz + 0.23) {
      const corners = [
        [x, z],
        [x + dx, z],
        [x + dx, z + dz],
        [x, z + dz],
      ];
      if (!corners.every((p) => contains(p, r))) continue;
      if (
        monitors.some(
          (m) =>
            x < m[0] + m[3] / 2 + 0.8 &&
            x + dx > m[0] - m[3] / 2 - 0.8 &&
            z < m[2] + 0.5 &&
            z + dz > m[1] - 0.5,
        )
      )
        continue;
      if (Math.hypot(x + dx / 2 + 24.4, z + dz / 2 + 57.7) < 6) continue;
      quad(
        o,
        'solar',
        corners.map((p) => [p[0], y + 0.2, p[1]]),
        solar,
        [0, 1, 0],
      );
      if (d === 3) {
        for (const z0 of [z, z + dz])
          quad(
            o,
            'iron',
            [
              [x, y + 0.215, z0 - 0.009],
              [x + dx, y + 0.215, z0 - 0.009],
              [x + dx, y + 0.215, z0 + 0.009],
              [x, y + 0.215, z0 + 0.009],
            ],
            rgb('afb7b5'),
            [0, 1, 0],
          );
        // A single cell seam is enough at the exterior review distances.
        quad(
          o,
          'solar',
          [
            [x + dx / 2 - 0.006, y + 0.221, z],
            [x + dx / 2 + 0.006, y + 0.221, z],
            [x + dx / 2 + 0.006, y + 0.221, z + dz],
            [x + dx / 2 - 0.006, y + 0.221, z + dz],
          ],
          tint(solar, 1.35),
          [0, 1, 0],
        );
      }
    }
}
function cylinder(o, x, z, radius, lo, hi, d) {
  const count = d < 2 ? 8 : d === 2 ? 16 : 32;
  const r = Array.from({ length: count }, (_, i) => [
    x + radius * Math.cos((2 * Math.PI * i) / count),
    z + radius * Math.sin((2 * Math.PI * i) / count),
  ]);
  prism(o, 'iron', r, lo, hi, tint(rust, 0.87));
  for (let i = 0; i < count; i++)
    tri(
      o,
      'iron',
      [
        [r[i][0] * 1 + 0.1 * (r[i][0] - x), hi, r[i][1] + 0.1 * (r[i][1] - z)],
        [
          r[(i + 1) % count][0] + 0.1 * (r[(i + 1) % count][0] - x),
          hi,
          r[(i + 1) % count][1] + 0.1 * (r[(i + 1) % count][1] - z),
        ],
        [x, hi + 1.2, z],
      ],
      rust,
      [0, 1, 0],
    );
  if (d >= 2)
    for (const y of [lo + 0.45, hi - 0.35])
      for (let i = 0; i < count; i++)
        bar(
          o,
          'iron',
          [r[i][0], y, r[i][1]],
          [r[(i + 1) % count][0], y, r[(i + 1) % count][1]],
          0.06,
          0.06,
          iron,
        );
}

export function alcatrazFederalPenitentiary(o, _frame = frame, d = 3) {
  // Foundation depth is an explicit hidden work envelope, not a fitted terrain replacement.
  prism(o, 'foundation', outer, -8.2, -0.3, footing);
  for (const c of alcatrazFacadeControls()) facade(o, c, d);
  const parts = frame.geometry.parts.map((p) => ring(p.outline));
  for (const [r, y] of [
    [parts[0], 17.2],
    [parts[1], 14.4],
    [parts[2], 16.4],
  ])
    cap(o, 'roof', r, y - 0.65, roof);
  // Visible roof-height transitions at the internal interfaces, above the lower roofs only.
  const main = parts[0];
  for (const [a, b, lo, hi] of [
    [main[0], main[1], 13.75, 17.2],
    [main[4], main[5], 15.75, 17.2],
  ]) {
    const f = faceSpace(a, b);
    quad(o, 'concrete', [f.p(0, lo), f.p(f.length, lo), f.p(f.length, hi), f.p(0, hi)], concrete);
  }
  cylinder(o, -24.4, -57.7, 4.4, 16.6, 20.0, d);
  const monitors = [
    [-16.0, -44.0, -4.0, 2.5],
    [-4.0, -61.0, -4.0, 2.6],
    [8.1, -44.0, -4.0, 2.5],
  ];
  for (const [x, z0, z1, width] of monitors) monitor(o, x, z0, z1, 16.65, width, d);
  if (d) {
    solarRoof(o, parts[0], 16.55, d, monitors);
    solarRoof(o, parts[1], 13.75, d);
    solarRoof(o, parts[2], 15.75, d);
    if (d >= 2) {
      B(o, 'roof', 1.5, 4.25, 16.2, 34.5, 0.35, 2.7, roof);
      for (let i = 0; i < 3; i++)
        B(o, 'concrete', 1.4, 4.2 + i * 0.13, 18.3 - i * 0.35, 3.1, 0.13, 0.4, trim);
      for (const x of [-0.35, 3.15])
        bar(o, 'iron', [x, 5.1, 18.45], [x, 5.5, 16.7], 0.04, 0.04, iron);
      for (const x of [-0.35, 3.15])
        for (const z of [17.0, 18.1]) bar(o, 'iron', [x, 4.5, z], [x, 5.3, z], 0.04, 0.04, iron);
      // Utility vents are photograph-directed secondary forms, not interior systems.
      for (const [x, z] of [
        [-11, -31],
        [2, -49],
        [13, -14],
      ]) {
        B(o, 'roof', x, 16.55, z, 0.7, 0.65, 0.7, footing);
        B(o, 'iron', x, 17.2, z, 0.95, 0.12, 0.95, iron);
      }
    }
  }
}
export const alcatrazFederalPenitentiarySkyline = (o) => alcatrazFederalPenitentiary(o, frame, 0);
export const alcatrazFederalPenitentiaryDistrict = (o) => alcatrazFederalPenitentiary(o, frame, 1);
export const alcatrazFederalPenitentiaryStreet = (o) => alcatrazFederalPenitentiary(o, frame, 2);
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  trim: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  recess: { slot: 'window', localRef: ref, roughness: 0.65, metallic: 0.08 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
  solar: { slot: 'roof', localRef: 'palette:#fffefd', roughness: 0.4, metallic: 0.12 },
};
export const alcatrazFederalPenitentiaryModel = {
  id: 'alcatraz_federal_penitentiary',
  key: 'alcatraz_federal_penitentiary',
  recipe: 'structure-alcatraz-federal-penitentiary.mjs',
  cell: '9q/9q8',
  title: 'Alcatraz Federal Penitentiary',
  brief:
    'Native principal prison exterior with staggered cellhouse wings, attached dining/kitchen and lower southeast administration frontage; nine-bay central arched entrance, two tiers of large recessed metal-grid windows over smaller base lights, plain concrete pilasters, rusticated lower walls, stepped cornices/parapets and narrow roof rods. Three long gabled glazed roof monitors, later solar-panel rows and an integral weathered cylindrical roof cistern with shallow conical cover. Short front entry apron and steps; separate lighthouse, detached cistern terrace, island guard towers/barracks and ruins excluded.',
  camera: [125, 95, 145],
  lookAt: [-5, 7, -45],
  portableGroundY: -0.15,
  qaCameras: [
    { name: 'southeast-entrance', position: [42, 19, 65], lookAt: [1, 10, 14.6] },
    { name: 'front-door-and-pilasters', position: [2, 10, 33], lookAt: [1, 9.3, 14.7] },
    { name: 'east-cellhouse', position: [100, 25, -22], lookAt: [15, 7.5, -28] },
    { name: 'west-cellhouse', position: [-110, 25, -36], lookAt: [-25, 7, -44] },
    { name: 'dining-yard-face', position: [-63, 16, -89], lookAt: [-16.3, 5, -88] },
    { name: 'northern-kitchen', position: [30, 20, -145], lookAt: [-5, 6, -111] },
    { name: 'roof-monitors-and-solar', position: [45, 135, 90], lookAt: [-5, 14, -45] },
  ],
  mediumFiContext: {
    scale: 1.04,
    groundY: 0.04,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: outer,
    basis:
      'Native three-part prison envelope, closing only the documented6.4cm digitization sliver at the attached dining junction. Original part polygons retained. Physical building foundations/floors cover the bounded opening; original USGS source values remain unchanged.',
  },
  build: alcatrazFederalPenitentiary,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original USGS CA_SanFrancisco_B23 export locked to raster71693 before geometry. Independent203401pixel decode and66049derived samples; provider-relative external dry footway datum37.8684m. No terrain fitting/flattening or local survey alignment.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alcatraz-federal-penitentiary.mjs',
    level: 'skyline',
    export: 'alcatrazFederalPenitentiarySkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'alcatrazFederalPenitentiaryDistrict', errorMeters: 1, surfaces },
      street: { export: 'alcatrazFederalPenitentiaryStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Plan is native map geometry with a documented sub-decimetre dining-junction seam. Heights, floors, window sizes, roof monitors, solar-panel layout and roof cistern proportions are photographic estimates, not measured survey elevations.',
    'Later solar array is represented from the inspected official DOE roof photo; module count and maintenance/replacement state are not certified. Fine weathering, armorial relief and inscriptions are generalized.',
    'Main prison exterior only. Cell interiors, subterranean Citadel, recreation yard/guard houses, separate front vaulted cistern terrace, lighthouse and island-wide ruins/barracks remain outside scope. No navigable collision or architectural conservation claim.',
    'Original USGS field remains unchanged. One-metre source and sampling do not certify ground classification at paving/hidden foundations or default coarse Earth terrain compatibility.',
  ],
};
