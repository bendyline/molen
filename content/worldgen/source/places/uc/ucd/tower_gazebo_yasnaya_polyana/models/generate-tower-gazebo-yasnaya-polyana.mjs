/** 'tower_gazebo_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { towerGazeboStudy } from './tower-gazebo-yasnaya-polyana-model.mjs';

signatureTowers.push(towerGazeboStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=tower_gazebo_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
