import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './green-tree-tavern-janis-ziegler-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
