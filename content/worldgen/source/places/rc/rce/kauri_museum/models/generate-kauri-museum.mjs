import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kauri-museum-model.mjs';

await generateStructure(model, import.meta.url);
