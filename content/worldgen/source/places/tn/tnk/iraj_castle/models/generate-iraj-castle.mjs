import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './iraj-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
