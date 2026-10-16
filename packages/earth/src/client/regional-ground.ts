import type { TerrainSurfaceColor } from '@bendyline/molen-terrain/client';
import type { RegionalEnvironment } from '@bendyline/molen-worldgen-earth/kernel';
import { Color } from 'three';

/** Coarse ecology also colors bare/distant ground before semantic detail arrives. */
export function createRegionalGroundColor(
  environment: RegionalEnvironment | undefined,
): TerrainSurfaceColor | undefined {
  if (environment?.hasEcology !== true) return undefined;
  const colors = new Map<string, readonly [number, number, number]>();
  const linear = (hex: string): readonly [number, number, number] => {
    let value = colors.get(hex);
    if (value === undefined) {
      const color = new Color(hex);
      value = [color.r, color.g, color.b];
      colors.set(hex, value);
    }
    return value;
  };
  return (x, _y, z, slope) => {
    const surface = environment.scatterAt(x, z)?.surface;
    if (surface === undefined || environment.ecology?.resolve(x, z) === undefined) return undefined;
    const ground = linear(surface.default);
    const rock = linear(surface.colors.barren ?? '#aca28c');
    const blend = Math.min(0.65, Math.max(0, slope - 0.65) * 0.45);
    return [
      ground[0] + (rock[0] - ground[0]) * blend,
      ground[1] + (rock[1] - ground[1]) * blend,
      ground[2] + (rock[2] - ground[2]) * blend,
    ];
  };
}
