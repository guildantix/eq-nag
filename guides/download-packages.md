---
title: Downloading trigger packages
parent: How-to guides
nav_order: 2
applies_to: "0.2.30"
last_verified: 2026-11-26
---

# Downloading trigger packages

A package is a ready-made set of triggers that another player shared. Install one from the Trigger Library.

1. Click the **Triggers** tab.
2. Click the blue **Trigger Library** button. A window called **Trigger Library** opens.

   ![The Trigger Library window with Categories on the left and the Browse Packages list on the right]({{ '/assets/images/download-packages/library-categories.png' | relative_url }})

3. On the left, under **Categories**, click a category. **Installed** shows what you already have.
4. Click a package in the list. The list shows **Name**, **Author** and **Last Updated**. Click **Name** or **Author** to sort by it.

   ![The Trigger Library with the Spells category picked and its packages listed by Name, Author and Last Updated]({{ '/assets/images/download-packages/library-spells-list.png' | relative_url }})

5. Look at the package page. You will see its name, a description and every trigger in it.

   ![A package page in the Trigger Library, with its description, its triggers, and the Install Package and Copy Quick Share Code buttons]({{ '/assets/images/download-packages/library-package-page.png' | relative_url }})

6. To read more about one trigger, hover over the note icon at the end of its row.
7. Scroll down and click the green **Install Package** button.

You will see the package's triggers in your **Triggers** tab. The button becomes **Uninstall Package**.

Under the buttons, **History** lists what changed in each version of the package.

## If Nag asks about a missing overlay

An overlay is the on-screen box where timers and alerts show up. Some packages use an overlay you do not have. Nag then opens a window called **Missing an Overlay**.

- Click **Use Existing**, pick one of your overlays under **Existing Overlay**, then click **Use this overlay**.
- Or click **Copy** to make a copy of the package's overlay. Move and resize it, then click **Done**.

{: .warning }
If you click **Cancel**, the package is not installed.

{: .tip }
Click **Back to List** to return to the package list.

## If a package left folders at the top of your list

Some packages left their triggers in loose folders at the top of your **Triggers** list. Version 0.2.30 fixes this. To repair an older install:

1. Open the Trigger Library and click the package.
2. Click **Uninstall Package**.
3. Click **Install Package**.

**Uninstall Package** removes every trigger of the package, including any you moved or changed yourself. It also removes the empty package folders it leaves behind. **Install Package** then adds the triggers again, switched on, in the package's own folders. Updating a package no longer causes the problem.

{: .note }
Changes you made to the package's triggers are lost when you uninstall.

## Publishing your own packages

The green plus button at the top of **Browse Packages** creates a new package. It only shows for trusted authors. To ask for verification:

1. Open **Settings**, then **Sharing**.
2. Under **Author details**, type your **Author name** and click **Save**.
3. Click **Request verification**. This button shows after your author name is saved. Nag says **Request submitted!**

Once you are a trusted author, a small shield icon shows next to the **Sharing** title in Settings, and the plus button appears in the Trigger Library.

To share a package with a friend, click **Copy Quick Share Code** and send them the code. See [Quick Share]({{ '/guides/quick-share' | relative_url }}).
