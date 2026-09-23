import { webMercatorToWgs84 } from '@bendyline/molen-terrain/kernel';

/** Uses absolute world coordinates, never the renderer's floating-origin coordinates. */
export function formatCameraLocation(
  camera: { pos: readonly [number, number, number]; yaw: number; pitch: number },
  world: { label: string; metersPerUnit: number; geospatial: boolean },
): string {
  const [x, y, z] = camera.pos;
  const [longitude, latitude] = webMercatorToWgs84(
    x / world.metersPerUnit,
    z / world.metersPerUnit,
  );
  // World +X is east, +Z is south; camera yaw zero faces east.
  const heading = ((((camera.yaw * 180) / Math.PI + 90) % 360) + 360) % 360;
  return [
    `${world.label} · Camera`,
    world.geospatial
      ? `Lat ${latitude.toFixed(7)}° · Lon ${longitude.toFixed(7)}° (WGS84)`
      : `Local X ${x.toFixed(2)} m · Z ${z.toFixed(2)} m`,
    `Altitude ${y.toFixed(2)} m · Heading ${((Math.round(heading * 10) / 10) % 360).toFixed(1)}°`,
    `Yaw ${camera.yaw.toFixed(5)} rad · Pitch ${camera.pitch.toFixed(5)} rad`,
  ].join('\n');
}
