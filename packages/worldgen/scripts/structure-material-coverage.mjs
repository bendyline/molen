/** Inspect explicit GLB bindings without guessing a substance from a material name or color. */
const slots = new Set(['wall', 'roof', 'trim', 'foundation', 'window', 'door']);
const hasUv0 = (primitive) =>
  primitive.attributes?.TEXCOORD_0 !== undefined && primitive.attributes.TEXCOORD_0 !== null;
const usesSharedSurface = (model) =>
  model.materialCoverage.definitions.some(
    (definition) => definition.sharedSurface && definition.primitives > 0,
  );

export function inspectStructureMaterials(document, canonicalRefs) {
  const primitives = (document.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const issues = [];
  const definitions = (document.materials ?? []).map((material, index) => {
    const uses = primitives.filter((primitive) => primitive.material === index);
    const surface = material.extras?.molenSurface;
    if (surface) {
      if (!canonicalRefs.has(surface.ref))
        issues.push({ material: index, code: 'unknown-surface', ref: surface.ref });
      if (!slots.has(surface.slot)) issues.push({ material: index, code: 'invalid-slot' });
      if (surface.uv !== 'repeats') issues.push({ material: index, code: 'invalid-uv-convention' });
      if (uses.some((primitive) => !hasUv0(primitive)))
        issues.push({ material: index, code: 'missing-uv0' });
    }
    const pbr = material.pbrMetallicRoughness ?? {};
    const textureSlots = [
      ['baseColor', pbr.baseColorTexture],
      ['metallicRoughness', pbr.metallicRoughnessTexture],
      ['normal', material.normalTexture],
      ['occlusion', material.occlusionTexture],
      ['emissive', material.emissiveTexture],
    ]
      .filter(([, texture]) => texture !== undefined)
      .map(([name]) => name);
    return {
      index,
      name: material.name ?? `material-${index}`,
      sharedSurface: surface,
      primitives: uses.length,
      uv0Primitives: uses.filter(hasUv0).length,
      vertexColorPrimitives: uses.filter((primitive) => primitive.attributes?.COLOR_0 !== undefined)
        .length,
      alphaMode: material.alphaMode ?? 'OPAQUE',
      doubleSided: material.doubleSided ?? false,
      textureSlots,
      // Local factors remain evidence for review, never an automatic texture substitution rule.
      ...(!surface
        ? {
            fallback: {
              baseColor: pbr.baseColorFactor ?? [1, 1, 1, 1],
              roughness: pbr.roughnessFactor ?? 1,
              metalness: pbr.metallicFactor ?? 1,
              emissive: material.emissiveFactor ?? [0, 0, 0],
            },
          }
        : {}),
    };
  });
  return {
    definitions,
    implicitMaterialPrimitives: primitives.filter((primitive) => primitive.material === undefined)
      .length,
    issues,
  };
}

/** Count editable masters separately so imported copies cannot inflate adoption figures. */
export function summarizeStructureMaterials(models, entries) {
  const byPath = new Map(models.map((model) => [model.path, model]));
  const masters = entries
    .filter((entry) => entry.hasModel)
    .map((entry) => {
      const path = `${entry.sourcePath.replace(/^content\/worldgen\//, '')}/models/source.glb`;
      const model = byPath.get(path);
      if (!model) throw new Error(`Missing authored master in texture inventory: ${path}`);
      return { entry, model };
    });
  const groups = [...new Set(masters.map(({ entry }) => entry.collection))]
    .sort()
    .map((collection) => {
      const group = masters.filter(({ entry }) => entry.collection === collection);
      const definitions = group.flatMap(({ model }) => model.materialCoverage.definitions);
      return {
        collection,
        models: group.length,
        modelsWithSharedSurfaces: group.filter(({ model }) => usesSharedSurface(model)).length,
        sharedDefinitions: definitions.filter((definition) => definition.sharedSurface).length,
        localDefinitions: definitions.filter((definition) => !definition.sharedSurface).length,
        transparentLocalDefinitions: definitions.filter(
          (definition) => !definition.sharedSurface && definition.alphaMode === 'BLEND',
        ).length,
      };
    });
  const usage = new Map();
  const localNames = new Map();
  for (const { entry, model } of masters) {
    for (const definition of model.materialCoverage.definitions) {
      if (definition.sharedSurface) {
        if (!(definition.primitives > 0)) continue;
        const ref = definition.sharedSurface.ref;
        const users = usage.get(ref) ?? new Set();
        users.add(entry.key);
        usage.set(ref, users);
      } else {
        const group = localNames.get(definition.name) ?? {
          models: new Set(),
          definitions: 0,
          alphaModes: new Set(),
          textured: false,
        };
        group.models.add(entry.key);
        group.definitions++;
        group.alphaModes.add(definition.alphaMode);
        group.textured ||= definition.textureSlots.length > 0;
        localNames.set(definition.name, group);
      }
    }
  }
  return {
    scope:
      'Registered authored masters only; source/runtime pairs count once. Local definitions may be intentional glass, artwork or flat finishes. Shared bindings do not prove UV scale, orientation or visual approval.',
    models: masters.length,
    collections: groups,
    sharedSurfaceUsage: [...usage]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, keys]) => ({ ref, models: keys.size, sourceKeys: [...keys].sort() })),
    unboundModels: masters
      .filter(({ model }) => !usesSharedSurface(model))
      .map(({ entry, model }) => ({
        key: entry.key,
        candidateId: entry.candidateId,
        title: entry.title,
        sourcePath: entry.sourcePath,
        materials: model.materials,
        action:
          'Classify component substances and review metric UVs before adding shared bindings.',
      })),
    repeatedLocalNames: [...localNames]
      .filter(([, value]) => value.models.size > 1)
      .map(([name, value]) => ({
        name,
        models: value.models.size,
        definitions: value.definitions,
        alphaModes: [...value.alphaModes].sort(),
        textured: value.textured,
      }))
      .sort((a, b) => b.models - a.models || a.name.localeCompare(b.name)),
  };
}
