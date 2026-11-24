import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './ocean-forest-hotel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
