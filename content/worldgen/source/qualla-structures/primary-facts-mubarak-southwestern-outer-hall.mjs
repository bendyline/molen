/** Whole native eight-corner body with an explicitly inferred written architectural family. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMubarakSouthwesternOuterPrimaryFacts({ dir, proof, controls: P, frame: f }) {
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
    const s = proof.primarySources[0],
      j = read(s),
      native = read(proof.nativeIdentity),
      way = native.way;
    if (
      s.url !==
        'https://www.researchgate.net/publication/330983827_Conservation_of_Mubarak_Mandi_Complex_Jammu_-_Issues_and_Strategies' ||
      s.use !== 'factual-text-only' ||
      j.primaryAuthor !== 'Sakshi Sahni' ||
      j.retrieval !== 'public-author-upload-web-text-factual-extraction' ||
      j.imageryUsed !== false ||
      j.allFiguresAndPlansUnused !== true ||
      j.facts.namedBuilding !== 'Session Courts' ||
      j.facts.storeys !== 2 ||
      j.facts.archForm !== 'pointed' ||
      j.facts.reportedFrontAddition !== 'concrete balcony on cantilever steel girders'
    )
      return fail('northwestern-written-family-unbound');
    if (
      proof.case !== 'mubarak-mandi-native-eight-corner-southwestern-outer-hall-2012' ||
      P.model !== 'mubarak_mandi_southwestern_outer_hall' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'native-eight-corner-southwestern-outer-hall' ||
      P.representedDate !== '2012-07-01' ||
      way.id !== '168959067' ||
      way.tags.building !== 'yes' ||
      way.coordinates.length !== 9 ||
      proof.nativeIdentity.featureId !== 'way/168959067' ||
      P.nativeFeatureId !== 'way/168959067' ||
      P.exactHistoricBlockNameVerified !== false ||
      P.architecturalFamilyIsInferred !== true ||
      P.sourceNamedBuildingAppliedToThisBody !== false ||
      P.reportedDamageLocationVerified !== false ||
      P.allSectionsEstimated !== true ||
      P.heightMeasured !== false ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      native.originalAnchor.some((v, i) => v !== f.anchor[i]) ||
      native.heading !== f.heading
    )
      return fail('southwestern-outer-body-scope-or-estimates-disagree');
    const ring = f.geometry.polygons[0];
    if (ring.length !== 8 || JSON.stringify(P.nativeRing) !== JSON.stringify(ring))
      return fail('southwestern-outer-eight-corner-controls-changed');
    for (let i = 0; i < 8; i++) {
      const [x, z] = ring[i],
        X = Math.cos(f.heading) * x + Math.sin(f.heading) * z,
        Z = -Math.sin(f.heading) * x + Math.cos(f.heading) * z,
        point = [
          f.anchor[0] + X / (111320 * Math.cos((f.anchor[1] * Math.PI) / 180)),
          f.anchor[1] - Z / 111320,
        ];
      if (point.some((v, k) => Math.abs(v - way.coordinates[i][k]) > 1e-9))
        return fail('southwestern-outer-original-corner-mismatch');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original eight-corner numerical building; two-storey pointed-arch/balcony vocabulary is an explicitly inferred cross-complex family analogy, not a verified named court identity or damage survey. All sections, facade census, roof/finish and precise2012condition estimated. All images unused; whole palace unfinished.',
    };
  } catch {
    return fail('southwestern-outer-evidence-unreadable');
  }
}
