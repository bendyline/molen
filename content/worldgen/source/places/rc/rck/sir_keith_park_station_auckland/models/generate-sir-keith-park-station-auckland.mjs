import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sir-keith-park-station-auckland-model.mjs';

await generateMotatBuilding(model, import.meta.url);
