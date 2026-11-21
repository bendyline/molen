import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './imam-reza-shrine-model.mjs';

await generateMotatBuilding(model, import.meta.url);
