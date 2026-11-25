import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './thien-tru-pagoda-model.mjs';

await generateMotatBuilding(model, import.meta.url);
