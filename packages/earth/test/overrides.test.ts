import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import { createMapOverrideSet, mapOverridePoint } from '@bendyline/molen-worldgen-earth/kernel';
import { describe, expect, it, vi } from 'vitest';
import {
  bindMapOverrideEntities,
  bindMapOverrides,
  type EarthOverride,
  MAP_OVERRIDE_REFRESH_MARGIN,
  type MapOverrideBindingChange,
} from '../src/client/overrides';

const NEEDLE: [number, number] = [-122.3493, 47.62051];
const lot = (extra: Partial<EarthOverride> = {}): EarthOverride => ({
  id: 'lot',
  area: { center: NEEDLE, size: [80, 60] },
  buildings: [{ id: 'shed', rect: { size: [48, 30] }, height: 9 }],
  ...extra,
});
/** Let the microtasks a change queued run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('map overrides bound to a terrain stream', () => {
  function bound(metersPerUnit = 0.674) {
    const set = createMapOverrideSet<EarthOverride>();
    const order: string[] = [];
    const releases: Array<() => void> = [];
    const refreshLayers = vi.fn(
      (_refresh: { bounds: readonly number[]; layers?: readonly string[] }) => {
        order.push('refresh');
        return new Promise<void>((resolve) => releases.push(resolve));
      },
    );
    const supersede = vi.fn(() => {
      order.push('supersede');
    });
    const changes: MapOverrideBindingChange[] = [];
    const errors: unknown[] = [];
    const binding = bindMapOverrides(set, {
      stream: { refreshLayers },
      metersPerUnit,
      layers: [
        { id: 'land-classification', category: 'classification' },
        { id: 'water-features', category: 'hydrology' },
        { id: 'human-features', category: 'human-feature' },
      ],
      worldgen: { supersede },
      onChange: (change) => changes.push(change),
      onError: (error) => errors.push(error),
    });
    const release = (): void => {
      for (const resolve of releases.splice(0)) resolve();
    };
    return {
      set,
      binding,
      refreshLayers,
      supersede,
      order,
      changes,
      errors,
      release,
      metersPerUnit,
    };
  }

  it('builds the land cover and human-feature tiles around a change again', async () => {
    const { set, binding, refreshLayers, supersede, order, changes, release, metersPerUnit } =
      bound();
    set.set(lot());
    expect(binding.pending).toBe(1);
    // Nothing is asked of the stream until the task that made the change is over.
    expect(refreshLayers).not.toHaveBeenCalled();
    await settle();
    expect(order).toEqual(['supersede', 'refresh']);
    const refresh = refreshLayers.mock.calls[0]?.[0];
    expect(refresh?.layers).toEqual(['land-classification', 'human-features']);
    // The override's own ground in this stream's frame, and a margin for the tiles beside it.
    const geo = set.resolved('lot')?.geoBounds as readonly [number, number, number, number];
    const [minX, minZ] = wgs84ToWorld(metersPerUnit, geo[0], geo[3]);
    const [maxX, maxZ] = wgs84ToWorld(metersPerUnit, geo[2], geo[1]);
    expect(refresh?.bounds[0]).toBeCloseTo(minX - MAP_OVERRIDE_REFRESH_MARGIN, 6);
    expect(refresh?.bounds[1]).toBeCloseTo(minZ - MAP_OVERRIDE_REFRESH_MARGIN, 6);
    expect(refresh?.bounds[2]).toBeCloseTo(maxX + MAP_OVERRIDE_REFRESH_MARGIN, 6);
    expect(refresh?.bounds[3]).toBeCloseTo(maxZ + MAP_OVERRIDE_REFRESH_MARGIN, 6);
    expect(maxX - minX).toBeCloseTo(80, 0);
    expect(supersede).toHaveBeenCalledWith(refresh?.bounds);
    expect(changes).toEqual([
      { state: 'pending', ids: ['lot'], revision: 1, bounds: [refresh?.bounds] },
    ]);
    // Applied only once the stream has swapped the tiles in.
    let applied = false;
    void binding.whenApplied().then(() => {
      applied = true;
    });
    await settle();
    expect(applied).toBe(false);
    release();
    await settle();
    expect(applied).toBe(true);
    expect(binding.pending).toBe(0);
    expect(changes.at(-1)).toMatchObject({ state: 'applied', ids: ['lot'], revision: 1 });
  });

  it('applies the changes of one task together, old ground and new', async () => {
    const { set, binding, refreshLayers, changes, release } = bound();
    set.set(lot());
    await settle();
    release();
    await settle();
    refreshLayers.mockClear();
    changes.length = 0;
    // Moved, and another added, in one task.
    set.set(lot({ area: { center: [NEEDLE[0] + 0.01, NEEDLE[1]], size: [80, 60] } }));
    set.set(lot({ id: 'other', area: { center: [NEEDLE[0], NEEDLE[1] + 0.01], size: [40, 40] } }));
    expect(binding.pending).toBe(1);
    await settle();
    // Where the first stood, where it stands now, and the second's ground.
    expect(refreshLayers).toHaveBeenCalledTimes(3);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ state: 'pending', ids: ['lot', 'other'], revision: 3 });
    release();
    await binding.whenApplied();
    expect(changes).toHaveLength(2);
  });

  it('leaves the tiles alone when only what a host bundles with an override changed', async () => {
    const { set, binding, refreshLayers, supersede, changes, release } = bound();
    const first = lot();
    set.set(first);
    await settle();
    release();
    await settle();
    refreshLayers.mockClear();
    supersede.mockClear();
    changes.length = 0;
    set.set({ ...first, actors: [{ id: 'guard', figure: { type: 'x' }, position: [0, 0] }] });
    await binding.whenApplied();
    expect(refreshLayers).not.toHaveBeenCalled();
    expect(supersede).not.toHaveBeenCalled();
    expect(changes.map((change) => [change.state, change.bounds.length])).toEqual([
      ['pending', 0],
      ['applied', 0],
    ]);
  });

  it('reports a failed refresh and still settles; disposed, it follows the set no more', async () => {
    const set = createMapOverrideSet<EarthOverride>();
    const errors: unknown[] = [];
    const refreshLayers = vi.fn(async () => {
      throw new Error('stream gone');
    });
    const binding = bindMapOverrides(set, {
      stream: { refreshLayers },
      metersPerUnit: 1,
      layers: [{ id: 'human-features', category: 'human-feature' }],
      onError: (error) => errors.push(error),
    });
    set.set(lot());
    await binding.whenApplied();
    expect(errors).toHaveLength(1);
    expect(binding.pending).toBe(0);
    // A change still waiting for its task to end is settled by disposal, not left hanging.
    set.delete('lot');
    binding.dispose();
    await binding.whenApplied();
    set.set(lot());
    await settle();
    expect(refreshLayers).toHaveBeenCalledTimes(1);
  });
});

describe('the entities a map override brings', () => {
  function sinks() {
    const calls: string[] = [];
    const actors = new Map<string, Record<string, unknown>>();
    const vehicles = new Map<string, Record<string, unknown>>();
    const dioramas = new Map<string, Record<string, unknown>>();
    return {
      calls,
      actors,
      vehicles,
      dioramas,
      sinks: {
        actors: {
          add(spec: Record<string, unknown>) {
            calls.push(`+actor ${spec.id}`);
            actors.set(spec.id as string, spec);
            return spec.id as string;
          },
          remove(id: string) {
            calls.push(`-actor ${id}`);
            actors.delete(id);
          },
        },
        vehicles: {
          spawn(spec: Record<string, unknown>) {
            if (spec.type === 'unknown') throw new Error('unknown vehicle type');
            calls.push(`+vehicle ${spec.id}`);
            vehicles.set(spec.id as string, spec);
            return spec.id as string;
          },
          remove(id: string) {
            calls.push(`-vehicle ${id}`);
            vehicles.delete(id);
          },
        },
        dioramas: {
          add(spec: Record<string, unknown>) {
            calls.push(`+scene ${spec.id}`);
            dioramas.set(spec.id as string, spec);
          },
          remove(id: string) {
            calls.push(`-scene ${id}`);
            dioramas.delete(id);
          },
        },
      } as never,
    };
  }
  const load = (async () => ({ scene: {}, bounds: [0, 0, 0, 1, 1, 1] })) as never;
  const campus = (extra: Partial<EarthOverride> = {}): EarthOverride =>
    lot({
      area: { center: NEEDLE, size: [80, 60], heading: Math.PI / 2 },
      actors: [
        {
          id: 'teacher',
          figure: { preset: 'human.adult' } as never,
          position: [0, -10],
          heading: 0.5,
        },
        {
          id: 'pupil',
          figure: { preset: 'human.child' } as never,
          position: [5, 0],
          behaviour: { kind: 'wander', radius: 12 },
        },
        {
          id: 'runner',
          figure: { type: 'my.runner' },
          position: [0, 0],
          behaviour: { kind: 'goTo', to: [0, -20], arriveWithin: 2 },
          interactable: true,
        },
      ],
      vehicles: [
        { id: 'bus', type: 'molen.entities.vehicle.bus', position: [-20, 10], color: '#ffcc00' },
      ],
      scene: { load, yaw: 0.25 },
      ...extra,
    });

  it('adds what the overrides already in the set declare, laid out in their frame', () => {
    const set = createMapOverrideSet([campus()]);
    const { sinks: target, actors, vehicles, dioramas } = sinks();
    bindMapOverrideEntities(set, target);
    const frame = { center: NEEDLE, heading: Math.PI / 2 };
    const [lon, lat] = mapOverridePoint(frame, [0, -10]);
    expect(actors.get('lot/teacher')).toMatchObject({ longitude: lon, latitude: lat });
    // Ten meters toward the frame's -z, which at heading east is east: the same latitude.
    expect(lat).toBeCloseTo(NEEDLE[1], 6);
    expect(lon).toBeGreaterThan(NEEDLE[0]);
    // Compass headings add up; a wanderer strolls around where it stands; a walk goes to a frame point.
    expect(actors.get('lot/teacher')?.heading).toBeCloseTo(Math.PI / 2 + 0.5);
    const pupil = actors.get('lot/pupil');
    expect(pupil?.behaviour).toEqual({
      kind: 'wander',
      around: { latitude: pupil?.latitude, longitude: pupil?.longitude },
      radius: 12,
    });
    const [toLon, toLat] = mapOverridePoint(frame, [0, -20]);
    expect(actors.get('lot/runner')).toMatchObject({
      figure: { type: 'my.runner' },
      behaviour: { kind: 'goTo', to: { latitude: toLat, longitude: toLon }, arriveWithin: 2 },
      interactable: true,
    });
    expect(actors.get('lot/teacher')).not.toHaveProperty('behaviour');
    expect(vehicles.get('lot/bus')).toMatchObject({
      type: 'molen.entities.vehicle.bus',
      color: '#ffcc00',
      heading: Math.PI / 2,
    });
    // A diorama's yaw turns the other way from a compass heading; it stands on the rectangle.
    const scene = dioramas.get('lot/scene');
    expect(scene?.yaw).toBeCloseTo(0.25 - Math.PI / 2);
    expect(scene?.groundFootprint).toEqual([40, 30]);
    expect(scene?.load).toBe(load);
    expect(scene?.latitude).toBeCloseTo(NEEDLE[1], 9);
    expect(scene?.longitude).toBeCloseTo(NEEDLE[0], 9);
  });

  it('waits for the ground before parking a vehicle, and gives up if the override changed again', async () => {
    const set = createMapOverrideSet<EarthOverride>();
    const { sinks: target, calls, vehicles } = sinks();
    let ground!: () => void;
    const whenApplied = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          ground = resolve;
        }),
    );
    bindMapOverrideEntities(set, target, { whenApplied });
    set.set(campus());
    // People and the scene at once; the bus once what stood there is gone.
    expect(calls).toEqual([
      '+actor lot/teacher',
      '+actor lot/pupil',
      '+actor lot/runner',
      '+scene lot/scene',
    ]);
    ground();
    await settle();
    expect(vehicles.has('lot/bus')).toBe(true);
    // Removed while a re-set's vehicle was still waiting: it is never parked.
    set.set(
      campus({ vehicles: [{ id: 'van', type: 'molen.entities.vehicle.van', position: [0, 0] }] }),
    );
    expect(vehicles.has('lot/bus')).toBe(false);
    const late = ground;
    set.delete('lot');
    late();
    await settle();
    expect(vehicles.size).toBe(0);
    expect(calls.filter((call) => call.includes('van'))).toEqual([]);
  });

  it('keeps what did not change when an override is set again, and replaces all when it moved', () => {
    const first = campus();
    const set = createMapOverrideSet([first]);
    const { sinks: target, calls, actors, dioramas } = sinks();
    bindMapOverrideEntities(set, target);
    calls.length = 0;
    const firstActors = first.actors ?? [];
    // One actor's declaration changed, one went, one came; the rest is the same.
    set.set({
      ...first,
      actors: [
        firstActors[0] as never,
        { ...(firstActors[1] as object), behaviour: { kind: 'idle' } } as never,
        { id: 'dog', figure: { preset: 'dog' } as never, position: [2, 2] },
      ],
    });
    expect(calls).toEqual([
      '-actor lot/pupil',
      '-actor lot/runner',
      '+actor lot/pupil',
      '+actor lot/dog',
    ]);
    expect(actors.get('lot/pupil')).not.toHaveProperty('behaviour');
    // The scene's loader is compared by identity, its data by value.
    calls.length = 0;
    set.set({ ...set.get('lot'), scene: { load, yaw: 0.25 } } as EarthOverride);
    expect(calls).toEqual([]);
    set.set({
      ...set.get('lot'),
      scene: { load: (async () => ({})) as never, yaw: 0.25 },
    } as EarthOverride);
    expect(calls).toEqual(['-scene lot/scene', '+scene lot/scene']);
    // Moved: nothing stands where it was declared any more.
    calls.length = 0;
    set.set({
      ...set.get('lot'),
      area: { center: [NEEDLE[0] + 0.001, NEEDLE[1]], size: [80, 60], heading: Math.PI / 2 },
    } as EarthOverride);
    expect(calls.filter((call) => call.startsWith('-')).sort()).toEqual([
      '-actor lot/dog',
      '-actor lot/pupil',
      '-actor lot/teacher',
      '-scene lot/scene',
      '-vehicle lot/bus',
    ]);
    expect(calls.filter((call) => call.startsWith('+'))).toHaveLength(5);
    expect(dioramas.get('lot/scene')?.longitude).toBeCloseTo(NEEDLE[0] + 0.001, 9);
    // Gone with the override.
    calls.length = 0;
    set.delete('lot');
    expect(calls.every((call) => call.startsWith('-'))).toBe(true);
    expect(calls).toHaveLength(5);
  });

  it('reports what it could not add and carries on; resync fills a sink that was replaced', () => {
    const errors: string[] = [];
    const set = createMapOverrideSet([
      campus({
        vehicles: [
          { id: 'ghost', type: 'unknown', position: [0, 0] },
          { id: 'bus', type: 'molen.entities.vehicle.bus', position: [-20, 10] },
        ],
      }),
    ]);
    const { sinks: target, calls, vehicles, dioramas } = sinks();
    const entities = bindMapOverrideEntities(set, target, {
      onError: (_error, context) => errors.push(context),
    });
    expect(errors).toEqual(['override vehicle lot/ghost']);
    expect(vehicles.has('lot/bus')).toBe(true);
    // A host that rebuilt its scene director asks for its scenes again: added, not removed first.
    dioramas.clear();
    calls.length = 0;
    entities.resync('dioramas');
    expect(calls).toEqual(['+scene lot/scene']);
    // Without the sink for a kind, that kind is skipped.
    const actorsOnly = sinks();
    bindMapOverrideEntities(set, { actors: (actorsOnly.sinks as { actors: never }).actors });
    expect(actorsOnly.calls.every((call) => call.startsWith('+actor'))).toBe(true);
    // Disposed, it follows the set no more, and leaves what it added in place.
    entities.dispose();
    calls.length = 0;
    set.delete('lot');
    expect(calls).toEqual([]);
  });
});
