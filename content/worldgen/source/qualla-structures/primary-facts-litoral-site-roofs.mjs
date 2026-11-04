/** Whole numerical roofs inside the original named Litoral perimeter; actual building use unverified. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const identities = {
  "litoral_west_block_01": [
    "6792W3X3+QMMV",
    39,
    2.5,
    0.9225,
    0.87,
    6
  ],
  "litoral_west_block_02": [
    "6792W3X3+MM9Q",
    36,
    2.5,
    0.9334,
    0.87,
    4
  ],
  "litoral_west_block_03": [
    "6792W3X3+HP4R",
    36,
    2.5,
    0.9367,
    0.87,
    4
  ],
  "litoral_west_block_04": [
    "6792W3X3+CQR4",
    37,
    4,
    0.949,
    0.87,
    4
  ],
  "litoral_west_block_05": [
    "6792W3X3+9P5C",
    11,
    5.5,
    0.914,
    0.87,
    4
  ],
  "litoral_west_block_06": [
    "6792W3X3+5W3J",
    9,
    5,
    0.9377,
    0.87,
    4
  ],
  "litoral_west_block_07": [
    "6792W3X3+3PMJ",
    7,
    5.5,
    0.943,
    0.87,
    4
  ],
  "litoral_west_block_08": [
    "6792W3X3+2Q9C",
    8,
    5.5,
    0.9011,
    0.87,
    4
  ],
  "litoral_west_block_09": [
    "6792W3W3+WV3W",
    40,
    6,
    0.9406,
    0.87,
    8
  ],
  "litoral_west_block_10": [
    "6792W3W3+QXGF",
    50,
    5.5,
    0.8919,
    0.87,
    4
  ],
  "litoral_west_block_11": [
    "6792W3W3+MXH8",
    6,
    6,
    0.8843,
    0.87,
    4
  ],
  "litoral_west_block_12": [
    "6792W3W3+JX8R",
    6,
    6.5,
    0.8914,
    0.87,
    4
  ],
  "litoral_south_block_01": [
    "6792W3W4+92J6",
    17,
    7.5,
    0.9101,
    0.87,
    8
  ],
  "litoral_south_block_02": [
    "6792W3W4+94VQ",
    29,
    10,
    0.8751,
    0.87,
    4
  ],
  "litoral_west_block_13": ["6792W3X3+2VMC",27,5,0.8638,0.823,4],
  "litoral_west_block_14": ["6792W3W3+PVVQ",48,6,0.8435,0.823,4],
  "litoral_west_block_15": ["6792W3X3+6QWR",8,4.5,0.8596,0.823,8],
  "litoral_west_block_16": ["6792W3W3+XVHC",4,6.5,0.8644,0.823,4],
  "litoral_west_block_17": ["6792W3W4+H2GP",27,6.5,0.8609,0.823,4],
  "litoral_west_block_18": ["6792W3X3+5MH2",2,6,0.793,0.78,4],
  "litoral_central_block_01": ["6792W3X4+9CFC",52,3,0.7908,0.78,6],
  "litoral_west_block_19": ["6792W3W3+JV9P",15,6,0.8225,0.78,6],
  "litoral_south_block_03": ["6792W3W4+936W",1,9,0.7817,0.78,8],
  "litoral_west_block_20": ["6792W3X3+6MVW",1,6,0.7898,0.78,4],
  "litoral_west_block_21": ["6792W3X3+4Q5V",2,4.5,0.7902,0.78,4],
  "litoral_inner_block_01": ["6792W3W4+R4XM",0,null,0.8276,0.78,4,5,4],
  "litoral_inner_block_02": ["6792W3W4+P54C",0,null,0.8386,0.78,4,6,4],
  "litoral_inner_block_03": ["6792W3X4+C368",0,null,0.8182,0.78,4,3,4],
  "litoral_inner_block_04": ["6792W3X4+4JHR",0,null,0.795,0.78,4,9,4],
  "litoral_inner_block_05": ["6792W3W4+C73W",0,null,0.8161,0.78,8,null,4],
  "litoral_inner_block_06": ["6792W3W4+WMWH",0,null,0.8531,0.78,4,7,4],
  "litoral_inner_block_07": ["6792W3W4+XJ7F",0,null,0.8551,0.78,4,8,4]
};
export const litoralSiteRoofCases = Object.fromEntries(Object.keys(identities).map((id) => [
  'litoral-primary-original-google-whole-' + id.replace('litoral_', '').replace('pavilion_', 'pavilion').replaceAll('_', '-') + '-numerical-2023', id,
]));
export function inspectLitoralSiteRoofPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) => typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
    const n = proof.nativeIdentity;
    if (!safe(n?.path)) return fail('litoral-google-native-path-invalid');
    const bytes = fs.readFileSync(path.join(dir, n.path)), data = JSON.parse(bytes), m = data.modelRecord;
    const [code, count, height, confidence, minimumConfidence = .87, corners = 4, pavilion = null, authorHeight = null] = identities[P.model] ?? [];
    const id = 'google-open-buildings:' + code;
    if (!code || litoralSiteRoofCases[proof.case] !== P.model || P.parentModelIdentity !== 'litoral_penitentiary' || P.kind !== 'litoral-site-roofed-block') return fail('litoral-google-body-identity-invalid');
    if (hash(bytes) !== n.sha256 || n.sha256 !== P.numericalRecordHash || n.featureId !== id || m.sourceId !== id || P.nativeSourceId !== id || P.googleRecordId !== code || m.originalCsvRow.full_plus_code !== code || data.sourceUrl !== 'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/903_buildings.csv.gz' || data.originalDatasetSha256 !== 'sha256:a3a20d797f23abf9159ecef10b2355be9f8f87aa3b7b67f96ad1537f8529e400') return fail('litoral-google-original-row-unbound');
    if (Number(m.originalCsvRow.confidence) !== confidence || m.footprintConfidence !== confidence || confidence < minimumConfidence || m.pavilion !== pavilion) return fail('litoral-google-footprint-confidence-invalid');
    const precision = minimumConfidence === .780 ? 80 : minimumConfidence === .823 ? 85 : 90;
    if (![.780, .823, .87].includes(minimumConfidence) || Number(data.footprintThresholdRecord?.['confidence_threshold_' + precision + '%_precision']) !== minimumConfidence || P.footprintConfidenceThreshold !== minimumConfidence || P.footprintConfidenceThresholdPrecisionPercent !== precision || P.estimatedHorizontalUncertaintyMeters < (minimumConfidence === .780 ? 7 : 5)) return fail('litoral-site-roof-confidence-unbound');
    const sources = Object.fromEntries((proof.primarySources ?? []).map((s) => [s.key, s]));
    for (const key of ['roof', 'height', 'site']) {
      const s = sources[key];
      if (!safe(s?.path) || s.use !== 'factual-text-only' || hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256) return fail('litoral-google-primary-source-unbound');
    }
    if (sources.roof.url !== data.sourceUrl || sources.height.url !== m.heightSource || !m.heightSource.startsWith('https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/') || sources.site.url !== 'https://api.openstreetmap.org/api/0.6/map?bbox=-79.947,-2.055,-79.941,-2.049') return fail('litoral-google-primary-source-invalid');
    const pointOrigins = {"litoral_inner_block_06":{"sha256":"sha256:675d497ffe4b3fb57b747c66ffb2f67f3322803a93479208385a2a51b54e8796","gersId":"22e6ff1c-8725-476d-b5bf-9a165e63b7a7"},"litoral_inner_block_07":{"sha256":"sha256:a510fd048f26f81ae815d7c983db2f382ddbbc3493889beb69630dd56b29551b","gersId":"d91f6f22-94d8-40ff-987e-70831d3ce09f"}};
    if (pointOrigins[P.model]) {
      const expected = pointOrigins[P.model], origin = m.heightObservationOrigin;
      if (!safe(origin?.path) || origin.path !== 'native-map/original-height-observations.json' || hash(fs.readFileSync(path.join(dir, origin.path))) !== expected.sha256 || origin.sha256 !== expected.sha256 || origin.originalGersId !== expected.gersId) return fail('litoral-original-point-observation-origin-unbound');
      const original = JSON.parse(fs.readFileSync(path.join(dir, origin.path)));
      if (original.gersId !== expected.gersId || original.selectedSamples !== 0 || JSON.stringify(original.samples) !== JSON.stringify(m.samples) || JSON.stringify(original.heightSummary) !== JSON.stringify(m.heightSummary) || original.heightSource !== m.heightSource || origin.pointsInsideOriginalGoogleRoof !== original.samples.length || origin.pointsTransferred !== original.samples.length) return fail('litoral-original-point-observations-changed');
    }
    const selected = m.samples.filter((s) => s.values[2] > .7 && Number.isFinite(s.values[1]) && s.values[1] > 0).map((s) => s.values[1]).sort((a, b) => a - b);
    const authorOnly = count === 0 && authorHeight !== null, chosenHeight = authorOnly ? authorHeight : height;
    if (m.heightBand !== 1 || m.presenceBand !== 2 || m.heightSourceYear !== 2023 || m.samplingStepMeters !== 4 || selected.length !== count || m.selectedSamples !== count || P.numericalHeightSamples !== count || Math.abs(P.roofTop - P.floor - chosenHeight) > 1e-8 || P.estimatedHeightUncertaintyMeters < 3 || P.estimatedComponentUncertaintyMeters < 2) return fail('litoral-google-relative-height-invalid');
    if (authorOnly ? m.heightSummary.median !== undefined || P.numericalHeightMedian !== null || P.authorNominalHeightMeters !== authorHeight || P.authorHeightEstimateBasis !== 'conservative-visualization-only-no-passing-height-observations' || P.estimatedHeightUncertaintyMeters < 4 : selected[Math.floor(count / 2)] !== height || m.heightSummary.median !== height || P.numericalHeightMedian !== height) return fail('litoral-google-source-versus-author-height-unbound');
    if (count < 3 && P.estimatedHeightUncertaintyMeters < 4) return fail('litoral-site-roof-sparse-height-overstated');
    const match = m.originalCsvRow.geometry.match(/^POLYGON\s*\(\((.*)\)\)$/), ring = m.geometry.coordinates[0];
    if (!match || match[1].includes('(') || JSON.stringify(match[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))) !== JSON.stringify(ring) || m.geometry.type !== 'Polygon' || m.geometry.coordinates.length !== 1 || ring.length !== corners + 1 || JSON.stringify(ring[0]) !== JSON.stringify(ring[corners]) || P.nativeRing.length !== corners || JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])) return fail('litoral-google-original-wkt-changed');
    const site = data.siteIdentity;
    if (!safe(site?.originalResponsePath) || hash(fs.readFileSync(path.join(dir, site.originalResponsePath))) !== 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07' || site.wall.id !== '46012320' || site.wall.tags.name !== 'Penitenciaría del Litoral' || site.wall.tags.barrier !== 'wall') return fail('litoral-site-roof-site-identity-unbound');
    const siteXml = fs.readFileSync(path.join(dir, site.originalResponsePath), 'utf8'), originalWay = siteXml.match(/<way\b[^>]*\bid="46012320"[^>]*>([\s\S]*?)<\/way>/)?.[1], siteIds = [...originalWay.matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((m) => m[1]), siteCoords = siteIds.map((id) => { const n = siteXml.match(new RegExp('<node\\b[^>]*\\bid="' + id + '"[^>]*>')); const a = Object.fromEntries([...n[0].matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])); return [Number(a.lon), Number(a.lat)]; });
    if (JSON.stringify(siteCoords) !== JSON.stringify(site.wall.coordinates)) return fail('litoral-site-roof-site-boundary-changed');
    const inside = (p, r) => { let hit = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const a = r[i], b = r[k]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; };
    if (!ring.every((p) => inside(p, siteCoords))) return fail('litoral-site-roof-outside-original-site');
    const anchor = [0, 1].map((k) => ring.slice(0, -1).reduce((s, p) => s + p[k] / corners, 0)), D = 6378137 * Math.PI / 180, co = Math.cos(anchor[1] * Math.PI / 180), c = Math.cos(f.heading), s = Math.sin(f.heading);
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10)) return fail('litoral-google-original-body-moved');
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - anchor[0]) * D * co, z = -(p[1] - anchor[1]) * D;
      if ([c * x - s * z, s * x + c * z].some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7)) return fail('litoral-google-original-corner-changed');
    }
    return { status: 'passed', method: 'primary-facts-only', imageryUsed: false, evidenceHash: hash(Buffer.from(JSON.stringify(proof))), notes: `Whole separately mapped ${corners}-corner Google v3 roof inside the original named prison perimeter; specific building use unverified. Original WKT retained; ${authorOnly ? 'no passing source height observations; nominal ' + authorHeight + ' m is an author visualization estimate, not a source value' : height + ' m estimated numerical relative height retained'}; facade, roof section, openings and condition estimated. Approximate 2023 preview; other roofs, open yards and whole prison remain separate. All imagery unused.` };
  } catch { return fail('litoral-google-original-evidence-unreadable'); }
}
