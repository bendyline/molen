// execFileSync and spawnSync for commands that are .cmd shims on Windows: npm, pnpm and the
// entries of node_modules/.bin. Node runs a .cmd only through cmd.exe (CVE-2024-27980), and
// `shell: true` joins arguments unquoted, so `three@>=0.184.0 <0.187.0` would become a redirect.
// On Windows this finds the file the command names, the way cmd.exe does, and runs a batch file
// through cmd.exe with every argument quoted and caret-escaped (the scheme cross-spawn uses). An
// .exe, and every command elsewhere, goes straight to Node.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, extname, join, resolve } from 'node:path';

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** The file cmd.exe runs for `command`, applying PATH and PATHEXT, or undefined. */
function which(command, cwd) {
  const extensions = extname(command)
    ? ['']
    : (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';');
  const candidates = /[\\/]/.test(command)
    ? [resolve(cwd ?? '.', command)]
    : (process.env.PATH ?? '')
        .split(delimiter)
        .filter(Boolean)
        .map((directory) => join(directory, command));
  for (const candidate of candidates) {
    for (const extension of extensions) {
      if (existsSync(candidate + extension)) return candidate + extension;
    }
  }
  return undefined;
}

/**
 * One argument quoted for the C runtime's argv parser, then caret-escaped twice: once for the
 * `cmd.exe /c` line, and again for the batch file's own line that expands `%*`.
 */
function quoteForBatch(arg) {
  const quoted = `"${String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, '$1$1')}"`;
  return quoted.replace(CMD_META, '^$1').replace(CMD_META, '^$1');
}

/** The file, arguments and options Node needs to run `command` on this platform. */
function invocation(command, args, options) {
  if (process.platform !== 'win32') return [command, args, options];
  const file = which(command, options.cwd);
  if (file === undefined || /\.(com|exe)$/i.test(file)) return [file ?? command, args, options];
  const line = [`"${file}"`, ...args.map(quoteForBatch)].join(' ');
  return [
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', `"${line}"`],
    { ...options, windowsVerbatimArguments: true },
  ];
}

/** `execFileSync(command, args, options)`, including a Windows .cmd shim. */
export function execCommand(command, args = [], options = {}) {
  return execFileSync(...invocation(command, args, options));
}

/** `spawnSync(command, args, options)`, including a Windows .cmd shim. */
export function spawnCommand(command, args = [], options = {}) {
  return spawnSync(...invocation(command, args, options));
}
