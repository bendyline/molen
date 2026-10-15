import { applyKeyframeTo, stateHash, takeKeyframe } from '@bendyline/molen-kernel';
import { Transform, World } from '@bendyline/molen-kernel/world';
import { validate } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAmbientRenderer } from '../src/client';
import {
  AmbientAgent,
  installAmbient,
  networkToDocument,
  TransportNetwork,
  type TransportNetworkDocument,
} from '../src/kernel';

const network: TransportNetworkDocument = {
  format: 'molen/transport-network@1',
  ways: [
    {
      class: 'water',
      subclass: 'ferry',
      width: 60,
      speed: 6,
      points: [
        [-350, 7, 0],
        [350, 7, 0],
      ],
    },
    {
      class: 'water',
      subclass: 'channel',
      width: 120,
      points: [
        [-350, 0, 140],
        [350, 0, 140],
      ],
    },
    {
      class: 'road',
      points: [
        [0, -350],
        [0, 350],
      ],
    },
  ],
  stations: [{ id: 'port', kind: 'ferry', at: [0, 0], dwell: 2 }],
};

function build(max = 4) {
  const world = new World({ tickRate: 10, seed: 'water' });
  const ambient = installAmbient(world, {
    classes: ['boat'],
    seed: 'water',
    ground: () => -120,
    policy: { boat: { near: 0, far: 1000, keep: 1500, perLaneKm: 6, max } },
    types: {
      boat: [
        { id: 'ferry', length: 30, width: 9, cruise: 6, max: 4, waterway: 'ferry' },
        { id: 'freighter', length: 110, width: 20, cruise: 3, waterway: 'channel' },
        { id: 'too-wide', length: 100, width: 200, waterway: 'channel' },
      ],
    },
  });
  ambient.addDocument(network);
  ambient.setObserver({ pos: [0, 10, 0] });
  return { world, ambient };
}

describe('water traffic', () => {
  it('validates water ways, ferry terminals and scene classes', () => {
    expect(validate('transport-network', network).ok).toBe(true);
    expect(
      validate('scene', {
        format: 'molen/scene@3',
        name: 'water',
        entities: [],
        ambient: { classes: ['boat'], density: { boat: 2 } },
      }).ok,
    ).toBe(true);
  });

  it('keeps water separate from roads, uses water height, and honors one-way navigation', () => {
    const net = new TransportNetwork({ ground: () => -120, traffic: 'left' });
    net.addDocument(network);
    const water = [...net.edgeList()].filter((edge) => edge.class === 'water');
    expect(water).toHaveLength(2); // Crossing the road never splits/connects a waterway.
    for (const edge of water) {
      expect([...edge.ys].every((y) => y === (edge.kind === 'ferry' ? 7 : 0))).toBe(true);
      for (const id of edge.lanes) {
        const lane = net.lane(id);
        if (!lane) throw new Error('Missing water lane');
        expect(lane.offset).toBeGreaterThan(0); // starboard even in left-driving countries
        expect(lane.next.every((m) => net.lane(m.to)?.class === 'water')).toBe(true);
      }
    }
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'water',
          oneway: true,
          points: [
            [0, 300],
            [300, 300],
          ],
        },
      ],
    });
    const one = net.edgeList().find((e) => e.oneway);
    if (!one) throw new Error('Missing one-way edge');
    expect(one.lanes).toHaveLength(1);
    expect(net.lane(one.lanes[0] ?? '')?.offset).toBe(0);
    expect(net.lane(one.lanes[0] ?? '')?.next).toHaveLength(0);
  });

  it('imports mapped ferry routes and terminals, then exports a rebakeable document', () => {
    const net = new TransportNetwork({ ground: () => -90 });
    net.registerTile({
      key: 'harbor',
      origin: [-500, -500],
      tileSize: 1000,
      features: [
        {
          class: 'ferry',
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
        },
      ],
      pois: [{ class: 'ferry_terminal', point: [0.5, 0.5] }],
    });
    expect(net.edgeList().some((e) => e.class === 'water')).toBe(true);
    const doc = networkToDocument(net);
    expect(validate('transport-network', doc).ok).toBe(true);
    expect(doc.ways[0]?.class).toBe('water');
    expect(doc.stations?.[0]?.kind).toBe('ferry');
    const roundTrip = new TransportNetwork();
    roundTrip.addDocument(doc);
    expect(roundTrip.edgeList().some((e) => e.kind === 'ferry')).toBe(true);
  });

  it('attaches ferry terminals to service routes even beside a nearer shipping channel', () => {
    const net = new TransportNetwork();
    net.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'water',
          subclass: 'channel',
          points: [
            [-300, 0],
            [300, 0],
          ],
        },
        {
          class: 'water',
          subclass: 'ferry',
          points: [
            [-300, 40],
            [300, 40],
          ],
        },
      ],
      stations: [{ id: 'terminal', kind: 'ferry', at: [0, 0] }],
    });
    for (const edge of net.edgeList()) {
      for (const id of edge.lanes)
        expect(net.lane(id)?.stops).toHaveLength(edge.kind === 'ferry' ? 1 : 0);
    }
  });

  it('spawns fitting vessels in the right service, moves, dwells and resumes', () => {
    const { world, ambient } = build(8);
    let dwell = false;
    let resumed = false;
    const stopped = new Set<string>();
    for (let tick = 0; tick < 2400; tick++) {
      world.step();
      for (const [id, a, t] of world.query(AmbientAgent, Transform)) {
        const edge = ambient.network.edge(ambient.network.lane(a.lane)?.edge ?? '');
        if (!edge) throw new Error('Vessel lost its waterway');
        expect(a.type).not.toBe('too-wide');
        expect(edge.kind).toBe(a.type === 'ferry' ? 'ferry' : 'channel');
        expect(t.pos[1]).toBe(a.type === 'ferry' ? 7 : 0);
        expect(a.speed).toBeLessThanOrEqual((a.cruise ?? 6) + 0.001);
        if (a.state === 'dwell') {
          dwell = true;
          stopped.add(id);
          expect(a.speed).toBe(0);
        }
        if (stopped.has(id) && a.state === 'move' && a.speed > 0.3) resumed = true;
      }
    }
    expect(ambient.stats().agents.boat).toBeGreaterThan(0);
    expect(dwell).toBe(true);
    expect(resumed).toBe(true);
    expect([...world.query(AmbientAgent)].some(([, a]) => a.hops > 0)).toBe(true);
  });

  it('restores vessel motion and dock timers exactly from a keyframe', () => {
    const a = build();
    a.world.stepN(400);
    const b = build();
    b.world.step(); // materialize the queued network
    applyKeyframeTo(b.world, takeKeyframe(a.world));
    for (let i = 0; i < 300; i++) {
      a.world.step();
      b.world.step();
      expect(stateHash(b.world)).toBe(stateHash(a.world));
    }
  });

  it('renders vessel proxies and reports boats separately from aircraft', () => {
    const { world } = build();
    world.stepN(60);
    const parent = new THREE.Group();
    const renderer = createAmbientRenderer({ world, parent });
    renderer.update([0, 10, 0], 0.1);
    expect(renderer.stats().boats).toBeGreaterThan(0);
    expect(renderer.stats().aircraft).toBe(0);
    expect(renderer.stats().proxies).toBe(renderer.stats().boats);
    renderer.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
