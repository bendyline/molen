/** Matched orthographic views + a centered wide cabin. Local evidence only. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { screenshotScene } from '../../tooling/dist/index.mjs';

const base = resolve('content/entities'),
  { aircraft } = JSON.parse(await readFile(`${base}/source/aircraft-expansion.json`));
const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length) throw Error('Select aircraft with --ids=...');
const rotation = (x, y, z) =>
  new Quaternion()
    .setFromRotationMatrix(
      new Matrix4().makeBasis(new Vector3(...x), new Vector3(...y), new Vector3(...z)),
    )
    .toArray();
const views = {
  top: [0, 0, 0, 1],
  side: rotation([0, 1, 0], [0, 0, -1], [-1, 0, 0]),
  front: rotation([1, 0, 0], [0, 0, -1], [0, 1, 0]),
};
for (const a of aircraft.filter((a) => ids.includes(a.slug))) {
  const folder = `${base}/source/aircraft/${a.slug}`,
    source = JSON.parse(await readFile(`${folder}/source.json`)),
    asset = JSON.parse(await readFile(`${base}/${source.files.models[0].output}`)),
    definition = JSON.parse(await readFile(`${folder}/entity.types.json`)),
    spec = definition.types[a.id].components.aircraft.spec;
  const min = asset.bounds.aabb.min,
    max = asset.bounds.aabb.max,
    center = min.map((v, i) => (v + max[i]) / 2),
    size = min.map((v, i) => max[i] - v);
  const report = [];
  const review = await readFile(`${folder}/reference-review.json`, 'utf8')
    .then(JSON.parse)
    .catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return {};
    });
  for (const [name, rot] of Object.entries(views)) {
    const q = new Quaternion(...rot);
    // A drawing may use the flight datum rather than the static ground attitude.
    // Apply only a recorded rigid view rotation, never nonuniform geometry scaling.
    if (review.viewRotations?.[name])
      q.multiply(new Quaternion().setFromEuler(new Euler(...review.viewRotations[name])));
    const viewRot = q.toArray(),
      c = new Vector3(...center).applyQuaternion(q),
      viewHeight =
        name === 'side'
          ? Math.max(size[1] * 1.4, size[2] * 0.53)
          : name === 'front'
            ? Math.max(size[1] * 1.3, size[0] * 0.53)
            : Math.max(size[2] * 1.15, size[0] * (1200 / 1300) * 1.08);
    const scene = {
      format: 'molen/scene@3',
      name: `${a.slug} ${name} orthographic`,
      seed: 'reference-review',
      physics: { engine: 'none' },
      camera: {
        mode: 'top-down-ortho',
        center: [c.x, c.z],
        viewHeight,
        cameraHeight: Math.max(...size) * 4,
      },
      entities: [
        {
          id: 'model',
          components: {
            transform: { pos: [0, 0, 0], rot: viewRot },
            renderable: { kind: 'gltf', ref: a.id },
          },
        },
        {
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
        },
      ],
    };
    // Match a reference's explicitly recorded configuration (for example gear-up).
    // Freeze raw telemetry in the aircraft frame, independently of the rigid view rotation.
    if (review.exteriorState) {
      const signals = definition.types[a.id].components['model.signals'];
      if (!signals) throw Error(`${a.slug}: exteriorState requires model.signals`);
      scene.entities[0].components['model.signals'] = {
        sources: {},
        derived: {
          ...signals.derived,
          ...Object.fromEntries(
            Object.entries(review.exteriorState).map(([key, value]) => [
              key,
              { op: 'add', args: [value, 0] },
            ]),
          ),
        },
        bindings: signals.bindings,
      };
    }
    const output = `${folder}/shots/ortho-${name}.png`;
    const result = await screenshotScene({
      scene,
      projectPath: `${base}/project.json`,
      ticks: 0,
      size: name === 'side' || name === 'front' ? [1500, 700] : [1300, 1200],
      outPath: output,
      antialias: true,
      reflections: true,
    });
    if (!result.ok) throw Error(JSON.stringify(result));
    report.push({ name, scene, output, result });
  }
  const eye = spec.pilotEye;
  const scene = {
    format: 'molen/scene@3',
    name: `${a.slug} cockpit comparison`,
    seed: 'reference-review',
    physics: { engine: 'none' },
    camera: {
      mode: 'fixed',
      position: [0, eye[1] + 0.15, eye[2] - 1.7],
      lookAt: [0, eye[1] - 0.7, eye[2]],
      fov: 74,
      ...review.cabinCamera,
    },
    entities: [
      { id: 'model', type: a.id },
      {
        id: 'environment',
        components: {
          environment: {
            background: '#bcd4df',
            ambient: { sky: '#f2f2df', ground: '#b0b4ad', intensity: 1.6 },
            sun: { direction: [7, 12, 5], color: '#ffffff', intensity: 2 },
            toneMapping: 'agx',
            exposure: 1,
          },
        },
      },
    ],
  };
  const output = `${folder}/shots/cabin-wide.png`,
    result = await screenshotScene({
      scene,
      projectPath: `${base}/project.json`,
      ticks: 0,
      size: [1400, 1000],
      outPath: output,
      antialias: true,
      reflections: true,
    });
  if (!result.ok) throw Error(JSON.stringify(result));
  report.push({ name: 'cabin-wide', scene, output, result });
  if (review.panelCamera) {
    const panelScene = structuredClone(report[0].scene);
    panelScene.name = `${a.slug} panel comparison`;
    panelScene.camera = review.panelCamera;
    panelScene.entities[0].components.transform = {
      pos: [0, review.panelOriginHeight ?? 10, 0],
      rot: rotation([-1, 0, 0], [0, 0, -1], [0, -1, 0]),
    };
    // A model can be authored in a recorded static tailwheel stance. Undo only
    // that rigid datum rotation when comparing its panel to a straight-on diagram.
    if (review.panelModelRotation)
      panelScene.entities[0].components.transform.rot = new Quaternion(
        ...panelScene.entities[0].components.transform.rot,
      )
        .multiply(new Quaternion().setFromEuler(new Euler(...review.panelModelRotation)))
        .toArray();
    // Freeze optional reviewed instrument readings independently of the rotated capture pose.
    // Otherwise all exported digit segments and scrolling tape rows would appear at once.
    if (review.instrumentState && spec.visual.interior) {
      panelScene.entities[0].components['model.signals'] = {
        sources: {},
        derived: {
          ...spec.visual.interior.derived,
          ...Object.fromEntries(
            Object.entries(review.instrumentState).map(([name, value]) => [
              name,
              { op: 'add', args: [value, 0] },
            ]),
          ),
        },
        bindings: spec.visual.interior.bindings,
      };
    }
    const panelOutput = `${folder}/shots/ortho-panel.png`;
    const panelResult = await screenshotScene({
      scene: panelScene,
      projectPath: `${base}/project.json`,
      ticks: 0,
      size: [1400, 1000],
      outPath: panelOutput,
      antialias: true,
      reflections: true,
    });
    if (!panelResult.ok) throw Error(JSON.stringify(panelResult));
    report.push({ name: 'panel', scene: panelScene, output: panelOutput, result: panelResult });
  }
  await mkdir('.artifacts/aircraft/comparisons', { recursive: true });
  await writeFile(
    `.artifacts/aircraft/comparisons/${a.slug}.json`,
    `${JSON.stringify(
      { id: a.id, sourceHash: asset.sourceHash, hash: asset.hash, views: report },
      null,
      2,
    )}\n`,
  );
  console.log(`${a.slug} comparison captures complete`);
}
