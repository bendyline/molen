import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sun-yat-sen-nanyang-memorial-hall-model.mjs';

await generateMotatBuilding(model, import.meta.url);
