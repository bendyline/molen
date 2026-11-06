/** A photographer's direct Flickr original, bound to the primary page's exact CC0 record. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plain = (hash) => hash?.replace(/^sha256:/, '');
function bytes(dir, relative) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  )
    throw Error('Invalid original reference path');
  const file = path.join(dir, relative);
  if (!fs.realpathSync(file).startsWith(fs.realpathSync(dir) + path.sep))
    throw Error('Original reference path escapes bundle');
  return fs.readFileSync(file);
}

/** Parse data only; never evaluate the primary page's JavaScript. */
export function flickrPrimaryModels(html) {
  const marker = html.indexOf('modelExport: {');
  if (marker < 0) throw Error('Primary photo data missing');
  const start = html.indexOf('{', marker);
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1)).main;
  }
  throw Error('Primary photo data incomplete');
}

export function inspectFlickrOriginalReference(dir, reference) {
  const blockers = [];
  try {
    const image = bytes(dir, reference.path),
      primary = bytes(dir, reference.rightsEvidence?.path);
    if (digest(image) !== plain(reference.sha256)) throw Error('Original image bytes changed');
    if (digest(primary) !== plain(reference.rightsEvidence?.sha256))
      throw Error('Primary record changed');
    const html = primary.toString('utf8'),
      models = flickrPrimaryModels(html);
    const match = /^https:\/\/www\.flickr\.com\/photos\/(\d+@N\d+)\/(\d+)\/$/.exec(
      reference.sourceUrl ?? '',
    );
    if (!match) throw Error('Original source identity missing');
    const [, nsid, id] = match,
      ownerUrl = `https://www.flickr.com/photos/${nsid}`;
    const records = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    ].flatMap((m) => {
      const j = JSON.parse(m[1]);
      return j['@graph'] ?? [j];
    });
    const photo = records.find((r) => r['@type'] === 'ImageObject');
    const data = models?.['photo-models']?.find((m) => m.data?.id === id)?.data;
    const owner = data?.owner?.data,
      original = data?.sizes?.data?.o?.data;
    const originalUrl = original?.url?.startsWith('//') ? `https:${original.url}` : original?.url;
    const creatorBound = [photo?.author, photo?.creator].every((person) => {
      const icon = new URL(person?.image);
      return (
        person['@type'] === 'Person' &&
        person.url === ownerUrl &&
        person.name === reference.artist &&
        icon.protocol === 'https:' &&
        /^(?:farm\d+|live)\.staticflickr\.com$/.test(icon.hostname) &&
        icon.pathname.endsWith(`/buddyicons/${nsid}.jpg`) &&
        icon.hash === `#${nsid}`
      );
    });
    if (
      reference.origin !== 'flickr-photographer-cc0-original' ||
      reference.license !== 'CC0' ||
      !reference.artist?.trim() ||
      !reference.title?.trim() ||
      !Number.isInteger(reference.width) ||
      reference.width <= 0 ||
      !Number.isInteger(reference.height) ||
      reference.height <= 0 ||
      reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
      photo?.license !== 'https://creativecommons.org/publicdomain/zero/1.0/' ||
      data?.license !== 9 ||
      photo?.acquireLicensePage?.replace(/\/$/, '') !== reference.sourceUrl.replace(/\/$/, '') ||
      !creatorBound ||
      owner?.id !== nsid ||
      owner.realname !== reference.artist ||
      data.title !== reference.title ||
      reference.downloadUrl !== originalUrl ||
      !new RegExp(`^https://live\\.staticflickr\\.com/\\d+/${id}_[a-f0-9]+_o\\.jpg$`).test(
        originalUrl ?? '',
      ) ||
      original.width !== reference.width ||
      original.height !== reference.height ||
      original.width !== data.oWidth ||
      original.height !== data.oHeight ||
      reference.originalReview?.status !== 'inspected' ||
      reference.visuallyReviewedForThisPolicy !== true
    )
      throw Error('Primary photographer/original/CC0 identity differs');
  } catch (error) {
    blockers.push(error.message);
  }
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}
