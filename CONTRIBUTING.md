# Contributing

Thank you for your interest in improving Molen.

## What We Accept

Code contributions are **not accepted**. Pull requests that add, modify, or
remove source code, tests, build configuration, dependencies, or other
implementation files will be closed.

We welcome proposals describing fixes or new capabilities. To submit one:

1. Add a Markdown document to [`specs/`](specs/).
2. Describe the problem, the desired behavior, relevant constraints, and
   examples or acceptance criteria.
3. Open a pull request containing only the proposal document and any directly
   related proposal assets.

See the [`specs/` guide](specs/README.md) for a suggested structure. A proposal
is a request for consideration, not a commitment that it will be accepted or
implemented. For requests that do not need a full proposal, you may instead
[open a GitHub issue](https://github.com/bendyline/molen/issues/new).

A reproduction usually makes a proposal much easier to evaluate. Molen's inner
loop runs headlessly, so a scene manifest plus the commands you ran is often the
whole thing:

```sh
molen validate scene.json
molen sim run scene.json --ticks 30 --assert checks.json --hash
```

## Building It Yourself

One invariant matters more than the rest: **build before you typecheck or
test**, because packages consume each other's `dist`. The root scripts encode it.

```sh
pnpm all       # clean install, build, and every check CI runs, in order
pnpm verify    # the fast subset: lint, typecheck, docs:check, test:unit, production audit
```

Generated files come from generators, not from hand edits: the schema reference
(`pnpm docs:gen`), the documentation site (`pnpm docs:site:gen`), and the script
type declarations beside each scene (`molen types gen`). Change the source — a
Zod `.describe()`, an `OPS_CATALOG` entry, a scene — and regenerate.

Golden images are recorded in CI, not locally, because a software rasterizer is
deterministic per build rather than across machines. `UPDATE_GOLDENS=1` produces
a candidate locally; the `update-goldens` workflow records the authoritative one.

## Releases

Molen uses [semantic-release](https://semantic-release.gitbook.io/semantic-release/) on a single
fixed version line across every `@bendyline/molen-*` package. Owner commits on `main` use
[Conventional Commits](https://www.conventionalcommits.org/): `fix:` produces a patch release,
`feat:` a minor release, and `feat!:` or a `BREAKING CHANGE:` footer a minor release while Molen
is on 0.x. `chore:` and `docs:` commits do not publish by themselves. Semantic-release writes one
root changelog, publishes all 14 packages at one version, then pushes one `vX.Y.Z` tag and creates
one GitHub release. The owner must deliberately change the release rule when Molen is ready for 1.0.

### First release and trusted publisher setup

npm trusted publishers can only be configured on a package that already exists, so the first
`0.0.1` release of the 14 packages is a one-time authenticated publish:

1. The owner commits the intended public source on `main`, pushes it, and waits for CI to pass.
   Git operations are reserved for the owner by `AGENTS.md`.
2. The owner signs into npm with an account authorized to publish the `@bendyline` scope, runs
   `pnpm all`, then runs `pnpm release:bootstrap` on that clean checkout of `main`. The script
   checks that the checkout matches `origin/main`, then verifies, packs and publishes all 14
   packages in dependency order. Last, it tags the published commit `v0.0.1` and pushes the tag:
   semantic-release reads the previous version from that tag, so later releases continue the 0.x
   line instead of starting at 1.0.0. The script can be rerun after a partial publish; it skips an
   existing package version only when the tarball contents match, and it leaves a `v0.0.1` tag
   that already names this commit alone.
3. On npmjs.com, the owner adds a GitHub Actions trusted publisher to **each** of the 14 package
   settings: organization `bendyline`, repository `molen`, workflow filename `release.yml`, no
   environment, and permission for direct `npm publish`. The filename is entered without
   `.github/workflows/`. The `Release` job has `id-token: write` and uses npm 11.19.1 on Node
   24.18.0; it sends no `NPM_TOKEN` or `NODE_AUTH_TOKEN`. After a trusted release succeeds, remove
   any old npm publish token secret and consider disallowing token publishing in npm settings.

### Subsequent releases

After CI is green on `main`, manually run the `Release` GitHub Actions workflow on `main`. It
rebuilds, runs `pnpm verify` and `pnpm docs:site:check`, and builds the complete docs site.
Semantic-release stamps the new version into all package manifests, `ENGINE_VERSION`, and the
shipped docs, then rebuilds and verifies both packages and site before it packs and publishes.
npm CLI exchanges the job's OIDC identity for short-lived credentials, and automatically publishes
provenance for public packages from a public repository. The workflow commits release metadata
once after publication, uploads the built docs site, and deploys it to GitHub Pages. A run with no
version-triggering commits still refreshes Pages without publishing npm packages. The workflow
creates and pushes each release's `vX.Y.Z` tag itself; nobody pushes tags by hand. Branch
protection must allow the workflow's `GITHUB_TOKEN` to push its tag and metadata commit.

Before running the workflow, select **GitHub Actions** as the source in repository Settings →
Pages. Set `molen.dev` as the custom domain there and configure its DNS with the domain provider;
the site is built for the domain root. GitHub Pages handles the custom domain independently of the
deployed files, so no `CNAME` file is needed. After `pnpm release:bootstrap` has published `0.0.1`
and pushed its tag, run `Release` once to deploy the initial docs even if semantic-release has no
new version.

If publishing stops partway through, rerun `Release` on the same commit. The publishing step
recognizes packages already published at the intended version by tarball contents: every file
byte for byte, except that `package.json` dependency keys may be reordered, because pnpm writes
resolved `workspace:` entries in a racy order. Any other difference is an error that needs
inspection. If a rendering change requires new reference images,
run `Update goldens` on the branch first and wait for CI to pass on its resulting commit before
starting the release flow.

## Submission Terms

By submitting a pull request, you represent that you have the right to submit
its contents. You grant Bendyline LLC and the public a perpetual, irrevocable,
worldwide, royalty-free, non-exclusive license to use, reproduce, modify,
publish, distribute, sublicense, and implement any or all facets of the
submission—including its ideas, specifications, prompts, examples, and other
content—for any purpose, without restriction, attribution, compensation, or an
obligation to use or implement it.

Do not submit confidential information or material that you do not have the
right to share under these terms.

All participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md).
