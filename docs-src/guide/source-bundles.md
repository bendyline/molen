# Logical source bundles

A logical thing is authored in one copyable directory. The directory contains a validated
`source.json` (`molen/source-bundle@1`) and every source file owned by that thing: definitions,
editable models or procedural recipes, authoring generators, behavior scripts, textures, sounds,
and provenance.

```text
source/<category>/<thing>/
  source.json
  README.md
  entity.types.json
  models/
    source.glb
    generate.mjs
    baseline.json
  scripts/
    interactions.ts
  textures/
  sounds/
```

Only create a subdirectory when the thing has a file of that class; empty directories are not
required. A root-level entity type document can reference `scripts/` without escaping its own
directory. Paths in `source.json` are relative to the bundle and cannot escape it. A source bundle
must not depend on a sibling bundle for concrete entity values or owned behavior. It may depend on
documented engine capabilities such as the generic vehicle, airplane, helicopter, or procedural
building solvers, and on shared material libraries.

Imported assets remain build outputs. Their `molen/asset@1` sidecars and canonical models belong
under the owning project's runtime `assets/` tree, not inside the source bundle. Browser `public/`
and `dist/` copies are also outputs. This leaves one authority for authoring while preserving the
existing runtime contracts.

Validate a manifest directly:

```sh
molen validate path/to/source.json
```

Repository builds additionally verify that every path listed by a source bundle exists, that no
owned source file is omitted, and that pinned source-model hashes match.
