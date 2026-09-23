import { getSchema, listSchemas, validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import '../../src/kernel';
import { ARCHSTYLE_EXAMPLE } from '../../src/kernel/archstyle-schema';
import { WORLDGEN_BATCH_EXAMPLE } from '../../src/kernel/batch-schema';
import { matchesWhen, selectStyle } from '../../src/kernel/rules';
import { SCATTER_EXAMPLE } from '../../src/kernel/scatter-schema';
import type { ScatterDoc } from '../../src/kernel/scatter-types';
import { resolveStylePackDocuments } from '../../src/kernel/stylepack';
import { STYLEPACK_EXAMPLE } from '../../src/kernel/stylepack-schema';
import { createTestPack, TEST_PACK_DOCS, TEST_PACK_ROOT, testStyle } from '../helpers/pack';

function validate(kind: string, doc: unknown): ReturnType<typeof validateByKind> {
  return validateByKind(kind as never, doc);
}

function issuesOf(
  kind: string,
  doc: unknown,
): Array<{ code: string; path: string; hint?: string }> {
  const result = validate(kind, doc);
  if (result.ok)
    return (result.notices ?? []).map((n) => ({
      code: n.code,
      path: n.path,
      ...(n.hint !== undefined ? { hint: n.hint } : {}),
    }));
  return result.issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    ...(issue.hint !== undefined ? { hint: issue.hint } : {}),
  }));
}

describe('worldgen formats', () => {
  it('registers four kinds with valid examples', () => {
    const kinds = listSchemas().map((entry) => entry.kind);
    for (const kind of ['archstyle', 'scatter', 'stylepack', 'worldgen-batch']) {
      expect(kinds).toContain(kind);
      for (const example of getSchema(kind)?.meta.examples ?? []) {
        const result = validate(kind, example);
        expect(result.ok, `${kind} example`).toBe(true);
      }
    }
    expect(validate('archstyle', ARCHSTYLE_EXAMPLE).ok).toBe(true);
    expect(validate('scatter', SCATTER_EXAMPLE).ok).toBe(true);
    expect(validate('stylepack', STYLEPACK_EXAMPLE).ok).toBe(true);
    expect(validate('worldgen-batch', WORLDGEN_BATCH_EXAMPLE).ok).toBe(true);
  });

  it('reports archstyle cross-field problems with did-you-mean hints', () => {
    const doc = structuredClone(ARCHSTYLE_EXAMPLE) as Record<string, unknown> & {
      massing: { floorHeight: { min: number; max: number }; heightFallback: unknown[] };
      materials: { wall: { palette: string } };
      roof: { choices: Array<{ pitchDeg?: unknown }> };
    };
    doc.massing.floorHeight = { min: 3, max: 2 };
    doc.materials.wall.palette = 'sidings';
    doc.massing.heightFallback = [{ when: { areaMax: 10 }, levels: { min: 1, max: 1 } }];
    doc.roof.choices = [{ ...(doc.roof.choices[1] as object), pitchDeg: undefined }];
    const issues = issuesOf('archstyle', doc);
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain('range_order');
    expect(codes).toContain('unknown_palette');
    expect(codes).toContain('height_fallback_catch_all');
    expect(codes).toContain('pitch_required');
    expect(issues.find((issue) => issue.code === 'unknown_palette')?.hint).toContain('siding');
  });

  it('reports scatter and stylepack problems', () => {
    const scatter = structuredClone(SCATTER_EXAMPLE) as Record<string, unknown> & {
      defaults: { lod: { keepByTier: number[] } };
      rules: Array<{ id: string }>;
    };
    scatter.defaults.lod.keepByTier = [0.5, 0.8];
    scatter.rules[1] = { ...(scatter.rules[1] as object), id: 'conifer-forest' } as { id: string };
    const scatterCodes = issuesOf('scatter', scatter).map((issue) => issue.code);
    expect(scatterCodes).toContain('keep_not_monotonic');
    expect(scatterCodes).toContain('duplicate_rule_id');
    const pack = structuredClone(STYLEPACK_EXAMPLE) as Record<string, unknown> & {
      styles: Record<string, string>;
    };
    pack.styles['other.vendor.house'] = 'x.json';
    expect(issuesOf('stylepack', pack).map((issue) => issue.code)).toContain(
      'id_outside_namespace',
    );
  });

  it('evaluates rules with word matching and bounds', () => {
    const metrics = {
      labels: ['semidetached_house', 'building'],
      context: 'residential',
      areaM2: 120,
      perimeterM: 44,
      vertexCount: 6,
      hasHoles: false,
      elongation: 1.3,
      rectangularity: 0.8,
    };
    expect(
      matchesWhen({ class: ['house'], contextClass: ['residential'], areaMax: 200 }, metrics),
    ).toBe(true);
    expect(matchesWhen({ class: ['warehouse'] }, metrics)).toBe(false);
    expect(matchesWhen({ heightMin: 3 }, metrics)).toBe(false);
    expect(matchesWhen({ contextClass: ['none'] }, { ...metrics, context: undefined })).toBe(true);
    expect(matchesWhen({ hasHeight: false }, metrics)).toBe(true);
    const selection = selectStyle(
      [
        { when: { class: ['shed'] }, style: 'a.shed' },
        { when: { class: ['house'], areaMax: 150 }, style: 'a.house' },
      ],
      metrics,
      'a.default',
    );
    expect(selection).toEqual({ style: 'a.house', ruleIndex: 1 });
    expect(selectStyle([], metrics, 'a.default').ruleIndex).toBe(-1);
  });

  it('resolves a pack bundle and rejects dangling references', async () => {
    const pack = await createTestPack();
    expect(Object.keys(pack.archstyles).sort()).toEqual(['test.pack.box', 'test.pack.house']);
    expect(pack.hash.startsWith('sha256:')).toBe(true);
    const broken = structuredClone(TEST_PACK_ROOT) as Record<string, unknown> & {
      defaults: { style: string };
    };
    broken.defaults.style = 'test.pack.hous';
    await expect(
      resolveStylePackDocuments(broken, async (path) => structuredClone(TEST_PACK_DOCS[path])),
    ).rejects.toThrow(/default_style_missing|did you mean "test.pack.house"/);
    const mismatched = structuredClone(TEST_PACK_ROOT);
    await expect(
      resolveStylePackDocuments(mismatched, async (path) =>
        path === 'house.archstyle.json'
          ? testStyle('test.pack.other')
          : structuredClone(TEST_PACK_DOCS[path]),
      ),
    ).rejects.toThrow(/id_mismatch|declares id/);
  });
});

it('validates positive, ordered crown-width ranges', () => {
  const doc = structuredClone(SCATTER_EXAMPLE) as unknown as ScatterDoc;
  const population = doc.rules[0]?.populations[0];
  if (population === undefined) throw new Error('missing example population');
  population.widthScale = { min: 0.8, max: 1.3 };
  expect(validate('scatter', doc).ok).toBe(true);
  population.widthScale = { min: 1.3, max: 0.8 };
  expect(issuesOf('scatter', doc)).toContainEqual({
    code: 'range_order',
    path: '/rules/0/populations/0/widthScale',
  });
  population.widthScale = { min: 0, max: 1 };
  expect(validate('scatter', doc).ok).toBe(false);
});
