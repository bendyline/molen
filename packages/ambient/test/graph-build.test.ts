import { describe, expect, it } from 'vitest';
import {
  laneSample,
  networkToDocument,
  sampleLaneBody,
  TRANSPORT_NETWORK_EXAMPLE,
  TransportNetwork,
} from '../src/kernel';
import { gridDocument, streetFeature } from './helpers';

describe('transport graph', () => {
  it('shares complete airport runways across streamed tiles without creating car lanes', () => {
    const net = new TransportNetwork();
    for (const [key, originZ] of [
      ['north', 0],
      ['south', 1000],
    ] as const) {
      net.registerTile({
        key,
        origin: [0, originZ],
        tileSize: 1000,
        features: [
          streetFeature([0.5, -originZ / 1000], [0.5, (3000 - originZ) / 1000], {
            class: 'aeroway',
            subclass: 'runway',
            width: 60,
          }),
          streetFeature([0.6, 0], [0.6, 1], { class: 'aeroway', subclass: 'taxiway' }),
        ],
      });
    }
    expect(net.runways()).toHaveLength(1);
    expect(net.runways()[0]).toMatchObject({ ax: 500, az: 0, bx: 500, bz: 3000 });
    expect([...net.edgeList()]).toHaveLength(0);
    net.unregisterTile('north');
    expect(net.runways()).toHaveLength(1);
    net.unregisterTile('south');
    expect(net.runways()).toHaveLength(0);
  });

  it('keeps regional lanes and turn permissions in one network, including export and reload', () => {
    const net = new TransportNetwork();
    for (const [index, drivingSide] of (['left', 'right'] as const).entries()) {
      net.registerTile({
        key: drivingSide,
        origin: [index * 1000, 0],
        tileSize: 200,
        drivingSide,
        features: [
          streetFeature([0, 0.5], [1, 0.5], { lanes: 4, width: 12 }),
          streetFeature([0.5, 0], [0.5, 1], { lanes: 4, width: 12 }),
        ],
      });
    }
    const check = (network: TransportNetwork) => {
      let turns = 0;
      for (const edge of network.edgeList()) {
        const expected = (edge.path.points[0]?.[0] ?? 0) < 500 ? 'left' : 'right';
        expect(edge.drivingSide).toBe(expected);
        for (const id of edge.lanes) {
          const lane = network.lane(id);
          if (lane?.class !== 'road') continue;
          expect(Math.sign(lane.offset)).toBe(expected === 'left' ? -1 : 1);
          for (const move of lane.next) {
            if (move.turn !== 'left' && move.turn !== 'right') continue;
            turns++;
            expect(lane.index).toBe(move.turn === expected ? 1 : 0);
            expect(move.weight).toBe(move.turn === expected ? 2 : 1.5);
          }
        }
      }
      expect(turns).toBeGreaterThan(0);
    };
    check(net);
    const restored = new TransportNetwork();
    restored.addDocument(networkToDocument(net));
    check(restored);
    net.unregisterTile('right');
    check(net);
  });

  it('honours document and way driving sides without reversing one-way travel', () => {
    const net = new TransportNetwork();
    net.addDocument({
      format: 'molen/transport-network@1',
      drivingSide: 'left',
      ways: [
        {
          class: 'road',
          points: [
            [0, 0],
            [100, 0],
          ],
          lanes: 2,
        },
        {
          class: 'road',
          points: [
            [0, 50],
            [100, 50],
          ],
          lanes: 2,
          drivingSide: 'right',
        },
        {
          class: 'road',
          points: [
            [0, 100],
            [100, 100],
          ],
          lanes: 2,
          oneway: true,
        },
      ],
    });
    const edges = [...net.edgeList()];
    expect(edges.map((e) => e.drivingSide)).toEqual(['left', 'right', 'left']);
    const oneway = edges.find((e) => e.oneway);
    expect(oneway).toBeDefined();
    for (const id of oneway?.lanes ?? []) {
      const lane = net.lane(id);
      expect(lane?.dir).toBe(1);
      expect(net.sampleLane(id, 20)?.dx).toBeGreaterThan(0.99);
    }
    expect(net.lane(oneway?.lanes[0] ?? '')?.offset).toBeGreaterThan(0);
    net.addPolyline({
      class: 'path',
      points: [
        [0, 150],
        [100, 150],
      ],
      drivingSide: 'left',
    });
    const restored = new TransportNetwork();
    restored.addDocument(networkToDocument(net));
    const path = [...restored.edgeList()].find((e) => e.class === 'walk');
    expect(path?.drivingSide).toBe('left');
    expect(restored.lane(path?.lanes[0] ?? '')?.offset).toBeLessThan(0);
  });
  it('requires two arterials for inferred lights and accepts mapped stop and signal controls', () => {
    const build = (
      subclass: string,
      pois: Parameters<TransportNetwork['registerTile']>[0]['pois'] = [],
    ) => {
      const net = new TransportNetwork();
      net.registerTile({
        key: 'controls',
        origin: [0, 0],
        tileSize: 200,
        heightAt: () => 0,
        features: [
          streetFeature([0, 0.5], [1, 0.5], { subclass: 'primary', width: 12 }),
          streetFeature([0.5, 0], [0.5, 1], { subclass, width: 8 }),
        ],
        pois,
      });
      return [...net.junctionList()][0];
    };
    expect(build('residential')?.control).toBe('none');
    expect(build('secondary')?.control).toBe('signal');
    expect(build('residential', [{ class: 'traffic_signals', point: [0.5, 0.5] }])?.control).toBe(
      'signal',
    );
    expect(
      build('residential', [{ class: 'traffic_signals', point: [0.5, 0.5], layer: 1 }])?.control,
    ).toBe('none');
    const stopped = build('secondary', [{ class: 'stop', stop: 'all', point: [0.5, 0.5] }]);
    expect(stopped?.control).toBe('yield');
    expect(stopped?.arms.every((a) => a.yields)).toBe(true);
  });
  it('keeps ground approach lane heights aligned with an authored deck through a graph split', () => {
    const net = new TransportNetwork();
    net.registerTile({
      key: 'approach',
      origin: [0, 0],
      tileSize: 100,
      heightAt: () => 5,
      features: [
        {
          class: 'residential',
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
          bridgeConnections: [{ point: [0, 0.5], elevation: 18, radius: 20 }],
        },
        {
          class: 'residential',
          lines: [
            [
              [0.1, 0.5],
              [0.1, 0.8],
            ],
          ],
        },
      ],
    });
    const edges = [...net.edgeList()].filter((e) =>
      e.path.points.every((p) => Math.abs(p[1] - 50) < 1e-6),
    );
    expect(edges.length).toBeGreaterThan(1);
    for (const edge of edges)
      for (let i = 0; i < edge.path.points.length; i++) {
        const x = edge.path.points[i]?.[0] as number,
          t = Math.max(0, Math.min(1, x / 20));
        expect(edge.ys[i]).toBeCloseTo(5.32 + (18 - 5.32) * (1 - t * t * (3 - 2 * t)), 5);
      }
  });
  it.each([
    false,
    true,
  ])('carries sampled approach elevations through graph splits (tile parts: %s)', (parts) => {
    const net = new TransportNetwork();
    const tile: Parameters<TransportNetwork['registerTile']>[0] = {
      key: 'graded',
      origin: [1000, 2000],
      tileSize: 100,
      heightAt: () => 5,
      features: [
        {
          class: 'residential',
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
          bridgeApproachProfile: [
            { point: [0, 0.5], elevation: 18, flatness: 1 },
            { point: [0.4, 0.5], elevation: 18, flatness: 1 },
            { point: [0.8, 0.5], elevation: 5.32, flatness: 0 },
            { point: [1, 0.5], elevation: 5.32, flatness: 0 },
          ],
        },
        {
          class: 'residential',
          lines: [
            [
              [0.1, 0.5],
              [0.1, 0.8],
            ],
          ],
        },
      ],
    };
    if (parts) {
      for (const i of [0, 1])
        net.registerTile({
          ...tile,
          key: `graded:${i}`,
          bounds: [1000 + i * 50, 2000, 1050 + i * 50, 2100],
        });
    } else net.registerTile(tile);
    const edges = [...net.edgeList()].filter((e) =>
      e.path.points.every((p) => Math.abs(p[1] - 2050) < 1e-6),
    );
    expect(edges.length).toBeGreaterThan(1);
    for (const edge of edges)
      for (const [i, p] of edge.path.points.entries()) {
        const x = p[0] - 1000;
        const expected = x <= 40 ? 18 : x >= 80 ? 5.32 : 18 + ((5.32 - 18) * (x - 40)) / 40;
        expect(edge.ys[i]).toBeCloseTo(expected, 5);
      }
  });
  it('builds a signalised crossroads from a document', () => {
    const net = new TransportNetwork();
    net.addDocument(TRANSPORT_NETWORK_EXAMPLE);
    const stats = net.stats();
    expect(stats.junctions).toBe(1);
    expect(stats.signals).toBe(1);
    const junction = [...net.junctionList()][0];
    expect(junction?.arms).toHaveLength(4);
    expect(junction?.control).toBe('signal');
    expect(junction?.groups).toBe(2);
    // Opposing arms share a phase group.
    const arms = junction?.arms ?? [];
    for (const arm of arms) {
      const opposite = arms.find((o) => o !== arm && o.dx * arm.dx + o.dz * arm.dz < -0.9);
      expect(opposite?.group).toBe(arm.group);
    }
  });

  it('keeps right: an eastbound lane lies south (+Z) of an east-west centreline', () => {
    const net = new TransportNetwork({ traffic: 'right' });
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          points: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
    });
    const east = net.laneAt(50, 2, { class: 'road' });
    const west = net.laneAt(50, -2, { class: 'road' });
    expect(east).toBeDefined();
    expect(west).toBeDefined();
    const e = net.sampleLane(east?.lane ?? '', 10);
    const w = net.sampleLane(west?.lane ?? '', 10);
    expect(e?.dx).toBeCloseTo(1);
    expect(e?.z).toBeGreaterThan(0);
    expect(w?.dx).toBeCloseTo(-1);
    expect(w?.z).toBeLessThan(0);
  });

  it('keeps left when asked', () => {
    const net = new TransportNetwork({ traffic: 'left' });
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          points: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
    });
    const lane = net.laneAt(50, -2, { class: 'road' });
    const sample = net.sampleLane(lane?.lane ?? '', 10);
    expect(sample?.dx).toBeCloseTo(1);
    expect(sample?.z).toBeLessThan(0);
  });

  it('classifies turns at a four-way junction', () => {
    const net = new TransportNetwork();
    net.addDocument(gridDocument(2, 100));
    // Eastbound lane arriving at the centre junction from the west.
    const arriving = net.laneAt(-40, 2, { class: 'road' });
    const lane = net.lane(arriving?.lane ?? '');
    expect(lane).toBeDefined();
    const turns = new Set(lane?.next.map((m) => m.turn));
    expect(turns).toEqual(new Set(['straight', 'left', 'right']));
    for (const move of lane?.next ?? []) {
      const target = net.lane(move.to);
      const edge = net.edge(target?.edge ?? '');
      const start = sampleLaneBody(target as never, edge as never, 5, laneSample());
      if (move.turn === 'right') expect(start.dz).toBeGreaterThan(0.9); // south
      if (move.turn === 'left') expect(start.dz).toBeLessThan(-0.9); // north
      if (move.turn === 'straight') expect(start.dx).toBeGreaterThan(0.9);
      expect(move.junction).toBeDefined();
      expect(move.length).toBeGreaterThan(0);
    }
  });

  it('gives dead ends a U-turn and conflicts are symmetric', () => {
    const net = new TransportNetwork();
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          points: [
            [-100, 0],
            [100, 0],
          ],
        },
        {
          class: 'road',
          points: [
            [0, 0],
            [0, 80],
          ],
        },
      ],
    });
    const stub = net.laneAt(2, 60, { class: 'road' });
    const southbound = net.lane(stub?.lane ?? '');
    // The lane toward the dead end (south, +Z) turns around.
    const toEnd = southbound?.next.length === 1 ? southbound : undefined;
    const deadEndLane = toEnd ?? net.lane(net.laneAt(-2, 60, { class: 'road' })?.lane ?? '');
    expect(deadEndLane?.next.map((m) => m.turn)).toEqual(['uturn']);
    const junction = [...net.junctionList()][0];
    expect(junction).toBeDefined();
    const n = junction?.arms.length ?? 0;
    const keys = n * n;
    for (let a = 0; a < keys; a++)
      for (let b = 0; b < keys; b++)
        expect(junction?.conflicts[a * keys + b]).toBe(junction?.conflicts[b * keys + a]);
  });

  it('never connects a bridge to the road it crosses', () => {
    const net = new TransportNetwork();
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          points: [
            [-100, 0],
            [100, 0],
          ],
        },
        {
          class: 'road',
          points: [
            [0, -100],
            [0, 100],
          ],
          bridge: true,
          layer: 1,
        },
      ],
    });
    expect(net.stats().junctions).toBe(0);
  });

  it('records level crossings where rail crosses a road', () => {
    const net = new TransportNetwork();
    net.addDocument(TRANSPORT_NETWORK_EXAMPLE);
    const road = net.laneAt(2, 30, { class: 'road' });
    const lane = net.lane(road?.lane ?? '');
    expect(lane?.stops.some((s) => s.kind === 'level-crossing')).toBe(true);
    const rail = net.laneAt(0, 30, { class: 'rail' });
    expect(net.lane(rail?.lane ?? '')?.stops.some((s) => s.kind === 'station')).toBe(true);
  });

  it('infers sidewalks along streets and lets walkers cross at junctions', () => {
    const net = new TransportNetwork();
    net.registerTile({
      key: 't',
      origin: [0, 0],
      tileSize: 400,
      features: [streetFeature([0.1, 0.5], [0.9, 0.5]), streetFeature([0.5, 0.1], [0.5, 0.9])],
    });
    expect(net.stats().laneKm.walk).toBeGreaterThan(0.5);
    let crossings = 0;
    for (const id of net.laneIds()) {
      const lane = net.lane(id);
      if (lane?.class !== 'walk') continue;
      for (const move of lane.next) if (move.crosses !== undefined) crossings++;
    }
    expect(crossings).toBeGreaterThan(0);
  });

  it('makes the arm with a stop or yield sign give way', () => {
    const net = new TransportNetwork();
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          id: 'main',
          class: 'road',
          subclass: 'residential',
          points: [
            [-100, 0],
            [100, 0],
          ],
        },
        {
          id: 'side',
          class: 'road',
          subclass: 'residential',
          points: [
            [0, 0],
            [0, 100],
          ],
        },
      ],
      signals: [{ at: [2, 12], kind: 'stop' }],
    });
    const junction = [...net.junctionList()][0];
    expect(junction?.control).toBe('yield');
    const signed = junction?.arms.filter((arm) => arm.yields === true) ?? [];
    expect(signed).toHaveLength(1);
    expect(signed[0]?.dz).toBeGreaterThan(0.9);
    // The export carries the sign, and re-importing it gives way on the same arm.
    const exported = networkToDocument(net);
    expect(exported.signals?.map((s) => s.kind)).toEqual(['yield']);
    const again = new TransportNetwork();
    again.addDocument(exported);
    const arm = [...again.junctionList()][0]?.arms.find((a) => a.yields === true);
    expect(arm?.dz).toBeGreaterThan(0.9);
  });

  it('gives edges stable ids across rebuilds', () => {
    const a = new TransportNetwork();
    const b = new TransportNetwork();
    a.addDocument(gridDocument(3, 80));
    b.addDocument(gridDocument(3, 80));
    expect([...a.laneIds()]).toEqual([...b.laneIds()]);
  });
});

describe('tile stitching', () => {
  const left = {
    key: 'A',
    origin: [0, 0] as [number, number],
    tileSize: 100,
    features: [streetFeature([0.2, 0.5], [1.2, 0.5])],
  };
  const right = {
    key: 'B',
    origin: [100, 0] as [number, number],
    tileSize: 100,
    features: [streetFeature([-0.2, 0.5], [0.8, 0.5])],
  };

  it('continues lanes across a tile border and reopens them on unregister', () => {
    const net = new TransportNetwork();
    net.registerTile(left);
    net.registerTile(right);
    const eastInA = net.lane(net.laneAt(50, 52, { class: 'road' })?.lane ?? '');
    expect(eastInA?.next).toHaveLength(1);
    const target = net.lane(eastInA?.next[0]?.to ?? '');
    expect(net.edge(target?.edge ?? '')?.tile).toBe('B');
    expect(eastInA?.next[0]?.turn).toBe('straight');
    net.unregisterTile('B');
    const again = net.lane(net.laneAt(50, 52, { class: 'road' })?.lane ?? '');
    expect(again?.next.map((m) => m.turn)).toEqual(['uturn']);
    net.registerTile(right);
    const rejoined = net.lane(net.laneAt(50, 52, { class: 'road' })?.lane ?? '');
    expect(net.edge(net.lane(rejoined?.next[0]?.to ?? '')?.edge ?? '')?.tile).toBe('B');
  });

  it('drops the MVT buffer so neighbouring tiles never duplicate a road', () => {
    const net = new TransportNetwork();
    net.registerTile(left);
    net.registerTile(right);
    // Road from x=20 to x=180: 160 m of centreline, 2 lanes.
    expect(net.stats().laneKm.road).toBeCloseTo(0.32, 1);
  });

  it('builds a tile registered in parts like the whole tile, stitched across the parts', () => {
    const tile = {
      key: 'T',
      origin: [0, 0] as [number, number],
      tileSize: 200,
      features: [
        streetFeature([0.1, 0.3], [0.9, 0.3]),
        streetFeature([0.3, 0.1], [0.3, 0.9]),
        streetFeature([0.1, 0.7], [0.9, 0.7]),
      ],
    };
    const whole = new TransportNetwork();
    whole.registerTile(tile);
    const parts = new TransportNetwork();
    for (const [i, j] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const)
      parts.registerTile({
        ...tile,
        key: `T:${i},${j}`,
        bounds: [i * 100, j * 100, i * 100 + 100, j * 100 + 100],
      });
    expect(parts.stats().laneKm.road).toBeCloseTo(whole.stats().laneKm.road, 6);
    // Eastbound at x=90 on the z=60 street runs straight on into the next part.
    const east = parts.lane(parts.laneAt(90, 62, { class: 'road' })?.lane ?? '');
    const next = parts.lane(east?.next.find((m) => m.turn === 'straight')?.to ?? '');
    expect(parts.edge(next?.edge ?? '')?.tile).toBe('T:1,0');
    // Both crossroads form, part borders adding none.
    expect(parts.stats().junctions).toBe(whole.stats().junctions);
  });
});
