import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './unitarian-church-in-charleston-model.mjs';

await generateMotatBuilding(model, import.meta.url);
