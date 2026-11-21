# Osun Grove road entrance gate

The photographs show the road entrance with two blue heritage emblems, one clear side opening and a small covered opening opposite. The inner festival gate has taller black panels and a peaked timber structure. [Entrant view](https://commons.wikimedia.org/wiki/File:Osun_Osogbo_Sacred_Groove_Entrance_Gate.jpg) · [Road view](https://commons.wikimedia.org/wiki/File:Main_Entrance_Gate_To_The_Osun_Osogbo_World_Heritage_Site.jpg) · [Grove inventory](https://whc.unesco.org/document/224879)

The source models the open vehicle passage, two side portals, sculpted lintel, animal crest, ornamental iron leaves and corrugated canopy. The four viewer levels use shared lime plaster and painted iron.

The viewing stack checks the incoming Protomaps road before moving the gate to its overhead position. A matching source segment uses a 30.1 m correction that retains the mapped junction and the road inside the grove. Other source geometries use the road-centered preview, 3.55 m northwest of the overhead position. The town-facing angle follows photographs in both cases. [Reference observations](reference-observations.json) · [Placement report](placement-report.json)

The packaged correction clears a 5.3 m band through the gate on the retained Protomaps tile. The fallback clears 5.1 m on the original mapped road. Both positions draw all four detail levels using the owning tile’s terrain. The curve under the tree canopy is interpolated. [Coordinates and checks](placement-report.json)

Rebuild the GLB with `node content/worldgen/source/places/s1/s17/osun_grove_road_gate/models/generate-road-gate.mjs`. Add `--check` to verify the exact output bytes.
