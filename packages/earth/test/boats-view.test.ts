import { readFileSync } from 'node:fs';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EarthContent } from '../src/client/content';
import { FLAT_ARCHIVE, FLAT_EARTH, fakeCanvas, pump, stubFrameGlobals } from './view-harness';

vi.mock('@bendyline/molen-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bendyline/molen-client')>();
  const { stubCreateViewer } = await import('./view-harness');
  return { ...actual, applyEnvironment: () => {}, createViewer: stubCreateViewer(actual) };
});
const { mountEarthView } = await import('../src/client/earth-view');
beforeEach(stubFrameGlobals);
afterEach(() => vi.unstubAllGlobals());
it('offers boats through the geographic owned-vehicle API and seats actor passengers', async () => {
  const types = createTypeLibrary([
    JSON.parse(
      readFileSync(
        new URL('../../../content/entities/types/watercraft.types.json', import.meta.url),
        'utf8',
      ),
    ),
  ]);
  const content = {
    types,
    parkedVehicles: [],
    assets: { load: async () => new Uint8Array(), loadText: async () => '' },
    stars: async () => [],
    packs: {
      readBytes: async () => {
        throw new Error('No models in this headless view');
      },
    },
  } as unknown as EarthContent;
  const view = await mountEarthView({
    canvas: fakeCanvas() as unknown as HTMLCanvasElement,
    terrain: FLAT_EARTH,
    archives: { elevation: FLAT_ARCHIVE },
    content,
    ambient: false,
    audio: false,
    style: { sky: false },
    camera: { latitude: 47.6, longitude: -122.33, range: 500 },
    waterAt: () => ({ height: 100, depth: 10 }),
    water: { waves: [] },
  });
  try {
    const id = view.vehicles.spawn({
      type: 'molen.entities.watercraft.speedboat',
      latitude: 47.6,
      longitude: -122.33,
      heading: 0,
    });
    await pump(20);
    await view.vehicles.whenPlaced(id);
    expect(view.vehicles.pose(id)?.kind).toBe('boat');
    expect(view.vehicles.board(id, { force: true })).toBe(true);
    await pump(3);
    expect(view.vehicleStatus()?.kind).toBe('boat');
    expect(view.mode).toBe('drive');
    const actor = view.actors.add({
      figure: { preset: 'human.adult' },
      latitude: 47.6,
      longitude: -122.33,
    });
    view.actors.setBehaviour(actor, { kind: 'board', vehicle: id, force: true });
    await pump(10);
    expect(view.actors.pose(actor)?.mounted?.vehicle).toBe(id);
    view.vehicles.release();
    expect(view.vehicles.pose(id)?.placed).toBe(true);
    expect(view.actors.pose(actor)?.mounted?.vehicle).toBe(id);
  } finally {
    view.dispose();
  }
});
