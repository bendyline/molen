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

export function rietbergSepahsalarMatches(dir, reference, image, page) {
  const museum = readBound(dir, reference.museumEvidence)?.toString('utf8');
  const info = page.imageinfo?.[0];
  const revision = page.revisions?.[0];
  const source = revision?.slots?.main?.['*'];
  const construction = reference.accessionNumber === '2023.10.73';
  const item = construction ? '73' : '34';
  const objectId = construction ? '98705' : '98666';
  const scanId = construction ? '140990' : '140951';
  const titleSuffix = construction ? '-im-Bau-mit-Arbeitern' : '';
  const caption = construction ? ' im Bau mit Arbeitern, 1879–1884' : ', um 1879–1884';
  const alternatePrint = construction ? '33' : '36';
  const museumUrl = `https://rietberg.ch/sammlungen/2023-10-${item}`;
  const museumImage = `https://rietberg.ch/collection/Multimedia/${objectId}/_collectionEntryImageLightbox/2023.10.${item}_${scanId}.jpg`;
  return (
    page.title ===
      `File:Antoin-Sevruguin-Sipahsalar-Moschee-in-Teheran${titleSuffix}-Museum-Rietberg-2023.00010.${item}.jpg` &&
    reference.accessionNumber === `2023.10.${item}` &&
    reference.artist === 'Antoin Sevruguin' &&
    reference.museumEvidence?.sourceUrl === museumUrl &&
    reference.museumEvidence?.imageUrl === museumImage &&
    museum?.includes(`<link rel="canonical" href="${museumUrl}"/>`) &&
    museum.includes(
      `2023.10.${item}, Antoin Sevruguin (1851–1933), Sipahsalar-Moschee in Teheran${caption}`,
    ) &&
    museum.includes('1875–1896: Karl Emil Ludwig Alpiger sen. (1841–1905), angekauft in Iran') &&
    museum.replaceAll('\\/', '/').includes(museumImage) &&
    info?.descriptionurl === reference.sourceUrl &&
    info?.url?.split('?')[0] === reference.downloadUrl &&
    info?.sha1 === hash(image, 'sha1') &&
    info.size === image.length &&
    info.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    revision?.revid === reference.nativeRevision &&
    source?.includes('{{PD-Art|PD-old-auto-expired|deathyear=1933}}') &&
    source.includes(`Golestan Palace Album No. 163-${alternatePrint}.jpg`) &&
    info.extmetadata?.Copyrighted?.value === 'False' &&
    info.extmetadata?.AttributionRequired?.value === 'false' &&
    !info.extmetadata?.Restrictions?.value &&
    ['native-original', 'original-published-qualla-jpeg-byte-identical-to-native-file'].includes(
      reference.originalReview?.rendition,
    )
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
        body.includes(`|photographer = ${reference.artist}`) &&
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
    reference.rightsEvidence?.sourceUrl === `${service}?f=pjson` &&
    imageUrl.origin + imageUrl.pathname === `${service}/export` &&
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

function californiaNaip2009Matches(reference, record) {
  const service =
    'https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2009/ImageServer';
  const federalRights =
    'https://www.fgdc.gov/resources/whitepapers-reports/annual%20reports/2009/web-version/AppendixC.html';
  let url;
  let mosaic;
  try {
    url = new URL(reference.downloadUrl);
    mosaic = JSON.parse(url.searchParams.get('mosaicRule'));
  } catch {
    return false;
  }
  const q = url.searchParams;
  const item = record.item?.attributes;
  const box = q.get('bbox')?.split(',').map(Number);
  return (
    reference.artist === 'USDA Farm Service Agency' &&
    reference.sourceUrl === service &&
    reference.rightsEvidence.sourceUrl === federalRights &&
    record.licenseSource === federalRights &&
    record.itemUrl === `${service}/6694?f=pjson` &&
    item?.OBJECTID === 6694 &&
    item.Name === 'm_3712213_se_10_1_20090619.tif' &&
    item.Category === 1 &&
    reference.dateCreated === '2009-06-19' &&
    `${url.origin}${url.pathname}` === `${service}/exportImage` &&
    mosaic?.mosaicMethod === 'esriMosaicLockRaster' &&
    mosaic.lockRasterIds?.length === 1 &&
    mosaic.lockRasterIds[0] === item.OBJECTID &&
    q.get('f') === 'image' &&
    q.get('bboxSR') === '4326' &&
    q.get('imageSR') === '4326' &&
    q.get('adjustAspectRatio') === 'false' &&
    q.get('format') === 'jpg' &&
    q.get('interpolation') === 'RSP_NearestNeighbor' &&
    record.export?.width === reference.width &&
    record.export?.height === reference.height &&
    q.get('size') === `${reference.width},${reference.height}` &&
    box?.length === 4 &&
    box.every((value, i) => Number.isFinite(value) && value === record.export?.extent?.[i]) &&
    box[0] < -122.396 &&
    box[2] > -122.396 &&
    box[1] < 37.7894 &&
    box[3] > 37.7894 &&
    reference.originalReview?.rendition === 'native-georeferenced-export'
  );
}

function amosNaipMatches(reference, image, record) {
  const service = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';
  const extent = record.export?.extent;
  const expected = [-81.8302, 38.4697, -81.8172, 38.4787];
  return (
    reference.sourceUrl === service &&
    reference.rightsEvidence?.sourceUrl === service + '?f=pjson' &&
    reference.downloadUrl === service + '/exportImage?bbox=' + expected.join(',') +
      '&bboxSR=4326&imageSR=4326&size=1200,1000&adjustAspectRatio=false&format=jpg&f=image' &&
    record.service === service &&
    record.source?.copyrightText?.includes('The National Map') &&
    /public domain, NAIP/i.test(record.source?.description ?? '') &&
    record.licenseSource === 'https://catalog.data.gov/dataset/national-agriculture-imagery-program-naip-imagery' &&
    reference.artist === 'USDA and USGS The National Map' &&
    reference.width === 1200 &&
    reference.height === 1000 &&
    record.export?.width === 1200 &&
    record.export?.height === 1000 &&
    extent?.spatialReference?.wkid === 4326 &&
    [extent.xmin, extent.ymin, extent.xmax, extent.ymax].every(
      (value, i) => Math.abs(value - expected[i]) < 0.000001,
    ) &&
    reference.originalReview?.rendition === 'native-georeferenced-export' &&
    hash(image) === '2eec60ea24a58b32ab4ec30517c641667f42ff7976b0bee310b83cb3d2dd150a'
  );
}

function encinaNaip2018Matches(reference, record) {
  const service =
    'https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2018/ImageServer';
  const federalRights = 'https://www.fsa.usda.gov/Internet/FSA_Notice/ap_26.pdf';
  let url;
  let mosaic;
  try {
    url = new URL(reference.downloadUrl);
    mosaic = JSON.parse(url.searchParams.get('mosaicRule'));
  } catch {
    return false;
  }
  const q = url.searchParams;
  const item = record.item?.attributes;
  const box = q.get('bbox')?.split(',').map(Number);
  return (
    reference.artist === 'USDA Farm Service Agency' &&
    reference.sourceUrl === service &&
    reference.rightsEvidence.sourceUrl === federalRights &&
    record.licenseSource === federalRights &&
    record.itemUrl === `${service}/913?f=pjson` &&
    item?.OBJECTID === 913 &&
    item.Name === 'm_3311754_sw_11_060_20180821_20190412' &&
    item.Category === 1 &&
    reference.dateCreated === '2018-08-21' &&
    `${url.origin}${url.pathname}` === `${service}/exportImage` &&
    mosaic?.mosaicMethod === 'esriMosaicLockRaster' &&
    mosaic.lockRasterIds?.length === 1 &&
    mosaic.lockRasterIds[0] === item.OBJECTID &&
    q.get('bboxSR') === '4326' &&
    q.get('imageSR') === '4326' &&
    q.get('format') === 'jpg' &&
    q.get('f') === 'image' &&
    q.get('adjustAspectRatio') === 'false' &&
    q.get('interpolation') === 'RSP_NearestNeighbor' &&
    q.get('size') === `${reference.width},${reference.height}` &&
    box?.length === 4 &&
    box.every(Number.isFinite) &&
    box[0] < -117.337 &&
    box[2] > -117.336 &&
    box[1] < 33.135 &&
    box[3] > 33.137 &&
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

function cordobaPhotochromMatches(reference, image, record) {
  const item = record.item;
  const scan = record.resources?.find((resource) => resource.id === 'ppmsca.52789');
  return (
    reference.sourceUrl === 'https://www.loc.gov/pictures/item/2017660370/' &&
    reference.rightsEvidence?.sourceUrl === `${reference.sourceUrl}?fo=json` &&
    item?.link === reference.sourceUrl &&
    item.id === '2017660370' &&
    item.rights_information === 'No known restrictions on publication.' &&
    typeof item.created_published === 'string' &&
    item.created_published.includes('Photoglob Company') &&
    Array.isArray(item.notes) &&
    item.notes.some(({ note }) => note.includes('Detroit Publishing Company, 1905')) &&
    item.notes.some(({ note }) => note.includes('Detroit Publishing Company; 1906; 42865')) &&
    reference.artist === 'Photoglob Company' &&
    reference.dateCreated === '1890–1906' &&
    scan?.large === reference.downloadUrl &&
    scan.large === 'https://cdn.loc.gov/service/pnp/ppmsca/52700/52789v.jpg' &&
    scan.note === 'digital file from original item' &&
    scan.large_s === image.length &&
    image.includes(Buffer.from('http://hdl.loc.gov/loc.pnp/ppmsca.52789')) &&
    reference.originalReview?.rendition === 'native-archive-jpeg'
  );
}

function matsonWinterPalaceMatches(reference, image, record) {
  const item = record.catalog?.item;
  const scan = record.catalog?.resources?.find((resource) => resource.id === 'matpc.00282');
  return (
    reference.sourceUrl === 'https://www.loc.gov/pictures/item/2019691542/' &&
    reference.rightsEvidence?.sourceUrl === `${reference.sourceUrl}?fo=json` &&
    record.collectionRightsUrl === 'https://wwws.loc.gov/rr/print/res/258_mats.html' &&
    typeof record.collectionRights === 'string' &&
    record.collectionRights.includes(
      'In 2003, the Home dedicated the intellectual property and related rights to the collection to the American public',
    ) &&
    item?.link === reference.sourceUrl &&
    item.id === '2019691542' &&
    item.title === 'Egypt. Luxor. Winter Palace Hotel; from south west' &&
    item.created_published === '[1936]' &&
    reference.dateCreated === '1936' &&
    item.mediums?.some(({ medium }) => medium.includes('negative : glass, dry plate')) &&
    item.notes?.some(({ note }) => note === 'Gift; Episcopal Home; 1978.') &&
    item.collections?.some(({ code }) => code === 'matpc') &&
    item.rights_information?.startsWith('No known restrictions on publication.') &&
    item.rights_information.endsWith('https://hdl.loc.gov/loc.pnp/res.258.mats') &&
    reference.artist === 'American Colony (Jerusalem). Photo Department' &&
    item.creators?.some(
      ({ title, role }) => title === reference.artist && role === 'photographer',
    ) &&
    scan?.large === 'https://cdn.loc.gov/service/pnp/matpc/00200/00282v.jpg' &&
    scan.large === reference.downloadUrl &&
    scan.note === 'digital file from original' &&
    scan.large_s === image.length &&
    reference.originalReview?.rendition === 'native-archive-jpeg'
  );
}

function tughlaqabadFanshawePlateMatches(dir, reference, image, record) {
  const plates = {
    431: {
      caption: 'Ruined Walls of Tughlakabad.',
      sha256: 'c0f3fa6ae59d53b8808684fe91bdd67ff74211d42ad342587e2d0e7cb2840207',
    },
    432: {
      caption: 'Tomb of the Emperor Tughlak Shah, Tughlakabad.',
      sha256: '5df4eac965354e0f05318f59746c8c04a2ae444a18e33ebec8a597cd928bd625',
    },
  };
  const item = 'cu31924095603076';
  const leaf = reference.originalReview?.leaf;
  const plate = plates[leaf];
  if (!plate) return false;
  return (
    path.basename(dir) === 'tughlaqabad_fort' &&
    reference.sourceUrl === `https://archive.org/details/${item}/page/n${leaf}/mode/1up` &&
    reference.downloadUrl === `https://archive.org/download/${item}/page/n${leaf}.jpg` &&
    reference.rightsEvidence?.sourceUrl === `https://archive.org/metadata/${item}` &&
    record.metadata?.identifier === item &&
    record.metadata?.title === 'Delhi past and present' &&
    record.metadata?.contributor === 'Cornell University Library' &&
    record.metadata?.publisher === 'London, J. Murray' &&
    record.metadata?.date === '1902' &&
    reference.artist === 'Sultan Ahmad Khan' &&
    reference.originalReview?.rendition === 'original-published-plate' &&
    reference.originalReview?.caption === plate.caption &&
    hash(image) === plate.sha256
  );
}

function cooktownStateLibraryMatches(reference, record) {
  const downloads = record.downloads?.FL9491;
  const download =
    Array.isArray(downloads) &&
    downloads.find((item) => item?.ext === 'jpg' && item.term === reference.downloadUrl);
  return (
    reference.sourceUrl === 'https://hdl.handle.net/10462/deriv/69051' &&
    reference.rightsEvidence?.sourceUrl === 'https://collections.slq.qld.gov.au/api/IE9151' &&
    record.id === 'IE9151' &&
    record.permalink === reference.sourceUrl &&
    record.title === "St Mary's Convent at Cooktown" &&
    record.type === 'image' &&
    record.copyright === 'Out of copyright.' &&
    record.contentPolicy === 'AR_EVERYONE' &&
    typeof record.original === 'string' &&
    record.original.includes('Negative number: 70851') &&
    reference.archiveItem === '70851' &&
    reference.artist === 'Unknown author' &&
    reference.downloadUrl ===
      'https://digital.slq.qld.gov.au/delivery/DeliveryManagerServlet?dps_func=download&dps_pid=FL9493' &&
    typeof download?.text === 'string' &&
    download.text.includes('70851.tif - Medium quality') &&
    reference.originalReview?.rendition === 'native-archive-jpeg'
  );
}

function efeoCambodiaMuseumPlateMatches(dir, reference, image, record) {
  const booklet = 'https://angkordatabase.asia/books/lecole-francaise-dextreme-orient';
  const pdf = 'https://cdn.angkordatabase.asia/libs/docs/efeo-booklet-1930.pdf';
  const library = 'https://parismuseescollections.paris.fr/en/node/875532';
  const review = reference.originalReview;
  return (
    path.basename(dir) === 'national_museum_of_cambodia' &&
    reference.sourceUrl === booklet &&
    reference.downloadUrl === pdf &&
    reference.rightsEvidence?.sourceUrl === library &&
    reference.artist === 'Uncredited photograph, Extrême-Asie' &&
    review?.rendition === 'original-published-plate' &&
    review.pdfPage === 69 &&
    review.printedPlate === 'XV' &&
    record.scanIdentifier === 'FRB060882104_ASE_8812_C1' &&
    record.libraryCatalogUrl === library &&
    record.libraryCatalogImprint === 'Hanoi : Imprimerie d’Extrême-Orient, 1930' &&
    record.originalPublication === 'Extrême-Asie, mars 1930, p. 119' &&
    record.pdfUrl === pdf &&
    record.pdfSha256 === '9f6eccac3bee6fe2c079b19b7135f00ac4ef6e020fd88575d2537edcbe41a16b' &&
    hash(image) === 'e775c38b7b27fafbfd2af15057db02086d411d08c3745837cdf312278050a3da'
  );
}

function archivesOntarioHammondMatches(reference, image, record) {
  const page = Object.values(record.native?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  const body = revision?.slots?.main?.['*'] ?? '';
  const title = 'Fort Lennox, Ile aux noix, Quebec, looking southwest (I0017513).jpg';
  return (
    page?.title === 'File:' + title &&
    record.archive === 'Archives of Ontario' &&
    record.fonds === 'F 1075 M. O. Hammond fonds' &&
    record.archiveProgram === 'https://www.archives.gov.on.ca/topic/digitized-records/' &&
    reference.sourceUrl === info?.descriptionurl &&
    reference.rightsEvidence?.sourceUrl?.startsWith('https://commons.wikimedia.org/w/api.php?') &&
    info?.url?.split('?')[0] === reference.downloadUrl &&
    info?.sha1 === hash(image, 'sha1') &&
    info?.size === image.length &&
    info.user === 'NeilAmagna' &&
    info.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    info.extmetadata?.AttributionRequired?.value === 'false' &&
    info.extmetadata?.Restrictions?.value === '' &&
    revision?.parentid === 0 &&
    revision.user === info.user &&
    revision.revid === reference.nativeRevision &&
    reference.dateCreated === '1923' &&
    reference.accessionNumber === 'I0017513' &&
    body.includes('|date = 1923\n') &&
    body.includes('|accession number = I0017513\n') &&
    body.includes('|institution = [https://www.wikidata.org/wiki/Q2860571 Archives of Ontario]') &&
    body.includes('|source = [https://www.wikidata.org/wiki/Q102389236 M.O. Hammond fonds]') &&
    body.includes('{{PD-US-expired |1=PD-Canada |country=CA |hide_us_warning=1}}') &&
    reference.originalReview?.rendition === 'native-archive-jpeg'
  );
}

function dendurGauPlateMatches(reference, image, record) {
  const expected = {
    23: ['15272266', '871c88220ef7f01665770868d7c4c9071a0265d44da728d6baac7efd3b7368f1'],
    24: ['15272267', 'ab94d5ed9fde7992e2a706eb2a9765f8da6905da3a235ef52b996e5bc5648809'],
    25: ['15272268', '43749dc5be5ac0c1c6c2fe29bff933ae4ab123b36f1ebd31f1ea5f4833a5d90e'],
  };
  const plate = expected[reference.plate];
  if (!plate) return false;
  const [id, digest] = plate;
  const site = 'https://www.e-rara.ch';
  const iiif = site + '/i3f/v20';
  return (
    reference.artist === 'Franz Christian Gau' &&
    reference.sourceUrl === site + '/zut/content/pageview/' + id &&
    reference.downloadUrl === iiif + '/' + id + '/full/2400,/0/default.jpg' &&
    reference.rightsEvidence?.sourceUrl === site + '/zut/content/titleinfo/15272200' &&
    record.holding === 'ETH-Bibliothek Zürich, Rar 9984' &&
    record.doi === 'https://doi.org/10.3931/e-rara-56517' &&
    record.published === 1822 &&
    record.license === 'https://creativecommons.org/publicdomain/mark/1.0/' &&
    record.manifest === iiif + '/15272200/manifest' &&
    record.canvas?.['@id'] === iiif + '/15272200/canvas/' + id &&
    record.canvas?.images?.[0]?.resource?.service?.['@id'] === iiif + '/' + id &&
    reference.originalReview?.rendition === 'complete-iiif-page-2400px' &&
    hash(image) === digest
  );
}

function dendurMetPhotographMatches(reference, image, record) {
  return (
    reference.artist === 'Félix Teynard' &&
    reference.sourceUrl === 'https://www.metmuseum.org/art/collection/search/261903' &&
    reference.rightsEvidence?.sourceUrl ===
      'https://collectionapi.metmuseum.org/public/collection/v1/objects/261903' &&
    record.objectID === 261903 &&
    record.isPublicDomain === true &&
    record.title === 'Dandour, Vue Générale des Ruines' &&
    record.artistDisplayName === reference.artist &&
    record.objectDate === '1851–52, printed 1853–54' &&
    record.primaryImage === reference.downloadUrl &&
    reference.downloadUrl === 'https://images.metmuseum.org/CRDImages/ph/original/DP138593.jpg' &&
    reference.originalReview?.rendition === 'native-archive-jpeg' &&
    hash(image) === '73010e2c0ab523476e81dae7c13c3aeea709bad4182262e4ee10a0c4fdc7c7d3'
  );
}

function alHakimMetDaguerreotypeMatches(reference, image, record) {
  const item = '726474';
  const objectUrl = `https://www.metmuseum.org/art/collection/search/${item}`;
  const apiUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${item}`;
  return (
    reference.artist === 'Joseph-Philibert Girault de Prangey' &&
    reference.sourceUrl === objectUrl &&
    reference.rightsEvidence?.sourceUrl === apiUrl &&
    record.objectID === Number(item) &&
    record.objectURL === objectUrl &&
    record.isPublicDomain === true &&
    record.accessionNumber === '2016.603' &&
    record.artistDisplayName === reference.artist &&
    record.objectDate === '1842–1843' &&
    record.primaryImage === reference.downloadUrl &&
    reference.downloadUrl ===
      'https://images.metmuseum.org/CRDImages/ph/original/DP-13897-115.jpg' &&
    reference.originalReview?.rendition === 'native-archive-jpeg' &&
    hash(image) === '23a4f43155a1b4433899824d33350047bfd498b18bcd4b111b5f4111cb27fe2f'
  );
}

function ottawaWarMuseumConstructionMatches(reference, image, record) {
  const name = 'Canadian_War_Museum_Under_Construction_31may2004.JPG';
  const source = `https://commons.wikimedia.org/wiki/File:${name}`;
  const info = record.imageinfo?.[0];
  const first = record.revisions?.[0];
  const original = first?.slots?.main?.content ?? '';
  return (
    reference.artist === 'RealGrouchy' &&
    reference.sourceUrl === source &&
    reference.rightsEvidence?.sourceUrl === source &&
    record.pageid === 6692347 &&
    info?.descriptionurl === source &&
    info?.url?.split('?')[0] === reference.downloadUrl &&
    reference.downloadUrl === `https://upload.wikimedia.org/wikipedia/commons/e/ed/${name}` &&
    info?.sha1 === hash(image, 'sha1') &&
    info?.size === image.length &&
    info?.width === 911 &&
    info?.height === 309 &&
    info?.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    info?.extmetadata?.Copyrighted?.value === 'False' &&
    info?.extmetadata?.AttributionRequired?.value === 'false' &&
    first?.revid === 20992272 &&
    first?.parentid === 0 &&
    original.includes('{{PD-user-w|en|wikipedia|RealGrouchy}}') &&
    original.includes(
      '2004-06-01 15:47 [[:en:User:RealGrouchy|RealGrouchy]] 911&times;309&times; (34789 bytes)',
    ) &&
    reference.originalReview?.rendition === 'native-original' &&
    hash(image) === 'e79373b6ee80743e4c160780b8b79265d341de189ac4794638ba90ad533e47e0'
  );
}

function maconTerminalPostcardMatches(reference, image, manifest) {
  const cards = {
    166: {
      title: 'Terminal Station at Night, Macon, Ga',
      sha256: '89cc170b6513a319ae4616564a15a66369368c3b5ae0a8338cbf3dae1d5cfdb2',
    },
    175: {
      title: 'Terminal Station, Macon, Georgia',
      sha256: 'fbf3dde07cbcd4613c262774f8ea6d53685b6194dc9b848db1628ddda404c82b',
    },
  };
  const card = cards[reference.accessionNumber];
  if (!card) return false;
  const id = `zgz-odom_epogpc_mccls-pstcrd-${reference.accessionNumber}`;
  const item = `https://dlg.usg.edu/record/${id}`;
  const service = `https://dlg.usg.edu/images/iiif/2/dlg%2Fzgz-odom%2Fepogpc%2F${id}%2F${id}-00001.jp2`;
  const metadata = (key) =>
    manifest.metadata?.find((field) => field.label?.en?.[0] === key)?.value?.en?.[0];
  return (
    reference.title === card.title &&
    reference.sourceUrl === item &&
    reference.rightsEvidence?.sourceUrl === manifest.id &&
    manifest.id === `${item}/presentation/manifest.json` &&
    manifest.rights === 'http://rightsstatements.org/vocab/NoC-US/1.0/' &&
    manifest.provider?.[0]?.label?.en?.[0] === 'Moultrie-Colquitt County Library System' &&
    metadata('Title') === card.title &&
    metadata('DLG record ID') === id &&
    metadata('Creator') === reference.artist &&
    manifest.items?.[0]?.items?.[0]?.items?.[0]?.body?.service?.[0]?.id === service &&
    reference.downloadUrl === `${service}/full/1600,/0/default.jpg` &&
    reference.originalReview?.rendition === 'full-postcard-iiif-1600px' &&
    hash(image) === card.sha256
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
    (!(reference.origin === 'usgs-national-map-amos-naip' && amosNaipMatches(reference, image, record)) &&
      !(reference.origin === 'dlg-macon-terminal-public-domain-postcard'
      ? maconTerminalPostcardMatches(reference, image, record)
      : reference.origin === 'loc-matson-winter-palace-public-domain'
        ? matsonWinterPalaceMatches(reference, image, record)
        : reference.origin === 'met-al-hakim-1842-daguerreotype'
          ? alHakimMetDaguerreotypeMatches(reference, image, record)
          : reference.origin === 'cornell-tughlaqabad-1902-plate'
            ? tughlaqabadFanshawePlateMatches(dir, reference, image, record)
            : reference.origin === 'commons-mccord-public-domain'
              ? mccordMatches(dir, reference, image, record)
              : reference.origin === 'commons-rietberg-sepahsalar-public-domain'
                ? rietbergSepahsalarMatches(dir, reference, image, record)
                : reference.origin === 'banq-public-domain-atlas'
                  ? banqMatches(reference, record)
                  : reference.origin === 'te-papa-expired-postcard'
                    ? tePapaPostcardMatches(dir, reference, record)
                    : reference.origin === 'rijksmuseum-public-domain'
                      ? rijksmuseumMatches(reference, record)
                      : reference.origin === 'loc-cordoba-photochrom-public-domain'
                        ? cordobaPhotochromMatches(reference, image, record)
                        : reference.origin === 'slq-cooktown-expired-original'
                          ? cooktownStateLibraryMatches(reference, record)
                          : reference.origin === 'commons-museu-paulista-expired-postcard'
                            ? museuPaulistaPostcardMatches(dir, reference, image, record)
                            : reference.origin === 'usgs-national-map-pr-naip'
                              ? puertoRicoNaipMatches(reference, record)
                              : reference.origin === 'usda-naip-california-2009'
                                ? californiaNaip2009Matches(reference, record)
                                : reference.origin === 'usda-naip-encina-2018'
                                  ? encinaNaip2018Matches(reference, record)
                                  : reference.origin === 'commons-presidencia-sv-cc0'
                                    ? salvadoranPresidencyMatches(reference, image, record)
                                    : reference.origin === 'efeo-cambodia-museum-1930-plate'
                                      ? efeoCambodiaMuseumPlateMatches(
                                          dir,
                                          reference,
                                          image,
                                          record,
                                        )
                                      : reference.origin ===
                                          'archives-ontario-hammond-expired-photograph'
                                        ? archivesOntarioHammondMatches(reference, image, record)
                                        : reference.origin === 'eth-gau-dendur-1822-survey'
                                          ? dendurGauPlateMatches(reference, image, record)
                                          : reference.origin === 'met-teynard-dendur-1851-original'
                                            ? dendurMetPhotographMatches(reference, image, record)
                                            : reference.origin ===
                                                'commons-ottawa-war-museum-original-construction'
                                              ? ottawaWarMuseumConstructionMatches(
                                                  reference,
                                                  image,
                                                  record,
                                                )
                                              : reference.origin ===
                                                  'commons-nara-bureau-of-public-roads' &&
                                                reference.originalReview?.rendition ===
                                                  'native-archive-jpeg' &&
                                                bureauOfPublicRoadsMatches(
                                                  reference,
                                                  image,
                                                  record,
                                                )))
  )
    blockers.push('supplemental-archive-item-public-domain-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: blockers.length === 0,
  };
}

/** Verify the Yale archive's original scale drawing of the house-church baptistery. */
export function inspectYaleDuraBaptisteryPlan(dir, reference) {
  const image = readBound(dir, reference);
  const proof = readRecord(dir, reference.rightsEvidence);
  const filename =
    "Dura-Europos archival photograph, YUAG negative number 1938.5999.5275'49 -object-id-76.tif";
  const page = proof?.commonsPage;
  const native = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  const body = revision?.slots?.main?.['*'] ?? '';
  const item = 'https://library.artstor.org/#/asset/SS7730479_7730479_10837877';
  const eligible = Boolean(
    image &&
      reference.origin === 'yale-dura-archive-cc0-plan' &&
      reference.license === 'CC0' &&
      reference.artist === 'anonymous' &&
      reference.sourceUrl ===
        `https://commons.wikimedia.org/wiki/File:${filename.replaceAll(' ', '_')}` &&
      reference.archiveIdentifier === "1938.5999.5275'49" &&
      proof?.item === item &&
      proof?.policyUrl === 'https://duraeuroposarchive.org/image-rights/' &&
      proof?.grant === 'https://creativecommons.org/publicdomain/zero/1.0/' &&
      proof?.institution === 'Yale University Art Gallery' &&
      page?.title === `File:${filename}` &&
      body.includes('{{Yale Digital Dura-Europos Archive}}') &&
      /\{\{Cc-zero\}\}/i.test(body) &&
      body.includes(item) &&
      body.includes('Christian Church #8, elevation, section and plan') &&
      revision?.revid === reference.nativeRevision &&
      /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/4\/42\//.test(
        reference.downloadUrl,
      ) &&
      native?.url?.split('?')[0] === reference.downloadUrl &&
      native?.sha1 === hash(image, 'sha1') &&
      native?.size === image.length &&
      native?.extmetadata?.LicenseShortName?.value === 'CC0' &&
      native?.extmetadata?.AttributionRequired?.value === 'false' &&
      native?.extmetadata?.Restrictions?.value === '' &&
      reference.visuallyReviewedForThisPolicy === true &&
      reference.originalReview?.status === 'inspected' &&
      reference.originalReview?.rendition === 'native-archive-tiff',
  );
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers: eligible ? [] : ['supplemental-yale-excavation-plan-unverified'],
    eligible,
  };
}
