/** Whole weighted-catenary browser levels. The original detailed master remains unchanged. */

import { normalFor } from './authored-structure-mesh.mjs';
import { gatewayArch, gatewaySection } from './gateway-arch-model.mjs';
import { face, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const ft = 0.3048;
const A = 68.7672 * ft,
  C = 3.0022,
  L = 299.2239 * ft;
const silver = [0.91, 0.915, 0.92],
  seam = [0.73, 0.75, 0.77];
const windows = Array.from({ length: 16 }, (_, i) => (i - 7.5) * 1.16);
const windowHalfWidth = 0.6858 / 2,
  windowU = 0.57,
  windowHalfU = 0.1778 / (2 * 17 * ft);

function point(x, edge, u, depth = 0) {
  const section = gatewaySection(x),
    a = section.corners[edge],
    b = section.corners[(edge + 1) % 3];
  const p = a.map((v, i) => v + (b[i] - v) * u);
  if (depth) {
    const next = gatewaySection(x + 0.001),
      q = next.corners[edge];
    let n = normalFor(a, b, q);
    if (n.reduce((sum, v, i) => sum + v * (p[i] - section.center[i]), 0) < 0) n = n.map((v) => -v);
    return p.map((v, i) => v + n[i] * depth);
  }
  return p;
}

function clipped(points) {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (a[1] >= 0) output.push(a);
    if (a[1] < 0 !== b[1] < 0) {
      const t = -a[1] / (b[1] - a[1]);
      output.push([a[0] + t * (b[0] - a[0]), 0, a[2] + t * (b[2] - a[2])]);
    }
  }
  return output;
}

function patch(out, slot, x0, x1, edge, u0, u1, color, depth = 0) {
  const p = clipped([
    point(x0, edge, u0, depth),
    point(x1, edge, u0, depth),
    point(x1, edge, u1, depth),
    point(x0, edge, u1, depth),
  ]);
  if (p.length < 3) return;
  const center = gatewaySection((x0 + x1) / 2).center;
  const n = normalFor(...p),
    mid = p[0].map((_, i) => p.reduce((s, q) => s + q[i], 0) / p.length);
  if (n.reduce((s, v, i) => s + v * (mid[i] - center[i]), 0) < 0) p.reverse();
  for (let i = 1; i < p.length - 1; i++) triangle(out, slot, [p[0], p[i], p[i + 1]], color);
}

function shell(out, mode) {
  const steps = { skyline: 128, district: 64, street: 192 }[mode];
  const extent = L + 0.18;
  const samples = [
    ...Array.from({ length: steps + 1 }, (_, i) => -extent + (2 * extent * i) / steps),
    0,
    ...(mode === 'skyline'
      ? []
      : windows.flatMap((x) => [x - windowHalfWidth, x + windowHalfWidth])),
  ].sort((a, b) => a - b);
  const xs = samples.filter((x, i) => !i || x - samples[i - 1] > 1e-8);
  for (let edge = 0; edge < 3; edge++) {
    const uc = edge === 0 ? windowU : 1 - windowU;
    const us =
      mode === 'skyline'
        ? [0, 1]
        : edge === 2
          ? [0, 1 / 3, 2 / 3, 1]
          : [0, 1 / 3, uc - windowHalfU, uc + windowHalfU, 2 / 3, 1].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < us.length - 1; j++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          u = (us[j] + us[j + 1]) / 2;
        const opening =
          mode !== 'skyline' &&
          edge < 2 &&
          Math.abs(u - uc) < windowHalfU &&
          windows.some((c) => Math.abs(x - c) < windowHalfWidth);
        if (!opening) patch(out, 'stainless', xs[i], xs[i + 1], edge, us[j], us[j + 1], silver);
      }
  }
  // Glazed apertures have a true opening, four reveal faces and a recessed glass plane.
  if (mode !== 'skyline')
    for (const x of windows)
      for (const edge of [0, 1]) {
        const uc = edge === 0 ? windowU : 1 - windowU;
        const x0 = x - windowHalfWidth,
          x1 = x + windowHalfWidth,
          u0 = uc - windowHalfU,
          u1 = uc + windowHalfU;
        const coords = [
          [x0, u0],
          [x1, u0],
          [x1, u1],
          [x0, u1],
        ];
        for (let i = 0; i < 4; i++) {
          const a = coords[i],
            b = coords[(i + 1) % 4];
          const ps = [
            point(a[0], edge, a[1]),
            point(b[0], edge, b[1]),
            point(b[0], edge, b[1], -0.07),
            point(a[0], edge, a[1], -0.07),
          ];
          face(out, 'stainless', ps, silver);
          face(out, 'stainless', [...ps].reverse(), silver);
        }
        patch(out, 'glass', x0, x1, edge, u0, u1, [0.1, 0.15, 0.2], -0.065);
        patch(out, 'stainless', x0 - 0.016, x1 + 0.016, edge, u0 - 0.003, u0, silver, 0.003);
        patch(out, 'stainless', x0 - 0.016, x1 + 0.016, edge, u1, u1 + 0.003, silver, 0.003);
        patch(out, 'stainless', x0 - 0.016, x0, edge, u0, u1, silver, 0.003);
        patch(out, 'stainless', x1, x1 + 0.016, edge, u0, u1, silver, 0.003);
      }
  // Longitudinal shop joints: three plates across each face. Field station spacing is provisional.
  if (mode === 'street')
    for (let edge = 0; edge < 3; edge++)
      for (const u of [1 / 3, 2 / 3])
        for (let i = 0; i < steps; i++) {
          const x0 = -extent + (2 * extent * i) / steps,
            x1 = -extent + (2 * extent * (i + 1)) / steps;
          const half = 0.0025 / gatewaySection((x0 + x1) / 2).side;
          patch(out, 'stainless', x0, x1, edge, u - half, u + half, seam, 0.0015);
        }
  // Integrate arc length to place the 71 station lines on each half without distorted x spacing.
  const arc = [{ x: 0, s: 0 }];
  for (let i = 1; i <= 4096; i++) {
    const x = (extent * i) / 4096,
      a = gatewaySection(arc.at(-1).x).center,
      b = gatewaySection(x).center;
    arc.push({ x, s: arc.at(-1).s + Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  const total = arc.at(-1).s;
  if (mode === 'street')
    for (let station = 1; station <= 71; station++) {
      const t = station / 71,
        target = total * (0.74 * t + 0.26 * t * t);
      const k = arc.findIndex((v) => v.s >= target),
        a = arc[Math.max(0, k - 1)],
        b = arc[Math.max(1, k)];
      const x = a.x + ((b.x - a.x) * (target - a.s)) / (b.s - a.s);
      for (const sign of [-1, 1])
        for (let edge = 0; edge < 3; edge++) {
          const half = 0.003 / Math.hypot(1, ((-A * C) / L) * Math.sinh((C * x) / L));
          for (let j = 0; j < 3; j++)
            patch(
              out,
              'stainless',
              sign * x - half,
              sign * x + half,
              edge,
              j / 3,
              (j + 1) / 3,
              seam,
              0.002,
            );
        }
    }
  // Closed level contact triangles; no underground visitor centre or outdated entrances are embedded.
  for (const sign of [-1, 1]) {
    const base = [];
    for (let corner = 0; corner < 3; corner++) {
      let lo = L - 1,
        hi = L + 1;
      for (let i = 0; i < 48; i++) {
        const x = (lo + hi) / 2;
        if (gatewaySection(x).corners[corner][1] > 0) lo = x;
        else hi = x;
      }
      const p = gatewaySection((sign * (lo + hi)) / 2).corners[corner];
      base.push([p[0], 0, p[2]]);
    }
    if (normalFor(...base)[1] > 0) base.reverse();
    triangle(out, 'stainless', base, silver);
  }
  // Low service hatch at the extrados crown, approximated from the HSR roof photographs.
  box(out, 'stainless', [-0.6, 191.986, -0.46], [0.6, 192.015, 0.46], silver);
  box(out, 'shadow', [-0.55, 192.016, -0.4], [0.55, 192.02, 0.4], [0.19, 0.21, 0.22]);
}

export function buildGatewaySkyline(out) {
  const mean = [0.81896, 0.822889, 0.822889],
    wrap = {};
  for (const name of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    wrap[name] = (slot, ref, ps, n, uv, color) =>
      out[name](
        slot,
        ref,
        ps,
        n,
        uv,
        color.map((v, i) => v * mean[i]),
      );
  shell(wrap, 'skyline');
}
export function buildGatewayDistrict(out) {
  shell(out, 'district');
}
export function buildGatewayStreet(out) {
  shell(out, 'street');
}
export function buildGatewayCloseup(out) {
  gatewayArch.build(out);
}
