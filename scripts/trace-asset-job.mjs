// Preloaded only in asset-generator processes. Record actual file/directory dependencies,
// including dynamically imported recipes; child Node processes inherit the same trace directory.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { dependencyPath, snapshotDependency } from './asset-job-cache.mjs';

const root = process.env.MOLEN_ASSET_TRACE_ROOT;
const directory = process.env.MOLEN_ASSET_TRACE_DIRECTORY;
if (root && directory) {
  const dependencies = new Map(),
    writes = new Set();
  const write = fs.writeFileSync;
  let recording = false;
  const note = (kind, value) => {
    if (recording) return;
    const path = dependencyPath(root, value);
    if (!path) return;
    const key = `${kind}:${path}`;
    if (!dependencies.has(key)) {
      recording = true;
      try {
        dependencies.set(key, { kind, path, value: snapshotDependency(root, { kind, path }) });
      } finally {
        recording = false;
      }
    }
  };
  const written = (value) => {
    if (recording) return;
    const path = dependencyPath(root, value);
    if (path) writes.add(path);
  };
  for (const [name, kind] of [
    ['readFile', 'file'],
    ['readdir', 'directory'],
    ['stat', 'exists'],
    ['lstat', 'exists'],
    ['access', 'exists'],
  ]) {
    const original = fs[name],
      sync = fs[`${name}Sync`],
      promise = promises[name];
    fs[name] = function (path, ...args) {
      note(kind, path);
      return original.call(this, path, ...args);
    };
    fs[`${name}Sync`] = function (path, ...args) {
      note(kind, path);
      return sync.call(this, path, ...args);
    };
    promises[name] = function (path, ...args) {
      note(kind, path);
      return promise.call(this, path, ...args);
    };
  }
  const exists = fs.existsSync;
  fs.existsSync = function (path) {
    note('exists', path);
    return exists.call(this, path);
  };
  for (const name of ['writeFile', 'appendFile', 'mkdir', 'copyFile', 'rename']) {
    const destination = ['copyFile', 'rename'].includes(name) ? 1 : 0;
    const original = fs[name],
      sync = fs[`${name}Sync`],
      promise = promises[name];
    fs[name] = function (...args) {
      written(args[destination]);
      return original.apply(this, args);
    };
    fs[`${name}Sync`] = function (...args) {
      written(args[destination]);
      return sync.apply(this, args);
    };
    promises[name] = function (...args) {
      written(args[destination]);
      return promise.apply(this, args);
    };
    if (name === 'copyFile') {
      const callbackCopy = fs[name],
        syncCopy = fs[`${name}Sync`],
        promiseCopy = promises[name];
      fs[name] = function (...args) {
        note('file', args[0]);
        return callbackCopy.apply(this, args);
      };
      fs[`${name}Sync`] = function (...args) {
        note('file', args[0]);
        return syncCopy.apply(this, args);
      };
      promises[name] = function (...args) {
        note('file', args[0]);
        return promiseCopy.apply(this, args);
      };
    }
  }
  const opened = (path, flags = 'r') => {
    const writable =
      typeof flags === 'number'
        ? (flags &
            (fs.constants.O_WRONLY |
              fs.constants.O_RDWR |
              fs.constants.O_CREAT |
              fs.constants.O_TRUNC |
              fs.constants.O_APPEND)) !==
          0
        : /[wa+]/.test(flags);
    if (writable) written(path);
    if (!writable || (typeof flags === 'string' && flags.includes('+'))) note('file', path);
  };
  for (const [object, name] of [
    [fs, 'open'],
    [fs, 'openSync'],
    [promises, 'open'],
  ]) {
    const original = object[name];
    object[name] = function (path, flags, ...args) {
      opened(path, flags);
      return original.call(this, path, flags, ...args);
    };
  }
  for (const [name, flags] of [
    ['createReadStream', 'r'],
    ['createWriteStream', 'w'],
  ]) {
    const original = fs[name];
    fs[name] = function (path, options) {
      opened(path, options?.flags ?? flags);
      return original.call(this, path, options);
    };
  }
  syncBuiltinESMExports();
  registerHooks({
    load(url, context, nextLoad) {
      if (url.startsWith('file:')) note('file', new URL(url));
      return nextLoad(url, context);
    },
  });
  process.on('exit', (code) => {
    if (code === 0)
      write(
        // Windows can reuse a PID before a large batch's trace directory is collected.
        join(directory, `${process.pid}-${randomUUID()}.json`),
        JSON.stringify({ dependencies: [...dependencies.values()], writes: [...writes] }),
      );
  });
}
