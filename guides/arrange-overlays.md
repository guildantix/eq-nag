---
title: Overlays
parent: How-to guides
nav_order: 5
---

# Overlays

An overlay is a see-through window that Nag puts on top of your game. Your timers, text alerts and combat numbers all show up in overlays. You make the overlays, place them where you want them, and tell each trigger which overlay to use.

Open the **Overlays** tab to see them all.

![The Overlays tab with a list of overlays showing Id, Name and Use Count, and the Arrange Overlays and New Overlay buttons]({{ '/assets/images/overlays/overlays-tab.png' | relative_url }})

The list has these columns:

| Column | What it shows |
|---|---|
| **Id** | A random code of 16 letters and digits that Nag gave the overlay. You can't change it. |
| **Name** | The name you gave it. |
| **Use Count** | How many trigger actions use the overlay. Only the overlays that are set as the floating combat text overlays for damage you deal and damage you take show **FCT** instead of a number. |

## Overlay types

When you make an overlay, you pick its type. The type decides what the overlay can draw.

| Type in the list | Used by |
|---|---|
| **Text Notifications** | The **Display Text** action. |
| **Timer & Countdown** | The **Timer**, **Countdown**, **DoT Timer** and **Beneficial Timer** actions. |
| **Floating Combat Text** | Floating Combat Text groups. See [Floating Combat Text]({{ '/guides/floating-combat-text' | relative_url }}). |
| **Debug Log** | Debug messages from Nag, such as which trigger actions ran and the log line that set them off. You do not need one for normal use. |

The list also has a **Chart** type. It is grayed out and cannot be picked yet.

The other actions do not use an overlay. These are **Speak**, **Play Audio**, **Clipboard**, **Counter**, **Store Variable**, **Clear Variable**, **Clear All**, **Screen Glow**, **Display Death Recap** and **Display Push Recap**. The **List** action sets its own place, and you move it with **Arrange Overlays**.

{: .note }
When a trigger action asks for an overlay, it only lists overlays of the right type. A **Display Text** action lists text overlays only.

## Make a new overlay

1. Click the **Overlays** tab.
2. Click **New Overlay**.
3. Type a **Name**.
4. Pick the **Overlay Type**.
5. Click **Enter a description ...** if you want to add a note. This is optional.
6. Click the monitor you want the overlay on.
7. Click **Save Changes**.

![The New Overlay window with a name, an overlay type and a monitor picked]({{ '/assets/images/overlays/new-overlay.png' | relative_url }})

The overlay editor opens next, so you can change how it looks and place it. See the next section.

## Edit an overlay

1. Click the **Overlays** tab.
2. Click the **Edit this overlay** button at the start of the row.
3. Move the overlay on your screen and drag its edges to resize it.
4. Use the **General** tab to change the name, font, text, background and border.
5. Use the options for the type, such as **Alert Options** or **Timer Options**.
6. Click **Send Test** to see a sample in the overlay.
7. Click **Center Overlay** if you want to move the overlay to the middle of a monitor.
8. Click **Save** to keep your changes, or **Cancel** to leave them.

![The overlay editor, with the General tab showing the font and color options]({{ '/assets/images/overlays/edit-overlay.png' | relative_url }})

An overlay of the type **Floating Combat Text** has no font options. Change its colors on the **Floating Combat Text** tab instead.

## Send an overlay to the middle of a monitor

Use this when an overlay is lost, for example after you unplug a monitor.

1. Click the **Overlays** tab.
2. Click the **Send overlay to the middle of the selected monitor** button in the row. It is the second button, next to **Edit this overlay**.
3. In the **Select Monitor** window, click the monitor you want.
4. Click **OK**.

## Delete an overlay

1. Click the **Overlays** tab.
2. Click the **x** at the end of the row.
3. If triggers still use the overlay, Nag asks you to pick another overlay for them first.
4. Confirm.

## Find missing overlays

A trigger can point at an overlay that no longer exists. This happens after you delete an overlay, or after you import a trigger from another player. The trigger then has nowhere to draw.

1. Click the **Overlays** tab.
2. Click the three dots at the top right.
3. Click **Find Missing Overlays**.
4. If Nag finds triggers with a missing overlay, pick a new overlay for each one and confirm.

If nothing is missing, Nag says **There are no missing overlays found.**

## Arrange your overlays

Arrange mode shows all your overlays at once, so you can place and resize them together.

1. Click the **Overlays** tab.
2. Click the blue **Arrange Overlays** button.

   ![The Overlays tab with the Arrange Overlays button marked]({{ '/assets/images/overlays/arrange-button.png' | relative_url }})

3. Each overlay opens on your screen. Drag an overlay to move it. Drag its edge to resize it.

   ![Three overlays on a desktop, each one with a name and ready to be moved or resized]({{ '/assets/images/overlays/arrange-mode.png' | relative_url }})

4. Click **Save** in the **Arrange Overlays** window to keep your changes. Click **Cancel** to leave arrange mode without saving.

   ![The Arrange Overlays window with the Save and Cancel buttons]({{ '/assets/images/overlays/arrange-window.png' | relative_url }})

The Roll Tracker panel also moves in arrange mode. See [Roll Tracker]({{ '/guides/roll-tracker' | relative_url }}).

## Related guides

- [Floating Combat Text]({{ '/guides/floating-combat-text' | relative_url }})
- [Roll Tracker]({{ '/guides/roll-tracker' | relative_url }})
