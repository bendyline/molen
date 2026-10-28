/** 'gate_towers_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { gateTowersStudy } from './gate-towers-yasnaya-polyana-model.mjs';

signatureTowers.push(gateTowersStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=gate_towers_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
