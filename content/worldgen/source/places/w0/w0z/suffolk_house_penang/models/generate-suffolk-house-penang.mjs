import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './suffolk-house-penang-model.mjs';

await generateMotatBuilding(model, import.meta.url);
