import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './shah-mosque-mashhad-model.mjs';

await generateMotatBuilding(model, import.meta.url);
