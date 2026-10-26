/** 'pavilion_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { pavilionStudy } from './pavilion-yasnaya-polyana-model.mjs';

signatureTowers.push(pavilionStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=pavilion_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
