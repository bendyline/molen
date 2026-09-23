# Terrain descriptor (`molen/terrain@2`)

Streamed heightmap terrain: tiles, chunk grid, height range, layers, LOD, and residency budgets.

## Example

```json
{
  "format": "molen/terrain@2",
  "name": "island",
  "chunkSize": 128,
  "tileResolution": 129,
  "gridSize": [
    4,
    4
  ],
  "height": {
    "min": 0,
    "max": 200
  },
  "tiles": {
    "heightUrl": "tiles/h_{x}_{z}.png"
  },
  "layers": [
    {
      "name": "grass",
      "tiling": 8
    },
    {
      "name": "rock",
      "tiling": 6,
      "auto": {
        "slopeMin": 0.6
      }
    },
    {
      "name": "snow",
      "tiling": 4,
      "auto": {
        "heightMin": 150
      }
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
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Terrain name."
    },
    "origin": {
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
      "description": "World [x, z] in meters of the corner of chunk (0, 0); default [0, 0]."
    },
    "chunkSize": {
      "default": 128,
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Chunk edge length in meters (default 128)."
    },
    "tileResolution": {
      "default": 129,
      "type": "integer",
      "minimum": 2,
      "maximum": 1025,
      "description": "Height samples per chunk edge, borders shared with neighbors (default 129)."
    },
    "gridSize": {
      "default": [
        1,
        1
      ],
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "integer",
        "exclusiveMinimum": 0,
        "maximum": 9007199254740991
      },
      "description": "Number of chunks along [x, z]; default [1, 1]."
    },
    "height": {
      "type": "object",
      "properties": {
        "min": {
          "type": "number",
          "description": "Height in meters encoded by sample value 0."
        },
        "max": {
          "type": "number",
          "description": "Height in meters encoded by the maximum sample value."
        }
      },
      "required": [
        "min",
        "max"
      ],
      "additionalProperties": false,
      "description": "Height range in meters the PNG16 samples map onto."
    },
    "tiles": {
      "type": "object",
      "properties": {
        "heightUrl": {
          "type": "string",
          "minLength": 1,
          "description": "PNG16 height tile URL template with {x}/{z} chunk placeholders, e.g. 'tiles/h_{x}_{z}.png'; relative to the descriptor."
        },
        "splatUrl": {
          "type": "string",
          "minLength": 1,
          "description": "Optional splat-weight tile URL template with {x}/{z} placeholders."
        }
      },
      "required": [
        "heightUrl"
      ],
      "additionalProperties": false,
      "description": "Tile sources."
    },
    "layers": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "Layer name, e.g. 'grass' or 'rock'."
          },
          "materialRef": {
            "type": "string",
            "minLength": 1,
            "description": "Material reference for the layer surface (project material doc id)."
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$",
            "description": "Flat '#rrggbb' color used for vertex-color splat banding (v1 shading)."
          },
          "tiling": {
            "default": 8,
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Texture repeats per chunk edge for the layer material (default 8)."
          },
          "auto": {
            "type": "object",
            "properties": {
              "heightMin": {
                "type": "number",
                "description": "Lowest height in meters at which the layer applies."
              },
              "heightMax": {
                "type": "number",
                "description": "Highest height in meters at which the layer applies."
              },
              "slopeMin": {
                "type": "number",
                "description": "Minimum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies."
              },
              "slopeMax": {
                "type": "number",
                "description": "Maximum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies."
              }
            },
            "additionalProperties": false,
            "description": "Automatic height/slope banding that selects where the layer paints."
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      },
      "description": "Surface layers painted by splat weights or auto banding, in order."
    },
    "lod": {
      "default": {
        "levels": 4,
        "distanceBands": [
          256,
          512,
          1024,
          2048
        ],
        "skirts": true
      },
      "type": "object",
      "properties": {
        "levels": {
          "default": 4,
          "type": "integer",
          "minimum": 1,
          "maximum": 6,
          "description": "Number of LOD levels (each halves the sample density; default 4)."
        },
        "distanceBands": {
          "default": [
            256,
            512,
            1024,
            2048
          ],
          "type": "array",
          "items": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "description": "Camera distances in meters (strictly increasing) beyond which each coarser LOD level applies."
        },
        "skirts": {
          "default": true,
          "type": "boolean",
          "description": "Add vertical skirts along chunk edges to hide LOD cracks (default true)."
        }
      },
      "additionalProperties": false,
      "description": "Level-of-detail settings."
    },
    "collision": {
      "default": {
        "enabled": false
      },
      "type": "object",
      "properties": {
        "enabled": {
          "default": false,
          "type": "boolean",
          "description": "Register the heightfield as the scene's ground/collision (default false)."
        }
      },
      "additionalProperties": false,
      "description": "Headless ground/collision settings."
    },
    "format": {
      "type": "string",
      "const": "molen/terrain@2",
      "description": "Format envelope; always 'molen/terrain@2'."
    },
    "metersPerUnit": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "World meters per unit of the source projected space (origin/chunkSize are pre-multiplied); absent = 1."
    },
    "streaming": {
      "default": {
        "loadRadius": 3,
        "unloadRadius": 4,
        "maxConcurrentLoads": 4,
        "maxResidentTiles": 96
      },
      "type": "object",
      "properties": {
        "loadRadius": {
          "default": 3,
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Radius around the camera, in chunks, that is kept resident (default 3)."
        },
        "unloadRadius": {
          "default": 4,
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Hysteresis radius in chunks; resident tiles outside it may be evicted (>= loadRadius; default 4)."
        },
        "maxConcurrentLoads": {
          "default": 4,
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 32,
          "description": "Maximum height-tile requests in flight at once (default 4)."
        },
        "maxResidentTiles": {
          "default": 96,
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 4096,
          "description": "Hard ceiling on decoded resident tiles and their meshes (default 96)."
        }
      },
      "additionalProperties": false,
      "description": "Tile residency budgets."
    }
  },
  "required": [
    "name",
    "height",
    "tiles",
    "format"
  ],
  "additionalProperties": false
}
```
