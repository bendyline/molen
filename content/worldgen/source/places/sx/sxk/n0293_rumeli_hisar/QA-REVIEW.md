# Rumeli Hisarı — reviewed medium-fi exterior

Reviewed2026-10-12. **52 final rendered views inspected.**

Inspected all 12 final portable views. Three stepped roofless towers, twelve-sided seaward lower body, crenellated sloping curtains, smaller bastions, sea gate, open court and mapped mosque remain readable. The inspected exterior tower picture supports the crown/masonry treatment; the second picture informs stone/brick appearance only and its interior is excluded.

Inspected all 12 final shared-material views. Common rubble, brick, gravel and tile graphs are reused with an explicit color slot. Roofless crowns, circular upper bodies, real gate opening and tiled mosque roof read correctly. Retained east/south map outline and Bosphorus-facing forecourt fit approximately. Material-cache reuse and unload checks passed.

Inspected all 28 final medium-fi views: noon/late light, high/economy quality, silhouette, seven identity views and all four matched tiers. Towers, enclosure, sea gate and open hillside court remain consistent. All wall/tower footings use one PMTiles sampler across LODs and the broad duplicate terrain patch is omitted; host terrain supplies the hillside.

## Placement and runtime

Inspected exterior tower picture confirms stepped roofless masonry crowns by the Bosphorus; the second picture informs stone/brick appearance only, with its interior excluded. Retained east/south wall, tower and courtyard geometry and standard viewer PMTiles set approximate location, scale and seaward orientation. The derivative omits the duplicated terrain patch, uses the same PMTiles sampler for all wall/tower-footing LODs and translates the old study datum to the21.351156683452786m PMTiles anchor datum. Tower floor pads retain a level rim above sampled coarse ground with bounded footings reaching it. Anchor 29.056189597,41.084874691; heading 0; standard PMTiles datum 21.351156683452786m. Floors are reconstructed and foundations extend below the coarse sampled ground.

skyline: 1000 triangles, 97468 bytes, 1 draws; district: 3747 triangles, 316804 bytes, 3 draws; street: 11733 triangles, 1026584 bytes, 4 draws; closeup: 15360 triangles, 1339564 bytes, 4 draws. Initial skyline+district 414272 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validated with zero errors, zero warnings and zero embedded images. Original detailed master/hash/recipe preserved. Four tiers contain 1000/3747/11733/15360 triangles and initial skyline+district downloads total 414272 bytes. Separate POSITION/NORMAL streams retained.

Approximate exterior and map fit from inspected pictures and standard viewer PMTiles. The old study datum is translated to the21.351156683452786m PMTiles anchor datum. Roofless towers, estimated forecourt and mosque remain exterior interpretations; restoration/visitor fixtures are not exhaustively reconstructed. No bespoke survey, exact thresholds, interiors, vegetation, waterline/simulation or terrain cutouts. Footprint replacement remains off; physical-device timing unmeasured.

## Pictures and map

- [Inspected picture 1](https://www.turkishmuseums.com/Uploads/M%C3%BCze/Foto/Foto%C4%9Fraflar/35c0ee5a-ca31-4568-afc7-8721028ae56a.jpg) — actual pixels inspected; image not redistributed.
- [Inspected picture 2](https://www.turkishmuseums.com/Uploads/M%C3%BCze/Foto/Foto%C4%9Fraflar/4cd7cb2b-1c19-4c0b-9dae-4ab7189af351.jpg) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
