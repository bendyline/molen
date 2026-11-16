import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './caracas-cathedral-model.mjs';

await generateStructure(model, import.meta.url);
