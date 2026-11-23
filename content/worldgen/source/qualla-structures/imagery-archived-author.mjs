/** Bind an unchanged Wikipedia author's archived original. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
const plain = (s) => String(s ?? '').replace(/^sha256:/, '');
function bytes(dir, relative) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  )
    return null;
  const file = path.resolve(dir, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const actual = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(actual) || actual === '..' || actual.startsWith(`..${path.sep}`)) return null;
  return fs.readFileSync(file);
}
const escapePattern = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function inspectCreatorUploadedArchive(native, source, download, image, reference) {
  const dedication = reference.creatorDedication;
  const user = dedication.username;
  if (!/^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/.test(user ?? '')) return false;
  const title =
    source?.protocol === 'https:' &&
    source.hostname === 'commons.wikimedia.org' &&
    source.pathname.startsWith('/wiki/File:')
      ? decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ')
      : null;
  const page = Object.values(native?.query?.pages ?? {}).find((item) => item.title === title);
  const first = page?.revisions?.[0];
  const current = page?.imageinfo?.[0];
  const original = page?.imageinfo?.at(-1);
  const body = first?.slots?.main?.content ?? first?.slots?.main?.['*'] ?? '';
  const account = native?.authorAccount?.query?.globaluserinfo;
  const attributes = current?.extmetadata;
  const field = (name) =>
    body
      .split(/\r?\n/)
      .find((line) => line.startsWith(`|${name}=`))
      ?.slice(name.length + 2)
      .trim();
  const credit = String(attributes?.Credit?.value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim();
  const cameraSource = field('Source');
  const cameraAuthor = field('Author');
  const confirmsOriginalRelease = dedication.kind === 'commons-archived-confirmed-self-release';
  const sameUpload =
    original?.timestamp === first?.timestamp ||
    ((cameraSource === 'Own work' || confirmsOriginalRelease) &&
      Date.parse(first?.timestamp) - Date.parse(original?.timestamp) === 1000);
  const cameraCredit =
    (cameraSource === 'my camera' &&
      cameraAuthor === `User:${user}` &&
      attributes?.Artist?.value?.includes(
        `href="//commons.wikimedia.org/wiki/User:${user.replaceAll(' ', '_')}"`,
      ) &&
      credit === 'Own work') ||
    (cameraSource === 'own photo' &&
      cameraAuthor === user &&
      field('Permission') === 'Own work, all rights released (Public domain)' &&
      attributes?.Artist?.value === user &&
      credit === 'Self-photographed') ||
    (cameraSource === 'Own work' &&
      cameraAuthor === `User:${user}` &&
      attributes?.Artist?.value === cameraAuthor &&
      credit === 'Own work');
  const confirmation = page?.revisions?.find(
    ({ revid }) => revid === dedication.confirmationRevision,
  );
  const confirmationBody =
    confirmation?.slots?.main?.content ?? confirmation?.slots?.main?.['*'] ?? '';
  const ownerLink = `[[User:${user}|${user}]]`;
  const confirmedGrant =
    !native?.continue?.rvcontinue &&
    cameraSource === 'self-made' &&
    cameraAuthor === ownerLink &&
    field('Permission') === 'all' &&
    original?.comment?.includes('|Source=self-made') &&
    original?.comment?.includes(`|Author= ${ownerLink}`) &&
    attributes?.Artist?.value?.includes(
      `href="//commons.wikimedia.org/wiki/User:${user.replaceAll(' ', '_')}"`,
    ) &&
    credit === 'Own work' &&
    confirmation?.user === user &&
    Date.parse(confirmation.timestamp) > Date.parse(first?.timestamp) &&
    Date.parse(confirmation.timestamp) < Date.parse(current?.timestamp) &&
    confirmationBody.includes('|Source=self-made') &&
    confirmationBody.includes(`|Author= ${ownerLink}`) &&
    confirmationBody.includes(`{{PD-self|author=I, ${ownerLink}}}`);
  const authoredGrant =
    dedication.kind === 'chinese-wikipedia-archived-author-original'
      ? account?.name === user &&
        account.merged?.some(({ wiki }) => wiki === 'commonswiki') &&
        account.merged?.some(({ wiki }) => wiki === 'zhwiki') &&
        field('Author') === `[[:zh:User:${user}|${user}]]` &&
        field('Source') === 'Self took photo (Own work)' &&
        field('Permission') === `{{PD-user-w|zh|Chinese Wikipedia|${user}}}` &&
        original?.comment?.includes(`{{PD-user-w|zh|Chinese Wikipedia|${user}}}`) &&
        attributes?.Artist?.value?.includes(
          `https://zh.wikipedia.org/wiki/User:${user.replaceAll(' ', '_')}`,
        )
      : confirmsOriginalRelease
        ? confirmedGrant
        : cameraCredit &&
          /^\{\{PD-self\}\}\s*$/im.test(body) &&
          original?.comment?.includes(`|Source=${cameraSource}`) &&
          original.comment.includes(`|Author=${cameraAuthor}`);
  let archive;
  try {
    archive = new URL(original?.url);
  } catch {}
  return (
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    reference.artist === user &&
    !native?.continue?.iicontinue &&
    page?.imageinfo?.length > 1 &&
    first?.parentid === 0 &&
    Number.isInteger(first.revid) &&
    first.revid === dedication.revision &&
    first.user === user &&
    original?.user === user &&
    sameUpload &&
    original.timestamp === dedication.originalUpload?.timestamp &&
    authoredGrant &&
    attributes?.LicenseShortName?.value === 'Public domain' &&
    attributes?.AttributionRequired?.value === 'false' &&
    attributes?.Restrictions?.value === '' &&
    archive?.origin === 'https://upload.wikimedia.org' &&
    archive.pathname.startsWith('/wikipedia/commons/archive/') &&
    decodeURIComponent(archive.pathname).endsWith(`!${title?.slice(5).replaceAll(' ', '_')}`) &&
    archive.origin + archive.pathname === download?.origin + download?.pathname &&
    image &&
    original.size === image.length &&
    hash(image, 'sha1') === original.sha1 &&
    reference.nativeSha1 === original.sha1 &&
    original.sha1 !== current.sha1 &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'native-original'
  );
}

export function inspectArchivedAuthorReference(dir, reference) {
  const blockers = [],
    image = bytes(dir, reference.path),
    snapshot = bytes(dir, reference.rightsEvidence?.path);
  if (!image || hash(image) !== plain(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || hash(snapshot) !== plain(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  let native, source, download;
  try {
    native = JSON.parse(snapshot);
    source = new URL(reference.sourceUrl);
    download = new URL(reference.downloadUrl);
  } catch {}
  const d = reference.creatorDedication,
    user = d?.username,
    upload = d?.originalUpload;
  if (
    [
      'chinese-wikipedia-archived-author-original',
      'commons-archived-own-camera-photograph',
      'commons-archived-confirmed-self-release',
    ].includes(d?.kind)
  ) {
    if (!inspectCreatorUploadedArchive(native, source, download, image, reference))
      blockers.push('supplemental-archived-author-original-unverified');
    return {
      path: reference.path,
      sourceUrl: reference.sourceUrl,
      eligible: !blockers.length,
      blockers,
    };
  }
  const title =
    source?.protocol === 'https:' &&
    source.hostname === 'commons.wikimedia.org' &&
    source.pathname.startsWith('/wiki/File:')
      ? decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ')
      : null;
  const page = Object.values(native?.query?.pages ?? {}).find(
      (p) => p.title?.replaceAll('_', ' ') === title,
    ),
    first = page?.imageinfo?.[0],
    revision = page?.revisions?.[0],
    body = revision?.slots?.main?.['*'] ?? '';
  const info = page?.imageinfo?.slice(1).find((i) => i.archivename === d?.archiveName),
    meta = first?.extmetadata,
    value = (k) => meta?.[k]?.value;
  let archive;
  try {
    archive = new URL(info?.url);
  } catch {}
  const validUser = /^[A-Za-z0-9_-]+$/.test(user ?? ''),
    who = escapePattern(user),
    originalName = title?.slice(5).replaceAll(' ', '_'),
    timestamp = upload?.timestamp;
  const row = new RegExp(
    `^\\* ${escapePattern(timestamp?.slice(0, 16))} \\[\\[:en:User:${who}\\|${who}\\]\\] ${upload?.width}×${upload?.height}× \\(${upload?.bytes} bytes\\)\\s*$`,
    'm',
  );
  const comment = `(BOT): Uploading old version of file from en.wikipedia; originally uploaded on ${timestamp} by [[en:User:${user}|${user}]]`;
  const name = d?.archiveName;
  if (
    reference.origin !== 'commons-author-public-domain' ||
    reference.license !== 'Public domain' ||
    d?.kind !== 'english-wikipedia-archived-author-original' ||
    !validUser ||
    reference.artist !== user ||
    !Number.isInteger(revision?.revid) ||
    revision.revid !== d?.revision ||
    !new RegExp(`\\{\\{PD-user-en\\|${who}\\}\\}`, 'i').test(body) ||
    !new RegExp(`\\|Author=\\[\\[:en:User:${who}\\|User:${who}\\]\\]`, 'i').test(body) ||
    !new RegExp(`\\{\\{user at project\\|${who}\\|wikipedia\\|en\\}\\}`, 'i').test(body) ||
    !body.includes(`{{original description|en.wikipedia|${originalName}}}`) ||
    !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(timestamp ?? '') ||
    !row.test(body) ||
    !info ||
    info.user !== 'OgreBot' ||
    info.comment !== comment ||
    info.archivename !== name ||
    !new RegExp(`^\\d{14}!${escapePattern(originalName)}$`).test(name ?? '') ||
    !Number.isFinite(Date.parse(info.timestamp)) ||
    !(Date.parse(info.timestamp) < Date.parse(first?.timestamp)) ||
    info.size !== upload?.bytes ||
    info.width !== upload?.width ||
    info.height !== upload?.height ||
    !image ||
    info.size !== image.length ||
    hash(image, 'sha1') !== info.sha1 ||
    info.sha1 === first?.sha1 ||
    archive?.protocol !== 'https:' ||
    archive?.hostname !== 'upload.wikimedia.org' ||
    !decodeURIComponent(archive?.pathname ?? '').endsWith(`/${name}`) ||
    !archive?.pathname.startsWith('/wikipedia/commons/archive/') ||
    download?.origin !== archive?.origin ||
    download?.pathname !== archive?.pathname ||
    value('LicenseShortName') !== 'Public domain' ||
    value('Copyrighted') !== 'False' ||
    value('AttributionRequired') !== 'false' ||
    value('Restrictions') ||
    !value('Artist')?.includes(`https://en.wikipedia.org/wiki/User:${user}`) ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-archived-author-original-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}
