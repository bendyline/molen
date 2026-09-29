# Sound bank (`molen/soundbank@1`)

Named sounds for the audio director: clip files (relative to the bank), loop points, gain, pitch range, bus, spatial defaults and required provenance. Content packs expose banks under provides.soundbank.

## Example

```json
{
  "format": "molen/soundbank@1",
  "id": "my.sounds",
  "license": "CC0-1.0",
  "sounds": {
    "ambience.rain.medium": {
      "clips": [
        "ambience/rain-medium.mp3"
      ],
      "description": "Steady medium rain on foliage and pavement.",
      "loop": true,
      "loopStart": 0.05,
      "loopEnd": 29.9,
      "gain": 0.8,
      "bus": "ambience",
      "spatial": false,
      "durationS": 30,
      "source": {
        "license": "CC0-1.0",
        "site": "freesound",
        "url": "https://freesound.org/s/000000/"
      }
    },
    "footstep.grass": {
      "clips": [
        "footsteps/grass-1.mp3",
        "footsteps/grass-2.mp3",
        "footsteps/grass-3.mp3"
      ],
      "description": "Single footstep on short grass.",
      "pitch": [
        0.94,
        1.06
      ],
      "gain": 0.6,
      "bus": "sfx",
      "source": {
        "license": "CC0-1.0",
        "site": "kenney",
        "notes": "trimmed, normalized to -16 LUFS"
      }
    }
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
      "const": "molen/soundbank@1",
      "description": "Format envelope; always 'molen/soundbank@1'."
    },
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Bank id, usually the content pack id, e.g. \"molen.sounds\"."
    },
    "title": {
      "description": "Human title.",
      "type": "string"
    },
    "license": {
      "description": "Bank-wide license policy. When set, every sound must carry exactly this source.license.",
      "type": "string"
    },
    "sounds": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "clips": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "description": "Audio files relative to the bank document (MP3 plays in every browser). Several clips = variations picked per play."
          },
          "description": {
            "description": "What it sounds like, for agents choosing sounds (\"steady medium rain on leaves\").",
            "type": "string"
          },
          "tags": {
            "description": "Search tags.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "loop": {
            "description": "Loop the clip (ambience, engines); default false.",
            "type": "boolean"
          },
          "loopStart": {
            "description": "Loop start in seconds (trims encoder padding).",
            "type": "number",
            "minimum": 0
          },
          "loopEnd": {
            "description": "Loop end in seconds; must exceed loopStart.",
            "type": "number",
            "minimum": 0
          },
          "gain": {
            "description": "Linear base gain; default 1.",
            "type": "number",
            "minimum": 0,
            "maximum": 4
          },
          "pitch": {
            "description": "[min, max] playback-rate range; each play picks a value in it. Default [1, 1].",
            "minItems": 2,
            "maxItems": 2,
            "type": "array",
            "items": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          },
          "bus": {
            "description": "Default bus; default sfx.",
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]*$"
          },
          "spatial": {
            "anyOf": [
              {
                "type": "boolean",
                "const": false
              },
              {
                "type": "object",
                "properties": {
                  "refDistance": {
                    "description": "Distance in meters at which the sound plays at full gain; default 1.",
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "maxDistance": {
                    "description": "Distance in meters beyond which the sound is culled; default 60.",
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "rolloff": {
                    "description": "How fast gain falls off past refDistance; default 1.",
                    "type": "number",
                    "minimum": 0
                  },
                  "model": {
                    "description": "Distance attenuation model (Web Audio PannerNode.distanceModel); default inverse.",
                    "type": "string",
                    "enum": [
                      "linear",
                      "inverse",
                      "exponential"
                    ]
                  }
                },
                "additionalProperties": false
              }
            ],
            "description": "false = non-positional (2D); an object = positional with these distance settings."
          },
          "durationS": {
            "description": "Clip duration in seconds (written by molen audio import).",
            "type": "number",
            "minimum": 0
          },
          "hash": {
            "description": "sha256 of the first clip, \"sha256:<hex>\".",
            "type": "string"
          },
          "source": {
            "type": "object",
            "properties": {
              "license": {
                "type": "string",
                "minLength": 1,
                "description": "SPDX-style license of this recording, e.g. \"CC0-1.0\". Required provenance."
              },
              "site": {
                "description": "Where it came from: freesound, kenney, opengameart, …",
                "type": "string"
              },
              "url": {
                "description": "Page of the original recording.",
                "type": "string"
              },
              "author": {
                "description": "Recordist or creator.",
                "type": "string"
              },
              "title": {
                "description": "Original title.",
                "type": "string"
              },
              "prompt": {
                "description": "Prompt text, when the clip was generated.",
                "type": "string"
              },
              "generator": {
                "description": "Generator/model name, when the clip was generated.",
                "type": "string"
              },
              "notes": {
                "description": "Edits made: trims, loudness normalization, loop points.",
                "type": "string"
              }
            },
            "required": [
              "license"
            ],
            "additionalProperties": false,
            "description": "Provenance: license plus origin or generation prompt."
          }
        },
        "required": [
          "clips",
          "source"
        ],
        "additionalProperties": false
      },
      "description": "Sound id → entry. Later banks override earlier ones with the same id."
    }
  },
  "required": [
    "format",
    "id",
    "sounds"
  ],
  "additionalProperties": false
}
```
