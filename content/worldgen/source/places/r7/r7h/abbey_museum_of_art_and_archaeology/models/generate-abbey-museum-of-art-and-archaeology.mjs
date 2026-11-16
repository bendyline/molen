import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './abbey-museum-of-art-and-archaeology-model.mjs';

await generateStructure(model, import.meta.url);
