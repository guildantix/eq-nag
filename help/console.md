---
title: The Console
parent: "Troubleshooting & FAQ"
nav_order: 2
applies_to: "0.2.30"
last_verified: 2026-11-26
---

# The Console

The Console is a list of what Nag is doing. It shows each time a trigger action ran, and it shows problems Nag found in your triggers. Open it when a trigger does not do what you expect.

## Open and close the Console

1. Click **Console** at the bottom right of the main window. The Console opens as a panel along the bottom of the window. Drag its top edge to make it taller or shorter.
2. To close it, click **Hide** in the Console's top bar.

You can also press F12 to open and close it.

![The Console open with a few lines]({{ '/assets/images/help/console-open.png' | relative_url }})

## The top bar

| Control | What it does |
|---|---|
| **Clear** | Removes the trigger lines and error lines, and Nag's stored history for them. Messages from Nag itself, such as progress messages, stay in the list. |
| **Hide** | Closes the Console. |
| Character list | Shows **Character** until you pick one. While none is picked, the Console shows trigger lines from every character. Pick a character to see only that character's trigger lines. To go back to every character, pick **All Characters** from the list. Messages from Nag itself always show. |
| Search box (magnifying glass) | Shows only lines that contain the text you type. |

## What a line shows

Each line starts with the time, such as `[20:15:03.120]`.

- A line with a trigger name in blue means an action of that trigger ran. The rest of the line is the log line that caused it.
- A red line is an error. It shows the trigger name and a short description of what went wrong. If the same error repeats, a number at the start of the line counts it.
- A line with a label and no trigger name is a message from Nag itself, such as a progress message while it loads something.

Click the small arrow on a line (tooltip "Show more details") to open the details. The details are a plain list of the raw fields Nag recorded for that line. Which fields appear depends on the line. A trigger line lists what Nag recorded about the match, and an error line also lists the error text.

## Click a trigger name

Click the trigger's name in a line to open that trigger so you can edit it.

## Show one trigger's history

1. Click the filter icon at the start of a trigger line.
2. The Console now lists only that trigger. Its name appears in the top bar.
3. Click **Failed** to see the lines where the trigger did not run. Click **Success** to see the lines where it did.
4. Click **Edit Trigger** to open the trigger.
5. Click the trigger's name in the top bar, the one with the small x, to go back to the full list.

## Messages you may see

| Message | What it means |
|---|---|
| The pattern is not a valid regular expression, so this trigger will not match. | A phrase with **RegEx** on has a mistake, such as a missing bracket. Nag skips that phrase and tells you once. Fix the phrase in the trigger. See [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }}). |
| System Error The pattern is not valid: ... | A red line with no trigger name, shown next to the line above for the same broken phrase. It gives the reason the phrase was refused, in the words of the regular expression checker, such as "Unterminated group". Use the reason to find the mistake. |

The Console keeps the most recent lines only. It starts empty each time you start Nag.

![A red Console line for a trigger whose phrase is not valid]({{ '/assets/images/help/console-invalid-pattern.png' | relative_url }})

## Where to go next

- [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }})
