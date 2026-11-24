import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './st-philip-s-church-charleston-south-carolina-model.mjs';

await generateMotatBuilding(model, import.meta.url);
