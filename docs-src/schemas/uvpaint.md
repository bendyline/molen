# UV paint sidecar (`molen/uvpaint@1`)

Island annotations pairing a paint-by-numbers template with a model for re-import.

## Example

```json
{
  "format": "molen/uvpaint@1",
  "model": "models/scout.glb",
  "atlasSize": [
    1024,
    1024
  ],
  "islands": [
    {
      "id": 1,
      "label": "head",
      "color": "#e6194b",
      "uvBBox": [
        0.02,
        0.05,
        0.31,
        0.4
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
      "const": "molen/uvpaint@1",
      "description": "Format envelope; always 'molen/uvpaint@1'."
    },
    "model": {
      "type": "string",
      "minLength": 1,
      "description": "Sidecar-relative path of the model the template was unwrapped from."
    },
    "atlasSize": {
      "default": [
        1024,
        1024
      ],
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "integer",
        "exclusiveMinimum": 0,
        "maximum": 9007199254740991
      },
      "description": "Template/atlas size [width, height] in pixels (default [1024, 1024])."
    },
    "texelDensity": {
      "default": 128,
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Texels per meter of model surface the atlas was laid out at (default 128)."
    },
    "islands": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Island number as printed on the template."
          },
          "label": {
            "default": "",
            "type": "string",
            "description": "Human label for the island, e.g. 'head'."
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$",
            "description": "'#rrggbb' key color of the island in the island map."
          },
          "uvBBox": {
            "minItems": 4,
            "maxItems": 4,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "Island bounds [minU, minV, maxU, maxV] in 0..1 UV space."
          },
          "notes": {
            "default": "",
            "type": "string",
            "description": "Free-form painting notes."
          }
        },
        "required": [
          "id",
          "color",
          "uvBBox"
        ],
        "additionalProperties": false
      },
      "description": "UV islands annotated on the template."
    },
    "paintedImage": {
      "type": "string",
      "description": "Sidecar-relative path of the painted template image to re-import."
    },
    "importRules": {
      "default": {
        "maskToIslands": true,
        "dilationPx": 8
      },
      "type": "object",
      "properties": {
        "maskToIslands": {
          "default": true,
          "type": "boolean",
          "description": "Clip paint to the island shapes on import (default true)."
        },
        "dilationPx": {
          "default": 8,
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Gutter dilation in pixels applied after masking (default 8)."
        }
      },
      "additionalProperties": false,
      "description": "How the painted image is turned back into a texture."
    }
  },
  "required": [
    "format",
    "model"
  ],
  "additionalProperties": false
}
```
