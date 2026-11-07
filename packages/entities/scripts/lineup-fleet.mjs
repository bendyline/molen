/** True-scale orthographic line-up for proportion review. Local evidence only.
 *
 * Every model shares one pixels-per-metre scale and one ground line, so a shared silhouette or a
 * wrong relative size is visible at a glance, which a turntable per model hides. Published length,
 * width and height say nothing about shape; compare what this shows with references.
 *
 * node packages/entities/scripts/lineup-fleet.mjs --ids=ford-f-150-2025,toyota-rav4-2025 \
 *   --out=.artifacts/lineups/trucks.png [--view=side|front] [--cols=4] [--cell=6.4,2.9] [--ppm=56]
 *
 * Asset bounds and the labels come from the imported runtime models, so rebuild and import first.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { screenshotScene } from '../../tooling/dist/index.mjs';

const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const ids = option('ids')?.split(',');
const out = option('out');
if (!ids?.length || !out) throw Error('Select models with --ids=... and a PNG with --out=...');
const view = option('view', 'side'),
  cols = Number(option('cols', 4)),
  [cellWidth, cellHeight] = option('cell', '6.4,2.9').split(',').map(Number),
  ppm = Number(option('ppm', 56));

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(packageRoot, '../../content/entities');
const sharp = createRequire(resolve(packageRoot, '../tooling/package.json'))('sharp');
const rotation = (x, y, z) =>
  new Quaternion()
    .setFromRotationMatrix(
      new Matrix4().makeBasis(new Vector3(...x), new Vector3(...y), new Vector3(...z)),
    )
    .toArray();
const rot =
  view === 'front'
    ? rotation([1, 0, 0], [0, 0, -1], [0, 1, 0])
    : rotation([0, 1, 0], [0, 0, -1], [-1, 0, 0]);

async function bundle(slug) {
  for (const category of ['vehicles', 'cycles', 'watercraft', 'transit', 'aircraft']) {
    const directory = `${base}/source/${category}/${slug}`;
    const text = await readFile(`${directory}/source.json`, 'utf8').catch((e) => {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    });
    if (text) return JSON.parse(text);
  }
  throw Error(`No source bundle named ${slug}`);
}

const entities = [],
  labels = [],
  quaternion = new Quaternion(...rot);
for (const [i, slug] of ids.entries()) {
  const source = await bundle(slug);
  const asset = JSON.parse(
    await readFile(`${base}/${source.files.models.find((m) => m.output).output}`, 'utf8'),
  );
  const { min, max } = asset.bounds.aabb,
    col = i % cols,
    row = Math.floor(i / cols);
  // The capture looks down: screen right is +X and screen down is +Z. Centre each model along its
  // length and rest it on the cell's ground line.
  const center = new Vector3((min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2).applyQuaternion(
    quaternion,
  );
  entities.push({
    id: `model-${i}`,
    components: {
      transform: {
        pos: [
          col * cellWidth + cellWidth / 2 - center.x,
          0,
          row * cellHeight + cellHeight - 0.6 - center.z,
        ],
        rot,
      },
      renderable: { kind: 'gltf', ref: source.id },
    },
  });
  const size = min.map((v, k) => (max[k] - v).toFixed(2));
  labels.push({
    x: col * cellWidth * ppm + 6,
    y: row * cellHeight * ppm + 16,
    text: `${slug}  ${size[2]}×${size[0]}×${size[1]}`,
  });
}
entities.push({
  id: 'environment',
  components: {
    environment: {
      background: '#f1f0eb',
      ambient: { sky: '#fffdf5', ground: '#9a9b94', intensity: 1.3 },
      sun: { direction: [7, 12, 5], color: '#ffffff', intensity: 2 },
      toneMapping: 'agx',
      exposure: 1,
    },
  },
});
const rows = Math.ceil(ids.length / cols),
  width = Math.round(cols * cellWidth * ppm),
  height = Math.round(rows * cellHeight * ppm);
const outPath = resolve(out);
await mkdir(dirname(outPath), { recursive: true });
const result = await screenshotScene({
  scene: {
    format: 'molen/scene@3',
    name: 'proportion line-up',
    seed: 'lineup',
    physics: { engine: 'none' },
    camera: {
      mode: 'top-down-ortho',
      center: [(cols * cellWidth) / 2, (rows * cellHeight) / 2],
      viewHeight: rows * cellHeight,
      cameraHeight: 400,
    },
    entities,
  },
  projectPath: `${base}/project.json`,
  ticks: 0,
  size: [width, height],
  outPath,
  antialias: true,
});
if (!result.ok) throw Error(JSON.stringify(result));
const text = labels
  .map(
    (l) =>
      `<text x="${l.x}" y="${l.y}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#334">${l.text}</text>`,
  )
  .join('');
const lettering = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${text}</svg>`,
);
const labeled = await sharp(outPath)
  .composite([{ input: lettering }])
  .toBuffer();
await sharp(labeled).toFile(outPath);
console.log(`${outPath}: ${ids.length} models at ${ppm} px/m, ${width}×${height}`);
