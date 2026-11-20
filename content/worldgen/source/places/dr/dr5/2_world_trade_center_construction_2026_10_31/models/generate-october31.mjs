import { generateConstruction } from '../../2_world_trade_center_construction_2026/models/generate-construction.mjs';
import { buildMaster, surfaces } from './october31-model.mjs';

await generateConstruction(
  import.meta.url,
  buildMaster,
  surfaces,
  'Molen 2 World Trade Center construction, October 31 2026',
);
