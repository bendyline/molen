/** Lusail's independent golden vessel, pierced triangular skin and double cable roof. */
import { beam, cross, loft, normalFor, normalize, radialRing } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const pale = [0.79, 0.78, 0.71],
  concrete = [0.58, 0.57, 0.52],
  gold = [1, 0.69, 0.26],
  steel = [0.61, 0.64, 0.62],
  white = [0.94, 0.93, 0.86],
  dark = [0.025, 0.03, 0.035],
  glazing = [0.15, 0.19, 0.19],
  fieldY = -4;
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const rimY = (a) => 63.8 - 8 * Math.cos(2 * a);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function tri(out, slot, points, color, expected) {
  let p = points,
    n = normalFor(...p);
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  out.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}
function rounded(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return radial(a, t, y);
}
function ringSlab(out, fn, inner, outer, y, thick = 0.3, color = pale, n = 384) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      p = [fn(a, inner, y), fn(b, inner, y), fn(b, outer, y), fn(a, outer, y)],
      q = p.map((v) => [v[0], y - thick, v[2]]);
    face(out, 'concrete', p, color, [0, 1, 0]);
    face(out, 'concrete', q, color, [0, -1, 0]);
    for (const k of [0, 2]) {
      const j = (k + 1) % 4;
      face(out, 'concrete', [q[k], q[j], p[j], p[k]], color, [
        p[j][2] - p[k][2],
        0,
        p[k][0] - p[j][0],
      ]);
    }
  }
}
function rail(out, fn, n = 192) {
  const ps = Array.from({ length: n + 1 }, (_, i) => fn((i * TAU) / n));
  for (const h of [0.5, 1.05])
    curve(
      out,
      ps.map((p) => [p[0], p[1] + h, p[2]]),
      0.025,
      steel,
    );
  for (const p of ps.slice(0, -1))
    beam(out, 'metal', p, [p[0], p[1] + 1.05, p[2]], 0.04, 0.04, steel);
}
function shellPoint(a, t) {
  return radial(a, 137.5 + 18.5 * Math.sin((t * Math.PI) / 2) ** 0.58, 5 + (rimY(a) - 5) * t);
}
function continuousTube(out, points, radius, color, sides = 20) {
  const rings = points.map((p, index) => {
    const before = points[Math.max(0, index - 1)],
      after = points[Math.min(points.length - 1, index + 1)],
      axis = normalize(after.map((v, k) => v - before[k])),
      u = normalize(cross(axis, [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, i) =>
      p.map(
        (x, k) =>
          x + radius * (u[k] * Math.cos((i * TAU) / sides) + v[k] * Math.sin((i * TAU) / sides)),
      ),
    );
  });
  loft(out, 'metal', rings, color);
}
function piercedTriangle(out, ps, perforation) {
  const c = ps[0].map((_, k) => (ps[0][k] + ps[1][k] + ps[2][k]) / 3),
    a = Math.atan2(c[0], c[2]);
  let n = normalFor(...ps);
  if (n[0] * Math.sin(a) + n[2] * Math.cos(a) < 0) n = n.map((v) => -v);
  const rings = [
    ps.map((p) => mix(c, p, 0.985)),
    ps.map((p) => mix(c, p, 0.83).map((v, k) => v - n[k] * 0.19)),
    ps.map((p) => mix(c, p, perforation).map((v, k) => v - n[k] * 0.22)),
  ];
  // Folded gold lips surround genuine triangular apertures; no dark decal fills them.
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) % 3,
        p = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      face(out, 'metal', p, gold, n);
      face(
        out,
        'metal',
        p.map((p) => p.map((v, k) => v - n[k] * 0.035)),
        gold.map((v) => v * 0.72),
        n.map((v) => -v),
      );
    }
  for (let i = 0; i < 3; i++) {
    const k = (i + 1) % 3,
      p = [
        rings[2][i],
        rings[2][k],
        rings[2][k].map((v, j) => v - n[j] * 0.045),
        rings[2][i].map((v, j) => v - n[j] * 0.045),
      ];
    face(
      out,
      'metal',
      p,
      gold.map((v) => v * 0.65),
      mix(rings[2][i], rings[2][k], 0.5).map((v, j) => c[j] - v),
    );
  }
}
function vessel(out) {
  // Four smaller perforated fields per published triangular cladding assembly.
  const n = 350,
    rows = 24;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const a = ((i + (j % 2) * 0.5) * TAU) / n,
        b = a + TAU / n,
        m = a + TAU / n / 2;
      const p = shellPoint(a, j / rows),
        q = shellPoint(b, j / rows),
        r = shellPoint(m, (j + 1) / rows),
        s = shellPoint(m - TAU / n, (j + 1) / rows);
      const hole = j > 20 ? 0.055 : 0.32 + 0.035 * Math.sin(j * 0.7);
      piercedTriangle(out, [p, q, r], hole);
      piercedTriangle(out, [p, r, s], hole);
    }
  for (const t of [0, 0.25, 0.5, 0.75, 1])
    curve(
      out,
      Array.from({ length: 701 }, (_, i) => shellPoint((i * TAU) / 700, t)),
      0.08,
      gold,
      'metal',
      8,
    );
  // 24 plinths support48 curved legs of the independent vessel structure.
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24,
      p = radial(a, 136, 0),
      o = transformed(out, a, p);
    loft(
      o,
      'concrete',
      [radialRing(0, 1.8, 2.25, 24), radialRing(3, 1.5, 1.75, 24), radialRing(8, 0.85, 1.1, 24)],
      pale,
    );
    for (const side of [-1, 1]) {
      const ps = Array.from({ length: 21 }, (_, j) => {
        const t = j / 20,
          ang = a + (side * t * TAU) / 48,
          p = shellPoint(ang, t);
        return radial(ang, Math.hypot(p[0], p[2]) - 1.9, p[1] + 2 * (1 - t));
      });
      continuousTube(out, ps, 0.58, steel);
      const inner = ps.map((p) => {
        const r = Math.hypot(p[0], p[2]);
        return [(p[0] * (r - 2.6)) / r, p[1], (p[2] * (r - 2.6)) / r];
      });
      continuousTube(out, inner, 0.37, steel, 16);
      for (let j = 0; j < 20; j++)
        tube(
          out,
          'metal',
          j % 2 ? inner[j] : ps[j],
          j % 2 ? ps[j + 1] : inner[j + 1],
          0.19,
          steel,
          8,
        );
    }
  }
  // Concourses visible through the perforated cladding, with concrete floors and glazing.
  for (const y of [0, 6, 12, 18, 24, 30, 36, 42]) {
    const r = 132 + Math.min(y / 42, 1) * 11;
    ringSlab(out, radial, r - 12, r, y, 0.32, concrete);
    for (let i = 0; i < 192; i++) {
      const a = (i * TAU) / 192,
        b = ((i + 1) * TAU) / 192;
      face(
        out,
        'glass',
        [
          radial(a, r - 7, y + 0.5),
          radial(b, r - 7, y + 0.5),
          radial(b, r - 7, y + 4.7),
          radial(a, r - 7, y + 4.7),
        ],
        glazing,
        [Math.sin(a), 0, Math.cos(a)],
      );
      beam(out, 'metal', radial(a, r - 7, y + 0.3), radial(a, r - 7, y + 4.9), 0.09, 0.09, pale);
    }
  }
  // Curved horizontal GFRC base strips and recessed public entrance bays.
  for (let bay = 0; bay < 24; bay++) {
    const a0 = ((bay + 0.07) * TAU) / 24,
      a1 = ((bay + 0.93) * TAU) / 24;
    for (let j = 0; j < 24; j++) {
      const a = a0 + ((a1 - a0) * j) / 24,
        b = a0 + ((a1 - a0) * (j + 1)) / 24,
        r = 133 + 1.2 * Math.sin((j / 24) * Math.PI);
      if (j > 8 && j < 15) {
        face(
          out,
          'glass',
          [radial(a, r, 0), radial(b, r, 0), radial(b, r, 4.5), radial(a, r, 4.5)],
          glazing,
          [Math.sin(a), 0, Math.cos(a)],
        );
        beam(out, 'metal', radial(a, r + 0.04, 0), radial(a, r + 0.04, 4.5), 0.08, 0.09, steel);
        beam(out, 'metal', radial(a, r + 0.04, 4.5), radial(b, r + 0.04, 4.5), 0.1, 0.12, steel);
        tube(
          out,
          'metal',
          radial((a + b) / 2, r + 0.1, 0.9),
          radial((a + b) / 2, r + 0.1, 1.5),
          0.022,
          steel,
          6,
        );
        continue;
      }
      face(
        out,
        'concrete',
        [radial(a, r, 0), radial(b, r, 0), radial(b, r, 5.2), radial(a, r, 5.2)],
        pale,
        [Math.sin(a), 0, Math.cos(a)],
      );
      for (let y = 0.25; y < 5; y += 0.22)
        face(
          out,
          'metal',
          [
            radial(a, r + 0.025, y),
            radial(b, r + 0.025, y),
            radial(b, r + 0.025, y + 0.04),
            radial(a, r + 0.025, y + 0.04),
          ],
          steel,
          [Math.sin(a), 0, Math.cos(a)],
        );
    }
  }
}
function roofPoint(a, t) {
  const r0 = 1 / Math.hypot(Math.sin(a) / 54, Math.cos(a) / 68),
    r = r0 + (153.5 - r0) * t;
  return radial(a, r, 63.8 - 8 * (r / 153.5) ** 2 * Math.cos(2 * a) - 1.5 * Math.sin(Math.PI * t));
}
function roof(out) {
  // Individually arched membrane bays create the characteristic leaf-like roof pattern.
  const angular = 96,
    radialRows = 13;
  for (let i = 0; i < angular; i++)
    for (let j = 0; j < radialRows; j++) {
      const a = (i * TAU) / angular,
        b = ((i + 1) * TAU) / angular,
        t = j / radialRows,
        u = (j + 1) / radialRows;
      const p = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)],
        c = roofPoint((a + b) / 2, (t + u) / 2);
      c[1] += 1.0 * Math.sin((Math.PI * (j + 0.5)) / radialRows) + 0.35;
      for (let k = 0; k < 4; k++) {
        const q = [p[k], p[(k + 1) % 4], c];
        tri(out, 'membrane', q, white, [0, 1, 0]);
        tri(
          out,
          'membrane',
          q.map((v) => [v[0], v[1] - 0.04, v[2]]),
          white,
          [0, -1, 0],
        );
      }
      if (i % 2 === 0) curve(out, [p[0], c, p[2]], 0.043, steel, 'metal', 6);
    }
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      upper = Array.from({ length: 27 }, (_, j) => {
        const p = roofPoint(a, j / 26);
        return [p[0], p[1] - 0.25, p[2]];
      }),
      lower = upper.map((p, j) => [p[0], p[1] - 4.2 - 3.7 * Math.sin((j * Math.PI) / 26), p[2]]);
    curve(out, upper, 0.095, steel, 'metal', 8);
    curve(out, lower, 0.11, steel, 'metal', 8);
    for (let j = 0; j < 27; j += 2) {
      tube(out, 'metal', upper[j], lower[j], 0.105, steel, 8);
      if (j < 26) tube(out, 'metal', upper[j], lower[j + 2], 0.05, steel, 6);
    }
  }
  for (const [height, rad] of [
    [-0.15, 0.23],
    [-4.5, 0.24],
    [-5.1, 0.13],
  ])
    curve(
      out,
      Array.from({ length: 385 }, (_, i) => {
        const p = roofPoint((i * TAU) / 384, 0);
        return [p[0], p[1] + height, p[2]];
      }),
      rad,
      steel,
      'metal',
      12,
    );
  // Outer compression ring has distinct upper, lower and inner chords with diagonals.
  for (const [dr, dy] of [
    [0, 0],
    [-4, -4.1],
    [0, -7.2],
  ])
    curve(
      out,
      Array.from({ length: 385 }, (_, i) =>
        radial((i * TAU) / 384, 153.5 + dr, rimY((i * TAU) / 384) + dy),
      ),
      0.52,
      steel,
      'metal',
      12,
    );
  for (let i = 0; i < 192; i++) {
    const a = (i * TAU) / 192,
      b = ((i + 1) * TAU) / 192;
    tube(out, 'metal', radial(a, 153.5, rimY(a)), radial(b, 153.5, rimY(b) - 7.2), 0.22, steel, 8);
    tube(
      out,
      'metal',
      radial(a, 153.5, rimY(a) - 7.2),
      radial(b, 149.5, rimY(b) - 4.1),
      0.18,
      steel,
      8,
    );
  }
  // Gold cap covers the structural ring; walkway/lights follow the oculus below.
  for (let i = 0; i < 384; i++) {
    const a = (i * TAU) / 384,
      b = ((i + 1) * TAU) / 384;
    face(
      out,
      'metal',
      [
        radial(a, 153.5, rimY(a)),
        radial(b, 153.5, rimY(b)),
        radial(b, 156, rimY(b)),
        radial(a, 156, rimY(a)),
      ],
      gold,
      [0, 1, 0],
    );
  }
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      p = roofPoint(a, 0.065),
      o = transformed(out, a, [p[0], p[1] - 5.9, p[2]]);
    box(o, 'metal', [-1.05, -0.25, -0.35], [1.05, 0.3, 0.35], dark);
    for (const x of [-0.68, 0, 0.68])
      box(o, 'plastic', [x - 0.26, -0.22, -0.36], [x + 0.26, 0.23, -0.34], white);
    tube(out, 'metal', [p[0], p[1] - 0.3, p[2]], [p[0], p[1] - 5.6, p[2]], 0.07, steel, 8);
  }
  for (const side of [-1, 1]) {
    const z = side * 77,
      o = transformed(out, side === 1 ? 0 : Math.PI, [0, 48, z]);
    box(o, 'metal', [-8, 0, -0.5], [8, 9, 0.5], steel);
    box(o, 'glass', [-7.7, 0.3, -0.54], [7.7, 8.7, -0.51], dark);
    for (const x of [-6, 6])
      tube(
        out,
        'metal',
        [x, 57, z],
        [x, roofPoint(side === 1 ? 0 : Math.PI, 0.14)[1] - 0.5, z],
        0.09,
        steel,
        8,
      );
  }
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, fieldY, 0]));
  const tiers = [
    { hx: 40, hz: 62, r: 18, y: -3.6, rows: 32, run: 0.82, rise: 0.37 },
    { hx: 70, hz: 92, r: 40, y: 12.7, rows: 22, run: 0.83, rise: 0.46 },
    { hx: 92, hz: 114, r: 64, y: 28.1, rows: 36, run: 0.77, rise: 0.6 },
  ];
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    for (let row = 0; row < t.rows; row++) {
      const y = t.y + row * t.rise,
        fn = (a, dr = 0, yy = y) =>
          rounded(
            a,
            t.hx + row * t.run + dr,
            t.hz + row * t.run + dr,
            t.r + row * t.run * 0.68 + dr * 0.68,
            yy,
          ),
        n = 768,
        ps = Array.from({ length: n + 1 }, (_, i) => fn((i * TAU) / n));
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n,
          b = ((i + 1) * TAU) / n;
        face(out, 'concrete', [ps[i], ps[i + 1], fn(b, t.run), fn(a, t.run)], pale, [0, 1, 0]);
        face(
          out,
          'concrete',
          [fn(a, 0, y - t.rise), fn(b, 0, y - t.rise), ps[i + 1], ps[i]],
          concrete,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
      const ds = [0];
      for (let i = 1; i < ps.length; i++)
        ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][2] - ps[i - 1][2]));
      let j = 1;
      const count = Math.floor(ds.at(-1) / 0.53);
      for (let i = 0; i < count; i++) {
        const d = (i * ds.at(-1)) / count;
        while (ds[j] < d) j++;
        const a = ((j - 1) * TAU) / n;
        if (Math.abs((a / TAU) * 48 - Math.round((a / TAU) * 48)) < 0.07) continue;
        const p = mix(ps[j - 1], ps[j], (d - ds[j - 1]) / (ds[j] - ds[j - 1])),
          choice = (i * 7 + row * 11 + Math.floor(i / 8) * 9) % 17,
          col =
            choice < 3 ? [0.54, 0.52, 0.44] : choice < 9 ? [0.81, 0.77, 0.65] : [0.93, 0.89, 0.75];
        chair(out, Math.atan2(-(ps[j][2] - ps[j - 1][2]), ps[j][0] - ps[j - 1][0]), p, col);
      }
    }
    rail(out, (a) => rounded(a, t.hx - 0.3, t.hz - 0.3, t.r, t.y));
    for (let i = 0; i < 48; i++) {
      const a = ((i + 0.5) * TAU) / 48,
        row = ti === 0 ? 18 : 10,
        p = rounded(
          a,
          t.hx + row * t.run,
          t.hz + row * t.run,
          t.r + row * t.run * 0.68,
          t.y + row * t.rise,
        ),
        o = transformed(out, a, p);
      box(o, 'metal', [-1.6, 0, -0.12], [1.6, 2.8, 2.8], concrete);
      box(o, 'glass', [-1.3, 0.05, -0.17], [1.3, 2.45, -0.14], dark);
      for (const x of [-1.42, 1.42])
        beam(o, 'metal', [x, 0, -0.2], [x, 2.63, -0.2], 0.13, 0.18, pale);
    }
  }
  for (const t of [
    { hx: 68.2, hz: 90.2, r: 37, y: 9.1, h: 3.2 },
    { hx: 90, hz: 112, r: 59, y: 24, h: 3.6 },
  ])
    for (let i = 0; i < 384; i++) {
      const a = (i * TAU) / 384,
        b = ((i + 1) * TAU) / 384,
        p = (a, y) => rounded(a, t.hx, t.hz, t.r, y);
      face(out, 'glass', [p(a, t.y), p(b, t.y), p(b, t.y + t.h), p(a, t.y + t.h)], glazing, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
      if (i % 2 === 0) beam(out, 'metal', p(a, t.y), p(a, t.y + t.h), 0.08, 0.09, steel);
      face(
        out,
        'metal',
        [
          p(a, t.y + t.h + 0.1),
          p(b, t.y + t.h + 0.1),
          p(b, t.y + t.h + 0.7),
          p(a, t.y + t.h + 0.7),
        ],
        dark,
        [-Math.sin(a), 0, -Math.cos(a)],
      );
    }
  // Continuous back enclosure follows the sloping stand, beneath the independent vessel.
  for (let i = 0; i < 384; i++) {
    const a = (i * TAU) / 384,
      b = ((i + 1) * TAU) / 384,
      p = (a, y) => rounded(a, 120.5, 142.5, 83, y);
    face(out, 'concrete', [p(a, 49), p(b, 49), p(b, 52), p(a, 52)], pale, [
      -Math.sin(a),
      0,
      -Math.cos(a),
    ]);
  }
}
function podium(out) {
  // Ground contact is the public entrance podium; shallow outer steps meet surrounding paving.
  ringSlab(out, radial, 132, 161, 0, 0.35, pale, 512);
  // The close podium is an outer annulus, leaving the depressed seating bowl open.
  for (let i = 0; i < 20; i++)
    ringSlab(out, radial, 160 + i * 0.52, 160 + (i + 1) * 0.52, -i * 0.11, 0.12, pale, 384);
  for (let i = 0; i < 48; i++) {
    const a = ((i + 0.5) * TAU) / 48,
      p = radial(a, 159, 0),
      o = transformed(out, a, p);
    beam(o, 'metal', [0, 0, 0], [0, 13, 0], 0.18, 0.2, steel);
    box(o, 'metal', [-0.85, 12.6, -0.24], [0.85, 13.1, 0.24], steel);
  }
}
export function buildLusail(target) {
  const out = transformed(target, 0, [0, 2.2, 0]);
  bowl(out);
  vessel(out);
  roof(out);
  podium(out);
}
export const lusailStudy = {
  id: 'N0691',
  key: 'lusail_stadium',
  wikidataId: 'Q1186333',
  title: 'Lusail Stadium',
  build: buildLusail,
  metricTriangleUv: true,
  previewGroundless: true,
  size: [344, 81, 344],
  smoothNormalSlots: ['trim'],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped playing-field center, +Z north-northwest. Y0 is the surrounding plaza at the lowest outer step; the public entrance podium is +2.2m and the visible football field is recessed beneath it.',
  },
  previewCamera: { position: [252, 158, 262], lookAt: [0, 30, 0] },
  visualBrief:
    'A burnished golden saddle-rimmed vessel with genuinely pierced, folded triangular metal fields,24 plinths and48 curved V-frame legs. Its white diamond membrane spans a double-layer cable net and two oculus tension rings. Sand-colored three-tier seating, hospitality bands, screens, roof lights, louvered GFRC base and a stepped circular podium retain the current completed exterior.',
  sourceFacts: {
    published:
      'Foster and ALUTEC give the307m roof diameter. ALUTEC records about4200 triangular cladding assemblies; their smaller perforated fields are individually modeled. The ASCE project team describes24 plinths,48 V-frame pieces, the independent vessel and two inner tension rings. BRIGC’s project case reports a312m outer envelope and74m/58m high/low rim.',
    reconstructed:
      'Three-tier profiles, field-to-podium level, member sections and panel subdivision are reconstructed from AFL and fabricator photographs and the FHECOR section. The2016 tender section supplies topology only; completed photographs control the visible finish. OSM’s276m stadium trace is a ground/body reference, not a roof dimension, and is not used to shrink the published307m roof.',
  },
  referencePages: [
    'https://www.afl-architects.com/projects/lusail-stadium',
    'https://www.alutec.com/projects/lusail-stadium',
    'https://www.fosterandpartners.com/projects/lusail-stadium',
    'https://www.fhecor.com/multimedia/proyectos/file/000000005000/Estadio%20Lusail%20(Doha)_5712.pdf',
    'https://www.asce.org/publications-and-news/civil-engineering-source/civil-engineering-magazine/issues/magazine-issue/article/2023/11/world-cup-qatar-stadiums-inspired-by-middle-east-aesthetic',
    'https://en.brigc.net/Reports/research_subject/202011/P020201129780236943177.pdf',
    'https://www.openstreetmap.org/way/1006062424',
    'https://www.openstreetmap.org/way/684020896',
  ],
  referenceRights:
    'Original authored geometry and shared procedural surfaces. Reference photographs, renderings and engineering illustrations are evidence only; no source pixels or third-party model are embedded. Geographic coordinates derive from OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: [51.490348974999996, 25.420796],
    heading: -2.942382267989901,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the surrounding plaza at the bottom of the shallow outer steps. The entrance podium is +2.2m and the native field -1.8m; this relative level is a photographic reconstruction. The final step slab straddles Y0 by one centimetre to close the ground contact.',
    source: 'https://www.openstreetmap.org/way/1006062424',
    featureIds: ['way/684020896', 'way/1006062424'],
    groundCutout: {
      outline: Array.from({ length: 128 }, (_, i) => {
        const p = radial((i * TAU) / 128, 170, 0);
        return [p[0], p[2]];
      }),
      basis:
        'Enclosed football bowl and stepped close podium require a terrain cutout; the outer step lip covers its boundary.',
    },
    notes:
      'The mapped pitch-surround rectangle directs +Z north-northwest; its132x99m map extent is not interpreted as the105x68m playing field. The saddle high points are along the east/west sides. The roof intentionally overhangs the smaller cached stadium trace; authoritative architect dimensions govern its diameter.',
  },
  limitations: [
    'Detailed completed exterior and visible bowl in Molen’s shared material style. Exact chair inventory, facade assembly subdivisions, concourse levels and roof cable pre-camber remain photographic reconstructions. The surrounding urban precinct and temporary event structures are excluded. The model depicts the full football configuration shown in completed reference photographs.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-golden-apertures', position: [164, 27, 30], lookAt: [150, 28, 25] },
    { name: 'near-base-gates', position: [154, 5, 24], lookAt: [133, 4.7, 17] },
    { name: 'near-curved-v-frame', position: [145, 45, 0], lookAt: [150, 51, 12] },
    { name: 'near-roof-diamonds', position: [85, 98, 45], lookAt: [90, 68, 46] },
    { name: 'near-double-cables', position: [37, 26, 19], lookAt: [78, 60, 24] },
    { name: 'near-sand-seating', position: [-18, 1, 5], lookAt: [92, 23, 0] },
    { name: 'near-hospitality', position: [40, 5, 0], lookAt: [71, 13, 0] },
    { name: 'near-oculus-screen', position: [0, 19, 12], lookAt: [0, 54, 77] },
    { name: 'near-podium', position: [181, 8, 30], lookAt: [151, 1, 22] },
    { name: 'far-saddle', position: [233, 195, 225], lookAt: [0, 25, 0] },
  ],
};
