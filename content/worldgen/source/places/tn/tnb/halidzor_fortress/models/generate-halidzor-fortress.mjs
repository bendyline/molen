import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './halidzor-fortress-model.mjs';

await generateMotatBuilding(model, import.meta.url);
