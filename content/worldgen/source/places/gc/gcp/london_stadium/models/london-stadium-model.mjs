/** London Stadium in football mode, with the mapped compression ring and roof opening. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const ground = read('terrain-grid');
const {
  outline: outer,
  holes: [inner],
} = frame.geometry;
const d = plan.dimensions;
const shades = Object.fromEntries(
  Object.entries({
    turf: '547c37',
    lawn: '628945',
    chalk: 'e9eadd',
    burgundy: '653747',
    margin: '7c5260',
    cement: '9d9e9d',
    apron: 'b9b9b2',
    edge: '9a9e9b',
    steel: 'dee0de',
    cable: 'b9bfbd',
    truss: 'd4d9d9',
    whiteRoof: 'd4d6d1',
    innerRoof: 'c0ced0',
    gutter: 'a4acab',
    film: '353c40',
    glass: '43515a',
    black: '302f32',
    deep: '2e2930',
    claret: '77505e',
    blue: '668696',
    banner: 'b7b8b5',
    seat: 'bbbdb5',
    brightSeat: 'cecec5',
    whiteSeat: 'd9dbd4',
    seatShadow: '888a85',
    lamp: 'e5ded0',
  }).map(([k, v]) => [k, rgb(v)]),
);
const c = shades;
const surfaces = {
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  field: { slot: 'foundation', localRef: 'palette:#fffffe', roughness: 0.98, metallic: 0 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.11 },
  membrane: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.91, metallic: 0 },
  glazing: { slot: 'roof', localRef: 'palette:#fefeff', roughness: 0.67, metallic: 0.04 },
  window: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.77, metallic: 0.03 },
  seats: { slot: 'trim', localRef: 'palette:#fffffd', roughness: 0.89, metallic: 0 },
};
const tau = Math.PI * 2;
const up = [0, 1, 0];
const as3 = ([x, z], y) => [x, y, z];
const blend = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [blend(a[0], b[0], t), blend(a[1], b[1], t)];

function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((dot, value, i) => dot + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function grade([x, z]) {
  const u = (x - ground.origin[0]) / ground.stepMeters;
  const v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = u - i,
    b = v - j;
  const h = ground.heightsMeters;
  return (
    blend(blend(h[j][i], h[j][i + 1], a), blend(h[j + 1][i], h[j + 1][i + 1], a), b) -
    ground.modelDatumElevationMeters
  );
}

function rayRadius(ring, x, z) {
  let result = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [u, v] = ring[i];
    const [u2, v2] = ring[(i + 1) % ring.length];
    const dx = u2 - u,
      dz = v2 - v;
    const denominator = x * dz - z * dx;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = (u * dz - v * dx) / denominator;
    const s = (u * z - v * x) / denominator;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) result = Math.min(result, t);
  }
  if (!Number.isFinite(result)) throw Error('Ray misses the stadium ring');
  return result;
}

function radialSection(a) {
  const x = Math.cos(a),
    z = Math.sin(a);
  const rOuter = rayRadius(outer, x, z);
  const rInner = rayRadius(inner, x, z);
  const rLower =
    1 / Math.pow(Math.pow(Math.abs(x) / 43.6, 5) + Math.pow(Math.abs(z) / 62.5, 5), 0.2);
  return { x, z, rOuter, rInner, rLower };
}

const on = (s, r) => [s.x * r, s.z * r];
const roof = (s, t) => on(s, blend(s.rInner, s.rOuter, t));
const seats = (s, t) => on(s, blend(s.rLower, s.rOuter, t));
const compass = (s) => [s.x, 0, s.z];
const inward = (s) => [-s.x, 0, -s.z];

function sections(n, exact = false) {
  const angles = Array.from({ length: n }, (_, i) => (i * tau) / n);
  if (exact) {
    for (const [x, z] of [...outer, ...inner]) {
      const a = Math.atan2(z, x);
      angles.push(a < 0 ? a + tau : a);
    }
  }
  return angles
    .sort((a, b) => a - b)
    .filter((a, i, all) => i === 0 || a - all[i - 1] > 0.00028)
    .map(radialSection);
}

function band(out, slot, a, b, p, q, y0, y1, tint, at = roof) {
  face(
    out,
    slot,
    [as3(at(a, p), y0), as3(at(b, p), y0), as3(at(b, q), y1), as3(at(a, q), y1)],
    up,
    tint,
  );
}

function wall(out, slot, a, b, t, y0, y1, tint, normal, at = roof, otherBase = y0, otherTop = y1) {
  face(
    out,
    slot,
    [as3(at(a, t), y0), as3(at(b, t), otherBase), as3(at(b, t), otherTop), as3(at(a, t), y1)],
    normal,
    tint,
  );
}

function pitchLine(out, a, b, width = 0.116) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const q = Math.hypot(dx, dz);
  const n = [(dz * width) / (2 * q), (-dx * width) / (2 * q)];
  const side = (p, s) => [p[0] + s * n[0], p[1] + s * n[1]];
  const y = d.pitchY + 0.025;
  face(
    out,
    'field',
    [as3(side(a, -1), y), as3(side(b, -1), y), as3(side(b, 1), y), as3(side(a, 1), y)],
    up,
    c.chalk,
  );
}

function border(out, x1, z1, x2, z2) {
  const points = [
    [x1, z1],
    [x2, z1],
    [x2, z2],
    [x1, z2],
  ];
  for (let i = 0; i < points.length; i++)
    pitchLine(out, points[i], points[(i + 1) % points.length]);
}

function turf(out, rings, detail) {
  const W = d.fieldWidth / 2,
    L = d.fieldLength / 2;
  const grass = [
    [-W - 0.7, -L - 0.7],
    [W + 0.7, -L - 0.7],
    [W + 0.7, L + 0.7],
    [-W - 0.7, L + 0.7],
  ];
  const ring = rings.map((s) => on(s, s.rLower));
  const all = [...ring, ...grass];
  const triangles = earcut(all.flat(), [ring.length]);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      'field',
      triangles.slice(i, i + 3).map((k) => as3(all[k], d.pitchY - 0.003)),
      up,
      c.burgundy,
    );
  const strips = [4, 8, 12, 16][detail];
  for (let i = 0; i < strips; i++) {
    const a = blend(-L - 0.7, L + 0.7, i / strips),
      b = blend(-L - 0.7, L + 0.7, (i + 1) / strips);
    face(
      out,
      'field',
      [
        [-W - 0.7, d.pitchY, a],
        [W + 0.7, d.pitchY, a],
        [W + 0.7, d.pitchY, b],
        [-W - 0.7, d.pitchY, b],
      ],
      up,
      i % 2 ? c.lawn : c.turf,
    );
  }
  border(out, -W, -L, W, L);
  pitchLine(out, [-W, 0], [W, 0]);
  const n = [8, 14, 22, 30][detail];
  for (let i = 0; i < n; i++) {
    const p = (tau * i) / n,
      q = (tau * (i + 1)) / n;
    pitchLine(
      out,
      [9.15 * Math.cos(p), 9.15 * Math.sin(p)],
      [9.15 * Math.cos(q), 9.15 * Math.sin(q)],
    );
  }
  for (const end of [-1, 1]) {
    const y = d.pitchY;
    border(out, -20.16, end * L, 20.16, end * (L - 16.5));
    border(out, -9.16, end * L, 9.16, end * (L - 5.5));
    if (detail === 0) continue;
    const z = end * L;
    const zBack = end * (L + 1.75);
    const t = 0.105;
    const sectionArc = Math.acos(5.5 / 9.15);
    for (let i = 0; i < n; i++) {
      const a = blend(-sectionArc, sectionArc, i / n),
        b = blend(-sectionArc, sectionArc, (i + 1) / n);
      const point = (p) => [9.15 * Math.sin(p), end * (L - 11 - 9.15 * Math.cos(p))];
      pitchLine(out, point(a), point(b));
    }
    beam(out, 'steel', [-3.66, y + 2.44, z], [3.66, y + 2.44, z], t, t, c.chalk);
    for (const x of [-3.66, 3.66]) {
      beam(out, 'steel', [x, y, z], [x, y + 2.44, z], t, t, c.chalk);
      if (detail >= 2) beam(out, 'steel', [x, y, zBack], [x, y + 2.44, z], 0.046, 0.052, c.chalk);
    }
    if (detail >= 2) beam(out, 'steel', [-3.66, y, zBack], [3.66, y, zBack], 0.05, 0.05, c.chalk);
  }
}

function seatSlope(out, a, b, f0, f1, y0, y1, tint, steps, aisleWidth) {
  for (let i = 0; i < steps; i++) {
    const p = blend(f0, f1, i / steps);
    const q = blend(f0, f1, (i + 1) / steps);
    const y = blend(y0, y1, i / steps);
    const top = blend(y0, y1, (i + 1) / steps);
    if (steps === 1) {
      band(out, 'seats', a, b, p, q, y, top, tint, seats);
      continue;
    }
    const pa = seats(a, p),
      pb = seats(b, p),
      qa = seats(a, q),
      qb = seats(b, q);
    const left = mix(pa, pb, aisleWidth),
      right = mix(qa, qb, aisleWidth);
    face(out, 'seats', [as3(left, y), as3(pb, y), as3(qb, y), as3(right, y)], up, tint);
    face(out, 'foundation', [as3(pa, y), as3(left, y), as3(right, y), as3(qa, y)], up, c.apron);
    wall(out, 'seats', a, b, q, y, top, c.seatShadow, inward(a), seats);
  }
}

function bowl(out, rings, detail) {
  for (let i = 0; i < rings.length; i++) {
    const a = rings[i],
      b = rings[(i + 1) % rings.length];
    const rail = d.pitchY + 1.05;
    const seatsStart = d.pitchY + 2.53;
    wall(out, 'wall', a, b, 0, d.pitchY - 0.035, rail, c.claret, inward(a), seats);
    band(out, 'foundation', a, b, 0, 0.033, rail, rail, c.edge, seats);
    const hue = [c.brightSeat, c.whiteSeat, c.seat, c.blue, c.claret];
    const lower = hue[i % 17 === 0 ? 4 : i % 9 === 0 ? 3 : i % 3];
    const upper = hue[i % 12 === 4 ? 4 : i % 13 === 0 ? 3 : (i + 1) % 3];
    wall(out, 'wall', a, b, 0.032, rail, seatsStart, c.film, inward(a), seats);
    seatSlope(
      out,
      a,
      b,
      0.033,
      0.345,
      seatsStart,
      d.lowerSeatTop,
      lower,
      [1, 2, 5, 10][detail],
      0.062,
    );
    band(out, 'foundation', a, b, 0.345, 0.391, d.lowerSeatTop, d.lowerSeatTop, c.apron, seats);
    wall(out, 'wall', a, b, 0.392, d.lowerSeatTop, 12.05, c.film, inward(a), seats);
    if (detail >= 1) {
      wall(out, 'seats', a, b, 0.391, 11.23, 11.71, c.claret, inward(a), seats);
      band(out, 'foundation', a, b, 0.392, 0.421, 12.05, 12.05, c.apron, seats);
    }
    seatSlope(out, a, b, 0.421, 0.865, 12.05, d.upperSeatTop, upper, [1, 2, 5, 12][detail], 0.057);
    band(out, 'foundation', a, b, 0.865, 0.903, d.upperSeatTop, d.upperSeatTop, c.apron, seats);
    wall(
      out,
      'wall',
      a,
      b,
      0.904,
      d.upperSeatTop,
      d.upperSeatTop + 2.55,
      c.black,
      inward(a),
      seats,
    );
  }
}

function canopy(out, rings, detail) {
  const sections = [
    [0, d.innerRoofY],
    [0.31, 35.1],
    [0.64, 35.0],
    [1, d.roofEaves],
  ];
  for (let i = 0; i < rings.length; i++) {
    const a = rings[i],
      b = rings[(i + 1) % rings.length];
    for (let k = 1; k < sections.length; k++) {
      const [p, y] = sections[k - 1],
        [q, h] = sections[k];
      const slot = k === 1 ? 'glazing' : 'membrane';
      const tint = k === 1 ? c.innerRoof : c.whiteRoof;
      band(out, slot, a, b, p, q, y, h, tint);
      if (detail === 0) continue;
      face(
        out,
        slot,
        [
          as3(roof(a, p), y - 0.28),
          as3(roof(b, p), y - 0.28),
          as3(roof(b, q), h - 0.28),
          as3(roof(a, q), h - 0.28),
        ],
        [0, -1, 0],
        k === 1 ? c.innerRoof : c.apron,
      );
    }
    wall(out, 'steel', a, b, 0, d.innerRoofY - 0.73, d.innerRoofY + 0.13, c.gutter, inward(a));
    wall(out, 'steel', a, b, 1, d.roofEaves - 0.54, d.roofEaves + 0.22, c.gutter, compass(a));
    if (detail >= 2 && i % 2 === 0)
      beam(
        out,
        'steel',
        as3(roof(a, 0.03), d.innerRoofY - 0.31),
        as3(roof(a, 0.94), d.roofEaves - 0.76),
        0.138,
        0.15,
        c.cable,
      );
  }
}

function exterior(out, rings, detail) {
  for (let i = 0; i < rings.length; i++) {
    const a = rings[i],
      b = rings[(i + 1) % rings.length];
    const baseA = grade(roof(a, 0.89)) - 0.6;
    const baseB = grade(roof(b, 0.89)) - 0.6;
    const endA = roof(a, 0.94),
      endB = roof(b, 0.94);
    const topA = roof(a, 0.992),
      topB = roof(b, 0.992);
    wall(out, 'wall', a, b, 0.87, baseA, d.concourseY, c.cement, compass(a), roof, baseB);
    band(out, 'foundation', a, b, 0.85, 0.997, d.concourseY, d.concourseY, c.apron);
    wall(out, 'wall', a, b, 0.997, d.concourseY - 0.48, d.concourseY + 0.22, c.edge, compass(a));
    face(
      out,
      'wall',
      [as3(endA, 6.28), as3(endB, 6.28), as3(topB, 29.1), as3(topA, 29.1)],
      compass(a),
      c.film,
    );
    face(
      out,
      'wall',
      [as3(topA, 29.1), as3(topB, 29.1), as3(roof(b, 0.962), 34.9), as3(roof(a, 0.962), 34.9)],
      compass(a),
      c.black,
    );
    if (detail === 0) continue;
    const span = Math.hypot(endB[0] - endA[0], endB[1] - endA[1]);
    const inset = ([x, z], s) => [x + s.x * 0.034, z + s.z * 0.034];
    const left = mix(inset(endA, a), inset(endB, b), 0.08),
      right = mix(inset(endA, a), inset(endB, b), 0.87);
    const tl = mix(inset(topA, a), inset(topB, b), 0.08),
      tr = mix(inset(topA, a), inset(topB, b), 0.87);
    if (span >= 2.2) {
      const f = i % 9;
      const tip = mix(left, right, 0.65);
      face(
        out,
        'wall',
        [as3(left, 8.7), as3(tip, 8.7), as3(tr, 26.15), as3(mix(tl, tr, 0.49), 26.15)],
        compass(a),
        f === 0 ? c.claret : f === 4 ? c.blue : c.banner,
      );
      if (detail >= 2)
        face(
          out,
          'wall',
          [as3(mix(left, right, 0.34), 8.68), as3(right, 8.68), as3(tl, 25.8)],
          compass(a),
          f < 3 ? c.deep : f === 5 ? c.margin : c.black,
        );
    }
    if (detail >= 2 && span >= 4) {
      const p = roof(a, 0.87),
        q = roof(b, 0.87);
      const n = compass(a);
      const e1 = mix(p, q, 0.18),
        e2 = mix(p, q, 0.78);
      face(
        out,
        'window',
        [
          as3(e1, 0.62).map((x, j) => x + n[j] * 0.037),
          as3(e2, 0.62).map((x, j) => x + n[j] * 0.037),
          as3(e2, 3.81).map((x, j) => x + n[j] * 0.037),
          as3(e1, 3.81).map((x, j) => x + n[j] * 0.037),
        ],
        n,
        c.glass,
      );
    }
  }
}

function trussStrip(out, a, b, n, width) {
  const lateral = normalFor(
    [0, 0, 0],
    b.map((v, i) => v - a[i]),
    n,
  );
  const offset = (p, side) => p.map((v, i) => v + (lateral[i] * width * side) / 2);
  face(out, 'steel', [offset(a, -1), offset(b, -1), offset(b, 1), offset(a, 1)], n, c.steel);
}

function steelwork(out, detail) {
  const count = [20, 30, 44, 60][detail];
  const rows = sections(count);
  const yLow = 34.1,
    yHigh = d.compressionTrussTop;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i],
      b = rows[(i + 1) % rows.length];
    const mid = radialSection(((i + 0.5) * tau) / count);
    const ha = as3(roof(a, 0.997), yHigh),
      hb = as3(roof(b, 0.997), yHigh);
    const la = as3(roof(a, 0.996), yLow),
      lb = as3(roof(b, 0.996), yLow);
    const lm = as3(roof(mid, 0.996), yLow);
    const gradeA = as3(roof(a, 0.983), d.concourseY);
    const gradeB = as3(roof(b, 0.983), d.concourseY);
    if (detail === 0) {
      const inside = 0.032;
      wall(out, 'steel', a, b, 0.998, yHigh - 0.92, yHigh, c.steel, compass(a));
      wall(out, 'steel', a, b, 0.996, yLow - 0.42, yLow + 0.25, c.steel, compass(a));
      const to = (p) => p.map((n, j) => n + (j === 0 ? a.x : j === 2 ? a.z : 0) * inside);
      const crown = to(lm);
      face(
        out,
        'steel',
        [to(gradeA), to(gradeA).map((v, j) => (j === 1 ? v + 1.25 : v)), crown],
        compass(a),
        c.steel,
      );
      continue;
    }
    for (const [p, q, width] of [
      [ha, hb, 1.05],
      [la, lb, 0.85],
      [ha, lm, 0.54],
      [hb, lm, 0.54],
      [gradeA, lm, 0.8],
      [gradeB, lm, 0.8],
    ])
      if (detail === 1) trussStrip(out, p, q, compass(a), width);
      else beam(out, 'steel', p, q, width, width, c.steel);
    if (detail >= 2) {
      beam(out, 'steel', la, ha, 0.28, 0.31, c.truss);
      beam(
        out,
        'steel',
        as3(roof(a, 0.908), yLow - 1.6),
        as3(roof(b, 0.908), yLow - 1.6),
        0.26,
        0.29,
        c.cable,
      );
      const innerA = as3(roof(a, 0.028), d.innerRoofY - 1.05);
      const innerB = as3(roof(b, 0.028), d.innerRoofY - 1.05);
      beam(out, 'steel', innerA, innerB, 0.36, 0.35, c.truss);
      beam(out, 'steel', la, innerA, 0.21, 0.22, c.steel);
      beam(out, 'steel', lb, innerA, 0.128, 0.13, c.cable);
      if (detail === 3) beam(out, 'steel', ha, as3(roof(a, 0.69), 36.5), 0.163, 0.16, c.cable);
    }
  }
}

function lights(out, detail) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = (tau * (i + 0.2)) / count;
    const l = radialSection(angle - 0.062),
      r = radialSection(angle + 0.062),
      m = radialSection(angle);
    const high = d.innerRoofY + 1.8,
      low = d.innerRoofY - 4.9;
    const a = as3(roof(l, 0.022), low),
      b = as3(roof(r, 0.022), low);
    const top = as3(roof(m, 0.027), high);
    if (detail === 0) {
      face(out, 'steel', [a, b, top], inward(m), c.steel);
    } else {
      for (const [p, q] of [
        [a, b],
        [a, top],
        [b, top],
      ])
        beam(out, 'steel', p, q, 0.25, 0.27, c.steel);
      const rows = [0, 2, 3, 5][detail];
      for (let k = 0; k < rows; k++) {
        const t = 0.14 + (0.65 * k) / rows;
        const p = a.map((v, j) => blend(v, top[j], t)),
          q = b.map((v, j) => blend(v, top[j], t));
        beam(out, 'steel', p, q, 0.22, 0.16, c.steel);
        if (detail >= 2) {
          const n = detail === 2 ? 3 : 7;
          for (let j = 0; j < n; j++) {
            const f = (j + 0.35) / n;
            const l1 = p.map((v, k2) => blend(v, q[k2], f) + (k2 === 1 ? 0.11 : 0));
            const l2 = l1.map((v, k2) => v + (k2 === 1 ? 0.25 : 0));
            beam(out, 'seats', l1, l2, 0.32, 0.38, c.lamp);
          }
        }
      }
    }
  }
}

function boards(out, detail) {
  if (detail === 0) return;
  for (const x of [-1, 1]) {
    const z = x * 91.2;
    const y = 13.3;
    face(
      out,
      'window',
      [
        [-12.9, y, z],
        [12.9, y, z],
        [12.9, y + 8.8, z],
        [-12.9, y + 8.8, z],
      ],
      [0, 0, -x],
      c.black,
    );
    const frameZ = z + x * 0.38;
    face(
      out,
      'wall',
      [
        [-13.5, y - 0.24, frameZ],
        [13.5, y - 0.24, frameZ],
        [13.5, y + 9.03, frameZ],
        [-13.5, y + 9.03, frameZ],
      ],
      [0, 0, -x],
      c.blue,
    );
    if (detail >= 2)
      for (const w of [-11.5, 11.5])
        beam(
          out,
          'steel',
          [w, y + 8.3, z + x * 1.2],
          [w, y + 17.5, z + x * 10.1],
          0.28,
          0.28,
          c.cable,
        );
  }
}

function draw(out, detail) {
  const rings = sections([20, 35, 58, 74][detail], detail === 3);
  turf(out, rings, detail);
  bowl(out, rings, detail);
  canopy(out, rings, detail);
  exterior(out, rings, detail);
  steelwork(out, detail);
  lights(out, detail);
  boards(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [330, 233, -329];
const lookAt = [-4, 12, 6];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q172190',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'London Stadium’s white compression truss and V-columns enclose a football pitch and two seating tiers on its Olympic Park island.',
  camera,
  lookAt,
  sunDirection: [-90, 88, 66],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.83,
    groundY: -5,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'roof-opening-and-oval', position: [181, 191, -184], lookAt: [-5, 9, 0] },
    { name: 'white-truss-and-concourse', position: [135, 23, 128], lookAt: [37, 25, 66] },
    { name: 'field-and-cable-roof', position: [37, 4, 60], lookAt: [-38, 14, -46] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.097, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry from exact CC0 Qualla and supplemental references, native mapping, original elevation and project records.',
};
