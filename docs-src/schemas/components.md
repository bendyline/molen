# Components

Components are pure-JSON data attached to entities. molen ships a known component vocabulary;
`molen validate` checks component data against it, so a typo'd name (`helth` → `health`) or a
wrong field (`transform.position` → `pos`) is caught in the cheap pre-sim loop. **Inventing your
own components is fine** — a name that doesn't resemble a known one is accepted as-is (declare it
under `components` in the scene or project to document it). A name that *is* a near-typo of a
known component is flagged.

Discover the live vocabulary from the tools (this page is generated from the same registry):

```sh
molen components            # name, owning layer, description
molen component transform   # one component's JSON Schema + examples
```

(MCP: `list_components`, `get_component`.) Capability packages and content can register more
with `registerComponent(name, zodSchema, meta)` from `@bendyline/molen-schema`. Strict schemas
(`additionalProperties: false`) flag unknown fields; loose ones allow extras.

## Conventions

- Coordinate system: **Y-up**, right-handed; distances in **meters**.
- Time is in **ticks** at the scene `tickRate` (dt = 1/tickRate s); rates are per second.
- Quaternions are `[x, y, z, w]`; identity is `[0, 0, 0, 1]`.
- Colors are `"#rrggbb"` strings.
- `collider.halfExtents` is `[x, z]` (2.5D kinematics act in the XZ plane).
- `moveIntent.dir` is `[x, z]`: +x east, +z south (screen-down in top-down views).
- `layer`/`mask` are bitmasks: a collides with b when `a.mask & b.layer` or `b.mask & a.layer` is non-zero.
- `renderable.primitive.size` is `[x, y, z]`.
- `environment.sun.direction` points FROM the origin TOWARD the sun (the light sits at that offset and shines back at the origin).

## Vocabulary

| Component | Owner | Description |
|---|---|---|
| `aircraft` | kernel/aircraft | External airplane/helicopter instance. Y up, Z forward; landing-contact origin. |
| `aircraftInput` | kernel/aircraft | Pilot flight controls. Power is retained when input keys are released. |
| `aircraftState` | kernel/aircraft | Deterministic flight state, including rotor phase and engine spool, preserved by keyframes. |
| `character` | kernel/character | Kinematic character controller state (speed/jump/gravity + kernel-owned vy/grounded). |
| `collider` | kernel/kinematics | 2.5D kinematic collider (circle or XZ AABB) with layer/mask bitmasks. |
| `collider3d` | physics-rapier | 3D collider (ball/cuboid/capsule/hull/trimesh/asset/heightfield) with layer/mask, sensor, and material params. Static without a rigidbody. |
| `environment` | client | Singleton scene environment: optional Earth/custom sky, ambient/sun lighting, background, fog, tone mapping, shadow quality tier. |
| `figure` | figures | What a figure is: a preset plus descriptor overrides (height, build, proportions, features, palette) and how it faces its motion. Pair with renderable.kind "figure". |
| `figureAttachment` | figures | Follow a named socket of the parent figure (with `parent`): the figures systems write localTransform from the evaluated pose each tick. |
| `figureIntent` | figures | Optional authored control of a figure: a forced mode, a look-at target, joint overrides, and IK goals. |
| `figureState` | figures | Kernel-owned locomotion state of a figure (mode, quantized speed, tick-anchored gait phase). Read it; the figures systems write it. |
| `force` | physics-rapier | Continuous force/torque applied every tick while present. |
| `fsm` | kernel/gameplay | Minimal event-driven state machine: transitions fire on world events targeting the entity. |
| `health` | content | Common gameplay hit-points component. |
| `impulse` | physics-rapier | One-shot impulse/torque; consumed the tick it is applied. |
| `joint` | physics-rapier | Impulse joint to another body (fixed/revolute/spherical/prismatic + limits/motor). |
| `kinematicBody` | kernel/kinematics | Velocity-driven body for the kinematic collision layer. |
| `lifetime` | kernel | Auto-despawn countdown in ticks. |
| `light` | client | A light source at the entity transform (directional/point/spot). |
| `localTransform` | kernel/gameplay | Parent-relative transform for entities carrying `parent`. |
| `model.signals` | client | Bind same-entity simulation fields to named GLB transform channels. Visual only; no physics writes. |
| `mountable` | kernel/vehicles | Mount points in local meters, ordered safe exit candidates, and interaction reach. Seat position is the rider camera anchor. |
| `mounted` | kernel/vehicles | Rider-to-mount relationship. Occupied seats are exclusive; mounted characters bypass walking physics. |
| `moveIntent` | kernel/character | Desired planar move direction + jump flag, consumed by the character controller. |
| `parent` | kernel/gameplay | Attach to a parent entity: transform becomes parent.transform × localTransform each tick. |
| `platformBody` | kernel | Deterministic XY platform controller: gravity, swept wall/floor/ceiling collision, jump buffering and coyote time. |
| `platformIntent` | kernel | Input to a platformBody. Scripts translate declared commands to this component. |
| `platformSolid` | kernel | Static XY solid for physics.engine=platformer; Z is ignored. |
| `renderable` | client | Client render contract: a primitive, a gltf asset (by project asset id) with optional sub-node, material override, shadows, and clip playback, or a capability-registered kind. |
| `rigidbody` | physics-rapier | 3D rigid-body dynamics: dynamic, fixed, or kinematicPosition (characters). |
| `setVelocity` | physics-rapier | One-shot velocity set; consumed the tick it is applied. |
| `tag` | content | Named tag for selecting/grouping entities (e.g. tag.name === "enemy"). |
| `timer` | kernel/gameplay | Snapshot-safe countdown timers that emit events (one-shot or repeating). Replaces callbacks. |
| `transform` | kernel | World position + orientation. pos is required; rot defaults to identity. |
| `tween` | kernel/gameplay | Data-driven value animation over ticks: component + select-style path, lerp with easing. |
| `vehicle` | kernel/vehicles | External wheeled-vehicle instance: stable id, paint, complete physics tuning, and GLB bindings. |
| `vehicleInput` | kernel/vehicles | Driver intent: signed throttle (negative brakes then reverses), signed steering (positive right), brake/handbrake. |
| `vehicleState` | kernel/vehicles | Snapshot-safe chassis state. Speeds in m/s, angles in radians; owned by installVehicles. |
| `velocity` | physics-rapier | Opt-in per-tick body velocity mirror (presence = subscription; plugin-written). |
| `weather` |  | Singleton physical atmosphere and visual weather: temperature, pressure, humidity, wind, independent cloud cover, precipitation and visibility. Readable by scripts and physics; see guide/weather.md. |
| `worldgenBuilding` | worldgen | A building generated at runtime from an outline in the entity frame, styled by a molen/archstyle@1 in the loaded pack; rendered by the worldgen client entity layer. |

## Owner: client

### `environment`

Singleton scene environment: optional Earth/custom sky, ambient/sun lighting, background, fog, tone mapping, shadow quality tier.

Required: none

```json
{
  "ambient": {
    "sky": "#ffffff",
    "ground": "#444455",
    "intensity": 1.1
  },
  "sun": {
    "direction": [
      5,
      10,
      7
    ],
    "intensity": 1.4,
    "castShadow": true
  },
  "shadows": "medium"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "sky": {
      "description": "Clear sky with sun, moon, stars and automatic lighting. Earth mode uses an explicit UTC epoch and observer; custom mode accepts authored body directions. See guide/sky.md.",
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "palette": {
              "description": "Art-directed clear-sky colors. These control the sky dome, not distance fog or weather.",
              "type": "object",
              "properties": {
                "dayZenith": {
                  "description": "Daytime overhead color, default #2374c5.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "dayHorizon": {
                  "description": "Daytime horizon and ambient light color, default #b8d7eb.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "twilight": {
                  "description": "Twilight glow and low Sun color, default #f78753.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "nightZenith": {
                  "description": "Nighttime overhead color, default #020510.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "nightHorizon": {
                  "description": "Nighttime horizon and ambient light color, default #121c32.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "ground": {
                  "description": "Below-horizon dome and ground ambient color, default #18212c.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "sun": {
                  "description": "Sun disk and high-altitude sunlight color, default #fff4dc.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "moon": {
                  "description": "Moon surface and moonlight color, default #dae5f5.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                }
              },
              "additionalProperties": false
            },
            "lighting": {
              "description": "Sky-managed lights replace environment.ambient and environment.sun when sky is enabled.",
              "type": "object",
              "properties": {
                "sunIntensity": {
                  "description": "Peak directional sunlight, default 3.",
                  "type": "number",
                  "minimum": 0
                },
                "moonIntensity": {
                  "description": "Full-moon directional light, default 0.12; scaled by phase and altitude.",
                  "type": "number",
                  "minimum": 0
                },
                "dayAmbient": {
                  "description": "Daytime hemisphere intensity, default 0.6.",
                  "type": "number",
                  "minimum": 0
                },
                "nightAmbient": {
                  "description": "Nighttime hemisphere intensity, default 0.025.",
                  "type": "number",
                  "minimum": 0
                },
                "castShadow": {
                  "description": "Sun shadows; also requires environment.shadows. Default true.",
                  "type": "boolean"
                }
              },
              "additionalProperties": false
            },
            "stars": {
              "description": "Star catalog visibility, brightness and size.",
              "type": "object",
              "properties": {
                "enabled": {
                  "description": "Show the star catalog, default true.",
                  "type": "boolean"
                },
                "magnitudeLimit": {
                  "description": "Faintest catalog magnitude rendered, default 6.",
                  "type": "number",
                  "minimum": -2,
                  "maximum": 6.5
                },
                "intensity": {
                  "description": "Star brightness multiplier, default 1; fades with daylight and moonlight.",
                  "type": "number",
                  "minimum": 0
                },
                "size": {
                  "description": "Visual angular-size multiplier, default 1.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 10
                }
              },
              "additionalProperties": false
            },
            "sun": {
              "description": "Sun disk appearance.",
              "type": "object",
              "properties": {
                "visible": {
                  "description": "Show the Sun disk; lighting is independent. Default true.",
                  "type": "boolean"
                },
                "size": {
                  "description": "Visual diameter multiplier, default 1. Does not affect astronomy or lighting.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100
                }
              },
              "additionalProperties": false
            },
            "moon": {
              "description": "Moon disk appearance.",
              "type": "object",
              "properties": {
                "visible": {
                  "description": "Show the Moon disk; lighting is independent. Default true.",
                  "type": "boolean"
                },
                "size": {
                  "description": "Visual diameter multiplier, default 1.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100
                },
                "earthshine": {
                  "description": "Dark-side visibility, default 0.025.",
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1
                }
              },
              "additionalProperties": false
            },
            "mode": {
              "type": "string",
              "const": "earth",
              "description": "Compute positions from an Earth observer and UTC clock."
            },
            "observer": {
              "type": "object",
              "properties": {
                "latitude": {
                  "type": "number",
                  "minimum": -90,
                  "maximum": 90,
                  "description": "Geodetic degrees north."
                },
                "longitude": {
                  "type": "number",
                  "minimum": -180,
                  "maximum": 180,
                  "description": "Degrees east; west is negative."
                },
                "elevation": {
                  "description": "Meters above sea level, default 0; used for lunar parallax.",
                  "type": "number",
                  "minimum": -500,
                  "maximum": 100000
                },
                "northOffsetDeg": {
                  "description": "Rotate geographic north clockwise toward +X, default 0 (-Z north).",
                  "type": "number"
                }
              },
              "required": [
                "latitude",
                "longitude"
              ],
              "additionalProperties": false,
              "description": "Geographic observing position and world orientation."
            },
            "time": {
              "type": "object",
              "properties": {
                "epochMs": {
                  "type": "number",
                  "minimum": -2208988800000,
                  "maximum": 4133980799999,
                  "description": "UTC Unix milliseconds at simulation second zero (1900–2100). Explicit: never reads the host clock."
                },
                "scale": {
                  "description": "Sky seconds per simulation second, default 1. Zero freezes, negative rewinds.",
                  "type": "number"
                }
              },
              "required": [
                "epochMs"
              ],
              "additionalProperties": false,
              "description": "UTC epoch and rate relative to simulation time."
            }
          },
          "required": [
            "mode",
            "observer",
            "time"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "palette": {
              "description": "Art-directed clear-sky colors. These control the sky dome, not distance fog or weather.",
              "type": "object",
              "properties": {
                "dayZenith": {
                  "description": "Daytime overhead color, default #2374c5.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "dayHorizon": {
                  "description": "Daytime horizon and ambient light color, default #b8d7eb.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "twilight": {
                  "description": "Twilight glow and low Sun color, default #f78753.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "nightZenith": {
                  "description": "Nighttime overhead color, default #020510.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "nightHorizon": {
                  "description": "Nighttime horizon and ambient light color, default #121c32.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "ground": {
                  "description": "Below-horizon dome and ground ambient color, default #18212c.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "sun": {
                  "description": "Sun disk and high-altitude sunlight color, default #fff4dc.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                },
                "moon": {
                  "description": "Moon surface and moonlight color, default #dae5f5.",
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$"
                }
              },
              "additionalProperties": false
            },
            "lighting": {
              "description": "Sky-managed lights replace environment.ambient and environment.sun when sky is enabled.",
              "type": "object",
              "properties": {
                "sunIntensity": {
                  "description": "Peak directional sunlight, default 3.",
                  "type": "number",
                  "minimum": 0
                },
                "moonIntensity": {
                  "description": "Full-moon directional light, default 0.12; scaled by phase and altitude.",
                  "type": "number",
                  "minimum": 0
                },
                "dayAmbient": {
                  "description": "Daytime hemisphere intensity, default 0.6.",
                  "type": "number",
                  "minimum": 0
                },
                "nightAmbient": {
                  "description": "Nighttime hemisphere intensity, default 0.025.",
                  "type": "number",
                  "minimum": 0
                },
                "castShadow": {
                  "description": "Sun shadows; also requires environment.shadows. Default true.",
                  "type": "boolean"
                }
              },
              "additionalProperties": false
            },
            "stars": {
              "description": "Star catalog visibility, brightness and size.",
              "type": "object",
              "properties": {
                "enabled": {
                  "description": "Show the star catalog, default true.",
                  "type": "boolean"
                },
                "magnitudeLimit": {
                  "description": "Faintest catalog magnitude rendered, default 6.",
                  "type": "number",
                  "minimum": -2,
                  "maximum": 6.5
                },
                "intensity": {
                  "description": "Star brightness multiplier, default 1; fades with daylight and moonlight.",
                  "type": "number",
                  "minimum": 0
                },
                "size": {
                  "description": "Visual angular-size multiplier, default 1.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 10
                }
              },
              "additionalProperties": false
            },
            "sun": {
              "description": "Sun disk appearance.",
              "type": "object",
              "properties": {
                "visible": {
                  "description": "Show the Sun disk; lighting is independent. Default true.",
                  "type": "boolean"
                },
                "size": {
                  "description": "Visual diameter multiplier, default 1. Does not affect astronomy or lighting.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100
                }
              },
              "additionalProperties": false
            },
            "moon": {
              "description": "Moon disk appearance.",
              "type": "object",
              "properties": {
                "visible": {
                  "description": "Show the Moon disk; lighting is independent. Default true.",
                  "type": "boolean"
                },
                "size": {
                  "description": "Visual diameter multiplier, default 1.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 100
                },
                "earthshine": {
                  "description": "Dark-side visibility, default 0.025.",
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1
                }
              },
              "additionalProperties": false
            },
            "mode": {
              "type": "string",
              "const": "custom",
              "description": "Use authored body positions without an Earth clock."
            },
            "sunBody": {
              "type": "object",
              "properties": {
                "direction": {
                  "minItems": 3,
                  "maxItems": 3,
                  "type": "array",
                  "items": {
                    "type": "number"
                  },
                  "description": "Nonzero direction toward the body; +X east, +Y up, -Z north. Normalized by the renderer."
                },
                "angularDiameterDeg": {
                  "description": "Apparent diameter in degrees; default 0.53.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 90
                }
              },
              "required": [
                "direction"
              ],
              "additionalProperties": false,
              "description": "Authored sun position and apparent diameter."
            },
            "moonBody": {
              "description": "Moon lit from sunBody.direction; omit for a moonless world.",
              "type": "object",
              "properties": {
                "direction": {
                  "minItems": 3,
                  "maxItems": 3,
                  "type": "array",
                  "items": {
                    "type": "number"
                  },
                  "description": "Nonzero direction toward the body; +X east, +Y up, -Z north. Normalized by the renderer."
                },
                "angularDiameterDeg": {
                  "description": "Apparent diameter in degrees; default 0.53.",
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 90
                }
              },
              "required": [
                "direction"
              ],
              "additionalProperties": false
            },
            "starRotationDeg": {
              "description": "XYZ Euler rotation in degrees of the catalog sphere; default [0,0,0].",
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              }
            }
          },
          "required": [
            "mode",
            "sunBody"
          ],
          "additionalProperties": false
        }
      ]
    },
    "ambient": {
      "type": "object",
      "properties": {
        "sky": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Sky-side (from above) ambient color '#rrggbb'."
        },
        "ground": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Ground-side (from below) ambient color '#rrggbb'."
        },
        "intensity": {
          "type": "number",
          "minimum": 0,
          "description": "Ambient intensity (unitless multiplier; default 1.1)."
        }
      },
      "additionalProperties": false,
      "description": "Hemisphere ambient light."
    },
    "sun": {
      "type": "object",
      "properties": {
        "direction": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Vector [x, y, z] pointing FROM the world origin TOWARD the sun: the directional light is placed at this offset and shines back toward the origin, so y > 0 puts the sun above the horizon (Y-up). Default [5, 10, 7]."
        },
        "color": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Sun light color '#rrggbb'."
        },
        "intensity": {
          "type": "number",
          "minimum": 0,
          "description": "Sun intensity (unitless multiplier; default 1.4)."
        },
        "castShadow": {
          "type": "boolean",
          "description": "Whether the sun casts shadows (also requires shadows != 'off')."
        }
      },
      "additionalProperties": false,
      "description": "Directional sun light."
    },
    "background": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$",
      "description": "Background clear color '#rrggbb'."
    },
    "fog": {
      "type": "object",
      "properties": {
        "color": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Fog color '#rrggbb'."
        },
        "near": {
          "type": "number",
          "minimum": 0,
          "description": "Distance from the camera in meters at which fog starts."
        },
        "far": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Distance from the camera in meters at which fog is fully opaque."
        }
      },
      "required": [
        "color"
      ],
      "additionalProperties": false,
      "description": "Linear distance fog."
    },
    "toneMapping": {
      "type": "string",
      "enum": [
        "none",
        "aces",
        "agx"
      ],
      "description": "Tone-mapping operator: none, aces, or agx."
    },
    "exposure": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Tone-mapping exposure multiplier (1 = neutral)."
    },
    "shadows": {
      "type": "string",
      "enum": [
        "off",
        "low",
        "medium",
        "high"
      ],
      "description": "Shadow quality tier (shadow-map resolution); off disables all shadows."
    }
  },
  "additionalProperties": false
}
```

</details>

### `light`

A light source at the entity transform (directional/point/spot).

Required: `type`

```json
{
  "type": "point",
  "color": "#ffdca8",
  "intensity": 2,
  "range": 12
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "directional",
        "point",
        "spot"
      ],
      "description": "Light type: directional (parallel rays), point (omnidirectional), or spot (cone). Directional/spot lights aim at the world origin by default."
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$",
      "description": "Light color as '#rrggbb'."
    },
    "intensity": {
      "type": "number",
      "minimum": 0,
      "description": "Light intensity (three.js units; a unitless multiplier)."
    },
    "range": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "point/spot falloff distance in meters (absent = unlimited)."
    },
    "angleDeg": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "spot cone half-angle in degrees, measured from the aim direction (default 45)."
    },
    "penumbra": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "spot soft-edge fraction 0..1 of the cone (default 0 = hard edge)."
    },
    "castShadow": {
      "type": "boolean",
      "description": "Whether this light casts shadows."
    }
  },
  "required": [
    "type"
  ],
  "additionalProperties": false
}
```

</details>

### `model.signals`

Bind same-entity simulation fields to named GLB transform channels. Visual only; no physics writes.

Required: `sources`, `bindings`

```json
{
  "sources": {
    "speed": {
      "component": "vehicleState",
      "path": [
        "speed"
      ]
    }
  },
  "bindings": [
    {
      "node": "speed-pointer",
      "source": "speed",
      "property": "rotation",
      "axis": "z",
      "scale": 0.04
    }
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "sources": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "component": {
            "type": "string",
            "minLength": 1,
            "description": "Component on this same entity."
          },
          "path": {
            "minItems": 1,
            "type": "array",
            "items": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1
                },
                {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                }
              ]
            },
            "description": "Explicit property names or array indices leading to a number or boolean."
          }
        },
        "required": [
          "component",
          "path"
        ],
        "additionalProperties": false
      },
      "description": "Named signals read from same-entity component fields."
    },
    "bindings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "node": {
            "type": "string",
            "minLength": 1,
            "description": "Exact loaded GLB node name."
          },
          "source": {
            "type": "string",
            "minLength": 1,
            "description": "Named simulation signal."
          },
          "property": {
            "type": "string",
            "enum": [
              "rotation",
              "position"
            ],
            "description": "Local transform channel."
          },
          "axis": {
            "type": "string",
            "enum": [
              "x",
              "y",
              "z"
            ],
            "description": "Local transform axis."
          },
          "scale": {
            "type": "number",
            "description": "Multiply the signal by this value."
          },
          "offset": {
            "description": "Offset after scaling; default zero.",
            "type": "number"
          },
          "min": {
            "description": "Minimum displacement from authored pose.",
            "type": "number"
          },
          "max": {
            "description": "Maximum displacement from authored pose.",
            "type": "number"
          }
        },
        "required": [
          "node",
          "source",
          "property",
          "axis",
          "scale"
        ],
        "additionalProperties": false
      },
      "description": "Per-model node channels and their signal calibration."
    }
  },
  "required": [
    "sources",
    "bindings"
  ],
  "additionalProperties": false
}
```

</details>

### `renderable`

Client render contract: a primitive, a gltf asset (by project asset id) with optional sub-node, material override, shadows, and clip playback, or a capability-registered kind.

Required: `kind`, `ref`

```json
{
  "kind": "primitive",
  "ref": "box",
  "materialRef": "palette:#4363d8"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "enum": [
        "primitive",
        "gltf",
        "figure"
      ],
      "description": "Render source: 'primitive' (built-in geometry named by ref), 'gltf' (an imported project asset), 'figure' (a procedural skinned figure body from the entity `figure` component)."
    },
    "ref": {
      "type": "string",
      "minLength": 1,
      "description": "Primitive name (box, sphere, plane, cylinder) or, for gltf, the project asset id."
    },
    "materialRef": {
      "type": "string",
      "description": "Material reference, e.g. 'palette:#rrggbb' or a project material doc id; overrides the asset's own materials."
    },
    "primitive": {
      "type": "object",
      "properties": {
        "size": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Primitive extents [x, y, z] in meters: box = full extents; sphere = x is the diameter; cylinder = x diameter, y height; plane = x by z. Default [1, 1, 1]."
        }
      },
      "additionalProperties": false,
      "description": "Primitive geometry parameters (kind = primitive)."
    },
    "node": {
      "type": "string",
      "minLength": 1,
      "description": "gltf: named sub-node of the asset to instance (default: the whole scene)."
    },
    "visible": {
      "type": "boolean",
      "description": "Whether the object is drawn; default true."
    },
    "shadows": {
      "type": "object",
      "properties": {
        "cast": {
          "type": "boolean",
          "description": "Whether this object casts shadows onto others."
        },
        "receive": {
          "type": "boolean",
          "description": "Whether this object receives shadows from others."
        }
      },
      "additionalProperties": false,
      "description": "Shadow participation flags."
    },
    "animation": {
      "type": "object",
      "properties": {
        "clip": {
          "type": "string",
          "minLength": 1,
          "description": "Name of the glTF animation clip to play."
        },
        "speed": {
          "type": "number",
          "description": "Playback rate multiplier (1 = authored speed)."
        },
        "loop": {
          "type": "string",
          "enum": [
            "repeat",
            "once",
            "pingpong"
          ],
          "description": "Loop mode: repeat, once (hold the last frame), or pingpong."
        },
        "paused": {
          "type": "boolean",
          "description": "Freeze playback at pausedAtTick (default startTick)."
        },
        "pausedAtTick": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Simulation tick to hold while paused; serialize this when pausing so live and captured poses agree."
        },
        "startTick": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Tick the clip started at; clip time = (tick - startTick) / tickRate * speed seconds (default 0)."
        }
      },
      "required": [
        "clip"
      ],
      "additionalProperties": false,
      "description": "gltf clip playback (client-owned); clip time derives deterministically from startTick."
    },
    "lod": {
      "anyOf": [
        {
          "type": "string",
          "const": "auto"
        },
        {
          "type": "number",
          "const": 0
        },
        {
          "type": "number",
          "const": 1
        },
        {
          "type": "number",
          "const": 2
        }
      ],
      "description": "Figure body detail tier: 0 (full), 1 (medium), 2 (far), or \"auto\" to pick by distance."
    }
  },
  "required": [
    "kind",
    "ref"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: content

### `health`

Common gameplay hit-points component.

Required: `hp`

```json
{
  "hp": 100
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "hp": {
      "type": "number",
      "description": "Hit points."
    }
  },
  "required": [
    "hp"
  ],
  "additionalProperties": {}
}
```

</details>

### `tag`

Named tag for selecting/grouping entities (e.g. tag.name === "enemy").

Required: `name`

```json
{
  "name": "enemy"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Tag name used for selecting/grouping entities, e.g. 'enemy'."
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": {}
}
```

</details>

## Owner: figures

### `figure`

What a figure is: a preset plus descriptor overrides (height, build, proportions, features, palette) and how it faces its motion. Pair with renderable.kind "figure".

Required: `preset`

```json
{
  "preset": "human.adult",
  "height": 1.7,
  "palette": {
    "top": "#3b6ea5",
    "bottom": "#2f2f38"
  }
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "preset": {
      "type": "string",
      "enum": [
        "human.adult",
        "human.child",
        "human.elder",
        "dog",
        "cat",
        "horse",
        "deer",
        "cow",
        "sheep"
      ],
      "description": "Preset the descriptor starts from, e.g. 'human.adult' or 'horse'."
    },
    "height": {
      "type": "number",
      "minimum": 0.2,
      "maximum": 4,
      "description": "Standing height in meters (bipeds: head top; quadrupeds: withers)."
    },
    "build": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Body mass from -1 (slight) to 1 (heavy): limb and torso radii, shoulder width."
    },
    "age": {
      "type": "string",
      "enum": [
        "child",
        "adult",
        "elder"
      ],
      "description": "Age band (head and limb ratios)."
    },
    "proportions": {
      "type": "object",
      "properties": {
        "legRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Leg length multiplier (1 = preset)."
        },
        "armRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Arm length multiplier (1 = preset)."
        },
        "torsoRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Torso length multiplier (1 = preset)."
        },
        "headScale": {
          "type": "number",
          "minimum": 0.6,
          "maximum": 2,
          "description": "Head size multiplier (1 = preset)."
        },
        "neckLength": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Neck length multiplier (1 = preset)."
        },
        "neckPitch": {
          "type": "number",
          "minimum": -1.2,
          "maximum": 1.6,
          "description": "Quadruped neck pitch above the spine line, radians."
        },
        "shoulderWidth": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Shoulder width multiplier (1 = preset)."
        },
        "hipWidth": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Hip width multiplier (1 = preset)."
        },
        "bodyLength": {
          "type": "number",
          "minimum": 0.8,
          "maximum": 2.5,
          "description": "Quadruped body length as a multiple of height (withers)."
        },
        "tailLength": {
          "type": "number",
          "minimum": 0,
          "maximum": 2,
          "description": "Tail length as a multiple of height."
        },
        "earSize": {
          "type": "number",
          "minimum": 0,
          "maximum": 2,
          "description": "Ear size multiplier (1 = preset)."
        },
        "snoutLength": {
          "type": "number",
          "minimum": 0,
          "maximum": 1.5,
          "description": "Snout length as a multiple of the head unit (0 = flat face)."
        }
      },
      "additionalProperties": false,
      "description": "Proportion multipliers over the preset."
    },
    "features": {
      "type": "object",
      "properties": {
        "hair": {
          "type": "string",
          "enum": [
            "none",
            "cap",
            "bob",
            "long"
          ],
          "description": "Hair shell style."
        },
        "hands": {
          "type": "string",
          "enum": [
            "mitten",
            "fingers"
          ],
          "description": "Hand geometry (fingers: near tier only)."
        },
        "sleeves": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long"
          ],
          "description": "Sleeve length (top color extent)."
        },
        "legs": {
          "type": "string",
          "enum": [
            "shorts",
            "long"
          ],
          "description": "Legwear length (bottom color extent)."
        },
        "tail": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long",
            "bushy"
          ],
          "description": "Tail style."
        },
        "ears": {
          "type": "string",
          "enum": [
            "none",
            "round",
            "pointed",
            "floppy"
          ],
          "description": "Ear style."
        },
        "horns": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long",
            "antlers"
          ],
          "description": "Horn style."
        },
        "feet": {
          "type": "string",
          "enum": [
            "plantigrade",
            "digitigrade",
            "unguligrade"
          ],
          "description": "Foot stance: flat feet, paws, or hooves."
        },
        "mane": {
          "type": "boolean",
          "description": "Neck mane (horses)."
        }
      },
      "additionalProperties": false,
      "description": "Discrete feature choices over the preset."
    },
    "palette": {
      "type": "object",
      "properties": {
        "skin": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Skin, fur, or hide color."
        },
        "hair": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Hair or mane color."
        },
        "eyes": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Color as \"#rrggbb\"."
        },
        "top": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Torso and sleeves."
        },
        "bottom": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Legwear."
        },
        "shoes": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Shoes, paws, or hooves."
        },
        "accent": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Belt, collar, or saddle strip."
        },
        "markings": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Secondary fur markings (animals)."
        }
      },
      "additionalProperties": false,
      "description": "Color blocks over the preset (\"#rrggbb\")."
    },
    "seed": {
      "type": "string",
      "minLength": 1,
      "description": "Detail jitter seed (symmetry-safe details only; default none)."
    },
    "facing": {
      "type": "string",
      "enum": [
        "velocity",
        "manual"
      ],
      "description": "How the figure turns: 'velocity' (default) writes transform.rot toward the travel direction; 'manual' leaves rotation to whoever owns it."
    },
    "turnRate": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Max turn rate in rad/s for velocity facing (default 10)."
    },
    "speedSource": {
      "type": "string",
      "enum": [
        "auto",
        "transform",
        "none"
      ],
      "description": "Where speed comes from: 'auto' (kinematicBody, character, platformBody, rapier velocity, else transform deltas), 'transform', or 'none'."
    },
    "blendTicks": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Ticks to blend between modes (default 12)."
    }
  },
  "required": [
    "preset"
  ],
  "additionalProperties": false
}
```

</details>

### `figureAttachment`

Follow a named socket of the parent figure (with `parent`): the figures systems write localTransform from the evaluated pose each tick.

Required: `socket`

```json
{
  "socket": "head.top"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "socket": {
      "type": "string",
      "minLength": 1,
      "description": "Socket name on the parent figure: 'head.top', 'hand.r', 'back', 'saddle', ..."
    },
    "offset": {
      "type": "object",
      "properties": {
        "pos": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Socket-local position offset in meters."
        },
        "rot": {
          "minItems": 4,
          "maxItems": 4,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Socket-local rotation offset [x, y, z, w]."
        }
      },
      "additionalProperties": false,
      "description": "Extra socket-local offset."
    },
    "anchor": {
      "type": "string",
      "enum": [
        "origin",
        "pelvis",
        "eye"
      ],
      "description": "Which point of the attached entity sits on the socket (default 'origin')."
    }
  },
  "required": [
    "socket"
  ],
  "additionalProperties": false
}
```

</details>

### `figureIntent`

Optional authored control of a figure: a forced mode, a look-at target, joint overrides, and IK goals.

Required: none

```json
{
  "mode": "sit"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": [
        "idle",
        "walk",
        "run",
        "jump",
        "fall",
        "sit",
        "custom"
      ],
      "description": "Force a mode instead of deriving it from motion."
    },
    "lookAt": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "pos": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "World point [x, y, z] to look at."
            }
          },
          "required": [
            "pos"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "entity": {
              "type": "string",
              "minLength": 1,
              "description": "Entity id to look at."
            }
          },
          "required": [
            "entity"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Aim the head at a world point or another entity."
    },
    "overrides": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "minItems": 4,
        "maxItems": 4,
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      "description": "Joint-local rotations [x, y, z, w] by canonical joint name, replacing the gait."
    },
    "ik": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "enum": [
          "hand.l",
          "hand.r",
          "foot.l",
          "foot.r"
        ]
      },
      "additionalProperties": {
        "minItems": 3,
        "maxItems": 3,
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      "description": "Figure-local effector goals solved by two-bone IK after the gait."
    },
    "footIk": {
      "type": "boolean",
      "description": "Plant feet on the ground field (opt-in)."
    }
  },
  "additionalProperties": false
}
```

</details>

### `figureState`

Kernel-owned locomotion state of a figure (mode, quantized speed, tick-anchored gait phase). Read it; the figures systems write it.

Required: `mode`, `speed`, `strideRate`, `phaseAt`, `phaseAtTick`, `modeAtTick`

```json
{
  "mode": "walk",
  "speed": 1.4,
  "strideRate": 1.09,
  "phaseAt": 0.37,
  "phaseAtTick": 1200,
  "modeAtTick": 1180,
  "prevMode": "idle"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": [
        "idle",
        "walk",
        "run",
        "jump",
        "fall",
        "sit",
        "custom"
      ],
      "description": "Current locomotion mode."
    },
    "gait": {
      "type": "string",
      "enum": [
        "walk",
        "trot",
        "gallop"
      ],
      "description": "Quadruped gait for walk/run modes."
    },
    "speed": {
      "type": "number",
      "minimum": 0,
      "description": "Planar speed in m/s (quantized)."
    },
    "travel": {
      "type": "number",
      "description": "Travel direction relative to facing, radians (absent = forward)."
    },
    "strideRate": {
      "type": "number",
      "minimum": 0,
      "description": "Gait cycles per second."
    },
    "phaseAt": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Gait phase [0, 1) at phaseAtTick."
    },
    "phaseAtTick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the phase was anchored at."
    },
    "modeAtTick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the current mode began (blend start)."
    },
    "prevMode": {
      "type": "string",
      "enum": [
        "idle",
        "walk",
        "run",
        "jump",
        "fall",
        "sit",
        "custom"
      ],
      "description": "Mode being blended out of."
    },
    "lookAtTick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the look-at target last changed."
    }
  },
  "required": [
    "mode",
    "speed",
    "strideRate",
    "phaseAt",
    "phaseAtTick",
    "modeAtTick"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel

### `lifetime`

Auto-despawn countdown in ticks.

Required: `ticksLeft`

```json
{
  "ticksLeft": 30
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "ticksLeft": {
      "type": "number",
      "description": "Ticks remaining before the entity is despawned; decremented each tick."
    }
  },
  "required": [
    "ticksLeft"
  ],
  "additionalProperties": false
}
```

</details>

### `platformBody`

Deterministic XY platform controller: gravity, swept wall/floor/ceiling collision, jump buffering and coyote time.

Required: `halfExtents`

```json
{
  "halfExtents": [
    0.4,
    0.6
  ],
  "speed": 7,
  "jumpSpeed": 11
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "halfExtents": {
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "description": "Moving XY box half-width/half-height, world meters. Z remains unchanged."
    },
    "vel": {
      "description": "XY velocity in meters/second; default [0,0].",
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "speed": {
      "description": "Maximum horizontal speed; default 7 m/s.",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "acceleration": {
      "description": "Horizontal acceleration/braking; default 45 m/s squared.",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "gravity": {
      "description": "Downward acceleration; default 28 m/s squared.",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "jumpSpeed": {
      "description": "Jump velocity; default 11 m/s.",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "grounded": {
      "description": "Output: landed in the last physics tick.",
      "type": "boolean"
    },
    "coyoteTicks": {
      "description": "Jump grace after leaving a ledge; default 3 ticks.",
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "bufferTicks": {
      "description": "Jump input buffer before landing; default 4 ticks.",
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "grace": {
      "description": "Runtime remaining coyote ticks; checkpointed.",
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "buffered": {
      "description": "Runtime remaining buffered jump ticks; checkpointed.",
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "halfExtents"
  ],
  "additionalProperties": false
}
```

</details>

### `platformIntent`

Input to a platformBody. Scripts translate declared commands to this component.

Required: `move`

```json
{
  "move": 1,
  "jump": true,
  "jumpHeld": true
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "move": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Horizontal intent -1..1."
    },
    "jump": {
      "description": "One-shot jump request, consumed by the controller. Send on press, not every tick.",
      "type": "boolean"
    },
    "jumpHeld": {
      "description": "Hold for full height; false cuts upward velocity for a short hop. Default true.",
      "type": "boolean"
    }
  },
  "required": [
    "move"
  ],
  "additionalProperties": false
}
```

</details>

### `platformSolid`

Static XY solid for physics.engine=platformer; Z is ignored.

Required: `halfExtents`

```json
{
  "halfExtents": [
    3,
    0.5
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "halfExtents": {
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "description": "Static XY box half-width/half-height in world meters. Rotation and visual scale do not affect collision."
    },
    "oneWay": {
      "type": "boolean",
      "description": "Only stop descending bodies crossing the top; default false."
    }
  },
  "required": [
    "halfExtents"
  ],
  "additionalProperties": false
}
```

</details>

### `transform`

World position + orientation. pos is required; rot defaults to identity.

Required: `pos`

```json
{
  "pos": [
    0,
    1.5,
    -3
  ],
  "rot": [
    0,
    0,
    0,
    1
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pos": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "World position [x, y, z] in meters (Y-up)."
    },
    "rot": {
      "minItems": 4,
      "maxItems": 4,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "World orientation quaternion [x, y, z, w]; defaults to identity [0, 0, 0, 1]."
    },
    "scale": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Per-axis scale factors [x, y, z]; defaults to [1, 1, 1]."
    },
    "teleport": {
      "type": "boolean",
      "description": "Client interpolation hint: when true the client snaps to this update instead of lerping from the previous tick."
    }
  },
  "required": [
    "pos"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel/aircraft

### `aircraft`

External airplane/helicopter instance. Y up, Z forward; landing-contact origin.

Required: `kind`, `spec`

```json
{
  "kind": "example.airplane",
  "spec": {
    "label": "Example airplane",
    "model": "airplane",
    "mass": 1200,
    "span": 10,
    "length": 8,
    "height": 3,
    "centerOfMass": [
      0,
      1,
      0
    ],
    "pilotEye": [
      0,
      1.8,
      0
    ],
    "engine": {
      "position": [
        0,
        1,
        2.5
      ],
      "thrustAxis": [
        0,
        0,
        1
      ],
      "power": 200000,
      "idleRpm": 0.2,
      "spoolRate": 0.5,
      "rotorAngularSpeed": 200
    },
    "airplane": {
      "wingPosition": [
        0,
        1,
        0
      ],
      "wingArea": 16,
      "controlAuthoritySpeed": 45,
      "maxControlAuthority": 1.3,
      "pitchAuthority": 0.4,
      "pitchResponse": 0.75,
      "stallPitchRate": 0.18,
      "rollAuthority": 1,
      "rollResponse": 2,
      "rudderAuthority": 0.2,
      "groundSteerSpeed": 8,
      "coordinatedTurnMinSpeed": 25,
      "groundLevelRate": 2,
      "maxPitch": 1.2,
      "maxGroundPitch": 0.2,
      "maxRoll": 1.3,
      "camberAngle": 0.04,
      "flapLift": 0.3,
      "postStallFlapEffect": 0.4,
      "stallAngle": 0.28,
      "stallSpeed": 22,
      "liftSlope": 4.5,
      "postStallLift": 0.2,
      "postStallDecay": 2.8,
      "profileDrag": 0.025,
      "inducedDrag": 0.065,
      "gearDrag": 0.018,
      "flapDrag": 0.035,
      "stallDrag": 0.2,
      "propellerEfficiency": 0.8,
      "maxThrust": 5000,
      "minPropellerSpeed": 40,
      "lateralDamping": 0.8,
      "brakeDeceleration": 7,
      "rollingDeceleration": 0.22,
      "groundTrackRate": 12
    },
    "hardLandingSpeed": 4.5,
    "hardLandingRoll": 0.3,
    "hardLandingPitch": 0.35,
    "maxSupportStep": 0.65,
    "collisionProbes": [
      [
        0,
        1,
        0
      ]
    ],
    "visual": {
      "rotors": [
        {
          "node": "propeller",
          "axis": "z",
          "multiplier": 1
        }
      ],
      "gearNodes": [
        "gear"
      ],
      "flaps": [
        {
          "node": "flap",
          "axis": "x",
          "multiplier": -0.45
        }
      ],
      "ailerons": [
        {
          "node": "aileron",
          "axis": "x",
          "multiplier": 0.3
        }
      ],
      "controlStick": {
        "node": "control-stick",
        "pitchAxis": "x",
        "rollAxis": "z"
      },
      "airspeedGaugeMax": 180
    }
  }
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "minLength": 1,
      "description": "Stable external entity/type id."
    },
    "spec": {
      "type": "object",
      "properties": {
        "label": {
          "type": "string",
          "minLength": 1,
          "description": "External label setting."
        },
        "model": {
          "type": "string",
          "enum": [
            "airplane",
            "helicopter"
          ],
          "description": "External model setting."
        },
        "mass": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External mass setting."
        },
        "span": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External span setting."
        },
        "length": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External length setting."
        },
        "height": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External height setting."
        },
        "centerOfMass": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "External centerOfMass setting."
        },
        "pilotEye": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "External pilotEye setting."
        },
        "engine": {
          "description": "Single engine, implicitly named main. Supply exactly one of engine or engines.",
          "type": "object",
          "properties": {
            "position": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Engine thrust application point in aircraft-local meters, relative to the landing-contact origin."
            },
            "thrustAxis": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Local thrust direction; normalized by the solver."
            },
            "power": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Maximum shaft power in watts, for this engine only."
            },
            "idleRpm": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "External idleRpm setting."
            },
            "spoolRate": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External spoolRate setting."
            },
            "rotorAngularSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External rotorAngularSpeed setting."
            },
            "propellerEfficiency": {
              "description": "Per-engine override of airplane.propellerEfficiency.",
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "maxThrust": {
              "description": "Per-engine static thrust cap in newtons; defaults to airplane.maxThrust.",
              "type": "number",
              "exclusiveMinimum": 0
            },
            "minPropellerSpeed": {
              "description": "Minimum propeller advance speed in m/s for the power/thrust calculation; defaults to airplane.minPropellerSpeed.",
              "type": "number",
              "exclusiveMinimum": 0
            }
          },
          "required": [
            "position",
            "thrustAxis",
            "power",
            "idleRpm",
            "spoolRate",
            "rotorAngularSpeed"
          ],
          "additionalProperties": false
        },
        "engines": {
          "description": "Named independent airplane engines; ids must be unique. Each power/thrust limit is per engine.",
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "position": {
                "minItems": 3,
                "maxItems": 3,
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "Engine thrust application point in aircraft-local meters, relative to the landing-contact origin."
              },
              "thrustAxis": {
                "minItems": 3,
                "maxItems": 3,
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "Local thrust direction; normalized by the solver."
              },
              "power": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "Maximum shaft power in watts, for this engine only."
              },
              "idleRpm": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "External idleRpm setting."
              },
              "spoolRate": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "External spoolRate setting."
              },
              "rotorAngularSpeed": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "External rotorAngularSpeed setting."
              },
              "propellerEfficiency": {
                "description": "Per-engine override of airplane.propellerEfficiency.",
                "type": "number",
                "minimum": 0,
                "maximum": 1
              },
              "maxThrust": {
                "description": "Per-engine static thrust cap in newtons; defaults to airplane.maxThrust.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "minPropellerSpeed": {
                "description": "Minimum propeller advance speed in m/s for the power/thrust calculation; defaults to airplane.minPropellerSpeed.",
                "type": "number",
                "exclusiveMinimum": 0
              },
              "id": {
                "type": "string",
                "pattern": "^[A-Za-z][A-Za-z0-9_-]*$",
                "description": "Stable engine id, such as left or right; single-engine form uses main."
              }
            },
            "required": [
              "position",
              "thrustAxis",
              "power",
              "idleRpm",
              "spoolRate",
              "rotorAngularSpeed",
              "id"
            ],
            "additionalProperties": false
          }
        },
        "airplane": {
          "description": "External airplane setting.",
          "type": "object",
          "properties": {
            "wingPosition": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "External wingPosition setting."
            },
            "wingArea": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External wingArea setting."
            },
            "controlAuthoritySpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External controlAuthoritySpeed setting."
            },
            "maxControlAuthority": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxControlAuthority setting."
            },
            "pitchAuthority": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External pitchAuthority setting."
            },
            "pitchResponse": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External pitchResponse setting."
            },
            "stallPitchRate": {
              "type": "number",
              "minimum": 0,
              "description": "External stallPitchRate setting."
            },
            "rollAuthority": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External rollAuthority setting."
            },
            "rollResponse": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External rollResponse setting."
            },
            "rudderAuthority": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External rudderAuthority setting."
            },
            "groundSteerSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External groundSteerSpeed setting."
            },
            "coordinatedTurnMinSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External coordinatedTurnMinSpeed setting."
            },
            "groundLevelRate": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External groundLevelRate setting."
            },
            "maxPitch": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxPitch setting."
            },
            "maxGroundPitch": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxGroundPitch setting."
            },
            "maxRoll": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxRoll setting."
            },
            "camberAngle": {
              "type": "number",
              "description": "External camberAngle setting."
            },
            "flapLift": {
              "type": "number",
              "minimum": 0,
              "description": "External flapLift setting."
            },
            "postStallFlapEffect": {
              "type": "number",
              "minimum": 0,
              "description": "External postStallFlapEffect setting."
            },
            "stallAngle": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External stallAngle setting."
            },
            "stallTransitionAngle": {
              "description": "Radians beyond stallAngle over which flow separates smoothly. Default 0.12.",
              "type": "number",
              "exclusiveMinimum": 0
            },
            "yawStability": {
              "description": "Sideslip restoring yaw rate per radian at reference airspeed, in 1/s. Default 1.",
              "type": "number",
              "minimum": 0
            },
            "yawInertia": {
              "description": "Yaw inertia in kg m². Default mass * (span² + length²) / 12.",
              "type": "number",
              "exclusiveMinimum": 0
            },
            "thrustYawDamping": {
              "description": "Thrust-induced yaw-rate damping in 1/s at reference airspeed. Default 1.2; scales with airspeed with a 20% floor.",
              "type": "number",
              "minimum": 0
            },
            "stallSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Legacy tuning reference in m/s; aerodynamic stall detection uses angle of attack."
            },
            "liftSlope": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External liftSlope setting."
            },
            "postStallLift": {
              "type": "number",
              "minimum": 0,
              "description": "External postStallLift setting."
            },
            "postStallDecay": {
              "type": "number",
              "minimum": 0,
              "description": "External postStallDecay setting."
            },
            "profileDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External profileDrag setting."
            },
            "inducedDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External inducedDrag setting."
            },
            "gearDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External gearDrag setting."
            },
            "flapDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External flapDrag setting."
            },
            "stallDrag": {
              "type": "number",
              "minimum": 0,
              "description": "Broadside separated-flow drag coefficient, blended by separation and sin(alpha)^2."
            },
            "propellerEfficiency": {
              "type": "number",
              "minimum": 0,
              "description": "External propellerEfficiency setting."
            },
            "maxThrust": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxThrust setting."
            },
            "minPropellerSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External minPropellerSpeed setting."
            },
            "lateralDamping": {
              "type": "number",
              "minimum": 0,
              "description": "External lateralDamping setting."
            },
            "brakeDeceleration": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External brakeDeceleration setting."
            },
            "rollingDeceleration": {
              "type": "number",
              "minimum": 0,
              "description": "External rollingDeceleration setting."
            },
            "groundTrackRate": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External groundTrackRate setting."
            }
          },
          "required": [
            "wingPosition",
            "wingArea",
            "controlAuthoritySpeed",
            "maxControlAuthority",
            "pitchAuthority",
            "pitchResponse",
            "stallPitchRate",
            "rollAuthority",
            "rollResponse",
            "rudderAuthority",
            "groundSteerSpeed",
            "coordinatedTurnMinSpeed",
            "groundLevelRate",
            "maxPitch",
            "maxGroundPitch",
            "maxRoll",
            "camberAngle",
            "flapLift",
            "postStallFlapEffect",
            "stallAngle",
            "stallSpeed",
            "liftSlope",
            "postStallLift",
            "postStallDecay",
            "profileDrag",
            "inducedDrag",
            "gearDrag",
            "flapDrag",
            "stallDrag",
            "propellerEfficiency",
            "maxThrust",
            "minPropellerSpeed",
            "lateralDamping",
            "brakeDeceleration",
            "rollingDeceleration",
            "groundTrackRate"
          ],
          "additionalProperties": false
        },
        "helicopter": {
          "description": "External helicopter setting.",
          "type": "object",
          "properties": {
            "rotorPosition": {
              "minItems": 3,
              "maxItems": 3,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "External rotorPosition setting."
            },
            "rotorRadius": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External rotorRadius setting."
            },
            "cyclicTilt": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External cyclicTilt setting."
            },
            "cyclicResponse": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External cyclicResponse setting."
            },
            "cyclicDamping": {
              "type": "number",
              "minimum": 0,
              "description": "External cyclicDamping setting."
            },
            "groundLevelRate": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External groundLevelRate setting."
            },
            "maxTilt": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External maxTilt setting."
            },
            "yawRate": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External yawRate setting."
            },
            "liftMultiplier": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External liftMultiplier setting."
            },
            "groundEffect": {
              "type": "number",
              "minimum": 0,
              "description": "External groundEffect setting."
            },
            "translationalLift": {
              "type": "number",
              "minimum": 0,
              "description": "External translationalLift setting."
            },
            "translationalLiftSpeed": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External translationalLiftSpeed setting."
            },
            "verticalDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External verticalDrag setting."
            },
            "horizontalDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External horizontalDrag setting."
            },
            "quadraticDrag": {
              "type": "number",
              "minimum": 0,
              "description": "External quadraticDrag setting."
            },
            "groundDeceleration": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "External groundDeceleration setting."
            }
          },
          "required": [
            "rotorPosition",
            "rotorRadius",
            "cyclicTilt",
            "cyclicResponse",
            "cyclicDamping",
            "groundLevelRate",
            "maxTilt",
            "yawRate",
            "liftMultiplier",
            "groundEffect",
            "translationalLift",
            "translationalLiftSpeed",
            "verticalDrag",
            "horizontalDrag",
            "quadraticDrag",
            "groundDeceleration"
          ],
          "additionalProperties": false
        },
        "hardLandingSpeed": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External hardLandingSpeed setting."
        },
        "hardLandingRoll": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External hardLandingRoll setting."
        },
        "hardLandingPitch": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External hardLandingPitch setting."
        },
        "maxSupportStep": {
          "type": "number",
          "minimum": 0,
          "description": "External maxSupportStep setting."
        },
        "collisionProbes": {
          "minItems": 1,
          "type": "array",
          "items": {
            "minItems": 3,
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "number"
            }
          },
          "description": "External collisionProbes setting."
        },
        "visual": {
          "type": "object",
          "properties": {
            "rotors": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "node": {
                    "type": "string",
                    "minLength": 1,
                    "description": "External node setting."
                  },
                  "axis": {
                    "type": "string",
                    "enum": [
                      "x",
                      "y",
                      "z"
                    ],
                    "description": "External axis setting."
                  },
                  "multiplier": {
                    "type": "number",
                    "description": "External multiplier setting."
                  },
                  "engine": {
                    "description": "Engine id driving this propeller; omitted follows the first engine.",
                    "type": "string",
                    "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                  }
                },
                "required": [
                  "node",
                  "axis",
                  "multiplier"
                ],
                "additionalProperties": false
              },
              "description": "External rotors setting."
            },
            "gearNodes": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              },
              "description": "External gearNodes setting."
            },
            "flaps": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "node": {
                    "type": "string",
                    "minLength": 1,
                    "description": "External node setting."
                  },
                  "axis": {
                    "type": "string",
                    "enum": [
                      "x",
                      "y",
                      "z"
                    ],
                    "description": "External axis setting."
                  },
                  "multiplier": {
                    "type": "number",
                    "description": "External multiplier setting."
                  }
                },
                "required": [
                  "node",
                  "axis",
                  "multiplier"
                ],
                "additionalProperties": false
              },
              "description": "External flaps setting."
            },
            "ailerons": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "node": {
                    "type": "string",
                    "minLength": 1,
                    "description": "External node setting."
                  },
                  "axis": {
                    "type": "string",
                    "enum": [
                      "x",
                      "y",
                      "z"
                    ],
                    "description": "External axis setting."
                  },
                  "multiplier": {
                    "type": "number",
                    "description": "External multiplier setting."
                  }
                },
                "required": [
                  "node",
                  "axis",
                  "multiplier"
                ],
                "additionalProperties": false
              },
              "description": "External ailerons setting."
            },
            "controlStick": {
              "description": "External controlStick setting.",
              "type": "object",
              "properties": {
                "node": {
                  "type": "string",
                  "minLength": 1,
                  "description": "External node setting."
                },
                "pitchAxis": {
                  "type": "string",
                  "enum": [
                    "x",
                    "y",
                    "z"
                  ],
                  "description": "External pitchAxis setting."
                },
                "rollAxis": {
                  "type": "string",
                  "enum": [
                    "x",
                    "y",
                    "z"
                  ],
                  "description": "External rollAxis setting."
                }
              },
              "required": [
                "node",
                "pitchAxis",
                "rollAxis"
              ],
              "additionalProperties": false
            },
            "collective": {
              "description": "External collective setting.",
              "type": "object",
              "properties": {
                "node": {
                  "type": "string",
                  "minLength": 1,
                  "description": "External node setting."
                },
                "axis": {
                  "type": "string",
                  "enum": [
                    "x",
                    "y",
                    "z"
                  ],
                  "description": "External axis setting."
                },
                "multiplier": {
                  "type": "number",
                  "description": "External multiplier setting."
                }
              },
              "required": [
                "node",
                "axis",
                "multiplier"
              ],
              "additionalProperties": false
            },
            "airspeedGaugeMax": {
              "description": "External airspeedGaugeMax setting.",
              "type": "number",
              "exclusiveMinimum": 0
            },
            "interior": {
              "description": "External interior setting.",
              "type": "object",
              "properties": {
                "nodes": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": "Cabin nodes in the same exterior/interior GLB."
                },
                "sources": {
                  "description": "Optional component fields overriding or extending host telemetry.",
                  "type": "object",
                  "propertyNames": {
                    "type": "string",
                    "minLength": 1
                  },
                  "additionalProperties": {
                    "type": "object",
                    "properties": {
                      "component": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Component on this same entity."
                      },
                      "path": {
                        "minItems": 1,
                        "type": "array",
                        "items": {
                          "anyOf": [
                            {
                              "type": "string",
                              "minLength": 1
                            },
                            {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 9007199254740991
                            }
                          ]
                        },
                        "description": "Explicit property names or array indices leading to a number or boolean."
                      }
                    },
                    "required": [
                      "component",
                      "path"
                    ],
                    "additionalProperties": false
                  }
                },
                "bindings": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "node": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Exact loaded GLB node name."
                      },
                      "source": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Named simulation signal."
                      },
                      "property": {
                        "type": "string",
                        "enum": [
                          "rotation",
                          "position"
                        ],
                        "description": "Local transform channel."
                      },
                      "axis": {
                        "type": "string",
                        "enum": [
                          "x",
                          "y",
                          "z"
                        ],
                        "description": "Local transform axis."
                      },
                      "scale": {
                        "type": "number",
                        "description": "Multiply the signal by this value."
                      },
                      "offset": {
                        "description": "Offset after scaling; default zero.",
                        "type": "number"
                      },
                      "min": {
                        "description": "Minimum displacement from authored pose.",
                        "type": "number"
                      },
                      "max": {
                        "description": "Maximum displacement from authored pose.",
                        "type": "number"
                      }
                    },
                    "required": [
                      "node",
                      "source",
                      "property",
                      "axis",
                      "scale"
                    ],
                    "additionalProperties": false
                  },
                  "description": "Per-model node channels and their signal calibration."
                }
              },
              "required": [
                "nodes",
                "bindings"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "rotors",
            "gearNodes",
            "flaps",
            "ailerons"
          ],
          "additionalProperties": false,
          "description": "External visual setting."
        }
      },
      "required": [
        "label",
        "model",
        "mass",
        "span",
        "length",
        "height",
        "centerOfMass",
        "pilotEye",
        "hardLandingSpeed",
        "hardLandingRoll",
        "hardLandingPitch",
        "maxSupportStep",
        "collisionProbes",
        "visual"
      ],
      "additionalProperties": false,
      "description": "Complete airplane or helicopter performance configuration."
    }
  },
  "required": [
    "kind",
    "spec"
  ],
  "additionalProperties": false
}
```

</details>

### `aircraftInput`

Pilot flight controls. Power is retained when input keys are released.

Required: `power`, `pitch`, `roll`, `yaw`, `brake`, `engine`, `gear`, `flaps`

```json
{
  "power": 0,
  "pitch": 0,
  "roll": 0,
  "yaw": 0,
  "brake": true,
  "engine": false,
  "gear": true,
  "flaps": false
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "power": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Absolute throttle for a plane; collective for a helicopter."
    },
    "pitch": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Positive pulls the nose up."
    },
    "roll": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Positive banks right."
    },
    "yaw": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Positive rudder/pedals turns right."
    },
    "brake": {
      "type": "boolean",
      "description": "Ground wheel brake."
    },
    "engine": {
      "type": "boolean",
      "description": "Engine on; rotor/propeller spools over time."
    },
    "engines": {
      "description": "Per-engine pilot overrides by id. Failures live in aircraftState and cannot be cleared by pilot input.",
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[A-Za-z][A-Za-z0-9_-]*$",
        "description": "Stable engine id, such as left or right; single-engine form uses main."
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "power": {
            "description": "Absolute throttle override; omitted inherits common power.",
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "enabled": {
            "description": "Individual engine switch; common engine switch is the master cutoff.",
            "type": "boolean"
          }
        },
        "additionalProperties": false
      }
    },
    "gear": {
      "type": "boolean",
      "description": "Landing gear extended; helicopter skids are fixed."
    },
    "flaps": {
      "type": "boolean",
      "description": "Plane landing flaps extended."
    }
  },
  "required": [
    "power",
    "pitch",
    "roll",
    "yaw",
    "brake",
    "engine",
    "gear",
    "flaps"
  ],
  "additionalProperties": false
}
```

</details>

### `aircraftState`

Deterministic flight state, including rotor phase and engine spool, preserved by keyframes.

Required: `velocity`, `yaw`, `pitch`, `roll`, `pitchRate`, `rollRate`, `rpm`, `rotorAngle`, `airspeed`, `altitudeAGL`, `verticalSpeed`, `angleOfAttack`, `stalled`, `grounded`, `crashed`, `waitingForTerrain`

```json
{
  "velocity": [
    0,
    0,
    0
  ],
  "yaw": 0,
  "pitch": 0,
  "roll": 0,
  "pitchRate": 0,
  "rollRate": 0,
  "rpm": 0,
  "rotorAngle": 0,
  "airspeed": 0,
  "altitudeAGL": 0,
  "verticalSpeed": 0,
  "angleOfAttack": 0,
  "stalled": false,
  "grounded": true,
  "crashed": false,
  "waitingForTerrain": false
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "velocity": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "World velocity in meters per second."
    },
    "yaw": {
      "type": "number",
      "description": "Heading in radians, zero +Z."
    },
    "pitch": {
      "type": "number",
      "description": "Nose-up angle in radians."
    },
    "roll": {
      "type": "number",
      "description": "Right bank angle in radians."
    },
    "pitchRate": {
      "type": "number",
      "description": "Pitch angular speed in radians per second."
    },
    "rollRate": {
      "type": "number",
      "description": "Roll angular speed in radians per second."
    },
    "thrustYawRate": {
      "description": "Additional thrust-induced yaw angular speed about local +Y, in rad/s.",
      "type": "number"
    },
    "engines": {
      "description": "Authoritative individual spool, rotor phase, failure and thrust state; initialized by the solver.",
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[A-Za-z][A-Za-z0-9_-]*$",
        "description": "Stable engine id, such as left or right; single-engine form uses main."
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "rpm": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "rotorAngle": {
            "type": "number"
          },
          "failed": {
            "type": "boolean"
          },
          "thrust": {
            "type": "number",
            "minimum": 0,
            "description": "Current propeller thrust in newtons; zero for the helicopter shaft engine."
          }
        },
        "required": [
          "rpm",
          "rotorAngle",
          "failed",
          "thrust"
        ],
        "additionalProperties": false
      }
    },
    "rpm": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Maximum normalized RPM across all engines; used by common HUDs and exit checks."
    },
    "rotorAngle": {
      "type": "number",
      "description": "First engine rotor phase, wrapped in radians; bind visuals by engine id for independent phases."
    },
    "airspeed": {
      "type": "number",
      "minimum": 0,
      "description": "Speed relative to wind in meters per second."
    },
    "altitudeAGL": {
      "type": "number",
      "minimum": 0,
      "description": "Height above available terrain in meters."
    },
    "verticalSpeed": {
      "type": "number",
      "description": "Vertical velocity in meters per second."
    },
    "angleOfAttack": {
      "type": "number",
      "description": "Wing incidence relative to airflow in radians."
    },
    "stalled": {
      "type": "boolean",
      "description": "Wing beyond useful lift envelope."
    },
    "grounded": {
      "type": "boolean",
      "description": "Supported by landing surface."
    },
    "crashed": {
      "type": "boolean",
      "description": "Hard landing or obstruction impact; explicit recovery required."
    },
    "waitingForTerrain": {
      "type": "boolean",
      "description": "Paused at last known position while terrain is unavailable."
    }
  },
  "required": [
    "velocity",
    "yaw",
    "pitch",
    "roll",
    "pitchRate",
    "rollRate",
    "rpm",
    "rotorAngle",
    "airspeed",
    "altitudeAGL",
    "verticalSpeed",
    "angleOfAttack",
    "stalled",
    "grounded",
    "crashed",
    "waitingForTerrain"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel/character

### `character`

Kinematic character controller state (speed/jump/gravity + kernel-owned vy/grounded).

Required: `speed`, `jumpSpeed`, `gravity`, `vy`, `grounded`

```json
{
  "speed": 6,
  "jumpSpeed": 8,
  "gravity": 20,
  "vy": 0,
  "grounded": true
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "speed": {
      "type": "number",
      "description": "Planar move speed in meters per second."
    },
    "jumpSpeed": {
      "type": "number",
      "description": "Initial upward velocity in meters per second applied when jumping from the ground."
    },
    "gravity": {
      "type": "number",
      "description": "Downward acceleration in meters per second squared applied to vy each tick."
    },
    "vy": {
      "type": "number",
      "description": "Current vertical velocity in meters per second (kernel-owned)."
    },
    "grounded": {
      "type": "boolean",
      "description": "True when the character stood on the ground as of the last tick (kernel-owned)."
    }
  },
  "required": [
    "speed",
    "jumpSpeed",
    "gravity",
    "vy",
    "grounded"
  ],
  "additionalProperties": false
}
```

</details>

### `moveIntent`

Desired planar move direction + jump flag, consumed by the character controller.

Required: `dir`, `jump`

```json
{
  "dir": [
    1,
    0
  ],
  "jump": false
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dir": {
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Desired planar move direction [x, z]: +x east, +z south (screen-down in top-down views); magnitudes above 1 are normalized."
    },
    "jump": {
      "type": "boolean",
      "description": "Request a jump this tick (honored only while grounded)."
    }
  },
  "required": [
    "dir",
    "jump"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel/gameplay

### `fsm`

Minimal event-driven state machine: transitions fire on world events targeting the entity.

Required: `state`, `transitions`

```json
{
  "state": "idle",
  "transitions": [
    {
      "from": "idle",
      "event": "player_seen",
      "to": "aggro"
    }
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "state": {
      "type": "string",
      "minLength": 1,
      "description": "Current state name."
    },
    "transitions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "minLength": 1,
            "description": "State the transition leaves ('*' matches any state)."
          },
          "event": {
            "type": "string",
            "minLength": 1,
            "description": "World event type that triggers the transition (events with payload.entity only match that entity)."
          },
          "to": {
            "type": "string",
            "minLength": 1,
            "description": "State entered."
          }
        },
        "required": [
          "from",
          "event",
          "to"
        ],
        "additionalProperties": false
      },
      "description": "Transition table, checked in order; the first match wins."
    }
  },
  "required": [
    "state",
    "transitions"
  ],
  "additionalProperties": false
}
```

</details>

### `localTransform`

Parent-relative transform for entities carrying `parent`.

Required: `pos`

```json
{
  "pos": [
    0,
    1,
    0
  ],
  "rot": [
    0,
    0,
    0,
    1
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pos": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Parent-relative position [x, y, z] in meters (Y-up)."
    },
    "rot": {
      "minItems": 4,
      "maxItems": 4,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Parent-relative orientation quaternion [x, y, z, w]; defaults to identity [0, 0, 0, 1]."
    },
    "scale": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Per-axis scale factors [x, y, z]; defaults to [1, 1, 1]."
    },
    "teleport": {
      "type": "boolean",
      "description": "Client interpolation hint: when true the client snaps to this update instead of lerping from the previous tick."
    }
  },
  "required": [
    "pos"
  ],
  "additionalProperties": false
}
```

</details>

### `parent`

Attach to a parent entity: transform becomes parent.transform × localTransform each tick.

Required: `id`

```json
{
  "id": "turret-base"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Entity id of the parent."
    },
    "onParentDestroyed": {
      "type": "string",
      "enum": [
        "destroy",
        "detach"
      ],
      "description": "When the parent is destroyed: destroy this entity too (default, cascading) or detach it and keep it alive."
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

</details>

### `timer`

Snapshot-safe countdown timers that emit events (one-shot or repeating). Replaces callbacks.

Required: `timers`

```json
{
  "timers": [
    {
      "id": "respawn",
      "ticksLeft": 90,
      "event": "respawn_ready"
    }
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "timers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Timer id, unique within this entity."
          },
          "ticksLeft": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991,
            "description": "Ticks until the timer fires; decremented each tick."
          },
          "event": {
            "type": "string",
            "minLength": 1,
            "description": "World event type emitted when the timer fires (payload carries entity + timerId)."
          },
          "payload": {
            "description": "Optional JSON payload included in the emitted event.",
            "$ref": "#/$defs/__schema0"
          },
          "repeatEvery": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991,
            "description": "If set, the timer re-arms with this many ticks after firing (repeating)."
          }
        },
        "required": [
          "id",
          "ticksLeft",
          "event"
        ],
        "additionalProperties": false
      },
      "description": "Active timers on this entity."
    }
  },
  "required": [
    "timers"
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

</details>

### `tween`

Data-driven value animation over ticks: component + select-style path, lerp with easing.

Required: `tweens`

```json
{
  "tweens": [
    {
      "component": "transform",
      "path": "pos[1]",
      "to": 4,
      "ticks": 30,
      "easing": "quadOut"
    }
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "tweens": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Optional tween id."
          },
          "component": {
            "type": "string",
            "minLength": 1,
            "description": "Name of the component whose value is animated."
          },
          "path": {
            "type": "string",
            "minLength": 1,
            "description": "Select-style value path within the component, e.g. 'pos', 'pos[1]', or 'primitive.size'."
          },
          "from": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "array",
                "items": {
                  "type": "number"
                }
              }
            ],
            "description": "Start value (number or number array); defaults to the current value when the tween starts."
          },
          "to": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "array",
                "items": {
                  "type": "number"
                }
              }
            ],
            "description": "End value (number or number array, same arity as from)."
          },
          "ticks": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991,
            "description": "Duration in ticks."
          },
          "elapsed": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Ticks elapsed so far (kernel-owned; starts at 0)."
          },
          "easing": {
            "type": "string",
            "enum": [
              "linear",
              "quadIn",
              "quadOut",
              "quadInOut",
              "cubicIn",
              "cubicOut",
              "cubicInOut"
            ],
            "description": "Easing curve (default linear)."
          },
          "loop": {
            "type": "string",
            "enum": [
              "none",
              "loop",
              "pingpong"
            ],
            "description": "After completing: none (remove, default), loop (restart from `from`), or pingpong (swap from/to)."
          },
          "emitOnComplete": {
            "type": "string",
            "description": "World event type emitted (payload { entity }) each time the tween completes."
          }
        },
        "required": [
          "component",
          "path",
          "to",
          "ticks"
        ],
        "additionalProperties": false
      },
      "description": "Active tweens on this entity."
    }
  },
  "required": [
    "tweens"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel/kinematics

### `collider`

2.5D kinematic collider (circle or XZ AABB) with layer/mask bitmasks.

Required: (shape="circle": `shape`, `layer`, `mask`) or (shape="aabb": `shape`, `layer`, `mask`)

```json
{
  "shape": "circle",
  "radius": 0.5,
  "layer": 1,
  "mask": 1
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "shape": {
          "type": "string",
          "const": "circle",
          "description": "Circle collider in the XZ plane."
        },
        "radius": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Circle radius in meters (default 0.5)."
        },
        "layer": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295,
          "description": "Bitmask of collision layers this collider belongs to; a collides with b when (a.mask & b.layer) or (b.mask & a.layer) is non-zero."
        },
        "mask": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295,
          "description": "Bitmask of layers this collider collides with (see layer for the rule)."
        },
        "isStatic": {
          "type": "boolean",
          "description": "Static colliders never move and are never pushed by other bodies."
        }
      },
      "required": [
        "shape",
        "layer",
        "mask"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "shape": {
          "type": "string",
          "const": "aabb",
          "description": "Axis-aligned box collider in the XZ plane."
        },
        "halfExtents": {
          "minItems": 2,
          "maxItems": 2,
          "type": "array",
          "items": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "description": "Half-extents [x, z] in meters of the box in the XZ plane (2.5D; default [0.5, 0.5])."
        },
        "layer": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295,
          "description": "Bitmask of collision layers this collider belongs to; a collides with b when (a.mask & b.layer) or (b.mask & a.layer) is non-zero."
        },
        "mask": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295,
          "description": "Bitmask of layers this collider collides with (see layer for the rule)."
        },
        "isStatic": {
          "type": "boolean",
          "description": "Static colliders never move and are never pushed by other bodies."
        }
      },
      "required": [
        "shape",
        "layer",
        "mask"
      ],
      "additionalProperties": false
    }
  ]
}
```

</details>

### `kinematicBody`

Velocity-driven body for the kinematic collision layer.

Required: `vel`, `slide`

```json
{
  "vel": [
    0,
    0,
    0
  ],
  "slide": true
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "vel": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Velocity [x, y, z] in meters per second, integrated each tick (dt = 1/tickRate)."
    },
    "slide": {
      "type": "boolean",
      "description": "When true, blocked motion slides along the contact surface instead of stopping."
    }
  },
  "required": [
    "vel",
    "slide"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: kernel/vehicles

### `mountable`

Mount points in local meters, ordered safe exit candidates, and interaction reach. Seat position is the rider camera anchor.

Required: `seats`, `exits`, `reach`

```json
{
  "seats": [
    {
      "id": "driver",
      "role": "driver",
      "position": [
        0.4,
        1.14,
        0.25
      ]
    }
  ],
  "exits": [
    [
      -1.56,
      0,
      0.25
    ],
    [
      1.56,
      0,
      0.25
    ]
  ],
  "reach": 3
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "seats": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Unique seat identifier within this mount."
          },
          "role": {
            "type": "string",
            "enum": [
              "driver",
              "passenger"
            ],
            "description": "Only a driver seat grants vehicle control."
          },
          "position": {
            "minItems": 3,
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "Local rider/camera anchor in meters, transformed by the chassis quaternion."
          }
        },
        "required": [
          "id",
          "role",
          "position"
        ],
        "additionalProperties": false
      },
      "description": "Available seat definitions. Each seat can hold one actor."
    },
    "exits": {
      "minItems": 1,
      "type": "array",
      "items": {
        "minItems": 3,
        "maxItems": 3,
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      "description": "Ordered local foot positions to check when dismounting."
    },
    "reach": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Maximum distance in meters from the actor to the seat to enter."
    }
  },
  "required": [
    "seats",
    "exits",
    "reach"
  ],
  "additionalProperties": false
}
```

</details>

### `mounted`

Rider-to-mount relationship. Occupied seats are exclusive; mounted characters bypass walking physics.

Required: `vehicle`, `seat`

```json
{
  "vehicle": "car-1",
  "seat": "driver"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "vehicle": {
      "type": "string",
      "minLength": 1,
      "description": "Entity ID of the mount."
    },
    "seat": {
      "type": "string",
      "minLength": 1,
      "description": "Occupied seat ID in the mountable component."
    }
  },
  "required": [
    "vehicle",
    "seat"
  ],
  "additionalProperties": false
}
```

</details>

### `vehicle`

External wheeled-vehicle instance: stable id, paint, complete physics tuning, and GLB bindings.

Required: `kind`, `color`, `spec`, `visual`

```json
{
  "kind": "example.vehicle",
  "color": "#566d82",
  "spec": {
    "label": "Example car",
    "width": 1.8,
    "length": 4.6,
    "height": 1.5,
    "centerOfMass": [
      0,
      0.55,
      0
    ],
    "wheelbase": 2.75,
    "wheelTrack": 1.5,
    "wheelRadius": 0.31,
    "mass": 1450,
    "engineForce": 6200,
    "maxSpeed": 42,
    "reverseSpeed": 8,
    "brakeDeceleration": 9.5,
    "maxSteer": 0.56,
    "grip": 8,
    "driverEye": [
      0.4,
      1.14,
      0.25
    ],
    "steeringRate": 1.8,
    "steeringFadeSpeed": 18,
    "rollingResistance": 0.15,
    "aerodynamicResistance": 0.0025,
    "terrainAlignRate": 1.8,
    "supportTolerance": 0.08,
    "maxStepHeight": 0.4,
    "maxSlope": 0.61
  },
  "visual": {
    "wheelNodes": [
      "wheel-front-left"
    ],
    "frontWheelNodes": [
      "wheel-front-left"
    ],
    "steeringWheelNode": "steering-wheel",
    "paintMaterial": "vehicle-paint-and-trim"
  }
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "minLength": 1,
      "description": "Stable external entity/type id."
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$",
      "description": "Body paint as an sRGB #rrggbb color."
    },
    "spec": {
      "type": "object",
      "properties": {
        "label": {
          "type": "string",
          "minLength": 1,
          "description": "External label setting."
        },
        "width": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External width setting."
        },
        "length": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External length setting."
        },
        "height": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External height setting."
        },
        "centerOfMass": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "External centerOfMass setting."
        },
        "wheelbase": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External wheelbase setting."
        },
        "wheelTrack": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External wheelTrack setting."
        },
        "wheelRadius": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External wheelRadius setting."
        },
        "mass": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External mass setting."
        },
        "engineForce": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External engineForce setting."
        },
        "maxSpeed": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External maxSpeed setting."
        },
        "reverseSpeed": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External reverseSpeed setting."
        },
        "brakeDeceleration": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External brakeDeceleration setting."
        },
        "maxSteer": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External maxSteer setting."
        },
        "grip": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External grip setting."
        },
        "driverEye": {
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "External driverEye setting."
        },
        "steeringRate": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External steeringRate setting."
        },
        "steeringFadeSpeed": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External steeringFadeSpeed setting."
        },
        "rollingResistance": {
          "type": "number",
          "minimum": 0,
          "description": "External rollingResistance setting."
        },
        "aerodynamicResistance": {
          "type": "number",
          "minimum": 0,
          "description": "External aerodynamicResistance setting."
        },
        "terrainAlignRate": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External terrainAlignRate setting."
        },
        "supportTolerance": {
          "type": "number",
          "minimum": 0,
          "description": "External supportTolerance setting."
        },
        "maxStepHeight": {
          "type": "number",
          "minimum": 0,
          "description": "External maxStepHeight setting."
        },
        "maxSlope": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "External maxSlope setting."
        }
      },
      "required": [
        "label",
        "width",
        "length",
        "height",
        "centerOfMass",
        "wheelbase",
        "wheelTrack",
        "wheelRadius",
        "mass",
        "engineForce",
        "maxSpeed",
        "reverseSpeed",
        "brakeDeceleration",
        "maxSteer",
        "grip",
        "driverEye",
        "steeringRate",
        "steeringFadeSpeed",
        "rollingResistance",
        "aerodynamicResistance",
        "terrainAlignRate",
        "supportTolerance",
        "maxStepHeight",
        "maxSlope"
      ],
      "additionalProperties": false,
      "description": "Complete data-driven chassis and handling configuration."
    },
    "visual": {
      "type": "object",
      "properties": {
        "wheelNodes": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "description": "External wheelNodes setting."
        },
        "frontWheelNodes": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "description": "External frontWheelNodes setting."
        },
        "steeringWheelNode": {
          "description": "External steeringWheelNode setting.",
          "type": "string",
          "minLength": 1
        },
        "paintMaterial": {
          "type": "string",
          "minLength": 1,
          "description": "External paintMaterial setting."
        },
        "interior": {
          "description": "External interior setting.",
          "type": "object",
          "properties": {
            "nodes": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              },
              "description": "Cabin nodes in the same exterior/interior GLB."
            },
            "sources": {
              "description": "Optional component fields overriding or extending host telemetry.",
              "type": "object",
              "propertyNames": {
                "type": "string",
                "minLength": 1
              },
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "component": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Component on this same entity."
                  },
                  "path": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "anyOf": [
                        {
                          "type": "string",
                          "minLength": 1
                        },
                        {
                          "type": "integer",
                          "minimum": 0,
                          "maximum": 9007199254740991
                        }
                      ]
                    },
                    "description": "Explicit property names or array indices leading to a number or boolean."
                  }
                },
                "required": [
                  "component",
                  "path"
                ],
                "additionalProperties": false
              }
            },
            "bindings": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "node": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Exact loaded GLB node name."
                  },
                  "source": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Named simulation signal."
                  },
                  "property": {
                    "type": "string",
                    "enum": [
                      "rotation",
                      "position"
                    ],
                    "description": "Local transform channel."
                  },
                  "axis": {
                    "type": "string",
                    "enum": [
                      "x",
                      "y",
                      "z"
                    ],
                    "description": "Local transform axis."
                  },
                  "scale": {
                    "type": "number",
                    "description": "Multiply the signal by this value."
                  },
                  "offset": {
                    "description": "Offset after scaling; default zero.",
                    "type": "number"
                  },
                  "min": {
                    "description": "Minimum displacement from authored pose.",
                    "type": "number"
                  },
                  "max": {
                    "description": "Maximum displacement from authored pose.",
                    "type": "number"
                  }
                },
                "required": [
                  "node",
                  "source",
                  "property",
                  "axis",
                  "scale"
                ],
                "additionalProperties": false
              },
              "description": "Per-model node channels and their signal calibration."
            }
          },
          "required": [
            "nodes",
            "bindings"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "wheelNodes",
        "frontWheelNodes",
        "paintMaterial"
      ],
      "additionalProperties": false,
      "description": "Named GLB nodes/material used by the generic client."
    }
  },
  "required": [
    "kind",
    "color",
    "spec",
    "visual"
  ],
  "additionalProperties": false
}
```

</details>

### `vehicleInput`

Driver intent: signed throttle (negative brakes then reverses), signed steering (positive right), brake/handbrake.

Required: `throttle`, `steering`, `brake`

```json
{
  "throttle": 1,
  "steering": 0,
  "brake": false
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "throttle": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Signed accelerator; opposite input brakes to zero before reversing."
    },
    "steering": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Steering intent -1..1; positive turns right."
    },
    "brake": {
      "type": "boolean",
      "description": "Apply the service/parking brake while true."
    }
  },
  "required": [
    "throttle",
    "steering",
    "brake"
  ],
  "additionalProperties": false
}
```

</details>

### `vehicleState`

Snapshot-safe chassis state. Speeds in m/s, angles in radians; owned by installVehicles.

Required: `speed`, `steer`, `yaw`, `pitch`, `roll`, `vy`, `grounded`, `waitingForTerrain`, `wheelAngle`

```json
{
  "speed": 0,
  "steer": 0,
  "yaw": 0,
  "pitch": 0,
  "roll": 0,
  "vy": 0,
  "grounded": true,
  "waitingForTerrain": false,
  "wheelAngle": 0
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "speed": {
      "type": "number",
      "description": "Signed forward speed in meters per second."
    },
    "steer": {
      "type": "number",
      "description": "Current front wheel steering angle in radians. Positive turns right."
    },
    "yaw": {
      "type": "number",
      "description": "Chassis rotation about Y in radians; zero faces +Z."
    },
    "pitch": {
      "type": "number",
      "description": "Chassis rotation about local X in radians, from terrain support."
    },
    "roll": {
      "type": "number",
      "description": "Chassis rotation about local Z in radians, from terrain support."
    },
    "vy": {
      "type": "number",
      "description": "Vertical velocity in meters per second."
    },
    "grounded": {
      "type": "boolean",
      "description": "Whether wheel support currently carries the chassis."
    },
    "waitingForTerrain": {
      "type": "boolean",
      "description": "Motion is paused because one or more wheel samples have no terrain."
    },
    "wheelAngle": {
      "type": "number",
      "description": "Accumulated wheel spin angle in radians, wrapped each revolution."
    }
  },
  "required": [
    "speed",
    "steer",
    "yaw",
    "pitch",
    "roll",
    "vy",
    "grounded",
    "waitingForTerrain",
    "wheelAngle"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: other

### `weather`

Singleton physical atmosphere and visual weather: temperature, pressure, humidity, wind, independent cloud cover, precipitation and visibility. Readable by scripts and physics; see guide/weather.md.

Required: none

```json
{
  "atmosphere": {
    "temperatureK": 282.15,
    "pressurePa": 100200,
    "windVelocity": [
      7,
      0,
      3
    ]
  },
  "clouds": {
    "coverage": 0.95
  },
  "precipitation": {
    "kind": "rain",
    "intensity": 0.7
  },
  "visibility": 4500
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "atmosphere": {
      "description": "Physical atmospheric state; independent of the visual weather profile.",
      "type": "object",
      "properties": {
        "temperatureK": {
          "description": "Temperature at referenceAltitude in kelvin; default 288.15 (15 °C).",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "pressurePa": {
          "description": "Absolute barometric pressure at referenceAltitude in pascals; default 101325. Zero permits vacuum.",
          "type": "number",
          "minimum": 0
        },
        "relativeHumidity": {
          "description": "Relative humidity 0–1, default 0.5. Stored independently; does not select precipitation.",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "windVelocity": {
          "description": "Air velocity [x,y,z] in world meters/second; default [0,0,0]. This is a velocity, not a meteorological FROM bearing.",
          "minItems": 3,
          "maxItems": 3,
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "referenceAltitude": {
          "description": "World Y in meters where temperature and pressure apply; default 0.",
          "type": "number"
        },
        "gasConstant": {
          "description": "Specific gas constant in J/(kg·K); default 287.05 for dry Earth air. Supports other atmospheres.",
          "type": "number",
          "exclusiveMinimum": 0
        }
      },
      "additionalProperties": false
    },
    "visibility": {
      "description": "Visual distance in meters; default 50000. Independent of clouds and precipitation. Renderer also respects a nearer authored fog limit.",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "clouds": {
      "description": "World-anchored, wind-advected cloud layer. Does not imply precipitation.",
      "type": "object",
      "properties": {
        "coverage": {
          "description": "Sky coverage 0–1, default 0; controls breaks in the procedural layer.",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "density": {
          "description": "Cloud optical density 0–1, default 0.65; independent of coverage.",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "baseAltitude": {
          "description": "Cloud base at absolute world Y in meters, default 1800.",
          "type": "number"
        },
        "thickness": {
          "description": "Vertical layer thickness in meters, default 600.",
          "type": "number",
          "exclusiveMinimum": 0
        },
        "scale": {
          "description": "Horizontal cloud-pattern repeat size in meters, default 16000.",
          "type": "number",
          "exclusiveMinimum": 0
        }
      },
      "additionalProperties": false
    },
    "precipitation": {
      "description": "Precipitation independent of cloud coverage and visibility.",
      "type": "object",
      "properties": {
        "kind": {
          "description": "Explicit precipitation phase, default none. Temperature never silently overrides it.",
          "type": "string",
          "enum": [
            "none",
            "rain",
            "snow"
          ]
        },
        "intensity": {
          "description": "Visual precipitation intensity 0–1, default 0. Not a calibrated rainfall rate.",
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "additionalProperties": false
    },
    "seed": {
      "description": "Stable visual pattern seed, default 1. Does not consume simulation RNG.",
      "type": "integer",
      "minimum": 0,
      "maximum": 4294967295
    }
  },
  "additionalProperties": false
}
```

</details>

## Owner: physics-rapier

### `collider3d`

3D collider (ball/cuboid/capsule/hull/trimesh/asset/heightfield) with layer/mask, sensor, and material params. Static without a rigidbody.

Required: `shape`

```json
{
  "shape": {
    "type": "cuboid",
    "hx": 10,
    "hy": 0.5,
    "hz": 10
  }
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "shape": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "ball",
              "description": "Sphere."
            },
            "radius": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Sphere radius in meters."
            }
          },
          "required": [
            "type",
            "radius"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "cuboid",
              "description": "Axis-aligned box (in the collider frame)."
            },
            "hx": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Half-extent along X in meters."
            },
            "hy": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Half-extent along Y in meters."
            },
            "hz": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Half-extent along Z in meters."
            }
          },
          "required": [
            "type",
            "hx",
            "hy",
            "hz"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "capsule",
              "description": "Capsule aligned with the Y axis."
            },
            "halfHeight": {
              "type": "number",
              "minimum": 0,
              "description": "Half the length of the cylindrical section along Y in meters (caps excluded)."
            },
            "radius": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Capsule radius in meters."
            }
          },
          "required": [
            "type",
            "halfHeight",
            "radius"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "convexHull",
              "description": "Convex hull of a point cloud."
            },
            "points": {
              "minItems": 12,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Flat [x, y, z, x, y, z, ...] point list in meters (at least 4 points); the shape is their convex hull."
            }
          },
          "required": [
            "type",
            "points"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "trimesh",
              "description": "Triangle mesh (static geometry)."
            },
            "vertices": {
              "minItems": 9,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "Flat [x, y, z, ...] vertex positions in meters."
            },
            "indices": {
              "minItems": 3,
              "type": "array",
              "items": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "description": "Triangle vertex indices, three per triangle."
            }
          },
          "required": [
            "type",
            "vertices",
            "indices"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "asset",
              "description": "Collision geometry from a project asset's sidecar."
            },
            "assetId": {
              "type": "string",
              "minLength": 1,
              "description": "Project asset id whose sidecar collision geometry is used."
            },
            "collision": {
              "type": "string",
              "enum": [
                "hull",
                "trimesh"
              ],
              "description": "Which sidecar geometry to use: hull (convex, default) or trimesh."
            },
            "index": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991,
              "description": "Index of the sidecar hull to use when the asset has several (default 0)."
            }
          },
          "required": [
            "type",
            "assetId"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "const": "heightfield",
              "description": "Terrain heightfield."
            },
            "ref": {
              "type": "string",
              "minLength": 1,
              "description": "Heightfield reference id resolved by the host (e.g. the scene terrain)."
            }
          },
          "required": [
            "type",
            "ref"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Collision shape."
    },
    "offset": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Shape offset [x, y, z] in meters relative to the entity transform."
    },
    "rotOffset": {
      "minItems": 4,
      "maxItems": 4,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Shape rotation quaternion [x, y, z, w] relative to the entity transform."
    },
    "layer": {
      "type": "integer",
      "minimum": 0,
      "maximum": 65535,
      "description": "16-bit collision-group bitmask this collider belongs to (default 1)."
    },
    "mask": {
      "type": "integer",
      "minimum": 0,
      "maximum": 65535,
      "description": "16-bit bitmask of groups this collider collides with (default 0xffff = all)."
    },
    "sensor": {
      "type": "boolean",
      "description": "Sensor colliders detect overlaps (collision events) but produce no contact forces."
    },
    "events": {
      "type": "boolean",
      "description": "Emit 'collision' / 'collisionEnd' world events for this collider."
    },
    "restitution": {
      "type": "number",
      "minimum": 0,
      "description": "Bounciness coefficient (0 = inelastic)."
    },
    "friction": {
      "type": "number",
      "minimum": 0,
      "description": "Coulomb friction coefficient."
    },
    "density": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Mass density in kg/m^3 used to derive the body mass from the shape volume."
    }
  },
  "required": [
    "shape"
  ],
  "additionalProperties": false
}
```

</details>

### `force`

Continuous force/torque applied every tick while present.

Required: none

```json
{
  "linear": [
    0,
    20,
    0
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "linear": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Force [x, y, z] in newtons applied at the center of mass every tick while present."
    },
    "torque": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Torque [x, y, z] in N*m applied every tick while present."
    }
  },
  "additionalProperties": false
}
```

</details>

### `impulse`

One-shot impulse/torque; consumed the tick it is applied.

Required: none

```json
{
  "v": [
    10,
    0,
    0
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "v": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Linear impulse [x, y, z] in N*s (kg*m/s) applied once."
    },
    "torque": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Angular impulse [x, y, z] in N*m*s applied once."
    }
  },
  "additionalProperties": false
}
```

</details>

### `joint`

Impulse joint to another body (fixed/revolute/spherical/prismatic + limits/motor).

Required: `type`, `other`, `anchor1`, `anchor2`

```json
{
  "type": "revolute",
  "other": "chassis",
  "anchor1": [
    0,
    0,
    1
  ],
  "anchor2": [
    0,
    0,
    0
  ],
  "axis": [
    0,
    0,
    1
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "fixed",
        "revolute",
        "spherical",
        "prismatic"
      ],
      "description": "Joint type: fixed, revolute (hinge), spherical (ball), or prismatic (slider)."
    },
    "other": {
      "type": "string",
      "minLength": 1,
      "description": "Entity id of the other body."
    },
    "anchor1": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Anchor point [x, y, z] in meters in this body's local frame."
    },
    "anchor2": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Anchor point [x, y, z] in meters in the other body's local frame."
    },
    "axis": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Joint axis [x, y, z] in this body's local frame (revolute/prismatic)."
    },
    "limits": {
      "minItems": 2,
      "maxItems": 2,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "[min, max] joint limits: radians for revolute, meters for prismatic."
    },
    "motor": {
      "type": "object",
      "properties": {
        "targetVel": {
          "type": "number",
          "description": "Target joint velocity: rad/s for revolute, m/s for prismatic."
        },
        "maxForce": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Maximum force (N) or torque (N*m) the motor may apply."
        }
      },
      "required": [
        "targetVel",
        "maxForce"
      ],
      "additionalProperties": false,
      "description": "Velocity motor driving the joint (revolute/prismatic)."
    }
  },
  "required": [
    "type",
    "other",
    "anchor1",
    "anchor2"
  ],
  "additionalProperties": false
}
```

</details>

### `rigidbody`

3D rigid-body dynamics: dynamic, fixed, or kinematicPosition (characters).

Required: `body`

```json
{
  "body": "dynamic"
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "body": {
      "type": "string",
      "enum": [
        "dynamic",
        "fixed",
        "kinematicPosition"
      ],
      "description": "Body type: dynamic (simulated), fixed (immovable), or kinematicPosition (driven by transform writes, e.g. characters)."
    },
    "gravityScale": {
      "type": "number",
      "description": "Multiplier on scene gravity for this body (1 = normal, 0 = weightless)."
    },
    "linearDamping": {
      "type": "number",
      "minimum": 0,
      "description": "Linear velocity damping coefficient per second (0 = none)."
    },
    "angularDamping": {
      "type": "number",
      "minimum": 0,
      "description": "Angular velocity damping coefficient per second (0 = none)."
    },
    "ccd": {
      "type": "boolean",
      "description": "Enable continuous collision detection for fast-moving bodies."
    },
    "lockRot": {
      "type": "boolean",
      "description": "Lock all rotations so the body never tumbles."
    }
  },
  "required": [
    "body"
  ],
  "additionalProperties": false
}
```

</details>

### `setVelocity`

One-shot velocity set; consumed the tick it is applied.

Required: none

```json
{
  "linear": [
    0,
    0,
    5
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "linear": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Linear velocity [x, y, z] in m/s to set once."
    },
    "angular": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Angular velocity [x, y, z] in rad/s to set once."
    }
  },
  "additionalProperties": false
}
```

</details>

### `velocity`

Opt-in per-tick body velocity mirror (presence = subscription; plugin-written).

Required: `linear`, `angular`

```json
{
  "linear": [
    0,
    0,
    0
  ],
  "angular": [
    0,
    0,
    0
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "linear": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Current linear velocity [x, y, z] in m/s (plugin-written each tick)."
    },
    "angular": {
      "minItems": 3,
      "maxItems": 3,
      "type": "array",
      "items": {
        "type": "number"
      },
      "description": "Current angular velocity [x, y, z] in rad/s (plugin-written each tick)."
    }
  },
  "required": [
    "linear",
    "angular"
  ],
  "additionalProperties": false
}
```

</details>

## Owner: worldgen

### `worldgenBuilding`

A building generated at runtime from an outline in the entity frame, styled by a molen/archstyle@1 in the loaded pack; rendered by the worldgen client entity layer.

Required: `style`, `outline`

```json
{
  "style": "molen.worldgen.fantasy.hall",
  "outline": [
    [
      -12,
      -5
    ],
    [
      12,
      -5
    ],
    [
      12,
      5
    ],
    [
      -12,
      5
    ]
  ],
  "levels": 2,
  "labels": [
    "hall"
  ]
}
```

<details>
<summary>JSON Schema</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "style": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Style id in the loaded pack, e.g. 'molen.worldgen.fantasy.hall'."
    },
    "appearance": {
      "type": "object",
      "properties": {
        "wall": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$"
        },
        "trim": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$"
        }
      },
      "additionalProperties": false
    },
    "storefronts": {
      "maxItems": 12,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "identity": {
            "type": "string",
            "minLength": 1
          },
          "at": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number"
              },
              {
                "type": "number"
              }
            ],
            "items": false,
            "minItems": 2,
            "maxItems": 2,
            "description": "Desired frontage anchor in local meters; projected to a non-seam exterior edge."
          },
          "signModel": {
            "type": "string",
            "pattern": "^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+)$"
          },
          "signSize": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              }
            ],
            "items": false,
            "minItems": 2,
            "maxItems": 2
          },
          "accent": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "width": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          }
        },
        "required": [
          "identity",
          "at",
          "signModel",
          "accent"
        ],
        "additionalProperties": false
      }
    },
    "outline": {
      "minItems": 3,
      "type": "array",
      "items": {
        "minItems": 2,
        "maxItems": 2,
        "type": "array",
        "items": {
          "type": "number"
        },
        "description": "[x, z] in entity-local meters."
      },
      "description": "Open ring of [x, z] points."
    },
    "holes": {
      "type": "array",
      "items": {
        "minItems": 3,
        "type": "array",
        "items": {
          "minItems": 2,
          "maxItems": 2,
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "[x, z] in entity-local meters."
        },
        "description": "Open ring of [x, z] points."
      },
      "description": "Inner rings (courtyards)."
    },
    "height": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Wall height in meters (overrides levels)."
    },
    "levels": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Floor count."
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Labels the style rules and props see (default ['building'])."
    },
    "seed": {
      "type": "string",
      "minLength": 1,
      "description": "Stable identity for the seed (default: entity id)."
    },
    "tier": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Detail tier, 0 = full (default 0)."
    }
  },
  "required": [
    "style",
    "outline"
  ],
  "additionalProperties": {}
}
```

</details>

