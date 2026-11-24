import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kruger-house-pretoria-model.mjs';

await generateMotatBuilding(model, import.meta.url);
