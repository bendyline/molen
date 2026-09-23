import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { encodeStarCatalog } from '../dist/index.mjs';

// Offline regeneration of the molen.sky pack's star catalog, after `pnpm build`:
//   node packages/client/scripts/generate-star-catalog.mjs /path/to/catalog.gz
// Source: https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
// Columns: https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe
// Writes content/sky/stars.bin (molen/stars@1); content/sky/NOTICE.md carries the attribution.
const input = process.argv[2];
if (!input) throw new Error('Pass the downloaded V/50 catalog.gz path');
const bytes = await readFile(input);
const rows = [];
for (const line of gunzipSync(bytes).toString('ascii').split('\n')) {
  if (!line.slice(75, 83).trim() || !line.slice(102, 107).trim()) continue;
  const num = (start, end) => Number(line.slice(start - 1, end));
  const magnitude = num(103, 107);
  if (magnitude > 6.5) continue;
  const ra = 15 * (num(76, 77) + num(78, 79) / 60 + num(80, 83) / 3600);
  const dec = (line[83] === '-' ? -1 : 1) * (num(85, 86) + num(87, 88) / 60 + num(89, 90) / 3600);
  const bv = line.slice(109, 114).trim() ? num(110, 114) : 0;
  rows.push([ra, dec, magnitude, bv].map((v) => Number(v.toFixed(5))));
}
const out = encodeStarCatalog(rows);
await writeFile(new URL('../../../content/sky/stars.bin', import.meta.url), out);
console.log(
  `Wrote content/sky/stars.bin: ${rows.length} stars, ${out.length} bytes (input sha256 ${createHash('sha256').update(bytes).digest('hex')})`,
);
