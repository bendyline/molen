import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './green-bank-telescope-model.mjs';

await generateMotatBuilding(model, import.meta.url);
