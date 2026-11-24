import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kaohsiung-museum-of-history-model.mjs';

await generateMotatBuilding(model, import.meta.url);
