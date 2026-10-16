# Regional content catalog (`molen/regional-catalog@1`)

Composable ecological and architectural channels with explicit dependency versions and replacements. Resolve catalogs together to check cross-document references and selector ambiguity.

## Example

```json
{
  "format": "molen/regional-catalog@1",
  "id": "example.regional",
  "version": 1,
  "title": "Regional content",
  "requires": [],
  "overrides": [],
  "profiles": [],
  "scatters": []
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "const": "molen/regional-catalog@1"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "requires": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "version": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          }
        },
        "required": [
          "id",
          "version"
        ],
        "additionalProperties": false
      }
    },
    "overrides": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
      }
    },
    "profiles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "priority": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "match": {
            "type": "object",
            "properties": {
              "biomes": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 14
                }
              },
              "realms": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "ecoregions": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                }
              },
              "regions": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "additionalProperties": false
          },
          "scatter": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "buildings": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "when": {
                  "type": "object",
                  "properties": {
                    "class": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": "Match when any label equals or contains one of these words; \"house\" matches \"semidetached_house\" but not \"warehouse\"."
                    },
                    "notClass": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": "Reject when any label matches one of these words."
                    },
                    "contextClass": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": "Match the surrounding label (e.g. the land class); 'none' matches an absent context."
                    },
                    "notContextClass": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": "Reject when the surrounding label matches."
                    },
                    "areaMin": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Minimum footprint area in m²."
                    },
                    "areaMax": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Maximum footprint area in m²."
                    },
                    "heightMin": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Minimum known height in meters; never matches an unknown height."
                    },
                    "heightMax": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Maximum known height in meters; never matches an unknown height."
                    },
                    "hasHeight": {
                      "type": "boolean",
                      "description": "Require (true) or forbid (false) a known source height."
                    },
                    "levelsMin": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Minimum floor count; roof choices also use resolved estimates."
                    },
                    "levelsMax": {
                      "type": "number",
                      "minimum": 0,
                      "description": "Maximum floor count; roof choices also use resolved estimates."
                    },
                    "elongationMin": {
                      "type": "number",
                      "minimum": 1,
                      "description": "Minimum long/short axis ratio of the oriented bounding box (>= 1)."
                    },
                    "elongationMax": {
                      "type": "number",
                      "minimum": 1,
                      "description": "Maximum long/short axis ratio of the oriented bounding box (>= 1)."
                    },
                    "rectangularityMin": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1,
                      "description": "Minimum area / (width * depth), 0..1."
                    },
                    "rectangularityMax": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1,
                      "description": "Maximum area / (width * depth), 0..1."
                    },
                    "verticesMax": {
                      "type": "integer",
                      "minimum": 3,
                      "maximum": 9007199254740991,
                      "description": "Maximum outline vertex count after cleaning."
                    },
                    "holes": {
                      "type": "boolean",
                      "description": "Require (true) or forbid (false) holes (courtyards)."
                    },
                    "wingsMin": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991,
                      "description": "Minimum roof wing count (archstyle rules only)."
                    },
                    "wingsMax": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991,
                      "description": "Maximum roof wing count (archstyle rules only)."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Conditions; omit for a catch-all rule."
                },
                "style": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
                  "description": "Archstyle id to apply, e.g. 'molen.worldgen.pnw.house'."
                },
                "variants": {
                  "minItems": 1,
                  "maxItems": 120,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "style": {
                        "type": "string",
                        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
                      },
                      "weight": {
                        "type": "number",
                        "exclusiveMinimum": 0
                      }
                    },
                    "required": [
                      "style",
                      "weight"
                    ],
                    "additionalProperties": false
                  },
                  "description": "Optional weighted styles sampled from stable building identity. Without identity, use style."
                }
              },
              "required": [
                "style"
              ],
              "additionalProperties": false
            }
          },
          "wildlife": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "agriculture": {
            "type": "object",
            "properties": {
              "crops": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "crop": {
                      "type": "string",
                      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
                    },
                    "weight": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "crop",
                    "weight"
                  ],
                  "additionalProperties": false
                }
              },
              "orchards": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "crop": {
                      "type": "string",
                      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
                    },
                    "weight": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "crop",
                    "weight"
                  ],
                  "additionalProperties": false
                }
              },
              "tropical": {
                "type": "boolean"
              }
            },
            "required": [
              "crops"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "id",
          "title",
          "priority",
          "match"
        ],
        "additionalProperties": false
      }
    },
    "scatters": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "format": {
            "type": "string",
            "const": "molen/scatter@1",
            "description": "Format envelope; always 'molen/scatter@1'."
          },
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "Rule set id under the pack namespace, e.g. 'molen.worldgen.scatter.pnw'."
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "description": "Human title."
          },
          "doc": {
            "type": "string"
          },
          "version": {
            "default": 1,
            "type": "integer",
            "minimum": 1,
            "maximum": 9007199254740991,
            "description": "Bump to re-roll every placement."
          },
          "surface": {
            "type": "object",
            "properties": {
              "default": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$",
                "description": "Surface color for unlisted labels."
              },
              "colors": {
                "default": {},
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "description": "Label pattern to '#rrggbb' surface color (exact, then word match)."
              }
            },
            "required": [
              "default"
            ],
            "additionalProperties": false
          },
          "defaults": {
            "type": "object",
            "properties": {
              "avoid": {
                "type": "object",
                "properties": {
                  "roads": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Clearance from road edges, meters."
                  },
                  "buildings": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Clearance from building outlines, meters."
                  },
                  "water": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Clearance from water, meters."
                  }
                },
                "required": [
                  "roads",
                  "buildings",
                  "water"
                ],
                "additionalProperties": false
              },
              "slopeMax": {
                "default": 0.75,
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Default slope limit."
              },
              "lod": {
                "type": "object",
                "properties": {
                  "keepByTier": {
                    "minItems": 1,
                    "maxItems": 8,
                    "type": "array",
                    "items": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    },
                    "description": "Keep fraction per detail tier (index 0 = full detail); must be non-increasing."
                  },
                  "maxInstancesPerBatch": {
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 9007199254740991,
                    "description": "Hard cap per batch for this rule."
                  }
                },
                "required": [
                  "keepByTier",
                  "maxInstancesPerBatch"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "avoid",
              "lod"
            ],
            "additionalProperties": false
          },
          "rules": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_-]*$",
                  "description": "Rule id; part of every placement seed."
                },
                "classes": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": "Labels this rule applies to (word match)."
                },
                "notClasses": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": "Labels that exclude the rule."
                },
                "densityPerHectare": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 20000,
                  "description": "Target instances per hectare before clustering and polygon density."
                },
                "minSpacing": {
                  "default": 2,
                  "type": "number",
                  "minimum": 0,
                  "description": "Minimum spacing hint in meters."
                },
                "rows": {
                  "type": "object",
                  "properties": {
                    "headland": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 30
                    },
                    "spacing": {
                      "type": "number",
                      "minimum": 0.5,
                      "maximum": 100,
                      "description": "Distance between cultivation rows, meters."
                    },
                    "interval": {
                      "type": "number",
                      "minimum": 0.5,
                      "maximum": 100,
                      "description": "Distance between plants along a row, meters."
                    },
                    "angle": {
                      "default": 0,
                      "type": "number",
                      "minimum": 0,
                      "maximum": 180,
                      "description": "Grid rotation in degrees from world X."
                    },
                    "jitter": {
                      "default": 0.04,
                      "type": "number",
                      "minimum": 0,
                      "maximum": 0.2,
                      "description": "Fractional cell jitter; 0 gives exact rows."
                    }
                  },
                  "required": [
                    "spacing",
                    "interval"
                  ],
                  "additionalProperties": false,
                  "description": "Optional world-anchored cultivation grid. Density may thin it, but cannot overfill it."
                },
                "nearWater": {
                  "type": "object",
                  "properties": {
                    "maxDistance": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 500,
                      "description": "Maximum horizontal distance from mapped water edges, meters."
                    },
                    "classes": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      },
                      "description": "Optional water labels; omitted accepts any mapped water."
                    }
                  },
                  "required": [
                    "maxDistance"
                  ],
                  "additionalProperties": false,
                  "description": "Require mapped water nearby, at the exclusion raster resolution. Water itself remains excluded."
                },
                "clustering": {
                  "type": "object",
                  "properties": {
                    "scale": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "description": "Noise wavelength in meters."
                    },
                    "threshold": {
                      "default": 0.35,
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1,
                      "description": "Noise value below which density is zero."
                    },
                    "contrast": {
                      "default": 1.4,
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "description": "Steepness of the density ramp."
                    },
                    "seedOffset": {
                      "default": 0,
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991,
                      "description": "Decorrelates rules sharing a class."
                    },
                    "sharedSeed": {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991,
                      "description": "Shared density field across layers; does not change placement seeds."
                    },
                    "detailScale": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "description": "Wavelength of smaller clumps inside density patches, meters."
                    }
                  },
                  "required": [
                    "scale"
                  ],
                  "additionalProperties": false,
                  "description": "Noise-modulated density for natural clumps and clearings."
                },
                "layer": {
                  "default": "canopy",
                  "type": "string",
                  "enum": [
                    "canopy",
                    "understory",
                    "groundcover",
                    "agriculture"
                  ],
                  "description": "Budget pool: canopy uses the batch instance and model caps; understory (shrubs and thickets) and groundcover (low patches) have independent caps and never thin canopy trees."
                },
                "slopeMax": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "Slope limit for this rule (0 = flat, 1 = vertical)."
                },
                "altitude": {
                  "type": "object",
                  "properties": {
                    "min": {
                      "type": "number",
                      "description": "Lowest ground height in meters."
                    },
                    "max": {
                      "type": "number",
                      "description": "Highest ground height in meters."
                    }
                  },
                  "additionalProperties": false
                },
                "avoid": {
                  "type": "object",
                  "properties": {
                    "roads": {
                      "type": "number",
                      "minimum": 0
                    },
                    "buildings": {
                      "type": "number",
                      "minimum": 0
                    },
                    "water": {
                      "type": "number",
                      "minimum": 0
                    }
                  },
                  "additionalProperties": false,
                  "description": "Overrides of the default clearances, meters."
                },
                "populations": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "model": {
                        "type": "string",
                        "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$",
                        "description": "Model: an asset id (e.g. 'molen.entities.tree.conifer.fir') or 'builtin:<name>'."
                      },
                      "weight": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000,
                        "description": "Relative weight among sibling entries; 0 disables the entry."
                      },
                      "variants": {
                        "minItems": 1,
                        "maxItems": 16,
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "model": {
                              "type": "string",
                              "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$"
                            },
                            "weight": {
                              "type": "number",
                              "exclusiveMinimum": 0,
                              "maximum": 1000
                            }
                          },
                          "required": [
                            "model",
                            "weight"
                          ],
                          "additionalProperties": false
                        },
                        "description": "Interchangeable model forms sampled independently of species. Unretained forms fall back to model under the model budget; all must share habitat and scale bounds."
                      },
                      "scale": {
                        "type": "object",
                        "properties": {
                          "min": {
                            "type": "number",
                            "description": "Minimum uniform scale."
                          },
                          "max": {
                            "type": "number",
                            "description": "Maximum uniform scale (>= min)."
                          }
                        },
                        "required": [
                          "min",
                          "max"
                        ]
                      },
                      "widthScale": {
                        "type": "object",
                        "properties": {
                          "min": {
                            "type": "number",
                            "exclusiveMinimum": 0
                          },
                          "max": {
                            "type": "number",
                            "exclusiveMinimum": 0
                          }
                        },
                        "required": [
                          "min",
                          "max"
                        ],
                        "additionalProperties": false,
                        "description": "Independent X/Z scale multiplier for crown width/bushiness; omitted means 1."
                      },
                      "yaw": {
                        "default": "random",
                        "type": "string",
                        "enum": [
                          "random",
                          "none",
                          "rows"
                        ],
                        "description": "Random, fixed, or aligned with cultivation rows."
                      },
                      "align": {
                        "default": "up",
                        "type": "string",
                        "enum": [
                          "up",
                          "normal"
                        ],
                        "description": "Upright, or tilted to the ground normal."
                      },
                      "tint": {
                        "type": "object",
                        "properties": {
                          "hue": {
                            "default": 0,
                            "type": "number",
                            "minimum": 0,
                            "maximum": 0.5,
                            "description": "Hue jitter ± (0..0.5)."
                          },
                          "saturation": {
                            "default": 0,
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "Saturation jitter ± (0..1)."
                          },
                          "lightness": {
                            "default": 0,
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "Lightness jitter ± (0..1)."
                          }
                        },
                        "additionalProperties": false,
                        "description": "Per-instance HSL jitter applied as instance color."
                      },
                      "slopeMax": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                        "description": "Species-specific slope limit (0 = flat, 1 = vertical)."
                      },
                      "altitude": {
                        "type": "object",
                        "properties": {
                          "min": {
                            "type": "number",
                            "description": "Lowest ground height in meters."
                          },
                          "max": {
                            "type": "number",
                            "description": "Highest ground height in meters."
                          }
                        },
                        "additionalProperties": false,
                        "description": "Species-specific ground height limits."
                      }
                    },
                    "required": [
                      "model",
                      "weight",
                      "scale"
                    ],
                    "additionalProperties": false
                  },
                  "description": "Weighted species."
                },
                "lod": {
                  "type": "object",
                  "properties": {
                    "keepByTier": {
                      "minItems": 1,
                      "maxItems": 8,
                      "type": "array",
                      "items": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    },
                    "maxInstancesPerBatch": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "additionalProperties": false,
                  "description": "Overrides of the default detail policy."
                }
              },
              "required": [
                "id",
                "classes",
                "densityPerHectare",
                "populations"
              ],
              "additionalProperties": false
            },
            "description": "Placement rules, all matching rules apply."
          }
        },
        "required": [
          "format",
          "id",
          "title",
          "surface",
          "defaults"
        ],
        "additionalProperties": false
      }
    },
    "plants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "version": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "family": {
            "type": "string",
            "enum": [
              "broadleaf",
              "conifer",
              "palm",
              "cactus",
              "succulent",
              "bamboo",
              "banana",
              "grass",
              "fern",
              "reed",
              "mangrove",
              "deadwood",
              "shrub",
              "thicket",
              "forb",
              "vine",
              "mat",
              "fallenwood",
              "crop"
            ]
          },
          "form": {
            "type": "string",
            "enum": [
              "round",
              "columnar",
              "umbrella",
              "feather",
              "fan",
              "branching",
              "paddle"
            ]
          },
          "height": {
            "type": "number",
            "minimum": 0.1,
            "maximum": 100
          },
          "width": {
            "type": "number",
            "minimum": 0.1,
            "maximum": 60
          },
          "crownBase": {
            "type": "number",
            "minimum": 0,
            "maximum": 0.95
          },
          "stemRadius": {
            "type": "number",
            "minimum": 0.01,
            "maximum": 6
          },
          "lean": {
            "type": "number",
            "minimum": 0,
            "maximum": 0.5
          },
          "foliage": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "bark": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "shapeSeed": {
            "type": "integer",
            "minimum": 0,
            "maximum": 65535
          },
          "patch": {
            "type": "boolean"
          },
          "climber": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "cropKind": {
            "type": "string",
            "enum": [
              "maize",
              "cereal",
              "rice",
              "broadleaf",
              "cotton",
              "cane",
              "sunflower",
              "roots"
            ]
          },
          "cropStage": {
            "type": "string",
            "enum": [
              "sown",
              "growing",
              "mature",
              "ripe",
              "stubble"
            ]
          },
          "taxa": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "leafType": {
            "type": "string",
            "enum": [
              "broadleaved",
              "needleleaved"
            ]
          },
          "phenology": {
            "type": "object",
            "properties": {
              "spring": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "autumn": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              }
            },
            "required": [
              "spring",
              "autumn"
            ],
            "additionalProperties": false
          },
          "leafless": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "version",
          "title",
          "family",
          "form",
          "height",
          "width",
          "crownBase",
          "stemRadius",
          "lean",
          "foliage",
          "bark"
        ],
        "additionalProperties": false
      }
    },
    "crops": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "aliases": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "model": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "variants": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
            }
          },
          "kind": {
            "type": "string",
            "enum": [
              "annual",
              "orchard",
              "vineyard",
              "pasture",
              "fallow"
            ]
          },
          "spacing": {
            "type": "number",
            "minimum": 0.25,
            "maximum": 30
          },
          "interval": {
            "type": "number",
            "minimum": 0.25,
            "maximum": 30
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "soil": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "ripe": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "sowingMonth": {
            "type": "integer",
            "minimum": 1,
            "maximum": 12
          },
          "growingMonths": {
            "type": "integer",
            "minimum": 2,
            "maximum": 11
          }
        },
        "required": [
          "id",
          "aliases",
          "model",
          "kind",
          "spacing",
          "interval",
          "color",
          "soil",
          "ripe",
          "sowingMonth",
          "growingMonths"
        ],
        "additionalProperties": false
      }
    },
    "animals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "version": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "taxon": {
            "type": "string",
            "minLength": 1
          },
          "range": {
            "type": "string",
            "minLength": 1
          },
          "winterColor": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "inactiveInWinter": {
            "type": "boolean"
          },
          "body": {
            "type": "object",
            "properties": {
              "family": {
                "type": "string",
                "enum": [
                  "ungulate",
                  "canid",
                  "feline",
                  "rodent",
                  "lagomorph",
                  "hopper",
                  "elephant",
                  "bird",
                  "reptile",
                  "fish",
                  "insect"
                ]
              },
              "height": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 7
              },
              "length": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 12
              },
              "width": {
                "type": "number",
                "minimum": 0.005,
                "maximum": 5
              },
              "color": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "accent": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "details": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "antlers",
                    "horns",
                    "long-neck",
                    "bushy-tail",
                    "stripes",
                    "spots",
                    "wader",
                    "waterfowl",
                    "raptor",
                    "parrot",
                    "long-tail"
                  ]
                }
              }
            },
            "required": [
              "family",
              "height",
              "length",
              "width",
              "color",
              "accent",
              "details"
            ],
            "additionalProperties": false
          },
          "motion": {
            "type": "string",
            "enum": [
              "walk",
              "hop",
              "fly",
              "swim",
              "crawl"
            ]
          },
          "speed": {
            "type": "number",
            "minimum": 0.01,
            "maximum": 30
          },
          "roam": {
            "type": "number",
            "minimum": 1,
            "maximum": 200
          },
          "clearance": {
            "type": "number",
            "minimum": 0,
            "maximum": 80
          },
          "rest": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "margin": {
            "type": "number",
            "minimum": 0.02,
            "maximum": 8
          }
        },
        "required": [
          "id",
          "version",
          "title",
          "body",
          "motion",
          "speed",
          "roam",
          "clearance",
          "rest",
          "margin"
        ],
        "additionalProperties": false
      }
    },
    "populations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "rules": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "animal": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
                },
                "density": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100
                },
                "habitats": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "match": {
                  "type": "object",
                  "properties": {
                    "biomes": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 14
                      }
                    },
                    "realms": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "ecoregions": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      }
                    },
                    "regions": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      }
                    }
                  },
                  "additionalProperties": false
                },
                "nearWater": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 500
                },
                "protectedOnly": {
                  "type": "boolean"
                }
              },
              "required": [
                "animal",
                "density",
                "habitats",
                "match"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "title",
          "rules"
        ],
        "additionalProperties": false
      }
    },
    "stylePack": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "format",
    "id",
    "version",
    "title",
    "requires",
    "overrides",
    "profiles",
    "scatters"
  ],
  "additionalProperties": false
}
```
