/** Browser exteriors preserve the four independently mapped triangular shafts.
 * The original detailed buildBoc master remains unchanged in signature-tower-next-models.
 * Continuous glazing and clipped full-length mullions replace per-pane frame rings.
 */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const id = 'bank_of_china_tower';
const silver = [0.72, 0.76, 0.77],
  glazing = [0.31, 0.42, 0.47];
const frame = JSON.parse(
  readFileSync(structureSourcePath(id, 'georeferencing-baseline.json'), 'utf8'),
);
const parts = partsEvidence(id);
const part = (id) => parts.find((p) => p.id === id);

function roofFor(p, plan) {
  const bearing = (+p.tags['roof:direction'] * Math.PI) / 180;
  const east = Math.sin(bearing),
    south = -Math.cos(bearing);
  const dir = [
    east * Math.cos(frame.heading) - south * Math.sin(frame.heading),
    east * Math.sin(frame.heading) + south * Math.cos(frame.heading),
  ];
  const projection = plan.map((p) => p[0] * dir[0] + p[1] * dir[1]);
  const low = Math.min(...projection),
    high = Math.max(...projection);
  return (q) =>
    +p.tags.height +
    5 -
    (+p.tags['roof:height'] * (q[0] * dir[0] + q[1] * dir[1] - low)) / (high - low);
}

// Clip a surface segment to the actual inclined roof. No floating mast or flat cap.
function belowRoof(a, b, roof, margin = 0) {
  const f = a[1] - roof([a[0], a[2]]) + margin;
  const g = b[1] - roof([b[0], b[2]]) + margin;
  if (f >= 0 && g >= 0) return;
  if (f > 0) a = lerp(a, b, f / (f - g));
  else if (g > 0) b = lerp(b, a, g / (g - f));
  if (Math.hypot(...b.map((v, i) => v - a[i])) > 0.02) return [a, b];
}

function strip(out, a, b, n, width, color = silver, lift = 0.03) {
  const length = Math.hypot(...b.map((v, i) => v - a[i]));
  if (length < 0.01) return;
  const d = b.map((v, i) => (v - a[i]) / length);
  const side = [d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]];
  const q = (p, sign) => p.map((v, i) => v + n[i] * lift + (side[i] * width * sign) / 2);
  face(out, 'metal', [q(a, 1), q(b, 1), q(b, -1), q(a, -1)], color);
}

function shaft(out, p, detail) {
  const plan = partPlan(frame, p),
    roof = roofFor(p, plan);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / length, 0, (b[0] - a[0]) / length];
    const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
    const top = Math.max(roof(a), roof(b));
    face(out, 'glass', [at(0, 0.35), at(1, 0.35), at(1, roof(b)), at(0, roof(a))], glazing);
    const frameLine = (aa, bb, width) => {
      if (detail.solidFrame)
        beam(out, 'metal', shift(aa, n, 0.18), shift(bb, n, 0.18), width, width * 1.22, silver);
      else strip(out, aa, bb, n, width, silver, 0.18);
    };
    frameLine(at(0, 0.35), at(0, roof(a)), 0.95);
    frameLine(at(0, roof(a)), at(1, roof(b)), 0.9);
    // These primary structural diagonals define the tower at every distance.
    for (let y = 8; y < top; y += 52) {
      for (const [aa, bb] of [
        [at(0, y), at(1, y + 52)],
        [at(1, y), at(0, y + 52)],
      ]) {
        const clipped = belowRoof(aa, bb, roof, 0.4);
        if (clipped) frameLine(...clipped, 0.72);
      }
    }
    if (!detail.pitch) continue;
    const count = Math.ceil(length / detail.pitch);
    for (let k = 1; k < count; k++) {
      const u = k / count,
        q = lerp(a, b, u);
      strip(out, at(u, 0.35), at(u, roof(q)), n, detail.mullion);
    }
    for (let y = 4.5; y < top - 0.05; y += detail.rows) {
      const clipped = belowRoof(at(0, y), at(1, y), roof, 0.04);
      if (clipped) strip(out, ...clipped, n, detail.mullion);
    }
  }
  let roofPoints = plan.map(([x, z]) => [x, roof([x, z]), z]);
  if (normalFor(...roofPoints)[1] < 0) roofPoints = roofPoints.toReversed();
  tri(
    out,
    'glass',
    roofPoints,
    glazing.map((v) => v * 1.08),
  );
  if (detail.roofPitch) {
    for (let axis = 0; axis < 2; axis++) {
      const other = 1 - axis;
      const low = Math.min(...plan.map((p) => p[axis])),
        high = Math.max(...plan.map((p) => p[axis]));
      for (let value = low + detail.roofPitch; value < high - 0.1; value += detail.roofPitch) {
        const hits = [];
        for (let i = 0; i < plan.length; i++) {
          const a = plan[i],
            b = plan[(i + 1) % plan.length];
          if ((a[axis] <= value && b[axis] > value) || (b[axis] <= value && a[axis] > value))
            hits.push(lerp(a, b, (value - a[axis]) / (b[axis] - a[axis])));
        }
        hits.sort((a, b) => a[other] - b[other]);
        if (hits.length < 2) continue;
        const [a, b] = hits;
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.15)
          beam(
            out,
            'metal',
            [a[0], roof(a) + 0.035, a[1]],
            [b[0], roof(b) + 0.035, b[1]],
            0.075,
            0.095,
            silver,
          );
      }
    }
  }
}

function build(out, detail) {
  const plan = localOutline(frame);
  mappedSolid(out, 'stone', plan, 0, 0.35, [0.47, 0.49, 0.48]);
  for (const id of [279949066, 279949067, 279949068, 279949069]) shaft(out, part(id), detail);
  const high = part(279949067),
    roof = roofFor(high, partPlan(frame, high));
  for (const id of [279949064, 279949065]) {
    const p = partPlan(frame, part(id));
    const x = p.reduce((s, q) => s + q[0] / p.length, 0),
      z = p.reduce((s, q) => s + q[1] / p.length, 0);
    const foot = roof([x, z]) - 0.3;
    loft(
      out,
      'metal',
      [
        [foot, 0.91],
        [337, 0.66],
        [359, 0.3],
        [367.4, 0.025],
      ].map(([y, r]) => radialRing(y, r, r, detail.sides, [x, z])),
      silver,
    );
    if (detail.collars)
      for (let y = 316; y < 359; y += 7)
        torus(out, 'metal', [x, y, z], 0.81 - (y - 316) * 0.011, 0.06, silver, detail.sides, 4);
  }
  for (const [x, z] of plan)
    box(out, 'metal', [x - 0.47, 0.35, z - 0.47], [x + 0.47, 12, z + 0.47], silver);
  // Lifted banking-hall belt; no speculative surrounding gardens or interiors.
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    beam(out, 'metal', [a[0], 8, a[1]], [b[0], 8, b[1]], 0.7, 0.9, silver);
  }
}

export const buildBankOfChinaSkyline = (out) => build(out, { sides: 6, solidFrame: false });
export const buildBankOfChinaDistrict = (out) =>
  build(out, { sides: 8, solidFrame: true, pitch: 6.2, rows: 16.6, mullion: 0.12 });
export const buildBankOfChinaStreet = (out) =>
  build(out, { sides: 12, solidFrame: true, pitch: 3.1, rows: 8.3, mullion: 0.09, roofPitch: 6.6 });
export const buildBankOfChinaCloseup = (out) =>
  build(out, {
    sides: 16,
    solidFrame: true,
    pitch: 1.55,
    rows: 4.15,
    mullion: 0.065,
    roofPitch: 1.65,
    collars: true,
  });
