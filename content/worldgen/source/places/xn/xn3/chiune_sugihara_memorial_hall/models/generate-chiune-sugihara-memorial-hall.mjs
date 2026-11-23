import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './chiune-sugihara-memorial-hall-model.mjs';
await generateMotatBuilding(model, import.meta.url);
