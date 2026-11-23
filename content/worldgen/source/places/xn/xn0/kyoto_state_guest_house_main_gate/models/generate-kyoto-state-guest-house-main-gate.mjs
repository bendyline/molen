import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kyoto-state-guest-house-main-gate-model.mjs';

await generateMotatBuilding(model, import.meta.url);
