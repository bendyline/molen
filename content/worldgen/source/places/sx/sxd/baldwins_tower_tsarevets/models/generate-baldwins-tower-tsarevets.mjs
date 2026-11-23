import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './baldwins-tower-tsarevets-model.mjs';

await generateMotatBuilding(model, import.meta.url);
