import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './daniel-boone-hotel-charleston-west-virginia-model.mjs';
await generateMotatBuilding(model, import.meta.url);
