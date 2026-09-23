# Sky data and mathematical references

The clear-sky renderer contains numeric star positions and photometry extracted from:

Hoffleit, D. and Warren, W. H. Jr. (1991), **The Bright Star Catalogue, 5th Revised Edition
(Preliminary Version)**, Astronomical Data Center, NSSDC/ADC. Catalog identifier: CDS V/50.

- Catalog and field definitions: https://cdsarc.cds.unistra.fr/ftp/V/50/
- NASA HEASARC description: https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html

The included subset contains 8,404 records with valid J2000 equatorial positions and visual
magnitude at most 6.5. Fields are right ascension, declination, visual magnitude and B−V color.
Missing B−V values use 0 for rendering. The source checksum and regeneration instructions are
recorded in `src/sky/bright-stars.ts` in the source repository.

Sun and Moon orbital formula reference: Paul Schlyter, **How to compute planetary positions**,
https://www.stjarnhimlen.se/comp/ppcomp.html. Molen implements the formulas independently.

Regression position fixtures were generated with Don Cross's MIT-licensed **Astronomy Engine**,
https://github.com/cosinekitty/astronomy. Astronomy Engine is not bundled or required at runtime.
