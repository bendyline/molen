import { defineConfig } from 'vitepress';
import generated from './generated-nav.json' with { type: 'json' };

// Everything under `sidebar` is produced by `scripts/generate-all.mjs` from the packages,
// OPS_CATALOG, docs-src and examples on disk. Only the framing below is hand-written.
const { sidebar, counts } = generated;

/** Static directories staged beside the site by scripts/stage-hosted.mjs; see `markdown.config`. */
const HOSTED_PATH = /^\/(?:play|packs)(?:[/?#]|$)/;

export default defineConfig({
  title: 'Molen',
  description:
    'An AI-legible 3D experience engine: a deterministic headless kernel, a three.js client, ' +
    'and a headless dev loop an agent can drive end to end.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  // `scripts/` is build tooling, not content; the package README is not a page.
  srcExclude: ['**/README.md', 'scripts/**'],

  head: [
    ['meta', { name: 'theme-color', content: '#5b8def' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Molen — an AI-legible 3D experience engine' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guides', link: '/guide/quickstart', activeMatch: '^/guide/' },
      { text: 'Samples', link: '/samples/', activeMatch: '^/samples/' },
      // A staged directory, not a page: `_self` makes it a full page load (see `markdown.config`).
      { text: 'Play', link: '/play/', target: '_self' },
      { text: 'API', link: '/api/', activeMatch: '^/api/' },
      { text: 'Schemas', link: '/schemas/', activeMatch: '^/schemas/' },
      {
        text: 'Tooling',
        activeMatch: '^/reference/',
        items: [
          { text: 'CLI reference', link: '/reference/cli' },
          { text: 'MCP server', link: '/reference/mcp' },
          { text: 'llms.txt', link: '/llms.txt', target: '_blank' },
        ],
      },
    ],

    sidebar,

    search: { provider: 'local' },

    outline: { level: [2, 3], label: 'On this page' },

    editLink: undefined,

    footer: {
      message:
        `${counts.guides} guides · ${counts.schemas} schema formats · ${counts.entryPoints} API entry points · ${counts.samples} samples. ` +
        'API, CLI and schema pages are generated from the shipped build.',
      copyright: 'Molen',
    },
  },

  // The API reference is large and deeply cross-linked; surface real breakage but do not fail the
  // build on anchors TypeDoc generates into pages it did not emit.
  ignoreDeadLinks: [/^\/llms\.txt$/],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    // /play/ (the samples) and /packs/ (the content packs) are not pages: scripts/stage-hosted.mjs
    // copies them into the build after VitePress finishes. A root-relative link to them would
    // fail the dead-link check, and on the live site the client router would intercept the click
    // and render its 404 page in place of the sample. A `target` attribute opts a link out of
    // both, so the browser does a full page load. Full https://molen.dev/play/ URLs are external
    // links and already carry one. A nav or sidebar entry pointing there needs `target: '_self'`.
    config(md) {
      md.core.ruler.push('molen-hosted-links', (state) => {
        for (const block of state.tokens) {
          for (const token of block.children ?? []) {
            const href = token.type === 'link_open' ? token.attrGet('href') : null;
            if (href !== null && HOSTED_PATH.test(href) && token.attrGet('target') === null) {
              token.attrSet('target', '_self');
            }
          }
        }
      });
    },
  },
});
