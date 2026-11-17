import { readFileSync } from 'node:fs';
import {
  createChongarBridge,
  surfaces,
} from '../../../../../../../../packages/worldgen/scripts/chongar-bridge-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));

export { surfaces };
export const { buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  createChongarBridge(frame);
