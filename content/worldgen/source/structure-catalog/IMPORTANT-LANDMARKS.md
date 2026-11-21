# Important missing landmarks

[The 500-entry backlog](IMPORTANT-LANDMARKS.json) is the shared inventory for this coverage pass.
Rank reflects broad recognition, architectural or historical significance, and regional coverage.
The selection uses Wikidata sitelinks and selected UNESCO listings, supplemented by named
landmark leads. The manifest records the source and reference coordinate for each entry.

## First authoring pass

The existing collection covers the Empire State Building, Eiffel Tower, Brandenburg Gate,
Christ the Redeemer and the Great Pyramid of Khufu. The [Khufu model scope](../places/st/stq/great_pyramid_of_giza/README.md)
explicitly excludes its neighbors. The first three queued landmarks are separate geographic
assets, with their own footprints and terrain contact.

| Priority | Landmark | First modeling scope |
| ---: | --- | --- |
| 1 | Great Sphinx of Giza | Surviving limestone figure, head, paws and lower body at the carved enclosure floor. [Egyptian Ministry of Tourism and Antiquities](https://egymonuments.gov.eg/en/monuments/the-great-sphinx/) |
| 2 | Pyramid of Khafre | Main pyramid footprint, surviving upper casing, stepped limestone faces and summit outline. [Egyptian Ministry of Tourism and Antiquities](https://egymonuments.gov.eg/en/monuments/pyramid-complex-of-khafre-khefren) |
| 3 | Pyramid of Menkaure | Main pyramid footprint, lower granite courses and the distinctive north-face breach. [Egyptian Ministry of Tourism and Antiquities](https://egymonuments.gov.eg/en/monuments/pyramid-complex-of-menkaure) |

## Working across devices

1. Sync the current manifest through the branch shared by the devices. Read the existing claims,
   then run `node content/worldgen/source/structure-catalog/check-important-landmarks.mjs --next`
   from the repository root to list the highest-ranked unclaimed entries.
2. Change the chosen entry to `claimed` and set `owner` to the device or workstream name. Share
   that change through the same branch before starting geometry. Keep the record's `id` and
   external identity stable across handoffs. The Qualla scanner and batch preparation consume
   the backlog as a reservation and will reject work assigned to this catalog.
3. Verify the named building, surviving or represented era, precise footprint, signed axes and
   terrain against photos and PMTiles. For entries scoped to a compound, give independently
   placed buildings their own assets and record their names in the parent entry's scope.
4. Follow the [medium-fi guide](../../../../docs-src/guide/medium-fi.md), then record the canonical
   source bundle, reviewed runtime asset and placement before setting `status` to `reviewed`.
   Run `node content/worldgen/source/structure-catalog/check-important-landmarks.mjs --check`
   to catch collisions from newly imported models or other batch assignments.

The overlap check reads the source index and model specs, project and style-pack registries,
Earth placement sources, the original structure catalog and its collection members, and Qualla's
batch entries and current holds. Identity matches use stable model IDs, Wikidata IDs and
normalized names near their reference locations. Verify aliases and exact footprint scope again
when claiming each landmark. [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en) ·
[UNESCO World Heritage List](https://whc.unesco.org/en/list/)
