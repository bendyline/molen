/** Existing 1997 numerical stack identities; no imagery or future design adopted. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const olympicStackCases = {
  'olympic-dam-primary-whole60m-anode-stacks-existing1997': 'olympic_dam_anode_furnace_stack',
  'olympic-dam-primary-whole40m-acid-stack-existing1997': 'olympic_dam_acid_plant_stack',
};
const url =
  'https://www.bhp.com/-/media/bhp/regulatory-information-media/copper/olympic-dam/0000/1997-olympic-dam-expansion-project-environmental-impact-statement/environmental-impact-statement---technical-appendices.pdf';
export function inspectOlympicStackPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [sources.table, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        return fail('olympic-stack-unsafe-source');
      if (hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256)
        return fail('olympic-stack-source-hash-unbound');
    }
    const j = JSON.parse(fs.readFileSync(path.join(dir, sources.table.path))),
      acid = P.model === 'olympic_dam_acid_plant_stack',
      expected = acid ? [2] : [0, 1],
      rows = expected.map((i) => j.records[i]);
    if (
      sources.table.url !== url ||
      sources.table.use !== 'numerical-data-only' ||
      j.sourceUrl !== url ||
      j.imageryUsed !== false ||
      !j.section.includes('existing/pre-expansion') ||
      j.records.length !== 3
    )
      return fail('olympic-stack-existing-table-not-bound');
    const numbers = [
      [679169, 6630054, 60, 1.37],
      [679139, 6630054, 60, 1.37],
      [678970, 6630106, 40, 1.8],
    ];
    if (
      j.records.some((r, i) =>
        [r.easting, r.northing, r.heightMeters, r.internalTipDiameterMeters].some(
          (v, k) => v !== numbers[i][k],
        ),
      )
    )
      return fail('olympic-stack-original-values-changed');
    if (
      P.model !== olympicStackCases[proof.case] ||
      P.parentModelIdentity !== 'olympic_dam_mine' ||
      P.kind !== 'industrial-exhaust-stack' ||
      P.representedDate !== '1997-01-01' ||
      P.civilHeight !== (acid ? 40 : 60) ||
      Math.abs(P.shellTop - P.floor - P.civilHeight) > 1e-8 ||
      P.innerTipDiameter !== (acid ? 1.8 : 1.37) ||
      P.sourceRecordIds.join(',') !== rows.map((r) => r.id).join(',') ||
      P.equipmentInstances !== rows.length
    )
      return fail('olympic-stack-whole-scope-or-phase-changed');
    if (
      P.sourceDatumEstablished !== false ||
      j.coordinateInterpretation.sourceDatumEstablished !== false ||
      P.registrationAllowanceIsMeasuredErrorBound !== false ||
      P.nominalRegistrationAllowanceMeters < 300 ||
      P.estimatedOuterRadiusUncertaintyMeters < 1 ||
      P.estimatedComponentUncertaintyMeters < 1 ||
      P.estimatedHeightUncertaintyMeters < 2 ||
      !f.geometryLabel.includes('NOT a native mapped footprint')
    )
      return fail('olympic-stack-estimates-not-explicit');
    if (
      f.anchor.some((v, i) => v !== rows[0].provisionalCoordinate[i]) ||
      proof.nativeIdentity.featureId !== `operator-1997/${rows[0].id}` ||
      P.instances.some(
        (r, i) =>
          r.sourceId !== rows[i].id ||
          r.coordinate.some((v, k) => v !== rows[i].provisionalCoordinate[k]),
      )
    )
      return fail('olympic-stack-source-coordinate-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original operator1997 existing-column stack coordinates/heights/internal outlet diameters; complete dated structure. Provisional UTM53S/WGS84 conversion with unresolved source datum and300m nominal registration allowance, not a measured bound. Outside radius/taper/material/platform/access/ground contact estimated; every image unused. Parent mine unfinished.',
    };
  } catch {
    return fail('olympic-stack-evidence-unreadable');
  }
}
