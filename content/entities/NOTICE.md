# molen.entities notice

This pack (nature, aircraft, road vehicles, motorhomes, cycles, transit, watercraft and rail) is Molen's
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

Fifty-three models depict real aircraft types, including the original P-51D Mustang and OH-6.
The fifty-one additions and their reference credits are listed in
[source/AIRCRAFT-EXPANSION.md](source/AIRCRAFT-EXPANSION.md) and
`source/aircraft-references.json`. These are original polygonal interpretations; dimensions,
cockpit installations and flight tuning are approximate, not manufacturer CAD or flight-test
reconstructions. The Bendy Small Airliner remains a generic design. The model geometry carries
only operator-neutral lettering and original safety stencils, without manufacturer logos,
external weapons or gun pods. Reference photographs keep their individual PD/CC licenses;
no reference image pixels are distributed in the GLBs.

## Aircraft liveries

Every aircraft type's `livery` component offers three to eight schemes, each modeled on a real
operator's paint and linked to the photographs it was studied from. Military and government
liveries show real national insignia, service titles, tail codes, serials and unit tail art,
redrawn as original vector artwork (no traced or copied image pixels, no trademarked characters
or mascots, and no claim to be an official replica). Civil liveries (airlines, charter, police,
air ambulance, corporate) reproduce only the operator's colors, cheatlines and tail pattern. They
carry no operator name, logo, emblem or wordmark, and use fictional registrations in the national
format. No livery carries a manufacturer's logo. Lettering is outlined from Overpass, Overpass
Mono and Jost (SIL OFL 1.1; the license texts are in the Molen repository's
`content/entities/fonts/` and `content/earth/fonts/`). A paint scheme can be an operator's trade dress: these
schemes identify a period or operator for simulation only, and a host can replace a type's
`livery` component with its own.

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

## Real rail rolling-stock identities

Three locomotives (GE ES44AC, EMD GP38-2, MPI MP36PH-3C) and two passenger cars (Bombardier
BiLevel coach and cab car) use manufacturer and model names to identify what each original
polygonal interpretation depicts; the seven freight cars use generic class names (boxcar,
covered hopper, DOT-117 tank car and so on). The names live in asset IDs, labels and documents
only; the catalog is [RAIL.md](RAIL.md). Dimensions are rounded authoring targets and running
data is game tuning. **The geometry carries no railroad or manufacturer mark:** no logos,
heralds, wordmarks, builder's plates, real reporting marks or real liveries. Liveries are
generic two-tone and commuter schemes; the only lettering is the fictional reporting mark `MLN`
(locomotives) or `MLNX` (cars) with plain numbers, unbranded containers and lumber wrap, and
generic stencils such as the DOT-117 class marking.

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
