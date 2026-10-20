/** 'N0528': N0528: mapped exposed Eanna ziggurat core, without restoring the ancient temple. */
import earcut from 'earcut';

function subdivide(outline, edge) {
  return outline.flatMap((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const count = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / edge));
    return Array.from({ length: count }, (_, k) => p.map((v, j) => v + ((q[j] - v) * k) / count));
  });
}

function cap(f, role, points, bottom = false) {
  const indices = earcut(points.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < indices.length; i += 3)
    f(
      role,
      indices.slice(i, i + 3).map((k) => points[k]),
      [0, bottom ? -1 : 1, 0],
    );
}

function belt(f, low, high, role, center, inward = false) {
  for (let i = 0; i < low.length; i++) {
    const j = (i + 1) % low.length;
    const target = [
      low[i][0] + low[j][0] - center[0] * 2,
      0,
      low[i][2] + low[j][2] - center[1] * 2,
    ];
    f(role, [low[i], low[j], high[j], high[i]], inward ? target.map((v) => -v) : target);
  }
}

export function buildEannaRuins(f, detail, r, terrain) {
  const edge = [12, 4, 2, 1.2][detail];
  const core = subdivide(r.core, edge),
    outer = subdivide(r.outer, edge);
  const center = r.coreCenter,
    grade = terrain(...center);
  const wave = (x, z) =>
    Math.sin(x * 0.49 + z * 0.29) * 0.55 + Math.sin(x * 0.21 - z * 0.43) * 0.45;
  // The low excavated perimeter uses the actual irregular mapped outline and retained grade.
  const signedArea = r.outer.reduce((sum, p, i) => {
    const q = r.outer[(i + 1) % r.outer.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      sign = Math.sign(signedArea);
    const normal = [(-(b[1] - a[1]) / length) * sign, ((b[0] - a[0]) / length) * sign];
    const points = [
      a,
      b,
      [b[0] + normal[0] * 1.3, b[1] + normal[1] * 1.3],
      [a[0] + normal[0] * 1.3, a[1] + normal[1] * 1.3],
    ];
    const low = points.map(([x, z]) => [x, terrain(x, z) - 0.65, z]);
    const high = points.map(([x, z], k) => [
      x,
      terrain(x, z) + (k < 2 ? r.baseHeight * (0.65 + wave(x, z) * 0.25) : 0.15),
      z,
    ]);
    cap(f, 'earth', high);
    cap(f, 'earth', low, true);
    for (let k = 0; k < 4; k++) {
      // Only original polygon corners close a strip; internal subdivision caps cause seams.
      const end = k === 1 ? b : k === 3 ? a : undefined;
      if (end && !r.outer.some((p) => p[0] === end[0] && p[1] === end[1])) continue;
      const j = (k + 1) % 4,
        u = points[k],
        v = points[j];
      f(
        k === 0 ? 'brick' : 'earth',
        [low[k], low[j], high[j], high[k]],
        [(v[1] - u[1]) * sign, 0, (u[0] - v[0]) * sign],
      );
    }
  }

  const full = [
    [1, -0.65],
    [1, 0.25],
    [0.96, 1.4],
    [0.89, 1.8],
    [0.88, 3.1],
    [0.79, 3.6],
    [0.77, 5.3],
    [0.68, 5.9],
    [0.65, 7.4],
    [0.58, 7.9],
    [0.56, 9],
    [r.topScale, r.height],
  ];
  const profile = detail === 0 ? [full[0], full[2], full[6], full[10], full.at(-1)] : full;
  const rings = profile.map(([scale, height]) =>
    core.map(([x, z]) => {
      const dx = x - center[0],
        dz = z - center[1],
        angle = Math.atan2(dz, dx);
      const q = Math.max(0, height / r.height);
      // Picture-led erosion channels cut the exposed core rather than making regular intact stages.
      const channel =
        detail === 0 ? 0 : Math.pow(Math.max(0, Math.sin(angle * 11 + 0.8)), 4) * 0.05;
      const irregular = detail === 0 ? 0 : Math.sin(angle * 5 + q * 3) * 0.023 + wave(x, z) * 0.016;
      const size = scale - channel * Math.sin(q * Math.PI) + irregular * Math.sin(q * Math.PI);
      const length = Math.hypot(dx, dz),
        co = Math.cos(r.architecturalAngleRadians),
        si = Math.sin(r.architecturalAngleRadians);
      const du = co * dx + si * dz,
        dv = -si * dx + co * dz;
      const roundedRadius = 1 / Math.hypot(du / (length * 20), dv / (length * 21));
      // The mapped deep basal notch fades into the photograph's broader eroded crown.
      const relief = size * (1 - q * 0.85 + (q * 0.85 * roundedRadius) / length);
      const u = center[0] + dx * relief,
        v = center[1] + dz * relief;
      const y =
        terrain(x, z) * (1 - q) +
        grade * q +
        height +
        (height > 0
          ? (wave(x, z) * r.erosionAmplitude + Math.sin(angle * 4 + q * 5) * 0.35) * (0.3 + 0.7 * q)
          : 0);
      return [u, y, v];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++) {
    const dy = profile[k + 1][1] - profile[k][1];
    const dr = profile[k][0] - profile[k + 1][0];
    belt(f, rings[k], rings[k + 1], dy > 0.6 && dr < 0.07 ? 'brick' : 'earth', center);
  }
  cap(f, 'earth', rings[0], true);
  cap(f, 'earth', rings.at(-1));
}
