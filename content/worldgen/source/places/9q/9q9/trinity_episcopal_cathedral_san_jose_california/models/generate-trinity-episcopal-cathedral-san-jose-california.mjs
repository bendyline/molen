import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './trinity-episcopal-cathedral-san-jose-california-model.mjs';
await generateMotatBuilding(model, import.meta.url);
