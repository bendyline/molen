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
      'commons-native-reviewed-state-department-photo',
      'commons-native-state-department-staff-photo',
      'commons-native-nps-photo',
      'commons-native-usaf-reference-series-photo',
      'commons-native-expired-publication',
      'commons-native-expired-library-photo',
      'commons-native-expired-periodical-photo',
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
    if (!ordinarySelf && !selfPhotographed && !namedSelf) return failed;
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
      year = originalDrawing ? proof.creationYear : proof.publicationYear;
    if (
      !Number.isInteger(year) ||
      year < 1800 ||
      year > (originalDrawing ? 1892 : 1875) ||
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
    basis = originalDrawing
      ? 'Exact native original drawing dated 1892-09-24; Mariano Pedrero (1865-1927), collection of Marceliano Pedrero, explicit PD-Scan/PD-old-auto-expired release and original bytes bound'
      : `Exact native historical print, ${year}; named original creator, matched source citation and explicit ${proof.recordClass.startsWith('brazilian-') ? 'PD-Brazil-media historical print' : proof.recordClass === 'bnf-arnaud-1843-map' ? 'PD-France and PD-US-expired original Arnaud map' : 'PD-old-70-1923 map'} grant`;
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
