import { generateMotatBuilding as generateStructure } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './primatial-cathedral-of-bogota-model.mjs';

await generateStructure(model, import.meta.url);
