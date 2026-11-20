import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './mihrimah-sultan-mosque-edirnekap-model.mjs';

await generateMotatBuilding(model, import.meta.url);
