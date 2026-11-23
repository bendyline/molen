import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './raudone-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
