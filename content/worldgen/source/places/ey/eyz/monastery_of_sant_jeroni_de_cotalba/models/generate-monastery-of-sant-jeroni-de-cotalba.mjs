import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './monastery-of-sant-jeroni-de-cotalba-model.mjs';

await generateMotatBuilding(model, import.meta.url);
