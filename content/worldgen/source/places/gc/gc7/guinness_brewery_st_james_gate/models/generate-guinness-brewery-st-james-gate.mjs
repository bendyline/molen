import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './guinness-brewery-st-james-gate-model.mjs';

await generateMotatBuilding(model, import.meta.url);
