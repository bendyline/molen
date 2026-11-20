import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './bibi-shahrbanu-shrine-model.mjs';

await generateMotatBuilding(model, import.meta.url);
