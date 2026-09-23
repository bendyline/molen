/** Select an explicit backend for comparisons; normal visits negotiate WebGPU with fallback. */
export function selectedRendererBackend(params: URLSearchParams): 'auto' | 'webgpu' | 'webgl' {
  const value = params.get('backend') ?? 'auto';
  if (value === 'auto' || value === 'webgpu' || value === 'webgl') return value;
  throw new Error(`invalid ?backend=${value}; expected auto, webgpu, or webgl`);
}

/** Live rendering uses multisampling; allow an explicit opt-out for controlled comparisons. */
export function selectedAntialias(params: URLSearchParams): boolean {
  const value = params.get('antialias');
  if (value === null || value === '1') return true;
  if (value === '0') return false;
  throw new Error(`invalid ?antialias=${value}; expected 0 or 1`);
}
