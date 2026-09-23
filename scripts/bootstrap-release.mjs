// One-time first publish. Run only after the owner commits the intended public snapshot and
// authenticates npm locally. Once every package exists, register their trusted publishers.
import { execFileSync } from 'node:child_process';
import {
  packRelease,
  publicationOrder,
  publishRelease,
  releasePackages,
} from './semantic-release-molen.mjs';

const packages = publicationOrder(releasePackages());
const version = packages[0].data.version;
if (version !== '0.0.1') {
  throw new Error(`Bootstrap publishing is only for the initial 0.0.1 release, found ${version}.`);
}
execFileSync('pnpm', ['verify'], { stdio: 'inherit' });
publishRelease(packRelease(packages, version), version);
