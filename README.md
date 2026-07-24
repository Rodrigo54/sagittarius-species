# Sagittarius Species

[![Steam Downloads](https://img.shields.io/steam/downloads/3054793206?style=plastic&logo=steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=3054793206)
![Steam Favorites](https://img.shields.io/steam/favorites/3054793206?style=plastic&logo=steam)
![Steam Subscriptions](https://img.shields.io/steam/subscriptions/3054793206?style=plastic&logo=steam)
![GitHub package.json version](https://img.shields.io/github/package-json/v/Rodrigo54/sagittarius-species?style=plastic)
![Steam File Size](https://img.shields.io/steam/size/3054793206?style=plastic)

Sagittarius Species is a Stellaris mod that adds AI-assisted portrait art for **18 species**, each plugged into
the game's `species_classes` / `portrait_categories` / `portrait_sets` data chain (see `CLAUDE.md` for the full
model). Most species share one of two animated rigs (`sl_shared` or `ssm_shared`) rather than shipping unique
meshes — see `portraits.md` and the "`sl_shared` vs. `ssm_shared`" section of `CLAUDE.md` for why.

This repository is a content/asset pipeline, not an application: `mod/sagittarius-species/` is the Clausewitz-script
mod itself (published to the Steam Workshop), and `scripts/` (Bun/TypeScript) converts source art in `assets/`
into the textures and `.txt`/`.yml` files inside `mod/`.

## Species

| Species | Portrait slug | Species class |
| --- | --- | --- |
| Humans (augmented realism) | `ssm_default` | HUM |
| Space Elves | `ssm_elves` | HUM |
| High Elves | `ssm_high_elves` | HUM |
| Green Elves | `ssm_green_elves` | PLANT |
| Atlantis Space (Mermaids) | `ssm_mermaids` | AQUATIC |
| Astral Humans | `ssm_astral` | HUM |
| Necromancers | `ssm_necron` | NECROID |
| Furries | `ssm_gamba` | MAM |
| Mollusk | `ssm_octopus` | MOL |
| Lovecraftian Mollusk | `ssm_hastur` | MOL |
| Order of the Green Knights | `ssm_green_order` | MACHINE |
| Shaw's Birds | `ssm_avians` | AVI |
| New Vargrosians | `ssm_vargrosianos` | HUM |
| Order of Red Soldiers | `ssm_new_order` | MACHINE |
| Cyborgs | `ssm_cyborg` | MACHINE |
| Timbot | `ssm_timbot` | MACHINE |
| Mercenaries | `ssm_mercenary` | HUM |
| Star Knight | `ssm_knight` | HUM |

`ssm_mermaids` and `ssm_astral` currently use the legacy `sl_shared` rig — a migration to `ssm_shared` was
attempted and reverted after in-game testing found framing issues (see `future-plans.md`). Every other species
above uses `ssm_shared`.

## Recommended tools

The pipeline needs these to run end to end; everything after the runtime/OS pair is either auto-downloaded or
optional depending on what you're touching:

- **[Bun](https://bun.sh)** — runtime for every script in `scripts/` (`bun scripts/xxx.ts` or `bun run <task>`).
- **PowerShell** — required for `bun run copy`/`bun run overwrite` (Windows-only; bash equivalents exist for the
  rest of the pipeline).
- **[texconv](https://github.com/microsoft/DirectXTex)** (`bin/texconv/`) — PNG→DDS conversion engine.
  Auto-downloaded by `bun run setup`.
- **[ImageMagick](https://imagemagick.org)** (`bin/imagemagick/`) — image manipulation (trim/resize/composite)
  used by `scripts/migrate-portraits/`. Auto-downloaded by `bun run setup`.
- **Blender + [io_pdx_mesh](https://github.com/ross-g/io_pdx_mesh)** — optional, only needed to edit the shared
  animated rig itself (mesh/skeleton/animations, `.mesh`/`.anim` files). Not required for the normal portrait
  pipeline.
- **VS Code + [cwtools](https://marketplace.visualstudio.com/items?itemName=tboby.cwtools-vscode)** — Clausewitz
  script validation/lint. Open `sagittarius-species.code-workspace`, not the raw folder — see `cwtools.md`.
- **Affinity Designer/Photo or Photoshop** — editing the source `.psd` reference/art layers in `assets/`.
- **[StabilityMatrix](https://github.com/LykosAI/StabilityMatrix)** (ComfyUI) — AI-assisted portrait art
  generation for new species.

## Key commands

```bash
bun run setup       # download bin/ tools (texconv, ImageMagick)
bun run portrait     # sync assets/portraits/ -> mod/ (textures + .txt)
bun run rooms         # sync assets/city_sets/ -> mod/ (textures + .txt)
bun run names          # generate name_lists + localisation + species_names
bun run shared-rig    # derive gfx/.../ssm_shared/ from sl_shared/
bun run copy           # copy the mod into the local Stellaris mods folder (Windows/PowerShell only)
```

See `CLAUDE.md` for the full command reference, the asset→mod pipeline details, and the data model connecting
species, portraits, and rigs.

## Links

[![github.com](https://raw.githubusercontent.com/Rodrigo54/sagittarius-species/develop/steam-workshop/pictures/github_banner.png)](https://github.com/Rodrigo54/sagittarius-species)

![img](https://raw.githubusercontent.com/Rodrigo54/sagittarius-species/develop/steam-workshop/pictures/brasil_banner.png)
