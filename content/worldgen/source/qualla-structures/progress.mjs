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
import { readPlacementSources } from '../../../../packages/worldgen-earth/scripts/placement-sources.mjs';
import {
  nativePointSourcePath,
  reviewedSourceMapFrame,
} from '../../../../packages/worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { inspectImageryInventory } from './imagery-inventory.mjs';
import {
  inspectImageryPolicy,
  PUBLIC_DOMAIN_POLICY,
  publicDomainReviewMatches,
  verifiedSupplementalSelection,
} from './imagery-policy.mjs';
import { inspectPrimaryFactsReconstruction } from './primary-facts-reconstruction.mjs';
import { structureCatalogEntries, structureCatalogMatches } from './work-ownership.mjs';

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
  {
    repository = root,
    project,
    stylepack,
    placements,
    currentReferences,
    imageryPolicy,
    qualla = path.resolve(repository, '../qualla-internal'),
  } = {},
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
  const imageryEvidence = read(path.join(dir, 'imagery-evidence.json'));
  const factual =
    refs?.method === 'primary-facts-only'
      ? inspectPrimaryFactsReconstruction({
          dir,
          entry,
          references: refs,
          currentReferences,
          qualla,
          structures: fs
            .readFileSync(
              path.join(repository, 'content/worldgen/source/qualla-structures/structures.jsonl'),
              'utf8',
            )
            .trim()
            .split('\n')
            .map(JSON.parse)
            .filter((s) => s.id === entry.structureId),
        })
      : undefined;
  const inventory =
    imageryPolicy?.id === PUBLIC_DOMAIN_POLICY && !factual
      ? inspectImageryInventory({
          dir,
          qualla,
          evidence: imageryEvidence,
          selectedReferences: refs?.references,
          stories: refs?.stories,
          conflicts: refs?.metadataConflicts,
          frame: read(path.join(dir, 'map-frame.json')),
        })
      : undefined;
  const supplementalSelection =
    verifiedSupplementalSelection(refs, inventory, imageryEvidence) &&
    JSON.stringify(refs.externalReferences) ===
      JSON.stringify(currentReferences?.externalReferences);
  if (
    refs?.review?.state !== 'accepted' ||
    (!refs.references?.length && !supplementalSelection && factual?.status !== 'passed') ||
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
  const frameBytes = bytes(path.join(dir, 'map-frame.json')),
    nativePointFile = nativePointSourcePath(frameBytes);
  const frame = reviewedSourceMapFrame({
    frameBytes,
    nativeNodeBytes: nativePointFile ? bytes(path.join(dir, nativePointFile)) : undefined,
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
  row.technicalReadiness = row.blockers.length ? 'needs-review' : 'ready';
  if (imageryPolicy?.id === PUBLIC_DOMAIN_POLICY) {
    const mediumDocument = read(path.join(dir, 'medium-fi-report.json'));
    row.currentRenderIdentityVerified = !!medium && mediumDocument?.captureVersion === 2;
    if (!row.currentRenderIdentityVerified)
      row.blockers.push('current-asset-render-identity-unverified');
    if (factual) {
      row.imagery = {
        status: 'not-used',
        selection: 'primary-facts-only',
        fidelityReviewPassed: false,
      };
      row.primaryFactsReconstruction = factual;
      if (
        factual.status !== 'passed' ||
        qa?.primaryFactsReview?.status !== 'passed' ||
        qa.primaryFactsReview.inputHash !== inputHash ||
        qa.primaryFactsReview.evidenceHash !== factual.evidenceHash ||
        qa?.imageryReview?.status !== 'not-used' ||
        qa.imageryReview.imageryUsed !== false
      )
        row.blockers.push('primary-facts-reconstruction-missing-or-unbound');
    } else {
      row.imagery = inspectImageryPolicy({
        qualla,
        references: refs?.references,
        stories: refs?.stories,
        conflicts: refs?.metadataConflicts,
      });
      if (supplementalSelection)
        row.imagery = {
          ...row.imagery,
          status: 'passed',
          selection: 'verified-public-domain-originals-after-qualla-first-search',
        };
      if (row.imagery.status !== 'passed')
        row.blockers.push('public-domain-qualla-imagery-unverified');
      row.imagery.inventory = inventory;
      if (row.imagery.inventory.status !== 'passed')
        row.blockers.push('public-domain-imagery-inventory-unverified');
      const inventoryBytes = bytes(path.join(dir, 'imagery-evidence.json'));
      row.imagery.fidelityReviewPassed =
        row.imagery.inventory.status === 'passed' &&
        !!inventoryBytes &&
        matchesEvidenceText(inventoryBytes, qa?.imageryReview?.imageryEvidenceHash) &&
        publicDomainReviewMatches(qa?.imageryReview, refs, inputHash);
      if (!row.imagery.fidelityReviewPassed)
        row.blockers.push('public-domain-fidelity-review-missing-or-unbound');
    }
  }
  row.readiness = row.blockers.length ? 'needs-review' : 'ready';
  row.geographic = {
    activePlacement: active ? placement.id : null,
    placementHash: placementHash ?? null,
    verified: !!frame,
  };
  return row;
}

export async function buildProgress({
  repository = root,
  output = here,
  check = false,
  batchName = 'qualla-001',
} = {}) {
  if (!/^qualla-\d{3}$/.test(batchName)) throw Error('Invalid batch name');
  const batch = read(path.join(output, `batches/${batchName}.json`));
  const ledger = batchName === 'qualla-001' ? 'readiness.json' : `${batchName}.readiness.json`;
  const structures = fs
    .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const reserved = structureCatalogEntries(
    read(path.join(repository, 'content/worldgen/source/structure-catalog/candidates.json')),
    read(path.join(repository, 'content/worldgen/source/structure-catalog/collections.json')),
  );
  const project = read(path.join(repository, 'content/worldgen/project.json')),
    stylepack = read(path.join(repository, 'content/worldgen/stylepack.json')),
    placements = (
      await readPlacementSources(path.join(repository, 'content/earth/source/placements'))
    ).catalog;
  const rows = [];
  for (const entry of batch.entries) {
    const structure = structures.find((s) => s.id === entry.structureId);
    if (!structure) throw Error(`Structure identity unavailable: ${entry.name}`);
    const otherDevice = structureCatalogMatches(structure, reserved, entry.modelIdentity);
    if (otherDevice.length || entry.workOwner === 'structure-catalog-other-device') {
      // A newly resolved alias must remain visible without inspecting or approving
      // the other device's asset, or preventing unrelated local progress updates.
      rows.push({
        candidateId: entry.modelIdentity,
        backlogTargetId: entry.structureId,
        title: entry.name,
        asset: null,
        sourcePath: null,
        order: entry.order,
        pilot: !!entry.pilot,
        readiness: 'reserved-other-device',
        blockers: ['structure-catalog-other-device'],
        reservedCandidateIds: [...new Set(otherDevice.map((m) => m.id))].sort(),
        geographic: { activePlacement: null },
        fidelityQa: { target: 'medium-fi', hashBoundReviewPassed: false },
      });
      continue;
    }
    rows.push(
      await inspectLocalModel(entry, {
        repository,
        project,
        stylepack,
        placements,
        currentReferences: read(path.join(output, `references/${entry.structureId}.json`)),
        imageryPolicy: batch.policy?.imagery,
      }),
    );
  }
  const counts = {
    target: batch.targetCount,
    ready: rows.filter((r) => r.readiness === 'ready').length,
    started: rows.filter((r) => r.sourcePath).length,
    pilotsReady: rows.filter((r) => r.pilot && r.readiness === 'ready').length,
    ...(rows.some((r) => r.readiness === 'reserved-other-device')
      ? {
          reservedForOtherDevice: rows.filter((r) => r.readiness === 'reserved-other-device')
            .length,
        }
      : {}),
    ...(batch.policy?.imagery?.id === PUBLIC_DOMAIN_POLICY
      ? {
          technicallyValidated: rows.filter((r) => r.technicalReadiness === 'ready').length,
          publicDomainImageryVerified: rows.filter((r) => r.imagery?.status === 'passed').length,
          publicDomainFidelityReviewed: rows.filter((r) => r.imagery?.fidelityReviewPassed).length,
          primaryFactsReconstructionsVerified: rows.filter(
            (r) => r.readiness === 'ready' && r.primaryFactsReconstruction?.status === 'passed',
          ).length,
        }
      : {}),
  };
  const document = {
    format: 'molen/structure-readiness@1',
    title: `${batch.title ?? 'Qualla compat'} — verified completion ledger`,
    policy:
      'A source or import is not completion. Ready requires verified references or a separately supported primary-factual reconstruction, exact source/runtime/LOD bytes, inspected portable/shared/context captures, fidelity appropriate to the declared method, and terrain/placement evidence. Structure catalog work is excluded.' +
      (batch.policy?.imagery?.id === PUBLIC_DOMAIN_POLICY
        ? ' Imagery must be public domain, match published Qualla media and original attribution, and have current bytes. Conflicting or incomplete records are excluded.'
        : ''),
    counts,
    candidates: rows,
  };
  const text = `# Qualla compat — local 100 — completion progress\n\n**${counts.ready} / ${counts.target} completed. ${rows.some((r) => r.pilot) ? `${counts.pilotsReady} / ${rows.filter((r) => r.pilot).length} pilots completed.` : ''}** ${counts.started} models started; ${counts.target - counts.started} not started.${counts.technicallyValidated === undefined ? '' : `\n\n${counts.technicallyValidated} models retain their technical validation; ${counts.publicDomainImageryVerified} reference sets currently meet the public-domain Qualla imagery policy. Source replacements need renewed visual review before completion.`}\n\nFinish each model using Qualla photographs, current renders and story synchronization in the same authoring pass. Every structure catalog candidate and collection member remains assigned to the other device.\n\nCompletion is recomputed from current evidence; editing geometry, source references, material graphs, terrain or placement invalidates the affected approval. [Machine-readable ledger](readiness.json).\n\n| # | Structure and story | Completion | Remaining checks |\n| ---: | --- | --- | --- |\n${rows
    .map((r) => {
      const s = structures.find((s) => s.id === r.backlogTargetId);
      return `| ${r.order}${r.pilot ? ' · pilot' : ''} | [${r.title.replaceAll('|', '/')}](https://qualla.com/${s.stories[0].url.split('qualla.com/')[1]}) | ${r.readiness === 'ready' ? 'Complete' : r.readiness === 'not-started' ? 'Not started' : r.readiness === 'reserved-other-device' ? 'Other device' : 'In review'} | ${r.blockers.join('; ') || 'All required evidence current'} |`;
    })
    .join(
      '\n',
    )}\n\nRefresh with \`node content/worldgen/source/qualla-structures/progress.mjs\`, then run \`sync-completed.mjs --ids=<reviewed-model> --write\` for bounded completed-story updates.\n`;
  for (const [p, value] of [
    [`batches/${ledger}`, `${JSON.stringify(document, null, 2)}\n`],
    [
      `batches/${batchName === 'qualla-001' ? 'PROGRESS' : `${batchName}.PROGRESS`}.md`,
      text
        .replaceAll('local 100', `local ${batch.targetCount}`)
        .replaceAll('completed. **', 'completed.**')
        .replaceAll('(readiness.json)', `(${ledger})`),
    ],
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
    JSON.stringify(
      await buildProgress({
        check: process.argv.includes('--check'),
        batchName: process.argv.find((a) => a.startsWith('--batch='))?.slice(8) ?? 'qualla-001',
      }),
      null,
      2,
    ),
  );
