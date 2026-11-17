import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './ancient-congregational-mosque-of-shiraz-model.mjs';

await generateStructure(model, import.meta.url);
