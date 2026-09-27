# Stone Bridge in Skopje — N0004

Status: **research blocked; no 3D model produced**. Target: maximum fidelity.

[research.json](research.json) records the published dimensions, dated photo observations, source URLs, conflicts, mapped outline and review requirements. The original catalog identity Q1780883 is retained. No model, preview, runtime registration or placement is claimed.

## Established evidence

The national tourism publication gives a historical length of 213.85 m and deck width of 6.33 m. Field studies describe unequal openings and altered or buried ends. The 2023 paper documents a level central deck, descending approaches and asymmetric restored piers; its 2016 photographs were visually inspected. These sources do not provide a complete current measured elevation.

The exact-identity OSM outline has a fitted length of 218.92 m and total projected width of 23.76 m. **That width includes cutwaters and is not the deck width.** Local +X points northeast and +Z southeast. No vertical datum is established. OSM-derived coordinates are © OpenStreetMap contributors, ODbL 1.0.

## Required before modeling

- **current-opening-inventory:** Dated complete elevation identifying every visible, buried and filled opening.
- **arch-stations-and-profiles:** Individual opening endpoints, spring levels, crown levels and intrados profiles in a measured local frame.
- **vertical-profile-and-datum:** Deck break stations, deck levels, foundations, river level reference and vertical datum.
- **pier-and-cutwater-survey:** Both elevations and plans of each pier, including restored flat and pyramidal caps.
- **niche-parapet-and-masonry-detail:** Scaled mihrab, balcony, parapet sections, arch rings and masonry courses with dated close views.
- **current-shore-fit:** Both current abutments, bank heights and pedestrian approach connections fitted to the host map/terrain.

Do not construct thirteen equally spaced semicircles or apply the footprint width to the deck. The historical and current counts describe different extents and must be reconciled. Proposed QA camera coordinates in the JSON are authoring suggestions, not surveyed levels or completed captures.

## Sources and reproducibility

- [tourism](https://macedonia-timeless.com/eng/about/about/did-you-know/stone-bridge) — Original-form dimensions and construction description; not a current survey.
- [ibrahimgil-2012](https://dergipark.org.tr/en/download/article-file/288477) — Text inspected; dimensions on printed page 48 and field visit on page 49.
- [ozbey-2023](https://dergipark.org.tr/tr/download/article-file/3321195) — Text and rendered printed pages 306, 307, 310, 311 inspected. Figures 2–3 are the author’s 2016 photographs.
- [haemus](https://haemus.org.mk/stone-bridge/) — Construction description and bibliography inspected.
- [ukim](https://ceipa.pmf.ukim.mk/en/node/126) — Historical reconstruction description; counts piers rather than arches.
- [wojtowicz-2013](https://commons.wikimedia.org/wiki/File:Skopje_-_Kamen_Most_(9454032526).jpg) — 1280 × 851 reference photograph visually inspected; not included in the asset pack.

Source publications and photographs are consulted, not redistributed. The editable research contract is `packages/worldgen/scripts/stone-bridge-skopje-model.mjs`; rebuild this brief with `node packages/worldgen/scripts/generate-stone-bridge-skopje.mjs`, or verify with `--check`. The generator uses the cached OSM feature and pins its SHA-256. It refuses to write if a model master already exists.

A future mesh generator must protect artist-edited source bytes, reuse Molen's mesh/GLB pipeline, record its dimensions and limitations, and pass source/runtime hash-bound visual, maximum-fidelity and geographic reviews before runtime activation.
