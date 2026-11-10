---
title: "What's new"
nav_order: 6
hide_meta: true
---

# What's new

What changed in each Nag release. You can also open the **Update Notes** window from the **Settings** tab, by clicking **Notes** at the top.

## Coming after 0.2.27

These changes are in the development version and are not in a release yet.

### New

- **Roll Tracker.** Nag follows `/random` rolls, ranks them, handles ties and can copy or speak the result. It has a **Rolls** tab, a roll panel on screen, a **Test overlay** button and a **Roll Tracker** section in **Settings**. See [Roll Tracker]({{ '/guides/roll-tracker' | relative_url }}).
- **Help & guides link** at the top of **Settings**. It opens this site.
- **Your zone from `/who`.** The built-in Capture Zone trigger also sets `CurrentZone` from your own `/who` line. See [Conditions and variables]({{ '/triggers/conditions' | relative_url }}#zone-conditions).

### Fixes

- **DoT timers start at once.** They count down from the cast, and restart from the first damage line if you chose one. They no longer sit at "(??)".
- **Quarm and TAKP spell damage in the DPS meter** is credited to the right caster.
- **Spell import reads tick durations correctly.** "12 ticks" is 72 seconds, not 12.
- **The Console search box and character list work.**
- **Settings are saved safely.** A crash or power loss can no longer cut a settings file short. If Nag cannot read a file it shows "Nag could not read its data" and closes, so nothing is overwritten. See the [FAQ]({{ '/help/faq' | relative_url }}#could-not-read).
- **Plain timers leave the overlay as soon as they reach zero**, instead of showing "0s" for a second.
- **Millions show as "1.5M"** in the DPS meter and floating combat text. It used to be a lowercase m.
- **The ending and ended sound buttons** in the DoT Timer editor work.
- **Sequential triggers** remove the finished sequence, not another one.
- **Death Recap** no longer fails on damage lines from your own DoTs.

## v0.2.27 (not released yet)

### Fixes

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
