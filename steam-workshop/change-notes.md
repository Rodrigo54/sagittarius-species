# Change Notes

For the steam workshop change notes I recommended to use major mod version increases when removing features or adding a plethora of them, minor ones when updating to a new game version or doing small tweaks and patch version increases when changing things unrelated to the users experience.

> New entries go on top, as a `## <version>` heading. `bun run publish-workshop` reads the topmost
> section as the changenote for that build, stamping `— YYYY-MM-DD HH:mm` onto the heading at
> publish time if it isn't there yet (that stamp is local bookkeeping only — it never gets sent
> to Steam, which already timestamps updates on its own).

## 1.12.0

* **The Timbots got a complete art overhaul.** All 25 units were redrawn from scratch: matte injection-molded plastic with visible seams and parting lines instead of polished ceramic, and each unit now comes in its own bold color — 20 distinct hues across the line, with unit 001 kept factory white. Their LED eyes and chassis light strips share a second color that glows against the shell.
* **The Gamba species has been removed**, bringing the pack to 18 species. It was the mod's only Mammalian portrait, so the Mammalian tab it added to the empire creator is gone as well — existing empires using a Gamba portrait will need to pick a new one.
* Rewrote the Workshop description: every species is now listed under the empire creator tab it actually appears in, with its portrait count and a bit of in-universe flavor.

## 1.11.0 — 2026-08-17 17:45

* **New species: Drakelings** — 30 portraits (15 male, 15 female) of cute little dragon-folk blacksmiths, bronze-plated on one side of the forge and polished silver on the other. That brings the pack to 19 species.
* Mermaids got fresh portrait art for both genders, plus a fix for portrait entity references that were pointing at the wrong models.
* **Every species is now registered the way the game expects it.** Drakelings were missing from the character creator entirely, and Mermaids without the Aquatics Species Pack were being offered under a species class you can't actually play. Both fixed — and every species now falls back to a sensible class when you don't own the matching DLC.
* AI empires roll the portraits more fairly: Necromancers and Green Elves were being drawn from two species classes at once, and Astral Humans were registered twice under the same one, doubling their odds. All cleaned up.
* Removed the mod's three custom species classes. The game's parser had been silently rejecting them all along — three errors in your error.log on every launch — so they never contributed a single portrait. Species now use vanilla class flavor instead: insults, compliments and anatomy come from the class they actually belong to.
* Updated for Stellaris 4.5.

## 1.10.0 — 2026-08-10 18:05

* Astral Humans got fresh portrait art (new female/male variants) and were migrated back to the corrected shared portrait rig, fixing the framing issue that kept them on the legacy rig since 1.8.0.
* Default Humans got updated portrait textures too.
* Overhauled the AI portrait generation pipeline under the hood — ethnicity traits are now reinforced automatically and consistently across every variant instead of being hand-tuned per portrait, and hairstyle variety got expanded.

## 1.8.0

* Migrated the shared animated portrait rig to a corrected UV layout for most species — better framing and a larger, more centered portrait instead of wasted canvas.
* Reverted Mermaids and Astral Humans to their previous portrait rig after in-game testing showed framing issues with the new layout (tail/scale inconsistencies); a proper fix will follow in a future update.
