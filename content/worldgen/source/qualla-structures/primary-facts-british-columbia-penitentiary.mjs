import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const bcPenitentiaryCase = 'new-westminster-bc-pen-surviving-heritage-buildings';
export const bcPenitentiaryModel = 'british_columbia_penitentiary';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const cityGatehouse = 'https://pub-newwestcity.escribemeetings.com/filestream.ashx?DocumentId=6648';
const regionalWarehouse = 'https://metrovancouver.org/boards/Parks/PAR-2026-04-01-AGE.pdf';

function readEvidence(dir, receipt, file) {
  if (receipt?.path !== file) throw new Error(`Unexpected BC Penitentiary evidence ${file}`);
  const bytes = readFileSync(join(dir, file));
  if (hash(bytes) !== receipt.sha256) throw new Error(`BC Penitentiary evidence changed ${file}`);
  return JSON.parse(bytes);
}

export function inspectBCPenitentiaryFacts({ dir, proof, controls, frame, inventory }) {
  const needsReview = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/heritage-building-facts.json',
    );
    const { elements } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/penitentiary-exteriors.json',
    );
    const map = new Map(elements.map((obj) => [obj.id, obj]));
    const [gate, gaol, wharf] = [86736846, 248399498, 83604318].map((id) => map.get(id));
    const stairs = [1043571276, 1043571278, 1043571280].map((id) => map.get(id));
    if (
      gate?.tags?.['heritage:ref'] !== 'DhRr-93' ||
      gaol?.tags?.['heritage:ref'] !== 'DhRr-60' ||
      wharf?.tags?.building !== 'yes' ||
      frame.geometry.polygons.length !== 3 ||
      ![gate, gaol, wharf].every(
        ({ id, nodes }, i) =>
          frame.features[i]?.id === `way/${id}` &&
          frame.geometry.polygons[i].length === nodes.length - 1,
      ) ||
      !stairs.every((way, i) => Number(way.tags.step_count) === [24, 12, 24][i])
    )
      return needsReview('bc-pen-native-heritage-outlines-or-stairs-unbound');

    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      ![cityGatehouse, regionalWarehouse].every((url) =>
        facts.sources.some((row) => row.url === url),
      ) ||
      facts.identifiedArchitecture.gatehouseStoreys !== 2 ||
      facts.identifiedArchitecture.gaolRoof !== 'mansard' ||
      controls.dimensions.gatehouseStoreys !== 2 ||
      controls.dimensions.gaolRoof !== 'mansard' ||
      !inventory.candidates.every(({ path, sourceUrl }) =>
        facts.excludedImages.some(
          (row) => row.path === path && row.sourceUrl === sourceUrl && row.reason,
        ),
      )
    )
      return needsReview('bc-pen-heritage-architecture-or-image-exclusions-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped footprints and public stair establish the three extant exteriors. City and provincial heritage reports distinguish the Gothic Gatehouse and Second Empire Gaol Block. Regional park records corroborate the Wharf Warehouse. Unmeasured roof and elevation details are approximate.',
    };
  } catch {
    return needsReview('bc-pen-factual-evidence-invalid');
  }
}
