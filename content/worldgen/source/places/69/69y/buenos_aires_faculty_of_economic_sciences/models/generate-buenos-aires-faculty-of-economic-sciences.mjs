import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './buenos-aires-faculty-of-economic-sciences-model.mjs';

await generateStructure(model, import.meta.url);
