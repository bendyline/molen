import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './st-michael-and-all-angels-church-blantyre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
