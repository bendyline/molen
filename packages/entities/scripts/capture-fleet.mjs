/** Review the fleet. --ids=slug,slug narrows checks; --report=path keeps batch evidence separate. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const reportOverride = process.argv.find((arg) => arg.startsWith('--report='))?.slice(9);
const report = [];
for (const category of ['vehicles', 'cycles', 'watercraft', 'transit', 'aircraft']) {
  for (const name of (await readdir(`${root}/source/${category}`)).sort()) {
    if (selection && !selection.includes(name)) continue;
    const directory = `${root}/source/${category}/${name}`;
    const source = JSON.parse(await readFile(`${directory}/source.json`, 'utf8'));
    const definition = JSON.parse(await readFile(`${directory}/entity.types.json`, 'utf8'));
    const components = definition.types[source.id].components;
    const spec = components.vehicle?.spec ?? components.boat?.spec ?? components.aircraft?.spec;
    if (!spec) continue;
    const sidecar = JSON.parse(
      await readFile(`${root}/${source.files.models.find((m) => m.output).output}`, 'utf8'),
    );
    const result = await screenshotAsset({
      ref: source.id,
      projectPath: `${root}/project.json`,
      outDir: `${directory}/shots`,
      angles: 4,
      size: [900, 650],
      reflections: true,
      antialias: true,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    const bounds = sidecar.bounds.aabb;
    const length = Math.max(...bounds.max.map((v, i) => v - bounds.min[i]));
    const centerY = (bounds.min[1] + bounds.max[1]) / 2;
    const groundY = components.boat ? -spec.draft - 0.05 : -0.05;
    const scene = {
      format: 'molen/scene@3',
      name: `${source.title} review`,
      seed: 'bendy-review',
      entities: [
        { id: 'vehicle', type: source.id },
        {
          id: 'ground',
          components: {
            transform: {
              pos: [0, groundY, 0],
              rot: [0, 0, 0, 1],
              scale: [length * 4, 0.1, length * 4],
            },
            renderable: {
              kind: 'primitive',
              ref: 'box',
              materialRef: 'palette:#b6b9b1',
              shadows: { receive: true },
            },
          },
        },
        {
          id: 'environment',
          components: {
            environment: {
              background: '#c5d7e0',
              ambient: { sky: '#e0e8ed', ground: '#70766d', intensity: 1.1 },
              sun: { direction: [7, 12, 6], color: '#fff4df', intensity: 2, castShadow: true },
              toneMapping: 'agx',
              exposure: 1,
              shadows: 'high',
            },
          },
        },
      ],
      physics: { engine: 'none' },
    };
    const camera = {
      position: [length * 0.8, centerY + length * 0.42, length * 0.95],
      lookAt: [0, centerY, 0],
      fov: 38,
    };
    const exterior = await screenshotScene({
      scene,
      projectPath: `${root}/project.json`,
      ticks: 1,
      camera,
      size: [1000, 750],
      outPath: `${directory}/shots/three-quarter.png`,
      reflections: true,
      antialias: true,
      fitShadows: true,
    });
    if (!exterior.ok) throw new Error(JSON.stringify(exterior));
    const eye = spec.driverEye ?? spec.pilotEye;
    const cockpitCamera = { position: eye, lookAt: [eye[0], eye[1] - 0.16, eye[2] + 1], fov: 70 };
    const cockpit = await screenshotScene({
      scene,
      projectPath: `${root}/project.json`,
      ticks: 1,
      camera: cockpitCamera,
      size: [1000, 750],
      outPath: `${directory}/shots/operator.png`,
      reflections: true,
      antialias: true,
      fitShadows: true,
    });
    if (!cockpit.ok) throw new Error(JSON.stringify(cockpit));
    // A forward operator view proves sightlines but crops most center consoles. Keep a second
    // current view for dashboard/helm review; this is evidence, not a gameplay camera change.
    const cabinX = category === 'vehicles' ? 0 : eye[0];
    const referenceReview = await readFile(`${directory}/reference-review.json`, 'utf8')
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === 'ENOENT') return {};
        throw error;
      });
    const cabinCamera = referenceReview.cabinCamera ?? {
      position: [cabinX, eye[1], eye[2] - 0.3],
      lookAt: [cabinX, eye[1] - (category === 'cycles' ? 0.75 : 0.42), eye[2] + 0.65],
      fov: 78,
    };
    const cabin = await screenshotScene({
      scene,
      projectPath: `${root}/project.json`,
      ticks: 1,
      camera: cabinCamera,
      size: [1000, 750],
      outPath: `${directory}/shots/cabin.png`,
      reflections: true,
      antialias: true,
      fitShadows: true,
    });
    if (!cabin.ok) throw new Error(JSON.stringify(cabin));
    const detailCamera = {
      'p-51': { position: [2.2, 2.5, 2.4], lookAt: [0.4, 1.8, 1.5], fov: 44 },
      'oh-6': { position: [2, 1.8, -2], lookAt: [0.2, 1.5, -2], fov: 44 },
      airliner: { position: [4.4, 5, 11.4], lookAt: [1.7, 4.2, 11.4], fov: 50 },
    }[name];
    const detail = detailCamera
      ? await screenshotScene({
          scene,
          projectPath: `${root}/project.json`,
          ticks: 1,
          camera: detailCamera,
          size: [1000, 750],
          outPath: `${directory}/shots/skin-detail.png`,
          reflections: true,
          antialias: true,
          fitShadows: true,
        })
      : undefined;
    if (detail && !detail.ok) throw new Error(JSON.stringify(detail));
    report.push({
      id: source.id,
      title: source.title,
      hash: sidecar.hash,
      sourceHash: sidecar.sourceHash,
      stats: sidecar.stats,
      camera,
      cockpitCamera,
      turntable: result,
      exterior,
      cockpit,
      cabinCamera,
      cabin,
      detailCamera,
      detail,
    });
    console.log(source.title);
  }
}
if (!report.length) throw new Error('No fleet recipes matched.');
const reportPath = reportOverride
  ? resolve(reportOverride)
  : `${root}/shots/${selection ? 'selected-capture-report' : 'capture-report'}.json`;
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (!selection) {
  for (const name of ['fleet', 'harbor']) {
    const result = await screenshotScene({
      scenePath: `${root}/scenes/${name}.scene.json`,
      ticks: 90,
      outPath: `${root}/shots/${name}.png`,
      size: [1600, 1000],
      reflections: true,
      antialias: true,
      fitShadows: true,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    console.log(name, JSON.stringify(result));
  }
}
