import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './casa-monica-hotel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
