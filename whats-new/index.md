---
title: "What's new"
nav_order: 6
hide_meta: true
---

# What's new

What changed in each Nag release. You can also open the **Update Notes** window from the **Settings** tab, by clicking **Notes** at the top.

## v0.2.30 (pre-release)

Pre-release builds are offered only if you turn on **Get pre-release updates** in **Settings**. See [Install Nag]({{ '/get-started/install' | relative_url }}).

### New

- **Push Recap.** After a kill, a hotkey shows each player's push spells and procs. It is built in, like Clear All. See [Push Recap]({{ '/guides/push-recap' | relative_url }}).
- **Push tab.** Keeps every recap and can scan a whole log, including old backed-up logs, for boss kills. See [Push Recap]({{ '/guides/push-recap' | relative_url }}).
- **Possible procs.** Spells that share a landing message with a push proc no longer take credit for pushes they did not do. Unsure ones are listed separately.
- **Features tab.** Rolls and Push share one tab, so the tab bar fits on a normal window.
- **.nag files.** Save a trigger share to a file and send it any way you like. Open it by dragging it onto Nag or with **Import from File...**. See [Quick Share]({{ '/guides/quick-share' | relative_url }}).
- **Settings redesign.** Sections on the left, everyday options first, extras under **Advanced**, and a **Status** card that shows which logs Nag is reading. See the [Settings reference]({{ '/reference/settings' | relative_url }}).
- **Your class updates by itself** from persona swaps and your own `/who`.
- **Death Recap Off option.** It is the default for new profiles. Picking a mode recreates a deleted Death Recap trigger, and the window says "No death found" when there is none.

### Fixes

- **Less CPU use in raids.** Nag only tries the triggers that could match a log line. Matches are unchanged.
- **Trigger Library packages install into the right folders.** If a package left triggers in loose top-level folders, reinstall it. Nag moves them back and removes the empty folders.
- **One broken trigger pattern** no longer slows down every log line. Nag skips it and reports it once in the Console.
- **Floating combat text:** Crippling Blow, Twincast and Slay Undead hits show in their own modifier group, and riposte hits show again. See [Floating Combat Text]({{ '/guides/floating-combat-text' | relative_url }}).
- **Conditions** with spaces around `|` work, and two conditions on the same variable keep their own values.
- **Renamed or archived log copies** no longer show up as extra characters.
- Your EverQuest folder is kept when its drive is offline at start-up.
- Smaller fixes: quitting, start-up without a saved window size, the Console scrolling sideways, and a few buttons in the trigger editor.

### Security

- **Shared triggers are checked field by field** before they are installed. Damaged or tampered triggers are skipped and listed by name.
- **Timer icons in shares must be embedded images** (PNG, JPEG, GIF, WebP or SVG), up to 256 KB through the share server or 10 MB in a .nag file.

### Heads-up

- On first start, floating combat text groups that show Normal hits also get Slay Undead.

## v0.2.29 (pre-release)

### New

- **Roll Tracker.** Nag follows `/random` rolls, ranks them, handles ties and can copy or speak the result. See [Roll Tracker]({{ '/guides/roll-tracker' | relative_url }}).
- **Help & guides link** at the top of **Settings**. It opens this site.
- **Your zone from `/who`.** The built-in Capture Zone trigger also sets `CurrentZone` from your own `/who` line. See [Conditions and variables]({{ '/triggers/conditions' | relative_url }}#zone-conditions).
- **DoT timers start at once.** They count down from the cast, and restart from the first damage line if you chose one.
- **Millions show as "1.5M"** in the DPS meter and floating combat text.

### Fixes

- **Less CPU use**, especially with overlays and many timers on screen.
- **No more white "Nag Renderer" bar** stuck at the top of the screen.
- **Timers that never appeared** on the overlay now show.
- **Imported spells lasting 10 or more ticks** get the right duration. Re-import affected timers.
- **Pet ownership** is detected on live servers again.
- **TAKP:** your spell damage is credited to you in the DPS meter.
- **Settings are saved safely.** A crash or power loss can no longer cut a settings file short. If Nag cannot read a file it shows "Nag could not read its data" and closes, so nothing is overwritten. See the [FAQ]({{ '/help/faq' | relative_url }}#could-not-read).
- **Plain timers leave the overlay as soon as they reach zero**, instead of showing "0s" for a second.
- Death Recap, Sequential triggers, the Console search box and character list, and the sound buttons in the DoT Timer editor work again.

## v0.2.28 (latest) and v0.2.27

### Fixes

- **Number conditions** check again after the first run. (New in 0.2.28.)
- **The Setup window no longer gets stuck.** On a new install, or after Nag's settings files were lost or damaged, the buttons could stop working and the window covered the app. This affected every version since 0.2.23. Anyone already stuck is fixed automatically after updating.
- **Clear All works again on live servers.** EverQuest's October 2026 patch puts `~ ` in front of the player's name on `/emote` messages. That stopped the built-in Clear All trigger. It now accepts both the new and the old format, so it also keeps working on emulator servers.
- **The Death Recap hotkey works again on live servers.** It had the same problem. Existing Death Recap triggers are updated automatically, unless you edited the phrase yourself.
- **Your own emote triggers.** Make the new `~ ` optional so they work on live and emulator servers. See the [FAQ]({{ '/help/faq' | relative_url }}#emote-prefix).
- **The Heroes Journey.** Character and server detection when adding characters is fixed, and so is direct-damage spell parsing.
- **Timer durations (`{TS}`) are read correctly.** "10 minutes" used to become a 10-second timer and "90:00" became 9 hours. `{TS}` now understands "5m", "10 min", "2.5 hours", "1h30m", "1 hour 30 minutes", "28 minute(s) 1 seconds", "1:30" and "1:02:03".
- **`{N}` captures the whole number**, not just its first digits.
- **"Your resolution has changed!"** no longer appears on a new profile. If your monitors turn off and come back, the message now closes by itself once the screens are back to normal.
- **Timers end when an NPC or pet dies on live servers.** Live now says "was slain by" instead of "has been slain by". New triggers handle both, and existing ones are updated automatically. Emulator servers are not affected.
- **SVG timer icons now show** in the Timer, DoT Timer and Stopwatch editors.

### Security

- **Safer shared triggers.** HTML in trigger text, overlay names and log text is cleaned before it is shown. Formatting and styles still work, but nothing in it can run. Overlays no longer load images, sounds or fonts from other websites. Sound files from shared packages and Quick Shares are checked before they are saved.

### New

- **Pets in Combat Statistics.** You can add pets and assign them to their owner. Nag also finds pet owners from the log, so pet damage goes to the right player.
- **Better player identification** in the combat parser, including class abbreviations.
- **More sound formats:** `.ogg`, `.m4a`, `.opus`, `.webm` and `.aac`, as well as `.mp3`.
- **Easier to read and use:** a three-column action type picker with icons, phrase boxes that grow as you type, End Early phrases you can reorder, a **Regex Visualizer** for capture phrases, a better color picker, sorted variable and sound lists, shorter console timestamps, and title bar text that brightens on hover.

### Other changes

- **Nag is now open source** at [github.com/guildantix/eq-nag](https://github.com/guildantix/eq-nag).
- **The installer is no longer code-signed.** Windows SmartScreen may show an "unknown publisher" warning the first time you install. Click **More info**, then **Run anyway**. Updates install as usual. See [Install Nag]({{ '/get-started/install' | relative_url }}#windows-warning).
- The Patreon banner was removed from the Update Notes window.
- **The Allakhazam trigger generators are removed.** Allakhazam does not allow automated access, so the Allakhazam DoT, Buff and Raid Ability generators are gone. The EQ Spell Resources generators are unchanged, and triggers made earlier keep working. To refresh an old DoT or Buff timer, see [Re-import a timer from EQ Spell Resources]({{ '/guides/reimport-allakhazam' | relative_url }}).

## Older versions and plans

See the [releases on GitHub](https://github.com/guildantix/eq-nag/releases) for older versions, and the [road map]({{ '/road-map' | relative_url }}) for what is planned.
