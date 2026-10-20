# N0502 — Akshardham

Reviewed2026-10-19. Accepted for the specific medium-fi Delhi mandir and approximate full-site PMTiles/DEM fit.

![Current modeled mandir](preview.png)

## Exterior and shared materials

Inspected all10 portable views. The specific Delhi mandir retains nine stepped lobed domes, gilt finials and a central flag, twenty quadrangular roof spires, four open pillared porches, the broad southwest stair, waterside platform, a narrow approach bridge,148 simplified elephant figures and two mapped forecourt pavilions with open central passages and three chhatris each. The first preview prompted adding the missing main stairs, masonry bands and selected pilasters under the domes. Facade niches and sculpture are original simplified geometry; individual carved narratives and the complete interior are not reproduced.

Inspected all10 shared-material views. Two common256-square material graphs provide sandstone and tinted metal, with four role slots, metric UVs and linear palette tints. No embedded images, unique atlas or copied photograph. Each shared graph is read once; eviction frees model geometry. Four near draws and one skyline draw. The common sandstone tint stands in for the lighter dome stone; exact stone varieties are approximate. Flat-stage views expose some buried foundation depth; actual terrain contact was checked separately on the unchanged standard DEM.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 944 | 100876 | 1 |
| district | 3989 | 405832 | 4 |
| street | 15757 | 1554860 | 4 |
| closeup | 48097 | 4576756 | 4 |

Inspected all26 medium-fi views: street/block/skyline at noon and late afternoon in Economy/High, untextured silhouette, five architectural details, all four complete-model levels and transitions. Levels944/3989/15757/48097 triangles retain the main dome cluster, mapped platform, approach and two forecourt buildings. Skyline replaces open porches with a solid silhouette and simplifies spires; district restores open bays and roof drums; street adds selected wall details, stone bands and30 representative elephant figures; closeup retains all148 simplified figures and selected pilasters. Initial skyline+district geometry506708bytes, plus two reused material graphs. Separate attribute streams avoid duplicate GPU uploads. Physical-device and dense-city performance remain pending.

## Geographic fit

Reviewed approximate full-site fit on the unchanged161-square/6m standard DEM. Three original map footprints retain54 control vertices. The mapped approach, flanking forecourt buildings and ordinary pictures establish the signed southwest front; native +X east/+Z south and heading0 retain geographic coordinates, while architecture uses its explicit59.688826-degree local rotation. The main waterside platform follows the mapped inner shore; the narrow approach bridge leaves native water intact below it. Principal grade follows the southwest approach sample plus0.85m, with independent local grades for the two forecourt pavilions. Three bounded occupied floors open terrain, with opaque tops, retaining sides below the lowest boundary grade and inward joins to the coarse bank. Full-site loading replaces3 authored records and preserves52 independent tile buildings exactly; all64 independent records in the retained extract remain outside the replacement envelope. Two native water features retain14519.038420645898 square metres. Failure preserves55 native tile buildings and ground; eviction frees geometry. The2cm building-only margin removes numerical footprint slivers while original control vertices and ground openings remain unchanged. Synthetic64m partial residency clips outer architecture and shows the known pale sky seam at the temporary terrain/model boundary: partial contact and architectural completeness remain pending, not passed. Exact historic thresholds, ornate profiles and the coarse DEM grade are approximate.

## Scope and limitations

Accepted for the specific medium-fi principal Akshardham Delhi mandir, mapped waterside platform, narrow approach and two flanking forecourt pavilions, with approximate standard-map/DEM placement. Three original mapped component footprints retain54 vertices. Ordinary photographs, mapped approach geometry and two flanking pavilions establish the signed southwest front. The local architectural rotation is59.688826degrees inside an east/south geographic frame at heading0. The main mandir map outline is about64×73m; the surrounding platform/approach is about96×109m, so the published overall dimensions do not rescale the roof to the entire platform. The ordinary official description reports nine domes, twenty quadrangular spires,141.3ft height and148 elephant figures. Dome placement and profiles, individual spires, pedestal tiers, pavilion envelopes, floor heights and repeated sculpture poses are photo/map-guided estimates. Shared sandstone approximates lighter upper stone; tinted shared metal approximates gilt. Native water and independent campus buildings remain intact. Exhibition halls, theatre, distant gardens, interior murtis,234 literal interior/exterior pillars and the complete carved inventory are outside scope. The synthetic64m partial-tile test exposes the known pale sky seam and clipped architecture: temporary-boundary contact/completeness remain pending. Full-site approximate placement passes; exact surveyed thresholds and profiles are not claimed. No bespoke survey or archive research was used.

## Source and checks

Two registered recipes and retained map, terrain and reference inputs rebuild the master and four browser levels. Master48097triangles/5774656bytes. Six Khronos validations have zero errors/warnings. All212 shape/opening probes,54 original map vertices and676 floor samples pass. Inspected46 official and23 site/failure/partial views. Bulk captures stay local.

The960m integration tile has55 buildings: three authored components are replaced and52 independent records remain byte-identical. All64 independent buildings from the retained local extract remain outside the replacement envelope. Two native water features retain14519.038420645898m². Raw map properties and161-square/6m DEM remain unchanged. Failed loads preserve native procedural buildings; eviction restores ground and releases geometry. Partial-boundary limitations remain explicit.

Selected source/import/placement/LOD checks, strict medium-fi audit, asset hash inspection, scene validate and sim30 pass. The asset lock and full source rebuild will refresh at a meaningful batch milestone. No dependency audit, Git mutation or upload was performed.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0502; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0502; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0502.

Source: sha256:2d16600483e96654d178dcd741bad1fb11d5b036e7931a5f8081b262808e94cf

Runtime: sha256:8471ceda3fa3c599cac8e7605f6a70e4b189232651d900b0b27498a5756e61c0

Input: sha256:86403027950bc64156fd4e2e71dc0c011fc5622685c599ee74f255bc2372d437

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:New_Delhi_Temple.jpg — Swaminarayan Sanstha; CC BY-SA3.0, as displayed on Commons; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Akshardham_Delhi_Ricky_W.jpg — Ricky W. / Riction; CC BY-SA3.0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Akshardham_construction.jpg — Juthani1; CC BY-SA3.0; viewed only. No pixels shipped.
