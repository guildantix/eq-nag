# Releasing Nag

Everything runs from GitHub's **Actions** tab; you don't need to build anything
or change any version numbers. Version numbers are picked automatically: the
last number goes up by one for every pre-release and release (0.2.27, 0.2.28,
...), and test builds get a beta number (0.2.29-beta.1, -beta.2, ...).

## 1. Test build (optional, for a few testers)

1. Actions → **Test build** → **Run workflow**.
2. When it finishes, send testers the link to the new
   "test build (testers only)" release.

No copy of Nag updates to a test build on its own.

## 2. Pre-release

1. Actions → **Pre-release** → **Run workflow**.
2. Open the new draft on the Releases page. Under **Changes to write up** is
   a list of what changed since the last release. Rewrite it for players, add
   details and screenshots, and delete anything players don't need to know.
3. Click **Publish release** (it's already labeled Pre-release).

Copies of Nag with pre-release updates turned on install it automatically.
Running Pre-release again before publishing rebuilds the same version from the
latest code and adds only the new changes; your edits are kept.

## 3. Release

1. Actions → **Release** → **Run workflow**.
2. Open the new draft. It already contains the notes of every pre-release
   since the last full release; tidy them up if you like.
3. Click **Publish release** (it's already labeled Latest).

The release is built from the exact code of the latest pre-release, so it
ships what pre-release users have been running. Every copy of Nag updates to
it.

## Good to know

- The installer isn't code-signed, so Windows SmartScreen may warn on first
  install ("More info" → "Run anyway").
- Release notes appear in Nag's Update Notes window, so write them for
  players.
- Only people with write access to the repository can run these workflows.
