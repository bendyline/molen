import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './xavier-and-sadie-herbert-s-cottage-model.mjs';

await generateStructure(model, import.meta.url);
