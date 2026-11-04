/** Whole independent Tate's Cairn station service buildings from original numerical records. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const tatesSupportCases = {
  'tates-primary-whole-service-4046724307T20050430-2019': 'tates_cairn_southwest_service_building',
  'tates-primary-whole-service-4047524315T20050430-2019': 'tates_cairn_north_service_structure',
};
export function inspectTatesSupportPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('tates-support-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      j = JSON.parse(bytes),
      feat = j.features.find((e) => e.properties.BuildingCSUID === P.officialBuildingCSUID),
      source =
        'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer';
    if (
      s.url !== source ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        'Hong Kong Lands Department CSDI Building original numerical record',
        'internal use unverified',
        'All photographs, figures, diagrams, plans and image-derived descriptions unused',
      ].every((v) => text.toString().includes(v))
    )
      return fail('tates-support-primary-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      !j.sourceUrl?.startsWith(source + '/0/query?') ||
      !feat ||
      !j.features.some(
        (e) =>
          e.properties.BuildingCSUID === '4047624294T20050430' &&
          e.properties.BuildingNameEN ===
            "Tate's Cairn Meteorological Station Hong Kong Observatory",
      ) ||
      n.featureId !== 'csdi/' + P.officialBuildingCSUID
    )
      return fail('tates-support-original-record-unbound');
    if (
      tatesSupportCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'tate_s_cairn' ||
      P.kind !== 'tates-service' ||
      P.officialBaseHeight !== feat.properties.BaseHeight ||
      P.officialTopHeight !== feat.properties.TopHeight ||
      Math.abs(P.officialRelativeHeight - (P.officialTopHeight - P.officialBaseHeight)) > 1e-8 ||
      Math.abs(P.eave - P.floor - P.officialRelativeHeight) > 1e-8 ||
      P.ridge !== P.eave ||
      P.estimatedHeightUncertaintyMeters < 0.8 ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      P.nativeRing.length !== 4 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])
    )
      return fail('tates-support-whole-body-height-estimates-disagree');
    const ring = feat.geometry.coordinates[0];
    if (ring.length !== 5 || JSON.stringify(ring[0]) !== JSON.stringify(ring[4]))
      return fail('tates-support-original-ring-invalid');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      sine = Math.sin(f.heading);
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - f.anchor[0]) * D * co,
        z = -(p[1] - f.anchor[1]) * D,
        v = [c * x - sine * z, sine * x + c * z];
      if (v.some((q, k) => Math.abs(q - P.nativeRing[i][k]) > 1e-7))
        return fail('tates-support-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original official fourcorner independent building and relative generalized height retained. Flat roof, facade, finish, service role and ground registration explicitly approximate. Main radar/radome and parent station unfinished; every image unused.',
    };
  } catch {
    return fail('tates-support-evidence-unreadable');
  }
}
