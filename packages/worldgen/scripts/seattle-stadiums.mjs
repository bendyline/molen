/**
 * Lumen Field and T-Mobile Park at medium-fi: real footprints and the features that make them
 * recognizable from the air, in a few thousand flat-shaded triangles each. Units are meters, +Y
 * up, +X east, +Z south, origin at the placement anchor (the field centre). Colors are linear.
 */
import { box, quad, tube } from './structure-mesh.mjs';

const REF = 'palette:#ffffff';
const concrete = [0.46, 0.48, 0.48];
const paleConcrete = [0.62, 0.63, 0.62];
const seats = [0.07, 0.1, 0.15];
const steel = [0.42, 0.46, 0.49];
const roofGrey = [0.6, 0.62, 0.63];
const roofUnder = [0.4, 0.42, 0.43];
const turf = [0.11, 0.27, 0.08];
const glass = [0.06, 0.12, 0.18];
const UP = () => [0, 1, 0];
const DOWN = () => [0, -1, 0];

/**
 * One quad facing `hint(centroid)`: the normal comes from the corners and is flipped to agree
 * with the hint, so callers never depend on winding.
 */
function face(out, slot, points, color, hint) {
  const [a, b, c] = points;
  const u = b.map((v, i) => v - a[i]);
  const w = c.map((v, i) => v - a[i]);
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const length = Math.hypot(...n);
  if (length < 1e-9) return;
  n = n.map((v) => v / length);
  const centre = [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length);
  const want = hint(centre);
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) n = n.map((v) => -v);
  quad(out, slot, points, n, color);
}

/** Quads between two rows of points. */
function band(out, slot, inner, outer, color, hint, closed = true) {
  const count = closed ? inner.length : inner.length - 1;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % inner.length;
    face(out, slot, [inner[i], inner[j], outer[j], outer[i]], color, hint);
  }
}

const lift = (points, dy) => points.map((p) => [p[0], p[1] + dy, p[2]]);
const scaleXZ = (points, s) => points.map((p) => [p[0] * s, p[1], p[2] * s]);

/** Rounded-rectangle (superellipse) ring at height y. */
function superellipse(rx, rz, y, segments, exponent = 4) {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [
      rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent),
      y,
      rz * Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent),
    ];
  });
}

/**
 * Lumen Field: a 212 × 257 m bowl on a north–south field, low at the open north end, under two
 * 224 m roof canopies over the east and west sideline stands, each hung from an arched truss.
 */
export function lumenField(out) {
  const segments = 48;
  // How far each stand rises around the bowl: full on the sidelines, low at the open north end.
  const rise = (point) => {
    const end = Math.pow(Math.abs(point[2]) / 124, 3);
    const north = point[2] < 0 ? 0.55 : 0.12;
    return 1 - north * end;
  };
  const ring = (rx, rz, y) =>
    superellipse(rx, rz, 0, segments).map((p) => [p[0], y * rise(p), p[2]]);
  const field = superellipse(31, 62, 0.3, segments);
  const lower0 = ring(33, 64, 1.5);
  const lower1 = ring(66, 96, 16);
  const club0 = ring(66, 96, 21);
  const upper1 = ring(98, 124, 38);
  const outward = (c) => [c[0], 0, c[2]];
  const inward = (c) => [-c[0], 0, -c[2]];
  out.addConvexPolygon('roof', REF, field, [0, 1, 0], (p) => [p[0], p[2]], turf);
  for (const z of [-53, 46])
    box(out, 'trim', [-24.5, 0.31, z], [24.5, 0.36, z + 7], [0.03, 0.06, 0.12]);
  // Seating rakes, the club level's glazed fascia, and the outer wall.
  band(out, 'foundation', lower0, lower1, seats, UP);
  band(out, 'wall', lower1, club0, concrete, inward);
  band(
    out,
    'window',
    scaleXZ(lift(lower1, 1.2), 0.996),
    scaleXZ(lift(club0, -1.2), 0.996),
    glass,
    inward,
  );
  band(out, 'foundation', club0, upper1, seats, UP);
  const rim = lift(upper1, 2.5);
  band(out, 'wall', upper1, rim, paleConcrete, inward);
  band(out, 'wall', rim, scaleXZ(rim, 1.01), paleConcrete, UP);
  band(
    out,
    'wall',
    scaleXZ(rim, 1.01),
    scaleXZ(
      rim.map((p) => [p[0], 0, p[2]]),
      1.01,
    ),
    concrete,
    outward,
  );
  band(
    out,
    'wall',
    field.map((p) => [p[0], 0, p[2]]),
    lower0,
    concrete,
    (c) => [-c[0], 2, -c[2]],
  );
  // Roof canopies: inward-sloping, arched along the length, an arched truss at the outer edge.
  for (const side of [-1, 1]) {
    const steps = 14;
    const inner = [];
    const outer = [];
    for (let k = 0; k <= steps; k++) {
      const z = -112 + (224 * k) / steps;
      const arch = 6 * (1 - (z / 112) ** 2);
      inner.push([side * 52, 34 + arch * 0.6, z]);
      outer.push([side * 104, 41 + arch, z]);
    }
    band(out, 'roof', lift(inner, 1.2), lift(outer, 1.2), roofGrey, UP, false);
    band(out, 'roof', inner, outer, roofUnder, DOWN, false);
    band(out, 'roof', inner, lift(inner, 1.2), roofGrey, () => [-side, 0, 0], false);
    band(out, 'roof', outer, lift(outer, 1.2), roofGrey, () => [side, 0, 0], false);
    const truss = outer.map((p) => [p[0], 54 + 1.2 - 13 * (p[2] / 112) ** 2, p[2]]);
    for (let k = 0; k < steps; k++) tube(out, 'trim', truss[k], truss[k + 1], 0.9, steel, 6);
    for (let k = 1; k < steps; k += 2)
      tube(out, 'trim', truss[k], lift(outer, 1.2)[k], 0.4, steel, 4);
    for (const k of [0, steps])
      tube(out, 'trim', [side * 104, 0, outer[k][2]], truss[k], 1.1, steel, 6);
  }
  // South-end video board on its mast.
  box(out, 'trim', [-18, 24, 110], [18, 34, 112], [0.05, 0.07, 0.09]);
  box(out, 'trim', [-1.5, 0, 111], [1.5, 24, 112], steel);
}

/**
 * T-Mobile Park: a fan-shaped bowl wrapping home plate at the south-west corner with a brick
 * lower facade and the corner clock tower, and the three-panel retractable roof parked over the
 * rail tracks to the east on its two great east–west trusses.
 */
export function tMobilePark(out) {
  const brick = [0.36, 0.13, 0.08];
  const dirt = [0.42, 0.26, 0.14];
  const home = [-42, 0, 42];
  // Angle 0 points from home plate to centre field (north-east); positive turns clockwise.
  const at = (angle, distance, y) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      home[0] + (c + s) * Math.SQRT1_2 * distance,
      y,
      home[2] + (s - c) * Math.SQRT1_2 * distance,
    ];
  };
  const fromHome = (c) => [c[0] - home[0], 0, c[2] - home[2]];
  const towardHome = (c) => [home[0] - c[0], 0, home[2] - c[2]];
  // Distance from home plate to the field wall: 100 m down the lines, 123 m to centre.
  const wall = (angle) => 100 + 23 * Math.cos(angle * 2);
  const fan = Array.from({ length: 25 }, (_, i) => -Math.PI / 4 + (Math.PI / 2) * (i / 24));
  for (let i = 0; i < fan.length - 1; i++) {
    const [a, b] = [fan[i], fan[i + 1]];
    out.addConvexPolygon(
      'roof',
      REF,
      [at(a, 0, 0.3), at(a, wall(a), 0.3), at(b, wall(b), 0.3)],
      [0, 1, 0],
      (p) => [p[0], p[2]],
      turf,
    );
  }
  const base = 27.4;
  out.addConvexPolygon(
    'trim',
    REF,
    [
      at(0, 0, 0.36),
      at(-Math.PI / 4, base, 0.36),
      at(0, base * Math.SQRT2, 0.36),
      at(Math.PI / 4, base, 0.36),
    ],
    [0, 1, 0],
    (p) => [p[0], p[2]],
    dirt,
  );
  // Stands: the main bowl runs parallel to both foul lines and curves behind home plate, deep
  // and tall behind home, lower toward the foul poles; low bleachers line the outfield wall.
  const local = (u, v, y) => [
    home[0] + (u + v) * Math.SQRT1_2,
    y,
    home[2] + (v - u) * Math.SQRT1_2,
  ];
  const bowl = (offset, y) => {
    const points = [];
    const line = (sign, t) => {
      // Along a foul line (45° either side of centre), pushed out beyond it.
      const along = [Math.SQRT1_2, sign * Math.SQRT1_2];
      const outward = [-Math.SQRT1_2, sign * Math.SQRT1_2];
      return [along[0] * t + outward[0] * offset, along[1] * t + outward[1] * offset];
    };
    for (let t = 104; t > 0; t -= 13) points.push([...line(1, t), y(t)]);
    for (let k = 0; k <= 8; k++) {
      const a = (Math.PI * 3) / 4 + (Math.PI / 2) * (k / 8);
      points.push([Math.cos(a) * offset, Math.sin(a) * offset, y(0)]);
    }
    for (let t = 13; t <= 104; t += 13) points.push([...line(-1, t), y(t)]);
    return points.map(([u, v, h]) => local(u, v, h));
  };
  const front = bowl(18, () => 1.5);
  const back = bowl(52, (t) => 34 - 12 * (t / 104));
  band(out, 'foundation', front, back, seats, UP, false);
  const rim = lift(back, 2);
  band(out, 'wall', back, rim, paleConcrete, towardHome, false);
  const upper = rim.map((q) => [q[0], 14, q[2]]);
  band(out, 'wall', rim, upper, concrete, fromHome, false);
  band(
    out,
    'foundation',
    upper,
    rim.map((q) => [q[0], 0, q[2]]),
    brick,
    fromHome,
    false,
  );
  const bleacherFront = fan.map((a) => at(a, wall(a) + 2, 1.5));
  const bleacherBack = fan.map((a) => at(a, wall(a) + 20, 9));
  band(out, 'foundation', bleacherFront, bleacherBack, seats, UP, false);
  band(
    out,
    'wall',
    bleacherBack,
    bleacherBack.map((q) => [q[0], 0, q[2]]),
    concrete,
    fromHome,
    false,
  );
  // Clock tower at the home-plate corner.
  const corner = at(Math.PI, 30, 0);
  box(
    out,
    'foundation',
    [corner[0] - 6, 0, corner[2] - 6],
    [corner[0] + 6, 40, corner[2] + 6],
    brick,
  );
  box(
    out,
    'trim',
    [corner[0] - 6.4, 40, corner[2] - 6.4],
    [corner[0] + 6.4, 42, corner[2] + 6.4],
    paleConcrete,
  );
  box(
    out,
    'window',
    [corner[0] - 4, 31, corner[2] + 6],
    [corner[0] + 4, 37, corner[2] + 6.2],
    [0.6, 0.6, 0.55],
  );
  // Parked roof: three stacked arched panels over the tracks, on two east–west rail trusses.
  for (let p = 0; p < 3; p++) {
    const x0 = 72 + p * 6;
    const x1 = 178 - p * 6;
    const y = 50 + p * 4;
    const north = [];
    const south = [];
    for (let k = 0; k <= 10; k++) {
      const x = x0 + ((x1 - x0) * k) / 10;
      const crown = 8 * (1 - ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2);
      north.push([x, y + crown, -102 + p * 3]);
      south.push([x, y + crown, 98 - p * 3]);
    }
    band(out, 'roof', north, south, p === 2 ? roofGrey : [0.52, 0.54, 0.55], UP, false);
    band(out, 'roof', lift(north, -1.5), lift(south, -1.5), roofUnder, DOWN, false);
  }
  for (const z of [-108, 104]) {
    for (let k = 0; k < 10; k++) {
      const [xa, xb] = [-60 + 24 * k, -60 + 24 * (k + 1)];
      tube(out, 'trim', [xa, 46, z], [xb, 46, z], 1.2, steel, 6);
      tube(out, 'trim', [xa, 36, z], [xb, 36, z], 0.8, steel, 6);
      tube(out, 'trim', [xa, 36, z], [xb, 46, z], 0.45, steel, 4);
    }
    for (const x of [-60, 60, 180])
      box(out, 'foundation', [x - 3, 0, z - 3], [x + 3, 46, z + 3], concrete);
  }
}
