# Entity model quality

How to judge and improve the moving models: road vehicles, cycles, boats, transit, aircraft,
people, animals and the animated diorama structures. It complements the
[medium-fi style guide](../../docs-src/guide/medium-fi.md), which sets the look and the budgets;
this page records what a whole-fleet review found, the rules that came out of it, and the
tools that make the next review fast.

## The cockpit and cabin review of 2026-11-26

The owner sat in the cockpits and cars and listed five faults. Then every cockpit and every road
car dashboard was reviewed from the seat against licensed reference photographs.

1. **Fit.** Cockpits did not meet their frames: painted skin showed beside and under panels.
2. **Overlap.** Panels stood in front of other panels.
3. **Popped out.** Controls stood proud of their panels.
4. **Chunky.** Detail was coarse: six-sided rods, box knobs.
5. **Re-use.** Parts repeated across types: the same pedals, vents, wheels and switch strip.

| Fault | Where | Cause | Fix |
| --- | --- | --- | --- |
| A strip of generic switches in front of the panel | About 35 of 54 cockpits | `cockpit-controls.mjs` bolted ENGINE / PWR ALL / SPEEDBRAKE / GEAR / FLAPS / BRAKE switches onto any cockpit that did not model those controls. | **Control stations:** each builder places each missing control where the real aircraft has it, as its own part. Examples: a fighter's gear handle on the left vertical panel, a Cessna's flap switch, a 737's start levers. "All throttles" on twins is now the set of per-engine levers rather than a switch. |
| Rudder pedals read as floor vents | Nearly every aircraft | Every pedal was a flat box crossed by five dark bars. | Five pedal families from `cockpit-parts.mjs`: fighter, light aircraft, airliner, helicopter, warbird. Each has a lean, a tread, guards and an arm. The console's own pedals lost their bars too. |
| White skin around the panel and in the footwell | Fighters, light aircraft, transports | Liners stopped short of the panel, and the double-sided exterior paint showed through. | `cockpit-fit.mjs` slices the model's own skin at a station and closes the gap: a bulkhead behind and beside the panel, and liners to the sill. |
| Chunky, repeated controls | Sticks, throttles, switches across the fleet | Six-sided rods, beveled boxes and one switch shape for everything. | The parts library adds stick grips, yokes, throttle and quadrant knobs, handles and switches, with 12–24-sided round forms and cheap chamfers on switch-sized parts. |
| One vent, one wheel in every car | All 125 road vehicles | One `vent()` (a silver box of five bars) and one wheel (a ring, a box hub, metal rods). | `cabin-parts.mjs` has eight vent families, six wheel families, hung or floor-hinged pedals, four gear selectors and four knob styles, chosen by profile layout or by explicit profile fields. Wheels now rake like real columns. |
| Body colour inside the roof and A pillars | All road vehicles | Every car material is double-sided, so the inside of the painted shell showed from the seat. | `addCabinLiner`: painted triangles above the belt inside the cabin are copied, faced in and set 8 mm inboard as a headliner and pillar trim. The profile's `headliner` field overrides its colour. |
| White canopy bows and sills | Fighters, helicopters, light aircraft | The exterior paint of frames the crew sees directly, with no glass between. | `lineSeatFrames` (in `cockpit-fit.mjs`) lines those triangles in dark cockpit trim. The cockpit finisher runs it from every crew eye, including a tandem rear seat. Rules:<ul><li>A triangle is lined only if the eye can see it: rays are tested against every opaque face in reach, the cockpit's own liners included.</li><li>Seals within 6 mm, a pane set into its frame and culled back faces do not count as hiding it.</li><li>Dark parts, interior nodes and rotors are skipped.</li><li>Each lining is set toward the eye that sees it and parented with its frame, so it opens with the canopy.</li></ul>It costs about 500–1,300 triangles per aircraft. |
| Car cabins over their triangle budgets | Most road vehicles, after the new parts | The first parts were too fine for a traffic model: about 920 triangles for a slat vent, 2,600 for a turbine vent, 3,000 for a wheel, 820 for a pedal. The median car grew 9,000 triangles and 160 tests failed their 26,000–32,000 caps. | <ul><li>Each vent bezel is one chamfered sweep.</li><li>Vanes and fins are plain boxes.</li><li>Wheel rims use 8×40 sides; the old rim used 5×24.</li><li>Pedals, gauge ticks and speaker bars are boxes.</li><li>Liner slivers under 2 cm² are dropped.</li></ul>Every car is back under its cap; a vent now costs 160–630 triangles. |
| Stack switchgear stood proud | Every road vehicle with a centre stack | The stack plate's face sat 1 cm behind the fascia line, while knobs, switch rows and vents were drawn 2.5–3.5 cm in front of it. From the seat at an angle they floated 2–4 cm off the stack. | The plate's face meets the backs of the parts it carries; knobs and switches are based on it. A climate bar carries them where a layout has no stack. |
| Shapes the profile could not express | Mustang, Colorado, F-150, Sierra, Silverado, Tundra, Ford GT, i3, Seagull | No profile field for a joined driver-and-centre display, vents beside the screen in one bezel, a toggle bank, or a smooth shelf. | <ul><li>`panel: 'joined'`: one gloss-black panel carries both displays.</li><li>`centerVents: 'flank'`: tall vents beside the screen in a dark bezel edged in bright trim.</li><li>`centerVents: 'none'`: no vents on the stack.</li><li>The GT's eight-toggle bank and red start button.</li><li>The i3's and Seagull's swept shelf, straight or waved, replaces the stepped blocks.</li></ul> |
| Digital clusters lost the speed needle | 16 cars given `cluster: digital` | The authored `speed-needle` binding had no node to drive. | A stated digital cluster draws a virtual dial on its screen, with a live needle. |
| Layout faults in car dashboards | Most road vehicles | Several defects in the dashboard builder: <ul><li>right-hand-drive cabins put the glove box and grab handle on the driver's side;</li><li>centre vents straddled their stack plate or cut into an embedded screen;</li><li>twin dials overlapped at their bezels;</li><li>demister slots were bright;</li><li>wipers parked a fixed run back in z, which put them halfway up upright windscreens;</li><li>floating screens stood on a trim slab;</li><li>push-button selectors lay on the tunnel floor;</li><li>auxiliary gauges stood on posts.</li></ul> | <ul><li>Passenger furniture mirrors to the side opposite the driver.</li><li>The stack plate is sized to frame its vents.</li><li>Dials are spaced by bezel.</li><li>Demister slots are dark.</li><li>Wipers park 3 cm up the glass.</li><li>Floating screens sit on a neck.</li><li>Selectors are a P/R/N/D column on the stack.</li><li>Gauge pods are moulded humps.</li></ul> |

The 54 cockpits were reworked by aircraft family against Commons and US-government photographs.
Each was checked from every seat, by an exterior poke scan, and by a controls check: every
supported control is modelled, none is left to the switch-strip fallback, and every control can
be reached from the eye. Triangle growth was held to the baseline plus 12,000 per aircraft. The
vehicle console now lifts each aircraft's own stick, pedals, throttle, gear, flaps, engine master
and parking brake: across the fleet none falls back to the console's generic kit. The interactions
test fails any aircraft that brings back the bolted switch module. The cockpit finisher drops
triangles under 0.1 mm across: the import's quantization collapses them, which leaves them with
no UV frame.

All 125 road vehicles were reviewed against their cited interior photograph, or a newly found
licensed one: 17 references were added to [the ledger](source/INTERIORS.md). The reviewers
proposed profile fields: `vents`, `wheel`, `shifter`, `knobs`, `dash`, `stack`, `band`,
`headliner`, `cluster`, `screen`, `dials` and `centerVents`. They also listed builder faults;
the recurring ones were fixed in code (see the table above). On 2026-11-27 the 15 cars still
without a photo were searched again. Six were then matched; for the Model Y, R1T and View the
photo shows a sister model with the same dashboard. Their profiles and the builder were
corrected:
- the Polo's screen is joined to its cluster;
- the Tesla's wood strip is a band of its own;
- the Transit's tall vents keep their slats (as do the CTS's chrome ones);
- the Sprinter's round vents flank its screen.

The other nine have no licensed photo of their generation. They were compared with public press
imagery instead (GM, Fiat, Ford, Geely, Honda, Renault and Toyota media, and a Revista Carro road
test), studied only. All nine were corrected:
- the Traverse's 17.7 in screen and vent rail;
- the Explorer's free-standing screen;
- the Kwid's touchscreen in place of the radio;
- the Element's large centre speedometer;
- the xB's single speedometer pod;
- stack colours and vent families on the Onix, Trax, Strada and Monjaro.

The ledger notes each source.

A final per-model pass, also on 2026-11-27, compared every real car's finished dashboard with its
own photo. Of 108 cars, 55 were fixed and 35 already matched. All 18 that needed a builder change got one. The last was the Saab 9-3's stack: it is now turned
toward the driver, with a silver outline round one wide grid vent and the radio
(`stackAngle`, `stackFrame`, `railWidth`). The most common fault was a centre
stack drawn in the seat-trim colour where the car has a black one. Next came panoramic Hyundai
and Kia displays drawn as two screens.

Those builder changes added:
- `dashTop`, `bandHeight`, `clusterHood`, `pod`, `screenBezel`, `selectorSide` and `stackWidth`;
- the auto-rickshaw's painted dash and headset speedometer pod; the MDX's vents at its lower
  screen, the Fiat 500's horizontal vent pair, the GT's toggle
  bank over its radio, the Jimny's twin dial hoods, black dial faces on coloured dashboards, and
  a passenger grab handle in rugged layouts.

The fleet's own designs, boats, transit and two-wheelers were compared with licensed photos of
their class, or with their cited photo. Results:
- 23 fixed, among them sloped merchant-ship consoles, a wooden fishing-boat wheel, tug azimuth
  heads, a speedboat chartplotter, the bus wheel's rake, and a snowmobile's dash and thumb
  throttle;
- the Class A coaches' keypad moved to the driver's side;
- the car ferry also gained its window-head repeater dials (rudder angle, engine revolutions,
  speed), as in the Seikan ferry wheelhouse photographs, and a white deckhead where its green
  roof paint had shown overhead.

Bicycles, skateboards, skis, the snowboard and the kick scooter have no dashboard. The generic
Bendy cars, the fleet's own designs, have no real counterpart, so they were judged for
plausibility. After the
last builder change, every dashboard was rendered again from the driver's seat and at the centre
stack, and checked sheet by sheet.

Rules that came out of it:

- **Every control has a place.** A control the simulation supports is modelled where the real
  type has it, as a part of that type. A generic switch strip is a fallback, never a design.
- **From the seat, nothing is exterior paint.** Bulkheads, liners and frame linings close every
  view of the skin's inside, including canopy bows and car pillars.
- **Round things are round.** Near controls use 12–24 sides. Small switches stay cheap, with
  one chamfer. A row of bars on a box reads as a vent, so don't draw pedals or treads that way.
- **A car is a traffic model too.** Car parts repeat in every car on the street, so count their
  triangles. Use one swept bezel, not four rounded bars, and plain boxes for anything thinner
  than a few millimetres.
- **Variety comes from the type, not from noise.** Pick the real family (a Hornet grip, a
  Cessna ram's horn, a Boeing thrust lever, turbine vents in a TT) before adding detail.

Tools (local, `.artifacts/cockpit-pass/`):

- `check-controls.mjs`: the interactions test for one aircraft. Its triangle count includes the
  runtime's propeller-blur discs.
- `console-sheet.mjs`: each aircraft's console parts. A red corner marks the console's own kit.
- `car-cabin.mjs` and `shot.mjs`: driver, dash and centre views of any road vehicle, bus or helm.
- `parts-sheet.mjs` and `car-parts-sheet.mjs`: every part style on one board.
- `apply-car-review.mjs`: merges reviewer proposals into the profiles and the reference ledger.
- `car-cost.mjs` and `car-part-tris.mjs`: a car's triangles by source line, and each part style's
  cost.
- `lining-count.mjs`, `lining-tint.mjs` and `lining-rays.mjs`: what the frame lining adds, a magenta
  render of it, and the bare frame faces a fan of rays from a seat still finds.

Left for later:

- A follow-up on 2026-11-27 checked against licensed photographs the cockpits first laid out
  from manuals or memory (Commons had rate-limited the review), and fixed what differed. Fixes:
  - OV-10A: flight group, caution grid, pedestal and parking brake.
  - Typhoon: panel grey.
  - F-16B: the U grab handle, and a black auxiliary console.
  - Bell 206B and 407: the fuel valve moved from the overhead to the panel.
  - MV-22B: engine control levers on the overhead with the fire panel; gear, flaps and parking
    brake at the foot of the pedestal.
  - H125: light grey cabin.
  - OH-6 and Bell 206: panel hoods.
  - R44: carpet and seat greys.
  - G650ER: the PlaneView II overhead, glareshield, gear handle, fuel levers, pedestal and yokes.
  - Beechcraft: the molded yoke and white gear knob.

  The [ledger](source/interior-references.json) now cites each photo used. Where Commons had no
  licensed photo, other public imagery was studied, never shipped:
  - Rafale C: a Flickr photo and The Aviationist. Stick and throttle blocks raised, near-black tub,
    bare combiner.
  - H145: a CC Flickr photo and Vertical Magazine. Broad Helionix visor.
  - G36 and G58: Textron press photos, FLYING and Plane & Pilot. Grey molded yokes, T/P/M quadrant,
    climate panel, glareshield lip, ivory sidewalls.

  A last pass compared the four remaining areas with real photographs:
  - **AV-8B:** left display strip, master-arm plate, armament panel and black lower-left panel,
    from Spanish Navy AV-8B+ photos; the nozzle lever now sits inboard of the throttle.
  - **Rafale C:** the housing under the head-level display, and the lower strips with jettison,
    hook, the red gear knob and the engine levers.
  - **H145:** the moulded overhead with breaker blocks; engine main switches as yellow guarded
    levers; the rotor brake on the floor; a light grey cabin lining with dark posts, as in the
    UH-72 and H145M photos.
  - **G650:** the full aft pedestal, with the fuel control toggles (the red L/R handles are the
    fire handles), flap gate, speed brake, RAT, park brake and trim.

  The AV-8B consoles, pedestal and throttle and nozzle quadrant were then laid out from the public
  NATOPS flight manual's cockpit foldout (FO-2) and quadrant figure. The fuel shutoff handle
  moved to the left wall and the parking brake outboard of the throttle. The Rafale's parking
  brake is a grooved grip inboard of the canopy switch, from its manual and Rafale B photos. No
  photograph of the AV-8B's consoles was found, so those follow the manual's drawings. A Harrier
  II GR9 cockpit photograph (MOD, OGL) shows both consoles' forward ends and matches them; the
  right sill's TAKEOFF checklist plate, the LANDING plate's seven checks and a white ring fitting
  on each wall were taken from it. Aft of those stations the photograph shows only the pilot's
  legs and the canopy frame, so the aft console panels rest on the manual's foldout alone. The
  H145 pedestal's generic radio stack became the ELT strip and twin audio panels in the
  Heli-Expo 2019 D3 photograph.

  A final side-by-side sweep set each current render against its reference photographs: all 54
  aircraft (from the photographers' centreline viewpoint, fighters from the eye), 125 road
  vehicles, 8 boats and 2 transit cabs. What it changed:
  - **OV-10:** square instrument cases round every front dial, a turn-and-slip above the VSI and
    the test-switch strip over the ADI (CHECO fig. 10: the real panel reads full).
  - **Bell 407:** the wine-red paint showed inside the posts because a colour that dark passes
    for trim in the frame lining; `material.userData.paint` now marks it as paint to line.
  - **A320neo:** the panel moved from grey toward the Airbus blue-grey of its reference.
  - **Fighters:** displays that showed only an amber INOP (F-14D, F-15C, F-16B, F-22A, F-35A,
    F/A-18C) now show their green format, blank (`mfd-page.mjs`: radar scope frame, threat or
    tactical rings, stores planform, navigation rose). No contact, threat, range or heading is
    drawn, so the rule that unsimulated quantities are never invented still holds. Small "NAV
    INOP" and "SENSORS INOP" sub-labels on otherwise live displays stay.
  - **Golf GTI:** the stack trim darkened to the Mk7's gloss black.
  - **Bell 412EP:** the light grey panel face (from the copyright N7506M photograph) became
    charcoal: both open photographs, the cited INAER EC-IPM and an AB-412 Griffon, show it dark.
  - **Cars at full size:** every road vehicle's driver, dash and stack renders were checked
    at full resolution against its photograph (one verdict per car in
    `.artifacts/cockpit-pass/sweep/car-verdicts/`). The clear mismatches were fixed through
    profile fields: Acura TL parchment cabin, Chrysler 300 dark framed stack, Fiat 500 tall
    body-colour fascia, Honda N-Box and Wuling black bezels, Hyundai Casper pale cabin, Camry
    joined display band, Tacoma dark framed stack, Countryman black switch stack (the Mini
    switch stack now takes `stack`), Solstice and Smart light dials, Smart dark stack,
    Sportage tall outer vents, and the Kia Soul's dash-corner speaker pods (new `cornerPods`).
    Also: i3 grey dash top, Corvette stack turned to the driver. Three recurring notes got
    fields: `lowerDash` (a light lower fascia under a dark top: Genesis, Odyssey, Palisade,
    Tucson, Explorer), `railWidth` over 0.5 m running across the fascia (Genesis, Palisade,
    Tucson, Grand Cherokee) and `grabHandle: false` (Bronco, Hummer EV). The other minor notes
    stay in the verdicts.
  - **Aircraft at full size:** every aircraft's compare and seat renders were checked at full
    resolution against all its reference images (verdicts in
    `.artifacts/cockpit-pass/sweep/aircraft-verdicts/`). Fixed: the A220 panel to its light grey,
    the H125 board run on under the hood's left third (clock, radio head, ELT plate), the P-51's
    coaming checklist card removed (it hid the K-14 sight), the Twin Otter panel to near-black.
    Two reported faults were capture artefacts: G1000 and King Air speed-tape rows hide by
    per-row visibility bindings the review harness does not apply, and transport overheads sit
    above the seats, out of the forward views.
  - **Aircraft minor notes:** 23 aircraft then had their verdicts' minor differences fixed in
    their own builders (each change recorded as `applied` in its verdict): glareshields and hoods
    (F-22A, A400M, Q400, CH-47F, OH-6), panel colours (F-15C, F/A-18C, MiG-29A, An-124, PC-6,
    PC-12 overhead, C-17A liner, airliner), missing parts (KAP 140 and compass in the 172S/182T,
    Caravan trim wheel, Beaver MP/RPM dials, F-15C jettison controls, CH-47F fire handles, Q400
    fuel handles, 737 and airliner trim wheels, C-5M throttle box, 412EP radio heads) and
    proportions (MV-22B bezels, Typhoon rim and bezels, C-130J tiller). Left: window posts and
    glareshield heights set in the shared transport kit.
  - **Window posts:** the shared transport kit's window members were smooth-shaded boxes that
    read as round tubes from the seats (737, CJ4, Q400, E175, A320neo, A220, G650ER). They are now
    wider, shallower and flat-faced (creased normals).
  - **Car minor notes:** 35 more cars took documented profile fields sampled from their photos
    (lower dashes, vent rails, band heights and colours, stack frames and colours, screen sizes);
    each is recorded as `applied` in its verdict. The rest need a builder feature the profiles do
    not have (vents above a screen, twin dial cowls, a stack-less console, wave bands) or are
    generic class designs.
  Checked and left alone: AW139 and UH-60M display sizes (real 8x10 and 8x6 inch). A further
  Openverse search for AV-8B consoles found only exteriors and a display cockpit seen from outside.

  The Beechcraft builders model a 2015 G36 (E-4063–4080) and a 2016 G58 (TH-2453 onward). Their
  factory G1000 panel is the layout modelled and photographed. The 2022+ optimized NXi panel
  (autopilot above the audio panel, a GI 275 standby) belongs to later serials, not these
  variants.
- The automatic flaps of the F-22, F-35, Gripen, Rafale and Typhoon have toggles only because the
  simulation has a flaps control.
- The console's throttle now prefers the common power control's own levers. Before, a
  per-engine lever nearer the eye (a condition lever, an overhead engine lever) could stand in.
  With that fixed, the MV-22's engine control levers went back to the forward overhead console.
- `cockpit-controls.mjs` keeps the switch module as a fallback for a new aircraft, placed by
  `frame.controlModule`. The 38 old per-aircraft placements were removed.
- `interior-review.json` still pins October hashes; it was not re-stamped.

## The aircraft fidelity review of 2026-11-25

The owner flew the fleet in the World Explorer and found faults no earlier review had caught.

- **UH-60M:** round engine pods, a boxy fuselage, odd door windows, and a wiper that crossed the pilot's view.
- **Bonanza G36:** the propeller showed between the panel and the glareshield, and retracted gear showed through the wing.
- **F/A-18C:** a speed brake that looked half open at rest.

Every one of the 54 aircraft was then reviewed. Each was rendered from outside and from every
seat (the explorer's 60° vertical field of view, entry pitch -0.18 rad), with gear down and up
and with brakes, canopies and doors closed and open. The renders were compared with Commons
photographs of the type.

Each render was also scanned with an ID buffer, which flags three kinds of pixel:

- **From a seat:** a pixel showing sky, a propeller or rotor, gear, or the outside of the skin,
  with no glass in between. A dark disc stands in where a propeller or rotor spins, so a slot
  that would show the blur disc in flight is caught.
- **From outside:** a pixel showing a cockpit part with no glass in between.
- **With the gear up:** a pixel showing any gear part.

The baseline scan flagged about 40 aircraft. After the pass, every seat view of every type is
closed:

- No sky or propeller shows from any seat; the transport flight decks used to show over half
  their view as open sky.
- Interior parts no longer show from outside, except slivers of a few pixels.
- Retracted gear is hidden or flush, except where the real aircraft shows it (DC-3, Beech 18 and
  CJ4 tyres) and the closed strut doors.

| Fault | Where | Cause | Fix |
| --- | --- | --- | --- |
| Engine bay seen from the seat | Bonanza, OV-10, P-51, CH-47, H145, UH-1H/412 | The Bonanza's glareshield ended 3 cm under the windscreen base. Behind it the cowl was open all the way to the inlet, so the eye looked through the engine bay at the propeller. Elsewhere, roof quarters stopped short of curved headers, canopy bases bulged past the last nose ring, and one-sided glare shields and nose caps were culled from inside. | A firewall and a glareshield tucked under the cowl skin. Roof quarters follow the header curve. Frames close the coaming corners. Inward faces added where a surface is seen from inside. |
| No windscreen glass from the flight deck | The seven transport-kit types and the generic airliner | The panes faced outward only, so from the seat the deck looked out through open frames. | An inward glass layer, faint from inside and culled outside, plus lined pillars, sill and header inside the skin (`transport-kit.mjs`). |
| Retracted gear outside the skin | Bonanza, Baron, DA42, King Air, PC-12, AW139, F-14, F-15, the transport-kit types, the airliner, OV-10 | GA wing roots were 9–12% thick against 14–17% on the real aircraft, so a stowed wheel lay on top of the skin. Drag braces inboard of a leg swung up through the upper skin. Nose wheels stowed below the belly. The generic fallback swung a leg 90° wherever it stood. | Roots thickened to the real airfoils. Hinges re-set so the stowed wheel sits mid-depth. Braces fold in the leg's plane, and strut doors are shaped to lie on the lower skin. The AW139 and the kit types author their own rigs (side stays that fold, nose doors). The F-14 and F-15 have no bay that fits their gear, so it is hidden by `visible`. The Beech 18 mains fold aft as the real ones do. |
| Interior through the skin | Cessnas, Caravan, Cirrus, Beaver, PC-6, PC-12, Twin Otter, DC-3, Beech 18, F-16, MiG-29, F-22, F-35, Bell 412, R44, ATR 72, MV-22 | Flat floor and liner boxes, seats and tubs were sized to the cabin's widest section. Where the belly rose and the fuselage tapered, they cut through it. | Floors and liners are sampled from the skin rings (`fittedFloor`, builder `ringAt`/`skinHalfWidth` helpers). Tubs stop above the lower fuselage, and seats are clamped inside. |
| Cabin open to the tail or engines | All the helicopters, AV-8B, UH-1H, Gripen | No aft wall: from the seat the eye looked down the tail boom (9 m on the AW139), into the engine bay, or at a fan disc. From behind, the cabin showed past the Bell 206/407 boom roots (the aft frame was an open octagon) and up the Gripen's hollow fuselage around its nozzle. | Bulkheads and firewalls. An aft closing sheet around each Bell boom; a ring and an aft face around the Gripen nozzle. |
| Surfaces not flush at rest | F/A-18, Typhoon, Gripen, F-14, F-16, AV-8B | Speed brakes were flat plates at a fixed height on curved or sloping skin. Buried at the hinge and proud aft, they read as half open; some sat inside the fuselage and broke out through the skin when opened. | `conformPanel` lays each panel on the skin from above, from the side (`sideBrakes`: the Gripen's side panels swing outward) or from below (the AV-8B ventral brake). Panel sizes follow photographs. |
| Canopies and brake mixing | F-22, Typhoon, Rafale, Gripen, F-16, AV-8B, F-35 | The opening was cut 0.4 m ahead of the eye, splitting the glass. Every canopy rotated about a rear hinge. Both F-35 rudders deflected one way for braking (a yaw), and the Rafale's single rudder yawed. | Per-type cut points: the F-22 bubble lifts whole. The Gripen swings to port, the AV-8B slides aft, and the F-16 hood opens about 30°. Paired rudders splay; a centreline rudder stays out of the mix. |
| Recognizable shape | UH-60, A400M, C-17A, C-5M, An-124, CH-47, UH-1H, Gripen, Rafale, F-16, AV-8B, CJ4, Caravan, Beaver, PC-12, H145, Bell 407, AW139, Baron, King Air | Examples: UH-60 nacelles as free pods overhanging the cabin, a square tail tube, and a wall where the cabin met the tail; a pointed A400M radome with its refuelling probe lying flat; a Gripen canopy a metre too long; a stubby CH-47 forward pylon; window layouts that did not match the type. | Rebuilt against photographs. UH-60: faired nacelles beside the transmission, an oval tail cone and taper, rounded windows, upright pitch links. Also new A400M, C-17A and C-5M windscreens and nose, CJ4/Caravan/Beaver/PC-12 windows, H145 Fenestron, 407 endplates, AW139 exhausts and Baron nacelles. |
| Oversized or misplaced details | UH-60, UH-1H, C-130J, An-124, MV-22, Cessnas, Caravan, many wipers | Wipers 2–2.4 cm thick: the UH-60's ran inside the glass to eye height and folded into a Z, and the UH-1H's sat inside the cabin. Also sun visors at forehead height, a glareshield that hid the An-124's attitude indicators, and black horizon backing squares standing over panel tops (MV-22, Caravan). | Wipers parked on the outside of the glass at 1 cm or less. Visors stowed. Masks trimmed under the brow. |
| Markings off the skin | UH-60 stencil, Gripen/Typhoon/Rafale panel lines, Bonanza and Baron wing details | Flat lettering and lines on tapering or curved skin. "UNITED STATES ARMY" read "TATES ARMY". | Text turned with the taper. Panel lines cast onto the actual triangles. Fuel caps, vortex generators and wing walks laid on the surface. |

Rules that came out of it:

- **A seat view must be closed.** From the eye, every ray ends on glass, a cockpit part or the
  inside of the skin. A slot a few centimetres high under a glareshield shows the whole engine
  bay. Check with the propeller disc present, because the disc is what shows in flight.
- **A one-sided surface is invisible from behind.** Anything seen from inside the cabin (glare
  shields, nose caps, the skin past a lining edge) needs an inward face.
- **Check stowed gear against the wing section.** Real light-aircraft roots are 14–17% thick; a
  wheel stowed in a 10% root lies on top of it.
- **Fit interior parts to the skin.** A box sized to the cabin's widest section cuts through a
  tapering belly.
- **Lay moving panels on the surface.** A flat plate on a sloping or curved spine reads as
  partly open.
- **Wipers, visors and handles belong outside the line of sight**, or outside the glass, at real
  thickness.

Left for later:

- 737 main wheels are hidden in flight; real ones show in their wells, which needs well
  cut-outs.
- Main-gear doors are not modelled on the A320, A220, E175, G650 and Q400.
- The A400M side windows sit high (glazePatch cannot bend over the roof shoulder).
- The UH-1H crew door is about 0.3 m aft of the TM figure.
- The OH-6 transmission base shows when looking aft.
- The H145 has a broad opaque band between the windscreen and the front-door window.
- The Beech 18 nacelles end mid-chord, and its tailwheel shows when stowed.
- The C-130J's lower cockpit side window is missing.
- The F-14 mains swing inboard (a test pins it); the real ones retract forward.
- One spoiler panel per wing (real types have 4–5).
- `horizon()` in instrument-geometry draws a backing square larger than its aperture. Builders
  near a panel top trim it locally; a shared `maskTop` option would remove the workarounds.

The renderer, the scan, reference fetching and the per-family evidence stayed local to the
session, as the see-through scan's did. The scan is the "interior-clearance check" listed under
"Worth adding next" below, extended to the exterior and to stowed gear.

### Lettering and liveries (same day)

**Real-font lettering.** The detail kit's `text()` lost its hand-built 3x5 dot glyphs. It now
outlines Overpass, Overpass Mono and Jost through `lettering-outlines.mjs`. Every road vehicle,
motorhome, cycle, watercraft, rail, transit and aircraft model was regenerated and imported.

**Operator markings moved into liveries.** Builders no longer bake in markings that belong to
one operator, or that contradict other operators' schemes:
- national titles: UNITED STATES ARMY on the UH-60, CH-47 and OH-6, and MARINES on the AV-8B;
- national roundels on the Gripen, Rafale and Typhoon;
- the P-51's star-and-bar;
- the MiG-29's nose number;
- the An-124's blue cheatline and the Bell 412's red stripes;
- type designations that took the accent color in every scheme: R44, H125, H145, AW139, 206B,
  407 GX, 412 EP, DHC 2, PC 6, PC-12 NGX, DHC 6, D 18 S, DOUGLAS DC-3, KING AIR 350i, AN-124,
  MV-22B and ATR 72 600;
- BENDY on the generic airliner.

Generic stencils (RESCUE, NO STEP, warning arrows) stay in the geometry.

**The liveries.** Every aircraft has 3–7 real operators' liveries, 264 in all, authored as design
modules in `packages/entities/scripts/liveries/`. Their authoring guide is the README there. The
civil models' unpainted masters are now plainer than before, since the color now comes from the
liveries.

### AV-8B nozzles (2026-11-26)

The owner saw the Harrier's nozzles as much larger than the real ones. They were long round pipes
reaching 0.5 m out from the skin before turning aft, with black discs for exits. Each front pipe
sat behind a fixed pod 0.6 m wide and 0.86 m tall, and each rear one behind a dark pod of the same
size. The rear pair stood 3.1 m behind the front pair. In flight, from above and behind, they read
as four large drums.

Checked against side, head-on and close-up photographs of the AV-8B and Harrier GR.9, and against
museum Pegasus 11 and 103 engines:
- **Shape:** each nozzle is now a compact elbow. A round bearing collar eases into a
  rounded-rectangle outlet: 0.50 by 0.36 m at the front, 0.42 by 0.30 m at the rear. The outlet
  shows a grey duct and turning vanes (two at the front, one at the rear), and its outer face is
  about 0.2 m outboard of the intake cowl.
- **Positions:** the front bearings keep the drawing's station (z 1.13). The rear bearings now sit
  1.9 m behind them, the spacing of the nozzle rings on the Pegasus. Two side photographs disagree
  by 0.5 m on the front station, so it was left at the drawing's value.
- **Fairings:** a fixed pod 1.1 m long and 0.44 m tall sits ahead of each front nozzle; every
  service's insignia sits on it. The intake cowl now fairs into the body behind the nozzles; the
  old pods had closed it.
- **Materials:** the front nozzles take the livery. The rear nozzles and a heat shield on the body
  behind them are bare metal under every livery.
- **Insignia:** the livery anchors moved from the intake trunk onto the pods: the US
  star-and-bar, the Spanish roundel and the Italian anchor badge.

Still open: the same photographs put the intake lip and the pod 0.2–0.5 m further aft than the
drawing-based layout. That has not been reconciled, and the intakes are unchanged.

### F-35A aft body, nozzle and detail (2026-11-26)

The owner saw the F-35A as fat and chunky from behind, more than the real one. The model was
checked against the public-domain three-view, Komatsu photographs from the rear and low rear, and
photographs from a tanker boom.

The side profile and the front silhouette already agreed within about 0.15 m. The difference was
in the aft body:
- It kept a round belly 2.6 m wide to within 0.65 m of the nozzle, then pinched into it, which
  read as a bomb shape from behind.
- The real engine bay is a tube about 1.5 m across that runs almost parallel to the nozzle. Above
  it a thin shelf carries the fins and the stabilator booms, and under it the belly narrows to a
  shallow keel.

What changed:
- **Aft body:** two new sections at z −3.2 and −3.75 build the fin-root shelf, the keel and a
  collar just outside the nozzle. The booms widen so the fin roots sit on them.
- **Nozzle:** 1.25 m across at the base, down from 1.36 m, and 0.92 m at the exit. It has 15 flat
  flaps with dark seams, a hinge band and a saw-toothed exit lip. The body overlaps the nozzle
  with 24 saw teeth where there used to be a line. Inside are an exhaust cone, spray bars and a
  flame-holder ring behind the turbine disc.
- **Detail:**
  - Gun: the GAU-22/A fairing on the left shoulder, with its port door and gas louvres.
  - Vents: two louvred grilles on the right shoulder.
  - Bays: weapons-bay door outlines with saw-toothed ends.
  - Sensors: six EO-DAS windows (above and below the nose, behind the canopy, under the aft body,
    and one on each side of the nose).
  - Lights: formation-light strips on the fins.
- **Livery:** the RAAF serial anchor moved 0.35 m forward onto the full-depth aft side.

### F-14D intake mouth, glove underside and spoilers (2026-11-26)

The owner reported two things on the F-14.

**"Transparency" where the glove meets the wing.** Nothing was open. The raked, tilted intake
mouth had an all-black duct behind it. Seen from low ahead, the lit outboard intake wall crossed a
black parallelogram, which read as a hole through the airframe. The fix:
- The front 40% of the duct and the variable ramp take a light interior paint, as on the real
  Tomcat, whose intakes are white inside near the mouth.
- The deep duct stays dark.
- The ramp no longer uses F14-upper, so the livery module drops the nacelles' F14-upper slots.

The glove also gained its lower skin, from the swept leading edge down into the nacelle side and
the lower lip. Until then the upper glove overhung an open pocket.

**Slats that looked "all up".** These were the spoilers, not slats. The F-14 model has no slats.
The spoilers were level slabs floating 4–7 cm above the drooping wing, stepped from panel to
panel, so they read as deployed at rest. Each is now a flush panel 4 mm above the skin, following
the wing's surface and its swept hinge line. They still rise with roll input.

The seat and exterior leak scans are unchanged under the baseline's conditions.

### UH-1H shading and nose (2026-11-26)

The owner said the UH-1H looked a little boxy and its nose was not quite right. Against the TM
fig 2-2 overlay, the outline already matched. The causes were shading and the lower nose.

**Boxy:**
- The cowling's section had 11 points. The loft smooths normals only from 12, so it rendered as
  flat chamfers.
- The cabin's rounded corners had four points each, so the roof and belly corners showed as
  bands.

The crown now has nine points and each corner seven. A closing sheet beside the corner pane had
hard-coded the old corner's indices; with the new count it left a gap that showed sky and the
rotor from the seat. It now derives them from the corner count.

**Nose:** below the tip, the rows fell steadily back, leaving a long sloping chin under the upper
nose, a duck bill. In the JGSDF 41659 side photograph and the TM side view, the chin face stays
within about 6 cm of the tip 0.4 m lower, then rounds into a broad underside. The lower rows are
now fuller and slightly wider.

The chin windows also changed. Their glass is now tinted (70% opacity), because clear glass over
the dark footwell read as an open mouth. Their frame is slimmer: a 9 mm tube in place of 16 mm.

**Scans:** the seat scans match the baseline, except the chin-window view. It shows more of the
dark footwell lining through the fuller nose, plus a 2-pixel seam.

## The human review of 2026-11-23

Seen in the world explorer's designer, the twelve faces looked like one person, braids and locks
hung free of the hair, the beard was a dark panel on the cheek, and the legs read as too long.
Every change was judged in rendered sheets (faces from the front, three-quarters and the side;
every hair style from three sides; the nine body shapes; walk and run at 16 phases a cycle) at
all three tiers, then in the designer itself.

| Part | What was wrong | What changed |
| --- | --- | --- |
| Head | The face stood 0.43 of a head width in front of the neck's axis (a head is about 0.6), so the chin barely cleared the throat and there was no jawline. Features were Gaussian bumps on a 40 x 30 grid: a nose without a bridge or wings, flat white eyes with the iris laid on top, two thin ribbons for lips, ears as upright sausages 18 mm deep. The head shape's fourteen parameters moved those bumps by a few millimeters. | A skull as deep in front as behind, so the jaw overhangs the throat by about 3 cm. The nose is its own planes (ridge, walls, wings, underside with nostrils); the eye is an almond under a lid that stands over it, with a lash line and an iris the lids cut off; lips have a bow, a fuller lower lip and a dark parting; brows taper; ears are shallow shells angled off the head. Five more head parameters (`faceLength`, `noseLength`, `mouthWidth`, `browArch`, `eyeLid`) and stronger effects for the first fourteen. The eleven presets keep their old values and take the new five by the same Latin-hypercube rule. Age shapes any face: softer and fuller on a child, thinner on an elder. |
| Facial hair | The beard was a flat grid across the front of the face that stopped short of the ears and had no underside. | It wraps the jaw from sideburn to sideburn on the head's own angles, thins to nothing at its ends, hangs from the jaw's outline and tucks under the chin. The mustache is a shaped piece over the lip. |
| Hair | Braids started 1.2 cm outside the skull behind the ear and hung straight down some centimeters behind the back; locks were ten sticks starting below a helmet; the skull showed through close shells in diamonds; the balding fringe ended on a square edge. | Braids start inside the shell low behind the ear, drop past the nape and lie on the back surface the body hands over, with crossed facets and a tie. Locks rise out of the shell at the crown, run down it as ridges and hang to the shoulders, at medium detail too. The skull above a full shell's hairline is no longer drawn (about 800 triangles near), so nothing can show through. Ears stand off the skull by the thickness of close-cut hair and hide under hair that covers them. The ponytail lies flat against the nape. |
| Body | Each trouser leg grew out of half the waistband, so the legs appeared to start at the belt, 0.6 of the height. Knee at 0.25 over an ankle at 0.02; hips 0.223 across; no seat (0.107 deep); a flat board in profile; legs as thin as leggings (0.068 through at the knee); shoes 0.154 long with the ankle a third of the way along. | One hip block from the waistband (0.578) to the crotch (0.475), splitting into two legs. Hip joint 0.52, knee 0.275, ankle 0.04; hips 0.199 across and 0.132 deep; rows with their own front and back depths make the chest, shoulder blades, hollow back and seat; trousers cut as cloth (0.081 at the knee, 0.073 at the hem) with crisp hems; set-in sleeves under a deltoid cap; shoes 0.166 long with the ankle 27% from the heel. Hip to ankle stays 0.48, so riders reach what they reached. |
| Motion | The walk swung the hips as a cosine, so stance feet slid and the stride ignored speed; feet stayed level; standing figures only breathed. | Walk and run are solved from foot paths by two-bone IK with the stride `speed / strideRate`: worst stance slip 0.0002 mm over seven bodies and nine speeds. Heel strike, heel-off and toe-off; pelvis height from what the legs reach; shoulders against the pelvis; arms with a lagging elbow; a flight phase in the run. People take 2.7 leg lengths a stride at Froude 1 (`figureStrideRate`): 112 steps a minute at 1.35 m/s, where the cross-species 2.3 gave 134. Idle shifts weight between the legs with the feet planted. Arms hang clear of hips wider than the shoulders (`FigureMetrics.hipOutline`). |

Triangles fell: the default adult is 5,620 / 1,858 / 964 (was 7,500 / 2,234 / 1,088) and the
heaviest styling (locs, a beard, a coat over a skirt) 7,352 / 2,388 / 1,072 against caps of
9,000 / 2,600 / 1,200. The ears went from 576 triangles to 96 and the hidden scalp is gone.

Things that looked right by the numbers and wrong on screen:

- **The legs were not long.** Hip, knee and crotch heights were at or below adult means. What
  read as length was where the legs appeared to begin. Measure a complaint, then look for what
  the eye is using as the landmark.
- **An iris laid on the face's surface sinks.** The socket is hollow, so the white stretched
  between the lid margins sits in front of an iris placed on the surface under it. The eye has
  its own surface between the lids, and a ray test pins it.
- **A coarser shell needs more room.** A hair shell spanning the skull's curve in fewer rows
  cuts under it: medium and distant shells stand 1.3 and 2.5 mm further off.
- **Flat shading was tried and not adopted.** On the near tier's 40 x 30 head it reads as
  noise; the planes come from features with their own vertices (the nose, the lids, hems).

The pinned state hashes in `examples/figures-gallery` and `examples/dioramas` moved with the
rig and the stride rate. Five landmarks carve their statues from this body (Louisville Water
Tower, the New York Stock Exchange pediment, the Empress Joséphine, the Trevi Fountain and
Antigua Guatemala Cathedral), and the asset key does not cover the figures package's build
output: their GLBs stay as they are until their generators next run, and change then (they pose
with `mode: 'custom'`, so only the geometry moves).

That next run was the first source build in CI, and it failed: `louisville_water_tower:
degenerate Float32 triangle`. Lips and eyelids taper to a point at their corners, and each cell
there kept a second triangle with two corners on that point: 12, 8 and 4 triangles without area
per body at the three tiers. They draw nothing, but the landmark exporter rejects a mesh that
holds one. The face patches no longer emit them (`spansNoArea`), a test pins it for every head,
age and tier, and the five landmarks were regenerated, imported and given their levels of detail
to check the rest of the build: 97,915 triangles for Louisville (102,479 from the body before
this review), the Trevi's street level 15,560 of its 16,000. Long hair, hair under a hat and the
open fronts of coats and jackets still hold such triangles, as they did before this review; no
statue wears them. Check a figure change against the statues before calling it done:
`node packages/worldgen/scripts/generate-authored-places.mjs --ids=<the five> --check` must stop
at "Stale generated output", which is past the mesh checks.

## The figure review of 2026-11-08

Humans still read wrong in the world explorer (long neck, broad chest), and every pedestrian wore
the same short hair, shirt and trousers. The human mesh was sliced at landmark heights (exact
triangle-plane intersections of the bind pose, not vertex bands) and compared with adult
anthropometric means as fractions of stature; the animals were compared with side and front
photographs. Every change was then checked in lineups from the front, profile, rear and
three-quarters, idle and walking, with `scripts/review-humans.mjs` and the model sheets.

| Family | What was wrong | What changed |
| --- | --- | --- |
| Human proportions | Neck base at 0.80 of stature and chin at 0.856 under a head 0.144 tall: 12 cm of 0.10 m-wide neck under a large head. A 1.75 m adult measured 0.42 × 0.30 m through the chest (adults: about 0.33 × 0.24) and 0.57 m across the arms (about 0.47). The sleeve cap ran straight from neck to arm with a bulge added, which read as shoulder pads. The jaw was as wide as the cheekbones. | Neck base 0.825, chin 0.87, head 0.13 (7.5 heads); neck radius 0.036 of stature (feminine 0.9 of it); shoulder joints 0.2 apart; chest 0.19 × 0.135; upper arms 0.84 of the leg radius; the cap is a cubic that slopes off the neck, crests over the acromion and rounds the deltoid; a pectoral or bust row; jaw 0.83 of the cheekbones; deeper skull. Now 0.34 × 0.24 m chest, 0.32 × 0.21 m waist, 0.48 m across the arms, 0.126 m neck. |
| Human variety | One hair style per age; long hair was a flat panel the width of the head; no facial hair, body forms or skirts. | `form` (neutral, masculine, feminine), ten hair styles (shells lift at the crown instead of only widening), stubble, mustache and beard, a skirt. Long hair drapes down the back about 1 cm off the torso; it and the ponytail blend from head to chest. The ambient wardrobe has 31 outfits across skin tones. |
| Quadrupeds | Dog, cat and sheep heads at or below the back line; one head-droop formula for every species; horse and cow heads about twice real width and depth (the horse 0.51 m across); the top neck section stood behind the skull as a ridge; a dachshund-length dog; thick horse cannons; a high, leggy cat. | Steeper necks (dog 45°, cat 60°, sheep 42°) that stay full through the middle; per-species head width, depth, droop and limb radius; neck sections turn into the head's axis; dog body 1.2 withers heights; slim cannons on horses and deer; a lower, deeper cat with a thicker tail that lifts at the tip; a 0.6 m horse head. |

Triangle budgets are unchanged: the default human is 7,500 / 2,234 / 1,088 and the most detailed
combination (long hair, beard, skirt) 8,460 / 2,570 / 1,188 against 8,500 / 2,600 / 1,200. The
medium tier keeps the chest row only for a bust; the distant tier also drops the hairline lip and
the eyelid rims.

Four landmarks carve statues from the shared human and horse bodies (Trevi Fountain, the New
York Stock Exchange pediment, the Louisville water statuary and the Joséphine monument), so they
follow the new anatomy. Their `headScale` values were divided by the head change (0.145 / 0.16)
to keep the carved head sizes. Trevi's street level now reduces each figure to its error floor
(`simplifyStaticSculpture` takes an optional cap): people at 8.5 cm (was 380 triangles at 8 cm),
horses at 4 cm, 15,911 triangles against the 16,000 cap (15,980 before). The four models'
GLBs change and need the next asset batch rebuild and review.

A second look the same day found the necks still long and unnatural. The proportions were close
to anatomy (about 6 cm of throat between collar and chin), but the shape was not:

- **A level neck base.** The shirt's top ring was flat, so behind the head a 9 cm column, about
  45% of head height, stood between the collar and the skull. On a person the trapezius rises
  to the seventh vertebra, about level with the chin, and 3 to 5 cm show. The neck line now
  slants: 0.83 of stature at the notch, 0.85 at the sides and 0.865 behind. The collar, the
  sleeve-cap seam and the long-hair drape follow it.
- **A vertical stalk under the middle of the head.** The neck is now 0.072 of stature across
  (0.065 feminine). It is set back on the shoulders by 0.011 of stature and leans forward to the
  skull, and it tapers to 0.88 under the jaw. The trapezius curve is concave, falling steeply off
  the neck and then flattening toward the shoulder.
- **Knock-on effects on hair.** The set-back collar pushed the long-hair drape out past the head's
  shell as a visible ledge. The drape now starts inside the shell. It is thin and close over the
  collar and clears the body below it within a cone (slope 0.75), so it fans out gradually. The
  shell flares a little below the skull. Buzz and balding shells moved to about 3 mm off the
  scalp: at 1.4 mm the skull, which bulges about 2 mm between the shell's coarser rows, showed
  through in blotches.
- **Quadrupeds.** The dog's raised head sat on a long, thin neck, and the horse's crest ran about
  1.6 head lengths. The dog neck is now 0.34 of withers height at 45° (was 0.42 at 50°) and the
  horse's 0.44 (was 0.5). Every species tapers its neck as t^1.3, so it stays full through the
  middle.

The triangle counts did not change.

## The look review of 2026-10-29

Proportions passed, but side-profile landmarks miss what people see from the three-quarter
views, so every model was then graded on overall "look" by reviewers who had not built it. Each
grader compares the model with photographs of the right generation at matched cameras (front
3/4, rear 3/4, side, front, rear; aircraft also from below) and scores five criteria
(silhouette, glass, front, rear, details), each 100 minus listed deductions: trivial −1,
minor −2 to −3, noticeable −4 to −6, major −8 to −15. Flat colours, absent small details and
faceting within the polygon budget are not deducted. A model passes at a mean of 96 or more
with every criterion at 92 or more and no major deduction. First-pass grades: cars 74–89 (mean
83), aircraft 86–92, boats 86–91, cycles 91–94, transit 89–90; no model passed.

| Family | What was wrong | What changed |
| --- | --- | --- |
| F-14 and other fighters | The F-14's "flattened" nozzles were open single-sided shells (`caps: false`, front faces only) seen from inside and culled from behind; the F-16 intake duct had the same defect. Thin same-grey canards, plain box intakes, low canopies, a flat AV-8B spine. | Double-sided nozzles with a closed lip; thin F-14 beaver tail; raked F-15 ramps; dark F-16 smile; thicker canards; split Typhoon intake; rounded F-35 forebody; F-22 wedge nozzle flaps; AV-8B humpback and drooped nose. |
| Road-vehicle builder | The side fit had no landmark for the rear-header height or where the side glass ends, so a fastback K5 scored 98 while reading as a shooting brake. In 3/4 views bodies read as a soap bar: section widest at mid-door, glass on the body edge, pillow hood, rounded slab tails. Fixed-size tail lamps that vanished on red paint, one headlamp vocabulary, stud-mesh grilles, chrome-disc wheels, a see-through slot on raised-roof vans. | Five builder rounds (see the keys below): flat doors to a crisp crease and shoulder, glass inset to 0.43 W, a crowned hood with a crisp edge and fender peaks, 0.18–0.24 m tail corners and narrowing tailgates; independent rear roof fall and blind quarters; tail and head lamps with size, wrap, shape and graphics; intakes, grille bars and frames, fog lamps, skids, diffusers; alloy, steel, mesh and aero wheels; flares, cladding and trim finishes; commercial bumpers and dual wheels. Every recipe refitted at matched cameras with the two new landmarks. |
| Airliners and bizjets | Every type shared one nose, windscreen and small round window. | Per-type radomes, pane layouts, windows (G650 ovals), nacelle sections (737 flat lip), winglets (sharklets, canted E1), flap-track fairings, measured turboprop blades. |
| Helicopters and GA | Cabins built from vertical flat sides with small roof chamfers: boxes head-on. | A curved cabin shell (`cabinShell` in `robinson-r44.mjs`, used by six helicopters) with glazing cut into the curved skin; GA cabins with tumblehome; fins and rudders as tapered airfoils; bulky DA42 diesels, 208B cargo pod. |
| Boats, cycles, transit | Merchant houses read as office blocks; glass-box wheelhouses; a tender-like speedboat; boxy cruiser and scooter; an upright tram cab. | Stepped houses with bridge wings and funnels; raked flared wheelhouses; higher tug and ferry bridges (helm eyes raised); a bowrider hull; V-twin, Vespa-style scooter, current road frame; S70-style LRV cab with skirts; a modern bus front. |

Status at the end of the day (independent graders, latest grade per model; the record is in
[proportion-review-2026-10-29.json](source/proportion-review-2026-10-29.json) under
`finalGrade`):

| Group | Graded | Pass | Notes |
| --- | ---: | ---: | --- |
| Aircraft (53) | 46 | 38 | A400M and H145 noses fail a criterion; R44, C-17A, CH-47F, MV-22B miss by under 1 point. AV-8B and Bell 412EP were fixed after their failing grade. Not yet graded at their final builds: H125, Bell 206B/407, King Air, Beech 18, DC-3, P-51. |
| Watercraft (8) | 8 | 5 | Bulk carrier, container ship and speedboat at 95.4–95.8 (square sterns, short bridge wings, speedboat sheer). |
| Cycles (6) | 6 | 3 | Cruiser, scooter and standard motorcycle were reworked after their failing grade. |
| Transit (2) | 2 | 0 | Both reworked after their failing grade (bus front, LRV cab). |
| Road vehicles (116) and motorhomes (7) | 0 | – | Refit self-grades 82–94 (mean 89.5, from an independent 83); motorhomes 95.4–96.2. None is at 96 yet; the remaining gap is listed in the backlog. |

Graders disagree by 1–2 points, so a model fixed to exactly 96 often fails the next grader: aim
for 97 or more.

## The proportion review of 2026-10-29

The 2026-10-26 pass fixed construction; this one fixed proportion. Every vehicle model (111
recipe road vehicles, the five Bendy generics, six motorhomes, the box truck, bus, light rail,
six cycles, eight boats and 53 aircraft) was compared with public-domain or Creative Commons
photographs and, for aircraft, three-view drawings, using calibrated overlays: the model is
rendered with a camera matched to the photograph (perspective) or drawing (orthographic),
aligned by two known points (the near-side wheel hubs, or nose and tail), and landmarks are read
in metres. The proportion score is 100 × (1 − mean relative landmark error), with heights
relative to overall height and lengthwise positions relative to length; the bar is 96 with no
single landmark above 6 %. After a final verification pass on the finished builder, all 192
models meet it: scores 97.4–100 (mean 99.1, from 95.1) and no landmark worse than 5.9 %.
Per-model references, scores, changes and remaining gaps are in
[proportion-review-2026-10-29.json](source/proportion-review-2026-10-29.json).

| Family | What was wrong | What changed |
| --- | --- | --- |
| Road vehicles (shared builder) | Every body was a vertical slab: flat vertical fascias, a straight hood falling to a high blunt nose, a flat roof and a trapezoid greenhouse. | Rounded body section (rocker tuck, fullest at mid-door, shoulder roll-in); fascias lean back above the bumper line and tuck under below it, with lamps, grilles and plates following; the hood rolls over at the front; the belt rises toward the C pillar; windshield and backlight bow and wrap, with pillars and side glass sharing their edge; the greenhouse narrows toward the rear header. |
| Road vehicles (recipes) | Templated forms (belt about 0.61 of height): belts 5–25 cm too low, which is what made every cabin look tall; windshield bases 0.2–0.5 m too far forward; hoods, trunk decks and SUV sills too low; several cabs (Hilux, D-Max) too far forward. | Each recipe refitted to a side profile of its generation. Typical modern belts are now 0.66–0.72 of height. |
| Bendy generics | The five original masters were boxy hand-built GLBs; the SUV read as a sedan and the pickup as a sedan with a tub. | Rebuilt on the road-vehicle builder (`"output": "detailed.glb"`; the tracked `source.glb` masters are now unused legacy files) and fitted to class exemplars. |
| Fighters | Boxy aft nacelles ending in small rings (F-14, F-15), squashed oval nozzles (MiG-29), needle radomes (F-14, F-16, AV-8B), zero-thickness fins (F-22, F-35). | Round engine bays and nozzles, ogive radomes, fins with thickness, nozzle spacing from rear photographs. |
| Transports and airliners | Gear at fixed fractions of fuselage length; wings, nacelles and tails 2–4 m out of place; untapered tail cones; tailplanes without dihedral. | Per-type gear, wing, nacelle and tail stations from three-views; upswept tail cones, kinked trailing edges, tailplane dihedral; the C-130J ramp upsweep and beaver tail; the An-124 anhedral. |
| General aviation | Greenhouses and wings a hand-width too tall (Cessnas); faceted wedge or pyramid noses (Baron, DA42, King Air, Twin Otter, SR22T). | Lowered roofs and wings; rounded noses joined to the windshield section; tail cones ending under the rudder. |
| Helicopters | Wrong-side tail rotor (AW139), wedge tail cone (UH-60), V-wedge cabin (R44), oversized egg (OH-6), pointed noses. | Rebuilt noses, booms and cabins against three-views. |
| Cycles and boats | Road bike bars above the saddle, cruiser footpegs behind the seat, cargo bike on a city-bike layout; slab hulls with generic superstructures. | Cycle builder rewritten around measured frame geometry with real steering axes; hulls and superstructures per vessel type. |

New road-vehicle form keys (defaults keep older recipes valid): `beltRise`, `deck` (tail or bed
rail height), `hoodCurve`, `tuck`, `shoulder`, `noseSlope`, `chin`, `bumperLine`, `tailSlope`,
`tailTuck`, `rearBumperLine`, `windshieldBow`, `rearBow`, `windshieldWrap`, `rearWrap`,
`roofPeak`, `roofTaper`, `cowlRise` (raises the hood's rear centre and windshield base above
the belt, a truck power dome), `dloDrop` (paints a band between the side glass and the roof
edge on vans and off-roaders) and `railsInHeight` (the quoted height includes the roof rails).

Keys added in the look review (all default to the previous output unless noted; ranges and
meanings are in the comments beside each key in `road-vehicle-geometry.mjs`):

- Roof and glass: `roofDropRear`, `dloEnd`, `dloEndTop`, `dloEndBulge`, `dloFall`, `dloSplit`,
  `beltKink`, `beltDip`, `glassBase`, `rearGlassBase`, `rearGlassWidth`, `rearPanel`, `capRun`
  (default on cargo vans), `aPillar`, `frameRadius`, `frameFinish`, `tridion`, `alpine`.
- Body: `crease` (now a default flat door to a crisp crease), `noseCorner`, `tailCorner`
  (default 0.18–0.24 m), `tailLip`, `rearShoulder`, `noseShape`, `tailShape`, `fenderPeak`,
  `deckPeak`, `hoodEdge`, `hoodDome`, `hoodDrop`, `ducktail`, `doorCrease`, `engineLid`,
  `cabRake`, `bedRail`, `tonneau`.
- Cladding and trim: `flare`, `flareTop`, `flareShape`, `flareDepth`, `flareFinish`, `rocker`,
  `rockerFinish`, `rockerStrip`, `bumperTrim`, `bumperFinish`, `bumperIntake`, `bumperWrap`,
  `railStyle` (flush by default), `blackRails`, `sideSteps`, `rollBar`, `spareCover`,
  `mirrorScale`.
- Fascia: `intake` styles with `intakeWidth/Height/Y`; grille `band`, `twin`, `tall`,
  `three-port`, `grilleTrim`, `grilleFill`, `grilleMesh`, `grilleBars`, `grilleBar`,
  `grilleFrame`; `lampShape`, `lampDrl`, `lampX/Y/Width/Height/Sweep/Drop`, `lampLens`; tail
  styles `boomerang`, `racetrack`, `twin-line`, `pixel-band`, `black-panel`, `band-l`,
  `round-wrap`, `slashes`, a real `c`, with `tailX/Y/Width/Height/Wrap/Bezel/Count/Band`,
  `tailHousing`, `tailStack`, `tailNotch`; `fogLamps`, `skid`, `garnish`, `diffuser`,
  `tailgateCap`, `deckGrille`, `hoodVents`, `sideIntakeZ`, `exhaust`; `spoiler` is a lip
  (`'wing'` for a raised wing). `road-fascia.test.mjs` rejects unknown style values.
- Wheels: `wheelStyle` (`alloy`, `split`, `multi`, `mesh`, `dial`, `aero`, `steel`, `hubcap`),
  `wheelFinish`, `dually`, `tread` (`road` by default, `at` on off-roaders, `mt`), `ventWindow`.

## The review of 2026-10-26

Every model was rendered from the same calibrated views (below), first family by family, then
one by one where a family sheet showed a problem. The defects were rarely in one model: most
came from a shared builder or a shared recipe habit, so one fix improved dozens of models.

| Family | Models | What was wrong | What changed |
| --- | ---: | --- | --- |
| Road vehicles (`road-vehicle-geometry.mjs`) | 106 + 6 motorhomes on its cab | SUVs, hatchbacks, wagons, vans and off-roaders had a sedan's raked rear glass and trunk deck. Every body sat at a car's sill height; pickups had no frame, a raked cab back, round car arches and a bed as deep as the sills. Rear doors and C pillars were placed from the rear glass, not the rear axle. Wheels detailed both faces and carried a 4 mm sidewall ring. | Rear glass base and run corrected per model (the [proportions test](../../packages/entities/test/vehicle-proportions.test.mjs) now guards it). Ride height and arch gap by body style; squared truck arches; frame rails, crossmembers, live rear axle and undertray; realistic bed floor; cab/bed shut line; rear doors and C pillars follow the axle; two-door cars get one long door; spare tires mounted on the tailgate. Inboard wheel faces are a dark disc (about 4,000 fewer drawn triangles per car). |
| Bendy generics (`fleet-geometry.mjs`) | 6 | Glass boxes on slabs: 24%-opacity greenhouses, a roof slab covering half the cabin, wheels outside the body. | Station wagon, taxi (with roof sign), electric hatchback, off-roader and sports coupe rebuilt on the road-vehicle builder; the box truck has its own builder (`box-truck-geometry.mjs`): shared cab, chassis, dual rear wheels, framed dry-freight box. |
| Watercraft | 8 | One slab-sided wedge hull for every boat; flat sheer, vertical stem; ships without funnels; hull lettering standing off the flared topsides (its shadow read as doubled text). | Lofted hulls per type: plan-view bow fullness, transom, raked stem, flare, deadrise, bilge, sheer rising to the bow, bulwarks with a cap rail, boot-top, antifouling, a sailboat fin keel and bulb. Ships gain funnels, accommodation windows and bridge wings; tugs a fender belt and hull-mounted tires. Fittings and lettering query the hull. |
| Cycles | 6 | The scooter was a motorcycle with a panel; brick saddles; motorcycles drawn on a scaled-up bicycle frame; box headlamps. | Step-through scooter (floorboard, leg shield, engine cowl, bar-mounted lamp); tapered saddles and seat posts; drop bars; a motorcycle chassis (backbone, down tube, swingarm, twin shocks); round headlamps. Rider contacts are unchanged except the scooter's floorboard stance. |
| Transit | 2 | Pure-white bodies; the bus hid its wheels behind flat panels. | Off-white paint (liveries still recolor it); bus wheel openings with arch lips and wells; tinted side glass. |
| Aircraft | 53 | Silhouettes and planforms were sound; the PA-28's wing used the stripe color while its flaps and ailerons were white. | PA-28 wing painted to match. Other aircraft unchanged (see backlog). |
| Wildlife (`wildlife-geometry.ts`) | 90 | Inflated ovoid bodies on straight stick legs; one template for every ungulate; flat-sheet bird wings; zebra stripes as floating rods; squirrel tails as upright eggs. | Jointed legs (stifle, hock, knee, fetlock); chest and rump masses; dark hooves; moose hump, bell and palmate antlers, oryx spear horns, lyre horns, zebra mane (new detail tags `palmate`, `straight-horns`, `mane`); stripes built into the body surface; bent bird wings; a squirrel plume. |
| Figures | 9 | The cat read as a small dog. | Cat preset: shorter legs, larger head. |
| Dioramas | 6 | The carousel was a disc over a platform. | Peaked canopy, valance, rounding board and twelve horses (six ridden). |

## Guidelines

These follow from the defects above. The [medium-fi style guide](../../docs-src/guide/medium-fi.md)
remains the standard; these are the checks that most often fail in practice.

### Review families side by side, not models one at a time

A shared builder fails the same way in every model it builds, and a single preview hides it.
Render a family as a grid of orthographic side views at one scale: identical silhouettes,
identical stances or a whole class with the wrong rear are obvious there and invisible in a
three-quarter preview. Name the object from the clay silhouette alone before judging detail.

### Proportion archetypes for road vehicles

| Body | Rear glass base from the rear end | Rear glass horizontal run | Sill height | Arch gap |
| --- | --- | --- | --- | --- |
| Sedan, coupe | trunk deck behind (about 0.35 L) | 0.5–0.9 m | about 0.48 × wheel radius | 4–5 cm, round |
| Hatchback, wagon, SUV, van | 0.10–0.25 m | 0.1–0.5 m (coupe-SUVs up to 1 m) | 0.6 × radius for SUVs | 6 cm |
| Off-roader | 0.08–0.12 m, spare on the tailgate | 0.1–0.2 m | 0.68 × radius, frame visible | 8 cm, squared |
| Pickup | cab back nearly vertical (under 0.15 m of rake) | — | about the wheel radius, frame visible; bed floor 0.55 m below the rail | 8 cm, squared |

Rear doors end over the rear wheel whatever the rear glass does; a long-roof body shows a C
pillar and a quarter window behind them. A two-door car has one door of about 1.2 m.

Heights measured on the 2026-10-29 profiles (fractions of overall height; check each vehicle):

| Body | Belt (side glass bottom) | Hood leading edge | Deck / tail top | Sill |
| --- | --- | --- | --- | --- |
| Sedan, fastback | 0.67–0.72, rising 3–8 cm to the C pillar | 0.50–0.60 | 0.65–0.76 (high, short trunk) | 0.13–0.19 m |
| Coupe, roadster | 0.68–0.72 | 0.50–0.56 | 0.67–0.76 | 0.12–0.15 m |
| Hatchback, city car | 0.64–0.70 | 0.54–0.60 | 0.68–0.80 | 0.16–0.22 m |
| SUV, crossover | 0.65–0.74 | 0.57–0.64 | 0.66–0.80 | 0.23–0.30 m |
| Minivan, van | 0.53–0.66 | 0.46–0.60 | — | 0.22–0.38 m |
| Pickup | 0.66–0.76 | 0.59–0.72 (rail about at the belt) | 0.69–0.77 | 0.38–0.47 m |

The windshield base usually sits 0.15–0.25 L ahead of the centre on cars and well behind the
front axle; a long-hooded profile with the base at 0.25 L or more reads as a 1980s car.

### Construction

- **Stance is a silhouette feature.** Sill height, arch gap and arch shape say "truck" or "car"
  before any detail does. Show what a raised body stands on: frame, axle, undertray, not sky.
- **Markings conform to the surface.** Lettering and decals lie on the skin and follow its
  slope; a floating letter casts a copy of itself as a shadow. Fittings query the surface they
  sit on (the boat hull's `deckAt` and `sideAt`) instead of assuming a box.
- **Interiors stay inside.** Put the driver's eye about 0.9 m behind an upright windshield's
  base, or the full-depth dashboard pierces the glass onto the hood.
- **Spend triangles where they are seen.** The inboard face of a wheel, the inside of a closed
  box, a 4 mm ring: none reach the screen. A body shell of 1,300 triangles beside wheels of
  8,000 is the wrong way round. Remember that import de-duplicates identical meshes, so the
  sidecar's triangle count can hide a drawn-triangle saving or cost.
- **Identity features are data.** Species and vehicle variants differ by named details
  (`palmate`, `straight-horns`, `mane`; `roofSign`, `spare`, `cargoVan`), not by a model-name
  switch inside a generator.
- **Stripes and liveries belong in the surface.** Build stripes into the mesh's own bands or
  vertex colors; never stack proud rings around a faceted body.
- **No pure white or black on a large surface.** Use off-whites and let liveries color.

### Contracts a model must keep

- Liveries bind by node name and material (`source/liveries.json`): a generator's node names
  and its paint material are part of its interface. Keep one node per livery slot when
  restructuring geometry.
- Named pivots (`wheel-*`, `-spin`, `-brakes`, `handlebar`, pedals, steering wheel, needles)
  and the spec's driver eye, grips, footrests and seats must still match the geometry.
- Generators stay byte-deterministic: `Math.pow` rather than `**`, no clocks, no randomness.

## Tools

- **Review sheets:** `node packages/entities/scripts/model-sheet.mjs` renders any source GLB,
  figure preset or wildlife recipe from calibrated views under an Earth-like rig: walk-around
  three-quarters, orthographic side, front, rear and top at one scale with the recipe's declared
  dimensions and wheel centers drawn on them, a clay silhouette and a traffic-distance view.
  `--compare=<dir>` stacks before and after; `--family=<name> --grid=N` builds a family grid;
  `--figures=all` and `--wildlife=base` bake procedural bodies first. Output goes to ignored
  `shots/model-sheets/`. Use `--gpu` on a machine with a GPU; the default is SwiftShader.
- **Proportions test:** `packages/entities/test/vehicle-proportions.test.mjs` fails a recipe
  with a sedan rear on a tailgate body, a pickup without frame-height sills, or a dashboard ahead
  of its windshield base.

Worth adding next:

- A family silhouette check: render each family's clay side views and flag pairs whose
  silhouettes overlap almost completely, so a template reused without its proportions is
  caught automatically.
- A floating-marking check: raycast each lettering and decal mesh onto its parent surface and
  fail gaps over a centimeter.
- An entity budget audit beside `check-medium-fi.mjs`: runtime draw calls (many aircraft run
  100–330 against the guide's "roughly eight batches"), drawn rather than unique triangles,
  and large near-white or near-black materials.
- An interior-clearance check that rays from the driver's eye through the glazing and fails
  cabin geometry outside the body shell.

## Backlog

- Aircraft draw calls: consolidate static detail by material in the per-aircraft builders.
- Elephants are blocky; birds at rest could use more shape.
- Figures: a skirt shows specks of thigh at the highest knee lift of a run and slivers of seat
  from a rear three-quarter view when seated; long hair and a ponytail twist where a look-at
  turns the head past about 60 degrees; long hair over a hoodie stands off the back as a slab;
  shoes are rounded forms without a separate heel and stay rigid at toe-off; the distant tier's
  temple hairline is one diagonal between two columns and its crotch a visible notch; short
  hair styles differ little in silhouette; eyes do not blink. Walking backward steps forward
  (`state.travel` is not read), a walk above about 2.4 m/s or a run above 5.4 leg lengths a
  stride slips, elders run like young adults, and seated hands rest on the thighs rather than
  on a stick or wheel. Long hair, hair tucked under a hat and the open fronts of coats and
  jackets hold triangles without area (two corners on one point), which a statue carved from
  such a body would be rejected for. Model sheets bake the bind pose under their own lighting,
  which makes the dog's and cat's necks look flatter than they do posed in a scene; judge necks
  in a scene render.
- Cars do not yet reach 96 on look (refit self-grades 82–94). The most common builder limits
  the refits ran into: a hood-to-grille edge and per-corner fascia lean so noses stop reading as upright slabs under a
  soft hood; a shoulder crease across tailgates and trunk lids with a plate recess and a rear
  bumper shelf; the cabin interior showing through the tinted glass; free-form grille outlines
  (Tacoma hexagon, Lincoln star, Jeep/Escape shapes); lamps on the bonnet or fender top (Mini,
  Leaf); pontoon fenders (Chevrolet SSR, PT Cruiser); stepped roofs (Element, Defender);
  roadster headrest fairings; a roof-edge radius on boxy bodies. Then refit the cars again and
  have fresh graders grade them.
- Aircraft that still fail an independent grade: A400M nose (pointed drooping ogive, larger
  windscreen), H145 nose cap, C-17A windscreen, CH-47F aft pylon and nose length, MV-22B
  nacelles, R44 fin sweep; re-grade the AV-8B and Bell 412EP (fixed after grading) and grade the
  seven not yet graded at their final builds.
- Boats: round, overhanging sterns and full-beam bridge wings on the bulk carrier and container
  ship; drop the speedboat's gunwale toward the transom and open its bow. Re-grade the cruiser,
  scooter, standard motorcycle, bus and light-rail car (reworked after their failing grade).
- Weakest references: Casper Electric, Octavia Combi, Outback and the Bendy station wagon have no
  Commons side profile and were scored from camera-matched three-quarter photographs; Ioniq 5,
  Ram 1500 and the MDX rear glass also rely on angled views. Their scores are less firm.
- Taildraggers (P-51, PC-6, DC-3, Beaver, Beech 18) are built posed in their real three-point
  attitude, because the kernel holds body pitch 0 on the ground. The same pose is drawn in
  flight, so they fly visibly nose-high (P-51 13°). A kernel rest-pitch (three-point attitude on
  the ground, level datum in the air) would fix all five; until then the P-51's tail collision
  probes stay in the flight datum so takeoff rotation does not strike the tail.
- Budgets: the look work kept plain road-vehicle builds within about +1.5k triangles each
  (most 20–27k source triangles), cycles at most 14k, boats at most 14.5k, aircraft at most
  about 90k. The articulation layer (`road-articulation.mjs`, `aircraft-articulation.mjs`)
  adds 6–9k triangles to every road vehicle, which takes many past the 22k runtime caps in the
  fleet tests; measure look changes with `articulate: false`.
- The tracked Bendy `source.glb` masters (compact, sedan, SUV, pickup, van) are no longer read
  by any generator and can be deleted.
- The smock windmill's skyline level shows dark, inverted-looking facets from automatic reduction.
- `molen types gen` writes `airport\scene.json` with a backslash into the generated header on
  Windows, so declarations made there differ from those made on Linux.

## Reproduce

```sh
node packages/entities/scripts/generate-fleet.mjs --ids=<slug,...>   # road, cycle, boat recipes
node packages/entities/scripts/generate-rail.mjs --ids=<slug,...>    # rail rolling stock (RAIL.md)
node content/entities/source/transit/bus/models/generate.mjs
node packages/entities/scripts/generate-aircraft.mjs --ids=pa-28-180
node content/wildlife/source/build-catalog.mjs                     # wildlife detail tags
node packages/entities/scripts/model-sheet.mjs --ids=<slug,...> --compare=<before-dir> --gpu
node packages/entities/scripts/capture-fleet.mjs --ids=<slug,...>   # then preview-fleet.mjs
```

Import each changed bundle with `pnpm assets:build --no-generate`, then run
`generate-models.mjs` and `preview-liveries.mjs --capture` (see
[repository GLBs](../ASSET-PACKS.md)).
