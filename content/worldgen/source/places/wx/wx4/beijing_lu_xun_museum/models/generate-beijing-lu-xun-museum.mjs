import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './beijing-lu-xun-museum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
