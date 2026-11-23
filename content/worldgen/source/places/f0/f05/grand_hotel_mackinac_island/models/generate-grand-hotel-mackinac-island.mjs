import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './grand-hotel-mackinac-island-model.mjs';
await generateMotatBuilding(model, import.meta.url);
