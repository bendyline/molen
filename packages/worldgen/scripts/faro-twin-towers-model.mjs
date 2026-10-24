/** el_faro_towers: mapped angled El Faro shafts, stepped crowns and open inter-tower space. */
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export function buildFaroTowers(face, detail, r, sample) {
  for (const tower of r.towers) {
    const { width: w, depth: d, floorY: F, center: c, xAxis: X, zAxis: Z } = tower,
      P = ([x, y, z]) => [c[0] + x * X[0] + z * Z[0], F + y, c[1] + x * X[1] + z * Z[1]],
      D = ([x, y, z]) => [x * X[0] + z * Z[0], y, x * X[1] + z * Z[1]],
      f = (role, points, normal) => face(role, points.map(P), D(normal)),
      core = rect(0, 0, w, d),
      foundation = Math.min(...tower.outline.map((p) => sample(...p))) - F - 0.35;
    prism(f, 'wall', core, foundation, 0.3);
    const windowWall = (axis, sign, length, halfDepth) => {
      const n = axis === 0 ? [0, 0, sign] : [sign, 0, 0],
        u = axis === 0 ? [1, 0, 0] : [0, 0, 1],
        point = (s, y, depth = 0) =>
          axis === 0 ? [s, y, sign * (halfDepth + depth)] : [sign * (halfDepth + depth), y, s],
        plane = (role, a, b, lo, hi, depth = 0) =>
          f(
            role,
            [point(a, lo, depth), point(b, lo, depth), point(b, hi, depth), point(a, hi, depth)],
            n,
          ),
        rows = detail === 1 ? 10 : detail === 2 ? 20 : 40,
        cols = Math.max(3, Math.round(length / (detail === 1 ? 6 : detail === 2 ? 4.5 : 3.1))),
        pitch = (r.mainTop - 3.2) / rows,
        cell = length / cols;
      for (let row = 0; row < rows; row++) {
        const lo = 3.2 + row * pitch,
          hi = lo + pitch,
          sill = lo + (detail === 3 ? 0.68 : pitch * 0.22),
          head = hi - (detail === 3 ? 0.46 : pitch * 0.15);
        plane('wall', -length / 2, length / 2, lo, sill);
        plane('wall', -length / 2, length / 2, head, hi);
        for (let col = 0; col < cols; col++) {
          const a = -length / 2 + col * cell,
            b = a + cell,
            left = a + cell * 0.18,
            right = b - cell * 0.18;
          plane('wall', a, left, sill, head);
          plane('wall', right, b, sill, head);
          plane('glass', left, right, sill, head, -0.14);
          if (detail > 1) {
            f(
              'wall',
              [
                point(left, sill),
                point(left, head),
                point(left, head, -0.14),
                point(left, sill, -0.14),
              ],
              u,
            );
            f(
              'wall',
              [
                point(right, sill),
                point(right, sill, -0.14),
                point(right, head, -0.14),
                point(right, head),
              ],
              u.map((v) => -v),
            );
            f(
              'wall',
              [
                point(left, sill),
                point(left, sill, -0.14),
                point(right, sill, -0.14),
                point(right, sill),
              ],
              [0, 1, 0],
            );
            f(
              'wall',
              [
                point(left, head),
                point(right, head),
                point(right, head, -0.14),
                point(left, head, -0.14),
              ],
              [0, -1, 0],
            );
          }
        }
      }
      plane('wall', -length / 2, length / 2, 0.3, 3.2);
    };
    if (detail === 0) {
      prism(f, 'wall', core, 0.3, r.mainTop);
    } else {
      // A closed recessed backing makes every window opaque without overlapping the visible pane.
      prism(f, 'wall', rect(0, 0, w - 0.48, d - 0.48), 0.3, r.mainTop);
      for (const sign of [-1, 1]) {
        windowWall(0, sign, w, d / 2);
        windowWall(1, sign, d, w / 2);
      }
    }
    prism(f, 'roof', core, r.mainTop - 0.16, r.mainTop);
    const gw = w * 0.91,
      gd = d * 0.79,
      gx = w * 0.045;
    prism(f, 'glass', rect(gx, 0, gw, gd), r.mainTop, r.glazedTop);
    if (detail > 0) {
      const step = detail === 1 ? 9 : 3;
      for (let y = r.mainTop; y < r.glazedTop; y += step)
        prism(f, 'wall', rect(gx, 0, gw + 0.16, gd + 0.16), y, y + 0.32);
      // Narrow continuous inner-end glazing breaks the concrete shaft as in both ordinary views.
      for (const sign of [-1, 1]) {
        const z = sign * (d / 2 + 0.025),
          x = -w / 2 + 1.15;
        f(
          'glass',
          [
            [x, 3.2, z],
            [x + 1.45, 3.2, z],
            [x + 1.45, r.mainTop, z],
            [x, r.mainTop, z],
          ],
          [0, 0, sign],
        );
      }
    }
    prism(f, 'metal', rect(gx, 0, gw + 0.25, gd + 0.25), r.glazedTop, r.crownTop);
    prism(f, 'roof', rect(gx, 0, gw + 0.4, gd + 0.4), r.crownTop, r.crownTop + 0.12);
    if (detail > 0) {
      const step = detail === 1 ? 1.6 : 0.8;
      for (let y = r.glazedTop + 0.45; y < r.crownTop - 0.2; y += step) {
        // Broad pale louver slats are retained; sub-pixel fins and mechanical equipment are omitted.
        box(f, 'wall', gx, y, -gd / 2 - 0.19, gw + 0.45, 0.25, 0.25);
        box(f, 'wall', gx, y, gd / 2 + 0.19, gw + 0.45, 0.25, 0.25);
        box(f, 'wall', gx - gw / 2 - 0.19, y, 0, 0.25, 0.25, gd + 0.45);
        box(f, 'wall', gx + gw / 2 + 0.19, y, 0, 0.25, 0.25, gd + 0.45);
      }
    }
    // Small attached entrances, never a slab spanning the entire site or the inter-tower opening.
    box(f, 'glass', w * 0.18, 0.3, d / 2 + 0.45, w * 0.34, 3.1, 1.5);
    box(f, 'wall', w * 0.18, 3.4, d / 2 + 0.65, w * 0.4, 0.3, 2.3);
  }
  const base = Math.max(...r.towers.map((t) => t.floorY));
  // Native high connector supplies the horizontal outline for all three bounded bridge volumes.
  for (const [lo, hi] of r.bridgeLevels) {
    prism(face, 'glass', { outline: r.bridgeOutline }, base + lo, base + hi);
    prism(face, 'wall', { outline: r.bridgeOutline }, base + lo - 0.3, base + lo);
    prism(face, 'wall', { outline: r.bridgeOutline }, base + hi, base + hi + 0.25);
  }
}
