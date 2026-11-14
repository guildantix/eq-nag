# Instructions for AI coding agents

This file is for AI assistants working on Nag. People should read
[Code Styles.md](Code%20Styles.md), [RELEASING.md](RELEASING.md) and the
[README](README.md); everything here is consistent with them.

## What Nag is

Nag (EQ Nag) is a Windows desktop app for EverQuest players: it reads the
game's log file and shows alerts, timers and combat information on overlays.
It's Electron 36 with an Angular 14 UI (TypeScript 4.6). Players share
triggers with each other, so trigger text, packages and log lines are
untrusted input.

## Where things are

- `main.js`: Electron main process entry (ES module).
- `src/electron/data/`: data stores and their migrations (`migrations/`).
- `src/electron/threads/`: hidden windows doing the work: `log-watcher.js`
  (matches every log line against the triggers), `combat-watcher.js`,
  `renderer.js` / `renderer.html` (the overlays).
- `src/electron/utilities/`: shared helpers (`string.js` shortcodes like
  `{S}`, `{N}`, `{TS}`; `html.js` sanitizing; `perf.js` timing taps).
- `src/app/`: the Angular UI (main window, dialogs, editors).
- `tools/perf/`: performance test; `tools/lint/`: style check.
- `.github/workflows/`: Test build, Pre-release, Release, Code style.

## Commands

- Build the UI: `npx ng build --configuration=production`. Never pass
  `--base-href ./`; it breaks the trigger windows.
- Run from source: `npx electron .` (set `NAG_DEV=0` to run without dev mode
  and its DevTools windows).
- Style check of your changes: `npm run lint`. Fix everything it reports on
  the lines you changed before you finish.
- Performance test: `npm run perf -- --log <EverQuest log>`
  (`tools/perf/README.md`).

## Code style (summary of Code Styles.md)

The goal is code a newcomer can understand. Prefer the clearer code when a
rule would make it harder to read.

- Long, descriptive names; no abbreviations. Functions start with a verb,
  booleans read as questions (`isEnabled`).
- Every class, function and method has a `/** ... */` summary with
  `@param` descriptions. Comments explain why, not what; complex code
  (regular expressions, timing math) gets an explanation and an example.
- 10 empty lines between methods, functions and classes.
- Class order: properties (with `@Input` / `@Output`), then the constructor
  (every Angular component has one, even empty), then lifecycle handlers
  (`ngOnInit` etc.: no summary, one empty line apart, under 10 lines each),
  then methods.
- No commented-out code.
- Comments wrap at 100 characters (code at 140); wrapped lines line up with the text above,
  e.g. a long `@param` continues under its description. For an exceptionally long name or
  type, indent the wrapped lines 8 spaces from the start of the tag instead.
- 4-space indents; spaces inside parentheses, brackets and braces:
  `fn( a, b )`, `list[ 0 ]`, `{ key: value }`; empty ones stay closed:
  `fn()`, `[]`. No space after a function name; a space after `function`
  when it has no name: `function ( event ) {`.
- Braces on every `if` / `else` / loop; opening brace on the same line.
- `if` / `else if` instead of `switch`, unless you need fall-through.
- Run code with `if`, not with `a && doSomething()`. Ternaries are fine for
  picking a value; nested ones go one level per line.
- `const` unless reassigned, then `let`; never `var`. `===`, not `==`.
  Single quotes; template literals for inserting values. Semicolons.
- Lines under 140 characters (long regexes, URLs and strings excepted).
- No `console.log` in committed code; use the existing logging.
- Match the surrounding code. Don't reformat code you aren't changing.

## Rules you must follow

- **Never read EverQuest's process memory.** Only the log files and the
  game's files on disk.
- **Sanitize HTML** from triggers, packages and logs with `sanitizeHtml()`
  before `innerHTML` or `bypassSecurityTrustHtml`. Don't add new ways for
  windows to navigate or open external sites; allowed sites are listed in
  `externalLinkOrigins` in `main.js`.
- **Never commit secrets** (tokens, passwords, signing credentials). Nothing
  in this repository needs them.
- **Keep per-line code fast.** Code in `log-watcher.js`, the shortcodes in
  `string.js`, built-in trigger phrases and the combat parser run on every
  log line. Built-in phrases start with `^` and a literal word, use bounded
  patterns like `[^!]*` instead of `.*`, and non-capturing groups `(?:...)`.
  Measure changes with the performance test.
- **Stored data changes need a migration.** If you change the shape of saved
  triggers, overlays, characters or settings, add a migration step and bump
  the version in `src/electron/data/migrations/`.
- **Don't change versions, tags or releases.** The workflows set the version
  for each build; don't edit `"version"` in `package.json` (except to start
  a new series, see RELEASING.md), and don't create tags, push, or publish
  releases unless a maintainer asks.
- **The performance taps never ship.** Release and Pre-release builds remove
  `perf-taps.js`; don't make release code depend on it.
