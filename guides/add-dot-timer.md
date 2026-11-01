---
title: Add a DoT timer
parent: How-to guides
nav_order: 7
---

# Add a DoT timer

Make a timer that counts down your damage-over-time spell on each target. Nag builds it from the spell's page on EQ Spell Resources.

{: .note }
On Nag 0.2.26 and earlier you could also use Allakhazam. That option was removed because Allakhazam does not allow automated access. Timers you made that way still work. To refresh one, see [Re-import a timer from EQ Spell Resources]({{ '/guides/reimport-allakhazam' | relative_url }}).

## Before you start

- Add your character and pick its class. See [Add your character]({{ '/get-started/first-character' | relative_url }}).
- Have a timer overlay. An overlay is the on-screen box where timers show up. The Setup window makes one called **Detrimental Timers**.
- Know that the timer only follows spells **you** cast. The same spell from another player is ignored.

## 1. Find the spell

1. Open [EQ Spell Resources](https://spells.eqresource.com/spellsearch.php) in your browser.
2. Search for your spell and open its page.
3. Click the address bar and copy the whole address. It looks like `https://spells.eqresource.com/spells.php?id=1447`.

{: .important }
Copy the page of the **spell**, not an item or a scroll. The address has `spells.php?id=` in it.

## 2. Open the DoT Timer window

1. In Nag, click the **Triggers** tab.
2. Click the folder where the new trigger should go, for example one for your DoTs. Make sure it is highlighted. Clicking a selected folder again deselects it. If no folder is selected, Nag asks you to pick one.
3. Click the three dots at the top right.
4. Click **Auto Generation**, then under **EQ Spell Resources** click **DoT Timer**.

You will see a window called **Import DoT Timer (EQ Spell Resources)**.

## 3. Paste the address

1. Click the box and paste the address. The hint under it says **EQ Spell Resources URL**.
2. Click **Next**.

You will see the **Tracking** step.

## 4. Pick your options

1. Open **Overlay Window** and pick the overlay that shows your timers.
2. Tick **End timer early if your target dies.** to remove the timer when the target dies. This works with "was slain by" and the older "has been slain by".
3. Tick **Only execute for rare and raid targets.** only if you want to skip ordinary mobs. Nag guesses "rare" from the name: a name that starts with a lowercase letter, or with "A" or "An", counts as ordinary. It can guess wrong.
4. Click **Next**.

You will see **Ready for import!**

## 5. Import it

1. Click **Import**.
2. If a window called **Locating EverQuest assets** or **Select an icon** opens, wait while it shows **Processing game files ...**. Then click one of the small pictures. That picture becomes the timer's icon. You can also click **Cancel**. The trigger is still made, just without that icon. If the window says **Could not locate your EverQuest folder.**, click **Select EverQuest Folder** and pick the `eqgame.exe` file in your EverQuest folder.

Your new trigger is in the folder you picked, named after the spell.

## 6. Try it

Cast the spell on a target. A timer counts down in your overlay. You can also test with **Simulate Log**. See [Get your first alert]({{ '/get-started/first-trigger' | relative_url }}).

## If it does not work

**The timer does not end when the mob dies.** Triggers made before 0.2.27 only listened for "has been slain by". Updating Nag fixes them, unless you changed that phrase yourself. Open the trigger and check its **End Early** phrases. See the [FAQ]({{ '/help/faq' | relative_url }}#timer-slain).

**Nothing happens after Next.** Check that the address is the spell's page on EQ Spell Resources.

**You want to change the timer afterwards.** Open the trigger and use its **Actions** tab. The [Documentation]({{ '/documentation/' | relative_url }}) explains every setting.

## Next

- [Add a buff timer]({{ '/guides/add-buff-timer' | relative_url }})
- [Arrange your overlays]({{ '/guides/arrange-overlays' | relative_url }})
