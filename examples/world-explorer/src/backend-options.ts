/** Streamed worlds default to WebGL, matching EarthView; explicit backend comparisons remain. */
export function selectedRendererBackend(params: URLSearchParams): 'auto' | 'webgpu' | 'webgl' {
  // WebGPU currently builds node state for every new instanced mesh. At jet speeds this
  // preparation consumes the frame budget even when GPU rendering has ample headroom.
  const value = params.get('backend') ?? 'webgl';
  if (value === 'auto' || value === 'webgpu' || value === 'webgl') return value;
  throw new Error(`invalid ?backend=${value}; expected auto, webgpu, or webgl`);
}

/**
 * Screen-space ambient occlusion (WebGPU; it does nothing on WebGL) is off unless `?ao=1` asks
 * for it. With it on beside shader warm-up, nearby buildings draw without their facade textures
 * for as long as the page lives: blank walls and no windows, where the same view with occlusion
 * off (or with `?warmup=0`) draws them. No contact shading reads better than that. Seen low over
 * downtown Bellevue (lat 47.6135, lon -122.212, 230 m) at Balanced; the cause is not found.
 */
export function selectedAmbientOcclusion(params: URLSearchParams): boolean {
  const value = params.get('ao');
  if (value === null || value === '0') return false;
  if (value === '1') return true;
  throw new Error(`invalid ?ao=${value}; expected 0 or 1`);
}

/** Live rendering uses multisampling; allow an explicit opt-out for controlled comparisons. */
export function selectedAntialias(params: URLSearchParams): boolean {
  const value = params.get('antialias');
  if (value === null || value === '1') return true;
  if (value === '0') return false;
  throw new Error(`invalid ?antialias=${value}; expected 0 or 1`);
}
