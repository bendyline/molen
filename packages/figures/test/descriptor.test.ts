import { getComponent, getSchema, validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  descriptorKey,
  FIGURE_EXAMPLE,
  FIGURE_FILE_EXAMPLE,
  FIGURE_PRESET_IDS,
  FIGURE_PRESETS,
  Figure,
  FigureAttachment,
  FigureIntent,
  FigureState,
  resolveFigureDescriptor,
} from '../src/kernel';

describe('figure descriptors', () => {
  it('resolves every preset to a complete descriptor', () => {
    for (const preset of FIGURE_PRESET_IDS) {
      const resolved = resolveFigureDescriptor({ preset });
      expect(resolved.height).toBe(FIGURE_PRESETS[preset].height);
      expect(resolved.archetype).toBe(FIGURE_PRESETS[preset].archetype);
      expect(Object.keys(resolved.palette).sort()).toEqual(
        ['accent', 'bottom', 'eyes', 'hair', 'markings', 'shoes', 'skin', 'top'].sort(),
      );
      for (const value of Object.values(resolved.proportions))
        expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('merges overrides over the preset and keys by content', () => {
    const a = resolveFigureDescriptor({
      preset: 'human.adult',
      height: 1.6,
      palette: { top: '#112233' },
    });
    expect(a.height).toBe(1.6);
    expect(a.palette.top).toBe('#112233');
    expect(a.palette.skin).toBe(FIGURE_PRESETS['human.adult'].palette.skin);
    const b = resolveFigureDescriptor({
      palette: { top: '#112233' },
      height: 1.6,
      preset: 'human.adult',
    });
    expect(descriptorKey(a)).toBe(descriptorKey(b));
    expect(descriptorKey(a)).not.toBe(
      descriptorKey(resolveFigureDescriptor({ preset: 'human.adult' })),
    );
  });

  it('registers validated components whose examples pass', () => {
    for (const c of [Figure, FigureIntent, FigureState, FigureAttachment]) {
      const entry = getComponent(c.name);
      expect(entry, c.name).toBeDefined();
      for (const example of entry?.meta.examples ?? []) {
        expect(entry?.zod.safeParse(example).success, `${c.name} example`).toBe(true);
      }
    }
    expect(getComponent('figure')?.zod.safeParse({ preset: 'nope' }).success).toBe(false);
    expect(getComponent('figure')?.zod.safeParse(FIGURE_EXAMPLE).success).toBe(true);
  });

  it('widens renderable.kind with "figure"', () => {
    const renderable = getComponent('renderable');
    expect(renderable?.zod.safeParse({ kind: 'figure', ref: 'procedural' }).success).toBe(true);
    expect(renderable?.zod.safeParse({ kind: 'sprite', ref: 'x' }).success).toBe(false);
  });

  it('registers the molen/figure@1 format', () => {
    expect(getSchema('figure')?.meta.id).toBe('molen/figure@1');
    expect(validateByKind('figure', FIGURE_FILE_EXAMPLE).ok).toBe(true);
    expect(validateByKind('figure', { format: 'molen/figure@1', preset: 'dragon' }).ok).toBe(false);
  });
});
