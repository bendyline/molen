import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './winter-palace-hotel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
