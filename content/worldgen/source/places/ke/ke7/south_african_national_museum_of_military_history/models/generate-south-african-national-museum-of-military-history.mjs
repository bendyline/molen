import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './south-african-national-museum-of-military-history-model.mjs';

await generateStructure(model, import.meta.url);
