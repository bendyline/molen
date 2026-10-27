/** Exact asset identity shared by the review browser and its capture driver. */
export function mediumFiAsset(assets, id) {
  if (typeof id !== 'string' || !id) throw new Error('Missing review asset identity');
  const assetId = id.startsWith('molen.worldgen.structure.')
    ? id
    : `molen.worldgen.structure.${id}`;
  const path = assets[assetId];
  if (typeof path !== 'string' || !path) throw new Error(`Unknown review asset ${assetId}`);
  return { assetId, path };
}

/** Generated LODs are indexed here even when no hand-authored variants are declared. */
export function mediumFiLodFile(sidecar, name) {
  const file = sidecar.runtimeLods?.levels?.find((level) => level.name === name)?.file;
  if (typeof file !== 'string' || !file) throw new Error(`Missing review LOD ${name}`);
  return file;
}

export function verifyMediumFiRender(sidecar, state) {
  const level = sidecar.runtimeLods?.levels?.find((level) => level.name === state?.level);
  if (
    state?.assetId !== sidecar.id ||
    state.runtimeHash !== sidecar.hash ||
    !level ||
    state.lodHash !== level.hash
  )
    throw new Error(`Review rendered the wrong asset or bytes: expected ${sidecar.id}`);
}
