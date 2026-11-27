# Sound profiles (`molen/sound-profiles@1`)

Voices for whole families of entities: each profile is a set of named layers (engine, exhaust, tires, wind, cabin), each evaluated like an audioSource on the entity, plus how its cabin sounds from inside and its horn. Match rules give every entity carrying one of `components` the first profile whose conditions hold. Content packs expose them under the sound-profiles role.

## Example

```json
{
  "format": "molen/sound-profiles@1",
  "id": "my.sounds",
  "components": [
    "vehicle"
  ],
  "match": [
    {
      "profile": "car",
      "when": {
        "vehicle.spec.bodyStyle": [
          "sedan",
          "hatchback"
        ]
      }
    }
  ],
  "profiles": {
    "car": {
      "description": "A small petrol car.",
      "cabin": {
        "isolationDb": 24,
        "cutoffHz": 900
      },
      "horn": "vehicle.horn",
      "layers": [
        {
          "name": "engine",
          "sound": "vehicle.engine.car",
          "when": {
            "self.occupied": true
          },
          "pitchFrom": {
            "signal": "vehicleState.rpm",
            "curve": [
              [
                800,
                0.8
              ],
              [
                6500,
                1.9
              ]
            ]
          }
        },
        {
          "name": "tires",
          "sound": "vehicle.tire.asphalt",
          "gainFrom": {
            "signal": "self.speed",
            "curve": [
              [
                1,
                0
              ],
              [
                30,
                1
              ]
            ]
          }
        }
      ]
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
      "const": "molen/sound-profiles@1",
      "description": "Format envelope; always 'molen/sound-profiles@1'."
    },
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Document id, usually the content pack id."
    },
    "title": {
      "description": "Human title.",
      "type": "string"
    },
    "components": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Components whose entities are matched to a profile, e.g. [\"vehicle\", \"aircraft\", \"ambientAgent\"]."
    },
    "match": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "profile": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$",
            "description": "Profile id: lowercase dotted segments, e.g. \"aircraft.jet.fighter\"."
          },
          "when": {
            "type": "object",
            "propertyNames": {
              "type": "string",
              "minLength": 1
            },
            "additionalProperties": {
              "anyOf": [
                {
                  "type": [
                    "string",
                    "number",
                    "boolean"
                  ]
                },
                {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": [
                      "string",
                      "number",
                      "boolean"
                    ]
                  }
                },
                {
                  "type": "object",
                  "properties": {
                    "min": {
                      "description": "Inclusive lower bound.",
                      "type": "number"
                    },
                    "max": {
                      "description": "Inclusive upper bound.",
                      "type": "number"
                    }
                  },
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "exists": {
                      "type": "boolean",
                      "description": "true = the signal resolves to a value."
                    }
                  },
                  "required": [
                    "exists"
                  ],
                  "additionalProperties": false
                }
              ]
            },
            "description": "Conditions on the entity, e.g. { \"renderable.ref\": [\"molen.entities.aircraft.f_15c\"] } or { \"aircraft.spec.engines.0.propulsion\": \"jet\" }."
          }
        },
        "required": [
          "profile",
          "when"
        ],
        "additionalProperties": false
      },
      "description": "Rules tried in order; the first whose conditions hold gives the entity its profile."
    },
    "profiles": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$",
        "description": "Profile id: lowercase dotted segments, e.g. \"aircraft.jet.fighter\"."
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "description": {
            "description": "What it is the voice of.",
            "type": "string"
          },
          "extends": {
            "description": "Inherit the layers, cabin, horn and range of another profile; same-name layers are replaced.",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
          },
          "layers": {
            "description": "Sounds the entity makes, each evaluated like an audioSource on that entity.",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "sound": {
                  "type": "string",
                  "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$",
                  "description": "Sound id from a molen/soundbank@1 document, e.g. \"ambience.rain.medium\"."
                },
                "loop": {
                  "description": "Loop while active; default the sound's own loop flag.",
                  "type": "boolean"
                },
                "autoplay": {
                  "description": "Play when the entity exists and `when` holds; default true. false = only triggerFrom/startTick fire it.",
                  "type": "boolean"
                },
                "gain": {
                  "description": "Gain multiplier; default 1.",
                  "type": "number",
                  "minimum": 0,
                  "maximum": 4
                },
                "pitch": {
                  "description": "Playback-rate multiplier; default 1.",
                  "type": "number",
                  "exclusiveMinimum": 0
                },
                "bus": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9-]*$",
                  "description": "Mixer bus: music, ambience, sfx, ui, voice, or a custom lowercase name."
                },
                "spatial": {
                  "description": "Override the sound's spatial settings. Positional sources follow the entity's transform.",
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
                  ]
                },
                "when": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string",
                    "minLength": 1
                  },
                  "additionalProperties": {
                    "anyOf": [
                      {
                        "type": [
                          "string",
                          "number",
                          "boolean"
                        ]
                      },
                      {
                        "minItems": 1,
                        "type": "array",
                        "items": {
                          "type": [
                            "string",
                            "number",
                            "boolean"
                          ]
                        }
                      },
                      {
                        "type": "object",
                        "properties": {
                          "min": {
                            "description": "Inclusive lower bound.",
                            "type": "number"
                          },
                          "max": {
                            "description": "Inclusive upper bound.",
                            "type": "number"
                          }
                        },
                        "additionalProperties": false
                      },
                      {
                        "type": "object",
                        "properties": {
                          "exists": {
                            "type": "boolean",
                            "description": "true = the signal resolves to a value."
                          }
                        },
                        "required": [
                          "exists"
                        ],
                        "additionalProperties": false
                      }
                    ]
                  },
                  "description": "Conditions that must ALL hold, keyed by signal: a value (equality), a list (any of), {min,max} (inclusive range), or {exists}."
                },
                "gainFrom": {
                  "description": "Drive gain from a signal, or from several whose curves multiply.",
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "signal": {
                          "type": "string",
                          "minLength": 1,
                          "description": "Signal path: <component>.<field> on the entity (vehicleState.speed), or self.*, listener.*, weather.*, sky.*, time.*, host.*."
                        },
                        "curve": {
                          "minItems": 1,
                          "type": "array",
                          "items": {
                            "minItems": 2,
                            "maxItems": 2,
                            "type": "array",
                            "items": {
                              "type": "number"
                            }
                          },
                          "description": "Piecewise-linear [input, output] points, clamped at the ends."
                        },
                        "smoothS": {
                          "description": "Smoothing time constant in seconds; default 0.15.",
                          "type": "number",
                          "minimum": 0
                        }
                      },
                      "required": [
                        "signal",
                        "curve"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "signal": {
                            "type": "string",
                            "minLength": 1,
                            "description": "Signal path: <component>.<field> on the entity (vehicleState.speed), or self.*, listener.*, weather.*, sky.*, time.*, host.*."
                          },
                          "curve": {
                            "minItems": 1,
                            "type": "array",
                            "items": {
                              "minItems": 2,
                              "maxItems": 2,
                              "type": "array",
                              "items": {
                                "type": "number"
                              }
                            },
                            "description": "Piecewise-linear [input, output] points, clamped at the ends."
                          },
                          "smoothS": {
                            "description": "Smoothing time constant in seconds; default 0.15.",
                            "type": "number",
                            "minimum": 0
                          }
                        },
                        "required": [
                          "signal",
                          "curve"
                        ],
                        "additionalProperties": false
                      }
                    }
                  ]
                },
                "pitchFrom": {
                  "description": "Drive pitch from a signal, or from several whose curves multiply.",
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "signal": {
                          "type": "string",
                          "minLength": 1,
                          "description": "Signal path: <component>.<field> on the entity (vehicleState.speed), or self.*, listener.*, weather.*, sky.*, time.*, host.*."
                        },
                        "curve": {
                          "minItems": 1,
                          "type": "array",
                          "items": {
                            "minItems": 2,
                            "maxItems": 2,
                            "type": "array",
                            "items": {
                              "type": "number"
                            }
                          },
                          "description": "Piecewise-linear [input, output] points, clamped at the ends."
                        },
                        "smoothS": {
                          "description": "Smoothing time constant in seconds; default 0.15.",
                          "type": "number",
                          "minimum": 0
                        }
                      },
                      "required": [
                        "signal",
                        "curve"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "signal": {
                            "type": "string",
                            "minLength": 1,
                            "description": "Signal path: <component>.<field> on the entity (vehicleState.speed), or self.*, listener.*, weather.*, sky.*, time.*, host.*."
                          },
                          "curve": {
                            "minItems": 1,
                            "type": "array",
                            "items": {
                              "minItems": 2,
                              "maxItems": 2,
                              "type": "array",
                              "items": {
                                "type": "number"
                              }
                            },
                            "description": "Piecewise-linear [input, output] points, clamped at the ends."
                          },
                          "smoothS": {
                            "description": "Smoothing time constant in seconds; default 0.15.",
                            "type": "number",
                            "minimum": 0
                          }
                        },
                        "required": [
                          "signal",
                          "curve"
                        ],
                        "additionalProperties": false
                      }
                    }
                  ]
                },
                "triggerFrom": {
                  "description": "Fire one-shots from a signal (footsteps from distance, clicks on change).",
                  "type": "object",
                  "properties": {
                    "signal": {
                      "type": "string",
                      "minLength": 1,
                      "description": "Signal to watch (see signal paths)."
                    },
                    "every": {
                      "description": "Fire each time the signal advances by this much (odometer-style, e.g. meters).",
                      "type": "number",
                      "exclusiveMinimum": 0
                    },
                    "onChange": {
                      "description": "Fire whenever the signal value changes.",
                      "type": "boolean"
                    },
                    "sound": {
                      "description": "Sound to fire; default the source's own sound.",
                      "type": "string",
                      "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
                    }
                  },
                  "required": [
                    "signal"
                  ],
                  "additionalProperties": false
                },
                "startTick": {
                  "description": "Play once at this tick; changing it retriggers (like renderable.animation).",
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "name": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9-]*$",
                  "description": "Layer name; a profile that extends another replaces the layer of the same name."
                },
                "perspective": {
                  "description": "interior: only for a listener riding in this entity's cabin. exterior (the default): heard from outside, and muffled by the cabin when the listener rides inside. any: both, never muffled.",
                  "type": "string",
                  "enum": [
                    "interior",
                    "exterior",
                    "any"
                  ]
                }
              },
              "required": [
                "sound",
                "name"
              ],
              "additionalProperties": false
            }
          },
          "cabin": {
            "description": "How the cabin sounds from inside: what it does to everything outside it.",
            "type": "object",
            "properties": {
              "isolationDb": {
                "type": "number",
                "minimum": 0,
                "maximum": 60,
                "description": "Attenuation of sound from outside, dB."
              },
              "cutoffHz": {
                "type": "number",
                "minimum": 100,
                "maximum": 20000,
                "description": "Low-pass cutoff on sound from outside, Hz."
              }
            },
            "required": [
              "isolationDb",
              "cutoffHz"
            ],
            "additionalProperties": false
          },
          "horn": {
            "description": "Sound the host plays while the driver holds the horn.",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
          },
          "start": {
            "description": "One-shot the host plays when the engine starts (a driver boards, rpm leaves zero).",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
          },
          "stop": {
            "description": "One-shot the host plays when the engine stops.",
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)*$"
          },
          "maxDistance": {
            "description": "Meters beyond which the entity is not voiced at all; default 400.",
            "type": "number",
            "exclusiveMinimum": 0
          }
        },
        "additionalProperties": false
      },
      "description": "Profile id → profile."
    }
  },
  "required": [
    "format",
    "id",
    "components",
    "match",
    "profiles"
  ],
  "additionalProperties": false
}
```
