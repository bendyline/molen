# Vehicle proportion review, 2026-11-06

The owner reported that the F-15C's nose was wrong and its cockpit oversized, and asked for another
realism pass on proportions. Measuring it, then the whole fleet at true scale, showed three things:

- Most road vehicles shared one sedan profile, whatever their badge.
- Seven aircraft still used the generic parametric body.
- Several fighters had the F-15's fault.

Every affected model had passed earlier review, because that review checked overall length, width
and height. Those three numbers say nothing about shape.

## What the audit found

Each class was rendered side-on, orthographic, at one scale per sheet, on one ground line. Reference
values come from published drawings, manufacturer planning documents and matched photographs.

| Class | Models | Result | Action |
| --- | --- | --- | --- |
| Road vehicles | 106 | Shared sedan profile: fastback SUVs, low-belted trucks, boxy ends | Generator and data pass |
| Airliners and business jets | 7 | Generic tube, needle nose, box engines | New dedicated builders |
| F-15C | 1 | Thin forebody under a correct canopy | Rebuilt from traced stations |
| F-14D, F/A-18C | 2 | Same class of error | Rebuilt |
| F-16B | 1 | Thin radome | Radome corrected |
| F-22A, F-35A, Typhoon, Rafale C, MiG-29A | 5 | Fit in side view | Left alone |
| Gripen C | 1 | Depth fits; forward fuselage 0.11 m low, wheelbase 0.2 m short | Left alone, gaps recorded |
| Helicopters, GA, utility, heritage, cargo, MV-22B, AV-8B, ATR 72 | 33 | Side views looked convincing, but this hid cockpit faults; see the second pass | Later corrected where reported |
| Bus, light rail, Bendy cycles | 8 | Dedicated or invented designs that read correctly | Left alone |
| Watercraft | 8 | Invented designs: funnels floating clear of the ship, vertical stems | Funnels seated, stem and transom raked |
| Generic Bendy road models | 11 | Invented filler: `suv` was a tall sedan, and `taxi` and `station-wagon` had narrow greenhouses | Second pass |
| RVs | 6 | Share the van cab, so the road pass reached them | Rebuilt; Class C cab redone in the second pass |

The C-5M and An-124 noses are blocky but correct in mass and placement. That is polygon styling, not
a proportion error.

## Road vehicles

> **Superseded on 2026-11-07.** This pass ran on a branch from 2026-10-25 and never saw `main`'s
> 2026-10-26 to 10-31 road-vehicle rebuild, which fixed the same shared-sedan-profile defect its
> own way. When the branch merged into `main`, the owner kept `main`'s road, RV, watercraft and
> generic Bendy generators and recipes. `main` already draws a ladder frame, seats funnels on their
> decks, and rakes stems and transoms. The rules below that still hold on `main`'s fleet are in
> `packages/entities/test/vehicle-proportions.test.mjs`. The tables in this section record the
> branch's work and are not the current models. The aircraft sections are current.

Published dimensions were already right. The errors were in the `form` block of each recipe and in
what the generator assumed about every body.

| Correction | Before | After |
| --- | --- | --- |
| RAV4 roof end, fraction of length aft of center | 0.25 | 0.415 |
| RAV4 rear glass base | 0.42 | 0.478 |
| F-150 belt line | 1.27 m | 1.44 m |
| F-150 hood leading edge | 1.25 m | 1.36 m |
| F-150 rocker | 0.19 m | 0.42 m |
| RAV4 rocker | 0.17 m | 0.25 m |

- **Two-box bodies** now carry the roof to the tail, per vehicle rather than per class. True
  fastbacks stay sloped: Model Y, I-PACE, Leaf and Veloster.
- **Pickups** take the cab back from the published bed length. The bed is a separate box with a
  level rail and a floor a fixed depth below it, and the bumper sits high on a tall nose.
- **Rear doors** on two-box bodies stop at the wheel arch instead of running to the tail, with a
  real rear pillar behind them.
- **Ride height** follows the class. Body-on-frame trucks show a ladder frame. Maverick, Strada,
  R1T and SSR set their own height and show none.
- **Nose and tail** are bent in a final side-profile pass, so grilles, lamps and bumpers stay on the
  surface. The crest of the bumper holds the overall length.

`packages/entities/test/vehicle-proportions.test.mjs` holds these rules. It caught two vehicles the
data pass had missed.

## F-15C

The canopy was nearly right. The forebody was too slim and shallow to carry it, which is why it
looked oversized.

| Landmark | Before | After | Reference |
| --- | --- | --- | --- |
| Canopy height to forebody depth | 0.63 | 0.41 | 0.43 |
| Forebody depth at the seat | 1.22 m | 1.50 m | 1.50 m |
| Radome base depth | 0.97 m | 1.19 m | 1.16 m |
| Inlet width at the lip | 1.00 m | 0.60 m | 0.60 m |
| Cowl rake | 0.80 m | 1.65 m | 1.65 m |
| Engine centerlines | ±1.03 m | ±0.70 m | ±0.70 m |

The SAC sheet is not one scale. Its 12.00 ft canopy bar gives 51.1 px/m against 46.98 px/m along the
body. A matched photograph confirmed the annotation. Its solved camera also showed that the airframe
sat 0.22 m too far aft of the gear and that the inlet cowl rests drooped on the ground, neither of
which the drawing shows. Full evidence is in
[reference-review.json](source/aircraft/f-15c/reference-review.json).

## Other aircraft

Each aircraft's `reference-review.json` records its references, calibration and limits.

**F-14D** was rebuilt from its SAC sheet: canopy to depth 0.65 to 0.42, half-breadth 0.69 to 0.77 m,
engines ±1.68 to ±1.40 m, and the missing spine added. **F/A-18C** was rebuilt from a NASA three-view
and a solved photograph. Its fault was the leading-edge extension, not the nose. The **F-16B** radome
half-breadth went from 0.16 to 0.27 m.

The seven transports have new builders on a shared `transport-kit.mjs`, with per-type tables.
Confidence is not even:

| Aircraft | Basis | Confidence |
| --- | --- | --- |
| 737-800 | Airport-planning drawing overlays | Highest |
| A320neo, E175 | Manufacturer tables | Good |
| A220-300 | Tables plus a photograph; the source figures have no line art | Moderate |
| G650ER, CJ4, Dash 8-400 | No dimensioned drawing; read from oblique photographs | Lowest |

## Second pass: cockpits and close-ups

The first pass judged side views at fleet scale. The owner then flew the aircraft and walked around
them, which exposed what a side view cannot show. A cockpit needs its own measurements: eye to panel,
eye to roof and walls, real instrument size, and what shows through the windscreen from outside.

| Model | Fault | Fix |
| --- | --- | --- |
| Bell 206B | Panel twice life size; eye 0.12 m below the roof | Dials 170 to 85 mm, panel 1.15 to 0.58 m, headroom 0.20 m, wrap-around windscreen, blunt nose |
| Bell 407 | Same panel fault; wedge nose, opaque windscreen sides | Panel 1.20 to 0.74 m, headroom 0.20 m, nose and glazing rebuilt. Height of 3.36 m is right for low skids |
| UH-1H | Panel scaled from a drawing with no absolute size | Rescaled from a 3.125 in dial: panel 1.76 to 1.05 m, glass gap 0.12 to 0.29 m |
| ATR 72-600 | Eye 0.16 m from roof, 0.21 m from wall; glareshield through the windscreen | Forebody and flight deck rebuilt: headroom 0.39 m, wall 0.51 m |
| C-130J | Flight deck 1.5 m too far aft, crown up to 0.7 m low, HUD read as a box on legs | Forebody retraced, deck moved forward, panel 2.12 to 1.456 m, real combiners |
| Bendy Small Airliner | Open hole in the nose, no windscreen, cone tip | Rebuilt on `transport-kit.mjs` with a real flight deck |
| OH-6A | Body too large, boom unjoined, wire-cage canopy | Rebuilt from Army TM stations: body 1.82 by 2.04 to 1.392 by 1.71 m, height 2.60 m per the TM |
| F-15C | Radome read as a needle | Depth matched the photograph, but traced noise left a concave pinch at a sharp tip; now a convex ogive |
| C172S, C182T, SR22T | Tires through the top of the wheel fairings by 1.5 to 3 cm | Cessna tires set to 6.00-6 and 5.00-5, fairings sized from the wheel, 2 to 5 cm clearance |
| 11 Bendy road models | Old bodies | Moved to the road-vehicle generator; the box truck has its own cab-over builder |
| Winnebago View, Bendy Class C | Low hood, black band at the windscreen, cap reaching the bumper, arrow bunk window | Tall hood, large lamps, rounded cap stopping behind the hood, framed bunk window |

Propellers also read as stopped at full power. A C182 at 2400 rpm turns exactly 240 degrees per 60 Hz
frame, two blade spacings of its three-blade propeller. The client now fades fast rotors into a
translucent disc and keeps the hub solid: `packages/client/src/rotor-blur.ts`.

The five binary vehicle masters are retired, so every vehicle GLB now comes from a generator.

## Third pass: cockpit sweep

The second pass fixed the cockpits the owner reported, and the same faults were likely elsewhere. So
every aircraft was measured from its seated eye and rendered at the view the pilot gets:
`packages/entities/scripts/cockpit-sweep.mjs` casts rays through each source GLB from
`spec.pilotEye`. Of 53 aircraft, 44 were flagged. The renders mattered as much as the numbers, because
no measurement caught a slab hanging in a windscreen or a panel floating in mid-air.

| Group | Models | Fault | Fix |
| --- | --- | --- | --- |
| Eye in the roof | Beech 18, SR22T, DA42, PC-6, Beaver, PC-12, Baron, Bonanza, H125, AV-8B | Headroom 0.03 to 0.17 m | Eye moved, or roof and seats refit: headroom 0.16 to 0.29 m |
| Seat not under the eye | DC-3, Twin Otter, Caravan, Beaver, PC-12, MV-22B, H145, CH-47F, UH-60M, all large transports | Cushion 1.0 to 2.1 m below the eye | Seats and decks raised: 0.73 to 0.86 m |
| Seat behind the pilot | F-15C, F-22A, F-35A, Gripen C, Rafale C, Typhoon, MiG-29A, F/A-18C | Seatback 0.65 to 0.91 m behind the shoulders | Seats forward: 0.18 to 0.28 m |
| Eye inside the seat | F-16B, UH-1H, Bell 407, ATR 72, F-14D, Bendy Small Airliner | Seatback 0.04 to 0.16 m | Seats aft: 0.19 to 0.28 m |
| Objects in the windscreen | Caravan, SR22T, DA42, C182T, King Air, PC-6, R44, DC-3 | Sun visors deployed as black slabs; overhead hanging; compass outside the glass | Visors stowed or removed; overhead laid on the ceiling; compass back inside |
| Hood through the glass | Bell 412EP, H125, AW139, Baron, Bonanza | Hood filled or pierced the windscreen | Panels rescaled from a 3.125 in dial; hoods lowered and shortened |
| Over the nose | F-15C, MiG-29A, 737-800, A400M, C-5M | Solid structure 0 to 2 degrees below the eye | F-15C and MiG-29A -11 and -12; 737-800 -17; A400M and C-5M -11 |
| HUDs | Typhoon, F/A-18C, Gripen C, A400M, C-17A | Through the windscreen or hidden; oversized frames | Combiners rebuilt and visible |
| Kit transports | 737-800, A320neo, A220, E175, Q400, G650ER, CJ4 | Eye 0.8 m aft of published stations; dark tinted glass; slab glareshield | Eye moved, glass clear from the seat, thin hood. Over the nose -12 to -18 degrees |
| Heavy flight decks | A400M, C-17A, C-5M, An-124 | Panels 1.5 m away, then too low to see | Panels raised and moved: attitude display -25 to -27 degrees |

The F-15C also lost two frame lines across its windscreen. Both matched photographs show a clear
one-piece windscreen forward of a single bow. The MiG-29A's dotted box, the PC-6 compass, the An-124
sun visor and cabin fan, and the Beaver's center throttle quadrant are real, so they stayed.

**The first transport fix failed in a way the sweep could not see.** Correcting the eye stations pushed
the heavy panels out of frame while every number improved. Looking at the renders caught it, and the
sweep now reports `attitude`, the elevation of the display nearest the sightline.

**The view starts below level.** World-explorer enters the seat at `lookPitch` -0.18, which is 10.3
degrees down, so the frame runs from +20 to -40 degrees. Earth view enters level, from +30 to -30
degrees. The kit transports put the primary display near -35 degrees, close to a real flight deck, so
it is on screen in world-explorer but half cut off in Earth view until the pilot looks down.

### Still flagged

The sweep is a prompt to look, not a verdict. Each remaining flag was looked at and left:

| Model | Reading | Why it stayed |
| --- | --- | --- |
| Beech 18, DC-3, Beaver, PC-6, P-51 | Over the nose near 0 | Taildraggers sit nose-high on the ground |
| Beech 18 | Headroom 0.16 m, outside 32 percent | Tight real cabin, and raising the roof changes the airframe |
| DC-3 | Horizon 41 percent | Same attitude, plus the side wall is now where it belongs |
| C-17A | Headroom 0.85 m, outside 36 percent | Tall deck. Raising the eye lowers the display and costs window top |
| OH-6A | Headroom 0.16 m, wall 0.15 m, cushion, seatback | False alarm: the canopy curves in, and the down ray clips the leaning seatback. Clearance overhead is 0.21 m and the cushion is 0.73 m down |
| An-124 | Dials 141 mm | Primary dials are large on this deck, but no dimension was available to check them |
| Bendy Small Airliner | Poked 3 percent | An alloy detail at the windscreen, not the interior |
| P-51 | Poked 0.8 percent | The panel edge touches the skin. The model is an old master, left alone |

The C182T eye also sits a little aft, at 1.12 m from the panel against 0.88 m on the C172S. The seat
view looks right, so it stayed.

## Open items

- **Transports stay `rework-required`.** Their exteriors are rebuilt, but the cockpits are refitted
  shared interiors that were not compared with each type, and only the 737 has drawing overlays.
  The sweep corrected seating, glass and sightlines only. None has a matched-camera overlay, and gear
  doors are omitted. Visual acceptance is the owner's.
- **Fixed cameras ignore `fov` in `screenshotScene`.** `CameraSpec` drops it, so `cabinCamera.fov`
  in the review files has had no effect on `cabin-wide.png`. Use a `follow` camera until that is
  fixed.
- **`instrumentReview` captures** in the F-14D, F/A-18C and F-15C records predate this work.
- **Earth view enters the cockpit level.** World-explorer starts 10.3 degrees down. Matching it is one
  line, `lookPitch` in `packages/earth/src/client/aircraft.ts`, and would bring transport primary
  displays fully on screen at entry.
- **Deck and seat heights are inferred.** The sweep's seat fixes follow seated human dimensions, not
  drawings of each deck, and the Q400, G650ER and CJ4 eyes are read from photographs.
- **Former masters stay tracked.** `.gitignore` still excepts the five `source.glb` files. Removing
  those lines and untracking the files is a Git step for the owner.
- **Rebuild needed.** `pnpm assets:check` fails until `pnpm assets:build` stamps the new inputs.

## Repeat the audit

In the engine repository, after importing the models you want to compare:

```sh
node packages/entities/scripts/lineup-fleet.mjs --ids=ford-f-150-2025,toyota-rav4-2025 \
  --out=.artifacts/lineups/check.png --cols=2
```

Compare hood height, belt line, roof end, forebody depth and canopy against the body they sit on. A
part that looks oversized is often correct on a body that is undersized, so measure both before
changing either.

To check cockpits, measure from the seat, then look at the same aircraft in a seat render:

```sh
node packages/entities/scripts/cockpit-sweep.mjs --ids=boeing-737-800,f-15c --json=.artifacts/cockpits.json
```

| Column | Measures | Flagged |
| --- | --- | --- |
| `outside` | Percent of the frame that is not cockpit | Under 38 |
| `horizon` | Percent of the horizon visible across 70 degrees | Under 60 |
| `overNose` | Degrees below level at the first solid surface dead ahead | Above -4 |
| `headroom` | Closest surface above the eye, in meters | Under 0.17, over 0.75 |
| `wall` | Closest surface beside the eye, in meters | Under 0.2 |
| `panel` | Distance to the deck ahead and below, in meters | Under 0.55, over 1.25 |
| `cushion` | Straight down from the eye, in meters | Under 0.6, over 0.98 |
| `seatback` | Straight back from the shoulders, in meters | Under 0.15, over 0.48 |
| `attitude` | Degrees below level of the nearest attitude display | Below -36, near the frame edge |
| `dial` | Median round dial diameter, in millimeters | Under 40, over 115 |
| `poked` | Percent of nearby cockpit vertices outside the shell | Over 0.4 |

Render at the entry pitch, not level, because `cabinCamera` and `shots/operator.png` are not the
runtime view. A flag asks for a look, and a clean line can still be wrong.
