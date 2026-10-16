// Actual worldgen buffers and shared material graphs, captured with Molen's public preview op.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewWorldgen } from '../../../packages/tooling/dist/index.mjs';
import { architectureFamilies } from './architecture-families.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const variants = process.argv.includes('--variants') ? ['', '.compact', '.open'] : [''];
const out = resolve(
  root,
  `.artifacts/regional-world/${variants.length > 1 ? 'architecture-diversity' : 'architecture'}`,
);
await mkdir(out, { recursive: true });
const selected = process.argv
  .filter((arg) => arg.startsWith('--family='))
  .map((arg) => arg.slice(9));
const entries = [
  ['detached', 'house', 12, 10, 2],
  ['attached', 'terrace', 8, 14, 3],
  ['apartments', 'apartments', 22, 16, 5],
  ['commercial', 'retail', 20, 14, 2],
  ['civic', 'school', 24, 15, 2],
  ['industrial', 'warehouse', 28, 20, 1],
  ['farm', 'barn', 22, 16, 1],
];
const evidence = [];
for (const family of architectureFamilies) {
  if (selected.length && !selected.includes(family.id)) continue;
  const batch = {
    format: 'molen/worldgen-batch@1',
    name: `${family.title} ordinary buildings`,
    ground: { kind: 'flat', height: 0, dx: 0, dz: 0 },
    buildings: variants.flatMap((suffix, row) =>
      entries.map(([type, label, width, depth, levels], i) => {
        const x = (variants.length > 1 ? i : i % 4) * 36,
          z = (variants.length > 1 ? row : Math.floor(i / 4)) * 42;
        return {
          identity: `regional-qa:${type}${suffix}`,
          labels: [label],
          levels,
          style: `molen.worldgen.regional.${family.id}.${type}${suffix}`,
          outline: [
            [x, z],
            [x + width, z],
            [x + width, z + depth],
            [x, z + depth],
          ],
        };
      }),
    ),
    tier: 0,
  };
  const batchPath = resolve(out, `${family.id}.batch.json`);
  await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
  const result = await previewWorldgen({
    packPath: resolve(root, 'content/worldgen'),
    batchPath,
    angles: 2,
    size: [variants.length > 1 ? 1920 : 1440, 1000],
    outPath: resolve(out, `${family.id}.png`),
  });
  if (!result.ok || result.materialFailures?.length) throw new Error(JSON.stringify(result));
  const report = {
    family: family.id,
    hash: result.hash,
    renderStats: result.renderStats,
    frames: result.frames,
  };
  evidence.push(report);
  console.log(JSON.stringify(report));
}
await writeFile(resolve(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
