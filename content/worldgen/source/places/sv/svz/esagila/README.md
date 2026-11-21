# Esagila

This model reconstructs the Marduk temple and its eastern entrance annex during Nebuchadnezzar II’s reign. The excavated perimeter, central courtyard and documented room divisions follow the published floor plan. The massing uses pale lime-plastered walls, projecting piers, flat roofs and fired-brick courtyard floors. [Excavation plan and reconstruction](https://www.zaphon.de/WebRoot/Store28/Shops/83179382/MediaGallery/Pedersen-Babylon-Zaphon-2021-100dpi.pdf)

Wall heights, roof construction, doorway elevations, the west sanctuary and the open divisions of the eastern annex include interpretation. The archaeological plan and the model keep the western sanctuary and annex divisions separate from the excavated controls. The distinct Etemenanki ziggurat belongs to its own site.

The published aerial photograph and Protomaps point identify the excavation pit on Tell Amran. The model uses an approximate bearing from the plan’s north arrow and a 29.85 m datum from the documented 29.8–29.9 m floors. A bounded terrain adjustment exposes the temple in the representative 575 BCE view and blends into the surrounding terrain. The undated view retains Tell Amran as it appears in the terrain provider. [Aerial and elevation evidence](https://www.cambridge.org/core/journals/iraq/article/tower-of-babylon-stele-found-in-babylon/A712F186B2FA1965854911081620467B) · [Dated placement and limitations](placement-report.json)

Use `viewingDate: '-000574-07-01'` in `mountEarthView`. The option selects a representative snapshot. The terrain adjustment uses the standard Protomaps profile and a sufficiently fine heightfield.

Rebuild with `node content/worldgen/source/places/sv/svz/esagila/models/generate-esagila.mjs`. The local recipe defines the detailed master and the four runtime levels. Six existing shared material graphs supply the architectural surfaces.
