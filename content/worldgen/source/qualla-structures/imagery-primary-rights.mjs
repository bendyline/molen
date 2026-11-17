/** Recover an omitted Qualla category from an exact, hash-bound primary rights record. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bureauOfPublicRoadsMatches } from './imagery-public-archives.mjs';

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

/** Bind a transferred English Wikipedia photograph to its original upload log. */
function nativeTransferredUploaderRelease(page, username, binding, original) {
  const revision = page?.revisions?.[0];
  const info = page?.imageinfo?.[0];
  const wiki = revision?.slots?.main?.['*'] ?? '';
  const account = `[[:en:User:${username}|${username}]]`;
  const originalLog = wiki.split('{{Original upload log}}')[1] ?? '';
  const originalUpload = originalLog
    .split('\n')
    .find((row) =>
      row.includes(`${info?.width}×${info?.height} (${info?.size} bytes) || ${account}`),
    );
  return (
    binding?.kind === 'english-wikipedia-original-upload-log' &&
    /^[A-Za-z0-9_-]+$/.test(username ?? '') &&
    binding.revision === revision?.revid &&
    wiki.includes('|Source={{own work by original uploader}}') &&
    wiki.includes(`|Author=${account}`) &&
    wiki.includes(`{{PD-user-w|en|wikipedia|${username}}}`) &&
    originalLog.includes(`{{original description|en.wikipedia|${page.title.slice(5)}}}`) &&
    originalUpload?.includes('I (~~~) created this work entirely by myself.') &&
    !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) &&
    info.size === original.length &&
    text(info.extmetadata?.Artist?.value) === username &&
    info.extmetadata?.Copyrighted?.value === 'False' &&
    info.extmetadata?.AttributionRequired?.value === 'false' &&
    !text(info.extmetadata?.Restrictions?.value)
  );
}

function nativeTransferredNamedPhotograph(page, username, binding, original) {
  const revision = page?.revisions?.[0];
  const info = page?.imageinfo?.[0];
  const wiki = revision?.slots?.main?.['*'] ?? '';
  const log = wiki.split('{{Original upload log}}')[1] ?? '';
  const account = `[[:en:User:${username}|${username}]]`;
  const photo = `Photo by [[User:${username}]],`;
  const uploader = 'File Upload Bot (Magnus Manske)';
  const upload = log
    .split('\n')
    .find((row) =>
      row.includes(
        `${account} ${info?.width}&times;${info?.height}&times; (${info?.size} bytes) ''<nowiki>${photo}`,
      ),
    );
  const uploadDate = upload?.match(/^\* (\d{4}-\d{2}-\d{2}) \d{2}:\d{2} /)?.[1];
  const meta = info?.extmetadata;
  return (
    binding?.kind === 'english-wikipedia-named-photograph-transfer' &&
    /^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/.test(username) &&
    revision?.revid === binding.revision &&
    revision.parentid === 0 &&
    revision.user === uploader &&
    page.imageinfo.length === 1 &&
    info.user === uploader &&
    Math.abs(Date.parse(revision.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    !!uploadDate &&
    Date.parse(uploadDate) < Date.parse(info.timestamp) &&
    wiki.includes(`|Date={{Original upload date|${uploadDate}}}`) &&
    wiki.includes(`|Author=Original uploader was {{user at project|${username}|wikipedia|en}}`) &&
    wiki.includes('|Permission=Released into the public domain (by the author).') &&
    wiki.includes(`{{PD-user-w|en|wikipedia|${username}}}`) &&
    log.includes(`{{original description|en.wikipedia|${page.title.slice(5)}}}`) &&
    info.size === original.length &&
    text(meta?.Artist?.value) === `${username} at English Wikipedia` &&
    String(meta?.Artist?.value).includes(
      `href="https://en.wikipedia.org/wiki/User:${username.replaceAll(' ', '_')}"`,
    ) &&
    text(meta?.Credit?.value) === 'Self-photographed' &&
    meta?.Copyrighted?.value === 'False' &&
    meta?.AttributionRequired?.value === 'false' &&
    !text(meta?.Restrictions?.value)
  );
}

/** Dated book photograph with the same named, long-deceased photographer in both records. */
export function nativeExpiredNamedBookPhoto(page, publication, proof, artist) {
  const wiki = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    info = page?.imageinfo?.[0],
    field = (name) =>
      wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '',
    metadata = publication?.catalog?.metadata,
    year = proof.publicationYear,
    born = proof.creatorBorn,
    died = proof.creatorDied,
    id = proof.archiveIdentifier,
    creator = `${artist} (${born}-${died})`,
    creators = [metadata?.creator].flat();
  return (
    /^[a-z0-9][a-z0-9-]+$/.test(id ?? '') &&
    typeof artist === 'string' &&
    artist.trim().length > 3 &&
    !/unknown|anonymous|unidentified|unrecorded|assumed|probably/i.test(text(wiki)) &&
    Number.isInteger(year) &&
    year >= 1800 &&
    year <= 1922 &&
    Number.isInteger(born) &&
    born >= 1500 &&
    born < year &&
    Number.isInteger(died) &&
    died >= year &&
    died <= 1915 &&
    field('author') === creator &&
    text(info?.extmetadata?.Artist?.value) === creator &&
    field('date') === `${year}-12-31` &&
    field('source') === `https://archive.org/details/${id}` &&
    typeof proof.publicationTitle === 'string' &&
    proof.publicationTitle.length > 3 &&
    field('description').includes(`From ''${proof.publicationTitle}''`) &&
    /\{\{\s*PD-old-70-1923\s*\}\}/i.test(wiki) &&
    !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) &&
    info?.extmetadata?.Copyrighted?.value === 'False' &&
    info?.extmetadata?.AttributionRequired?.value === 'false' &&
    !text(info?.extmetadata?.Restrictions?.value) &&
    publication?.source === `https://archive.org/metadata/${id}` &&
    metadata?.identifier === id &&
    metadata?.date === String(year) &&
    typeof metadata?.title === 'string' &&
    metadata.title.toLowerCase().includes(proof.publicationTitle.toLowerCase()) &&
    metadata?.licenseurl === 'http://creativecommons.org/publicdomain/mark/1.0/' &&
    typeof metadata?.source === 'string' &&
    /(?:Library|Libraries)\b/.test(metadata.source) &&
    typeof proof.archiveCreatorCitation === 'string' &&
    proof.archiveCreatorCitation ===
      `${artist.split(' ').at(-1)}, ${artist.split(' ').slice(0, -1).join(' ')}, ${born}-${died}` &&
    creators.includes(proof.archiveCreatorCitation) &&
    typeof metadata?.description === 'string' &&
    metadata.description.includes(`photographs specifically taken by ${artist}`)
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
      'commons-native-whitehouse-photo',
      'commons-native-usace-photo',
      'commons-native-doe-photo',
      'commons-native-nasa-esrs-photo',
      'commons-native-reviewed-state-department-photo',
      'commons-native-state-department-staff-photo',
      'commons-native-nps-photo',
      'commons-native-usaf-reference-series-photo',
      'commons-native-nara-bureau-of-public-roads',
      'commons-native-expired-publication',
      'commons-native-expired-library-photo',
      'commons-native-lac-expired-photo',
      'commons-native-expired-periodical-photo',
      'commons-native-expired-us-periodical-photo',
      'commons-native-expired-us-book-photo',
      'commons-native-expired-named-book-photo',
      'commons-native-expired-historical-print',
      'commons-native-slq-archival-photo',
      'commons-native-qsa-government-plan',
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
        !text(info.extmetadata?.Artist?.value).includes(text(reference.artist))))
  )
    return failed;
  let basis, creatorAttribution;
  if (proof.kind === 'commons-native-nara-bureau-of-public-roads') {
    if (
      reference.originalReview?.rendition !== 'exact-published-native-original' ||
      !bureauOfPublicRoadsMatches(reference, original, page)
    )
      return failed;
    basis = 'Bureau of Public Roads federal archive original with the native PD-USGov-DOC release.';
  } else if (proof.kind === 'commons-native-nasa-esrs-photo') {
    const field = (name) =>
      wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\r\\n]*)`, 'i'))?.[1]?.trim();
    const id = `${proof.mission}-${proof.roll}-${proof.frame}`;
    if (
      !/^ISS\d{3}$/.test(proof.mission ?? '') ||
      proof.roll !== 'E' ||
      !/^\d{4,6}$/.test(String(proof.frame ?? '')) ||
      title !== `File:${id} - View of Earth.jpg` ||
      !/\{\{ESRS-image\s*\n/.test(wiki) ||
      field('mission') !== proof.mission ||
      field('roll') !== proof.roll ||
      field('frame') !== String(proof.frame) ||
      !wiki.includes(`{{NASA-image|id=${id}|center=JSC}}`) ||
      !/\{\{\s*PD-USGov-NASA\s*\}\}/.test(wiki) ||
      reference.artist !==
        'Earth Science and Remote Sensing Unit, Lyndon B. Johnson Space Center' ||
      /contractor|courtesy|provided by/i.test(clean) ||
      /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      info.size !== original.length ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    )
      return failed;
    basis = `Exact native NASA JSC Earth Science and Remote Sensing Unit photograph ${id}; pinned mission/roll/frame, NASA-image and PD-USGov-NASA release, original bytes and named agency bound.`;
  } else if (proof.kind === 'commons-native-self-released-photo') {
    const author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1],
      sourceField = wiki.match(/\|\s*source\s*=([^\r\n]*)/i)?.[1];
    const nativeLink = `[[User:${photographer}|${photographer}]]`;
    const binding = proof.nativeCreatorRelease;
    const history = record.creatorHistory?.[title.slice(5)]?.history;
    const historicPage = Object.values(history?.query?.pages ?? {}).find(
      (item) => item.title === title,
    );
    const firstRelease = historicPage?.revisions?.[0];
    const firstWikitext = firstRelease?.slots?.main?.['*'] ?? '';
    const [corrected, initial] = historicPage?.imageinfo ?? [];
    const perspectiveCorrection =
      binding?.kind === 'perspective-corrected-original' &&
      historicPage?.imageinfo?.length === 2 &&
      !history?.continue?.iicontinue &&
      firstRelease?.parentid === 0 &&
      firstRelease.user === photographer &&
      firstRelease.revid === binding.revision &&
      initial?.user === photographer &&
      Number.isFinite(Date.parse(initial.timestamp)) &&
      Math.abs(Date.parse(firstRelease.timestamp) - Date.parse(initial.timestamp)) < 300000 &&
      firstWikitext.includes(nativeLink) &&
      /\|\s*source\s*=\s*Own work by uploader\s*(?:\n|\|)/i.test(firstWikitext) &&
      /\{\{\s*PD-self\s*\}\}/i.test(firstWikitext) &&
      corrected?.user === info.user &&
      corrected.user !== initial.user &&
      corrected.sha1 === info.sha1 &&
      corrected.timestamp === info.timestamp &&
      corrected.size === original.length &&
      corrected.width <= initial.width &&
      corrected.height <= initial.height &&
      corrected.comment === 'Tilt and perspective corrected' &&
      info.extmetadata?.Copyrighted?.value === 'False' &&
      info.extmetadata?.AttributionRequired?.value === 'false' &&
      !text(info.extmetadata?.Restrictions?.value);
    const ordinarySelf = !(
      !photographer ||
      /\b(?:unknown|anonymous|unidentified|unrecorded)\b/i.test(photographer) ||
      photographer !== reference.artist ||
      (text(author) !== photographer &&
        !(
          author?.trim() === nativeLink &&
          (info.user === photographer || perspectiveCorrection)
        )) ||
      text(info.extmetadata?.Artist?.value) !== photographer ||
      !/^\s*\{\{\s*own(?: photo)?\s*\}\}\s*$/i.test(sourceField ?? '') ||
      !/\{\{\s*PD-self\s*\}\}/i.test(wiki) ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    );

    // Commons' explicit self-photographed declaration with the same named author link.
    // Bind the original/grant directly; do not invent or repair local Qualla categories.
    const selfPhotographed =
      /^[A-Za-z0-9_-]+$/.test(photographer) &&
      photographer === reference.artist &&
      author?.trim() === `[[User:${photographer}|${photographer}]]` &&
      /^\s*\{\{\s*self-photographed\s*\}\}\s*$/i.test(sourceField ?? '') &&
      /\{\{\s*PD-self\s*\}\}/i.test(wiki) &&
      !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) &&
      /\.jpe?g$/i.test(nativeUrl.pathname) &&
      text(info.extmetadata?.Artist?.value) === photographer &&
      info.extmetadata?.Copyrighted?.value === 'False' &&
      info.extmetadata?.AttributionRequired?.value === 'false' &&
      !text(info.extmetadata?.Restrictions?.value);
    const namedSelf =
      photographer === reference.artist &&
      /\.jpe?g$/i.test(nativeUrl.pathname) &&
      !record.continue?.iicontinue &&
      nativeNamedUploaderRelease(page, photographer, proof.nativeCreatorRelease);
    const transferredSelf =
      photographer === reference.artist &&
      /\.jpe?g$/i.test(nativeUrl.pathname) &&
      nativeTransferredUploaderRelease(page, photographer, binding, original);
    const transferredNamedPhotograph =
      reference.artist === `${photographer} at English Wikipedia` &&
      /\.jpe?g$/i.test(nativeUrl.pathname) &&
      !record.continue?.iicontinue &&
      nativeTransferredNamedPhotograph(page, photographer, binding, original);
    // Early Japanese uploads say "the uploader themself" in both fields.
    // Bind that first-person claim to the original uploading account and time;
    // a later PD-self tag or a translated artist label alone is insufficient.
    const first = page?.revisions?.[0],
      japaneseUploaderSelf =
        binding?.kind === 'contemporaneous-japanese-uploader-self-release' &&
        /^[A-Za-z0-9_-]+$/.test(binding.username ?? '') &&
        first?.parentid === 0 &&
        first.user === binding.username &&
        first.revid === binding.revision &&
        page.imageinfo.length === 1 &&
        !record.continue?.iicontinue &&
        info.user === binding.username &&
        Number.isFinite(Date.parse(first.timestamp)) &&
        Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
        photographer === '投稿者本人' &&
        reference.artist === photographer &&
        author?.trim() === photographer &&
        sourceField?.trim() === photographer &&
        text(info.extmetadata?.Artist?.value) === photographer &&
        text(info.extmetadata?.Credit?.value) === photographer &&
        /\{\{\s*PD-self\s*\}\}/i.test(wiki) &&
        !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) &&
        /\.jpe?g$/i.test(nativeUrl.pathname) &&
        info.size === original.length &&
        info.extmetadata?.Copyrighted?.value === 'False' &&
        info.extmetadata?.AttributionRequired?.value === 'false' &&
        !text(info.extmetadata?.Restrictions?.value);
    // Other early Japanese originals sign the source with the uploading account
    // and say "photographed by the uploader". Require the first native release,
    // same sole upload and minute-exact signature, including a retained wiki alias.
    const uploadedAt = new Date(first?.timestamp ?? 0),
      month = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ][uploadedAt.getUTCMonth()],
      signatureTime = `${String(uploadedAt.getUTCHours()).padStart(2, '0')}:${String(uploadedAt.getUTCMinutes()).padStart(2, '0')}, ${uploadedAt.getUTCDate()} ${month} ${uploadedAt.getUTCFullYear()} (UTC)`,
      signatureName = binding?.signatureUsername,
      japaneseSignedPhotograph =
        binding?.kind === 'contemporaneous-japanese-signed-photographer-release' &&
        /^[\p{L}\p{N}_-]+$/u.test(signatureName ?? '') &&
        [signatureName, `${signatureName}~commonswiki`].includes(binding.username) &&
        first?.parentid === 0 &&
        first.user === binding.username &&
        first.revid === binding.revision &&
        page.imageinfo.length === 1 &&
        !record.continue?.iicontinue &&
        info.user === binding.username &&
        Number.isFinite(Date.parse(first.timestamp)) &&
        Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
        photographer === '投稿者が撮影' &&
        reference.artist === photographer &&
        author?.trim() === photographer &&
        sourceField?.startsWith(`[[User:${signatureName}|${signatureName}]]`) &&
        sourceField.endsWith(signatureTime) &&
        text(info.extmetadata?.Artist?.value) === photographer &&
        text(info.extmetadata?.Credit?.value).includes(signatureName) &&
        text(info.extmetadata?.Credit?.value).endsWith(signatureTime) &&
        /\{\{\s*PD-self\s*\}\}/i.test(wiki) &&
        !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) &&
        /\.jpe?g$/i.test(nativeUrl.pathname) &&
        info.size === original.length &&
        info.extmetadata?.Copyrighted?.value === 'False' &&
        info.extmetadata?.AttributionRequired?.value === 'false' &&
        !text(info.extmetadata?.Restrictions?.value);
    if (
      !ordinarySelf &&
      !selfPhotographed &&
      !namedSelf &&
      !transferredSelf &&
      !transferredNamedPhotograph &&
      !japaneseUploaderSelf &&
      !japaneseSignedPhotograph
    )
      return failed;
    basis = transferredNamedPhotograph
      ? `Original upload log and public-domain release by ${photographer}, preserved in the first Commons transfer.`
      : `Exact native creator photograph; pinned own-photo/PD-self or contemporaneous named-native-photographer release by ${photographer}`;
  } else if (proof.kind === 'commons-native-lac-expired-photo') {
    const archive = record.archive;
    if (
      title !== 'File:Fort Temiscamingue 1876.jpg' ||
      reference.artist !== 'George McLaughlin' ||
      proof.photoYear !== 1876 ||
      proof.archiveItem !== 3257337 ||
      archive?.mikanId !== proof.archiveItem ||
      archive.url !==
        'https://recherche-collection-search.bac-lac.gc.ca/eng/home/record?idnumber=3257337&app=fonandcol' ||
      archive.accession !== '1966-094 NPC' ||
      archive.reproduction !== 'PA-028724' ||
      archive.photographer !== reference.artist ||
      archive.date !== proof.photoYear ||
      archive.restriction !== 'Nil' ||
      archive.copyright !== 'Expired' ||
      page.revisions[0].revid !== reference.nativeRevision ||
      info.size !== original.length ||
      !wiki.includes('|Source={{LAC|Acc. No. 1966-094|3257337}}') ||
      !wiki.includes('|Author=George McLaughlin\n') ||
      !wiki.includes('|Date=1876\n') ||
      !wiki.includes('{{PD-Canada}}{{PD-1923}}') ||
      /\{\{\s*(?:cc[- ]by|gfdl)/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      reference.originalReview?.rendition !== 'exact-published-native-original'
    )
      return failed;
    basis =
      'Exact Qualla original of the 1876 photograph, with both native public-domain tags and the Library and Archives Canada expiry record for MIKAN 3257337.';
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
  } else if (proof.kind === 'commons-native-qsa-government-plan') {
    // These two original Crown architectural drawings have an explicit native
    // government-work release; do not infer one from an anonymous photo credit.
    const plans = {
        'File:Ground Floor Plan of Government House, Brisbane, c 1940.jpg': '35295240095',
        'File:First Floor Plan of Government House, Brisbane, c 1940.jpg': '35254984396',
      },
      item = plans[title],
      sourceField = wiki.match(/\|\s*source\s*=([^\r\n]*)/i)?.[1] ?? '',
      dateField = wiki.match(/\|\s*date\s*=([^\r\n]*)/i)?.[1] ?? '',
      author = wiki.match(/\|\s*author\s*=([^\r\n]*)/i)?.[1]?.trim();
    if (
      !item ||
      proof.archive !== 'queensland-state-archives' ||
      proof.archiveItem !== item ||
      proof.creationYear !== 1940 ||
      reference.artist !== 'Unknown author' ||
      author !== '{{unknown|author}}' ||
      !sourceField.includes(`https://www.flickr.com/photos/queenslandstatearchives/${item}`) ||
      !sourceField.includes('published by Queensland State Archives') ||
      !sourceField.includes(title.slice(5, -4)) ||
      !(dateField.includes('1940') || dateField.trim() === '2012-04-15 00:55:02') ||
      !/\{\{\s*PD-AustraliaGov\s*\}\}/i.test(wiki) ||
      !/\{\{\s*PDreview\|/i.test(wiki) ||
      /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    )
      return failed;
    basis = `Exact native circa1940 Crown architectural plan, Queensland State Archives item ${item}; explicit PD-AustraliaGov release and reviewed original bytes bound`;
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
  } else if (proof.kind === 'commons-native-expired-us-periodical-photo') {
    const publication = record.publicationEvidence;
    const field = (name) =>
      wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]+)`, 'i'))?.[1]?.trim();
    const scanName = publication?.scan?.path;
    if (
      title !== 'File:Santo Domingo Cathedral (1899).jpg' ||
      proof.publicationTitle !== "Munsey's Magazine" ||
      proof.publicationYear !== 1899 ||
      publication?.catalog !== 'https://books.google.com/books?id=NOAAAAAAYAAJ' ||
      publication?.leaf !== 'https://books.google.com/books?id=NOAAAAAAYAAJ&pg=PA891' ||
      publication?.publisher !== 'Frank A. Munsey & Company, New York' ||
      !text(publication?.caption).includes('THE CATHEDRAL AND COLUMBUS PARK') ||
      field('source') !== "''Munsey's Magazine'' (vol. XX)" ||
      field('date') !== '1899-02' ||
      field('author') !== '{{Anonymous}}' ||
      reference.artist !== 'AnonymousUnknown author' ||
      !/\{\{\s*PD-US-expired\s*\}\}/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      info.size !== original.length ||
      !/^[a-z0-9-]+\.jpg$/.test(scanName ?? '')
    )
      return failed;
    const scan = path.join(path.dirname(file), scanName);
    if (
      !fs.existsSync(scan) ||
      !fs.lstatSync(scan).isFile() ||
      createHash('sha256').update(fs.readFileSync(scan)).digest('hex') !== publication.scan.sha256
    )
      return failed;
    basis =
      'Exact native Qualla photograph matched to the printed illustration on page 891 of the 1899 New York edition of Munsey’s Magazine and the native PD-US-expired record.';
  } else if (proof.kind === 'commons-native-expired-named-book-photo') {
    if (
      !/\.jpe?g$/i.test(nativeUrl.pathname) ||
      !nativeExpiredNamedBookPhoto(page, record.publicationEvidence, proof, reference.artist)
    )
      return failed;
    basis = `Exact native photographic plate in ${proof.publicationTitle}, ${proof.publicationYear}; named photographer ${reference.artist} (${proof.creatorBorn}-${proof.creatorDied}), matching library book record and explicit PD-old-70-1923 grant`;
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
      authorField = field('author'),
      originalDrawing = proof.recordClass === 'pedrero-1892-original-drawing',
      lessmannPhoto = proof.recordClass === 'lessmann-caracas-circa-1870-photo',
      garreaudAlbumPlate = proof.recordClass === 'garreaud-1900-republica-peruana-plate-21',
      year = originalDrawing || lessmannPhoto ? proof.creationYear : proof.publicationYear;
    if (
      !Number.isInteger(year) ||
      year < 1800 ||
      year > (garreaudAlbumPlate ? 1900 : originalDrawing ? 1892 : 1875) ||
      !proof.sourceCitation?.trim() ||
      sourceField !== proof.sourceCitation ||
      /unknown|anonymous|unidentified|unrecorded|assumed|probably/i.test(
        reference.artist + authorField + clean,
      ) ||
      (!dateField.includes(String(year)) && !sourceField.includes(String(year)))
    )
      return failed;
    if (originalDrawing) {
      // This is a dated original drawing, not an asserted 1892 publication.
      // Bind the named artist, exact original, native scan release and lifespan.
      if (
        title !==
          'File:Original, Santo Domingo de Silos, 24.9.1892, colección Maruja Pedrero, dibujo por Mariano Pedrero.jpg' ||
        page.revisions[0].revid !== 892318834 ||
        info.sha1 !== '6310452578a63856f6a7cb36b9886700e73e8671' ||
        year !== 1892 ||
        proof.creatorDied !== 1927 ||
        reference.artist !== 'Mariano Pedrero (1865-1927)' ||
        authorField !== reference.artist ||
        dateField !== '1892-09-24' ||
        sourceField !== 'collection of Marceliano Pedrero' ||
        !/\{\{PD-Scan\|1=PD-old-auto-expired\|deathyear=1927\}\}/i.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
    } else if (lessmannPhoto) {
      if (
        title !==
          'File:Lessman, Federico Carlos - Plaza Major mit Kathedrale (Zeno Fotografie).jpg' ||
        page.revisions[0].revid !== 1262799309 ||
        info.sha1 !== 'bcc874c038a6d6ff764bc393dc2b02176077bef8' ||
        year !== 1870 ||
        proof.creatorDied !== 1886 ||
        proof.creatorRecord !== 'https://elarchivo.org/federico-lessmann/' ||
        reference.artist !== 'Lessman, Federico Carlos' ||
        authorField !== reference.artist ||
        dateField !== '{{circa|1870}}' ||
        sourceField !== '[http://www.zeno.org/Fotografien.images/I/PHO02798.jpg Image]<br>' ||
        !wiki.includes('{{Zeno.org|20001882589}}') ||
        !wiki.includes('Instituto autónomo Biblioteca Nacional Caracas') ||
        !wiki.includes('{{PD-Art-Zeno}}') ||
        !wiki.includes('{{PD-old-70-1923}}') ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact circa-1870 photograph by Federico Lessmann (1826–1886), bound to Zeno item 20001882589, the Caracas national library collection and the native PD-Art-Zeno and PD-old-70-1923 notices.';
    } else if (garreaudAlbumPlate) {
      if (
        title !== 'File:N° 21 Lima. Yglesia de Sto Domingo.png' ||
        page.revisions[0].revid !== 1222300596 ||
        info.sha1 !== '74d300274af19205b3062afa1430e04cd2f98c1e' ||
        info.size !== original.length ||
        reference.artist !== 'Fernando Garreaud' ||
        authorField !== reference.artist ||
        dateField !== '1898–1900' ||
        year !== 1900 ||
        proof.creatorDied !== 1929 ||
        sourceField !== '[[:Category:República Peruana|República Peruana]]' ||
        proof.edition !== 'https://memoriaperu.bnp.gob.pe/micrositio/album-republica-peruana' ||
        proof.authority !== 'https://memoriaperu.bnp.gob.pe/micrositio/fernando-garreaud' ||
        !wiki.includes('{{PD-Peru-photo}}') ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact plate 21 of the República Peruana album published in 1900, photographer Fernando Garreaud (1870–1929); verified native PD-Peru-photo record and National Library of Peru edition and creator records.';
    } else if (proof.recordClass === 'coste-keisaria-1867-engraving') {
      // Qualla retained the PD label but omitted the native expiry category.
      // Bind the actual named engraving and its 1867 publication; never infer
      // expiry from an architectural subject or an anonymous historical date.
      if (
        title !== 'File:Bazar tailors by Pascal Coste.jpg' ||
        reference.artist !== 'Pascal Coste' ||
        authorField !== '{{Creator:Pascal Coste}}' ||
        dateField !== '1840' ||
        year !== 1867 ||
        proof.creatorBorn !== 1787 ||
        proof.creatorDied !== 1879 ||
        sourceField !==
          'Monuments modernes de la Perse mesurés, dessinés et décrits, éd. Morel, 1867' ||
        !/\{\{\s*PD-Art\s*\|\s*PD-old-auto-expired\s*\|\s*deathyear=1879\s*\}\}/i.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
    } else if (proof.recordClass === 'terragno-1875-theatre-photo') {
      if (
        title !== 'File:O Teatro São Pedro - 1875 - Luigi Terragno.jpg' ||
        page.revisions[0].revid !== 1270638996 ||
        info.sha1 !== '84cfc412af0fd31d3ccbce2dc67ce5a39e9ef5d4' ||
        info.size !== original.length ||
        reference.artist !== 'Luigi Terragno' ||
        authorField !== '{{Creator:Luigi Terragno}}' ||
        dateField !== '1875' ||
        year !== 1875 ||
        proof.creatorDied !== 1891 ||
        proof.authority !== 'https://brasilianafotografica.bn.gov.br/?tag=luis-terragno' ||
        proof.photographCitation !==
          'https://vitruvius.com.br/revistas/read/arquitextos/17.204/6559/en' ||
        !/\{\{\s*PD-old-auto-1923\s*\|\s*deathyear=1891\s*\}\}/.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native copy of the published 1875 Porto Alegre theatre photograph by Luigi Terragno, with named creator, original bytes and PD-old-auto-1923 bound.';
    } else if (proof.recordClass === 'sl-nsw-1872-pickering-public-buildings') {
      // The original government album identifies its photographer, publication,
      // and the specimen held by the State Library of New South Wales.
      if (
        title !== 'File:SLNSW 479514 11 Australian Museum SH 564.jpg' ||
        page.revisions[0].revid !== 1081628741 ||
        info.sha1 !== '27c36d0efa840d2de0cd55ccb098853961a8a3ed' ||
        info.size !== original.length ||
        reference.artist !== 'Pickering, Charles Percy' ||
        authorField !== 'Pickering, Charles Percy (New South Wales. Government Printing Office)' ||
        dateField !== '1872' ||
        year !== 1872 ||
        proof.archiveItem !== '479514' ||
        !sourceField.includes('itemID=479514 (item)') ||
        !sourceField.includes('itemID=442753 (album)') ||
        !wiki.includes('{{SLNSW-image|1=479514}}') ||
        !wiki.includes('Thomas Richards, Government Printer - 1872') ||
        !wiki.includes('|Album_Copying_Conditions=Out of copyright  - Created before 1955') ||
        !wiki.includes('{{PD-Australia}}') ||
        !wiki.includes('{{PD-1996|country=Australia}}') ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native Australian Museum photograph by Charles Percy Pickering, published by the NSW Government Printer in 1872; State Library of NSW item 479514 and historical public-domain tags verified.';
    } else if (proof.recordClass === 'clarke-1830-sans-souci-engraving') {
      if (
        title !== 'File:Le Palais Sans-Souci à Milot en Haïti, 1830.png' ||
        page.revisions[0].revid !== 1009242269 ||
        info.sha1 !== '197a3e902fdd72eddbf957cc7ee67819bec3456c' ||
        info.size !== original.length ||
        !sourceField.includes('H. Colburn and R. Bentley, 1830, Volume II.') ||
        year !== 1830 ||
        authorField !== 'J. Clarke, graveur, Colburn & Bentley (Londres)' ||
        !/\{\{\s*PD-old-70-1923\s*\}\}/i.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native J. Clarke engraving from Charles Mackenzie’s 1830 Notes on Haiti, Volume II. Original publication imprint, native bytes and explicit expiry bound.';
    } else if (proof.recordClass === 'kuestner-1836-sans-souci-lithograph') {
      if (
        title !==
          'File:Sans souci Haiti illustration Naturhistorische Reise nach der westindischen Insel Hayti Brasiliensium Ritter1826.jpg' ||
        page.revisions[0].revid !== 689667852 ||
        info.sha1 !== 'd22051d09a88d735219abbb811b697c81693d133' ||
        info.size !== original.length ||
        reference.artist !== 'Gottfried Küstner / Carl Ritter' ||
        authorField !==
          '{{technique|lithography}} {{Creator:Gottfried Küstner}} {{after}} {{technique|drawing}} {{Creator:Carl Ritter}}' ||
        !sourceField.startsWith('[http://botanicus.org/page/1475767 Botanicus.com]') ||
        dateField !== '1836' ||
        year !== 1836 ||
        proof.creatorDied !== 1864 ||
        !/\{\{\s*PD-old-100-1923\s*\}\}/i.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native copy of Gottfried Küstner’s published 1836 lithograph of Sans-Souci after Carl Ritter, with its named creators, Botanicus printing citation, original bytes and explicit expiry bound.';
    } else if (proof.recordClass === 'bourne-lahore-fort-photo') {
      if (
        title !== 'File:Hazuri Bagh Pavillion and Lahore Fort in 1863.jpg' ||
        page.revisions[0].revid !== 1294962574 ||
        info.sha1 !== '1f724820bc3f8cb7f48a48fd019522461640699f' ||
        info.size !== original.length ||
        year !== 1863 ||
        proof.creatorDied !== 1912 ||
        reference.artist !== 'Samuel Bourne' ||
        authorField !== '{{Creator:Samuel Bourne}}' ||
        dateField !== '1863' ||
        sourceField !==
          'http://www.bl.uk/onlinegallery/onlineex/apac/photocoll/f/019pho000000394u00004000.html' ||
        proof.authority !== 'https://searcharchives.bl.uk/catalog/040-003081187' ||
        !wiki.includes('{{PD-old-70-expired}}') ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native scan of Samuel Bourne’s Lahore Fort photograph, dated circa 1863–1864 by the British Library (Photo 394(4)), with named photographer, original scan bytes and explicit PD-old-70-expired release.';
    } else if (proof.recordClass === 'hartmann-dongola-engraving') {
      if (
        title !== 'File:Dongola Mosque.png' ||
        page.revisions[0].revid !== 1196520823 ||
        info.sha1 !== '6021dd4a5c27deb4d52feab504109ab673a4b5c5' ||
        info.size !== original.length ||
        reference.artist !== 'Robert Hartmann' ||
        authorField !== reference.artist ||
        dateField !== '1868' ||
        year !== 1868 ||
        proof.creatorDied !== 1893 ||
        proof.authority !== 'https://www.deutsche-biographie.de/sfz120277.html' ||
        sourceField !==
          '"Erinnerungen an Nubien" in "Westermann\'s illustrierte deutsche Monatshefte"' ||
        !/\{\{\s*PD-old-70-expired\s*\}\}/.test(wiki) ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
        info.extmetadata?.Copyrighted?.value !== 'False' ||
        info.extmetadata?.AttributionRequired?.value !== 'false' ||
        text(info.extmetadata?.Restrictions?.value)
      )
        return failed;
      basis =
        'Exact native print of the Dongola mosque published in Westermann’s Monatshefte in 1868. Robert Hartmann, 1832–1893. Original bytes and declared public domain verified.';
    } else if (proof.recordClass === 'brazilian-periodical') {
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
    } else if (proof.recordClass === 'bnf-arnaud-1843-map') {
      // The drawing is explicitly attributed to Arnaud in the native object title.
      // Its catalogue's text contributor is not used as a map-creator identity.
      if (
        proof.archiveItem !== 'btv1b84924810' ||
        proof.publicationYear !== 1873 ||
        proof.creatorDied !== 1884 ||
        reference.artist !== 'Arnaud, Thomas-Joseph (1812-1884). Auteur du texte' ||
        authorField !== reference.artist ||
        !title.includes('Fait par Mr. Th. Joseph Arnaud en 1843') ||
        !/\{\{\s*PD-France\s*\}\}/i.test(wiki) ||
        !/\{\{\s*PD-US-expired\s*\}\}/i.test(wiki) ||
        !wiki.includes('{{ARK-BNF|ark:/12148/btv1b84924810}}') ||
        !sourceField.includes('Bibliothèque nationale de France') ||
        !sourceField.includes('GE D-14364') ||
        /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki)
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
    basis ??= originalDrawing
      ? 'Exact native original drawing dated 1892-09-24; Mariano Pedrero (1865-1927), collection of Marceliano Pedrero, explicit PD-Scan/PD-old-auto-expired release and original bytes bound'
      : `Exact native historical print, ${year}; named original creator, matched source citation and explicit ${proof.recordClass.startsWith('brazilian-') ? 'PD-Brazil-media historical print' : proof.recordClass === 'bnf-arnaud-1843-map' ? 'PD-France and PD-US-expired original Arnaud map' : proof.recordClass === 'coste-keisaria-1867-engraving' ? 'PD-Art/PD-old-auto-expired, Pascal Coste (1787-1879)' : 'PD-old-70-1923 map'} grant`;
  } else if (proof.kind === 'commons-native-usaf-reference-series-photo') {
    // This exact published aerial is independently visible in the official government volume.
    // Do not extend this witness to contractor reports, other aircraft photos or whole books.
    const publication = record.publication,
      book = path.resolve(path.dirname(file), '../reference-plans/usaf-reference-series-1989.pdf'),
      model = path.resolve(path.dirname(file), '..'),
      field = (name) => wiki.match(new RegExp(`\\|\\s*${name}\\s*=([^\\r\\n]*)`, 'i'))?.[1]?.trim(),
      citation =
        'Active Air Force Bases Within the United States of America on 17 September 1982 USAF Reference Series, OFFICE OF AIR FORCE HISTORY UNITED STATES AIR FORCE WASHINGTON, D.C., 1989';
    if (
      title !== 'File:Castleafb-1982.jpg' ||
      reference.artist !== 'USAF' ||
      text(info.extmetadata?.Artist?.value) !== 'USAF' ||
      field('Author') !== 'USAF' ||
      field('Date') !== '1982' ||
      field('Source') !== citation ||
      !/\{\{\s*PD-USGov-Military-Air Force\s*\}\}/i.test(wiki) ||
      /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
      info.size !== original.length ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      publication?.source !==
        'https://media.defense.gov/2010/Sep/21/2001330255/-1/-1/0/AFD-100921-026.pdf' ||
      publication?.title !== 'Air Force Bases, Volume I' ||
      publication?.publisher !== 'Office of Air Force History, United States Air Force' ||
      publication?.author !==
        'Robert Mueller, United States Air Force Historical Research Center' ||
      publication?.publicationYear !== 1989 ||
      publication?.titlePdfPage !== 1 ||
      publication?.authorPdfPage !== 7 ||
      publication?.photoPdfPage !== 90 ||
      publication?.photoPrintedPage !== 72 ||
      publication?.photoCaption !== 'Castle AFB, 1982' ||
      publication?.scope !== 'lower-1982-parade-ground-aerial-only' ||
      publication?.originalImageMatched !== true ||
      publication?.personallyInspected !== true ||
      !fs.existsSync(book) ||
      !fs.statSync(book).isFile() ||
      path.relative(fs.realpathSync(model), fs.realpathSync(book)).startsWith('..')
    )
      return failed;
    const bookBytes = fs.readFileSync(book);
    if (
      bookBytes.subarray(0, 5).toString() !== '%PDF-' ||
      publication.bytes !== bookBytes.length ||
      publication.sha256 !== createHash('sha256').update(bookBytes).digest('hex')
    )
      return failed;
    basis =
      'Exact native USAF employee aerial, explicit PD-USGov-Military-Air Force grant; independently matched to the inspected Castle AFB1982 photograph in the original1989 official Reference Series volume, with publication bytes bound. This grants no contractor or unrelated image approval.';
  } else if (proof.kind === 'commons-native-whitehouse-photo') {
    if (
      !/^The White House(?: from Washington, DC)?$/.test(reference.artist) ||
      !/\{\{\s*PD-USGov-POTUS\s*\}\}/i.test(wiki) ||
      !/^[A-Za-z][A-Za-z .'-]+ [A-Za-z][A-Za-z .'-]+$/.test(photographer) ||
      !clean.includes(`Official White House Photo by ${photographer}`) ||
      !/\|\s*Source\s*=\s*\[https:\/\/www\.flickr\.com\/photos\/whitehouse\/\d+\//i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value)
    )
      return failed;
    basis =
      'Exact native official White House photograph; named presidential staff photo credit, official White House Flickr source and explicit PD-USGov-POTUS grant';
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
  } else if (proof.kind === 'commons-native-state-department-staff-photo') {
    const id = proof.flickrId;
    if (
      proof.flickrAccountId !== '9364837@N06' ||
      !/^\d{11}$/.test(id ?? '') ||
      !title.endsWith(`(${id}).jpg`) ||
      !/^[A-Za-z][A-Za-z .'-]+ [A-Za-z][A-Za-z .'-]+$/.test(photographer) ||
      reference.artist !== text(info.extmetadata?.Artist?.value) ||
      !reference.artist.startsWith('U.S. Department of State') ||
      !clean.includes(`State Department photo by ${photographer}/ Public Domain`) ||
      !wiki.includes('[https://www.flickr.com/people/9364837@N06 U.S. Department of State]') ||
      !wiki.includes(`https://www.flickr.com/photos/statephotos/${id}/`) ||
      !/\{\{\s*PD-USGov-DOS\s*\}\}/i.test(wiki) ||
      !wiki.includes(
        `{{FlickreviewR|status=passed|author=U.S. Department of State|sourceurl=https://flickr.com/photos/9364837@N06/${id}|`,
      ) ||
      !/\|reviewlicense=United States Government Work\|reviewer=FlickreviewR 2\}\}/.test(wiki) ||
      /contractor|courtesy|provided by/i.test(clean) ||
      /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      info.size !== original.length ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    )
      return failed;
    basis =
      'Exact native State Department staff photograph: named staff/Public Domain caption, official statephotos account, PD-USGov-DOS and independently reviewed United States Government Work release; original bytes and native record bound.';
  } else if (proof.kind === 'commons-native-reviewed-state-department-photo') {
    const id = proof.flickrId;
    if (
      reference.artist !== 'US Embassy  South Africa' ||
      proof.flickrAccountId !== '101005855@N06' ||
      !/^\d{11}$/.test(id ?? '') ||
      title !== `File:Market Theatre (${id}).jpg` ||
      !/\{\{\s*PD-USGov-DOS\s*\}\}/i.test(wiki) ||
      !wiki.includes(`[https://www.flickr.com/people/101005855@N06 US Embassy  South Africa]`) ||
      !wiki.includes(`https://www.flickr.com/photos/usembassysa/${id}/`) ||
      !wiki.includes(
        `{{FlickreviewR|status=passed|author=USEmbassySA|sourceurl=https://flickr.com/photos/101005855@N06/${id}|`,
      ) ||
      !/\|reviewlicense=United States Government Work\|reviewer=FlickreviewR 2\}\}/.test(wiki) ||
      /\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(wiki) ||
      info.extmetadata?.Copyrighted?.value !== 'False' ||
      info.extmetadata?.AttributionRequired?.value !== 'false' ||
      text(info.extmetadata?.Restrictions?.value) ||
      info.size !== original.length ||
      !/\.jpe?g$/i.test(nativeUrl.pathname)
    )
      return failed;
    basis =
      'Exact native official US Embassy South Africa photograph; pinned PD-USGov-DOS release, matching official agency Flickr account and reviewed United States Government Work grant. Original bytes and native record bound; no Qualla metadata repair.';
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
