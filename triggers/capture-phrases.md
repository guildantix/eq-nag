---
title: Capture phrases
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 2
---

# Capture phrases

A capture phrase is the text Nag looks for in each log line. When a line matches, the actions linked to that phrase run. This page covers the **Phrases** group on the trigger editor's **Capture** tab.

If you are new to triggers, read [Triggers 101]({{ '/triggers/triggers-101' | relative_url }}) first.

## The Phrases group

Open a trigger, then stay on the **Capture** tab. The **Phrases** group has these parts:

| Part | What it does |
|---|---|
| **New** | Adds a phrase row. |
| **Capture Method** | How the phrases work together. See [Any match or Sequential](#any-match-or-sequential). |
| **Cooldown** | Pauses the trigger after it fires. See [Cooldown](#cooldown). |
| Up and down arrows | Move a phrase up or down. The **No.** column shows each phrase's position. |
| **Phrase** | The text to look for. |
| **RegEx** | Tick it to treat the phrase as a regular expression. |
| **Ops** | The **i** button turns **Ignore Case** on or off for that phrase. |
| Clear (X) button | Deletes the phrase after a confirmation. |

You can add as many phrases as you like. On the **Actions** tab, each action uses **Trigger on phrase** to pick which phrases make it run.

## Plain text or regex

Leave **RegEx** unticked for simple jobs. Tick it when you need to grab part of the line, accept several wordings, or anchor the phrase to the start or end of the line.

| | Plain text (RegEx unticked) | Regex (RegEx ticked) |
|---|---|---|
| Match rule | The log line contains the phrase | The pattern is found anywhere in the line, unless you anchor it with `^` and `$` |
| Upper and lower case | Always ignored | Matters, unless **Ignore Case** (the **i** button) is on |
| Snippets such as `{S1}`, `{N1}`, `{TS}` and `{C}` | Not expanded. They are searched for as ordinary text. | Expanded. See [Snippets and variables]({{ '/triggers/snippets' | relative_url }}). |
| Special characters such as `. ( ) [ ] ? *` | Ordinary characters | Have special meanings. See [Regex for Nag]({{ '/triggers/regex' | relative_url }}). |

For example, the plain-text phrase `tells you` fires on every tell. The regex phrase `^{S1} tells you, '{S2}'$` fires on a tell and hands you the sender and the message.

{: .warning }
Snippets only work with **RegEx** ticked. If you type `{S1}` in a plain-text phrase, Nag looks for the letters `{S1}` in the log line and never finds them.

{: .note }
Nag matches against the log line without its `[timestamp]`. In a regex phrase, `^` is the very start of the message.

## Any match or Sequential

**Capture Method** has three entries.

| Capture Method | What it does |
|---|---|
| **Any match** | Every phrase is checked against every new log line. Each phrase that matches runs the actions linked to it. |
| **Sequential** | The phrases must match in order, on separate log lines. Phrase 2 is only checked after phrase 1 has matched, phrase 3 after phrase 2, and so on. Each phrase runs its own linked actions when it matches. |
| **Concurrent** | Greyed out in the app. It is not available. |

Use **Sequential** for two-step events, such as an emote followed by a shout. When you pick it, a **Sequential Rules** group appears with a **Restart Behavior** list:

| Restart Behavior | What the app says |
|---|---|
| **None** | Always begin a new sequence. |
| **Restart on Phrase #1** | Restart the sequence when phrase #1 matches exactly. |
| **Restart on any Phrase after #1** | Restart the sequence when any phrase after the first matches exactly. |

In the text of an action on a Sequential trigger you can use `${deltaTime}`, which is how many milliseconds passed since the previous phrase matched. It works in text only, never inside a phrase. In a later phrase you can use `?{Name}`, which repeats a named group from an earlier phrase. See [Snippets and variables]({{ '/triggers/snippets' | relative_url }}).

## Cooldown

Tick **Cooldown** and set a duration to stop a trigger from firing again too soon. After any of its phrases matches, the trigger ignores every log line until the duration has passed. During the cooldown Nag does not even run the phrases.

This is useful for abilities that hit many people at once. If every hit writes a log line, a one-second cooldown means only the first hit starts your timer. Click the **?** next to **Cooldown** in the app for the same explanation.

{: .note }
The cooldown belongs to the whole trigger, not to one phrase. While it runs, none of the trigger's phrases are checked.

{: .warning }
Do not turn on **Cooldown** for a **Sequential** trigger unless you mean it. While a cooldown is running, a new log line resets the sequence in progress, so a later phrase that arrives inside the cooldown cannot finish the sequence.

## Ignore case

Each phrase has its own **i** button in the **Ops** column. Hover it to see **Ignore Case**.

- New phrases start with Ignore Case on.
- It only changes a regex phrase. A plain-text phrase always ignores case.
- It is the JavaScript `i` flag, the only regex flag Nag uses. When it is off, `you` does not match `You`.
- Ignore Case does not apply to a stored `${Variable}` match. The captured text must equal the stored value exactly.

## The Regex Visualizer

When a phrase has **RegEx** ticked, a **Regex Visualizer** toggle appears under the phrase box, on the right, across from the **Capture Phrase** hint. Click it to show a colored copy of your phrase under the box. Click it again to close it.

The colors tell you what each part of the phrase does:

<table>
  <thead><tr><th>Color</th><th>Part of the phrase</th></tr></thead>
  <tbody>
    <tr><td><span class="rx-sample" style="color: #9aa3a8;">Gray</span></td><td>Plain text that must appear as typed</td></tr>
    <tr><td><span class="rx-sample" style="color: #ffd166;">Gold</span></td><td>Anchors <code>^</code> and <code>$</code>, the dot <code>.</code>, and the brackets of every group</td></tr>
    <tr><td><span class="rx-sample" style="color: #f1a500;">Orange</span></td><td>Quantifiers such as <code>+</code>, <code>*</code>, <code>?</code> and <code>{2}</code></td></tr>
    <tr><td><span class="rx-sample" style="color: #e73ce4;">Magenta</span></td><td>The <code>|</code> that separates choices, and escapes such as <code>\.</code></td></tr>
    <tr><td><span class="rx-sample" style="color: #c3a2fd;">Purple</span></td><td>Shorthands such as <code>\d</code> and <code>\s</code></td></tr>
    <tr><td><span class="rx-sample" style="color: #69cc67;">Green</span></td><td>Character classes such as <code>[a-z]</code></td></tr>
    <tr><td><span class="rx-sample" style="color: #58a6ff;">Blue</span></td><td>Variables such as <code>${SpellBeingCast}</code></td></tr>
    <tr><td><span class="rx-sample" style="color: #ff0026;">Red</span></td><td>A mistake, such as an unclosed <code>(</code> or a quantifier with nothing before it</td></tr>
  </tbody>
</table>

Those are the dark-theme colors the app uses. The tester on [Regex for Nag]({{ '/triggers/regex' | relative_url }}) uses the same colors, with darker versions on the light theme.

- The Visualizer opens for one phrase at a time.
- Plain-text phrases have nothing to color, so the toggle only shows when **RegEx** is ticked.
- It shows all groups in gold. The tester on [Regex for Nag]({{ '/triggers/regex' | relative_url }}) gives each capture its own color, so you can follow it through the line.
- It colors the phrase. It does not test the phrase against a log line. For that, use the tester or run the trigger.

## Where to go next

- [Regex for Nag]({{ '/triggers/regex' | relative_url }}) teaches the regex symbols you need, one step at a time.
- [Snippets and variables]({{ '/triggers/snippets' | relative_url }}) lists every code you can use in a phrase and in text.
- [Conditions and variables]({{ '/triggers/conditions' | relative_url }}) covers the checks that run before the phrases do.
