import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tianjin-nankai-high-school-model.mjs';

await generateMotatBuilding(model, import.meta.url);
