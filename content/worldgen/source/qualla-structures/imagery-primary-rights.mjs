/** Recover an omitted Qualla category from an exact, hash-bound primary rights record. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const modelRightsRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const text = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();
/** A first-party PD-user grant authored at the original native upload. */
export function nativeNamedUploaderRelease(page, username, binding) {
  const first = page?.revisions?.[0],
    info = page?.imageinfo?.[0],
    body = first?.slots?.main?.['*'] ?? '',
    field = (name) => body.match(new RegExp(`\\|\\s*${name}\\s*=([^\\r\\n]*)`, 'i'))?.[1]?.trim(),
    credit = field('source'),
    author = field('author') ?? field('photographer'),
    nativeLink = `[[User:${username}|${username}]]`,
    germanLink = `[[:de:Benutzerin:${username}|${username}]]`,
    own = /^\{\{\s*own(?: photo)?\s*\}\}$/i.test(credit ?? ''),
    namedSource = credit === `Von ${germanLink}`;
  return (
    binding?.kind === 'contemporaneous-named-native-photographer' &&
    /^[A-Za-z0-9_-]+$/.test(username ?? '') &&
    binding.username === username &&
    first?.parentid === 0 &&
    first.user === username &&
    binding.revision === first.revid &&
    page.imageinfo?.length > 0 &&
    page.imageinfo.every((v) => v.user === username) &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(page.imageinfo.at(-1).timestamp)) < 300000 &&
    ['PD-user', 'PD-User'].some((tag) =>
      body.replace(/\s*\|\s*/g, '|').includes(`{{${tag}|${username}}}`),
    ) &&
    !/\{\{\s*(?:cc-by|gfdl|copyright)/i.test(body) &&
    ((own && (author === nativeLink || author === germanLink)) ||
      (namedSource && (author === undefined || author === germanLink))) &&
    text(info?.extmetadata?.Artist?.value) === username &&
    info?.extmetadata?.Copyrighted?.value === 'False' &&
    info?.extmetadata?.AttributionRequired?.value === 'false' &&
    !text(info?.extmetadata?.Restrictions?.value)
  );
}
export function inspectQuallaPrimaryRights(reference, original, root = modelRightsRoot) {
  const proof = reference.publicDomainEvidence;
  if (!proof) return null;
  const failed = {
    eligible: false,
    basis: null,
    blocker: 'primary-public-domain-rights-unverified',
  };
  if (
    ![
      'commons-native-usace-photo',
      'commons-native-doe-photo',
      'commons-native-nps-photo',
      'commons-native-expired-publication',
      'commons-native-expired-library-photo',
      'commons-native-expired-periodical-photo',
      'commons-native-expired-us-book-photo',
      'commons-native-expired-historical-print',
      'commons-native-slq-archival-photo',
      'commons-native-self-released-photo',
    ].includes(proof.kind) ||
    !/^content\/worldgen\/source\/places\/[a-z0-9_/-]+\/reference-rights\/[a-z0-9-]+\.json$/.test(
      proof.path ?? '',
    ) ||
    !/^[a-f0-9]{64}$/.test(proof.sha256 ?? '')
  )
    return failed;
  const file = path.resolve(root, proof.path);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return failed;
  const real = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  if (path.isAbsolute(real) || real === '..' || real.startsWith(`..${path.sep}`)) return failed;
  const bytes = fs.readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== proof.sha256) return failed;
  let record, source, ref, title;
  try {
    record = JSON.parse(bytes);
    source = new URL(record.source);
    ref = new URL(reference.sourceUrl);
    title = decodeURIComponent(ref.pathname.replace(/^\/wiki\//, '')).replaceAll('_', ' ');
  } catch {
    return failed;
  }
  const page = Object.values(record.query?.pages ?? {}).find((p) => p.title === title),
    info = page?.imageinfo?.[0],
    wiki = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    clean = text(wiki),
    photographer = text(proof.photographer);
  let nativeUrl;
  try {
    nativeUrl = new URL(info?.url);
  } catch {
    return failed;
  }
  if (
    source.origin !== 'https://commons.wikimedia.org' ||
    source.pathname !== '/w/api.php' ||
    source.searchParams.get('action') !== 'query' ||
    !source.searchParams.get('prop')?.split('|').includes('revisions') ||
    !source.searchParams.get('prop')?.split('|').includes('imageinfo') ||
    !source.searchParams
      .get('titles')
      ?.split('|')
      .map((s) => s.replaceAll('_', ' '))
      .includes(title) ||
    ref.origin !== 'https://commons.wikimedia.org' ||
    !title.startsWith('File:') ||
    !page?.revisions?.[0]?.revid ||
    nativeUrl.origin !== 'https://upload.wikimedia.org' ||
    nativeUrl.pathname.includes('/thumb/') ||
    info?.sha1 !== createHash('sha1').update(original).digest('hex') ||
    reference.license !== 'Public domain' ||
    info.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    (!['commons-native-slq-archival-photo', 'commons-native-expired-us-book-photo'].includes(
      proof.kind,
    ) &&
      (!reference.artist?.trim() ||
        !text(info.extmetadata?.Artist?.value).includes(reference.artist)))
  )
    return failed;
  let basis, creatorAttribution;
  if (proof.kind === 'commons-native-self-released-photo') {
    const author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1],
      sourceField = wiki.match(/\|\s*source\s*=([^\r\n]*)/i)?.[1];
    const ordinarySelf = !(
      !photographer ||
      /\b(?:unknown|anonymous|unidentified|unrecorded)\b/i.test(photographer) ||
      photographer !== reference.artist ||
      text(author) !== photographer ||
      text(info.extmetadata?.Artist?.value) !== photographer ||
      !/^\s*\{\{\s*own(?: photo)?\s*\}\}\s*$/i.test(sourceField ?? '') ||
      !/\{\{\s*PD-self\s*\}\}/i.test(wiki) ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    );

    const namedSelf =
      photographer === reference.artist &&
      /\.jpe?g$/i.test(nativeUrl.pathname) &&
      !record.continue?.iicontinue &&
      nativeNamedUploaderRelease(page, photographer, proof.nativeCreatorRelease);
    if (!ordinarySelf && !namedSelf) return failed;
    basis = `Exact native creator photograph; pinned own-photo/PD-self or contemporaneous named-native-photographer release by ${photographer}`;
  } else if (proof.kind === 'commons-native-expired-library-photo') {
    // Recover a missing local category only from the exact native library photo.
    // A PD-old label alone is insufficient: bind its named creator's lifespan,
    // nineteenth-century date and item-specific national-library citation too.
    const field = (name) =>
        wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '',
      dates = [...field('date').matchAll(/\b(\d{4})\b/g)].map((m) => Number(m[1])),
      life = info.extmetadata?.Artist?.value?.match(/\((\d{4})\s*[-–]\s*(\d{4})\)/),
      born = Number(life?.[1]),
      died = Number(life?.[2]),
      sourceField = field('source');
    if (
      !Number.isInteger(proof.photoYear) ||
      proof.photoYear < 1800 ||
      proof.photoYear > 1875 ||
      !dates.length ||
      !dates.includes(proof.photoYear) ||
      dates.some((y) => y > 1875) ||
      !Number.isInteger(born) ||
      born < 1500 ||
      born >= proof.photoYear ||
      !Number.isInteger(died) ||
      died < proof.photoYear ||
      died > 1900 ||
      proof.creatorDied !== died ||
      field('author') !== `{{Creator:${reference.artist}}}` ||
      /unknown|anonymous|unidentified|unrecorded|assumed|probably/i.test(clean) ||
      !/\{\{\s*PD-old\s*\}\}/i.test(wiki) ||
      /\{\{\s*(?:cc[- ]by|gfdl)/i.test(wiki) ||
      info.extmetadata?.Restrictions?.value?.trim() ||
      !/^bdh\d{10}$/.test(proof.archiveItem ?? '') ||
      !sourceField.includes('{{Institution:Biblioteca Nacional de España}}') ||
      !sourceField.includes(`http://bdh.bne.es/bnesearch/detalle/${proof.archiveItem}`) ||
      sourceField !== proof.sourceCitation
    )
      return failed;
    basis = `Exact native national-library photograph, ${proof.photoYear}; named creator ${reference.artist} (${born}-${died}), item ${proof.archiveItem}, explicit PD-old grant and original bytes bound`;
  } else if (proof.kind === 'commons-native-slq-archival-photo') {
    const author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1];
    if (
      proof.archive !== 'state-library-queensland' ||
      !/^10462\/deriv\/\d+$/.test(proof.archiveItem ?? '') ||
      !/\{\{\s*PD-Australia\s*\}\}/i.test(wiki) ||
      !/\{\{\s*StateLibQld-License\s*\}\}/i.test(wiki) ||
      !wiki.includes(`id=${proof.archiveItem}|`) ||
      !wiki.includes('John Oxley Library, State Library of Queensland') ||
      !/\.jpe?g$/i.test(nativeUrl.pathname) ||
      author === undefined ||
      text(author) ||
      reference.artist?.trim() ||
      text(info.extmetadata?.Artist?.value)
    )
      return failed;
    basis = `Exact native SLQ archival photograph; pinned public-domain release and archive item ${proof.archiveItem}, photographer unrecorded`;
    creatorAttribution = 'unrecorded-archival';
  } else if (proof.kind === 'commons-native-expired-periodical-photo') {
    const sourceField = wiki.match(/\|\s*source\s*=([^\r\n]*)/i)?.[1] ?? '',
      dateField = wiki.match(/\|\s*date\s*=([^\r\n]*)/i)?.[1] ?? '',
      author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1] ?? '';
    if (
      proof.publicationTitle !== 'Caras y Caretas' ||
      proof.publicationCountry !== 'AR' ||
      !Number.isInteger(proof.publicationYear) ||
      proof.publicationYear < 1898 ||
      proof.publicationYear > 1922 ||
      !Number.isInteger(proof.issueNumber) ||
      proof.issueNumber < 1 ||
      !/^https:\/\/hemerotecadigital\.bne\.es\/issue\.vm\?id=\d+$/.test(
        proof.publicationRecord ?? '',
      ) ||
      !sourceField.includes(proof.publicationRecord.replace(/^https:/, 'http:')) ||
      !/''Caras y Caretas''/i.test(sourceField) ||
      !new RegExp(`\\bn\\s+${proof.issueNumber}\\b`).test(sourceField) ||
      !new RegExp(`^\\s*${proof.publicationYear}-\\d{2}\\s*$`).test(dateField) ||
      !reference.artist?.trim() ||
      /unknown|anonymous|unrecorded/i.test(reference.artist) ||
      text(author) !== reference.artist ||
      !/\{\{\s*PD-AR-Photo\s*\}\}/i.test(wiki) ||
      !/\{\{\s*PD-US-expired\s*\}\}/i.test(wiki)
    )
      return failed;
    basis = `Exact native photograph in ${proof.publicationTitle}, issue ${proof.issueNumber}, ${proof.publicationYear}; named photographic credit, BNE publication record and explicit PD-AR-Photo/PD-US-expired grants`;
  } else if (proof.kind === 'commons-native-expired-us-book-photo') {
    const publication = record.publicationEvidence,
      metadata = publication?.catalog?.metadata,
      sourceField = wiki.match(/\|\s*source\s*=([^\r\n]*)/i)?.[1] ?? '',
      dateField = wiki.match(/\|\s*date\s*=([^\r\n]*)/i)?.[1] ?? '',
      author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1] ?? '';
    if (
      !/^[a-z0-9]+$/.test(proof.archiveIdentifier ?? '') ||
      publication?.source !== `https://archive.org/metadata/${proof.archiveIdentifier}` ||
      metadata?.identifier !== proof.archiveIdentifier ||
      metadata?.['possible-copyright-status'] !== 'NOT_IN_COPYRIGHT' ||
      metadata?.['copyright-region'] !== 'US' ||
      !/New York/.test(metadata?.publisher ?? '') ||
      !metadata?.contributor?.trim() ||
      !Number.isInteger(proof.publicationYear) ||
      proof.publicationYear < 1800 ||
      proof.publicationYear > 1922 ||
      metadata?.date !== String(proof.publicationYear) ||
      dateField.trim() !== metadata.date ||
      !proof.publicationTitle?.trim() ||
      !metadata?.title?.startsWith(proof.publicationTitle) ||
      !sourceField.includes(proof.publicationTitle) ||
      !sourceField.includes('New York') ||
      !proof.bookAuthor?.trim() ||
      !sourceField.includes(proof.bookAuthor) ||
      !metadata.creator?.startsWith(`${proof.bookAuthor.split(' ').at(-1)},`) ||
      !/\{\{\s*PD-US-expired\s*\|\s*country=US\s*\}\}/i.test(wiki) ||
      reference.artist !== 'Unknown' ||
      text(author) !== 'Unknown' ||
      text(info.extmetadata?.Artist?.value) !== 'Unknown' ||
      !publication.plateCaption?.includes('Lodging House of the Hotel Bristol') ||
      publication.plateCaptionSource !==
        `https://archive.org/download/${proof.archiveIdentifier}/${proof.archiveIdentifier}_djvu.txt`
    )
      return failed;
    basis = `Exact native photographic plate in ${proof.publicationTitle}, New York ${proof.publicationYear}; original library book/caption and NOT_IN_COPYRIGHT record, photographer unrecorded`;
    creatorAttribution = 'unrecorded-published-plate';
  } else if (proof.kind === 'commons-native-expired-historical-print') {
    const field = (name) =>
        wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]+)`, 'i'))?.[1]?.trim() ?? '',
      sourceField = field('source'),
      dateField = field('date'),
      authorField = field('author');
    if (
      !Number.isInteger(proof.publicationYear) ||
      proof.publicationYear < 1800 ||
      proof.publicationYear > 1875 ||
      !proof.sourceCitation?.trim() ||
      sourceField !== proof.sourceCitation ||
      /unknown|anonymous|unidentified|unrecorded|assumed|probably/i.test(
        reference.artist + authorField + clean,
      ) ||
      (!dateField.includes(String(proof.publicationYear)) &&
        !sourceField.includes(String(proof.publicationYear)))
    )
      return failed;
    if (proof.recordClass === 'brazilian-periodical') {
      if (
        proof.publicationTitle !== 'A Vida Fluminense' ||
        !Number.isInteger(proof.issueNumber) ||
        proof.issueNumber < 1 ||
        proof.issueNumber > 200 ||
        sourceField !== `A Vida Fluminense, nº ${proof.issueNumber}` ||
        !/^186[0-9]-\d\d-\d\d$/.test(dateField) ||
        !/\{\{\s*PD-Brazil-media\s*\}\}/i.test(wiki) ||
        !(
          text(authorField) === reference.artist ||
          authorField === `{{Creator:${reference.artist}}}`
        )
      )
        return failed;
    } else if (proof.recordClass === 'brazilian-library-map') {
      if (
        !/\{\{\s*PD-Brazil-media\s*\}\}/i.test(wiki) ||
        text(authorField) !== reference.artist ||
        !/^186[0-9]$/.test(dateField) ||
        proof.publicationYear !== Number(dateField) ||
        !sourceField.includes('Rio de Janeiro, RJ: Semana Ilustrada') ||
        !/^https:\/\/objdigital\.bn\.br\/objdigital2\/acervo_digital\/div_cartografia\/cart\d+\/cart\d+\.jpg$/.test(
          proof.archiveOriginal ?? '',
        ) ||
        !sourceField.includes(proof.archiveOriginal.replace('https:', 'http:'))
      )
        return failed;
    } else if (proof.recordClass === 'named-old-map') {
      if (
        !/\bmap|\bplan/i.test(clean) ||
        !/\{\{\s*PD-old-70-1923\s*\}\}/i.test(wiki) ||
        text(authorField) !== reference.artist ||
        !Number.isInteger(proof.creatorDied) ||
        proof.creatorDied < 1800 ||
        proof.creatorDied > 1915 ||
        !authorField.includes(String(proof.creatorDied))
      )
        return failed;
    } else return failed;
    basis = `Exact native historical print, ${proof.publicationYear}; named original creator, matched source citation and explicit ${proof.recordClass.startsWith('brazilian-') ? 'PD-Brazil-media historical print' : 'PD-old-70-1923 map'} grant`;
  } else if (proof.kind === 'commons-native-usace-photo') {
    if (
      !/\{\{\s*PD-USGov-Military-Army-USACE\s*\}\}/i.test(wiki) ||
      !/^U\.S\. Army Corps of Engineers(?: Sacramento District)?$/.test(reference.artist) ||
      !photographer ||
      photographer.split(' ').length < 2 ||
      /unknown|uncredited|not specified/i.test(photographer) ||
      !clean.includes(`U.S. Army Photo/ ${photographer}`)
    )
      return failed;
    basis =
      'Exact native USACE government photograph; pinned primary PD-USGov-Military-Army-USACE record and named Army photo credit';
  } else if (proof.kind === 'commons-native-doe-photo') {
    if (
      reference.artist !== 'ENERGY.GOV' ||
      !/\{\{\s*PD-USGov-DOE\s*\}\}/i.test(wiki) ||
      !/\|\s*Source\s*=\s*\[https:\/\/www\.flickr\.com\/photos\/departmentofenergy\/\d+\//i.test(
        wiki,
      ) ||
      !/\{\{User:FlickreviewR\/reviewed-pass\|ENERGY\.GOV\|https:\/\/www\.flickr\.com\/photos\/37916456@N02\/\d+\|[^|]+\|United States Government Work\|\}\}/.test(
        wiki,
      )
    )
      return failed;
    basis =
      'Exact native DOE photograph; pinned primary PD-USGov-DOE record and reviewed ENERGY.GOV United States Government Work release';
  } else if (proof.kind === 'commons-native-nps-photo') {
    if (
      reference.artist !== 'NPS' ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(proof.npgalleryAssetId ?? '') ||
      !wiki.includes(`{{NPGallery-accession|${proof.npgalleryAssetId}}}`) ||
      !/\{\{\s*PD-USGov-NPS\s*\}\}/i.test(wiki) ||
      !/\|\s*photographer\s*=\s*\{\{en\|1=NPS\}\}/i.test(wiki) ||
      !/\|\s*publisher\s*=\s*\{\{en\|1=U\.S\. National Park Service\}\}/i.test(wiki) ||
      !/\|\s*source\s*=\s*\{\{NPGallery-source\}\}/i.test(wiki)
    )
      return failed;
    basis =
      'Exact native NPS agency photograph; pinned PD-USGov-NPS release, NPS photographer/publisher and matching NPGallery accession';
  } else {
    const field = (name) => wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]+)`, 'i'))?.[1] ?? '',
      year = proof.publicationYear,
      sourceField = field('Source'),
      dateField = field('Date');
    if (
      !Number.isInteger(year) ||
      year < 1800 ||
      year > 1922 ||
      !proof.publicationTitle?.trim() ||
      !proof.sourceCitation?.startsWith(proof.publicationTitle) ||
      !proof.publicationDate?.includes(String(year)) ||
      !dateField.includes(proof.publicationDate) ||
      !sourceField.includes(proof.sourceCitation) ||
      !/https?:\/\/hdl\.handle\.net\/2027\/[a-z0-9.]+/i.test(sourceField) ||
      !text(field('Author')).includes(reference.artist) ||
      !/^\s*Pre-1923\s*$/i.test(field('Permission')) ||
      !/\{\{\s*PD-US\s*\}\}/i.test(wiki) ||
      !/journal/i.test(wiki) ||
      !/US publication published before 1923/i.test(wiki)
    )
      return failed;
    basis = `Exact native scan of ${proof.publicationTitle}, ${proof.publicationDate}; pinned dated US journal publication, publisher, archival plate and PD-US record`;
  }
  return {
    eligible: true,
    basis,
    path: proof.path,
    sha256: proof.sha256,
    nativeSha1: info.sha1,
    revision: page.revisions[0].revid,
    ...(creatorAttribution ? { creatorAttribution } : {}),
  };
}
