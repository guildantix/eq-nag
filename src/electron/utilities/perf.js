// Performance taps: timings for Nag's hot paths, for finding slowdowns.
//
// The timing code lives in perf-taps.js, which Release and Pre-release builds
// remove (see .github/actions/build-nag).  Without it, or when Nag isn't
// started with --perf, everything here is a no-op: callers check
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

if ( process.argv.includes( '--perf' ) ) {
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
