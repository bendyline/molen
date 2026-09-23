# Architectural style (`molen/archstyle@1`)

How to turn any outline into a styled building: massing, roof grammar, facade rhythm, materials, palettes, props, and detail tiers. World-agnostic; bound to places by a pack or a region atlas.

## Example

```json
{
  "format": "molen/archstyle@1",
  "id": "molen.worldgen.pnw.house",
  "title": "Pacific Northwest house",
  "doc": "Wood-sided single-family homes: steep gable and hip roofs, deep eaves, muted sage, slate, and cedar palettes, exposed foundations on slopes.",
  "version": 1,
  "applicability": {
    "classes": [
      "house",
      "detached",
      "semidetached",
      "residential",
      "bungalow",
      "yes",
      "building"
    ],
    "contextClasses": [
      "residential",
      "none"
    ],
    "areaMax": 400
  },
  "massing": {
    "floorHeight": {
      "min": 2.7,
      "max": 3.1
    },
    "heightFallback": [
      {
        "when": {
          "areaMax": 90
        },
        "levels": {
          "min": 1,
          "max": 1
        }
      },
      {
        "when": {
          "areaMax": 220
        },
        "levels": {
          "min": 1,
          "max": 2
        }
      },
      {
        "levels": {
          "min": 2,
          "max": 2
        }
      }
    ],
    "groundFit": "platform-max",
    "foundation": {
      "height": {
        "min": 0.4,
        "max": 0.9
      },
      "exposeOnSlope": true
    },
    "wings": {
      "split": "rectangles",
      "maxWingSpan": 12,
      "minWingArea": 18,
      "secondaryHeightScale": {
        "min": 0.6,
        "max": 0.95
      }
    },
    "setbacks": [],
    "respectMinHeight": true
  },
  "roof": {
    "perWing": true,
    "ridge": "long-axis",
    "overhang": {
      "min": 0.45,
      "max": 0.75
    },
    "complexFootprint": "wings",
    "choices": [
      {
        "type": "gable",
        "weight": 6,
        "pitchDeg": {
          "min": 30,
          "max": 42
        },
        "when": {
          "elongationMin": 1.15
        }
      },
      {
        "type": "hip",
        "weight": 3,
        "pitchDeg": {
          "min": 25,
          "max": 35
        }
      },
      {
        "type": "pyramid",
        "weight": 1,
        "pitchDeg": {
          "min": 25,
          "max": 32
        },
        "when": {
          "elongationMax": 1.15,
          "areaMax": 90
        }
      }
    ],
    "fallback": "flat",
    "features": {
      "dormers": {
        "probability": 0.35,
        "perRidgeMeters": 5,
        "style": "gable",
        "when": {
          "areaMin": 110
        }
      }
    }
  },
  "facade": {
    "bays": {
      "width": {
        "min": 2.6,
        "max": 3.6
      },
      "cornerMargin": 0.6
    },
    "windows": {
      "style": "punched",
      "width": {
        "min": 1,
        "max": 1.5
      },
      "height": {
        "min": 1.2,
        "max": 1.5
      },
      "sill": {
        "min": 0.8,
        "max": 1
      },
      "probabilityPerBay": 0.8,
      "groundFloor": "same"
    },
    "bands": {
      "base": {
        "height": {
          "min": 0.3,
          "max": 0.5
        }
      },
      "floorLines": false,
      "cornice": {
        "height": 0.18
      }
    }
  },
  "materials": {
    "wall": {
      "choices": [
        {
          "ref": "matgraph:molen.worldgen.material.siding_lap",
          "weight": 4
        },
        {
          "ref": "matgraph:molen.worldgen.material.siding_shingle",
          "weight": 1
        }
      ],
      "palette": "siding",
      "tint": "multiply",
      "uv": "meters",
      "uvScale": [
        3,
        2.9
      ],
      "uvOffset": "meters",
      "uvMirror": true
    },
    "roof": {
      "choices": [
        {
          "ref": "matgraph:molen.worldgen.material.shingle_asphalt",
          "weight": 1
        }
      ],
      "palette": "roof",
      "tint": "multiply",
      "uv": "meters",
      "uvScale": [
        2,
        2
      ],
      "uvOffset": "meters",
      "uvMirror": false
    },
    "trim": {
      "choices": [
        {
          "ref": "palette:#f2efe6",
          "weight": 1
        }
      ],
      "palette": "trim",
      "tint": "multiply",
      "uv": "meters",
      "uvOffset": "none",
      "uvMirror": false
    },
    "foundation": {
      "choices": [
        {
          "ref": "matgraph:molen.worldgen.material.concrete_plain",
          "weight": 1
        }
      ],
      "tint": "none",
      "uv": "meters",
      "uvScale": [
        2,
        2
      ],
      "uvOffset": "meters",
      "uvMirror": false
    }
  },
  "palettes": {
    "siding": {
      "entries": [
        {
          "color": "#8b9a7a",
          "weight": 3,
          "name": "sage"
        },
        {
          "color": "#5e6b7a",
          "weight": 3,
          "name": "slate"
        },
        {
          "color": "#a89f8e",
          "weight": 2,
          "name": "warm grey"
        },
        {
          "color": "#7a5a45",
          "weight": 2,
          "name": "cedar"
        },
        {
          "color": "#ece7dc",
          "weight": 1,
          "name": "cream"
        }
      ],
      "jitter": {
        "hue": 0.015,
        "saturation": 0.06,
        "lightness": 0.06
      }
    },
    "roof": {
      "entries": [
        {
          "color": "#3f4245",
          "weight": 5
        },
        {
          "color": "#5a4a3c",
          "weight": 2
        },
        {
          "color": "#2f3a34",
          "weight": 2
        }
      ],
      "jitter": {
        "hue": 0.01,
        "saturation": 0.04,
        "lightness": 0.05
      }
    },
    "trim": {
      "entries": [
        {
          "color": "#f4f1ea",
          "weight": 4
        },
        {
          "color": "#d9d4c7",
          "weight": 1
        }
      ],
      "jitter": {
        "hue": 0,
        "saturation": 0.02,
        "lightness": 0.03
      }
    }
  },
  "props": [
    {
      "id": "chimney",
      "model": "molen.worldgen.prop.chimney.brick",
      "anchor": "roof-ridge",
      "probability": 0.55,
      "count": {
        "min": 1,
        "max": 1
      },
      "roof": [
        "gable",
        "hip"
      ],
      "spacing": 4,
      "margin": 1.2,
      "scale": {
        "min": 0.9,
        "max": 1.1
      },
      "yaw": "align-wall",
      "lodTier": 0
    }
  ],
  "lod": {
    "tiers": [
      {
        "minTier": 0,
        "keep": [
          "roof-shape",
          "roof-features",
          "facade-texture",
          "facade-bands",
          "props"
        ]
      },
      {
        "minTier": 1,
        "keep": [
          "roof-shape",
          "facade-texture"
        ]
      },
      {
        "minTier": 2,
        "keep": [
          "roof-shape"
        ]
      }
    ]
  }
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
      "const": "molen/archstyle@1",
      "description": "Format envelope; always 'molen/archstyle@1'."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Style id under the pack namespace, e.g. 'molen.worldgen.pnw.house'."
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Human title."
    },
    "doc": {
      "type": "string",
      "description": "What the style looks like and where it applies."
    },
    "version": {
      "default": 1,
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991,
      "description": "Bump to re-roll every building using this style."
    },
    "applicability": {
      "type": "object",
      "properties": {
        "classes": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "description": "Labels this style is meant for."
        },
        "contextClasses": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "description": "Surrounding labels it suits."
        },
        "areaMin": {
          "type": "number",
          "minimum": 0,
          "description": "Smallest suitable footprint, m²."
        },
        "areaMax": {
          "type": "number",
          "minimum": 0,
          "description": "Largest suitable footprint, m²."
        },
        "notes": {
          "type": "string"
        }
      },
      "required": [
        "classes"
      ],
      "additionalProperties": false
    },
    "massing": {
      "type": "object",
      "properties": {
        "floorHeight": {
          "type": "object",
          "properties": {
            "min": {
              "type": "number",
              "description": "Minimum floor height in meters."
            },
            "max": {
              "type": "number",
              "description": "Maximum floor height in meters (>= min)."
            }
          },
          "required": [
            "min",
            "max"
          ],
          "description": "Sampled once per building."
        },
        "groundFloorHeight": {
          "type": "object",
          "properties": {
            "min": {
              "type": "number",
              "description": "Minimum ground floor height in meters."
            },
            "max": {
              "type": "number",
              "description": "Maximum ground floor height in meters (>= min)."
            }
          },
          "required": [
            "min",
            "max"
          ],
          "description": "Ground floor height; defaults to floorHeight."
        },
        "heightFallback": {
          "minItems": 1,
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
                "description": "Conditions; omit on the last (catch-all) rule."
              },
              "levels": {
                "type": "object",
                "properties": {
                  "min": {
                    "type": "number",
                    "description": "Minimum floor count."
                  },
                  "max": {
                    "type": "number",
                    "description": "Maximum floor count (>= min)."
                  }
                },
                "required": [
                  "min",
                  "max"
                ],
                "description": "Floor count range to sample from."
              },
              "height": {
                "type": "object",
                "properties": {
                  "min": {
                    "type": "number",
                    "description": "Minimum height in meters."
                  },
                  "max": {
                    "type": "number",
                    "description": "Maximum height in meters (>= min)."
                  }
                },
                "required": [
                  "min",
                  "max"
                ],
                "description": "Height range in meters to sample from."
              }
            },
            "additionalProperties": false
          },
          "description": "Used only when a request has neither height nor levels; ordered, first match wins, the last rule must have no \"when\"."
        },
        "groundFit": {
          "default": "platform-average",
          "type": "string",
          "enum": [
            "platform-average",
            "platform-max",
            "platform-min"
          ],
          "description": "How the platform height follows the terrain under the outline."
        },
        "foundation": {
          "type": "object",
          "properties": {
            "height": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum exposed foundation height in meters."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum exposed foundation height in meters (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ]
            },
            "exposeOnSlope": {
              "default": true,
              "type": "boolean",
              "description": "Emit a foundation skirt where the ground falls below the platform."
            }
          },
          "required": [
            "height"
          ],
          "additionalProperties": false
        },
        "wings": {
          "type": "object",
          "properties": {
            "split": {
              "default": "rectangles",
              "type": "string",
              "enum": [
                "none",
                "rectangles"
              ],
              "description": "'rectangles' decomposes L/T/U/... outlines into roof wings."
            },
            "maxWingSpan": {
              "default": 14,
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Widest wing (meters) that still gets a pitched roof; wider wings go flat."
            },
            "minWingArea": {
              "default": 12,
              "type": "number",
              "minimum": 0,
              "description": "Wings smaller than this (m²) are dropped from the roof."
            },
            "secondaryHeightScale": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum secondary wing height scale, 0..1."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum secondary wing height scale, 0..1 (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ],
              "description": "Height of non-dominant wings relative to the main wing."
            }
          },
          "required": [
            "secondaryHeightScale"
          ],
          "additionalProperties": false
        },
        "setbacks": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "aboveHeight": {
                "type": "number",
                "minimum": 0,
                "description": "Height in meters above which the setback applies."
              },
              "inset": {
                "type": "number",
                "minimum": 0,
                "description": "Inset in meters."
              }
            },
            "required": [
              "aboveHeight",
              "inset"
            ],
            "additionalProperties": false
          },
          "description": "Stepped insets for tall buildings, lowest first."
        },
        "respectMinHeight": {
          "default": true,
          "type": "boolean",
          "description": "Honor a request minHeight (raised parts) instead of grounding everything."
        }
      },
      "required": [
        "floorHeight",
        "heightFallback",
        "foundation",
        "wings"
      ],
      "additionalProperties": false
    },
    "roof": {
      "type": "object",
      "properties": {
        "perWing": {
          "default": true,
          "type": "boolean",
          "description": "One roof per wing (true) or one over the main wing."
        },
        "ridge": {
          "default": "long-axis",
          "type": "string",
          "enum": [
            "long-axis",
            "short-axis"
          ],
          "description": "Default ridge orientation."
        },
        "overhang": {
          "type": "object",
          "properties": {
            "min": {
              "type": "number",
              "description": "Minimum default eave overhang in meters."
            },
            "max": {
              "type": "number",
              "description": "Maximum default eave overhang in meters (>= min)."
            }
          },
          "required": [
            "min",
            "max"
          ]
        },
        "complexFootprint": {
          "default": "wings",
          "type": "string",
          "enum": [
            "flat",
            "wings"
          ],
          "description": "Roof for outlines that cannot be decomposed: flat, or roofs over whatever wings exist."
        },
        "choices": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "flat",
                  "gable",
                  "hip",
                  "pyramid",
                  "shed",
                  "mansard",
                  "gambrel"
                ],
                "description": "Roof form."
              },
              "weight": {
                "type": "number",
                "minimum": 0,
                "maximum": 1000,
                "description": "Relative weight among sibling entries; 0 disables the entry."
              },
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
                "description": "Eligibility, e.g. elongationMin for gables."
              },
              "pitchDeg": {
                "type": "object",
                "properties": {
                  "min": {
                    "type": "number",
                    "description": "Minimum roof pitch in degrees (5..75)."
                  },
                  "max": {
                    "type": "number",
                    "description": "Maximum roof pitch in degrees (5..75) (>= min)."
                  }
                },
                "required": [
                  "min",
                  "max"
                ],
                "description": "Required for every type except flat."
              },
              "lowerPitchDeg": {
                "type": "object",
                "properties": {
                  "min": {
                    "type": "number",
                    "description": "Minimum lower slope pitch in degrees (mansard, gambrel)."
                  },
                  "max": {
                    "type": "number",
                    "description": "Maximum lower slope pitch in degrees (mansard, gambrel) (>= min)."
                  }
                },
                "required": [
                  "min",
                  "max"
                ]
              },
              "overhang": {
                "type": "object",
                "properties": {
                  "min": {
                    "type": "number",
                    "description": "Minimum eave overhang in meters."
                  },
                  "max": {
                    "type": "number",
                    "description": "Maximum eave overhang in meters (>= min)."
                  }
                },
                "required": [
                  "min",
                  "max"
                ],
                "description": "Overrides roof.overhang."
              },
              "ridge": {
                "type": "string",
                "enum": [
                  "long-axis",
                  "short-axis"
                ],
                "description": "Ridge orientation relative to the wing."
              },
              "parapet": {
                "type": "object",
                "properties": {
                  "height": {
                    "type": "object",
                    "properties": {
                      "min": {
                        "type": "number",
                        "description": "Minimum parapet height in meters."
                      },
                      "max": {
                        "type": "number",
                        "description": "Maximum parapet height in meters (>= min)."
                      }
                    },
                    "required": [
                      "min",
                      "max"
                    ]
                  },
                  "thickness": {
                    "default": 0.3,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "description": "Parapet thickness in meters."
                  }
                },
                "required": [
                  "height"
                ],
                "additionalProperties": false,
                "description": "Flat roofs only."
              },
              "shedDirection": {
                "type": "string",
                "enum": [
                  "downhill",
                  "random",
                  "long-axis"
                ],
                "description": "Which way a shed roof rises."
              }
            },
            "required": [
              "type",
              "weight"
            ],
            "additionalProperties": false
          },
          "description": "Weighted roof forms; eligible ones are drawn by weight."
        },
        "fallback": {
          "default": "flat",
          "type": "string",
          "const": "flat",
          "description": "Always constructible fallback."
        },
        "features": {
          "type": "object",
          "properties": {
            "dormers": {
              "type": "object",
              "properties": {
                "probability": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "Chance a qualifying building gets dormers."
                },
                "perRidgeMeters": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "description": "One dormer per this many ridge meters."
                },
                "style": {
                  "type": "string",
                  "enum": [
                    "gable",
                    "shed"
                  ],
                  "description": "Dormer roof form."
                },
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
                  "additionalProperties": false
                }
              },
              "required": [
                "probability",
                "perRidgeMeters",
                "style"
              ],
              "additionalProperties": false
            }
          },
          "additionalProperties": false
        }
      },
      "required": [
        "overhang",
        "choices"
      ],
      "additionalProperties": false
    },
    "facade": {
      "type": "object",
      "properties": {
        "details": {
          "type": "object",
          "properties": {
            "shutters": {
              "type": "boolean",
              "description": "Paired louvered shutters beside punched windows."
            },
            "balconies": {
              "type": "object",
              "properties": {
                "depth": {
                  "default": 0.7,
                  "type": "number",
                  "minimum": 0.25,
                  "maximum": 2,
                  "description": "Balcony projection in meters."
                },
                "railing": {
                  "default": "open",
                  "type": "string",
                  "enum": [
                    "open",
                    "solid"
                  ],
                  "description": "Slender rails or a solid parapet."
                },
                "every": {
                  "default": 1,
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 8,
                  "description": "One balcony per this many upper-floor window bays."
                }
              },
              "additionalProperties": false
            },
            "framing": {
              "type": "object",
              "properties": {
                "style": {
                  "type": "string",
                  "enum": [
                    "timber",
                    "pilasters"
                  ],
                  "description": "Exposed half-timber framing or classical pilasters."
                },
                "width": {
                  "default": 0.16,
                  "type": "number",
                  "minimum": 0.08,
                  "maximum": 0.5,
                  "description": "Member width in meters; fitted to available wall."
                }
              },
              "required": [
                "style"
              ],
              "additionalProperties": false
            },
            "awnings": {
              "type": "object",
              "properties": {
                "depth": {
                  "default": 0.9,
                  "type": "number",
                  "minimum": 0.25,
                  "maximum": 2,
                  "description": "Sloping canopy projection above windows, meters."
                }
              },
              "additionalProperties": false
            },
            "veranda": {
              "type": "object",
              "properties": {
                "depth": {
                  "default": 1.4,
                  "type": "number",
                  "minimum": 0.5,
                  "maximum": 3,
                  "description": "Ground veranda canopy projection, meters."
                },
                "columns": {
                  "default": true,
                  "type": "boolean",
                  "description": "Support the canopy with slender posts."
                }
              },
              "additionalProperties": false
            }
          },
          "additionalProperties": false,
          "description": "Optional near-detail geometry fitted to the live outline and openings; follows facade-bands LOD."
        },
        "bays": {
          "type": "object",
          "properties": {
            "width": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum window bay width in meters."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum window bay width in meters (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ]
            },
            "cornerMargin": {
              "default": 0.5,
              "type": "number",
              "minimum": 0,
              "description": "Blank wall at each corner, meters."
            }
          },
          "required": [
            "width"
          ],
          "additionalProperties": false
        },
        "windows": {
          "type": "object",
          "properties": {
            "style": {
              "default": "punched",
              "type": "string",
              "enum": [
                "punched",
                "ribbon",
                "grid",
                "none"
              ],
              "description": "Window rhythm; none omits upper windows but still allows ground-floor storefronts."
            },
            "width": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum window width in meters; also controls storefront pane spacing."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum window width in meters; also controls storefront pane spacing (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ]
            },
            "height": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum window height in meters; caps storefront glazing below the solid wall above."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum window height in meters; caps storefront glazing below the solid wall above (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ]
            },
            "sill": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "number",
                  "description": "Minimum sill height above the floor in meters."
                },
                "max": {
                  "type": "number",
                  "description": "Maximum sill height above the floor in meters (>= min)."
                }
              },
              "required": [
                "min",
                "max"
              ]
            },
            "probabilityPerBay": {
              "default": 0.8,
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Chance each bay carries a window."
            },
            "groundFloor": {
              "default": "same",
              "type": "string",
              "enum": [
                "same",
                "storefront",
                "none"
              ],
              "description": "Ground floor treatment."
            }
          },
          "required": [
            "width",
            "height",
            "sill"
          ],
          "additionalProperties": false
        },
        "bands": {
          "type": "object",
          "properties": {
            "base": {
              "type": "object",
              "properties": {
                "height": {
                  "type": "object",
                  "properties": {
                    "min": {
                      "type": "number",
                      "description": "Minimum base band height in meters."
                    },
                    "max": {
                      "type": "number",
                      "description": "Maximum base band height in meters (>= min)."
                    }
                  },
                  "required": [
                    "min",
                    "max"
                  ]
                }
              },
              "required": [
                "height"
              ],
              "additionalProperties": false
            },
            "floorLines": {
              "default": false,
              "type": "boolean",
              "description": "Emit a trim line at each floor."
            },
            "cornice": {
              "type": "object",
              "properties": {
                "height": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "description": "Cornice height in meters."
                }
              },
              "required": [
                "height"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "base"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "bays",
        "windows",
        "bands"
      ],
      "additionalProperties": false
    },
    "materials": {
      "type": "object",
      "properties": {
        "wall": {
          "type": "object",
          "properties": {
            "choices": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ref": {
                    "type": "string",
                    "pattern": "^(palette:#[0-9a-fA-F]{6}|matgraph:\\S+|pixelgrid:\\S+)$",
                    "description": "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'."
                  },
                  "weight": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000,
                    "description": "Relative weight among sibling entries; 0 disables the entry."
                  }
                },
                "required": [
                  "ref",
                  "weight"
                ],
                "additionalProperties": false
              },
              "description": "Weighted materials; one is picked per building."
            },
            "palette": {
              "type": "string",
              "minLength": 1,
              "description": "Key of `palettes` used to tint this part."
            },
            "tint": {
              "default": "multiply",
              "type": "string",
              "enum": [
                "multiply",
                "none"
              ],
              "description": "'multiply' = vertex color times texture (author textures light); 'none' = texture as is."
            },
            "uv": {
              "default": "meters",
              "type": "string",
              "enum": [
                "meters",
                "cell"
              ],
              "description": "'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell."
            },
            "uvScale": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "description": "Meters per texture repeat [u, v] when uv is meters."
            },
            "uvOffset": {
              "default": "meters",
              "type": "string",
              "enum": [
                "cell",
                "meters",
                "none"
              ],
              "description": "Seeded per-building UV shift so neighbours never align."
            },
            "uvMirror": {
              "default": false,
              "type": "boolean",
              "description": "Allow a seeded horizontal flip."
            }
          },
          "required": [
            "choices"
          ],
          "additionalProperties": false
        },
        "roof": {
          "type": "object",
          "properties": {
            "choices": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ref": {
                    "type": "string",
                    "pattern": "^(palette:#[0-9a-fA-F]{6}|matgraph:\\S+|pixelgrid:\\S+)$",
                    "description": "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'."
                  },
                  "weight": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000,
                    "description": "Relative weight among sibling entries; 0 disables the entry."
                  }
                },
                "required": [
                  "ref",
                  "weight"
                ],
                "additionalProperties": false
              },
              "description": "Weighted materials; one is picked per building."
            },
            "palette": {
              "type": "string",
              "minLength": 1,
              "description": "Key of `palettes` used to tint this part."
            },
            "tint": {
              "default": "multiply",
              "type": "string",
              "enum": [
                "multiply",
                "none"
              ],
              "description": "'multiply' = vertex color times texture (author textures light); 'none' = texture as is."
            },
            "uv": {
              "default": "meters",
              "type": "string",
              "enum": [
                "meters",
                "cell"
              ],
              "description": "'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell."
            },
            "uvScale": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "description": "Meters per texture repeat [u, v] when uv is meters."
            },
            "uvOffset": {
              "default": "meters",
              "type": "string",
              "enum": [
                "cell",
                "meters",
                "none"
              ],
              "description": "Seeded per-building UV shift so neighbours never align."
            },
            "uvMirror": {
              "default": false,
              "type": "boolean",
              "description": "Allow a seeded horizontal flip."
            }
          },
          "required": [
            "choices"
          ],
          "additionalProperties": false
        },
        "trim": {
          "type": "object",
          "properties": {
            "choices": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ref": {
                    "type": "string",
                    "pattern": "^(palette:#[0-9a-fA-F]{6}|matgraph:\\S+|pixelgrid:\\S+)$",
                    "description": "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'."
                  },
                  "weight": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000,
                    "description": "Relative weight among sibling entries; 0 disables the entry."
                  }
                },
                "required": [
                  "ref",
                  "weight"
                ],
                "additionalProperties": false
              },
              "description": "Weighted materials; one is picked per building."
            },
            "palette": {
              "type": "string",
              "minLength": 1,
              "description": "Key of `palettes` used to tint this part."
            },
            "tint": {
              "default": "multiply",
              "type": "string",
              "enum": [
                "multiply",
                "none"
              ],
              "description": "'multiply' = vertex color times texture (author textures light); 'none' = texture as is."
            },
            "uv": {
              "default": "meters",
              "type": "string",
              "enum": [
                "meters",
                "cell"
              ],
              "description": "'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell."
            },
            "uvScale": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "description": "Meters per texture repeat [u, v] when uv is meters."
            },
            "uvOffset": {
              "default": "meters",
              "type": "string",
              "enum": [
                "cell",
                "meters",
                "none"
              ],
              "description": "Seeded per-building UV shift so neighbours never align."
            },
            "uvMirror": {
              "default": false,
              "type": "boolean",
              "description": "Allow a seeded horizontal flip."
            }
          },
          "required": [
            "choices"
          ],
          "additionalProperties": false
        },
        "foundation": {
          "type": "object",
          "properties": {
            "choices": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ref": {
                    "type": "string",
                    "pattern": "^(palette:#[0-9a-fA-F]{6}|matgraph:\\S+|pixelgrid:\\S+)$",
                    "description": "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'."
                  },
                  "weight": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000,
                    "description": "Relative weight among sibling entries; 0 disables the entry."
                  }
                },
                "required": [
                  "ref",
                  "weight"
                ],
                "additionalProperties": false
              },
              "description": "Weighted materials; one is picked per building."
            },
            "palette": {
              "type": "string",
              "minLength": 1,
              "description": "Key of `palettes` used to tint this part."
            },
            "tint": {
              "default": "multiply",
              "type": "string",
              "enum": [
                "multiply",
                "none"
              ],
              "description": "'multiply' = vertex color times texture (author textures light); 'none' = texture as is."
            },
            "uv": {
              "default": "meters",
              "type": "string",
              "enum": [
                "meters",
                "cell"
              ],
              "description": "'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell."
            },
            "uvScale": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "description": "Meters per texture repeat [u, v] when uv is meters."
            },
            "uvOffset": {
              "default": "meters",
              "type": "string",
              "enum": [
                "cell",
                "meters",
                "none"
              ],
              "description": "Seeded per-building UV shift so neighbours never align."
            },
            "uvMirror": {
              "default": false,
              "type": "boolean",
              "description": "Allow a seeded horizontal flip."
            }
          },
          "required": [
            "choices"
          ],
          "additionalProperties": false
        },
        "window": {
          "type": "object",
          "properties": {
            "choices": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ref": {
                    "type": "string",
                    "pattern": "^(palette:#[0-9a-fA-F]{6}|matgraph:\\S+|pixelgrid:\\S+)$",
                    "description": "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'."
                  },
                  "weight": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000,
                    "description": "Relative weight among sibling entries; 0 disables the entry."
                  }
                },
                "required": [
                  "ref",
                  "weight"
                ],
                "additionalProperties": false
              },
              "description": "Weighted materials; one is picked per building."
            },
            "palette": {
              "type": "string",
              "minLength": 1,
              "description": "Key of `palettes` used to tint this part."
            },
            "tint": {
              "default": "multiply",
              "type": "string",
              "enum": [
                "multiply",
                "none"
              ],
              "description": "'multiply' = vertex color times texture (author textures light); 'none' = texture as is."
            },
            "uv": {
              "default": "meters",
              "type": "string",
              "enum": [
                "meters",
                "cell"
              ],
              "description": "'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell."
            },
            "uvScale": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "description": "Meters per texture repeat [u, v] when uv is meters."
            },
            "uvOffset": {
              "default": "meters",
              "type": "string",
              "enum": [
                "cell",
                "meters",
                "none"
              ],
              "description": "Seeded per-building UV shift so neighbours never align."
            },
            "uvMirror": {
              "default": false,
              "type": "boolean",
              "description": "Allow a seeded horizontal flip."
            }
          },
          "required": [
            "choices"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "wall",
        "roof",
        "trim",
        "foundation"
      ],
      "additionalProperties": false
    },
    "palettes": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "entries": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "color": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "'#rrggbb' color."
                },
                "weight": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1000,
                  "description": "Relative weight among sibling entries; 0 disables the entry."
                },
                "name": {
                  "type": "string"
                }
              },
              "required": [
                "color",
                "weight"
              ],
              "additionalProperties": false
            }
          },
          "jitter": {
            "type": "object",
            "properties": {
              "hue": {
                "default": 0,
                "type": "number",
                "minimum": 0,
                "maximum": 0.5,
                "description": "Hue jitter, ± fraction of the wheel (0..0.5)."
              },
              "saturation": {
                "default": 0,
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Saturation jitter, ± (0..1)."
              },
              "lightness": {
                "default": 0,
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Lightness jitter, ± (0..1)."
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "entries",
          "jitter"
        ],
        "additionalProperties": false
      },
      "description": "Named color palettes referenced by parts and props."
    },
    "props": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]*$",
            "description": "Prop id, unique within the style."
          },
          "model": {
            "type": "string",
            "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$",
            "description": "Model: an asset id (e.g. 'molen.worldgen.prop.chimney.brick') or 'builtin:<name>'."
          },
          "anchor": {
            "type": "string",
            "enum": [
              "roof-ridge",
              "roof-flat",
              "roof-edge",
              "wall-any",
              "ground-any"
            ],
            "description": "Where instances attach."
          },
          "probability": {
            "default": 1,
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Chance the building gets this prop at all."
          },
          "count": {
            "type": "object",
            "properties": {
              "min": {
                "type": "number",
                "description": "Minimum instance count."
              },
              "max": {
                "type": "number",
                "description": "Maximum instance count (>= min)."
              }
            },
            "required": [
              "min",
              "max"
            ]
          },
          "perAreaM2": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "When set, count = clamp(round(area / perAreaM2), count.min, count.max)."
          },
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
            "additionalProperties": false
          },
          "roof": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "flat",
                "gable",
                "hip",
                "pyramid",
                "shed",
                "mansard",
                "gambrel"
              ]
            },
            "description": "Only on these roof forms."
          },
          "spacing": {
            "default": 2,
            "type": "number",
            "minimum": 0,
            "description": "Minimum spacing between instances, meters."
          },
          "margin": {
            "default": 0.5,
            "type": "number",
            "minimum": 0,
            "description": "Distance from edges, meters."
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
          "yaw": {
            "default": "align-wall",
            "type": "string",
            "enum": [
              "align-wall",
              "random",
              "fixed"
            ],
            "description": "Orientation policy."
          },
          "tintPalette": {
            "type": "string",
            "description": "Palette key for instance tint."
          },
          "lodTier": {
            "default": 0,
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Highest detail tier that still shows this prop."
          }
        },
        "required": [
          "id",
          "model",
          "anchor",
          "count",
          "scale"
        ],
        "additionalProperties": false
      },
      "description": "Attached props (chimneys, rooftop units, ...)."
    },
    "lod": {
      "type": "object",
      "properties": {
        "tiers": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "minTier": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991,
                "description": "Detail tier this entry applies from (0 = full detail)."
              },
              "keep": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "roof-shape",
                    "roof-features",
                    "facade-texture",
                    "facade-bands",
                    "props"
                  ]
                },
                "description": "Features kept at this tier."
              }
            },
            "required": [
              "minTier",
              "keep"
            ],
            "additionalProperties": false
          },
          "description": "Ordered by minTier; beyond the last tier the building is a tinted box."
        }
      },
      "required": [
        "tiers"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "format",
    "id",
    "title",
    "applicability",
    "massing",
    "roof",
    "facade",
    "materials",
    "lod"
  ],
  "additionalProperties": false
}
```
