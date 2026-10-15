# Esztergom Basilica

![Molen preview](preview.png)

Individual Esztergom Basilica: eight-column classical open portico/triangular pediment/inset timber portal, broad pale rectangular masonry body with paired round windows/high lunettes and rear parapet terrace. Two lateral tower wings with genuine round arch passages and balustrades, octagonal dark-louvered upper stages/green domes/crosses. Dominant tall pale colonnaded central drum, recessed rectangular window bays, heavy circular cornice and green ribbed copper dome/orb/cross. Four existing shared stone/continuous limestone/copper/wood graphs, metric UVs, linear tints and four browser levels. Fine Corinthian sculpture/reliefs/inscriptions, interiors and exact hilltop threshold joins remain approximate or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Basilica_of_Esztergom,_Hungary_-_Bak%C3%B3_G%C3%A1bor.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Esztergom_Kathedrale_Mari%C3%A4_Himmelfahrt_Fassade_1.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Basilica_of_Esztergom.jpg)

Four existing cached256-square coursed limestone, continuous limestone, oxidized copper and plain-wood graphs. Linear pale-stone/green-copper/wood tints, metric UVs and flat architectural normals; glazing/gold accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.

## Model and axes

29,430 triangles; 88,290 vertices; 6 material groups; 3,535,260 bytes. Native bounds: -58.639, -13.531, -47.279 to 63.900, 90.800, 47.322. Source hash: `sha256:13a9e122c88bbf320d7fab02bbe5b2a84612d6d34fd4a5e2f185cb89fa650129`.

{"x":"eastward from western rear toward eight-column portico","y":"up","z":"southward across lateral wings/towers"}

Standard viewer DEM datum156.867491m; estimated floor0.8m, raw whole perimeter-13.18..0.22m. Footings crossY=0 and extend below retained coarse terrain. Local eastern steps descend toward coarse front samples. Exact hilltop retaining-wall/ground contacts, street/door joins, absolute altitude, height datum and walking remain unverified. No preview flattening, host DEM alteration or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0383` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way/77102132/Q991832 matches current main35184449190964 (24 vertices rather than earlier34). Current dome component35185413897395 retains20 raw vertices and height100m. Both controls retain all44 vertices/tags by rigid rotation with no rescale. Native+X eastern eight-column portico, -X western rear and lateral towers sign retained heading0.494588533929rad. Existing Wikidata facts height100m, length120m and width40m remain verbatim; their measurement datum/scope is unspecified. Current mapped whole is about116.4m long/94.4m across including lateral tower wings, while central body is about43.8m wide. No artificial scaling forces the40m fact onto the whole envelope. The100m fact and dome tag are retained without forcing that measurement onto the entrance-floor datum. Picture proportions guide an estimated90m exterior tip above the model floor; crypt/basement-to-cross datum remains unresolved. Other heights and all internal partitions are picture estimates: main wall34m/shallow copper roof40m; portico columns1..30.5m, entablature34m/pediment43m; side links34m with open ground arches; tower base34m, octagonal belfry35..49m, green cap55m/tip58m; drum42..63m/cornice66m, green dome84m/orb86m/cross90m. Drum radius/center follows mapped component, with estimated24 exterior columns and recessed rectangular bays. Lower side paired arched fields, high lunettes, rear parapet/roof surfaces, pilasters and decoration are simplified. No survey/engineering accuracy claimed.
- Standard viewer DEM datum156.867491m; estimated floor0.8m, raw whole perimeter-13.18..0.22m. Footings crossY=0 and extend below retained coarse terrain. Local eastern steps descend toward coarse front samples. Exact hilltop retaining-wall/ground contacts, street/door joins, absolute altitude, height datum and walking remain unverified. No preview flattening, host DEM alteration or road replacement.
- Medium-fi exterior from three inspected2012/2013/undated older aerial/front pictures plus standard viewer PMTiles/DEM. Existing dimensions/map height retained; crypt/floor datum and exact measured scopes unverified. Other heights/internal partitions,hidden rear roof and current finishes are approximate. Fine Corinthian sculpture,reliefs,inscriptions,interiors and surveyed thresholds excluded or simplified. Nearby castle/seminary/retaining walls are separate objects. Physical phone/laptop timings pending.
- Skyline keeps eight-column portico,open lateral arches,central drum/green dome and paired smaller domes;small glazing/colonnade omitted. District adds shared surfaces,24 simplified drum columns/flat fields and simple cornices. Street adds actual recessed fields and dome ribs/pilasters/balustrades;closeup/master refine columns/opening frames and ribs. Synthetic cottages are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
