import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './wat-phra-that-choeng-chum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
