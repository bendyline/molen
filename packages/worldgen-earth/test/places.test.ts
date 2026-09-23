import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { Vec3 } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { createInThreadWorldgenGenerator } from '../src/client/generators';
import { createWorldgenWorkerBridge, type WorkerLike } from '../src/client/worker-bridge';
import { createPlacesContent, type PlacesContentDocs } from '../src/kernel/places';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import type { WorldgenWorkerResult } from '../src/kernel/worker-protocol';
import { installWorldgenWorker } from '../src/worker';
import { loadDefaultPack, loadDefaultPlacesDocs } from './helpers/pack';

const pack = await loadDefaultPack();
const docs = await loadDefaultPlacesDocs();

const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 100,
  metersPerUnit: 1,
  levelBelowMax: 0,
};

/** One building with a Safeway inside, next to a road. */
function tile(): TerrainSemanticTile {
  const t = createEmptyTerrainSemanticTile();
  t.buildings = [
    {
      id: 1,
      class: 'building',
      height: 6,
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.8, 0.1],
            [0.8, 0.5],
            [0.1, 0.5],
          ],
        },
      ],
    },
  ];
  t.transportation = [
    {
      class: 'minor_road',
      lines: [
        [
          [0, 0.6],
          [1, 0.6],
        ],
      ],
    },
  ];
  t.pois = [{ id: 1, class: 'supermarket', name: 'Safeway', point: [0.4, 0.3] }];
  return t;
}

/** The shipped catalog without its Safeway identity. */
function withoutSafeway(source: PlacesContentDocs): PlacesContentDocs {
  const businesses = structuredClone(source.businesses) as { profiles: { id: string }[] };
  businesses.profiles = businesses.profiles.filter((profile) => profile.id !== 'safeway');
  return { landmarks: source.landmarks, businesses };
}

describe('places content', () => {
  it('builds the default content from raw documents with the pinned hashes', () => {
    const places = createPlacesContent(docs);
    expect(places.landmarks.hash).toBe(
      'sha256:9736a490e9a85edbe0b41ba8198ea62321eb6ae9bdced3642a4f03087d5f638c',
    );
    expect(places.businesses.hash).toBe(
      'sha256:68e93df7a0e1b17030909c2b5d80cd91ea550639fc7cf81b89a8fe4e06d7a927',
    );
  });

  it('recognizes no businesses and places no furniture without places content', () => {
    const t = tile();
    t.pois?.push({ id: 2, class: 'bench', point: [0.9, 0.9] });
    const withPlaces = semanticTileToBatch(t, geom, { pack, places: createPlacesContent(docs) });
    expect(withPlaces.buildings[0]?.storefronts).toHaveLength(1);
    expect(withPlaces.props?.map((p) => p.model)).toEqual(['builtin:bench']);
    const without = semanticTileToBatch(t, geom, { pack });
    expect(without.buildings[0]?.storefronts).toBeUndefined();
    expect(without.props).toEqual([]);
  });

  it('uses the injected catalog when it differs', () => {
    const shipped = semanticTileToBatch(tile(), geom, { pack, places: createPlacesContent(docs) });
    const custom = createPlacesContent(withoutSafeway(docs));
    const without = semanticTileToBatch(tile(), geom, { pack, places: custom });
    expect(shipped.buildings[0]?.appearance?.trim).toBe('#b82b35');
    expect(without.buildings[0]?.appearance?.trim).not.toBe('#b82b35');
    expect(custom.businesses.resolve({ class: 'supermarket', name: 'Safeway' })?.profile).toBe(
      undefined,
    );
  });

  it('reaches a worker as documents', async () => {
    const request = {
      tile: tile(),
      geom,
      ground: {
        sampleHeight: () => 10,
        slopeAt: () => 0,
        normalAt: (): Vec3 => [0, 1, 0],
      },
      resolution: 17,
      features: { buildings: true, scatter: false },
    };
    const signal = new AbortController().signal;
    const inThread = await createInThreadWorldgenGenerator(pack, {
      places: createPlacesContent(docs),
    }).generate(request, signal);
    const same = createWorldgenWorkerBridge(fakeWorker(), { pack, metersPerUnit: 1, places: docs });
    expect((await same.generate(request, signal))?.hash).toBe(inThread?.hash);
    same.dispose();
    const custom = createWorldgenWorkerBridge(fakeWorker(), {
      pack,
      metersPerUnit: 1,
      places: withoutSafeway(docs),
    });
    expect((await custom.generate(request, signal))?.hash).not.toBe(inThread?.hash);
    custom.dispose();
  });
});

/** In-memory worker: the handler on one side, a `WorkerLike` on the other. */
function fakeWorker(): WorkerLike {
  const listeners = new Set<(event: { data: unknown }) => void>();
  let inbound: ((event: { data: unknown }) => void) | undefined;
  installWorldgenWorker({
    postMessage: (message) => {
      for (const listener of listeners) listener({ data: message as WorldgenWorkerResult });
    },
    addEventListener: (_type, listener) => {
      inbound = listener;
    },
  });
  return {
    postMessage: (message) => inbound?.({ data: message }),
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
}
