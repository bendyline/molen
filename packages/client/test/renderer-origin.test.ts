import { describe, expect, it } from 'vitest';
import { nextWorldOrigin } from '../src/three/renderer';

describe('automatic world-origin policy', () => {
  it('keeps the current origin inside the threshold', () => {
    expect(nextWorldOrigin([100, 0, 200], [140, 999, 230], { threshold: 50 })).toBeUndefined();
  });

  it('rebases horizontal worlds on a stable grid', () => {
    expect(
      nextWorldOrigin([0, 12, 0], [1_249, 900, -1_251], {
        threshold: 1_000,
        gridSize: 500,
      }),
    ).toEqual([1_000, 12, -1_500]);
  });

  it('optionally includes and rebases the vertical axis', () => {
    expect(
      nextWorldOrigin([0, 0, 0], [0, 101, 0], {
        threshold: 100,
        gridSize: 25,
        includeY: true,
      }),
    ).toEqual([0, 100, 0]);
  });

  it('rejects invalid budgets and positions', () => {
    expect(() => nextWorldOrigin([0, 0, 0], [0, 0, 0], { threshold: 0 })).toThrow(/threshold/);
    expect(() =>
      nextWorldOrigin([0, 0, 0], [0, 0, 0], { threshold: 1, gridSize: Number.NaN }),
    ).toThrow(/gridSize/);
    expect(() => nextWorldOrigin([0, 0, 0], [Number.NaN, 0, 0], { threshold: 1 })).toThrow(
      /finite/,
    );
  });
});
