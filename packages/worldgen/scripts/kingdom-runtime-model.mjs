/** Kingdom Centre: elliptical curtain wall, open catenary, curved bridge and both podium wings. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { normalFor } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0166_kingdom_centre',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  source: { tolerance: 0.055, dx: 1.8, dy: 4.5, slices: 64, seams: true },
  closeup: { tolerance: 0.055, dx: 1.8, dy: 4.5, slices: 64, seams: true },
  street: { tolerance: 0.15, dx: 3.6, dy: 9, slices: 48, seams: true },
  district: { tolerance: 0.5, dx: 12, dy: 24, slices: 24, seams: false },
  skyline: { tolerance: 1, dx: 0, dy: 0, slices: 16, seams: false },
};
function cleanPlan(plan, tolerance) {
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
const edges = (p) =>
  p
    .map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
const polygon = (out, slot, p, color) => {
  for (let i = 1; i < p.length - 1; i++) tri(out, slot, [p[0], p[i], p[i + 1]], color);
};
function clip(p, distance) {
  const q = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = distance(a),
      db = distance(b);
    if (da <= 0) q.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) q.push(lerp(a, b, da / (da - db)));
  }
  return q;
}
function curtain(out, p, lo, hi, c, tint, trim, width = 0.15, slot = 'metal') {
  for (const { a, b, len, n } of edges(p)) {
    const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
    face(out, 'glass', [at(0, lo), at(1, lo), at(1, hi), at(0, hi)], tint);
    if (c.dy)
      for (let y = lo + c.dy; y < hi - 0.1; y += c.dy)
        face(
          out,
          slot,
          [at(0, y - width), at(1, y - width), at(1, y + width), at(0, y + width)].map((p) =>
            shift(p, n, 0.04),
          ),
          trim,
        );
    if (c.dx) {
      const count = Math.max(1, Math.ceil(len / c.dx));
      for (let i = 0; i <= count; i++) {
        const u = Math.max(0, i / count - 0.04 / len),
          v = Math.min(1, i / count + 0.04 / len);
        face(
          out,
          slot,
          [at(u, lo), at(v, lo), at(v, hi), at(u, hi)].map((p) => shift(p, n, 0.05)),
          trim,
        );
      }
    }
  }
}
function build(out, level) {
  const c = settings[level],
    part = (id) =>
      cleanPlan(
        partPlan(
          map,
          map.elements.find((p) => p.id === id),
        ),
        c.tolerance,
      ),
    podium = part(264745917),
    plan = part(264745922),
    tint = [0.38, 0.5, 0.56],
    trim = [0.59, 0.67, 0.7];
  mappedSolid(out, 'stone', podium, 0, 0.35, [0.69, 0.63, 0.5]);
  curtain(
    out,
    podium,
    0.35,
    15.75,
    { ...c, dy: 5.1, dx: level === 'skyline' ? 0 : Math.max(6.2, c.dx) },
    [0.32, 0.36, 0.32],
    [0.7, 0.63, 0.51],
    0.48,
    'cladding',
  );
  mappedCap(out, 'stone', podium, 15.75, [0.74, 0.67, 0.52]);
  // Independently clipped east/west mapped lobes carry the photographed pale roofs.
  for (const sign of [-1, 1]) {
    const wing = clip(podium, (p) => 45 - sign * p[0]),
      cx = sign * 94,
      height = (p) => 27 - 11.2 * Math.max(Math.abs(p[0] - cx) / 50, Math.abs(p[1]) / 140),
      emit = (p) => {
        for (let i = 1; i < p.length - 1; i++) {
          const q = [p[0], p[i], p[i + 1]].map((p) => [p[0], height(p), p[1]]);
          const n = normalFor(...q);
          if (Math.abs(n[1]) < 1e-7) continue;
          if (n[1] < 0) [q[1], q[2]] = [q[2], q[1]];
          tri(out, 'metal', q, [0.72, 0.72, 0.66]);
        }
      };
    // Triangulate the concave outline first, then clip to each of four roof planes.
    // A center fan incorrectly crossed the mapped notches and reversed some faces.
    for (const ids of ShapeUtils.triangulateShape(
      wing.map((p) => new Vector2(...p)),
      [],
    )) {
      const t = ids.map((i) => wing[i]);
      for (const axis of [0, 1])
        for (const s of [-1, 1]) {
          const d = (p) => (axis === 0 ? (s * (p[0] - cx)) / 50 : (s * p[1]) / 140),
            other = (p) => (axis === 0 ? p[1] / 140 : (p[0] - cx) / 50);
          emit(
            clip(
              clip(
                clip(t, (p) => -d(p)),
                (p) => other(p) - d(p),
              ),
              (p) => -other(p) - d(p),
            ),
          );
        }
    }
    for (const { a, b } of edges(wing))
      face(
        out,
        'metal',
        [
          [a[0], 15.75, a[1]],
          [b[0], 15.75, b[1]],
          [b[0], height(b), b[1]],
          [a[0], height(a), a[1]],
        ],
        [0.72, 0.72, 0.66],
      );
  }
  const min = Math.min(...plan.map((p) => p[0])),
    max = Math.max(...plan.map((p) => p[0])),
    cx = (min + max) / 2,
    rx = (max - min) / 2;
  const roof = (x) =>
    205 + ((302.3 - 205) * (Math.cosh((2.1 * (x - cx)) / rx) - 1)) / (Math.cosh(2.1) - 1);
  for (const { a, b, len, n } of edges(plan)) {
    const cols = c.dx ? Math.max(1, Math.ceil(len / Math.max(c.dx, 1.8))) : 1;
    for (let i = 0; i < cols; i++) {
      const p = lerp(a, b, i / cols),
        q = lerp(a, b, (i + 1) / cols),
        hp = roof(p[0]),
        hq = roof(q[0]),
        at = (u, y) => [p[0] + (q[0] - p[0]) * u, y, p[1] + (q[1] - p[1]) * u];
      face(out, 'glass', [at(0, 0.35), at(1, 0.35), at(1, hq), at(0, hp)], tint);
      if (c.dy)
        for (let y = 0.35 + c.dy; y < Math.max(hp, hq); y += c.dy) {
          const poly = clip(
            [
              [0, y - 0.075],
              [1, y - 0.075],
              [1, y + 0.075],
              [0, y + 0.075],
            ],
            (p) => p[1] - (hp + (hq - hp) * p[0]),
          ).map(([u, y]) => shift(at(u, y), n, 0.035));
          polygon(out, 'metal', poly, trim);
        }
      if (c.dx) {
        const width = 0.04 / Math.hypot(q[0] - p[0], q[1] - p[1]),
          u = Math.min(width, 0.49);
        face(
          out,
          'metal',
          [at(0, 0.35), at(u, 0.35), at(u, hp + (hq - hp) * u), at(0, hp)].map((p) =>
            shift(p, n, 0.045),
          ),
          trim,
        );
      }
    }
  }
  const extent = (x) => {
    const hits = [];
    for (const { a, b } of edges(plan))
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    return [Math.min(...hits), Math.max(...hits)];
  };
  for (let i = 0; i < c.slices; i++) {
    const x0 = min + 0.0005 + ((max - min - 0.001) * i) / c.slices,
      x1 = min + 0.0005 + ((max - min - 0.001) * (i + 1)) / c.slices,
      a = extent(x0),
      b = extent(x1),
      h0 = roof(x0),
      h1 = roof(x1),
      p = [
        [x0, h0, a[0]],
        [x0, h0, a[1]],
        [x1, h1, b[1]],
        [x1, h1, b[0]],
      ];
    face(out, 'metal', p, [0.55, 0.64, 0.67]);
    if (c.seams && i % 3 === 0) {
      const n = normalFor(...p.slice(0, 3)),
        w = 0.035;
      face(
        out,
        'metal',
        [
          [x0 - w, h0, a[0]],
          [x0 - w, h0, a[1]],
          [x0 + w, h0, a[1]],
          [x0 + w, h0, a[0]],
        ].map((p) => shift(p, n, 0.03)),
        [0.64, 0.71, 0.73],
      );
    }
  }
  const bridge = part(984443070);
  mappedSolid(out, 'metal', bridge, 296.5, 297.2, [0.61, 0.67, 0.68]);
  curtain(out, bridge, 297.2, 301.85, c, [0.23, 0.37, 0.44], [0.67, 0.73, 0.75], 0.08);
  mappedSolid(out, 'metal', bridge, 301.85, 302.3, [0.66, 0.72, 0.73]);
  for (const id of [264745924, 264745925]) {
    const p = part(id);
    curtain(out, p, 296.3, 302.3, c, [0.45, 0.57, 0.61], [0.63, 0.68, 0.7]);
    mappedCap(out, 'metal', p, 302.3, [0.64, 0.7, 0.72]);
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
export const buildKingdomReviewedMaster = (out) => build(out, 'source');
export const buildKingdomCloseup = (out) => build(out, 'closeup');
export const buildKingdomStreet = (out) => build(out, 'street');
export const buildKingdomDistrict = (out) => build(out, 'district');
export const buildKingdomSkyline = (out) => build(skylineOutput(out), 'skyline');
