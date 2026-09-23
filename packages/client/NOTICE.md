# Sky data and mathematical references

This package contains no star data. The clear-sky renderer draws stars from a catalog the app
supplies, usually the `molen.sky` content pack, which is extracted from Hoffleit and Warren's
Bright Star Catalogue (CDS V/50) and carries that attribution in its own NOTICE.

Sun and Moon orbital formula reference: Paul Schlyter, **How to compute planetary positions**,
https://www.stjarnhimlen.se/comp/ppcomp.html. Molen implements the formulas independently.

Regression position fixtures were generated with Don Cross's MIT-licensed **Astronomy Engine**,
https://github.com/cosinekitty/astronomy. Astronomy Engine is not bundled or required at runtime.
