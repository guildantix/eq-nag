---
title: Timers in depth
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 21
---

# Timers in depth

Nag has five timer-style actions: **Timer**, **Countdown**, **DoT Timer**, **Beneficial Timer** and **Stopwatch**. They share most of their settings. This page describes each setting once and says which timers have it. For the other action types, see the [Actions reference]({{ '/triggers/actions' | relative_url }}).

## Which one do I use?

| Action | Bar | Use it for | Needs |
|---|---|---|---|
| **Timer** | Fills up as time passes. | Anything with a known length that you want to watch fill. | A duration above zero. |
| **Countdown** | Starts full and empties. | The same, when you care about time left. | A duration above zero. |
| **DoT Timer** | Fills like a timer, one bar per target. Only the time label counts down. | Damage-over-time spells you cast. | A phrase with a named group `target`. |
| **Beneficial Timer** | Empties like a countdown, one bar per target. | Buffs, mostly your own casts. | A phrase with a named group `target`, plus the spell's cast time. |
| **Stopwatch** | Counts up, no end. | Timing a phase or a respawn until a stop phrase matches. | At least one stop phrase. |

Timers and countdowns take their length from the **Timer duration** you set. If the phrase that fired the action has `{TS}`, the length found in the log line wins, so one trigger can handle "30 seconds", "2 minutes 30 seconds" and "1:30". DoT, Beneficial and Stopwatch actions do not read `{TS}`.

## The tabs

| Tab | Timer, Countdown, Beneficial | DoT Timer | Stopwatch |
|---|---|---|---|
| **Timer** (**Stopwatch** for a stopwatch) | Yes | Yes | Yes |
| **Timer Ending** | Yes | Yes | No |
| **Timer Ended** (**Stopwatch Ended** for a stopwatch) | Yes | Yes | Yes |
| **Exclude Targets** | No | Yes | No |
| **End Early** (**Stop Stopwatch** for a stopwatch) | Yes | Yes | Yes |

## The Timer tab

| Property | Used by | Description |
|---|---|---|
| Tick damage phrase (hint: "Select the capture phrase for the dot's tick damage (not the initial damage).") | DoT | Starts the clock on the first tick. See [DoT Timer](#dot-timer). |
| **Overlay Window** | All | The Timer overlay that shows the bar. |
| **Timer name** (**Stopwatch name**) | Timer, Countdown, Beneficial, Stopwatch | The label on the bar. On a Timer, Countdown or Stopwatch, snippets are filled in, and a name that was never filled in falls back to the trigger's name. On a Beneficial Timer it is the spell's name (see [Beneficial Timer](#beneficial-timer)). DoT timers have no name box. |
| **Timer duration** | Timer, Countdown, DoT, Beneficial | The length. On a DoT Timer the label also shows the number of ticks. The **Storage Formula** link on a Timer or Countdown takes the length from a stored variable or Persistent Dictionary instead. A Beneficial Timer shows the link but does not use it. |
| **AA Extended Focus Only** | Beneficial | Item click effects only benefit from AA extended focus. |
| **Hide Timer?** (**Hide stopwatch?**) | Timer, Countdown, Beneficial, Stopwatch | Keeps track of the time without showing the bar. See [Hide conditions](#hide-conditions). |
| **Restart behavior** | All | What happens when the action fires again. See [Restart behavior](#restart-behavior). |
| **Show the time remaining** (**Show the stopwatch duration**) | All | Adds the time to the label. This also applies when the overlay's own setting is off. |
| **Repeat timer** | Timer, Countdown, Beneficial | Starts over each time it reaches zero. A number box appears; leave it blank to repeat forever. |
| **Use color** | All | Picks a bar color instead of the overlay's color. |
| **Cast time** | Beneficial | The spell's base cast time in milliseconds, so 2.5 seconds is 2500. Enter 0 for instant effects. |
| **Do not use beneficial spell haste focus.** | Beneficial | For item clicks, which do not benefit from spell haste. |
| **Timer Icon** | All | **Select Icon File**, **Select EverQuest Spell Icon**, or **Reset Icon** to remove it. |

## Restart behavior

The **Restart behavior** list decides what happens when the action fires while an earlier bar from the same action is still showing.

| Option | What happens |
|---|---|
| **Always start new timer** | Nothing is removed. You get one bar per match. |
| **Restart only if the name matches** | The matching bar is replaced. For a DoT or Beneficial Timer, "the name" is the `target` capture, so Soandso's buff and Fizzlethorp's buff stay separate. For a Timer, Countdown or Stopwatch, it is the rendered **Timer name**. If **Timer name** was never filled in, every bar from this action counts as a match. If you typed a name and then cleared it, nothing ever matches, so set a **Timer name** when you use this option. |
| **Restart timer regardless of the name** | Every bar from this action is replaced, whatever its name or target. |
| **Do nothing and ignore trigger** | If a bar from this action is already showing, the new match is ignored. |

The Stopwatch list says "stopwatch" in place of "timer".

{: .note }
**Restart timer regardless of the name** replaces bars for every target, even for DoT and Beneficial Timers. Choose **Restart only if the name matches** to keep one bar per target.

## Timer Ending

Runs once when the time left drops to the **Notify duration** you set. It is available on Timer, Countdown, Beneficial and DoT actions.

| Property | Description |
|---|---|
| **Notify when ending** | Turns the tab on. A duration box appears. The rest of the tab stays hidden until you set a duration above zero. |
| **Show Timer** | Only if the timer is hidden: shows the bar when the ending time arrives. |
| **Change timer color** | Changes the bar color at the ending time. |
| **Display Text** | Shows text, with an **Overlay Window** and a duration. Snippets are filled in. |
| **Speak phrase** | Speaks the phrase. **Interrupt speech** stops anything Nag is already saying. |
| **Send text to clipboard** | Copies the text. |
| **Play an audio clip** | Plays a saved clip. **Select new audio file.** adds one. |
| **Execute actions when ending soon.** | Timer, Countdown and Beneficial only. Runs other actions from the same trigger (see below). |

## Timer Ended

Runs when the time reaches zero.

| Property | Description |
|---|---|
| **Remain after ended** (**Notify when ended** on a DoT Timer) | Keeps the bar on screen for the duration you set after it reaches zero. It is the same setting under two labels. |
| **Change timer color** | Changes the bar color while it remains. |
| **Enable ended notifications.** (**Execute actions when timer ends.** on a DoT Timer) | Turns on the options below. |
| **Display Text**, **Speak phrase**, **Send text to clipboard**, **Play an audio clip** | The same options as **Timer Ending**. |
| **Execute actions when ended.** | Timer, Countdown, Beneficial and Stopwatch only. |

Right-click the **Timer Ended** tab to **Copy Timer Ended Properties** and **Paste Timer Ended Properties** between actions.

{: .note }
While **Repeat timer** is on, the timer never really ends, so the **Display Text**, **Speak phrase**, clipboard and audio options on this tab do not run. **Execute actions when ended.** still runs each time around.

### Running other actions from a timer

**Execute actions when ending soon.** and **Execute actions when ended.** let a timer run other actions in the same trigger. Click the plus button, then pick an action from the list. The list only shows the trigger's other actions.

To use this, create the action you want, such as a **Screen Glow**, and leave its **Trigger on phrase** empty. Then pick it here. If the chosen action uses snippets the timer's phrase did not capture, Nag shows a **Variable Assignment** box where you type a value for each one.

## End Early

The **End Early** tab holds phrases that stop the bar before it reaches zero. They are checked against every new log line, but only while the bar exists. A Stopwatch calls this tab **Stop Stopwatch**. A matching phrase there stops the stopwatch and runs its ended actions, then the bar goes away.

What happens when an End Early phrase matches:

- **DoT Timer:** the bar is removed. Its ended settings do not run.
- **Timer, Countdown and Beneficial Timer:** if you turned on **Remain after ended** or **Enable ended notifications.**, the bar jumps to its ended state so those settings still run. Otherwise the bar is removed. The **When ended early, force the timer to close without waiting for the remain timer to end.** box (shown when **Remain after ended** is on) removes the bar at once.

{: .warning }
**When ended early, force the timer to close...** only takes effect on overlays that have **Group DoTs by target** turned on. On other overlays the bar still stays for its full remain time.

End Early phrases are different from capture phrases in four ways:

- They can use `${name}` to reuse a named group from the phrase that started the bar, and `{S1}` or `{N1}` to reuse a captured value. They cannot capture new values. Use `(.+?)` instead.
- The reused value is inserted as plain text. In a **RegEx** phrase it is not escaped, so a mob name with brackets or dots can change what the phrase means. In a plain-text phrase it is escaped.
- Each phrase has its own **RegEx** checkbox and an **i** button in the **Ops** column (tooltip "Ignore Case"). Mob names often start with a capital letter in one line and not in another ("A cave lurker was slain" and "You have slain a cave lurker"), so turn on **i**.
- A plain-text phrase here is a "contains" check that is case sensitive unless **i** is on. Plain-text capture phrases are always case-insensitive.

## Exclude Targets

DoT Timers only. A target that matches any phrase here never gets a bar. Unlike capture phrases, these are checked only against the first capture group of the phrase that fired the action, which is normally the target's name. A plain-text phrase must match the whole name, ignoring case. A regular expression can match any part of it.

## DoT Timer

A DoT Timer follows one damage-over-time spell on one target.

What your trigger must provide:

- A capture phrase with a named group called `target`, such as `(?<target>.+?)`. The label on the bar is the trigger's name and that target.
- The trigger's name should be the spell's name. When you use a tick phrase, Nag watches for "Your *trigger name* spell has worn off of *target*." to cut the bar short.

How the clock works:

- The bar starts counting down when the spell is cast. If you pick a tick phrase in the **Timer** tab, the first matching damage line restarts the bar from that moment. If that line never comes, for example because the spell was resisted, the bar still runs down and ends. The tick phrase can use `?{target}` to mean "the same target as phrase 1" when the trigger is **Sequential**.
- With a tick phrase, the first "worn off" message after the bar starts ends it at that moment, as if it had run out. Its **Timer Ended** settings still run.
- If you pick no tick phrase, the clock starts when the main phrase matches, and there is no worn-off check.

Focus effects: if you turn on **Extended DOT Focus?** for the character (**Characters** tab, **Focus Effects**), Nag adds the extra ticks to every DoT bar. A tick is 6 seconds. The **Percent increase** is reduced by 5% for each level above **Level at which decay begins**. The level used is the **Spell Level** for your class on the trigger's **Character Classes** tab. The number of extra ticks is rounded down, except that a fractional gain below one tick is rounded to the nearest whole tick.

## Beneficial Timer

A Beneficial Timer follows a buff on one target.

- The phrase needs a named group `target`, like a DoT Timer. The bar's label is the spell name followed by the target, in the form "Spell --== Target ==--". Snippets in **Timer name** are not filled in.
- Nag only starts the bar if it saw you begin casting the spell. It looks for "You begin casting *spell name*." in the log about one cast time before the buff landed, give or take a second. The spell name is the value of the `SpellBeingCast` variable if the trigger has a condition on it, and otherwise the **Timer name**. If **Cast time** is 0, this check is skipped.
- If the character has **Beneficial Spell Haste Focus?** turned on, the cast time used for that check is shortened (for cast times of 3 seconds or more). **Do not use beneficial spell haste focus.** turns that off for item clicks.
- If the character has **Extended Beneficial Focus?** turned on, extra ticks are added to the duration. **AA Extended Focus Only** limits that to the AA part of the focus.

## Stopwatch

A Stopwatch counts up from zero. It has three tabs.

| Tab | Description |
|---|---|
| **Stopwatch** | The same settings as a timer, except there is no duration, repeat or cast time. |
| **Stopwatch Ended** | **Store stopwatch duration in variable.** saves the final time in **Variable Name**, in milliseconds. It is the unit a timer's **Storage Formula** expects, so another timer can take its length from the stopwatch. **Change stopwatch color**, **Enable ended notifications.** and **Execute actions when ended.** work as on a timer. |
| **Stop Stopwatch** | Phrases that stop the stopwatch. "If any of the below phrases match a new log entry, the stopwatch will end and execute any specified ended actions." |

## Hide conditions

Tick **Hide Timer?** to keep a timer running without showing its bar. Then click the blue **Conditions** link to hide the bar only for some matches. The **Edit hide conditions** box asks for a **Name**, an **Operator** (**Equals** or **Is not equal to**) and a **Value**. The name is a named capture group from the phrase that fired the action.

| Situation | Result |
|---|---|
| No conditions | The bar is always hidden. |
| Every condition passes | The bar is hidden. |
| Any condition fails | The bar is shown. |

**Equals** passes when the group exists and has exactly that value, including capital letters. **Is not equal to** passes unless the group exists and has that value.

So hide conditions work the opposite way from what you might expect: the bar is hidden only when all conditions pass.

{: .warning }
Hide conditions read named groups, so the phrase must be a regular expression with at least one named group, such as `(?<target>.+?)`. A plain-text phrase has none, and the timer will not start correctly.

## When the target dies

Live servers now report an NPC or pet death as "... was slain by ..." instead of "... has been slain by ...". Players still use "has been slain by".

- Triggers made by Nag's generators now handle both, along with "died." and "You have slain ...".
- On update, Nag changed existing regular-expression End Early phrases that start with `^`, do not start with `^You `, and contain "has been slain by". It changed them to `(?:has been|was) slain by`.
- If you wrote the phrase yourself in another form, such as plain text, change it by hand. Emulator servers still use "has been slain by".

A good end-early phrase for a target captured as `target` is:

```
^${target} (?:(?:has been|was) slain by [^!]*!|died\.)$
```
