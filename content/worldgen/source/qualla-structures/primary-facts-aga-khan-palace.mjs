import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const agaKhanPalaceCase = 'aga-khan-palace-standing-arcaded-ranges';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function evidence(dir, record, name) {
  if (record?.path !== name) throw Error('Unexpected palace evidence path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== record.sha256) throw Error('Palace evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectAgaKhanPalaceFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = evidence(
      dir,
      proof.primarySources,
      'reference-rights/pune-architecture-facts.json',
    );
    const { elements } = evidence(dir, proof.nativeIdentity, 'native-map/aga-khan-palace.json');
    const ways = new Map(elements.filter(({ type }) => type === 'way').map((way) => [way.id, way]));
    const nodes = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const palace = ways.get(215998839);
    const approach = ways.get(1134548506);
    const fountain = ways.get(1134548507);
    if (
      palace?.tags?.wikidata !== 'Q2344976' ||
      frame.mappedIdentity.wikidataId !== palace.tags.wikidata ||
      frame.mappedIdentity.buildingWay !== palace.id ||
      frame.mappedIdentity.eastApproachWay !== approach?.id ||
      frame.mappedIdentity.eastFountainWay !== fountain?.id ||
      fountain?.tags?.amenity !== 'fountain' ||
      controls.wikidataId !== palace.tags.wikidata ||
      controls.representedDate !== 'present' ||
      source.mode !== 'factual-text-only' ||
      source.imageryUsed !== false ||
      !source.sources.some(
        ({ url }) =>
          url === 'https://www.punemetrorail.org/download/PCMC-Nigdi_Revised_updated.pdf',
      ) ||
      !source.sources.some(
        ({ url }) => url === 'https://www.intachpune.org/images/Ashwin_2024_Patrika.pdf',
      )
    )
      return fail('aga-khan-standing-palace-identity-unbound');

    const [lon, lat] = frame.anchor;
    const factor = (6378137 * Math.PI) / 180;
    const cos = Math.cos(frame.heading);
    const sin = Math.sin(frame.heading);
    const matches = (ids, points) =>
      ids.length === points.length &&
      ids.every((id, i) => {
        const node = nodes.get(id);
        const x = (node.lon - lon) * factor * Math.cos((lat * Math.PI) / 180);
        const z = (lat - node.lat) * factor;
        return (
          Math.hypot(x * cos - z * sin - points[i][0], x * sin + z * cos - points[i][1]) < 0.00002
        );
      });
    if (
      palace.nodes.length !== 19 ||
      palace.nodes[0] !== palace.nodes.at(-1) ||
      !matches(palace.nodes.slice(0, -1), frame.geometry.outline) ||
      !matches(approach.nodes, frame.geometry.centerlines[0]) ||
      !matches(
        fountain.nodes.slice(0, -1),
        frame.features.find(({ id }) => id === 'way/1134548507').points,
      )
    )
      return fail('aga-khan-footprint-fountain-or-approach-mismatch');

    const architecture = source.architecture;
    const section = controls.section;
    if (
      architecture.principalPorchRoundArches !== 3 ||
      section.porchRoundArches !== architecture.principalPorchRoundArches ||
      section.verandaDepth !== 2.5 ||
      architecture.verandaDepthMeters !== section.verandaDepth ||
      !architecture.hippedTiledPavilions ||
      !architecture.continuousUpperBalustrades ||
      !architecture.darkLowerColumns ||
      !architecture.pointedJaliAbovePorch ||
      section.groundFloor >= section.firstFloor ||
      section.firstFloor >= section.firstCornice ||
      section.firstCornice >= section.pavilionEaves ||
      section.pavilionEaves >= section.pavilionRidge ||
      Math.abs(section.porchCenter - frame.geometry.centerlines[0][1][0]) > 0.005
    )
      return fail('aga-khan-architectural-controls-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The native standing building, east approach and fountain are preserved. Architectural reports establish the arcade depth, triple porch, roof and material profiles. Estimated heights and openings are recorded in the model.',
    };
  } catch {
    return fail('aga-khan-primary-facts-invalid');
  }
}
