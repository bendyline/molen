import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './western-springs-pumping-station-auckland-model.mjs';

await generateMotatBuilding(model, import.meta.url);
