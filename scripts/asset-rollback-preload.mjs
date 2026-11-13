// Preloaded into every Node process an asset build starts, and every process they start. Before
// the process first changes a committed text file, keep the original in the build's rollback
// journal (scripts/asset-rollback.mjs). Load it before the job tracer, so the tracer never sees
// the journal's own copies.
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { createBackup } from './asset-rollback.mjs';

const options = process.env.MOLEN_ASSET_ROLLBACK;
if (options) {
  const backup = createBackup(JSON.parse(options));
  for (const [name, destination] of [
    ['writeFile', 0],
    ['appendFile', 0],
    ['truncate', 0],
    ['copyFile', 1],
    ['rename', 1],
  ]) {
    const callback = fs[name],
      sync = fs[`${name}Sync`],
      promise = promises[name];
    fs[name] = function (...args) {
      backup(args[destination]);
      return callback.apply(this, args);
    };
    fs[`${name}Sync`] = function (...args) {
      backup(args[destination]);
      return sync.apply(this, args);
    };
    promises[name] = function (...args) {
      backup(args[destination]);
      return promise.apply(this, args);
    };
  }
  const writable = (flags) =>
    typeof flags === 'number'
      ? (flags &
          (fs.constants.O_WRONLY |
            fs.constants.O_RDWR |
            fs.constants.O_CREAT |
            fs.constants.O_TRUNC |
            fs.constants.O_APPEND)) !==
        0
      : /[wa+]/.test(flags);
  for (const [object, name] of [
    [fs, 'open'],
    [fs, 'openSync'],
    [promises, 'open'],
  ]) {
    const original = object[name];
    object[name] = function (path, flags, ...args) {
      // fs.open(path, callback) omits the flags.
      if (typeof flags !== 'function' && writable(flags ?? 'r')) backup(path);
      return original.call(this, path, flags, ...args);
    };
  }
  const createWriteStream = fs.createWriteStream;
  fs.createWriteStream = function (path, options) {
    if (writable((typeof options === 'object' && options?.flags) || 'w')) backup(path);
    return createWriteStream.call(this, path, options);
  };
  syncBuiltinESMExports();
}
