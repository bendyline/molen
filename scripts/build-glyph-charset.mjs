// The characters a region's storefront signs need: every letter of the sign-eligible place names
// in its map archive (cleaned as a sign shows them), its catalog chains' aliases, and Basic Latin.
// A region glyph pack is built from this list (scripts/build-fonts.mjs), so it carries the letters
// the region's names use rather than a whole CJK font.
//
// pnpm --filter @bendyline/molen-terrain build && pnpm --filter @bendyline/molen-worldgen-earth build
// node scripts/build-glyph-charset.mjs <region> <out.json> [--check]
// e.g. node scripts/build-glyph-charset.mjs kyoto content/glyphs-kyoto/source/charset.json
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createProtomapsTerrainMvtDecoder } from '../packages/terrain/dist/kernel.mjs';
import { cleanBusinessName } from '../packages/worldgen-earth/dist/kernel.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [region, outPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const check = process.argv.includes('--check');
if (!region || !outPath) throw new Error('usage: build-glyph-charset.mjs <region> <out.json>');
const require = createRequire(resolve(root, 'packages/terrain/package.json'));
const { PMTiles } = await import(pathToFileURL(require.resolve('pmtiles')).href);

const archivePath = `examples/world-explorer/public/terrain/${region}/world.pmtiles`;
const bytes = await readFile(resolve(root, archivePath));
const archive = new PMTiles({
  getKey: () => archivePath,
  getBytes: async (offset, length) => ({
    data: bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length),
  }),
});
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/earth/businesses/catalog.json'), 'utf8'),
);
// The place kinds that get a storefront sign: every catalog category's kinds and chain categories.
const kinds = new Set([
  ...catalog.categories.flatMap((category) => category.kinds),
  ...catalog.profiles.flatMap((profile) => profile.categories),
]);

const characters = new Set();
const add = (text) => {
  for (const char of text) if (!/\s/u.test(char)) characters.add(char);
};
// Basic Latin, the space included: names are cleaned to single spaces between words.
for (let code = 32; code < 127; code++) characters.add(String.fromCodePoint(code));
for (const profile of catalog.profiles) for (const alias of profile.aliases) add(alias);

const header = await archive.getHeader();
const z = header.maxZoom;
const tileX = (lon) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const decoder = createProtomapsTerrainMvtDecoder();
let tiles = 0,
  names = 0;
for (let x = tileX(header.minLon); x <= tileX(header.maxLon); x++)
  for (let y = tileY(header.maxLat); y <= tileY(header.minLat); y++) {
    const tile = await archive.getZxy(z, x, y);
    if (!tile?.data) continue;
    tiles++;
    const decoded = decoder.decode(new Uint8Array(tile.data), {
      address: { level: z, x, z: y },
      content: 'all',
      encoding: 'mvt',
      layers: ['poi'],
    });
    for (const poi of decoded.pois ?? []) {
      if (!kinds.has(poi.class)) continue;
      for (const raw of [poi.name, poi.nameLatin]) {
        const text = raw === undefined ? undefined : cleanBusinessName(raw);
        if (text === undefined) continue;
        names++;
        add(text);
      }
    }
  }
const sorted = [...characters].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
const document = {
  generator: 'scripts/build-glyph-charset.mjs',
  archive: { path: archivePath, sha256: createHash('sha256').update(bytes).digest('hex') },
  zoom: z,
  tiles,
  names,
  count: sorted.length,
  characters: sorted.join(''),
};
const text = `${JSON.stringify(document, null, 2)}\n`;
const target = resolve(root, outPath);
if (check) {
  if ((await readFile(target, 'utf8')) !== text) throw new Error(`Stale character set: ${outPath}`);
} else await writeFile(target, text);
console.log(`${region}: ${sorted.length} characters from ${names} names in ${tiles} tiles`);
