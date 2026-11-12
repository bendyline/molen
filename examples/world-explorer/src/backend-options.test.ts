import { describe, expect, it } from 'vitest';
import {
  selectedAmbientOcclusion,
  selectedAntialias,
  selectedRendererBackend,
} from './backend-options';

describe('explorer rendering backend selection', () => {
  it('uses the cheaper streaming preparation path by default', () => {
    expect(selectedRendererBackend(new URLSearchParams())).toBe('webgl');
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

  it('leaves ambient occlusion off unless asked: with it on, near buildings lose their facades', () => {
    expect(selectedAmbientOcclusion(new URLSearchParams())).toBe(false);
    expect(selectedAmbientOcclusion(new URLSearchParams({ backend: 'webgpu' }))).toBe(false);
    expect(selectedAmbientOcclusion(new URLSearchParams({ ao: '0' }))).toBe(false);
    expect(selectedAmbientOcclusion(new URLSearchParams({ ao: '1' }))).toBe(true);
    expect(() => selectedAmbientOcclusion(new URLSearchParams({ ao: 'on' }))).toThrow(
      'expected 0 or 1',
    );
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
