/** 'white_kitchen_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { kitchenStudy } from './white-kitchen-yasnaya-polyana-model.mjs';

signatureTowers.push(kitchenStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=white_kitchen_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
