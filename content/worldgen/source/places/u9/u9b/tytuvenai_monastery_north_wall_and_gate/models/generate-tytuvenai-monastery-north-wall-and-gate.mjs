import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tytuvenai-monastery-north-wall-and-gate-model.mjs';

await generateMotatBuilding(model, import.meta.url);
