import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './b07-cn-tower-toronto-model.mjs';

await generateMotatBuilding(model, import.meta.url);
