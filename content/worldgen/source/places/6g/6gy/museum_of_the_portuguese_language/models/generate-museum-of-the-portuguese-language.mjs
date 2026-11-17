import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './museum-of-the-portuguese-language-model.mjs';

await generateStructure(model, import.meta.url);
