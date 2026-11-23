import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kentucky-state-capitol-model.mjs';
await generateMotatBuilding(model, import.meta.url);
