import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const thewalaiKhanetCase = 'sanam-chandra-thewalai-khanet-mapped-domed-shrine';
export const thewalaiKhanetModel = 'thewalai_khanet';

const nativePath = 'native-map/thewalai-khanet.json';
const factsPath = 'reference-rights/thewalai-khanet-facts.json';
const conservation =
  'https://patricklepetit.jalbum.net/NAKHON%20PATHOM/LIBRARY/Sanam%20Chandra%20Palace.pdf';
const fineArts =
  'https://www.finearts.go.th/storage/contents/file/etXrhMyyx18MpyKaZ8ViRrfdJQkShFO45rGZKxnF.pdf';
const research = 'https://doi.nrct.go.th/admin/doc/doc_478599.pdf';
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readPin(dir, pin, expectedPath) {
  if (pin?.path !== expectedPath) throw Error('Unexpected Thewalai Khanet evidence path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (digest(bytes) !== pin.sha256) throw Error('Unbound Thewalai Khanet evidence');
  return JSON.parse(bytes);
}

export function inspectThewalaiKhanetFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const { elements } = readPin(dir, proof.nativeIdentity, nativePath);
    const facts = readPin(dir, proof.primarySources, factsPath);
    const way = elements.find((element) => element.type === 'way' && element.id === 1472988301);
    if (
      way?.tags?.wikidata !== 'Q137947495' ||
      way.tags['name:en'] !== 'Thewalai Khanet' ||
      way.tags.religion !== 'hindu' ||
      way.nodes.length !== 5 ||
      way.nodes[0] !== way.nodes.at(-1) ||
      frame.mappedIdentity?.way !== way.id ||
      frame.mappedIdentity.wikidataId !== way.tags.wikidata ||
      controls.wikidataId !== way.tags.wikidata ||
      controls.representedDate !== 'present'
    )
      return fail('thewalai-khanet-native-identity-unbound');

    const [lon, lat] = frame.anchor;
    const meter = (6378137 * Math.PI) / 180;
    const lonMeter = meter * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const nodes = new Map(
      elements.filter((node) => node.type === 'node').map((node) => [node.id, node]),
    );
    if (
      frame.geometry?.outline?.length !== 4 ||
      !way.nodes.slice(0, -1).every((id, i) => {
        const node = nodes.get(id),
          [localX, localZ] = frame.geometry.outline[i];
        const x = (node.lon - lon) * lonMeter,
          z = (lat - node.lat) * meter;
        return Math.hypot(c * x - s * z - localX, s * x + c * z - localZ) < 0.00002;
      })
    )
      return fail('thewalai-khanet-native-footprint-changed');

    const { baseTop, archSpring, roofEave, roofCrown, finialTop } = controls.dimensions;
    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      ![conservation, fineArts, research].every((url) =>
        facts.sources.some((source) => source.url === url),
      ) ||
      facts.architecture.material !== 'reinforced concrete' ||
      facts.architecture.roof !== 'domed canopy' ||
      facts.architecture.support !== 'raised platform' ||
      facts.architecture.ornament !== 'Lopburi-style and brass' ||
      facts.architecture.figure !== 'bronze Ganesha facing Bhimarn Prathom' ||
      !(
        baseTop > 0 &&
        baseTop < archSpring &&
        archSpring < roofEave &&
        roofEave < roofCrown &&
        roofCrown < finialTop
      )
    )
      return fail('thewalai-khanet-documentary-controls-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The exact mapped footprint and written site records support the raised concrete platform, open domed shrine and bronze figure. Doorhood, ornament, figure details and section heights are estimates.',
    };
  } catch {
    return fail('thewalai-khanet-primary-facts-invalid');
  }
}
