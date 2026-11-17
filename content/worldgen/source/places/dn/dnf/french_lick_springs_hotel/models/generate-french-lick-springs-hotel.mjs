import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './french-lick-springs-hotel-model.mjs';

await generateStructure(model, import.meta.url);
