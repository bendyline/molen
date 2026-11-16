import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-byewash-reservoir-dam-model.mjs';

await generateMotatBuilding(model, import.meta.url);
