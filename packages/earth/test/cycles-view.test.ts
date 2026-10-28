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

it('spawns, boards and switches all six cycle types through the public Earth view', async () => {
  const types = createTypeLibrary([
    JSON.parse(
      readFileSync(
        new URL('../../../content/entities/types/cycle.types.json', import.meta.url),
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
        throw new Error('No GLBs needed for the headless controller test');
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
  });
  try {
    await pump(10);
    const messages: string[] = [];
    view.on('message', ({ text }) => messages.push(text));
    view.walker.setAvatar({ figure: { preset: 'human.adult' } });
    for (const type of types.idsWith('vehicle')) {
      expect(view.setMode('drive', { vehicle: type, force: true })).toBe(true);
      await pump(60);
      expect(view.vehicleStatus()?.kind, `${type}: ${messages.join('; ')}`).toBe('car');
      expect(view.vehicleStatus()?.label).toBe(
        types.component<{ spec: { label: string } }>(type, 'vehicle').spec.label,
      );
      expect(view.getCamera().mode).toBe('drive');
      expect(view.interactable().id).toBeDefined();
      view.input.map.setVirtual('test', 'nav-forward', 1);
      await pump(30);
      const normal = view.vehicleStatus();
      const normalSpeed = normal && normal.kind !== 'aircraft' ? normal.speed : 0;
      expect(normalSpeed).toBeGreaterThan(0);
      view.setBoostMode(true);
      await pump(2);
      const boosted = view.vehicleStatus();
      expect(boosted && boosted.kind !== 'aircraft' ? boosted.speed : 0).toBeGreaterThan(
        normalSpeed * 3.8,
      );
      view.input.map.clearVirtual('test');
      view.setBoostMode(false);
    }
    view.input.map.setVirtual('test', 'nav-jump', 1);
    await pump(180);
    view.input.map.clearVirtual('test');
    expect(view.setMode('walk')).toBe(true);
    expect(view.vehicleStatus()).toBeUndefined();
  } finally {
    view.dispose();
  }
});
