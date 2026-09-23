import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import '../src/index'; // registers the material schemas (+ their validators)

describe('material format validators (post-parse)', () => {
  it('accepts the valid examples', () => {
    const grid = validate('pixelgrid' as never, {
      format: 'molen/pixelgrid@1',
      size: [2, 2],
      palette: { '.': 'transparent', X: '#222222' },
      rows: ['.X', 'X.'],
    });
    expect(grid.ok).toBe(true);
  });

  it('pixelgrid: flags a wrong row length + unknown palette char', () => {
    const r = validate('pixelgrid' as never, {
      format: 'molen/pixelgrid@1',
      size: [3, 2],
      palette: { '.': 'transparent', X: '#222222' },
      rows: ['.X', '.XQ'], // first row too short; Q not in palette
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((i) => i.code === 'row_length')).toBe(true);
    expect(r.issues.some((i) => i.code === 'unknown_palette_char')).toBe(true);
  });

  it('matgraph: flags a cycle', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [
        { id: 'a', type: 'invert', input: 'b' },
        { id: 'b', type: 'invert', input: 'a' },
      ],
      outputs: { baseColor: 'a' },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((i) => i.code === 'graph_cycle')).toBe(true);
    expect(r.formatted).toContain('cycle');
  });

  it('matgraph: flags a dangling node reference with did-you-mean', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [
        { id: 'noise1', type: 'noise', params: {} },
        {
          id: 'ramp',
          type: 'ramp',
          input: 'noise',
          params: {
            stops: [
              { t: 0, color: '#000000' },
              { t: 1, color: '#ffffff' },
            ],
          },
        },
      ],
      outputs: { baseColor: 'ramp' },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const issue = r.issues.find((i) => i.code === 'unknown_node_ref');
    expect(issue?.hint).toContain('noise1');
  });

  it('matgraph: flags a dangling output reference', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [{ id: 'n', type: 'noise', params: {} }],
      outputs: { baseColor: 'nope' },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(
      r.issues.some((i) => i.code === 'unknown_node_ref' && i.path === '/outputs/baseColor'),
    ).toBe(true);
  });
});
