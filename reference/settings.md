---
title: Settings reference
parent: Reference
grand_parent: Documentation
nav_order: 1
applies_to: "0.2.30"
last_verified: 2026-11-26
---

# Settings reference

Every setting on the **Settings** tab, section by section. The list of sections is on the left side of the tab. Click a name to open it.

Six sections have an **Advanced** switch at the top right: Characters & log, Overlays, Sound & voice, Sharing, Roll tracker and Push recap. It is one switch for the whole tab. Turn it on and the extra settings of every section show. Nag remembers the choice. While it is off, a small dot next to the switch means some hidden setting is not at its default.

## Status

A quick check that Nag is working.

| Item | What it shows |
|---|---|
| Headline | **Watching** and the character's name (with the class when known, and "and N more" for more characters), **Not reading a log right now**, or **No characters set up yet**. |
| **Run setup again** | Starts the setup wizard again. It finds your characters and places your overlays. |
| **Log last written** | How long ago EverQuest last wrote to a log file you watch. A dash means nothing has been written yet. |
| **Triggers** | How many triggers you have, and how many of them are on. |
| **Open the guides** | In the **Help & guides** row. Opens this site in your browser. |

If the headline says **Not reading a log right now**, turn logging on in EverQuest with `/log on`. See the [FAQ]({{ '/help/faq' | relative_url }}#logging).

The **Notes** link in the title bar of the tab opens the Update Notes window.

## Characters & log

Add and remove characters on the **Characters** tab, not here.

### Log file maintenance

Keeps EverQuest log files from growing without limit by archiving them.

| Setting | What it does |
|---|---|
| **Tidy up log files automatically** | Turns log file maintenance on. Off by default. The settings below stay grayed out until it is on. |
| **When should Nag archive a log?** | Pick **When a log file reaches a certain size** or **On a schedule**. The default is by size. |
| **Archive when the file reaches** | For the size plan: 20 MB, 50 MB, 100 MB, 500 MB or 1 GB. The default is 50 MB. |
| **Sun** to **Sat** | For the schedule plan: the days of the week to archive. |
| **Archive time of day** | For the schedule plan: the time to archive. If you pick a day and no time, Nag uses 12:00 AM. |

### Advanced: Log file settings

The warning says changing these may change your performance a lot. Tick **Show log file settings** to see them.

| Setting | What it does |
|---|---|
| **Read delay** | How often Nag checks for new log entries, from 50 to 1000 milliseconds. The default is 200. |
| **Error delay** | How long Nag waits before it tries again after a read error, from 50 to 1000 milliseconds. The default is 1000. |

Click **Save changes** to keep a change, or **Cancel** to drop it.

## Overlays

Create, move and test overlays on the **Overlays** tab. See the [Overlays guide]({{ '/guides/arrange-overlays' | relative_url }}) for the steps.

### Default overlays

| Setting | What it does |
|---|---|
| **Default detrimental timer overlay** | The overlay new detrimental timers use. |
| **Default beneficial timer overlay** | The overlay new beneficial timers use. |
| **Default text overlay** | The overlay new text alerts use. |

### Advanced: Overlay positions

| Setting | What it does |
|---|---|
| **Enable relative window positions** | Keeps each overlay in the same relative position when your screen setup changes. On by default. The **?** next to it explains more. |

## Sound & voice

### Volume

| Setting | What it does |
|---|---|
| **Main volume** | Scales all sound from Nag, from 1 to 100. The default is 100. |

### Voice

| Setting | What it does |
|---|---|
| **Text to speech voice** | The voice used by **Speak** actions. The list comes from the voices installed in Windows. |
| **Test voice** | Speaks a sample sentence in the chosen voice. |

### Advanced: More volume and speed

| Setting | What it does |
|---|---|
| **Text to speech volume** | Volume of spoken text, from 1 to 100. The default is 100. |
| **Audio volume** | Volume of sound files, from 1 to 100. The default is 100. |
| **Base speaking rate** | How fast the voice speaks, from 0.25 to 4 in steps of 0.25. The default is 1. |

### Advanced: Speech examples

**Normal**, **Fast** and **Very fast** speak the **Example speech** text at three speeds, so you can pick a rate. You can change the example text. The default is `Hello, my name is nag.`

### Advanced: Phonetic transforms

Fixes names the voice says badly. Each row replaces the text on the left with the text on the right before it is spoken.

| Item | What it does |
|---|---|
| **New** | Adds a row. |
| **Original text** | The text as it appears in the trigger. |
| **Phonetic text** | The text to speak instead. |
| Play button | Speaks the **Phonetic text** so you can hear it. |
| **X** button | Deletes the row. |
| **Save changes** | Shows once you edit a row. Click it to keep your edits. |

## Sharing

### Quick Share

See the [Quick Share guide]({{ '/guides/quick-share' | relative_url }}) for how to share and import triggers.

| Setting | What it does |
|---|---|
| **Import Quick Share triggers** | Nag listens for Quick Share triggers in your log file and responds to them. On by default. |

### Author details

The name that goes on triggers you share.

| Setting | What it does |
|---|---|
| **Author name** | The name attached to any trigger you share. |
| **Discord** | Optional. Your Discord name or server. |
| **Save** | Creates your author record the first time. After that the button reads **Save changes**. |
| **Request verification** | Shows after you save and while you are not yet a trusted author. It asks for your author name to be verified. |

A shield icon next to the section title shows when you are a trusted author. Click it for details. Only trusted authors can create packages.

### Advanced: Who can send you triggers

Chooses whose Quick Share triggers Nag accepts.

| Setting | What it does |
|---|---|
| **Everyone** | Accept from any player. The default. |
| **Only these players** | Accept only from the players in the **Characters list**. |
| **Everyone except these players** | Accept from anyone not in the **Characters list**. |
| **Characters list** | One character name per line. Grayed out while **Everyone** is picked. |

### Advanced: Shared and installed trigger permissions

| Setting | What it does |
|---|---|
| **Disable screen glow** | Triggers created by another author do not run glow actions. Off by default. |
| **Disable all screen glow actions** | Shows once the first box is ticked. No trigger runs glow actions, whoever created it. Off by default. |

## Roll tracker

Tracks `/random` rolls and shows the top rolls on an overlay. See the [Roll Tracker guide]({{ '/guides/roll-tracker' | relative_url }}) for how to use it.

**Everyday** settings:

| Setting | Default | What it does |
|---|---|---|
| **Track /random rolls** | Off | Turns the tracker on. |
| **Copy the result when a contest closes** | On | Copies the result to your clipboard. |
| **Speak the winner** | Off | Speaks the winner or a tie. |
| **Paste prefix** | Empty | Text put in front of the copied result, for example `/rs`. **Reset** restores the default. |

**Advanced** settings:

| Setting | Default | What it does |
|---|---|---|
| **Close after (seconds)** | 30 | A contest closes after this long with no new rolls. From 10 to 600. |
| **Rows on the overlay** | 4 | How many players the roll panel shows. From 1 to 20. |
| **Hide overlay result after (seconds)** | 10 | How long a closed contest stays on the overlay. 0 keeps it there. From 0 to 600. |
| **Someone rolls twice** | First roll counts | Pick **First roll counts** or **Highest roll counts**. |
| **Paste text** | `Rolls ${min}-${max} (${count}): ${ranked}` | The text copied when a contest closes. |
| **Winner phrase** | `${winner} wins with ${roll}` | Spoken when someone wins. The play button previews it. |
| **Tie phrase** | `Tie at ${roll} between ${winners}` | Spoken on a tie. The play button previews it. |

Paste text can use `${min}`, `${max}`, `${count}` and `${ranked}`. The phrases can use `${winner}`, `${winners}`, `${roll}`, `${min}`, `${max}` and `${count}`. A blank text box goes back to its default.

## Death recap

Opens a window that shows what happened before a character died. See the [Death Recap guide]({{ '/guides/death-recap' | relative_url }}).

| Setting | What it does |
|---|---|
| **Off** | The default. Turns the Death Recap trigger off. |
| **Hotkey** | Opens the window when your EverQuest hotkey sends the "wonders how they died" emote. A **Copy** button copies the hotkey command. |
| **Automatic** | Opens the window when you are slain. |

The first time you pick **Hotkey** or **Automatic**, Nag asks which trigger folder to put the new Death Recap trigger in. Later changes update that trigger. If you deleted it, Nag makes a new one.

The section also describes the three parts of the window: **Damage Log**, **Damage Sources** and **Encounter Statistics**.

## Push recap

Shows who pushed the boss. See the [Push Recap guide]({{ '/guides/push-recap' | relative_url }}).

| Setting | Default | What it does |
|---|---|---|
| Hotkey command | | The command to paste into EverQuest. **Create in-game hotkey** copies it. |
| **Show Push under Features** | Off | Adds the Push tab under **Features**, with your saved recaps. |
| **Save every recap to Features › Push** | On | Keeps a small summary of each recap you view, up to 200 fights. No log lines are stored. |

**Advanced** settings:

| Setting | Default | What it does |
|---|---|---|
| **A fight ends after this many seconds with no combat** | 30 | From 5 to 300. A value outside that range is moved to the nearest end. |
| **Hidden proc messages** | None | Lists messages you hid with the X in the proc tables. **Restore** brings one back and **Restore all** brings all back. |

## Combat

Combat statistics read every hit in your log while you play. Floating Combat Text has its own switch on its tab. Death recap works with Combat off.

| Setting | Default | What it does |
|---|---|---|
| **Enable combat statistics** | Off | Turns on the DPS meter overlay and the statistics. |
| **Encounter minimum damage** | 0 | The least damage an encounter needs to count. |
| **Only show when Nag or EverQuest have focus** | On | Hides the meter when neither program is in front. |
| **Only show when there is an encounter** | Off | Hides the meter between fights. |
| **Highlight my name in the meters** | Off | Marks your own name. |

**Show more** opens the **Combat database**: one tab per server with your **Players**, **Pets** and **NPCs**. Search by name or class. Use the menu on a row to move a name between lists, change class or level, assign a pet owner or remove it.

## Advanced

The **Advanced** section is not behind the switch. It holds settings that are rarely needed.

| Setting | Default | What it does |
|---|---|---|
| **Open minimized to tray** | Off | Nag starts minimized to the system tray. |
| **Glow on startup** | On | The main display glows when Nag starts. |
| **Get pre-release updates** | Off | Nag updates to the latest pre-release automatically. |

**Messages you chose not to see again** lists every message where you ticked "Don't show this again". Click **Show again** on one to see it next time. **Show all again** shows when two or more are hidden.

## Diagnostics

Files for getting help. Under **Support files**:

| Button | What it does |
|---|---|
| **Download log file** | Saves a zip of Nag's own log. |
| **Download data files** | Saves a zip of your data files. |
| **Show data folder** | Opens the folder where Nag keeps its data in File Explorer. |

Do not post data files in public. They can hold your character names and triggers.
