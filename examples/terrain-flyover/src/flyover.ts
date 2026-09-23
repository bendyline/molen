import { validateByKind } from '@bendyline/molen-schema';
import { registerTerrainSchemas, type TerrainDescriptor } from '@bendyline/molen-terrain/kernel';
import terrainDoc from '../terrain.json';

// Shared config for the flyover (browser app + headless golden). The heightmap is generated
// from a fixed seed so the demo and the golden test agree without shipping image assets.
// Validate (not a bare cast) so schema defaults — origin, collision, layer/LOD fields — are
// applied; buildChunkGeometry reads descriptor.origin, which a raw cast leaves undefined.
registerTerrainSchemas();
const parsed = validateByKind('terrain', terrainDoc);
if (!parsed.ok) throw new Error(parsed.formatted);
export const TERRAIN = parsed.value as TerrainDescriptor;
export const HEIGHTMAP_SEED = 42;
export const HEIGHTMAP_SIZE = 256;

const worldW = TERRAIN.chunkSize * TERRAIN.gridSize[0];
const worldD = TERRAIN.chunkSize * TERRAIN.gridSize[1];

/** A camera pose looking across the island from the south-east. */
export const FLYOVER_CAMERA = {
  position: [worldW * 0.5, 160, worldD + 160] as [number, number, number],
  lookAt: [worldW * 0.5, 20, worldD * 0.5] as [number, number, number],
};
