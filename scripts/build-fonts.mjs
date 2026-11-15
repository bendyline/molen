// Rebuild the Earth lettering subset from pinned, licensed font sources; no network access.
// pnpm --filter @bendyline/molen-materials build && pnpm --filter @bendyline/molen-client build
// node scripts/build-fonts.mjs [--check]
//
// Writes the vector fonts (triangulated outlines for road signs and labels) and the storefront
// sign glyph atlas (distance fields; see scripts/glyph-atlas.mjs) into content/earth/fonts.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'three/addons/libs/opentype.module.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { compileVectorFont } from '../packages/client/dist/text.mjs';
import { buildGlyphAtlas } from './glyph-atlas.mjs';

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
async function emit(name, value, directory = out) {
  const path = resolve(directory, name);
  if (check) {
    const existing = await readFile(path).catch(() => undefined);
    const expected = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
    if (existing === undefined || !existing.equals(expected))
      throw new Error(`Stale font asset: ${name}`);
  } else await writeFile(path, value);
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const provenance = [];
const parsedFonts = new Map();
for (const [id, file, weight, family, license] of specs) {
  const bytes = await readFile(resolve(source, file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const parsed = opentype.parse(buffer);
  parsedFonts.set(id, { parsed, family, weight, file });
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
// Storefront sign lettering: one distance-field atlas for the sign faces, shared by every sign.
// 48 texels per em keeps a sign's letters crisp at street distance; a 4-texel distance range
// antialiases them down to a few pixels tall, past which the renderer stops drawing them.
const signAtlas = buildGlyphAtlas({
  id: 'molen.earth.signs',
  faces: ['overpass.semibold', 'overpass.regular', 'sign.serif'].map((id) => {
    const { parsed, family, weight } = parsedFonts.get(id);
    return {
      id,
      font: parsed,
      family,
      weight,
      characters: chars,
      // Pair kerning for Basic Latin only: the accented pairs would treble the document.
      kerning: chars.slice(0, 95),
    };
  }),
  emSize: 48,
  distanceRange: 4,
  pagePrefix: 'signs.glyphs',
  defaultFace: 'overpass.semibold',
  roles: { bold: 'overpass.semibold', sans: 'overpass.regular', serif: 'sign.serif' },
});
const atlasJson = `${JSON.stringify(signAtlas.doc)}\n`;
await emit('signs.glyphs.json', atlasJson);
const atlasPages = [];
for (const [index, page] of signAtlas.pages.entries()) {
  const name = signAtlas.doc.pages[index].path;
  await emit(name, page);
  atlasPages.push({ path: name, sha256: sha256(page) });
}
console.log(
  `signs.glyphs: ${Object.values(signAtlas.doc.faces).reduce((n, f) => n + Object.keys(f.glyphs).length, 0)} glyphs, ` +
    `${signAtlas.doc.pages.map((p) => `${p.width}x${p.height}`).join(', ')}, ${(atlasJson.length / 1024).toFixed(0)} KB metrics`,
);
await emit(
  'build.json',
  `${JSON.stringify(
    {
      generator: 'scripts/build-fonts.mjs',
      fonts: provenance,
      glyphAtlases: [
        {
          id: signAtlas.doc.id,
          faces: Object.keys(signAtlas.doc.faces),
          outputSha256: sha256(atlasJson),
          pages: atlasPages,
        },
      ],
    },
    null,
    2,
  )}\n`,
);

// Region glyph packs (content/glyphs-*): the letters a region's place names use beyond the Latin
// faces, from a pinned font and the region's character set (scripts/build-glyph-charset.mjs).
// Each pack ships its atlas in glyphs/, with the font's license and the build's provenance.
const contentRoot = resolve(root, '..');
for (const dir of (await readdir(contentRoot))
  .filter((name) => name.startsWith('glyphs-'))
  .sort()) {
  const sourceDir = resolve(contentRoot, dir, 'source');
  const spec = JSON.parse(await readFile(resolve(sourceDir, 'glyphs.json'), 'utf8'));
  const charset = JSON.parse(await readFile(resolve(sourceDir, spec.charset), 'utf8'));
  const fontBytes = await readFile(resolve(sourceDir, spec.font));
  const font = opentype.parse(
    fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength),
  );
  const atlas = buildGlyphAtlas({
    id: spec.id,
    faces: [
      {
        id: spec.face,
        font,
        family: spec.family,
        weight: spec.weight,
        characters: charset.characters,
      },
    ],
    emSize: spec.emSize,
    distanceRange: spec.distanceRange,
    pagePrefix: spec.prefix,
    defaultFace: spec.face,
  });
  const glyphsDir = resolve(contentRoot, dir, 'glyphs');
  await mkdir(glyphsDir, { recursive: true });
  const json = `${JSON.stringify(atlas.doc)}\n`;
  await emit(`${spec.prefix}.json`, json, glyphsDir);
  const pages = [];
  for (const [index, page] of atlas.pages.entries()) {
    const name = atlas.doc.pages[index].path;
    await emit(name, page, glyphsDir);
    pages.push({ path: name, sha256: sha256(page) });
  }
  await emit('OFL.txt', await readFile(resolve(sourceDir, spec.license), 'utf8'), glyphsDir);
  const glyphs = atlas.doc.faces[spec.face].glyphs;
  // Letters the name list has and the font does not (Thai, Hangul, rare forms): those names fall
  // back to an English name or their category sign.
  const missing = Array.from(charset.characters).filter((char) => !Object.hasOwn(glyphs, char));
  await emit(
    'build.json',
    `${JSON.stringify(
      {
        generator: 'scripts/build-fonts.mjs',
        id: spec.id,
        face: spec.face,
        source: spec.font,
        sourceSha256: sha256(fontBytes),
        upstream: spec.upstream,
        charsetSha256: sha256(await readFile(resolve(sourceDir, spec.charset))),
        glyphs: Object.keys(glyphs).length,
        missing: missing.join(''),
        outputSha256: sha256(json),
        pages,
      },
      null,
      2,
    )}\n`,
    glyphsDir,
  );
  console.log(
    `${spec.prefix}: ${Object.keys(glyphs).length} glyphs (${missing.length} not in the font), ` +
      `${atlas.doc.pages.map((p) => `${p.width}x${p.height}`).join(', ')}`,
  );
}
