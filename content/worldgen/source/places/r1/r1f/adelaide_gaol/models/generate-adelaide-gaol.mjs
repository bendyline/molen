import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './adelaide-gaol-model.mjs';

await generateStructure(model, import.meta.url);
