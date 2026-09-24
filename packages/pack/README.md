# @bendyline/molen-pack

Content packs for Molen: zip files that carry models, documents and catalogs outside the code
packages, opened from wherever your app keeps them.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-pack
```

Node >= 22.13, ESM only. The `.` export runs in browsers, Workers and Node; `./node` adds file and
directory helpers for Node. Its only dependencies are `@bendyline/molen-schema` and `fflate`.

## Use

Where a pack lives is the app's choice: a URL on any origin, a file bundled with an Electron app,
a file the user picked, bytes you already hold, or storage you read yourself.

```ts
import { createPackSet, openPack } from '@bendyline/molen-pack';

const packs = createPackSet([
  await openPack('/packs/molen.entities-3f2a9c1e5b7d.zip'), // any URL
  await openPack(userPickedFile), // a File or Blob
  await openPack(bytes), // an ArrayBuffer or Uint8Array
  await openPack({ size, read: (offset, length) => myStorage.read(offset, length) }),
]);

// Asset ids, pack-qualified paths, or plain paths; the pack added last wins.
const glb = await packs.readBytes('molen.entities.aircraft.p51d');
const types = await packs.readJson('pack:molen.entities/types/aircraft.types.json');

// The client's asset provider shape, so models and material docs load from packs.
const client = await createClient(link, { assets: { provider: packs.assetProvider() } });
```

Opening a remote pack reads only its last 64 KiB, which holds the manifest, the zip directory and
the small documents. Other files are read on demand with HTTP range requests; reads issued
together are merged when they sit close in the file, at most six run at once, and transient
failures are retried. A server that ignores `Range` just sends the whole file, which is used as is.

Molen's own packs (entities, the default style pack, the Earth catalogs, the star table) are
published at [molen.dev/packs](https://molen.dev/packs/index.json).
`npx molen pack fetch https://molen.dev/packs/index.json` downloads them and pins each one's
`contentHash` in `project.json`.

Build your own packs with the CLI (`molen pack build <dir> --out-dir <d>`) or in code:

```ts
import { buildPack, openDirPack } from '@bendyline/molen-pack/node';

// A directory with a molen-pack.source.json describing the pack.
const built = await buildPack('content/my-props', { outDir: 'dist/packs' });
built.file; // 'my.props-3f2a9c1e5b7d.zip', named by a hash of its bytes

// The same content, unzipped: handy in tests and during development.
const pack = await openDirPack('content/my-props');
```

## What's in it

- `openPack(input, options)` — a `Pack` from a URL, `Blob`, bytes, or a `RangeReader`, with
  `readBytes` / `readText` / `readJson` / `prefetch`. Options cover whole-or-range mode, retries,
  concurrency, progress, an expected `contentHash`, and sha256 checks per file.
- `createPackSet(packs)` — several packs read as one, with later packs overriding earlier ones,
  `provided(role)` to find the files a pack declares for a role, and `assetProvider()`.
- `createPack(files, options)` / `describePack` / `packFromFiles` — build a pack, or a pack-shaped
  view of loose files, from bytes in any environment.
- `./node`: `buildPack`, `openFilePack`, `openDirPack`, `openPackAt`, `readPackSource`,
  `extractPack`.

A pack is a standard zip you can open with any zip tool. Binary files are their own members,
deflated when that helps. Small text files are concatenated into a few deflated solid blocks,
which compresses JSON far better than one file at a time: the default worldgen style pack, 240
files and 799 KB, builds to 79 KB. `molen pack extract` turns a pack back into its source files.
The manifest (`molen/pack@1`) lists every file with its size and sha256, the asset ids it
provides, and a `contentHash` over paths and contents that does not depend on the zip layout.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. The format is
beta. Packs are written without zip64, so a pack must stay under 4 GiB and 65,535 members.
Building the same files always produces the same bytes; that depends on the exact `fflate`
version this package pins.

## Docs

- [Schema: molen/pack@1](https://molen.dev/schemas/pack)
- [Schema: molen/pack-source@1](https://molen.dev/schemas/pack-source)

MIT © Bendyline LLC
