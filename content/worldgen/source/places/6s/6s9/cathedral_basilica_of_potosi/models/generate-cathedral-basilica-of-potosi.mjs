import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './cathedral-basilica-of-potosi-model.mjs';

await generateMotatBuilding(model, import.meta.url);
