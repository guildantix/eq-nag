---
title: Snippets and variables
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 5
---

# Snippets and variables

Snippets are short codes in curly braces, such as `{S1}` and `{TS}`. In a **capture phrase** they grab part of the log line. In **text** (Display Text, timer names, Speak and so on) they are replaced with what was grabbed.

This page has one entry for each snippet. Try any of them in the tester on [Regex for Nag]({{ '/triggers/regex' | relative_url }}).

| Snippet | Kind | In a regex phrase | In text |
|---|---|---|---|
| [{% include chip.html k="val" g="@" t="{C}" %}](#snip-c) | Value | Your character name | Your character name |
| [{% include chip.html k="cap" n="1" g="Aa" t="{S1}" %}](#snip-s) | Capture | Grabs text | The grabbed text |
| [{% include chip.html k="cap" n="2" g="#" t="{N1}" %}](#snip-n) | Capture | Grabs a whole number, with optional checks | The number |
| [{% include chip.html k="cap" n="3" g="&#9201;" t="{TS}" %}](#snip-ts) | Capture | Grabs a duration | The duration, such as `2m 30s` |
| [{% include chip.html k="out" g="&para;" t="{L}" %}](#snip-l) | Output only | Not for phrases | The text the phrase matched |
| [{% include chip.html k="cap" n="1" g="Aa" t="{LN}" %}](#snip-ln) | Capture | Matches a name in a List action | Not for text |
| [{% include chip.html k="val" g="+" t="+{Counter}" %}](#snip-counter) | Value | Not for phrases | A counter's current value |
| [{% include chip.html k="val" g="$" t="${Variable}" %}](#snip-var) | Value or capture | A stored variable's values | A stored variable, else a named group |
| [`{1}` `#{1}` `${1}`](#snip-index) | Capture | Not for phrases | A numbered group |

## Which text fields accept snippets

Snippets in text work in **Display Text**, in the name of a **Timer**, **Countdown** or **Stopwatch**, in **Speak**, in **Clipboard**, and in the Ending and Ended text, speak and clipboard fields of a timer. The names of DoT Timers and Beneficial Timers are built by Nag from the trigger name or spell name and the target, so they take no snippets. End Early phrases also accept snippets, with a difference: Nag fills in the values from the match that started the timer and then builds the phrase from the result. A plain-text phrase is searched as text. A phrase with **RegEx** ticked stays a regex, with the values inserted as typed. Codes such as `{S1}` are replaced by the captured text, not expanded into capture groups.

Snippets in phrases only work when **RegEx** is ticked. A plain-text phrase is searched for exactly as typed.

## {C}: your character {#snip-c}

{% include chip.html k="val" g="@" t="{C}" %} Also written `${Character}`.

- **What it is:** The name of the character whose log Nag is reading.
- **Where you can use it:** regex phrases and every text field. Not plain-text phrases.
- **What it becomes:** In a phrase, your name as fixed text, such as `Soandso`. In text, the same name.

```
Log line   ~ Soandso wonders how they died.
Phrase     ^(?:~ )?{C} wonders how they died\.$
Text       {C}, here is your Death Recap
Shown      Soandso, here is your Death Recap
```

{: .nag-doesnot }
**Does not** match other players' names. To match any name, use `{S1}`.

## {S} and {S1}, {S2}...: text {#snip-s}

{% include chip.html k="cap" n="1" g="Aa" t="{S1}" %} The number is optional. You can use as many as you like, numbered from 1.

- **What it is:** Grabs any text: a name, a spell, a zone, a whole message.
- **Where you can use it:** regex phrases to capture, and every text field to show what was captured.
- **What it becomes:** `(?<S1>.+?)`, a named group that takes as little text as it can.

```
Log line   Fizzlethorp tells you, 'need a port to the Nexus'
Phrase     ^{S1} tells you, '{S2}'$
Captured   {S1} = Fizzlethorp, {S2} = need a port to the Nexus
Text       {S1}: {S2}
Shown      Fizzlethorp: need a port to the Nexus
```

{: .nag-doesnot }
**Does not** know where to stop on its own. It takes as little as possible, so follow it with fixed text. At the very end of a phrase it captures a single character. Using the same number twice in one phrase, such as `{S1}` and `{S1}`, is an error and the trigger never fires.

## {N} and {N1}, {N2}...: numbers {#snip-n}

{% include chip.html k="cap" n="2" g="#" t="{N1}" %} The number is optional.

- **What it is:** Grabs a whole number, all of its digits.
- **Where you can use it:** regex phrases to capture, and every text field to show the number.
- **What it becomes:** `(?<N1>[0-9]+)`. With a check, `(?<N1>-?[0-9]+)`, so negative numbers are allowed.

### Number checks

Add a check inside the braces to fire only when the number passes it. A number that fails the check is the same as a line that does not match.

| Write | Fires when |
|---|---|
| `{N1>=1000}` | The number is 1000 or more. Also `>`, `<`, `<=`, `=` and `!=`. |
| `{N1[120,124]}` | The number is from 120 to 124, both ends included |
| `{N1(5,9)}` | The number is between 5 and 9, both ends left out |
| `{N1[1000,]}` | The number is 1000 or more. Leave a side empty for no limit. |

The `1` after `N` is optional, and the check works on that capture. Square brackets include the end number. Round brackets leave it out.

```
Log line   You crush a training dummy for 1234 points of damage.
Phrase     ^You crush {S1} for {N1>=1000} points of damage\.$
Text       Big hit: {N1}
Shown      Big hit: 1234
```

{: .nag-doesnot }
**Does not** match decimals or commas, such as `12.5` or `1,234`. Use one style of check per phrase, comparison (`>=`) or range (`[ ]`). If a phrase has a comparison check, Nag leaves any range check in it as plain text. A comparison check only takes whole, positive numbers. For a negative limit use a range, such as `{N1[-5,]}`.

## {TS}: duration {#snip-ts}

{% include chip.html k="cap" n="3" g="&#9201;" t="{TS}" %}

- **What it is:** Grabs a length of time from the log line.
- **Where you can use it:** regex phrases, once per phrase, and text fields to show the duration.
- **What it becomes:** a named group called `timerDuration` that understands the formats below.
- **What it starts:** The length of any **Timer** or **Countdown** that the phrase starts. Stopwatch, DoT Timer and Beneficial Timer do not read it.

`{TS}` understands these, with or without spaces:

| Written in the log | Means |
|---|---|
| `90` | 90 seconds. A plain number is seconds. |
| `5m`, `10 min`, `2.5 hours` | 5 minutes, 10 minutes, 2.5 hours |
| `1h30m`, `1 hour 30 minutes` | 1 hour 30 minutes |
| `28 minute(s) 1 seconds` | 28 minutes 1 second |
| `1:30` | 1 minute 30 seconds |
| `1:02:03` | 1 hour 2 minutes 3 seconds |

In text, `{TS}` shows hours, minutes and seconds, such as `1h 30m` or `2m 30s`.

```
Log line   Lord Vexwick shouts, 'The floor gives way in 2 minutes 30 seconds!'
Phrase     ^Lord Vexwick shouts, 'The floor gives way in {TS}!'$
Action     Countdown named "Floor in {TS}", length taken from {TS} = 150 seconds
Shown      Floor in 2m 30s
```

{: .nag-doesnot }
**Does not** start a timer from ordinary words such as "soon". Only the first `{TS}` in a phrase is expanded. In a **Display Text** action `{TS}` is the action's own **Duration** setting, not the captured time, because Display Text is not a timer.

## {L}: the matched log text {#snip-l}

{% include chip.html k="out" g="&para;" t="{L}" %} Output only.

- **What it is:** The text the phrase matched. For a plain-text phrase, or a regex that starts with `^` and ends with `$`, that is the whole line.
- **Where you can use it:** Display Text, Speak, Clipboard and the other text fields. Never in a phrase.

```
Log line   Fizzlethorp tells you, 'need a port'
Phrase     ^{S1} tells you, '{S2}'$
Text       Heard: {L}
Shown      Heard: Fizzlethorp tells you, 'need a port'
```

{: .nag-doesnot }
**Does not** include the `[timestamp]`. For an unanchored regex it only includes the part of the line that matched, not the rest.

## {LN} and {L1}: List action names {#snip-ln}

{% include chip.html k="cap" n="1" g="Aa" t="{LN}" %}

- **What it is:** Codes for the **List** action. `{LN}` matches the name of a member of the list. `{L1}`, `{L2}` and so on match the list member in that position.
- **Where you can use them:** regex phrases of a trigger that has a List action. The List action's phrases that activate, deactivate or time a name must contain `{LN}`.
- **What they become:** `{LN}` becomes a named capture `(?<nag_listname>.+?)`. `{L1}` becomes a capture that only counts when its text equals the first name in the list. If that name is your character, the log's "you" matches.

{: .nag-doesnot }
**Do not** work in plain-text phrases. Nag logs an error: "List action types are not supported in non-regex capture phrases." Without a List action in the trigger, `{L1}` is left as plain text.

## +{Counter}: a counter's value {#snip-counter}

{% include chip.html k="val" g="+" t="+{Deaths}" %}

- **What it is:** The current value of a **Counter** action, looked up by its **Counter name**. Names can contain spaces.
- **Where you can use it:** the text fields. Never in a phrase.
- **What it becomes:** The counter's number at the moment the text is made.

```
Text    Deaths tonight: +{Deaths}
Shown   Deaths tonight: 3
```

{: .nag-doesnot }
**Does not** change on its own. The Counter action adds 1 when its phrase matches. If no counter has that name, the text stays as you typed it.

## ${Variable}: a stored variable or a named group {#snip-var}

{% include chip.html k="val" g="$" t="${SpellBeingCast}" %}

A variable is a list of values kept by a **Store Variable** action. See [Conditions and variables]({{ '/triggers/conditions' | relative_url }}).

**In a regex phrase.** Nag replaces `${Variable}` with a capture that takes any text, then checks whether the text it captured is one of the variable's stored values. If it is, the phrase matches and the value is also available as a named group called `Variable`.

```
Log line   Your Boil Blood spell is interrupted.
Phrase     ^Your ${SpellBeingCast} spell is interrupted\.$
Stored     SpellBeingCast = Boil Blood
Result     Fires. ${SpellBeingCast} is now a named group holding "Boil Blood".
```

**In text.** Nag looks, in this order, for a stored variable with that name, then (everywhere except Display Text) a value that passed one of the trigger's variable conditions, then a named group of the phrase. The first one found wins. If several values are stored, they are joined with commas and no space.

Variables Nag keeps for you: `${Character}` is your character name, `${CurrentZone}` comes from the Capture Zone trigger and `${SpellBeingCast}` comes from the Capture spell casting trigger. Those two triggers ship with Nag.

`${deltaTime}` is a special value for text, such as Display Text, in **Sequential** triggers: the milliseconds since the previous phrase in the sequence matched. It is 0 on the first phrase. It is text-only. Inside a regex phrase Nag treats it as a stored variable named `deltaTime`, which never has a value, so the phrase never matches.

{: .nag-doesnot }
**Does not** work for more than one variable in a phrase. Nag only expands the first `${...}` it finds, and the second stays as plain text and never matches. Using the same `${Variable}` twice in one phrase is an error (duplicate group), and the trigger never fires. The match is exact and case-sensitive, even with **Ignore Case** on, and a variable with no stored value can never match. If a stored variable and a named group share a name, text shows the stored variable. Use a regex phrase when you need a stored variable in a phrase. Plain-text phrases do not handle stored values reliably.

## {1}, #{1} and ${1}: numbered groups {#snip-index}

`{1}` `#{1}` `${1}`

- **What it is:** The text of capturing group number 1, 2 and so on, counted from the left. All three spellings do the same job. The extra spellings help with phrases imported from GINA.
- **Where you can use it:** text fields. Never in a phrase.

```
Log line   a cave lurker was slain by Soandso!
Phrase     ^(.+?) (?:has been|was) slain by {S1}!$
Text       {1} died to {S1}
Shown      a cave lurker died to Soandso
```

{: .nag-doesnot }
**Does not** count `(?:...)` groups. Snippets such as `{S1}` and `{N1}` do count as groups, so mixing them with plain `( )` groups changes the numbers. Named groups are safer.

## ?{Name}: repeat an earlier match {#snip-seq}

`?{Name}`

- **What it is:** In a later phrase of a **Sequential** trigger, matches the same text that a named group called `Name` captured in an earlier phrase.
- **Where you can use it:** regex phrases of a Sequential trigger.

{: .nag-doesnot }
**Does not** work in an **Any match** trigger. Nag only expands it in Sequential triggers.
