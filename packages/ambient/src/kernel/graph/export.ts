/** Export a built network as a molen/transport-network@1 document (the bake op's output). */

import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  TRANSPORT_NETWORK_FORMAT,
  type TransportNetworkDocument,
  type TransportNetworkStation,
  type TransportNetworkWay,
} from './doc';
import type { TransportNetwork } from './network';
import type { TransportEdge } from './types';

const round = (v: number): number => dmath.round(v * 100) / 100;

function subclassOf(edge: TransportEdge): string | undefined {
  if (edge.class === 'rail') return edge.kind === 'tram' ? 'tram' : 'rail';
  if (edge.class === 'walk') return edge.kind === 'crossing' ? 'crossing' : undefined;
  return edge.kind === 'living'
    ? 'living_street'
    : edge.kind === 'street'
      ? 'residential'
      : edge.kind;
}

/** Every road, rail and path edge as a way (with surface heights), plus stations and signals. */
export function networkToDocument(
  network: TransportNetwork,
  meta: Pick<TransportNetworkDocument, 'name' | 'origin'> = {},
  options: { heights?: boolean } = {},
): TransportNetworkDocument {
  const heights = options.heights !== false;
  const ways: TransportNetworkWay[] = [];
  const stations: TransportNetworkStation[] = [];
  const seenStations = new Set<string>();
  for (const edge of network.edgeList()) {
    if (edge.class === 'air') continue;
    let roadLanes = 0;
    for (const id of edge.lanes) if (network.lane(id)?.class === 'road') roadLanes++;
    const subclass = subclassOf(edge);
    ways.push({
      id: edge.id,
      class: edge.class === 'walk' ? 'path' : edge.class,
      ...(subclass !== undefined ? { subclass } : {}),
      points: edge.path.points.map((p, i) =>
        heights
          ? ([round(p[0]), round(edge.ys[i] ?? 0), round(p[1])] as [number, number, number])
          : ([round(p[0]), round(p[1])] as [number, number]),
      ),
      ...(edge.class === 'road' ? { lanes: roadLanes, oneway: edge.oneway } : {}),
      width: round(edge.width),
      ...(edge.layer !== 0 ? { layer: edge.layer } : {}),
      ...(edge.bridge ? { bridge: true } : {}),
      ...(edge.tunnel ? { tunnel: true } : {}),
      ...(edge.name !== undefined ? { name: edge.name } : {}),
    });
    for (const id of edge.lanes) {
      const lane = network.lane(id);
      for (const stop of lane?.stops ?? []) {
        if (stop.kind !== 'station' || seenStations.has(stop.id)) continue;
        seenStations.add(stop.id);
        const sample = network.sampleLane(id, lane === undefined ? 0 : stop.d - lane.trimStart);
        if (sample !== undefined)
          stations.push({ id: stop.id, at: [round(sample.x), round(sample.z)], kind: 'rail' });
      }
    }
  }
  const signals: TransportNetworkDocument['signals'] = [];
  for (const junction of network.junctionList()) {
    if (junction.control === 'signal')
      signals.push({ at: [round(junction.x), round(junction.z)], kind: 'light' });
    // A sign just outside the core of each arm that gives way (re-imports onto the same arm).
    else
      for (const arm of junction.arms)
        if (arm.yields === true)
          signals.push({
            at: [
              round(junction.x + arm.dx * (junction.radius + 4)),
              round(junction.z + arm.dz * (junction.radius + 4)),
            ],
            kind: 'yield',
          });
  }
  return {
    format: TRANSPORT_NETWORK_FORMAT,
    ...meta,
    drivingSide: network.traffic,
    ways,
    ...(stations.length > 0 ? { stations } : {}),
    ...(signals.length > 0 ? { signals } : {}),
  };
}
