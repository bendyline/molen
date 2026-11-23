import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './north-carolina-state-capitol-model.mjs';
await generateMotatBuilding(model, import.meta.url);
