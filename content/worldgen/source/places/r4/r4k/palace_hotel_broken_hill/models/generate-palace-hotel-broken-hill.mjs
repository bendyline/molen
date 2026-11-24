import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './palace-hotel-broken-hill-model.mjs';

await generateMotatBuilding(model, import.meta.url);
