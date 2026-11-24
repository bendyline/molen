import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './fort-beausejour-model.mjs';

await generateMotatBuilding(model, import.meta.url);
