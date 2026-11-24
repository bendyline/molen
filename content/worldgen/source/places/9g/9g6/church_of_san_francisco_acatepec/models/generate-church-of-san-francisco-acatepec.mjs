import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './church-of-san-francisco-acatepec-model.mjs';

await generateMotatBuilding(model, import.meta.url);
