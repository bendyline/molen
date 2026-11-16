import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ziaMuseumCase = 'zia-museum-standing-circuit-house-brick-verandah';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function evidence(dir, receipt, expected) {
  if (receipt?.path !== expected) throw Error('Unexpected Circuit House evidence path');
  const bytes = readFileSync(join(dir, expected));
  if (hash(bytes) !== receipt.sha256) throw Error('Circuit House evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectZiaMuseumFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = evidence(
      dir,
      proof.primarySources,
      'reference-rights/chittagong-circuit-house-facts.json',
    );
    const { elements } = evidence(dir, proof.nativeIdentity, 'native-map/zia-memorial-museum.json');
    const museum = elements.find(({ type, id }) => type === 'way' && id === 244157243);
    if (
      museum?.tags?.name !== 'Zia Memorial Museum' ||
      museum.tags.tourism !== 'museum' ||
      museum.nodes.length !== 18 ||
      museum.nodes[0] !== museum.nodes.at(-1) ||
      frame.mappedIdentity.historicMuseumWay !== museum.id ||
      frame.mappedIdentity.wikidataId !== 'Q18987476' ||
      controls.wikidataId !== 'Q18987476' ||
      controls.representedDate !== 'present' ||
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false
    )
      return fail('zia-museum-native-identity-unbound');

    const [lon, lat] = frame.anchor;
    const meter = (6378137 * Math.PI) / 180;
    const lonMeter = meter * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const nodes = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const { outline } = frame.geometry;
    if (
      outline.length !== 17 ||
      !museum.nodes.slice(0, -1).every((id, i) => {
        const node = nodes.get(id);
        const x = (node.lon - lon) * lonMeter,
          z = (lat - node.lat) * meter;
        return Math.hypot(c * x - s * z - outline[i][0], s * x + c * z - outline[i][1]) < 0.00002;
      })
    )
      return fail('zia-museum-footprint-mismatch');

    const { levels, groundFloorY, firstFloorY, eavesY, naveRidgeY, facadeProjections } =
      controls.dimensions;
    if (
      facts.architecture?.storeys !== 2 ||
      facts.architecture?.structure !== 'brick masonry' ||
      facts.architecture?.wallColor !== 'white' ||
      facts.architecture?.roof !== 'red tiles' ||
      facts.architecture?.upperVerandah !== true ||
      !facts.sources.some(
        ({ url }) => url === 'https://moca.gov.bd/pages/static-pages/694032d035ce18e1c0562d4f',
      ) ||
      !facts.sources.some(
        ({ url }) => url === 'https://www.dailyamardesh.com/op-ed/amduahlosqhoi',
      ) ||
      levels !== 2 ||
      !(groundFloorY < firstFloorY && firstFloorY < eavesY && eavesY < naveRidgeY) ||
      JSON.stringify(facadeProjections) !==
        JSON.stringify(
          [
            [0, 1],
            [4, 5],
            [8, 9],
          ].map(([a, b]) => [outline[a], outline[b]]),
        )
    )
      return fail('zia-museum-documented-architecture-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named historic footprint and two-storey masonry survey anchor the reconstruction. Firsthand accounts establish the white walls, red roof tiles, tall windows and upper verandah. Exact roof and façade details are estimates.',
    };
  } catch {
    return fail('zia-museum-primary-facts-invalid');
  }
}
