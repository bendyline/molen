import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './borssele-nuclear-power-station-model.mjs';

await generateMotatBuilding(model, import.meta.url);
