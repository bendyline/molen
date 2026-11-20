import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './mendelssohn-house-leipzig-model.mjs';

await generateMotatBuilding(model, import.meta.url);
