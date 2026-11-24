import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './nara-hotel-main-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
