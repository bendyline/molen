# Structure identities

Use a persistent building name for each catalog candidate and independently modeled
collection member. A title is display text; changing it does not rename the assigned ID.
The candidate refresh retains IDs and authoring metadata by Wikidata identity.

For Edifício Altino Arantes:

| Purpose | Identity |
| --- | --- |
| Candidate, spec and source key | `edificio_altino_arantes` |
| Runtime asset | `molen.worldgen.structure.edificio_altino_arantes` |
| Geographic placement | `edificio.altino.arantes` |
| Source directory | `places/6g/6gy/edificio_altino_arantes/` |
| Placement source | `content/earth/source/placements/6g/6gy/edificio.altino.arantes.json` |

Use lowercase ASCII words joined by underscores for new source keys. Preserve accents
and punctuation in display titles. Real numeric names such as `11_foot_8_bridge` are
valid. Qualify duplicate names with their city or site, for example `aon_center_chicago`
and `aon_center_los_angeles`. Qualify collection members with their building and site
names so they remain understandable outside the parent collection. Each member has
its own model, source key, asset and placement; membership is explicit in
`structure-catalog/collections.json`.

New candidate name collisions fail validation and require an explicit qualified ID.
Never assign batch numbers, array positions or production queue labels as identities.
Existing independent named assets keep their established identities.

Renaming an assigned identity is a coordinated migration: update the catalog, specs,
source and runtime paths, project/style registries, placement sources, generators,
tests, evidence references and asset lock together. Rebuild the source and authoring
indexes and generated placement catalogs. Review hashes must only be rebound when
their original evidence still matches and the migration preserves its meaning;
renaming must not turn a stale review into a current review. No compatibility alias
table is shipped in the runtime.

The completed naming migration retains its original-to-current mapping and original
source text locally under `.artifacts/structure-identity-migration/` for auditing.
That local archive is not a runtime dependency or a tracked source of identities.
