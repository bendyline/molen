# Ilédì Oǹtótóo, Second Palace

This exterior depicts the Ògbóni Shrine in the Ọ̀ṣun–Òṣogbo Sacred Grove. The model follows
the restored building documented by the Adunni Olorisha Trust and Adunni Osun Foundation.
Three swept metal roofs join in low valleys behind the open front bays. Staggered rows of leaning
timber posts support the central palm-rib soffit. Raised metal sheets and narrow laps articulate
the valleys. The underside has timber ridge members and alternating diagonal bamboo panels.
The taller posts have carved brows and noses,
and their feet meet the forecourt slab. Red cement reliefs surround an asymmetrical opening with
a recessed iron scroll grille in the street and close-up models.
A low stone sculpture with a raised center sits in the forecourt of the elephant wing.
The roof curves, rear wall and obscured details are reconstructed from published exterior
views. [CyArk flyover](https://www.youtube.com/watch?v=YdqZ-3SxZl8)

At street and close range, the central grille reveals a painted earthen panel and carved timber posts. The curved bands and light stippling follow the 2019 panorama. The interior dimensions and individual motifs are interpreted. The panorama suggests an easterly sightline through the grille, and its camera pin is 96 m from the archive scan center. [Shrine panorama](https://artsandculture.google.com/streetview/IAHtJvQAPXqLVA?sv_pid=CAISFkFGc0NtLWNuY29JQUFBUkdrZWFyLUE) · [Map observations](reference-observations.json)

The master, district, street and close-up models show the separate head and long arms of Ọbàtálá rising above the elephant’s forehead. The red trunk sweeps forward below the pale tusks. The carving follows two Trust photographs. Its depth and concealed attachments are interpreted. [Trust photographs](https://artsandculture.google.com/story/NQURHd6Wqbgz_A)

The sculpture beneath the left gable has two raised forearms that meet at stacked closed fists. Beside it, a waterlily has three clay coils that curl into a recessed center. The close-up shows rounded finger bands. The contours follow the exterior panorama and Trust photographs, with reconstructed depths. [CyArk exterior panorama](https://artsandculture.google.com/story/ZAUBPwpovR_cfQ) · [Trust waterlily photograph](https://artsandculture.google.com/asset/XgHSbt1bZ2e7Vw) · [Left-gable render](portal-preview.webp)

Six shared Molen materials supply the corrugated roof, grille, bamboo, timber, concrete and
sandstone surfaces. The catalog draft uses the tested south-facing pose at the scan-coverage
center. The exterior panorama supports this bearing, and its camera pin lies about 167 m from
that center. The draft clears the mapped road and river. All four detail levels fit the temporary
review grade. The footprint, ground datum and bearing still need geographic confirmation. The
asset can be used in a standalone scene. [Placement trials](placement-report.json) · [Model review](QA-REVIEW.md)

- [Adunni Olorisha Trust and Adunni Osun Foundation exhibit](https://artsandculture.google.com/story/NQURHd6Wqbgz_A)
- [UNESCO nomination and site inventory](https://whc.unesco.org/uploads/nominations/1118.pdf)
- [Reference and map observations](reference-observations.json)

```powershell
node content/worldgen/source/places/s1/s17/osun_grove_second_palace/models/generate-second-palace.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=osun_grove_second_palace
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=osun_grove_second_palace
```
