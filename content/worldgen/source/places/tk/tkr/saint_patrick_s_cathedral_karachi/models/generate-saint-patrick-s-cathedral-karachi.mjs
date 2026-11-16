import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './saint-patrick-s-cathedral-karachi-model.mjs';

await generateStructure(model, import.meta.url);
