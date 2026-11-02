---
title: Add a buff timer
parent: How-to guides
nav_order: 6
---

# Add a buff timer

Make a timer that counts down a buff, and tells you when it is about to fade. Nag builds it from the spell's page on EQ Spell Resources.

{: .note }
On Nag 0.2.26 and earlier you could also use Allakhazam. That option was removed because Allakhazam does not allow automated access. Timers you made that way still work. To refresh one, see [Re-import a timer from EQ Spell Resources]({{ '/guides/reimport-allakhazam' | relative_url }}).

## Before you start

- Add your character and pick its class. See [Add your character]({{ '/get-started/first-character' | relative_url }}).
- Have a timer overlay. An overlay is the on-screen box where timers show up. The Setup window makes one called **Beneficial Timers**.

## 1. Find the spell

1. Open [EQ Spell Resources](https://spells.eqresource.com/spellsearch.php) in your browser.
2. Search for the buff and open its page.
3. Click the address bar and copy the whole address. It looks like `https://spells.eqresource.com/spells.php?id=1447`.

{: .important }
Copy the page of the **spell**, not an item or a scroll. The address has `spells.php?id=` in it.

## 2. Open the Buff Timer window

1. In Nag, click the **Triggers** tab.
2. Click the folder where the new trigger should go. Make sure it is highlighted. Clicking a selected folder again deselects it. If no folder is selected, Nag asks you to pick one.
3. Click the three dots at the top right.
4. Click **Auto Generation**, then under **EQ Spell Resources** click **Buff Timer**.

   ![The three-dot menu in the Triggers tab, open on Auto Generation, then EQ Spell Resources, with DoT Timer and Buff Timer]({{ '/assets/images/first-trigger/triggers-menu.png' | relative_url }})

You will see a window called **Import Buff Timer (EQ Spell Resources)**.

![The Import Buff Timer (EQ Spell Resources) window on the Scrape step, with a spell page address in the EQ Spell Resources URL box]({{ '/assets/images/add-buff-timer/buff-import-step1.png' | relative_url }})

## 3. Paste the address

1. Click the box and paste the address. The hint under it says **EQ Spell Resources URL**.
2. Click **Next**.

You will see the **Tracking Type** step.

## 4. Pick who the buff is for

Pick one:

- **I want to track the buffs that I cast.**
- **I want to track the buffs that others cast on me.**

Then click **Next**.

If you pick the second choice and see **This spell cannot be tracked because there is no "cast on you" phrase to track.**, Nag cannot time this spell that way.

## 5. Pick your timer options

If you picked **I want to track the buffs that I cast.**

1. Turn on **Track the buff duration with a countdown for Self** to time the buff on you.
2. Turn on **Track the buff duration with a countdown for Other** to time it on other players. This is off for spells that only land on you.
3. Turn on **Notify me when the buff is ending in** and type how long before the end you want the warning.
4. Turn on **Notify me when the buff fades.**
5. Click **Next**.

If you picked **I want to track the buffs that others cast on me.**

1. Turn on **Notify me when the buff fades.**
2. Turn on **Notify me when the buff is ending in** and type the time.
3. Turn on **Hide timer until nearing its end.** if you only want to see it close to the end.
4. Click **Next**.

{: .note }
For buffs cast on others, the log does not say who got the buff. Nag guesses from the spell's casting time. It can guess wrong if another player casts the same spell at the same moment.

## 6. Pick the overlay

1. Open **Timer Overlay Window** and pick the overlay that shows your timers.
2. Tick **End timer early if your target dies.** if you do not want the timer after the target dies.
3. Click **Next**.

If the spell comes from items too, Nag asks **There are item(s) with this effect. Would you like to include any of these?** Tick the ones you want and click **Next**.

## 7. Import it

You will see **Ready for import!** Click **Import**.

If a window called **Locating EverQuest assets** or **Select an icon** opens, wait while it shows **Processing game files ...**. Then click one of the small pictures. That picture becomes the timer's icon. You can also click **Cancel**. The trigger is still made, just without that icon. If the window says **Could not locate your EverQuest folder.**, click **Select EverQuest Folder** and pick the `eqgame.exe` file in your EverQuest folder.

Your new trigger is in the folder you picked, named after the spell.

## Try it

Cast the buff. A timer counts down in your overlay. You can also test with **Simulate Log**. See [Get your first alert]({{ '/get-started/first-trigger' | relative_url }}).

## If it does not work

Some buffs, such as ones with charges, do not write a line when they fade on you. Nag then cannot warn you at the end.

To change the timer afterwards, open the trigger and use its **Actions** tab. The [Documentation]({{ '/documentation/' | relative_url }}) explains every setting.

## Next

- [Add a DoT timer]({{ '/guides/add-dot-timer' | relative_url }})
- [Arrange your overlays]({{ '/guides/arrange-overlays' | relative_url }})
