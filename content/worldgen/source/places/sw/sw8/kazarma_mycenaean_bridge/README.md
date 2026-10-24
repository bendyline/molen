# Kazarma Mycenaean Bridge

![Molen preview](preview.png)

Surviving Cyclopean corbel bridge, reconstructed as individual irregular limestone boulders, projecting horizontal tunnel courses and closing stone, battered retaining wings, small dry-joint packing stones and an uneven gravel road surface.

## Evidence

- [Primary reference](https://www.argolisculture.gr/el/lista-mnimeion/mykinaiki-gefyra-kazarmas/)
- [Primary reference](https://odysseus.culture.gr/h/2/gh251.jsp?obj_id=1710)
- [Primary reference](https://pergamos.lib.uoa.gr/uoa/dl/object/3417312/file.pdf)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Arkadiko_bridge,_mycenaean,_Late_Heladic_age,_202418.jpg)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Arkadiko_bridge,_mycenaean,_Late_Heladic_age,_202420.jpg)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Kazarma_bridge_9267.jpg)
- [Primary reference](https://www.openstreetmap.org/way/306121794)

Published dimensions and reconstruction assumptions are separated in spec.json. Source photos were consulted; no photos or third-party geometry are embedded. Map plan attribution: © OpenStreetMap contributors, ODbL-1.0.

## Source

97266 triangles; 11614512 bytes; 2 material groups. SHA256: sha256:a128c2ada15a1b85cbfa1e66ddc4fc6a8a04c50b73168e8baf6b879689359fc2.

Shared surfaces (gravel, stone_limestone_weathered) are loaded through the central library; any transparent materials use local PBR parameters. Axis and provisional vertical datum are in spec.json.

Regenerate with node packages/worldgen/scripts/generate-researched-bridges.mjs --ids=kazarma_mycenaean_bridge; append --check to verify. Import and capture through the standard structure-catalog scripts. Geometry validation does not substitute for current-frame visual review.

## Reconstruction limits

- Original detailed exterior; individual boulder shapes, hidden tunnel joints and full retaining-wing extent are interpreted from photographs and published overall dimensions.
- No modern safety parapet, regular Roman voussoirs, embedded source photograph or surrounding landscape is invented.
- Retaining-wing road height and gully shoulders are photo-scaled relative reconstructions. Conflicting coarse DEM samples cannot resolve this narrow opening; no surveyed streambed, absolute elevation or measured public DTM is claimed.
- Source-local terrain is an explicitly reconstructed dry-gully context, with the runtime tunnel opening rasterized into it. The host independently supplies real terrain; relative off-center bank contact avoids anchoring the bridge to a smoothed mid-gully sample.
- The97254triangle/11613072byte original master remains byte-reproducible, hashf84ee3da46d21a01e511b4268160a6f0b7b1e0c5d63b7e7968d00ce6464a8100. The current detailed derivative corrects hidden core face winding and closes crown bedding. Separate browser models retain major photo-scaled Cyclopean boulders/corbels while replacing tiny gravel and buried back-face stones with two shared256-square materials.
- The opposite facade and stone depths remain interpreted. No current stream flow, vegetation, modern road, precise hidden foundations or walkable navigation certification is claimed. Physical-device timings remain pending.
