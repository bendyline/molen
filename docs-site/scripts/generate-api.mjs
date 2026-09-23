// Generate the TypeScript API reference from the BUILT `.d.mts` surface of every public package.
//
// Reading `dist/*.d.mts` (not `src/`) is deliberate: those files are literally what ships to npm,
// one per `exports` entry, with internals already bundled away. So the reference can never drift
// from the published shape, and `isolatedDeclarations` guarantees every exported symbol carries an
// explicit type. Run `pnpm -r build` first (the repo's build invariant).
//
// Output: docs-site/api/<pkg-slug>/<entry-slug>.md, one page per entry point.

import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  entryLabel,
  entrySlug,
  escapeProse,
  publicPackages,
  repoRoot,
  siteDir,
  yamlString,
} from './packages.mjs';

const apiDir = join(siteDir, 'api');
const typedocBin = join(siteDir, 'node_modules', '.bin', 'typedoc');

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(typedocBin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`typedoc exited ${code}\n${err}`)),
    );
  });
}

/**
 * TypeDoc's markdown carries its own breadcrumb navigation and an `# <basename>` title. VitePress
 * supplies both, so strip the breadcrumb, replace the title with the real import specifier, and
 * add frontmatter.
 */
function reshape(markdown, { label, specifier, pkg }) {
  // Everything before the first `# ` heading is TypeDoc breadcrumb chrome.
  const at = markdown.indexOf('\n# ');
  let body = at === -1 ? markdown : markdown.slice(at + 1);
  body = body.replace(/^# .*\n/, '');
  // Doc comments routinely contain placeholders like `<id>`; escape them outside code.
  body = escapeProse(body);
  // TypeDoc links its removed per-package README; send those to the API index instead.
  body = body.replace(/\]\(README\.md\)/g, '](/api/)');

  const front = [
    '---',
    `title: ${yamlString(label)}`,
    'outline: [2, 3]',
    '---',
    '',
    `# \`${label}\``,
    '',
    `<p class="api-blurb">${pkg.description}</p>`,
    '',
    '```ts',
    `import { /* … */ } from '${specifier}';`,
    '```',
    '',
  ].join('\n');
  return `${front}${body.trimStart()}\n`;
}

export async function generateApi() {
  const pkgs = await publicPackages();
  await rm(apiDir, { recursive: true, force: true });
  await mkdir(apiDir, { recursive: true });

  const index = [];
  for (const pkg of pkgs) {
    const entryPoints = pkg.entries.map((e) => join(pkg.dir, e.types.replace(/^\.\//, '')));
    const outDir = join(apiDir, pkg.slug);
    await run(
      [
        '--plugin',
        'typedoc-plugin-markdown',
        '--tsconfig',
        join(siteDir, 'tsconfig.api.json'),
        '--entryPointStrategy',
        'resolve',
        '--outputFileStrategy',
        'modules',
        '--readme',
        'none',
        '--githubPages',
        'false',
        '--hideGenerator',
        '--disableSources', // dist line numbers mean nothing to a reader
        '--excludeInternal',
        // The client re-exports all of three.js as the documented escape hatch; documenting it
        // here would add ~340k lines of upstream API. Link to three.js docs instead.
        '--excludeExternals',
        '--externalPattern',
        '**/node_modules/**',
        '--useCodeBlocks',
        '--logLevel',
        'Error',
        '--out',
        outDir,
        ...entryPoints,
      ],
      repoRoot,
    );

    // A project with ONE entry point has no module layer: TypeDoc puts the whole surface in
    // README.md. With several, it emits one file per module, named after the file basename —
    // map those back to `exports` subpaths.
    const single = pkg.entries.length === 1;
    const byBasename = new Map(
      single
        ? [['README', pkg.entries[0].subpath]]
        : pkg.entries.map((e) => [
            e.types.replace(/^.*\//, '').replace(/\.d\.mts$/, ''),
            e.subpath,
          ]),
    );
    const entryPages = [];
    for (const file of await readdir(outDir)) {
      if (!file.endsWith('.md')) continue;
      const base = file.replace(/\.md$/, '');
      const subpath = byBasename.get(base);
      if (subpath === undefined) {
        // README.md in a multi-entry project is TypeDoc's module list; the sidebar replaces it.
        if (base === 'README') await rm(join(outDir, file));
        continue;
      }
      const label = entryLabel(pkg.name, subpath);
      const slug = entrySlug(subpath);
      const md = await readFile(join(outDir, file), 'utf8');
      await writeFile(join(outDir, `${slug}.md`), reshape(md, { label, specifier: label, pkg }));
      if (slug !== base) await rm(join(outDir, file));
      entryPages.push({ label, slug, link: `/api/${pkg.slug}/${slug}` });
    }
    // `.` first, then the simulation half before the rendering half, then alphabetical.
    const entryRank = (s) => (s === 'index' ? 0 : s === 'kernel' ? 1 : s === 'client' ? 2 : 3);
    entryPages.sort(
      (a, b) => entryRank(a.slug) - entryRank(b.slug) || a.slug.localeCompare(b.slug),
    );
    index.push({ pkg, entryPages });
  }

  await writeFile(join(apiDir, 'index.md'), apiIndexPage(index));
  return index;
}

function apiIndexPage(index) {
  const rows = index.map(
    ({ pkg, entryPages }) =>
      `| [\`${pkg.name}\`](${entryPages[0]?.link ?? '#'}) | ${pkg.description} | ${entryPages
        .map((e) => `[\`${e.slug === 'index' ? '.' : `./${e.slug}`}\`](${e.link})`)
        .join(' · ')} |`,
  );
  return `---
title: API reference
outline: [2, 3]
---

# API reference

Generated from the built \`.d.mts\` of every published package — the same files npm ships — so
this reference always matches the current release. Regenerate with \`pnpm docs:site:gen\`.

Every package is ESM-only and requires Node ≥ 22. Capability packages (terrain, worldgen,
figures) have **no \`.\` export**: import \`/kernel\` for simulation-side code and \`/client\`
for the three.js side.

| Package | What it is | Entry points |
|---|---|---|
${rows.join('\n')}

## Where to start

- **[\`@bendyline/molen-kernel\`](/api/kernel/index)** — \`buildWorld\`, the ECS \`World\`, commands, and the deterministic scheduler.
- **[\`@bendyline/molen-client\`](/api/client/index)** — \`mountExperience\` and the three.js renderer.
- **[\`@bendyline/molen-schema\`](/api/schema/index)** — the format registry, validator, and component vocabulary.
- **[\`@bendyline/molen-tooling\`](/api/tooling/index)** — every CLI/MCP operation as a plain \`(input) => output\` function.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateApi();
  console.log('api reference generated');
}
