// Performance taps: timings for Nag's hot paths, for finding slowdowns.
//
// The timing code lives in perf-taps.js, which Release and Pre-release builds
// remove (see .github/actions/build-nag).  Without it, or when Nag isn't
// started with --perf (or built with perf-always-on.json, as the Test build
// workflow's perf portable is), everything here is a no-op: callers check
// `perf.enabled` (a constant) before timing anything.
//
// Usage:
//     const t = perf.enabled ? perf.now() : 0;
//     ...work...
//     perf.enabled && perf.record( 'log-watcher: line', t );
//     perf.record( name, t, 10 );   // when only timing 1 call in 10: scales it up
//
//     fn = perf.wrap( 'renderer: render', fn );   // returns fn itself when disabled
//
// See tools/perf/README.md.

let taps = null;

// The perf test build ships perf-always-on.json so testers don't need --perf.
let alwaysOn = false;
try {
    alwaysOn = !!require( './perf-always-on.json' );
} catch {
    // Not a perf build.
}

if ( alwaysOn || process.argv.includes( '--perf' ) ) {
    // Child processes (log watchers, overlays) inherit this.
    process.env.NAG_PERF = '1';
}

if ( process.env.NAG_PERF === '1' ) {
    try {
        taps = require( './perf-taps' );
    } catch {
        // Release build: the taps were removed.
    }
}

module.exports = taps ?? {
    enabled: false,
    now: () => 0,
    record: () => { },
    wrap: ( name, fn ) => fn,
};
