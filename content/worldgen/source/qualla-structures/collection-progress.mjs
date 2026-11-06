/** Complete a site through its independently approved assets, without an aggregate GLB. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateStructureCollections } from '../../../../packages/worldgen/scripts/structure-collections.mjs';
import { readCurrentReferences } from './member-references.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const read = (file) => JSON.parse(fs.readFileSync(file));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function within(root, relative) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  )
    throw Error('Collection evidence path must remain inside its source root');
  const file = path.resolve(root, relative);
  if (!fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep))
    throw Error('Collection evidence escapes its source root');
  return file;
}

export async function inspectLocalCollection(entry, options, inspectMember) {
  const { repository } = options;
  const row = {
    candidateId: entry.modelIdentity,
    backlogTargetId: entry.structureId,
    title: entry.name,
    sourcePath: entry.collectionSourcePath,
    order: entry.order,
    pilot: !!entry.pilot,
    asset: null,
    assets: [],
    readiness: 'needs-review',
    blockers: [],
    geographic: { activePlacement: null, activePlacements: [], verified: false },
    fidelityQa: { target: 'medium-fi', hashBoundReviewPassed: false },
    collection: { identityKind: 'site-members', members: [] },
  };
  try {
    const dir = within(repository, entry.collectionSourcePath);
    if (entry.collectionManifest !== `${entry.collectionSourcePath}/collection.json`)
      throw Error('Collection manifest identity differs');
    const doc = read(path.join(dir, 'collection.json'));
    validateStructureCollections(doc);
    const collection = doc.collections.find((c) => c.id === entry.modelIdentity);
    const members = entry.requiredMembers ?? [];
    if (
      !collection ||
      collection.identityKind !== 'site-members' ||
      !members.length ||
      members.some((m) => m.collectionSourcePath || m.requiredMembers?.length) ||
      !same(collection.members.map((m) => m.id).sort(), members.map((m) => m.modelIdentity).sort())
    )
      throw Error('Collection member scope differs from the fixed batch');
    if (
      collection.membershipEvidence.inventoryStatus !== 'complete' ||
      collection.membershipEvidence.outstanding?.length
    )
      throw Error('Collection physical inventory remains incomplete');
    const review = read(path.join(dir, 'collection-review.json'));
    if (
      review.format !== 'molen/structure-collection-review@1' ||
      review.status !== 'completed' ||
      review.parentCompleted !== true ||
      review.memberGeometryFramesFieldsFloorsAndQaChanged !== false
    )
      throw Error('Collection assembly has no completed visual review');
    const required = [
      'collection.json',
      'collection-frame.json',
      'collection-assembly.json',
      'scene.json',
      'route-coverage.json',
      'terrain-grid.json',
      'terrain-review.terrain.json',
      'terrain-review.height.png',
    ];
    if (required.some((p) => !review.inputFiles?.[p]))
      throw Error('Collection review inputs missing');
    for (const [relative, expected] of Object.entries(review.inputFiles))
      if (hash(fs.readFileSync(within(dir, relative))) !== expected)
        throw Error(`Collection review input changed: ${relative}`);
    const coverage = read(path.join(dir, 'route-coverage.json'));
    if (
      coverage.independentModels !== members.length ||
      coverage.uncoveredLocal?.length !== 0 ||
      coverage.remainingLocalNativeFeatures?.length !== 0 ||
      !coverage.tests?.length ||
      coverage.tests.some(
        (t) =>
          !t.coveredBy.length &&
          !coverage.uncoveredExternal?.some((e) => same(e.coordinate, t.coordinate)),
      )
    )
      throw Error('Collection local physical coverage unresolved');
    if (
      !Array.isArray(review.currentImagesPersonallyInspected) ||
      new Set(review.currentImagesPersonallyInspected.map((view) => view.view)).size < 2
    )
      throw Error('Collection assembly views missing');
    for (const view of review.currentImagesPersonallyInspected ?? [])
      if (hash(fs.readFileSync(within(repository, view.localCapturePath))) !== view.sha256)
        throw Error('Collection assembly view changed');
    const assembly = read(path.join(dir, 'collection-assembly.json'));
    if (!same(assembly.members.map((m) => m.id).sort(), members.map((m) => m.modelIdentity).sort()))
      throw Error('Collection scene member scope differs');
    const output = path.join(repository, 'content/worldgen/source/qualla-structures');
    for (const member of members) {
      const declared = collection.members.find((m) => m.id === member.modelIdentity);
      if (
        member.modelState !== 'completed' ||
        member.parentModelIdentity !== entry.modelIdentity ||
        member.structureId !== entry.structureId ||
        member.workOwner !== entry.workOwner ||
        !same(member.stories, entry.stories) ||
        declared.sourcePath !== member.sourcePath
      )
        throw Error(`Collection member identity incomplete: ${member.modelIdentity}`);
      const result = await inspectMember(member, {
        ...options,
        currentReferences: readCurrentReferences(output, member),
      });
      const binding = review.memberReviews?.find((m) => m.modelIdentity === member.modelIdentity);
      const qaHash = hash(fs.readFileSync(within(repository, `${member.sourcePath}/qa.json`)));
      const spec = read(within(repository, `${member.sourcePath}/spec.json`));
      if (
        result.readiness !== 'ready' ||
        binding?.inputHash !== result.inputHash ||
        binding.qaHash !== qaHash ||
        declared.sourceHash !== spec.mesh.sha256 ||
        assembly.members.find((m) => m.id === member.modelIdentity)?.sourceHash !== spec.mesh.sha256
      )
        throw Error(`Collection member review changed: ${member.modelIdentity}`);
      row.collection.members.push({
        modelIdentity: member.modelIdentity,
        asset: result.asset,
        inputHash: result.inputHash,
        activePlacement: result.geographic.activePlacement,
      });
    }
    if (review.memberReviews.length !== members.length)
      throw Error('Collection review member count differs');
    row.assets = row.collection.members.map((m) => m.asset);
    row.inputHash = hash(
      JSON.stringify({ inputs: review.inputFiles, members: review.memberReviews }),
    );
    row.geographic.activePlacements = row.collection.members.map((m) => m.activePlacement);
    row.geographic.verified = true;
    row.fidelityQa.hashBoundReviewPassed = true;
    row.imagery = {
      status: 'passed',
      fidelityReviewPassed: true,
      selection: 'independent-member-reviews',
    };
    row.currentRenderIdentityVerified = true;
    row.readiness = 'ready';
    row.technicalReadiness = 'ready';
  } catch (error) {
    row.blockers.push(error.message);
    row.technicalReadiness = 'needs-review';
  }
  return row;
}
