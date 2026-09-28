import { encodeSourceGeohash, validateSourceKey } from './structure-source-paths.mjs';

const basisPrefix = 'folder-location-evidence:';

/** Validate organizational evidence without choosing a folder or changing runtime placement. */
export function validateFolderLocationEvidence(document, indexEntries) {
  const referenced = indexEntries.filter((entry) => entry.anchorBasis?.startsWith(basisPrefix));
  if (document === undefined) {
    if (referenced.length > 0)
      throw new Error('Folder location evidence is missing for referenced source anchors');
    return;
  }
  if (
    document?.format !== 'molen/structure-folder-locations@1' ||
    document.scope !== 'organizational-reference-only' ||
    !Array.isArray(document.entries)
  )
    throw new Error('Unsupported folder location evidence format or scope');

  const records = new Map();
  for (const record of document.entries) {
    const key = validateSourceKey(record?.key);
    if (records.has(key)) throw new Error(`Duplicate folder location evidence key: ${key}`);
    if (
      typeof record.assetId !== 'string' ||
      !/^molen\.worldgen\.structure\.[a-z0-9][a-z0-9_-]*$/.test(record.assetId) ||
      typeof record.title !== 'string' ||
      record.title.trim() === ''
    )
      throw new Error(`${key}: folder location evidence needs a structure asset ID and title`);
    if (!Array.isArray(record.anchor) || record.anchor.length !== 2)
      throw new Error(`${key}: folder location evidence needs a longitude/latitude anchor`);
    encodeSourceGeohash(record.anchor[0], record.anchor[1]);
    let url;
    try {
      url = new URL(record.source?.url);
    } catch {
      throw new Error(`${key}: folder location evidence needs an absolute HTTP(S) source URL`);
    }
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error(`${key}: folder location evidence needs an absolute HTTP(S) source URL`);
    records.set(key, record);
  }

  for (const entry of referenced) {
    const key = entry.anchorBasis.slice(basisPrefix.length);
    if (key !== entry.key)
      throw new Error(`${entry.key}: folder location evidence reference must use its source key`);
    const record = records.get(key);
    if (!record) throw new Error(`${key}: referenced folder location evidence is missing`);
    if (record.assetId !== entry.assetId)
      throw new Error(`${key}: folder location evidence asset ID differs from the source index`);
    if (
      !Array.isArray(entry.anchor) ||
      entry.anchor.length !== 2 ||
      !record.anchor.every((value, index) => value === entry.anchor[index])
    )
      throw new Error(`${key}: folder location evidence anchor differs from the source index`);
  }
}
