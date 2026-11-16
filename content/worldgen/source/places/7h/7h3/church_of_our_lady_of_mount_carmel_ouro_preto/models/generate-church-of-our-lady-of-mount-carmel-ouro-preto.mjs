import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './church-of-our-lady-of-mount-carmel-ouro-preto-model.mjs';

await generateStructure(model, import.meta.url);
