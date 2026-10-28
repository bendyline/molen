/** One small comparison sheet per vehicle. Bulk captures stay in .artifacts. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const root = resolve(repo, 'content/entities');
const output = resolve(root, 'livery-previews');
const shots = resolve(repo, '.artifacts/livery-gallery');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const catalog = (await read('source/liveries.json')).models;
const project = await read('project.json');
const definitions = {};
for (const path of project.types) Object.assign(definitions, (await read(path)).types);
const aliases = { f_16b: 'f16', winnebago_view_2022: 'rv', ford_mustang_2024: 'mustang' };
const capture = process.argv.includes('--capture');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (
  selected?.some((key) => !Object.keys(catalog).some((id) => id === key || id.endsWith(`.${key}`)))
)
  throw new Error('Unknown vehicle in --ids');
const screenshot = capture
  ? (await import('../../tooling/dist/index.mjs')).screenshotScene
  : undefined;
const sharp = capture
  ? createRequire(new URL('../../tooling/package.json', import.meta.url))('sharp')
  : undefined;
let previous = { examples: [] };
try {
  previous = await read('livery-previews/manifest.json');
} catch (error) {
  if (!capture) throw error;
}
const manifest = { format: 'molen/livery-previews@1', examples: [] };
await mkdir(output, { recursive: true });
if (capture) await mkdir(shots, { recursive: true });
const escapeXml = (s) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
for (const [type, data] of Object.entries(catalog)) {
  const key = type.split('.').at(-1),
    slug = aliases[key] ?? key;
  const asset = await read(project.assets[type]);
  const runtimeHash = hash(
    await readFile(resolve(root, project.assets[type], '..', asset.files.main)),
  );
  const lo = asset.bounds.aabb.min,
    hi = asset.bounds.aabb.max;
  const center = lo.map((v, i) => (v + hi[i]) / 2);
  const distance = Math.max(...hi.map((v, i) => v - lo[i])) * 1.3;
  const camera = [center[0] + distance, center[1] + distance * 0.43, center[2] + distance * 0.8];
  const entry = {
    type,
    image: `${slug}.png`,
    variants: data.variants.map((v) => v.id),
    recipeHash: hash(JSON.stringify(data)),
    runtimeHash,
    camera,
    lookAt: center,
    renderer: 'photo-sheet-v1',
  };
  const old = previous.examples.find((e) => e.type === type);
  let current = false;
  if (
    old &&
    Object.entries(entry).every(([k, v]) => JSON.stringify(old[k]) === JSON.stringify(v))
  ) {
    try {
      current = old.imageHash === hash(await readFile(resolve(output, entry.image)));
    } catch {}
  }
  if (current) {
    manifest.examples.push(old);
    continue;
  }
  if (!capture || (selected && !selected.includes(type) && !selected.includes(key)))
    throw new Error(`${key}: stale preview; run preview-liveries.mjs --capture --ids=${key}`);
  const composites = [];
  for (const [i, variant] of data.variants.entries()) {
    // Pass the full component data: merging a partial definition can retain obsolete slots.
    const scene = {
      format: 'molen/scene@3',
      name: 'Livery gallery',
      seed: 'photo-review',
      tickRate: 30,
      camera: { mode: 'fixed', position: camera, lookAt: center, fov: 40 },
      entities: [
        {
          id: 'vehicle',
          components: {
            ...definitions[type].components,
            transform: { pos: [0, 0, 0] },
            livery: { ...data, selected: variant.id },
          },
        },
        {
          id: 'light',
          components: {
            environment: {
              ambient: { sky: '#f1f3f2', ground: '#a3a29e', intensity: 2 },
              sun: { direction: [7, 12, 6], color: '#ffffff', intensity: 3 },
              toneMapping: 'aces',
              exposure: 1,
              background: '#b2cde4',
            },
          },
        },
      ],
    };
    const out = resolve(shots, `${key}-${variant.id}.png`);
    const result = await screenshot({
      scene,
      projectPath: resolve(root, 'project.json'),
      ticks: 0,
      outPath: out,
      size: [1000, 650],
      reflections: true,
      antialias: true,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    composites.push({
      input: await sharp(out)
        .trim({ background: '#b2cde4', threshold: 12 })
        .resize(500, 310, { fit: 'contain', background: '#b2cde4' })
        .png()
        .toBuffer(),
      left: i * 500,
      top: 0,
    });
    const label = `<svg width="500" height="55"><rect width="500" height="55" fill="#f3efe6"/><text x="10" y="22" font-family="Arial" font-size="16">${escapeXml(variant.label)}</text><text x="10" y="43" font-family="Arial" font-size="12">${escapeXml(key)} · ${escapeXml(variant.id)}</text></svg>`;
    composites.push({ input: Buffer.from(label), left: i * 500, top: 310 });
  }
  const png = await sharp({
    create: { width: 500 * data.variants.length, height: 365, channels: 3, background: '#f3efe6' },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(output, entry.image), png);
  manifest.examples.push({ ...entry, imageHash: hash(png) });
  console.log(`Captured ${type}`);
}
if (capture) {
  // Format like `biome check` so a capture leaves the tracked manifest lint-clean.
  const path = resolve(output, 'manifest.json');
  const biome = fileURLToPath(new URL('../node_modules/@biomejs/biome/bin/biome', import.meta.url));
  const formatted = execFileSync(process.execPath, [biome, 'format', '--stdin-file-path', path], {
    input: `${JSON.stringify(manifest, null, 2)}\n`,
    encoding: 'utf8',
  });
  if (!formatted.trim()) throw new Error(`Formatter produced no JSON for ${path}`);
  await writeFile(path, formatted);
}
console.log(`Checked ${manifest.examples.length} livery comparison sheets.`);
