import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './christ-church-cathedral-grafton-model.mjs';

await generateMotatBuilding(model, import.meta.url);
