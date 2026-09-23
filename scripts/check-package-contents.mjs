#!/usr/bin/env node
// npm packages carry code, schemas and types; content (models, textures, catalogs, star tables)
// ships as content packs built from content/. This gate keeps it that way.
//
// Run by the root `lint` script against the package sources (and their dist, when built), and by
// the release's packRelease against the real tarballs, so a content file cannot reach npm by
// either route. Each rule names what it caught and where content belongs instead.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** File types that are content, not code. */
export const CONTENT_EXTENSIONS = new Set([
  '.glb',
  '.gltf',
  '.ktx2',
  '.bin',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.hdr',
  '.exr',
  '.zip',
  '.pmtiles',
  '.mp3',
  '.ogg',
  '.wav',
  '.mp4',
]);

/** Directory names that hold content; none may be published. */
const CONTENT_DIRECTORIES = new Set(['assets', 'packs', 'source', 'content']);

/**
 * A built JavaScript file above this is almost certainly carrying data: the star table that
 * started this rule was 306 KB of one chunk. The largest code chunk today is about 255 KB.
 */
export const MAX_CHUNK_BYTES = 384 * 1024;

/** A bundled JSON file above this is content, whatever its name. */
const MAX_JSON_IMPORT_BYTES = 32 * 1024;

/** Exceptions, each with the reason it is not content. Paths are relative to the repository. */
const ALLOWED = {
  chunk: {
    // Prebuilt pages the headless capture ops load into Chromium; they bundle three.js.
    'packages/tooling/dist/capture/': 'self-contained capture pages bundling three.js',
  },
  host: {
    'packages/schema/src/registry.ts': 'JSON Schema $id namespace; it names schemas, never fetched',
  },
};

const allowed = (table, path) => Object.keys(table).some((prefix) => path.startsWith(prefix));

/** Problems with one packed file, given its path inside the package and its size. */
export function checkPackedFile(path, size) {
  const problems = [];
  const segments = path.split('/');
  if (segments.some((segment) => CONTENT_DIRECTORIES.has(segment))) {
    problems.push(`${path}: a content directory; content ships in content packs`);
  }
  if (CONTENT_EXTENSIONS.has(extname(path).toLowerCase())) {
    problems.push(`${path}: a content file (${extname(path)}); content ships in content packs`);
  }
  if (/\.(m?js|cjs)$/.test(path) && size > MAX_CHUNK_BYTES) {
    problems.push(
      `${path}: ${Math.round(size / 1024)} KB of JavaScript (limit ${MAX_CHUNK_BYTES / 1024} KB); data compiled into code belongs in a content pack`,
    );
  }
  return problems;
}

/** Problems with a package's `files` list. */
export function checkFilesField(files = []) {
  return files
    .filter((entry) =>
      entry
        .replace(/^\.\//, '')
        .split('/')
        .some((segment) => CONTENT_DIRECTORIES.has(segment)),
    )
    .map((entry) => `"files" publishes ${entry}; content ships in content packs`);
}

const HOST_RE = /molen\.dev(?!\/(?:guide|schemas)\/)/;

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+\.json)['"]/gm;

/** Problems with one source file: JSON reached outside the package, or large, and host names. */
export function checkSourceFile(file, packageDir, text) {
  const problems = [];
  const where = relative(ROOT, file).split(sep).join('/');
  for (const match of text.matchAll(IMPORT_RE)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(packageDir + sep)) {
      problems.push(`${where}: imports ${specifier}, outside the package; load it as content`);
    } else if (existsSync(target) && statSync(target).size > MAX_JSON_IMPORT_BYTES) {
      problems.push(`${where}: bundles ${specifier}; data this size belongs in a content pack`);
    }
  }
  if (!allowed(ALLOWED.host, where)) {
    // Links to the guides and schema ids are documentation; anything else picks a host.
    const hit = text.split('\n').findIndex((line) => HOST_RE.test(line));
    if (hit >= 0) {
      problems.push(
        `${where}:${hit + 1}: names molen.dev; library code never picks a content host, the app does`,
      );
    }
  }
  return problems;
}

/** Files under `dir` (or `dir` itself when it is a file), skipping what npm never packs. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === 'node_modules') return [];
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Every problem across the publishable packages, from their sources and any built output. */
export function checkWorkspace(root = ROOT) {
  const problems = [];
  const packagesDir = join(root, 'packages');
  for (const name of readdirSync(packagesDir).sort()) {
    const dir = join(packagesDir, name);
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.private === true) continue;
    const label = manifest.name ?? name;
    problems.push(...checkFilesField(manifest.files).map((p) => `${label}: ${p}`));
    for (const file of walk(join(dir, 'src'))) {
      if (!/\.(m?[jt]sx?)$/.test(file)) continue;
      problems.push(...checkSourceFile(file, dir, readFileSync(file, 'utf8')));
    }
    // Built output, when present (lint can run before a build; the release checks tarballs).
    for (const entry of manifest.files ?? []) {
      for (const file of walk(join(dir, entry))) {
        const where = relative(root, file).split(sep).join('/');
        if (allowed(ALLOWED.chunk, where)) continue;
        const inPackage = relative(dir, file).split(sep).join('/');
        problems.push(
          ...checkPackedFile(inPackage, statSync(file).size).map((p) => `${label}: ${p}`),
        );
      }
    }
  }
  return problems;
}

/** The files in an npm tarball (`.tgz`), as `{ path, size }`; a plain ustar reader. */
export function tarballEntries(archive) {
  return tarballFiles(archive).map(({ path, size }) => ({ path, size }));
}

/** The files in an npm tarball (`.tgz`) with their bytes, as `{ path, size, data }`. */
export function tarballFiles(archive) {
  const tar = gunzipSync(readFileSync(archive));
  const entries = [];
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const prefix = text(345, 155);
    const name = prefix ? `${prefix}/${text(0, 100)}` : text(0, 100);
    const size = Number.parseInt(text(124, 12).trim() || '0', 8);
    if (text(156, 1) === '0' || text(156, 1) === '') {
      entries.push({ path: name, size, data: tar.subarray(offset + 512, offset + 512 + size) });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/** Problems in a packed tarball's entries (`tarballEntries`), for the package in `packageDir`. */
export function checkTarballEntries(label, entries, packageDir) {
  const where = relative(ROOT, packageDir).split(sep).join('/');
  return entries
    .map(({ path, size }) => ({ path: path.replace(/^package\//, ''), size }))
    .filter(({ path }) => !allowed(ALLOWED.chunk, `${where}/${path}`))
    .flatMap(({ path, size }) => checkPackedFile(path, size).map((p) => `${label}: ${p}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkWorkspace();
  if (problems.length > 0) {
    console.error('check-package-contents: npm packages would ship content.\n');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nMove content under content/<pack>/ and load it as a content pack.');
    process.exit(1);
  }
  console.log('check-package-contents: no content in any publishable package.');
}
