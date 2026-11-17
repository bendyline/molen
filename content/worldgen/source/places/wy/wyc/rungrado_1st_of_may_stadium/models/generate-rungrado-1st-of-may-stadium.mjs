import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './rungrado-1st-of-may-stadium-model.mjs';

await generateStructure(model, import.meta.url);
