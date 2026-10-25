/** Reproducible local visual QA for the shared human generator. Build packages first. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { out: { type: 'string' } } });
const out = resolve(ROOT, values.out ?? '.artifacts/human-review');
await mkdir(out, { recursive: true });
const writeJson = (name, data) => writeFile(join(out, name), `${JSON.stringify(data, null, 2)}\n`);
const checked = (result) => {
  if (!result.ok) throw new Error(result.error ?? 'Review operation failed');
  return result;
};
const descriptors = [
  {
    preset: 'human.adult',
    palette: {
      skin: '#b87d59',
      top: '#526c7d',
      bottom: '#303a43',
      hair: '#261e1a',
      shoes: '#3a3030',
    },
  },
  {
    preset: 'human.adult',
    height: 1.67,
    build: -0.45,
    features: { hair: 'long', sleeves: 'short' },
    palette: { skin: '#d3a080', hair: '#382720', top: '#874c48', bottom: '#424450' },
  },
  {
    preset: 'human.adult',
    height: 1.85,
    build: 0.4,
    features: { hair: 'none', sleeves: 'none' },
    palette: { skin: '#704630', top: '#b6ad97', bottom: '#3b4840', shoes: '#32302c' },
  },
  { preset: 'human.child' },
  { preset: 'human.elder', features: { hair: 'bob' } },
];
const figure = (d, i) => ({
  id: `person-${i}`,
  components: {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    figure: { ...d, facing: 'manual', speedSource: 'none' },
    figureIntent: { mode: 'idle' },
    renderable: {
      kind: 'figure',
      ref: 'procedural',
      lod: 0,
      shadows: { cast: true, receive: true },
    },
  },
});
const environment = {
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
const base = {
  format: 'molen/scene@3',
  name: 'Human model review',
  seed: 'human-review',
  tickRate: 60,
  entities: [environment, ground, figure(descriptors[0], 0)],
};
await writeJson('review.scene.json', base);
const frames = [];
async function shot(name, scene, position, lookAt, size = [900, 1100], ticks = 30) {
  const result = checked(
    await screenshotScene({
      scene,
      ticks,
      camera: { position, lookAt },
      size,
      antialias: true,
      fitShadows: true,
      outPath: join(out, `${name}.png`),
    }),
  );
  frames.push({
    name,
    camera: { position, lookAt },
    size,
    ticks,
    stateHash: result.stateHash,
    renderStats: result.renderStats,
    sha256: createHash('sha256')
      .update(await readFile(result.imagePath))
      .digest('hex'),
  });
}
for (const [name, position, lookAt] of [
  ['front', [0, 1.12, 2.05], [0, 0.88, 0]],
  ['three-quarter', [1.1, 1.15, 1.85], [0, 0.88, 0]],
  ['portrait', [0.33, 1.64, 0.8], [0, 1.48, 0]],
  ['rear', [-1.1, 1.15, -1.85], [0, 0.88, 0]],
  ['side', [1.75, 1.15, 0.1], [0, 0.9, 0]],
  ['shoulders-rear', [-0.45, 1.45, -1.05], [0, 1.28, 0]],
  ['hands-front', [0.55, 0.8, 0.72], [0.24, 0.72, 0]],
  ['hands-side', [0.95, 0.8, 0.08], [0.24, 0.72, 0]],
])
  await shot(name, base, position, lookAt);
const lineup = {
  ...base,
  entities: [
    environment,
    ground,
    ...descriptors.map((d, i) => {
      const f = figure(d, i);
      f.components.transform.pos = [(i - 2) * 0.85, 0, 0];
      return f;
    }),
  ],
};
await writeJson('lineup.scene.json', lineup);
await shot('lineup', lineup, [0.8, 1.35, 2.7], [0, 0.85, 0], [1400, 800]);
for (const [mode, speed, tick] of [
  ['walk', 1.4, 21],
  ['walk', 1.4, 48],
  ['run', 4, 18],
  ['sit', 0, 30],
  ['jump', 0, 30],
  ['fall', 0, 30],
]) {
  const scene = structuredClone(base),
    c = scene.entities.at(-1).components;
  c.figureIntent.mode = mode;
  c.figure.speedSource = 'auto';
  c.kinematicBody = { vel: [0, 0, speed], slide: true };
  await shot(`pose-${mode}-${tick}`, scene, [1.5, 1.3, 2.35], [0, 0.85, 0], [900, 1000], tick);
}
for (const tier of [1, 2]) {
  const scene = structuredClone(base);
  scene.entities.at(-1).components.renderable.lod = tier;
  await shot(`tier-${tier}`, scene, [0, 1.12, 2.05], [0, 0.88, 0]);
}
const hair = structuredClone(base);
hair.entities.at(-1).components.figure.features = { hair: 'long', sleeves: 'short' };
await shot('hair-rear', hair, [1.4, 1.65, -2], [0, 1.4, 0]);

// A review export proves the generated buffers are an ordinary skinned glTF model.
// Runtime humans continue to use their procedural mesh and shared deterministic pose evaluator.
const descriptor = resolveFigureDescriptor({ preset: 'human.adult' });
const body = generateFigureBody(descriptor, 0);
const geometry = figureGeometry(body.buffers);
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
material.name = 'human-palette';
const model = figureBodyToSkinnedMesh(body, geometry, material);
// Preserve the skin and its inverse bind matrices, but open the QA GLB in the resting pose.
applyPose(evaluatePose(body.rig, undefined, 30, { tickRate: 60, seed: 0 }), model.bones);
model.root.updateMatrixWorld(true);
const previousReader = globalThis.FileReader;
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
let bytes;
try {
  bytes = Buffer.from(await new GLTFExporter().parseAsync(model.root, { binary: true }));
} finally {
  globalThis.FileReader = previousReader;
  model.dispose();
  geometry.dispose();
  material.dispose();
}
await writeFile(join(out, 'human.glb'), bytes);
await writeJson('project.json', {
  format: 'molen/project@1',
  name: 'human-review',
  scenes: { main: 'review.scene.json' },
  defaultScene: 'main',
  assets: {},
  reservations: [{ namespace: 'review', owner: 'human-model-review' }],
});
const projectPath = join(out, 'project.json');
// Avoid quantization here: the importer's bounds currently inspect quantized local accessors
// instead of the skin's meter-space bounds. This QA export preserves its original transforms.
checked(
  await importAsset({
    path: join(out, 'human.glb'),
    id: 'review.human',
    projectPath,
    force: true,
    optimize: false,
  }),
);
const inspected = checked(await inspectAsset({ ref: 'review.human', projectPath, verify: true }));
checked(
  await screenshotAsset({
    ref: 'review.human',
    projectPath,
    outDir: join(out, 'glb'),
    angles: 4,
    antialias: true,
  }),
);
const sources = [
  'body.ts',
  'body-biped.ts',
  'body-human-head.ts',
  'body-human-extremities.ts',
  'skinned-mesh-builder.ts',
  'presets.ts',
  'descriptor.ts',
  'proportions.ts',
  'rig.ts',
  'gait.ts',
  'hand-rest.ts',
  'color.ts',
];
const sourceHashes = {};
for (const name of sources)
  sourceHashes[name] = createHash('sha256')
    .update(await readFile(join(ROOT, 'packages/figures/src/kernel', name)))
    .digest('hex');
const tiers = [0, 1, 2].map((tier) => {
  const { buffers } = generateFigureBody(descriptor, tier);
  return {
    tier,
    triangles: buffers.triangleCount,
    vertices: buffers.vertexCount,
    bytes: buffers.bytes,
  };
});
await writeJson('review-report.json', {
  subject: 'Procedural human geometry',
  descriptor,
  sourceHashes,
  tiers,
  joints: body.rig.joints.length,
  bounds: body.bounds,
  glb: {
    sourceHash: createHash('sha256').update(bytes).digest('hex'),
    importedHash: inspected.sidecar.hash,
    textures: 0,
    clips: 0,
  },
  frames,
});
console.log(`Human review: ${frames.length} scene views and four GLB views in ${out}`);
console.log(tiers);
