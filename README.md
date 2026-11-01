# Writing the Nag docs

The docs are a [Jekyll](https://jekyllrb.com/) site using the
[Just the Docs](https://just-the-docs.com/) theme, published from this folder
by GitHub Pages. This file is not part of the site.

## How pages are organised

Each top-level section is a folder with an `index.md` that has
`has_children: true`. Pages inside the folder name that section in `parent`.
The casual sections come first; `documentation/` holds the details of the
advanced features. Its sub-sections are a third navigation level: their pages
set `parent` to the sub-section and `grand_parent` to Documentation.

| Section | Folder | Holds |
|---|---|---|
| Get started | `get-started/` | Install, first character, first trigger |
| How-to guides | `guides/` | Step-by-step tasks |
| Troubleshooting & FAQ | `help/` | Problems and questions |
| Documentation | `documentation/` | Hub page for the advanced features |
| Documentation > Triggers & Regex | `triggers/` | How triggers, phrases, conditions and actions work |
| Documentation > Reference | `reference/` | Lookup pages |
| What's new | `whats-new/` | Release notes |

The Documentation hub lists every child section and page with a one-line
description. Add a line there when you add a page under it.

The sidebar can be collapsed with the hamburger button in the header. The home
page starts collapsed (`nav_collapsed: true` in its front matter); other pages
start open, or as the reader last left them.

Keep a page at its current path once it is published; other sites and players
link to it. If a page has to move, add the old path to `redirect_from`.

## Front matter

```yaml
---
title: Add a DoT timer
parent: How-to guides
nav_order: 7
applies_to: "0.2.27"
last_verified: 2026-11-01
redirect_from:
  - /guides/old-name/
---
```

| Field | Meaning |
|---|---|
| `title` | Page title, also shown in the navigation |
| `parent` | Title of the section page |
| `grand_parent` | Title of the top-level section, for pages on the third level |
| `nav_order` | Position among its siblings |
| `applies_to` | Nag version the steps were checked against. Defaults to the value in `_config.yml` |
| `last_verified` | Date someone followed the page in the app. Defaults to the value in `_config.yml` |
| `redirect_from` | Old paths that should lead to this page |
| `nav_exclude: true` | Keeps the page out of the navigation |
| `hide_meta: true` | Hides the "Applies to / Last verified" badges |
| `nav_collapsed: true` | Starts the page with the sidebar collapsed (used by the home page) |

## Callouts

Put a line with the callout name directly under the paragraph:

```markdown
{: .note }
Background a reader needs before the step works.
```

Available callouts: `note`, `tip`, `warning`, `important`. Use them sparingly,
at most three per screen.

## Style

Write in second person, present tense, with short sentences. Name buttons and
tabs with their exact label in bold, for example **New Character**. Use US
spelling to match the app. Show phrases exactly as typed in Nag.

## Screenshots

- Use made-up names only, such as `Soandso` for a character and `Testserver`
  for a server. No real characters, guilds, chat, user paths or emails.
- Crop to the panel or dialog, not the whole desktop.
- Save PNG files under `docs/assets/images/`, and link them with
  `{{ '/assets/images/name.png' | relative_url }}`.
- Give every image alt text that says what it shows and what to look at.
- Retake a screenshot when the UI changes, and bump `last_verified` on the page.

## Coverage map

`_data/features.yml` lists each Nag feature, the page that documents it, and a
status: `documented`, `outdated` or `missing`. When you add or change a page,
update its rows. When you add a feature to the app, add a row.

## Bumping `last_verified`

When you follow a page in the app and it is still correct, set its
`last_verified` to today's date. If the page needed changes for a newer
version, also change `applies_to`.

## Previewing locally (optional)

You don't need Ruby to contribute; GitHub builds the site. To preview:

```
cd docs
bundle install
bundle exec jekyll serve --baseurl /eq-nag
```

Then open http://127.0.0.1:4000/eq-nag/.
