import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './seimei-shrine-model.mjs';
await generateMotatBuilding(model, import.meta.url);
