import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-byewash-reservoir-valve-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
