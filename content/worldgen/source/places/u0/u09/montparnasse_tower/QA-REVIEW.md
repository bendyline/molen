# Montparnasse Tower — dated dark exterior

Reviewed 2026-10-09 to medium-fi. Inspected **43 images**: 10 portable, 10 shared
material/placement and 23 browser light, silhouette, distance and LOD views.

## Evidence and represented date

The [operator](https://www.tourmontparnasse56.com/fr/la-tour-montparnasse-en-chiffres/)
lists 210 m, 59 floors and the observation level at 196 m. It also reports closure
for renovation on 31 March 2026. This asset deliberately represents the established
dark exterior before that work. Construction staging and the proposed future facade
are excluded. The [city's 2023 article](https://www.paris.fr/pages/la-tour-montparnasse-fete-ses-50-ans-24034)
and its 2020/2023 photographs informed the bowed facade, recessed ends and dark finish.
References are linked; photographs are not redistributed as textures.

The attributed map snapshot supplies way 16406633, Q323767, its raw coordinates and
signed native perimeter. The coordinate-to-native check matches the stored rounded
outline. The mapped envelope is 61.91 by 39.158 m; narrow facade frames extend it
to 61.95 by 39.20 m. Retaining the asymmetric small recesses preserves its signed
orientation: +X 39.525 degrees NE and +Z 129.525 degrees SE.

## Source and browser models

The original **9424-triangle, 1028696-byte source master is unchanged**. Skyline uses
the full mapped perimeter and the observation/parapet envelope. District coarsens
horizontal bands, railing posts and roof fittings while retaining every mapped facet,
recessed end, observation glazing, open terrace and service enclosure. Street and
closeup retain the master. The published 7200 windows are not an exact modeled count.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 636 | 53172 | 1 |
| District | 3988 | 309048 | 3 |
| Street | 9424 | 1028584 | 3 |
| Closeup | 9424 | 1028584 | 3 |

Initial download is **362220 bytes**. Skyline and district use a conservative 1.4 m
geometric reservation. Canonical painted-metal and granite graphs have metric UVs,
load once, and unload disposes model geometries. Dark glazing stays local opaque PBR.
There are no embedded bitmap images. All six GLBs have zero Khronos errors/warnings.

Three focused checks pass: raw signed perimeter, height and open district terrace,
and exact four-level reproduction with preserved original master hash. Selected
source reproduction, LOD and strict medium-fi checks also pass.

## Limits

Flat placement stage confirms the north-up map overlay, not plaza grading. Host terrain
supplies Y=0 contact. Fine mullions can alias at distance; district bands deliberately
have a coarser rhythm. Rooftop furniture, individual service hardware, interiors and
engineering survey are unrepresented. Collision is a convex exterior hull. Synthetic
neighbors provide scale context. Physical-device timing and full-scene memory remain
unmeasured. Old maximum-fidelity notes are retained as a separate historical record.
