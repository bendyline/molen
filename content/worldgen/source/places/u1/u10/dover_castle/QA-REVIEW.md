# Dover Castle — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final rendered views inspected.**

Inspected all 11 final portable views after the keep-crown correction. The square banded Great Tower, four raised corner crowns, forebuilding, concentric ward, church/pharos group and selected barracks match the inspected picture at medium-fi scale. The runtime contains architecture; standard PMTiles supplies the surrounding hill.

Inspected all 11 final shared-material views. Five common stone/brick/slate/paving graphs and one explicit recess slot are bound correctly. Map placement retains true east/south orientation inside the cached site boundary. Material-cache reuse and unload checks passed. The shared fixture uses flat ground for materials and orientation; it does not establish hillside fit.

Inspected all 27 final medium-fi views on retained PMTiles ground: noon/late lighting, high/economy quality, silhouette, six feature views and four matched tier views. Keep/church floors and outer defenses fit the coarse hill without a second embedded terrain patch; site structure and crown remain readable through LOD transitions.

## Placement and runtime

Inspected aerial picture confirms the square Great Tower, concentric mural towers, gatehouses, church/pharos group and later barracks. The retained east/south site frame and standard viewer PMTiles set approximate location, scale and orientation. The derivative omits the embedded hill, uses host PMTiles terrain, reconstructs level keep/church floors above coarse sampled ground and extends their bounded wall bottoms beneath it. Anchor 1.322679734,51.129258466; heading 0; standard PMTiles datum 110.20328505915221m. Floors are reconstructed and foundations extend below the coarse sampled ground.

skyline: 846 triangles, 83480 bytes, 1 draws; district: 2836 triangles, 226508 bytes, 6 draws; street: 4492 triangles, 367936 bytes, 6 draws; closeup: 4732 triangles, 386656 bytes, 6 draws. Initial skyline+district 309988 bytes, below3MB phone/6MB laptop limits. Separate POSITION/NORMAL streams; physical-device timings remain unmeasured.

## Checks and accepted limits

Six GLBs validated with zero errors, zero warnings and zero embedded images. Original detailed architectural recipe, hash and relative terrain remain preserved. Four tiers contain 846/2836/4492/4732 triangles; initial skyline+district download is 309988 bytes. Separate POSITION/NORMAL streams are retained.

Approximate current exterior and map fit from one inspected picture and standard viewer PMTiles. Internal plan, corner merlons, reconstructed keep/church floors and coarse wall footings are approximations. Earthworks, tunnels, interiors, ground cutouts and survey accuracy are outside this review; footprint replacement stays off. Physical-device timing remains unmeasured.

## Pictures and map

- [Inspected picture 1](https://www.english-heritage.org.uk/siteassets/home/learn/story-of-england/medieval/war/dover-castle-aerial.jpg?WebsiteVersion=20200219&anchor=NoFocus&h=612&mode=crop&quality=100&scale=both&w=1440) — actual pixels inspected; image not redistributed.
- Standard viewer Protomaps20261008/Mapzen Terrarium PMTiles; controls/hashes retained in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL, elevation attribution retained with the fit data.
