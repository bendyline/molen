import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './gulbarga-fort-model.mjs';

await generateMotatBuilding(model, import.meta.url);
