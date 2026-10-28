/** Exact NZ Embassy original: specific DOS grant plus the same agency's primary photo release. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
const plain = (v) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();
function bytes(root, name) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const p = path.resolve(root, name);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(p));
  return path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)
    ? null
    : fs.readFileSync(p);
}
const parse = (b) => {
  try {
    return JSON.parse(b);
  } catch {
    return null;
  }
};
export function inspectNewZealandEmbassyReference(dir, r) {
  const image = bytes(dir, r.path),
    nativeBytes = bytes(dir, r.catalogEvidence?.path),
    primary = bytes(dir, r.rightsEvidence?.path),
    record = parse(nativeBytes),
    id = r.flickrId,
    account = 'us_embassy_newzealand',
    nsid = '46907600@N02',
    photoUrl = `https://www.flickr.com/photos/${account}/${id}`,
    owner = `https://www.flickr.com/photos/${account}`,
    blockers = [];
  let source, api, download, title;
  try {
    source = new URL(r.sourceUrl);
    api = new URL(record?.source);
    download = new URL(r.downloadUrl);
    title = decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ');
  } catch {}
  const pg = Object.values(record?.query?.pages ?? {}).find((p) => p.title === title),
    i = pg?.imageinfo?.[0],
    body = pg?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    meta = (k) => i?.extmetadata?.[k]?.value;
  const objects = [
      ...(primary?.toString('utf8') ?? '').matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ].flatMap((m) => {
      const j = parse(m[1]);
      return j?.['@graph'] ?? (j ? [j] : []);
    }),
    photo = objects.find((o) => o['@type'] === 'ImageObject');
  const creatorBound = [photo?.author, photo?.creator].every((o) => {
    try {
      const u = new URL(o?.image);
      return (
        o.name === 'US Embassy' &&
        o.url === owner &&
        u.protocol === 'https:' &&
        /^(?:farm\d+|live)\.staticflickr\.com$/.test(u.hostname) &&
        u.pathname.endsWith(`/buddyicons/${nsid}.jpg`) &&
        u.hash === `#${nsid}`
      );
    } catch {
      return false;
    }
  });
  let sameOriginal = false;
  try {
    const u = new URL(i?.url);
    sameOriginal =
      u.origin === 'https://upload.wikimedia.org' &&
      !u.pathname.includes('/thumb/') &&
      download?.origin === u.origin &&
      download?.pathname === u.pathname;
  } catch {}
  if (!image || hash(image) !== String(r.sha256 ?? '').replace(/^sha256:/, ''))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !nativeBytes ||
    hash(nativeBytes) !== String(r.catalogEvidence?.sha256 ?? '').replace(/^sha256:/, '') ||
    !primary ||
    hash(primary) !== String(r.rightsEvidence?.sha256 ?? '').replace(/^sha256:/, '')
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    r.origin !== 'commons-new-zealand-embassy-government-photo' ||
    r.artist !== 'US Embassy from New Zealand' ||
    r.license !== 'Public domain' ||
    !/^\d{11}$/.test(id ?? '') ||
    source?.origin !== 'https://commons.wikimedia.org' ||
    !source?.pathname.startsWith('/wiki/File:') ||
    !title?.endsWith(`(${id}).jpg`) ||
    api?.origin !== 'https://commons.wikimedia.org' ||
    api?.pathname !== '/w/api.php' ||
    api?.searchParams.get('action') !== 'query' ||
    !['imageinfo', 'revisions'].every((v) =>
      api?.searchParams.get('prop')?.split('|').includes(v),
    ) ||
    !api?.searchParams.get('titles')?.split('|').includes(title) ||
    !pg?.revisions?.[0]?.revid ||
    !body.includes('{{PD-USGov-DOS}}') ||
    !/\{\{Flickrreview\|[^|{}]+\|\d{4}-\d{2}-\d{2}\}\}/.test(body) ||
    !body.includes(`[https://www.flickr.com/photos/${account}/${id}/ `) ||
    !body.includes(`[https://www.flickr.com/people/${nsid} US Embassy] from New Zealand`) ||
    plain(meta('Artist')) !== r.artist ||
    meta('LicenseShortName') !== 'Public domain' ||
    meta('AttributionRequired') !== 'false' ||
    plain(meta('Restrictions')) ||
    !sameOriginal ||
    i?.width !== r.width ||
    i?.height !== r.height ||
    i?.size !== image?.length ||
    (image && hash(image, 'sha1') !== i?.sha1) ||
    r.rightsEvidence?.sourceUrl !== `${photoUrl}/` ||
    photo?.acquireLicensePage !== photoUrl ||
    photo?.license !== 'https://creativecommons.org/publicdomain/mark/1.0/' ||
    !photo?.contentUrl?.startsWith(`https://live.staticflickr.com/65535/${id}_`) ||
    !creatorBound ||
    r.originalReview?.status !== 'inspected' ||
    r.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-new-zealand-embassy-specific-DOS-release-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: !blockers.length };
}
