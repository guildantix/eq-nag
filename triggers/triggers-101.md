---
title: Triggers 101
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 1
---

# Triggers 101

A trigger is a rule: **when this line shows up in my log, do these things.** Every trigger has three parts: conditions, capture phrases and actions.

## What happens to each log line

EverQuest writes one line to your log for everything that happens. Nag reads each new line and runs it through every enabled trigger, in the same order every time.

<ol class="nag-flow" aria-label="The path of a log line: log line, conditions, capture phrases, actions, overlays and audio">
  <li>
    <div class="nag-where">EverQuest writes</div>
    <h4>Log line</h4>
    <div class="nag-mono">[Sun Nov 01 21:04:11 2026] Fizzlethorp tells you, 'pull in 30s'</div>
    <p>Nag drops the <code>[timestamp]</code> first.</p>
  </li>
  <li class="nag-gate">
    <div class="nag-where">Capture tab, Character Classes tab</div>
    <h4>Conditions</h4>
    <p>Is the trigger on for this character? Do the class, cooldown and variable checks pass? If not, stop here.</p>
  </li>
  <li class="nag-cap">
    <div class="nag-where">Capture tab, Phrases</div>
    <h4>Capture phrases</h4>
    <p>Does the line match? If it does, pull out the values:</p>
    <p>{% include chip.html k="cap" n="1" g="Aa" t="{S1}" %} = Fizzlethorp<br>{% include chip.html k="cap" n="2" g="&#9201;" t="{TS}" %} = 30s</p>
  </li>
  <li class="nag-act">
    <div class="nag-where">Actions tab</div>
    <h4>Actions</h4>
    <p>Run each action that is linked to the phrase that matched: Display Text, Countdown, Speak and so on.</p>
  </li>
  <li>
    <div class="nag-where">You see and hear</div>
    <h4>Overlays and audio</h4>
    <p>Text on an overlay, a timer bar, a spoken phrase or a sound.</p>
  </li>
</ol>

{: .note }
Nag checks every enabled trigger against every new line. One line can fire several triggers. A trigger whose capture method is **Any match** also fires once for each of its phrases that matches.

## The three parts

| Part | Where you edit it | Question it answers | Read more |
|---|---|---|---|
| Conditions | **Capture** tab, **Conditions** group. **Character Classes** tab. Right-click a trigger folder and choose **Folder Conditions**. | Should this trigger listen right now? | [Conditions and variables]({{ '/triggers/conditions' | relative_url }}) |
| Capture phrases | **Capture** tab, **Phrases** group | Is this the line I care about, and what is in it? | [Capture phrases]({{ '/triggers/capture-phrases' | relative_url }}), [Regex for Nag]({{ '/triggers/regex' | relative_url }}) |
| Actions | **Actions** tab. Click **New**, pick an **Action Type**, then pick the phrases in **Trigger on phrase**. | What should happen? | [Advanced Trigger Mechanics]({{ '/guides/advanced-triggers' | relative_url }}) |

Each action only runs for the phrases you picked in **Trigger on phrase**. That is how one trigger can show a warning for one phrase and start a timer for another.

## Words used on every trigger page

The same words are used in these pages, in the Regex Visualizer in the app and in the tester on [Regex for Nag]({{ '/triggers/regex' | relative_url }}).

| Term | Looks like | Meaning |
|---|---|---|
| **Capture** (slot) | {% include chip.html k="cap" n="1" g="Aa" t="{S1}" %} {% include chip.html k="cap" n="2" g="#" t="{N1}" %} {% include chip.html k="cap" n="3" g="&#9201;" t="{TS}" %} {% include chip.html k="cap" n="4" g="&#9873;" t="(?<Target>...)" %} | A part of the log line that changes, which Nag grabs. Round chip. |
| **Value** (insert) | {% include chip.html k="val" g="@" t="{C}" %} {% include chip.html k="val" g="$" t="${SpellBeingCast}" %} {% include chip.html k="val" g="+" t="+{Deaths}" %} | Something Nag already knows and fills in: your character name, a stored variable, a counter. Square chip, blue. |
| **Output only** | {% include chip.html k="out" g="&para;" t="{L}" %} | Only works in text you display or speak. Never put it in a phrase. |
| **Phrase** | <code>^{S1} tells you, '{S2}'$</code> | The pattern a log line is tested against. |
| **Rendered text** | Tell from Fizzlethorp | Text after Nag has replaced the chips with real values. |
| **Slot number** | 1, 2, 3 | The order of the captures from left to right. Also the color used on these pages. |

## Where to go next

- [Capture phrases]({{ '/triggers/capture-phrases' | relative_url }}): plain text or regex, capture methods, cooldown and the Regex Visualizer.
- [Regex for Nag]({{ '/triggers/regex' | relative_url }}): the few regex symbols you need, with a tester you can type into.
- [Snippets and variables]({{ '/triggers/snippets' | relative_url }}): every `{S1}`, `{N1}`, `{TS}` and `${Variable}` code.
- [Conditions and variables]({{ '/triggers/conditions' | relative_url }}): make a trigger listen only in the right zone, class or moment.
