/** Whole original L-shaped courtyard body; relative heights remain learned estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMubarakEasternHallPrimaryFacts({ dir, proof, controls: P, frame: f }) {
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
      hs = proof.primarySources[1],
      h = read(hs),
      native = read(proof.nativeIdentity),
      record = native.record;
    if (
      source.url !==
        'https://tekton.mes.ac.in/wp-content/uploads/2025/04/3-11.2-Kanisha-Kavita-P.pdf' ||
      source.use !== 'factual-text-only' ||
      j.primaryAuthors?.join('/') !== 'Kanisha Mahajan/Kavita Pradhan' ||
      j.imageryUsed !== false ||
      j.allFiguresAndPlansUnused !== true ||
      j.facts.joinery !== 'Deodar wood in doors, windows and extended balconies' ||
      !j.facts.archFamilies.includes('round')
    )
      return fail('eastern-written-family-unbound');
    if (
      proof.case !== 'mubarak-mandi-native-six-corner-eastern-L-hall-height-estimated2023' ||
      P.model !== 'mubarak_mandi_eastern_courtyard_hall' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'native-six-corner-L-eastern-courtyard-hall' ||
      P.representedDate !== '2023-06-30' ||
      record.id !== 'e66a7b2e-dce8-4d4b-be3a-566c2341e7bc' ||
      record.sources[0].dataset !== 'Google Open Buildings' ||
      record.sources[0].record_id !== '8J4PPVQF+MVR6' ||
      P.nativeFeatureId !== 'google-open-buildings/8J4PPVQF+MVR6' ||
      proof.nativeIdentity.featureId !== P.nativeFeatureId ||
      P.exactHistoricBlockNameVerified !== false ||
      P.allSectionsEstimated !== true ||
      P.storeysEstimated !== true ||
      P.heightMeasured !== false ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.heightNumericalEstimate !== true ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHeightUncertaintyMeters < 4 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      native.headingEdge !== 4 ||
      native.originalAnchor.some((v, i) => v !== f.anchor[i]) ||
      native.heading !== f.heading
    )
      return fail('eastern-whole-body-or-estimates-disagree');
    const b = Buffer.from(record.geometry_wkb, 'hex');
    if (
      b[0] !== 1 ||
      b.readUInt32LE(1) !== 3 ||
      b.readUInt32LE(5) !== 1 ||
      b.readUInt32LE(9) !== 7 ||
      b.length !== 125
    )
      return fail('eastern-original-wkb-shape');
    const original = Array.from({ length: 7 }, (_, i) => [
        b.readDoubleLE(13 + i * 16),
        b.readDoubleLE(21 + i * 16),
      ]),
      ring = f.geometry.polygons[0];
    if (
      JSON.stringify(original) !== JSON.stringify(native.originalGeometry.coordinates[0]) ||
      ring.length !== 6 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring)
    )
      return fail('eastern-original-six-corner-controls-changed');
    for (let i = 0; i < 6; i++) {
      const [x, z] = ring[i],
        X = Math.cos(f.heading) * x + Math.sin(f.heading) * z,
        Z = -Math.sin(f.heading) * x + Math.cos(f.heading) * z,
        p = [
          f.anchor[0] + X / (111320 * Math.cos((f.anchor[1] * Math.PI) / 180)),
          f.anchor[1] - Z / 111320,
        ];
      if (p.some((v, k) => Math.abs(v - original[i][k]) > 1e-9))
        return fail('eastern-original-corner-mismatch');
    }
    const dataUrl =
      'https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/391ec_2023_06_30/tile_ZXwPulKZTyk.tif';
    if (
      hs.url !== dataUrl ||
      hs.use !== 'original-numerical-data-only' ||
      h.heightSource !== dataUrl ||
      h.heightSourceYear !== 2023 ||
      h.sourceId !== record.id ||
      h.sourceMetadata.geoKeys.ProjectedCSTypeGeoKey !== 32643 ||
      h.originalRecordHash !== hash(Buffer.from(JSON.stringify(record))) ||
      h.originalWkbHash !== hash(b) ||
      h.allAppearanceImagesUnused !== true ||
      h.confidenceThreshold !== 0.7 ||
      h.samplingStepMeters !== 4 ||
      h.samples.length !== 69 ||
      P.sourceHeightDataPoints !== 69 ||
      P.qualifiedHeightPoints !== 22
    )
      return fail('eastern-numerical-height-source-unbound');
    const values = h.samples
      .filter(
        (s) =>
          s.values[h.presenceBand] > 0.7 &&
          Number.isFinite(s.values[h.heightBand]) &&
          s.values[h.heightBand] > 0,
      )
      .map((s) => s.values[h.heightBand])
      .sort((a, b) => a - b);
    if (
      values.length !== 22 ||
      values[0] !== 8 ||
      values.at(-1) !== 12 ||
      values[11] !== 11 ||
      h.heightSummary.median !== 11 ||
      P.relativeHeightMedianMeters !== 11 ||
      Math.abs(P.roof - P.floor - 11) > 1e-10 ||
      P.heightRecordHash !== hs.sha256
    )
      return fail('eastern-relative-height-estimate-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original six-corner L-shaped source body. Learned relative height8–12m/median11m from22qualifying points is not a surveyed roof or proof of condition. All sections/storeys/facade/finish estimated; historic name unverified; every appearance image unused; whole palace unfinished.',
    };
  } catch {
    return fail('eastern-evidence-unreadable');
  }
}
