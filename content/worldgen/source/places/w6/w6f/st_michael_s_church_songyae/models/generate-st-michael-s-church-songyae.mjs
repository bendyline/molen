import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './st-michael-s-church-songyae-model.mjs';

await generateMotatBuilding(model, import.meta.url);
