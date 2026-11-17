import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './grand-egyptian-museum-model.mjs';

await generateStructure(model, import.meta.url);
