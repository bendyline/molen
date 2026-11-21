import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './maryknoll-house-stanley-model.mjs';

await generateMotatBuilding(model, import.meta.url);
