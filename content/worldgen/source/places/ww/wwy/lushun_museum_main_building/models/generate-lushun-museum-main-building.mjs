import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './lushun-museum-main-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
