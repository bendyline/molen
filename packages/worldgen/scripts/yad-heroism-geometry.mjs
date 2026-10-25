/** 'pillar_of_heroism_yad_vashem': curved open-section pillar with near-level facing joints. */
import { prism } from './khmer-structure-geometry.mjs';

export function buildYadHeroism(face, detail, r) {
  const T = r.xAxis,
    Z = r.zAxis,
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [x * T[0] + z * Z[0], y, x * T[1] + z * Z[1]]),
        [n[0] * T[0] + n[2] * Z[0], n[1], n[0] * T[1] + n[2] * Z[1]],
      ),
    segments = [6, 12, 24, 40][detail];
  const section = (outer, inner, angle) => {
    const curve = (radius) =>
      Array.from({ length: segments + 1 }, (_, i) => {
        const a = ((-angle + (2 * angle * i) / segments) * Math.PI) / 180;
        return [radius * Math.sin(a), r.radius - radius * Math.cos(a)];
      });
    return { outline: [...curve(outer), ...curve(inner).toReversed()], holes: [] };
  };
  prism(f, 'floor', { outline: r.footprint, holes: [] }, r.foundationY, r.floorY, true);
  prism(
    f,
    'concrete',
    section(r.radius, r.radius - r.thickness, r.halfAngleDegrees),
    r.floorY,
    r.floorY + r.height,
    true,
  );
  if (!detail) return;
  const count = [0, 1, 7, 12][detail],
    gap = detail >= 2 ? 0.014 : 0;
  for (let i = 0; i < count; i++)
    prism(
      f,
      'facing',
      section(
        r.radius - r.thickness + 0.003,
        r.radius - r.thickness - 0.012,
        r.halfAngleDegrees - 2,
      ),
      r.floorY + 0.035 + (i * (r.height - 0.07)) / count + gap / 2,
      r.floorY + 0.035 + ((i + 1) * (r.height - 0.07)) / count - gap / 2,
      true,
    );
}
