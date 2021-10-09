## Adding a DoT Timer

DoT timer triggers will only activate on your spells and will ignore the same spell cast by other players.  They are easy to add with the DoT timer wizard. Start by finding the spell details page on alla and copying the URL.

**_NOTE_** _It is important that you get the spell details and not the spell scroll item. Look for ```spell.html``` in the url.

[We'll be using the Necromancer/Shadow Knight spell Boil Blood](https://everquest.allakhazam.com/db/spell.html?spell=451)

First, we'll want to select the desired trigger folder for the new trigger.  I'll select the ```Spells / Detrimental / DoTs``` folder.

![image](https://user-images.githubusercontent.com/66176124/136667656-ae9befbc-6443-4a1c-ad5a-a3b22a9ed0f7.png)

Begin by opening on the New Trigger sub-menu by clicking on the three vertical dots.

![image](https://user-images.githubusercontent.com/66176124/136667108-b0326a95-370c-43c1-9fe0-dbd7a4a472cc.png)

Then select the "DoT Timer" menu option.

![image](https://user-images.githubusercontent.com/66176124/136667677-6d557394-ff42-45a0-a3f5-d1c9cc1c8270.png)

The DoT timer import is a bit simpler than Buff Timers, here we'll select the DoT Timer overlay, paste in the URL spell details.  We'll select the option to "End timer early if your target dies." so that the timer won't stick around after we've finished a target.  But we want to track this on every target so we'll leave the "Only execute for rare and raid targets." option disabled.

Once all of your options are set, click on the green **\[Import\]** button to import and create the trigger.

![image](https://user-images.githubusercontent.com/66176124/136667817-88f7fe0b-08db-4ce6-aad6-7a460d37859a.png)

_**NOTE** The option for "Only execute for rare and raid targets." approximately guesses when your target is a rare/raid target by using capitolization rules.  These leaves some room for error, so you'll occasionally get regular mobs tracked.  However, if you see that a rare or raid target mob isn't tracking, please let me know in Discord._
