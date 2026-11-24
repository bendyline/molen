import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './church-of-santa-prisca-de-taxco-model.mjs';

await generateMotatBuilding(model, import.meta.url);
