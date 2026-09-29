/** Arena AufSchalke: published roof span, open sliding panels, mapped curtain facade and pitch exit. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { schalkePlan } from './schalke-plan.mjs';
import { letterAt, lettering } from './stadium-lettering.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  steel = [0.64, 0.68, 0.63],
  concrete = [0.58, 0.59, 0.56],
  white = [0.9, 0.91, 0.87],
  blue = [0.025, 0.16, 0.46],
  glass = [0.22, 0.3, 0.34],
  dark = [0.035, 0.05, 0.055];
const fieldY = -10.7;
function outline(a, hx = 93, hz = 113, corner = 30, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  const r = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9), (hx + hz - corner) / (dx + dz));
  return [r * Math.sin(a), y, r * Math.cos(a)];
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
  return [t * Math.sin(a), y, t * Math.cos(a)];
}
function slab(
  out,
  inside,
  outside,
  y,
  thickness = 0.28,
  slot = 'concrete',
  color = concrete,
  n = 360,
) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      top = [inside(a, y), inside(b, y), outside(b, y), outside(a, y)],
      bot = top.map((p) => [p[0], y - thickness, p[2]]);
    face(out, slot, top, color, [0, 1, 0]);
    face(out, slot, bot, color, [0, -1, 0]);
    for (const k of [0, 2]) {
      const j = (k + 1) % 4,
        dx = top[j][0] - top[k][0],
        dz = top[j][2] - top[k][2];
      face(out, slot, [bot[k], bot[j], top[j], top[k]], color, [dz, 0, -dx]);
    }
  }
}
function rail(out, fn, n = 144) {
  const ps = Array.from({ length: n + 1 }, (_, i) => fn((i * TAU) / n));
  curve(
    out,
    ps.map((p) => [p[0], p[1] + 1.05, p[2]]),
    0.028,
    steel,
  );
  for (const p of ps.slice(0, -1))
    beam(out, 'metal', p, [p[0], p[1] + 1.05, p[2]], 0.035, 0.035, steel);
}
function roofPoint(a, t) {
  const inner = outline(a, 34, 59, 0),
    outer = outline(a);
  return [
    inner[0] + (outer[0] - inner[0]) * t,
    42.8 - 15.3 * t + 0.3 * Math.sin(t * Math.PI) * Math.sin(a * 12) ** 2,
    inner[2] + (outer[2] - inner[2]) * t,
  ];
}
function roof(out) {
  for (let i = 0; i < 480; i++)
    for (let j = 0; j < 12; j++) {
      const a = (i * TAU) / 480,
        b = ((i + 1) * TAU) / 480,
        t = j / 12,
        u = (j + 1) / 12,
        ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      face(out, 'membrane', ps, white, [0, 1, 0]);
      face(
        out,
        'membrane',
        ps.map((p) => [p[0], p[1] - 0.12, p[2]]),
        white,
        [0, -1, 0],
      );
    }
  // Twenty-four perimeter support stations and variable-depth circular-tube space trusses.
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24,
      p = roofPoint(a, 1),
      foot = [p[0] * 0.967, 0, p[2] * 0.967];
    tube(out, 'metal', foot, [p[0], 25.5, p[2]], 0.36, steel, 16);
    box(transformed(out, a, foot), 'concrete', [-0.9, 0, -0.9], [0.9, 0.5, 0.9], concrete);
    for (const side of [-1, 1]) {
      const pts = Array.from({ length: 13 }, (_, k) => {
        const q = roofPoint(a, k / 12);
        return [q[0] + side * Math.cos(a) * 1.65, q[1] - 0.3, q[2] - side * Math.sin(a) * 1.65];
      });
      curve(out, pts, 0.27, steel, 'metal', 12);
      for (let j = 0; j < 12; j++) {
        const t = j / 12,
          u = (j + 1) / 12,
          q = roofPoint(a, t),
          r = roofPoint(a, u),
          low = [q[0], q[1] - 2 - 13 * (1 - t), q[2]],
          nextLow = [r[0], r[1] - 2 - 13 * (1 - u), r[2]];
        if (side === 1) tube(out, 'metal', low, nextLow, 0.32, steel, 12);
        tube(out, 'metal', pts[j], j % 2 ? nextLow : low, 0.13, steel, 10);
        tube(out, 'metal', pts[j + 1], j % 2 ? nextLow : low, 0.13, steel, 10);
      }
    }
  }
  // Rectangular crown truss and its maintenance catwalk frame the clear roof opening.
  for (let side = 0; side < 4; side++) {
    const turn = side % 2 ? Math.PI / 2 : 0,
      sign = side < 2 ? 1 : -1,
      half = side % 2 ? 59 : 34,
      z = sign * (side % 2 ? 34 : 59),
      o = transformed(out, turn);
    for (const y of [28, 42.5])
      for (const zz of [z - 1.5, z + 1.5])
        tube(o, 'metal', [-half, y, zz], [half, y, zz], 0.34, steel, 14);
    const count = side % 2 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const x = -half + (2 * half * i) / count,
        xx = -half + (2 * half * (i + 1)) / count;
      for (const zz of [z - 1.5, z + 1.5]) {
        tube(o, 'metal', [x, 28, zz], [xx, 42.5, zz], 0.18, steel, 10);
        tube(o, 'metal', [x, 42.5, zz], [xx, 28, zz], 0.18, steel, 10);
      }
      box(o, 'metal', [x, 28.15, z - 1.3], [xx, 28.22, z + 1.3], steel);
      for (const zz of [z - 1.3, z + 1.3]) {
        tube(o, 'metal', [x, 29.25, zz], [xx, 29.25, zz], 0.026, steel, 8);
        tube(o, 'metal', [x, 28.2, zz], [x, 29.25, zz], 0.026, steel, 8);
      }
    }
  }
  // Two parked sliding halves. Six bays per half match the operator's twelve membrane fields.
  for (const sign of [-1, 1])
    for (let bay = 0; bay < 6; bay++) {
      const z0 = -59 + (bay * 118) / 6,
        z1 = z0 + 118 / 6;
      for (let i = 0; i < 20; i++)
        for (let j = 0; j < 12; j++) {
          const p = (u, v) => [
              sign * (34 + 34 * u),
              43 - 0.55 * u + 0.17 * Math.sin(v * Math.PI),
              z0 + (z1 - z0) * v,
            ],
            ps = [
              p(i / 20, j / 12),
              p((i + 1) / 20, j / 12),
              p((i + 1) / 20, (j + 1) / 12),
              p(i / 20, (j + 1) / 12),
            ];
          face(out, 'membrane', ps, white, [0, 1, 0]);
          face(
            out,
            'membrane',
            ps.map((v) => [v[0], v[1] - 0.14, v[2]]),
            white,
            [0, -1, 0],
          );
        }
      for (const z of [z0, z1]) {
        tube(out, 'metal', [sign * 34, 42.8, z], [sign * 68, 42.3, z], 0.17, steel, 12);
        for (let i = 0; i < 8; i++) {
          const x = sign * (34 + i * 4.25),
            xx = sign * (34 + (i + 1) * 4.25);
          tube(out, 'metal', [x, 41.15, z], [xx, 41.15, z], 0.12, steel, 10);
          tube(out, 'metal', [x, 41.15, z], [xx, 42.4, z], 0.075, steel, 8);
        }
      }
    }
  for (const z of [-60.8, 60.8]) {
    box(out, 'metal', [-70, 41.6, z - 0.18], [70, 41.85, z + 0.18], steel);
    for (const sign of [-1, 1])
      for (const x of [35, 44, 57, 67]) {
        box(out, 'metal', [sign * x - 0.4, 41.9, z - 0.5], [sign * x + 0.4, 42.35, z + 0.5], dark);
        // Trestles carry the level sliding track above the sloping fixed membrane.
        const a = Math.atan2(sign * x, z),
          lo = outline(a, 34, 59, 0),
          hi = outline(a),
          t = Math.hypot(sign * x - lo[0], z - lo[2]) / Math.hypot(hi[0] - lo[0], hi[2] - lo[2]),
          base = roofPoint(a, t);
        for (const dz of [-0.65, 0.65])
          beam(
            out,
            'metal',
            [base[0], base[1] - 0.1, base[2] + dz],
            [sign * x, 41.6, z + dz],
            0.15,
            0.15,
            steel,
          );
        beam(
          out,
          'metal',
          [base[0], base[1] - 0.1, base[2] - 0.65],
          [sign * x, 41.6, z + 0.65],
          0.1,
          0.1,
          steel,
        );
      }
  }
  // Four-screen 2016 cube, 10.6 x 7.2m per face, suspended above the center.
  box(out, 'metal', [-5.5, 15, -5.5], [5.5, 22.5, 5.5], dark);
  for (let i = 0; i < 4; i++) {
    const o = transformed(out, (i * Math.PI) / 2);
    box(o, 'glass', [-5.3, 15.1, 5.51], [5.3, 22.3, 5.53], [0.025, 0.04, 0.055]);
    for (const x of [-5.25, 5.25])
      tube(o, 'metal', [x, 22.5, 5.2], [x, 42.2, 5.2], 0.045, steel, 8);
  }
  for (let i = 0; i < 53; i++)
    for (let side = 0; side < 4; side++) {
      const a = ((i + 0.5) * TAU) / 53,
        p = roofPoint(a, 0.15 + side * 0.19),
        o = transformed(out, a, p);
      box(o, 'metal', [-0.38, -0.75, -0.15], [0.38, -0.3, 0.22], steel);
      box(o, 'plastic', [-0.31, -0.68, 0.225], [0.31, -0.37, 0.24], white);
    }
}
function bowl(out) {
  const pitched = transformed(out, 0, [0, fieldY, 0]);
  const clip = (p) => [
    Math.max(-39.5, Math.min(39.5, p[0])),
    p[1],
    Math.max(-59, Math.min(59, p[2])),
  ];
  soccerPitch({
    addQuad(s, r, p, n, u, c) {
      pitched.addQuad(s, r, s === 'turf' ? p.map(clip) : p, n, u, c);
    },
    addTriangle(...v) {
      pitched.addTriangle(...v);
    },
    addConvexPolygon(...v) {
      pitched.addConvexPolygon(...v);
    },
  });
  box(out, 'concrete', [-39.7, fieldY - 0.7, -59.2], [39.7, fieldY - 0.015, 59.2], concrete);
  for (const x of [-31, -20, -9, 9, 20, 31])
    box(out, 'metal', [x - 0.12, fieldY - 0.68, -59], [x + 0.12, fieldY - 0.62, 230], steel);
  const tiers = [
    { x: 44, z: 64, r: 10, y: -9.55, rows: 30, run: 0.78, rise: 0.36 },
    { x: 69, z: 88, r: 28, y: 7, rows: 33, run: 0.57, rise: 0.58 },
  ];
  for (let k = 0; k < tiers.length; k++) {
    const t = tiers[k];
    for (let row = 0; row < t.rows; row++) {
      const y = t.y + row * t.rise,
        p = (a, h) => rounded(a, t.x + row * t.run, t.z + row * t.run, t.r + row * t.run * 0.7, h),
        q = (a, h) =>
          rounded(
            a,
            t.x + (row + 1) * t.run,
            t.z + (row + 1) * t.run,
            t.r + (row + 1) * t.run * 0.7,
            h,
          );
      slab(out, p, q, y, t.rise);
      const ps = Array.from({ length: 721 }, (_, i) => p((i * TAU) / 720, y)),
        ds = [0];
      for (let i = 1; i < ps.length; i++)
        ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][2] - ps[i - 1][2]));
      const count = Math.floor(ds.at(-1) / 0.52);
      let j = 1;
      for (let i = 0; i < count; i++) {
        const d = (i / count) * ds.at(-1);
        while (ds[j] < d) j++;
        if (Math.abs((i / count) * 36 - Math.round((i / count) * 36)) < 0.055) continue;
        const f = (d - ds[j - 1]) / (ds[j] - ds[j - 1]),
          pos = ps[j - 1].map((v, k) => v + (ps[j][k] - v) * f);
        const seatColor =
          k === 0 &&
          pos[0] > 0 &&
          row >= 7 &&
          row <= 24 &&
          letterAt('FC SCHALKE 04', (pos[2] + 53) / 8.9, (row - 7) / 17)
            ? white
            : blue;
        chair(out, Math.atan2(-(ps[j][2] - ps[j - 1][2]), ps[j][0] - ps[j - 1][0]), pos, seatColor);
      }
    }
    rail(out, (a) => rounded(a, t.x, t.z, t.r, t.y));
    for (let i = 0; i < 28; i++) {
      const a = ((i + 0.5) * TAU) / 28,
        p = rounded(
          a,
          t.x + 14 * t.run,
          t.z + 14 * t.run,
          t.r + 14 * t.run * 0.7,
          t.y + 14 * t.rise,
        ),
        o = transformed(out, a, p);
      box(o, 'glass', [-1.35, 0, -0.18], [1.35, 1.85, 0.1], dark);
      box(o, 'concrete', [-1.45, 1.85, -0.2], [1.45, 2.08, 0.15], concrete);
    }
  }
  const lower = (a, h) => rounded(a, 67.4, 87.4, 26.38, h),
    upper = (a, h) => rounded(a, 69, 88, 28, h);
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      ps = [lower(a, 1.25), lower(b, 1.25), upper(b, 7), upper(a, 7)];
    face(out, 'glass', ps, glass, [-Math.sin(a), 0, -Math.cos(a)]);
    if (i % 3 === 0) beam(out, 'metal', lower(a, 1.2), upper(a, 7), 0.055, 0.055, steel);
  }
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = rounded(a, 44, 64, 10, fieldY - 0.8),
      q = rounded(b, 44, 64, 10, fieldY - 0.8);
    face(
      out,
      'concrete',
      [p, q, rounded(b, 44, 64, 10, -9.55), rounded(a, 44, 64, 10, -9.55)],
      concrete,
      [-Math.sin(a), 0, -Math.cos(a)],
    );
  }
  // Concrete event floor under the tray and the spectator moat.
  box(out, 'concrete', [-44, fieldY - 0.9, -64], [44, fieldY - 0.72, 64], concrete);
}
function outside(out) {
  // Permanent southern roof lettering is original beam geometry, with no font or image texture.
  lettering(out, 'VELTINS ARENA', {
    width: 53,
    height: 4,
    y: 29,
    z: 108,
    color: [0.13, 0.22, 0.31],
    stroke: 0.22,
  });
  for (let x = -25; x <= 25; x += 5)
    beam(out, 'metal', [x, 28, 108], [x, 30, 106], 0.13, 0.13, steel);
  const facade = (a, y) => outline(a, 91, 111, 29, y);
  // Almost fully glazed curtain wall, horizontal aluminum bands and dense slim mullions.
  for (let i = 0; i < 480; i++) {
    const a = (i * TAU) / 480,
      b = ((i + 1) * TAU) / 480;
    for (let level = 0; level < 5; level++) {
      const y = level * 5.35;
      face(
        out,
        'glass',
        [facade(a, y + 0.55), facade(b, y + 0.55), facade(b, y + 4.68), facade(a, y + 4.68)],
        glass,
        [Math.sin(a), 0, Math.cos(a)],
      );
      face(
        out,
        'metal',
        [facade(a, y), facade(b, y), facade(b, y + 0.55), facade(a, y + 0.55)],
        white,
        [Math.sin(a), 0, Math.cos(a)],
      );
      face(
        out,
        'metal',
        [facade(a, y + 4.68), facade(b, y + 4.68), facade(b, y + 5.35), facade(a, y + 5.35)],
        white,
        [Math.sin(a), 0, Math.cos(a)],
      );
    }
    if (i % 2 === 0) beam(out, 'metal', facade(a, 0), facade(a, 26.75), 0.08, 0.1, steel);
  }
  slab(
    out,
    (a, h) => outline(a, 87.5, 107.5, 28, h),
    (a, h) => outline(a, 96, 116, 30, h),
    27.6,
    0.8,
    'metal',
    blue,
  );
  slab(
    out,
    (a, h) => outline(a, 90.8, 110.8, 29, h),
    (a, h) => outline(a, 98, 118, 29, h),
    0.08,
    0.35,
  );
  // Mapped external stair towers: repeated bays are derived from the actual projecting footprint.
  const stairs = [];
  for (const sign of [-1, 1])
    for (const z of [-66, -34, 34, 66]) stairs.push({ x: sign * 98, z, a: (sign * Math.PI) / 2 });
  for (const sign of [-1, 1])
    for (const x of [-35, 0, 35]) stairs.push({ x, z: sign * 117, a: sign === 1 ? 0 : Math.PI });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) stairs.push({ x: sx * 77, z: sz * 98, a: Math.atan2(sx, sz) });
  for (const s of stairs) {
    const o = transformed(out, s.a, [s.x, 0, s.z]);
    for (const x of [-2.6, 2.6])
      for (const z of [-2.8, 2.8]) beam(o, 'metal', [x, 0, z], [x, 27.1, z], 0.24, 0.24, steel);
    for (let floor = 0; floor < 5; floor++) {
      const y = floor * 5.35;
      // The two flights occupy open wells; only the end landings cross the cage.
      if (floor === 0) box(o, 'concrete', [-3.1, -0.23, -3.4], [3.1, 0, 3.4], concrete);
      box(o, 'concrete', [-3.1, y, 2.5], [3.1, y + 0.18, 3.4], concrete);
      box(o, 'concrete', [-3.1, y + 2.675, -3.4], [3.1, y + 2.855, -2.4], concrete);
      for (const flight of [0, 1]) {
        const x = (flight ? 1 : -1) * 1.35;
        for (const edge of [-1.15, 1.15]) {
          const start = [x + edge, y + flight * 2.675, flight ? -2.6 : 2.6],
            end = [x + edge, y + (flight + 1) * 2.675, flight ? 2.6 : -2.6];
          beam(o, 'metal', start, end, 0.12, 0.17, steel);
          tube(
            o,
            'metal',
            [start[0], start[1] + 1.05, start[2]],
            [end[0], end[1] + 1.05, end[2]],
            0.028,
            steel,
            8,
          );
          for (let j = 0; j <= 4; j++) {
            const t = j / 4,
              p = start.map((v, k) => v + (end[k] - v) * t);
            tube(o, 'metal', p, [p[0], p[1] + 1.05, p[2]], 0.028, steel, 8);
          }
        }
      }
      for (let flight = 0; flight < 2; flight++)
        for (let j = 0; j < 16; j++) {
          const x = (flight ? 1 : -1) * 1.35,
            z = (flight ? 1 : -1) * (-2.6 + j * 0.33),
            yy = y + ((flight * 16 + j) * 5.35) / 32;
          box(o, 'concrete', [x - 1.15, yy, z - 0.17], [x + 1.15, yy + 0.17, z + 0.17], concrete);
        }
      for (const z of [-3.35, 3.35]) {
        const landingY = y + (z < 0 ? 2.675 : 0);
        tube(o, 'metal', [-3.05, landingY + 1.05, z], [3.05, landingY + 1.05, z], 0.028, steel, 8);
        for (const x of [-3, 0, 3])
          tube(o, 'metal', [x, landingY + 0.2, z], [x, landingY + 1.05, z], 0.028, steel, 8);
      }
    }
  }
  // Western glazed entry pavilion occupies the real asymmetric mapped projection.
  const entry = transformed(out, -Math.PI / 2, [-93, 0, 0]);
  for (const x of [-11, 11])
    box(entry, 'concrete', [x - 0.35, 0, -1], [x + 0.35, 14, 14], concrete);
  box(entry, 'glass', [-10.65, 0, 13.9], [10.65, 13.8, 14], glass);
  box(entry, 'seam', [-12, 14, -2], [12, 14.6, 15], white);
  for (let i = -5; i <= 5; i++)
    box(entry, 'metal', [i * 2 - 0.035, 0, 14.02], [i * 2 + 0.035, 13.9, 14.06], steel);
  // The southern pitch aperture stays open under the grandstand. Retaining faces connect the lower tray route to the esplanade.
  box(out, 'concrete', [-42, fieldY - 1, 111], [42, fieldY - 0.72, 231], concrete);
  for (const sign of [-1, 1]) {
    box(
      out,
      'concrete',
      [sign > 0 ? 40 : -42, fieldY - 0.9, 106],
      [sign > 0 ? 42 : -40, 0, 231],
      concrete,
    );
    face(
      out,
      'turf',
      [
        [sign * 42, 0, 112],
        [sign * 58, 0, 112],
        [sign * 58, 0, 231],
        [sign * 42, 0, 231],
      ],
      [0.2, 0.32, 0.12],
      [0, 1, 0],
    );
  }
  box(out, 'concrete', [-42, fieldY - 0.9, 230.5], [42, 0, 232], concrete);
  for (let i = 0; i < 15; i++) {
    const x = -38 + (i * 76) / 14;
    beam(out, 'metal', [x, 0, 109], [x, 7, 109], 0.2, 0.2, steel);
    if (i < 14) beam(out, 'metal', [x, 0, 109], [x + 76 / 14, 7, 109], 0.18, 0.18, steel);
  }
  for (const y of [0, 7]) tube(out, 'metal', [-40, y, 109], [40, y, 109], 0.22, steel, 12);
}
export function buildSchalke(out) {
  outside(out);
  bowl(out);
  roof(out);
}

export const schalkeStudy = {
  id: 'N0688',
  wikidataId: 'Q150961',
  key: 'arena_aufschalke',
  title: 'Arena AufSchalke',
  build: buildSchalke,
  quality: 'detailed',
  metricTriangleUv: true,
  smoothNormalSlots: ['trim'],
  previewGroundless: true,
  portableReviewBasis:
    'The asset review has no artificial ground plane: the field and pitch rollout channel lie below the public concourse. Geographic review uses the explicit terrain cutout.',
  size: [250, 54, 350],
  previewCamera: { position: [210, 144, 235], lookAt: [0, 8, 15] },
  visualBrief:
    'Schalke’s blue-edged glazed arena, circular-tube space roof with two parked sliding halves, giant central four-screen cube, two blue spectator tiers, exterior stair cages, asymmetric western entry and southern sliding-pitch channel.',
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Center of the published roof envelope; +Z points southwest along the mapped pitch rollout route. Native Y0 is the public concourse; field Y−10.7 is a photo-reconstructed level below it.',
  },
  sourceFacts: {
    basis:
      'The roof fabricator SEH gives 226×186m, round tubular trusses and movable halves. HPP’s published project sheet gives 225×187×53.5m; the city brochure independently confirms 53.5m above the concrete floor. Operator documentation establishes twelve movable membrane fields, 118×79m pitch tray and 10.6×7.2m video screens. Original roof and facade geometry follows eight inspected operator/fabricator/chamber photographs. The 10.7m concourse-to-field level and smaller member/stair dimensions are reconstructed from the exterior profile; the roof envelope is centered independently of the asymmetric west entry.',
  },
  referencePages: [
    'https://seh-engineering.de/referenzen/veltins-arena-gelsenkirchen',
    'https://www.baukunst-nrw.de/objekte/125-veltins-arena-arena-auf-schalke',
    'https://veltins-arena.de/veltins-arena/zahlen-und-fakten/',
    'https://schalke04.de/veltins-arena/s04-erneuert-dach-membranen-der-veltins-arena/',
    'https://www.baukunst-nrw.de/objekte/125-veltins-arena-arena-auf-schalke',
    'https://www.gelsenkirchen.de/de/stadtprofil/stadtthemen/freizeit_und_kultur/_doc/Gelsenkirchen_entdecken.pdf',
    'https://cdn-s-www.dna.fr/pdf/7d9f37f6-6fc1-433c-8c79-9705f05f29f7/la-presentation-des-candidats-retenus.pdf',
    'https://www.openstreetmap.org/way/147192563',
    'https://www.openstreetmap.org/way/331441037',
  ],
  referenceRights:
    'Original authored geometry; public photographs and project dimensions are architectural evidence only. No photographic pixels or downloaded model are embedded. Mapped outline and pitch route are © OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: schalkePlan.anchor,
    heading: schalkePlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the pedestrian forecourt and external stair feet. The depressed football bowl and rollout channel are intentional below-grade geometry. Roof-to-field total follows the published 53.5m; the concourse offset is reconstructed from the photographed facade and retained explicitly.',
    groundCutout: {
      outline: [
        [-91, -81],
        [-61, -111],
        [61, -111],
        [91, -81],
        [91, 81],
        [61, 111],
        [41, 111],
        [41, 231],
        [-41, 231],
        [-41, 111],
        [-61, 111],
        [-91, 81],
      ],
      basis:
        'The stadium bowl and southern pitch rollout channel must remain below the public forecourt. This compound footprint follows the published roof envelope plus the mapped tray parking route; model retaining faces close its terrain edges.',
    },
    source: 'https://www.openstreetmap.org/way/147192563',
    featureIds: ['way/147192563', 'way/331441037'],
    notes:
      'The exact stadium footprint and southwest pitch parking polygon establish identity, anchor and directed axis. The main roof center removes the offset caused by the asymmetric western entrance. Native +Z follows the southwest route; native −X is the western hospitality/entry side. The static football configuration has the pitch inside and roof halves parked open.',
  },
  limitations: [
    'Static open-roof football configuration, with no animated hydraulics. Member diameters, minor roof subdivisions, stair details, glazing divisions, seat distribution and local grade profile are photographic reconstructions. The 10.7m public-concourse offset is reconstructed rather than surveyed. Current advertising and transient screen content are omitted; no enclosed room inventory or exact fabrication bolt certification is claimed.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-curtain-facade', position: [125, 19, 26], lookAt: [90, 13, 2] },
    { name: 'near-external-stairs', position: [128, 12, 88], lookAt: [98, 12, 65] },
    { name: 'near-sliding-roof', position: [84, 72, 16], lookAt: [44, 41, 3] },
    { name: 'near-space-truss', position: [19, 24, 40], lookAt: [34, 36, 59] },
    { name: 'near-blue-bowl', position: [0, 0, 25], lookAt: [67, 9, 0] },
    { name: 'near-video-cube', position: [20, 16, 20], lookAt: [0, 19, 0] },
    { name: 'near-pitch-route', position: [15, -4, 195], lookAt: [0, -5, 110] },
    { name: 'far-open-roof', position: [-201, 160, 232], lookAt: [0, 7, 20] },
  ],
};
