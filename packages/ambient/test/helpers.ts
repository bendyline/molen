import type {
  TerrainPoiFeature,
  TerrainTransportationFeature,
} from '@bendyline/molen-terrain/kernel';
import type { TransportNetworkDocument } from '../src/kernel';

/** A square grid of two-way streets, `blocks` × `blocks` blocks of `size` metres. */
export function gridDocument(
  blocks: number,
  size: number,
  subclass = 'residential',
): TransportNetworkDocument {
  const ways: TransportNetworkDocument['ways'] = [];
  const extent = blocks * size;
  for (let i = 0; i <= blocks; i++) {
    const c = i * size - extent / 2;
    ways.push({
      id: `ew${i}`,
      class: 'road',
      subclass,
      points: [
        [-extent / 2, c],
        [extent / 2, c],
      ],
    });
    ways.push({
      id: `ns${i}`,
      class: 'road',
      subclass,
      points: [
        [c, -extent / 2],
        [c, extent / 2],
      ],
    });
  }
  return { format: 'molen/transport-network@1', ways };
}

/** A closed one-way square loop of side `side`, centred on the origin. */
export function loopDocument(side: number): TransportNetworkDocument {
  const h = side / 2;
  return {
    format: 'molen/transport-network@1',
    ways: [
      {
        id: 'loop',
        class: 'road',
        subclass: 'residential',
        oneway: true,
        lanes: 1,
        points: [
          [-h, -h],
          [h, -h],
          [h, h],
          [-h, h],
          [-h, -h],
        ],
      },
    ],
  };
}

/** A horizontal street through a tile, in normalized tile coordinates (with buffer overhang). */
export function streetFeature(
  from: [number, number],
  to: [number, number],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature {
  return { class: 'minor_road', subclass: 'residential', lines: [[from, to]], ...extra };
}

export function poi(kind: string, point: [number, number]): TerrainPoiFeature {
  return { class: kind, point };
}
