import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './fort-mackinac-officers-stone-quarters-model.mjs';

await generateMotatBuilding(model, import.meta.url);
