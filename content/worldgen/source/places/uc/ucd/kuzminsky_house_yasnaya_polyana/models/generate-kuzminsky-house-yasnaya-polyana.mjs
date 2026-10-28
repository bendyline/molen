/** 'kuzminsky_house_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { kuzminskyStudy } from './kuzminsky-house-yasnaya-polyana-model.mjs';

signatureTowers.push(kuzminskyStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=kuzminsky_house_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
