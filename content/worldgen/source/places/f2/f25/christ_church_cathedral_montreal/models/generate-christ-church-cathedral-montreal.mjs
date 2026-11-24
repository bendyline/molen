import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './christ-church-cathedral-montreal-model.mjs';

await generateMotatBuilding(model, import.meta.url);
