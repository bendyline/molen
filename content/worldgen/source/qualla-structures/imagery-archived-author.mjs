/** Bind an unchanged English Wikipedia author's archived original, never a later derivative. */
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
