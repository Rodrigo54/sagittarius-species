# Change Notes

For the steam workshop change notes I recommended to use major mod version increases when removing features or adding a plethora of them, minor ones when updating to a new game version or doing small tweaks and patch version increases when changing things unrelated to the users experience.

> New entries go on top, as a `## <version>` heading. `bun run publish-workshop` reads the topmost
> section as the changenote for that build, stamping `— YYYY-MM-DD HH:mm` onto the heading at
> publish time if it isn't there yet (that stamp is local bookkeeping only — it never gets sent
> to Steam, which already timestamps updates on its own).

## 1.10.0

* Astral Humans got fresh portrait art (new female/male variants) and were migrated back to the corrected shared portrait rig, fixing the framing issue that kept them on the legacy rig since 1.8.0.
* Default Humans got updated portrait textures too.
* Overhauled the AI portrait generation pipeline under the hood — ethnicity traits are now reinforced automatically and consistently across every variant instead of being hand-tuned per portrait, and hairstyle variety got expanded.

## 1.8.0

* Migrated the shared animated portrait rig to a corrected UV layout for most species — better framing and a larger, more centered portrait instead of wasted canvas.
* Reverted Mermaids and Astral Humans to their previous portrait rig after in-game testing showed framing issues with the new layout (tail/scale inconsistencies); a proper fix will follow in a future update.
