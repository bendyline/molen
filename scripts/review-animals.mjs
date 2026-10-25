/** Local visual QA of all procedural quadrupeds. Build figures and the capture harness first. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import {
  applyPose,
  figureBodyToSkinnedMesh,
  figureGeometry,
} from '../packages/figures/dist/client.mjs';
import {
  evaluatePose,
  generateFigureBody,
  resolveFigureDescriptor,
} from '../packages/figures/dist/kernel.mjs';
import {
  importAsset,
  inspectAsset,
  screenshotAsset,
  screenshotScene,
} from '../packages/tooling/dist/index.mjs';

const { values } = parseArgs({
  options: { out: { type: 'string' }, quick: { type: 'boolean' }, species: { type: 'string' } },
});
const out = resolve(values.out ?? '.artifacts/animal-review');
await mkdir(out, { recursive: true });
const species = values.species?.split(',') ?? ['dog', 'cat', 'horse', 'cow', 'deer', 'sheep'];
const json = (path, data) => writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
const check = (result) => {
  if (!result.ok) throw new Error(result.error);
  return result;
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const light = {
  id: 'light',
  components: {
    environment: {
      background: '#c5cbd0',
      ambient: { sky: '#f0f5ff', ground: '#8c8072', intensity: 2 },
      sun: { direction: [-3, 6, 7], color: '#fff1df', intensity: 3.2, castShadow: true },
      shadows: 'high',
      toneMapping: 'neutral',
      exposure: 1,
    },
  },
};
const ground = {
  id: 'ground',
  components: {
    transform: { pos: [0, -0.035, 0], rot: [0, 0, 0, 1] },
    renderable: {
      kind: 'primitive',
      ref: 'box',
      materialRef: 'palette:#93918a',
      primitive: { size: [30, 0.07, 30] },
      shadows: { receive: true },
    },
  },
};
const records = [];
const frames = [];
async function shot(name, scene, position, lookAt, ticks = 30) {
  const result = check(
    await screenshotScene({
      scene,
      ticks,
      camera: { position, lookAt },
      size: [1000, 800],
      antialias: true,
      fitShadows: true,
      outPath: join(out, `${name}.png`),
    }),
  );
  frames.push({
    name,
    camera: { position, lookAt },
    ticks,
    stateHash: result.stateHash,
    renderStats: result.renderStats,
    sha256: hash(await readFile(result.imagePath)),
  });
}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(
      (value) => {
        this.result = value;
        this.onloadend?.();
      },
      (error) => {
        this.error = error;
        this.onerror?.();
      },
    );
  }
};
for (const preset of species) {
  const d = resolveFigureDescriptor({ preset }),
    H = d.height;
  const body = generateFigureBody(d, 0);
  const base = {
    format: 'molen/scene@3',
    name: `${preset} review`,
    seed: 'animal-review',
    tickRate: 60,
    entities: [
      light,
      ground,
      {
        id: preset,
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          figure: { preset, facing: 'manual', speedSource: 'none' },
          figureIntent: { mode: 'idle' },
          renderable: {
            kind: 'figure',
            ref: 'procedural',
            lod: 0,
            shadows: { cast: true, receive: true },
          },
        },
      },
    ],
  };
  await json(join(out, `${preset}.scene.json`), base);
  const pos = [2.7 * H, 1.65 * H, 2.8 * H],
    look = [0, 0.65 * H, 0.18 * H];
  await shot(`${preset}-hero`, base, pos, look);
  if (values.quick) continue;
  await shot(`${preset}-side`, base, [3.7 * H, 1.05 * H, 0.05 * H], look);
  await shot(`${preset}-front`, base, [0, 1.05 * H, 3.7 * H], look);
  for (const [mode, speed, tick] of [
    ['walk', H * 1.3, 21],
    ['run', H * 4, 18],
  ]) {
    const scene = structuredClone(base),
      c = scene.entities.at(-1).components;
    c.figureIntent.mode = mode;
    c.figure.speedSource = 'auto';
    c.kinematicBody = { vel: [0, 0, speed], slide: true };
    await shot(`${preset}-${mode}`, scene, pos, look, tick);
  }
  for (const tier of [1, 2]) {
    const scene = structuredClone(base);
    scene.entities.at(-1).components.renderable.lod = tier;
    await shot(`${preset}-tier-${tier}`, scene, pos, look);
  }
  const assetDir = join(out, preset);
  await mkdir(assetDir, { recursive: true });
  const projectPath = join(assetDir, 'project.json');
  await json(projectPath, {
    format: 'molen/project@1',
    name: `${preset}-review`,
    scenes: {},
    assets: {},
    reservations: [{ namespace: 'review', owner: 'animal-review' }],
  });
  const geometry = figureGeometry(body.buffers),
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  material.name = `${preset}-palette`;
  const model = figureBodyToSkinnedMesh(body, geometry, material);
  applyPose(evaluatePose(body.rig, undefined, 30, { tickRate: 60, seed: 0 }), model.bones);
  model.root.updateMatrixWorld(true);
  const bytes = Buffer.from(await new GLTFExporter().parseAsync(model.root, { binary: true }));
  model.dispose();
  geometry.dispose();
  material.dispose();
  const path = join(assetDir, 'source.glb');
  await writeFile(path, bytes);
  check(
    await importAsset({ path, id: `review.${preset}`, projectPath, force: true, optimize: false }),
  );
  const verified = check(
    await inspectAsset({ ref: `review.${preset}`, projectPath, verify: true }),
  );
  check(
    await screenshotAsset({
      ref: `review.${preset}`,
      projectPath,
      angles: 4,
      outDir: join(assetDir, 'turntable'),
      antialias: true,
    }),
  );
  records.push({
    preset,
    height: H,
    bounds: body.bounds,
    joints: body.rig.joints.length,
    tiers: [0, 1, 2].map((tier) => {
      const b = generateFigureBody(d, tier).buffers;
      return { tier, triangles: b.triangleCount, vertices: b.vertexCount, bytes: b.bytes };
    }),
    glb: { sourceHash: hash(bytes), importedHash: verified.sidecar.hash },
  });
}
const sourceHashes = {};
for (const name of [
  'body.ts',
  'body-quadruped.ts',
  'body-animal-head.ts',
  'body-animal-parts.ts',
  'body-animal-shape.ts',
  'rig.ts',
  'gait.ts',
  'proportions.ts',
  'presets.ts',
  'skinned-mesh-builder.ts',
]) {
  try {
    sourceHashes[name] = hash(await readFile(join('packages/figures/src/kernel', name)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await json(join(out, 'review-report.json'), {
  subject: 'Procedural quadrupeds',
  sourceHashes,
  records,
  frames,
});
console.log(
  `Reviewed ${species.join(', ')}: ${frames.length} scene views; ${records.length} verified GLBs.`,
);
console.log(records.map(({ preset, tiers }) => ({ preset, tiers })));
