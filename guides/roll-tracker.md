---
title: Roll Tracker
parent: How-to guides
nav_order: 11
---

# Roll Tracker

When your group uses `/random` to decide who gets an item, the Roll Tracker follows the rolls for you. It ranks them, spots ties, and can copy the result so you can paste it into chat.

Rolls with the same range (for example 1 to 100) belong to one contest. A contest closes by itself when nobody has rolled for a while. A contest with one roller still shows in the Rolls tab. The roll panel, the copied line and the spoken winner need at least two players.

## What you see

- **A roll panel on your screen.** It shows a countdown and the top rolls while a contest is open, then the winner. It does not block your mouse.
- **The Rolls tab.** It lists every contest on the left and the full ranking on the right, with a rank, the player, the roll, the time and a note.

The Rolls tab marks the winner. A tie shows **TIE** in the Note column. A player who rolled more than once is flagged, with a note saying which roll counts.

## Use the Rolls tab

1. Click the **Rolls** tab.
2. Click a contest in the list to see its rolls.

Buttons:

| Button | What it does |
|---|---|
| **Close now** | Closes a contest that is still open. |
| **Copy top 4** | Copies the result line to your clipboard. The number is your **Rows on the overlay** setting. |
| **Test overlay** | Plays a short made-up contest (rolls 1 to 15) so you can see the panel and place it. |
| **Clear all** | Removes every contest from the list. It sits at the top of the list and only shows when there are contests. |
| **×** next to a contest | Removes that contest. |

Under the ranking, **Copied text (paste into chat)** shows the exact line Nag copies.

{: .note }
**Test overlay** works with no contest selected. It is grayed out while a test is running, and when **Track /random rolls** is off in Settings.

## Move the roll panel

1. Open the **Overlays** tab and click **Arrange Overlays**.
2. Find the dashed card named **Rolls** with the text **Drag to place**. It is always there, even when no contest is running.
3. Drag the card where you want the panel. Drag its edge to make it wider or narrower. The height adjusts by itself.

Nag saves the position as soon as you let go of the mouse. **Cancel** does not undo it. Until you place it, the panel sits 15% from the left and 20% from the top of your main monitor. If a saved position ends up off screen, for example after you unplug a monitor, Nag uses that default again.

See [Arrange your overlays]({{ '/guides/arrange-overlays' | relative_url }}).

## Settings

Open **Settings** and find **Roll Tracker**. The everyday options are always visible. Click **Show** next to **Advanced** for the rest. Each box with a **Reset** link goes back to Nag's default when you click it.

### Everyday

| Setting | What it does |
|---|---|
| **Track /random rolls** | Turns the Roll Tracker on or off. |
| **Copy the result when a contest closes** | Copies the result line to your clipboard when a contest closes. On by default. |
| **Speak the winner** | Reads the winner out loud when a contest closes. Off by default. |
| **Paste prefix** | Text put in front of the copied line, such as `/rs` to send it to your raid channel. Empty by default. |

### Advanced

| Setting | Default | What it does |
|---|---|---|
| **Close after (s, no new rolls)** | 30 | A contest closes this many seconds after the last roll. You can set 10 to 600. |
| **Rows on the overlay** | 4 | How many top rolls the panel and the copied line show. You can set 1 to 20. |
| **Hide overlay result after (s, 0 = keep)** | 10 | How long the panel stays after a contest closes. You can set 0 to 600. 0 keeps it on screen. |
| **Someone rolls twice** | First roll counts | Choose **First roll counts** or **Highest roll counts**. |
| **Paste text** | `Rolls ${min}-${max} (${count}): ${ranked}` | The line that is copied, after the prefix. |
| **Winner phrase** | `${winner} wins with ${roll}` | What Nag says for a winner. |
| **Tie phrase** | `Tie at ${roll} between ${winners}` | What Nag says for a tie. |

If you leave **Paste text**, **Winner phrase** or **Tie phrase** blank, Nag uses the default. Click the play button next to a phrase to hear it. In **Paste text** you can use `${min}`, `${max}`, `${count}` and `${ranked}`. In the phrases you can use `${winner}`, `${winners}`, `${roll}`, `${min}`, `${max}` and `${count}`.

{: .note }
The countdown allows for a short log delay, up to 10 seconds or half of **Close after**, whichever is smaller. Players whose logs lag a little behind still see a contest close at the same moment.

## Boxed characters

If you run several characters on one PC, the same roll can show up in more than one log. Nag counts it once.
