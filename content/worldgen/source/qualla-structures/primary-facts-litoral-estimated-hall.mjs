/** One original numerical hall outline; height and exterior are disclosed original estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const litoralEstimatedHallCases = {
  'litoral-primary-whole-FC47-numerical-plan-original-height-estimate-2023':
    'litoral_central_south_hall',
  'litoral-primary-whole-Q4WF-numerical-plan-original-height-estimate-2023':
    'litoral_southern_small_building',
  'litoral-primary-whole-3G4F-numerical-plan-original-height-estimate-2023':
    'litoral_eastern_small_building',
  'litoral-primary-whole-46M2-numerical-plan-original-height-estimate-2023':
    'litoral_central_small_building',
};
const additionalEstimatedBodies = {
  litoral_southern_small_building: { record: '6792W3W4+Q4WF', confidence: 0.6674, height: 3.5 },
  litoral_eastern_small_building: { record: '6792W3X4+3G4F', confidence: 0.703, height: 6.5 },
  litoral_central_small_building: { record: '6792W3X4+46M2', confidence: 0.7023, height: 3 },
};
export function inspectLitoralEstimatedHallPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) =>
      typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
    const n = proof.nativeIdentity,
      roof = proof.primarySources?.find((s) => s.key === 'roof');
    if (!safe(n?.path) || !safe(roof?.path)) return fail('litoral-hall-invalid-path');
    const body = additionalEstimatedBodies[P.model] ?? {
        record: '6792W3X4+FC47',
        confidence: 0.7764,
        height: 5,
      },
      bytes = fs.readFileSync(path.join(dir, n.path)),
      data = JSON.parse(bytes),
      row = data.originalCsvRow,
      source =
        'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/903_buildings.csv.gz',
      id = `google-open-buildings:${body.record}`;
    if (
      litoralEstimatedHallCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'litoral_penitentiary' ||
      P.kind !== 'litoral-estimated-height-hall' ||
      hash(bytes) !== n.sha256 ||
      n.sha256 !== P.numericalRecordHash ||
      n.featureId !== id ||
      P.nativeSourceId !== id ||
      P.googleRecordId !== body.record ||
      row.full_plus_code !== P.googleRecordId ||
      data.sourceUrl !== source ||
      data.sourceDatasetHash !==
        'sha256:a3a20d797f23abf9159ecef10b2355be9f8f87aa3b7b67f96ad1537f8529e400' ||
      roof.url !== source ||
      roof.use !== 'factual-text-only' ||
      hash(fs.readFileSync(path.join(dir, roof.path))) !== roof.sha256
    )
      return fail('litoral-hall-original-record-unbound');
    const text = fs.readFileSync(path.join(dir, roof.path), 'utf8');
    if (
      !text.includes('below tile80%-precision threshold0.780') ||
      !text.includes('not a numerical height observation') ||
      Number(row.confidence) !== body.confidence ||
      P.footprintConfidence !== body.confidence ||
      P.scoreBelowTile80PrecisionThreshold !== true ||
      data.scoreBelowTile80PrecisionThreshold !== true ||
      data.sameSourceOvertureIsIndependentConfirmation !== false ||
      data.heightPresent !== false ||
      data.nativePrisonPerimeter.id !== '46012320' ||
      data.allOriginalCornersInsideNamedPrison !== true ||
      data.independentExistingBodyIntersections.length !== 0 ||
      P.heightMeasured !== false ||
      P.heightFromNumericalSamples !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedRoofHeightAboveFloorMeters !== body.height ||
      Math.abs(P.roofTop - P.floor - body.height) > 1e-8 ||
      P.estimatedHeightUncertaintyMeters < 5 ||
      P.estimatedHorizontalUncertaintyMeters < 15 ||
      P.estimatedComponentUncertaintyMeters < 3
    )
      return fail('litoral-hall-estimate-or-source-quality-mislabeled');
    const match = row.geometry.match(/^POLYGON\s*\(\((.*)\)\)$/),
      ring = data.geometry.coordinates[0];
    if (
      !match ||
      match[1].includes('(') ||
      JSON.stringify(match[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))) !==
        JSON.stringify(ring) ||
      ring.length !== 5 ||
      JSON.stringify(ring[0]) !== JSON.stringify(ring[4]) ||
      P.nativeRing.length !== 4 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      f.features[0].id !== id
    )
      return fail('litoral-hall-original-plan-changed');
    const anchor = [0, 1].map((k) => ring.slice(0, -1).reduce((s, p) => s + p[k] / 4, 0)),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10))
      return fail('litoral-hall-original-body-moved');
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - anchor[0]) * D * co,
        z = -(p[1] - anchor[1]) * D;
      if ([c * x - s * z, s * x + c * z].some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7))
        return fail('litoral-hall-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: `Whole separate original ${body.record} numerical roof inside named prison. Source detection score below tile80%-precision threshold is explicit. ${body.height}m height, facade, roof profile, function and date continuity remain original estimates; no measured body height or independent Overture confirmation claimed. Every image unused.`,
    };
  } catch {
    return fail('litoral-hall-original-evidence-unreadable');
  }
}
