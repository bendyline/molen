import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './bahla-fort-model.mjs';

await generateMotatBuilding(model, import.meta.url);
