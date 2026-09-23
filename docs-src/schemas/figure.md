# Figure descriptor (`molen/figure@1`)

A figure descriptor document: a preset plus overrides, the same shape as the `figure` component. Preview it with `molen figure preview`, bake it with `molen figure bake`.

## Example

```json
{
  "format": "molen/figure@1",
  "preset": "horse",
  "height": 1.6,
  "palette": {
    "skin": "#3b2a1e",
    "markings": "#f0ead6"
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
      "const": "molen/figure@1",
      "description": "Format envelope; always 'molen/figure@1'."
    },
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
    }
  },
  "required": [
    "format",
    "preset"
  ],
  "additionalProperties": false
}
```
