/**
 * Resolve a style pack from its manifest plus the documents it references, and cross-check the
 * bundle (dangling ids, material kinds, model sources). Pure over already-fetched JSON so the
 * same code runs in Node, a Worker, and the browser.
 */

import '@bendyline/molen-materials';
import { hashJson } from '@bendyline/molen-kernel/determinism';
import {
  type AssetSidecar,
  detectKind,
  formatIssues,
  getSchema,
  type JsonValue,
  namespaceCovers,
  nearest,
  type ValidationIssue,
  validateByKind,
} from '@bendyline/molen-schema';
import type { ArchStyleDoc } from './archstyle-types';
import { anyClassMatches } from './classes';
import type { InteriorCatalogDoc } from './interior-types';
import type { ScatterDoc } from './scatter-types';
import { registerWorldgenSchemas } from './schema';
import { isUrlishRef, parseMaterialRef } from './schema-common';
import type { PackIdentity } from './seed';
import type { StylePackDoc } from './stylepack-types';

export type StylePackDocumentReader = (relativePath: string) => Promise<unknown>;

export interface ResolvedStylePack {
  id: string;
  version: string;
  /** Content hash over every document; part of cache keys. */
  hash: string;
  root: StylePackDoc;
  archstyles: Readonly<Record<string, ArchStyleDoc>>;
  scatters: Readonly<Record<string, ScatterDoc>>;
  /** Material id to document kind. */
  materials: Readonly<Record<string, 'matgraph' | 'pixelgrid'>>;
  /** Asset id to pack-relative sidecar path. */
  assets: Readonly<Record<string, string>>;
  /** Layouts for enterable buildings; undefined when the pack has none. */
  interiors?: InteriorCatalogDoc;
  warnings: string[];
}

export function packIdentity(pack: ResolvedStylePack): PackIdentity {
  return { name: pack.root.name, version: pack.root.version };
}

function failed(label: string, issues: ValidationIssue[]): Error {
  return new Error(formatIssues(label, issues));
}

/**
 * Reads in flight at once. A pack references ~170 small documents, and over a network each read
 * is a round trip, so reading them one at a time dominated pack load time.
 */
const READ_CONCURRENCY = 16;

type ReadResult = { ok: true; doc: unknown } | { ok: false; error: unknown };

/** Read every path with bounded concurrency; failures are kept per path, not thrown here. */
async function readAll(
  readDoc: StylePackDocumentReader,
  paths: readonly string[],
): Promise<Map<string, ReadResult>> {
  const queue = [...new Set(paths)];
  const results = new Map<string, ReadResult>();
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < queue.length) {
      const path = queue[next++] as string;
      try {
        results.set(path, { ok: true, doc: await readDoc(path) });
      } catch (error) {
        results.set(path, { ok: false, error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, queue.length) }, worker));
  return results;
}

function validated<T>(doc: unknown, path: string, kind: string, label: string): T {
  const parsed = validateByKind(kind as never, doc);
  if (!parsed.ok) throw new Error(`${label} (${path}):\n${parsed.formatted}`);
  return parsed.value as T;
}

/** Load and validate every document a manifest references; throws on any blocking issue. */
export async function resolveStylePackDocuments(
  rootDoc: unknown,
  readDoc: StylePackDocumentReader,
): Promise<ResolvedStylePack> {
  registerWorldgenSchemas();
  const parsedRoot = validateByKind('stylepack' as never, rootDoc);
  if (!parsedRoot.ok) throw new Error(parsedRoot.formatted);
  const root = parsedRoot.value as StylePackDoc;
  // Read everything up front, then validate in manifest order, so the result, its hash and the
  // first error reported are the same as reading one document at a time.
  const reads = await readAll(readDoc, [
    ...Object.values(root.styles),
    ...Object.values(root.scatter),
    ...Object.values(root.materials),
    ...Object.values(root.assets),
    ...(root.interiors !== undefined ? [root.interiors] : []),
  ]);
  const read = (path: string): unknown => {
    const result = reads.get(path) as ReadResult;
    if (!result.ok) throw result.error;
    return result.doc;
  };
  const warnings: string[] = [];
  const archstyles: Record<string, ArchStyleDoc> = {};
  for (const [id, path] of Object.entries(root.styles)) {
    archstyles[id] = validated<ArchStyleDoc>(read(path), path, 'archstyle', `style "${id}"`);
  }
  const scatters: Record<string, ScatterDoc> = {};
  for (const [id, path] of Object.entries(root.scatter)) {
    scatters[id] = validated<ScatterDoc>(read(path), path, 'scatter', `scatter "${id}"`);
  }
  const materials: Record<string, 'matgraph' | 'pixelgrid'> = {};
  for (const [id, path] of Object.entries(root.materials)) {
    const doc = read(path);
    const kind = detectKind(doc);
    if (kind !== 'matgraph' && kind !== 'pixelgrid') {
      throw new Error(
        `material "${id}" (${path}) must be a molen/matgraph@1 or molen/pixelgrid@1 document`,
      );
    }
    if (getSchema(kind) !== undefined) {
      const parsed = validateByKind(kind as never, doc);
      if (!parsed.ok) throw new Error(`material "${id}" (${path}):\n${parsed.formatted}`);
    } else {
      warnings.push(`material "${id}" was not validated: ${kind} schema is not registered`);
    }
    materials[id] = kind;
  }
  const assets: Record<string, string> = {};
  for (const [id, path] of Object.entries(root.assets)) {
    const sidecar = validated<AssetSidecar>(read(path), path, 'asset', `asset "${id}"`);
    if (sidecar.id !== id) {
      throw new Error(`asset "${id}" (${path}) declares id "${sidecar.id}"`);
    }
    assets[id] = path;
  }
  const interiors =
    root.interiors === undefined
      ? undefined
      : validated<InteriorCatalogDoc>(
          read(root.interiors),
          root.interiors,
          'interior-catalog',
          'interior catalog',
        );
  const pack: ResolvedStylePack = {
    id: root.name,
    version: root.version,
    hash: hashJson({
      root,
      archstyles,
      scatters,
      materials,
      ...(interiors !== undefined ? { interiors } : {}),
    } as unknown as JsonValue),
    root,
    archstyles,
    scatters,
    materials,
    assets,
    ...(interiors !== undefined ? { interiors } : {}),
    warnings,
  };
  const issues = validateStylePackBundle(pack);
  const blocking = issues.filter((issue) => issue.severity !== 'notice');
  if (blocking.length > 0) throw failed(`style pack "${root.name}"`, blocking);
  for (const notice of issues.filter((issue) => issue.severity === 'notice')) {
    warnings.push(`${notice.path}: ${notice.message}`);
  }
  return pack;
}

function modelKnown(pack: ResolvedStylePack, model: string): boolean {
  if (model.startsWith('builtin:') || isUrlishRef(model)) return true;
  if (pack.assets[model] !== undefined) return true;
  return pack.root.imports.some((entry) => namespaceCovers(entry.namespace, model));
}

/** Cross-document checks over a resolved pack. */
export function validateStylePackBundle(pack: ResolvedStylePack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const styleIds = Object.keys(pack.archstyles);
  const scatterIds = Object.keys(pack.scatters);
  const materialIds = Object.keys(pack.materials);
  const usedStyles = new Set<string>();
  const usedScatters = new Set<string>();
  const usedMaterials = new Set<string>();
  const usedAssets = new Set<string>();
  for (const [id, doc] of Object.entries(pack.archstyles)) {
    if (doc.id !== id) {
      issues.push({
        path: `/styles/${id}`,
        code: 'id_mismatch',
        message: `style file declares id "${doc.id}"`,
      });
    }
    for (const [part, spec] of Object.entries(doc.materials)) {
      if (spec === undefined) continue;
      spec.choices.forEach((choice, index) => {
        const parsed = parseMaterialRef(choice.ref);
        if (parsed === undefined || parsed.kind === 'palette' || isUrlishRef(parsed.ref)) return;
        const kind = pack.materials[parsed.ref];
        if (kind === undefined) {
          const near = nearest(parsed.ref, materialIds);
          issues.push({
            path: `/styles/${id}/materials/${part}/choices/${index}/ref`,
            code: 'unknown_material',
            message: `material "${parsed.ref}" is not in the pack`,
            expected:
              materialIds.length > 0 ? `one of: ${materialIds.join(' ')}` : 'a pack material id',
            ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
          });
        } else {
          usedMaterials.add(parsed.ref);
          if (kind !== parsed.kind) {
            issues.push({
              path: `/styles/${id}/materials/${part}/choices/${index}/ref`,
              code: 'material_kind_mismatch',
              message: `"${parsed.ref}" is a ${kind} document but the reference says ${parsed.kind}`,
            });
          }
        }
      });
    }
    doc.props.forEach((prop, index) => {
      if (!modelKnown(pack, prop.model)) {
        issues.push({
          path: `/styles/${id}/props/${index}/model`,
          code: 'unknown_model',
          message: `model "${prop.model}" is not a pack asset, an imported namespace, or a builtin`,
        });
      } else if (pack.assets[prop.model] !== undefined) {
        usedAssets.add(prop.model);
      }
    });
  }
  for (const [id, doc] of Object.entries(pack.scatters)) {
    if (doc.id !== id) {
      issues.push({
        path: `/scatter/${id}`,
        code: 'id_mismatch',
        message: `scatter file declares id "${doc.id}"`,
      });
    }
    doc.rules.forEach((rule, ruleIndex) => {
      rule.populations.forEach((population, index) => {
        if (!modelKnown(pack, population.model)) {
          issues.push({
            path: `/scatter/${id}/rules/${ruleIndex}/populations/${index}/model`,
            code: 'unknown_model',
            message: `model "${population.model}" is not a pack asset, an imported namespace, or a builtin`,
          });
        } else if (pack.assets[population.model] !== undefined) {
          usedAssets.add(population.model);
        }
      });
    });
  }
  const defaults = pack.root.defaults;
  if (pack.archstyles[defaults.style] === undefined) {
    const near = nearest(defaults.style, styleIds);
    issues.push({
      path: '/defaults/style',
      code: 'default_style_missing',
      message: `default style "${defaults.style}" is not in the pack`,
      expected: `one of: ${styleIds.join(' ')}`,
      ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
    });
  } else {
    usedStyles.add(defaults.style);
  }
  if (defaults.scatter !== undefined) {
    if (pack.scatters[defaults.scatter] === undefined) {
      const near = nearest(defaults.scatter, scatterIds);
      issues.push({
        path: '/defaults/scatter',
        code: 'unknown_scatter',
        message: `default scatter "${defaults.scatter}" is not in the pack`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      });
    } else {
      usedScatters.add(defaults.scatter);
    }
  }
  defaults.rules.forEach((rule, index) => {
    for (const [variantIndex, variant] of (rule.variants ?? []).entries()) {
      if (pack.archstyles[variant.style] === undefined) {
        issues.push({
          path: `/defaults/rules/${index}/variants/${variantIndex}/style`,
          code: 'unknown_style',
          message: `variant style "${variant.style}" is not in the pack`,
        });
      } else {
        usedStyles.add(variant.style);
      }
    }
    const style = pack.archstyles[rule.style];
    if (style === undefined) {
      const near = nearest(rule.style, styleIds);
      issues.push({
        path: `/defaults/rules/${index}/style`,
        code: 'unknown_style',
        message: `style "${rule.style}" is not in the pack`,
        expected: `one of: ${styleIds.join(' ')}`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      });
      return;
    }
    usedStyles.add(rule.style);
    const classes = rule.when?.class;
    if (classes !== undefined && !anyClassMatches(classes, style.applicability.classes)) {
      issues.push({
        path: `/defaults/rules/${index}`,
        code: 'applicability_mismatch',
        message: `rule classes [${classes.join(', ')}] do not overlap style "${rule.style}" applicability [${style.applicability.classes.join(', ')}]`,
        severity: 'notice',
      });
    }
  });
  for (const id of styleIds) {
    if (!usedStyles.has(id)) {
      issues.push({
        path: `/styles/${id}`,
        code: 'unused_entry',
        message: `style "${id}" is never referenced by pack defaults`,
        severity: 'notice',
      });
    }
  }
  for (const id of materialIds) {
    if (!usedMaterials.has(id)) {
      issues.push({
        path: `/materials/${id}`,
        code: 'unused_entry',
        message: `material "${id}" is never referenced`,
        severity: 'notice',
      });
    }
  }
  for (const id of Object.keys(pack.assets)) {
    if (!usedAssets.has(id)) {
      issues.push({
        path: `/assets/${id}`,
        code: 'unused_entry',
        message: `asset "${id}" is never referenced`,
        severity: 'notice',
      });
    }
  }
  return issues;
}

/** Distinct doc-backed material references (matgraph, pixelgrid) any style part may use. */
export function stylePackMaterialRefs(pack: ResolvedStylePack): string[] {
  const refs = new Set<string>();
  for (const doc of Object.values(pack.archstyles)) {
    for (const spec of Object.values(doc.materials)) {
      if (spec === undefined) continue;
      for (const choice of spec.choices) {
        const parsed = parseMaterialRef(choice.ref);
        if (parsed !== undefined && parsed.kind !== 'palette') refs.add(choice.ref);
      }
    }
  }
  return [...refs].sort();
}

/**
 * Asset index for a pack served from `baseUrl`: material ids map to their document URLs (so a
 * `matgraph:<id>` reference loads through the client asset provider) and asset ids map to their
 * GLB URLs (sidecar directory + model.glb).
 */
export function stylePackAssetIndex(
  pack: ResolvedStylePack,
  baseUrl: string,
): Record<string, string> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const index: Record<string, string> = {};
  for (const [id, path] of Object.entries(pack.root.materials)) index[id] = `${base}${path}`;
  for (const [id, path] of Object.entries(pack.assets)) {
    const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    index[id] = `${base}${directory}model.glb`;
  }
  return index;
}
