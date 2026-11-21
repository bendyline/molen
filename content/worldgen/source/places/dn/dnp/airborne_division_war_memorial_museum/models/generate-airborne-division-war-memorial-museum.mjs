import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './airborne-division-war-memorial-museum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
