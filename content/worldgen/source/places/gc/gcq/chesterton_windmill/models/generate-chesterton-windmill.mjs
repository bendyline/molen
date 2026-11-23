import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './chesterton-windmill-model.mjs';

await generateMotatBuilding(model, import.meta.url);
