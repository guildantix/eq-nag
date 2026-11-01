---
title: Trigger hotkeys
parent: "Triggers & Regex"
grand_parent: Documentation
nav_order: 22
---

# Trigger hotkeys

A trigger hotkey is a short set of EverQuest commands saved with the trigger. It lets you press one button in the game to do the thing the trigger listens for. A trigger that reacts to `/em starts the pull timer.` can come with a hotkey that types that emote for you.

Hotkeys are saved inside the trigger. When a trigger goes into a trigger package, its hotkeys go with it, with **Quick Action** switched off.

## Add a hotkey to a trigger

1. Open the trigger and stay on the **Capture** tab.
2. In the **Hotkeys** group, click **New**.
3. In the **Edit Trigger Hotkey** window, fill in the settings below.
4. Click **OK**.

| Setting | Description |
|---|---|
| **Name** | Required. The name of the hotkey button. |
| **Description** | Required. A note for you and for anyone you share the trigger with. |
| Lines **1** to **5** | The commands. Enter up to 5 lines. At least one line must have text. |
| **Command** | Turns the hotkey into a single line. Only line 1 is used. |

If a required box is empty, Nag lists what is missing and does not close the window.

Each hotkey shows in the **Hotkeys** table with its **Name** and **Description**. Use the **Edit this hotkey** button to change it, or the delete button on the right to remove it. Nag asks you to confirm before it deletes.

## Use the hotkey in the game

1. In the **Hotkeys** table, click **Generate EQ Hotkey** (the menu icon).
2. Nag shows the lines you can paste into EverQuest. The first line starts with `/hot "Name"`, which is the command that creates the hotkey.
3. Click the copy button next to line 1. Nag says "Line copied to clipboard."
4. In EverQuest, paste into the chat window and press Enter.
5. Place the new hotkey on a hotbar. The other lines are listed below line 1, each with its own copy button.

## Interpolation: ask for a value each time

Put a name between double braces in any line to have Nag ask you for the value when you generate the hotkey:

{% raw %}
```
/rsay Pull in {{Seconds}} seconds.
```
{% endraw %}

When you click **Generate EQ Hotkey**, Nag opens a box titled **Seconds** that says "Enter a value for Seconds". Whatever you type replaces the braces and the name.

- Use short, descriptive names. They are the only prompt you get.
- Nag remembers your last answer for each name on that hotkey, until Nag closes, and offers it again.
- Leaving a box empty cancels. Nothing is generated. The next time you use the hotkey, that box may be filled in with `n/a`; replace it with the real value.
- A name that appears twice makes Nag ask twice, and only the first copy in each line is replaced. Use each name once per line.

## Command and Quick Action

Tick **Command** for a single line that you want to use as a **Quick Action**. A Quick Action copies the line as it is, without the `/hot "Name"` part that creates an EverQuest hotkey. **Generate EQ Hotkey** still adds `/hot "Name"` in front, even with **Command** on.

Once **Command** is on, the **Quick Action** checkbox in the **Hotkeys** table becomes available. With **Quick Action** on, Nag adds a button with the hotkey's name to the bottom right of the main Nag window. Click that button when you want the line.

- If the line has double-brace names, Nag asks for each value and then copies the finished line to your clipboard.
- If the line has no double-brace names, Nag shows the same lines window as **Generate EQ Hotkey** instead of copying straight away.

## Built-in hotkeys

The three-dot menu in the **Triggers** tab has a **Hotkeys** submenu, titled **Create Hotkeys**. **Clear All** copies `/hot "Clear All" /em clears their mind.` for the built-in Clear All trigger. **Death Recap** is for the Death Recap trigger and is greyed out unless Death Recap is set to load by hotkey in **Settings**. See [Death Recap]({{ '/guides/death-recap' | relative_url }}).
