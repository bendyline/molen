/** Local facade accents and instanced identity signs for arbitrary outlines. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import { ringSignedArea } from './geometry2d';
import type { MeshBufferBuilder } from './mesh-buffers';
import { modelBox } from './model-primitives';
import type { PropPlacement } from './props';
import type { StorefrontRequest, Vec2, Vec3 } from './types';

export function buildStorefronts(
  requests: readonly StorefrontRequest[],
  outline: readonly Vec2[],
  base: number,
  topAt: (p: Vec2) => number,
  seams: ReadonlySet<number> | undefined,
  simplified: boolean,
  out: MeshBufferBuilder,
  openEntrance = false,
): PropPlacement[] {
  const groups = new Map<number, Array<{ request: StorefrontRequest; t: number }>>();
  // A bounded number of identity markers per building, sorted independently of source order.
  for (const request of [...requests]
    .sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0))
    .slice(0, 12)) {
    let best: { edge: number; t: number; distance: number } | undefined;
    for (let edge = 0; edge < outline.length; edge++) {
      if (seams?.has(edge)) continue;
      const a = outline[edge] as Vec2,
        b = outline[(edge + 1) % outline.length] as Vec2;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 2) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((request.at[0] - a[0]) * dx + (request.at[1] - a[1]) * dz) / (length * length),
        ),
      );
      const distance = Math.hypot(request.at[0] - a[0] - t * dx, request.at[1] - a[1] - t * dz);
      if (!best || distance < best.distance) best = { edge, t, distance };
    }
    if (!best) continue;
    const group = groups.get(best.edge) ?? [];
    group.push({ request, t: best.t });
    groups.set(best.edge, group);
  }
  const props: PropPlacement[] = [];
  const winding = ringSignedArea(outline) >= 0 ? 1 : -1;
  for (const [edge, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    group.sort((a, b) => a.t - b.t || (a.request.identity < b.request.identity ? -1 : 1));
    const a = outline[edge] as Vec2,
      b = outline[(edge + 1) % outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    const nx = dz * winding,
      nz = -dx * winding,
      yaw = dmath.atan2(nx, nz);
    const slot = length / group.length;
    for (let i = 0; i < group.length; i++) {
      const { request, t } = group[i] as { request: StorefrontRequest; t: number };
      // If adjacent points compete for a frontage, give them stable nonoverlapping bays.
      const margin = Math.min(request.width ?? 10, length - 0.5) / 2 + 0.2;
      const center =
        group.length > 1
          ? (i + 0.5) * slot
          : Math.max(margin, Math.min(length - margin, t * length));
      const width = Math.min(
        request.width ?? 10,
        slot - 0.5,
        2 * Math.min(center, length - center) - 0.4,
      );
      if (width < 1.8) continue;
      const x = a[0] + dx * center,
        z = a[1] + dz * center;
      // Broad retail frontages lift the fascia toward their taller parapet.
      const frontageHeight = width >= 20 ? Math.min(8, width * 0.34) : 5.2;
      const top = Math.min(topAt([x, z]) - 0.12, base + frontageHeight),
        height = top - base;
      if (height < 2.4) continue;
      const band = Math.min(width >= 20 ? 2.4 : 1.5, height * 0.28),
        bottom = top - band;
      const place = (side: number, y: number, forward: number): Vec3 => [
        x + dmath.cos(yaw) * side + nx * forward,
        y,
        z - dmath.sin(yaw) * side + nz * forward,
      ];
      modelBox(out, place(0, bottom + band / 2, 0.1), [width, band, 0.28], request.accent, yaw);
      if (!simplified) {
        modelBox(out, place(0, bottom - 0.14, 0.65), [width + 0.1, 0.2, 1.4], request.accent, yaw);
        const doorHeight = Math.min(2.5, bottom - base - 0.2);
        if (!openEntrance)
          modelBox(
            out,
            place(0, base + doorHeight / 2, 0.16),
            [Math.min(2.0, width * 0.42), doorHeight, 0.12],
            '#243c4b',
            yaw,
          );
        for (const side of [-1, 1])
          modelBox(
            out,
            place(side * (width / 2 - 0.15), base + (bottom - base) / 2, 0.08),
            [0.26, bottom - base, 0.24],
            request.accent,
            yaw,
          );
      }
      const native = request.signSize ?? [4, 1.35];
      const scale = Math.min((width * 0.88) / native[0], (band * 0.84) / native[1]);
      if (scale <= 0) continue;
      props.push({
        model: request.signModel,
        x: x + nx * 0.28,
        y: bottom + (band - native[1] * scale) / 2,
        z: z + nz * 0.28,
        yaw,
        scale,
        color: [1, 1, 1],
      });
    }
  }
  return props;
}
