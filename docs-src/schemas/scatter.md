# Scatter rules (`molen/scatter@1`)

Label-keyed deterministic prop placement (density, clustering, slope and clearance limits, weighted species with jitter, detail tiers) plus per-label surface colors.

## Example

```json
{
  "format": "molen/scatter@1",
  "id": "molen.worldgen.scatter.pnw",
  "title": "Pacific Northwest vegetation",
  "version": 1,
  "surface": {
    "default": "#6f7d64",
    "colors": {
      "forest": "#3f6347",
      "wood": "#3a5f43",
      "grassland": "#7d9562",
      "grass": "#79915e",
      "farmland": "#999866",
      "scrub": "#6e8060",
      "park": "#64845c",
      "residential": "#8a8b7f",
      "commercial": "#8d8a84",
      "industrial": "#827c72",
      "urban_area": "#85857d",
      "beach": "#c0ae7d",
      "sand": "#b6a777",
      "glacier": "#d7e3e5",
      "barren": "#8a806c",
      "wetland": "#6e8a72"
    }
  },
  "defaults": {
    "avoid": {
      "roads": 5,
      "buildings": 3,
      "water": 1.5
    },
    "slopeMax": 0.75,
    "lod": {
      "keepByTier": [
        1,
        0.45,
        0.18,
        0.06
      ],
      "maxInstancesPerBatch": 6000
    }
  },
  "rules": [
    {
      "id": "conifer-forest",
      "classes": [
        "forest",
        "wood"
      ],
      "densityPerHectare": 140,
      "minSpacing": 3.2,
      "clustering": {
        "scale": 160,
        "threshold": 0.35,
        "contrast": 1.4,
        "seedOffset": 0
      },
      "slopeMax": 0.8,
      "altitude": {
        "max": 1700
      },
      "populations": [
        {
          "model": "molen.entities.tree.conifer.fir",
          "weight": 6,
          "scale": {
            "min": 0.85,
            "max": 1.4
          },
          "yaw": "random",
          "align": "up",
          "tint": {
            "hue": 0.02,
            "saturation": 0.08,
            "lightness": 0.08
          }
        },
        {
          "model": "molen.entities.tree.conifer.pine",
          "weight": 3,
          "scale": {
            "min": 0.8,
            "max": 1.3
          },
          "yaw": "random",
          "align": "up"
        }
      ]
    },
    {
      "id": "park-trees",
      "classes": [
        "park",
        "garden",
        "cemetery",
        "grass",
        "meadow"
      ],
      "densityPerHectare": 18,
      "minSpacing": 6,
      "populations": [
        {
          "model": "molen.entities.tree.deciduous.oak",
          "weight": 3,
          "scale": {
            "min": 0.8,
            "max": 1.2
          },
          "yaw": "random",
          "align": "up"
        }
      ]
    }
  ]
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
              "groundcover"
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
                    "none"
                  ],
                  "description": "Random heading or fixed."
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
```
