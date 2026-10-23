import {
  createEmptyTerrainSemanticTile,
  type TerrainPyramidTileLayerContext,
  type TerrainRoadSignPatternId,
  type TerrainRoadSignProfile,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';

export interface RoadSignGalleryCase {
  pattern: TerrainRoadSignPatternId;
  tile: TerrainSemanticTile;
  tags: Record<string, string>;
  caption: string;
}

export function roadSignGalleryContext(): TerrainPyramidTileLayerContext {
  return {
    tileSize: 400,
    origin: [0, 0],
    address: { level: 3, x: 0, z: 0 },
    pyramid: { maxLevel: 3 },
    heightfield: new Heightfield(new Float32Array(4), 2, 2, {
      origin: [0, 0],
      worldSize: [400, 400],
      height: { min: 0, max: 1 },
    }),
    signal: new AbortController().signal,
  } as TerrainPyramidTileLayerContext;
}

/** Synthetic map inputs are fed through the production detector, never hand-drawn sign mocks. */
export function roadSignGalleryCases(
  profile?: Readonly<TerrainRoadSignProfile>,
): RoadSignGalleryCase[] {
  const cross = (): TerrainSemanticTile => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation = [
      {
        id: 'example:oak',
        class: 'minor_road',
        subclass: 'residential',
        width: 8,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
      {
        id: 'example:pine',
        class: 'minor_road',
        subclass: 'residential',
        width: 8,
        lines: [
          [
            [0.5, 0],
            [0.5, 1],
          ],
        ],
      },
    ];
    return tile;
  };
  const highway = (ramp = true): TerrainSemanticTile => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation = [
      {
        id: 'example:interstate',
        class: 'highway',
        subclass: 'motorway',
        oneway: true,
        ref: 'I 90',
        destination: 'Eastbound',
        lanes: 3,
        width: 11,
        maxspeed: '65 mph',
        lines: [
          [
            [0.05, 0.4],
            [0.95, 0.4],
          ],
        ],
      },
    ];
    if (ramp)
      tile.transportation.push({
        id: 'example:exit-17b',
        class: 'highway',
        subclass: 'motorway_link',
        oneway: true,
        link: true,
        width: 4.5,
        junctionRef: '17B',
        destination: 'Lake City;Downtown',
        lines: [
          [
            [0.6, 0.4],
            [0.75, 0.55],
            [0.95, 0.65],
          ],
        ],
      });
    return tile;
  };
  const stop = cross();
  stop.pois = [{ class: 'stop', point: [0.47, 0.5] }];
  const yieldTile = cross();
  yieldTile.pois = [{ class: 'give_way', point: [0.47, 0.5] }];
  const speed = cross();
  Object.assign(speed.transportation[0] as TerrainTransportationFeature, { maxspeed: '25 mph' });
  const attraction = highway();
  Object.assign(attraction.transportation[1] as TerrainTransportationFeature, {
    destination: 'Lake City;Cedar Lake;State Park',
    destinationColour: 'green;brown;brown',
  });
  const exitTags = {
    highway: 'motorway_link',
    destination: 'Lake City;Downtown',
    'junction:ref': '17B',
  };
  const cases: RoadSignGalleryCase[] = [
    {
      pattern: 'highway-overhead',
      tile: highway(),
      tags: exitTags,
      caption:
        'A connected departure supplies the exit direction; the map supplies the name and number.',
    },
    {
      pattern: 'highway-exit',
      tile: highway(),
      tags: exitTags,
      caption: 'A smaller two-post board confirms the exit alongside its ramp.',
    },
    {
      pattern: 'all-way-stop',
      tile: cross(),
      tags: { highway: 'residential', controls: '(absent)' },
      caption: 'This sparse-map example produces four STOP signs, one for every incoming approach.',
    },
    {
      pattern: 'street-speed',
      tile: speed,
      tags: { highway: 'residential', maxspeed: '25 mph' },
      caption: 'The literal posted limit and its units are preserved.',
    },
    {
      pattern: 'freeway-speed',
      tile: highway(false),
      tags: { highway: 'motorway', maxspeed: '65 mph' },
      caption: 'A panel 40% larger than the street version, placed beyond the freeway shoulder.',
    },
    {
      pattern: 'yield',
      tile: yieldTile,
      tags: { highway: 'give_way' },
      caption: 'Only the approach carrying the mapped give-way control receives a sign.',
    },
    {
      pattern: 'attraction',
      tile: attraction,
      tags: {
        destination: 'Lake City;Cedar Lake;State Park',
        'destination:colour': 'green;brown;brown',
        'junction:ref': '17B',
      },
      caption:
        'Brown destinations get their own board. The green city destination stays on the exit sign.',
    },
    {
      pattern: 'minor-stop',
      tile: stop,
      tags: { highway: 'stop' },
      caption: 'A mapped approach stop does not turn the whole intersection into an all-way stop.',
    },
    {
      pattern: 'route-guide',
      tile: highway(false),
      tags: { highway: 'motorway', ref: 'I 90', destination: 'Eastbound' },
      caption: 'The route label uses the source reference; it does not invent a numbered shield.',
    },
  ];
  if (profile)
    for (const sample of cases) {
      if (sample.pattern === 'all-way-stop' && !profile.inferStopSigns) {
        sample.tile.pois = [{ class: 'stop', stop: 'all', point: [0.5, 0.5] }];
        sample.tags = { highway: 'stop', stop: 'all' };
        sample.caption =
          'A mapped all-way control covers four approaches. This region does not infer stops from a local crossroads.';
      }
      for (const road of sample.tile.transportation) {
        if (road.maxspeed)
          road.maxspeed =
            profile.speedUnit === 'MPH'
              ? road.subclass === 'motorway'
                ? profile.id === 'gb'
                  ? '70 mph'
                  : '65 mph'
                : profile.id === 'gb'
                  ? '30 mph'
                  : '25 mph'
              : road.subclass === 'motorway'
                ? '110'
                : '50';
        if (road.ref)
          road.ref =
            (
              { us: 'I 90', gb: 'M1', de: 'A 8', fr: 'A6', it: 'A1', ch: 'A1' } as Record<
                string,
                string
              >
            )[profile.id] ?? (profile.stateNetwork ? 'I 90' : 'R1');
      }
      if (sample.tags.maxspeed)
        sample.tags.maxspeed = sample.tile.transportation.find((r) => r.maxspeed)?.maxspeed ?? '';
      if (sample.tags.ref) sample.tags.ref = sample.tile.transportation[0]?.ref ?? '';
    }
  if (!profile || profile.id === 'us' || profile.stateNetwork) {
    const tile = createEmptyTerrainSemanticTile();
    const network = profile?.stateNetwork ?? 'US:WA';
    tile.transportation = [
      {
        id: 'example:state-route',
        class: 'major_road',
        subclass: 'primary',
        network,
        shieldText: '28',
        ref: '28',
        width: 9,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    cases.push({
      pattern: 'route-marker',
      tile,
      tags: { network, shield_text: '28' },
      caption:
        'A source route number inside the state’s marker. Number 28 is a synthetic example; the network selects the artwork.',
    });
  }
  return cases;
}
