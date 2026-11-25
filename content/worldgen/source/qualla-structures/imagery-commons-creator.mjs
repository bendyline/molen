import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

function localBytes(dir, file) {
  if (typeof file !== 'string' || isAbsolute(file) || file.split(/[\\/]/).includes('..'))
    throw Error('Invalid Commons evidence path');
  const resolved = realpathSync(resolve(dir, file));
  const inside = relative(realpathSync(dir), resolved);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw Error('Evidence leaves the source bundle');
  return readFileSync(resolved);
}

function titleFromCommons(url) {
  const address = new URL(url);
  if (address.origin !== 'https://commons.wikimedia.org' || !address.pathname.startsWith('/wiki/'))
    return null;
  return decodeURIComponent(address.pathname.slice(6)).replaceAll('_', ' ');
}

/** Verify the photographer's release on the first revision of their native original. */
export function inspectCommonsCreatorOriginal(dir, reference) {
  const result = { path: reference.path, sourceUrl: reference.sourceUrl };
  try {
    const rights = localBytes(dir, reference.rightsEvidence?.path);
    const record = JSON.parse(rights);
    const raw = record.native;
    const page = Object.values(raw.query.pages)[0];
    const first = page.revisions[0];
    const archived = reference.origin === 'commons-native-creator-public-domain';
    const info = archived ? page.imageinfo.at(-1) : page.imageinfo[0];
    const meta = info.extmetadata;
    const archive = new URL(record.source);
    const image = localBytes(dir, reference.path);
    const text = first.slots.main['*'] ?? first.slots.main.content;
    const field = (name) => {
      const row = text
        .split(/\r?\n/)
        .find((line) => line.toLowerCase().trimStart().startsWith(`|${name}=`));
      return row?.slice(row.indexOf('=') + 1).trim();
    };
    const nickname = reference.artist;
    const nativeUrl = new URL(info.url);
    const uploadedByCreator = archived
      ? info.user === nickname || info.user === `${nickname}~commonswiki`
      : info.user === nickname;
    const creditedArtist = meta.Artist?.value?.replace(/<[^>]+>/g, '').trim();
    const originalRelease = archived
      ? field('source') === 'Own work - Public Domain' &&
        field('author') === creditedArtist &&
        creditedArtist?.split(' (')[0] === nickname &&
        field('permission') === 'Own work, all rights released (Public domain)' &&
        /^\{\{PD-self\}\}[ \t]*$/im.test(text) &&
        meta.LicenseShortName?.value === 'Public domain' &&
        reference.license === 'Public domain'
      : field('source') === '{{own}}' &&
        field('author') === `[[User:${nickname}|${nickname}]]` &&
        creditedArtist === nickname &&
        (/\{\{\s*self\s*\|\s*cc-zero\s*\}\}/i.test(text) ||
          /^\{\{\s*cc-zero\s*\}\}[ \t]*$/im.test(text)) &&
        meta.LicenseShortName?.value === 'CC0' &&
        reference.license === 'CC0';
    const accepted =
      archive.origin === 'https://commons.wikimedia.org' &&
      archive.pathname === '/w/api.php' &&
      archive.searchParams.get('titles')?.replaceAll('_', ' ') === page.title &&
      titleFromCommons(reference.sourceUrl) === page.title &&
      titleFromCommons(info.descriptionurl) === page.title &&
      archive.searchParams.get('rvdir') === 'newer' &&
      first.parentid === 0 &&
      first.revid === reference.nativeRevision &&
      (archived ? page.imageinfo.length > 1 : page.imageinfo.length === 1) &&
      !raw.continue?.iicontinue &&
      !['iistart', 'iiend', 'iicontinue'].some((key) => archive.searchParams.has(key)) &&
      uploadedByCreator &&
      first.user === info.user &&
      Number.isFinite(Date.parse(first.timestamp)) &&
      Math.abs(Date.parse(info.timestamp) - Date.parse(first.timestamp)) <= 300000 &&
      originalRelease &&
      !/\{\{\s*(?:cc[- ]by|gfdl|copyright)/i.test(text) &&
      meta.AttributionRequired?.value === 'false' &&
      meta.Restrictions?.value === '' &&
      nativeUrl.origin === 'https://upload.wikimedia.org' &&
      nativeUrl.pathname.startsWith('/wikipedia/commons/') &&
      nativeUrl.pathname.startsWith('/wikipedia/commons/archive/') === archived &&
      !nativeUrl.pathname.includes('/thumb/') &&
      nativeUrl.origin + nativeUrl.pathname === reference.downloadUrl &&
      info.size === image.length &&
      info.sha1 === digest(image, 'sha1') &&
      reference.nativeSha1 === info.sha1 &&
      digest(image) === reference.sha256?.replace(/^sha256:/, '') &&
      digest(rights) === reference.rightsEvidence.sha256?.replace(/^sha256:/, '') &&
      reference.originalReview?.status === 'inspected' &&
      reference.originalReview?.rendition ===
        (archived ? 'archived-native-original' : 'native-original') &&
      reference.visuallyReviewedForThisPolicy === true;
    if (accepted) return { ...result, eligible: true, blockers: [] };
  } catch {
    // Missing or altered evidence leaves the image ineligible.
  }
  return { ...result, eligible: false, blockers: ['commons-creator-original-unverified'] };
}
