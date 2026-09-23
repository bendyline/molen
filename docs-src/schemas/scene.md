# Scene manifest (`molen/scene@3`)

Root document an experience boots from; instantiates into ECS state at tick 0.

## Example

```json
{
  "format": "molen/scene@3",
  "name": "demo",
  "seed": "demo-1",
  "tickRate": 30,
  "prefabs": {
    "cube": {
      "components": {
        "transform": {
          "pos": [
            0,
            0,
            0
          ],
          "rot": [
            0,
            0,
            0,
            1
          ]
        },
        "spin": {
          "axis": [
            0,
            1,
            0
          ],
          "radPerTick": 0.05
        }
      }
    }
  },
  "entities": [
    {
      "id": "cube-1",
      "prefab": "cube"
    }
  ],
  "components": {
    "spin": {
      "description": "Continuous rotation about an axis, applied by the spin script.",
      "examples": [
        {
          "axis": [
            0,
            1,
            0
          ],
          "radPerTick": 0.05
        }
      ]
    }
  },
  "commands": {
    "move": {
      "doc": "Set the planar move direction [x, z] (-1..1 per axis).",
      "payload": {
        "type": "object",
        "properties": {
          "dir": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "minItems": 2,
            "maxItems": 2
          }
        },
        "required": [
          "dir"
        ],
        "additionalProperties": false
      }
    }
  },
  "scripts": [
    {
      "id": "control",
      "code": "molen.onCommand('move', (p) => molen.patch('cube-1', 'transform', { pos: [p.dir[0], 0, p.dir[1]] }));"
    }
  ],
  "camera": {
    "mode": "fixed",
    "position": [
      0,
      6,
      16
    ],
    "lookAt": [
      0,
      0,
      0
    ]
  },
  "input": {
    "bindings": {
      "KeyW": "up",
      "KeyS": "down",
      "KeyA": "left",
      "KeyD": "right"
    },
    "emit": [
      {
        "kind": "axis2d",
        "xNeg": "left",
        "xPos": "right",
        "yNeg": "up",
        "yPos": "down",
        "command": "move",
        "field": "dir"
      }
    ]
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
      "const": "molen/scene@3",
      "description": "Format envelope; always 'molen/scene@3'."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Human-readable scene name."
    },
    "seed": {
      "default": 0,
      "description": "Deterministic RNG seed (string or number; default 0).",
      "type": [
        "string",
        "number"
      ]
    },
    "tickRate": {
      "default": 30,
      "type": "integer",
      "minimum": 1,
      "maximum": 240,
      "description": "Simulation ticks per second, 1..240 (default 30); dt = 1/tickRate seconds."
    },
    "lateCommands": {
      "default": "rewrite",
      "type": "string",
      "enum": [
        "rewrite",
        "reject"
      ],
      "description": "Commands that arrive for a past tick: rewrite to the current tick (default) or reject."
    },
    "keyframeInterval": {
      "default": 60,
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991,
      "description": "Ticks between full keyframe snapshots (default 60)."
    },
    "prefabs": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "format": {
            "type": "string",
            "const": "molen/prefab@1",
            "description": "Format envelope 'molen/prefab@1' (optional when the prefab is inlined in a scene)."
          },
          "extends": {
            "type": "string",
            "minLength": 1,
            "description": "Name of a prefab in the same manifest to inherit components from (deep-merged)."
          },
          "type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "Project-registry type id this prefab specializes, e.g. 'train.locomotive'."
          },
          "components": {
            "default": {},
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "$ref": "#/$defs/__schema0"
              }
            },
            "description": "Component name to pure-JSON component data (deep-merged over the extends/type base)."
          }
        },
        "additionalProperties": false
      },
      "description": "Prefab name to prefab (entity templates instantiated by entities[].prefab)."
    },
    "entities": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?!e\\d+$)(?!\\d+$)(?!\\$)",
            "description": "Authored entity id, stable across save/load; omitted = runtime id 'e<n>'."
          },
          "type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "Project-registry type id to instantiate, e.g. 'train.locomotive'."
          },
          "prefab": {
            "type": "string",
            "minLength": 1,
            "description": "Name of a prefab in this scene to instantiate."
          },
          "components": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "$ref": "#/$defs/__schema0"
              }
            },
            "description": "Component name to component data, layered over the type/prefab base (a partial when a base is present)."
          }
        },
        "additionalProperties": false
      },
      "description": "Entities instantiated at tick 0, in order."
    },
    "scripts": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "checkpoint": {
            "type": "string",
            "const": "state",
            "description": "Opt into checkpoint restore: keep all durable state in molen.state, components, or snapshot providers, never mutable closures. Without this declaration replay seeks from the beginning."
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Script id, unique within the scene."
          },
          "code": {
            "type": "string",
            "minLength": 1,
            "description": "Inline JavaScript source (exactly one of code or path)."
          },
          "path": {
            "type": "string",
            "minLength": 1,
            "allOf": [
              {
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
              },
              {
                "pattern": "\\.(?:js|ts)$"
              }
            ],
            "description": "Scene-relative path to a script file, .js or .ts (exactly one of code or path). A .ts file has its types erased when the scene is loaded."
          },
          "config": {
            "default": {},
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "Frozen JSON config exposed to the script as `config`."
          }
        },
        "required": [
          "id"
        ],
        "additionalProperties": false
      },
      "description": "Deterministic scene scripts (inline code or file refs). Evaluated with the authority of the host process, so treat a manifest like source code."
    },
    "commands": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "doc": {
            "type": "string",
            "description": "Human/agent description of what the command does."
          },
          "payload": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "JSON Schema (object/array/number/integer/string/boolean subset) the payload must satisfy; omitted = any JSON."
          }
        },
        "additionalProperties": false
      },
      "description": "Command types this scene accepts, with optional doc and payload schema (scripts attach handlers via molen.onCommand)."
    },
    "components": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-zA-Z]\\w*$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string",
            "minLength": 1,
            "description": "One-line human/agent description of the component."
          },
          "examples": {
            "minItems": 1,
            "type": "array",
            "items": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "At least one valid example of the component data (feeds hints and docs)."
          },
          "schema": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "JSON Schema (object/array/number/integer/string/boolean subset) for the component data; omitted = any object."
          }
        },
        "required": [
          "description",
          "examples"
        ],
        "additionalProperties": false
      },
      "description": "Custom component vocabulary this scene introduces (description + examples, optional schema); known to validation and docs."
    },
    "camera": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "follow",
              "description": "Perspective camera tracking an interpolated entity transform; works in live play and capture."
            },
            "entity": {
              "type": "string",
              "minLength": 1,
              "description": "Entity to follow (need not have a renderable)."
            },
            "offset": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Camera offset [x,y,z] in meters from the target."
            },
            "lookOffset": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Look-at offset from the target; must differ from offset."
            },
            "space": {
              "type": "string",
              "enum": [
                "world",
                "local"
              ],
              "description": "World-axis offsets (default), or offsets rotated by the target quaternion (first person/chase)."
            },
            "fov": {
              "type": "number",
              "minimum": 1,
              "maximum": 179,
              "description": "Vertical field of view in degrees."
            }
          },
          "required": [
            "mode",
            "entity",
            "offset",
            "lookOffset"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "fixed",
              "description": "Static perspective camera."
            },
            "position": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Camera position [x, y, z] in meters (Y-up)."
            },
            "lookAt": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Point [x, y, z] in meters the camera looks at (default: the origin)."
            },
            "fov": {
              "type": "number",
              "minimum": 1,
              "maximum": 179,
              "description": "Vertical field of view in degrees."
            }
          },
          "required": [
            "mode",
            "position"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "free-fly",
              "description": "Perspective camera the user flies with keyboard/mouse."
            },
            "position": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Camera position [x, y, z] in meters (Y-up)."
            },
            "lookAt": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Point [x, y, z] in meters the camera looks at (default: the origin)."
            },
            "fov": {
              "type": "number",
              "minimum": 1,
              "maximum": 179,
              "description": "Vertical field of view in degrees."
            },
            "moveSpeed": {
              "default": 10,
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Base fly speed in meters per second (default 10)."
            },
            "boost": {
              "default": 4,
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Speed multiplier while the boost key is held (default 4)."
            }
          },
          "required": [
            "mode",
            "position"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "top-down-ortho",
              "description": "Orthographic camera looking straight down (-Y); screen-up is -z (north), screen-down is +z (south)."
            },
            "center": {
              "minItems": 2,
              "maxItems": 2,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "World [x, z] in meters the view centers on."
            },
            "viewHeight": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "World-space height in meters of the visible area; width follows the viewport aspect."
            },
            "cameraHeight": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Camera height in meters above the y = 0 plane (default 200)."
            }
          },
          "required": [
            "mode",
            "center",
            "viewHeight"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Initial client camera."
    },
    "input": {
      "type": "object",
      "properties": {
        "bindings": {
          "type": "object",
          "propertyNames": {
            "type": "string",
            "minLength": 1
          },
          "additionalProperties": {
            "type": "string",
            "minLength": 1
          },
          "description": "KeyboardEvent.code (e.g. 'KeyW') to input action name."
        },
        "axes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "action": {
                "type": "string",
                "minLength": 1,
                "description": "Named action receiving the numeric axis value."
              },
              "axis": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991,
                "description": "Raw zero-based axis index; no standard mapping required."
              },
              "device": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Exact browser Gamepad.id; omit to match any ID."
                  },
                  "index": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991,
                    "description": "Browser Gamepad.index; may change on reconnect."
                  }
                },
                "additionalProperties": false
              },
              "mode": {
                "type": "string",
                "enum": [
                  "signed",
                  "positive",
                  "negative",
                  "unit"
                ],
                "description": "signed -1..1 (default), positive/negative half axis 0..1, or unit full travel 0..1."
              },
              "invert": {
                "type": "boolean",
                "description": "Reverse calibrated travel before applying the mode."
              },
              "deadZone": {
                "type": "number",
                "minimum": 0,
                "exclusiveMaximum": 1,
                "description": "Rescaled dead zone; default 0.12 (unit: 0)."
              },
              "curve": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "Response exponent; default 1 (linear)."
              },
              "min": {
                "type": "number",
                "description": "Raw minimum; default -1. Must be below center."
              },
              "center": {
                "type": "number",
                "description": "Raw center; default 0. Must lie between min and max."
              },
              "max": {
                "type": "number",
                "description": "Raw maximum; default 1. Must be above center."
              }
            },
            "required": [
              "action",
              "axis"
            ],
            "additionalProperties": false
          },
          "description": "Mappings for arbitrary browser-exposed joystick axes."
        },
        "buttons": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "action": {
                "type": "string",
                "minLength": 1,
                "description": "Named action receiving button presses and releases."
              },
              "button": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991,
                "description": "Raw zero-based button index."
              },
              "device": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Exact browser Gamepad.id; omit to match any ID."
                  },
                  "index": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991,
                    "description": "Browser Gamepad.index; may change on reconnect."
                  }
                },
                "additionalProperties": false
              },
              "threshold": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 1,
                "description": "Analog button press threshold; default 0.5."
              }
            },
            "required": [
              "action",
              "button"
            ],
            "additionalProperties": false
          },
          "description": "Mappings for arbitrary browser-exposed controller buttons."
        },
        "profiles": {
          "type": "object",
          "propertyNames": {
            "type": "string",
            "minLength": 1
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "bindings": {
                "type": "object",
                "propertyNames": {
                  "type": "string",
                  "minLength": 1
                },
                "additionalProperties": {
                  "type": "string",
                  "minLength": 1
                },
                "description": "KeyboardEvent.code or Mouse<button> to action name."
              },
              "axes": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "action": {
                      "type": "string",
                      "minLength": 1,
                      "description": "Named action receiving the numeric axis value."
                    },
                    "axis": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991,
                      "description": "Raw zero-based axis index; no standard mapping required."
                    },
                    "device": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "minLength": 1,
                          "description": "Exact browser Gamepad.id; omit to match any ID."
                        },
                        "index": {
                          "type": "integer",
                          "minimum": 0,
                          "maximum": 9007199254740991,
                          "description": "Browser Gamepad.index; may change on reconnect."
                        }
                      },
                      "additionalProperties": false
                    },
                    "mode": {
                      "type": "string",
                      "enum": [
                        "signed",
                        "positive",
                        "negative",
                        "unit"
                      ],
                      "description": "signed -1..1 (default), positive/negative half axis 0..1, or unit full travel 0..1."
                    },
                    "invert": {
                      "type": "boolean",
                      "description": "Reverse calibrated travel before applying the mode."
                    },
                    "deadZone": {
                      "type": "number",
                      "minimum": 0,
                      "exclusiveMaximum": 1,
                      "description": "Rescaled dead zone; default 0.12 (unit: 0)."
                    },
                    "curve": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "description": "Response exponent; default 1 (linear)."
                    },
                    "min": {
                      "type": "number",
                      "description": "Raw minimum; default -1. Must be below center."
                    },
                    "center": {
                      "type": "number",
                      "description": "Raw center; default 0. Must lie between min and max."
                    },
                    "max": {
                      "type": "number",
                      "description": "Raw maximum; default 1. Must be above center."
                    }
                  },
                  "required": [
                    "action",
                    "axis"
                  ],
                  "additionalProperties": false
                },
                "description": "Mappings for arbitrary browser-exposed joystick axes."
              },
              "buttons": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "action": {
                      "type": "string",
                      "minLength": 1,
                      "description": "Named action receiving button presses and releases."
                    },
                    "button": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991,
                      "description": "Raw zero-based button index."
                    },
                    "device": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "minLength": 1,
                          "description": "Exact browser Gamepad.id; omit to match any ID."
                        },
                        "index": {
                          "type": "integer",
                          "minimum": 0,
                          "maximum": 9007199254740991,
                          "description": "Browser Gamepad.index; may change on reconnect."
                        }
                      },
                      "additionalProperties": false
                    },
                    "threshold": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 1,
                      "description": "Analog button press threshold; default 0.5."
                    }
                  },
                  "required": [
                    "action",
                    "button"
                  ],
                  "additionalProperties": false
                },
                "description": "Mappings for arbitrary browser-exposed controller buttons."
              }
            },
            "required": [
              "bindings"
            ],
            "additionalProperties": false
          },
          "description": "Named complete binding sets for walking, flying, driving, or other use cases."
        },
        "profile": {
          "type": "string",
          "minLength": 1,
          "description": "Initial profile name; absent uses the root bindings."
        },
        "emit": {
          "default": [],
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "const": "axis",
                    "description": "Emit a numeric action value when it changes."
                  },
                  "action": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings whose numeric value drives the axis."
                  },
                  "negative": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings to subtract from the value (optional keyboard opposite)."
                  },
                  "command": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Command type to emit; must be declared under the scene `commands`."
                  },
                  "field": {
                    "default": "value",
                    "type": "string",
                    "minLength": 1,
                    "description": "Payload field receiving the number (default 'value')."
                  }
                },
                "required": [
                  "kind",
                  "action",
                  "command"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "const": "press",
                    "description": "Emit once when the action becomes active."
                  },
                  "action": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that triggers the command."
                  },
                  "command": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Command type to emit; must be declared under the scene `commands`."
                  },
                  "payload": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {
                      "$ref": "#/$defs/__schema0"
                    },
                    "description": "Fixed JSON payload sent with the command."
                  }
                },
                "required": [
                  "kind",
                  "action",
                  "command"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "const": "release",
                    "description": "Emit once when the action becomes inactive."
                  },
                  "action": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that triggers the command."
                  },
                  "command": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Command type to emit; must be declared under the scene `commands`."
                  },
                  "payload": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {
                      "$ref": "#/$defs/__schema0"
                    },
                    "description": "Fixed JSON payload sent with the command."
                  }
                },
                "required": [
                  "kind",
                  "action",
                  "command"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "const": "axis2d",
                    "description": "Emit the command whenever the [x, y] axis vector built from four actions changes."
                  },
                  "xNeg": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that drives x toward -1 (west)."
                  },
                  "xPos": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that drives x toward +1 (east)."
                  },
                  "yNeg": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that drives y toward -1 (north / screen-up)."
                  },
                  "yPos": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Input action name produced by keyboard, button, or axis bindings that drives y toward +1 (south / screen-down, i.e. +z)."
                  },
                  "command": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Command type to emit; must be declared under the scene `commands`."
                  },
                  "field": {
                    "default": "dir",
                    "type": "string",
                    "minLength": 1,
                    "description": "Payload field that receives the [x, y] vector (default 'dir')."
                  }
                },
                "required": [
                  "kind",
                  "xNeg",
                  "xPos",
                  "yNeg",
                  "yPos",
                  "command"
                ],
                "additionalProperties": false
              }
            ]
          },
          "description": "Rules that turn input actions into commands."
        }
      },
      "required": [
        "bindings"
      ],
      "additionalProperties": false,
      "description": "Keyboard bindings and the rules that turn them into commands."
    },
    "terrain": {
      "type": "object",
      "properties": {
        "descriptor": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
          "description": "Scene-relative path to the molen/terrain descriptor JSON."
        },
        "heightmap": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
          "description": "Scene-relative path to a PNG16 heightmap used for headless ground sampling / collision."
        }
      },
      "required": [
        "descriptor"
      ],
      "additionalProperties": false,
      "description": "Streamed heightmap terrain attached to the scene."
    },
    "physics": {
      "type": "object",
      "properties": {
        "engine": {
          "type": "string",
          "enum": [
            "none",
            "kinematics",
            "platformer",
            "rapier"
          ],
          "description": "Physics engine: none, kinematics (cross-platform deterministic 2.5D in the XZ plane), platformer (cross-platform deterministic XY swept boxes), or rapier (same-platform deterministic 3D)."
        },
        "gravity": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Gravity [x, y, z] in meters per second squared (rapier; default [0, -9.81, 0])."
        },
        "ground": {
          "type": "string",
          "enum": [
            "flat",
            "terrain"
          ],
          "description": "Ground for kinematic bodies: flat y = 0 (default) or the scene's terrain heightfield."
        },
        "character": {
          "type": "boolean",
          "description": "Install the kernel character controller (character + moveIntent components); not allowed with rapier."
        }
      },
      "required": [
        "engine"
      ],
      "additionalProperties": false,
      "description": "Physics engine selection and settings."
    }
  },
  "required": [
    "format",
    "name"
  ],
  "additionalProperties": false,
  "$defs": {
    "__schema0": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/__schema0"
          }
        },
        {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "$ref": "#/$defs/__schema0"
          }
        }
      ]
    }
  }
}
```
