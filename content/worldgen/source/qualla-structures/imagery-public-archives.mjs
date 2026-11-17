/** Bind public-domain architectural references to an exact archive item and rendition. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

function readBound(dir, record) {
  const name = record?.path;
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const file = path.resolve(dir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
    return null;
  const bytes = fs.readFileSync(file);
  return hash(bytes) === record.sha256?.replace(/^sha256:/, '') ? bytes : null;
}

function readRecord(dir, record) {
  try {
    return JSON.parse(readBound(dir, record));
  } catch {
    return null;
  }
}

function mccordMatches(dir, reference, image, record) {
  const page = readRecord(dir, reference.commonsEvidence);
  const info = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  const source = revision?.slots?.main?.['*'];
  const accession = record.accession;
  return (
    /^https:\/\/collections\.musee-mccord-stewart\.ca\/en\/objects\/\d+\/[a-z0-9-]+$/.test(
      reference.rightsEvidence?.sourceUrl ?? '',
    ) &&
    record.url === reference.rightsEvidence.sourceUrl &&
    record.label === 'Public Domain' &&
    record.permitsCommercialReuse === true &&
    /^VIEW-\d+(?:\.[\dA-Z]+)?$/.test(accession ?? '') &&
    accession === reference.accessionNumber &&
    record.artist === reference.artist &&
    info?.descriptionurl === reference.sourceUrl &&
    info?.url?.split('?')[0] === reference.downloadUrl &&
    info?.sha1 === hash(image, 'sha1') &&
    info.size === image.length &&
    info.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    revision?.revid === reference.nativeRevision &&
    source?.includes(`|Source={{MM|${accession}}}`) &&
    source.includes(`|Author=${reference.artist}\n`) &&
    source.includes(`|Date=${reference.dateCreated}\n`) &&
    source.includes('{{PD-Canada}}') &&
    source.includes('{{PD-1923}}') &&
    reference.originalReview?.rendition === 'native-original'
  );
}

function banqMatches(reference, record) {
  const sheet = record.sheet;
  return (
    /^https:\/\/numerique\.banq\.qc\.ca\/patrimoine\/details\/52327\/\d+$/.test(
      reference.sourceUrl ?? '',
    ) &&
    record.url === reference.sourceUrl &&
    record.url === reference.rightsEvidence?.sourceUrl &&
    record.label === 'Domaine public au Canada' &&
    record.rightsDeclaration === 'https://creativecommons.org/publicdomain/mark/1.0/deed.fr' &&
    record.creator === reference.artist &&
    Number.isInteger(record.publicationYear) &&
    record.publicationYear < 1923 &&
    record.publicationYear === reference.publicationYear &&
    /^\d{3}$/.test(sheet?.designation ?? '') &&
    /^[\w-]{22}$/.test(sheet.id ?? '') &&
    sheet.designation === reference.sheet &&
    sheet.restriction?.accesRestriction === false &&
    record.imageService?.['@id'] === `https://img.banq.qc.ca/iiif/2/${sheet.id}` &&
    reference.downloadUrl === `${record.imageService['@id']}/full/full/0/default.jpg` &&
    record.imageService.width === reference.width &&
    record.imageService.height === reference.height &&
    record.scanSha256 === reference.sha256 &&
    reference.originalReview?.rendition === 'full-resolution-archive-scan'
  );
}

function tePapaPostcardMatches(dir, reference, record) {
  const item = /^https:\/\/collections\.tepapa\.govt\.nz\/object\/(\d+)$/.exec(reference.sourceUrl);
  const { production, recto, verso } = record;
  const publisher = production?.contributor;
  const [first, last] = Array.isArray(reference.publicationRange) ? reference.publicationRange : [];
  const date = `${first}-${last}`;
  const imprint = readBound(dir, reference.versoEvidence);
  return (
    item &&
    record.url === reference.sourceUrl &&
    record.url === reference.rightsEvidence?.sourceUrl &&
    record.id === Number(item[1]) &&
    record.classification === 'photographic postcards' &&
    /^PS\.\d+\/\d{2}$/.test(record.accessionNumber ?? '') &&
    record.accessionNumber === reference.accessionNumber &&
    Number.isInteger(first) &&
    Number.isInteger(last) &&
    first >= 1850 &&
    last >= first &&
    last <= 1922 &&
    production?.title === `${reference.artist}; ${date}; ${record.productionPlace}` &&
    publisher?.type === 'Organisation' &&
    publisher.title === reference.artist &&
    Number(publisher.birthDate) <= first &&
    Number(publisher.deathDate) >= last &&
    record.printedPublisherImprint === true &&
    reference.originalReview?.rendition === 'native-archive-catalog-preview' &&
    reference.originalReview?.versoInspected === true &&
    imprint &&
    imprint.length >= 2 &&
    imprint.readUInt16BE(0) === 0xffd8 &&
    recto?.id !== verso?.id &&
    [recto, verso].every(
      (resource, i) =>
        Number.isInteger(resource?.id) &&
        resource.fileFormat === 'image/jpeg' &&
        typeof resource.title === 'string' &&
        resource.title.startsWith(`${record.accessionNumber}; `) &&
        resource.title.endsWith(`view ${i + 1}`) &&
        resource.contentUrl === `https://media.tepapa.govt.nz/collection/${resource.id}/full` &&
        resource.previewUrl === `https://media.tepapa.govt.nz/collection/${resource.id}/preview` &&
        resource.rights?.title === 'No Known Copyright Restrictions' &&
        resource.rights.allowsDownload === true &&
        Array.isArray(resource.facetPermissionType) &&
        resource.facetPermissionType.includes('Unrestricted'),
    ) &&
    recto.previewUrl === reference.downloadUrl &&
    verso.previewUrl === reference.versoEvidence.sourceUrl
  );
}

function museuPaulistaPostcardMatches(dir, reference, image, record) {
  const accession = '1-14948-0000-0000';
  const verso = readBound(dir, reference.versoEvidence);
  const sides = [
    [record.recto, image, 90489238, 1267709386, '295e056f285c7ecbf03db04678b75f884399008a'],
    [record.verso, verso, 90489280, 1267709392, '2eac6b7f5395560b626df6b2801df767497b36f6'],
  ];
  return (
    reference.accessionNumber === accession &&
    reference.dateCreated === '1923-12' &&
    record.accession === accession &&
    record.datedInscription === 'XII.1923' &&
    reference.originalReview?.versoInspected === true &&
    reference.originalReview.rendition === 'native-original' &&
    reference.sourceUrl === record.recto?.imageinfo?.[0]?.descriptionurl &&
    reference.downloadUrl === record.recto?.imageinfo?.[0]?.url?.split('?')[0] &&
    reference.versoEvidence?.sourceUrl === record.verso?.imageinfo?.[0]?.descriptionurl &&
    reference.rightsEvidence.sourceUrl === reference.sourceUrl &&
    reference.artist === 'José Rosael/Hélio Nobre/Museu Paulista da USP' &&
    sides.every(([page, bytes, id, revision, sha1], i) => {
      const info = page?.imageinfo?.[0];
      const native = page?.revisions?.[0];
      const rights = info?.extmetadata;
      const body = native?.slots?.main?.['*'] ?? '';
      return (
        page?.pageid === id &&
        native?.revid === revision &&
        page.title ===
          `File:Ouro Preto Egreja do Carmo (${i + 1}) - ${accession}, Acervo do Museu Paulista da USP.jpg` &&
        info?.url?.startsWith('https://upload.wikimedia.org/wikipedia/commons/') &&
        !info.url.includes('/thumb/') &&
        bytes &&
        bytes.length === info.size &&
        hash(bytes, 'sha1') === sha1 &&
        info.sha1 === sha1 &&
        body.includes('|wikidata = Q90302489') &&
        body.includes('{{Museu Paulista license|PD|old}}') &&
        body.includes('|photographer = ' + reference.artist) &&
        rights?.Artist?.value === reference.artist &&
        rights.LicenseShortName?.value === 'Public domain' &&
        rights.Copyrighted?.value === 'False' &&
        rights.AttributionRequired?.value === 'false' &&
        rights.Restrictions?.value === ''
      );
    })
  );
}

function puertoRicoNaipMatches(reference, record) {
  const service = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer';
  let imageUrl;
  try {
    imageUrl = new URL(reference.downloadUrl);
  } catch {
    return false;
  }
  const q = imageUrl.searchParams;
  const box = q.get('bbox')?.split(',').map(Number);
  const { extent, width, height } = record.export ?? {};
  return (
    record.service === service &&
    record.source?.mapName === 'USGSImageryOnly' &&
    record.source?.description?.includes('PR - 2018') &&
    record.source?.copyrightText?.startsWith('USDA, USGS The National Map: Orthoimagery.') &&
    record.licenseSource ===
      'https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip' &&
    reference.artist === 'USDA and USGS The National Map' &&
    reference.sourceUrl === service &&
    reference.rightsEvidence?.sourceUrl === service + '?f=pjson' &&
    imageUrl.origin + imageUrl.pathname === service + '/export' &&
    q.get('f') === 'image' &&
    q.get('bboxSR') === '4326' &&
    q.get('imageSR') === '4326' &&
    q.get('format') === 'jpg' &&
    box?.length === 4 &&
    box.every(Number.isFinite) &&
    box[0] >= -67.4 &&
    box[0] < box[2] &&
    box[2] <= -65.2 &&
    box[1] >= 17.85 &&
    box[1] < box[3] &&
    box[3] <= 18.55 &&
    width === reference.width &&
    height === reference.height &&
    q.get('size') === `${width},${height}` &&
    extent?.spatialReference?.wkid === 4326 &&
    [extent.xmin, extent.ymin, extent.xmax, extent.ymax].every(
      (value, i) => Math.abs(value - box[i]) < 0.00012,
    ) &&
    reference.originalReview?.rendition === 'native-georeferenced-export'
  );
}

function salvadoranPresidencyMatches(reference, image, record) {
  const source = record.imageinfo?.[0];
  const revision = record.revisions?.[0];
  const body = revision?.slots?.main?.['*'] ?? '';
  const id = reference.flickrId;
  const witnesses = {
    31436690438: [
      73613946,
      1112517906,
      '81249e6418102806e0fc0ccfff16aa4eaa14e99c',
      '20200419190437',
    ],
    43495384800: [
      73613955,
      1112517979,
      '756ce892d0e25f7ef4ebe0aecd37b773831e376d',
      '20200419190516',
    ],
  };
  if (!Object.hasOwn(witnesses, id)) return false;
  const [pageId, revisionId, sha1, archive] = witnesses[id];
  const flickrPhoto = `https://flickr.com/photos/124520909@N04/${id}`;
  const firstPartyPhoto = `https://www.flickr.com/photos/fotospresidencia_sv/${id}/`;
  const review = body.match(/\{\{FlickreviewR\|([^{}]+)\}\}/)?.[1]?.split('|') ?? [];
  const author = 'Presidencia de El Salvador from San Salvador, El Salvador, América Central';
  return (
    record.pageid === pageId &&
    revision?.revid === revisionId &&
    reference.license === 'CC0' &&
    reference.artist === author &&
    source?.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '').trim() === author &&
    source.extmetadata.LicenseShortName?.value === 'CC0' &&
    source.extmetadata.AttributionRequired?.value === 'false' &&
    source.extmetadata.Restrictions?.value === '' &&
    source.descriptionurl === reference.sourceUrl &&
    reference.rightsEvidence?.sourceUrl === reference.sourceUrl &&
    source.url?.split('?')[0] === reference.downloadUrl &&
    source.sha1 === sha1 &&
    hash(image, 'sha1') === sha1 &&
    image.length === source.size &&
    body.includes(firstPartyPhoto) &&
    body.includes('https://www.flickr.com/people/124520909@N04 Presidencia de El Salvador]') &&
    /\{\{\s*cc-zero\s*\}\}/i.test(body) &&
    review.includes('status=passed') &&
    review.includes('reviewlicense=cc-zero') &&
    review.includes('author=Fotos Presidencia El Salvador') &&
    review.includes('reviewer=FlickreviewR 2') &&
    review.includes(`sourceurl=${flickrPhoto}`) &&
    review.includes(`archive=https://web.archive.org/web/${archive}/${flickrPhoto}`) &&
    reference.originalReview?.rendition === 'native-original'
  );
}

export function bureauOfPublicRoadsMatches(reference, image, record) {
  const info = record.imageinfo?.[0];
  const revision = record.revisions?.[0];
  const text = revision?.slots?.main?.['*'] ?? '';
  const metadata = info?.extmetadata;
  if (typeof record.title !== 'string' || !/^File:[A-Za-z0-9 ,.'()-]+\.jpg$/.test(record.title))
    return false;
  const name = record.title.slice(5).replaceAll(' ', '_');
  return (
    reference.sourceUrl === `https://commons.wikimedia.org/wiki/File:${name}` &&
    reference.sourceUrl === info?.descriptionurl &&
    reference.rightsEvidence.sourceUrl === reference.sourceUrl &&
    reference.downloadUrl === info.url?.split('?')[0] &&
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[a-f0-9]\/[a-f0-9]{2}\/[^/]+\.jpg$/.test(
      reference.downloadUrl ?? '',
    ) &&
    info.sha1 === hash(image, 'sha1') &&
    info.size === image.length &&
    info.width === reference.width &&
    info.height === reference.height &&
    revision.revid === reference.nativeRevision &&
    reference.artist === 'Bureau of Public Roads' &&
    metadata?.Artist?.value?.replace(/<[^>]*>/g, '').trim() === reference.artist &&
    metadata?.LicenseShortName?.value === 'Public domain' &&
    metadata.Copyrighted?.value === 'False' &&
    metadata.AttributionRequired?.value === 'false' &&
    metadata.Restrictions?.value === '' &&
    text.includes('{{NARA-image-full') &&
    text.includes('{{PD-USGov-DOC}}{{NARA-cooperation}}') &&
    /^\|Author=Bureau of Public Roads$/m.test(text) &&
    /^\|Creator=Department of Commerce\. Bureau of Public Roads\./m.test(text) &&
    /^\|Series ARC=513325$/m.test(text) &&
    /^\|File unit ARC=\d+$/m.test(text)
  );
}

function rijksmuseumMatches(reference, record) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const production = record.produced_by;
  const credits = [
    ...list(production?.referred_to_by),
    ...list(production?.part).flatMap((part) => list(part?.referred_to_by)),
  ];
  const image = list(record.subject_of)
    .flatMap((subject) => list(subject?.digitally_carried_by))
    .find((item) => list(item?.access_point).some((point) => point?.id === reference.downloadUrl));
  return (
    /^https:\/\/id\.rijksmuseum\.nl\/\d+$/.test(reference.sourceUrl) &&
    reference.rightsEvidence?.sourceUrl === reference.sourceUrl &&
    record.id === reference.sourceUrl &&
    record.type === 'HumanMadeObject' &&
    list(record.identified_by).some(
      (item) => item?.type === 'Identifier' && item.content === reference.accessionNumber,
    ) &&
    Boolean(reference.artist?.trim()) &&
    credits.some((credit) =>
      [reference.artist, `${reference.artist} (mentioned on object)`].includes(credit?.content),
    ) &&
    /^\d{4}$/.test(reference.dateCreated ?? '') &&
    production?.timespan?.begin_of_the_begin?.startsWith(`${reference.dateCreated}-`) &&
    /^https:\/\/iiif\.micr\.io\/[A-Za-z0-9]+\/full\/max\/0\/default\.jpg$/.test(
      reference.downloadUrl,
    ) &&
    list(image?.referred_to_by).some(
      (rights) => rights?.content === 'https://creativecommons.org/publicdomain/mark/1.0/',
    ) &&
    reference.originalReview?.rendition === 'native-archive-jpeg'
  );
}

export function inspectPublicArchiveReference(dir, reference) {
  const image = readBound(dir, reference);
  const record = readRecord(dir, reference.rightsEvidence);
  const blockers = [];
  const expectedLicense =
    reference.origin === 'commons-presidencia-sv-cc0' ? 'CC0' : 'Public domain';
  if (!image) blockers.push('supplemental-image-bytes-unbound');
  if (!record) blockers.push('supplemental-rights-snapshot-unbound');
  if (
    !image ||
    !record ||
    image.length < 2 ||
    image.readUInt16BE(0) !== 0xffd8 ||
    reference.license !== expectedLicense ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    !(reference.origin === 'commons-mccord-public-domain'
      ? mccordMatches(dir, reference, image, record)
      : reference.origin === 'banq-public-domain-atlas'
        ? banqMatches(reference, record)
        : reference.origin === 'te-papa-expired-postcard'
          ? tePapaPostcardMatches(dir, reference, record)
          : reference.origin === 'rijksmuseum-public-domain'
            ? rijksmuseumMatches(reference, record)
            : reference.origin === 'commons-museu-paulista-expired-postcard'
              ? museuPaulistaPostcardMatches(dir, reference, image, record)
              : reference.origin === 'usgs-national-map-pr-naip'
                ? puertoRicoNaipMatches(reference, record)
                : reference.origin === 'commons-presidencia-sv-cc0'
                  ? salvadoranPresidencyMatches(reference, image, record)
                  : reference.origin === 'commons-nara-bureau-of-public-roads' &&
                    reference.originalReview?.rendition === 'native-archive-jpeg' &&
                    bureauOfPublicRoadsMatches(reference, image, record))
  )
    blockers.push('supplemental-archive-item-public-domain-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: blockers.length === 0,
  };
}
