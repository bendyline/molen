# Bradbury Building exterior review

The model uses the ordinary `bradbury_building` catalog identity. Its concave native footprint retains the Broadway entrance front, Third Street side, narrow corner chamfer and rear return. Neighboring bridal shops and office blocks are excluded.

Four complete local originals and all 24 candidate thumbnails were inspected. The two 2014 exterior photographs control five storeys, the grouped rectangular middle windows, round upper windows, bracketed terracotta cornice, retail openings and fire escapes. A focused perspective inspection of those same originals resolves 14 windows across the flat Broadway front, 16 middle windows and 21 upper arches on Third Street, and one window per row on the chamfer. The main arched portal is under Broadway's third grouped bay; a smaller portal remains on Third Street. Fine relief is simplified. Temporary shop branding, street objects and original photo pixels are excluded.

The fourth reference shows the atrium's pitched glass roof. Only its exterior ridge profile is represented, with opaque glazing and metal divisions. Its position, unseen roof plant and rear detailing are estimates. Interior galleries, stairs and elevators are outside this exterior batch. The 25.8 m map height remains a control; the rooflight ridge at 28.1 m and other authored heights are photographic approximations rather than surveyed elevations.

## Geographic scope

The named Bradbury POI and building share native ID 35184800031600. The retained 13-vertex concave outline has approximately 2,105.96 m² area. The model frame is anchored at −118.24786511272077, 34.05053200121085 with heading 0.8994823531637312 radians. A dry Broadway footway datum was selected before ground acquisition and modeling. The POI's unclassified elevation value is not used as ground.

The exact original USGS export, catalog, service and export metadata are retained in `terrain-sources`. The export locks current catalog object 127960, **USGS 1 Meter 11 x38y377 CA_LosAngeles_B23**, catalog acquisition 2024-07-01 and publication 20250811. All 203,401 original pixels were compared between Pillow and an independent standard-library TIFF reader. That reader reproduces all 66,049 derived one-metre grid values to the recorded rounding precision. The dry datum is 86.3604 m in the source-specific NAVD88 context; no separate local datum transformation is asserted.

The independent source field was frozen before geometry and remains unchanged. The architectural base at −0.65 m and raised entrance threshold at 0.45 m represent the photographic wall foot and steps. All 432 native perimeter samples fall between them, approximately −0.321282 to +0.276511 m relative to the datum. There is no terrain cutout, fitted pad or generic footprint replacement. This accepts the retained source-ground preview only. Another host DEM needs its own contact review; one-metre data does not establish a surveyed sidewalk or foundation.

## Reproducible checks

`verify-geometry.mjs` validates actual Float32 source and imported geometry at all four levels, including attributes, finite values, normals, winding and UVs. Independent native-plan, concavity, photographic window counts, recessed doors, open rail gaps and roof controls accompany strict 1,000 / 4,000 / 16,000 / 64,000 triangle limits. Nine sampled roof heights agree within 0.045001 m (omitted skyline metal frame thickness); these samples are not a global geometric error bound. Declared 2 / 1.1 / 0.4 m LOD approximation also covers omitted fine ornament.

Current hashes, inspected frames, material bindings, runtime-pack inclusion, repeated simulation, placement lifecycle and completion acceptance are recorded in `qa.json` and the capture reports. Bulk views stay in ignored local review folders; `preview.png` and `detail-preview.jpg` are the small summary views.
