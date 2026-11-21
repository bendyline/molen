import { fileURLToPath } from 'node:url';
import { validateStructureCandidateIds } from '../../../../packages/worldgen/scripts/structure-identity.mjs';
import { readImportantLandmarks } from '../qualla-structures/work-ownership.mjs';
import {
  createLandmarkOverlapIndex,
  loadLandmarkCoverage,
} from './important-landmark-overlaps.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const manifest = readImportantLandmarks(root);
if (manifest?.targetCount !== 500 || manifest.entries.length !== manifest.targetCount)
  throw new Error('The important landmark backlog must have 500 slots.');

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !['--check', '--next'].includes(args[0])))
  throw new Error('Usage: node check-important-landmarks.mjs [--check|--next]');
validateStructureCandidateIds(manifest.entries);
const coverage = loadLandmarkCoverage(root);
const findOverlap = createLandmarkOverlapIndex(coverage);
const identityIds = new Set();
const states = { queued: 0, claimed: 0, reviewed: 0 };
const failures = [];
const ownsClaim = (entry) => typeof entry.owner === 'string' && Boolean(entry.owner.trim());
for (const [index, entry] of manifest.entries.entries()) {
  const { longitude, latitude } = entry.referenceCoordinate ?? {};
  if (
    entry.priority !== index + 1 ||
    !entry.title?.trim() ||
    !/^https:\/\//.test(entry.source) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Object.hasOwn(states, entry.status) ||
    (entry.status === 'claimed' && !ownsClaim(entry)) ||
    !/^([A-Z]{2})$/.test(entry.countryCode)
  ) {
    failures.push(`${entry.id}: invalid candidate or missing claim owner`);
    continue;
  }
  const identity = /^Q[1-9]\d*$/.test(entry.wikidataId)
    ? entry.wikidataId
    : /^\d+$/.test(entry.unescoId)
      ? `unesco:${entry.unescoId}`
      : /^QS-[a-f0-9]+$/.test(entry.quallaStructureId)
        ? entry.quallaStructureId
        : undefined;
  if (!identity || identityIds.has(identity))
    failures.push(`${entry.id}: missing or duplicate public identity`);
  identityIds.add(identity);

  const match = findOverlap(entry);
  const ownAsset = `molen.worldgen.structure.${entry.id}`;
  if (match && (entry.status === 'queued' || match.assetId !== ownAsset)) {
    failures.push(
      `${entry.id}: already covered or reserved as ${match.id ?? match.assetId ?? match.names[0]} in ${match.source}`,
    );
  }
  if (
    entry.status === 'reviewed' &&
    !coverage.some((item) => item.assetId === ownAsset && item.hasModel)
  )
    failures.push(`${entry.id}: reviewed entry has no indexed source model`);
  states[entry.status]++;
}
if (failures.length) throw new Error(failures.join('\n'));

if (args[0] === '--next') {
  for (const entry of manifest.entries.filter((entry) => entry.status === 'queued').slice(0, 10))
    console.log(`${entry.priority}. ${entry.title} (${entry.countryCode}) — ${entry.id}`);
} else {
  console.log(
    `Verified ${manifest.entries.length} landmark slots (${states.queued} queued, ${states.claimed} claimed, ${states.reviewed} reviewed).`,
  );
  console.log(
    `Checked against ${coverage.length} source, runtime, placement and planning records.`,
  );
}
