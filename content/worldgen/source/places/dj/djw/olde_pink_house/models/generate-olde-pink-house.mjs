import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './olde-pink-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
