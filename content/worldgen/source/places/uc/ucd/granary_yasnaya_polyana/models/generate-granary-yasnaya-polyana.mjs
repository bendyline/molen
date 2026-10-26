/** 'granary_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { granaryStudy } from './granary-yasnaya-polyana-model.mjs';

signatureTowers.push(granaryStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=granary_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
