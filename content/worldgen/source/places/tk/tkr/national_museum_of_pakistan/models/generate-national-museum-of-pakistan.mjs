import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './national-museum-of-pakistan-model.mjs';

await generateStructure(model, import.meta.url);
