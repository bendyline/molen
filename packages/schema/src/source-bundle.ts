import { z } from 'zod';
import type { ValidationIssue } from './issues';
import { registerSchema } from './registry';

const containedPath = z
  .string()
  .min(1)
  .regex(/^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
const stableId = z.string().regex(/^[a-z][a-z0-9_.-]*$/);
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export interface SourceBundleModel {
  path: string;
  assetId?: string;
  output?: string;
  pipeline?: 'copy' | 'import';
  sha256?: string;
}

export interface SourceBundleNamedFile {
  id: string;
  path: string;
}

/** Portable authoring-time contents for one logical thing. Runtime outputs live elsewhere. */
export interface SourceBundle {
  format: 'molen/source-bundle@1';
  id: string;
  kind: string;
  title: string;
  order?: number;
  files: {
    definitions: string[];
    models: SourceBundleModel[];
    generators: SourceBundleNamedFile[];
    scripts: SourceBundleNamedFile[];
    textures: SourceBundleNamedFile[];
    sounds: SourceBundleNamedFile[];
    documents: string[];
  };
}

const namedFile = z.strictObject({
  id: stableId.describe('Stable role/name for this file inside the logical source bundle.'),
  path: containedPath.describe('Bundle-relative source path; it may not escape the bundle.'),
});

const sourceBundleSchema = z.strictObject({
  format: z
    .literal('molen/source-bundle@1')
    .describe("Format envelope; always 'molen/source-bundle@1'."),
  id: stableId.describe('Stable logical content id, normally the runtime entity or asset id.'),
  kind: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .describe("Open content class such as 'entity', 'vehicle', or 'worldgen-structure'."),
  title: z.string().min(1).describe('Human-readable content name.'),
  order: z
    .int()
    .nonnegative()
    .describe('Optional stable presentation or build order within an owning collection.')
    .optional(),
  files: z
    .strictObject({
      definitions: z
        .array(containedPath)
        .describe('Bundle-relative JSON definitions, manifests, recipes, or configuration files.')
        .default([]),
      models: z
        .array(
          z.strictObject({
            path: containedPath.describe('Bundle-relative editable model or model recipe path.'),
            assetId: stableId
              .describe('Runtime asset id produced from this source model, when applicable.')
              .optional(),
            output: containedPath
              .describe(
                'Owning-project-relative output path of the generated molen/asset@1 sidecar, when applicable.',
              )
              .optional(),
            pipeline: z
              .enum(['copy', 'import'])
              .describe(
                "'copy' when the editable GLB is already canonical; 'import' when molen asset import derives the runtime model.",
              )
              .optional(),
            sha256: sha256
              .describe('Optional pinned authoring-source hash for binary model masters.')
              .optional(),
          }),
        )
        .describe('Editable model masters and procedural model recipes.')
        .default([]),
      generators: z
        .array(namedFile)
        .describe('Authoring programs used to create, verify, or transform owned source files.')
        .default([]),
      scripts: z
        .array(namedFile)
        .describe('Deterministic behavior scripts owned by this logical thing.')
        .default([]),
      textures: z
        .array(namedFile)
        .describe('Authoring texture sources owned by this logical thing.')
        .default([]),
      sounds: z
        .array(namedFile)
        .describe('Authoring audio sources owned by this logical thing.')
        .default([]),
      documents: z
        .array(containedPath)
        .describe('Bundle-relative provenance, briefs, verification reports, and previews.')
        .default([]),
    })
    .describe(
      'Every source file owned by the logical thing. Shared engine code and generated runtime outputs are intentionally excluded.',
    ),
});

function validateSourceBundle(data: unknown): ValidationIssue[] {
  const bundle = data as SourceBundle;
  const paths = [
    ...bundle.files.definitions,
    ...bundle.files.models.map((file) => file.path),
    ...bundle.files.generators.map((file) => file.path),
    ...bundle.files.scripts.map((file) => file.path),
    ...bundle.files.textures.map((file) => file.path),
    ...bundle.files.sounds.map((file) => file.path),
    ...bundle.files.documents,
  ];
  const issues: ValidationIssue[] = [];
  if (paths.length === 0) {
    issues.push({
      path: '/files',
      code: 'empty_source_bundle',
      message: 'a source bundle must list at least one owned source file',
    });
  }
  for (const path of new Set(paths)) {
    if (paths.filter((candidate) => candidate === path).length > 1) {
      issues.push({
        path: '/files',
        code: 'duplicate_source_path',
        message: `source path "${path}" is listed more than once`,
      });
    }
  }
  return issues;
}

registerSchema('source-bundle', sourceBundleSchema, {
  id: 'molen/source-bundle@1',
  title: 'Logical source bundle',
  description:
    'Portable authoring-time manifest for one logical thing: definitions, editable models or recipes, generators, behavior scripts, textures, sounds, and documentation under one directory.',
  examples: [
    {
      format: 'molen/source-bundle@1',
      id: 'example.vehicle.roadster',
      kind: 'vehicle',
      title: 'Roadster',
      order: 10,
      files: {
        definitions: ['entity.types.json'],
        models: [
          {
            path: 'models/source.glb',
            assetId: 'example.vehicle.roadster',
            output: 'assets/example/vehicle/roadster/asset.json',
            pipeline: 'import',
            sha256: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
        generators: [{ id: 'model', path: 'models/generate.mjs' }],
        scripts: [{ id: 'interactions', path: 'scripts/interactions.ts' }],
        textures: [],
        sounds: [],
        documents: ['README.md'],
      },
    },
  ],
  docsRef: 'guide/source-bundles.md',
  validate: validateSourceBundle,
});
