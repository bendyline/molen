/** Separate Litoral roofed blocks: structured roof geometry and numerical relative heights. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  inspectLitoralGooglePrimaryFacts,
  litoralGoogleCases,
} from './primary-facts-litoral-google.mjs';
import {
  inspectLitoralMicrosoftEstimatedPrimaryFacts,
  litoralMicrosoftEstimatedCases,
} from './primary-facts-litoral-microsoft-estimated.mjs';
import {
  inspectLitoralPerimeterPrimaryFacts,
  litoralPerimeterCases,
} from './primary-facts-litoral-perimeter.mjs';
import {
  inspectLitoralRoofSectionPrimaryFacts,
  litoralRoofSectionCases,
} from './primary-facts-litoral-roof-sections.mjs';
import {
  inspectLitoralSiteRoofPrimaryFacts,
  litoralSiteRoofCases,
} from './primary-facts-litoral-site-roofs.mjs';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const litoralCases = {
  ...litoralRoofSectionCases,
  ...litoralMicrosoftEstimatedCases,
  'litoral-primary-whole-pavilion12-east-service-block-numerical-2021':
    'litoral_pavilion_12_east_service_block',
  'litoral-primary-whole-pavilion6-south-service-block-numerical-2022':
    'litoral_pavilion_6_south_service_block',
  'litoral-primary-whole-pavilion10-south-central-block-numerical-2023':
    'litoral_pavilion_10_south_central_block',
  ...litoralSiteRoofCases,
  ...litoralPerimeterCases,
  ...litoralGoogleCases,
  'litoral-primary-whole-pavilion11-northeast-block-numerical-2023':
    'litoral_pavilion_11_northeast_block',
  'litoral-primary-whole-pavilion11-southeast-block-numerical-2023':
    'litoral_pavilion_11_southeast_block',
  'litoral-primary-whole-pavilion8-north-central-block-numerical-2023':
    'litoral_pavilion_8_north_central_block',
  'litoral-primary-whole-pavilion9-south-block-numerical-2023': 'litoral_pavilion_9_south_block',
  'litoral-primary-whole-pavilion8-west-central-block-numerical-2023':
    'litoral_pavilion_8_west_central_block',
  'litoral-primary-whole-pavilion8-east-block-numerical-2023': 'litoral_pavilion_8_east_block',
  'litoral-primary-whole-pavilion4-northwest-block-numerical-2023':
    'litoral_pavilion_4_northwest_block',
  'litoral-primary-whole-pavilion4-southwest-block-numerical-2023':
    'litoral_pavilion_4_southwest_block',
  'litoral-primary-whole-pavilion4-central-block-numerical-2023':
    'litoral_pavilion_4_central_block',
  'litoral-primary-whole-pavilion4-northeast-block-numerical-2023':
    'litoral_pavilion_4_northeast_block',
  'litoral-primary-whole-pavilion4-central-east-block-numerical-2023':
    'litoral_pavilion_4_central_east_block',
  'litoral-primary-whole-pavilion4-southeast-block-numerical-2023':
    'litoral_pavilion_4_southeast_block',
  'litoral-primary-whole-pavilion5-west-block-numerical-2023': 'litoral_pavilion_5_west_block',
  'litoral-primary-whole-pavilion5-central-east-block-numerical-2023':
    'litoral_pavilion_5_central_east_block',
  'litoral-primary-whole-pavilion5-northeast-block-numerical-2023':
    'litoral_pavilion_5_northeast_block',
  'litoral-primary-whole-pavilion5-southeast-block-numerical-2023':
    'litoral_pavilion_5_southeast_block',
  'litoral-primary-whole-pavilion6-west-block-numerical-2023': 'litoral_pavilion_6_west_block',
  'litoral-primary-whole-pavilion6-east-block-numerical-2023': 'litoral_pavilion_6_east_block',
  'litoral-primary-whole-pavilion6-north-block-numerical-2023': 'litoral_pavilion_6_north_block',
  'litoral-primary-whole-pavilion6-south-block-numerical-2023': 'litoral_pavilion_6_south_block',
  'litoral-primary-whole-pavilion7-southwest-block-numerical-2023':
    'litoral_pavilion_7_southwest_block',
  'litoral-primary-whole-pavilion7-northwest-block-numerical-2023':
    'litoral_pavilion_7_northwest_block',
  'litoral-primary-whole-pavilion7-east-hall-numerical-2023': 'litoral_pavilion_7_east_hall',
  'litoral-primary-whole-pavilion8-northwest-block-numerical-2023':
    'litoral_pavilion_8_northwest_block',
  'litoral-primary-whole-pavilion8-southwest-block-numerical-2023':
    'litoral_pavilion_8_southwest_block',
  'litoral-primary-whole-pavilion9-central-block-numerical-2023':
    'litoral_pavilion_9_central_block',
  'litoral-primary-whole-pavilion9-west-block-numerical-2023': 'litoral_pavilion_9_west_block',
  'litoral-primary-whole-pavilion10-southwest-block-numerical-2023':
    'litoral_pavilion_10_southwest_block',
  'litoral-primary-whole-pavilion10-northwest-block-numerical-2023':
    'litoral_pavilion_10_northwest_block',
  'litoral-primary-whole-pavilion10-central-hall-numerical-2023':
    'litoral_pavilion_10_central_hall',
  'litoral-primary-whole-pavilion11-central-hall-numerical-2023':
    'litoral_pavilion_11_central_hall',
  'litoral-primary-whole-pavilion11-west-block-numerical-2023': 'litoral_pavilion_11_west_block',
  'litoral-primary-whole-pavilion12-west-block-numerical-2023': 'litoral_pavilion_12_west_block',
  'litoral-primary-whole-pavilion12-central-hall-numerical-2023':
    'litoral_pavilion_12_central_hall',
};
const identities = {
  litoral_pavilion_12_east_service_block: [
    '835d7368-39ef-470f-a172-5c52f719b8f3',
    null,
    4,
    6.5,
    4,
    'Microsoft ML Buildings',
    2021,
  ],
  litoral_pavilion_6_south_service_block: [
    '80013b28-e85c-4e7b-89b4-36f19f380033',
    null,
    3,
    4,
    4,
    'Microsoft ML Buildings',
    2022,
  ],
  litoral_pavilion_10_south_central_block: [
    '05c0a597-ca5f-4155-9578-75b4da16eb2f',
    null,
    2,
    4,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_11_northeast_block: [
    'cf0f11d5-0031-462f-b974-806ee97ca621',
    null,
    3,
    5.5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_11_southeast_block: [
    '50d3c3ef-1abf-43b1-8a03-d5123bad6e2b',
    null,
    3,
    5.5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_8_north_central_block: [
    'c86cc404-c478-4aec-9281-592c5287547f',
    '6792W3X4+3H84',
    6,
    7,
  ],
  litoral_pavilion_9_south_block: [
    '9d06df7c-7de0-4f7a-84fe-165d76bd70ea',
    '6792W3X4+3CH6',
    17,
    6,
    6,
  ],
  litoral_pavilion_8_west_central_block: [
    '793aae41-34d2-4390-844a-116c7e3a2778',
    '6792W3W4+XFM5',
    22,
    7,
  ],
  litoral_pavilion_8_east_block: ['85ae05e3-d591-42d9-824c-a454391413eb', '6792W3X4+2JH2', 15, 7],
  litoral_pavilion_4_northwest_block: [
    '67c1065d-7d35-440d-9f0e-06e44b67a388',
    null,
    4,
    4.5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_4_southwest_block: [
    '96c4937c-b453-4c8a-8f07-4178110ec709',
    null,
    6,
    5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_4_central_block: [
    '8fffdad6-9c2e-4f90-b3c0-e6acfd4b03e5',
    '6792W3X4+367M',
    12,
    8.5,
  ],
  litoral_pavilion_4_northeast_block: [
    '834ababd-6725-4671-bb81-a225c1263f76',
    null,
    10,
    5.5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_4_central_east_block: [
    '30389a0f-d2f9-4983-afce-bfc5dba75daa',
    '6792W3X4+37QP',
    24,
    7.5,
  ],
  litoral_pavilion_4_southeast_block: [
    'ed166266-de7f-4827-9052-222accb65743',
    '6792W3X4+28JV',
    11,
    5,
  ],
  litoral_pavilion_5_west_block: ['19ca8554-b331-4f11-b25b-42b32cd6788a', '6792W3W4+W533', 24, 6.5],
  litoral_pavilion_5_central_east_block: [
    '0ec9386e-1d80-42fb-b2da-bad83cde008f',
    '6792W3W4+W8WG',
    22,
    7.5,
  ],
  litoral_pavilion_5_northeast_block: [
    '4ec59696-64f2-4506-be7e-7ae04ff3da3f',
    '6792W3X4+2836',
    11,
    4,
  ],
  litoral_pavilion_5_southeast_block: [
    'ed899475-fd7c-4927-aa42-8790db10c2bc',
    '6792W3W4+V8XM',
    10,
    4.5,
  ],
  litoral_pavilion_6_west_block: ['e5099a2e-323d-4075-9665-605a849bf041', '6792W3W4+Q62M', 25, 5],
  litoral_pavilion_6_east_block: ['51012c67-2e92-4f6e-8409-ea613c3f1c29', '6792W3W4+Q9VW', 21, 5],
  litoral_pavilion_6_north_block: ['233589aa-12fe-4f99-bd67-42d4ad3affb2', '6792W3W4+V926', 7, 4],
  litoral_pavilion_6_south_block: ['b23f2d0d-c64c-459a-b02c-bff33c88484d', '6792W3W4+Q939', 8, 4.5],
  litoral_pavilion_7_southwest_block: [
    '3163e996-b8fc-49ef-8065-e8745461faeb',
    '6792W3W4+QGR5',
    5,
    3,
  ],
  litoral_pavilion_7_northwest_block: [
    '1dcb3694-ff9e-4136-a8a6-06d9510b36d2',
    '6792W3W4+VFPQ',
    4,
    4.5,
  ],
  litoral_pavilion_7_east_hall: [
    'b21e12ac-e1a5-41ae-b176-844df2bac22b',
    null,
    27,
    5,
    10,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_8_northwest_block: [
    '85b72a42-c3f2-4b9c-ac5f-5b8d25401b39',
    '6792W3X4+2CQQ',
    13,
    6,
  ],
  litoral_pavilion_8_southwest_block: [
    'f136100c-e59a-43f2-8473-d2f2c9e9fe36',
    '6792W3W4+WFGR',
    9,
    5,
  ],
  litoral_pavilion_9_central_block: [
    '42b0515c-8110-4bd5-84a7-d5e877963af0',
    '6792W3X4+5H82',
    26,
    7.5,
  ],
  litoral_pavilion_9_west_block: ['7543186e-0299-4397-bd3f-80cc6aae58ac', '6792W3X4+5FWV', 13, 4.5],
  litoral_pavilion_10_southwest_block: [
    'b1923bc7-5d45-4181-9be2-be8fa61d2042',
    '6792W3X4+F8P4',
    12,
    5,
  ],
  litoral_pavilion_10_northwest_block: [
    'f1cf0348-e236-4d9c-affc-621c3cd0d41a',
    '6792W3X4+H8JG',
    11,
    5,
  ],
  litoral_pavilion_10_central_hall: [
    '2d8b1b96-ebf8-445b-9a62-6bf750e18528',
    null,
    20,
    6,
    10,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_11_central_hall: [
    'fd783aa1-2bd4-46bd-b925-778cf38e923f',
    null,
    21,
    6.5,
    8,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_11_west_block: [
    '41dd67d7-2c37-41bf-9ed3-813e175341b2',
    null,
    16,
    5.5,
    4,
    'Microsoft ML Buildings',
  ],
  litoral_pavilion_12_west_block: [
    '69ddb3c8-980d-4989-b9fa-1b3705851c0f',
    '6792W3X4+Q8XH',
    36,
    5.5,
    6,
    'Google Open Buildings',
  ],
  litoral_pavilion_12_central_hall: [
    'a8d5f13f-0f87-4128-ac5b-b220cd413d94',
    null,
    34,
    7.5,
    12,
    'Microsoft ML Buildings',
  ],
};
export function inspectLitoralPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  if (litoralRoofSectionCases[proof.case])
    return inspectLitoralRoofSectionPrimaryFacts({ dir, proof, controls: P, frame: f });
  if (litoralMicrosoftEstimatedCases[proof.case])
    return inspectLitoralMicrosoftEstimatedPrimaryFacts({ dir, proof, controls: P, frame: f });
  if (litoralSiteRoofCases[proof.case])
    return inspectLitoralSiteRoofPrimaryFacts({ dir, proof, controls: P, frame: f });
  if (litoralPerimeterCases[proof.case])
    return inspectLitoralPerimeterPrimaryFacts({ dir, proof, controls: P, frame: f });
  if (litoralGoogleCases[proof.case])
    return inspectLitoralGooglePrimaryFacts({ dir, proof, controls: P, frame: f });
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) =>
      typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
    const n = proof.nativeIdentity;
    if (!safe(n?.path)) return fail('litoral-native-path-invalid');
    const bytes = fs.readFileSync(path.join(dir, n.path)),
      data = JSON.parse(bytes),
      m = data.modelRecord;
    const [
      id,
      recordId,
      count,
      expectedMedian,
      corners = 4,
      dataset = 'Google Open Buildings',
      expectedYear = 2023,
    ] = identities[P.model] ?? [];
    const pavilion = Number(P.model.match(/^litoral_pavilion_(\d+)_/)?.[1]);
    if (
      !id ||
      litoralCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'litoral_penitentiary' ||
      P.kind !== 'litoral-pavilion-block'
    )
      return fail('litoral-whole-block-identity-invalid');
    if (
      hash(bytes) !== n.sha256 ||
      n.sha256 !== P.numericalRecordHash ||
      n.featureId !== 'overture/' + id ||
      m.gersId !== id ||
      P.gersId !== id ||
      P.googleRecordId !== recordId ||
      m.sourceRecord.id !== id ||
      m.sourceRecord.sources[0].record_id !== recordId ||
      m.sourceRecord.sources[0].dataset !== dataset ||
      !data.sourceUrl.startsWith(
        'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/',
      )
    )
      return fail('litoral-original-structured-roof-unbound');
    const sources = Object.fromEntries((proof.primarySources ?? []).map((s) => [s.key, s]));
    for (const key of ['roof', 'height', 'snai']) {
      const s = sources[key];
      if (
        !safe(s?.path) ||
        s.use !== 'factual-text-only' ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('litoral-primary-source-unbound');
    }
    if (
      sources.roof.url !== data.sourceUrl ||
      sources.height.url !== m.heightSource ||
      !m.heightSource.startsWith(
        'https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/',
      ) ||
      sources.snai.url !==
        'https://www.atencionintegral.gob.ec/wp-content/uploads/2024/03/Informe-RDC-2023-VF-2024-02-27-signed.pdf'
    )
      return fail('litoral-primary-source-identity-invalid');
    const selected = m.samples
      .filter(
        (s) =>
          s.values[m.presenceBand] > 0.7 &&
          Number.isFinite(s.values[m.heightBand]) &&
          s.values[m.heightBand] > 0,
      )
      .map((s) => s.values[m.heightBand])
      .sort((a, b) => a - b);
    const median = selected[Math.floor(selected.length / 2)];
    if (
      m.heightBand !== 1 ||
      m.presenceBand !== 2 ||
      m.heightSourceYear !== expectedYear ||
      m.samplingStepMeters !== 4 ||
      selected.length !== count ||
      m.selectedSamples !== count ||
      P.numericalHeightSamples !== count ||
      median !== expectedMedian ||
      m.heightSummary.median !== median ||
      P.numericalHeightMedian !== median ||
      Math.abs(P.roofTop - P.floor - median) > 1e-8 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedComponentUncertaintyMeters < 2
    )
      return fail('litoral-numerical-height-or-uncertainty-invalid');
    if (
      expectedYear !== 2023 &&
      (P.numericalHeightSourceYear !== expectedYear ||
        P.nominalRepresentedYear !== 2023 ||
        P.temporalContinuityVerified !== false)
    )
      return fail('litoral-earlier-height-year-unbound');
    if (count < 3 && P.estimatedHeightUncertaintyMeters < 4)
      return fail('litoral-sparse-nominal-height-overstated');
    const ring = m.geometry.coordinates[0];
    if (
      m.geometry.type !== 'Polygon' ||
      m.geometry.coordinates.length !== 1 ||
      ring.length !== corners + 1 ||
      JSON.stringify(ring[0]) !== JSON.stringify(ring[corners]) ||
      P.nativeRing.length !== corners ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      data.compoundIdentity.poi.properties.name !==
        'Pabellón ' + String(pavilion).padStart(2, '0') ||
      data.compoundIdentity.area.id !== 'landuse/' + (35185886821920 + pavilion)
    )
      return fail('litoral-roof-and-compound-scope-invalid');
    const anchor = [0, 1].map((k) => ring.slice(0, -1).reduce((s, p) => s + p[k] / corners, 0)),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10))
      return fail('litoral-original-body-moved');
    for (const [i, p] of ring.slice(0, -1).entries()) {
      const x = (p[0] - anchor[0]) * D * co,
        z = -(p[1] - anchor[1]) * D,
        local = [c * x - s * z, s * x + c * z];
      if (local.some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7))
        return fail('litoral-original-roof-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: `Whole independent ${({ 4: 'four', 6: 'six', 8: 'eight', 10: 'ten', 12: 'twelve' })[corners] ?? corners}-corner roofed body inside Pavilion ${pavilion}; compound yards remain separate. Original structured footprint and median ${median} m numerical relative-height estimate retained, with ${P.estimatedHeightUncertaintyMeters} m uncertainty. Sparse1–2 observations provide nominal visualization support, not statistical precision or floor census. Flat roof, facade, entries, windows, finish and exact 2023 condition explicitly estimated. All imagery unused; whole prison remains unfinished.`,
    };
  } catch {
    return fail('litoral-evidence-unreadable');
  }
}
