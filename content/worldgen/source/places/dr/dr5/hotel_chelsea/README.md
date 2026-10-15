# Hotel Chelsea

Restored red-brick West 23rd Street exterior with eight varied iron balcony tiers, three projecting sections, pointed end gables, four dormers, four massive chimneys and tall central roof.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [Hotel Chelsea: Where Art Checked In and Never Left](https://qualla.com/hotel-chelsea/)

Original medium-fi exterior from individually inspected Qualla 2025 and 2010 facade photographs, 2011 ironwork detail and the official NYC landmark report. Not a survey or photogrammetric reconstruction.

Mapped height 52.5 m provides a coarse upper roof control. Intermediate levels, roof slopes, rear/service openings and exact balcony panel spacing remain photographic approximations.

2025 restored finishes take precedence over older white windows, air conditioners and shop signage. Flower-and-leaf ironwork is original simplified geometry; no photo pixels are embedded.

The hotel parcel only; adjacent buildings, interiors and precise rooftop spa/garden fit-out are excluded. Hidden roof service enclosure and side/rear openings are conservative interpretations.

Independent terrain is preserved unchanged, with foundation below the central sidewalk datum. Exact contact with another host DEM remains uncertain.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=hotel_chelsea`. Add `--check` to verify exact regeneration. 43677 triangles; 5 materials; no embedded photographs.
