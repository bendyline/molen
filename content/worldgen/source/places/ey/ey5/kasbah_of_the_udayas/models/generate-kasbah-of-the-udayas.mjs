import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kasbah-of-the-udayas-model.mjs';

await generateStructure(model, import.meta.url);
