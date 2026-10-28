# Pupin Bridge

Reviewed 2026-10-27. **Scoped medium-fi exterior and approximate native placement complete.**

![Bridge in the native viewer](preview.png)

Inspected 70 current frames: 13 portable, 13 shared-material/geographic, 25 medium-fi and 19 native. The complete mapped crossing has two concrete box-girder decks, three haunched river spans, regular approach spans, paired supports, six traffic lanes, outside paths, open metal barriers and repeating double-arm lights. Near levels retain chamfered pier heads, caps, bearings, joints, rail posts and lamp housings. The street level simplifies columns and fittings while retaining the defining crossing shape. Widened only the small landing caps after the native review found a mapped path edge just outside the old footprint.

Two existing shared 256px graphs, concrete_plain and metal_painted, serve three semantic material groups with metric UVs and linear vertex tints. Asphalt, paving and concrete use distinct tints/roughness over the common low-frequency graph. No embedded/private images, downloaded meshes or copied photo pixels. Each graph is read once per native view; all four runtime files use separate GPU attribute streams.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 960 | 83836 | 1 |
| district | 3780 | 335664 | 3 |
| street | 15452 | 1345608 | 3 |
| closeup | 32580 | 2778228 | 3 |

Detailed source master: 51228 triangles / 6149812 bytes. Runtime levels: 960 / 3780 / 15452 / 32580 triangles, 83836 / 335664 / 1345608 / 2778228 bytes and 1 / 3 / 3 / 3 draws. Initial skyline plus district is 419500 bytes. Strict medium-fi budgets pass; physical laptop/phone timing remains unmeasured.

Exact-QID OSM way 662893894 / Q3397334 supplies the 1492.189 m by 29.107 m overall plan, while standard PMTiles supplies both named carriageways and outside cycle paths. Anchor [20.383373068,44.867175721], heading 1.020039121409: +X northeast toward Borča, -X southwest toward Zemun, +Z southeast downstream along the Danube. Source datum 64.2 m follows native water 65.6534 m and a declared deck grade between the high and low banks. All 69 actual mapped cut-boundary width samples have model support at every LOD. Fifty also retain rendered map paving, meeting within 0.026719 m; the other 19 lie inside the replaced map road area. These join differences are renderer checks, not surveyed geographic accuracy.

All 403 resident buildings and 159 independent input road records remain. Original road inputs, DEM samples, displayed ground and water geometry stay unchanged; connected approach paving is deliberately graded. Failed loading retains the original map crossing. Unloading preserves native ground/water and releases every model/support geometry resource. No ground cutout was needed.

## Reconstruction limits

- Exterior geometry uses ordinary photographs and the mapped overall plan. Span proportions, girder sections, pier/railing profiles and foundations are regularized visual approximations; no as-built engineering survey is claimed.
- The exact mapped footprint is 1492.189m long and 29.107m wide, versus the nominal 1507m reference. The model follows that span; small 3.6 m long landing caps widen 0.7 m beyond each side to support the current mapped path edges.
- Three haunched river spans use a photo-led 95/172/95m schedule, followed by 24 regularized approach spans of about 47.09m. These inferred dimensions/counts are authoring controls, not independently established construction facts.
- The two carriageways, outside paths, open metal barriers, paired supports and repeating double-arm lights preserve the photo-led visual identity. Fine joints, fasteners, surface wear, inscriptions and exact lamp housings are omitted or simplified.
- The standard native water surface is 65.6534m and the source datum 64.2m. The deck profile meets the steep coarse Zemun bank and descends toward Borča; it is a visualization grade, not a surveyed roadway profile.
- Support bases sample the retained standard terrain. The lowest approach spans merge into the coarse landing ground; adjacent streets, floodplain, riverbanks and buildings remain independent context.
- Skyline retains the two slabs, haunches and paired supports. Closer levels restore tapered piers, bearings, lane markings, rail posts, expansion joints and lamp fittings.
- The surrounding buildings, riverbanks, floodplain paths, automatic retaining faces and surface fixtures are procedural context, not a reconstruction of historic Belgrade.
- The span schedule, structural sections, deck grade and support elevations are photo-led/standard-terrain visualization approximations. Small landing caps support generalized path edges. Lowest approach spans merge into coarse ground near Borča.
