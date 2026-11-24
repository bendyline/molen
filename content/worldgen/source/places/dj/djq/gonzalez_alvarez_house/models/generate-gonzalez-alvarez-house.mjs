import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './gonzalez-alvarez-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
