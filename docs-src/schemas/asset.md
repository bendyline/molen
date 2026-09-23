# Asset sidecar (`molen/asset@1`)

Per-asset metadata written by `molen asset import`: bounds + collision geometry for headless physics, and name-level node/animation/material summaries for agents.

## Example

```json
{
  "format": "molen/asset@1",
  "id": "crate",
  "kind": "model",
  "files": {
    "main": "model.glb",
    "variants": {}
  },
  "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "bounds": {
    "aabb": {
      "min": [
        -0.5,
        0,
        -0.5
      ],
      "max": [
        0.5,
        1,
        0.5
      ]
    },
    "sphere": {
      "center": [
        0,
        0.5,
        0
      ],
      "radius": 0.87
    }
  },
  "stats": {
    "triangles": 12,
    "vertices": 24,
    "meshes": 1,
    "primitives": 1,
    "materials": 1,
    "textures": 0,
    "animations": 0,
    "sizeBytes": 1024
  },
  "nodes": [
    {
      "name": "Crate",
      "triangles": 12
    }
  ],
  "nodesTruncated": false,
  "animations": [],
  "materials": [
    {
      "name": "wood",
      "slots": [
        "baseColor"
      ],
      "doubleSided": false,
      "alphaMode": "OPAQUE"
    }
  ],
  "collision": {
    "hulls": [
      {
        "node": "Crate",
        "points": [
          -0.5,
          0,
          -0.5,
          0.5,
          0,
          -0.5,
          0.5,
          0,
          0.5,
          -0.5,
          0,
          0.5,
          -0.5,
          1,
          -0.5,
          0.5,
          1,
          -0.5,
          0.5,
          1,
          0.5,
          -0.5,
          1,
          0.5
        ]
      }
    ]
  },
  "extensionsUsed": []
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
      "const": "molen/asset@1",
      "description": "Format envelope; always 'molen/asset@1'."
    },
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Asset id referenced by renderable.ref / collider3d.shape.assetId, e.g. 'crate'."
    },
    "kind": {
      "type": "string",
      "enum": [
        "model",
        "audio"
      ],
      "description": "Asset kind: model (glTF/GLB) or audio."
    },
    "files": {
      "type": "object",
      "properties": {
        "main": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
          "description": "Sidecar-relative path of the main file (the GLB)."
        },
        "collision": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
          "description": "Sidecar-relative path of the collision trimesh binary, if any."
        },
        "variants": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
          },
          "description": "Variant name to sidecar-relative file path (e.g. LOD or compressed variants)."
        }
      },
      "required": [
        "main"
      ],
      "additionalProperties": false,
      "description": "Files that make up the asset, relative to the sidecar directory."
    },
    "hash": {
      "type": "string",
      "pattern": "^sha256:[0-9a-f]{64}$",
      "description": "'sha256:<hex>' of files.main."
    },
    "sourceHash": {
      "type": "string",
      "pattern": "^sha256:[0-9a-f]{64}$",
      "description": "'sha256:<hex>' of the pre-import source file."
    },
    "bounds": {
      "type": "object",
      "properties": {
        "aabb": {
          "type": "object",
          "properties": {
            "min": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Minimum corner [x, y, z] in meters."
            },
            "max": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Maximum corner [x, y, z] in meters."
            }
          },
          "required": [
            "min",
            "max"
          ],
          "additionalProperties": false,
          "description": "Axis-aligned bounding box in model space."
        },
        "sphere": {
          "type": "object",
          "properties": {
            "center": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Sphere center [x, y, z] in meters."
            },
            "radius": {
              "type": "number",
              "minimum": 0,
              "description": "Sphere radius in meters."
            }
          },
          "required": [
            "center",
            "radius"
          ],
          "additionalProperties": false,
          "description": "Bounding sphere in model space."
        }
      },
      "required": [
        "aabb",
        "sphere"
      ],
      "additionalProperties": false,
      "description": "Model-space bounds (meters, Y-up) for placement, culling, and headless reasoning."
    },
    "stats": {
      "type": "object",
      "properties": {
        "triangles": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Total triangle count."
        },
        "vertices": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Total vertex count."
        },
        "meshes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Number of glTF meshes."
        },
        "primitives": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Number of mesh primitives (draw calls)."
        },
        "materials": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Number of materials."
        },
        "textures": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Number of textures."
        },
        "animations": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Number of animation clips."
        },
        "sizeBytes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Size of files.main in bytes."
        }
      },
      "required": [
        "triangles",
        "vertices",
        "meshes",
        "primitives",
        "materials",
        "textures",
        "animations",
        "sizeBytes"
      ],
      "additionalProperties": false,
      "description": "Size and complexity summary of the asset."
    },
    "nodes": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "glTF node name (usable as renderable.node)."
          },
          "triangles": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Triangles under this node."
          }
        },
        "required": [
          "name",
          "triangles"
        ],
        "additionalProperties": false
      },
      "description": "Named mesh-bearing nodes (capped; see nodesTruncated)."
    },
    "nodesTruncated": {
      "default": false,
      "type": "boolean",
      "description": "True when the nodes list was capped and omits some nodes."
    },
    "animations": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Clip name (usable as renderable.animation.clip)."
          },
          "durationSec": {
            "type": "number",
            "minimum": 0,
            "description": "Clip duration in seconds at speed 1."
          },
          "channels": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Number of animated channels in the clip."
          }
        },
        "required": [
          "name",
          "durationSec",
          "channels"
        ],
        "additionalProperties": false
      },
      "description": "Animation clips in the asset."
    },
    "materials": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Material name."
          },
          "slots": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "baseColor",
                "roughness",
                "metalness",
                "normal",
                "emissive",
                "ao"
              ]
            },
            "description": "Texture slots the material binds."
          },
          "doubleSided": {
            "default": false,
            "type": "boolean",
            "description": "Whether the material renders both faces."
          },
          "alphaMode": {
            "default": "OPAQUE",
            "type": "string",
            "enum": [
              "OPAQUE",
              "MASK",
              "BLEND"
            ],
            "description": "glTF alpha mode."
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      },
      "description": "Materials in the asset (name-level summary)."
    },
    "collision": {
      "type": "object",
      "properties": {
        "hulls": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "node": {
                "type": "string",
                "description": "Mesh-bearing node the hull was computed from."
              },
              "points": {
                "minItems": 12,
                "maxItems": 192,
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "Flat [x, y, z, ...] hull vertices in meters (4..64 points, rounded to 1e-4)."
              }
            },
            "required": [
              "node",
              "points"
            ],
            "additionalProperties": false
          },
          "description": "Convex hulls, one per mesh-bearing node (used by collider3d shape.type = asset)."
        },
        "trimesh": {
          "type": "object",
          "properties": {
            "bin": {
              "type": "string",
              "minLength": 1,
              "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
              "description": "Sidecar-relative filename of the collision binary."
            },
            "positions": {
              "type": "object",
              "properties": {
                "byteOffset": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991,
                  "multipleOf": 4,
                  "description": "Byte offset of the position block in the binary (4-byte aligned)."
                },
                "count": {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 1000000,
                  "description": "Number of vertices (f32le [x, y, z] triples in meters)."
                }
              },
              "required": [
                "byteOffset",
                "count"
              ],
              "additionalProperties": false,
              "description": "Vertex position block: f32le xyz triples."
            },
            "indices": {
              "type": "object",
              "properties": {
                "byteOffset": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991,
                  "multipleOf": 4,
                  "description": "Byte offset of the index block in the binary (4-byte aligned)."
                },
                "count": {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 3000000,
                  "multipleOf": 3,
                  "description": "Number of u32le indices (a multiple of 3; three per triangle)."
                }
              },
              "required": [
                "byteOffset",
                "count"
              ],
              "additionalProperties": false,
              "description": "Triangle index block: u32le indices."
            },
            "hash": {
              "type": "string",
              "pattern": "^sha256:[0-9a-f]{64}$",
              "description": "'sha256:<hex>' of the collision binary."
            }
          },
          "required": [
            "bin",
            "positions",
            "indices",
            "hash"
          ],
          "additionalProperties": false,
          "description": "Exact triangle-mesh collision geometry stored in an external binary."
        }
      },
      "additionalProperties": false,
      "description": "Collision geometry for headless physics."
    },
    "extensionsUsed": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "glTF extensions the asset uses (e.g. KHR_draco_mesh_compression)."
    }
  },
  "required": [
    "format",
    "id",
    "kind",
    "files",
    "hash",
    "bounds",
    "stats",
    "collision"
  ],
  "additionalProperties": false
}
```
