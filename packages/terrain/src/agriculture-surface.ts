/** Field parameters preserve world row phase across tile clipping and floating-origin rebases. */
import * as THREE from 'three';
import type { TerrainSurfaceMeshBuilder } from './linear-features';
import type { TerrainLandcoverFeature } from './semantic-types';

export function appendAgricultureAttributes(
  builder: TerrainSurfaceMeshBuilder,
  start: number,
  feature: TerrainLandcoverFeature,
): void {
  const cultivation = feature.cultivation;
  const soil = new THREE.Color(cultivation?.soil ?? '#ffffff');
  const angle = ((cultivation?.rowAngle ?? 0) * Math.PI) / 180;
  const sin = Math.sin(angle),
    cos = Math.cos(angle),
    spacing = cultivation?.spacing ?? 1;
  const phase =
    ((-sin * builder.context.origin[0] + cos * builder.context.origin[1]) / spacing) % 8;
  const size = builder.context.tileSize;
  const edges = (cultivation && cultivation.pattern !== 'plain' ? feature.polygons : []).flatMap(
    (polygon) =>
      [polygon.outer, ...(polygon.holes ?? [])].flatMap((ring) =>
        ring.flatMap((a, i) => {
          const b = ring[(i + 1) % ring.length]!;
          if (
            (Math.abs(a[0] - b[0]) < 1e-6 &&
              (Math.abs(a[0]) < 1e-6 || Math.abs(a[0] - 1) < 1e-6)) ||
            (Math.abs(a[1] - b[1]) < 1e-6 && (Math.abs(a[1]) < 1e-6 || Math.abs(a[1] - 1) < 1e-6))
          )
            return [];
          return [[a[0] * size, a[1] * size, b[0] * size, b[1] * size]];
        }),
      ),
  );
  builder.attributeSince('agricultureRows', 4, start, (x, z) => {
    if (!cultivation || cultivation.pattern === 'plain') return [0, 0, 0, 0];
    let margin = Number.POSITIVE_INFINITY;
    for (const [ax = 0, az = 0, bx = 0, bz = 0] of edges) {
      const dx = bx - ax,
        dz = bz - az,
        length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
      margin = Math.min(margin, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return [
      phase + (-sin * x + cos * z) / spacing,
      Number.isFinite(margin) ? margin : 3,
      1,
      cultivation.stage === 'sown' || cultivation.stage === 'stubble'
        ? 0.25
        : cultivation.pattern === 'grove'
          ? 0.45
          : 0.85,
    ];
  });
  builder.attributeSince('agricultureSoil', 3, start, () => [soil.r, soil.g, soil.b]);
}
