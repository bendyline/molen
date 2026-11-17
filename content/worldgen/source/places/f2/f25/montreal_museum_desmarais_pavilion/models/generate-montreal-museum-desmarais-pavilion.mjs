import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './montreal-museum-desmarais-pavilion-model.mjs';

await generateMotatBuilding(model, import.meta.url);
