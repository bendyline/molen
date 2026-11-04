/** The 2024 published Olympic Dam obstacle: rounded locus and an AMSL top, not an AGL survey. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const olympicAipStackCase = 'olympic-dam-aip2024-northwestern-smelter-stack-634ft-amsl';
export const olympicAipStackModel = 'olympic_dam_northwestern_smelter_stack';
export function inspectOlympicAipStackPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const documents = new Map();
    for (const source of [...(proof.primarySources ?? []), proof.nativeIdentity]) {
      if (
        typeof source?.path !== 'string' ||
        path.isAbsolute(source.path) ||
        source.path.split(/[\\/]/).includes('..')
      )
        return fail('olympic-aip-unsafe-source');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (hash(bytes) !== source.sha256) return fail('olympic-aip-source-bytes-changed');
      documents.set(source.path, JSON.parse(bytes));
    }
    const source = documents.get('primary-source/original-aip-obstacle-record.json');
    const point = documents.get('native-map/original-obstacle-derived-point.json');
    const grid = JSON.parse(fs.readFileSync(path.join(dir, 'terrain-grid.json')));
    const original = source?.obstacles?.[1];
    if (
      proof.case !== olympicAipStackCase ||
      P.model !== olympicAipStackModel ||
      P.parentModelIdentity !== 'olympic_dam_mine' ||
      source?.publisher !== 'Airservices Australia' ||
      source.publishedDate !== '2024-11-28' ||
      source.originalPdfBytes !== 13609419 ||
      !/^sha256:[a-f0-9]{64}$/.test(source.originalPdfSha256) ||
      source.originalDocumentPage !== 572 ||
      source.allChartGraphicsAndPhotographsUnused !== true ||
      source.airportReference.latitudeDegrees !== -30.485 ||
      source.airportReference.longitudeDegrees !== 136.87666666666667 ||
      source.airportReference.magneticVariationEastDegrees !== 7 ||
      original?.topElevationFeetAmsl !== 634 ||
      original.bearingDegreesMagnetic !== 335 ||
      original.distanceMetersFromAirportReference !== 4500 ||
      original.count !== 1 ||
      original.lighting !== 'lit' ||
      point?.trueBearingDegrees !== 342 ||
      point.distanceMeters !== 4500 ||
      point.topElevationMetersAmsl !== 193.2432
    )
      return fail('olympic-aip-original-observation-unbound');
    const expected = [136.86218926680527, -30.446394274262218];
    if (
      f.anchor.some((v, i) => Math.abs(v - expected[i]) > 1e-9) ||
      point.provisionalCoordinate.some((v, i) => Math.abs(v - expected[i]) > 1e-9) ||
      P.representedDate !== '2024-11-28' ||
      P.sourceTopElevationMetersAmsl !== 193.2432 ||
      Math.abs(P.shellTop + grid.modelDatumElevationMeters - 193.2432) > 1e-8 ||
      Math.abs(P.civilHeight - (P.shellTop - P.floor)) > 1e-8 ||
      P.civilHeight < 30 ||
      P.civilHeight > 140 ||
      P.heightMeasured !== false ||
      P.verticalDatumTieVerified !== false ||
      P.processIdentityVerified !== false ||
      P.dimensionsMeasured !== false ||
      P.nominalRegistrationAllowanceMeters < 100 ||
      P.registrationAllowanceIsMeasuredErrorBound !== false ||
      P.estimatedHeightUncertaintyMeters < 12 ||
      P.estimatedOuterRadiusUncertaintyMeters < 1 ||
      !f.geometryLabel.includes('NOT a native mapped footprint') ||
      !P.limitations.some((s) => s.includes('AMSL') && s.includes('not')) ||
      !P.limitations.some((s) => s.includes('process identity') && s.includes('unverified'))
    )
      return fail('olympic-aip-locus-height-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original 2024 published single lit smelter obstacle retained. WGS84 geodesic from rounded bearing/range gives a coarse locus. The 634ft AMSL top is expressed against an independently acquired composite ground datum; aboveground height and vertical tie are approximate. Process identity, shell diameter/taper, fittings and ground contact remain unverified estimates. No1997coordinate transfer or whole-mine proxy.',
    };
  } catch {
    return fail('olympic-aip-evidence-unreadable');
  }
}
