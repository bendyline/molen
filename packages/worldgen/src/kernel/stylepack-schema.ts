import {
  getSchema,
  type JsonValue,
  namespaceCovers,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { styleRuleSchema, unreachableRuleIssues, whenIssues } from './rules';
import { DOTTED_ID_RE, REL_PATH_RE } from './schema-common';
import type { StylePackDoc } from './stylepack-types';

const dottedId = z.string().regex(DOTTED_ID_RE, 'must be a namespaced dotted id');
const relPath = z.string().min(1).regex(REL_PATH_RE, 'must be a contained relative POSIX path');
const idToPath = z.record(z.string(), relPath);

const stylePackSchema = z.strictObject({
  format: z.literal('molen/stylepack@1').describe("Format envelope; always 'molen/stylepack@1'."),
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'must be a lowercase package-like name')
    .describe("Pack name, e.g. 'molen-worldgen-default'."),
  version: z
    .string()
    .min(1)
    .describe("Pack version string, e.g. '2026.09.0'; participates in every seed."),
  title: z.string().optional(),
  doc: z.string().optional(),
  namespace: dottedId.describe(
    "Namespace every id in the pack lives under, e.g. 'molen.worldgen'.",
  ),
  styles: idToPath.describe('Archstyle id to pack-relative molen/archstyle@1 path.'),
  scatter: idToPath.describe('Scatter id to pack-relative molen/scatter@1 path.').default({}),
  materials: idToPath
    .describe(
      'Material id to pack-relative matgraph/pixelgrid document path (resolves matgraph:<id>).',
    )
    .default({}),
  assets: idToPath
    .describe('Asset id to pack-relative molen/asset@1 sidecar path (props).')
    .default({}),
  interiors: relPath
    .describe(
      'Pack-relative molen/interior-catalog@1 path: layouts for enterable buildings. Without one, the pack generates no interiors.',
    )
    .optional(),
  defaults: z.strictObject({
    style: dottedId.describe('Archstyle used when no rule matches.'),
    scatter: dottedId.describe('Scatter rule set used when a binding names none.').optional(),
    rules: z
      .array(styleRuleSchema)
      .describe('Ordered style rules evaluated after any world binding rules.')
      .default([]),
  }),
  imports: z
    .array(
      z.strictObject({
        namespace: dottedId.describe(
          "External asset namespace the pack may reference, e.g. 'molen.entities'.",
        ),
        package: z
          .string()
          .describe('Informational: where the namespace comes from, e.g. a content pack id.')
          .optional(),
        note: z.string().optional(),
      }),
    )
    .describe('Namespaces of external asset libraries the pack references.')
    .default([]),
  attribution: z
    .array(
      z.strictObject({
        text: z.string().min(1).describe('Attribution text to display.'),
        license: z.string().min(1).describe("License identifier, e.g. 'MIT'."),
        sourceUrl: z.url().optional(),
        licenseUrl: z.url().optional(),
      }),
    )
    .min(1)
    .describe('Content attributions (at least one).'),
});

export function validateStylePack(data: unknown): ValidationIssue[] {
  const doc = data as StylePackDoc;
  const issues: ValidationIssue[] = [];
  const sections: Array<[string, Record<string, string>]> = [
    ['styles', doc.styles],
    ['scatter', doc.scatter],
    ['materials', doc.materials],
    ['assets', doc.assets],
  ];
  const paths = new Map<string, string>();
  for (const [section, entries] of sections) {
    for (const [id, path] of Object.entries(entries)) {
      if (!namespaceCovers(doc.namespace, id)) {
        issues.push({
          path: `/${section}/${id}`,
          code: 'id_outside_namespace',
          message: `"${id}" is not under the pack namespace "${doc.namespace}"`,
          expected: `${doc.namespace}.<name>`,
        });
      }
      const previous = paths.get(path);
      if (previous !== undefined) {
        issues.push({
          path: `/${section}/${id}`,
          code: 'duplicate_path',
          message: `"${id}" and "${previous}" point at the same file "${path}"`,
          severity: 'notice',
        });
      }
      paths.set(path, id);
    }
  }
  doc.imports.forEach((entry, index) => {
    if (
      namespaceCovers(entry.namespace, doc.namespace) ||
      namespaceCovers(doc.namespace, entry.namespace)
    ) {
      issues.push({
        path: `/imports/${index}/namespace`,
        code: 'import_overlaps_namespace',
        message: `import "${entry.namespace}" overlaps the pack namespace "${doc.namespace}"`,
      });
    }
  });
  doc.defaults.rules.forEach((rule, index) => {
    issues.push(
      ...whenIssues(rule.when, `/defaults/rules/${index}/when`, { wingsSupported: false }),
    );
  });
  issues.push(...unreachableRuleIssues(doc.defaults.rules, '/defaults/rules'));
  return issues;
}

export const STYLEPACK_EXAMPLE: JsonValue = {
  format: 'molen/stylepack@1',
  name: 'molen-worldgen-default',
  version: '2026.09.0',
  title: 'Molen default world styles',
  doc: 'Regional architecture and vegetation looks for outlines and labeled polygons.',
  namespace: 'molen.worldgen',
  styles: {
    'molen.worldgen.pnw.house': 'styles/pnw/house.archstyle.json',
    'molen.worldgen.generic.house': 'styles/generic/house.archstyle.json',
    'molen.worldgen.generic.commercial': 'styles/generic/commercial.archstyle.json',
    'molen.worldgen.generic.box': 'styles/generic/box.archstyle.json',
  },
  scatter: {
    'molen.worldgen.scatter.global': 'scatter/global.scatter.json',
  },
  materials: {
    'molen.worldgen.material.siding_lap': 'materials/siding-lap.matgraph.json',
  },
  assets: {
    'molen.worldgen.prop.chimney.brick': 'assets/prop/chimney/brick/asset.json',
  },
  interiors: 'interiors/catalog.json',
  defaults: {
    style: 'molen.worldgen.generic.box',
    scatter: 'molen.worldgen.scatter.global',
    rules: [
      {
        when: { class: ['commercial', 'retail', 'industrial', 'office', 'apartments'] },
        style: 'molen.worldgen.generic.commercial',
      },
      {
        when: { class: ['house', 'residential', 'yes', 'building'], areaMax: 600 },
        style: 'molen.worldgen.generic.house',
      },
    ],
  },
  imports: [
    {
      namespace: 'molen.entities',
      note: 'The molen.entities content pack: trees, shrub, boulder.',
    },
  ],
  attribution: [{ text: 'Molen default world styles', license: 'MIT' }],
};

export function registerStylePackSchema(): void {
  if (getSchema('stylepack') !== undefined) return;
  registerSchema('stylepack', stylePackSchema, {
    id: 'molen/stylepack@1',
    title: 'Style pack manifest',
    description:
      'Index of a shippable look: archstyles, scatter rules, materials, prop assets, an optional interior catalog, default style rules, imports, and attribution. One directory is one pack; the version feeds every seed.',
    examples: [STYLEPACK_EXAMPLE],
    docsRef: 'guide/worldgen.md',
    validate: validateStylePack,
  });
}
