import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tampere-workers-hall-model.mjs';

await generateMotatBuilding(model, import.meta.url);
