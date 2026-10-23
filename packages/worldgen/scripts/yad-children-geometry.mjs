/** 'N0748_CHILDREN': rock-cut portal, hewn approach and unfinished pillar field. */
import earcut from 'earcut';
import { prism, rect } from './khmer-structure-geometry.mjs';

export function buildYadChildren(face, detail, r) {
  const Y = r.floorY,
    floor = (x) => Y - 0.04 * (5.5 - x),
    P = (p) => p;
  const f = (role, ps, n) => face(role, ps.map(P), n);
  function solid(role, p, low, high) {
    const rings = [p.outline, ...(p.holes ?? [])],
      flat = rings.flat(),
      holes = [];
    let k = rings[0].length;
    for (const h of rings.slice(1)) {
      holes.push(k);
      k += h.length;
    }
    const ix = earcut(flat.flat(), holes),
      lo = flat.map(([x, z]) => [x, low(x, z), z]),
      hi = flat.map(([x, z]) => [x, high(x, z), z]);
    for (let i = 0; i < ix.length; i += 3) {
      f(
        role,
        ix.slice(i, i + 3).map((k) => lo[k]),
        [0, -1, 0],
      );
      f(
        role,
        ix.slice(i, i + 3).map((k) => hi[k]),
        [0, 1, 0],
      );
    }
    let o = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri],
        sign =
          Math.sign(
            ring.reduce(
              (s, p, i) =>
                s + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
              0,
            ),
          ) * (ri ? -1 : 1);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        f(
          role,
          [lo[o + i], lo[o + j], hi[o + j], hi[o + i]],
          [(ring[j][1] - ring[i][1]) * sign, 0, (ring[i][0] - ring[j][0]) * sign],
        );
      }
      o += ring.length;
    }
  }
  function stone(role, p, index = 0) {
    const w = p.width / 2,
      d = p.depth / 2,
      c = detail >= 2 ? 0.09 : 0;
    const outline =
      detail >= 2
        ? [
            [-w + c, -d],
            [w - c, -d],
            [w, -d + c],
            [w, d - c],
            [w - c, d],
            [-w + c, d],
            [-w, d - c],
            [-w, -d + c],
          ]
        : [
            [-w, -d],
            [w, -d],
            [w, d],
            [-w, d],
          ];
    const lo = outline.map(([x, z]) => [p.x + x, p.base, p.z + z]),
      hi = outline.map(([x, z], i) => [
        p.x + x,
        p.base +
          p.height +
          (p.topOffsets?.[detail >= 2 ? i : i * 2] ?? (((i + index) % 3) - 1) * 0.06),
        p.z + z,
      ]);
    const shoulder = hi.map(([x, y, z]) => [x, Math.min(y - 0.07, p.base + p.height - 0.22), z]);
    if (detail >= 3)
      for (const pnt of hi) {
        pnt[0] = p.x + (pnt[0] - p.x) * 0.93;
        pnt[2] = p.z + (pnt[2] - p.z) * 0.93;
      }
    const center = [p.x, p.base + p.height + (p.topCenterOffset ?? -0.045), p.z];
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      f(
        role,
        [lo[i], lo[j], detail >= 3 ? shoulder[j] : hi[j], detail >= 3 ? shoulder[i] : hi[i]],
        [outline[j][1] - outline[i][1], 0, outline[i][0] - outline[j][0]],
      );
      if (detail >= 3)
        f(
          role,
          [shoulder[i], shoulder[j], hi[j], hi[i]],
          [outline[j][1] - outline[i][1], 0, outline[i][0] - outline[j][0]],
        );
      f(role, [center, hi[i], hi[j]], [0, 1, 0]);
      f(role, [[p.x, p.base, p.z], lo[j], lo[i]], [0, -1, 0]);
    }
  }
  solid(
    'floor',
    { outline: r.floorOutline, holes: [] },
    () => r.foundationY,
    (x) => floor(x),
  );
  // Rock roof and side lining bound a genuine finite cave-mouth volume.
  solid(
    'rock',
    { outline: r.roofOutline, holes: [] },
    (x) => Y + 3 + 0.04 * x,
    (x) => Y + 3.7 + 0.08 * x,
  );
  // A sloping rock shoulder covers the proxy's vertical outer lining and meets original grade.
  const moundHeights = new Map(r.moundOutline.map((p, i) => [p.join(','), r.moundHeights[i]]));
  for (let i = 0; i < r.roofOutline.length; i++) {
    if (i === 2) continue; // The front is the real pierced arch, not a solid rock shoulder.
    const j = (i + 1) % r.roofOutline.length;
    solid(
      'rock',
      {
        outline: [r.roofOutline[i], r.roofOutline[j], r.moundOutline[j], r.moundOutline[i]],
        holes: [],
      },
      (x, z) => Math.min(r.foundationY, (moundHeights.get([x, z].join(',')) ?? Y) - 0.15),
      (x, z) => moundHeights.get([x, z].join(',')) ?? Y + 3.7 + 0.08 * x,
    );
  }
  for (const z of [-2.3, 2.3])
    solid(
      'lining',
      rect(-1.45, z, 11.5, 1.7),
      () => r.foundationY,
      (x) => Y + 3.18 + 0.04 * x,
    );
  solid(
    'lining',
    rect(-6.75, 0, 0.9, 3.1),
    () => r.foundationY,
    () => Y + 3.0,
  );
  for (const p of r.arch)
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([z, x, y]) => [x, Y + y, z]),
          [n[1], n[2], n[0]],
        ),
      'rock',
      p,
      3.8,
      5.4,
      true,
    );
  // The pale cut stones rise along the left side of the approach, backed by rock.
  for (let i = 0; i < 9; i++)
    stone(
      'pillar',
      {
        x: 6.25 - i * 1.05,
        z: 1.74,
        base: floor(6.25 - i * 1.05) - 0.12,
        height: 0.35 + (2.3 * i) / 8,
        width: 0.9,
        depth: 0.58,
        topOffsets: [0, -0.09, 0.03, -0.11, 0.04, -0.05, 0, -0.08],
      },
      i,
    );
  for (const [i, p] of r.boulders.entries())
    if (detail >= 2 || i % (detail ? 2 : 3) === 0) stone('rock', p, i);
  // Low fieldstone support follows the original hill; individual posts seat into its top.
  const H = r.pylonPlatform.heights,
    platform = (x, z) => {
      const u = (x + 7.9) / 5.9,
        v = (z - 3.6) / 4.9;
      return (H[0] * (1 - u) + H[1] * u) * (1 - v) + (H[3] * (1 - u) + H[2] * u) * v;
    };
  solid(
    'rock',
    { outline: r.pylonPlatform.outline, holes: [] },
    (x, z) => platform(x, z) - 0.12,
    (x, z) => platform(x, z) + 0.72,
  );
  for (const [i, p] of r.pillars.entries()) stone('pillar', p, i);
  // Selected small unfinished blocks beside the entry; no copied glass dedication panel.
  for (const [i, block] of r.entryBlocks.entries()) if (detail || i < 4) stone('pillar', block, i);
}
