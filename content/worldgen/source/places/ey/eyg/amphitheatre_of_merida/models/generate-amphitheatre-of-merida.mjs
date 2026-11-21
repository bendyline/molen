import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './amphitheatre-of-merida-model.mjs';

await generateStructure(model, import.meta.url);
