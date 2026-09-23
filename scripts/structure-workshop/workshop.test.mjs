import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encodeRecipe, geometries, gltf, PNG, repo, sha, validateRecipe } from './geometry.mjs';
import { build, json, prepare, review, safeId, save, validateRequests } from './pipeline.mjs';

const fixture = async (name) => json(join(repo, 'scripts/structure-workshop/fixtures', name));
test('recipe validates general geometry, budgets and finite meter-scale input', async () => {
  const r = await fixture('brick-school.recipe.json');
  const g = geometries(r);
  assert(g.triangles > 100 && g.triangles <= 8000);
  assert(Math.abs(g.bounds.min[1]) < 1e-6);
  for (const mutate of [
    (r) => (r.parts[0].size[0] = -1),
    (r) => (r.parts[0].position[0] = Infinity),
    (r) => (r.parts[0].material = 'unknown'),
    (r) => (r.materials[0].graph = '../config'),
    (r) => (r.parts[0].repeat = { count: 900, step: [1, 0, 0] }),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => validateRecipe(bad));
  }
  const rim = structuredClone(r);
  rim.parts = [
    {
      name: 'rim',
      shape: 'lathe',
      material: r.materials[0].id,
      profile: [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
        [0, 2],
      ],
      segments: 12,
    },
  ];
  assert(geometries(rim).triangles > 0);
  for (const profile of [
    [
      [0, 0],
      [1, 1],
      [2, 0],
    ],
    [
      [0, 0],
      [1, 1],
      [1, 1],
    ],
  ]) {
    rim.parts[0].profile = profile;
    assert.throws(() => validateRecipe(rim));
  }
  assert.throws(() => safeId('../escape'));
  assert.throws(() => validateRequests({ requests: [] }));
});
test('recipes produce deterministic glTF with named geometry, normals and physical UVs', async () => {
  for (const name of ['brick-school', 'space-needle']) {
    const r = await fixture(`${name}.recipe.json`);
    const a = await encodeRecipe(r, new Map()),
      b = await encodeRecipe(r, new Map());
    assert.equal(sha(a.bytes), sha(b.bytes));
    const doc = await new gltf.NodeIO().readBinary(a.bytes);
    assert(doc.getRoot().listMeshes().length > 10);
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        assert(p.getAttribute('NORMAL'));
        assert(p.getAttribute('TEXCOORD_0'));
        assert(p.getIndices().getCount() > 0);
      }
    if (name === 'space-needle') assert(Math.abs(a.bounds.max[1] - 184.42) < 0.01);
  }
});
test('real importer, canonical PBR maps and scene simulation; rejects unreviewed and stale output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'molen-workshop-test-'));
  try {
    const req = await fixture('requests.json');
    req.requests = req.requests.slice(0, 1);
    await save(join(dir, 'requests.json'), req);
    await prepare(dir);
    const id = req.requests[0].id,
      brief = await json(join(dir, id, 'brief.json'));
    await save(join(dir, id, 'research.json'), {
      references: brief.references.map((r) => ({
        id: r.id,
        sha256: r.sha256,
        observations:
          'Fixture-only technical test: this string does not claim a model looked at a photograph or approved any visual result.',
      })),
    });
    await save(join(dir, id, 'recipe.json'), await fixture('brick-school.recipe.json'));
    const b = await build(dir, id, { capture: false });
    assert.equal(b.verified, true);
    assert.equal(b.images.length, 0);
    assert(b.simulationHash);
    const maps = await readFile(join(dir, id, b.output, 'textures/brick-orm.png'));
    const png = PNG.sync.read(maps);
    assert.equal(png.width, 256);
    assert.equal(png.data[2], 0);
    assert(png.data[1] > 180);
    const io = new gltf.NodeIO();
    const doc = await io.readBinary(await readFile(join(dir, id, b.output, 'models/source.glb')));
    assert(doc.getRoot().listTextures().length >= 2);
    assert(
      doc
        .getRoot()
        .listMaterials()
        .some((m) => m.getBaseColorTexture() && m.getMetallicRoughnessTexture()),
    );
    await save(join(dir, id, 'review.json'), { buildId: b.buildId });
    await assert.rejects(review(dir, id), /eight render/);
    // Two failed compiler attempts must leave room to fix a rendered model.
    await mkdir(join(dir, id, 'revisions/2'));
    await mkdir(join(dir, id, 'revisions/3'));
    const repaired = await build(dir, id, { capture: false });
    assert.equal(repaired.revision, 4);
    assert.equal(repaired.qualityAttempt, 1);
    await mkdir(join(dir, id, 'revisions/9'));
    await assert.rejects(build(dir, id, { capture: false }), /Nine compiler attempts/);
    await writeFile(join(dir, id, 'recipe.json'), '{}');
    await assert.rejects(review(dir, id), /Recipe changed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('review rejects missing views, poor scores, stale screenshot/model hashes and exhausted repairs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'molen-review-test-')),
    id = 'probe';
  const dir = join(root, id);
  await mkdir(join(dir, 'revisions/3/assets/probe'), { recursive: true });
  try {
    await writeFile(join(dir, 'recipe.json'), 'recipe');
    await writeFile(join(dir, 'revisions/3/assets/probe/model.glb'), 'model');
    const images = [];
    for (let i = 0; i < 8; i++) {
      const path = `revisions/3/view-${i}.png`;
      await writeFile(join(dir, path), `pixels-${i}`);
      images.push({ path, sha256: sha(`pixels-${i}`) });
    }
    const b = {
      recipeHash: sha('recipe'),
      modelHash: sha('model'),
      assetId: 'probe',
      buildId: 'technical-test',
      output: 'revisions/3',
      revision: 3,
      images,
    };
    await save(join(dir, 'build.json'), b);
    await save(join(dir, 'brief.json'), { features: ['slender tower'] });
    const r = {
      buildId: b.buildId,
      views: images.map((i) => ({
        ...i,
        observation: 'Technical fixture evidence; this is not an actual visual approval.',
      })),
      features: [
        {
          feature: 'slender tower',
          pass: true,
          observation: 'Synthetic test fixture for the review contract.',
        },
      ],
      scores: { silhouette: 3, proportions: 4, materials: 4, style: 4, usefulness: 4 },
      issues: ['The shaft is too wide.'],
    };
    await save(join(dir, 'review.json'), r);
    const rejected = await review(root, id);
    assert.equal(rejected.decision, 'reject');
    assert.equal(rejected.needsHelp, true);
    r.scores.silhouette = 4;
    r.issues = [];
    await save(join(dir, 'review.json'), r);
    assert.equal((await review(root, id)).decision, 'approve');
    r.views.pop();
    await save(join(dir, 'review.json'), r);
    await assert.rejects(review(root, id), /Inspect and describe/);
    await writeFile(join(dir, images[0].path), 'changed');
    await assert.rejects(review(root, id), /Screenshot changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
