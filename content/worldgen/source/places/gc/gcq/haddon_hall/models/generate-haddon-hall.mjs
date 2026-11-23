import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './haddon-hall-model.mjs';
await generateMotatBuilding(model, import.meta.url);
