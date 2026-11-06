/** Independent native southern hall bodies; reported right-block identity remains unassigned. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const mubarakCourtCases = {
  'mubarak-mandi-native-southern-west-hall-2012': 'mubarak_mandi_southern_west_hall',
  'mubarak-mandi-native-southern-east-hall-2012': 'mubarak_mandi_southern_east_hall',
};
export function inspectMubarakCourtPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const read = (s) => {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        throw Error('path');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (hash(b) !== s.sha256) throw Error('hash');
      return JSON.parse(b);
    };
    const source = proof.primarySources[0],
      j = read(source),
      native = read(proof.nativeIdentity),
      way = native.way,
      expected = P.model.endsWith('_west_hall') ? '168959079' : '168959080';
    if (
      source.url !==
        'https://www.researchgate.net/publication/330983827_Conservation_of_Mubarak_Mandi_Complex_Jammu_-_Issues_and_Strategies' ||
      source.use !== 'factual-text-only' ||
      j.primaryAuthor !== 'Sakshi Sahni' ||
      j.retrieval !== 'public-author-upload-web-text-factual-extraction' ||
      j.imageryUsed !== false ||
      j.allFiguresAndPlansUnused !== true ||
      j.facts.group !== 'High Court and UPSC Office' ||
      j.facts.bothFrontVerandahWidthFeet !== 10 ||
      j.facts.partsJoinedAtUpperFloorAboveDeorhi !== true ||
      j.facts.oneHighCourtRightBlockReportedHeightFeet !== 42
    )
      return fail('southern-hall-family-facts-unbound');
    if (
      mubarakCourtCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'native-southern-palace-court-hall' ||
      P.representedDate !== '2012-04-01' ||
      way.id !== expected ||
      way.tags.building !== 'yes' ||
      way.coordinates.length !== 5 ||
      proof.nativeIdentity.featureId !== `way/${expected}` ||
      P.nativeFeatureId !== `way/${expected}` ||
      P.exactHistoricBlockNameVerified !== false ||
      P.reported42ftAssignedToThisBody !== false ||
      P.allSectionsEstimated !== true ||
      P.heightMeasured !== false ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      Math.abs(P.porticoDepth - 3.048) > 1e-9 ||
      native.originalAnchor.some((v, i) => v !== f.anchor[i]) ||
      native.heading !== f.heading
    )
      return fail('southern-hall-native-scope-or-estimates-disagree');
    const ring = f.geometry.polygons[0];
    if (ring.length !== 4 || JSON.stringify(P.nativeRing) !== JSON.stringify(ring))
      return fail('southern-hall-native-controls-changed');
    for (let i = 0; i < 4; i++) {
      const [x, z] = ring[i],
        X = Math.cos(f.heading) * x + Math.sin(f.heading) * z,
        Z = -Math.sin(f.heading) * x + Math.cos(f.heading) * z,
        point = [
          f.anchor[0] + X / (111320 * Math.cos((f.anchor[1] * Math.PI) / 180)),
          f.anchor[1] - Z / 111320,
        ];
      if (point.some((v, k) => Math.abs(v - way.coordinates[i][k]) > 1e-9))
        return fail('southern-hall-original-corner-mismatch');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original whole independent four-corner numerical body and written southern-court architectural family; all appearance imagery unused. Exact HighCourt/UPSC name unverified,42ft right-block height not assigned as a measurement. Heights, counts, facade, roof, finish and phase remain explicit estimates; parent palace unfinished.',
    };
  } catch {
    return fail('southern-hall-evidence-unreadable');
  }
}
