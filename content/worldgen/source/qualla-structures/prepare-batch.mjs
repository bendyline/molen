#!/usr/bin/env node
/** Resolve a frozen Qualla batch to local original images without changing media.
 * Metadata gallery paths take precedence over stale merged-article aliases. Source
 * families collapse resized copies. Selection and visual acceptance are separate;
 * accepted evidence is invalidated by changed image bytes, attribution or scope.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { next1000Entries, next1000Matches } from './work-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = (v) =>
  createHash('sha256')
    .update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v))
    .digest('hex');
const optional = (p, fallback) => (fs.existsSync(p) ? read(p) : fallback);
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const write = (p, v, check) => {
  const bytes = typeof v === 'string' ? v : `${JSON.stringify(v, null, 2)}\n`;
  if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === bytes) return 0;
  if (check) throw new Error(`Stale batch evidence: ${p}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(`${p}.${process.pid}.tmp`, bytes);
  fs.renameSync(`${p}.${process.pid}.tmp`, p);
  return 1;
};
const words = (text) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const stop = new Set(
  'the of in at and a an including current main building house hotel palace memorial museum tower castle'.split(
    ' ',
  ),
);

export function sourceFamily(image) {
  const value = image.sourceUrl || image.descriptionUrl || image.filename || image.path;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* Preserve malformed original metadata. */
  }
  return decoded
    .replace(
      /^https?:\/\/(?:commons\.wikimedia\.org\/wiki\/|en\.wikipedia\.org\/wiki\/)?File:/i,
      'commons:',
    )
    .replaceAll('_', ' ')
    .normalize('NFC')
    .toLowerCase();
}

export function rankReference(image, name) {
  const text = words(`${image.filename} ${image.caption}`);
  const subject = words(name.replace(/\([^)]*\)/g, '').split(',')[0]);
  const tokens = words(name)
    .split(' ')
    .filter((t) => t.length > 2 && !stop.has(t));
  let score = tokens.filter((t) => text.includes(t)).length * 6;
  if (text.includes(subject)) score += 12;
  if (image.sourceType === 'core') score += 5;
  if (tokens.length && !tokens.some((t) => text.includes(t))) score -= 16;
  if (/exterior|facade|front|aerial|overview|panorama|courtyard/.test(text)) score += 5;
  if (
    /interior|inside|exhibit|atrium|dining room|dressing room|writing den|chandelier|altar|portrait|bookcase|map |location map|floor plan|drawing|woodcut|engraving|painting|stamp |coin |logo|coat of arms|election|protest|demonstrat|singer|wedding|bus |aircraft|airport|airshow|fins on|dog at|tree infront|sculpture on|autograph|plaque|nameplate|sign in front|lighting sconce|view from the front steps/.test(
      text,
    )
  )
    score -= 24;
  if (/construction|scaffold|historic|historical|ruins of|destroyed|demolition/.test(text))
    score -= 8;
  if (image.width >= 1200 && image.height >= 700) score += 3;
  if (Math.min(image.width ?? 0, image.height ?? 0) < 400) score -= 8;
  const date = String(image.dateCreated ?? '').match(/\b(18\d\d|19\d\d|20\d\d)\b/);
  if (date && Number(date[1]) < 1970) score -= 7;
  return score;
}

export function collectReferences(qualla, structures, entry) {
  const byPath = new Map(),
    conflicts = [];
  const add = (media, p, origin, authoritative = false, reviews = []) => {
    if (!p?.startsWith('_m/') || p.includes('..') || !fs.existsSync(path.join(qualla, p))) return;
    if (!/\.(jpe?g|png|webp)$/i.test(p) || /-(small|medium)\.webp$/.test(p)) return;
    const ref = {
      path: p,
      filename: media.filename ?? path.basename(p),
      caption: media.description ?? media.caption ?? media.alt ?? '',
      sourceUrl: media.descriptionUrl ?? media.sourceUrl ?? null,
      downloadUrl: media.url ?? null,
      artist: media.artist ?? null,
      license: media.license ?? null,
      dateCreated: media.dateCreated ?? null,
      width: media.width ?? null,
      height: media.height ?? null,
      sourceType: media.sourceType ?? null,
      metadataOrigin: origin,
      reviewRecords: reviews,
    };
    ref.sourceFamily = sourceFamily(ref);
    const previous = byPath.get(p);
    if (previous && previous.sourceFamily !== ref.sourceFamily) {
      conflicts.push({
        path: p,
        firstSource: previous.sourceUrl,
        otherSource: ref.sourceUrl,
        resolution: authoritative ? 'media-metadata-preferred' : 'kept-media-metadata',
      });
    }
    if (!previous || authoritative) byPath.set(p, ref);
  };
  for (const structure of structures) {
    for (const story of structure.stories) {
      const article = read(path.join(qualla, story.sourcePath));
      for (const media of [article.media?.hero, ...(article.media?.images ?? [])].filter(Boolean))
        add(media, media.path, story.sourcePath);
      const folders = new Set([
        story.sourcePath.replace(/^_c\/art\//, '_m/').replace(/\.json$/, ''),
        ...(entry.referenceFolders ?? []).filter((p) => p.startsWith('_m/') && !p.includes('..')),
        ...[article.locationWikipediaPath, article.locationWikivoyagePath]
          .filter((p) => typeof p === 'string' && !p.includes('..'))
          .map((p) => `_m/${p}`),
      ]);
      for (const folder of folders) {
        const metadataPath = `${folder}/metadata.json`,
          meta = optional(path.join(qualla, metadataPath), {});
        const records = (p) =>
          (meta.mediaReviews?.[path.basename(p)]?.productionReviews ?? [])
            .map((r) => r.assessment?.record)
            .filter(Boolean);
        if (meta.hero)
          add(meta.hero, `${folder}/hero.jpg`, metadataPath, true, records(`${folder}/hero.jpg`));
        for (let i = 0; i < (meta.gallery ?? []).length; i++) {
          const p = meta.galleryPaths?.[i];
          if (p) add(meta.gallery[i], p, metadataPath, true, records(p));
        }
      }
    }
  }
  const families = new Map();
  for (const ref of byPath.values()) {
    const old = families.get(ref.sourceFamily);
    if (!old || (ref.width ?? 0) * (ref.height ?? 0) > (old.width ?? 0) * (old.height ?? 0))
      families.set(ref.sourceFamily, ref);
  }
  const candidates = [...families.values()]
    .map((r) => ({ ...r, selectionScore: rankReference(r, entry.name) }))
    .sort((a, b) => b.selectionScore - a.selectionScore || order(a.path, b.path));
  return { candidates, conflicts };
}

export function prepareBatch({
  qualla,
  batchPath = path.join(here, 'batches/qualla-001.json'),
  output = here,
  repository = root,
  check = false,
}) {
  const batch = read(batchPath);
  const reserved = next1000Entries(
    read(path.join(repository, 'content/worldgen/source/next-1000/candidates.json')),
    read(path.join(repository, 'content/worldgen/source/next-1000/collections.json')),
  );
  const all = fs
    .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const byId = new Map(all.flatMap((r) => [r.id, ...(r.aliasIds ?? [])].map((id) => [id, r])));
  const reviews = optional(path.join(output, 'batches/reference-reviews.json'), { reviews: {} });
  const results = [];
  let changed = 0;
  if (
    batch.entries.length !== batch.targetCount ||
    new Set(batch.entries.map((e) => e.structureId)).size !== batch.targetCount
  )
    throw new Error('Batch count/identity mismatch');
  // Validate the whole batch before writing any evidence, even when a list changed after scanning.
  for (const entry of batch.entries) {
    const structure = byId.get(entry.structureId);
    if (!structure)
      throw new Error(`Batch target disappeared; reconcile explicitly: ${entry.name}`);
    const external = next1000Matches(structure, reserved, entry.modelIdentity);
    if (
      external.length ||
      structure.workAssignment?.localAuthoringAllowed === false ||
      entry.workOwner === 'next-1000-other-device'
    )
      throw new Error(
        `Other-device work cannot enter the local batch: ${entry.name} (${external.map((m) => m.id).join(', ')}). Record a replacement; retain its coverage link.`,
      );
  }
  for (const entry of batch.entries) {
    const structure = byId.get(entry.structureId);
    const { candidates, conflicts } = collectReferences(qualla, [structure], entry);
    const selected =
      entry.referenceSelection === 'needs-replacement'
        ? []
        : entry.references.length
          ? entry.references.map((p) => candidates.find((c) => c.path === p))
          : candidates.slice(0, 2);
    if (selected.some((r) => !r)) throw new Error(`Selected reference disappeared: ${entry.name}`);
    if (
      selected.length > 2 ||
      new Set(selected.map((r) => r.sourceFamily)).size !== selected.length
    )
      throw new Error(`Select at most two distinct reference images: ${entry.name}`);
    const references = selected.map((r) => ({
      ...r,
      sha256: hash(fs.readFileSync(path.join(qualla, r.path))),
    }));
    const inputHash = hash({
      scope: entry.scope,
      era: entry.era,
      referenceNotes: entry.referenceNotes,
      stories: structure.stories.map((s) => ({ id: s.id, contentHash: s.contentHash })),
      references,
    });
    const review = reviews.reviews[entry.structureId];
    const record = {
      format: 'molen/qualla-model-references@1',
      batchId: batch.id,
      structureId: entry.structureId,
      name: entry.name,
      scope: entry.scope,
      era: entry.era,
      stories: structure.stories,
      existing: structure.existing,
      backlogState: structure.status,
      candidateCount: candidates.length,
      metadataConflicts: conflicts,
      references,
      inputHash,
      review:
        review?.inputHash === inputHash && (references.length > 0 || review.state !== 'accepted')
          ? review
          : {
              state: review ? 'stale' : 'pending',
              reason: review
                ? 'Scope, story or image evidence changed.'
                : 'Suggested references need visual inspection; scores are only a shortlist.',
            },
      candidates,
    };
    changed += write(path.join(output, 'references', `${entry.structureId}.json`), record, check);
    results.push({ entry, record });
  }
  const reviewed = results.filter((r) => r.record.review.state === 'accepted').length;
  const pilots = results.filter((r) => r.entry.pilot).length;
  const started = results.filter((r) => r.entry.sourcePath).length;
  const report =
    `# Qualla compat model batch 001\n\nFixed **${batch.targetCount} structures**, including **${pilots} pilot models**. **${reviewed} reference sets visually accepted**; ${batch.targetCount - reviewed} need reference work. **${started} models started**, ${batch.targetCount - started} not started. Geometry and placement completion are tracked separately.\n\nThe pilots establish the quality bar before scaling production. References are local Qualla originals, deduplicated by source family and bound to content hashes. No photos are copied into Molen runtime packs.\n\nA draft is not ready coverage. Before activation: refine photographic fidelity, reconcile each footprint and anchor, check terrain contact, inspect shared materials and runtime detail levels, then record readiness and sync Qualla. See [the workflow](../README.md#first-100-and-reference-evidence) and [pilot review](PILOT-REVIEW.md).\n\n| # | Structure / story | Model work | References | Scope |\n| ---: | --- | --- | --- | --- |\n` +
    results
      .map(
        ({ entry: e, record: r }) =>
          `| ${e.order}${e.pilot ? ' · pilot' : ''} | [${e.name.replaceAll('|', '/')}](${r.stories[0].url}) | ${e.sourcePath ? `[${e.modelState}](../../${e.sourcePath.replace(/^content\/worldgen\/source\//, '')}/README.md)` : e.modelState} | [${r.review.state}: ${r.references.length} / ${r.candidateCount} candidates](../references/${e.structureId}.json) | ${e.scope.replaceAll('|', '/')} |`,
      )
      .join('\n') +
    '\n\n## Reserved for the other device\n\nAll next-1,000 candidates and collection members are excluded from local production. Preparation rechecks current list identities and rejects overlaps before writing evidence.\n\n' +
    (batch.deferredEntries ?? [])
      .map(
        (e) =>
          `- ${e.name} (${e.modelIdentity}): ${e.deferredReason} Retained references: [${e.structureId}](../references/${e.structureId}.json).`,
      )
      .join('\n') +
    '\n';
  changed += write(path.join(output, 'batches/QUALLA-001.md'), report, check);
  return {
    targets: results.length,
    referenceSetsAccepted: reviewed,
    selectedImages: results.reduce((s, r) => s + r.record.references.length, 0),
    filesChanged: changed,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    qi = args.indexOf('--qualla');
  console.log(
    JSON.stringify(
      prepareBatch({
        qualla: qi < 0 ? path.resolve(root, '../qualla-internal') : path.resolve(args[qi + 1]),
        check: args.includes('--check'),
      }),
      null,
      2,
    ),
  );
}
