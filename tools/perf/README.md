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
(`.github/actions/build-nag`). Test builds keep it, so a tester can run
`eq_nag_portable.exe --perf` and send you `perf-report.json` from
`%APPDATA%\electron-angular-eq-parse`. It contains timings and trigger
names, nothing else.

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
