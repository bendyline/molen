import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tel-aviv-museum-of-art-model.mjs';

await generateStructure(model, import.meta.url);
