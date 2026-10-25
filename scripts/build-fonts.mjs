// Rebuild the Earth lettering subset from pinned, licensed font sources; no network access.
// pnpm --filter @bendyline/molen-materials build && pnpm --filter @bendyline/molen-client build
// node scripts/build-fonts.mjs [--check]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'three/addons/libs/opentype.module.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { compileVectorFont } from '../packages/client/dist/text.mjs';

const root = fileURLToPath(new URL('../content/earth/', import.meta.url));
const source = resolve(root, 'source/fonts');
const out = resolve(root, 'fonts');
const check = process.argv.includes('--check');
const chars = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCodePoint(i + 32)),
  ...Array.from({ length: 224 }, (_, i) => String.fromCodePoint(i + 160)),
  ...Array.from('–—‘’“”…←↑→↓'),
].join('');
const specs = [
  ['overpass.semibold', 'Overpass-SemiBold.ttf', 600, 'Overpass', 'Overpass-OFL.txt'],
  ['overpass.regular', 'Overpass-Regular.ttf', 400, 'Overpass', 'Overpass-OFL.txt'],
  ['overpass.mono', 'OverpassMono-SemiBold.ttf', 600, 'Overpass Mono', 'Overpass-OFL.txt'],
  // OFL reserved family name: our compiled derivative has its own name.
  ['sign.serif', 'LibreBaskerville.ttf', 400, 'Molen Sign Serif', 'LibreBaskerville-OFL.txt'],
];
await mkdir(out, { recursive: true });
async function emit(name, value) {
  const path = resolve(out, name);
  if (check) {
    if ((await readFile(path, 'utf8')) !== value) throw new Error(`Stale font asset: ${name}`);
  } else await writeFile(path, value);
}
const provenance = [];
for (const [id, file, weight, family, license] of specs) {
  const bytes = await readFile(resolve(source, file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const parsed = opentype.parse(buffer);
  const typeface = new TTFLoader().parse(buffer);
  typeface.familyName = family;
  // TTFLoader scales outlines by 100000/(unitsPerEm*72); normalize back to true em units.
  typeface.resolution = 100000 / 72;
  const supported = Array.from(chars).filter((char) => typeface.glyphs[char]);
  const kerning = {};
  // Pair adjustments use the original em, matching the normalized outlines.
  for (const left of supported)
    for (const right of supported) {
      const amount = parsed.getKerningValue(parsed.charToGlyph(left), parsed.charToGlyph(right));
      if (amount) kerning[left + right] = Math.round((amount / parsed.unitsPerEm) * 1e6) / 1e6;
    }
  const font = compileVectorFont(typeface, {
    id,
    weight,
    characters: chars,
    kerning,
    curveSegments: 6,
  });
  const serialized = `${JSON.stringify(font)}\n`;
  await emit(`${id}.json`, serialized);
  await emit(license, await readFile(resolve(source, license), 'utf8'));
  provenance.push({
    id,
    source: file,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    outputSha256: createHash('sha256').update(serialized).digest('hex'),
    glyphs: Object.keys(font.glyphs).length,
    triangles: Object.values(font.glyphs).reduce((sum, glyph) => sum + glyph.indices.length / 3, 0),
    license,
  });
  console.log(
    `${id}: ${Object.keys(font.glyphs).length} glyphs, ${(serialized.length / 1024).toFixed(0)} KB`,
  );
}
await emit(
  'build.json',
  `${JSON.stringify({ generator: 'scripts/build-fonts.mjs', fonts: provenance }, null, 2)}\n`,
);
