// Mirror the shipped `docs-src/` bundle into the site.
//
// `docs-src/` stays the single source of truth: it is what ships to agents (and what
// `molen docs search` searches), and CONVENTIONS.md already forbids hand-editing the generated
// schema pages there. This step copies it and rewrites the few link forms that only make sense
// inside a repo checkout — links into `docs/` (the design plan, which is NOT public) and into
// `packages/` / `examples/` source become plain code spans rather than dead links.
//
// Output: docs-site/guide/*.md, docs-site/schemas/*.md, docs-site/public/llms.txt.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { escapeProse, repoRoot, siteDir, yamlString } from './packages.mjs';

const docsSrc = join(repoRoot, 'docs-src');

/** `# Title` on the first heading line, for frontmatter and the sidebar. */
function titleOf(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

/**
 * Rewrite the link forms that only make sense inside a repo checkout.
 *
 * `docs-src/` is flat — `guide/` and `schemas/` beside `llms.txt` — so any link that climbs above
 * the bundle points at something the public site does not publish: the `docs/` design plan, the
 * AGENTS.md signpost, or source under `packages/` / `examples/` / `assets/`. Those become plain
 * text. Everything inside the bundle becomes a site route.
 */
function rewriteLinks(markdown) {
  return (
    markdown
      // Bundle-internal, from either directory.
      .replace(
        /\]\((?:\.\.\/)?guide\/([\w.-]+)\.md(#[\w-]*)?\)/g,
        (_, page, hash) => `](/guide/${page}${hash ?? ''})`,
      )
      .replace(
        /\]\((?:\.\.\/)?schemas\/README\.md(#[\w-]*)?\)/g,
        (_, hash) => `](/schemas/${hash ?? ''})`,
      )
      .replace(
        /\]\((?:\.\.\/)?schemas\/([\w.-]+)\.md(#[\w-]*)?\)/g,
        (_, page, hash) => `](/schemas/${page}${hash ?? ''})`,
      )
      // Anything still climbing out of the bundle is unpublished: keep the words, drop the link.
      .replace(/\[([^\]]+)\]\(\.\.\/[^)]*\)/g, (_, text) => text)
      // Same-directory links: drop the extension so VitePress routes them.
      .replace(/\]\(([\w.-]+)\.md(#[\w-]*)?\)/g, (_, page, hash) => `](./${page}${hash ?? ''})`)
  );
}

async function mirror(fromDir, toDir, { indexFrom } = {}) {
  await rm(toDir, { recursive: true, force: true });
  await mkdir(toDir, { recursive: true });
  const pages = [];
  for (const file of (await readdir(fromDir)).sort()) {
    if (!file.endsWith('.md')) continue;
    const raw = await readFile(join(fromDir, file), 'utf8');
    const slug = file === indexFrom ? 'index' : basename(file, '.md');
    const title = titleOf(raw, slug);
    const body = escapeProse(rewriteLinks(raw));
    await writeFile(
      join(toDir, `${slug}.md`),
      `---\ntitle: ${yamlString(title)}\n---\n\n${body.trimStart()}`,
    );
    pages.push({ slug, title, file });
  }
  return pages;
}

/** Guides, in the order llms.txt introduces them — learning order, not alphabetical. */
const GUIDE_ORDER = [
  'quickstart',
  'agent-loop',
  'scripting',
  'determinism',
  'project',
  'browser-mount',
  'input',
  'entities',
  'experience-playback',
  'examples',
  'game-samples',
  'terrain',
  'worldgen',
  'surface-rendering',
  'structure-library',
  'recognizable-places',
  'building-interiors',
  'figures',
  'vehicles',
  'aircraft',
  'vehicle-interiors',
  'materials',
  '3d-model-assets',
  'source-bundles',
  '3d-art-guidelines',
  'rendering-backends',
  'sky',
  'weather',
  'graphics-performance',
  'adaptive-performance',
  'three-surface',
  'capability-authoring',
];

export async function generateGuides() {
  const guides = await mirror(join(docsSrc, 'guide'), join(siteDir, 'guide'));
  const schemas = await mirror(join(docsSrc, 'schemas'), join(siteDir, 'schemas'), {
    indexFrom: 'README.md',
  });

  // llms.txt is the agent-facing index — serve it verbatim at /llms.txt.
  await mkdir(join(siteDir, 'public'), { recursive: true });
  await copyFile(join(docsSrc, 'llms.txt'), join(siteDir, 'public', 'llms.txt'));

  const rank = (slug) =>
    GUIDE_ORDER.indexOf(slug) === -1 ? GUIDE_ORDER.length : GUIDE_ORDER.indexOf(slug);
  guides.sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));

  const ungrouped = guides.filter((g) => rank(g.slug) === GUIDE_ORDER.length);
  if (ungrouped.length > 0) {
    console.warn(
      `guides: not in GUIDE_ORDER, appended at the end — ${ungrouped.map((g) => g.slug).join(', ')}`,
    );
  }
  return { guides, schemas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { guides, schemas } = await generateGuides();
  console.log(`guides: ${guides.length} pages, schemas: ${schemas.length} pages`);
}
