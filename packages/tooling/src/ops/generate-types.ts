import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getComponent, listComponents } from '@bendyline/molen-schema';
import { z } from 'zod';
import { findProjectFile, loadProject, type ProjectContext } from '../project';
import { schemaToTsType } from '../schema-to-ts';
import { collectScriptTypesTargets, type ScriptTypesTarget } from '../script-targets';

export interface GenerateTypesInput {
  projectPath?: string;
  cwd?: string;
  /** Override the output path (default: project.codegen.out). */
  out?: string;
  /** Compare only — exit stale without writing (CI / types check). */
  check?: boolean;
}

/** One generated artifact beside a scripts directory (the ambient types, or its jsconfig). */
export interface GeneratedScriptArtifact {
  path: string;
  written: boolean;
  stale: boolean;
}

export interface GenerateTypesOutput {
  ok: boolean;
  outPath?: string;
  /** Ambient script types written (or checked) beside each scripts directory. */
  scriptArtifacts?: GeneratedScriptArtifact[];
  /** True when --check found the committed file out of date (or missing). */
  stale?: boolean;
  written?: boolean;
  componentCount?: number;
  typeCount?: number;
  error?: string;
}

function pascal(segment: string): string {
  return segment
    .split(/[^A-Za-z0-9_$]+/)
    .filter((part) => part.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function identifier(value: string, fallback: string): string {
  const candidate = pascal(value).replace(/[^A-Za-z0-9_$]/g, '_');
  if (candidate.length === 0) return fallback;
  return /^[A-Za-z_$]/.test(candidate) ? candidate : `${fallback}${candidate}`;
}

function uniqueIdentifier(
  value: string,
  fallback: string,
  used: Map<string, string>,
  owner = value,
): string {
  const base = identifier(value, fallback);
  const previousOwner = used.get(base);
  if (previousOwner === undefined || previousOwner === owner) {
    used.set(base, owner);
    return base;
  }
  const suffix = createHash('sha256').update(owner).digest('hex').slice(0, 8);
  const unique = `${base}_${suffix}`;
  used.set(unique, owner);
  return unique;
}

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** Render the generated module (deterministic given the registry + project types). */
export function renderTypesModule(project: ProjectContext): string {
  const components = listComponents(project.componentRegistry);
  const ifaceLines: string[] = [];
  const handleLines: string[] = [];
  const usedInterfaces = new Map<string, string>();
  for (const c of components) {
    const entry = getComponent(c.name, project.componentRegistry);
    if (entry === undefined) continue;
    const iface = `${uniqueIdentifier(c.name, 'Component', usedInterfaces)}Data`;
    const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
    const body = schemaToTsType(jsonSchema);
    ifaceLines.push(`/** ${c.description} */`);
    // A schema that starts with an object may still be a top-level union (`{...} | {...}`),
    // which cannot extend an interface declaration. Type aliases handle every schema shape.
    ifaceLines.push(`export type ${iface} = ${body};`);
    handleLines.push(
      `  ${quote(c.name)}: defineComponent<JsonObject & ${iface}>(${quote(c.name)}),`,
    );
  }

  const typeIds = [...project.resolvedTypes.keys()].sort();
  const usedNames = new Map<string, string>();
  const typeLines: string[] = [];
  const defLines: string[] = [];
  for (const id of typeIds) {
    const lastSegment = id.split('.').at(-1) as string;
    const constName = uniqueIdentifier(lastSegment, 'Type', usedNames, id);
    typeLines.push(`  ${constName}: ${quote(id)},`);
    const def = project.typesDocs
      .flatMap((d) => Object.entries(d.doc.types))
      .find(([tid]) => tid === id)?.[1];
    const doc = def?.doc !== undefined ? `doc: ${quote(def.doc)}` : undefined;
    const ext = def?.extends !== undefined ? `extends: ${quote(def.extends)}` : undefined;
    defLines.push(`  ${quote(id)}: { ${[doc, ext].filter(Boolean).join(', ')} },`);
  }

  const body = [
    `import { defineComponent, type JsonObject } from '@bendyline/molen-kernel';`,
    '',
    ifaceLines.join('\n'),
    '',
    '/** Typed handles for every registered component. */',
    `export const C = {`,
    handleLines.join('\n'),
    `} as const;`,
    '',
    components.length === 0
      ? 'export type ComponentName = never;'
      : `export type ComponentName =\n${components.map((c) => `  | ${quote(c.name)}`).join('\n')};`,
    '',
    '/** Registry type ids declared by this project. */',
    `export const T = {`,
    typeLines.join('\n'),
    `} as const;`,
    '',
    `export type EntityTypeId = (typeof T)[keyof typeof T];`,
    '',
    `export const TYPE_DEFS: Readonly<Record<string, { doc?: string; extends?: string }>> = {`,
    defLines.join('\n'),
    `};`,
    '',
  ].join('\n');

  const hash = createHash('sha256').update(body).digest('hex');
  return [
    `// AUTO-GENERATED by \`molen types gen\` — do not edit. inputs-hash: sha256:${hash}`,
    `// Regenerate after editing types/*.json; \`molen types check\` flags staleness.`,
    `/** biome-ignore-all format: generated file (stable output beats house wrapping) */`,
    body,
  ].join('\n');
}

async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** Script artifacts are opt-in like codegen: absent is "not adopted", different is stale. */
async function checkScriptArtifacts(
  targets: ScriptTypesTarget[],
): Promise<GeneratedScriptArtifact[]> {
  const out: GeneratedScriptArtifact[] = [];
  for (const target of targets) {
    for (const [path, content] of [
      [target.dtsPath, target.dts],
      [target.tsconfigPath, target.tsconfig],
    ] as const) {
      const existing = await readIfPresent(path);
      out.push({ path, written: false, stale: existing !== undefined && existing !== content });
    }
  }
  return out;
}

async function writeScriptArtifacts(
  targets: ScriptTypesTarget[],
): Promise<GeneratedScriptArtifact[]> {
  const out: GeneratedScriptArtifact[] = [];
  for (const target of targets) {
    for (const [path, content] of [
      [target.dtsPath, target.dts],
      [target.tsconfigPath, target.tsconfig],
    ] as const) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
      out.push({ path, written: true, stale: false });
    }
  }
  return out;
}

/** Generate (or verify with `check`) the project's typed component/type-id module. */
export async function generateTypes(input: GenerateTypesInput): Promise<GenerateTypesOutput> {
  try {
    const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
    if (projectPath === undefined) {
      return {
        ok: false,
        error: 'no project.json found (pass projectPath or run inside a project)',
      };
    }
    const project = await loadProject(projectPath);
    const outPath = join(project.dir, input.out ?? project.manifest.codegen.out);
    const content = renderTypesModule(project);
    // Ambient types for scene-data and registry-type scripts: the same vocabulary, checkable by tsc.
    const targets = await collectScriptTypesTargets(project);

    if (input.check === true) {
      let existing: string | undefined;
      try {
        existing = await readFile(outPath, 'utf8');
      } catch {
        existing = undefined;
      }
      // A missing file means codegen was never adopted (it is opt-in) — not staleness.
      const stale = existing !== undefined && existing !== content;
      const scriptArtifacts = await checkScriptArtifacts(targets);
      const staleScripts = scriptArtifacts.filter((a) => a.stale);
      const anyStale = stale || staleScripts.length > 0;
      return {
        ok: !anyStale,
        outPath,
        stale: anyStale,
        written: false,
        scriptArtifacts,
        componentCount: listComponents(project.componentRegistry).length,
        typeCount: project.resolvedTypes.size,
        ...(anyStale
          ? {
              error: `${[outPath, ...staleScripts.map((a) => a.path)]
                .filter((path) => path !== outPath || stale)
                .join(', ')} is stale — run: molen types gen`,
            }
          : {}),
      };
    }

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, content);
    const scriptArtifacts = await writeScriptArtifacts(targets);
    return {
      ok: true,
      outPath,
      stale: false,
      written: true,
      scriptArtifacts,
      componentCount: listComponents(project.componentRegistry).length,
      typeCount: project.resolvedTypes.size,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
