import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tytuvenai-church-of-the-virgin-mary-model.mjs';

await generateMotatBuilding(model, import.meta.url);
