import {
  createTerrainSurfaceRenderer,
  createTerrainSurfaceWorkerBridge,
  resolveTerrainSurfaceStyle,
  TERRAIN_SURFACE_STYLES,
  type TerrainParkedVehicle,
  type TerrainQualityPreset,
  type TerrainSurfaceDetails,
  type TerrainSurfaceRenderer,
  type TerrainSurfaceStyleId,
} from '@bendyline/molen-terrain/client';

export interface SurfaceControls extends TerrainSurfaceRenderer {
  /** Device adaptation changes budgets without overwriting the user's style or detail choices. */
  setPerformanceScale(scale: number, quality?: TerrainQualityPreset): Promise<void>;
}

/** Surface controls update resident meshes in place and keep shareable URL preferences. */
export function createSurfaceControls(
  quality: TerrainQualityPreset,
  parkedVehicles: readonly TerrainParkedVehicle[],
): SurfaceControls {
  const select = document.getElementById('surface-style') as HTMLSelectElement;
  const status = document.getElementById('surface-status') as HTMLParagraphElement;
  const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-surface-detail]')];
  const params = new URLSearchParams(location.search);
  const requested = params.get('surfaces') ?? 'modern';
  let style: TerrainSurfaceStyleId = Object.hasOwn(TERRAIN_SURFACE_STYLES, requested)
    ? (requested as TerrainSurfaceStyleId)
    : 'modern';
  let details: TerrainSurfaceDetails = {
    preferMappedProps: params.get('style') !== 'none',
    parkedVehicles,
  };
  for (const input of inputs) {
    const key = input.dataset.surfaceDetail as
      | 'markings'
      | 'sidewalks'
      | 'crossings'
      | 'streetlights'
      | 'trafficSignals'
      | 'parkedCars';
    const value = params.get(key);
    if (value === '0' || value === '1') details[key] = value === '1';
    if (key === 'markings' && value !== null) details.parkingStalls = value === '1';
  }
  const inferParking = document.getElementById('infer-parking') as HTMLInputElement;
  inferParking.checked = params.get('inferParking') !== '0';
  const budgetsForQuality = (value: TerrainQualityPreset) => ({
    maxFixturesPerTile: value === 'high' ? 300 : value === 'balanced' ? 160 : 60,
    maxDetailElements: value === 'high' ? 28_000 : value === 'balanced' ? 16_000 : 6_000,
  });
  let budgets = budgetsForQuality(quality);
  let performanceScale = 1;
  const options = () => ({
    style,
    details: {
      ...details,
      maxFixturesPerTile: Math.round(budgets.maxFixturesPerTile * performanceScale),
      maxDetailElements: Math.round(budgets.maxDetailElements * performanceScale),
      inferParking: inferParking.checked,
    },
  });
  const generator =
    typeof Worker !== 'undefined' &&
    params.get('worker') !== '0' &&
    params.get('surfaceWorker') !== '0'
      ? createTerrainSurfaceWorkerBridge(
          new Worker(new URL('./surface-worker.ts', import.meta.url), { type: 'module' }),
        )
      : undefined;
  const renderer = createTerrainSurfaceRenderer(options(), generator);
  let revision = 0;
  const sync = (): void => {
    select.value = style;
    const resolved = resolveTerrainSurfaceStyle(style, details);
    for (const input of inputs)
      input.checked = resolved[input.dataset.surfaceDetail as keyof typeof resolved] === true;
    status.textContent =
      style === '1910'
        ? 'Circa 1910 treatment · present-day map layout'
        : 'Surface details appear as you approach.';
    status.dataset.style = style;
  };
  const update = async (): Promise<void> => {
    const current = ++revision;
    sync();
    status.textContent = 'Updating surfaces…';
    const url = new URL(location.href);
    url.searchParams.set('surfaces', style);
    for (const input of inputs) {
      const key = input.dataset.surfaceDetail as keyof TerrainSurfaceDetails;
      if (details[key] === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, details[key] ? '1' : '0');
    }
    url.searchParams.set('inferParking', inferParking.checked ? '1' : '0');
    history.replaceState(null, '', url);
    try {
      await renderer.setOptions(options());
      if (current === revision) sync();
    } catch (error) {
      if (current === revision)
        status.textContent = `Surface update failed: ${(error as Error).message}`;
    }
  };
  inferParking.addEventListener('change', () => {
    void update();
  });
  select.addEventListener('change', () => {
    style = select.value as TerrainSurfaceStyleId;
    details = { preferMappedProps: params.get('style') !== 'none', parkedVehicles };
    void update();
  });
  for (const input of inputs)
    input.addEventListener('change', () => {
      const key = input.dataset.surfaceDetail as
        | 'markings'
        | 'sidewalks'
        | 'crossings'
        | 'streetlights'
        | 'trafficSignals'
        | 'parkedCars';
      details[key] = input.checked;
      // Parking paint follows the markings control; vehicles are independent.
      if (key === 'markings') details.parkingStalls = input.checked;
      void update();
    });
  sync();
  return Object.assign(renderer, {
    async setPerformanceScale(scale: number, nextQuality = quality): Promise<void> {
      if (!Number.isFinite(scale) || scale <= 0)
        throw new Error('Surface performance scale must be positive and finite');
      // Bucket small controller changes to avoid repeatedly rebuilding hundreds of tiles.
      const next = scale >= 1 ? 1 : scale >= 0.5 ? 0.5 : Math.min(0.2, scale);
      if (next === performanceScale && nextQuality === quality) return;
      performanceScale = next;
      quality = nextQuality;
      budgets = budgetsForQuality(quality);
      await renderer.setOptions(options());
    },
  });
}
