/** Open curved display roofs of the National Rail Museum outdoor gallery. */
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const colors = {
  zinc: rgb('9d9c88'),
  warmZinc: rgb('9a8b72'),
  framing: rgb('454d43'),
  posts: rgb('716a59'),
  ashlar: rgb('9d8a71'),
};
const lerp = (a, b, t) => a + (b - a) * t;

/** Width, length and approximate height are metres. Endpoints use the siding's local frame. */
export function railYardCanopy(
  out,
  { start, end, width, eaveHeight, rise, warm = false },
  ground,
  lod,
) {
  const [a, b] = start;
  const dx = end[0] - a,
    dz = end[1] - b;
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dz, dx);
  const canopy = transform(out, angle, [a, 0, b]);
  const bed = (x, z) =>
    ground([
      a + x * Math.cos(angle) + z * Math.sin(angle),
      b - x * Math.sin(angle) + z * Math.cos(angle),
    ]);
  const yStart = bed(0, 0),
    yEnd = bed(length, 0);
  const profile = (x, u) => [
    x,
    lerp(yStart, yEnd, x / length) + eaveHeight + rise * (1 - u * u),
    width * u * 0.5,
  ];
  const finish = warm ? colors.warmZinc : colors.zinc;
  const slices = [2, 3, 6, 10][lod];
  for (let i = 0; i < slices; i++) {
    const u = -1 + (2 * i) / slices,
      v = -1 + (2 * (i + 1)) / slices;
    const strip = [profile(0, u), profile(0, v), profile(length, v), profile(length, u)];
    face(canopy, 'canopy', strip, finish);
    if (lod > 1)
      face(
        canopy,
        'canopy',
        strip.toReversed().map(([x, y, z]) => [x, y - 0.038, z]),
        colors.warmZinc,
      );
  }

  const count = lod === 0 ? (length > 45 ? 2 : 1) : Math.max(2, Math.round(length / 6.3));
  for (let i = 0; i <= count; i++) {
    const x = lerp(0.31, length - 0.31, i / count);
    for (const side of [-1, 1]) {
      const z = side * (width * 0.5 - 0.24),
        base = bed(x, z);
      const [, y] = profile(x, side * 0.94);
      const radius = lod === 0 ? 0.13 : 0.077;
      box(
        canopy,
        'metal',
        [x - radius, base - 0.18, z - radius],
        [x + radius, y - 0.015, z + radius],
        colors.posts,
      );
      if (lod > 1) {
        box(
          canopy,
          'stone',
          [x - 0.16, base - 0.21, z - 0.16],
          [x + 0.16, base + 0.21, z + 0.16],
          colors.ashlar,
        );
        const brace = [[x, y - 0.92, z], [x, y - 0.29, z - side * 0.36], profile(x, side * 0.69)];
        beamPath(canopy, 'metal', brace, 0.075, 0.079, colors.framing);
      }
    }
    if (lod === 0) continue;
    const arch = Array.from({ length: slices + 1 }, (_, k) => {
      const [xx, y, z] = profile(x, -1 + (2 * k) / slices);
      return [xx, y - 0.068, z];
    });
    beamPath(canopy, 'metal', arch, 0.115, 0.073, colors.framing);
  }
  if (lod > 1) {
    for (const at of [-0.87, -0.42, 0, 0.42, 0.87]) {
      const support = (x) => {
        const [xx, y, z] = profile(x, at);
        return [xx, y - 0.105, z];
      };
      beamPath(canopy, 'metal', [support(0), support(length)], 0.09, 0.075, colors.framing);
    }
  }
}
