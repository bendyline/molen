import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tytuvenai-holy-stairs-chapel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
