import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './grianan-theatre-model.mjs';
await generateMotatBuilding(model, import.meta.url);
