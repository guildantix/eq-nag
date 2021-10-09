## Adding a buff timer

Buff timers will only track buffs that you cast and should not trigger from buffs cast by other players.  These are easy to add with the buff timer wizard.  Start by finding the buff details page on alla and copying the URL.

**_NOTE_** _It is important that you get the spell details and not the spell scroll item. Look for ```spell.html``` in the url.

[We'll be using the Beastlord spell Savagery](https://everquest.allakhazam.com/db/spell.html?spell=2941)

First, we'll want to select the desired trigger folder for the new trigger.  I'll select the ```Spells / Beneficial``` folder.

![image](https://user-images.githubusercontent.com/66176124/136667261-46d44d3a-cbb0-4c26-8230-ff8a82c7fcdc.png)

Begin by opening on the New Trigger sub-menu by clicking on the three vertical dots.

![image](https://user-images.githubusercontent.com/66176124/136667108-b0326a95-370c-43c1-9fe0-dbd7a4a472cc.png)

Then select the "Buff Timer" menu option.

![image](https://user-images.githubusercontent.com/66176124/136667140-15f77730-56ec-42e6-a968-5cb93660976e.png)

Paste in the URL for the spell and click the **\[Next\]** button.

![image](https://user-images.githubusercontent.com/66176124/136667181-2e74ba7b-8cb6-4299-89bc-dcf2e178f448.png)

Next, select how you want to track the buff.  Because the beastlord will cast this spell on themselves and at least 1 other person, I'll choose to track for **Self** and **Other**.

Additionally, we want to be notified when the buff is down to 30 seconds and again if the buff fades.

![image](https://user-images.githubusercontent.com/66176124/136667401-49de1e01-496c-4035-b51d-49f37b4b3133.png)

<sup>_**NOTE** We don't care about other beastlord's Savagery buffs, so the trigger will only capture your spell landing by using the casting time of the spell to approximate when the "Spell landed on Other" text should appear in the log._</sup>

Finally, select which Overlay should the timer appear in.  Additionally, we don't care about the timer if the character that is buffed dies, so we'll end it early if that happens.

![image](https://user-images.githubusercontent.com/66176124/136667496-7cea98f8-a4b5-4cc0-abbb-e27371e6290c.png)

Once all your options have been set, click on the green **\[Import\]** button to create your buff timer.

![image](https://user-images.githubusercontent.com/66176124/136667514-a8bfaa63-a8f1-4e27-a18f-533eacbe6254.png)

