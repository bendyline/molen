import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { findProjectFile, loadProject } from '../project';
import { collectScriptTypesTargets, type ScriptTypesTarget } from '../script-targets';

// Typecheck the scene-data scripts against their generated ambient declarations. The scripts stay
// plain JavaScript (they are text inside scene.json); `checkJs` + the generated d.ts turn a
// component typo, a bad command payload, or an unguarded `get` into an error before the first
// tick — the same place an agent already looks, rather than a runtime throw 40 ticks in.

export interface CheckScriptsInput {
  projectPath?: string;
  cwd?: string;
}

export interface ScriptDiagnostic {
  /** Project-relative script path. */
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

export interface CheckScriptsOutput {
  ok: boolean;
  error?: string;
  /** Number of script files checked. */
  checked?: number;
  diagnostics?: ScriptDiagnostic[];
  /** Generated artifacts that no longer match the scenes (regenerate before trusting a check). */
  stale?: string[];
  /** Directories whose declarations were never generated. */
  ungenerated?: string[];
}

interface TypeScriptModule {
  readConfigFile(path: string, read: (p: string) => string | undefined): { config?: unknown };
  parseJsonConfigFileContent(
    json: unknown,
    host: unknown,
    basePath: string,
  ): { fileNames: string[]; options: Record<string, unknown> };
  sys: unknown;
  createProgram(fileNames: string[], options: Record<string, unknown>): unknown;
  getPreEmitDiagnostics(program: unknown): readonly TsDiagnostic[];
  flattenDiagnosticMessageText(text: unknown, newLine: string): string;
}

interface TsDiagnostic {
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
  };
  start?: number;
  code: number;
  messageText: unknown;
}

/**
 * Resolve the project's own TypeScript. A molen project scaffolds one (`molen new` writes a
 * tsconfig and the devDependency); resolving from the project keeps the check on the same
 * compiler the editor and `pnpm typecheck` use.
 */
async function loadTypeScript(projectDir: string): Promise<TypeScriptModule | undefined> {
  for (const from of [
    join(projectDir, 'noop.js'),
    join(process.cwd(), 'noop.js'),
    import.meta.url,
  ]) {
    try {
      const require = createRequire(from);
      return require('typescript') as TypeScriptModule;
    } catch {
      // try the next resolution root
    }
  }
  return undefined;
}

/**
 * `typescript` is an OPTIONAL PEER DEPENDENCY of the tooling package: installed from npm, nothing
 * provides it until the project installs its own devDependencies (in this monorepo it only works
 * because TypeScript is hoisted). Name the directory that has to have it and the command to run.
 */
export function typescriptNotFoundError(projectDir: string): string {
  return [
    "typescript not found — molen scripts check compiles with the project's own TypeScript",
    `  install it in ${projectDir}:`,
    '    npm install                 # the scaffold lists typescript as a devDependency',
    '  or add it directly:',
    '    npm install -D typescript   # pnpm: pnpm add -D typescript',
  ].join('\n');
}

async function isCurrent(path: string, expected: string): Promise<'current' | 'stale' | 'absent'> {
  try {
    return (await readFile(path, 'utf8')) === expected ? 'current' : 'stale';
  } catch {
    return 'absent';
  }
}

function diagnosticsFor(
  ts: TypeScriptModule,
  target: ScriptTypesTarget,
  projectDir: string,
): ScriptDiagnostic[] {
  const { config } = ts.readConfigFile(target.tsconfigPath, (p) => {
    try {
      return (ts.sys as { readFile(p: string): string | undefined }).readFile(p);
    } catch {
      return undefined;
    }
  });
  const parsed = ts.parseJsonConfigFileContent(config ?? {}, ts.sys, target.dir);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const out: ScriptDiagnostic[] = [];
  for (const d of ts.getPreEmitDiagnostics(program)) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (d.file === undefined || d.start === undefined) {
      out.push({ file: target.label, line: 0, column: 0, code: `TS${d.code}`, message });
      continue;
    }
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    out.push({
      file: relative(projectDir, d.file.fileName),
      line: line + 1,
      column: character + 1,
      code: `TS${d.code}`,
      message,
    });
  }
  return out;
}

/** Typecheck every file-backed scene or registry-type script in the project. */
export async function checkScripts(input: CheckScriptsInput): Promise<CheckScriptsOutput> {
  try {
    const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
    if (projectPath === undefined) {
      return {
        ok: false,
        error: 'no project.json found (pass projectPath or run inside a project)',
      };
    }
    const project = await loadProject(projectPath);
    const targets = await collectScriptTypesTargets(project);
    if (targets.length === 0) {
      return { ok: true, checked: 0, diagnostics: [] };
    }

    const stale: string[] = [];
    const ungenerated: string[] = [];
    for (const target of targets) {
      for (const [path, content] of [
        [target.dtsPath, target.dts],
        [target.tsconfigPath, target.tsconfig],
      ] as const) {
        const state = await isCurrent(path, content);
        if (state === 'stale') stale.push(relative(project.dir, path));
        if (state === 'absent') ungenerated.push(relative(project.dir, path));
      }
    }
    // A stale or missing declaration makes every diagnostic suspect, so say so instead of
    // reporting errors against types the scene no longer describes.
    if (stale.length > 0 || ungenerated.length > 0) {
      return {
        ok: false,
        stale,
        ungenerated,
        error: `script declarations are ${stale.length > 0 ? 'stale' : 'missing'} — run: molen types gen`,
      };
    }

    const ts = await loadTypeScript(project.dir);
    if (ts === undefined) return { ok: false, error: typescriptNotFoundError(project.dir) };

    const diagnostics: ScriptDiagnostic[] = [];
    let checked = 0;
    for (const target of targets) {
      checked += target.scriptFiles.length;
      diagnostics.push(...diagnosticsFor(ts, target, project.dir));
    }
    return { ok: diagnostics.length === 0, checked, diagnostics };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
