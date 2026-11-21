import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './wat-phra-kaew-chiang-rai-model.mjs';

await generateStructure(model, import.meta.url);
