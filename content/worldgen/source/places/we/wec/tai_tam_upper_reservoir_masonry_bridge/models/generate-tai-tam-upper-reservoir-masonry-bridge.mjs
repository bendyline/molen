import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-upper-reservoir-masonry-bridge-model.mjs';

await generateMotatBuilding(model, import.meta.url);
