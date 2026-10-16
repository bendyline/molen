/** Messeturm: full mapped granite steles, exposed cylinder, curved lobby and three-stage pyramid. */
import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  shift,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0170_messeturm',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  closeup: { dx: 1, dy: 1, tolerance: 0.025, roofPitch: 1.2 },
  street: { dx: 2, dy: 3, tolerance: 0.08, roofPitch: 3 },
  district: { dx: 4, dy: 9, tolerance: 0.3, roofPitch: 8 },
  skyline: { dx: 0, dy: 0, tolerance: 0.3, roofPitch: 0 },
};
const part = (key, id) => partsEvidence(key).find((p) => p.id === id);
const metal = [0.63, 0.68, 0.7];
function bandPlan(out, plan, y, h, depth, color, slot = 'metal') {
  for (const { a, b, n } of edges(plan))
    face(
      out,
      slot,
      [
        [a[0], y - h, a[1]],
        [b[0], y - h, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ].map((p) => shift(p, n, depth)),
      color,
    );
}
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function curtainLevel(
  out,
  plan,
  lo,
  hi,
  c,
  {
    dx = 1.5,
    dy = 3.6,
    tint = [0.23, 0.31, 0.35],
    frame = 0.08,
    trim = [0.63, 0.68, 0.7],
    slot = 'metal',
  } = {},
) {
  if (slot === 'cladding') frame = 0.62;
  for (const { a, b, len, n } of edges(plan)) {
    const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
    face(
      out,
      'glass',
      [at(0, lo), at(1, lo), at(1, hi), at(0, hi)],
      !c.dx && slot === 'cladding' ? tint.map((v, i) => 0.4 * v + 0.6 * trim[i] * 0.701109) : tint,
    );
    // Skyline retains granite-dominated steles through broad facade corner/end strips.
    if (!c.dx) {
      continue;
    }
    const nx = Math.max(1, Math.ceil(len / (dx * c.dx))),
      ny = Math.max(1, Math.ceil((hi - lo) / (dy * c.dy))),
      wu = Math.min(0.22, (frame * c.dx) / (len / nx)) / nx,
      wy = (Math.min(0.22, (frame * c.dy) / ((hi - lo) / ny)) * (hi - lo)) / ny;
    for (let i = 0; i <= nx; i++) {
      const u = Math.max(0, i / nx - wu),
        v = Math.min(1, i / nx + wu);
      face(
        out,
        slot,
        [at(u, lo), at(v, lo), at(v, hi), at(u, hi)].map((p) => shift(p, n, 0.035)),
        trim,
      );
    }
    for (let j = 0; j <= ny; j++) {
      const y = lo + ((hi - lo) * j) / ny,
        a = Math.max(lo, y - wy),
        b = Math.min(hi, y + wy);
      face(
        out,
        slot,
        [at(0, a), at(1, a), at(1, b), at(0, b)].map((p) => shift(p, n, 0.04)),
        trim,
      );
    }
  }
}
function buildMesseturm(out, m, level) {
  const c = settings[level];
  const curtain = (out, p, lo, hi, opts) => curtainLevel(out, p, lo, hi, c, opts);
  const key = 'n0170_messeturm',
    granite = [0.62, 0.32, 0.27],
    dark = [0.2, 0.29, 0.3],
    trim = [0.55, 0.56, 0.53];
  const base = cleanPlan(partPlan(m, part(key, 930215227)), c.tolerance),
    lobby = cleanPlan(partPlan(m, part(key, 927655685)), c.tolerance);
  mappedSolid(out, 'stone', base, 0, 0.25, granite);
  curtain(out, lobby, 0.25, 17, {
    dx: 2.3,
    dy: 5.55,
    tint: [0.31, 0.44, 0.46],
    frame: 0.045,
    trim,
  });
  mappedCap(out, 'glass', lobby, 17, [0.28, 0.36, 0.37]);
  // Four substantial corner piers expose the new curved glazed lobby on each face.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      box(
        out,
        'cladding',
        [Math.min(sx * 14, sx * 20.6), 0, Math.min(sz * 14, sz * 20.6)],
        [Math.max(sx * 14, sx * 20.6), 17, Math.max(sz * 14, sz * 20.6)],
        granite,
      );
    }
  curtain(out, base, 17, 30, {
    dx: 3.5,
    dy: 3.25,
    tint: dark,
    frame: 0.36,
    trim: granite,
    slot: 'cladding',
  });
  mappedCap(out, 'cladding', base, 30, granite);
  const cylinder = cleanPlan(partPlan(m, part(key, 183063659)), c.tolerance);
  curtain(out, cylinder, 30, 210, { dx: 1.8, dy: 3.6, tint: dark, frame: 0.085, trim });
  mappedCap(out, 'metal', cylinder, 210, [0.26, 0.29, 0.27]);
  // The signed OSM cross-shaped steles recede separately at188,194 and200 m.
  for (const [id, lo, hi] of [
    [927655688, 30, 188],
    [927655687, 188, 194],
    [927655686, 194, 200],
  ]) {
    const p = cleanPlan(partPlan(m, part(key, id)), c.tolerance);
    curtain(out, p, lo, hi, {
      dx: 3.5,
      dy: 3.3,
      tint: dark,
      frame: 0.4,
      trim: granite,
      slot: 'cladding',
    });
    mappedCap(out, 'cladding', p, hi, granite);
    bandPlan(out, p, hi, 0.16, 0.17, granite, 'cladding');
  }
  const upper = cleanPlan(partPlan(m, part(key, 183063661)), c.tolerance);
  curtain(out, upper, 210, 220, { dx: 1.65, dy: 3.3, tint: [0.24, 0.33, 0.34], frame: 0.11, trim });
  mappedCap(out, 'metal', upper, 220, [0.26, 0.29, 0.27]);
  const diamond = partPlan(m, part(key, 183063660));
  const center = diamond.reduce(
    (s, p) => [s[0] + p[0] / diamond.length, s[1] + p[1] / diamond.length],
    [0, 0],
  );
  const scaled = (s) =>
    diamond.map((p) => [center[0] + (p[0] - center[0]) * s, center[1] + (p[1] - center[1]) * s]);
  // Three sloping roof stages, separated by narrow recessed glazed belts.
  const roofs = [
    [220, 232, 0.995, 0.68],
    [233.1, 244.1, 0.65, 0.345],
    [245.2, 256.5, 0.32, 0.002],
  ];
  for (const [lo, hi, s0, s1] of roofs) {
    const a = scaled(s0),
      b = scaled(s1);
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length,
        q = [
          [a[i][0], lo, a[i][1]],
          [a[k][0], lo, a[k][1]],
          [b[k][0], hi, b[k][1]],
          [b[i][0], hi, b[i][1]],
        ];
      face(out, 'metal', q, [0.18, 0.225, 0.24]);
      const count = Math.ceil(Math.hypot(a[k][0] - a[i][0], a[k][1] - a[i][1]) / c.roofPitch);
      for (let j = 0; c.roofPitch && j <= count; j++)
        beam(
          out,
          'metal',
          lerp(q[0], q[1], j / count),
          lerp(q[3], q[2], j / count),
          0.055,
          0.075,
          [0.44, 0.5, 0.5],
        );
    }
    mappedCap(out, 'metal', b, hi, metal);
    bandPlan(out, a, lo, 0.22, 0.18, [0.54, 0.56, 0.5], 'metal');
    if (hi < 256) {
      const next = scaled(s1 * 0.955);
      curtain(out, next, hi, hi + 1.1, {
        dx: 1.2,
        dy: 1.2,
        tint: [0.21, 0.29, 0.29],
        frame: 0.055,
        trim,
      });
      mappedCap(out, 'metal', next, hi + 1.1, metal);
    }
  }
  // Four signed pointed glass bays continue the facade centerlines up the steles.
  for (let a = 0; a < 4; a++) {
    const theta = (a * Math.PI) / 2,
      c = Math.cos(theta),
      s = Math.sin(theta),
      P = (x, y, z) => [x * c - z * s, y, x * s + z * c];
    for (let y = 17; y < 30; y += c.dy || 13)
      for (const sign of [-1, 1]) {
        const q = [
          P(sign * 2.15, y, 20.6),
          P(0, y, 22.7),
          P(0, Math.min(30, y + (c.dy || 13)), 22.7),
          P(sign * 2.15, Math.min(30, y + (c.dy || 13)), 20.6),
        ];
        if (sign < 0) q.reverse();
        panel(out, q, [0.27, 0.36, 0.36], 0.06, trim);
      }
  }
}

function skylineOutput(out) {
  return {
    addTriangle(slot, _ref, points, normal, uv, color) {
      const graph = scope.surfaceOverrides[slot]?.graph,
        mean = scope.sourceFacts.surfaceMeans[graph] ?? [1, 1, 1];
      out.addTriangle(
        'glass',
        'palette:#ffffff',
        points,
        normal,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    },
    addQuad(slot, _ref, points, normal, uv, color) {
      const graph = scope.surfaceOverrides[slot]?.graph,
        mean = scope.sourceFacts.surfaceMeans[graph] ?? [1, 1, 1];
      out.addQuad(
        'glass',
        'palette:#ffffff',
        points,
        normal,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    },
  };
}

export const buildMesseturmCloseup = (out) => buildMesseturm(out, map, 'closeup');
export const buildMesseturmStreet = (out) => buildMesseturm(out, map, 'street');
export const buildMesseturmDistrict = (out) => buildMesseturm(out, map, 'district');
export const buildMesseturmSkyline = (out) => buildMesseturm(skylineOutput(out), map, 'skyline');

export const buildMesseturmReviewedMaster = (out) => buildMesseturm(out, map, 'closeup');
