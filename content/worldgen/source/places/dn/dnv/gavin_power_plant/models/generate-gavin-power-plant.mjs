import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './gavin-power-plant-model.mjs';

await generateMotatBuilding(model, import.meta.url);
