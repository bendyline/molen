import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const saintSarkisTehranCase = 'saint-sarkis-tehran-post-renovation-marble-cathedral';
const nativePath = 'native-map/saint-sarkis-cathedral.json';
const factsPath = 'reference-rights/saint-sarkis-cathedral-facts.json';
const paper = 'https://www.tojdac.org/tojdac/VOLUME6-AGUSPCL_files/tojdac_v060AGSE173.pdf';
const tourism = 'https://visitiran.ir/attraction/saint-sarkis-cathedral';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readReceipt(dir, receipt, name) {
  if (receipt?.path !== name) throw new Error('Unexpected Saint Sarkis evidence path');
  const bytes = readFileSync(join(dir, name));
  if (receipt.sha256 !== hash(bytes)) throw new Error('Saint Sarkis evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectSaintSarkisTehranFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const { elements } = readReceipt(dir, proof.nativeIdentity, nativePath);
    const facts = readReceipt(dir, proof.primarySources, factsPath);
    const way = elements.find(({ type, id }) => type === 'way' && id === 480654425);
    if (
      way?.tags?.wikidata !== 'Q2082848' ||
      way.tags.denomination !== 'armenian_apostolic' ||
      way.tags['name:en'] !== 'Saint Sarkis Cathedral' ||
      way.nodes.length !== 27 ||
      way.nodes[0] !== way.nodes.at(-1) ||
      frame.mappedIdentity?.way !== way.id ||
      frame.mappedIdentity.wikidataId !== way.tags.wikidata ||
      controls.wikidataId !== way.tags.wikidata ||
      controls.representedDate !== 'present'
    )
      return fail('saint-sarkis-native-identity-unbound');

    const [lon, lat] = frame.anchor;
    const meter = (6378137 * Math.PI) / 180;
    const lonMeter = meter * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const nodes = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    if (
      frame.geometry?.outline?.length !== 26 ||
      !way.nodes.slice(0, -1).every((id, index) => {
        const node = nodes.get(id),
          [mx, mz] = frame.geometry.outline[index];
        const x = (node.lon - lon) * lonMeter,
          z = (lat - node.lat) * meter;
        return Math.hypot(c * x - s * z - mx, s * x + c * z - mz) < 0.00002;
      })
    )
      return fail('saint-sarkis-footprint-mismatch');

    const a = facts.architecture,
      v = controls.dimensions;
    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      !facts.sources.some(({ url }) => url === paper) ||
      !facts.sources.some(({ url }) => url === tourism) ||
      a.wallFace !== 'white marble' ||
      a.westBellTowers !== 2 ||
      a.westMainDoors !== 3 ||
      a.apse !== 'polygonal east projection' ||
      a.roofPhase !== 'later opaque conical covering with drum lights' ||
      v.bellTowers.length !== a.westBellTowers ||
      v.westDoors.length !== a.westMainDoors ||
      !(v.threshold < v.naveEave && v.naveEave < v.domeDrumTop && v.domeDrumTop < v.domeApex)
    )
      return fail('saint-sarkis-documented-architecture-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named mapped footprint establishes the surviving exterior. The University of Tehran study and tourism authority document the white marble, polygonal apse, central roof and twin bell towers. Heights, surface details and opening spans are estimates.',
    };
  } catch {
    return fail('saint-sarkis-primary-facts-invalid');
  }
}
