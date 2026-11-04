---
title: Conditions and variables
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 6
---

# Conditions and variables

Conditions decide whether a trigger listens at all. If a condition fails, Nag does not check the trigger's phrases on that line. This page covers variable conditions, counter conditions, class conditions, folder conditions and the hide conditions on timers. It also explains how Nag stores variables and how the Clear Variable action decides what to remove.

## Where conditions live

| Condition | Where you set it |
|---|---|
| Variable and counter conditions | The trigger editor's **Capture** tab, in the **Conditions** group. Click **New** to add one. |
| Class conditions | The trigger editor's **Character Classes** tab |
| Folder conditions | Right-click a trigger folder and choose **Folder Conditions** |
| Hide conditions | On a timer, tick **Hide Timer?**, then click **Conditions** |

Nag checks a trigger's conditions on every new log line, in this order: the class, then the cooldown, then the trigger's own variable conditions and the conditions of its folders. Every one of them must pass. The app's hint under **Conditions** says the trigger "will not be loaded" when a condition fails. In practice the checks run again on each line, so the trigger starts working as soon as they pass.

## Variable conditions

Each condition in the **Conditions** group has three boxes:

| Box | What goes in it |
|---|---|
| **Variable Name** | Pick a variable from the list. It lists the variables your triggers create with a **Store Variable** action, and your counters. |
| **Operator** | **Is empty**, **Equals**, **Is not equal to** or **Contains** |
| **Value** | The text to compare. Separate several choices with a vertical bar, with no spaces around it. |

The operators work like this:

| Operator | The condition passes when |
|---|---|
| **Is empty** | The variable holds no values |
| **Equals** | The variable holds at least one of the values you typed. The match is exact and case-sensitive. |
| **Is not equal to** | The variable holds none of the values you typed. With the box left blank, it passes when the variable holds any value. |
| **Contains** | A stored value contains one of the values you typed. Case is ignored. |

A blank **Value** with **Equals** or **Contains** never passes.

To pass for several zones, separate the names with a vertical bar. Do not put spaces around the bar. Nag splits on the bar and does not trim the pieces, so `Zone A | Zone B` looks for "Zone A " and " Zone B" and neither would match.

For example:

```
Testvale Caverns|Plane of Time
```

The zone variable is filled from the line "You have entered Zone Name." That name is not always the one on the map, so read the exact text in your log after you zone.

### Variables Nag already keeps

| Variable | Filled by |
|---|---|
| `CurrentZone` | The **Capture Zone** trigger that comes with Nag. It stores the zone on "You have entered ..." and clears it on "LOADING, PLEASE WAIT...". |
| `SpellBeingCast` | The **Capture spell casting** trigger that comes with Nag. It stores the spell on "You begin casting ..." (and on "You activate ..." and "You begin singing ..."), and clears it when the spell is interrupted, resisted, does not take hold, fizzles or is reflected. |
| `Character` | Your character name. Always set. |

You can make your own with a **Store Variable** action. It stores the first capture group of the phrase that fired it, or the whole matched text if the phrase has no groups.

The **Store Variable** action has these options for a **Local Variable**:

| Option | What it does |
|---|---|
| **Variable Name** | The name other triggers use in conditions and in `${Name}`. |
| **Check if value is used?** | Only saves the value if some trigger uses it as a condition value. |
| **Loop-back for value?** | When the log loads, Nag loops backwards through the log to find the most recent matching line. |

## Counter conditions

A counter appears in the same **Variable Name** list. Pick one and the operators change to **Equals**, **Is not equal to**, **Is less than** and **Is greater than**. Type a number in **Value**. The condition compares that number with the counter's current value. See the Counter action in [Advanced Trigger Mechanics]({{ '/guides/advanced-triggers' | relative_url }}).

## How a variable stores its values

A variable is a list, not a single value. Each Store Variable action adds a value to the end of the list. The list can hold the same value more than once. Behind the scenes there can be several values at once because a second spell can start before the first has finished, and because of lag.

That is why the operators above ask whether the list "holds" or "contains" a value instead of "is" a value.

When text shows a variable with several values, `${Name}` joins them with commas and no space.

## Clear Variable and its three rules {#clear-variable-and-its-three-rules}

The **Clear Variable** action removes values from a variable. Pick the variable under **Variable Name**. Nag follows three rules, in this order, and stops at the first that applies:

1. **A named group matches the variable.** If the phrase that fired the action has a named group with the same name as the variable, that captured value is removed from the list. A phrase that uses `${Name}` has such a group, because Nag adds it when the value matches.
2. **The trigger has a condition on the variable.** If the trigger has a variable condition that passed, the value that passed it is removed.
3. **Neither of those.** All values in the variable are removed.

{: .note }
Rules 1 and 2 only remove that one value, one time. If the value is not in the list, nothing is removed and Nag does not fall through to rule 3.

### Example: a spell is interrupted

The player starts casting Boil Blood, so `SpellBeingCast` holds `Boil Blood`. Another phrase in the trigger is:

```
^Your ${SpellBeingCast} spell is interrupted\.$
```

Nag swaps `${SpellBeingCast}` for a capture that takes any text, and checks that the captured text is one of the stored values. The line "Your Boil Blood spell is interrupted." matches. The captured value is also saved as a group called `SpellBeingCast`, so rule 1 applies and `Boil Blood` is removed from the list.

### Example: the spell lands

A DoT trigger named Boil Blood has the condition `SpellBeingCast` **Equals** `Boil Blood`. On its **Actions** tab, a Clear Variable action for `SpellBeingCast` runs when the target takes the first tick. That phrase has no group named `SpellBeingCast`, so rule 1 does not apply. The trigger's condition passed with the value `Boil Blood`, so rule 2 removes `Boil Blood`.

### Example: loading screen

Capture Zone's phrase `^LOADING, PLEASE WAIT\.\.\.` has a Clear Variable action for `CurrentZone`. It has no group and no condition, so rule 3 empties the whole list. The zone stays empty until the next "You have entered ..." line.

## Class conditions

Open the **Character Classes** tab. The **Class & Level** group lists every class with a checkbox and a **Spell Level** box.

- If no class is ticked, the trigger works for every class.
- If you tick one or more, the trigger only works for characters whose class is one of those. Set a character's class on the Characters screen.
- A character with no class set always passes.
- The **Spell Level** is not a condition. The app says it is "only used for calculating focus decay", and only the class turns the trigger on or off.

## Folder conditions

Right-click a trigger folder and choose **Folder Conditions**. The dialog is the same list as the trigger's **Conditions** group, with **Save** and **Cancel** buttons. The conditions apply to every trigger in the folder and in the folders inside it. A trigger needs its own conditions and its folders' conditions to pass.

## Hide conditions on timers

A timer can run without being shown. On a **Timer**, **Countdown** or **Beneficial Timer**, tick **Hide Timer?**. On a **Stopwatch** the box is **Hide stopwatch?**. A link called **Conditions** appears next to it. It opens the **Edit hide conditions** dialog.

Hide conditions look at the named groups of the phrase that started the timer. That includes `S1` and `N1`, because `{S1}` and `{N1}` are named groups. The dialog has three boxes:

| Box | What goes in it |
|---|---|
| **Name** | The name of a named group, typed without braces, such as `S1` or `Target` |
| **Operator** | **Equals** or **Is not equal to** |
| **Value** | The text to compare. It is exact and case-sensitive. |

The timer is hidden only when **all** of the conditions pass. If any one fails, the timer is shown. If you add no conditions, a hidden timer is always hidden.

- **Equals** passes when the group exists and has exactly that value.
- **Is not equal to** passes when the group is missing, or has a different value.

{: .warning }
Hide conditions need a regex phrase with named groups. If the phrase has no named groups at all, such as a plain-text phrase, the app hits an error and the timer won't work. Use a regex phrase with named groups, such as `{S1}` or `(?<Target>...)`.

## Where to go next

- [Snippets and variables]({{ '/triggers/snippets' | relative_url }}) shows `${Variable}` in a phrase and in text.
- [Capture phrases]({{ '/triggers/capture-phrases' | relative_url }}) covers **Cooldown**, which is checked with the conditions.
- [Triggers 101]({{ '/triggers/triggers-101' | relative_url }}) shows where conditions sit in the path of a log line.
