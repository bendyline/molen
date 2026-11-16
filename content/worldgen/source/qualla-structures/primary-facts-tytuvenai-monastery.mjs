import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hashBytes } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';

export const tytuvenaiHouseCase = 'tytuvenai-bernardine-house-registered-wings-and-court';
export const tytuvenaiHouseModel = 'tytuvenai_bernardine_monastery_house';
export const tytuvenaiRegistry =
  'https://kvr.kpd.lt/KvrWcf/LabbisServiceKvr.svc/GetDocument/158B3539-8A98-4FF0-99E4-63E9A8AD887E';

function pinned(dir, reference, relative) {
  const bytes = readFileSync(path.join(dir, relative));
  if (reference.path !== relative || reference.sha256 !== hashBytes(bytes))
    throw Error('Recorded evidence bytes differ');
  return JSON.parse(bytes);
}

/** The architectural register establishes the three wings separately from the courtyard arcade. */
export function inspectTytuvenaiHouseFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = pinned(
      dir,
      proof.primarySources,
      'reference-rights/heritage-architecture-facts.json',
    );
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const native = pinned(dir, proof.nativeIdentity, 'native-map/heritage-footprint.json');
    const heritage = source.sources.find((record) => record.url === tytuvenaiRegistry)?.facts;
    const dimensions = controls.dimensions;
    if (
      source.mode !== 'factual-text-only' ||
      source.imageryUsed !== false ||
      heritage?.record !== 21848 ||
      heritage.wings !== 3 ||
      heritage.storeys !== 2 ||
      heritage.courtMeters?.join(',') !== '16.4,10.85,16.62,10.72' ||
      dimensions.wings?.length !== heritage.wings ||
      dimensions.wings.some((wing) => wing.storeys !== heritage.storeys) ||
      excluded.selectedImages !== 0 ||
      excluded.candidates.length !== inventory.candidates.length ||
      inventory.candidates.some((candidate, i) => {
        const record = excluded.candidates[i];
        return (
          record.path !== candidate.path ||
          record.sourceUrl !== candidate.sourceUrl ||
          record.license !== candidate.license
        );
      })
    )
      return fail('tytuvenai-monastery-house-factual-scope-unbound');

    if (
      native.feature.id !== 1874439 ||
      native.feature.tags.wikidata !== 'Q942809' ||
      frame.mappedIdentity.kpd !== heritage.record ||
      frame.sourceUrl !== 'https://www.openstreetmap.org/relation/1874439' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(dimensions.outline) ||
      JSON.stringify(frame.geometry.wings) !==
        JSON.stringify(dimensions.wings.map((wing) => wing.outline))
    )
      return fail('tytuvenai-monastery-house-footprint-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hashBytes(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped monastery and church junction, surveyed court, three two-storey brick wings, gabled clay roofs and lean-to glazed link establish the exterior. Heights, subsidiary openings and the west gable details are estimated.',
    };
  } catch {
    return fail('tytuvenai-monastery-house-evidence-invalid');
  }
}
