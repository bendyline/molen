import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './government-house-nassau-model.mjs';

await generateMotatBuilding(model, import.meta.url);
