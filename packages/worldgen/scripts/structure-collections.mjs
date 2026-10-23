/** Authoring collections contain independent assets, never an aggregate runtime placement. */
import { readFile } from 'node:fs/promises';

const qid = /^Q[1-9][0-9]*$/;
const asset = /^molen\.worldgen\.structure\.[a-z0-9_]+$/;
const id = /^N\d+(?:_[A-Z0-9]+)?$/;
const featureId = /^(?:node|way|relation)\/[1-9][0-9]*$/;

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
    const mappedMembers = collection.identityKind === 'osm-members';
    if (collection.identityKind && !mappedMembers)
      throw new Error(`${collection.id}: unsupported member identity kind`);
    const identity = (member) => (mappedMembers ? member.featureId : member.wikidataId);
    const expected = new Set((mappedMembers ? evidence?.featureIds : evidence?.wikidataIds) ?? []);
    if (
      !/^https?:\/\//.test(evidence?.source ?? '') ||
      expected.size !== collection.requiredCount ||
      collection.members.some((member) => !expected.has(identity(member)))
    )
      throw new Error(`${collection.id}: members differ from attributed membership evidence`);
    const localIds = new Set(),
      localQids = new Set();
    for (const member of collection.members) {
      if (
        !id.test(member.id) ||
        member.id === collection.id ||
        !qid.test(member.wikidataId) ||
        (mappedMembers
          ? !featureId.test(member.featureId) ||
            (member.wikidataId !== collection.wikidataId &&
              member.identitySource !== `https://www.wikidata.org/wiki/${member.wikidataId}`)
          : member.wikidataId === collection.wikidataId || member.featureId !== undefined) ||
        !member.title ||
        !asset.test(member.assetId) ||
        !/^[a-z0-9_]+$/.test(member.sourceKey) ||
        member.assetId !== `molen.worldgen.structure.${member.sourceKey}` ||
        !Number.isFinite(member.referenceCoordinate?.longitude) ||
        !Number.isFinite(member.referenceCoordinate?.latitude)
      )
        throw new Error(`${collection.id}: invalid independent member ${member.id}`);
      if (localIds.has(member.id) || localQids.has(identity(member)))
        throw new Error(`${collection.id}: duplicate member identity`);
      localIds.add(member.id);
      localQids.add(identity(member));
      // A named structure already in another candidate/collection must be referenced, not copied.
      for (const existing of candidates.filter(
        (entry) =>
          entry.wikidataId === member.wikidataId && (!mappedMembers || entry.id !== collection.id),
      )) {
        if (
          existing.id !== member.id ||
          (existing.modelRef && existing.modelRef !== member.assetId)
        )
          throw new Error(`${member.id}: reuse existing identity ${existing.id}`);
      }
      const signature = `${member.id}/${identity(member)}/${member.assetId}`;
      for (const [map, key] of [
        [identities, identity(member)],
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
  if (
    member &&
    (spec.wikidataId !== member.wikidataId ||
      spec.assetId !== member.assetId ||
      spec.mapFeatureId !== member.featureId)
  )
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
    .map((member) => ({
      id: member.id,
      wikidataId: member.wikidataId,
      ...(member.featureId ? { featureId: member.featureId } : {}),
      asset: member.assetId,
    }));
}

/** Dense mapped groups can use an explicit small radius; legacy authoring retains 80 metres. */
export function authoredMapMatchRadius(proposal) {
  const radius =
    proposal.mapIdentity?.maxDistance === undefined ? 80 : proposal.mapIdentity.maxDistance;
  if (!Number.isFinite(radius) || radius <= 0 || radius > 80)
    throw new Error('Authored map match radius must be greater than zero and at most 80 metres');
  return radius;
}

/** Shared site QIDs are safe only for declared distinct map members with disjoint match radii. */
export function distinctMappedCollectionPlacement(spec, proposal, existing, collections) {
  const collection = collections.find((entry) => entry.id === spec.collectionId);
  if (collection?.identityKind !== 'osm-members') return false;
  const member = collection.members.find((entry) => entry.id === spec.id);
  const other = collection.members.find((entry) => entry.assetId === existing.asset);
  if (
    !member ||
    !other ||
    member.featureId === other.featureId ||
    member.featureId !== spec.mapFeatureId ||
    spec.wikidataId !== collection.wikidataId ||
    existing.mapIdentity?.wikidata !== collection.wikidataId
  )
    return false;
  const distance = ([lon, lat], [lon2, lat2]) =>
    Math.hypot((lon2 - lon) * Math.cos(((lat + lat2) * Math.PI) / 360), lat2 - lat) * 111319.490793;
  const coordinate = (entry) => [
    entry.referenceCoordinate.longitude,
    entry.referenceCoordinate.latitude,
  ];
  const existingRadius = existing.mapIdentity.maxDistance ?? 150;
  if (!Number.isFinite(existingRadius) || existingRadius <= 0) return false;
  return (
    proposal.anchor?.every(Number.isFinite) &&
    existing.anchor?.every(Number.isFinite) &&
    distance(proposal.anchor, coordinate(member)) < 2 &&
    distance(existing.anchor, coordinate(other)) < 2 &&
    distance(proposal.anchor, existing.anchor) > authoredMapMatchRadius(proposal) + existingRadius
  );
}
