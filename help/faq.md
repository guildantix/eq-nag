---
title: FAQ
parent: "Troubleshooting & FAQ"
nav_order: 1
---

# FAQ

Click a question to open the answer.

## Installing

<details id="windows-warning-faq" markdown="1">
<summary>Windows says "Windows protected your PC" when I install</summary>

The installer is no longer code-signed, so Windows does not know the publisher. Click **More info**, then **Run anyway**. Only the first install shows this. Updates install as usual. See [Install Nag]({{ '/get-started/install' | relative_url }}#windows-warning).
</details>

<details id="setup-stuck" markdown="1">
<summary>The Setup window is stuck and its buttons do nothing</summary>

This was a bug in Nag 0.2.23 to 0.2.26. It could happen on a new install, or after Nag's settings files were lost or damaged. Version 0.2.27 fixes it. Update Nag and it repairs itself.
</details>

<details id="resolution" markdown="1">
<summary>"Your resolution has changed!" keeps appearing</summary>

Since 0.2.27 the message closes by itself when your screens are back to normal, for example after your monitors turn off overnight. It no longer shows on a new profile. If your screens really did change, see [Arrange your overlays]({{ '/guides/arrange-overlays' | relative_url }}).
</details>

## Triggers and timers

<details id="not-firing" markdown="1">
<summary>My trigger does not fire</summary>

Check these, in order:

1. Is logging on? Type `/log on` in EverQuest.
2. Is the trigger turned on? A check mark shows in the **Triggers** list. Turning a folder off turns off every trigger inside it, so look for a crossed box.
3. Is the right character picked, and does the trigger's **Character Classes** tab include your class?
4. Does the phrase match? Paste a line into **Simulate Log** to test. New phrases ignore capital letters. The small **i** button next to the phrase is lit when that is on. If a phrase was imported, check that **i** is lit.
5. Is **Cooldown** on? It blocks repeats for the time you set.
6. Did you pick **Trigger on phrase** on each action?

See [Get your first alert]({{ '/get-started/first-trigger' | relative_url }}) and the [Documentation]({{ '/documentation/' | relative_url }}).
</details>

<details id="emote-prefix" markdown="1">
<summary>My emote triggers stopped working on live servers</summary>

In October 2026, EverQuest changed how emotes look in the log on live servers. Nag 0.2.27 fixes the built-in **Clear All** and **Death Recap** triggers for you. They keep working on servers such as Project 1999 and TAKP too.

If you wrote your own trigger that reacts to an emote, it may need a small change. The [Documentation]({{ '/documentation/' | relative_url }}) shows the exact fix.
</details>

<details id="timer-slain" markdown="1">
<summary>My DoT or buff timer does not end when the mob dies</summary>

Live servers now word the death message differently. Nag 0.2.27 understands both wordings. New timers are right from the start. Older ones are fixed for you, unless you changed their **End Early** phrases yourself. If you did, see the [Documentation]({{ '/documentation/' | relative_url }}) for the fix.
</details>

<details id="timer-length" markdown="1">
<summary>My timer has the wrong length</summary>

Before 0.2.27, Nag sometimes misread times written in words. "10 minutes" became a 10-second timer, for example. Nag now reads times like "5m", "10 min", "1h30m" and "1:30" correctly. Update Nag.
</details>

<details id="allakhazam" markdown="1">
<summary>The Allakhazam option is gone</summary>

It was removed in 0.2.27 because Allakhazam does not allow automated access. Use **Auto Generation**, then **EQ Spell Resources**. For an old timer, see [Re-import a timer from EQ Spell Resources]({{ '/guides/reimport-allakhazam' | relative_url }}).
</details>

## Characters and sounds

<details id="logging" markdown="1">
<summary>Nag does nothing at all</summary>

Nag reads the log file EverQuest writes. Turn logging on with `/log on` in the game, once for each character. Then check that the character is in the **Characters** tab. See [Add your character]({{ '/get-started/first-character' | relative_url }}).
</details>

<details id="thj" markdown="1">
<summary>My Heroes' Journey character is not found</summary>

Detection of The Heroes' Journey characters was fixed in 0.2.27. In **New Character**, a character from that service shows **THJ** as its **Service**.
</details>

<details id="sound-formats" markdown="1">
<summary>Which sound files can I use?</summary>

`.mp3`, `.ogg`, `.m4a`, `.opus`, `.webm` and `.aac`. The extra formats arrived in 0.2.27.
</details>

<details id="dps-takp" markdown="1">
<summary>My spell damage is missing or credited to the wrong name in the DPS meter</summary>

On Project Quarm and TAKP servers, spell damage is logged in a different form from live servers. Nag read some of those lines wrongly. Spell damage you cast is now credited to you, and other players' spell damage is credited to them, or to the pet's owner. Chat lines that quote combat text no longer count as damage. Update Nag.
</details>

<details id="dot-bar-wait" markdown="1">
<summary>My DoT timer shows "(??)" or waits before it starts</summary>

Nag now starts a DoT timer when the spell is cast. If you chose a first damage phrase, the bar restarts from the moment of the first damage line. If that line never comes, for example because the spell was resisted, the bar still counts down and ends. See [Timers in depth]({{ '/triggers/timers' | relative_url }}#dot-timer).
</details>

<details id="console-filter" markdown="1">
<summary>The Console search box or character list does nothing</summary>

This was a bug. Typing in the search box, or picking a character, now filters the Console. The character list filters trigger matches only. Messages from Nag itself always show. See [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }}#read-the-console).
</details>

<details id="zone-who" markdown="1">
<summary>My zone trigger does not work in an instance</summary>

Nag also reads your zone from your own `/who` line, and `/who` can add an instance number, such as "Chardok 19". A condition set to **Equals** "Chardok" does not match that. Use **Contains** with the base zone name. See [Conditions and variables]({{ '/triggers/conditions' | relative_url }}#zone-conditions).
</details>

## Your data

<details id="data-folder" markdown="1">
<summary>Where does Nag keep my settings and triggers?</summary>

In a folder called `electron-angular-eq-parse` inside your Windows `AppData\Roaming` folder. Type `%APPDATA%` in the Windows File Explorer address bar and press **Enter** to get there. Close Nag before you copy anything. Do not edit these files by hand.
</details>

<details id="could-not-read" markdown="1">
<summary>Nag says "Nag could not read its data" and closes</summary>

Nag could not open one of its settings files. It names the file in the message. Nag closes on purpose, so it does not replace your triggers and settings with empty ones.

1. Check that the named file is not locked. Antivirus programs and cloud sync tools sometimes lock files.
2. Start Nag again.

If a file is damaged, Nag renames it to a name ending in `.corrupt-` and a time, keeps it, and starts with fresh settings for that file. Your damaged copy stays in the same folder, so you can ask for help in the [Discord](https://discord.gg/e3Z8PR8EXE) before you delete anything.

Saves are also crash-safe now. Nag writes a new copy and swaps it in, so a crash or power loss while saving no longer cuts a settings file short.
</details>

<details id="help-link" markdown="1">
<summary>Where do I find these guides from inside Nag?</summary>

Open the **Settings** tab. The **Help & guides** row at the top has an **Open the guides** link. It opens this site in your browser.
</details>

<script>
  ( function () {
    function openTarget() {
      var id;
      try {
        id = decodeURIComponent( window.location.hash.slice( 1 ) );
      } catch ( error ) {
        return;
      }
      var el = id ? document.getElementById( id ) : null;
      if ( el && el.tagName === 'DETAILS' ) {
        el.open = true;
      }
    }
    window.addEventListener( 'hashchange', openTarget );
    openTarget();
  } )();
</script>
