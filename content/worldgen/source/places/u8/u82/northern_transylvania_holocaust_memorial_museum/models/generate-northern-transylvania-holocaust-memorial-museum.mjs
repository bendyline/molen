import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './northern-transylvania-holocaust-memorial-museum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
