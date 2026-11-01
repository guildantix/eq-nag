---
title: Coming from GINA
parent: Get started
nav_order: 4
---

# Coming from GINA

Nag can copy your GINA triggers, so you do not start from zero. This page shows how, what comes across and what does not.

## Before you start

- GINA must be installed on this same PC. Nag finds GINA's data on its own.
- Add your character in Nag first. See [Add your character]({{ '/get-started/first-character' | relative_url }}).
- Nag does not change anything in GINA.

## Import your triggers

1. Click the **Triggers** tab.
2. Click the three dots at the top right, then **Import from GINA**. You can also use **Settings**, then **Import from GINA**, then **Import**.
3. A window called **GINA Import** opens. If you see **Could not load GINA data.** or **Could not find the GINA data directory**, Nag cannot find GINA on this PC.
4. In **GINA Components** on the left, tick the folders and triggers you want. To bring over a spoken-word fix, click it under **Phonetic Transforms** and click **Import**.
5. Click **Generate Models**.
6. If some triggers listen for the same words, **Duplicate Triggers** appears. Use **Merge** to combine two triggers or **Ignore** to leave them as they are. Then click **Continue**.
7. **Map Gina Folders** shows your GINA folders. New folders show in green. Click a name to use one of your Nag folders instead. Then click **Continue**.
8. **Restrict by Zone** is optional. Type a zone name to make a trigger work only there. Use a bar to type more than one, like `Zone One|Zone Two`.
9. Click **Import Triggers**, then **Yes**.

Nag picks the overlays for you from your default overlays. An overlay is the on-screen box where text and timers show up.

You will see your GINA triggers in the **Triggers** tab, in their folders.

Items that are already imported are hidden from the list. Click the round check button above the list to show them again.

## What comes across

| GINA | In Nag |
|---|---|
| Trigger group | Trigger folder |
| Trigger | Trigger |
| Search text | **Capture Phrase** |
| Use Regular Expressions | **RegEx** box on the phrase |
| Display text | **Display Text** action, shown for 6 seconds |
| Copy to clipboard | **Clipboard** action |
| Text to voice | **Speak** action |
| Play media file | **Play Audio** action. Nag copies the sound file in. |
| Timer | **Countdown** action |
| Repeating timer | **Countdown** action that repeats |
| Stopwatch | **Stopwatch** action |
| Timer start behavior | **Restart behavior** on the timer |
| Early enders | **End Early** phrases |
| Timer ending and ended alerts | The **Timer Ending** and **Timer Ended** tabs of the timer |
| Counter reset timer | **Counter** action |
| Phonetic transforms | **Phonetic Transforms** in **Settings** |

GINA's timer start choices become these Nag choices:

| GINA | Nag **Restart behavior** |
|---|---|
| Start a new timer | Always start new timer |
| Restart timer, by timer name | Restart only if the name matches |
| Restart timer | Restart timer regardless of the name |
| Ignore if running | Do nothing and ignore trigger |

## What does not come across

- GINA's overlay look: fonts, colors and window positions. Nag gives each trigger one of your own overlays.
- GINA's "enable by default" setting. Imported triggers start turned on.
- Timer visible duration, Fast Check and the modified date.
- GINA's **Category** names. Nag does not use them to pick overlays.

## Things to check afterwards

Test each imported trigger with **Simulate Log** before you rely on it. Imported phrases are copied exactly as they were in GINA, so some may behave a little differently in Nag. The [Documentation]({{ '/documentation/' | relative_url }}) explains the differences.
