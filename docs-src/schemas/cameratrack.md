# Camera track (`molen/cameratrack@1`)

Keyframed camera poses over ticks for scripted playback (machinima).

## Example

```json
{
  "format": "molen/cameratrack@1",
  "easing": "smooth",
  "keyframes": [
    {
      "tick": 0,
      "position": [
        0,
        20,
        40
      ],
      "lookAt": [
        0,
        0,
        0
      ]
    },
    {
      "tick": 120,
      "position": [
        40,
        20,
        0
      ],
      "lookAt": [
        0,
        0,
        0
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
      "const": "molen/cameratrack@1",
      "description": "Format envelope; always 'molen/cameratrack@1'."
    },
    "easing": {
      "default": "smooth",
      "type": "string",
      "enum": [
        "linear",
        "smooth"
      ],
      "description": "Interpolation between keyframes: linear or smooth (smoothstep; default)."
    },
    "loop": {
      "default": false,
      "type": "boolean",
      "description": "Wrap the tick back to the first keyframe after the last one (default false)."
    },
    "keyframes": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "tick": {
            "type": "number",
            "minimum": 0,
            "description": "Tick at which this pose is reached (scene tickRate)."
          },
          "position": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number"
              },
              {
                "type": "number"
              },
              {
                "type": "number"
              }
            ],
            "items": false,
            "minItems": 3,
            "maxItems": 3,
            "description": "Camera position [x, y, z] in meters (Y-up)."
          },
          "lookAt": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number"
              },
              {
                "type": "number"
              },
              {
                "type": "number"
              }
            ],
            "items": false,
            "minItems": 3,
            "maxItems": 3,
            "description": "Point [x, y, z] in meters the camera looks at."
          }
        },
        "required": [
          "tick",
          "position",
          "lookAt"
        ],
        "additionalProperties": false
      },
      "description": "Camera poses over ticks (at least one; sorted by tick when evaluated)."
    }
  },
  "required": [
    "format",
    "keyframes"
  ],
  "additionalProperties": false
}
```
