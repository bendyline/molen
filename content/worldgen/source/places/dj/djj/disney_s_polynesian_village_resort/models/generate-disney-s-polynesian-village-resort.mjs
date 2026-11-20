import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './disney-s-polynesian-village-resort-model.mjs';

await generateStructure(model, import.meta.url);
