import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

// Offline regeneration: node scripts/generate-star-catalog.mjs /path/to/catalog.gz
// Source: https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
// Columns: https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe
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
const header = `// Generated from Bright Star Catalogue V/50, Hoffleit & Warren (1991), via CDS.\n// https://cdsarc.cds.unistra.fr/ftp/V/50/ — see guide/sky.md for attribution.\n// Input SHA256: ${createHash('sha256').update(bytes).digest('hex')}\n// ${rows.length} stars through visual magnitude 6.5. J2000 RA/Dec degrees, V magnitude, B-V.\n// Regenerate with packages/client/scripts/generate-star-catalog.mjs; do not edit.\n// biome-ignore-all format: generated numeric catalog\nexport const brightStars: ReadonlyArray<readonly [number, number, number, number]> = [\n`;
await writeFile(
  new URL('../src/sky/bright-stars.ts', import.meta.url),
  `${header}${rows.map((row) => `  [${row.join(', ')}],`).join('\n')}\n];\n`,
);
console.log(`Generated ${rows.length} stars`);
