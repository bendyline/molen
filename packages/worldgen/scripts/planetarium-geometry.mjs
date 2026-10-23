/** 'N0752_PLANETARIUM': mapped bronze cone with a closed inclined metal cap. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';

const earcut = createRequire(import.meta.url)('earcut').default;

export function buildPlanetarium(emit, detail, r) {
  const f = r.floorY,
    bottom = r.foundationY,
    footprint = r.floors[0].outline;
  const phi = (51.477 * Math.PI) / 180,
    radius = 7.4;
  const apex = [0, 2 * radius * Math.tan(phi), -radius];
  const k = 1 / Math.tan(phi),
    intercept = 9.2;
  const capNormal = [0, Math.sin(phi), -Math.cos(phi)];
  const n = [8, 16, 24, 32][detail];
  const base = [],
    top = [];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      x = radius * Math.cos(a),
      z = radius * Math.sin(a);
    const t = (intercept + k * z) / (apex[1] + k * (z + radius));
    base.push([x, f, z]);
    top.push([(1 - t) * x, f + t * apex[1], (1 - t) * z + t * apex[2]]);
  }
  // Exact mapped occupied footing seals the terrain cut even at the coarsest LOD.
  const ids = earcut(footprint.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => footprint[j]);
    emit(
      'stone',
      p.map(([x, z]) => [x, f, z]),
      [0, 1, 0],
    );
    emit(
      'stone',
      p.map(([x, z]) => [x, bottom, z]),
      [0, -1, 0],
    );
  }
  const orientation = Math.sign(
    footprint.reduce((sum, p, i) => {
      const q = footprint[(i + 1) % footprint.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i],
      b = footprint[(i + 1) % footprint.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    emit(
      'stone',
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], f, b[1]],
        [a[0], f, a[1]],
      ],
      [orientation * dz, 0, -orientation * dx],
    );
  }
  const center = top.reduce((v, p) => v.map((x, j) => x + p[j] / n), [0, 0, 0]);
  const inset = (p) => p.map((v, j) => center[j] + (v - center[j]) * 0.985);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = base[i],
      b = base[j],
      c = top[j],
      d = top[i];
    emit('wall', [a, b, c, d], [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2 + radius * 0.3]);
    emit('dark', [d, c, inset(c), inset(d)], capNormal);
    emit('roof', [center, inset(d), inset(c)], capNormal);
    emit('wall', [[0, f, 0], b, a], [0, -1, 0]);
  }
  if (detail > 0) {
    // Broad low-frequency welded divisions on the cap, merged by material.
    const capPoint = (x, z) => [x, f + intercept + k * z, z];
    const stripe = (z, width) => {
      const intersections = [];
      for (let i = 0; i < n; i++) {
        const a = top[i],
          b = top[(i + 1) % n];
        if ((a[2] <= z && b[2] > z) || (b[2] <= z && a[2] > z))
          intersections.push(a[0] + ((b[0] - a[0]) * (z - a[2])) / (b[2] - a[2]));
      }
      intersections.sort((a, b) => a - b);
      if (intersections.length < 2) return;
      const lo = intersections[0] + 0.12,
        hi = intersections.at(-1) - 0.12;
      if (hi <= lo) return;
      emit(
        'seam',
        [
          [lo, z - width / 2],
          [hi, z - width / 2],
          [hi, z + width / 2],
          [lo, z + width / 2],
        ].map(([x, v]) => capPoint(x, v).map((q, j) => q + capNormal[j] * 0.012)),
        capNormal,
      );
    };
    const min = Math.min(...top.map((p) => p[2])),
      max = Math.max(...top.map((p) => p[2]));
    for (let z = min + 1.1; z < max - 0.6; z += 1.1) stripe(z, detail === 1 ? 0.04 : 0.025);
    const a = top[n / 4],
      b = top[(n * 3) / 4];
    emit(
      'seam',
      [
        [a[0] - 0.025, a[2] - 0.12],
        [a[0] + 0.025, a[2] - 0.12],
        [b[0] + 0.025, b[2] + 0.12],
        [b[0] - 0.025, b[2] + 0.12],
      ].map(([x, z]) => capPoint(x, z).map((q, j) => q + capNormal[j] * 0.015)),
      capNormal,
    );
  }
}
