import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './luce-memorial-chapel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
