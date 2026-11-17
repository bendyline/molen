import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './holy-trinity-cathedral-addis-ababa-model.mjs';

await generateStructure(model, import.meta.url);
