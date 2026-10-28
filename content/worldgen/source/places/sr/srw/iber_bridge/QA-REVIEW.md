# Ibër Bridge

Reviewed 2026-10-27. **Scoped medium-fi exterior and approximate native placement complete.**

![Bridge in the native viewer](preview.png)

Inspected 62 current frames: 11 portable, 11 shared-material/geographic, 23 medium-fi and 17 native. The main crossing retains paired swept walkway canopies, inclined ribs, curved tubular carriers, concrete haunched girders and flared pier walls, rounded cornices, outside walks, dark open railings, cable-linked lamps and pale beacon caps. Small landing caps were widened for one generalized map path edge. Replaced an aliased hard-cut perforation graph with the existing filtered fractional-coverage graph; canopy form remains legible across views and modes. Far levels simplify fittings while retaining the distinctive paired canopy silhouette.

Four existing shared 256px material graphs: concrete_plain, stone_granite, metal_painted and metal_perforated_round, in five semantic material groups with metric UVs and linear vertex tints. The perforated sheet uses filtered fractional alpha coverage; portable fallback and skyline are simplified solid surfaces. No embedded/private images, copied photo pixels or downloaded meshes. Each graph is read once per native view, and all four runtime files use separate GPU attribute streams.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 924 | 78324 | 1 |
| district | 3908 | 366428 | 5 |
| street | 11330 | 1015388 | 5 |
| closeup | 22802 | 2058472 | 5 |

Detailed source master: 35906 triangles / 4312148 bytes. Runtime levels: 924 / 3908 / 11330 / 22802 triangles, 78324 / 366428 / 1015388 / 2058472 bytes and 1 / 5 / 5 / 5 draws. Initial skyline plus district is 444752 bytes. Strict medium-fi budgets pass; physical laptop/phone timing remains unmeasured.

The named standard PMTiles main crossing Ura e Ibrit / Most na Ibru (name:en Iber Bridge), mapped outside sidewalks and ordinary-photo location match resolve the previously unknown axis. No exact-QID map footprint is claimed. Anchor [20.86601972579956,42.891292885499894], heading 1.848488636959144: +X north/northwest toward the northern bank, -X south/southeast, +Z east/northeast along the Ibar. The mapped transport extent is 98.949 m; the body uses the nominal 91.2 m reference and an inferred 23.2 m width with flared landing caps. Source datum 498.8518249511719 m follows native water 499.651825 m and a declared bank/crown grade. All 24 actual map boundary width samples have model support at every LOD. Nearest upward-facing pavement meets within 0.042936 m. Two higher native bank-edge surfaces remain 0.113463 m and 0.177719 m above the cap, with joining pavement verified beneath them; those steps are recorded separately. These are renderer checks, not surveyed geographic accuracy.

All 1121 resident buildings and 248 independent input road records remain. Five records for the distinct Avni Koshtova crossing east of this bridge and six underpass records retain their input paths and receive no authored connection metadata. Raw road inputs, DEM samples, displayed ground and water geometry stay unchanged; connected bank paving is deliberately graded. Failed loading retains the original map crossing, and unloading releases every model/support geometry resource while preserving ground/water. No ground cutout was needed.

## Reconstruction limits

- The main bridge is identified by the named PMTiles road Ura e Ibrit / Most na Ibru (name:en Iber Bridge), nearby mapped sidewalks and ordinary photographs. There is no exact-QID footprint tag in the retained map snapshot; the distinct eastern Avni Koshtova crossing remains independent.
- The mapped transport extent is 98.949m between road joins. The body uses the nominal 91.2m reference with short supported landing extensions. Width 23.2m is inferred from outside map sidewalks and photographs; small landing caps flare to 25.6 m to support generalized path edges. These are not surveyed dimensions.
- Paired swept walkway canopies preserve the curved profile, inclined ribs and perforated sheet character. Transverse curvature, perforation pattern, individual rib/cable spacing and support sections are regularized visual interpretations.
- Three haunched girder bays, two flared pier walls, rounded edge cornices, dark open railings, cable-linked masts and pale beacon caps follow ordinary photographs. Fine fixings, drainage, graffiti, murals and inscriptions are omitted.
- A two-lane asphalt deck and raised outside walks represent the permanent crossing. Temporary barricades, military installations, vehicles, event banners and moveable furniture visible in older pictures are excluded.
- Source datum 498.8518249511719m follows native water 499.651825m. The shallow deck crown and bank levels adapt the coarse standard PMTiles/Mapzen fixture; no as-built or surveyed curb, vault, foundation or river-stage accuracy is claimed.
- The shared perforated-metal graph uses filtered fractional coverage for near-view holes; portable fallback and far levels use simplified solid surfaces. Closer levels restore inclined ribs, rounded carriers, railing pickets, lamp fittings and cable sag.
- The two higher native bank-edge surfaces are ordinary procedural context; the lower joining pavement is also present and checked. Their maximum 17.8 cm step is retained, not described as a sub-5cm top-surface match.
- Surrounding buildings, banks, automatic retaining faces and surface fixtures are procedural context, not a reconstruction of Mitrovica. Some side-bay foundations merge into coarse bank ground.
