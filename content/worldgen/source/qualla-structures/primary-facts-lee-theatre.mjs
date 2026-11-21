import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const leeTheatreCase = 'lee-theatre-hong-kong-survey-editions-1975-and-1989';
export const leeTheatreModel = 'lee_theatre';

const archive = 'https://data.gov.hk/en-data/dataset/hk-landsd-openmap-old-survey-sheets';
const owner = 'https://www.hysan.com.hk/about/history/';
const heritage = 'https://www.amo.gov.hk/filemanager/amo/common/form/YMTT_RBB_HIA-Report.pdf';
const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

export function inspectLeeTheatreFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }

  try {
    const survey = readBound(proof.nativeIdentity, 'native-map/lee-theatre-survey-controls.json');
    const facts = readBound(
      proof.primarySources,
      'reference-rights/lee-theatre-written-evidence.json',
    );
    const screened = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const rejected = new Set(
      screened.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    const heritageEntry = facts.sources.find(({ url }) => url === heritage);
    const ownerEntry = facts.sources.find(({ url }) => url === owner);
    const d = controls.dimensions;
    if (
      facts.imageryUsed !== false ||
      screened.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      heritageEntry?.facts.closedYear !== 1991 ||
      ownerEntry?.facts.successor !== 'Lee Theatre Plaza'
    )
      return fail('lee-theatre-written-scope-or-exclusions-unbound');

    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const ids = [138414, 138418];
    const editions = [1975, 1989];
    if (
      survey.sourceUrl !== archive ||
      survey.coordinateReferenceSystem !== 'EPSG:2326' ||
      survey.surveys.length !== 2 ||
      !survey.surveys.every(
        (item, i) =>
          item.sheet === '11-SW-15B' &&
          item.year === editions[i] &&
          item.hkmsItemId === ids[i] &&
          item.perimeterLocal.length === 12 &&
          item.nativeUrl.includes(`hkmsItemId=${ids[i]}&editionDate=${editions[i]}`) &&
          /^sha256:[0-9a-f]{64}$/.test(item.archiveSha256),
      ) ||
      !(
        survey.projectedMaximumDisagreementMeters > 0 &&
        survey.projectedMaximumDisagreementMeters < 1
      ) ||
      !same(survey.surveys[0].perimeterLocal, survey.outline) ||
      !same(frame.geometry.outline, survey.outline) ||
      !same(d.outline, survey.outline) ||
      !same(frame.anchor, survey.anchor) ||
      frame.heading !== survey.heading ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(d.entrance, survey.entrance) ||
      d.estimatedExterior !== true ||
      controls.representedDate !== '1975' ||
      controls.validUntil !== '1991-08-19'
    )
      return fail('lee-theatre-native-footprint-or-period-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The two native survey editions register the footprint and chamfered entrance. The exterior elevations and roof profile are interpretations of the written architecture.',
    };
  } catch {
    return fail('lee-theatre-evidence-invalid');
  }
}
