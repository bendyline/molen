import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './key-route-inn-model.mjs';

await generateMotatBuilding(model, import.meta.url);
