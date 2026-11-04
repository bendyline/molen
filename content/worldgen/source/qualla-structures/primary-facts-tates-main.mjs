/** Official whole radar-building plan/body height plus a disclosed original enclosure estimate. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const tatesMainCases = {
  'tates-primary-whole-main-radar-4047624294T20050430-2019': 'tates_cairn_main_radar_building',
};
export function inspectTatesMainPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries((proof.primarySources ?? []).map((s) => [s.key, s]));
    for (const s of [...Object.values(sources), proof.nativeIdentity, proof.roofCentreEstimate]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        return fail('tates-main-unsafe-evidence-path');
      if (hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256)
        return fail('tates-main-source-hash-mismatch');
    }
    const official =
        'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer',
      building = sources.building,
      radar = sources.radar,
      btext = fs.readFileSync(path.join(dir, building.path), 'utf8'),
      rtext = fs.readFileSync(path.join(dir, radar.path), 'utf8'),
      j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      feat = j.features.find((e) => e.properties.BuildingCSUID === '4047624294T20050430'),
      centre = JSON.parse(fs.readFileSync(path.join(dir, proof.roofCentreEstimate.path)));
    if (
      building.url !== official ||
      radar.url !== 'https://www.weather.gov.hk/en/aviat/amt/tc_radar.htm' ||
      building.use !== 'factual-text-only' ||
      radar.use !== 'factual-text-only' ||
      !btext.includes('full11corner') ||
      !btext.includes('BaseHeight575.9m; TopHeight579.8m') ||
      !rtext.includes('antenna diameter4.3m') ||
      !rtext.includes('Antenna diameter does not establish radome diameter') ||
      !rtext.includes('antenna altitude does not establish building height')
    )
      return fail('tates-main-written-facts-unbound');
    if (
      !j.sourceUrl?.startsWith(`${official}/0/query?`) ||
      !feat ||
      feat.properties.BuildingNameEN !==
        "Tate's Cairn Meteorological Station Hong Kong Observatory" ||
      proof.nativeIdentity.featureId !== 'csdi/4047624294T20050430' ||
      proof.nativeIdentity.sha256 !== P.numericalRecordHash ||
      P.nativeFeatureId !== proof.nativeIdentity.featureId ||
      f.features[0].id !== P.nativeFeatureId ||
      tatesMainCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'tate_s_cairn' ||
      P.kind !== 'tates-main-radar' ||
      P.officialBuildingCSUID !== '4047624294T20050430' ||
      P.officialBaseHeight !== feat.properties.BaseHeight ||
      P.officialTopHeight !== feat.properties.TopHeight ||
      Math.abs(P.officialRelativeHeight - (P.officialTopHeight - P.officialBaseHeight)) > 1e-8 ||
      Math.abs(P.eave - P.floor - P.officialRelativeHeight) > 1e-8
    )
      return fail('tates-main-original-body-unbound');
    const geo = feat.geometry.coordinates[0];
    if (
      geo.length !== 12 ||
      JSON.stringify(geo[0]) !== JSON.stringify(geo.at(-1)) ||
      P.nativeRing.length !== 11 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])
    )
      return fail('tates-main-whole-original-plan-changed');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (const [i, p] of geo.slice(0, -1).entries()) {
      const x = (p[0] - f.anchor[0]) * D * co,
        z = -(p[1] - f.anchor[1]) * D,
        v = [c * x - s * z, s * x + c * z];
      if (v.some((a, k) => Math.abs(a - P.nativeRing[i][k]) > 1e-7))
        return fail('tates-main-original-corner-changed');
    }
    if (
      P.documentedAntennaDiameterMeters !== 4.3 ||
      P.documentedAntennaSystemYear !== 1994 ||
      P.radomeSizeMeasured !== false ||
      P.radomePositionVerified !== false ||
      P.roofProfileVerified !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.radomeRadius * 2 <= 4.3 ||
      P.estimatedRadomeDiameterUncertaintyMeters < 3 ||
      P.estimatedRadomeCentreUncertaintyMeters < 8 ||
      JSON.stringify(P.radomeCentre) !== JSON.stringify(centre.localCentre) ||
      JSON.stringify(P.radomeCentre) !== JSON.stringify(f.roofEquipmentCentreEstimate.local) ||
      centre.actualRadomeCentreVerified !== false ||
      centre.chosenBeforeTerrainAndAnyVerticalSections !== true ||
      centre.clearanceMeters < P.radomeRadius ||
      Math.abs(P.radomeBottom - P.eave - 0.6) > 1e-8 ||
      Math.abs(
        P.radomeCentreY - (P.radomeBottom - P.radomeRadius * Math.sin(P.radomeCutLatitude)),
      ) > 1e-8 ||
      Math.abs(P.radomeTop - P.radomeCentreY - P.radomeRadius) > 1e-8
    )
      return fail('tates-main-original-estimate-mislabeled-or-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Full official11-corner main radar-building body and3.9m generalized height retained. Complete protective enclosure is an original explicit estimate, with unverified size/position/profile. Historical4.3m antenna and583m altitude are not dome/building dimensions. All imagery unused; separate accepted service models unchanged.',
    };
  } catch {
    return fail('tates-main-evidence-unreadable');
  }
}
