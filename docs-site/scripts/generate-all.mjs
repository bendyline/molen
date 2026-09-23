// Run every generator, then emit the VitePress nav/sidebar from what was actually produced.
//
// The sidebar is generated rather than hand-maintained for the same reason the pages are: a new
// package export, a new op in OPS_CATALOG, or a new guide in docs-src should appear in the site
// navigation without anyone remembering to add it.
//
//   node scripts/generate-all.mjs          # write (pnpm docs:site:gen)
//   node scripts/generate-all.mjs --check  # fail if anything is stale (CI)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateApi } from './generate-api.mjs';
import { generateCli } from './generate-cli.mjs';
import { generateGuides } from './generate-guides.mjs';
import { generateSamples } from './generate-samples.mjs';
import { siteDir } from './packages.mjs';

const check = process.argv.includes('--check');

function guideSidebar(guides) {
  // Section boundaries are editorial; everything else follows GUIDE_ORDER.
  const sections = [
    { text: 'Getting started', until: 'experience-playback' },
    { text: 'Samples and worlds', until: 'building-interiors' },
    { text: 'Content and art', until: '3d-art-guidelines' },
    { text: 'Rendering and performance', until: 'capability-authoring' },
  ];
  const items = [];
  let cursor = 0;
  for (const section of sections) {
    const end = guides.findIndex((g) => g.slug === section.until);
    const slice = guides.slice(cursor, end === -1 ? guides.length : end + 1);
    cursor = end === -1 ? guides.length : end + 1;
    if (slice.length > 0) {
      items.push({
        text: section.text,
        collapsed: false,
        items: slice.map((g) => ({ text: g.title, link: `/guide/${g.slug}` })),
      });
    }
  }
  if (cursor < guides.length) {
    items.push({
      text: 'More',
      collapsed: false,
      items: guides.slice(cursor).map((g) => ({ text: g.title, link: `/guide/${g.slug}` })),
    });
  }
  return items;
}

function apiSidebar(index) {
  return [
    { text: 'Overview', link: '/api/' },
    ...index.map(({ pkg, entryPages }) => ({
      text: pkg.name.replace('@bendyline/molen-', ''),
      collapsed: true,
      items: entryPages.map((e) => ({
        text: e.slug === 'index' ? '.' : `./${e.slug}`,
        link: e.link,
      })),
    })),
  ];
}

function schemaSidebar(schemas) {
  const core = [
    'scene',
    'prefab',
    'command',
    'components',
    'assert',
    'keyframe',
    'delta',
    'replay',
    'project',
    'types',
  ];
  const isCore = (s) => core.includes(s.slug);
  const rest = schemas.filter((s) => s.slug !== 'index' && !isCore(s));
  return [
    { text: 'All formats', link: '/schemas/' },
    {
      text: 'Core',
      collapsed: false,
      items: core
        .map((slug) => schemas.find((s) => s.slug === slug))
        .filter(Boolean)
        .map((s) => ({ text: s.slug, link: `/schemas/${s.slug}` })),
    },
    {
      text: 'Capability formats',
      collapsed: false,
      items: rest.map((s) => ({ text: s.slug, link: `/schemas/${s.slug}` })),
    },
  ];
}

function samplesSidebar(entries) {
  const groups = [
    ['Start here', 'starter'],
    ['Capability demos', 'capability'],
    ['Complete games', 'game'],
  ];
  return [
    { text: 'Gallery', link: '/samples/' },
    ...groups.map(([text, kind]) => ({
      text,
      collapsed: false,
      items: entries
        .filter(([s]) => s.kind === kind)
        .map(([s]) => ({ text: s.title, link: `/samples/${s.dir}` })),
    })),
  ];
}

async function main() {
  const { guides, schemas } = await generateGuides();
  const apiIndex = await generateApi();
  await generateCli();
  const samples = await generateSamples();

  const nav = {
    sidebar: {
      '/guide/': guideSidebar(guides),
      '/api/': apiSidebar(apiIndex),
      '/schemas/': schemaSidebar(schemas),
      '/samples/': samplesSidebar(samples),
      '/reference/': [
        {
          text: 'Tooling',
          collapsed: false,
          items: [
            { text: 'CLI', link: '/reference/cli' },
            { text: 'MCP server', link: '/reference/mcp' },
          ],
        },
      ],
    },
    counts: {
      guides: guides.length,
      schemas: schemas.length - 1,
      samples: samples.length,
      packages: apiIndex.length,
      entryPoints: apiIndex.reduce((n, x) => n + x.entryPages.length, 0),
    },
  };

  const outPath = join(siteDir, '.vitepress', 'generated-nav.json');
  const next = `${JSON.stringify(nav, null, 2)}\n`;
  if (check) {
    const current = await readFile(outPath, 'utf8').catch(() => '');
    if (current !== next) {
      console.error('docs site navigation is stale — run `pnpm docs:site:gen` and commit.');
      process.exit(1);
    }
  } else {
    await writeFile(outPath, next);
  }

  const c = nav.counts;
  console.log(
    `docs site: ${c.guides} guides, ${c.schemas} schemas, ${c.entryPoints} API entry points ` +
      `across ${c.packages} packages, ${c.samples} samples`,
  );
}

await main();
