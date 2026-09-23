import assert from 'node:assert/strict';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  encodeRecipe,
  materialsApi,
  PNG,
  repo,
  sha,
  sharp,
  tooling,
  validateRecipe,
} from './geometry.mjs';
export const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
export const save = async (path, data) => {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
};
export function safeId(id) {
  assert(
    /^[a-z][a-z0-9_-]{0,63}$/.test(id),
    'Use a lowercase id with letters, digits, hyphens or underscores',
  );
  return id;
}
export const runRoot = (run) =>
  resolve(process.cwd(), '.artifacts/structure-workshop', safeId(run));
export function validateRequests(data) {
  assert(
    Array.isArray(data.requests) && data.requests.length >= 1 && data.requests.length <= 8,
    'requests: 1–8 buildings',
  );
  const ids = new Set();
  for (const r of data.requests) {
    safeId(r.id);
    assert(!ids.has(r.id), 'duplicate request id');
    ids.add(r.id);
    assert(typeof r.title === 'string' && r.title.length > 0, 'title required');
    assert(
      typeof r.brief === 'string' && r.brief.length >= 40,
      'brief must describe the intended model',
    );
    assert(
      Array.isArray(r.features) &&
        r.features.length >= 3 &&
        r.features.every((s) => typeof s === 'string' && s.length >= 8),
      'at least 3 visible recognition features',
    );
    assert(
      Array.isArray(r.references) && r.references.length > 0 && r.references.length <= 6,
      '1–6 references required',
    );
    const referenceIds = new Set();
    for (const ref of r.references) {
      assert(!referenceIds.has(ref.id), 'duplicate reference id');
      referenceIds.add(ref.id);
      safeId(ref.id);
      assert(
        typeof ref.sourceUrl === 'string' && /^https:\/\//.test(ref.sourceUrl),
        'reference sourceUrl required',
      );
      assert(
        typeof ref.credit === 'string' &&
          ref.credit.length > 0 &&
          typeof ref.rights === 'string' &&
          ref.rights.length > 0,
        'reference credit and rights required',
      );
      assert(ref.imageUrl?.startsWith('https://') || ref.fixture, 'imageUrl or fixture required');
    }
  }
  return data;
}
export async function prepare(root) {
  const requestBytes = await readFile(join(root, 'requests.json'));
  const data = validateRequests(JSON.parse(requestBytes));
  const queue = [];
  for (const request of data.requests) {
    const dir = join(root, request.id);
    await mkdir(join(dir, 'references'), { recursive: true });
    const refs = [];
    for (const ref of request.references) {
      let bytes;
      if (ref.fixture)
        bytes = await readFile(
          join(
            repo,
            'scripts/structure-workshop/fixtures/references',
            `${safeId(ref.fixture)}.jpg`,
          ),
        );
      else {
        const url = new URL(ref.imageUrl);
        assert(
          url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            ['upload.wikimedia.org', 'thumb.wikimedia.org', 'cdn.loc.gov', 'tile.loc.gov'].includes(
              url.hostname,
            ),
          'Use a Commons or Library of Congress image URL',
        );
        const response = await fetch(ref.imageUrl, {
          signal: AbortSignal.timeout(20000),
          redirect: 'error',
        });
        assert(response.ok, `Reference HTTP ${response.status}: ${ref.imageUrl}`);
        assert(
          response.headers.get('content-type')?.startsWith('image/'),
          'Reference must be an image',
        );
        const chunks = [];
        let length = 0;
        for await (const chunk of response.body) {
          length += chunk.length;
          assert(length <= 8_000_000, 'reference exceeds 8 MB');
          chunks.push(chunk);
        }
        bytes = Buffer.concat(chunks);
      }
      assert(
        bytes.length > 1000 && bytes.length <= 8_000_000,
        'reference must contain image bytes',
      );
      const meta = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
      assert(['jpeg', 'png', 'webp'].includes(meta.format), 'Reference must be JPEG, PNG or WebP');
      const path = `references/${ref.id}.${meta.format === 'jpeg' ? 'jpg' : meta.format}`;
      await writeFile(join(dir, path), bytes);
      refs.push({ ...ref, path, sha256: sha(bytes) });
    }
    await save(join(dir, 'brief.json'), {
      ...request,
      references: refs,
      availableMaterialGraphs: (
        await readdir(join(repo, 'packages/worldgen/packs/default/materials'))
      )
        .filter((f) => f.endsWith('.matgraph.json'))
        .map((f) => f.replace('.matgraph.json', ''))
        .sort(),
      styleGuide: 'docs-src/guide/3d-art-guidelines.md',
      assumptions:
        'Stylized exterior study; not surveyed architecture. +Y up, meters, base Y=0, front +Z. Maximum 8,000 triangles.',
    });
    queue.push({ id: request.id, title: request.title });
  }
  await save(join(root, 'queue.json'), queue);
  await save(join(root, 'prepared.json'), {
    requestHash: sha(requestBytes),
    ids: queue.map((r) => r.id),
  });
  return queue;
}
function png(image) {
  const p = new PNG({ width: image.width, height: image.height });
  p.data = Buffer.from(image.data);
  return PNG.sync.write(p);
}
async function bakeTextures(recipe, dir) {
  const textures = new Map();
  await mkdir(join(dir, 'textures'), { recursive: true });
  for (const m of recipe.materials) {
    if (!m.graph) continue;
    const graph = await json(
      join(repo, 'packages/worldgen/packs/default/materials', `${m.graph}.matgraph.json`),
    );
    const validated = check(await tooling.validateAsset({ inline: graph }), 'material validation');
    const baked = materialsApi.bakeMatGraph(validated.value);
    const base = baked.slots.baseColor;
    assert(base && base.width <= 512 && base.height <= 512, 'canonical texture must be <=512');
    const basecolor = png(base),
      orm = new PNG({ width: base.width, height: base.height });
    for (let i = 0; i < base.width * base.height; i++) {
      orm.data[i * 4] = 255;
      orm.data[i * 4 + 1] = Math.round(
        (m.roughness ?? (baked.slots.roughness?.data[i * 4] ?? 220) / 255) * 255,
      );
      orm.data[i * 4 + 2] = Math.round((m.metalness ?? 0) * 255);
      orm.data[i * 4 + 3] = 255;
    }
    const maps = { basecolor, orm: PNG.sync.write(orm) };
    textures.set(m.id, maps);
    for (const [slot, bytes] of Object.entries(maps))
      await writeFile(join(dir, 'textures', `${m.id}-${slot}.png`), bytes);
    await save(join(dir, 'textures', `${m.id}.matgraph.json`), graph);
  }
  assert(
    textures.size > 0,
    'At least one canonical material graph is required; the deliverable includes real textures',
  );
  return textures;
}
function check(result, label) {
  assert(result.ok, `${label}: ${result.error ?? JSON.stringify(result)}`);
  return result;
}
export async function build(root, id, { capture = true } = {}) {
  safeId(id);
  const assetId = id.replaceAll('-', '_');
  const dir = join(root, id);
  const recipeBytes = await readFile(join(dir, 'recipe.json'));
  const recipe = validateRecipe(JSON.parse(recipeBytes));
  assert(recipe.id === id, 'recipe id must match request');
  const brief = await json(join(dir, 'brief.json'));
  assert(brief.id === id, 'missing brief');
  const observations = await json(join(dir, 'research.json'));
  assert(
    brief.references.every((ref) =>
      observations.references?.some(
        (o) =>
          o.id === ref.id &&
          o.sha256 === ref.sha256 &&
          typeof o.observations === 'string' &&
          o.observations.length >= 60,
      ),
    ),
    'Inspect every reference image; research.json needs id, sha256 and >=60-character observations for each',
  );
  const revDir = join(dir, 'revisions');
  await mkdir(revDir, { recursive: true });
  const attempts = (await readdir(revDir)).filter((x) => /^\d+$/.test(x));
  const revision = Math.max(0, ...attempts.map(Number)) + 1;
  let rendered = 0;
  for (const attempt of attempts) {
    try {
      const prior = await json(join(revDir, attempt, 'build.json'));
      if (prior.images.length === 8) rendered++;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  assert(revision <= 9, 'Nine compiler attempts exhausted. Needs human help.');
  assert(
    rendered < 3,
    'Three rendered model revisions exhausted. Needs human help; do not mark accepted.',
  );
  const qualityAttempt = rendered + 1;
  const out = join(revDir, String(revision));
  await mkdir(join(out, 'models'), { recursive: true });
  await writeFile(join(out, 'recipe.json'), recipeBytes);
  await save(join(out, 'brief.json'), brief);
  await save(join(out, 'research.json'), observations);
  await cp(join(dir, 'references'), join(out, 'references'), { recursive: true });
  await cp(join(repo, 'docs-src/guide/3d-art-guidelines.md'), join(out, 'STYLE-GUIDE.md'));
  const textures = await bakeTextures(recipe, out);
  const model = await encodeRecipe(recipe, textures);
  await writeFile(join(out, 'models/source.glb'), model.bytes);
  const projectPath = join(out, 'project.json');
  await save(projectPath, {
    format: 'molen/project@1',
    name: recipe.title,
    scenes: { main: 'scene.json' },
    defaultScene: 'main',
    types: [],
    assets: {},
    reservations: [],
  });
  check(
    await tooling.importAsset({ path: join(out, 'models/source.glb'), id: assetId, projectPath }),
    'import',
  );
  const inspected = check(
    await tooling.inspectAsset({ ref: assetId, projectPath, verify: true }),
    'hash verification',
  );
  assert(inspected.verified, 'GLB verification failed');
  const max = model.bounds.max,
    min = model.bounds.min,
    h = max[1],
    span = Math.max(max[0] - min[0], max[2] - min[2], h);
  const transform = (pos, scale = [1, 1, 1], rot = [0, 0, 0, 1]) => ({ pos, scale, rot });
  const scene = {
    format: 'molen/scene@3',
    name: recipe.title,
    seed: 'structure-review',
    tickRate: 30,
    physics: { engine: 'none' },
    camera: {
      mode: 'fixed',
      position: [span * 0.8, Math.max(h * 0.7, span * 0.35), span * 0.95],
      lookAt: [0, h * 0.42, 0],
    },
    entities: [
      {
        id: 'model',
        components: {
          transform: transform([0, 0, 0]),
          renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: transform([0, -0.15, 0], [span * 4, 0.3, span * 4]),
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#88917f',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'scale-person',
        components: {
          transform: transform([max[0] + 1.5, 0.875, max[2] + 1], [0.45, 1.75, 0.3]),
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#a85a32',
            shadows: { cast: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#d8e4ec', ground: '#696d63', intensity: 1.2 },
            sun: { direction: [-8, 14, 10], color: '#fff8e9', intensity: 2.2, castShadow: true },
            background: '#c8d9e4',
            toneMapping: 'agx',
            exposure: 1,
            shadows: 'high',
          },
        },
      },
    ],
  };
  await save(join(out, 'scene.json'), scene);
  const checks = {
    format: 'molen/assert@1',
    assertions: [
      { select: 'has:renderable', op: 'count', value: 3 },
      { select: '#model .transform.pos[1]', op: 'approx', value: 0, tol: 0.001 },
    ],
  };
  await save(join(out, 'checks.json'), checks);
  check(await tooling.validateAsset({ path: join(out, 'scene.json') }), 'scene validation');
  const sim = check(
    await tooling.runSimulation({
      scenePath: join(out, 'scene.json'),
      projectPath,
      ticks: 30,
      assertDoc: checks,
    }),
    'simulation',
  );
  const images = [];
  if (capture) {
    const turntable = check(
      await tooling.screenshotAsset({
        ref: assetId,
        projectPath,
        outDir: join(out, 'shots'),
        angles: 4,
        size: [640, 640],
      }),
      'turntable',
    );
    images.push(...turntable.frames.map((f) => f.path));
    const captureScene = async (name, override = {}) => {
      const path = join(out, 'shots', `${name}.png`);
      const captured = check(
        await tooling.screenshotScene({
          scene: { ...scene, ...override },
          projectPath,
          ticks: 30,
          size: [960, 720],
          outPath: path,
        }),
        name,
      );
      assert(
        captured.renderStats?.triangles >= inspected.sidecar.stats.triangles,
        `${name}: model geometry missing from capture`,
      );
      images.push(path);
    };
    await captureScene('in-scene');
    await captureScene('distance', {
      camera: { ...scene.camera, position: scene.camera.position.map((v) => v * 2.2) },
    });
    const rotated = structuredClone(scene);
    rotated.entities[0].components.transform = transform(
      [0, 0, 0],
      [0.75, 0.75, 0.75],
      [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
    );
    await captureScene('rotated-scaled', { entities: rotated.entities });
    const plain = await encodeRecipe(recipe, textures, { untextured: true });
    await writeFile(join(out, 'models/silhouette.glb'), plain.bytes);
    check(
      await tooling.importAsset({
        path: join(out, 'models/silhouette.glb'),
        id: `${assetId}_silhouette`,
        projectPath,
      }),
      'silhouette import',
    );
    const plainScene = structuredClone(scene);
    plainScene.entities[0].components.renderable.ref = `${assetId}_silhouette`;
    await captureScene('untextured', { entities: plainScene.entities });
  }
  const files = [];
  for (const path of images)
    files.push({
      path: relative(dir, path).replaceAll('\\', '/'),
      sha256: sha(await readFile(path)),
    });
  const receipt = {
    id,
    assetId,
    revision,
    qualityAttempt,
    recipeHash: sha(recipeBytes),
    sourceHash: sha(model.bytes),
    modelHash: sha(await readFile(join(out, 'assets', assetId, 'model.glb'))),
    triangles: model.triangles,
    bounds: model.bounds,
    verified: true,
    simulationHash: sim.stateHash,
    images: files,
    textureCount: textures.size * 2,
    output: relative(dir, out).replaceAll('\\', '/'),
  };
  receipt.buildId = sha(JSON.stringify(receipt));
  await save(join(out, 'build.json'), receipt);
  await save(join(dir, 'build.json'), receipt);
  await writeFile(
    join(out, 'README.md'),
    `# ${recipe.title}\n\n${brief.brief}\n\nOriginal stylized exterior; meters, +Y up, ground pivot, front +Z. ${model.triangles} triangles.\n\n[Molen building style guide](STYLE-GUIDE.md) (snapshot of docs-src/guide/3d-art-guidelines.md). Recipe is the editable source; canonical material graphs and baked PNGs are in textures/. No lighting is baked into base color. Normals are geometric; no synthetic normal-map claims.\n\nBuild ${receipt.buildId}. Source SHA-256 ${receipt.sourceHash}. Runtime SHA-256 ${receipt.modelHash}.\n\nCollision hulls are import diagnostics; these exterior studies are not enterable buildings. KTX2 packing is a separate ship-time step. Review is pending until review.json matches this build.\n`,
  );
  const textureFiles = (await readdir(join(out, 'textures')))
    .filter((f) => f.endsWith('.png'))
    .map((path) => ({ id: path.replace('.png', ''), path: `textures/${path}` }));
  await save(join(out, 'source.json'), {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: recipe.title,
    files: {
      definitions: [
        'recipe.json',
        'project.json',
        'scene.json',
        'checks.json',
        ...recipe.materials.filter((m) => m.graph).map((m) => `textures/${m.id}.matgraph.json`),
      ],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: `assets/${assetId}/asset.json`,
          pipeline: 'import',
          sha256: `sha256:${receipt.sourceHash}`,
        },
        ...(capture
          ? [
              {
                path: 'models/silhouette.glb',
                assetId: `${assetId}_silhouette`,
                output: `assets/${assetId}_silhouette/asset.json`,
                pipeline: 'import',
                sha256: `sha256:${sha(await readFile(join(out, 'models/silhouette.glb')))}`,
              },
            ]
          : []),
      ],
      generators: [],
      scripts: [],
      textures: textureFiles,
      sounds: [],
      documents: [
        'README.md',
        'STYLE-GUIDE.md',
        ...brief.references.map((r) => r.path),
        'brief.json',
        'research.json',
        'build.json',
        ...files.map((f) => relative(out, join(dir, f.path)).replaceAll('\\', '/')),
      ],
    },
  });
  return receipt;
}
export async function review(root, id) {
  const dir = join(root, safeId(id)),
    b = await json(join(dir, 'build.json')),
    r = await json(join(dir, 'review.json'));
  assert(
    b.recipeHash === sha(await readFile(join(dir, 'recipe.json'))),
    'Recipe changed after build; rebuild before review',
  );
  assert(
    b.modelHash === sha(await readFile(join(dir, b.output, 'assets', b.assetId, 'model.glb'))),
    'Model changed after build',
  );
  assert(r.buildId === b.buildId, 'Review must name current buildId');
  assert(b.images.length === 8, 'All eight render views required');
  for (const image of b.images) {
    assert(
      image.sha256 === sha(await readFile(join(dir, image.path))),
      'Screenshot changed after build',
    );
    assert(
      r.views?.some(
        (v) =>
          v.path === image.path &&
          v.sha256 === image.sha256 &&
          typeof v.observation === 'string' &&
          v.observation.length >= 40,
      ),
      `Inspect and describe ${image.path}`,
    );
  }
  const brief = await json(join(dir, 'brief.json'));
  assert(
    brief.features.every((feature) =>
      r.features?.some(
        (f) =>
          f.feature === feature &&
          typeof f.observation === 'string' &&
          f.observation.length >= 20 &&
          typeof f.pass === 'boolean',
      ),
    ),
    'Evaluate every requested recognition feature',
  );
  for (const key of ['silhouette', 'proportions', 'materials', 'style', 'usefulness'])
    assert(
      Number.isInteger(r.scores?.[key]) && r.scores[key] >= 1 && r.scores[key] <= 5,
      `Score ${key} from 1 to 5`,
    );
  assert(
    Array.isArray(r.issues) && r.issues.every((x) => typeof x === 'string'),
    'issues array required',
  );
  const accepted =
    Object.values(r.scores).every((x) => x >= 4) &&
    r.features.every((f) => f.pass) &&
    r.issues.length === 0;
  const result = {
    decision: accepted ? 'approve' : 'reject',
    buildId: b.buildId,
    revision: b.revision,
    needsHelp: !accepted && (b.qualityAttempt ?? b.revision) >= 3,
    message: accepted
      ? 'Current model passed technical and visual review.'
      : `Revise recipe.json from these review findings and rebuild: ${r.issues.join('; ') || 'raise every visual axis to 4/5 and satisfy each recognition feature'}`,
  };
  await save(join(dir, b.output, 'review.json'), r);
  // Keep the portable source inventory complete after review.
  const sourcePath = join(dir, b.output, 'source.json');
  try {
    const source = await json(sourcePath);
    if (!source.files.documents.includes('review.json')) source.files.documents.push('review.json');
    await save(sourcePath, source);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await save(join(dir, 'verdict.json'), result);
  return result;
}
export async function collect(root) {
  const data = validateRequests(await json(join(root, 'requests.json'))),
    rows = [];
  for (const req of data.requests) {
    const verdict = await review(root, req.id);
    assert(verdict.decision === 'approve', `${req.id} needs revision or human help`);
    rows.push({
      id: req.id,
      assetId: (await json(join(root, req.id, 'build.json'))).assetId,
      title: req.title,
      ...verdict,
      output: `${req.id}/${(await json(join(root, req.id, 'build.json'))).output}`,
    });
  }
  await save(join(root, 'catalog.json'), rows);
  await writeFile(
    join(root, 'REPORT.md'),
    `# Structure workshop\n\n${rows.map((r) => `- **${r.title}**: [model](${r.output}/assets/${r.assetId}/model.glb), [scene](${r.output}/shots/in-scene.png), [source](${r.output}/source.json), revision ${r.revision}.`).join('\n')}\n`,
  );
  return rows;
}
