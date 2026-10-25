# Watergate public-domain imagery revalidation — 2026-10-17

The two selected public-domain aerials and the public-domain labeled plan were inspected from Qualla's published local originals. Exact hashes, positive rights bases and exclusions are in [imagery-evidence.json](imagery-evidence.json). No photograph is a runtime texture.

A real distant-outline error was repaired: simplification now compares replacement chords with the original polygon arc, preventing accumulated drift. The source, runtime and four detail outputs were regenerated. All 33 current renders were inspected; all 19 medium-fi frames identify the actual current runtime/detail bytes. Geometry budgets are 1000 / 3656 / 14546 / 49972 triangles and 1 / 2 / 3 / 3 draws. All 1631 mapped solid/void probes pass at each level.

The scene, terrain, frame coordinates, cameras, dry reference and footing depths remain unchanged. Source/runtime integrity, four schemas, six pack members, strict detail/material checks and repeated 30-tick states pass. This is a targeted repair and revalidation, not a new full-batch source build.

Mapped footprints and coarse host terrain are generalized. Fine balcony spacing, roof equipment and lower courtyard details remain medium-fi estimates; pools, landscaping and interiors are omitted. Footprint suppression remains off.

Current input: `sha256:725c9f2bde1ad77474eeb57ed1f6cba9f545b1b5eac4b8c081ad813ff2398c54`. Current source: `sha256:b4041278a8a87c27d3f428f51d4f10f662541794d114992764095734f7aa262e`. Current runtime: `sha256:37e04eb05a902c5e4eb4fcc3dcf7f1884979245aab61c8833914c8fced6adf2c`.
