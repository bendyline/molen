# Star catalog

`stars.bin` (molen/stars@1) holds numeric star positions and photometry extracted from:

Hoffleit, D. and Warren, W. H. Jr. (1991), **The Bright Star Catalogue, 5th Revised Edition
(Preliminary Version)**, Astronomical Data Center, NSSDC/ADC. Catalog identifier: CDS V/50.

- Catalog and field definitions: https://cdsarc.cds.unistra.fr/ftp/V/50/
- NASA HEASARC description: https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html

The subset contains the 8,404 records with valid J2000 equatorial positions and visual magnitude
at most 6.5: right ascension, declination, visual magnitude and B−V colour, quantized to six bytes
a star. Missing B−V values use 0. Regenerate from the CDS `catalog.gz` (input SHA-256
`3dc44b1e90be8fbe5bcc7656032560f51275f985c7e3f783c9028e1838ec7bed`) with
`node packages/client/scripts/generate-star-catalog.mjs <catalog.gz>`.
