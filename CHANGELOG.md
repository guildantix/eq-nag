# Changelog

Each version's section is written to be pasted into its GitHub release
description, which Nag shows in the Update Notes window.

## v0.2.27 (unreleased)

### Fixes
- **Setup wizard no longer gets stuck.** On a new install, or after Nag's settings files were lost or damaged (for example after a crash), the setup wizard's buttons could stop working, leaving the wizard covering the app. This affected every version since 0.2.23. Nag now correctly upgrades its settings on startup, and anyone already stuck should be fixed automatically after updating.
- **Clear All works again on live servers.** EverQuest's October 2026 patch puts `~ ` in front of the player's name on `/emote` messages, which stopped the built-in Clear All trigger (`/em clears their mind`) from firing. It now accepts both the new and old formats, so it keeps working on emulator servers. (Thanks, Maxx!)
- **If you have your own emote-based triggers** (for example timers started with `/em`), make the new `~ ` optional so they work on both live and emulator servers. For a regular-expression phrase, add `(?:~ )?` right after the `^` at the start.
- **The Heroes Journey:** fixed THJ character and server detection when adding characters, and fixed direct-damage spell parsing for THJ.

### New
- **Pets in Combat Statistics.** Pets can now be added and assigned to their owner from the Combat Statistics screen, and Nag detects pet ownership from the log, so pet damage is credited to the right player.
- **Better player identification** in the combat parser, including class abbreviations.

### Other changes
- **Nag is now open source** at https://github.com/guildantix/eq-nag.
- **The installer is no longer code-signed.** Windows SmartScreen may show an "unknown publisher" warning the first time you install. Click "More info", then "Run anyway". Updates install as usual.
- Removed the Patreon banner from the Update Notes window.

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
