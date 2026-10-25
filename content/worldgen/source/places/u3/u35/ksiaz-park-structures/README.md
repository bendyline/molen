# Książ park structures authoring

Geographic authoring bundle for related components of the Książ site in cell `u3/u35`.
The generator and its common geometry recipe live here; each generated component keeps its
own source bundle, stable asset ID, runtime model and independently reviewed placement.

Run `node content/worldgen/source/places/u3/u35/ksiaz-park-structures/models/generate-ksiaz-park-structures.mjs`; use `--ids=<component-id>`
for one component or `--check` to verify existing outputs.
Shared mesh and material helpers remain in `packages/worldgen/scripts/`.
