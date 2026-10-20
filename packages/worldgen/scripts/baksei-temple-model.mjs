/** 'N0530': N0530: four laterite tiers, four steep stairs and the surviving east-facing brick shrine. */
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

function pose(f, x, y, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + c * u - s * w, y + v, z + s * u + c * w]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function shrine(f, p, detail) {
  const w = p.width,
    d = p.depth,
    h = p.bodyHeight,
    door = p.doorWidth;
  for (const [k, angle] of [-Math.PI / 2, 0, Math.PI / 2, Math.PI].entries()) {
    const alongX = k % 2 === 0,
      span = alongX ? d : w,
      half = alongX ? w / 2 : d / 2;
    const front = pose(
        f,
        -Math.sin(angle) * (half - 0.325),
        0,
        Math.cos(angle) * (half - 0.325),
        angle,
      ),
      primary = k === 0,
      pier = (span - door) / 2,
      bottom = primary ? 0 : 0.45;
    for (const side of [-1, 1])
      box(front, 'brick', (side * (door + pier)) / 2, bottom, 0, pier, h - bottom, 0.65);
    box(front, 'brick', 0, p.doorHeight, 0, door, h - p.doorHeight, 0.65);
    if (!primary) {
      box(front, 'brick', 0, 0, 0, door, 0.45, 0.65);
      box(front, 'brick', 0, 0.45, -0.245, door, p.doorHeight - 0.45, 0.16);
    }
    if (detail >= 1) {
      for (const side of [-1, 1]) {
        box(front, 'brick', side * (span / 2 - 0.32), 0, 0.36, 0.4, h, 0.32);
        box(front, 'stone', side * (door / 2 + 0.15), 0, 0.4, 0.23, p.doorHeight + 0.2, 0.24);
        if (detail >= 2)
          for (const y of [0.18, 0.42, 2.5, 2.75])
            box(front, 'carved', side * (door / 2 + 0.15), y, 0.43, 0.34, 0.1, 0.28);
      }
      box(front, 'carved', 0, p.doorHeight, 0.4, door + 0.75, 0.4, 0.42);
      if (primary && detail >= 2)
        for (const x of [-0.7, 0, 0.7])
          box(front, 'carved', x, p.doorHeight + 0.22, 0.64, 0.38, 0.15, 0.12);
    }
  }
  for (const [y, width, depth, thickness] of [
    [-0.55, w + 0.7, d + 0.7, 0.28],
    [-0.27, w + 0.35, d + 0.35, 0.27],
    [h - 0.42, w + 0.3, d + 0.3, 0.18],
    [h - 0.24, w + 0.65, d + 0.65, 0.24],
  ])
    box(f, y < 0 ? 'stone' : 'brick', 0, y, 0, width, thickness, depth);
  const profile =
    detail === 0
      ? [
          [h, 7],
          [5.8, 6],
          [7.5, 4.6],
          [8.7, 2.8],
          [9.2, 1.7],
        ]
      : [
          [h, 7],
          [4.55, 7.2],
          [4.85, 6.5],
          [5.8, 5.9],
          [6.05, 6.2],
          [6.3, 5.1],
          [7.35, 4.5],
          [7.55, 4.8],
          [7.9, 3.8],
          [8.65, 2.9],
          [9.2, 1.7],
        ];
  loft(
    (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [
          x,
          y + (detail >= 2 && y > 6 ? 0.1 * Math.sin(x * 2.1 + z * 1.7 + y * 0.9) : 0),
          (z * d) / w,
        ]),
        n,
      ),
    'brick',
    0,
    0,
    profile,
    detail >= 1,
  );
}
export function buildBakseiTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    native = ([u, v]) => [c * u - s * v, s * u + c * v],
    grade = (u, v) => sampleTerrain(...native([u, v]));
  const f = (role, ps, n) => {
    if (detail === 0 && n[1] < -0.5) return;
    face(
      role,
      ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
  };
  for (const tier of r.tiers) {
    const body = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => {
          const q = (y - tier.low) / (tier.high - tier.low),
            scale = 1 - q * 0.025;
          return [u * scale, tier.groundFollowingBottom && y < 0 ? grade(u, v) + y : y, v * scale];
        }),
        n,
      );
    for (const p of tier.body) prism(body, 'laterite', p, tier.low, tier.high);
    for (const p of tier.cornice) prism(f, 'laterite', p, tier.high - 0.18, tier.high + 0.08);
  }
  for (const stair of r.stairs) {
    const front = pose(f, 0, 0, 0, stair.angle),
      steps = [5, 22, 32, 38][detail],
      run = stair.outer - stair.inner,
      topAt = (v) => stair.topY - ((v - stair.inner) / run) * (stair.topY - stair.bottomY);
    for (let i = 0; i < steps; i++) {
      const start = stair.inner + (i * run) / steps,
        end = stair.inner + ((i + 1) * run) / steps,
        top = topAt(start);
      box(
        front,
        'stone',
        stair.offset,
        stair.foundationBase,
        (start + end) / 2,
        stair.width,
        top - stair.foundationBase,
        end - start + 0.012,
      );
    }
    for (const side of [-1, 1]) {
      const x = stair.offset + (side * (stair.width + stair.cheekWidth)) / 2,
        p = rect(x, (stair.inner + stair.outer) / 2, stair.cheekWidth, run);
      prism(
        (role, ps, n) =>
          front(
            role,
            ps.map(([u, y, v]) => [u, y === 0 ? stair.foundationBase : topAt(v) + 0.35, v]),
            n,
          ),
        'laterite',
        p,
        0,
        1,
      );
      if (detail >= 1)
        for (const tier of r.tiers.slice(0, 3)) {
          const v = stair.inner + ((stair.topY - tier.high) / (stair.topY - stair.bottomY)) * run;
          box(
            front,
            'laterite',
            x,
            stair.foundationBase,
            v,
            stair.cheekWidth + 0.18,
            tier.high + 0.48 - stair.foundationBase,
            0.8,
          );
        }
    }
  }
  const p = r.shrine,
    at = pose(f, p.center[0], p.floorY, p.center[1]);
  shrine(at, p, detail);
  if (detail >= 1) {
    const east = pose(at, p.width / 2, 0, 0, -Math.PI / 2);
    for (let i = 0; i < 3; i++)
      box(east, 'stone', 0, -0.5, (i + 0.5) * 0.35, 1.9, 0.5 - i * 0.14, 0.37);
  }
}
