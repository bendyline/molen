import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './shrine-of-baba-farid-model.mjs';

await generateMotatBuilding(model, import.meta.url);
