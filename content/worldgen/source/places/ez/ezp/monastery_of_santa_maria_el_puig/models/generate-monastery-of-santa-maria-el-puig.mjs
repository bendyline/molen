import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './monastery-of-santa-maria-el-puig-model.mjs';
await generateMotatBuilding(model, import.meta.url);
