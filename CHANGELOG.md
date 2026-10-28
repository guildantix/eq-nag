# Changelog

Each version's section is written to be pasted into its GitHub release
description, which Nag shows in the Update Notes window.

## v0.2.27 (unreleased)

### Fixes
- **Setup wizard no longer gets stuck.** On a new install, or after Nag's settings files were lost or damaged (for example after a crash), the setup wizard's buttons could stop working, leaving the wizard covering the app. This affected every version since 0.2.23. Nag now correctly upgrades its settings on startup, and anyone already stuck should be fixed automatically after updating.
- **Clear All works again on live servers.** EverQuest's October 2026 patch puts `~ ` in front of the player's name on `/emote` messages, which stopped the built-in Clear All trigger (`/em clears their mind`) from firing. It now accepts both the new and old formats, so it keeps working on emulator servers. (Thanks, Maxx!)
- **Death Recap's hotkey works again on live servers.** The `/em wonders how they died.` hotkey had the same problem. Existing Death Recap triggers are updated automatically, unless you've edited the phrase yourself.
- **If you have your own emote-based triggers** (for example timers started with `/em`), make the new `~ ` optional so they work on both live and emulator servers. For a regular-expression phrase, add `(?:~ )?` right after the `^` at the start.
- **The Heroes Journey:** fixed THJ character and server detection when adding characters, and fixed direct-damage spell parsing for THJ.
- **Timer durations (`{TS}`) are read correctly.** Durations with words were misread: "10 minutes" became a 10-second timer and "90:00" became 9 hours, and ordinary words like "soon" could start a broken timer. `{TS}` now understands "5m", "10 min", "2.5 hours", "1h30m", "1 hour 30 minutes", "28 minute(s) 1 seconds", "1:30" and "1:02:03". (Thanks, Maxx!)
- **`{N}` captures the whole number**, not just its first digits.
- **"Your resolution has changed!"** no longer appears on a new profile, and if your monitors turn off and come back (for example overnight), the warning now closes by itself once the screens are back to normal.
- **Timers end when an NPC or pet dies on live servers.** Live now reports these deaths as "… was slain by …" instead of "… has been slain by …", so auto-generated DoT, buff and raid timers kept running after the target died. New triggers handle both, and existing ones are updated automatically (End Early phrases that check for "has been slain by"). Emulator servers are unaffected.
- **SVG timer icons now show** in the Timer, DoT Timer and Stopwatch editors. (Thanks, Maxx!)

### Security
- **Safer shared triggers.** HTML in trigger text, overlay names and log text is now cleaned before it is shown, so formatting and styles still work but nothing in it can run. Overlays no longer load images, sounds or fonts from other websites, and sound files from shared packages and quick-shares are checked before they are saved.
- **Timer icons in shares** must be embedded images (PNG, JPEG, GIF, WebP or SVG) up to 256 KB. Other icons are dropped when a share or package is installed, and Nag warns you when you share a trigger that has one.

### New
- **Pets in Combat Statistics.** Pets can now be added and assigned to their owner from the Combat Statistics screen, and Nag detects pet ownership from the log, so pet damage is credited to the right player.
- **Better player identification** in the combat parser, including class abbreviations.
- **More sound formats.** Sounds can now be `.ogg`, `.m4a`, `.opus`, `.webm` or `.aac` as well as `.mp3`. (Thanks, Maxx!)
- **Easier to read and use:** a three-column action type picker with icons, phrase boxes that grow as you type, reorderable End Early phrases, a Regex Visualizer for capture phrases, a better color picker (system picker, manual input, more palettes), alphabetically sorted variable and sound lists, shorter console timestamps, and title bar text that brightens on hover. (Thanks, Maxx!)

### Other changes
- **Nag is now open source** at https://github.com/guildantix/eq-nag.
- **The installer is no longer code-signed.** Windows SmartScreen may show an "unknown publisher" warning the first time you install. Click "More info", then "Run anyway". Updates install as usual.
- Removed the Patreon banner from the Update Notes window.
- **Allakhazam trigger generators removed.** Allakhazam doesn't allow automated access to its pages, so the Allakhazam DoT, Buff and Raid Ability generators are gone. The EQ Spell Resources generators are unchanged, and triggers made earlier keep working. DoT and Buff timers made from Allakhazam can be re-imported from EQ Spell Resources: open the trigger, click "Re-import from EQ Spell Resources" and paste the spell's EQ Spell Resources address.

<!-- Maintainer notes, not part of the release description:
- Store migrations now use app.whenReady() instead of app.on('ready'); the ESM main
  process could emit 'ready' before the stores were constructed (b132df56).
- Releases are built by .github/workflows/release.yml on a v* tag and published to
  guildantix/eq-nag as a draft; SSL.com eSigner signing was removed (80223e43).
- package.json repository/publish target is now guildantix/eq-nag; builds from this
  version check eq-nag directly for updates instead of the eq-parse redirect.
- The leading "~ " on /emote lines is NOT stripped (the strip was reverted at Maxx's request).
  Only the predefined Clear All trigger needed changing (Albin's commits). It is replaced from
  clear-all.json on every load, so existing users get it without a migration.
-->
