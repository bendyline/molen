import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const piratiniCase = 'piratini-palace-government-and-residential-wings';

const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function pinned(dir, record, expected) {
  if (record?.path !== expected) throw Error('Unexpected palace evidence path');
  const bytes = readFileSync(join(dir, expected));
  if (hash(bytes) !== record.sha256) throw Error('Palace evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Bind the existing enclosure, courtyard and documented standing architectural order. */
export function inspectPiratiniFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = pinned(
      dir,
      proof.primarySources,
      'reference-rights/iphan-and-state-architecture-facts.json',
    );
    const { elements } = pinned(dir, proof.nativeIdentity, 'native-map/piratini-palace.json');
    const relation = elements.find(({ type, id }) => type === 'relation' && id === 2798271);
    if (
      relation?.tags?.wikidata !== 'Q732922' ||
      frame.mappedIdentity.wikidataId !== relation.tags.wikidata ||
      frame.mappedIdentity.buildingRelation !== relation.id ||
      controls.wikidataId !== relation.tags.wikidata ||
      controls.representedDate !== 'present' ||
      source.mode !== 'factual-text-only' ||
      source.imageryUsed !== false ||
      source.restoration.sourceUrl !==
        'https://portal.iphan.gov.br/uploads/publicacao/ColReg_ProgramaMonumentaPortoAlegre_m.pdf' ||
      source.buildingSurvey.date !== '2022-04-12' ||
      source.buildingSurvey.project !== '21/0801-0000170-2'
    )
      return fail('piratini-standing-palace-primary-identity-unbound');

    const byNode = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const [lon, lat] = frame.anchor;
    const factor = (6378137 * Math.PI) / 180;
    const cos = Math.cos(frame.heading);
    const sin = Math.sin(frame.heading);
    for (const [kind, id, outline, length] of [
      ['outer', 208075871, frame.geometry.outline, 22],
      ['inner', 208075872, frame.geometry.holes[0], 4],
    ]) {
      const way = elements.find((entry) => entry.type === 'way' && entry.id === id);
      if (
        !relation.members.some(
          (member) => member.type === 'way' && member.role === kind && member.ref === id,
        ) ||
        way?.nodes.length !== length + 1 ||
        way.nodes[0] !== way.nodes.at(-1) ||
        outline.length !== length ||
        !way.nodes.slice(0, -1).every((nodeId, i) => {
          const node = byNode.get(nodeId);
          const x = (node.lon - lon) * factor * Math.cos((lat * Math.PI) / 180);
          const z = (lat - node.lat) * factor;
          return (
            Math.hypot(x * cos - z * sin - outline[i][0], x * sin + z * cos - outline[i][1]) <
            0.00002
          );
        })
      )
        return fail('piratini-native-wing-or-court-mismatch');
    }

    const keyed = controls.section;
    const architecture = source.restoration;
    const survey = source.buildingSurvey;
    if (
      architecture.giantIonicHalfColumns !== 8 ||
      keyed.ionicColumnOffsets.length !== architecture.giantIonicHalfColumns ||
      !architecture.frontPairedColumns ||
      !architecture.frontOpenParapet ||
      architecture.frontFrieze !== 'Doric' ||
      architecture.frontSculptures.length !== 2 ||
      keyed.mainFacadeStoreysAbovePlinth !== architecture.frontStoreysInArchitecturalOrder ||
      keyed.governmentStoreys !== survey.governmentStoreys ||
      keyed.residentialStoreys !== survey.residentialStoreys ||
      !survey.governmentTerrace ||
      !survey.residentialTerrace ||
      keyed.governmentDeck <= keyed.residentialDeck ||
      keyed.residentialDeck < keyed.connectingDeck
    )
      return fail('piratini-authored-order-and-wing-levels-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Native palace and court boundaries are preserved. The restoration and building survey establish the Ionic order, two visible facade levels, statuary positions, and separate terraces and storey counts. Heights and ornamental profiles are estimates.',
    };
  } catch {
    return fail('piratini-primary-facts-invalid');
  }
}
