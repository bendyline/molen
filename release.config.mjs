import { readFileSync } from 'node:fs';

const kernel = JSON.parse(readFileSync(new URL('./packages/kernel/package.json', import.meta.url)));

export default {
  branches: ['main'],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release expands this template.
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        // Keep the documented 0.x line until the owner deliberately opts into 1.0.
        ...(kernel.version.startsWith('0.')
          ? { releaseRules: [{ breaking: true, release: 'minor' }] }
          : {}),
      },
    ],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    './scripts/semantic-release-molen.mjs',
    [
      '@semantic-release/github',
      {
        successCommentCondition: false,
        failCommentCondition: false,
        releasedLabels: false,
      },
    ],
  ],
};
