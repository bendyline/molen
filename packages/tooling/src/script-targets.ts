import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  type ComponentRegistry,
  createComponentRegistry,
  getComponent,
  listComponents,
  type SceneManifest,
  validate,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { parseJson } from './ops/parse';
import type { ProjectContext } from './project';
import {
  renderScriptsTsconfig,
  renderScriptTypes,
  type ScriptCommandType,
  type ScriptConfigEntry,
  type ScriptTypesInput,
} from './script-types';

// Scene-data and type-owned scripts live next to the document that declares them, so the ambient
// types are generated per directory: every script in one directory shares one `molen`/`config`
// declaration. Scripts authored inline as `code` have no file to check and are skipped.

export const SCRIPT_TYPES_FILENAME = 'molen-scripts.d.ts';
export const SCRIPT_TSCONFIG_FILENAME = 'tsconfig.json';

export interface ScriptTypesTarget {
  /** Absolute path of the scripts directory. */
  dir: string;
  /** Project-relative directory, for messages. */
  label: string;
  dtsPath: string;
  tsconfigPath: string;
  /** Absolute paths of the scripts checked here. */
  scriptFiles: string[];
  dts: string;
  tsconfig: string;
}

interface Accumulator {
  scenes: string[];
  entityIds: Set<string>;
  prefabs: Set<string>;
  commands: Map<string, ScriptCommandType>;
  configs: ScriptConfigEntry[];
  capabilities: Set<string>;
  scriptFiles: Set<string>;
  registry: ComponentRegistry;
}

/** Load a scene keeping `scripts[].path` intact (the tooling loader inlines and drops it). */
async function loadSceneKeepingPaths(
  project: ProjectContext,
  scenePath: string,
): Promise<SceneManifest> {
  const raw = parseJson(await readFile(scenePath, 'utf8'));
  const parsed = validate('scene', raw, {
    registry: project.componentRegistry,
    types: project.resolvedTypes,
  });
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value;
}

/** Capability namespaces the CLI installs for a scene (see prepareSceneBuilder). */
function capabilitiesFor(manifest: SceneManifest): string[] {
  const caps = ['figures'];
  if (manifest.physics?.engine === 'rapier') caps.push('physics');
  if (manifest.terrain !== undefined) caps.push('terrain');
  return caps;
}

function componentsFor(registry: ComponentRegistry): ScriptTypesInput['components'] {
  return listComponents(registry).map((summary) => {
    const entry = getComponent(summary.name, registry);
    return {
      name: summary.name,
      description: summary.description,
      schema: entry === undefined ? {} : z.toJSONSchema(entry.zod, { io: 'input' }),
    };
  });
}

/**
 * Group every file-backed script in the project's scenes by directory and render the ambient
 * declarations for each. Deterministic: directories and their contents are sorted.
 */
export async function collectScriptTypesTargets(
  project: ProjectContext,
): Promise<ScriptTypesTarget[]> {
  const byDir = new Map<string, Accumulator>();

  const accumulatorFor = (dir: string, registry: ComponentRegistry): Accumulator => {
    let acc = byDir.get(dir);
    if (acc === undefined) {
      acc = {
        scenes: [],
        entityIds: new Set(),
        prefabs: new Set(),
        commands: new Map(),
        configs: [],
        capabilities: new Set(),
        scriptFiles: new Set(),
        registry,
      };
      byDir.set(dir, acc);
    }
    return acc;
  };

  for (const script of project.typeScriptFiles) {
    const dir = dirname(script.file);
    const acc = accumulatorFor(dir, project.componentRegistry);
    if (!acc.scenes.includes(script.declaration)) acc.scenes.push(script.declaration);
    acc.scriptFiles.add(script.file);
    acc.configs.push({
      scriptId: `${script.typeId}:${script.scriptId}`,
      config: { ...script.config, type: script.typeId },
    });
  }

  for (const sceneName of Object.keys(project.manifest.scenes).sort()) {
    const scenePath = project.resolveScenePath(sceneName);
    const manifest = await loadSceneKeepingPaths(project, scenePath);
    const sceneDir = dirname(scenePath);
    const sceneFile = relative(project.dir, scenePath);
    // Scene-declared custom components join the vocabulary the same way validation composes it.
    const registry = createComponentRegistry(manifest.components, {
      base: project.componentRegistry,
      owner: 'scene',
    }).registry;

    for (const script of manifest.scripts) {
      if (script.path === undefined) continue;
      const file = resolve(sceneDir, script.path);
      const dir = dirname(file);
      const acc = accumulatorFor(dir, registry);
      if (!acc.scenes.includes(sceneFile)) acc.scenes.push(sceneFile);
      acc.scriptFiles.add(file);
      acc.configs.push({ scriptId: script.id, config: script.config ?? {} });
      for (const entity of manifest.entities) {
        if (entity.id !== undefined) acc.entityIds.add(entity.id);
      }
      for (const name of Object.keys(manifest.prefabs)) acc.prefabs.add(name);
      for (const [name, def] of Object.entries(manifest.commands)) {
        const existing = acc.commands.get(name);
        const next: ScriptCommandType = {
          name,
          ...(def.doc !== undefined ? { doc: def.doc } : {}),
          ...(def.payload !== undefined ? { payload: def.payload } : {}),
        };
        // Two scenes sharing a scripts directory may declare the same command differently; the
        // payload a handler can rely on is then only what both accept.
        acc.commands.set(
          name,
          existing !== undefined && JSON.stringify(existing) !== JSON.stringify(next)
            ? { name }
            : next,
        );
      }
      for (const cap of capabilitiesFor(manifest)) acc.capabilities.add(cap);
    }
  }

  const targets: ScriptTypesTarget[] = [];
  for (const dir of [...byDir.keys()].sort()) {
    const acc = byDir.get(dir) as Accumulator;
    const input: ScriptTypesInput = {
      scenes: acc.scenes,
      components: componentsFor(acc.registry),
      entityIds: [...acc.entityIds].sort(),
      prefabs: [...acc.prefabs].sort(),
      typeIds: [...project.resolvedTypes.keys()].sort(),
      commands: [...acc.commands.values()].sort((a, b) => (a.name < b.name ? -1 : 1)),
      configs: acc.configs.sort((a, b) => (a.scriptId < b.scriptId ? -1 : 1)),
      capabilities: [...acc.capabilities].sort(),
    };
    targets.push({
      dir,
      label: relative(project.dir, dir) || '.',
      dtsPath: join(dir, SCRIPT_TYPES_FILENAME),
      tsconfigPath: join(dir, SCRIPT_TSCONFIG_FILENAME),
      scriptFiles: [...acc.scriptFiles].sort(),
      dts: renderScriptTypes(input),
      tsconfig: renderScriptsTsconfig(),
    });
  }
  return targets;
}
