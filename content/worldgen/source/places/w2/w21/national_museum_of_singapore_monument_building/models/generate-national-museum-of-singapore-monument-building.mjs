import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './national-museum-of-singapore-monument-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
