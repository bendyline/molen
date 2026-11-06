/** Original mapped postal body; all architectural appearance remains estimated. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectMubarakPostOfficePrimaryFacts({ dir, proof, controls: P, frame: f }) {
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
      postal = read(proof.postalIdentity),
      way = native.way,
      node = postal.node;
    if (
      source.url !==
        'https://www.indiapost.gov.in/documents/online-services/others/Aadhar_Centre_all.pdf' ||
      source.use !== 'factual-text-only' ||
      j.primaryOrganization !== 'Department of Posts, Government of India' ||
      j.retrieval !== 'official-publisher-indexed-document-text-factual-extraction' ||
      j.imageryUsed !== false ||
      j.allFiguresAndPlansUnused !== true ||
      j.facts.postOffice !== 'Mubarak Mandi SO' ||
      j.facts.address !== 'Mubarak Mandi Chowk' ||
      node.id !== '10542237321' ||
      node.tags.amenity !== 'post_office' ||
      node.tags.name !== 'Mubarak Mandi Indian Post Office' ||
      proof.postalIdentity.featureId !== 'node/10542237321'
    )
      return fail('postal-service-identity-unbound');
    if (
      proof.case !== 'mubarak-mandi-native-four-corner-post-office-estimated2023' ||
      P.model !== 'mubarak_mandi_post_office' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'native-four-corner-postal-building' ||
      P.representedDate !== '2023-02-01' ||
      way.id !== '1131074668' ||
      way.tags.building !== 'yes' ||
      way.coordinates.length !== 5 ||
      proof.nativeIdentity.featureId !== 'way/1131074668' ||
      P.nativeFeatureId !== 'way/1131074668' ||
      P.exactHistoricBlockNameVerified !== false ||
      P.historicGatewayIdentityVerified !== false ||
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
      return fail('postal-whole-body-or-estimates-disagree');
    const ring = f.geometry.polygons[0];
    if (ring.length !== 4 || JSON.stringify(P.nativeRing) !== JSON.stringify(ring))
      return fail('postal-four-corner-controls-changed');
    for (let i = 0; i < 4; i++) {
      const [x, z] = ring[i],
        X = Math.cos(f.heading) * x + Math.sin(f.heading) * z,
        Z = -Math.sin(f.heading) * x + Math.cos(f.heading) * z,
        p = [
          f.anchor[0] + X / (111320 * Math.cos((f.anchor[1] * Math.PI) / 180)),
          f.anchor[1] - Z / 111320,
        ];
      if (p.some((v, k) => Math.abs(v - way.coordinates[i][k]) > 1e-9))
        return fail('postal-original-corner-mismatch');
    }
    let inside = false;
    for (let i = 0, k = 3; i < 4; k = i++) {
      const a = way.coordinates[i],
        b = way.coordinates[k],
        p = node.coordinates;
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    if (!inside) return fail('postal-point-outside-original-body');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original four-corner body contains the mapped postal point. Official directory confirms service/locality only. Heights/storeys/roof/openings/finish and2023condition estimated. Historic gateway identity unverified; all images unused; whole palace unfinished.',
    };
  } catch {
    return fail('postal-evidence-unreadable');
  }
}
