import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './church-of-our-lady-of-the-rosary-of-black-men-ouro-preto-model.mjs';

await generateStructure(model, import.meta.url);
