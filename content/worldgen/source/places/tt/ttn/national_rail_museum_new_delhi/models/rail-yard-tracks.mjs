/** Ground-following museum sidings and the fixed rotating bridge at the outdoor gallery. */
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const palette = {
  ballast: rgb('9a8b75'),
  apron: rgb('9c7159'),
  rust: rgb('635951'),
  rail: rgb('84847d'),
  tie: rgb('76614b'),
  curb: rgb('9d9180'),
  pit: rgb('5e5144'),
  paint: rgb('6c4c41'),
  yellow: rgb('b0894b'),
};
const mix = (a, b, t) => a + (b - a) * t;
const at = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const unit = ([x, z]) => {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
};
const offset = (a, b) => unit([b[1] - a[1], a[0] - b[0]]);

function stations(points, ground, step) {
  const path = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance < 0.065) continue;
    const divisions = Math.max(1, Math.ceil(distance / step));
    for (let j = 1; j <= divisions; j++) path.push(at(a, b, j / divisions));
  }
  if (path.length < 2) return [];
  return path.map((p, i) => {
    const before = path[i - 1],
      after = path[i + 1];
    const left = before ? offset(before, p) : offset(p, after);
    const right = after ? offset(p, after) : left;
    const sum = [left[0] + right[0], left[1] + right[1]];
    const [x, z] = Math.hypot(...sum) > 0.001 ? unit(sum) : right;
    return { p, h: ground(p), x, z };
  });
}

function trackPoint(station, offset, rise) {
  return [station.p[0] + station.x * offset, station.h + rise, station.p[1] + station.z * offset];
}

function ribbon(out, slot, a, b, left, right, low, high, color) {
  face(
    out,
    slot,
    [
      trackPoint(a, right, high),
      trackPoint(a, left, low),
      trackPoint(b, left, low),
      trackPoint(b, right, high),
    ],
    color,
  );
}
function steel(out, a, b, center, lod) {
  const width = lod === 1 ? 0.078 : 0.037;
  ribbon(out, 'steel', a, b, center - width, center + width, 0.243, 0.243, palette.rail);
  if (lod > 1) {
    const edge = center - width;
    ribbon(out, 'steel', a, b, edge - 0.002, edge, 0.115, 0.243, palette.rust);
  }
  if (lod === 3) {
    const edge = center + width;
    ribbon(out, 'steel', a, b, edge, edge + 0.002, 0.243, 0.115, palette.rust);
  }
}

export function buildRailLine(out, points, ground, lod, { gauge, paved = false }) {
  const samples = stations(points, ground, [36, 24, 7, 3.2][lod]);
  const half = gauge * 0.5;
  const shoulder = half + 0.67;
  let untilTie = 0.35;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    ribbon(out, 'ballast', a, b, -shoulder, shoulder, 0.11, 0.11, palette.ballast);
    if (lod > 0) {
      steel(out, a, b, -half, lod);
      steel(out, a, b, half, lod);
    }
    if (lod > 1) {
      ribbon(out, 'ballast', a, b, -shoulder - 0.34, -shoulder, 0.012, 0.11, palette.ballast);
      ribbon(out, 'ballast', a, b, shoulder, shoulder + 0.34, 0.11, 0.012, palette.ballast);
    }
    if (paved && lod === 3) {
      ribbon(out, 'brick', a, b, -shoulder - 1.55, -shoulder - 0.44, 0.057, 0.057, palette.apron);
    }
    if (lod < 2) continue;
    const length = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    while (untilTie < length - 0.2) {
      const start = untilTie / length;
      const end = (untilTie + 0.18) / length;
      const along = (t) => ({
        p: at(a.p, b.p, t),
        h: mix(a.h, b.h, t),
        x: mix(a.x, b.x, t),
        z: mix(a.z, b.z, t),
      });
      const u = along(start),
        v = along(end),
        size = half + 0.35;
      ribbon(out, 'steel', u, v, -size, size, 0.136, 0.136, palette.tie);
      untilTie += lod === 3 ? 0.74 : 2.05;
    }
    untilTie = Math.max(0.1, untilTie - length);
  }
}

export function buildTurntable(out, ring, center, ground, lod) {
  const [x, z] = center;
  const [minX, maxX] = [Math.min(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[0]))];
  const level = Math.max(ground(center), ...ring.map(ground)) + 0.27;
  const factor = (p, t) => at(center, p, t);
  const flat = (p, y) => [p[0], y, p[1]];
  const floor = level - 0.2;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const aa = factor(a, 0.89),
      bb = factor(b, 0.89);
    face(
      out,
      'stone',
      [flat(b, level), flat(a, level), flat(aa, level), flat(bb, level)],
      palette.curb,
    );
    face(
      out,
      'stone',
      [flat(b, ground(b) - 0.055), flat(a, ground(a) - 0.055), flat(a, level), flat(b, level)],
      palette.curb,
    );
    triangle(out, 'ballast', [flat(bb, floor), flat(aa, floor), flat(center, floor)], palette.pit);
    if (lod > 0) {
      face(
        out,
        'stone',
        [flat(aa, level), flat(aa, floor), flat(bb, floor), flat(bb, level)],
        palette.curb,
      );
      const railInner = factor(a, 0.835),
        railNext = factor(b, 0.835);
      face(
        out,
        'steel',
        [
          flat(bb, floor + 0.015),
          flat(aa, floor + 0.015),
          flat(railInner, floor + 0.015),
          flat(railNext, floor + 0.015),
        ],
        palette.rail,
      );
    }
  }
  const start = minX + 0.57,
    end = maxX - 0.45;
  box(out, 'steel', [start, level - 0.28, z - 0.97], [end, level + 0.065, z + 0.97], palette.rust);
  if (lod < 1) return;
  for (const sign of [-1, 1]) {
    const rail = z + sign * 0.838;
    box(
      out,
      'steel',
      [start, level + 0.055, rail - 0.038],
      [end, level + 0.2, rail + 0.038],
      palette.rail,
    );
    const line = z + sign * 1.2;
    box(
      out,
      'metal',
      [start + 0.42, level - 0.048, line - 0.05],
      [end - 0.42, level + 0.12, line + 0.05],
      palette.paint,
    );
    if (lod > 1) {
      const count = lod === 3 ? 10 : 6;
      for (let i = 0; i < count; i++) {
        const u = mix(start + 0.67, end - 0.6, i / (count - 1));
        box(
          out,
          'metal',
          [u - 0.021, level, line - 0.021],
          [u + 0.021, level + 0.82, line + 0.021],
          palette.paint,
        );
      }
      box(
        out,
        'metal',
        [start + 0.62, level + 0.81, line - 0.032],
        [end - 0.58, level + 0.86, line + 0.032],
        palette.paint,
      );
    }
  }
  if (lod > 1)
    box(
      out,
      'metal',
      [x - 0.55, level, z - 1.74],
      [x + 0.55, level + 1.04, z - 1.14],
      palette.yellow,
    );
}
