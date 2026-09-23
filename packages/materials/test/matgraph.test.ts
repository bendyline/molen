import { validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakeMatGraph } from '../src/matgraph';
import { bakePalette } from '../src/palette';
import { registerMaterialSchemas } from '../src/schema';
import { createImage } from '../src/types';

beforeAll(() => registerMaterialSchemas());

function validatedGraph(doc: unknown): Parameters<typeof bakeMatGraph>[0] {
  const r = validate('matgraph' as never, doc);
  if (!r.ok) throw new Error(r.formatted);
  return r.value as Parameters<typeof bakeMatGraph>[0];
}

describe('matgraph schema', () => {
  it('validates the registered example', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [{ id: 'n', type: 'noise', params: {} }],
      outputs: { baseColor: 'n' },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects an empty output map', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [{ id: 'n', type: 'noise', params: {} }],
      outputs: {},
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown node type', () => {
    const r = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [{ id: 'n', type: 'wormhole', params: {} }],
      outputs: { baseColor: 'n' },
    });
    expect(r.ok).toBe(false);
  });

  it('bounds graph size, depth, and unsafe numeric parameters', () => {
    const nodes = Array.from({ length: 65 }, (_, i) => ({
      id: `n${i}`,
      type: 'invert',
      ...(i > 0 ? { input: `n${i - 1}` } : {}),
      params: {},
    }));
    const deep = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes,
      outputs: { baseColor: 'n64' },
    });
    expect(deep.ok).toBe(false);
    if (!deep.ok) expect(deep.issues.some((i) => i.code === 'graph_depth')).toBe(true);

    const badParams = validate('matgraph' as never, {
      format: 'molen/matgraph@1',
      nodes: [{ id: 'b', type: 'bricks', params: { rows: 0, cols: 2, mortarWidth: 2 } }],
      outputs: { baseColor: 'b' },
    });
    expect(badParams.ok).toBe(false);
  });
});

describe('bakeMatGraph', () => {
  it('produces a texture of the requested size', () => {
    const baked = bakeMatGraph(
      validatedGraph({
        format: 'molen/matgraph@1',
        size: [32, 32],
        nodes: [{ id: 'n', type: 'noise', params: { scale: 4 } }],
        outputs: { baseColor: 'n' },
      }),
    );
    expect(baked.slots.baseColor?.width).toBe(32);
    expect(baked.slots.baseColor?.data.length).toBe(32 * 32 * 4);
  });

  it('is deterministic for a given seed (identical bytes)', () => {
    const doc = {
      format: 'molen/matgraph@1',
      size: [24, 24],
      seed: 7,
      nodes: [
        { id: 'n1', type: 'noise', params: { kind: 'simplex', octaves: 4, scale: 5 } },
        {
          id: 'n2',
          type: 'ramp',
          input: 'n1',
          params: {
            stops: [
              { t: 0, color: '#000000' },
              { t: 1, color: '#ffffff' },
            ],
          },
        },
      ],
      outputs: { baseColor: 'n2', roughness: 'n1' },
    };
    const a = bakeMatGraph(validatedGraph(doc));
    const b = bakeMatGraph(validatedGraph(doc));
    expect(Array.from(a.slots.baseColor?.data ?? [])).toEqual(
      Array.from(b.slots.baseColor?.data ?? []),
    );
    expect(a.slots.roughness).toBeDefined();
  });

  it('different seeds give different output', () => {
    const mk = (seed: number) =>
      bakeMatGraph(
        validatedGraph({
          format: 'molen/matgraph@1',
          size: [16, 16],
          seed,
          nodes: [{ id: 'n', type: 'noise', params: { scale: 6 } }],
          outputs: { baseColor: 'n' },
        }),
      );
    const a = Array.from(mk(1).slots.baseColor?.data ?? []);
    const b = Array.from(mk(2).slots.baseColor?.data ?? []);
    expect(a).not.toEqual(b);
  });

  it('ramp maps a constant through colors', () => {
    const baked = bakeMatGraph(
      validatedGraph({
        format: 'molen/matgraph@1',
        size: [4, 4],
        nodes: [
          { id: 'c', type: 'const', params: { value: 1 } },
          {
            id: 'r',
            type: 'ramp',
            input: 'c',
            params: {
              stops: [
                { t: 0, color: '#000000' },
                { t: 1, color: '#ff0000' },
              ],
            },
          },
        ],
        outputs: { baseColor: 'r' },
      }),
    );
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    expect([d[0], d[1], d[2]]).toEqual([255, 0, 0]); // const 1 -> top of ramp -> red
  });

  it('blend reads inputs.a as its first operand (documented multi-input form)', () => {
    const bake = (nodes: unknown[]) =>
      bakeMatGraph(
        validatedGraph({
          format: 'molen/matgraph@1',
          size: [2, 2],
          nodes,
          outputs: { baseColor: 'out' },
        }),
      ).slots.baseColor?.data;
    const named = bake([
      { id: 'a', type: 'const', params: { value: [1, 0.5, 0.25, 1] } },
      { id: 'b', type: 'const', params: { value: 0.5 } },
      {
        id: 'out',
        type: 'blend',
        inputs: { a: 'a', b: 'b' },
        params: { mode: 'multiply', factor: 1 },
      },
    ]);
    const single = bake([
      { id: 'a', type: 'const', params: { value: [1, 0.5, 0.25, 1] } },
      { id: 'b', type: 'const', params: { value: 0.5 } },
      {
        id: 'out',
        type: 'blend',
        input: 'a',
        inputs: { b: 'b' },
        params: { mode: 'multiply', factor: 1 },
      },
    ]);
    expect(named).toBeDefined();
    expect(Array.from(named ?? [])).toEqual(Array.from(single ?? []));
    expect((named as Uint8Array)[0]).toBeGreaterThan(100);
  });

  it('checker alternates', () => {
    const baked = bakeMatGraph(
      validatedGraph({
        format: 'molen/matgraph@1',
        size: [2, 1],
        nodes: [{ id: 'c', type: 'checker', params: { scale: 2 } }],
        outputs: { baseColor: 'c' },
      }),
    );
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    // pixels at x=0 and x=1 map to different checker cells
    expect(d[0]).not.toBe(d[4]);
  });

  it('derives height-to-normal sampling from both output dimensions', () => {
    const bake = (size: [number, number]) =>
      bakeMatGraph(
        validatedGraph({
          format: 'molen/matgraph@1',
          size,
          nodes: [
            { id: 'g', type: 'gradient', params: { kind: 'linear', angleDeg: 0 } },
            { id: 'n', type: 'height-to-normal', input: 'g', params: { strength: 1 } },
          ],
          outputs: { normal: 'n' },
        }),
      ).slots.normal?.data[0] as number;
    expect(bake([8, 4])).toBeCloseTo(bake([64, 32]), 0);
  });

  it('detects cycles with a named path', () => {
    expect(() =>
      bakeMatGraph(
        validatedGraph({
          format: 'molen/matgraph@1',
          nodes: [
            { id: 'a', type: 'invert', input: 'b', params: {} },
            { id: 'b', type: 'invert', input: 'a', params: {} },
          ],
          outputs: { baseColor: 'a' },
        }),
      ),
    ).toThrow(/cycle/);
  });
});

// M4 hardening: an unvalidated document has no schema defaults, so `fbm` multiplied by
// `undefined` made every sample NaN and Math.round(NaN * 255) stored 0 — a flat texture that
// looks plausible. Baking must refuse such a document instead.
describe('bakeMatGraph rejects unvalidated documents', () => {
  const raw = (nodes: unknown[], extra: Record<string, unknown> = {}) =>
    ({
      format: 'molen/matgraph@1',
      size: [4, 4],
      seed: 1,
      nodes,
      outputs: { baseColor: (nodes[0] as { id: string }).id },
      ...extra,
    }) as unknown as Parameters<typeof bakeMatGraph>[0];

  it('names the missing parameter when noise defaults were never applied', () => {
    expect(() =>
      bakeMatGraph(raw([{ id: 'n', type: 'noise', params: { kind: 'simplex', scale: 6 } }])),
    ).toThrow(/node "n" \(noise\) is missing params\.octaves/);
  });

  it('points at validateByKind in the message', () => {
    expect(() =>
      bakeMatGraph(raw([{ id: 'n', type: 'noise', params: { kind: 'simplex', scale: 6 } }])),
    ).toThrow(/validateByKind\('matgraph', doc\)/);
  });

  it('rejects a node type outside the vocabulary', () => {
    expect(() => bakeMatGraph(raw([{ id: 'm', type: 'mix', params: { factor: 0.4 } }]))).toThrow(
      /unknown type "mix"/,
    );
  });

  it('rejects non-finite parameters', () => {
    expect(() =>
      bakeMatGraph(
        raw([
          {
            id: 'n',
            type: 'noise',
            params: {
              kind: 'simplex',
              octaves: 4,
              lacunarity: Number.NaN,
              gain: 0.5,
              scale: 6,
              seedOffset: 0,
            },
          },
        ]),
      ),
    ).toThrow(/non-finite params\.lacunarity/);
  });

  it('rejects a missing seed and a missing size', () => {
    const node = { id: 'c', type: 'const', params: { value: 0.5 } };
    expect(() => bakeMatGraph(raw([node], { seed: undefined }))).toThrow(/non-finite seed/);
    expect(() => bakeMatGraph(raw([node], { size: undefined }))).toThrow(/no size/);
  });

  it('still bakes a validated document with the same shape', () => {
    const baked = bakeMatGraph(
      validatedGraph({
        format: 'molen/matgraph@1',
        size: [8, 8],
        seed: 1,
        nodes: [{ id: 'n', type: 'noise', params: { kind: 'simplex', scale: 6 } }],
        outputs: { baseColor: 'n' },
      }),
    );
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    // ...and it is not the flat image the NaN path used to produce.
    expect(new Set(d.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(1);
  });
});

describe('createImage', () => {
  it('rejects invalid and excessive dimensions before allocating', () => {
    expect(() => createImage(0, 1)).toThrow(/dimensions/);
    expect(() => createImage(1.5, 2)).toThrow(/dimensions/);
    expect(() => createImage(8192, 8192)).toThrow(/limit/);
  });
});

describe('bakePalette (rung 1)', () => {
  it('produces a solid color texture', () => {
    const baked = bakePalette('palette:#ff8800');
    const d = baked?.slots.baseColor?.data as Uint8ClampedArray;
    expect([d[0], d[1], d[2], d[3]]).toEqual([255, 136, 0, 255]);
  });
  it('returns undefined for a non-palette ref', () => {
    expect(bakePalette('models/foo.glb')).toBeUndefined();
  });
});
