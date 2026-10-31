/** Reconstructed visible stair support, not a surveyed or navigable interior. */
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transformed } from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  box,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export function addStairSupport(out, { district = false, sides = 6 } = {}) {
  const color = [0.35, 0.37, 0.34];
  // The original fourteen treads remain. These last two reach the upper gallery.
  for (let i = 14; i < 16; i++) {
    const o = transformed(out, i * 0.34),
      y = 19.54 + i * 0.17;
    if (district) {
      const ps = [
        [-0.32, y + 0.07, 0.4],
        [-0.32, y + 0.07, 1.27],
        [0.32, y + 0.07, 1.27],
        [0.32, y + 0.07, 0.4],
      ];
      quad(o, 'metal', ps, [0, 1, 0], color);
      quad(o, 'metal', [...ps].reverse(), [0, -1, 0], color);
    } else box(o, 'metal', [-0.32, y, 0.4], [0.32, y + 0.07, 1.27], color);
  }
  const points = Array.from({ length: 17 }, (_, i) => [
    0.85 * Math.sin(i * 0.34),
    19.47 + i * 0.17,
    0.85 * Math.cos(i * 0.34),
  ]);
  if (district) {
    // The distant stringer is a continuous two-sided vertical web under every tread.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        ps = [
          [a[0], a[1] - 0.09, a[2]],
          [b[0], b[1] - 0.09, b[2]],
          [b[0], b[1] + 0.09, b[2]],
          [a[0], a[1] + 0.09, a[2]],
        ];
      quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
      ps.reverse();
      quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
    }
  } else tubePath(out, 'metal', points, 0.1, color, sides);
}
