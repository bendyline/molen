import { describe, expect, it } from 'vitest';
import { selectedAntialias, selectedRendererBackend } from './backend-options';

describe('explorer rendering backend selection', () => {
  it('uses capability negotiation by default', () => {
    expect(selectedRendererBackend(new URLSearchParams())).toBe('auto');
  });

  it.each(['auto', 'webgpu', 'webgl'] as const)('accepts an explicit %s selection', (backend) => {
    expect(selectedRendererBackend(new URLSearchParams({ backend }))).toBe(backend);
  });

  it('rejects typos instead of silently comparing the same backend', () => {
    expect(() => selectedRendererBackend(new URLSearchParams('backend=webgl2'))).toThrow(
      'expected auto, webgpu, or webgl',
    );
    expect(() => selectedRendererBackend(new URLSearchParams('backend='))).toThrow();
  });

  it('enables multisampling by default with an explicit comparison opt-out', () => {
    expect(selectedAntialias(new URLSearchParams())).toBe(true);
    expect(selectedAntialias(new URLSearchParams({ antialias: '1' }))).toBe(true);
    expect(selectedAntialias(new URLSearchParams({ antialias: '0' }))).toBe(false);
    expect(() => selectedAntialias(new URLSearchParams({ antialias: 'off' }))).toThrow(
      'expected 0 or 1',
    );
  });
});
