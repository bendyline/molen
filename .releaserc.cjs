// multi-semantic-release runs semantic-release once per package, from the package's directory,
// with this configuration. It reads only CommonJS or JSON configuration files, and semantic-release
// resolves plugins from the package directory, so the Molen plugin is named by absolute path.
const { join } = require('node:path');

module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        // Keep the documented 0.x line: a breaking change bumps the minor until the owner
        // deliberately removes this rule for 1.0.
        releaseRules: [{ breaking: true, release: 'minor' }],
      },
    ],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    join(__dirname, 'scripts/semantic-release-molen.mjs'),
  ],
};
