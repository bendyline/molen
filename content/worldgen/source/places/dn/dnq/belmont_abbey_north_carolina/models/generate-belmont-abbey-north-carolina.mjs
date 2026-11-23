import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './belmont-abbey-north-carolina-model.mjs';
await generateMotatBuilding(model, import.meta.url);
