# moschea_di_roma — Moschea di Roma

Reviewed 2026-10-18 for its declared medium-fi exterior and approximate geographic fit. Heights, internal layout and roof partitions are estimates.

![Molen preview](preview.png)

## Exterior and shared materials

Inspected 11 current portable renders including the retained 1024×640 summary. The folded envelope, low open canopy ranges, branching supports, estimated open atrium and geometric paving, tan brick hall with pale bands and narrow opaque windows, shallow ribbed main dome, surrounding roof vaults and single minaret with two open ring galleries and slotted hood are present. Fine roof coffering, screen perforations, inscriptions, furnishings and landscaping are omitted.

Inspected 11 current shared-material/geographic-flat views including the placement overlay. Five existing 256² graphs provide brick, raw/coursed limestone, standing-seam metal and painted metal; six merged roles include local opaque glazing. Metric UVs and linear tints; no embedded images or unique atlas. Graphs are read once and model geometry is disposed on eviction. The exact retained footprint owns the paving slab and replacement mask; all 24 nearby buildings remain separate. The flat overlay checks pose and replacement, while standard DEM data supplies approximate contact.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 1000 | 104168 | 1 |
| district | 2936 | 270648 | 6 |
| street | 8002 | 721808 | 6 |
| closeup | 13240 | 1222548 | 6 |

**374,816 bytes for initial skyline plus district**, plus five existing shared 256² graphs. Six merged roles; no embedded images.

Inspected 27 current medium-fi views: Economy/High, noon/late light, street/block/skyline, silhouette, six details, four matched LODs and four transitions. Folded wings, hall, shallow dome group and two-gallery tower remain visible through the levels. Skyline retains 20 coarse branching supports, simple roof vaults, open galleries and the atrium; its 0.25 m canopy underside/fascia is omitted and supports meet the top plane. District restores canopy thickness, 30 supports, opaque windows and coarse paving. Street restores all 59 supports, raised dome ribs and pilasters; closeup restores more branch, dome and vault segments and finer geometric paving. Whole views retain the structure; detail cameras may crop the minaret tip. Context houses are synthetic. Physical-device/full-city timings remain pending.

## Placement and limits

Retained Q1789776 /way30312316 identity,anchor,undirected axis and 24-vertex outer envelope remain unchanged. Current two-fragment main building has 28 vertices and closely matches that envelope;named mosque POI35184396038432 lies within the complex but has a separate id. Positive Z is assigned to the projecting prayer hall;the long folded negative-Z ranges become a low colonnaded canopy. The central open atrium is an architectural estimate absent from the retained no-hole map outline. Roof partitions,column grid,facing and dome/minaret positions are picture/map-guided estimates. Nearby buildings remain host content. Standard Protomaps20261014 /Mapzen-USGS viewer extractN0477;datum 27.654888910252524 m. 808 footprint samples span -3.9580224838881257 to 1.9617079918508615 m. Floor -2.0030297495745017 m is the median of 210 edge samples plus0.25 m. Footings follow standard DEM grade;the exact retained envelope owns a paving slab beneath hall,colonnades and estimated atrium. Exact stairs,retaining levels,thresholds,planting and grade joins are unverified. Independently reproduced the unchanged 24-vertex retained outline, current two-fragment 28-vertex main polygon and separate named mosque point. The positive-Z hall uses four retained outline vertices. The canopy is the exact outer envelope minus the hall and explicitly estimated atrium. The 59-column grid reproduces. All 150 footprint checks and 1,095 FrontSide probes pass: column stems, opaque wall fields, roof/underside coverage, open paved atrium, both tower ring galleries, slotted hood, tower/dome finials and seated foundations. Standard DEM reproduces 808 footprint, 210 perimeter and 624 seated preview samples and the 16-bit terrain image.

Individual Mosque of Rome: retained folded complex envelope,warm brick hall with pale horizontal bands,a shallow ribbed central roof dome and low surrounding roof vaults,open branching concrete colonnades,estimated atrium and geometric paving,one slender minaret with two open ring galleries and slotted pointed hood. Roofs,branching support rhythm and materials follow two inspected pictures. Detached buildings,landscaping,furnished interiors,inscriptions and engineering detail are excluded. No retained dimensional facts or current selected-building height tags exist. Estimated heights above the local floor: colonnade canopy6.6 m,hall15 m,shallow main dome20.1 m plus0.9 m finial,minaret42 m including tip. Small roof vaults rise1.65 m;branching columns,two open minaret galleries and its slotted hood are approximations. The selected photographs do not establish current complete condition. The retained record establishes exact identity, an exterior envelope and an undirected axis. Facade direction, roof partitions, atrium, canopy layout, support grid, dome/tower positions, bay counts, internal levels and all heights are estimates. The named mosque point has a different map id from the main building and does not identify an individual roof part. The 2010 exterior and undated colonnade picture establish visual vocabulary only; complete current condition is unverified. Exact retaining levels, stair/threshold joins, small daylight slots, coffering, screen detail, roof construction, interiors and engineering are unverified or omitted.

## Verification

49 current views inspected; 1,095 FrontSide probes; 150 footprint checks; six zero-error/zero-warning Khronos validations. Model/source/input/material/capture/placement hashes agree. Raw map controls, canopy/grid and 16-bit terrain fixture reproduce. Source/placement checks, scene validate/sim30, selected LOD layout and Biome pass. Bulk captures stay ignored.

Source: sha256:259ae11d1c94bfe0bcc243624e4b0abffba679b06f9faf223760da70ab5202c3

Runtime: sha256:fb0809d8a57b27b9cdb062fc74bd0b38ce69b2b188e68844af76db495cdb8a7f

Input: sha256:2e3b6896127c59af1d3f775cd26f7b8d8e17fd11cdf8259eebd7f86de3a1346e

Commands: targeted generate-additional-landmarks/import-structure-models/generate-landmark-lods/register-landmark-previews --ids=moschea_di_roma; source/placement --check; capture-structure-models --reflections --antialias --fit-shadows; capture-landmark-library --reflections --adaptive-clipping --bounded-placement; capture-medium-fi --ids=moschea_di_roma --reflections; scene validate/sim30; selected LOD layout; Biome. Existing builds reused.

## Inspected picture references

[LPLT — 2010-08-23](https://commons.wikimedia.org/wiki/File:Grande_Mosqu%C3%A9e_de_Rome.JPG). CC-BY-SA-3.0. Inspected exterior full view: warm tan brick hall,pale horizontal bands and narrow framed lower windows,shallow grey ribbed main dome,small surrounding roof vaults,one pale slender minaret with two open ring galleries and slotted pointed hood. Fence,trees,vehicles and inscriptions are not modeled.

[Lalupa — Capture and upload date unverified](https://commons.wikimedia.org/wiki/File:Moschea_-_cortile_00556.JPG). Public domain. Inspected960×720 colonnade view: pale square stems split into curving branches supporting a coffered roof,open daylight slots,warm brick screens and broad pale/brown geometric paving. Fine screen perforations,fixtures,signs and artwork are omitted.
