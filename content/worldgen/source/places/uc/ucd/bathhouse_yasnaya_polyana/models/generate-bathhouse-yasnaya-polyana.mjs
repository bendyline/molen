/** 'bathhouse_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { bathhouseStudy } from './bathhouse-yasnaya-polyana-model.mjs';

signatureTowers.push(bathhouseStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=bathhouse_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
