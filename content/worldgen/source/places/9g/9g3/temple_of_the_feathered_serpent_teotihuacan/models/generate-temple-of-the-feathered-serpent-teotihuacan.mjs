import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './temple-of-the-feathered-serpent-teotihuacan-model.mjs';

await generateMotatBuilding(model, import.meta.url);
