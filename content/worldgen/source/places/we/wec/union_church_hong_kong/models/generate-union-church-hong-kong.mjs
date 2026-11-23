import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './union-church-hong-kong-model.mjs';

await generateMotatBuilding(model, import.meta.url);
