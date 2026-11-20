import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './st-peter-s-basilica-model.mjs';

await generateMotatBuilding(model, import.meta.url);
