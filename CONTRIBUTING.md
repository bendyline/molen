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
pnpm install
pnpm assets:fetch  # download the GLBs pinned in asset-lock.json, or build them from source
pnpm all       # clean install, build, and every check CI runs, in order
pnpm verify    # the fast subset: lint, typecheck, docs:check, test:unit, production audit
```

GLBs are build outputs: the generators, source manifests, specs, shared materials, sidecars and
review evidence are in Git, and `asset-lock.json` pins the bytes they build to. `pnpm assets:build`
builds them from source; `pnpm assets:fetch` downloads the release CI published for the same
lock. To change a model, edit its generator, run `pnpm assets:build --update-lock` and commit the
result without any GLB. The Update asset lock workflow can do the build and commit for you. See
[repository GLBs](content/ASSET-PACKS.md).

Generated files come from generators, not from hand edits: the schema reference
(`pnpm docs:gen`), the documentation site (`pnpm docs:site:gen`), and the script
type declarations beside each scene (`molen types gen`). Change the source — a
Zod `.describe()`, an `OPS_CATALOG` entry, a scene — and regenerate.

Render tests (`pnpm test:golden`) compare no committed reference images: a
software rasterizer is deterministic per build rather than across machines. They
check that a frame renders the same way twice, that it changes when its input
does, and what it shows (`frameStats`), so they pass on any machine as they do in
CI and a renderer change needs no re-recording.

## Releases

Each `@bendyline/molen-*` package has its own version line, released with
[multi-semantic-release](https://github.com/qiwi/multi-semantic-release) as in Bendyline's other
monorepos. Owner commits on `main` use [Conventional Commits](https://www.conventionalcommits.org/),
and a package releases when a commit touches its directory: `fix:` produces a patch release,
`feat:` a minor release, and `feat!:` or a `BREAKING CHANGE:` footer a minor release while Molen
is on 0.x. `chore:` and `docs:` commits do not publish by themselves. Commits touching `docs-src/`
or the sample templates under `examples/` count toward `@bendyline/molen-tooling`, which ships
them. A package whose Molen dependencies release gets a patch release too, and published packages
pin their Molen dependencies exactly, so the newest version of every package works with the rest.
`ENGINE_VERSION` is the kernel's version. Each release writes the package's own `CHANGELOG.md` and
a `<name>@<version>` tag, such as `@bendyline/molen-kernel@0.0.4`; the root `CHANGELOG.md` covers
the releases from when every package shared one version. The owner must deliberately change the
release rule in `.releaserc.cjs` when Molen is ready for 1.0.

### Releasing

After CI is green on `main`, manually run the `Release` GitHub Actions workflow on `main`. It
rebuilds, runs `pnpm verify` and `pnpm docs:site:check`, and builds the complete docs site. Then:

1. multi-semantic-release stamps each releasing package's next version into its manifest (the
   kernel's also into `ENGINE_VERSION` and the shipped docs), writes its changelog, and pushes its
   tag. Nothing publishes yet.
2. `scripts/publish-release.mjs` rebuilds and verifies packages and site with the new versions,
   then packs and publishes every version npm does not have yet, dependencies first. npm CLI
   exchanges the job's OIDC identity for short-lived credentials, and automatically publishes
   provenance for public packages from a public repository.
3. The workflow commits the new versions and changelogs to `main` once, uploads the built docs
   site, and deploys it to GitHub Pages.

A run with no releasable commits still refreshes Pages without publishing npm packages. The
workflow creates and pushes every release tag itself. Branch protection must allow the workflow's
`GITHUB_TOKEN` to push its tags and metadata commit.

If publishing stops partway through, rerun `Release` on `main`. The metadata commit is made even
when publishing fails, so the rerun has nothing new to version and publishes the versions still
missing from npm. The publishing step recognizes versions already on npm by tarball contents:
every file byte for byte, except that `package.json` dependency keys may be reordered, because
pnpm writes resolved `workspace:` entries in a racy order. Any other difference is an error that
needs inspection.

The workflow deploys the docs to GitHub Pages: in repository Settings → Pages, **GitHub Actions**
must be the source, with `molen.dev` as the custom domain and its DNS configured with the domain
provider. The site is built for the domain root. GitHub Pages handles the custom domain
independently of the deployed files, so no `CNAME` file is needed.

### New packages

The workflow needs every package on npm, because npm trusted publishers can only be configured on
a package that already exists, and tagged `<name>@<version>`, because semantic-release computes
the next version from that tag (without one a package would start over at 1.0.0). The first
version of a new package is therefore a one-time authenticated publish:

1. The owner gives the package the version it should first publish as, commits it on `main`,
   pushes it, and waits for CI to pass. Git operations are reserved for the owner by `AGENTS.md`.
2. The owner signs into npm with an account authorized to publish the `@bendyline` scope, runs
   `pnpm all`, then runs `pnpm release:bootstrap` on that clean checkout of `main`. The script
   checks that the checkout matches `origin/main`. For each package whose tag is not on origin, it
   verifies, packs and publishes a version npm does not have and tags this commit, or tags a
   version npm already has at that version's `v<version>` tag, from when every package shared one
   version line. Then it pushes the tags. It can be rerun: a tag already on origin is left alone,
   and a version npm already has with the same tarball contents is not published again.
3. On npmjs.com, the owner adds a GitHub Actions trusted publisher to each newly published
   package: organization `bendyline`, repository `molen`, workflow filename `release.yml`, no
   environment, and permission for direct `npm publish`. The filename is entered without
   `.github/workflows/`. The `Release` job has `id-token: write` and uses npm 11.19.1 on Node
   24.18.0; it sends no `NPM_TOKEN` or `NODE_AUTH_TOKEN`.

A new package's first version pins its Molen dependencies at the versions already on npm. If it
relies on unreleased changes in them, the next `Release` run releases those dependencies and gives
the new package a patch release that pins them.

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
