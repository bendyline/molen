import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './first-territorial-capitol-of-kansas-model.mjs';

await generateMotatBuilding(model, import.meta.url);
