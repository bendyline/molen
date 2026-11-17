import { forestStudy } from './forest-of-remembrance-model.mjs';

const { signatureTowers } = await import(
  '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs'
);
const id = 'forest_of_remembrance';
signatureTowers.push(forestStudy);
if (!process.argv.some((arg) => arg.startsWith('--ids='))) {
  process.argv.push(`--ids=${id}`);
}
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
