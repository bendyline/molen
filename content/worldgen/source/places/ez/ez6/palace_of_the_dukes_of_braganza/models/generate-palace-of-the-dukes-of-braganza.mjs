import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './palace-of-the-dukes-of-braganza-model.mjs';

await generateMotatBuilding(model, import.meta.url);
