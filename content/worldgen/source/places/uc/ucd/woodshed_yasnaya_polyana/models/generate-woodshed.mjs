import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { woodshedStudy } from './woodshed-model.mjs';

signatureTowers.push(woodshedStudy);
if (!process.argv.some((arg) => arg.startsWith('--ids=')))
  process.argv.push(`--ids=${woodshedStudy.id}`);
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
