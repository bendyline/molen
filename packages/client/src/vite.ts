import { readFile } from 'node:fs/promises';
import * as nodeModule from 'node:module';

// Build-time helpers for hosts that author scene scripts in TypeScript. This module runs in
// Node (a Vite config, the tooling scene loader) — never in the browser bundle.
//
// Scene scripts are text: the kernel evaluates the string in `scripts[].code`, so a .ts file has
// to become JavaScript before it reaches the sandbox. Node's own type stripping does it by
// replacing type syntax with WHITESPACE, which is why molen uses it over a transpiler: the
// evaluated source keeps the line and column numbers of the file you wrote, so
// `script "dungeon" tick handler at tick 41: …` still points at the right line. The cost is that
// only erasable syntax works (no enums, namespaces, or parameter properties) — the tsconfig
// `molen types gen` writes sets `erasableSyntaxOnly`, so `molen scripts check` says so first.

interface TypeStripper {
  stripTypeScriptTypes?: (
    code: string,
    options?: { mode?: 'strip'; sourceMap?: boolean },
  ) => string;
}

/**
 * Node reports `stripTypeScriptTypes` as experimental on first use. The warning is about Node's
 * API, not about anything the user did, and it would print on every scene load — so it is
 * silenced narrowly (this exact warning, only around the call) rather than globally.
 */
function withoutExperimentalWarning<T>(fn: () => T): T {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]): void => {
    const name = warning instanceof Error ? warning.name : (rest[0] as string | undefined);
    const text = warning instanceof Error ? warning.message : warning;
    if (name === 'ExperimentalWarning' && text.includes('stripTypeScriptTypes')) return;
    (original as (w: string | Error, ...r: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return fn();
  } finally {
    process.emitWarning = original;
  }
}

/**
 * Erase the types from a TypeScript scene script, preserving every line and column. `filename`
 * is only used in error messages.
 */
export function stripScriptTypes(source: string, filename: string): string {
  const strip = (nodeModule as TypeStripper).stripTypeScriptTypes;
  if (strip === undefined) {
    throw new Error(
      `cannot load TypeScript scene script "${filename}": this Node (${process.version}) has no module.stripTypeScriptTypes — upgrade to Node 22.13+, or author the script as .js`,
    );
  }
  try {
    return withoutExperimentalWarning(() => strip(source, { mode: 'strip' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `cannot erase types from "${filename}": ${message} (scene scripts must use erasable syntax only — no enums, namespaces, or parameter properties)`,
    );
  }
}

/** The subset of Vite's plugin shape this uses; structural, so no dependency on vite. */
export interface MolenScriptsPlugin {
  name: string;
  enforce: 'pre';
  load(id: string): Promise<string | undefined>;
}

export interface MolenScriptsOptions {
  /** Restrict stripping to matching paths (default: any `.ts` imported with `?raw`). */
  include?: RegExp;
}

/**
 * Vite plugin: serve `*.ts?raw` imports as type-stripped JavaScript, so a browser host can glob
 * its scene scripts (`import.meta.glob('../scripts/*.ts', { query: '?raw' })`) and hand the
 * strings to `inlineScriptSources` exactly as it did with `.js`.
 */
export function molenScripts(options?: MolenScriptsOptions): MolenScriptsPlugin {
  return {
    name: 'molen:scene-scripts',
    // Ahead of Vite's own `?raw` handling, which would return the untransformed TypeScript.
    enforce: 'pre',
    async load(id: string): Promise<string | undefined> {
      const [file, query] = id.split('?');
      if (file === undefined || query === undefined) return undefined;
      if (!query.split('&').includes('raw') || !file.endsWith('.ts')) return undefined;
      if (options?.include !== undefined && !options.include.test(file)) return undefined;
      const source = await readFile(file, 'utf8');
      return `export default ${JSON.stringify(stripScriptTypes(source, file))};`;
    },
  };
}
