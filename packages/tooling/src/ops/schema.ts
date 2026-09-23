import {
  type ComponentRegistry,
  type ComponentSummary,
  componentNames,
  createComponentRegistry,
  getComponent,
  getSchema,
  listComponents,
  listSchemas,
  type SchemaSummary,
  schemaKinds,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { findProjectFile, loadProject, loadSceneDocument } from '../project';

export interface GetSchemaOutput {
  ok: boolean;
  id?: string;
  docsRef?: string;
  examples?: unknown[];
  jsonSchema?: unknown;
  error?: string;
}

/** List every registered asset schema kind. */
export function listSchemasOp(): SchemaSummary[] {
  return listSchemas();
}

/** Get one schema kind: JSON Schema + examples + docs reference. */
export function getSchemaOp(kind: string): GetSchemaOutput {
  const entry = getSchema(kind);
  if (entry === undefined) {
    return { ok: false, error: `unknown kind "${kind}". known: ${schemaKinds().join(', ')}` };
  }
  return {
    ok: true,
    id: entry.meta.id,
    docsRef: entry.meta.docsRef,
    examples: entry.meta.examples,
    jsonSchema: z.toJSONSchema(entry.zod, { io: 'input' }),
  };
}

/** List the known component vocabulary (name + description + owning layer). */
export function listComponentsOp(registry?: ComponentRegistry): ComponentSummary[] {
  return listComponents(registry);
}

export interface GetComponentOutput {
  ok: boolean;
  name?: string;
  description?: string;
  owner?: string;
  docsRef?: string;
  examples?: unknown[];
  jsonSchema?: unknown;
  error?: string;
}

/** Get one component's schema + examples. */
export function getComponentOp(name: string, registry?: ComponentRegistry): GetComponentOutput {
  const entry = getComponent(name, registry);
  if (entry === undefined) {
    return {
      ok: false,
      error: `unknown component "${name}". known: ${componentNames(registry).join(', ')}`,
    };
  }
  return {
    ok: true,
    name: entry.name,
    description: entry.meta.description,
    owner: entry.meta.owner,
    docsRef: entry.meta.docsRef,
    examples: entry.meta.examples,
    jsonSchema: z.toJSONSchema(entry.zod, { io: 'input' }),
  };
}

/** Resolve a request's vocabulary without changing package-global registrations. */
export async function loadComponentRegistry(
  input: { projectPath?: string; scenePath?: string } = {},
): Promise<ComponentRegistry | undefined> {
  if (input.scenePath !== undefined) {
    const loaded = await loadSceneDocument(input.scenePath, { projectPath: input.projectPath });
    return createComponentRegistry(loaded.manifest.components, {
      base: loaded.project?.componentRegistry,
      owner: 'scene',
    }).registry;
  }
  const path = input.projectPath ?? (await findProjectFile(process.cwd()));
  return path !== undefined ? (await loadProject(path)).componentRegistry : undefined;
}
