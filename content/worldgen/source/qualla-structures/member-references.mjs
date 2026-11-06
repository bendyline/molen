/** Keep independent site members' reviewed reference selections resumable. */
import fs from 'node:fs';
import path from 'node:path';

export function readCurrentReferences(output, entry) {
  const relative = entry.referenceManifest ?? `references/${entry.structureId}.json`;
  if (entry.referenceManifest) {
    if (
      !entry.parentModelIdentity ||
      !/^[a-z][a-z0-9_]*$/.test(entry.modelIdentity ?? '') ||
      relative !== `references/members/${entry.modelIdentity}.json`
    )
      throw Error(`Invalid member reference path: ${entry.modelIdentity}`);
    const file = path.join(output, relative);
    const real = path.relative(fs.realpathSync(output), fs.realpathSync(file));
    if (real.startsWith('..') || path.isAbsolute(real))
      throw Error(`Member references outside catalog: ${entry.modelIdentity}`);
    const record = JSON.parse(fs.readFileSync(file));
    if (
      record.format !== 'molen/structure-member-references@1' ||
      record.modelIdentity !== entry.modelIdentity ||
      record.parentModelIdentity !== entry.parentModelIdentity ||
      record.structureId !== entry.structureId ||
      record.referenceImages?.structureId !== entry.structureId
    )
      throw Error(`Member reference identity differs: ${entry.modelIdentity}`);
    return record.referenceImages;
  }
  const file = path.join(output, relative);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : undefined;
}
