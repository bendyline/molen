/** Exact original native northern hall; architectural sections remain explicit estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectMubarakNorthernPrimaryFacts({ dir, proof, controls: P, frame: f }) {
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
      s.url !== 'https://tekton.mes.ac.in/wp-content/uploads/2025/04/3-11.2-Kanisha-Kavita-P.pdf' ||
      s.use !== 'factual-text-only' ||
      j.primaryAuthors?.join('/') !== 'Kanisha Mahajan/Kavita Pradhan' ||
      j.retrieval !== 'original-publisher-web-text-factual-extraction' ||
      j.imageryUsed !== false ||
      j.allFiguresAndPlansUnused !== true ||
      j.facts.joinery !== 'Deodar wood in doors, windows and extended balconies' ||
      !j.facts.archFamilies.includes('round') ||
      JSON.stringify(j.facts.wallThicknessFeetRange) !== '[2,6]'
    )
      return fail('northern-written-family-unbound');
    if (
      proof.case !== 'mubarak-mandi-native-four-corner-northern-hall-estimated2024' ||
      P.model !== 'mubarak_mandi_northern_courtyard_hall' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'native-four-corner-northern-courtyard-hall' ||
      P.representedDate !== '2024-12-01' ||
      way.id !== '168959076' ||
      way.tags.building !== 'yes' ||
      way.coordinates.length !== 5 ||
      proof.nativeIdentity.featureId !== 'way/168959076' ||
      P.nativeFeatureId !== 'way/168959076' ||
      P.exactHistoricBlockNameVerified !== false ||
      P.allSectionsEstimated !== true ||
      P.storeysEstimated !== true ||
      P.heightMeasured !== false ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHeightUncertaintyMeters < 4 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      native.originalAnchor.some((v, i) => v !== f.anchor[i]) ||
      native.heading !== f.heading
    )
      return fail('northern-whole-body-or-estimates-disagree');
    const ring = f.geometry.polygons[0];
    if (ring.length !== 4 || JSON.stringify(P.nativeRing) !== JSON.stringify(ring))
      return fail('northern-four-corner-controls-changed');
    for (let i = 0; i < 4; i++) {
      const [x, z] = ring[i],
        X = Math.cos(f.heading) * x + Math.sin(f.heading) * z,
        Z = -Math.sin(f.heading) * x + Math.cos(f.heading) * z,
        p = [
          f.anchor[0] + X / (111320 * Math.cos((f.anchor[1] * Math.PI) / 180)),
          f.anchor[1] - Z / 111320,
        ];
      if (p.some((v, k) => Math.abs(v - way.coordinates[i][k]) > 1e-9))
        return fail('northern-original-corner-mismatch');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original northern court body; complex-wide primary written material/arch vocabulary. All heights/storeys/roof/census/finish and2024condition estimated; exact historic name unverified. All images unused, whole palace unfinished.',
    };
  } catch {
    return fail('northern-evidence-unreadable');
  }
}
