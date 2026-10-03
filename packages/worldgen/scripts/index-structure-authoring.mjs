/** Navigate from each generated landmark back to its registered generator and editable recipes. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knownSourceEntries } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const text = new Map();
async function dependencies(path, found = new Set()) {
  if (found.has(path)) return found;
  found.add(path);
  const source = await readFile(resolve(root, path), 'utf8');
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
  const keys = [entry.key, entry.candidateId, entry.assetId].filter(Boolean);
  const recipes = [...text]
    .filter(([, body]) =>
      keys.some(
        (key) =>
          ["'", '"', '`'].some((quote) => body.includes(`${quote}${key}${quote}`)) ||
          body.includes(`| ${key} |`),
      ),
    )
    .map(([path]) => path)
    .sort();
  const generatorCandidates = jobs
    .filter((job) => recipes.some((path) => job.dependencies.includes(path)))
    .map(({ id }) => id);
  entries.push({
    assetId: entry.assetId,
    candidateId: entry.candidateId,
    title: entry.title,
    sourceBundle: `${entry.sourcePath}/source.json`,
    models: source.files.models.filter((m) => m.path.endsWith('.glb')),
    generatorCandidates,
    recipes,
  });
}
entries.sort((a, b) => a.assetId.localeCompare(b.assetId, 'en'));
const missing = entries.filter((e) => !e.generatorCandidates.length);
if (missing.length)
  throw new Error(`No registered generator reference: ${missing.map((e) => e.assetId).join(', ')}`);
const document = {
  format: 'molen/structure-authoring-index@1',
  policy:
    'Editable recipes and source manifests live in Git. GLBs are generated outputs. Recipe candidates are lexical references within registered generator dependencies; shared modules can appear under several generators.',
  evidence:
    'Static dependency/identity cross-reference. The full assets:build hash comparison proves reconstruction; this index alone does not.',
  generators: jobs.map(({ id, command, dependencies }) => ({
    id,
    command,
    implementation: dependencies.filter((p) => p.endsWith('.mjs')).sort(),
  })),
  entries,
};
const path = resolve(root, 'content/worldgen/source/authoring-index.json');
const bytes = `${JSON.stringify(document, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== bytes)
    throw new Error(
      'Authoring index is stale; run node packages/worldgen/scripts/index-structure-authoring.mjs',
    );
} else await writeFile(path, bytes);
console.log(`Indexed source recipes for ${entries.length} structure models.`);
