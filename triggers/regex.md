---
title: Regex for Nag
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 3
---

# Regex for Nag

A regular expression, or "regex", is a phrase with wildcards. You only need about ten symbols to write almost every EverQuest trigger. This page teaches them one step at a time, with made-up log lines. Type into the tester as you go.

A **capture** is a part of the line that changes, which Nag grabs for you. Most of the symbols below exist to describe what a capture looks like.

{% include regex-tester.html preset="tell" %}

Pick an example above, then change the log line, the phrase or the text and watch what changes. Each capture gets a color. The same color marks the chip in the phrase, the words it grabbed in the log line and the row in the table.

## Check your phrase in the app

On the **Capture** tab, tick **RegEx** on a phrase and click **Regex Visualizer** under the phrase box. Nag shows a colored copy of the phrase. Mistakes such as an unclosed `(` show in red. See [Capture phrases]({{ '/triggers/capture-phrases' | relative_url }}#the-regex-visualizer) for what each color means.

## Step 0: you may not need regex

With **RegEx** unticked, a phrase matches when the log line **contains** it, ignoring upper and lower case. The phrase `tells you` fires on every tell. That is often enough.

Use regex when you need to grab values, accept more than one wording, or anchor the phrase to the start or end of the line. The rest of this page is for those jobs.

## Step 1: anchors `^` and `$`

`^` means "the start of the line" and `$` means "the end of the line". Nag removes the `[timestamp]` first, so `^` sits right before the text.

Without anchors, a phrase fires when its text appears anywhere. Load the **No anchor** example: `You have been slain` fires on a chat line where someone typed those words. Put `^` in front and it only fires when the line starts with them.

## Step 2: escape the special characters

These characters mean something in regex: `. ( ) [ ] { } ? * + | ^ $ \`

To match one of them as plain text, put a backslash `\` in front of it.

| Log text | Write | Why |
|---|---|---|
| `damage.` | `damage\.` | A bare `.` matches any character |
| `Shield (Rk. II)` | `Shield \(Rk\. II\)` | A bare `(` starts a group |
| `[Ancient]` | `\[Ancient\]` | A bare `[` starts a character class, a list of allowed characters such as `[0-9]` |
| `{S1}` as plain text | `\{S1\}` | `{S1}` is a Nag snippet |

The full stop at the end of most EverQuest lines is the classic one: `\.$`. Load the **Broken (** example to see what an unescaped bracket does. The tester shows an error, and in Nag the trigger never fires.

## Step 3: wildcards and numbers

| Write | Matches | Nag snippet |
|---|---|---|
| `.+?` | Any text, as little as possible | {% include chip.html k="cap" n="1" g="Aa" t="{S1}" %} is `(?<S1>.+?)` |
| `[0-9]+` or `\d+` | One or more digits | {% include chip.html k="cap" n="2" g="#" t="{N1}" %} is `(?<N1>[0-9]+)` |
| `\s` | A space or a tab | none |
| `\w+` | One word: letters, digits and `_` | none |

A snippet is a ready-made piece of regex. `{S1}` grabs text and gives it the name `S1`, so you can write `{S1}` in your Display Text, the text Nag shows on screen. Number them from 1 and use each number once per phrase. Step 6 explains names.

### Lazy versus greedy: `.+?` and `.+`

`.+` grabs as **much** as it can. `.+?` grabs as **little** as it can. Both are fine when fixed text follows them, because the fixed text tells them where to stop.

If nothing follows, the lazy `.+?` takes a single letter. Load the **Lazy trap** example. `{S2}` is at the very end of the phrase, so it captures one character. Add the closing `'` and the `$` after it and it captures the whole message.

## Step 4: one of several wordings

A vertical bar `|` means "or". Wrap the choices in `(?:` and `)`:

```
^(.+?) (?:has been|was) slain by {S1}!$
```

That matches both "a cave lurker has been slain by Soandso!" and "a cave lurker was slain by Soandso!". Live and emulator servers word some lines differently, so this comes up often. Load the **Slain (a|b)** example.

`(?:` groups without capturing, so it does not use up a number. A plain `(` captures. Captured plain groups are numbered from the left and can be used in text as `{1}`, `{2}` and so on. In that example `(.+?)` is group 1 and `{S1}` is group 2.

## Step 5: optional parts

A `?` after a character or group makes it optional. `(?:~ )?` means "a tilde and a space, if they are there".

{: .warning }
EverQuest's October 2026 patch puts `~ ` in front of the player's name on `/emote` lines. To keep an emote trigger working on live and emulator servers, add `(?:~ )?` right after the `^`, as in `^(?:~ )?{C} wonders how they died\.$`. Load the **Emote ~** example. Plain-text phrases are not affected, because they only need to be contained in the line.

## Step 6: named groups

You can name a capture yourself with `(?<Name>...)` and use it in text as `${Name}`. Load the **Named group** example.

```
^You begin casting (?<Spell>.+)\.$
```

Text: `Casting ${Spell}`.

Names matter for variables. When a Clear Variable action runs from a phrase that has a group named like the variable, only that one value is cleared. See [Conditions and variables]({{ '/triggers/conditions' | relative_url }}#clear-variable-and-its-three-rules).

## The symbols in one place

- `^` and `$`: start and end of the line.
- `\` : "treat the next character as plain text", as in `\.` and `\(`.
- `.+?`: any text, as little as possible. Nag's snippet `{S1}` is a ready-made version of it.
- `[0-9]+`: a whole number. Nag's snippet `{N1}` is a ready-made version of it.
- `(?:a|b)`: either `a` or `b`, without using up a number.
- `?` after something: that thing is optional.
- `( )`: capture what is inside. Numbered from the left.
- `(?<Name>...)`: capture what is inside and call it `Name`.

## Performance tips

Nag checks every enabled trigger's regex against every new log line, so a slow pattern costs you on every line.

- Start with `^` and some fixed text. The line can then be ruled out at its first characters.
- Avoid starting with `.*` or `.+`. Nag then has to try matching from every position in the line.
- Put `{S1}` between fixed words, as in `^{S1} tells you, '{S2}'$`, so it knows where to stop.
- Avoid repeating a repeat, such as `(.+)+` or `(a*)*`. These can make a single line take a very long time. A badly nested pattern like `(a+)+` can freeze this tester while you type, and it can slow Nag down the same way.
- If you do not need to grab anything, use a plain-text phrase.
- Merge near-identical triggers with `(?:a|b)` instead of keeping ten copies.
- For lines that arrive in bursts, turn on **Cooldown**. While it runs, Nag does not run the trigger's phrases at all.

## Common mistakes

| Symptom | Likely cause | Fix |
|---|---|---|
| Never fires | **RegEx** is not ticked, so `{S1}` is searched for as plain text | Tick **RegEx** |
| Never fires | A typo in the fixed text, or an unescaped `(` or `.` | Open the Regex Visualizer. Red marks the problem. |
| Never fires, and the tester shows an error | The phrase is not a valid regex, for example an unclosed `(`, or `{S1}` used twice | Fix the phrase. Nag logs a parse error and the trigger does not fire until you do. |
| Fires on chat spam | No `^` anchor | Anchor the phrase at the start |
| `{S2}` shows one letter | A lazy capture at the very end of the phrase | End with the fixed text that follows it, then `$` |
| Stopped working in October 2026 | An emote now starts with `~ ` | Add `(?:~ )?` after the `^` |
| "You" does not match "you" | Regex is case-sensitive | Turn on **Ignore Case** with the **i** button in the **Ops** column |
| Starts with `^[` and never fires | Nag removes the `[timestamp]` before matching | Start the phrase at the text after the timestamp |
| `{N1}` ignores a number such as `1,234` or `12.5` | `{N1}` only matches whole digits | Use a regex of your own, such as `[0-9,.]+` |

## Same engine as Nag

{: .note }
Nag runs inside Electron and builds phrases with JavaScript's `RegExp`, so this tester and Nag agree on what matches. The only differences come from Nag's own additions: snippets like `{S1}` and `{TS}`, `${Variable}` checked against stored values, and number checks like `{N1>=1000}`. The tester expands those the same way Nag does. If you test elsewhere, pick the JavaScript (ECMAScript) flavor.

## Where to go next

- [Snippets and variables]({{ '/triggers/snippets' | relative_url }}) explains every code in curly braces.
- [Capture phrases]({{ '/triggers/capture-phrases' | relative_url }}) covers capture methods, cooldown and the Regex Visualizer.
- [Conditions and variables]({{ '/triggers/conditions' | relative_url }}) covers stored variables and when a trigger listens.
