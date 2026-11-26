# Camera track (`molen/cameratrack@1`)

Keyframed camera poses over ticks for scripted playback (machinima). A scene may carry the same track inline as `cameraTrack`.

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
      ],
      "fov": 40
    },
    {
      "tick": 121,
      "position": [
        0,
        2,
        6
      ],
      "lookAt": [
        0,
        1.5,
        0
      ],
      "relativeTo": "player",
      "cut": true
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
            "minItems": 3,
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "Camera position [x, y, z] in meters (Y-up); an offset from relativeTo when that is set."
          },
          "lookAt": {
            "minItems": 3,
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "Point [x, y, z] in meters the camera looks at; an offset from relativeTo when that is set."
          },
          "fov": {
            "type": "number",
            "minimum": 1,
            "maximum": 179,
            "description": "Vertical field of view in degrees (interpolated; default: the client camera)."
          },
          "cut": {
            "type": "boolean",
            "description": "Jump to this pose at its tick instead of interpolating from the previous one."
          },
          "relativeTo": {
            "type": "string",
            "minLength": 1,
            "description": "Entity id: position and lookAt are offsets from its position at playback time (a tracking shot)."
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
