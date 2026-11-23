import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tang-chung-ling-ancestral-hall-model.mjs';
await generateMotatBuilding(model, import.meta.url);
