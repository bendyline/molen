# Pont de l'Archeveche

![Molen preview](preview.png)

Three shallow circular limestone vaults with radial ashlar and stone soffits, tapered rounded cutwaters and mooring rings, coursed flared mainland approach, crowned cobbled deck and stone curbs, post-2016 glazed crossed-iron parapets, mapped ornamental lanterns and direction-specific river signs.

## Evidence

- [Primary reference](https://books.google.com/books?id=fnI5AAAAcAAJ&pg=PA174)
- [Primary reference](https://books.google.com/books?id=fnI5AAAAcAAJ&pg=PA175)
- [Primary reference](https://www.afgc.asso.fr/history-heritage/pont-de-larcheveche-a-paris/)
- [Primary reference](https://www.paris.fr/pages/a-la-decouverte-des-ponts-parisiens-les-plus-romantiques-18806)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Pont_Archev%C3%AAch%C3%A9_-_Paris_IV_(FR75)_-_2021-06-05_-_1.jpg)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Pont_de_l%27Archev%C3%AAch%C3%A9,_Paris_June_2019.jpg)
- [Primary reference](https://www.openstreetmap.org/way/78329745)

Published dimensions and reconstruction assumptions are separated in spec.json. Source photos were consulted; no photos or third-party geometry are embedded. Map plan attribution: © OpenStreetMap contributors, ODbL-1.0.

## Source

432736 triangles; 36496176 bytes; 6 material groups. SHA256: sha256:1f9964ba99a151ce709af9b30662190c0adac758190d8231fdc8c7ba7ca785d5.

Shared surfaces (stone_limestone_raw, metal_painted, stone_granite) are loaded through the central library; any transparent materials use local PBR parameters. Axis and provisional vertical datum are in spec.json.

Regenerate with node packages/worldgen/scripts/generate-researched-bridges.mjs --ids=pont_de_l_archeveche; append --check to verify. Import and capture through the standard structure-catalog scripts. Geometry validation does not substitute for current-frame visual review.

## Reconstruction limits

- Current permanent bridge geometry; temporary street works and movable furnishings are omitted.
- Arch ring thickness, coursing and lantern member dimensions are original photo reconstruction, not a scan.
- The declared NGF-IGN69 origin and bank joins use independent IGN terrain and road evidence. Submerged foundation depth remains reconstructed; water elevation is not bathymetry.
- The separate public clock and island streetlight stand beyond this model footprint and are not duplicated within it.
- Original detailed master is preserved. Browser tiers aggregate individual coursing/fan paving,transparent fasteners,lantern profiles and navigation signs; shared granite grain approximates small cobbles. Ground placement retains its existing NGF-IGN69 host-datum requirement. No new bespoke terrain research or device timing claim.
