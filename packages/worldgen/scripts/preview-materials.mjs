/** Reproducible swatches of the actual shipped graphs; requires the workspace tooling deps. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { MATERIAL_PREVIEW_TINTS } from './architectural-material-catalog.mjs';
import { formatJson } from './format-json.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../../content/worldgen/materials');
const require = createRequire(resolve(here, '../../tooling/package.json'));
const sharp = require('sharp');
const outIndex = process.argv.indexOf('--out');
const destination = resolve(
  outIndex >= 0 ? process.argv[outIndex + 1] : 'artifacts/material-sheet.png',
);
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const files = (await readdir(packDir))
  .filter(
    (name) =>
      name.endsWith('.matgraph.json') &&
      (!selected || selected.includes(name.replace('.matgraph.json', ''))),
  )
  .sort();
const cols = 5;
const cellW = 360;
const cellH = 246;
const headerH = 115;
const width = cols * cellW + 40;
const height = Math.ceil(files.length / cols) * cellH + headerH + 30;
const composite = [];
const labels = [];
const report = [];

for (const [index, file] of files.entries()) {
  const id = file.replace('.matgraph.json', '');
  const parsed = validateByKind(
    'matgraph',
    JSON.parse(await readFile(resolve(packDir, file), 'utf8')),
  );
  if (!parsed.ok) throw new Error(`${id}: ${parsed.formatted}`);
  const baked = bakeMatGraph(parsed.value);
  const image = baked.slots.baseColor;
  const roughness = baked.slots.roughness;
  if (image === undefined || roughness === undefined) throw new Error(`${id}: missing PBR channel`);
  const tint = MATERIAL_PREVIEW_TINTS[id] ?? '#ffffff';
  const factors = [1, 3, 5].map((start) => Number.parseInt(tint.slice(start, start + 2), 16) / 255);
  const tinted = Buffer.from(image.data);
  let luminance = 0;
  for (let pixel = 0; pixel < image.width * image.height; pixel++) {
    const offset = pixel * 4;
    luminance +=
      (image.data[offset] * 0.2126 +
        image.data[offset + 1] * 0.7152 +
        image.data[offset + 2] * 0.0722) /
      255;
    for (let channel = 0; channel < 3; channel++) tinted[offset + channel] *= factors[channel];
  }
  luminance /= image.width * image.height;
  const raw = { width: image.width, height: image.height, channels: 4 };
  const swatch = await sharp(tinted, { raw }).resize(156, 156).png().toBuffer();
  const small = await sharp(tinted, { raw }).resize(52, 52).png().toBuffer();
  const tiled = await sharp({
    create: { width: 156, height: 156, channels: 4, background: '#ffffff' },
  })
    .composite(
      Array.from({ length: 9 }, (_, n) => ({
        input: small,
        left: (n % 3) * 52,
        top: Math.floor(n / 3) * 52,
      })),
    )
    .png()
    .toBuffer();
  const x = 20 + (index % cols) * cellW;
  const y = headerH + Math.floor(index / cols) * cellH;
  composite.push(
    { input: swatch, left: x + 12, top: y + 48 },
    { input: tiled, left: x + 180, top: y + 48 },
  );
  labels.push(
    `<rect x="${x}" y="${y}" width="348" height="232" rx="10" fill="#ffffff"/><text x="${x + 12}" y="${y + 26}" font-size="17" font-weight="600">${String(index + 1).padStart(2, '0')} ${id}</text><text x="${x + 12}" y="${y + 222}" font-size="12" fill="#607069">1 repeat · ${tint}</text><text x="${x + 180}" y="${y + 222}" font-size="12" fill="#607069">3 × 3 · roughness ${(roughness.data[0] / 255).toFixed(2)}</text>`,
  );
  report.push({
    id: `molen.worldgen.material.${id}`,
    size: [image.width, image.height],
    meanLuminance: Number(luminance.toFixed(4)),
    roughness: Number((roughness.data[0] / 255).toFixed(3)),
    channels: Object.keys(baked.slots),
    previewTint: tint,
    repeatMeters: MATERIAL_REPEAT_METERS[id],
  });
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Segoe UI, sans-serif" fill="#243e36"><rect width="100%" height="100%" fill="#e9eee9"/><text x="32" y="47" font-size="31" font-weight="700">Molen · Standard architectural surfaces</text><text x="32" y="79" font-size="16" fill="#50655c">${files.length} shared 256² procedural materials · actual baked base-color maps · representative palette tints · near and repeated views</text>${labels.join('')}</svg>`;
await mkdir(dirname(destination), { recursive: true });
await sharp(Buffer.from(svg)).composite(composite).png().toFile(destination);
await writeFile(destination.replace(/\.png$/i, '.json'), `${formatJson(report)}\n`);
console.log(`Rendered ${files.length} materials to ${destination}`);
console.log(
  `Lowest opaque luminance: ${Math.min(...report.filter((entry) => !entry.id.includes('window') && !entry.id.endsWith('storefront')).map((entry) => entry.meanLuminance))}`,
);
