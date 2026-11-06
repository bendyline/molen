/** Full original Microsoft-source WKB; all aboveground sections are disclosed estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const litoralMicrosoftEstimatedCases = {
  'litoral-primary-whole-microsoft-8f6dfbd6-original-WKB-height-estimate-2023':
    'litoral_southeast_small_building',
  'litoral-primary-whole-microsoft-f2b00c02-original-WKB-height-estimate-2023':
    'litoral_south_central_roof_body',
  'litoral-primary-whole-microsoft-a55ed66f-original-WKB-height-estimate-2023':
    'litoral_central_southeastern_small_roof',
  'litoral-primary-whole-microsoft-8b49dd9e-original-WKB-height-estimate-2023':
    'litoral_central_eastern_rectangular_roof',
};
const bodies = {
  litoral_southeast_small_building: ['8f6dfbd6-a6b8-4846-a31c-05fa42538911', 4],
  litoral_south_central_roof_body: ['f2b00c02-95e5-44ac-ac4a-889ec59a8646', 16],
  litoral_central_southeastern_small_roof: ['a55ed66f-1d21-4a3b-8b6b-637f574c8ec8', 4],
  litoral_central_eastern_rectangular_roof: ['8b49dd9e-3e24-448b-9305-68b413d52bf9', 4],
};
export function inspectLitoralMicrosoftEstimatedPrimaryFacts({
  dir,
  proof,
  controls: P,
  frame: f,
}) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const read = (s) => {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        throw Error('path');
      const bytes = fs.readFileSync(path.join(dir, s.path));
      if (hash(bytes) !== s.sha256) throw Error('hash');
      return bytes;
    };
    const n = proof.nativeIdentity,
      roof = proof.primarySources.find((s) => s.key === 'roof'),
      bytes = read(n),
      data = JSON.parse(bytes),
      row = data.originalSourceRecord,
      [id, corners] = bodies[P.model] ?? [],
      url =
        'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=buildings/type=building/part-00003-cc865024-4c8e-5276-b51f-e8d81cd96612-c000.zstd.parquet',
      text = read(roof).toString('utf8');
    if (
      litoralMicrosoftEstimatedCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'litoral_penitentiary' ||
      P.kind !==
        (P.model === 'litoral_southeast_small_building'
          ? 'litoral-estimated-height-microsoft-small-building'
          : 'litoral-estimated-height-microsoft-building') ||
      P.gersId !== id ||
      P.sourceProvider !== 'microsoft' ||
      P.googleRecordId !== null ||
      P.footprintConfidence !== null ||
      P.scoreBelowTile80PrecisionThreshold !== false ||
      n.featureId !== `overture/${id}` ||
      P.nativeSourceId !== n.featureId ||
      P.numericalRecordHash !== n.sha256 ||
      data.sourceUrl !== url ||
      roof.url !== url ||
      roof.use !== 'factual-text-only' ||
      row.id !== id ||
      row.sources[0].provider !== 'microsoft' ||
      row.sources[0].dataset !== 'Microsoft ML Buildings' ||
      row.sources[0].license !== 'ODbL-1.0' ||
      row.sources[0].version !== '2026-08-11' ||
      row.sources[0].record_id !== null ||
      row.sources[0].confidence !== null ||
      row.height !== null ||
      data.overtureIsRepublishingMicrosoft !== true
    )
      return fail('litoral-Microsoft-original-source-identity-unbound');
    if (
      data.heightPresent !== false ||
      data.nativePrisonPerimeter.id !== '46012320' ||
      data.allOriginalCornersInsideNamedPrison !== true ||
      data.independentExistingBodyIntersections.length !== 0 ||
      P.heightMeasured !== false ||
      P.heightFromNumericalSamples !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedRoofHeightAboveFloorMeters !== 5.5 ||
      Math.abs(P.roofTop - P.floor - 5.5) > 1e-8 ||
      P.estimatedHeightUncertaintyMeters < 5 ||
      P.estimatedHorizontalUncertaintyMeters < 15 ||
      P.estimatedComponentUncertaintyMeters < 3 ||
      !text.includes('not a numerical height observation') ||
      !text.includes('No Google confidence or threshold applies')
    )
      return fail('litoral-Microsoft-estimates-or-containment-overstated');
    const b = Buffer.from(row.geometry_wkb, 'hex');
    if (
      b[0] !== 1 ||
      b.readUInt32LE(1) !== 3 ||
      b.readUInt32LE(5) !== 1 ||
      b.readUInt32LE(9) !== corners + 1
    )
      return fail('litoral-Microsoft-original-WKB-invalid');
    const ring = Array.from({ length: corners + 1 }, (_, i) => [
      b.readDoubleLE(13 + i * 16),
      b.readDoubleLE(21 + i * 16),
    ]);
    if (
      JSON.stringify(ring) !== JSON.stringify(data.geometry.coordinates[0]) ||
      JSON.stringify(ring[0]) !== JSON.stringify(ring[corners]) ||
      P.nativeRing.length !== corners ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      f.features[0].id !== n.featureId
    )
      return fail('litoral-Microsoft-original-WKB-corners-changed');
    const anchor = [0, 1].map((k) => ring.slice(0, -1).reduce((s, p) => s + p[k] / corners, 0)),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10))
      return fail('litoral-Microsoft-body-moved');
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - anchor[0]) * D * co,
        z = -(p[1] - anchor[1]) * D;
      if ([c * x - s * z, s * x + c * z].some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7))
        return fail('litoral-Microsoft-original-corner-moved');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original Microsoft-source WKB outline, ODbL-1.0, no Google ID/score/precision claim.5.5m height and exterior are original estimates; physical presence, exact source-date/2023continuity/grade unverified. All appearance images unused. Whole prison unfinished.',
    };
  } catch {
    return fail('litoral-Microsoft-estimated-evidence-unreadable');
  }
}
