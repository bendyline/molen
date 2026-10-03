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
});
