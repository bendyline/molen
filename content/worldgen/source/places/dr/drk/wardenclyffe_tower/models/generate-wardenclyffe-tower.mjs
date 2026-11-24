import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './wardenclyffe-tower-model.mjs';

await generateMotatBuilding(model, import.meta.url);
