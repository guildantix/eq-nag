# Performance test

Replays a real EverQuest log against one or more Nag builds and compares how
much CPU they use. Use it whenever you change anything that runs per log line
(trigger matching, shortcodes like `{TS}`, the combat parser) or per overlay
update.

## Running it

Build the app once, then point the test at an EverQuest log, ideally a busy
raid:

```
npx ng build --configuration=production
npm run perf -- --log "C:\EverQuest\Logs\eqlog_Name_server.txt"
```

To compare builds, add each one with `--app` (`dev` is this repository):

```
npm run perf -- --log <eqlog> --app dev --app "C:\Downloads\eq_nag_portable.exe"
```

It takes about four minutes per build. Test windows open and close on your
screen while it runs; leave them alone.

| Option | |
|---|---|
| `--log <file>` | EverQuest log to replay (required). |
| `--app <exe or dev>` | Build to test; repeat to compare. Default: `dev`. |
| `--start <line>` | Line to start replaying from. Default: the busiest minute in the log. |
| `--seconds <n>` | How long to replay. Default 60. |
| `--idle <n>` | How long to measure before the replay, with no new lines. Default 30. |
| `--keep` | Keep the temporary folder (profiles, test log, `perf-report.json`). |

## What it does

1. Creates a test profile with this repository's build: two overlays, about
   300 raid-style triggers (a few that fire often and put text and timers on
   screen, most of them rarely matching) and a character whose log is a test
   file.
2. For each build: copies that profile, starts the build with `--perf`,
   measures CPU while idle, then replays the log at its original pace with
   current timestamps and measures again.
3. Prints CPU per build, and for builds with performance taps, where the time
   went and the slowest triggers.

CPU is shown as **% of one core**. Task Manager shows % of *all* cores, so
divide by your number of cores to compare with what it shows.

## Performance taps

Hot paths are timed through `src/electron/utilities/perf.js`: log lines,
each trigger, the per-line combat parser, the tick that rebuilds triggers,
overlay rendering, timer updates and HTML sanitizing. Taps do nothing unless
Nag is started with `--perf`; then every process sends its totals to the main
process, which writes `perf-report.json` to the user data folder every 10
seconds, with each process's CPU time.

The timing code itself is `perf-taps.js`. **Release and Pre-release builds
delete it** and check the finished app doesn't contain it
(`.github/actions/build-nag`).

Each test build has two portables: `eq_nag_portable.exe`, built exactly like
a release (no taps), and `eq_nag_portable-perf.exe`, the same code with the
taps switched on by default (the workflow adds `perf-always-on.json`). A
tester who sees Nag being slow runs the perf portable the same way and sends
you `perf-report.json` from `%APPDATA%\electron-angular-eq-parse`. It
contains timings and trigger names, nothing else.

`--perf` itself adds a little work: in a raid replay, about 1.5% of one core
on top of ~7%. Triggers are timed on one log line in ten (and scaled up) to
keep that low. Builds without taps are measured without that overhead, so
compare like with like when the difference is small.

To time something new:

```js
const perf = require( '../utilities/perf' );

const perfStart = perf.enabled ? perf.now() : 0;
doWork();
perf.enabled && perf.record( 'log-watcher: my work', perfStart );

// or wrap a whole function:
myFunction = perf.wrap( 'renderer: my function', myFunction );
```

## Trigger prefilter

Most log lines match no trigger, so the log watcher first looks up which
triggers can match a line (`src/electron/utilities/trigger-prefilter.js`) and
only runs those. Each phrase gives a literal its matches must contain; one
search over the lowered line marks the triggers whose literal is in it.
Phrases without a safe literal (shortcodes only, stored variables, anything
the scanner can't read) always run, as do sequential triggers with a sequence
in progress (and, with the trigger gate off, triggers with variable conditions).

- `--no-trigger-prefilter` (or `NAG_NO_TRIGGER_PREFILTER=1`) turns it off and
  runs every trigger on every line, as before.
- Perf builds add a `log-watcher: prefilter` tap, and these report notes:
  `prefilter` (phrases with a literal, always-run phrases and triggers,
  automaton size), `prefilter average candidates per line` and
  `prefilter and gate misses`. On one line in 100 the log watcher also parses the
  triggers the prefilter or gate skipped and counts any that matched (and
  logs a warning with the trigger name and id, at most once a minute); this
  should stay 0.

`tools/perf/prefilter-check.mjs` checks it without running Nag. With no
arguments it runs unit cases and a small synthetic library. To check a real
library against a real log, use copies:

```
node tools/perf/prefilter-check.mjs --triggers <trigger-database.json copy> --log <log copy>
```

It runs every phrase on every line and fails if a phrase matched a line it
wasn't a candidate for. It prints counts only, never phrases or log lines.

## Trigger gate

Before the prefilter looks at a line, the trigger gate
(`src/electron/utilities/trigger-gate.js`) decides which triggers can fire at
all right now: enabled, class, and every variable and counter condition, the
trigger's own and its folders', met by the stored values. Only the open
triggers go into the prefilter. The gate is re-checked for the triggers that
use a variable or counter when it changes (a zone change, a stored value, a
counter, Clear All) and rebuilt with the triggers on each tick. The prefilter
is rebuilt at the end of the batch of log lines; a trigger that opens during
a batch runs on every line until then, so nothing is missed. Sequential
triggers in the middle of a sequence are never gated out. Conditions on
named groups of the matched line are still checked after a match.

The log watcher also stores the zone itself when a line says
`You have entered <zone>.`, so zone conditions work with the Capture Zone
trigger disabled; with it enabled the zone is still stored once.

- The console shows `Triggers active in this zone: N of M` after each re-gate.
- `--no-trigger-gate` (or `NAG_NO_TRIGGER_GATE=1`) turns it off; triggers with
  variable conditions then run on every line again, as before.
- Perf builds check the skipped triggers on one line in 100 (the
  `prefilter and gate misses` note), which should stay 0.

`tools/perf/trigger-gate-check.mjs` runs unit cases against the real log
watcher with its Electron parts stubbed (zone change, variables set and used in
one batch, sequences, counters, loop-back, class, kill switch, and the gate
against the trigger's own condition check on random states). To compare a real
library against a real log, use copies:

```
node tools/perf/trigger-gate-check.mjs --triggers <trigger-database.json copy> --log <log copy> [--characters <characters-database.json copy>]
```

It runs the log three ways (every trigger on every line, prefilter only, gate
and prefilter) and fails if the gated run matched differently from the plain
one. It prints counts only.
