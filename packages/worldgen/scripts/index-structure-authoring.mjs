/** Navigate from each generated landmark back to its registered generator and editable recipes. */
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOptionalJson, writeIndex as writeFile } from './structure-model-files.mjs';
import { isStructureRecipePath, knownSourceEntries } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const path = resolve(root, 'content/worldgen/source/authoring-index.json');
const previous = await readOptionalJson(path);
const previousRecipes = new Map(previous?.entries.map((entry) => [entry.assetId, entry.recipes]));
const text = new Map();
async function dependencies(path, found = new Set()) {
  if (found.has(path)) return found;
  found.add(path);
  const source = text.get(path) ?? (await readFile(resolve(root, path), 'utf8'));
  text.set(path, source);
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([.][^'"]+\.mjs)['"]/g)) {
    const child = relative(root, resolve(root, dirname(path), match[1])).replaceAll('\\', '/');
    if (!child.includes('/dist/')) await dependencies(child, found);
  }
  return found;
}
const plan = JSON.parse(await readFile(resolve(root, 'asset-build.json'), 'utf8'));
const jobs = [];
for (const job of plan.generators.filter((j) => j.id.startsWith('worldgen-'))) {
  const files = [...(await dependencies(job.command[1]))];
  if (job.id === 'worldgen-structure-catalog') {
    const brief = 'examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md';
    text.set(brief, await readFile(resolve(root, brief), 'utf8'));
    files.push(brief);
  }
  jobs.push({ ...job, dependencies: files });
}

const entries = [];
for (const entry of knownSourceEntries().filter((e) => e.hasModel)) {
  const dir = resolve(root, entry.sourcePath);
  const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
  const keys = new Set([entry.key, entry.candidateId, entry.assetId].filter(Boolean));
  const references = [...keys].flatMap((key) => [
    `'${key}'`,
    `"${key}"`,
    `\`${key}\``,
    `| ${key} |`,
  ]);
  const recipes = new Set();
  for (const [path, body] of text) {
    if (references.some((reference) => body.includes(reference))) recipes.add(path);
  }
  const spec = JSON.parse(await readFile(resolve(dir, 'spec.json'), 'utf8'));
  for (const definition of [spec.runtimeLodOverlay, spec.sourceGeometry].filter(Boolean)) {
    const module = definition.module;
    if (!isStructureRecipePath(module, entry.sourcePath))
      throw new Error(`${entry.assetId}: invalid runtime overlay source`);
    const imports = await dependencies(module);
    recipes.add(module);
    // Shared geometry may have no literal asset ID. Preserve an existing recipe binding
    // while the declared geometry or LOD module still imports it.
    for (const recipe of previousRecipes.get(entry.assetId) ?? []) {
      if (imports.has(recipe)) recipes.add(recipe);
    }
  }
  const recipePaths = [...recipes].sort();
  const generatorCandidates = jobs
    .filter((job) => recipePaths.some((path) => job.dependencies.includes(path)))
    .map(({ id }) => id);
  if (spec.runtimeLodOverlay && !generatorCandidates.includes('worldgen-runtime-lods'))
    generatorCandidates.push('worldgen-runtime-lods');
  entries.push({
    assetId: entry.assetId,
    candidateId: entry.candidateId,
    title: entry.title,
    sourceBundle: `${entry.sourcePath}/source.json`,
    models: source.files.models.filter((m) => m.path.endsWith('.glb')),
    generatorCandidates,
    recipes: recipePaths,
  });
}
entries.sort((a, b) => a.assetId.localeCompare(b.assetId, 'en'));
const missing = entries.filter((e) => !e.generatorCandidates.length);
if (missing.length)
  throw new Error(`No registered generator reference: ${missing.map((e) => e.assetId).join(', ')}`);
const document = {
  format: 'molen/structure-authoring-index@1',
  policy:
    'Editable recipes and source manifests live in Git. GLBs are generated outputs. Recipes come from lexical references and declared geometry modules. Previously indexed shared recipes are retained while imported by declared modules.',
  evidence:
    'Static dependency/identity cross-reference. The full assets:build hash comparison proves reconstruction; this index alone does not.',
  generators: jobs.map(({ id, command, dependencies }) => ({
    id,
    command,
    implementation: dependencies.filter((p) => p.endsWith('.mjs')).sort(),
  })),
  entries,
};
const bytes = `${JSON.stringify(document, null, 2)}\n`;
// Model sha256 pins follow GLB bytes, which are build outputs that move with float formatting;
// --check compares the navigation the index exists for, not the pins it copies.
const unpinned = (text) =>
  text.replaceAll('\r\n', '\n').replace(/"sha256": "sha256:[0-9a-f]{64}"/g, '"sha256": ""');
if (process.argv.includes('--check')) {
  if (unpinned(await readFile(path, 'utf8')) !== unpinned(bytes))
    throw new Error(
      'Authoring index is stale; run node packages/worldgen/scripts/index-structure-authoring.mjs',
    );
} else await writeFile(path, bytes);
console.log(`Indexed source recipes for ${entries.length} structure models.`);
