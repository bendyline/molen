import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kota-kinabalu-city-mosque-model.mjs';

await generateMotatBuilding(model, import.meta.url);
