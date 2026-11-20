import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './dura-europos-church-model.mjs';

await generateMotatBuilding(model, import.meta.url);
