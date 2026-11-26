---
title: Death Recap
parent: How-to guides
nav_order: 9
---

# Death Recap

The Death Recap window shows what led to a character's death. It has three parts:

- **Damage Log**: what happened to your character, including damage taken and healing received.
- **Damage Sources**: all NPC damage done to the raid, and all healing the raid received.
- **Encounter Statistics**: general numbers for the raid, and numbers for each enemy in the fight.

## Choose how it opens

1. Click the **Settings** tab.
2. Click **Death recap** in the list on the left.
3. Pick **Off**, **Hotkey** or **Automatic**.

**Off** is the default. The window never opens by itself.

With **Automatic**, the window opens by itself when you are slain.

With **Hotkey**, you make an EverQuest hotkey button. Press it to see your last death.

The first time you pick **Hotkey** or **Automatic**, Nag asks which trigger folder to put the new Death Recap trigger in. Pick a folder and click the button to confirm. If you later delete that trigger, Nag makes a new one the next time you change the mode.

## Make the hotkey

1. Pick **Hotkey** in **Settings**, as above.
2. Click the **Copy** button that shows under the choices.
3. In EverQuest, paste into the chat box and press **Enter**.

You can also copy the command from the **Triggers** tab. Click the three dots at the top right, then **Hotkeys**, then **Death Recap**. You will see **The command has been copied to your clipboard!**

You now have a button called **Death Recap** that you can put on a hotbar. It sends the emote `/em wonders how they died.`, and Nag opens the recap when it sees it.

{: .note }
The **Death Recap** item under **Hotkeys** is grayed out unless you picked **Hotkey**.

## Look at an old death

1. In the **Triggers** tab, click the three dots, then **Death Recap**.
2. Pick your **Server** and **Character**, then click **Next**. If your character is not listed, click **Select Log File**.
3. Click a death in the list. It shows a **Description** and a **Timestamp**.

You will see the recap for that death.

{: .note }
If the window says **No death found in this log**, Nag did not find a line starting "You have been slain by" in that character's current log. Archived logs are not searched.

## If the hotkey stops working

Live servers now put `~ ` in front of your name on emotes. Nag 0.2.27 fixes the Death Recap hotkey. Triggers you edited yourself may need a fix. See the [FAQ]({{ '/help/faq' | relative_url }}#emote-prefix).

## Show it from a trigger

A trigger can open the recap too. Use the **Display Death Recap** action. The [Documentation]({{ '/documentation/' | relative_url }}) lists every action.
