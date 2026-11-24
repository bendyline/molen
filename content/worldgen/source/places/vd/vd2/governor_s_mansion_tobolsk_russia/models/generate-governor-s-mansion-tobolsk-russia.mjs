import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './governor-s-mansion-tobolsk-russia-model.mjs';

await generateMotatBuilding(model, import.meta.url);
