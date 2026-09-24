// Stage the playable samples and the content packs into the built site. Runs after
// `vitepress build` (the `build` script), because VitePress empties .vitepress/dist first.
//
//   /play/               examples/home/dist   the samples gallery
//   /play/<id>/          examples/<id>/dist   each sample's production build
//   /packs/index.json    content/<pack>/      every content pack, a molen/pack-index@1 index whose
//                                            `file` entries sit beside it, so
//                                            `molen pack fetch https://molen.dev/packs/index.json`
//                                            resolves them relative to the index URL
//
// VitePress never sees these directories: they are plain static files copied in after it finishes,
// so it builds no route, search entry or page for them. `.vitepress/config.mts` keeps root-relative
// links to them out of its client-side router.
//
// The script never builds a sample: that is each example's own `build`, which `pnpm -r build` (the
// root `predocs:site:build`) runs first. The ordering comes from this package's devDependencies —
// every example is one — so the check below that the declared list matches examples/ on disk is
// what keeps a new sample from being staged before it is built. A missing or root-absolute build
// fails the step instead of publishing a partial gallery.
import { access, cp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildPack } from '@bendyline/molen-pack/node';
import { repoRoot, siteDir } from './packages.mjs';

const outDir = join(siteDir, '.vitepress', 'dist');
const playDir = join(outDir, 'play');
const packsDir = join(outDir, 'packs');
const examplesDir = join(repoRoot, 'examples');
const contentDir = join(repoRoot, 'content');
const GALLERY = 'home';

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const rel = (path) => relative(repoRoot, path);

async function directorySize(dir) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) bytes += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return bytes;
}
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function exampleDirs() {
  const out = [];
  for (const entry of await readdir(examplesDir, { withFileTypes: true })) {
    const manifest = join(examplesDir, entry.name, 'package.json');
    if (!entry.isDirectory() || !(await exists(manifest))) continue;
    const { name } = JSON.parse(await readFile(manifest, 'utf8'));
    out.push({ dir: entry.name, name });
  }
  return out.sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

async function main() {
  const errors = [];

  if (!(await exists(join(outDir, 'index.html')))) {
    errors.push(`${rel(outDir)}/index.html is missing — run \`vitepress build\` first.`);
  }
  // A page or public file at /play or /packs would be overwritten by the staged copy.
  for (const name of ['play', 'packs']) {
    for (const source of [name, `${name}.md`, join('public', name)]) {
      if (await exists(join(siteDir, source))) {
        errors.push(`docs-site/${source} collides with the staged /${name}/ directory.`);
      }
    }
  }

  const site = JSON.parse(await readFile(join(siteDir, 'package.json'), 'utf8'));
  const declared = new Set(
    Object.keys(site.devDependencies ?? {}).filter((n) =>
      n.startsWith('@bendyline/molen-examples-'),
    ),
  );
  const examples = await exampleDirs();
  for (const { dir, name } of examples) {
    if (!declared.delete(name)) {
      errors.push(
        `examples/${dir} (${name}) is not a devDependency of ${site.name}. Add ` +
          `"${name}": "workspace:*" so \`pnpm -r build\` builds it before the site.`,
      );
    }
  }
  for (const name of declared) {
    errors.push(`${site.name} depends on ${name}, which is not a package under examples/.`);
  }

  for (const { dir, name } of examples) {
    const dist = join(examplesDir, dir, 'dist');
    if (!(await exists(join(dist, 'index.html')))) {
      errors.push(
        `examples/${dir}/dist/index.html is missing — build it: pnpm --filter ${name} build`,
      );
      continue;
    }
    // Under /play/<id>/ a root-absolute asset URL resolves to molen.dev/assets/… and 404s.
    const entries = new Set();
    for (const file of (await readdir(dist)).filter((f) => f.endsWith('.html'))) {
      const html = await readFile(join(dist, file), 'utf8');
      const absolute = html.match(/\b(?:src|href)="\/(?!\/)[^"]*"/);
      if (absolute !== null) {
        errors.push(
          `examples/${dir}/dist/${file} references ${absolute[0]} — set \`base: './'\` in ` +
            `examples/${dir}/vite.config so the build plays from /play/${dir}/.`,
        );
      }
      for (const m of html.matchAll(/<script type="module"[^>]*\ssrc="\.\/assets\/([^"]+\.js)"/g)) {
        entries.add(m[1]);
      }
    }
    // A chunk that imports an entry chunk deadlocks when the entry has a top-level `await` on
    // something that loads that chunk (mountExperience → the lazy WebGPU driver): a blank page, no
    // error, and only in browsers with a WebGPU adapter, which the golden runners do not have.
    const assets = join(dist, 'assets');
    const importers = [];
    for (const chunk of (await exists(assets)) ? await readdir(assets) : []) {
      if (!chunk.endsWith('.js') || entries.has(chunk)) continue;
      const code = await readFile(join(assets, chunk), 'utf8');
      if ([...entries].some((e) => code.includes(`"./${e}"`))) importers.push(chunk);
    }
    if (importers.length > 0) {
      errors.push(
        `examples/${dir}/dist: ${importers.join(', ')} import the entry chunk, which deadlocks ` +
          `on WebGPU when the entry awaits at top level — give three and @bendyline/molen-client ` +
          `their own chunk (build.rollupOptions.output.manualChunks in examples/${dir}/vite.config).`,
      );
    }
  }

  const ids = examples.filter((e) => e.dir !== GALLERY).map((e) => e.dir);
  const galleryHtml = join(examplesDir, GALLERY, 'dist', 'index.html');
  if (await exists(galleryHtml)) {
    const html = await readFile(galleryHtml, 'utf8');
    const linked = [...html.matchAll(/href="\.\/([^"/]+)\/"/g)].map((m) => m[1]);
    for (const id of linked.filter((id) => !ids.includes(id))) {
      errors.push(`the gallery links ./${id}/, which is not an example under examples/.`);
    }
    for (const id of ids.filter((id) => !linked.includes(id))) {
      console.warn(
        `stage-hosted: examples/${id} is published at /play/${id}/ but not listed in ` +
          `the gallery (examples/${GALLERY}/index.html).`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(`stage-hosted: not staging /play and /packs:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }

  await rm(playDir, { recursive: true, force: true });
  await rm(packsDir, { recursive: true, force: true });
  await cp(join(examplesDir, GALLERY, 'dist'), playDir, { recursive: true });
  for (const id of ids) {
    await cp(join(examplesDir, id, 'dist'), join(playDir, id), { recursive: true });
  }

  const packs = [];
  for (const entry of await readdir(contentDir, { withFileTypes: true })) {
    const source = join(contentDir, entry.name);
    if (!entry.isDirectory() || !(await exists(join(source, 'molen-pack.source.json')))) continue;
    const built = await buildPack(source, { outDir: packsDir });
    packs.push(`${built.manifest.id}@${built.manifest.version}`);
  }
  if (packs.length === 0) {
    console.error(`stage-hosted: no content packs found under ${rel(contentDir)}/.`);
    process.exit(1);
  }

  console.log(
    `stage-hosted: /play/ (gallery + ${ids.length} samples, ${mb(await directorySize(playDir))}), ` +
      `/packs/ (${packs.join(', ')}, ${mb(await directorySize(packsDir))})`,
  );
}

await main();
