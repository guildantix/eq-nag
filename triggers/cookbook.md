---
title: Trigger cookbook
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 23
---

# Trigger cookbook

Worked recipes you can copy and adapt. Each one shows the log line, the phrase, the settings and what fires. All names are made up (Soandso, Fizzlethorp, Lord Vexwick, Fizzlethorp Keep), so swap in your own.

The log lines are shown without the `[timestamp]`. Nag removes the timestamp before it checks a phrase, so `^` means the start of the message. To try a recipe without playing, use **Simulate Log** (see [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }})).

| Recipe | Uses |
|---|---|
| [Tell alert with the sender name](#tell-alert-with-the-sender-name) | `{S1}`, Display Text, Clipboard |
| [Raid emote with a countdown](#raid-emote-with-a-countdown) | `{TS}`, Countdown, Timer Ending and Ended |
| [AE warning in one zone only](#ae-warning-in-one-zone-only) | Variable condition, `CurrentZone` |
| [Death counter](#death-counter) | Counter, reset phrase |
| [DoT timer that ends when the mob dies](#dot-timer-that-ends-when-the-mob-dies) | Sequential, DoT Timer, End Early |
| [Two-step emote](#two-step-emote) | Sequential, Restart Behavior |
| [Low mana call-out](#low-mana-call-out) | `{N<=20}` number check |

## Tell alert with the sender name

*Chat, beginner*

**Log line**

```
Fizzlethorp tells you, 'are you up for a group?'
```

**Phrase** (turn on **RegEx**)

```
^{S1} tells you, '{S2}'$
```

`{S1}` captures the sender and `{S2}` captures the message.

**Settings**

- **Display Text** action, **Trigger on phrase** 1: `Tell from {S1}`, on an Alert overlay.
- **Clipboard** action, **Trigger on phrase** 1: `/tell {S1} ` (with a space at the end).
- Optional **Play Audio** action with a sound you like.

**What fires**

The overlay shows **Tell from Fizzlethorp**. The clipboard holds `/tell Fizzlethorp `, so you can paste it into the game chat, add your reply and press Enter.

{: .note }
`{S1}` only fills in because **RegEx** is on. In a plain-text phrase it stays as the literal text `{S1}`. The phrase does not match your own tells ("You told Fizzlethorp, ...") or group and raid chat.

## Raid emote with a countdown

*Raid, timers*

**Log line**

```
Lord Vexwick shouts, 'The floor gives way in 2 minutes 30 seconds!'
```

**Phrase** (turn on **RegEx**)

```
^Lord Vexwick shouts, 'The floor gives way in {TS}!'$
```

**Settings**

- **Countdown** action, **Trigger on phrase** 1. **Overlay Window**: pick a Timer overlay. **Timer name**: `Floor`. **Timer duration**: 30 seconds as a spare. The length in the log line wins.
- **Timer Ending** tab: tick **Notify when ending**, set 10 seconds, tick **Speak phrase** and enter `floor in ten`.
- A **Screen Glow** action with **Trigger on phrase** empty: red, **Glow Flash** ticked.
- **Timer Ended** tab: tick **Enable ended notifications.**, click the plus button next to **Execute actions when ended.**, and pick the Screen Glow action.

**What fires**

A countdown named Floor starts at 2m 30s. At 10 seconds left Nag says "floor in ten". At zero the screen glows red.

`{TS}` reads "45 seconds", "30s", "1:30" and "2 minutes 30 seconds", so the one trigger covers every wording. It does not match a line with no number, such as "in soon". The Timer Ending options stay hidden until you set a duration above zero.

## AE warning in one zone only

*Raid, variables*

**Log line**

```
Lord Vexwick roars, 'Feel the storm!'
```

**Phrase** (turn on **RegEx**)

```
^Lord Vexwick roars, 'Feel the storm!'$
```

**Condition**

In the **Conditions** group on the **Capture** tab, click **New** and set:

- **Variable Name**: `CurrentZone`
- **Operator**: **Equals**
- **Value**: `Fizzlethorp Keep|Fizzlethorp Depths`

The `|` separates alternatives, and there are no spaces around it. Nag does not trim them. The condition passes in either zone.

**Settings**

- **Display Text** action: `AE! Spread out`.
- **Speak** action: `spread`.

**What fires**

In Fizzlethorp Keep or Fizzlethorp Depths, the overlay shows the warning and Nag speaks. In any other zone nothing happens, even if the line appears.

`CurrentZone` is set by Nag's built-in **Capture Zone** trigger from the line `You have entered <zone>.` and from your own non-anonymous `/who` line. Keep that trigger enabled. **Equals** is exact and case sensitive, so type the zone as the log writes it. Use **Contains** to match part of a name without caring about capitals. If any condition fails, the trigger does not run at all.

## Death counter

*Variables*

**Log line**

```
You have been slain by a cave lurker!
```

**Phrase** (turn on **RegEx**)

```
^You (?:have been slain by [^!]*!|died\.)$
```

This also matches "You died.". It does not match other players' deaths.

**Settings**

Add the actions in this order, because actions run from top to bottom.

1. **Counter** action, **Trigger on phrase** 1. **Counter name**: `Deaths`. **Reset the counter after**: 8 hours. On the **Counter Reset** tab, click **New** and add this phrase with **RegEx** on:

```
^(?:~ )?{C} resets the death count\.$
```

2. **Display Text** action, **Trigger on phrase** 1: `Death #+{Deaths}`.

**What fires**

The first death shows **Death #1**, the next **Death #2**, and so on. If you type `/em resets the death count.` in the game, the count goes back to zero.

{: .warning }
Set **Reset the counter after**. In 0.2.27 a counter with no reset time is cleared on the next log line, so it never counts past one. The reset phrase accepts `{C}` for your character's name but cannot capture new values with `{S1}`. It makes the `~ ` optional so it works on both live and emulator servers.

## DoT timer that ends when the mob dies

*Timers, sequential*

This is the shape Nag's own DoT generators use.

**Log lines**

```
A cave lurker is wracked by green venom.
A cave lurker has taken 150 damage from your Fizzlethorp's Venom.
A cave lurker was slain by Soandso!
```

**Settings**

- Trigger name: `Fizzlethorp's Venom`. Use the spell's real name. Nag uses it to notice the "worn off" message.
- **Capture Method**: **Sequential**.
- Phrase 1 (**RegEx** on). `target` is a named group, and DoT Timers need it:

```
^(?<target>.+?) is wracked by green venom\.$
```

- Phrase 2 (**RegEx** on). `?{target}` means "the same target that phrase 1 captured":

```
^?{target} has taken [0-9]+ damage from your Fizzlethorp's Venom\.
```

- **DoT Timer** action, **Trigger on phrase** 1. In the **Timer** tab, pick phrase 2 as the tick damage phrase. Set **Timer duration** to 1 minute (it shows "10 ticks"). Set **Restart behavior** to **Restart only if the name matches**.
- **End Early** tab: add these three phrases, each with **RegEx** on and the **i** button (Ignore Case) on:

```
^${target} (?:(?:has been|was) slain by [^!]*!|died\.)$
^You have slain ${target}!$
^You (?:have been slain by [^!]*!|died\.)$
```

**What fires**

The bar **Fizzlethorp's Venom --== A cave lurker ==--** counts down from 60 seconds from the cast, and restarts from the first tick of damage. When the cave lurker dies, by either "was slain by" or "has been slain by" wording, the bar disappears. A second mob gets its own bar.

- `${target}` in an End Early phrase is replaced by the text phrase 1 captured. End Early phrases cannot capture new text.
- The **i** button matters because the same mob is "A cave lurker" at the start of a line and "a cave lurker" in "You have slain a cave lurker!".
- Do not turn on **Cooldown** on a Sequential trigger. See [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }}).

## Two-step emote

*Raid, sequential*

**Log lines, in order**

```
Lord Vexwick raises his arms.
Lord Vexwick slams his fists into the ground.
```

**Settings**

- **Capture Method**: **Sequential**.
- Phrase 1 (**RegEx** on): `^Lord Vexwick raises his arms\.$`
- Phrase 2 (**RegEx** on): `^Lord Vexwick slams his fists into the ground\.$`
- In **Sequential Rules**, set **Restart Behavior** to **Restart on Phrase #1**.
- **Display Text** action, **Trigger on phrase** 1: `Vexwick is winding up`.
- **Display Text** action, **Trigger on phrase** 2: `Knockback now!`
- **Screen Glow** action, **Trigger on phrase** 2.

**What fires**

The first emote shows the small warning. The second emote shows the big one and the glow, but only if the first one came first. The second line on its own does nothing.

- **Restart on Phrase #1** drops an earlier unfinished sequence when phrase 1 repeats with the same text. With **None**, every phrase 1 match starts its own sequence, so three phrase 1 lines in a row make phrase 2 fire three times.
- Nag does not put a time limit on an open sequence.
- Text on phrase 2 can use `${deltaTime}`, the milliseconds since phrase 1.

## Low mana call-out

*Chat, number check*

**Log line**

```
Fizzlethorp tells the group, 'I have 12% mana left.'
```

**Phrase** (turn on **RegEx**)

```
^{S1} tells the group, 'I have {N<=20}% mana left\.'$
```

**Settings**

- **Display Text** action, **Trigger on phrase** 1: `{S1} is low: {N}%`.
- **Speak** action: `{S1} needs mana`.

**What fires**

At 12% the overlay shows **Fizzlethorp is low: 12%**. At 20% it still fires, because the check includes 20. At 45% nothing happens, because the line matches but the number check fails.

Use one number style per phrase: `{N>=x}` style (`>`, `>=`, `<`, `<=`, `=`, `!=`) or the range style `{N[a,b]}`.
