import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './plaza-theatre-el-paso-model.mjs';

await generateMotatBuilding(model, import.meta.url);
