# N0522 — Shrine of the Báb

Reviewed2026-10-19 in one continuous author/build/inspect/fix round.

![Shrine of the Báb](preview.png)

## Appearance

Inspected all current source, shared, medium-fi and native-site views in the same authoring round. Golden ribbed near-hemispherical dome and open finial, eighteen-window drum with pointed pale surrounds, octagonal stage with eight pinnacles, open covered arcade with round pale-pink shafts and simplified leaf capitals, opaque core, level apron and downhill steps are present. Closed core/roof/cornice and dome-base joints before the final captures. No missing section or terrain-through-floor defect observed.

## Shared materials and browser levels

Five reused256-square graphs: marble, granite, neutral polished metal with gold tint, painted metal for opaque blue infill, and ceramic for turquoise bands. Metric UVs and linear palette tints; zero embedded images or unique atlas. One graph read per fixture, at most five draws, separate GPU streams, geometry disposed on eviction. Flat library views expose buried bases; native-site renders establish approximate hillside contact.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 952 | 100316 | 1 |
| district | 3616 | 358700 | 5 |
| street | 15864 | 1632996 | 5 |
| closeup | 24264 | 2516164 | 5 |

Inspected24 noon/late, Economy/High, street/block/skyline, silhouette, detail, explicit-level and transition views. Levels952/3616/15864/24264 triangles; initial skyline-plus-district geometry459016bytes. Distant levels retain dome/drum/octagon/arcade silhouette; window surrounds, ribs and capitals resolve nearer. The diffuse skyline gold is brighter than the reflected metallic levels, an explicit low-detail material approximation. Physical phone/laptop and dense-city timings remain pending.

## Approximate map fit

Mapped shrine center and32.1by29.2m footprint retain native east/south coordinates at runtime heading0; the internal mapped axis follows0.503874710567rad. Approximate downhill approach points northeast/local-V. Standard retained native terrain and water are unchanged. One mapped shrine shell is replaced to below1e-7square-meter boundary residue; all554 independent in-tile buildings are unchanged. Failed loading restores all555 original records; eviction releases geometry. The coarse DEM does not resolve the actual garden terrace engineering; retaining exposure, stair rise, threshold level and signed doorway facing remain approximate.

## Limits

Accepted medium-fi exterior and approximate standard-map fit from ordinary photographs. Upper-stage dimensions,48-shaft/four-pier bay rhythm, carved profiles, painted/decorative panels and terrace levels are picture-led estimates, not a surveyed or certified historic inventory. No exact inscriptions, furnished/navigable sanctuary, garden/landscaping reconstruction or unique photographic textures. Preserve independent buildings and native terrain/water.

## Selected checks

Six Khronos files: zero errors/warnings.60 actual geometry/contact probes; 48 current inspected views. Scene validation/sim30 and strict selected medium-fi audit pass. Source and runtime hashes/material bindings/LOD caps verified.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0522; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0522; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0522 --force.

Source: sha256:58bd22b4516c5877f145b7ca873dab8b2b53f5940aa8fb370aa632ae4092adac

Runtime: sha256:dd4e8ef495c256d27af10c689e7d5f92ed547bbcbbc50bd2cc9ae9abde9dc5be

Input: sha256:db6a091c32bf71b1fe29c54a8357fc71c50e57c93708e56edcff26524dfaaefd

## Viewed ordinary pictures

https://commons.wikimedia.org/wiki/File:Shrine_of_The_Bab.jpg — Ray in Manila; CC BY2.0; viewed only. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Shrine_of_the_B%C3%A1b_and_Bah%C3%A1%27%C3%AD_Gardens_34.JPG — Eviatar Bach; CC BY-SA3.0; viewed only. Viewed only; no pixels copied.

https://news.bahai.org/story/1764/shrine-of-the-bab-recent-work-at-the-shrine-completed — Bahá’í World News Service; Rights retained by source; viewed only; no pixels copied. Viewed only; no pixels copied.
