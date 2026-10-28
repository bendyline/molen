/** 'icehouse_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { icehouseStudy } from './icehouse-yasnaya-polyana-model.mjs';

signatureTowers.push(icehouseStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=icehouse_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
