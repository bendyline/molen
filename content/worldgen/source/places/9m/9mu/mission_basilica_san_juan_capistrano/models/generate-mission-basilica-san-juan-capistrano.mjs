import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './mission-basilica-san-juan-capistrano-model.mjs';

await generateMotatBuilding(model, import.meta.url);
