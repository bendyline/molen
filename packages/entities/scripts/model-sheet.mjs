/**
 * Model review sheets: one image per model (or per comparison) with calibrated views.
 *
 * capture-fleet.mjs renders registered runtime assets in scenes; this renders any GLB directly,
 * so a generator change can be judged before import. Each model gets one row of views under
 * an Earth-like rig (warm sun, sky fill, ACES): a walk-around three-quarter front and rear at
 * eye height, orthographic side, front, rear and top at one shared scale, and two clay views
 * (flat grey, every material replaced) for the silhouette check in the medium-fi review. The
 * recipe's declared length, width, height and wheelbase are drawn as red guides on the
 * orthographic views, so a body that misses its published dimensions shows without measuring.
 *
 *   node packages/entities/scripts/model-sheet.mjs --ids=ford-f-150-2025,sedan
 *   node packages/entities/scripts/model-sheet.mjs --glb=a.glb,b.glb --labels=before,after
 *   node packages/entities/scripts/model-sheet.mjs --ids=... --compare=<dir>   # <dir>/<slug>.glb above each
 *   node packages/entities/scripts/model-sheet.mjs --ids=... --family=pickups  # one sheet, a row per model
 *   node packages/entities/scripts/model-sheet.mjs --figures=all --wildlife=base --family=creatures
 *
 * Options: --views=q3f,q3r,side,front,rear,top,clay,far,claySide (default all but claySide),
 * --tile=420x280, --cols=4 (views per line), --grid=N (family sheets: N models per line),
 * --out=shots/model-sheets (ignored by Git), --gpu (hardware GPU instead of SwiftShader).
 * --signals=gear:0.4,canopy:1 poses the model's actual runtime signal bindings.
 * --runtime loads each --ids bundle's imported asset instead of its source GLB.
 * Sheets are local review evidence; see content/ASSET-PACKS.md "Model review images".
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const source = resolve(repo, 'content/entities/source');
const require = createRequire(resolve(repo, 'packages/tooling/package.json'));
const threeRoot = resolve(dirname(require.resolve('three')), '..');

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (name) => arg(name)?.split(',').filter(Boolean);
const [tileW, tileH] = (arg('tile') ?? '420x280').split('x').map(Number);
const views = list('views') ?? ['q3f', 'q3r', 'side', 'front', 'rear', 'top', 'clay', 'far'];
const out = resolve(repo, arg('out') ?? 'shots/model-sheets');
const compare = arg('compare') && resolve(arg('compare'));
const signalValues = arg('signals')
  ? Object.fromEntries(
      arg('signals')
        .split(',')
        .map((pair) => {
          const [name, value] = pair.split(':');
          if (!name || !value || !Number.isFinite(Number(value)))
            throw new Error(`Invalid --signals entry: ${pair}; expected name:number`);
          return [name, Number(value)];
        }),
    )
  : undefined;

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** Source bundles by slug: the generated GLB and the recipe's declared dimensions. */
async function bundle(slug) {
  for (const category of await readdir(source)) {
    const directory = resolve(source, category, slug);
    if (!(await exists(resolve(directory, 'source.json')))) continue;
    const manifest = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
    const recipe = await readFile(resolve(directory, 'models/recipe.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => ({}));
    let glb;
    for (const name of ['detailed.glb', 'source.glb'])
      if (await exists(resolve(directory, 'models', name))) {
        glb = resolve(directory, 'models', name);
        break;
      }
    if (!glb) throw new Error(`${slug}: no generated GLB under models/`);
    if (process.argv.includes('--runtime')) {
      const assetPath = resolve(repo, 'content/entities', manifest.files.models[0].output);
      const asset = JSON.parse(await readFile(assetPath, 'utf8'));
      glb = resolve(dirname(assetPath), asset.files.main);
    }
    const dims = recipe.length
      ? {
          length: recipe.length,
          width: recipe.width,
          height: recipe.height,
          wheelbase: recipe.wheelbase,
          wheelRadius: recipe.wheelRadius,
        }
      : undefined;
    const definition = JSON.parse(await readFile(resolve(directory, 'entity.types.json'), 'utf8'));
    const components = Object.values(definition.types)[0].components;
    const visual = components.aircraft?.spec.visual ?? components.vehicle?.visual;
    const articulation = visual
      ? {
          ...visual.animation,
          bindings: [
            ...(visual.flaps ?? []).map((b) => ({
              node: b.node,
              source: 'flaps',
              property: 'rotation',
              axis: b.axis,
              scale: b.multiplier,
            })),
            ...(visual.ailerons ?? []).map((b) => ({
              node: b.node,
              source: 'rollInput',
              property: 'rotation',
              axis: b.axis,
              scale: b.multiplier,
            })),
            ...(visual.animation?.bindings ?? []),
          ],
        }
      : undefined;
    return { slug, category, label: manifest.title ?? slug, glb, dims, articulation };
  }
  throw new Error(`No source bundle named ${slug}`);
}

/**
 * Procedural bodies have no GLB on disk: bake the bind pose of a figure preset (near tier) or a
 * wildlife recipe (tier 0) into a temporary GLB beside the sheets, as preview-animals.mjs does.
 */
async function bakeCreatures() {
  const figures = list('figures') ?? [];
  const wildlife = list('wildlife') ?? [];
  if (!figures.length && !wildlife.length) return [];
  const T = await import('three');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  globalThis.FileReader ??= class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((value) => {
        this.result = value;
        this.onloadend?.();
      });
    }
  };
  const dir = resolve(out, '.baked');
  await mkdir(dir, { recursive: true });
  const baked = [];
  const write = async (name, label, geometry, extra) => {
    const mesh = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, name: 'body' }),
    );
    const bytes = await new GLTFExporter().parseAsync(mesh, { binary: true });
    const glb = resolve(dir, `${name}.glb`);
    await (await import('node:fs/promises')).writeFile(glb, Buffer.from(bytes));
    baked.push({ slug: name, label, glb, ...extra });
  };
  if (figures.length) {
    const kernel = await import(
      pathToFileURL(resolve(repo, 'packages/figures/dist/kernel.mjs')).href
    );
    const ids = figures[0] === 'all' ? kernel.FIGURE_PRESET_IDS : figures;
    for (const preset of ids) {
      const { buffers } = kernel.generateFigureBody(kernel.resolveFigureDescriptor({ preset }), 0);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(buffers.positions, 3));
      geometry.setAttribute('normal', new T.BufferAttribute(buffers.normals, 3));
      geometry.setAttribute('color', new T.BufferAttribute(buffers.colors, 3, true));
      geometry.setIndex(new T.BufferAttribute(buffers.indices, 1));
      await write(preset, preset, geometry);
    }
  }
  if (wildlife.length) {
    const { wildlifeGeometry } = await import(
      pathToFileURL(resolve(repo, 'packages/ambient/dist/client.mjs')).href
    );
    const { animals } = JSON.parse(
      await readFile(resolve(repo, 'content/wildlife/regional.catalog.json'), 'utf8'),
    );
    const chosen =
      wildlife[0] === 'all'
        ? animals
        : wildlife[0] === 'base'
          ? animals.filter((a) => !/\.(compact|rangy)$/.test(a.id))
          : wildlife.map((name) => animals.find((a) => a.id.endsWith(`.${name}`)));
    for (const recipe of chosen) {
      const { geometry } = wildlifeGeometry(recipe, 0);
      const name = recipe.id.split('.').pop();
      await write(name, `${recipe.title} (${recipe.body.family})`, geometry, {
        dims: { length: recipe.body.length, width: recipe.body.width, height: recipe.body.height },
      });
    }
  }
  return baked;
}

const models = [];
for (const slug of list('ids') ?? []) models.push(await bundle(slug));
const labels = list('labels') ?? [];
for (const [i, path] of (list('glb') ?? []).entries())
  models.push({ slug: labels[i] ?? `model-${i}`, label: labels[i] ?? path, glb: resolve(path) });
models.push(...(await bakeCreatures()));
if (!models.length) throw new Error('Pass --ids=, --glb=, --figures= or --wildlife=');

// One sheet per model, a before/after pair per model, or one family sheet with a row each.
const sheets = [];
if (arg('family')) sheets.push({ name: arg('family'), rows: models });
else
  for (const model of models) {
    const rows = [model];
    if (compare) {
      const before = resolve(compare, `${model.slug}.glb`);
      if (await exists(before))
        rows.unshift({ ...model, label: `${model.label} — before`, glb: before });
      rows.at(-1).label = `${model.label}${rows.length > 1 ? ' — after' : ''}`;
    }
    sheets.push({ name: model.slug, rows });
  }

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary',
};
const served = new Map();
const esbuild = await import(pathToFileURL(require.resolve('esbuild')).href);
const signalBundle = await esbuild.build({
  entryPoints: [resolve(repo, 'packages/client/src/model-signals.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  external: ['three'],
});
const signalModules = new Map([['/signals/model-signals.js', signalBundle.outputFiles[0].text]]);
const server = createServer(async (request, response) => {
  const url = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (signalModules.has(url)) {
    response.writeHead(200, { 'content-type': 'text/javascript' }).end(signalModules.get(url));
    return;
  }
  let path;
  if (url === '/') path = resolve(here, 'model-sheet.html');
  else if (url.startsWith('/three/')) path = resolve(threeRoot, url.slice(7));
  else if (served.has(url)) path = served.get(url);
  if (!path || (url.startsWith('/three/') && !path.startsWith(threeRoot + sep))) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const playwright = await import(pathToFileURL(require.resolve('playwright')).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const browser = await chromium.launch(
  process.argv.includes('--gpu')
    ? { channel: 'chromium', args: ['--enable-unsafe-webgpu', '--force_high_performance_gpu'] }
    : {
        args: [
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--disable-gpu-sandbox',
        ],
      },
);
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.error('page:', e.message));
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => typeof globalThis.renderSheet === 'function');
  for (const sheet of sheets) {
    const rows = sheet.rows.map((row, i) => {
      const key = `/model/${sheet.name}/${i}.glb`;
      served.set(key, row.glb);
      return {
        url: key,
        label: row.label + (signalValues ? ` [${arg('signals')}]` : ''),
        dims: row.dims,
        articulation: row.articulation,
        signals: signalValues,
        water: row.category === 'watercraft',
        file: relative(repo, row.glb).replaceAll(sep, '/'),
      };
    });
    const size = await page.evaluate((request) => globalThis.renderSheet(request), {
      rows,
      views,
      tile: [tileW, tileH],
      cols: Number(arg('cols') ?? 4),
      grid: Number(arg('grid') ?? 0),
    });
    await page.setViewportSize({ width: size.width, height: size.height });
    const path = resolve(out, `${sheet.name}.png`);
    await page.locator('#sheet').screenshot({ path });
    console.log(`${relative(repo, path)}  ${size.stats.join(' | ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
