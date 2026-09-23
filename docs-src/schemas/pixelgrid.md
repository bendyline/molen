# Pixel-grid texture (`molen/pixelgrid@1`)

Indexed palette + rows of characters rasterized to a pixel-art texture.

## Example

```json
{
  "format": "molen/pixelgrid@1",
  "size": [
    4,
    4
  ],
  "palette": {
    ".": "transparent",
    "X": "#222222",
    "o": "#e6b84a"
  },
  "rows": [
    ".XX.",
    "XooX",
    "XooX",
    ".XX."
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
      "const": "molen/pixelgrid@1",
      "description": "Format envelope; always 'molen/pixelgrid@1'."
    },
    "size": {
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1,
        "maximum": 256
      },
      "description": "Grid size [width, height] in pixels, 1..256."
    },
    "palette": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      },
      "description": "Single-character key to 'transparent' or '#rrggbb[aa]' color."
    },
    "rows": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "One string per row (top to bottom), each `width` palette characters long."
    },
    "slots": {
      "default": {
        "baseColor": true,
        "emissive": false
      },
      "type": "object",
      "properties": {
        "baseColor": {
          "default": true,
          "type": "boolean",
          "description": "Emit the baseColor texture (default true)."
        },
        "emissive": {
          "default": false,
          "type": "boolean",
          "description": "Also emit the grid as an emissive texture (default false)."
        }
      },
      "additionalProperties": false,
      "description": "Which material texture slots the grid is rasterized into."
    },
    "filter": {
      "default": "nearest",
      "type": "string",
      "enum": [
        "nearest",
        "linear"
      ],
      "description": "Texture sampling filter: nearest (crisp pixels, default) or linear."
    }
  },
  "required": [
    "format",
    "size",
    "palette",
    "rows"
  ],
  "additionalProperties": false
}
```
