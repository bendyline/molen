/** Original eastern numerical roof bodies with openly estimated palace identity and sections. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const mubarakEasternEstimatedCases = {
  'mubarak-eastern-original-ring-estimated-68564691-9e5a-4e56-86d8-138ac2d324c5':
    'mubarak_mandi_eastern_riverfront_range',
  'mubarak-eastern-original-ring-estimated-a0ad0e40-3f1e-42bd-a829-66e4e5bd6196':
    'mubarak_mandi_northeastern_residential_range',
  'mubarak-eastern-original-ring-estimated-22c36693-8541-4685-86d2-6b1abdf45595':
    'mubarak_mandi_southeastern_residential_range',
  'mubarak-eastern-original-ring-estimated-5176576a-d359-4238-84da-9c8db5c115b0':
    'mubarak_mandi_lower_riverside_range',
};
export function inspectMubarakEasternEstimatedPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
        if (!s || path.isAbsolute(s.path) || s.path.split(/[\\/]/).includes('..'))
          throw Error('unsafe');
        const b = fs.readFileSync(path.join(dir, s.path));
        if (hash(b) !== s.sha256) throw Error('changed');
        return b;
      },
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      family = JSON.parse(bytes(sources.family)),
      context = JSON.parse(bytes(sources.context)),
      r = JSON.parse(bytes(proof.nativeIdentity));
    if (
      sources.family.url !==
        'https://tekton.mes.ac.in/wp-content/uploads/2025/04/3-11.2-Kanisha-Kavita-P.pdf' ||
      family.imageryUsed !== false ||
      family.allFiguresAndPlansUnused !== true ||
      !family.facts.archFamilies.includes('round') ||
      !family.facts.features.includes('cornices') ||
      !r.sources.some((s) => s.dataset === 'Microsoft ML Buildings') ||
      r.height !== null ||
      r.num_floors !== null ||
      context.sourceObservation.id !== r.id
    )
      return fail('mubarak-estimated-original-facts-unbound');
    if (
      mubarakEasternEstimatedCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'original-eastern-palace-range-estimated-sections' ||
      P.exactHistoricBlockNameVerified !== false ||
      P.palaceMembershipEstimated !== true ||
      P.physicalSurvivalAndDateVerified !== false ||
      P.heightMeasured !== false ||
      P.heightNumericalEstimate !== false ||
      P.allSectionsEstimated !== true ||
      P.storeysEstimated !== true ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.numericalRecordHash !== proof.nativeIdentity.sha256 ||
      f.identityStatus !== 'estimated-eastern-palace-context-not-verified-named-residence' ||
      !proof.estimates.some((s) => s.includes('unverified original estimates'))
    )
      return fail('mubarak-estimated-scope-disclosure-missing');
    const b = Buffer.from(r.geometry_wkb, 'hex'),
      n = b.readUInt32LE(9),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    if (n - 1 !== P.nativeRing.length || n - 1 !== context.sourceObservation.originalOuterCorners)
      return fail('mubarak-original-corner-census-changed');
    for (let i = 0; i < n - 1; i++)
      if (
        Math.abs((b.readDoubleLE(13 + i * 16) - f.anchor[0]) * D * co - P.nativeRing[i][0]) >
          1e-6 ||
        Math.abs(-(b.readDoubleLE(21 + i * 16) - f.anchor[1]) * D - P.nativeRing[i][1]) > 1e-6
      )
        return fail('mubarak-original-outline-shifted');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original Microsoft numerical roof and primary complex-wide masonry/arch/joinery vocabulary. Palace membership, exact royal/GoleGhar identity, survival/date, height/storeys, roof/facade/finish and grade ties are explicitly original estimates. No learned height value, named-residence certification, image/plan tracing or site/courtyard envelope substitution; existing palace members unchanged.',
    };
  } catch {
    return fail('mubarak-estimated-original-evidence-unreadable');
  }
}
