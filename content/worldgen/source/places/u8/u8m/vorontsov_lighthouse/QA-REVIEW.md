# vorontsov_lighthouse — Vorontsov Lighthouse review

Reviewed2026-10-09 against current source/import/browser hashes.

## Source and placement

Exact-Q1976702 node703128124 anchors[30.7600343,46.4965348]. Actual coastline ways555774482/1035205249 in the2026-09-28 snapshot supply open nearby control lines; the long breakwater continues beyond the modeled stair foot. Native+Z follows the south-southeast pier axis at heading0.5, and the published facade/cowls face the southwest harbor. Evidence east/south coordinates were inverse-rotated into model-local XZ before capture; tests project them back to the exact original OSM coordinates. No fabricated lighthouse footprint is used. Sea-level datum/elevation0 retains deckY4 and focal centerY27; approximate11m OSM seamark height is excluded as a scale control. Footprint replacement is disabled.

[Operator dimensions and lighthouse history](https://hydro.gov.ua/?page_id=381) and[June19,2019 modernization report](https://hydro.gov.ua/?p=1262) are primary references. Inspected research photographs:[2018](https://hydro.gov.ua/wp-content/uploads/2018/09/1-19.png),[2019](https://hydro.gov.ua/wp-content/uploads/2019/06/64799486_646013762541915_8439423072338968576_n.jpg). Reference pictures are not model textures.

## Actual image review

Inspected all9 final portable views. The white cylindrical cast-iron tower, red caged lantern, radial light arms, mast/stays, blue paired cowls, patterned harbor service doors, asymmetric tiered quay, deck rails, chain surround and full access stair are present and supported. The two original operator photographs were inspected directly: their facade, paired cowls, red lantern and exposed quay agree with the authored configuration. Original detailed source bytes remain unchanged.

Inspected all9 final shared-material views including north-up actual coastline controls. Four canonical256px graphs supply painted metal, lime plaster, concrete and rubble; blue/red/green features share these graphs through vertex tints. Every graph is read once; unload leaves zero live model geometries. No embedded images or redistributed operator pictures. Harbor doors are inset and the service deck is supported by the tapered quay. Flat terrain under a sea-level model is an inspection surface, not an invented harbor ground elevation.

Inspected all24 final browser frames with sky reflections: noon/late light, economy/high settings, synthetic cottage context, four source detail cameras, district full ensemble, street service facade/lantern and four transitions. Each level retains the whole tower, red lantern, asymmetric pier-head and descending access stair; blue cowls remain in skyline. District reduces cast-iron seams, railing posts, chains, door ornament, cap seams and wave-wall stair steps. Street retains fine facade openings, sparse seam relief and curved cowls. Close-up preserves the detailed original geometry. No missing primary mass or unsupported service block was observed.

## Source and browser budgets

Preserved original source54128triangles/4353236bytes; import4352732bytes. Browser levels contain585/3896/15572/54128triangles within1000/4000/16000/64000caps and8draws. Skyline+district total334808bytes; close-up3816508bytes loads separately. Shared graphs avoid embedded image duplication. Initial transfer meets3MB phone/6MB laptop budgets; physical-device frame-time measurements remain separate work.

Six current Khronos validations report zero errors, zero warnings and no embedded images. Three focused tests pass: exact original source hash/published heights and signed sea-level placement; full mast, supported asymmetric deck, descending stair and recessed tower entry at browser levels; exact deterministic regeneration, strict triangle/draw/download caps, four canonical graphs and separate12-byte position streams. Corrected native evidence coordinates round-trip to the original coastline point. The capture-frame regression suite also passes its4checks, including empty-outline/open-centerline evidence. All rebuilds finished before final captures.

## Accepted reconstruction limits

Ukraine State Hydrography publishes26m tower height and27m focal height. Its inspected2018/2019 photographs establish the white jointed cylinder, shallow red lantern cap/cage, radial arms, blue cowls, service facade and stepped quay. The June19,2019 report mentions solar/battery upgrades but does not locate those elements in the two photographs, so hidden equipment is not invented. Master source reproduces its exact historical hash. This static daylight exterior represents that documented configuration;4m deck,4.32m body diameter, minor joints/cowls/stays and mast extension remain photo-proportioned. Current condition, interiors, hidden machinery, operational flashing light, unlocated solar hardware and the remaining long breakwater are outside the accepted scope.

Current GLB, pixel, recipe, material, map and placement hashes are bound in qa.json. Synthetic cottages and flat ground are review context.
