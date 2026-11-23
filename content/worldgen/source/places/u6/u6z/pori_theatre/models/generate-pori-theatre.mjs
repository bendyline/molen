import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './pori-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
