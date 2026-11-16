import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './blackall-masonic-temple-model.mjs';

await generateStructure(model, import.meta.url);
