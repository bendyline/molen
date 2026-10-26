/** 'equipment_shed_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { equipmentStudy } from './equipment-shed-yasnaya-polyana-model.mjs';

signatureTowers.push(equipmentStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=equipment_shed_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
