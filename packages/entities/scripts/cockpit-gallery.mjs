/** Local cockpit review gallery. Uses current imported assets, with hash-bound capture caching.
 * node packages/entities/scripts/cockpit-gallery.mjs [--ids=p-51,oh-6] [--serve] [--no-capture]
 * Full-size review images stay in ignored .artifacts/cockpit-gallery/.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotScene } from '../../tooling/dist/index.mjs';
import { cockpitFinishLibrary } from './aircraft/cockpit-surfaces.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = resolve(repo, 'content/entities');
const out = resolve(repo, '.artifacts/cockpit-gallery');
const args = process.argv.slice(2);
const selection = args
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const roster = JSON.parse(
  await readFile(`${root}/source/aircraft-expansion.json`, 'utf8'),
).aircraft;
const featured = {
  'p-51': {
    panel: [
      [0, 2.05, 0.2],
      [0, 1.9, 0.8],
    ],
    seat: [
      [0, 2.12, 0.57],
      [0, 1.77, -0.25],
    ],
    note: 'Textured enamel backboard, rounded attitude indicator, canvas seat and woven harness.',
  },
  'oh-6': {
    panel: [
      [0, 1.48, 0.65],
      [0, 1.32, 1.32],
    ],
    seat: [
      [0, 1.7, 1.08],
      [0, 1.08, 0.2],
    ],
    note: 'Textured panel and pedestal, rounded attitude indicator, vinyl cushions and woven harness.',
  },
  'cessna-172s': {
    panel: [
      [0, 1.47, 0.44],
      [0, 1.32, 1.1],
    ],
    seat: [
      [0, 1.57, 0.78],
      [0, 0.98, -0.05],
    ],
    note: 'Textured instrument backboard with a joined panel rim, vinyl seat grain and stitching. NAV III screens stay flat.',
  },
};
const labels = {
  cabin: 'Cockpit',
  panel: 'Backboard',
  horizon: 'Artificial horizon',
  seat: 'Seats & trim',
  canopy: 'Canopy joins',
  intake: 'Intake joins',
  nozzle: 'Exhaust joins',
  quadrant: 'Throttle quadrant',
};
const joinViews = {
  'cessna-182t': {
    panel: { position: [0, 1.7, 0.68], lookAt: [0, 1.42, 1.5], fov: 70 },
  },
  'mig-29a': {
    panel: { position: [0, 2.85, 3.65], lookAt: [0, 2.6, 4.2], fov: 65 },
    canopy: { position: [2.5, 3.8, 7.5], lookAt: [0, 2.6, 3.8], fov: 46 },
    intake: { position: [3.6, 2.7, 6], lookAt: [1.1, 1.6, 0.6], fov: 44 },
    nozzle: { position: [3.2, 2.5, -9.7], lookAt: [1.1, 1.6, -5.2], fov: 44 },
  },
  'baron-g58': {
    quadrant: { position: [0.3, 1.65, 0.78], lookAt: [-0.02, 1.25, 0.95], fov: 65 },
  },
  'p-51': {
    quadrant: { position: [0.1, 1.98, -0.02], lookAt: [0.36, 1.75, 0.22], fov: 65 },
  },
};
// Review cameras move ahead of seat backs that obscure the shared cabin-ledger views.
const cabinOverrides = {
  'bell-206b': { position: [0, 1.53, 0.35], lookAt: [0, 1.12, 1.63], fov: 75 },
  'bell-407': { position: [0, 1.54, 0.35], lookAt: [0, 1.14, 1.5], fov: 76 },
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const optionalJson = async (path) =>
  readJson(path).catch((e) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
const environment = {
  background: '#b2cde4',
  ambient: { sky: '#e0e8ed', ground: '#9a8f70', intensity: 2 },
  sun: { direction: [7, 12, 6], color: '#fff1d8', intensity: 4.4, castShadow: true },
  toneMapping: 'aces',
  exposure: 1.05,
  shadows: 'high',
};
await mkdir(`${out}/images`, { recursive: true });
const names = (await readdir(`${root}/source/aircraft`)).sort(
  (a, b) => Number(!!featured[b]) - Number(!!featured[a]) || a.localeCompare(b),
);
const entries = [];
const jobs = [];
for (const slug of names) {
  const dir = `${root}/source/aircraft/${slug}`;
  const source = await readJson(`${dir}/source.json`);
  const definition = await readJson(`${dir}/entity.types.json`);
  const spec = definition.types[source.id].components.aircraft.spec;
  const sidecar = await readJson(`${root}/${source.files.models.find((m) => m.output).output}`);
  const reference = await optionalJson(`${dir}/reference-review.json`);
  const aircraft = roster.find((a) => a.slug === slug);
  const eye = spec.pilotEye;
  const finish = cockpitFinishLibrary.finishes[cockpitFinishLibrary.profiles[slug].panel];
  const entry = {
    slug,
    title: source.title,
    id: source.id,
    category:
      aircraft?.category ??
      (slug === 'oh-6' ? 'helicopter' : slug === 'airliner' ? 'airliner' : 'warbird'),
    featured: !!featured[slug],
    panelFinish: cockpitFinishLibrary.profiles[slug].panel,
    note:
      slug === 'mig-29a'
        ? 'Joined canopy shoulders, intake-to-engine transitions and exhaust rims, with continuous curved trim.'
        : (featured[slug]?.note ?? aircraft?.signature ?? 'Current fleet cockpit.'),
    hash: sidecar.hash,
    sourceHash: sidecar.sourceHash,
    views: [],
  };
  entry.note = `${finish.label} backboard, rubberized control trim and brushed alloy hardware. ${entry.note}`;
  const cameras = {
    cabin: cabinOverrides[slug] ??
      reference?.cabinCamera ?? {
        position: [eye[0], eye[1], eye[2] - 0.3],
        lookAt: [eye[0], eye[1] - 0.42, eye[2] + 0.65],
        fov: 78,
      },
  };
  if (featured[slug]) {
    for (const kind of ['panel', 'seat']) {
      const [position, lookAt] = featured[slug][kind];
      cameras[kind] = { position, lookAt, fov: kind === 'seat' ? 65 : 70 };
    }
    if (slug !== 'cessna-172s') {
      const layout = await readJson(`${dir}/models/interior.json`);
      const [x, y, z] = layout.gauges.find((g) => g.type === 'horizon').position;
      cameras.horizon = { position: [x + 0.055, y + 0.025, z - 0.245], lookAt: [x, y, z], fov: 46 };
    }
  }
  Object.assign(cameras, joinViews[slug]);
  const scene = {
    format: 'molen/scene@3',
    name: `${source.title} cockpit gallery`,
    seed: 'cockpit-gallery',
    physics: { engine: 'none' },
    entities: [
      { id: 'aircraft', type: source.id },
      {
        id: 'ground',
        components: {
          transform: { pos: [0, -0.08, 0], rot: [0, 0, 0, 1], scale: [100, 0.1, 100] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#a7ae9f',
            shadows: { receive: true },
          },
        },
      },
      { id: 'lighting', components: { environment } },
    ],
  };
  for (const [kind, camera] of Object.entries(cameras)) {
    const size = entry.featured ? [1200, 900] : [960, 720];
    const file = `images/${slug}-${kind}.png`;
    const key = createHash('sha256')
      .update(JSON.stringify({ hash: sidecar.hash, scene, camera, size }))
      .digest('hex');
    const view = { kind, label: labels[kind], file, camera, size, key };
    entry.views.push(view);
    jobs.push(async () => {
      const cached = await optionalJson(`${out}/${file}.json`);
      if (cached?.key === key && (await stat(`${out}/${file}`).catch(() => null))) return;
      if (args.includes('--no-capture') || (selection && !selection.includes(slug))) {
        // Never show a stale image as evidence for the current asset.
        entry.views = entry.views.filter((v) => v !== view);
        return;
      }
      const result = await screenshotScene({
        scene,
        projectPath: `${root}/project.json`,
        ticks: 1,
        camera,
        size,
        outPath: `${out}/${file}`,
        reflections: true,
        antialias: true,
        fitShadows: true,
      });
      if (!result.ok) throw Error(JSON.stringify(result));
      await writeFile(
        `${out}/${file}.json`,
        `${JSON.stringify({ key, hash: sidecar.hash, camera, size }, null, 2)}\n`,
      );
      console.log(`${source.title}: ${labels[kind]}`);
    });
  }
  entries.push(entry);
}
// Separate output files and browser instances; no shared asset mutations during capture.
let next = 0;
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }),
);
const data = { entries: entries.filter((e) => e.views.length), environment };
if (!data.entries.length) throw Error('No current captures. Run without --no-capture first.');
await writeFile(`${out}/manifest.json`, `${JSON.stringify(data, null, 2)}\n`);
const template = await readFile(new URL('./cockpit-gallery.html', import.meta.url), 'utf8');
await writeFile(
  `${out}/index.html`,
  template.replace(
    '{ entries: [] } /* GALLERY_DATA */',
    JSON.stringify(data).replaceAll('<', '\\u003c'),
  ),
);
console.log(`Gallery: ${out}/index.html (${data.entries.length} aircraft)`);
if (args.includes('--serve')) {
  const port = Number(args.find((a) => a.startsWith('--port='))?.slice(7) ?? 4318);
  createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(out, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(out + sep)) {
        res.writeHead(403).end();
        return;
      }
      const bytes = await readFile(path);
      res.writeHead(200, {
        'Content-Type':
          { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json' }[
            extname(path)
          ] ?? 'application/octet-stream',
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
}
