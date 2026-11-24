import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './old-fresno-water-tower-model.mjs';

await generateMotatBuilding(model, import.meta.url);
