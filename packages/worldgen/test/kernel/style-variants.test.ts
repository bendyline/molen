import { describe, expect, it } from 'vitest';
import {
  type BuildingMetrics,
  type StyleRule,
  selectStyle,
  styleRuleSchema,
} from '../../src/kernel/rules';

const metrics: BuildingMetrics = {
  labels: ['house'],
  areaM2: 100,
  perimeterM: 40,
  vertexCount: 4,
  hasHoles: false,
  elongation: 1,
  rectangularity: 1,
};
const rule: StyleRule = {
  when: { class: ['house'] },
  style: 'molen.example.original',
  variants: [
    { style: 'molen.example.first', weight: 1 },
    { style: 'molen.example.second', weight: 3 },
  ],
};

describe('stable architecture variants', () => {
  it('varies buildings without depending on batch order or unrelated preceding rules', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `feature:${i}`);
    const choices = new Map(
      ids.map((id) => [id, selectStyle([rule], metrics, 'fallback', id).style]),
    );
    expect(new Set(choices.values()).size).toBe(2);
    for (const id of ids.reverse()) {
      expect(
        selectStyle(
          [{ when: { class: ['warehouse'] }, style: 'unused' }, rule],
          metrics,
          'fallback',
          id,
        ).style,
      ).toBe(choices.get(id));
    }
    const second = [...choices.values()].filter((style) => style.endsWith('second')).length;
    expect(second).toBeGreaterThan(120);
    expect(second).toBeLessThan(175);
  });
  it('preserves fallback semantics and validates weighted references', () => {
    expect(selectStyle([rule], metrics, 'fallback').style).toBe(rule.style);
    expect(selectStyle([rule], { ...metrics, labels: ['warehouse'] }, 'fallback', 'x').style).toBe(
      'fallback',
    );
    expect(styleRuleSchema.safeParse({ ...rule, variants: [] }).success).toBe(false);
    expect(
      styleRuleSchema.safeParse({ ...rule, variants: [{ style: 'molen.valid.id', weight: 0 }] })
        .success,
    ).toBe(false);
    expect(
      styleRuleSchema.safeParse({ ...rule, variants: [{ style: 'missing namespace', weight: 1 }] })
        .success,
    ).toBe(false);
  });
});
