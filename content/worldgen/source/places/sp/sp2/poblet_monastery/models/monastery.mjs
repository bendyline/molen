import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  relief: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.96 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96 },
  oak: { slot: 'door', graph: 'wood_vertical', roughness: 0.93 },
};
const wall = rgb('b4a58c');
const pale = rgb('c4b598');
const tone = rgb('9f927a');
const clay = rgb('a07d63');
const dark = rgb('514e46');
const oak = rgb('635045');
const courtyard = rgb('9d947c');
const up = [0, 1, 0];
const part = (id) => site.buildings.find((p) => p.id === id).rings;
const grade = (x, z) => 0.68 + z * 0.071 - Math.max(0, x - 5) * 0.071;
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const blend = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

function face(out, slot, points, color, toward) {
  let p = points.map((row) => row.map(Math.fround));
  if (toward && normalFor(...p).reduce((sum, v, i) => sum + v * toward[i], 0) < 0)
    p = p.toReversed();
  for (let i = 1; i < p.length - 1; i++) {
    const tri = [p[0], p[i], p[i + 1]],
      normal = normalFor(...tri);
    if (Math.hypot(...normal) > 0.9) out.addTriangle(slot, '', tri, normal, [], color);
  }
}

const pt = ([x, z], height) => [x, height(x, z), z];
const flat = (y) => () => y;

function cap(out, slot, [outline, ...holes], height, color, toward = up) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'wall',
      'palette:#ffffff',
      outline,
      holes,
      (p) => height(...p),
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Poblet roof polygon');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = [0, 1, 2].map((k) =>
      positions.slice(3 * indices[i + k], 3 * indices[i + k] + 3),
    );
    face(out, slot, points, color, toward);
  }
}

function walls(out, slot, ring, base, top, color, hole = false) {
  const profile = area(ring) < 0 !== hole ? ring : ring.toReversed();
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(out, slot, [pt(a, base), pt(b, base), pt(b, top), pt(a, top)], color);
  }
}

function prism(out, rings, base, top, slot = 'stone', color = wall, roof = slot, tint = color) {
  for (let i = 0; i < rings.length; i++) walls(out, slot, rings[i], base, top, color, i > 0);
  cap(out, roof, rings, top, tint);
}

function roofHeight({ eave, rise, axis, box: [x, X, z, Z] }) {
  const [lo, hi] = axis === 'x' ? [z, Z] : [x, X];
  return (x, z) =>
    eave + rise * (1 - Math.abs((((axis === 'x' ? z : x) - (lo + hi) / 2) / (hi - lo)) * 2));
}

function distantRing(ring) {
  const points = [...ring];
  for (let i = points.length - 1; i >= 0 && points.length > 4; i--) {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[(i + 1) % points.length];
    const [x, z] = points[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz);
    if (t >= 0 && t <= 1 && Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < 1.95)
      points.splice(i, 1);
  }
  return points;
}

function pitched(out, zone, base, detail) {
  const top = roofHeight(zone);
  for (const polygon of zone.polygons) {
    for (const [i, ring] of polygon.entries())
      walls(out, 'stone', detail ? ring : distantRing(ring), base, top, wall, i > 0);
  }
  for (const polygon of zone.slopes)
    cap(
      out,
      zone.rise ? 'roof' : 'stone',
      detail ? polygon : polygon.map(distantRing),
      top,
      zone.rise ? clay : tone,
    );
}

function ring(x, z, r, n = 8, angle = Math.PI / n) {
  return Array.from({ length: n }, (_, i) => {
    const a = angle + (i * 2 * Math.PI) / n;
    return [x + Math.cos(a) * r, z + Math.sin(a) * r];
  });
}

function smallRoof(out, x, z, r, eave, peak, n = 8) {
  const points = ring(x, z, r, n);
  for (let i = 0; i < points.length; i++)
    face(
      out,
      'roof',
      [pt(points[i], flat(eave)), pt(points[(i + 1) % points.length], flat(eave)), [x, peak, z]],
      clay,
      up,
    );
}

function gateTower(out, polygon, roofY, detail) {
  const safeGrade = (x, z) => grade(x, z) - 1.4;
  prism(out, [polygon], safeGrade, flat(roofY - 1.27));
  const origin = polygon.reduce((sum, p) => sum.map((v, i) => v + p[i] / polygon.length), [0, 0]);
  const lip = polygon.map((p) => blend(origin, p, 1.045));
  prism(out, [lip], flat(roofY - 1.27), flat(roofY), 'relief', pale, 'stone', tone);
  if (!detail) return;
  cap(out, 'relief', [lip], flat(roofY - 1.271), tone, [0, -1, 0]);
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length];
    const n = Math.floor(Math.hypot(q[0] - p[0], q[1] - p[1]) / (detail === 1 ? 1.24 : 0.72));
    for (let k = 0; k < n; k++) {
      const a = blend(origin, blend(p, q, (k + 0.25) / n), 1.05);
      const b = blend(origin, blend(p, q, (k + 0.7) / n), 1.05);
      face(
        out,
        'relief',
        [
          pt(a, flat(roofY - 1.7)),
          pt(b, flat(roofY - 1.7)),
          pt(b, flat(roofY - 1.21)),
          pt(a, flat(roofY - 1.21)),
        ],
        tone,
        [a[0] - origin[0], 0, a[1] - origin[1]],
      );
    }
  }
}

function gatehouse(out, detail) {
  const g = site.gatePlan;
  const low = (x, z) => grade(x, z) - 1.8;
  gateTower(out, g.northTower, 22.2, detail);
  gateTower(out, g.southTower, 22.5, detail);
  for (const polygon of g.wall) prism(out, polygon, low, flat(13.6));
  const [westA, eastA, eastB, westB] = g.soffit;
  const n = [4, 8, 14, 20][detail];
  const high = 13.6;
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    const west = blend(westA, westB, a),
      westNext = blend(westA, westB, b);
    const east = blend(eastA, eastB, a),
      eastNext = blend(eastA, eastB, b);
    const arch = (t) => g.spring + (g.crown - g.spring) * Math.sqrt(1 - Math.pow(2 * t - 1, 2));
    const h = arch(a),
      j = arch(b);
    const w = pt(west, flat(h)),
      u = pt(westNext, flat(j)),
      e = pt(east, flat(h)),
      v = pt(eastNext, flat(j));
    face(out, 'stone', [w, u, pt(westNext, flat(high)), pt(west, flat(high))], wall, [-1, 0, 0]);
    face(out, 'stone', [e, v, pt(eastNext, flat(high)), pt(east, flat(high))], wall, [1, 0, 0]);
    face(out, 'relief', [w, e, v, u], tone, [0, -1, 0]);
    if (detail)
      face(
        out,
        'relief',
        [
          [w[0] - 0.06, h, w[2]],
          [u[0] - 0.06, j, u[2]],
          [u[0] - 0.06, j + 0.46, u[2]],
          [w[0] - 0.06, h + 0.46, w[2]],
        ],
        pale,
        [-1, 0, 0],
      );
  }
  cap(out, 'stone', [g.soffit], flat(high), tone);
}

function archArcade(out, a, b, base, eave, detail, toward) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const step = length / Math.round(length / 3.5);
  const bays = Math.round(length / step);
  const position = (t, y, d = 0) => [
    a[0] + (b[0] - a[0]) * t + toward[0] * d,
    y,
    a[1] + (b[1] - a[1]) * t + toward[2] * d,
  ];
  const depth = -0.58;
  const shadowDepth = -2.13;
  face(
    out,
    'stone',
    [
      position(0, base - 0.6, shadowDepth),
      position(1, base - 0.6, shadowDepth),
      position(1, eave, shadowDepth),
      position(0, eave, shadowDepth),
    ],
    rgb('665d4c'),
    toward,
  );
  for (let i = 0; i < bays; i++) {
    const l = (i + 0.12) / bays,
      r = (i + 0.88) / bays;
    const sill = base + 0.72,
      spring = base + 2.77,
      crest = base + 4.12;
    face(
      out,
      'stone',
      [position(i / bays, sill), position(l, sill), position(l, eave), position(i / bays, eave)],
      wall,
      toward,
    );
    face(
      out,
      'stone',
      [
        position(r, sill),
        position((i + 1) / bays, sill),
        position((i + 1) / bays, eave),
        position(r, eave),
      ],
      wall,
      toward,
    );
    face(
      out,
      'relief',
      [
        position(i / bays, base - 0.33),
        position((i + 1) / bays, base - 0.33),
        position((i + 1) / bays, sill),
        position(i / bays, sill),
      ],
      tone,
      toward,
    );
    const n = detail === 1 ? 4 : 8;
    for (let j = 0; j < n; j++) {
      const t = j / n,
        u = (j + 1) / n;
      const a = l + (r - l) * t,
        b = l + (r - l) * u;
      const h = spring + (crest - spring) * (1 - Math.pow(Math.abs(2 * t - 1), 1.7));
      const k = spring + (crest - spring) * (1 - Math.pow(Math.abs(2 * u - 1), 1.7));
      face(
        out,
        'stone',
        [position(a, h), position(b, k), position(b, eave), position(a, eave)],
        wall,
        toward,
      );
      if (detail >= 2) {
        face(
          out,
          'relief',
          [
            position(a, h, 0.055),
            position(b, k, 0.055),
            position(b, k + 0.155, 0.055),
            position(a, h + 0.155, 0.055),
          ],
          pale,
          toward,
        );
        face(
          out,
          'relief',
          [position(a, h), position(b, k), position(b, k, depth), position(a, h, depth)],
          tone,
          [0, -1, 0],
        );
      }
    }
    if (detail >= 2) {
      const c = (l + r) / 2;
      beam(
        out,
        'relief',
        position(c, sill, 0.05),
        position(c, spring + 0.08, 0.05),
        0.14,
        0.17,
        pale,
      );
      for (const d of [-1, 1]) {
        const f = c + d * (r - l) * 0.31;
        beam(
          out,
          'relief',
          position(c, spring, 0.05),
          position(f, spring + 0.58, 0.05),
          0.082,
          0.11,
          pale,
        );
      }
    }
  }
}

function cloister(out, detail) {
  const [outer, inner] = part(2325532);
  const court = [inner[0], inner[1], inner[2], inner.at(-1)];
  const center = [-5.55, -1.62],
    eave = 10.03,
    floor = 1.85;
  walls(out, 'stone', outer, flat(0.05), flat(eave), wall);
  cap(out, 'roof', [outer, court], flat(eave), clay);
  cap(out, 'base', [court], flat(floor), courtyard);
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length];
    const mid = blend(a, b, 0.5),
      toward = [center[0] - mid[0], 0, center[1] - mid[1]];
    const length = Math.hypot(...toward);
    if (detail)
      archArcade(
        out,
        a,
        b,
        floor,
        eave,
        detail,
        toward.map((v) => v / length),
      );
    else
      face(
        out,
        'stone',
        [pt(a, flat(floor)), pt(b, flat(floor)), pt(b, flat(eave)), pt(a, flat(eave))],
        tone,
        toward,
      );
  }
  const x = -1.44,
    z = -6.17;
  const columns = ring(x, z, 4.76, 6);
  if (detail === 0) prism(out, [columns], flat(floor), flat(5.65));
  else
    for (const [xx, zz] of columns)
      prism(
        out,
        [ring(xx, zz, 0.47, detail === 1 ? 4 : 8)],
        flat(floor),
        flat(5.68),
        'relief',
        pale,
      );
  prism(out, [ring(x, z, 4.9, 6)], flat(5.54), flat(6.12), 'relief', pale);
  if (detail) {
    const basin = ring(x, z, 1.81, 8);
    const bowl = ring(x, z, 1.46, 8);
    prism(out, [basin, bowl], flat(floor), flat(floor + 0.69), 'relief', tone);
    cap(out, 'shadow', [bowl], flat(floor + 0.4), rgb('637775'));
  }
  smallRoof(out, x, z, 5.1, 6.12, 8.35, 6);
}

function insetArch(out, x, z, base, width, height, color, slot, detail) {
  const n = detail < 2 ? 6 : 12,
    half = width / 2,
    spring = height - width / 2;
  face(
    out,
    slot,
    [
      [x, base, z - half],
      [x, base, z + half],
      [x, base + spring, z + half],
      [x, base + spring, z - half],
    ],
    color,
    [-1, 0, 0],
  );
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    const rise = (t) => Math.sqrt(1 - Math.pow(2 * t - 1, 2)) * half;
    const z0 = z + (a - 0.5) * width,
      z1 = z + (b - 0.5) * width;
    face(
      out,
      slot,
      [
        [x, base + spring, z0],
        [x, base + spring, z1],
        [x, base + spring + rise(b), z1],
        [x, base + spring + rise(a), z0],
      ],
      color,
      [-1, 0, 0],
    );
  }
}

function basilica(out, detail) {
  const [shell] = part(174173363);
  const roof = (x, z) => 17.3 + (z - 33) * 0.024;
  prism(
    out,
    [detail ? shell : distantRing(shell)],
    (x, z) => grade(x, z) - 1.18,
    roof,
    'stone',
    wall,
    'roof',
    clay,
  );
  pitched(out, site.basilicaRoof, roof, detail);
  const frontage = rect(-49.4, -39.3, 16.8, 44.9);
  prism(out, [frontage], flat(0.55), flat(15.15), 'stone', pale);
  const facade = [
    [-40.2, 22.4],
    [-40.2, 31.49],
    [-40.2, 40.58],
    [-36.3, 40.58],
    [-36.3, 31.49],
    [-36.3, 22.4],
  ];
  const gable = (_x, z) => 22.64 + 3.9 * (1 - Math.abs((z - 31.49) / 9.09));
  const halves = [rect(-40.2, -36.3, 22.4, 31.49), rect(-40.2, -36.3, 31.49, 40.58)];
  walls(out, 'stone', facade, flat(14.88), gable, pale);
  for (const poly of halves) cap(out, 'roof', [poly], gable, clay);
  const x = 22.6,
    z = 29.79;
  prism(out, [ring(x, z, 7.12)], flat(22.7), flat(37.2), 'stone', pale);
  prism(out, [ring(x, z, 7.43)], flat(37.16), flat(37.82), 'relief', pale);
  if (detail) cap(out, 'relief', [ring(x, z, 7.43)], flat(37.159), tone, [0, -1, 0]);
  smallRoof(out, x, z, 7.68, 37.82, 43.3);
  const belfry = rect(3.18, 7.38, 18.34, 22.49);
  prism(out, [belfry], flat(21.7), flat(39.25), 'stone', tone);
  smallRoof(out, 5.28, 20.42, 3.12, 39.25, 41.6, 4);
  gateTower(out, ring(-47.64, 51.25, 4.46), 24.9, detail);
  smallRoof(out, -47.64, 51.25, 4.73, 24.9, 29.18);
  if (!detail) return;
  for (const [cx, cz, lo, hi, i] of [
    [x, z, 27.9, 35.76, 8],
    [5.28, 20.42, 33.4, 38.05, 4],
  ]) {
    const edges = ring(cx, cz, i === 8 ? 7.15 : 2.98, i);
    for (let k = 0; k < edges.length; k++) {
      const a = edges[k],
        b = edges[(k + 1) % edges.length];
      const mid = blend(a, b, 0.5),
        n = [mid[0] - cx, 0, mid[1] - cz];
      const at = (t, y) => pt(blend(a, b, t), flat(y));
      face(
        out,
        'shadow',
        [at(0.28, lo), at(0.72, lo), at(0.72, hi - 1.12), at(0.5, hi), at(0.28, hi - 1.12)],
        dark,
        n,
      );
      if (detail >= 2) beam(out, 'relief', at(0.5, lo), at(0.5, hi - 0.66), 0.12, 0.16, pale);
    }
  }
  const rose = Array.from({ length: detail < 2 ? 12 : 20 }, (_, i) => {
    const a = (i * (2 * Math.PI)) / (detail < 2 ? 12 : 20);
    return [-40.224, 21.26 + 3.19 * Math.cos(a), 31.4 + 3.19 * Math.sin(a)];
  });
  face(out, 'shadow', rose, dark, [-1, 0, 0]);
  if (detail >= 2)
    for (let i = 0; i < rose.length; i += 2)
      beam(
        out,
        'relief',
        [-40.261, 21.26, 31.4],
        [-40.262, ...rose[i].slice(1)],
        0.13,
        0.095,
        pale,
      );
  insetArch(out, -49.444, 31.4, 1.8, 4.79, 8.28, pale, 'relief', detail);
  insetArch(out, -49.48, 31.4, 1.8, 2.55, 4.96, oak, 'oak', detail);
  if (detail >= 2)
    for (const sign of [-1, 1]) {
      for (const d of [1.95, 3.37]) {
        const z = 31.4 + sign * d;
        prism(
          out,
          [rect(-50.09, -49.22, z - 0.26, z + 0.26)],
          flat(1.8),
          flat(7.8),
          'relief',
          pale,
        );
        insetArch(out, -49.457, z, 9.3, 1.17, 2.21, tone, 'relief', detail);
      }
    }
}

function monastery(out, detail) {
  for (const zone of site.roofs) pitched(out, zone, (x, z) => grade(x, z) - 1.24, detail);
  for (const [id, h] of [
    [174173351, 16.9],
    [174173353, 13.1],
    [174174244, 13.67],
  ]) {
    prism(
      out,
      part(id),
      (x, z) => grade(x, z) - 1.32,
      flat(h),
      'stone',
      wall,
      id === 174173351 ? 'roof' : 'stone',
      id === 174173351 ? clay : tone,
    );
  }
  gatehouse(out, detail);
  cloister(out, detail);
  basilica(out, detail);
}
export const buildSkyline = (out) => monastery(out, 0);
export const buildDistrict = (out) => monastery(out, 1);
export const buildStreet = (out) => monastery(out, 2);
export const buildCloseup = (out) => monastery(out, 3);
export const buildMaster = buildCloseup;
