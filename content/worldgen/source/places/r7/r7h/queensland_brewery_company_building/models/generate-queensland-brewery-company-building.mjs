import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './queensland-brewery-company-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
