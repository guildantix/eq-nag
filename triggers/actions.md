---
title: Actions reference
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 20
---

# Actions reference

Actions are what a trigger does when one of its capture phrases matches. Open the trigger's **Actions** tab, click **New**, then pick a type from the action type picker. The picker has three columns and a hint for every type.

Every action except **List** has a **Trigger on phrase** box. Tick one or more of the trigger's capture phrases there. An action with no phrase ticked never fires on its own, but a timer can still run it from its **Timer Ending** or **Timer Ended** tab (see [Timers in depth]({{ '/triggers/timers' | relative_url }})).

Actions run from top to bottom in the order shown, so use the up and down arrows on an action card when order matters. For example, put a **Counter** above the **Display Text** that shows its value.

## All action types

| Action | The app's description | Details |
|---|---|---|
| Display Text | Display text on an overlay. | [Display Text](#display-text) |
| Speak | Speak a phrase. | [Speak](#speak) |
| Countdown | Start a countdown. | [Timer and Countdown](#timer-and-countdown) |
| Timer | Start a timer. | [Timer and Countdown](#timer-and-countdown) |
| DoT Timer | Creates a countdown until the dot expires. | [DoT Timer](#dot-timer) |
| Beneficial Timer | Creates a countdown until the buff expires. | [Beneficial Timer](#beneficial-timer) |
| Counter | Track the number of times an event occurs. | [Counter](#counter) |
| Clipboard | Put text into the clipboard. | [Clipboard](#clipboard) |
| Store Variable | Store a value in a variable. | [Store Variable](#store-variable) |
| Clear Variable | Empties the value in a variable. | [Clear Variable](#clear-variable) |
| Play Audio | Play an audio file. | [Play Audio](#play-audio) |
| Stopwatch | Starts a stopwatch. | [Stopwatch](#stopwatch) |
| List | Start and manage a list. | [List](#list) |
| Screen Glow | Renders a glow around the main display. | [Screen Glow](#screen-glow) |
| Clear All | Stops all active components. | [Clear All](#clear-all) |
| Display Death Recap | Displays the Death Recap window. | [Display Death Recap](#display-death-recap) |

{: .note }
Text boxes in actions accept snippets such as `{S1}`, `${Name}` and `+{Counter}`. See the [Triggers & Regex]({{ '/triggers/' | relative_url }}) section for the snippet reference. A snippet only fills in if the phrase that fired the action captured it.

## Display Text

Shows text on an **Alert** overlay. The **Overlay Window** list only offers Alert overlays.

| Property | Description |
|---|---|
| **Display Text** | The text to show. Snippets are filled in. |
| **Overlay Window** | The Alert overlay to draw on. |
| Duration (**Hrs**, **Mins**, **Sec**) | How long the text stays on screen. |
| **Custom color** | Shows the text in a color you pick. Off means the overlay's own color is used. |
| **Custom size** | Turns on a **Size** slider (1 to 64) and a **Spacing** slider (10 to 300, in steps of 5). |
| **Custom border** | Draws a colored border around the letters. |
| **Custom glow** | Draws a glow in the color you pick, with a size slider from 0 to 10. |
| **Custom font** | Picks a font from the list (Roboto, Red Rose, Oswald, Roboto Mono, Open Sans Condensed, Ranchers, Press Start 2P) and a weight slider. |
| **Show against color** | Only changes the preview box in the editor. |

The preview box at the bottom of the tab shows how the custom options look. Right-click inside the action to **Copy Properties** and **Paste Properties** between Display Text actions.

## Speak

Speaks a phrase with the text-to-speech voice you chose in **Settings**.

| Property | Description |
|---|---|
| **Text to speak** | The phrase. Snippets are filled in. The play button next to the box speaks it so you can listen. |
| **Volume** | A slider from 1 to 100. It is scaled by **Master Volume** and **Text to Speech Volume** in Settings. |
| **Rate** | **Normal**, **Fast** or **Very Fast**. These are 1.00, 1.75 and 2.25 times the **Base Speaking Rate** in Settings. |
| **Interrupt speech** | If Nag is already speaking, stop that speech and say this phrase now. |
| **Speak Next** | If Nag is already speaking, let it finish, then say this phrase before anything else that is waiting. |

If both **Interrupt speech** and **Speak Next** are ticked, **Interrupt speech** wins.

{: .note }
Speak does nothing if no voice is selected in **Settings**. Nag shows the problem in the Console instead of speaking.

## Play Audio

Plays one sound file.

| Property | Description |
|---|---|
| **Saved audio clips** | The sounds Nag already knows. The play button next to the list previews the selected clip. |
| **Select new audio file.** | Adds a file to the list. Nag accepts .mp3, .ogg, .m4a, .opus, .webm and .aac. |
| **Volume** | A slider from 1 to 100. It is scaled by **Master Volume** and **Audio Volume** in Settings. |

## Screen Glow

Draws a colored glow around the main display. It is useful for "move now" calls that you must not miss.

| Property | Description |
|---|---|
| **Glow Duration** (**Hrs**, **Mins**, **Sec**) | How long the glow lasts. |
| **Glow Color** | The color of the glow. |
| **Glow Flash** | Pulses the glow instead of holding it steady. |

Right-click inside the action to **Copy Properties** and **Paste Properties**.

{: .note }
Screen Glow can be switched off in **Settings**, under **Shared/Installed Trigger Permissions**. **Disable Screen Glow** blocks glows from triggers made by other authors. **Disable All Screen Glow Actions** (shown once the first is ticked) blocks all of them, including your own.

## Clipboard

Copies text to the Windows clipboard so you can paste it into the game or another program.

| Property | Description |
|---|---|
| **Clipboard text** | The text to copy. Snippets are filled in. |

A common use is a reply you can paste into chat, such as `/tell {S1} ` for the person who just sent you a tell.

## Timer and Countdown

A **Timer** fills up as time passes. A **Countdown** starts full and empties. Both show on a Timer overlay.

The editor has four tabs: **Timer**, **Timer Ending**, **Timer Ended** and **End Early**. Every property is described on [Timers in depth]({{ '/triggers/timers' | relative_url }}).

{: .warning }
A Timer or Countdown with a duration of zero is not shown.

## DoT Timer

Counts down the life of a damage-over-time spell on a target. It has its own page section because it works differently from a plain timer. See [DoT Timer]({{ '/triggers/timers#dot-timer' | relative_url }}) in Timers in depth for the properties, the tick phrase, **Exclude Targets** and focus effects.

## Beneficial Timer

Counts down a buff. See [Beneficial Timer]({{ '/triggers/timers#beneficial-timer' | relative_url }}) in Timers in depth for the properties, **Cast time** and focus effects.

## Stopwatch

Counts up from zero until a stop phrase matches. Use it to time a fight phase or a respawn. See [Stopwatch]({{ '/triggers/timers#stopwatch' | relative_url }}) in Timers in depth for the properties.

## Counter

Keeps a tally of how many times its phrases matched.

| Property | Description |
|---|---|
| **Counter name** | The name of the counter. Show the value in text with `+{CounterName}`. |
| **Reset the counter after** (**Hrs**, **Mins**, **Sec**) | The counter goes back to zero when this much time has passed since the last increase. |
| **Counter Reset** tab | Phrases that reset the counter to zero when one of them matches a new log line. |

{: .warning }
Set a reset time. In 0.2.27, a counter that has no reset time (blank or zero) is cleared on the next log line after it goes up, so it never counts past one. Pick a long time, such as 8 hours, if you want it to last a session.

Other things to know:

- The counter name is used exactly as typed. Snippets are not filled in, and names are case sensitive.
- The phrases on the **Counter Reset** tab are checked as typed. They can use `{C}`, but they cannot capture new values with `{S1}`.
- **Clear All** resets every counter to zero (see [Clear All](#clear-all)).
- You can also use a counter as a trigger condition. In the trigger's **Conditions** group, pick the counter name and choose **Equals**, **Is not equal to**, **Is less than** or **Is greater than**.

## Store Variable

Saves a value so other triggers can use it in conditions, in capture phrases and in text.

| Property | Description |
|---|---|
| **Storage Type** | **Local Variable** or **Persistent Dictionary**. |
| **Variable Name** | The name other triggers use. In text and phrases, write `${VariableName}`. |
| **Check if value is used?** | Only saves the value if an active trigger's condition asks for it. |
| **Loop-back for value?** | When Nag starts reading a log, it looks backward through the log for the latest matching line, so the variable has a value right away. |

The value saved is the first capture group of the phrase that fired the action. If the phrase has no capture group, the whole matched text is saved. A variable can hold several values at once.

A **Persistent Dictionary** keeps its values after Nag closes. It uses **Variable Name** as the dictionary key, such as `CastTimes[{S1}]`, and **Value** as the text to store. The name must have the `Name[key]` form, with the square brackets. Without them Nag raises an error. Timers can read a stored value through the **Storage Formula** link next to **Timer duration**.

For how conditions read variables, see [Triggers & Regex]({{ '/triggers/' | relative_url }}).

## Clear Variable

Removes values from a stored variable. Pick the name in **Variable Name**.

Nag decides what to remove in this order:

1. If the phrase has a named capture group with the same name as the variable, that captured value is removed.
2. Otherwise, if the trigger has a condition that names a value for the variable, that value is removed.
3. Otherwise, every value in the variable is removed.

## List

Tracks a list of names, usually for raid mechanics where Nag calls out whose turn it is. It is the most involved action, so it has its own tabs. A trigger can have only one List action, and a List action has no **Trigger on phrase** box. It uses its own phrase choices instead.

| Tab | What it holds |
|---|---|
| **List** | **List Name**. The capture phrase that starts the list. The variable that holds the names, as a comma-separated list. How the list moves on: **Auto Enumerate List** (on a timer) or **Manual Enumerate List** (on a phrase), and the phrases that clear the list or begin and end enumeration. |
| **Enrollment** | **Enable Enrollment** notifies players running Nag when their own name is in the list. Options for **Show Timer**, skip, activate, deactivate, remove and add phrases, and **Enable Action Tracking**. |
| **Display** | **Show List** places a sample list on your monitor so you can position it. **Use backdrop**, **Custom font** and **Custom size** style it. |
| **Timers** | **Enable Top Timer** and **Enable Bottom Timer**. Each one gets its own tab with a duration, the phrases that start it, **Hide Timer** and **Reset on Deactivated**. |
| **Boxing** | **Character Name**. When you fill this in, Nag tracks that character in the list instead of you. |

Phrases that act on one name in the list (activate, deactivate, and the Top and Bottom Timer phrases) must contain `{LN}`, and they must be regular expressions. Plain-text phrases cannot use list snippets. The editor warns you when an activate or deactivate phrase has no `{LN}`.

## Clear All

Resets Nag's running state. The editor shows this note: "This action will clear all render elements, stop all timer types, reset all stored variables, end all audio files and speech, and restart all counters."

Things to know:

- It also empties every stored variable, including `CurrentZone`. Variables that use **Loop-back for value?** are read from the log again afterward.
- It restarts Nag's log reader after a short pause.
- Nag ships a built-in **Clear All** trigger. It runs when your character does the `/em clears their mind` emote. The three-dot menu in the **Triggers** tab has **Hotkeys**, then **Clear All**, to make you an in-game hotkey for it.

## Display Death Recap

Opens the Death Recap window for your last death. The editor note is: "This action will load the latest death recap window." There are no settings, just **Trigger on phrase**.

See [Death Recap]({{ '/guides/death-recap' | relative_url }}) for what the window shows.
