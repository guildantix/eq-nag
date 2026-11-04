---
title: "Why didn't my trigger fire?"
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 24
---

# Why didn't my trigger fire?

Work through this list from the top. The first few checks catch most problems, and each one takes under a minute. If you want to test without playing, jump to [Test it with Simulate Log](#test-it-with-simulate-log).

## Is logging on?

Nag reads the log file that EverQuest writes. If the game is not writing it, Nag sees nothing. Type `/log on` in the game.

In the **Characters** tab, the character's row shows a connected icon when Nag is reading its log. Open the row and check **Select Log File** on the **Settings** tab. The path under it must be the log for the character you are playing.

## Is it the right character and class?

A trigger can be limited to certain classes. Open the trigger's **Character Classes** tab. If one or more classes are ticked, the trigger only runs for characters of those classes. If none are ticked, it runs for every class.

Nag compares that list with the **Character Class** set on the character's **Settings** tab. If that is blank, Nag does not apply class limits.

## Are the trigger and its folder turned on?

In the **Triggers** tab, a trigger runs only while the check box next to it is ticked. A folder can switch triggers off for you: right-click it to see **Disable All Triggers** and **Enable All Triggers**. A trigger can be ticked here and still be off for the character you are playing: open the character in the **Characters** tab and use the **Triggers** sub-tab, which has a check box per trigger for that character. A folder can also have its own **Folder Conditions**. If one of those fails, none of the triggers inside it run. See [Disabling specific triggers]({{ '/guides/disabling-triggers' | relative_url }}).

## Do the conditions pass?

On the **Capture** tab, the **Conditions** group says: "If any condition fails, the trigger will not be loaded." So one failed condition stops everything, and the trigger never looks at a line.

- A condition on a variable needs the variable to have a value. `CurrentZone` stays empty until Nag has seen a zone line, which it also looks for in your log when it starts.
- **Equals** is an exact match and is case sensitive. **Contains** ignores case and matches part of a value. **Is empty** passes only when the variable has no value.
- Use `|` between values to allow several, such as `Fizzlethorp Keep|Fizzlethorp Depths`. Do not put spaces around the `|`. Nag does not trim them, so a space becomes part of the value.
- A condition on a counter offers **Equals**, **Is not equal to**, **Is less than** and **Is greater than**.

## Plain text or regular expression?

Each phrase has a **RegEx** check box. It changes how the phrase is read.

| | RegEx off | RegEx on |
|---|---|---|
| Match | The log line only has to contain the text. | The pattern is checked with JavaScript regular expression rules. |
| Capital letters | Ignored. | Matter, unless the **i** button (Ignore Case) in the **Ops** column is on. |
| `{S1}`, `{N1}`, `{TS}` | Not filled in. They are just text. | Turned into captures. |
| `.`, `(`, `?`, `^`, `$` | Plain characters. | Special characters. Put `\` before a literal one, such as `\.`. |

The most common slip is a phrase that uses `{S1}` or `^` with **RegEx** off. The phrase then looks for those characters in the log line and never finds them.

The other common slip is the reverse. With **RegEx** on, a dot is "any character" and a bracket starts a group. A line like `You feel better (a little).` needs `\(a little\)\.` to match literally.

## Anchors and the timestamp

Log lines start with a timestamp such as `[Sat Nov 01 20:15:03 2026]`. Nag removes it before it checks a phrase, so `^` means the start of the message. Do not put the timestamp, or `\[`, in your phrase.

`$` means the end of the message. If a line has extra text after the part you typed, `$` makes the phrase fail. Open the **Regex Visualizer** under the phrase (see below) to see what your pattern actually says.

## Is it an emote?

Since EverQuest's October 2026 patch, live servers put `~ ` in front of a player's name on `/emote` messages. A phrase that starts with `^Soandso starts` no longer matches the live line `~ Soandso starts the pull timer.`

Make the prefix optional so the phrase works on live and emulator servers:

```
^(?:~ )?{C} starts the pull timer\.$
```

`{C}` is your character's name. This only works with **RegEx** on. Nag's built-in Clear All and Death Recap triggers already handle it.

## Did you turn on Ignore case?

Regular-expression phrases are case sensitive. If a name sometimes starts with a capital letter, as in "A cave lurker" and "a cave lurker", click the **i** button in the **Ops** column so it is highlighted.

## Is Cooldown blocking it?

When **Cooldown** is on, a match makes Nag stop checking the whole trigger for that long. Another matching line during that time is ignored.

{: .warning }
Do not use **Cooldown** on a **Sequential** trigger. While the trigger is on cooldown, Nag throws away any sequence in progress, so the later phrases never get a chance to match.

## Is the sequence in order?

With **Sequential**, phrase 2 can only fire after phrase 1 has matched, phrase 3 after phrase 2, and so on. Check **Restart Behavior** in the **Sequential Rules** group if repeats look odd. The [Two-step emote]({{ '/triggers/cookbook#two-step-emote' | relative_url }}) recipe shows the behavior.

## Does the action listen to this phrase?

On the **Actions** tab, each action has a **Trigger on phrase** box. A phrase can match perfectly and still run nothing if that phrase is not ticked on the action. An action with no phrase ticked does not run by itself.

## It fires, but I see or hear nothing

- **Display Text and timers** need an overlay window. Check **Overlay Window** on the action, and that the overlay is visible. See [Arrange overlays]({{ '/guides/arrange-overlays' | relative_url }}).
- **Screen Glow** can be switched off in **Settings**, under **Shared/Installed Trigger Permissions** (**Disable Screen Glow** and **Disable All Screen Glow Actions**).
- **Speak** needs a voice chosen in **Settings**.
- **Play Audio** needs a clip chosen, and volume above zero in **Settings**.
- A **Timer** or **Countdown** with a duration of zero is not shown.

## Test it with Simulate Log

Simulate Log feeds lines you paste to your real triggers, as if the game had written them. Overlays, sounds and speech all run for real. Lines replay at the pace of their timestamps, so a two-minute gap between two pasted lines takes two minutes.

1. Click the three-dot menu in the **Triggers** tab and choose **Simulate Log**.
2. Click **Paste Log Entries**, paste one or more lines, and click OK.
3. Pick your character in the list and click the green play button.

Give at least one line a timestamp, such as `[Sat Nov 01 20:15:03 2026] Fizzlethorp tells you, 'hello'`. A line without one borrows the timestamp of the nearest line that has one. If no line has a timestamp, Nag drops them all.

## Read the Console

The **Console** button at the bottom right of the main window opens Nag's Console. Each time an action fires, it adds a line with the trigger name and the log line. Click the arrow on the line (tooltip "Show more details") to see the rendered phrase and what matched.

- If your trigger's name shows up, the phrase matched and an action ran. Look at the action settings.
- If it does not show up, the line did not match, or a condition failed.
- Click the trigger's name in a Console line to open it. Click the filter icon to list only that trigger's lines.
- Errors in a phrase, such as a regular expression with a missing bracket, also appear in the Console.

The **Regex Visualizer** is under a RegEx phrase in the **Capture** tab. Click it to color the pattern. Red marks a mistake.
