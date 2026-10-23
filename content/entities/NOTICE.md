# molen.entities notice

This pack (nature, aircraft, road vehicles, motorhomes, cycles, transit and watercraft) is Molen's
own work, licensed under the MIT License with the rest of the Molen repository.

Interior research photographs retain their individual licenses. The citation and attribution
ledger is [source/INTERIORS.md](source/INTERIORS.md), with machine-readable records in
`source/interior-references.json`. CC0/public-domain, CC BY and CC BY-SA references are identified
separately, including generation/trim caveats. They inform original polygon geometry; their
pixels are not included in model textures or the distributed pack. The repository's MIT
license does not relicense those photographs. Any later redistribution or adaptation of a
reference image must honor its own terms, including attribution and applicable ShareAlike.

Every model is generated from committed source inputs in `content/entities/source/`, using
local generators or shared authoring helpers in `packages/entities/scripts/`. No third-party
mesh, texture, bitmap, blueprint or CAD data is used. The preview images beside each source bundle
and the contact sheets in `content/entities/` are Molen's renders of these models.

## Real aircraft designations

Fifty-two models depict real aircraft types, including the original P-51D Mustang and OH-6.
The fifty additions and their reference credits are listed in
[source/AIRCRAFT-EXPANSION.md](source/AIRCRAFT-EXPANSION.md) and
`source/aircraft-references.json`. These are original polygonal interpretations; dimensions,
cockpit installations and flight tuning are approximate, not manufacturer CAD or flight-test
reconstructions. The Bendy Small Airliner remains a generic design. The additions carry descriptive
type lettering and original safety stencils, without manufacturer logos, military unit insignia,
external weapons or gun pods. Reference photographs keep their individual PD/CC licenses;
no reference image pixels are distributed in the GLBs.

## Real road vehicle and motorhome identities

106 road vehicles (the U.S., regional, 2005–2024 variety and MINI/Acura collections) and one
motorhome (the 2022 Winnebago View 24D, dimensioned from Winnebago's 2022 brochure) use
manufacturer, model and model-year names — and, for the road vehicles, a trim name — to identify
what each original polygonal interpretation depicts. The names live in asset IDs, labels and
documents only. Dimensions are rounded authoring envelopes, cabin and trim details are
simplified, and driving parameters are game tuning. These are not manufacturer CAD models or
certified reproductions.

**The geometry carries no manufacturer mark.** Where a badge would sit, the generators place a
plain chrome ring and disc. They emit no maker emblem, wordmark, model lettering, logo-shaped
grille signature, cab maker's star, coach name, livery or real registration; the only lettering on
a real-identity model is the fictional plate `MLN <yy>`. Builds from an `asset-lock.json` older
than 2026-10-21 predate this and carry earlier badge geometry that reproduced several makers'
emblems and wordmarks; rebuild from source or re-fetch the pack.

The generic vehicle collection (`compact`, `pickup`, `sedan`, `suv`, `van`, `box-truck`,
`electric-hatchback`, `offroad`, `sports-coupe`, `station-wagon`, `taxi`), the five other
motorhomes and every cycle, transit and watercraft model are original Bendy designs and carry
Molen's own `BENDY` house lettering.

## Statement

All product names, model names, aircraft designations and trade dress referred to here are the
property of their respective owners. Molen and Bendyline LLC are not affiliated with, endorsed by,
sponsored by or approved by any of them, and no such relationship is implied. The names are used
only to identify the real type a model is an interpretation of. The MIT License grants rights in
this pack's software and data only; it grants no right in any third party's trademark, service
mark, trade name or trade dress. A redistributor's use of these names is that redistributor's own:
a use that is descriptive here may not be descriptive in another product. Every vehicle and
aircraft type in this pack also carries a name-free `genericLabel` (`Full-size pickup`) and, for
wheeled vehicles, a generic `bodyStyle`, so a host can show the fleet without any real name.
