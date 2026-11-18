import * as THREE from 'three';
import {
  createTerrainBoxInstances,
  type TerrainBoxPlacement,
  TerrainSurfaceMeshBuilder,
} from './linear-features';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { appendTerrainSignGlow } from './surface-lights';
import { appendSurfaceSign, type SurfaceSign } from './surface-sign-mesh';
import type { TerrainSurfaceOptions } from './surface-styles';

/** Render one planned sign with exactly the same geometry as a surface tile, its night glow
 * included (`updateTerrainStreetLights` sets it). Coordinates are tile-local and clipped to
 * context.tileSize. Dispose with disposeTerrainSurfaceObject.
 */
export function createTerrainRoadSignObject(
  sign: SurfaceSign,
  context: TerrainPyramidTileLayerContext,
  options: Pick<TerrainSurfaceOptions, 'fonts' | 'signFont' | 'routeShields'> = {},
): THREE.Group {
  const faces = new TerrainSurfaceMeshBuilder(context);
  const backs = new TerrainSurfaceMeshBuilder(context);
  const fixtures: TerrainBoxPlacement[] = [];
  appendSurfaceSign(
    faces,
    fixtures,
    sign,
    options.fonts,
    options.signFont,
    options.routeShields,
    backs,
  );
  const group = new THREE.Group();
  group.name = `road-sign:${sign.pattern}`;
  group.userData.roadSigns = [sign];
  for (const mesh of [
    faces.mesh(
      sign.kind === 'street-name' ? 'surface:street-names' : 'surface:road-signs',
      undefined,
      false,
    ),
    backs.mesh('surface:sign-backs', undefined, false),
    createTerrainBoxInstances(fixtures, 'surface:street-fixtures'),
  ])
    if (mesh) group.add(mesh);
  appendTerrainSignGlow(group);
  return group;
}
