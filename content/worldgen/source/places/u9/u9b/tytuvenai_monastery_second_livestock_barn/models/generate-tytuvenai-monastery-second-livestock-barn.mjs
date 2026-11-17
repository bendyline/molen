import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tytuvenai-monastery-second-livestock-barn-model.mjs';

await generateMotatBuilding(model, import.meta.url);
