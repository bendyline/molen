# Procedural material graph (`molen/matgraph@1`)

A small node graph (noise, gradients, ramps, blends) CPU-rasterized to textures.

## Example

```json
{
  "format": "molen/matgraph@1",
  "size": [
    256,
    256
  ],
  "seed": 1337,
  "nodes": [
    {
      "id": "n1",
      "type": "noise",
      "params": {
        "kind": "simplex",
        "octaves": 5,
        "scale": 4
      }
    },
    {
      "id": "n2",
      "type": "ramp",
      "input": "n1",
      "params": {
        "stops": [
          {
            "t": 0,
            "color": "#4a4a52"
          },
          {
            "t": 0.6,
            "color": "#6e6a63"
          },
          {
            "t": 1,
            "color": "#9a948a"
          }
        ]
      }
    }
  ],
  "outputs": {
    "baseColor": "n2"
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
      "const": "molen/matgraph@1",
      "description": "Format envelope; always 'molen/matgraph@1'."
    },
    "size": {
      "default": [
        512,
        512
      ],
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1,
        "maximum": 2048
      },
      "description": "Output texture size [width, height] in pixels, 1..2048 (default [512, 512])."
    },
    "seed": {
      "default": 0,
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991,
      "description": "Deterministic seed for noise nodes (default 0)."
    },
    "nodes": {
      "minItems": 1,
      "maxItems": 256,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "const",
                "description": "Constant scalar or RGBA value."
              },
              "params": {
                "type": "object",
                "properties": {
                  "value": {
                    "anyOf": [
                      {
                        "type": "number"
                      },
                      {
                        "minItems": 4,
                        "maxItems": 4,
                        "type": "array",
                        "items": {
                          "type": "number"
                        }
                      }
                    ],
                    "description": "Scalar 0..1 or [r, g, b, a] 0..1."
                  }
                },
                "required": [
                  "value"
                ],
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "uv",
                "description": "Raw UV coordinates as a value."
              },
              "params": {
                "default": {},
                "type": "object",
                "properties": {},
                "additionalProperties": false,
                "description": "No parameters."
              }
            },
            "required": [
              "id",
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "uv-transform",
                "description": "Scale/offset/rotate the UV space of the upstream node."
              },
              "params": {
                "type": "object",
                "properties": {
                  "scale": {
                    "default": 1,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1000000,
                    "description": "Pattern repeats across the 0..1 UV range (default 1)."
                  },
                  "offset": {
                    "default": [
                      0,
                      0
                    ],
                    "minItems": 2,
                    "maxItems": 2,
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "UV offset [u, v] in 0..1 units (default [0, 0])."
                  },
                  "rotateDeg": {
                    "default": 0,
                    "type": "number",
                    "description": "Rotation in degrees about the UV origin (default 0)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "noise",
                "description": "Fractal noise field (0..1)."
              },
              "params": {
                "type": "object",
                "properties": {
                  "kind": {
                    "default": "simplex",
                    "type": "string",
                    "enum": [
                      "simplex",
                      "value"
                    ],
                    "description": "Base noise: simplex (default) or value noise."
                  },
                  "octaves": {
                    "default": 4,
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8,
                    "description": "Number of fBm octaves, 1..8 (default 4)."
                  },
                  "lacunarity": {
                    "default": 2,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 16,
                    "description": "Frequency multiplier per octave (default 2)."
                  },
                  "gain": {
                    "default": 0.5,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Amplitude multiplier per octave, 0..1 (default 0.5)."
                  },
                  "scale": {
                    "default": 4,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1000000,
                    "description": "Pattern repeats across the 0..1 UV range (default 4)."
                  },
                  "seedOffset": {
                    "default": 0,
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991,
                    "description": "Added to the document seed so sibling noise nodes differ (default 0)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "worley",
                "description": "Worley (cellular) noise (0..1)."
              },
              "params": {
                "type": "object",
                "properties": {
                  "scale": {
                    "default": 4,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1000000,
                    "description": "Pattern repeats across the 0..1 UV range (default 4)."
                  },
                  "jitter": {
                    "default": 1,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Cell point randomness, 0 (regular grid) .. 1 (default)."
                  },
                  "output": {
                    "default": "f1",
                    "type": "string",
                    "enum": [
                      "f1",
                      "f2",
                      "f2-f1"
                    ],
                    "description": "Distance output: nearest (f1, default), second-nearest (f2), or their difference (f2-f1)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "gradient",
                "description": "Linear or radial gradient (0..1)."
              },
              "params": {
                "type": "object",
                "properties": {
                  "kind": {
                    "default": "linear",
                    "type": "string",
                    "enum": [
                      "linear",
                      "radial"
                    ],
                    "description": "linear across UV (default) or radial from the center."
                  },
                  "angleDeg": {
                    "default": 0,
                    "type": "number",
                    "description": "Direction of a linear gradient in degrees (0 = along +u; default 0)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "checker",
                "description": "Checkerboard (0/1)."
              },
              "params": {
                "type": "object",
                "properties": {
                  "scale": {
                    "default": 8,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1000000,
                    "description": "Pattern repeats across the 0..1 UV range (default 8)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "bricks",
                "description": "Brick/mortar mask (1 = brick, 0 = mortar)."
              },
              "params": {
                "type": "object",
                "properties": {
                  "rows": {
                    "default": 8,
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 4096,
                    "description": "Brick rows across V (default 8)."
                  },
                  "cols": {
                    "default": 4,
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 4096,
                    "description": "Brick columns across U (default 4)."
                  },
                  "mortarWidth": {
                    "default": 0.05,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 0.5,
                    "description": "Mortar width as a fraction of one brick cell, 0..0.5 (default 0.05)."
                  },
                  "offset": {
                    "default": 0.5,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Horizontal shift of alternate rows as a fraction of a brick, 0..1 (default 0.5)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "ramp",
                "description": "Map the scalar input 0..1 through a color ramp."
              },
              "params": {
                "type": "object",
                "properties": {
                  "stops": {
                    "minItems": 2,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "t": {
                          "type": "number",
                          "minimum": 0,
                          "maximum": 1,
                          "description": "Position of the stop along the input 0..1."
                        },
                        "color": {
                          "type": "string",
                          "pattern": "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
                          "description": "Stop color '#rrggbb' or '#rrggbbaa'."
                        }
                      },
                      "required": [
                        "t",
                        "color"
                      ],
                      "additionalProperties": false
                    },
                    "description": "Color stops ordered by t (at least two)."
                  }
                },
                "required": [
                  "stops"
                ],
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "blend",
                "description": "Combine inputs.a and inputs.b."
              },
              "params": {
                "type": "object",
                "properties": {
                  "mode": {
                    "default": "mix",
                    "type": "string",
                    "enum": [
                      "mix",
                      "multiply",
                      "add",
                      "screen",
                      "overlay"
                    ],
                    "description": "Blend mode (default mix)."
                  },
                  "factor": {
                    "default": 0.5,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Weight of input b, 0..1 (default 0.5)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "threshold",
                "description": "Soft step of the scalar input around an edge."
              },
              "params": {
                "type": "object",
                "properties": {
                  "edge": {
                    "default": 0.5,
                    "type": "number",
                    "description": "Input value at which the output crosses 0.5 (default 0.5)."
                  },
                  "smoothness": {
                    "default": 0.05,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Half-width of the smooth transition around edge, 0..1 (default 0.05)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "invert",
                "description": "1 - input."
              },
              "params": {
                "default": {},
                "type": "object",
                "properties": {},
                "additionalProperties": false,
                "description": "No parameters."
              }
            },
            "required": [
              "id",
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "levels",
                "description": "Remap input range to output range with gamma."
              },
              "params": {
                "type": "object",
                "properties": {
                  "inMin": {
                    "default": 0,
                    "type": "number",
                    "description": "Input value mapped to outMin (default 0)."
                  },
                  "inMax": {
                    "default": 1,
                    "type": "number",
                    "description": "Input value mapped to outMax (default 1; must exceed inMin)."
                  },
                  "gamma": {
                    "default": 1,
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 100,
                    "description": "Gamma exponent (default 1)."
                  },
                  "outMin": {
                    "default": 0,
                    "type": "number",
                    "description": "Output low value (default 0)."
                  },
                  "outMax": {
                    "default": 1,
                    "type": "number",
                    "description": "Output high value (default 1)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Node id, unique within the graph."
              },
              "input": {
                "type": "string",
                "minLength": 1,
                "description": "Id of the single upstream node this node reads (single-input nodes)."
              },
              "inputs": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "string"
                },
                "description": "Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend."
              },
              "type": {
                "type": "string",
                "const": "height-to-normal",
                "description": "Derive a tangent-space normal map from a height input."
              },
              "params": {
                "type": "object",
                "properties": {
                  "strength": {
                    "default": 1,
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "Height gradient multiplier (default 1)."
                  }
                },
                "additionalProperties": false,
                "description": "Node parameters."
              }
            },
            "required": [
              "id",
              "type",
              "params"
            ],
            "additionalProperties": false
          }
        ]
      },
      "description": "Graph nodes (1..256); each is a pure per-UV function of its inputs."
    },
    "outputs": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "baseColor"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "roughness"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "metalness"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "normal"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "emissive"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "baseColor": {
              "type": "string",
              "description": "Id of the node rasterized into the baseColor texture."
            },
            "roughness": {
              "type": "string",
              "description": "Id of the node rasterized into the roughness texture."
            },
            "metalness": {
              "type": "string",
              "description": "Id of the node rasterized into the metalness texture."
            },
            "normal": {
              "type": "string",
              "description": "Id of the node rasterized into the normal texture."
            },
            "emissive": {
              "type": "string",
              "description": "Id of the node rasterized into the emissive texture."
            },
            "ao": {
              "type": "string",
              "description": "Id of the node rasterized into the ambient-occlusion texture."
            }
          },
          "required": [
            "ao"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Texture slot to node id (at least one slot)."
    }
  },
  "required": [
    "format",
    "nodes",
    "outputs"
  ],
  "additionalProperties": false
}
```
