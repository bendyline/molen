# molen.dev style guide

How every page on molen.dev looks and reads. It applies to anything that becomes a page: the
`docs-src/` guides and schema pages, the generated API, CLI, MCP and sample pages, and the
landing page. It is for whoever writes those pages or the scripts that generate them, person or
agent.

The site is one family with Bendyline's other pages and with the samples gallery at
[molen.dev/play](https://molen.dev/play/) (`examples/home/`): warm paper, one olive accent, PT Serif
titles over Hanken Grotesk text. The rules come in two kinds. **Checked** rules are enforced by
`scripts/check-style.mjs`, so CI fails on them. **Judgement** rules are for a reviewer to hold
you to.

## The look

The theme owns presentation. A page never picks a colour, a font or a class; it uses markdown,
and the theme styles it. To change how something looks, change a token, and every page follows.

| Where | What it holds |
|---|---|
| `.vitepress/theme/custom.css` | The palette, the type, and how every markdown element is drawn |
| `.vitepress/code-theme.mts` | Syntax highlighting in the same palette, light and dark |
| `.vitepress/theme/MolenHome.vue` | The top of the landing page |
| `.vitepress/theme/fonts/` | The font files (the gallery's own), with their OFL licences |
| `examples/home/src/home.css` | The gallery. It uses the same tokens, so change the two together |

### Principles

- **Paper, not white.** Pages sit on warm paper. Code, tables and cards are a lighter surface
  with a 1px rule around them, not a drop shadow. Only screenshots and floating menus cast one.
- **One accent.** Olive marks what you can act on: links, the primary button, the current page.
  Clay (Bendyline's brown) marks inline code. Ochre and brick appear only in warnings.
- **Serif for titles, grotesk for reading.** PT Serif at regular weight sets h1 to h3, the site
  name and the landing page. Everything else is Hanken Grotesk. Titles are never bold.
- **Square-ish and flat.** 4px corners. No gradients, no glows, no emoji as decoration.
- **Both schemes are first-class.** The site follows the reader's system setting, and every
  colour has a light and a dark value. Check both before you merge a visual change.

### Palette

Tokens are `--molen-*` custom properties in `custom.css`, mapped onto VitePress's `--vp-c-*`
variables. Body, muted, link and code colours meet WCAG AA (4.5:1) on every background they sit
on.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `paper` | `#f3efe6` | `#23251f` | Page background |
| `surface` | `#fffcf6` | `#2b2e26` | Code blocks, table rows, callouts, landing-page cards |
| `header` | `#eae5d6` | `#292d24` | Nav band, sidebar, footer, table headers |
| `ink` | `#2a2923` | `#eeeadd` | Body text |
| `muted` | `#686354` | `#b7b5a6` | Ledes, captions, secondary text |
| `rule` | `#d8d1c1` | `#484c40` | Borders and dividers |
| `accent` | `#3d4d3a` | `#c5d5b5` | Primary button, site name, active state |
| `link` | `#44613a` | `#c5d5b5` | Links (always underlined in prose) |
| `clay` | `#6b4a32` | `#e0c4a4` | Inline code |
| `ochre` / `brick` | `#80520f` / `#9b2c1f` | `#e6c07b` / `#f0a08a` | Warning and danger callouts |

### Type

| Element | Face | Size |
|---|---|---|
| Page title (h1) | PT Serif 400 | 36px |
| Section (h2) | PT Serif 400, rule above | 27px |
| Subsection (h3) | PT Serif 400 | 21px |
| h4 to h6 (labels such as TypeDoc's "Parameters") | Hanken Grotesk 600 | VitePress default |
| Lede, the first paragraph after the title | Hanken Grotesk, `muted` | 18px |
| Body | Hanken Grotesk 400 | 16px, 28px line height |
| Code | System monospace | VitePress default |

Hanken Grotesk is a variable font, so one file covers every weight. PT Serif ships at 400 only,
and the theme turns off synthesised bold, so never ask for a bold serif.

### Code colours

`code-theme.mts` defines `molen-paper` (light) and `molen-ink` (dark), with a handful of roles:
keywords in rust, strings in olive, numbers and CLI flags in ochre, functions and commands in
slate, types in plum, keys and properties in clay, comments in muted italic. Every role clears
4.5:1 on the code-block surface. If you add a role, check its contrast in both schemes.

## Page anatomy

Every page has the same spine:

1. **Frontmatter `title`** (checked). The generators write it, and for `docs-src/` pages they
   copy it from the `#` line.
2. **One `#` title** (checked). It is the first heading on the page. Use sentence case: "Game
   logic: scripts and setup", not "Game Logic: Scripts And Setup". A symbol or command in a
   title goes in backticks (`` # `@bendyline/molen-kernel` ``).
3. **A lede** (checked). The title is followed directly by a paragraph of plain prose, not a
   heading, list, table, image, callout or code. The theme sets it larger and muted. In one to
   three sentences it says what the page covers and what the reader can do with it. A
   cross-reference ("See [Aircraft]…") is not a lede. Put it later on the page (judgement).
4. **Sections** as `##`, subsections as `###`. Headings nest one level at a time (checked) and
   are labels, not sentences, so they have no trailing period or colon (checked).
5. Optionally a closing **Read next** section of two to four links.

What each kind of page holds, and where to fix it:

| Page | Source | Shape |
|---|---|---|
| Guide (`/guide/*`) | `docs-src/guide/*.md` | Title, lede, then task-ordered sections. Commands first, explanation after |
| Schema (`/schemas/*`) | Zod `.describe()` text, via `pnpm docs:gen` | Title with the format id, one-line lede, Example, JSON Schema. Never edit the markdown by hand |
| API (`/api/*`) | TSDoc on exports, via `scripts/generate-api.mjs` | Import specifier as title, package description as lede, the import line, then TypeDoc |
| Sample (`/samples/*`) | `SAMPLES` in `scripts/generate-samples.mjs` | Title, tagline as lede, screenshot, Play it, Make it yours, What it teaches, the scene at a glance, Source, Read next |
| CLI / MCP (`/reference/*`) | `OPS_CATALOG`, `GROUPS` in `scripts/generate-cli.mjs` | Title, lede, how to run it, then grouped operations |
| Landing (`/`) | `index.md` frontmatter and body | See [The landing page](#the-landing-page) |

## Writing

- **The reader installed from npm.** They have never cloned this repository (CONVENTIONS.md,
  "Shipped docs are written for npm users"). Commands are what they run in their own project:
  `npx molen …`, `npm …`. A page may drop the `npx` in its examples if it says so once, as the
  CLI reference does. To create a project, name the scoped package
  (`npx @bendyline/molen-tooling new …`), because the unscoped `molen` on npm is unrelated.
- **Clone-only commands say so** (checked). A `pnpm …` or `node packages/…` command, in a code
  block or in inline code, needs the words "in the engine repository" in the same paragraph or
  in the paragraph that introduces the block.
- **Names.** The product is Molen. `molen` in code font is the CLI, the format namespace
  (`molen/scene@3`) or the script global. Packages are always the full `@bendyline/molen-*` name.
- **Say what is true now.** Avoid "new", "now", "recently", "currently" and version history in
  prose. A rename note can go in a `[!NOTE]` callout.
- **Lead with the action.** Show the command or the code, then explain what it did. Keep
  paragraphs short. A list of three or more parallel things is a list.
- **Links say where they go.** Write "[the agent loop](/guide/agent-loop)", not "[here]". Links
  out of `docs-src/` are absolute (`https://molen.dev/…`, `https://github.com/bendyline/molen/…`),
  enforced by `scripts/check-shipped-docs.mjs`.
- **Em dashes and plain punctuation** are the house style. Avoid exclamation marks and filler
  such as "simply", "just" or "easy".

## Components

**Code blocks** always name a language (checked): `sh` for commands, `ts`/`js`/`json`/`tsx` for
source, `powershell` where it has to be, and `text` for program output, error messages, file
trees and diagrams. Put one command per line. Align trailing `#` comments when a block has
several, and keep them short. Show a command's output in its own `text` block after the command.

**Inline code** is for identifiers, file names, flags, component names and literal values, not
for emphasis.

**Tables** always have a header row. Keep cells short: a table is for scanning, and a cell that
needs a paragraph belongs in prose. The first column does not wrap, so keep it to a name.

**Callouts** are rare: one or two a page, for something a reader would otherwise get wrong.

- In `docs-src/`, use GitHub alerts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`,
  `> [!CAUTION]` (checked). That markdown also ships raw inside the npm package and `llms.txt`,
  where VitePress's `:::` syntax would show up as stray text.
- Generated pages, which exist only on the site, may use a titled container:
  `::: tip Running the CLI`. Allowed kinds are `tip`, `info`, `warning`, `danger` and `details`
  (checked).

**Images** are sample screenshots: `examples/<id>/preview.png` at 1280×800, copied to
`/samples/<id>.png` by the generator and framed by the theme. Alt text says what is on screen.
Diagrams are `text` code blocks, not images.

**Raw HTML** carries no `class` or `style` (checked). If markdown cannot express something, add
it to the theme once rather than to a page.

## The landing page

`index.md` uses `layout: home`. Its frontmatter is data, and `MolenHome.vue` draws it:

- `intro`: the name, one-line description, tagline and at most three actions. The first action is
  the `brand` button and goes to the quickstart.
- `showcase`: one sample screenshot beside the intro, with a caption and a link to play it.
- `pillars`: four short claims, each with one link. These draw as a ruled row, like the gallery's
  list.

The markdown body below the frontmatter follows the normal rules, except that it has no `#`
title (checked), because the component draws the title.

## How it is enforced

`scripts/check-style.mjs` runs at the end of every `generate-all.mjs` run. During `pnpm
docs:site:gen`, `docs:site:dev` and `docs:site:build`, its problems print as warnings. Under
`pnpm docs:site:check`, which is part of `pnpm all` and of CI, any problem fails the run. To
check again after editing, without regenerating everything:

```sh
node docs-site/scripts/check-style.mjs   # in the engine repository, after one docs:site:gen
```

Guide and schema problems are reported against their `docs-src/` file and line. Other pages
are reported as generated, with the script that writes them.

| Rule | Checked on |
|---|---|
| Frontmatter `title` | Generated pages |
| Exactly one `#` title, first; none on the landing page | Every page |
| A prose lede directly after the title | Every page |
| Headings nest one level at a time and do not end in `.` or `:` | Every page |
| Every code block names a language | Every page |
| Clone-only commands appear only "in the engine repository" | Every page |
| No `class`/`style` in raw HTML | Every page |
| Callouts: alerts in `docs-src/`, known `:::` kinds elsewhere | Every page |

Anything else in this guide is judgement. When a review turns up the same judgement call twice,
consider making it a check.
