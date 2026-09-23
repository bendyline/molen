# Worldgen batch (`molen/worldgen-batch@1`)

A serialized generation request: labeled building outlines, optional labeled polygons and exclusions for scatter, style rules, and a synthetic ground. Used as fixture, preview and bake input, and worker payload.

## Example

```json
{
  "format": "molen/worldgen-batch@1",
  "name": "two houses",
  "ground": {
    "kind": "flat",
    "height": 0
  },
  "buildings": [
    {
      "identity": "room:hall-1",
      "labels": [
        "hall"
      ],
      "outline": [
        [
          0,
          0
        ],
        [
          14,
          0
        ],
        [
          14,
          8
        ],
        [
          0,
          8
        ]
      ],
      "levels": 2
    },
    {
      "identity": "f:42",
      "labels": [
        "house",
        "building"
      ],
      "context": "residential",
      "outline": [
        [
          20,
          0
        ],
        [
          32,
          0
        ],
        [
          32,
          6
        ],
        [
          26,
          6
        ],
        [
          26,
          12
        ],
        [
          20,
          12
        ]
      ]
    }
  ],
  "tier": 0
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
      "const": "molen/worldgen-batch@1",
      "description": "Format envelope; always 'molen/worldgen-batch@1'."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Fixture name."
    },
    "ground": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "flat",
            "slope"
          ],
          "description": "Flat plane or a plane rising by dx/dz per meter."
        },
        "height": {
          "default": 0,
          "type": "number",
          "description": "Ground height at the origin, meters."
        },
        "dx": {
          "default": 0,
          "type": "number",
          "description": "Rise per meter along +x (slope only)."
        },
        "dz": {
          "default": 0,
          "type": "number",
          "description": "Rise per meter along +z (slope only)."
        }
      },
      "required": [
        "kind"
      ],
      "additionalProperties": false,
      "description": "Synthetic ground under the batch."
    },
    "buildings": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "identity": {
            "type": "string",
            "minLength": 1,
            "description": "Caller-owned stable identity, e.g. 'f:123' or 'room:hall-1'."
          },
          "labels": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "description": "Category labels, most specific first."
          },
          "context": {
            "type": "string",
            "minLength": 1,
            "description": "Surrounding label (e.g. land class)."
          },
          "appearance": {
            "type": "object",
            "properties": {
              "wall": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "trim": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              }
            },
            "additionalProperties": false
          },
          "storefronts": {
            "maxItems": 12,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "identity": {
                  "type": "string",
                  "minLength": 1
                },
                "at": {
                  "type": "array",
                  "prefixItems": [
                    {
                      "type": "number"
                    },
                    {
                      "type": "number"
                    }
                  ],
                  "items": false,
                  "minItems": 2,
                  "maxItems": 2,
                  "description": "Desired frontage anchor in local meters; projected to a non-seam exterior edge."
                },
                "signModel": {
                  "type": "string",
                  "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$"
                },
                "signSize": {
                  "type": "array",
                  "prefixItems": [
                    {
                      "type": "number",
                      "exclusiveMinimum": 0
                    },
                    {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  ],
                  "items": false,
                  "minItems": 2,
                  "maxItems": 2
                },
                "accent": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "width": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100
                }
              },
              "required": [
                "identity",
                "at",
                "signModel",
                "accent"
              ],
              "additionalProperties": false
            }
          },
          "interiorLabels": {
            "maxItems": 32,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "outline": {
            "minItems": 3,
            "type": "array",
            "items": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "[x, z] in local meters."
            },
            "description": "Open ring of [x, z] points (no repeated closing point)."
          },
          "holes": {
            "type": "array",
            "items": {
              "minItems": 3,
              "type": "array",
              "items": {
                "minItems": 2,
                "maxItems": 2,
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "[x, z] in local meters."
              },
              "description": "Open ring of [x, z] points (no repeated closing point)."
            }
          },
          "groundOutline": {
            "minItems": 3,
            "type": "array",
            "items": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "[x, z] in local meters."
            },
            "description": "Shared ground-fitting footprint for related parts."
          },
          "height": {
            "type": "number",
            "minimum": 0,
            "description": "Known total height above the base, including the roof and minimum height, meters."
          },
          "levels": {
            "type": "number",
            "minimum": 0,
            "description": "Known floor count."
          },
          "minHeight": {
            "type": "number",
            "minimum": 0,
            "description": "Lowest floor above the base, meters."
          },
          "clipped": {
            "type": "boolean",
            "description": "The outline is a cut piece: flat roof and seam walls."
          },
          "seamEdges": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            },
            "description": "Outline edge indices on the cut boundary."
          },
          "style": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "Explicit archstyle id (bypasses rules)."
          }
        },
        "required": [
          "identity",
          "labels",
          "outline"
        ],
        "additionalProperties": false
      }
    },
    "scatter": {
      "type": "object",
      "properties": {
        "polygons": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "minLength": 1,
                "description": "Land label the scatter rules match against."
              },
              "ring": {
                "minItems": 3,
                "type": "array",
                "items": {
                  "minItems": 2,
                  "maxItems": 2,
                  "type": "array",
                  "items": {
                    "type": "number"
                  },
                  "description": "[x, z] in local meters."
                },
                "description": "Open ring of [x, z] points (no repeated closing point)."
              },
              "holes": {
                "type": "array",
                "items": {
                  "minItems": 3,
                  "type": "array",
                  "items": {
                    "minItems": 2,
                    "maxItems": 2,
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "[x, z] in local meters."
                  },
                  "description": "Open ring of [x, z] points (no repeated closing point)."
                }
              },
              "density": {
                "type": "number",
                "minimum": 0,
                "description": "Density multiplier (default 1)."
              },
              "seed": {
                "type": "integer",
                "minimum": 0,
                "maximum": 4294967295,
                "description": "Owner seed for acceptance and appearance on the shared placement grid."
              }
            },
            "required": [
              "label",
              "ring"
            ],
            "additionalProperties": false
          }
        },
        "exclusions": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "ring": {
                "minItems": 3,
                "type": "array",
                "items": {
                  "minItems": 2,
                  "maxItems": 2,
                  "type": "array",
                  "items": {
                    "type": "number"
                  },
                  "description": "[x, z] in local meters."
                },
                "description": "Open ring of [x, z] points (no repeated closing point)."
              },
              "polyline": {
                "minItems": 2,
                "type": "array",
                "items": {
                  "minItems": 2,
                  "maxItems": 2,
                  "type": "array",
                  "items": {
                    "type": "number"
                  },
                  "description": "[x, z] in local meters."
                }
              },
              "width": {
                "type": "number",
                "minimum": 0,
                "description": "Polyline width, meters."
              },
              "radius": {
                "type": "number",
                "minimum": 0,
                "description": "Clearance around the shape, meters."
              },
              "kind": {
                "type": "string",
                "enum": [
                  "roads",
                  "buildings",
                  "water"
                ]
              }
            },
            "required": [
              "radius"
            ],
            "additionalProperties": false
          }
        },
        "emitBounds": {
          "minItems": 4,
          "maxItems": 4,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "[minX, minZ, maxX, maxZ] local meters."
        },
        "frame": {
          "type": "object",
          "properties": {
            "originX": {
              "default": 0,
              "type": "number"
            },
            "originZ": {
              "default": 0,
              "type": "number"
            },
            "unitsPerMeter": {
              "default": 1,
              "type": "number",
              "exclusiveMinimum": 0
            }
          },
          "additionalProperties": false
        },
        "keep": {
          "default": 1,
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 1,
          "description": "Detail keep fraction in (0, 1]."
        }
      },
      "required": [
        "polygons",
        "emitBounds",
        "frame"
      ],
      "additionalProperties": false
    },
    "props": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "identity": {
            "type": "string",
            "minLength": 1
          },
          "model": {
            "type": "string",
            "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$"
          },
          "at": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number"
              },
              {
                "type": "number"
              }
            ],
            "items": false,
            "minItems": 2,
            "maxItems": 2
          },
          "yaw": {
            "type": "number"
          },
          "scale": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              }
            ],
            "items": false,
            "minItems": 3,
            "maxItems": 3
          }
        },
        "required": [
          "identity",
          "model",
          "at"
        ],
        "additionalProperties": false
      }
    },
    "rules": {
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
      },
      "description": "Style rules for this batch (before pack defaults)."
    },
    "fallbackStyle": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Archstyle when nothing matches."
    },
    "scatterId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Scatter rule set to use."
    },
    "tier": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Detail tier to generate at (0 = full)."
    },
    "interiors": {
      "type": "boolean",
      "description": "Cut real ground-floor openings and emit lazy interior descriptors."
    }
  },
  "required": [
    "format",
    "name",
    "ground"
  ],
  "additionalProperties": false
}
```
