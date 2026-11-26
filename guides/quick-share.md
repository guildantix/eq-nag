---
title: Quick Share
parent: How-to guides
nav_order: 8
---

# Quick Share

Quick Share sends triggers from one Nag to another. You can send them as a short code, or as a file.

## Send triggers

1. Click the **Triggers** tab.
2. Right-click a trigger or a trigger folder.
3. Click **Quick Share**. A window called **Send trigger(s) and folder(s)** opens.

   ![The Send trigger(s) and folder(s) window with a folder ticked and the How to share choices at the bottom]({{ '/assets/images/quick-share/send-dialog.png' | relative_url }})

4. Tick the triggers and folders you want to send. Click the arrow next to a folder to open it.
5. Under **How to share**, pick one or both:
   - **Share to server** puts your triggers on the share server and copies a code to your clipboard. The code looks like `{NAG:quick-share/...}`.
   - **Save as file** saves a `.nag` file. You can send it on Discord or a forum, or keep it as a backup. The file includes your author name and Discord name.
6. Click the button at the bottom. Its name changes with your choice:
   - **Copy to Clipboard** when you pick **Share to server** only.
   - **Save File...** when you pick **Save as file** only.
   - **Share and Save** when you pick both.
7. If you picked **Save as file**, choose where to save it and click **Save**.

{: .note }
If neither box is ticked, the window says **Pick at least one way to share**, and the button stays grey.

Send the code, or the file, to your friend. Paste the code in any chat. Nag players can also receive it in a game channel, see [Who can send you triggers](#who-can-send-you-triggers).

### If Nag leaves something out

When you send, Nag checks your triggers. A message at the bottom of the window then adds one of these lines to **Quickshare copied to clipboard.** or **Share saved to file**:

- **left out because they can't be shared**: a trigger is damaged, so it stays out of the share. It still works for you. This one only shows when you use **Share to server**.
- **trimmed to fit the share limits**: some very long text was shortened. This only affects the share, and only shows when you use **Share to server**.
- **The timer icon of "Soandso" is not an embedded image up to 256 KB**: see [Timer icons in shares](#timer-icons-in-shares). A saved file says **10 MB** instead of **256 KB**.

## Receive triggers

You can receive triggers in three ways.

### Paste a code

1. Copy the code you were sent.
2. Click the **Triggers** tab.
3. Click the three-dot button at the top right of the list.
4. Click **Install Quick Share Code**.
5. Paste the code into the **Package code** box and confirm.

Nag also accepts the code of a Trigger Library package here.

### Open a file

1. Click the **Triggers** tab.
2. Click the three-dot button at the top right of the list.
3. Click **Import from File...**.
4. Pick a `.nag`, `.zip` or `.json` file.

### Drag and drop

Drag the file onto the Nag window. A box called **Drop to import triggers** appears. It says **.nag, .zip or .json · up to 40 MB**. Let go of the file inside the box.

![The Drop to import triggers box over the Nag window]({{ '/assets/images/quick-share/drop-to-import.png' | relative_url }})

### Pick what to install

A window called **Receive trigger(s) and folder(s)** opens.

![The Receive trigger(s) and folder(s) window with a folder of triggers and the Import button]({{ '/assets/images/quick-share/receive-dialog.png' | relative_url }})

1. Tick the folders and triggers you want. Hover over an icon at the end of a row to read what it means. The green cloud only shows while your mouse is over that row. The orange icons always show.
   - A green cloud with an arrow: the trigger is new and will be installed.
   - An orange cloud with an arrow: you have this trigger already, and it will be updated.
   - A red cloud with a line through it: the trigger will be duplicated.
   - An orange exclamation mark on a folder: "This folder contains triggers that will be updated."
2. Read the two boxes at the bottom:
   - **Overwrite existing triggers.** replaces triggers you already have with the new versions.
   - **Stage new triggers.** puts new triggers in a folder called **Quick Share Staged** at the top of your list, so you can look at them before you use them. Click the **?** button next to it for details.
3. Click **Import**.

If the sender sent the same trigger before, for example after fixing a sound, Nag updates your copy. It does not make a second one. This needs **Overwrite existing triggers.** to be ticked, which it is at first. If you untick it, Nag adds the trigger again, and the red cloud shows it.

A file shows **Shared by Soandso (unverified, from a file)** at the top. Nag cannot prove who made a file, so only open files from people you trust.

## What Nag checks

A share comes from another person, so Nag checks every trigger before it installs one.

- A trigger with a wrong or missing part is repaired when it can be.
- A trigger that cannot work, for example one with no name or no phrase to look for, is skipped.
- Very long text is shortened.

After the install, Nag tells you what it did. For example: **1 trigger was skipped because it was damaged (Soandso's Timer).** or **2 triggers had fields corrected.** If a share is damaged completely, you see **This quick share can not be imported because its data is damaged.**

Nag may also show one of these messages when you open a file:

| Message | What it means | What to do |
|---|---|---|
| "isn't a trigger file. Nag can import .nag, .zip and .json files." | The file type is wrong. | Pick a different file. |
| "is larger than a trigger file can be, so Nag didn't open it." | The file is too big. The limit is about 40 MB. | Ask the sender to share fewer triggers or sounds. |
| "would unpack to ... so Nag stopped before extracting it." | A `.zip` file holds far more than a trigger file should. | Do not open it. |
| "doesn't contain Nag triggers." | The file is not from Nag's share window. | Ask the sender to save it again from Nag. |
| "is damaged and can't be read." | The file is broken. | Ask the sender to save it again. |
| "This file was made with a newer version of Nag" | The sender has a newer Nag. Some settings may not work in yours. | Click **Review import** to go on, or **Cancel**, then update Nag. |

## Timer icons in shares

A timer can have its own icon. An icon only travels in a share when it is an embedded image:

- The image must be a PNG, JPEG, GIF, WebP or SVG.
- It must be 256 KB or smaller when you share to the server. Nag stores the image as text, which makes it about a third bigger, so keep the picture file under about 190 KB.
- It must be 10 MB or smaller in a `.nag` file, which is a picture file of about 7.5 MB.

Nag drops any other icon, so the timer arrives without an icon. After you send, the message at the bottom of the window names the triggers that have such an icon. To fix it, open the timer action, click **Select Icon File**, and pick a smaller image. See [Timers in depth]({{ '/triggers/timers' | relative_url }}).

## Settings

Open **Settings**, then **Sharing**.

![The Sharing page in Settings with the Quick Share, Author details and Advanced options]({{ '/assets/images/quick-share/settings-sharing.png' | relative_url }})

- Under **Quick Share**, the **Import Quick Share triggers** box turns on listening. Nag then watches your log for Quick Share codes that other players send in game, and offers to install them. Turn it off if you do not want that.
- Under **Author details**, type an **Author name**, and a **Discord** name if you like, then click **Save**. People see these on what you share.

### Who can send you triggers

1. Turn on the **Advanced** switch at the top of the Sharing page.
2. Under **Who can send you triggers**, pick one:
   - **Everyone**.
   - **Only these players**.
   - **Everyone except these players**.
3. If you did not pick **Everyone**, type the player names in the **Characters list** box.

This only affects codes that arrive in your game log. Files and codes you paste yourself always open.

{: .note }
Triggers made by someone else can show a screen glow. To stop that, turn on **Disable screen glow** under **Shared and installed trigger permissions** on the same page.
