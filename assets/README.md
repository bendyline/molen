# Molen asset library

This directory holds reusable, source-controlled 3D asset entries grouped by semantic category.
Unlike `examples/`, each entry is an asset first: it keeps all editable source below one logical
thing directory and identifies those files with a validated `molen/source-bundle@1` `source.json`.
Canonical imported runtime files, provenance, and visual QA evidence can remain beside the source
when the whole directory is the asset workspace.

## Categories

- [Structures](structures/README.md)

Each asset should follow the shipped
[3D model asset workflow](../docs-src/guide/3d-model-assets.md): retain its generation prompts and
sources, import it through an `molen/project@1` project, verify its sidecar hashes, and inspect both
turntable and in-scene Molen captures.
