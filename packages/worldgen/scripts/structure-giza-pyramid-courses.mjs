import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const stoneColors = ['b6a482', 'b7a78d', 'bea988', 'b2a182', 'c7b698', 'c0ac8f'].map(rgb);
const casingColors = ['c9c1a9', 'c4bba3', 'cfc7af', 'cbc3af'].map(rgb);
const graniteColors = ['a08d7d', 'a08a7a', 'ad9885', '9b8878'].map(rgb);
export const pyramidSurfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  casing: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (n) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const tileColors = { limestone: stoneColors, casing: casingColors, granite: graniteColors };

function triangle(out, material, points, color, toward) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, axis) => sum + value * toward[axis], 0) < 0) {
    points.reverse();
    normal = normalFor(...points);
  }
  out.addTriangle(material, '', points, normal, [], color);
}

function quad(out, material, corners, color, toward) {
  triangle(out, material, corners.slice(0, 3), color, toward);
  triangle(out, material, [corners[0], corners[2], corners[3]], color, toward);
}

/** Build the surviving laid-stone core from its mapped corners and measured exterior height. */
export function buildGizaPyramid(out, site, detail) {
  const { corners, height, topScale, casingHeight, graniteHeight, breach, footing } = site;
  const count = [12, 29, 58, 102][detail];
  const segments = [1, 2, 7, 21][detail];
  const scale = (y) => lerp(1, topScale, y / height);
  const courseHeights = [
    0,
    ...Array.from({ length: count }, (_, i) => {
      const t = (i + 1) / count;
      return height * (t - 0.16 * t * (1 - t));
    }),
  ];
  for (const [edge, start] of corners.entries()) {
    const end = corners[(edge + 1) % corners.length];
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const outward = [(end[1] - start[1]) / distance, 0, (start[0] - end[0]) / distance];
    const north = outward[2] < -0.9;
    const inset = (u, y) => {
      if (!breach || !north) return 0;
      const mid = breach.center + 0.015 * Math.sin(y / 6.9);
      const side = 1 - smooth(Math.abs(u - mid) / breach.width);
      return breach.depth * side * smooth((y - 5) / 11) * smooth((breach.upper - y) / 11);
    };
    const point = (u, y, width) => [
      lerp(start[0], end[0], u) * width - outward[0] * inset(u, y),
      y,
      lerp(start[1], end[1], u) * width - outward[2] * inset(u, y),
    ];
    const bottomMaterial = graniteHeight ? 'granite' : 'limestone';
    quad(
      out,
      bottomMaterial,
      [point(0, footing, 1), point(1, footing, 1), point(1, 0, 1), point(0, 0, 1)],
      tileColors[bottomMaterial][0],
      outward,
    );
    for (let row = 0; row < count; row++) {
      const low = courseHeights[row],
        high = courseHeights[row + 1];
      const bands =
        breach && north ? Math.max(8, segments) : Math.max(1, Math.round(segments * scale(low)));
      const slope =
        casingHeight && low >= casingHeight - 1 ? 0.89 : [0.94, 0.7, 0.41, 0.31][detail];
      const base = scale(low),
        next = scale(high),
        front = lerp(base, next, slope);
      const joins = Array.from({ length: bands + 1 }, (_, i) => i / bands);
      if (breach && north) {
        joins.push(breach.center - breach.width, breach.center, breach.center + breach.width);
        joins.sort((a, b) => a - b);
      }
      for (let j = 1; j < joins.length; j++) {
        const a = joins[j - 1],
          b = joins[j];
        if (b - a < 1e-6) continue;
        const mid = (a + b) * 0.5;
        const scrapedCasingEdge =
          casingHeight +
          2.25 * Math.cos(8.1 * mid + 2.1 * edge) +
          1.1 * Math.sin(19 * mid + 3.4 * edge);
        const material =
          casingHeight && (low + high) * 0.5 >= scrapedCasingEdge
            ? 'casing'
            : graniteHeight && low < graniteHeight * (0.78 + 0.22 * Math.cos(9.7 * mid + edge))
              ? 'granite'
              : 'limestone';
        const palette = tileColors[material];
        const variation = ((row * 73856093) ^ (edge * 19349663) ^ (j * 83492791)) >>> 0;
        const color = palette[variation % palette.length];
        const bottomA = point(a, low, base),
          bottomB = point(b, low, base);
        const topA = point(a, high, front),
          topB = point(b, high, front);
        quad(out, material, [bottomA, bottomB, topB, topA], color, outward);
        quad(
          out,
          material,
          [topA, topB, point(b, high, next), point(a, high, next)],
          color,
          [0, 1, 0],
        );
      }
    }
  }
  // Close the top and underside. The tiny surviving platform preserves a damaged summit.
  const topMaterial = casingHeight ? 'casing' : 'limestone';
  quad(
    out,
    topMaterial,
    corners.map(([x, z]) => [x * topScale, height, z * topScale]),
    tileColors[topMaterial][0],
    [0, 1, 0],
  );
  const bottomMaterial = graniteHeight ? 'granite' : 'limestone';
  quad(
    out,
    bottomMaterial,
    corners.map(([x, z]) => [x, footing, z]),
    tileColors[bottomMaterial][0],
    [0, -1, 0],
  );
}
