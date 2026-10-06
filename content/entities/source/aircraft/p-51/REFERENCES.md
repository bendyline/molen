# P-51D visual references

The model uses the single-seat P-51D with a K-14-style sight. Reference photographs were retrieved
and inspected for this pass. In the engine repository, the downloaded originals are in
`.artifacts/aircraft-realism/references/`; they are authoring references, not runtime textures.

- [USAAF cockpit photograph, 1944–45](https://commons.wikimedia.org/wiki/File:North_American_P-51D_Mustang_cockpit.jpg).
  Author: United States Army Air Forces; public domain, as recorded by Commons.
  Local image: `p51d-cockpit-wartime.jpg`. Reference for sight housing, coaming, asymmetric
  panel, bezels and the relationship between the panel and windscreen.
- [Warbird Heritage Foundation: Baby Duck restoration](https://www.warbirdheritagefoundation.org/p51_baby_duck_restoration.html).
  Local image: `p51d-cockpit-restored.jpg`, from `images/p51_r_hr_05.jpg` on that site.
  Reference for panel outline, right-side engine instruments, control colors, placards and
  fasteners. This restoration includes modern avionics: those are not copied into the model.
  Copyright remains with the photographer/site; used only for inspection.
- [Warbird Heritage Foundation: Moonbeam McSwine](https://www.warbirdheritagefoundation.org/p51_moonbeam_mcswine.html).
  Local image: `p51d-exterior.jpg`, from `p7IGM_images/fullsize/p51-mm_f_04.jpg`.
  Reference for canopy, wing/fuselage proportions and natural-metal finish. The existing red
  Molen livery remains an illustrative scheme, rather than identifying this airframe.
  Copyright remains with the photographer/site; used only for inspection.
- [National Museum of the US Air Force: P-51D](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/).
  Dimensional/identity cross-check and museum cockpit image search. The direct Defense.gov
  image download returned HTTP 403; the files above were the inspected local references.

The generator authors the geometry and printing from scratch. No photograph is embedded in a GLB.
The panel is an approximation combining period and restored references, not a serial-specific
restoration. Additional engine/system instruments and switches are visual; the existing bound
airspeed, altitude, heading, climb, RPM, attitude and stick pivots remain live. The game solver's
level ground pose is retained; a parked Mustang normally has a nose-up taildragger attitude.
