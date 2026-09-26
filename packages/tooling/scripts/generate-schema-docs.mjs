// Autogenerate the schema reference markdown from the registered schemas (core + capability)
// and the registered component vocabulary. Run after building (`pnpm -r build`). Output:
// docs-src/schemas/<kind>.md, docs-src/schemas/components.md, docs-src/schemas/README.md.
// Part of llms.txt v0.
//
//   node packages/tooling/scripts/generate-schema-docs.mjs          # write (pnpm docs:gen)
//   node packages/tooling/scripts/generate-schema-docs.mjs --check  # verify committed output
//                                                                   # (pnpm docs:check; CI)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Importing these registers every schema kind into the shared registry.
import { getComponent, getSchema, listComponents, schemaKinds } from '@bendyline/molen-schema';
import { z } from 'zod';
import '@bendyline/molen-figures/kernel';
import '@bendyline/molen-materials';
import '@bendyline/molen-terrain/kernel';
import '@bendyline/molen-worldgen/kernel';
import '@bendyline/molen-worldgen-earth/kernel';
import { registerCameraTrackSchema } from '@bendyline/molen-client/camera-track';
// Tooling owns the play-scenario format, so the generator registers it the same way.
import { registerExperiencePlaySchema } from '../dist/index.mjs';

registerCameraTrackSchema();
registerExperiencePlaySchema();

const check = process.argv.includes('--check');
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', '..', 'docs-src', 'schemas');

// Conventions every field description assumes (mirrors the CONVENTIONS block at the top of
// packages/schema/src/components.ts).
const CONVENTIONS = [
  '- Coordinate system: **Y-up**, right-handed; distances in **meters**.',
  '- Time is in **ticks** at the scene `tickRate` (dt = 1/tickRate s); rates are per second.',
  '- Quaternions are `[x, y, z, w]`; identity is `[0, 0, 0, 1]`.',
  '- Colors are `"#rrggbb"` strings.',
  '- `collider.halfExtents` is `[x, z]` (2.5D kinematics act in the XZ plane).',
  '- `moveIntent.dir` is `[x, z]`: +x east, +z south (screen-down in top-down views).',
  '- `layer`/`mask` are bitmasks: a collides with b when `a.mask & b.layer` or `b.mask & a.layer` is non-zero.',
  '- `renderable.primitive.size` is `[x, y, z]`.',
  '- `environment.sun.direction` points FROM the origin TOWARD the sun (the light sits at that offset and shines back at the origin).',
];

function json(value) {
  return JSON.stringify(value, null, 2);
}

/** Human list of the required fields of a JSON Schema (unions list each variant). */
function requiredOf(schema) {
  const variants = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(variants)) {
    return variants
      .map((v) => {
        const req = requiredOf(v);
        const disc = Object.entries(v.properties ?? {}).find(([, p]) => p.const !== undefined);
        return disc === undefined ? `(${req})` : `(${disc[0]}=${json(disc[1].const)}: ${req})`;
      })
      .join(' or ');
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  return required.length === 0 ? 'none' : required.map((r) => `\`${r}\``).join(', ');
}

function renderKind(kind) {
  const entry = getSchema(kind);
  const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
  const example = entry.meta.examples[0];
  return [
    `# ${entry.meta.title} (\`${entry.meta.id}\`)`,
    '',
    entry.meta.description,
    '',
    '## Example',
    '',
    '```json',
    json(example),
    '```',
    '',
    '## JSON Schema',
    '',
    '```json',
    json(jsonSchema),
    '```',
    '',
  ].join('\n');
}

function renderComponent(summary) {
  const entry = getComponent(summary.name);
  const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
  return [
    `### \`${entry.name}\``,
    '',
    entry.meta.description,
    '',
    `Required: ${requiredOf(jsonSchema)}`,
    '',
    '```json',
    json(entry.meta.examples[0]),
    '```',
    '',
    '<details>',
    '<summary>JSON Schema</summary>',
    '',
    '```json',
    json(jsonSchema),
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
}

function renderComponents() {
  const summaries = listComponents();
  const byOwner = new Map();
  for (const c of summaries) {
    const owner = c.owner ?? 'other';
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(c);
  }
  const lines = [
    '# Components',
    '',
    'Components are pure-JSON data attached to entities. Molen ships a known component vocabulary;',
    "`molen validate` checks component data against it, so a typo'd name (`helth` → `health`) or a",
    'wrong field (`transform.position` → `pos`) is caught in the cheap pre-sim loop. **Inventing your',
    "own components is fine** — a name that doesn't resemble a known one is accepted as-is (declare it",
    'under `components` in the scene or project to document it). A name that *is* a near-typo of a',
    'known component is flagged.',
    '',
    'Discover the live vocabulary from the tools (this page is generated from the same registry):',
    '',
    '```sh',
    'molen components            # name, owning layer, description',
    "molen component transform   # one component's JSON Schema + examples",
    '```',
    '',
    '(MCP: `list_components`, `get_component`.) Capability packages and content can register more',
    'with `registerComponent(name, zodSchema, meta)` from `@bendyline/molen-schema`. Strict schemas',
    '(`additionalProperties: false`) flag unknown fields; loose ones allow extras.',
    '',
    '## Conventions',
    '',
    ...CONVENTIONS,
    '',
    '## Vocabulary',
    '',
    '| Component | Owner | Description |',
    '|---|---|---|',
    ...summaries.map((c) => `| \`${c.name}\` | ${c.owner ?? ''} | ${c.description} |`),
    '',
  ];
  for (const [owner, list] of [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## Owner: ${owner}`, '');
    for (const c of list) lines.push(renderComponent(c));
  }
  return `${lines.join('\n')}\n`;
}

function renderReadme(kinds) {
  const lines = [
    '# Schema reference',
    '',
    'Autogenerated from the schema registry `molen validate` checks against; `molen schema list` and `molen schema get <kind>` print the same set at runtime.',
    '',
    '- [Components](components.md) — the component vocabulary (`molen components`)',
  ];
  for (const kind of kinds) {
    const entry = getSchema(kind);
    lines.push(`- [${entry.meta.title}](${kind}.md) — \`${entry.meta.id}\``);
  }
  return `${lines.join('\n')}\n`;
}

const kinds = schemaKinds().sort();
const pages = new Map();
for (const kind of kinds) pages.set(`${kind}.md`, renderKind(kind));
pages.set('components.md', renderComponents());
pages.set('README.md', renderReadme(kinds));

if (check) {
  const stale = [];
  for (const [name, content] of pages) {
    let current;
    try {
      current = await readFile(join(outDir, name), 'utf8');
    } catch {
      stale.push(`${name} (missing)`);
      continue;
    }
    if (current !== content) stale.push(name);
  }
  if (stale.length > 0) {
    console.error('docs-src/schemas is stale; run `pnpm docs:gen` and commit:');
    for (const s of stale) console.error(`  docs-src/schemas/${s}`);
    process.exit(1);
  }
  console.log(`docs-src/schemas is up to date (${pages.size} files)`);
} else {
  await mkdir(outDir, { recursive: true });
  for (const [name, content] of pages) await writeFile(join(outDir, name), content);
  console.log(
    `generated schema docs for ${kinds.length} kinds + ${listComponents().length} components -> docs-src/schemas/`,
  );
}
