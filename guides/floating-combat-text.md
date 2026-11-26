---
title: Floating Combat Text
parent: How-to guides
nav_order: 14
---

# Floating Combat Text

Floating Combat Text (FCT) shows the damage and healing numbers from your fights on your screen, next to the action. You decide which hits show, how they look, and where they appear.

You set it up in groups. Each group picks the kinds of hits it shows, the look of the numbers, and the overlay that draws them.

## Turn it on

1. Click the **Combat** tab.
2. Click **Floating Combat Text**.
3. Check **Enable FCT** at the top right.

You also need an overlay of the type **Floating Combat Text**. See [Overlays]({{ '/guides/arrange-overlays' | relative_url }}).

{: .note }
FCT is off until you turn it on. The first time, Nag may ask if you want to **Create default combat groups**. They include starter groups such as **My Hits**. Change them, or click **New** to make your own.

## Make a group

1. Click **New**.
2. Type a name for the group and confirm.
3. Click the group name to open it.
4. Choose the settings below.
5. Click **Save Changes**.

![The Floating Combat Text tab with one group open, showing Combat Types, Modifiers and Group Settings]({{ '/assets/images/floating-combat-text/group-open.png' | relative_url }})

A group has changes you have not saved when its **Save group** button (a disk) shows in its title bar. **Revert Changes** puts the group back to its last saved state.

Each group has buttons in its title bar:

| Button | What it does |
|---|---|
| Up and down arrows | Move the group up or down the list. |
| **Change group name** | Renames the group. |
| **Copy group** | Makes a copy that you can change. |
| **Delete group** | Removes the group. |

{: .note }
Order matters. When a hit happens, Nag goes through the groups from the top. A group fits when it has the kind of hit checked under **Combat Types** and has every modifier of the hit picked. The first group that fits shows the hit. If no group has every modifier, the first group that has at least one of them shows it. Put your most specific groups at the top.

## Combat Types

Check the kinds of hits the group should show.

| Check box | Shows |
|---|---|
| **Your Melee Hits** | Melee damage you do. |
| **You Being Hit by Melee** | Melee damage done to you. |
| **Your Spell Hits** | Spell damage you do. |
| **You Being Hit by Spells** | Spell damage done to you. |
| **Your Healing Done** | Healing you cast. |
| **You Being Healed** | Healing you receive. |

Under **Pet Combat Types**, the same six choices exist for your pet:

- **Your Pet's Melee Hits**
- **Pets Being hit by Melee**
- **Your Pet's Spell Hits**
- **Pets Being Hit by Spells**
- **Your Pet's Healing Done**
- **Pets Being Healed**

## Modifiers

Modifiers are the special kinds of hit. Click a button to pick it. Click it again to clear it.

- **Normal** (a plain hit with no special kind)
- **Assassinate**
- **Crippling Blow**
- **Critical**
- **Deadly Strike**
- **Double Bow Shot**
- **Finishing Blow**
- **Flurry**
- **Headshot**
- **Lucky**
- **Rampage**
- **Riposte**
- **Slay Undead**
- **Strikethrough**
- **Twincast**
- **Wild Rampage**

For example, a group with only **Critical** picked shows critical hits. Add **Normal** to show plain hits too.

## Group Settings

The settings of the group are in tabs on the right.

### Styles

The **Styles** tab has a preview. Click the play button on the preview to watch the animation. Use the **Value**, **Source** and **Animations** links under the preview to switch between the parts.

- **Value** is the number itself. Pick its font, size, color and spacing.
- **Source** is the small label after the number, such as the kind of hit. Pick its look the same way.
- **Animations** controls how the numbers move.

The **Animations** part has these choices:

| Group | Choices |
|---|---|
| **Animations** | **Fountain**, **Scroll**, **Blowout**, **Grow**, **Shrink**, **Fade In**, **Fade Out** |
| **Starting Positions** | **Random Position**, **Right**, **Left**, **Top**, **Bottom** |

You can pick more than one of each. The numbers start from the positions you pick, and the animations play together.

### Properties

Under **Overlay**, pick the overlay that draws this group. The list only has overlays of the type **Floating Combat Text**. A group with no overlay shows nothing, and its box is marked red.

Under **Hit Data**, you can check:

| Check box | What it does |
|---|---|
| **Consolidate Hits** | Adds up small hits into one number, so your screen stays tidy. |
| **Ignore Hits** | Hides hits below a limit. |

Checking one of them adds a tab with the same name.

### Ignore Hits and Consolidate Hits

Both tabs ask for a **Threshold**. Pick **Percent** or **Value**. Click the **?** next to **Threshold** for a short explanation.

- **Percent** is a share of your typical hit. Nag works out your typical hit from your own fights. Nag tracks your hits for each character separately.
- **Value** is a number you type. With 500, the limit is 500.

With **Ignore Hits**, a hit below the limit is not shown by that group. With **Percent**, the limit is that share of your typical hit. If your typical hit is 500 and you pick 80%, the limit is 400. The next group that fits may still show the hit.

With **Consolidate Hits**, hits below the limit are added to the number that is already on screen instead of showing as new numbers. With **Percent**, the limit is that share of twice your typical hit. If your typical hit is 500 and you pick 80%, the limit is 800.

{: .note }
With **Percent**, you may see many hits over the limit at first. Nag is still learning your typical hit.

## Share your groups

To share, click **Quickshare** at the top. Nag shares all of your groups and the overlays they use, and copies a code to your clipboard. If you have no author name yet, Nag asks for one first. Send the code to the other player.

To add shared groups, click **Import**, paste the code and confirm. Nag adds the groups and their overlays.

## Related guides

- [Overlays]({{ '/guides/arrange-overlays' | relative_url }})
- [Combat Statistics and the DPS meter]({{ '/guides/combat-statistics' | relative_url }})
