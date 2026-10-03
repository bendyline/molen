/** Monnow's mapped retaining walls and DSM-constrained approaches; no modified terrain. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const site = JSON.parse(
  readFileSync(structureSourcePath('n0015_monnow_bridge', 'site-approaches.json')),
);
const frame = JSON.parse(
  readFileSync(structureSourcePath('n0015_monnow_bridge', 'map-frame.json')),
);
const ring = frame.geometry.outline.slice(0, -1);
const atX = (a, b, x) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
const west = site.walls['172233193'].localPoints;
const east = site.walls['172233195'].localPoints;
const eastNorth = site.walls['855452310'].localPoints.slice(-3);
const westLimit = atX(west[0], west[1], -24);
const eastLimit = atX(east[0], east[1], 23);
const westCap = [[-24, -4.5], ring[0], ring[1], ring[2], west[1], westLimit];
const eastCap = [
  ring[10],
  ...eastNorth.slice(1),
  [23, eastNorth.at(-1)[1]],
  eastLimit,
  east[1],
  ring[9],
];
export const monnowRoadOutline = [
  westCap[0],
  westLimit,
  west[1],
  ...ring.slice(2, 10),
  east[1],
  eastLimit,
  [23, eastNorth.at(-1)[1]],
  ...eastNorth.toReversed(),
  ...ring.slice(11),
];

function measuredHeight(x) {
  const a = site.roadHeights.findLast((point) => point[0] <= x) ?? site.roadHeights[0];
  const b = site.roadHeights.find((point) => point[0] >= x) ?? site.roadHeights.at(-1);
  return (
    a[1] + (b[1] - a[1]) * (a[0] === b[0] ? 0 : (x - a[0]) / (b[0] - a[0])) - site.originHeight
  );
}
export function monnowApproachHeight(x, deck) {
  if (x >= -18 && x <= 16) return deck(x) + 0.045;
  // Match the independently fitted bridge crown at each seam. This tiny correction
  // fades out at the road join; it is an authored surface, never a terrain edit.
  const end = x < 0 ? -18 : 16,
    limit = x < 0 ? -24 : 23;
  const weight = Math.max(0, Math.min(1, (x - limit) / (end - limit)));
  return measuredHeight(x) + (deck(end) + 0.045 - measuredHeight(end)) * weight;
}

export function buildMonnowApproaches(out, { deck, cut, extrude, tint, mortar, buff }) {
  const surface = (x) => monnowApproachHeight(x, deck);
  for (const poly of [westCap, eastCap]) {
    const winding = poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    // Short strips preserve the measured slope. Closed fill beneath the pavement
    // represents the retained earth volume, including the filtered DTM bank edge.
    for (
      let x = Math.min(...poly.map((p) => p[0]));
      x < Math.max(...poly.map((p) => p[0]));
      x += 0.2
    ) {
      const strip = cut(cut(poly, 0, x, 1), 0, x + 0.2, -1);
      if (strip.length < 3) continue;
      out.addCap(
        'road',
        'palette:#ffffff',
        strip,
        [],
        (p) => surface(p[0]),
        [0, 1, 0],
        (p) => p,
        [0.235, 0.22, 0.183],
      );
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / count);
        const q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count);
        const face = [
          [p[0], 0, p[1]],
          [q[0], 0, q[1]],
          [q[0], surface(q[0]), q[1]],
          [p[0], surface(p[0]), p[1]],
        ];
        if (winding > 0) face.reverse();
        quad(out, 'sandstone', face, normalFor(...face), mortar);
      }
    }
  }
  const wallPaths = [[ring[2], west[1], westLimit], [ring[9], east[1], eastLimit], eastNorth];
  for (const path of wallPaths)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const c = (b[0] - a[0]) / length,
        s = (b[1] - a[1]) / length;
      const point = ([x, y, z]) => [a[0] + c * x - s * z, y, a[1] + s * x + c * z];
      const normal = ([x, y, z]) => [c * x - s * z, y, s * x + c * z];
      const local = {
        addQuad: (slot, ref, points, n, uv, color) =>
          out.addQuad(slot, ref, points.map(point), normal(n), uv, color),
        addConvexPolygon: (slot, ref, points, n, uv, color) =>
          out.addConvexPolygon(slot, ref, points.map(point), normal(n), uv, color),
      };
      for (let u = 0; u < length; u += 0.38) {
        const v = Math.min(length, u + 0.38),
          top = surface(a[0] + (c * (u + v)) / 2) + 1.26;
        // Backing, separate rubble courses, broad weathered copings on actual wall lines.
        box(local, 'sandstone', [u, 0, -0.24], [v, top, 0.24], mortar);
        for (let y = 0.02, row = 0; y < top; y += 0.28, row++) {
          const poly = [
            [u + 0.012, y],
            [v - 0.012, y],
            [v - 0.012, Math.min(top, y + 0.257)],
            [u + 0.012, Math.min(top, y + 0.257)],
          ];
          for (const sign of [-1, 1])
            extrude(
              local,
              poly,
              sign * 0.241 - 0.025,
              sign * 0.241 + 0.025,
              tint(a[0] * 37 + u * 13 + row * 5),
              'sandstone',
              false,
              true,
            );
        }
        box(
          local,
          'sandstone',
          [u, top, -0.31],
          [v, top + 0.14, 0.31],
          buff.map((v) => v - 0.055),
        );
      }
    }
}
