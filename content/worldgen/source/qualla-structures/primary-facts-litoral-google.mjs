/** Original Google v3 numerical roofs, independent of the Overture extract. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const identities = {
  litoral_pavilion_12_north_block: ['6792W3X4+WCGG', 1, 4, 0.8392, 0.823, 4],
  litoral_pavilion_10_southeast_block: ['6792W3X4+GGP4', 2, 5.5, 0.8014, 0.78, 4],
  litoral_pavilion_9_northeast_block: ['6792W3X4+6JMC', 1, 6.5, 0.8179, 0.78, 4],
  litoral_pavilion_10_northeast_block: ['6792W3X4+JGJQ', 1, 5, 0.7814, 0.78, 6],
  litoral_pavilion_5_northwest_hall: ['6792W3W4+X57G', 1, 6, 0.7916, 0.78, 8],
  litoral_pavilion_1_north_block: ['6792W3X4+R3QW', 7, 4.5, .7912, .780],
  litoral_pavilion_2_central_hall: ['6792W3X4+J4XC', 23, 5, .8104, .780, 8],
  litoral_pavilion_5_central_block: ['6792W3W4+W7C2', 7, 7, .806, .780],
  litoral_pavilion_4_west_central_block: ['6792W3X4+24WF', 24, 7.5, .8553, .823],
  litoral_pavilion_6_central_block: ['6792W3W4+Q7HC', 11, 4.5, .8379, .823],
  litoral_pavilion_1_central_hall: ['6792W3X4+Q2QW', 44, 7, .8295, .823, 8],
  litoral_pavilion_8_northeast_block: ['6792W3X4+3MJ6', 3, 7, .835, .823],
  litoral_pavilion_3_southwest_block: ['6792W3X3+9XXR', 4, 5, .8476, .823],
  litoral_pavilion_1_east_block: ['6792W3X4+P4MM', 11, 6, .8537, .823],
  litoral_pavilion_3_northwest_block: ['6792W3X3+FXVV', 4, 5.5, .8254, .823],
  litoral_pavilion_3_west_block: ['6792W3X4+F3QV', 15, 7.5, .8274, .823],
  litoral_pavilion_1_west_block: ['6792W3X3+PWXJ', 33, 6.5, .8711],
  litoral_pavilion_2_northeast_block: ['6792W3X4+M4WH', 10, 5, .8705],
  litoral_pavilion_2_southeast_block: ['6792W3X4+H5JW', 9, 4.5, .9179],
  litoral_pavilion_2_southwest_block: ['6792W3X3+GXR4', 6, 5.5, .889],
  litoral_pavilion_3_northeast_block: ['6792W3X4+G5VM', 11, 4, .8768],
  litoral_pavilion_3_central_east_block: ['6792W3X4+F5W5', 21, 5, .9189],
};
export const litoralGoogleCases = Object.fromEntries(Object.keys(identities).map((id) => [
  'litoral-primary-original-google-whole-' + id.replace('litoral_', '').replace('pavilion_', 'pavilion').replaceAll('_', '-') + '-numerical-2023', id,
]));
export function inspectLitoralGooglePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) => typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
    const n = proof.nativeIdentity;
    if (!safe(n?.path)) return fail('litoral-google-native-path-invalid');
    const bytes = fs.readFileSync(path.join(dir, n.path)), data = JSON.parse(bytes), m = data.modelRecord;
    const [code, count, height, confidence, minimumConfidence = .87, corners = 4] = identities[P.model] ?? [];
    const id = 'google-open-buildings:' + code, pavilion = Number(P.model.match(/^litoral_pavilion_(\d+)_/)?.[1]);
    if (!code || litoralGoogleCases[proof.case] !== P.model || P.parentModelIdentity !== 'litoral_penitentiary' || P.kind !== 'litoral-pavilion-block') return fail('litoral-google-body-identity-invalid');
    if (hash(bytes) !== n.sha256 || n.sha256 !== P.numericalRecordHash || n.featureId !== id || m.sourceId !== id || P.nativeSourceId !== id || P.googleRecordId !== code || m.originalCsvRow.full_plus_code !== code || data.sourceUrl !== 'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/903_buildings.csv.gz' || data.originalDatasetSha256 !== 'sha256:a3a20d797f23abf9159ecef10b2355be9f8f87aa3b7b67f96ad1537f8529e400') return fail('litoral-google-original-row-unbound');
    if (Number(m.originalCsvRow.confidence) !== confidence || m.footprintConfidence !== confidence || confidence < minimumConfidence || m.pavilion !== pavilion) return fail('litoral-google-footprint-confidence-invalid');
    if (minimumConfidence === .823 && (data.footprintThresholdRecord?.s2_token !== '903' || Number(data.footprintThresholdRecord['confidence_threshold_85%_precision']) !== minimumConfidence || P.footprintConfidenceThreshold !== minimumConfidence || P.footprintConfidenceThresholdPrecisionPercent !== 85 || !(P.estimatedHorizontalUncertaintyMeters >= 5))) return fail('litoral-google-lower-confidence-uncertainty-unbound');
    if (minimumConfidence === .780 && (data.footprintThresholdRecord?.s2_token !== '903' || Number(data.footprintThresholdRecord['confidence_threshold_80%_precision']) !== minimumConfidence || P.footprintConfidenceThreshold !== minimumConfidence || P.footprintConfidenceThresholdPrecisionPercent !== 80 || !(P.estimatedHorizontalUncertaintyMeters >= 7))) return fail('litoral-google-lower-confidence-uncertainty-unbound');
    const sources = Object.fromEntries((proof.primarySources ?? []).map((s) => [s.key, s]));
    for (const key of ['roof', 'height', 'snai']) {
      const s = sources[key];
      if (!safe(s?.path) || s.use !== 'factual-text-only' || hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256) return fail('litoral-google-primary-source-unbound');
    }
    if (sources.roof.url !== data.sourceUrl || sources.height.url !== m.heightSource || !m.heightSource.startsWith('https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/') || sources.snai.url !== 'https://www.atencionintegral.gob.ec/wp-content/uploads/2024/03/Informe-RDC-2023-VF-2024-02-27-signed.pdf') return fail('litoral-google-primary-source-invalid');
    const selected = m.samples.filter((s) => s.values[2] > .7 && Number.isFinite(s.values[1]) && s.values[1] > 0).map((s) => s.values[1]).sort((a, b) => a - b);
    if (m.heightBand !== 1 || m.presenceBand !== 2 || m.heightSourceYear !== 2023 || m.samplingStepMeters !== 4 || selected.length !== count || m.selectedSamples !== count || P.numericalHeightSamples !== count || selected[Math.floor(count / 2)] !== height || m.heightSummary.median !== height || P.numericalHeightMedian !== height || Math.abs(P.roofTop - P.floor - height) > 1e-8 || P.estimatedHeightUncertaintyMeters < 3 || P.estimatedComponentUncertaintyMeters < 2) return fail('litoral-google-relative-height-invalid');
    if (count < 3 && P.estimatedHeightUncertaintyMeters < 4) return fail('litoral-google-sparse-nominal-height-uncertainty-unbound');
    const match = m.originalCsvRow.geometry.match(/^POLYGON\s*\(\((.*)\)\)$/), ring = m.geometry.coordinates[0];
    if (!match || match[1].includes('(') || JSON.stringify(match[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))) !== JSON.stringify(ring) || m.geometry.type !== 'Polygon' || m.geometry.coordinates.length !== 1 || ring.length !== corners + 1 || JSON.stringify(ring[0]) !== JSON.stringify(ring[corners]) || P.nativeRing.length !== corners || JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])) return fail('litoral-google-original-wkt-changed');
    if (data.compoundIdentity.poi.properties.name !== 'Pabellón ' + String(pavilion).padStart(2, '0') || data.compoundIdentity.area.id !== 'landuse/' + (35185886821920 + pavilion)) return fail('litoral-google-compound-identity-invalid');
    const anchor = [0, 1].map((k) => ring.slice(0, -1).reduce((s, p) => s + p[k] / corners, 0)), D = 6378137 * Math.PI / 180, co = Math.cos(anchor[1] * Math.PI / 180), c = Math.cos(f.heading), s = Math.sin(f.heading);
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10)) return fail('litoral-google-original-body-moved');
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - anchor[0]) * D * co, z = -(p[1] - anchor[1]) * D;
      if ([c * x - s * z, s * x + c * z].some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7)) return fail('litoral-google-original-corner-changed');
    }
    return { status: 'passed', method: 'primary-facts-only', imageryUsed: false, evidenceHash: hash(Buffer.from(JSON.stringify(proof))), notes: `Whole separately mapped ${corners}-corner Google v3 roof within Pavilion ${pavilion}. Original WKT and ${height} m estimated relative height retained; facade, roof section, openings and condition estimated. Approximate 2023 preview; compound yards and whole prison remain separate. All imagery unused.` };
  } catch { return fail('litoral-google-original-evidence-unreadable'); }
}
