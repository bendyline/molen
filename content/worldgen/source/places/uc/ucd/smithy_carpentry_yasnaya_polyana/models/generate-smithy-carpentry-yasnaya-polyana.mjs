/** 'smithy_carpentry_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { smithyStudy } from './smithy-carpentry-yasnaya-polyana-model.mjs';

signatureTowers.push(smithyStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=smithy_carpentry_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
