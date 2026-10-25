// Minimal Chrome DevTools Protocol helper for driving Nag's Electron windows.
export const sleep = ms => new Promise( r => setTimeout( r, ms ) );

export async function targets( port ) {
    return ( await fetch( `http://127.0.0.1:${port}/json/list` ) ).json();
}

export async function waitForTarget( port, match, timeoutMs = 30000 ) {
    const end = Date.now() + timeoutMs;
    while ( Date.now() < end ) {
        try {
            const t = ( await targets( port ) ).find( t => t.type === 'page' && match( t ) );
            if ( t ) return t;
        } catch { }
        await sleep( 500 );
    }
    throw new Error( 'target not found' );
}

export async function connect( target, { onConsole } = {} ) {
    const ws = new WebSocket( target.webSocketDebuggerUrl );
    await new Promise( r => ws.addEventListener( 'open', r ) );
    let id = 0;
    const pending = new Map();
    ws.addEventListener( 'message', ev => {
        const msg = JSON.parse( ev.data );
        if ( msg.id && pending.has( msg.id ) ) { pending.get( msg.id )( msg ); pending.delete( msg.id ); return; }
        if ( onConsole && msg.method === 'Runtime.exceptionThrown' )
            onConsole( 'exception', msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text );
        if ( onConsole && msg.method === 'Runtime.consoleAPICalled' && [ 'error', 'warning' ].includes( msg.params.type ) )
            onConsole( msg.params.type, msg.params.args.map( a => a.value ?? a.description ).join( ' ' ) );
    } );
    const send = ( method, params = {} ) => new Promise( r => { const i = ++id; pending.set( i, r ); ws.send( JSON.stringify( { id: i, method, params } ) ); } );
    const evaluate = async expr => {
        const res = await send( 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true } );
        if ( res.result?.exceptionDetails ) throw new Error( res.result.exceptionDetails.exception?.description ?? 'evaluate failed' );
        return res.result?.result?.value;
    };
    return { ws, send, evaluate, close: () => ws.close() };
}
