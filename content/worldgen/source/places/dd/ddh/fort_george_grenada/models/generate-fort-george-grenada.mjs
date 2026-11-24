import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './fort-george-grenada-model.mjs';

await generateMotatBuilding(model, import.meta.url);
