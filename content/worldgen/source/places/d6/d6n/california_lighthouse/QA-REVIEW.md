# california_lighthouse — California Lighthouse review

Reviewed2026-10-09 against current source/import/browser hashes.

## Source and placement

Exact-Q2279321 lighthouse node540121391 anchors[-70.0513486,12.6137665], correcting the old catalog point near the restaurant about124m southwest. Actual seven-point driveway way98865390 supplies the map control; inverse rotation puts it in model-local XZ and a focused test projects the first point back to its exact OSM location. The southwest entrance faces the former keeper-house/approach at heading-1.2, inferred from inspected owner photos and aerial context with approximately15degrees uncertainty. No surveyed door azimuth is claimed. Terrain datum follows host terrain; footprint replacement is disabled.

Primary references: [Royal Netherlands Navy2026 HP2B lights](https://www.defensie.nl/site/binaries/site-content/collections/documents/2026/04/30/hp2b/hp2b-lichtenlijst-2026-01.pdf), [owner restoration project](https://monumentenfondsaruba.org/california-lighthouse-1915/) and [2016 reopening report](https://monumentenfondsaruba.org/the-restoration-of-the-california-lighthouse-has-been-finished/). The lights row was read as parsed document text; its screenshot was unavailable. Inspected owner photographs are research references, not redistributed textures.

## Actual image review

Inspected all9 final portable views against the actual owner ground photographs and aerial image. The pale pink tapered tower, octagonal ivory pedestal, fourteen staggered green windows, four upper vents, triangular pediments, southwest entrance and three steps, two gallery decks, lantern cage/ladder, green cap and full vane are present. The original detailed source is reproduced without a geometry change. Cached photograph filenames were checked against actual pixels; the image called california-day is the aerial reference.

Inspected all9 final shared-material views including actual north-up driveway controls. Five canonical256px graphs provide lime plaster, limestone, painted metal, granite and plain wood. Green joinery and cap use shared surfaces with vertex tints; the window backing stays opaque. Every graph is read once; unloading leaves zero live model geometries. No embedded images or redistributed owner photographs. The actual road appears northeast of the tower in the geographic view and is an open driveway control, not a fabricated footprint.

Inspected all24 final browser frames with sky reflections: noon/late light, economy/high settings, synthetic cottage context, four near cameras, district whole tower, street openings/entrance and four level transitions. Every level retains the full tower, green cap/vane, pedestal and southwest steps. Skyline represents fourteen windows and four vents with dark patches; district and nearer levels have actual recessed and backed apertures. District uses sixteen tapered facets and sparse gallery rails; street uses thirty-two segments, visible at its intended intermediate distance. Close-up preserves the original detailed source. No primary mass is missing.

## Source and browser budgets

Preserved source36198triangles/2933708bytes; runtime import2933136bytes. Browser levels contain670/3214/11902/36198triangles within1000/4000/16000/64000caps and8draws. Skyline plus district total292536bytes; close-up2587604bytes loads separately. Five shared texture graphs avoid embedded image duplication. Initial transfer fits3MB phone and6MB laptop targets; physical-device frame-time measurements remain separate work.

Six current Khronos validations report zero errors, zero warnings and no embedded images. Three focused tests pass exact unchanged original-master reproduction and signed placement/map-coordinate projection; complete vane/steps and all fourteen recessed windows plus four vents in every near level; byte-identical derivative regeneration, strict triangle/draw/download limits, five shared graphs and separate12-byte position streams. Rebuilds and regeneration tests finished before the final image captures. Source reproduction, strict medium-fi audit and four-level pin audit all pass.

## Accepted reconstruction limits

Royal Netherlands Navy2026 HP2B lights row4000/J6330 publishes30m stone tower and55m focal elevation, corroborated by the owner restoration project. The owner records restoration completion and reopening in2016; inspected ground and aerial pictures establish the pale tapered shaft, green joinery/cap, octagonal pedestal and gallery arrangement. The30m structure excludes the authored vane extension to30.83m; focal elevation is not used to stretch the model. Base diameter, small trim/fittings and gallery proportions remain photo reconstructed. Static restored daylight exterior is accepted; current visitor status/condition, interiors, detached restaurant, precise weathering, operational light and animated vane are outside scope. References are research only, not model textures.

Current source, runtime, pixel, material, placement and recipe hashes are bound in qa.json. Synthetic cottages and flat ground are review context.
