import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './basilica-of-saint-sernin-toulouse-model.mjs';

await generateMotatBuilding(model, import.meta.url);
