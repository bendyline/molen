import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export const esplanadeJournal = 'https://books.google.com/books?id=DKfmAAAAMAAJ';
const mapCatalog =
  'https://daten.berlin.de/datensaetze/luftbilder-1928-massstab-1-4-000-wms-bed1a566';
const mapService = 'https://gdi.berlin.de/services/wms/luftbild_1928_04';
const aerialRequest =
  mapService +
  '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=c_luftbilder_1928_04_raster' +
  '&STYLES=&SRS=EPSG:25833&BBOX=389520,5818815,389810,5819105&WIDTH=1160&HEIGHT=1160&FORMAT=image/png';
const aerialHash = '040f0227bc245e29dcd234dfc79cbb1b9f47576bfef750f7bc9d62748c87bcae';
const capabilitiesHash = '034ee328be978ec223e409479f8d85f3edb12578b7ead4332f8d7ca05cf34724';
const courtyardHash = '4e1212c32cb58b7e10069e6be99b08ffedde1a53ad112b8bdb8081fabda615c1';
const plates = new Map([
  [753, '0ccbc38077502658f0c25d7c2206a101f67de0c2b9797f6bbe833945a16f2f5f'],
  [754, 'bde035a40a8d91ca25ebee5b390a2150107708bf63ed8401af894bfcd3c1faac'],
  [757, '0e721329906e4a0179748f0b417dbb63ffb3a2b2090f7bf0f01cd803d5cf6205'],
  [761, '1e4b15df6d592332e14a3276870ffc00a0e50346757cfac927ec08455d6434b2'],
  [763, 'ef576b7dcbbf3d4cbd32c52532d9a319cd6619137256f325d841184fc4fb57e0'],
  [778, 'a18c873933db490949fb041293b93783286e32b2c285059af637678418be2931'],
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plain = (hash) => hash?.replace(/^sha256:/, '');
const leaf = (page) => `${esplanadeJournal}&pg=PA${page}`;
const pageFile = (page) => `deutsche-bauzeitung-1913-p${page}.jpg`;

function localBytes(dir, file) {
  if (typeof file !== 'string' || isAbsolute(file) || file.split(/[\\/]/).includes('..'))
    throw Error('Invalid historical evidence path');
  const actual = realpathSync(resolve(dir, file));
  const inside = relative(realpathSync(dir), actual);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw Error('Evidence leaves the model folder');
  return readFileSync(actual);
}

export function matchesEsplanadeCourtyard(file, record, page, info, original, reference) {
  return (
    page.title === 'File:Hotel Esplanade Berlin - Innenhof.jpg' &&
    reference.license === 'Public domain' &&
    info.extmetadata?.Copyrighted?.value === 'False' &&
    info.extmetadata?.AttributionRequired?.value === 'false' &&
    info.extmetadata?.Restrictions?.value === '' &&
    info.size === original.length &&
    info.sha1 === '11e6a8dfb2c2c2719119a318dcaf8adf9e6ad9fc' &&
    digest(original) === courtyardHash &&
    record.publicationEvidence?.issue === 84 &&
    record.publicationEvidence?.source === leaf(761) &&
    record.publicationEvidence?.caption === 'Großer Gartenhof.' &&
    digest(localBytes(dirname(file), pageFile(761))) === plates.get(761) &&
    reference.originalReview?.rendition === 'exact-published-native-original'
  );
}

export function inspectEsplanadeArchive(dir, reference) {
  const result = { path: reference.path, sourceUrl: reference.sourceUrl };
  try {
    const snapshot = localBytes(dir, reference.rightsEvidence?.path);
    const record = JSON.parse(snapshot);
    const bytes = localBytes(dir, reference.path);
    const review = reference.originalReview;
    const bound =
      digest(snapshot) === plain(reference.rightsEvidence?.sha256) &&
      digest(bytes) === plain(reference.sha256) &&
      review?.status === 'inspected' &&
      reference.visuallyReviewedForThisPolicy === true;
    const page = review?.printedPage;
    const print =
      page !== 761 &&
      plates.get(page) === digest(bytes) &&
      record.volume === esplanadeJournal &&
      record.publicationYear === 1913 &&
      record.publicationCountry === 'DE' &&
      record.architect === 'Otto Rehnig' &&
      record.architectDeathYear === 1925 &&
      record.scans?.[page]?.source === leaf(page) &&
      record.scans[page].download === reference.downloadUrl &&
      reference.sourceUrl === leaf(page) &&
      reference.license === 'Public domain' &&
      review.rendition === 'original-print-scan';
    const aerial =
      digest(bytes) === aerialHash &&
      reference.license === 'dl-de-zero-2.0' &&
      reference.sourceUrl === mapCatalog &&
      reference.downloadUrl === aerialRequest &&
      record.aerial?.catalog === mapCatalog &&
      record.aerial.capabilities === `${mapService}?SERVICE=WMS&REQUEST=GetCapabilities` &&
      digest(localBytes(dir, 'reference-rights/berlin-aerial-1928-wms.xml')) === capabilitiesHash &&
      review.rendition === 'native-georeferenced-aerial';
    if (bound && (aerial || print)) return { ...result, eligible: true, blockers: [] };
  } catch {
    // Missing or altered native records leave the reference ineligible.
  }
  return { ...result, eligible: false, blockers: ['esplanade-archive-original-unverified'] };
}
