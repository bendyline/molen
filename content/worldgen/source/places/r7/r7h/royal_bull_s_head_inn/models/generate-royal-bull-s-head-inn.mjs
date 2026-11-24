import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './royal-bull-s-head-inn-model.mjs';

await generateMotatBuilding(model, import.meta.url);
