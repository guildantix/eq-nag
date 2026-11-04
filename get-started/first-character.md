---
title: Add your character
parent: Get started
nav_order: 2
---

# Add your character

Show Nag which character to watch. Nag learns what happens in the game by reading that character's log file.

## 1. Turn on logging in EverQuest

Nag can only read what EverQuest writes down.

1. Log in to your character.
2. Type `/log on` in the chat box and press **Enter**.

You only need to do this once for each character.

{: .important }
No log file means no alerts. If Nag ever seems quiet, check that logging is on.

## 2. Go through the Setup window

The first time Nag opens, a window called **Setup** appears. Click **Next** after each step.

1. **Welcome**: just click **Next**.

   ![The Setup window on the Welcome step, with Cancel Setup Wizard, Previous and Next buttons]({{ '/assets/images/first-character/setup-welcome.png' | relative_url }})

2. **FCT**: floating combat text shows your damage as numbers on screen. Leave **Enable FCT** off if you are not sure.

   ![The FCT step of the Setup window with the Enable FCT switch turned off]({{ '/assets/images/first-character/setup-fct.png' | relative_url }})

3. **DPS Meter**: shows damage for you and your group. Leave **Enable DPS Meter** off if you are not sure.

   ![The DPS Meter step of the Setup window with the Enable DPS Meter switch turned off]({{ '/assets/images/first-character/setup-dps-meter.png' | relative_url }})

4. **Overlays**: choose **Grouped** or **Linear** for your timers, then click **Next**.

   ![The Overlays step of the Setup window with the Grouped format picked]({{ '/assets/images/first-character/setup-overlays.png' | relative_url }})

5. **Characters**: click **New Character** and follow the steps in "Add the character" below. Then click **Next**.

   ![The Characters step of the Setup window with the New Character button and one added character below it]({{ '/assets/images/first-character/setup-characters.png' | relative_url }})

6. **Finished**: click **Complete Setup!**

   ![The Finished step of the Setup window with the Complete Setup! button at the bottom right]({{ '/assets/images/first-character/setup-finished.png' | relative_url }})

When you click **Next** on the **Overlays** step, Nag creates your overlays. An overlay is the on-screen box where timers and alerts show up. You get **Detrimental Timers**, **Beneficial Timers** and **Text Notifications**. If you turned on **Enable FCT**, you also get **FCT My Damage** and **FCT Damage to Me**.

A window called **Arrange Overlays** opens at the same time. You will see your new overlays on screen. Drag each one to where you want it, then click **Save**. Click **Cancel** to keep the default places. You can do this again later.

You can turn FCT on later in the **Combat** tab, under **Floating Combat Text**. If you click **Cancel Setup Wizard**, a green gear button appears at the top of Nag. Click it to start the Setup window again.

{: .tip }
Not sure about Grouped or Linear? Pick **Grouped**.

## 3. Add the character

In the Setup window you have already clicked **New Character**. Otherwise, click the **Characters** tab, then **New Character**.

A window called **New Character** opens.

1. Wait a moment while Nag shows **Searching for EverQuest folder.**
2. Open the **Server** list and pick your server.
3. Open the **Character** list and pick your character. A name that says **Added** is already in Nag.

   ![The New Character window with a server and a character picked, and the Create button at the bottom]({{ '/assets/images/first-character/new-character-found.png' | relative_url }})

4. Click **Create**.

You will see **Character added!** at the bottom of the window, and your character in the list.

### If Nag cannot find your EverQuest folder

You will see **Could not locate your EverQuest folder. Please select your character's log file.**

1. Click **Select Log File**.
2. Open your EverQuest folder, then the `Logs` folder.
3. Pick the file named like `eqlog_Soandso_testserver.txt`. It starts with `eqlog_`, then your character, then your server.
4. Check the **Character Information** shown: **Character Name**, **Service**, **Server** and **Log file**.

   ![The New Character window showing Character Information: Character Name, Service, Server and Log file]({{ '/assets/images/first-character/new-character-review.png' | relative_url }})

5. Click **Create**.

If Nag does not recognize the file name, it asks you for **Character Name**, **Service** and **Server**. Fill them in and click **Continue**, then **Create**. For **Service**, pick **P1999**, **Daybreak**, **TAKP**, **THJ** or **Other**.

![The New Character window asking for Character Name, Service and Server, with a Continue button]({{ '/assets/images/first-character/new-character-manual.png' | relative_url }})

## 4. Set the class

1. In the **Characters** tab, click your character's name. Its details open.
2. On the **Settings** tab, open **Character Class** and pick your class.

You will see the class next to your character's name.

![A character open in the Characters tab, with the Character Class list set and the Focus Effects switches below it]({{ '/assets/images/first-character/character-class-focus.png' | relative_url }})

Nag uses your class to work out how long your timers last. It also keeps class-only triggers quiet for other classes.

## 5. Set your focus effects

Focus effects are gear and abilities that make your spells last longer or cast faster. Nag counts them when it times your spells. If you have none, skip this step.

Under **Focus Effects**, turn on what applies to you:

- **Extended DOT Focus?**: type the **%** increase and the **Level** where it starts to fade.
- **Extended Beneficial Focus?**: type **Worn**, **Level** and **AA**.
- **Beneficial Spell Haste Focus?**: type **Worn**, **Level**, **AA** and **Duration Limit**.

Nag saves each change as you make it.

## Next

[Get your first alert]({{ '/get-started/first-trigger' | relative_url }})
