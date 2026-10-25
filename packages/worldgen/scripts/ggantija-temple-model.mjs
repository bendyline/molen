/** ggantija: the mapped roofless Ġgantija wall mass and its large limestone faces. */
export const ggantijaCandidateId = 'ggantija';

function stone(f, block, detail) {
  const { center, width, depth, bottom, height, angle, seed } = block,
    c = Math.cos(angle),
    s = Math.sin(angle),
    chamfer = detail < 2 ? 0 : Math.min(width, depth) * 0.18,
    ring =
      chamfer === 0
        ? [
            [-width / 2, -depth / 2],
            [width / 2, -depth / 2],
            [width / 2, depth / 2],
            [-width / 2, depth / 2],
          ]
        : [
            [-width / 2 + chamfer, -depth / 2],
            [width / 2 - chamfer, -depth / 2],
            [width / 2, -depth / 2 + chamfer],
            [width / 2, depth / 2 - chamfer],
            [width / 2 - chamfer, depth / 2],
            [-width / 2 + chamfer, depth / 2],
            [-width / 2, depth / 2 - chamfer],
            [-width / 2, -depth / 2 + chamfer],
          ],
    pose = (p, y) => [center[0] + p[0] * c - p[1] * s, y, center[1] + p[0] * s + p[1] * c],
    lower = ring.map((p) => pose(p, bottom)),
    upper = ring.map((p, i) =>
      pose(
        p,
        bottom + height + (((seed * 13 + i * 7) % 17) / 17 - 0.5) * Math.min(0.24, height * 0.16),
      ),
    );
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      dx = upper[j][0] - upper[i][0],
      dz = upper[j][2] - upper[i][2];
    f('blocks', [lower[i], lower[j], upper[j], upper[i]], [dz, 0, -dx]);
  }
  for (let i = 1; i < upper.length - 1; i++)
    f('blocks', [upper[0], upper[i], upper[i + 1]], [0, 1, 0]);
}

export function buildGgantija(f, detail, r) {
  for (const triangle of r.groundTriangles) f('ground', triangle, [0, 1, 0]);
  const ring = r.wallControls;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b.point[0] - a.point[0],
      dz = b.point[1] - a.point[1];
    f(
      'rubble',
      [
        [a.point[0], a.bottomY, a.point[1]],
        [b.point[0], b.bottomY, b.point[1]],
        [b.point[0], b.topY, b.point[1]],
        [a.point[0], a.topY, a.point[1]],
      ],
      [r.winding * dz, 0, -r.winding * dx],
    );
  }
  for (const triangle of r.wallTriangles) {
    f(
      'rubble',
      triangle.map((i) => [ring[i].point[0], ring[i].topY, ring[i].point[1]]),
      [0, 1, 0],
    );
    f(
      'rubble',
      triangle.map((i) => [ring[i].point[0], ring[i].bottomY, ring[i].point[1]]),
      [0, -1, 0],
    );
  }
  if (detail === 0) return;
  for (const block of r.stones) if (block.minimumDetail <= detail) stone(f, block, detail);
}
