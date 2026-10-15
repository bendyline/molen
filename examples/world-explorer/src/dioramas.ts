import { EarthDioramaDirector, type EarthDioramaSpec } from '@bendyline/molen-earth/client';
import catalog from '../../../content/dioramas/placements.json';
import { loadDiorama } from './load-diorama.js';

export const DIORAMA_SITES = catalog.placements.map((place) => ({
  ...place,
  groundFootprint: place.groundFootprint as [number, number],
}));
export function selectedDiorama(name: string | null) {
  return DIORAMA_SITES.find((place) => place.scene === name);
}
export function dioramaPlacements(): EarthDioramaSpec[] {
  return DIORAMA_SITES.map((place) => ({
    ...place,
    groundFootprint: place.groundFootprint as [number, number],
    load: (signal) => loadDiorama(place.scene, signal),
  }));
}

/** World Explorer composes its own terrain loop, so it uses the same Earth director directly. */
export function createExplorerDioramas(enabled: boolean): EarthDioramaDirector {
  return new EarthDioramaDirector(
    { placements: enabled ? dioramaPlacements() : [], maxActive: 2 },
    (error, id) => console.warn(`Diorama ${id}:`, error),
  );
}
