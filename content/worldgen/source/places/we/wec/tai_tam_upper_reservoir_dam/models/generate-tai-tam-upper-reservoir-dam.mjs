import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-upper-reservoir-dam-model.mjs';

await generateMotatBuilding(model, import.meta.url);
