---
title: Combat Statistics and the DPS meter
parent: How-to guides
nav_order: 13
---

# Combat Statistics and the DPS meter

Combat Statistics reads the hits in your log and shows who did how much damage. You see the numbers in the DPS meter, a small window on top of your game. You can also share your numbers with your group through Combat Log Sync.

## Turn it on

1. Click the **Settings** tab.
2. Click **Combat** in the list on the left.
3. Check **Enable combat statistics**.

The DPS meter window appears on your screen. It stays empty until a fight starts. To hide it between fights, see the options below.

{: .note }
Combat statistics read every hit in your log while you play. Floating Combat Text has its own switch. See [Floating Combat Text]({{ '/guides/floating-combat-text' | relative_url }}).

## Read the DPS meter

The meter lists one row for each player who did damage in the fight. The bar behind a row shows how that player compares with the others.

![The DPS meter with three players, showing Damage, DPS and Time columns and the enemy name at the bottom]({{ '/assets/images/combat-statistics/dps-meter.png' | relative_url }})

| Column | What it shows |
|---|---|
| **Damage** | The total damage the player did in the fight. |
| **DPS** | Damage per second. |
| **Time** | How many seconds the player was in the fight. |

The bottom of the window shows the name of the enemy and the length of the fight. When a player has a pet, the pet's damage is added to the owner's row and the name reads **Soandso + pet(s)**.

To add people to the list, type `/who` in the game. Nag then knows their class and level. Nag shows the class icon next to a name once it knows the class.

The meter only shows damage. It has no healing view.

Hover the mouse over the meter to show its buttons. The column names hide while you do.

{: .note }
If the **Time** column is cut off, drag the edge of the meter to make it wider. It starts 250 pixels wide.

| Button | What it does |
|---|---|
| **Settings** | Opens the Combat page of Settings. |
| **Clear History** | Removes the fights Nag remembers. It only shows when there is a fight to remove. |
| **Record** | Turns recording on or off. When it is on, Nag saves each finished fight as a .zip file with the log lines of the fight. The button lights up while recording is on. It is off every time you start Nag. |
| **Change View** | Pick **Show Current Fight**, **Show All Data**, or one enemy from an earlier fight. |

Nag keeps the .zip files in the `encounters` folder inside your Nag data folder. To open the data folder, click **Settings**, click **Diagnostics**, then click **Show data folder**. Nag does not open these files itself.

To move the meter, drag its title bar, the row that says **Damage Done**. Drag an edge to resize it. Nag remembers where you put it.

## Choose the options

Open **Settings** and click **Combat**.

| Setting | What it does |
|---|---|
| **Enable combat statistics** | Turns Combat Statistics and the DPS meter on or off. |
| **Encounter minimum damage** | A fight that does less damage than this is not counted. |
| **Only show when Nag or EverQuest have focus** | Hides the meter when another program is in front. |
| **Only show when there is an encounter** | Hides the meter between fights. |
| **Highlight my name in the meters** | Makes your own row stand out. |

Click **Show more** under these options to see the combat database.

![The Combat section of Settings with the five options and the Show more link]({{ '/assets/images/combat-statistics/settings-combat.png' | relative_url }})

## Fix players, pets and enemies

Nag keeps a list of players, pets and enemies for each server. Sometimes Nag puts a name in the wrong list. A pet can show up as a player, for example. You fix this in the combat database.

1. Open **Settings** and click **Combat**.
2. Click **Show more**.
3. Click the tab with your server name.
4. Find the name in the **Players**, **Pets** or **NPCs** table.
5. Click the three dots at the end of the row.
6. Pick what you want to do.

| Table | Choices in the menu |
|---|---|
| **Players** | **Move to pets**, **Move to NPCs**, **Change level**, **Change class**, **Remove** |
| **Pets** | **Move to players**, **Move to NPCs**, **Change or assign owner**, **Remove** |
| **NPCs** | **Move to players**, **Move to pets**, **Remove** |

To add a pet yourself, click the **+** next to **Pets**. To set the class or level of a player, click **Choose class** or **N/A** in its row. To give a pet an owner, click **Assign owner**.

Use **Search players** to find a player by name or class. Click **Show less** to close the combat database.

## Choose whose log to use

Open the **Combat** tab, then **Combat Statistics**. The **Combat Character** box at the top picks the character whose log Nag reads for the meter. **Auto** follows the character you are playing. Pick a name to stay with one character.

The gear button next to it opens the Combat settings.

## Combat Log Sync

Combat Log Sync shares fight numbers with other Nag users, so the damage of the whole group can show on your meter. During a fight, you send and receive the total damage, time in the fight, DPS, heals and HPS of each player. When the fight ends, you also send and receive the log lines of the fight. Nag only keeps the received log lines when **Record** is on. The meter shows damage only.

You connect to a Combat Sync Server. One player starts it. The others join it. Nag connects the players directly to each other. The Nag server only helps them find each other.

{: .warning }
Everyone in the server gets your damage numbers and the log lines of your side of the fight. Anyone who sees the server link can join. Post the link only where your group can read it.

Sync stops when you turn off **Enable combat statistics**.

### Start a server

1. Open the **Combat** tab, then **Combat Statistics**.
2. Under **Log Synchronization**, click **Start a server**.
3. Click **Copy server link**.
4. Paste the link into a chat channel your group reads, such as your group, raid or guild chat. It looks like `{NAG:p2p/abcd1234}`.

Wait for the others to join. Their names show under **Connected Peers**.

### Join a server

When someone posts a server link in chat, Nag notices it. A window called **Combat Sync Server** opens and asks if you want to join. It names the player and the server.

| Button | What it does |
|---|---|
| **Ignore** | Closes the window and does nothing. |
| **Join server** | Joins the server this one time. |
| **Trust this player** | Joins the server and adds the player to your trusted list. |
| **Block this player** | Adds the player to your blocked list. |

![The Combat Sync Server window saying Soandso linked a server and asking if you want to join it, with the Ignore, Join server, Trust this player and Block this player buttons]({{ '/assets/images/combat-statistics/join-dialog.png' | relative_url }})

You can also join by hand.

1. Click **Join a server**.
2. In the **Join Log Sync Server** window, paste the whole link, including the braces, into the **Server Link** box.
3. Click **OK**.

Nag ignores links you post yourself.

### Leave a server

Click **Disconnect from server**. While you are connected, a globe button also shows at the top right of the Nag window. Click it to turn off log sync.

The **Server Console** below shows what is happening and any errors. If a server cannot start or join, it says so there. Click **Clear** to empty it, or **Bottom** to jump to the newest line.

### Trusted and blocked players

Under **Server Trust**, pick your server from the box. The lists are kept for each server.

| List | What happens |
|---|---|
| **Trusted Players** | When one of these players posts a server link and you are not in a server, you join without being asked. |
| **Blocked Players** | Links from these players are ignored. You are not asked. |

Type one character name on each line. Type the name exactly as it shows in chat, with the same capital letters. If a name is in both lists, the trusted list wins. Nag saves the lists when you stop typing. Click the **?** next to **Server Trust** for a short explanation.

{: .warning }
Nag checks the character name in the chat line and nothing else. It cannot tell who is playing that character. A trusted name joins you to a server without a question, and then shares your damage numbers and fight log lines with everyone in it. Only trust names of people you know, and remove a name when you stop playing with that person.

{: .note }
You can only be in one server at a time. If you are already connected, Nag does not join a second one. If you click **Join server** in that case, the **Server Console** shows an error.

## Related guides

- [Floating Combat Text]({{ '/guides/floating-combat-text' | relative_url }})
- [Death Recap]({{ '/guides/death-recap' | relative_url }})
