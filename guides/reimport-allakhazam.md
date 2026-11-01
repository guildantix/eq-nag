---
title: Re-import a timer from EQ Spell Resources
parent: How-to guides
nav_order: 10
---

# Re-import a timer from EQ Spell Resources

Refresh an old DoT or buff timer that you made from Allakhazam. The timer keeps working without this. Do it only if you want to update the timer.

Allakhazam does not allow automated access, so Nag no longer uses it. The same spell on EQ Spell Resources gives Nag the same facts.

{: .warning }
Re-importing can overwrite changes you made to the trigger. The import window shows a warning about this at the top.

## Before you start

Find the spell on [EQ Spell Resources](https://spells.eqresource.com/spellsearch.php), open its page and copy the address from your browser. It looks like `https://spells.eqresource.com/spells.php?id=1447`.

## Steps

1. In Nag, click the **Triggers** tab.
2. Find the old timer in the list and click **Edit** at the start of its row. A window called **Trigger** opens.
3. At the bottom of that window, click **Re-import from EQ Spell Resources**. A window called **Re-import from EQ Spell Resources** opens.
4. Click **EQ Spell Resources address** and paste the address. If you see **That isn't an EQ Spell Resources spell page.**, check that you copied the spell's page.
5. Click **Re-import**.
6. Nag opens the import window for that timer. It says **WARNING: This may overwrite any custom setting you have applied to this trigger.** Read it, then click **Next** and go through the steps. Then click **Import**.

You will see **Ready for import!** before the last click.

For a buff timer, Nag keeps your earlier choice of who the buff is for, so it skips that step.

## If you do not see the button

The button only shows on timers made by the DoT Timer and Buff Timer generators. Raid ability timers made from Allakhazam cannot be re-imported, because EQ Spell Resources has no raid ability generator. Make a new trigger by hand instead. See [Get your first alert]({{ '/get-started/first-trigger' | relative_url }}).

## Next

- [Add a DoT timer]({{ '/guides/add-dot-timer' | relative_url }})
- [Add a buff timer]({{ '/guides/add-buff-timer' | relative_url }})
