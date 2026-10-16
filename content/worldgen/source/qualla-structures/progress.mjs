#!/usr/bin/env node
/** Verify the fixed local batch before counting completions or exporting ready story coverage. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesEvidenceText } from '../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { modelInputHash } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { hasUsableStructurePlacement } from '../../../../packages/worldgen-earth/scripts/historical-placement.mjs';
import { reviewedMediumFi } from '../../../../packages/worldgen-earth/scripts/medium-fi-readiness.mjs';
import { reviewedSourceMapFrame } from '../../../../packages/worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { next1000Entries, next1000Matches } from './work-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const bytes = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : undefined);
const read = (p) => {
  const b = bytes(p);
  return b ? JSON.parse(b) : undefined;
};
const inside = (dir, relative) =>
  typeof relative === 'string' &&
  !path.isAbsolute(relative) &&
  !relative.split(/[\\/]/).includes('..')
    ? path.join(dir, relative)
    : null;

export function inspectedCaptureMatches(dir, reportBytes, review, inputHash) {
  if (
    !reportBytes ||
    review?.status !== 'passed' ||
    !matchesEvidenceText(reportBytes, review.captureReportHash) ||
    !review.inspectedFrames?.length
  )
    return false;
  const report = JSON.parse(reportBytes);
  if (report.inputHash !== inputHash || report.errors?.length) return false;
  return review.inspectedFrames.every((p) => {
    const file = inside(dir, p),
      frame = report.frames?.find((f) => f.path === p),
      b = file && bytes(file);
    return !!b && hash(b) === frame?.hash;
  });
}

export async function inspectLocalModel(
  entry,
  { repository = root, project, stylepack, placements, currentReferences } = {},
) {
  const row = {
    candidateId: entry.modelIdentity,
    backlogTargetId: entry.structureId,
    title: entry.name,
    asset: null,
    sourcePath: entry.sourcePath ?? null,
    order: entry.order,
    pilot: !!entry.pilot,
    readiness: 'not-started',
    blockers: [],
    geographic: { activePlacement: null },
    fidelityQa: { target: 'medium-fi', hashBoundReviewPassed: false },
  };
  if (!entry.sourcePath) {
    row.blockers = ['source-model-missing'];
    return row;
  }
  const dir = path.resolve(repository, entry.sourcePath),
    spec = read(path.join(dir, 'spec.json')),
    manifest = read(path.join(dir, 'source.json')),
    qa = read(path.join(dir, 'qa.json'));
  if (!spec || !manifest) {
    row.blockers = ['source-model-missing'];
    return row;
  }
  row.asset = spec.assetId;
  const sourceEntry = manifest.files.models.find(
    (m) => m.assetId === spec.assetId && m.path === 'models/source.glb',
  );
  const source = bytes(path.join(dir, 'models/source.glb'));
  if (!source || hash(source) !== sourceEntry?.sha256 || hash(source) !== spec.mesh?.sha256)
    row.blockers.push('source-missing-or-hash-mismatch');
  const sidecarRelative = project.assets?.[spec.assetId],
    sidecarPath =
      sidecarRelative && inside(path.join(repository, 'content/worldgen'), sidecarRelative),
    sidecar = sidecarPath && read(sidecarPath);
  const runtimePath = sidecar?.files.main && inside(path.dirname(sidecarPath), sidecar.files.main),
    runtime = runtimePath && bytes(runtimePath);
  if (!runtime || hash(runtime) !== sidecar.hash || sidecar.sourceHash !== sourceEntry?.sha256)
    row.blockers.push('runtime-missing-or-hash-mismatch');
  if (stylepack.assets?.[spec.assetId] !== sidecarRelative || !sidecarRelative)
    row.blockers.push('asset-registry-missing');
  const inputHash = await modelInputHash(dir, spec.assetId);
  row.inputHash = inputHash;
  const matches =
    qa?.inputHash === inputHash &&
    qa?.sourceHash === sourceEntry?.sha256 &&
    qa?.runtimeHash === sidecar?.hash;
  if (!matches) row.blockers.push('review-inputs-stale-or-missing');
  const refs = read(path.join(dir, 'reference-images.json'));
  if (
    refs?.review?.state !== 'accepted' ||
    !refs.references?.length ||
    refs.inputHash !== currentReferences?.inputHash ||
    currentReferences?.review?.state !== 'accepted'
  )
    row.blockers.push('reference-review-stale-or-missing');
  const capture = bytes(path.join(dir, 'capture-report.json')),
    shared = bytes(path.join(dir, 'shared-capture-report.json'));
  if (
    !matches ||
    !inspectedCaptureMatches(
      dir,
      capture,
      { ...qa?.visualReview, captureReportHash: qa?.captureReportHash },
      inputHash,
    )
  )
    row.blockers.push('visual-review-missing-or-unbound');
  let sharedPass =
    matches && inspectedCaptureMatches(dir, shared, qa?.sharedSurfaceReview, inputHash);
  const sharedDoc = shared ? JSON.parse(shared) : null;
  for (const graph of Object.values(sharedDoc?.materialGraphs ?? {})) {
    const p = inside(path.join(repository, 'content/worldgen'), graph.path),
      b = p && bytes(p);
    if (!b || !matchesEvidenceText(b, graph.hash)) sharedPass = false;
  }
  if (!sharedPass) row.blockers.push('shared-surface-review-missing-or-unbound');
  let lodPass = true;
  for (const [name, limit] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const level = sidecar?.runtimeLods?.levels?.find((l) => l.name === name),
      p = level && inside(path.dirname(sidecarPath), level.file),
      b = p && bytes(p);
    if (!b || hash(b) !== level.hash || level.triangles > limit || level.drawCalls > 8)
      lodPass = false;
  }
  if (!lodPass) row.blockers.push('runtime-lods-missing-stale-or-over-budget');
  const medium =
    sidecar &&
    (await reviewedMediumFi({
      qa,
      reportBytes: bytes(path.join(dir, 'medium-fi-report.json')),
      sidecar,
      readImage: (p) => {
        const file = inside(dir, p);
        return file ? bytes(file) : undefined;
      },
    }));
  const fidelity =
    matches &&
    medium &&
    qa?.fidelityReview?.target === 'medium-fi' &&
    qa?.fidelityReview?.status === 'passed' &&
    qa.fidelityReview.notes?.trim().length > 0;
  row.fidelityQa.hashBoundReviewPassed = !!fidelity;
  if (!fidelity) row.blockers.push('medium-fi-fidelity-review-missing-or-unbound');
  const placement = placements.entries.find((e) => e.asset === spec.assetId),
    placementHash = placement && hash(JSON.stringify(placement));
  const active = hasUsableStructurePlacement(placement);
  if (!active) row.blockers.push('runtime-placement-inactive');
  const geographicReviewed =
    matches &&
    qa?.geographicReview?.status === 'passed' &&
    qa.geographicReview.placementHash === placementHash &&
    sharedDoc?.placementHash === placementHash &&
    sharedPass &&
    qa.sharedSurfaceReview.inspectedFrames.includes('shots/shared/placement.png');
  const frame = reviewedSourceMapFrame({
    frameBytes: bytes(path.join(dir, 'map-frame.json')),
    sourceManifest: manifest,
    spec,
    placement,
    geographicReviewed,
  });
  if (!frame) row.blockers.push('geographic-review-missing-or-unbound');
  const terrain = qa?.geographicReview?.terrain;
  const terrainPaths = [
    ['terrain-grid.json', terrain?.hash],
    ['terrain-review.terrain.json', terrain?.descriptorHash],
    ['terrain-review.height.png', terrain?.heightfieldHash],
  ];
  if (
    !terrainPaths.every(([p, h]) => {
      const b = bytes(path.join(dir, p));
      return b && (p.endsWith('.png') ? hash(b) === h : matchesEvidenceText(b, h));
    })
  )
    row.blockers.push('terrain-review-missing-or-unbound');
  row.readiness = row.blockers.length ? 'needs-review' : 'ready';
  row.geographic = {
    activePlacement: active ? placement.id : null,
    placementHash: placementHash ?? null,
    verified: !!frame,
  };
  return row;
}

export async function buildProgress({ repository = root, output = here, check = false } = {}) {
  const batch = read(path.join(output, 'batches/qualla-001.json'));
  const structures = fs
    .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const reserved = next1000Entries(
    read(path.join(repository, 'content/worldgen/source/next-1000/candidates.json')),
    read(path.join(repository, 'content/worldgen/source/next-1000/collections.json')),
  );
  const project = read(path.join(repository, 'content/worldgen/project.json')),
    stylepack = read(path.join(repository, 'content/worldgen/stylepack.json')),
    placements = read(path.join(repository, 'content/earth/structures/placements.json'));
  const rows = [];
  for (const entry of batch.entries) {
    const structure = structures.find((s) => s.id === entry.structureId);
    if (
      !structure ||
      next1000Matches(structure, reserved, entry.modelIdentity).length ||
      entry.workOwner === 'next-1000-other-device'
    )
      throw Error(`Local ownership unavailable: ${entry.name}`);
    rows.push(
      await inspectLocalModel(entry, {
        repository,
        project,
        stylepack,
        placements,
        currentReferences: read(path.join(output, `references/${entry.structureId}.json`)),
      }),
    );
  }
  const counts = {
    target: batch.targetCount,
    ready: rows.filter((r) => r.readiness === 'ready').length,
    started: rows.filter((r) => r.sourcePath).length,
    pilotsReady: rows.filter((r) => r.pilot && r.readiness === 'ready').length,
  };
  const document = {
    format: 'molen/structure-readiness@1',
    title: 'Qualla compat — local 100 — verified completion ledger',
    policy:
      'A source or import is not completion. Ready requires current image references, exact source/runtime/LOD bytes, inspected portable/shared/context captures, photographic fidelity and terrain/placement evidence. Next-1,000 work is excluded.',
    counts,
    candidates: rows,
  };
  const text = `# Qualla compat — local 100 — completion progress\n\n**${counts.ready} / ${counts.target} completed. ${counts.pilotsReady} / 5 pilots completed.** ${counts.started} models started; ${counts.target - counts.started} not started.\n\nGoal: finish the five pilots, then all remaining local models, using Qualla photographs and synchronizing story annotations after each verified completion. Every next-1,000 candidate and collection member remains assigned to the other device.\n\nCompletion is recomputed from current evidence; editing geometry, source references, material graphs, terrain or placement invalidates the affected approval. [Machine-readable ledger](readiness.json).\n\n| # | Structure and story | Completion | Remaining checks |\n| ---: | --- | --- | --- |\n${rows
    .map((r) => {
      const s = structures.find((s) => s.id === r.backlogTargetId);
      return `| ${r.order}${r.pilot ? ' · pilot' : ''} | [${r.title.replaceAll('|', '/')}](https://qualla.com/${s.stories[0].url.split('qualla.com/')[1]}) | ${r.readiness === 'ready' ? 'Complete' : r.readiness === 'not-started' ? 'Not started' : 'In review'} | ${r.blockers.join('; ') || 'All required evidence current'} |`;
    })
    .join(
      '\n',
    )}\n\nRefresh with \`node content/worldgen/source/qualla-structures/progress.mjs\`, then run \`sync-qualla.mjs --write\` to reconcile story annotations.\n`;
  for (const [p, value] of [
    ['batches/readiness.json', `${JSON.stringify(document, null, 2)}\n`],
    ['batches/PROGRESS.md', text],
  ]) {
    const file = path.join(output, p);
    if (bytes(file)?.toString() === value) continue;
    if (check) throw Error(`Stale progress: ${p}`);
    fs.writeFileSync(file, value);
  }
  return counts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(
    JSON.stringify(await buildProgress({ check: process.argv.includes('--check') }), null, 2),
  );
