---
title: Push Recap
parent: How-to guides
nav_order: 12
---

# Push Recap

Some bosses can be pushed around by spells and procs. The Push Recap tells you who pushed the boss, and with which spell. It reads your log backwards to the last boss kill and ranks every player by the number of push hits.

Nothing runs while you fight. Nag only reads the log when you open a recap.

## Before you start

Push Recap can only count what your log shows.

1. In EverQuest, turn on other players' spell damage messages in your chat filters. Without them you only see your own hits.
2. Nag finds the spell data in the EverQuest folder that holds your character's log. If it can't, it uses the EverQuest folder it found earlier.

{: .note }
Hits are counted from spell damage messages that end like "... points of ... damage by Spellname.".

## Turn on the hotkey

Nag already has a built-in trigger named **Push Recap**. It opens the recap when your character does the emote `/em wonders who is pushing`. You only need an in-game hotkey for that emote.

1. Click the **Settings** tab.
2. Click **Push recap** in the list on the left.
3. Click **Create in-game hotkey**. Nag copies the command.
4. In EverQuest, paste the command into the chat box and press Enter.

The command is:

`/hot "Push Recap" /em wonders who is pushing.`

You can also copy it from the **Triggers** tab. Click the three-dot menu, then **Hotkeys**, then **Push Recap**.

## Open a recap

1. Fight a boss and win.
2. Click your new **Push Recap** hotkey in EverQuest.

A Push Recap window opens for your last boss kill. It shows:

- The boss name and when it died, how long the fight lasted and how much damage it took.
- Tiles with the number of push hits, the top pusher, how many players pushed and the push value.
- A bar chart that shows push over the fight. Click a bar to see what landed in that moment.
- A list of players, with the spells they used.

{: .note }
If the log starts in the middle of the fight, the window says so. Earlier pushes can't be counted then.

The window has **Copy summary**, which copies the result as text so you can paste it into chat. It also has **Save to Features › Push**, which keeps the recap for later. That button only shows while the recap is not saved yet. A recap from the hotkey is saved by itself when **Save every recap to Features › Push** is on, so the button stays hidden. A fight you open from the **Push** tab that is already saved shows only **Copy summary** (and **Show NPC abilities**).

![The Push Recap window for a made-up boss, with the chart and the player list]({{ '/assets/images/push-recap/push-recap-window.png' | relative_url }})

## Show the Push tab

The **Push** tab keeps your saved recaps and lets you look back at old fights.

1. Click the **Settings** tab.
2. Click **Push recap** in the list on the left.
3. Tick **Show Push under Features**.
4. Click the **Features** tab. The **Push** tab is next to **Rolls**.

**Save every recap to Features › Push** is on by default, in the same place. It keeps a small summary of every recap you view. Nag keeps up to 200 fights. It stores no log lines.

{: .note }
If you untick **Save every recap to Features › Push**, you can still save one recap at a time with **Save to Features › Push** in the recap window.

![The Push tab under Features with a list of fights and the Source, Date and Named only filters]({{ '/assets/images/push-recap/push-tab.png' | relative_url }})

## Look at saved recaps

1. Click the **Features** tab, then **Push**.
2. Leave **Source** on **Saved recaps**.
3. Click a fight in the list. A panel opens below the list.

The list shows the time, the mob, the length of the fight, the damage taken, the push hits, the total push, the procs and the top pusher. Click a column name to sort by it. The panel shows each player and the spells they used, and the timeline of the fight.

To open the full window for one fight, select it and click **Open Push Recap**. To delete a fight, click the bin icon on its row. **Clear all** deletes every saved recap.

### Totals for many fights

Hold Ctrl or Shift and click to select more fights, or click **Select all shown**. The panel then adds the fights up:

- Tiles with the push hits, the total push and the top pusher.
- A bar chart with one bar per fight. Hover over a bar for the mob and time. Click a bar to open just that fight.
- A grid of each player and spell, added up over all the selected fights.

Click **Copy summary** to copy the totals as text.

## Scan a log

You don't need saved recaps to look at old fights. Nag can read a whole log and list every fight that has a kill in it.

1. Click the **Features** tab, then **Push**.
2. Click **Source** and pick **Scan a log**.
3. Click **Character** and pick a character.
4. Click **Scan**.

A progress bar shows how far Nag has read. Click **Cancel** to stop. The list shows the newest fights first. Nag keeps the newest 1,000 kills.

To scan a log that isn't in your character list, pick **Scan another log file...** as the **Source**. Click **Choose file...**, pick the log file, then click **Scan**.

A scanned fight shows **Save** on its row. Click it to keep the fight in your saved recaps. Fights you already saved show **Saved**.

## Filter the list

These filters work right away, on saved and scanned fights alike.

| Filter | What it does |
|---|---|
| **Show fights where the mob took at least** | A slider. Hides fights where the mob took less damage than the number you pick. |
| **Date** | Shows one night only. A night runs from 06:00 to 06:00. **Any** shows all. |
| **Named only** | Hides fights against mobs whose name starts with "A ", "An ", "a ", "an " or any lowercase letter. |
| **Mob name** | Shows only mobs with this text in their name. |

## Procs with no player named

Some weapon procs say nothing about who cast them. Nag can't tell whose proc it was, so it keeps these out of the player totals and lists them in their own tables.

- **Procs with no player named** are procs whose message matches a push spell.
- **Possible procs** use a message that is shared with spells that have no push. They may not be push at all. They are not in any totals. The column **Also used by (no push)** shows the other spells.

On the timeline, tick **Show possible procs** to draw the possible procs in the chart.

A row with a message that is always noise can be hidden. Click the **×** at the end of its row.

To get a hidden message back:

1. Click the **Settings** tab.
2. Click **Push recap** in the list on the left.
3. Turn on the **Advanced** switch.
4. Under **Hidden proc messages**, click **Restore** next to the message. **Restore all** brings back every message.

## Change how long a fight is

Nag decides that a fight is over when nothing happened for a while.

1. Click the **Settings** tab.
2. Click **Push recap** in the list on the left.
3. Turn on the **Advanced** switch.
4. Under **Fight length**, change **A fight ends after this many seconds with no combat**. You can set 5 to 300.

## Make it open from a trigger

If you want your own trigger to open the recap, give it a **Display Push Recap** action. See [Actions reference]({{ '/triggers/actions#display-push-recap' | relative_url }}).

{: .note }
You don't need to do this when you use the built-in **Push Recap** trigger. It is already on.
