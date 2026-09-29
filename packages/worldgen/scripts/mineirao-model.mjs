/** Mineirão: mapped heritage oval,88 concrete porticos and the completed2012 roof extension. */
import earcut from 'earcut';
import { beam, loft } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { mineiraoPlan } from './mineirao-plan.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  fieldY = -8.8;
const concrete = [0.59, 0.57, 0.51],
  pale = [0.79, 0.78, 0.72],
  steel = [0.39, 0.44, 0.44],
  white = [0.92, 0.93, 0.87],
  dark = [0.038, 0.045, 0.05],
  glass = [0.14, 0.22, 0.25];
const sectors = [
  [0.42, 0.08, 0.51],
  [0.81, 0.025, 0.08],
  [0.98, 0.36, 0.045],
  [0.96, 0.65, 0.035],
];
function ray(poly, a) {
  const d = [Math.sin(a), Math.cos(a)],
    hits = [];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hits.push(t);
  }
  if (!hits.length) throw Error(`Mineirao outline misses ray ${a}`);
  return Math.max(...hits);
}
const outer = (a) => ray(mineiraoPlan.outer, a),
  inner = (a) => ray(mineiraoPlan.inner, a);
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
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
function slab(out, inside, outside, y, thick = 0.25, color = concrete, n = 352) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      ps = [inside(a, y), inside(b, y), outside(b, y), outside(a, y)],
      bs = ps.map((p) => [p[0], y - thick, p[2]]);
    face(out, 'concrete', ps, color, [0, 1, 0]);
    face(out, 'concrete', bs, color, [0, -1, 0]);
    for (const k of [0, 2]) {
      const j = (k + 1) % 4;
      face(out, 'concrete', [bs[k], bs[j], ps[j], ps[k]], color, [
        ps[j][2] - ps[k][2],
        0,
        ps[k][0] - ps[j][0],
      ]);
    }
  }
}
function ringRail(out, fn, n = 176) {
  const ps = Array.from({ length: n + 1 }, (_, i) => fn((i * TAU) / n));
  for (const h of [0.52, 1.05])
    curve(
      out,
      ps.map((p) => [p[0], p[1] + h, p[2]]),
      0.025,
      steel,
    );
  for (const p of ps.slice(0, -1))
    beam(out, 'metal', p, [p[0], p[1] + 1.05, p[2]], 0.038, 0.045, steel);
}
function roofPoint(a, t) {
  const r = inner(a) + (outer(a) - inner(a)) * t;
  return radial(a, r, 21.1 - 5.75 * t);
}
function prism(out, profile, width, color = concrete) {
  // Convex profile is in local Y/Z; rings look along+X.
  loft(
    out,
    'concrete',
    [-width / 2, width / 2].map((x) => profile.map(([z, y]) => [x, y, z])),
    color,
  );
}
function heritageFrame(out) {
  for (let i = 0; i < 88; i++) {
    const a = (i * TAU) / 88,
      R = outer(a),
      o = transformed(out, a),
      tip = R - 2;
    // Four-corner inclined blades and their deep roof shoulders preserve the original concrete section.
    prism(
      o,
      [
        [R - 7, 0],
        [R - 5, 0],
        [R, 18.25],
        [R - 1.3, 18.2],
      ],
      0.82,
    );
    prism(
      o,
      [
        [R - 31, 17.7],
        [tip, 14.75],
        [R, 18.25],
        [R - 31, 20.1],
      ],
      0.82,
    );
    // New steel anchors bolt into the retained concrete shoulders.
    box(o, 'metal', [-0.62, 15.25, R - 9.6], [0.62, 16.55, R - 8.8], steel);
    for (const x of [-0.46, 0.46])
      for (const y of [15.45, 16.3])
        box(o, 'metal', [x - 0.075, y - 0.075, R - 8.77], [x + 0.075, y + 0.075, R - 8.7], dark);
    for (const y of [0.5, 4.1, 7.7]) {
      box(o, 'concrete', [-0.6, y, R - 14], [0.6, y + 0.45, R - 5.4], concrete);
      beam(o, 'concrete', [0, y, R - 16], [0, y + 2.4, R - 22], 0.65, 0.7, concrete);
    }
  }
  for (let i = 0; i < 528; i++) {
    const a = (i * TAU) / 528,
      b = ((i + 1) * TAU) / 528;
    // Cast exterior spandrel panels above three visibly open circulation galleries.
    for (const [y0, y1, dr] of [
      [0.15, 1.25, 5.4],
      [4.1, 5.25, 4.3],
      [7.7, 8.8, 3.3],
      [10.4, 15.35, 2.1],
    ])
      face(
        out,
        'concrete',
        [
          radial(a, outer(a) - dr, y0),
          radial(b, outer(b) - dr, y0),
          radial(b, outer(b) - dr, y1),
          radial(a, outer(a) - dr, y1),
        ],
        concrete,
        [Math.sin(a), 0, Math.cos(a)],
      );
    face(
      out,
      'concrete',
      [
        radial(a, outer(a) - 14, 0),
        radial(b, outer(b) - 14, 0),
        radial(b, outer(b) - 14, 10.4),
        radial(a, outer(a) - 14, 10.4),
      ],
      pale,
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
  for (const y of [0, 4.1, 7.7]) {
    slab(
      out,
      (a, y) => radial(a, outer(a) - 19, y),
      (a, y) => radial(a, outer(a) - 5.3, y),
      y,
      0.26,
    );
    ringRail(out, (a) => radial(a, outer(a) - 5.7, y));
  }
  // Fine board-form joints and small tie holes are geometric, preserving the concrete texture scale.
  for (let i = 0; i < 88; i++) {
    const a = ((i + 0.5) * TAU) / 88,
      o = transformed(out, a, radial(a, outer(a) - 2.04, 0));
    for (const y of [10.8, 12.3, 13.8, 15.1])
      box(o, 'metal', [-1.7, y, -0.018], [1.7, y + 0.016, 0.01], [0.42, 0.41, 0.37]);
    for (const x of [-1.55, 1.55])
      for (const y of [11.2, 13.4, 14.9])
        box(o, 'glass', [x - 0.035, y - 0.026, 0.02], [x + 0.035, y + 0.026, 0.027], dark);
    const rear = transformed(out, a, radial(a, outer(a) - 13.9, 0));
    for (const y of [0, 4.1, 7.7]) {
      box(rear, 'glass', [-0.65, y + 0.05, 0], [0.65, y + 2.25, 0.035], dark);
      box(rear, 'metal', [1.35, y + 0.25, 0], [2.8, y + 1.05, 0.04], sectors[Math.floor(i / 22)]);
    }
  }
}
function roof(out) {
  // Existing roof slab and the26m membrane extension have different material and construction systems.
  for (let i = 0; i < 704; i++)
    for (let j = 0; j < 16; j++) {
      const a = (i * TAU) / 704,
        b = ((i + 1) * TAU) / 704,
        t = j / 16,
        u = (j + 1) / 16,
        mid = (a + b) / 2;
      const isMembrane = (t + u) / 2 < 26 / (outer(mid) - inner(mid));
      const fn = (a, t) => {
        const p = roofPoint(a, t);
        if (isMembrane) p[1] -= 0.13 * Math.sin(a * 44) ** 2 * Math.sin(t * Math.PI);
        return p;
      };
      const ps = [fn(a, t), fn(b, t), fn(b, u), fn(a, u)],
        slot = isMembrane ? 'membrane' : 'concrete',
        color = isMembrane ? white : concrete;
      face(out, slot, ps, color, [0, 1, 0]);
      face(
        out,
        slot,
        ps.map((p) => [p[0], p[1] - 0.17, p[2]]),
        color,
        [0, -1, 0],
      );
    }
  for (let i = 0; i < 88; i++) {
    const a = (i * TAU) / 88,
      top = Array.from({ length: 15 }, (_, j) => {
        const p = roofPoint(a, j / 14);
        return [p[0], p[1] - 0.28, p[2]];
      }),
      bottom = top.map((p, j) => [p[0], p[1] - 1.7 - 0.3 * Math.sin((j * Math.PI) / 14), p[2]]);
    curve(out, top, 0.14, steel, 'metal', 12);
    curve(out, bottom, 0.14, steel, 'metal', 12);
    for (let j = 0; j < 14; j++)
      tube(
        out,
        'metal',
        j % 2 ? bottom[j] : top[j],
        j % 2 ? top[j + 1] : bottom[j + 1],
        0.075,
        steel,
        8,
      );
    // Reinforcement stays between existing portico and roof root.
    for (const off of [-0.6, 0.6]) {
      const p = roofPoint(a, 0.85);
      tube(
        out,
        'metal',
        [p[0] + Math.cos(a) * off, 13.5, p[2] - Math.sin(a) * off],
        top[12],
        0.045,
        steel,
        8,
      );
    }
    const p = roofPoint(a, 0.025),
      o = transformed(out, a, [p[0], p[1] - 0.6, p[2]]);
    box(o, 'metal', [-0.8, -0.3, -0.3], [0.8, 0.3, 0.3], dark);
    for (const x of [-0.52, 0, 0.52])
      box(o, 'plastic', [x - 0.2, -0.2, -0.33], [x + 0.2, 0.18, -0.31], white);
  }
  for (const t of [0, 0.18, 0.37, 0.56, 0.77, 0.97])
    curve(
      out,
      Array.from({ length: 353 }, (_, i) => {
        const p = roofPoint((i * TAU) / 352, t);
        return [p[0], p[1] - 0.4, p[2]];
      }),
      t === 0 ? 0.15 : 0.085,
      steel,
    );
  //5910 photovoltaic modules follow the88 roof bays. Exact string wiring is outside this exterior mesh.
  for (let bay = 0; bay < 88; bay++) {
    const count = bay < 14 ? 68 : 67;
    for (let index = 0; index < count; index++) {
      const row = Math.floor(index / 3),
        col = index % 3,
        a0 = ((bay + 0.105 + col * 0.265) * TAU) / 88,
        a1 = ((bay + 0.34 + col * 0.265) * TAU) / 88;
      const pp = (a, v) => {
        const R = outer(a),
          r = R - 3.3 - row * 1.14 - v * 1.06,
          t = (r - inner(a)) / (R - inner(a)),
          p = roofPoint(a, t);
        p[1] += 0.16;
        return p;
      };
      const q = [pp(a0, 0), pp(a1, 0), pp(a1, 1), pp(a0, 1)];
      face(out, 'glass', q, [0.035, 0.072, 0.17], [0, 1, 0]);
      const strip = (a, b, w) => {
        const dx = b[0] - a[0],
          dz = b[2] - a[2],
          L = Math.hypot(dx, dz),
          nx = (-dz / L) * w,
          nz = (dx / L) * w;
        face(
          out,
          'metal',
          [
            [a[0] + nx, a[1] + 0.008, a[2] + nz],
            [b[0] + nx, b[1] + 0.008, b[2] + nz],
            [b[0] - nx, b[1] + 0.008, b[2] - nz],
            [a[0] - nx, a[1] + 0.008, a[2] - nz],
          ],
          pale,
          [0, 1, 0],
        );
      };
      for (let k = 0; k < 4; k++) strip(q[k], q[(k + 1) % 4], 0.018);
      for (let k = 1; k < 6; k++) {
        const a = a0 + ((a1 - a0) * k) / 6;
        strip(pp(a, 0), pp(a, 1), 0.006);
      }
      for (let k = 1; k < 10; k++) strip(pp(a0, k / 10), pp(a1, k / 10), 0.0045);
    }
  }
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, fieldY, 0]));
  const tiers = [
    { hx: 39, hz: 62, r: 17, y: fieldY + 0.25, rows: 27, run: 0.86, rise: 0.255 },
    { hx: 64, hz: 88, r: 43, y: 1.0, rows: 40, run: 0.84, rise: 0.3 },
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
            t.r + row * t.run * 0.64 + dr * 0.64,
            yy,
          ),
        ps = Array.from({ length: 705 }, (_, i) => fn((i * TAU) / 704));
      for (let i = 0; i < 704; i++) {
        const a = (i * TAU) / 704,
          b = ((i + 1) * TAU) / 704;
        face(out, 'concrete', [ps[i], ps[i + 1], fn(b, t.run), fn(a, t.run)], pale, [0, 1, 0]);
        face(
          out,
          'concrete',
          [fn(a, 0, y - t.rise), fn(b, 0, y - t.rise), ps[i + 1], ps[i]],
          pale,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
      const ds = [0];
      for (let i = 1; i < ps.length; i++)
        ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][2] - ps[i - 1][2]));
      let j = 1;
      const count = Math.floor(ds.at(-1) / 0.54);
      for (let i = 0; i < count; i++) {
        const d = (i * ds.at(-1)) / count;
        while (ds[j] < d) j++;
        const a = ((j - 1) * TAU) / 704;
        if (Math.abs((a / TAU) * 44 - Math.round((a / TAU) * 44)) < 0.055) continue;
        const f = (d - ds[j - 1]) / (ds[j] - ds[j - 1]),
          p = ps[j - 1].map((v, k) => v + (ps[j][k] - v) * f),
          choice = (i * 17 + row * 31 + Math.floor(i / 7) * 13) % 11,
          col =
            choice < 3 ? [0.29, 0.32, 0.32] : choice < 7 ? [0.65, 0.66, 0.62] : [0.89, 0.9, 0.84];
        chair(out, Math.atan2(-(ps[j][2] - ps[j - 1][2]), ps[j][0] - ps[j - 1][0]), p, col);
      }
    }
    ringRail(out, (a) => rounded(a, t.hx - 0.4, t.hz - 0.4, t.r, t.y), 176);
  }
  // Hospitality glazing and circulation band between retained upper and reconstructed lower decks.
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352,
      p = (a, y) => rounded(a, 63, 86, 32, y);
    face(out, 'glass', [p(a, -1.7), p(b, -1.7), p(b, 0.85), p(a, 0.85)], glass, [
      -Math.sin(a),
      0,
      -Math.cos(a),
    ]);
    if (i % 2 === 0) beam(out, 'metal', p(a, -1.7), p(a, 0.85), 0.075, 0.08, pale);
  }
  for (const y of [-1.7, 0.85])
    slab(
      out,
      (a, y) => rounded(a, 61.8, 85, 32, y),
      (a, y) => rounded(a, 65, 89, 34, y),
      y,
      0.24,
      pale,
    );
  // Recessed access portals carry the four permanent color families used in the rebuilt bowl.
  for (let i = 0; i < 44; i++)
    for (const [tier, row] of [
      [0, 14],
      [1, 20],
    ]) {
      const a = ((i + 0.5) * TAU) / 44,
        t = tiers[tier],
        p = rounded(
          a,
          t.hx + row * t.run,
          t.hz + row * t.run,
          t.r + row * t.run * 0.64,
          t.y + row * t.rise,
        ),
        o = transformed(out, a, p),
        col = sectors[Math.floor(i / 11)];
      box(o, 'glass', [-1.25, 0, -0.16], [1.25, 2.2, 0.1], dark);
      for (const x of [-1.43, 1.43])
        box(o, 'metal', [x - 0.13, 0, -0.2], [x + 0.13, 2.3, 0.25], col);
      box(o, 'metal', [-1.55, 2.2, -0.2], [1.55, 2.45, 0.25], col);
    }
  slab(
    out,
    (a, y) => rounded(a, 34.6, 53.1, 0.2, y),
    (a, y) => rounded(a, 39, 62, 17, y),
    fieldY + 0.02,
    0.25,
    [0.35, 0.36, 0.32],
  );
  box(out, 'concrete', [-39, fieldY - 0.3, -62], [39, fieldY - 0.1, 62], concrete);
  for (const side of [-1, 1]) {
    const o = transformed(out, side < 0 ? 0 : Math.PI, [0, 0, side * 96]);
    box(o, 'metal', [-6.5, 11.1, -0.5], [6.5, 19.1, 0.2], steel);
    box(o, 'glass', [-6.25, 11.35, 0.21], [6.25, 18.85, 0.25], [0.025, 0.032, 0.04]);
    for (const x of [-5.5, 5.5]) beam(o, 'metal', [x, 19.1, 0], [x, 20.3, 0], 0.18, 0.22, steel);
  }
}
function surroundings(out) {
  // Triangulate the apron with actual rectangular stair wells, keeping descending flights visible.
  const rings = [15, -5.5].map((dr) =>
    Array.from({ length: 352 }, (_, i) => {
      const a = (i * TAU) / 352,
        p = radial(a, outer(a) + dr, 0);
      return [p[0], p[2]];
    }),
  );
  for (let i = 0; i < 18; i++) {
    const a = ((i + 0.22) * TAU) / 18,
      p = radial(a, outer(a) + 5.4, 0);
    rings.push(
      [
        [-2.96, -3.5],
        [2.96, -3.5],
        [2.96, 3.55],
        [-2.96, 3.55],
      ].map(([x, z]) => [
        p[0] + x * Math.cos(a) + z * Math.sin(a),
        p[2] - x * Math.sin(a) + z * Math.cos(a),
      ]),
    );
  }
  const holes = [];
  let count = 0;
  for (const ring of rings) {
    if (count) holes.push(count);
    count += ring.length;
  }
  const ps = rings.flat(),
    indices = earcut(ps.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((k) => [ps[k][0], 0, ps[k][1]]),
      a = points[0],
      b = points[1],
      c = points[2];
    if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) < 0) points.reverse();
    out.addTriangle(
      'concrete',
      'metric:uv',
      points,
      [0, 1, 0],
      points.map((p) => [p[0], p[2]]),
      pale,
    );
  }
  for (const [index, ring] of rings.entries())
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length],
        depth = index > 1 ? -2.7 : -0.24,
        n = [q[1] - p[1], 0, p[0] - q[0]];
      face(
        out,
        'concrete',
        [
          [p[0], depth, p[1]],
          [q[0], depth, q[1]],
          [q[0], 0, q[1]],
          [p[0], 0, p[1]],
        ],
        pale,
        n,
      );
      if (index > 1)
        face(
          out,
          'concrete',
          [
            [p[0], depth, p[1]],
            [q[0], depth, q[1]],
            [q[0], 0, q[1]],
            [p[0], 0, p[1]],
          ],
          pale,
          n.map((v) => -v),
        );
    }
  ringRail(out, (a) => radial(a, outer(a) + 14.4, 0));
  // Low glazed and steel-screened descent pavilions punctuate the immediate ring esplanade.
  for (let i = 0; i < 18; i++) {
    const a = ((i + 0.22) * TAU) / 18,
      p = radial(a, outer(a) + 5.4, 0),
      o = transformed(out, a, p),
      col = sectors[Math.floor(i / 4.5)];
    for (const x of [-3.08, 3.08])
      box(o, 'concrete', [x - 0.12, -0.2, -3.8], [x + 0.12, 0.14, 3.8], pale);
    box(o, 'concrete', [-2.96, -2.85, -3.5], [2.96, -2.65, 3.55], concrete);
    box(o, 'metal', [-3.3, 2.9, -3.9], [3.3, 3.12, 3.9], steel);
    for (const x of [-3.1, 3.1]) {
      box(o, 'glass', [x - 0.045, 0.15, -3.7], [x + 0.045, 2.9, 3.7], glass);
      for (let z = -3.6; z <= 3.6; z += 1.2)
        box(o, 'metal', [x - 0.045, 0.12, z - 0.04], [x + 0.045, 2.95, z + 0.04], pale);
    }
    for (const z of [-3.7, 3.7])
      for (const x of [-3, 3])
        box(o, 'metal', [x - 0.06, 0.12, z - 0.06], [x + 0.06, 2.95, z + 0.06], steel);
    box(o, 'metal', [-2.9, -2.7, -3.68], [2.9, 1.8, -3.6], col);
    for (let j = 0; j < 15; j++) {
      const z = 3.5 - j * 0.4,
        y = -j * 0.17;
      box(o, 'concrete', [-2.7, y - 0.2, z - 0.4], [2.7, y, z], pale);
    }
    for (const x of [-2.8, 0, 2.8])
      tube(o, 'metal', [x, 1.1, 3.5], [x, -1.3, -2.5], 0.035, steel, 8);
  }
  for (let i = 0; i < 22; i++) {
    const a = ((i + 0.5) * TAU) / 22,
      p = radial(a, outer(a) + 12, 0),
      o = transformed(out, a, p);
    box(o, 'concrete', [-0.28, 0, -0.28], [0.28, 0.45, 0.28], concrete);
    beam(o, 'metal', [0, 0.4, 0], [0, 10.5, 0], 0.19, 0.22, pale);
    for (const x of [-0.35, 0.35])
      box(o, 'metal', [x - 0.15, 10.15, -0.2], [x + 0.15, 10.65, 0.2], steel);
  }
}
export function buildMineirao(out) {
  bowl(out);
  heritageFrame(out);
  roof(out);
  surroundings(out);
}
export const mineiraoStudy = {
  id: 'N0690',
  key: 'mineirao',
  wikidataId: 'Q910370',
  title: 'Mineirão',
  build: buildMineirao,
  metricTriangleUv: true,
  previewGroundless: true,
  size: [255, 32, 310],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped playing-field center; +Z points north-northeast. Y0 is the immediate ring esplanade; the depressed playing field and lower galleries lie below it.',
  },
  previewCamera: { position: [210, 147, 239], lookAt: [0, 5, 0] },
  visualBrief:
    'The preserved1965 oval is defined by88 inclined concrete porticos and open three-level circulation galleries, topped by the white2012 inward canopy and a5910-module photovoltaic ring. Two gray-mottled seating tiers, colored access portals, glazed hospitality band, opposing video screens, roof trusses, esplanade descent pavilions and light standards complete the visible stadium envelope.',
  sourceFacts: {
    published:
      'BCMF records88 retained concrete porticos, a26m cantilever extension and3.4m lowering from the historic field. The operator gives current105x68m pitch dimensions. Cemig lists5910 photovoltaic units and88 inverters. Birdair identifies the PTFE-coated fiberglass membrane.',
    scaled:
      'Other vertical proportions derive from the architect’s25m-scale longitudinal section: the field lies about8.8m below the ring esplanade, and the canopy rises about21m above it. Member sections and module arrangement are photographic reconstructions; the5910 count is exact, wiring layout is not copied.',
    map: 'OSM way178504792 supplies the heritage exterior; way285468645 supplies its roof aperture. The historic pitch trace supplies direction only: its112x65m size is superseded by the operator’s current105x68m field.',
  },
  referencePages: [
    'https://bcmfarquitetos.com/en/projects/novo-mineirao',
    'https://bcmfarquitetos.com/images/uploads/posts/desktop/8a_1762536393.jpg',
    'https://bcmfarquitetos.com/images/uploads/posts/desktop/10-edit_1770916879.jpg',
    'https://mineirao.com.br/estrutura',
    'https://www.cemig.com.br/usinas/ufv-mineirao/',
    'https://www.birdair.com/historic-estadio-mineirao-receives-a-modern-transformation-with-birdair-roof/',
    'https://www.openstreetmap.org/way/178504792',
    'https://www.openstreetmap.org/way/285468645',
    'https://www.openstreetmap.org/way/8601181',
  ],
  referenceRights:
    'Original authored geometry. Architect/operator photographs and drawings were used only as visual and dimensional evidence; no source pixels or downloaded model are embedded. Projected OpenStreetMap coordinates retain contributor attribution and ODbL1.0.',
  portableReviewBasis:
    'Ground-free asset review preserves the intentional depressed bowl. The geographic renderer cuts terrain within the enclosed apron.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: mineiraoPlan.anchor,
    heading: mineiraoPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the ring esplanade at the heritage column feet. The native−8.8m field derives from the published scaled section; it is intentional below-contact geometry.',
    source: 'https://www.openstreetmap.org/way/178504792',
    featureIds: ['way/178504792', 'way/285468645', 'way/8601181'],
    groundCutout: {
      outline: Array.from({ length: 176 }, (_, i) => {
        const a = (i * TAU) / 176,
          p = radial(a, outer(a) + 14, 0);
        return [p[0], p[2]];
      }),
      basis:
        'The stadium and close apron contain the depressed bowl and descent pavilions. The apron lip closes the cut edge.',
    },
    notes:
      'The exact identified heritage ellipse and mapped roof aperture retain their actual slight asymmetry. The playing-field long edge directs+Z north-northeast. Current105x68m lines replace the oversized historic map trace. Outer urban parking terraces and neighboring Mineirinho are separate sites and are excluded.',
  },
  limitations: [
    'Detailed completed exterior and visible open bowl in Molen’s shared material style. Vertical levels are scaled from the architect’s published longitudinal section, not a survey. Individual seat inventory, portal allocation, member diameters and solar string arrangement are reconstructed from reference photographs. The large surrounding urban plaza, parking terraces, neighboring Mineirinho and enclosed service interiors are outside this stadium envelope.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-concrete-porticos', position: [144, 13, 24], lookAt: [99, 9, 20] },
    { name: 'near-galleries', position: [125, 4, -14], lookAt: [98, 4, -10] },
    { name: 'near-solar-modules', position: [96, 33, 48], lookAt: [82, 19, 40] },
    { name: 'near-canopy-trusses', position: [58, 9, 11], lookAt: [74, 18, 20] },
    { name: 'near-gray-bowl', position: [-18, -3, 2], lookAt: [78, 5, 0] },
    { name: 'near-hospitality', position: [35, -4, 3], lookAt: [63, 0, 1] },
    { name: 'near-goal-screen', position: [0, -2, 52], lookAt: [0, 13, 96] },
    { name: 'near-esplanade-entry', position: [125, 4, 12], lookAt: [114, -0.9, 9] },
    { name: 'far-solar-ring', position: [208, 167, 236], lookAt: [0, 4, 0] },
  ],
};
