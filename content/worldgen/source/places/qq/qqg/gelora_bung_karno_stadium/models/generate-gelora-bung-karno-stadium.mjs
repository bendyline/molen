import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './gelora-bung-karno-stadium-model.mjs';

await generateStructure(model, import.meta.url);
