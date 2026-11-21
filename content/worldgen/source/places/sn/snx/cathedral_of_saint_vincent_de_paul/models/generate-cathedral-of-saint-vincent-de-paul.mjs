import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './cathedral-of-saint-vincent-de-paul-model.mjs';

await generateMotatBuilding(model, import.meta.url);
