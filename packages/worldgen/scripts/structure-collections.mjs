/** Authoring collections contain independent assets, never an aggregate runtime placement. */
import { readFile } from 'node:fs/promises';

const qid = /^Q[1-9][0-9]*$/;
const asset = /^molen\.worldgen\.structure\.[a-z0-9_]+$/;
const id = /^N\d+(?:_[A-Z0-9]+)?$/;

/** Keep the serialized wrapper bounded to explicit IDs and optional read-only verification. */
export function structureImportArgs(args) {
  const selected = args.find((arg) => arg.startsWith('--ids='));
  if (
    !selected ||
    !/^--ids=N\d{4}(?:_[A-Z0-9]+)?(?:,N\d{4}(?:_[A-Z0-9]+)?)*$/.test(selected) ||
    args.filter((arg) => arg === selected).length !== 1 ||
    args.filter((arg) => arg === '--check').length > 1 ||
    args.some((arg) => arg !== selected && arg !== '--check')
  )
    throw new Error(
      'Usage: node import-and-register-next-1000.mjs --ids=N0001,N0208_MSU [--check]',
    );
  return [selected, ...(args.includes('--check') ? ['--check'] : [])];
}

export function validateStructureCollections(document, candidates = []) {
  if (document?.format !== 'molen/structure-collections@1' || !Array.isArray(document.collections))
    throw new Error('Invalid structure collection manifest');
  const identities = new Map(),
    ids = new Map(),
    assets = new Map();
  const collectionIds = new Set();
  for (const collection of document.collections) {
    if (!/^N\d+$/.test(collection.id) || collectionIds.has(collection.id))
      throw new Error('Duplicate or invalid collection candidate id');
    collectionIds.add(collection.id);
    const candidate = candidates.find((entry) => entry.id === collection.id);
    if (candidates.length && candidate?.wikidataId !== collection.wikidataId)
      throw new Error(`${collection.id}: collection identity differs from catalog`);
    if (
      !qid.test(collection.wikidataId) ||
      !collection.title ||
      !Array.isArray(collection.members) ||
      collection.members.length < 2 ||
      collection.requiredCount !== collection.members.length
    )
      throw new Error(`${collection.id}: every required member must be declared`);
    const evidence = collection.membershipEvidence;
    const expected = new Set(evidence?.wikidataIds ?? []);
    if (
      !/^https?:\/\//.test(evidence?.source ?? '') ||
      expected.size !== collection.requiredCount ||
      collection.members.some((member) => !expected.has(member.wikidataId))
    )
      throw new Error(`${collection.id}: members differ from attributed membership evidence`);
    const localIds = new Set(),
      localQids = new Set();
    for (const member of collection.members) {
      if (
        !id.test(member.id) ||
        member.id === collection.id ||
        !qid.test(member.wikidataId) ||
        member.wikidataId === collection.wikidataId ||
        !member.title ||
        !asset.test(member.assetId) ||
        !/^[a-z0-9_]+$/.test(member.sourceKey) ||
        member.assetId !== `molen.worldgen.structure.${member.sourceKey}` ||
        !Number.isFinite(member.referenceCoordinate?.longitude) ||
        !Number.isFinite(member.referenceCoordinate?.latitude)
      )
        throw new Error(`${collection.id}: invalid independent member ${member.id}`);
      if (localIds.has(member.id) || localQids.has(member.wikidataId))
        throw new Error(`${collection.id}: duplicate member identity`);
      localIds.add(member.id);
      localQids.add(member.wikidataId);
      // A named structure already in another candidate/collection must be referenced, not copied.
      for (const existing of candidates.filter((entry) => entry.wikidataId === member.wikidataId)) {
        if (
          existing.id !== member.id ||
          (existing.modelRef && existing.modelRef !== member.assetId)
        )
          throw new Error(`${member.id}: reuse existing identity ${existing.id}`);
      }
      const signature = `${member.id}/${member.wikidataId}/${member.assetId}`;
      for (const [map, key] of [
        [identities, member.wikidataId],
        [ids, member.id],
        [assets, member.assetId],
      ]) {
        if (map.has(key) && map.get(key) !== signature)
          throw new Error(`${member.id}: conflicting collection identity or asset`);
        map.set(key, signature);
      }
    }
  }
  for (const collection of document.collections)
    if (collection.members.some((member) => collectionIds.has(member.id)))
      throw new Error('Nested collections cannot be runtime members');
  return document.collections;
}

export async function readStructureCollections(path, candidates = []) {
  return validateStructureCollections(JSON.parse(await readFile(path, 'utf8')), candidates);
}

export function collectionMember(collections, memberId) {
  return collections
    .flatMap((collection) => collection.members)
    .find((member) => member.id === memberId);
}

export function selectedStructureIds(selection, collections) {
  if (!selection) return undefined;
  return [
    ...new Set(
      selection.flatMap(
        (selected) =>
          collections
            .find((collection) => collection.id === selected)
            ?.members.map((member) => member.id) ?? [selected],
      ),
    ),
  ];
}

/** Reject a member spec before it can create an asset with the collection's identity. */
export function validateCollectionSpec(spec, collections) {
  if (collections.some((collection) => collection.id === spec.id))
    throw new Error(`${spec.id}: a collection cannot have a composite source model`);
  const member = collectionMember(collections, spec.id);
  if (/^N\d+_/.test(spec.id) && !member)
    throw new Error(`${spec.id}: undeclared collection member`);
  if (member && (spec.wikidataId !== member.wikidataId || spec.assetId !== member.assetId))
    throw new Error(`${spec.id}: source differs from collection member identity`);
  if (
    spec.collectionId &&
    !collections.some(
      (collection) =>
        collection.id === spec.collectionId &&
        collection.members.some((entry) => entry.id === spec.id),
    )
  )
    throw new Error(`${spec.id}: unregistered collection membership`);
  return member;
}

/** References are routing metadata only: each member is imported and placed independently. */
export function collectionModelRefs(collection, registeredAssets) {
  return collection.members
    .filter((member) => registeredAssets[member.assetId] !== undefined)
    .map((member) => ({ id: member.id, wikidataId: member.wikidataId, asset: member.assetId }));
}
