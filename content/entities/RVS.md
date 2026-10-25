# Recreational vehicles

Six mountable, drivable RVs: two Class Cs, three Class As and one Class B. The 2022 Winnebago View 24D retains its real identity; the other five use the Bendy house brand.

The View uses [Winnebago’s 2022 brochure](https://www.winnebago.com/Files/Images/Winnebago/brochures/2022/2022_View_Digital.X.pdf) for the 25 ft 6 in length, 7 ft 6.25 in coach width, 11 ft overall height and 170 in wheelbase. The model interprets its Sprinter cab, cabover sleeper, 24D furnishings, retracted slideout and passenger-side entry/awning in original polygonal geometry. Trim and cabin layout are simplified. The View's cab badge is a plain ring and disc and it carries no coach name: manufacturer, model and year names identify what each interpretation depicts; the geometry carries no maker emblem, wordmark, model lettering or logo-shaped grille — a plain chrome badge and a fictional `MLN` plate stand in. See [NOTICE.md](NOTICE.md).

| Model | Class | Authored length | ID suffix |
| --- | --- | --- | --- |
| [2022 Winnebago View 24D](source/vehicles/winnebago-view-2022/README.md) | C | 7.77 m | winnebago_view_2022 |
| [Bendy Class C Family](source/vehicles/bendy-class-c-family/README.md) | C | 9.45 m | bendy_class_c_family |
| [Bendy Class A Compact](source/vehicles/bendy-class-a-compact/README.md) | A | 9.10 m | bendy_class_a_compact |
| [Bendy Class A Touring](source/vehicles/bendy-class-a-touring/README.md) | A | 11.40 m | bendy_class_a_touring |
| [Bendy Class A Grand](source/vehicles/bendy-class-a-grand/README.md) | A | 12.90 m | bendy_class_a_grand |
| [Bendy Class B Camper](source/vehicles/bendy-class-b-camper/README.md) | B | 6.36 m | bendy_class_b_camper |

All IDs begin with `molen.entities.vehicle.`. `MOLEN_RV_ENTITY_IDS` and `MolenRvEntityId` are exported by `@bendyline/molen-entities`; these IDs are also in the main vehicle/entity helpers. Instantiate the type or use the existing Earth vehicle spawn/boarding API. [scenes/rvs.scene.json](scenes/rvs.scene.json) is a six-model repository showroom. The local World Explorer entity pack contains all six.

RV footprints include mirrors and the stowed equipment envelope. They use a low-frequency `bus` ambient role: the existing large-road-vehicle path includes them in traffic while excluding ordinary curbside parking. All have driver controls and live wheel, steering and analog speed bindings. The Class A Grand has an additional tag axle; all Class As and Cs have dual rear tires.

Furnishings are visual detail. Doors, awnings and slideouts remain stowed; living areas are not a walkable or interactable RV simulation. Models use colored polygonal geometry with no bitmap textures. Their near-view masters use existing host distance/proxy policies. See [the review](RV-REVIEW.md) for measurements, tests, inspected views and limitations.
