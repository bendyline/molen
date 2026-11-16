import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-tuk-reservoir-masonry-bridge-2-model.mjs';

await generateMotatBuilding(model, import.meta.url);
