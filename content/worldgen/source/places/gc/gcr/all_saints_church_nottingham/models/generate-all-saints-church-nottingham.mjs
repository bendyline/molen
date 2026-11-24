import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './all-saints-church-nottingham-model.mjs';

await generateMotatBuilding(model, import.meta.url);
