/*
 * Live regex tester for the Nag docs.
 *
 * Plain browser JavaScript: no build step, no libraries and no network requests.
 * It runs the same JavaScript RegExp engine as Nag, and expands Nag's snippets
 * the same way Nag does (see expandPhrase and renderText).
 */
( function () {
  'use strict';

  var SLOT_COUNT = 4;
  var TIMESTAMP_RX = /^\[(.*?)\]\s*/i;

  var PRESETS = [
    { id: 'tell', name: 'Tell', log: "Fizzlethorp tells you, 'Can I get a port to the Nexus?'", phrase: "^{S1} tells you, '{S2}'$", text: 'Tell from {S1}: {S2}' },
    { id: 'damage', name: 'Damage {N}', log: 'You crush a training dummy for 1234 points of damage.', phrase: '^You (?:crush|slash|pierce) {S1} for {N1>=1000} points of damage\\.$', text: 'Big hit: {N1} on {S1}' },
    { id: 'emote', name: 'Emote ~', log: '~ Soandso wonders how they died.', phrase: '^(?:~ )?{C} wonders how they died\\.$', text: '{C}: opening Death Recap' },
    { id: 'raid', name: 'Raid {TS}', log: "Lord Vexwick shouts, 'The floor gives way in 2 minutes 30 seconds!'", phrase: "^Lord Vexwick shouts, 'The floor gives way in {TS}!'$", text: 'Floor in {TS}', mode: 'timer' },
    { id: 'named', name: 'Named group', log: 'You begin casting Boil Blood.', phrase: '^You begin casting (?<Spell>.+)\\.$', text: 'Casting ${Spell}' },
    { id: 'slain', name: 'Slain (a|b)', log: 'a cave lurker was slain by Soandso!', phrase: '^(.+?) (?:has been|was) slain by {S1}!$', text: '{1} died to {S1}' },
    { id: 'variable', name: 'Variable', log: 'Your Boil Blood spell is interrupted.', phrase: '^Your ${SpellBeingCast} spell is interrupted\\.$', text: 'Interrupted: ${SpellBeingCast}' },
    { id: 'counter', name: 'Counter', log: 'You have been slain by a cave lurker!', phrase: '^You have been slain by {S1}!$', text: 'Deaths tonight: +{Deaths} (last: {S1})' },
    { id: 'noanchor', name: 'No anchor', log: "Fizzlethorp says out of character, 'You have been slain lol'", phrase: 'You have been slain', text: 'You died!' },
    { id: 'lazy', name: 'Lazy trap', log: "Fizzlethorp tells you, 'Can I get a port?'", phrase: "^{S1} tells you, '{S2}", text: '{S2}' },
    { id: 'broken', name: 'Broken (', log: 'Your Shield of Dreams (Rk. II) spell has worn off.', phrase: '^Your Shield of Dreams (Rk. II spell has worn off\\.$', text: 'Rebuff!' }
  ];

  var root = typeof window !== 'undefined' ? window : globalThis;
  var DEFAULT_VARIABLES = 'SpellBeingCast=Boil Blood\nCurrentZone=Testvale Caverns';
  var DEFAULT_COUNTERS = 'Deaths=3';

  /* ---------- Ports of Nag's own functions ---------- */

  // Port of string.js isNullOrWhitespace.
  function isNullOrWhitespace( value ) {
    if ( value === null || value === undefined || value.replace( /\s+/gi, '' ).length === 0 ) {
      return true;
    }
  }

  // Port of string.js compare.
  function compare( a, b, caseSensitive ) {
    var aNil = isNullOrWhitespace( a );
    var bNil = isNullOrWhitespace( b );

    if ( aNil && bNil ) {
      return true;
    } else if ( ( !aNil && bNil ) || ( aNil && !bNil ) ) {
      return false;
    }

    caseSensitive = caseSensitive === false ? false : true;

    if ( caseSensitive ) {
      return a === b;
    } else {
      return a.toLowerCase() === b.toLowerCase();
    }
  }

  // Port of string.js getDurationLabel.
  function getDurationLabel( seconds ) {
    if ( seconds > 0 ) {
      var hours = Math.floor( seconds / 3600 );
      var mins = Math.floor( ( seconds % 3600 ) / 60 );
      var secs = seconds % 60;
      var label = '';

      if ( hours > 0 ) {
        label += hours + 'h ';
      }
      if ( mins > 0 ) {
        label += mins + 'm ';
      }
      if ( secs > 0 ) {
        label += secs + 's ';
      }

      return label;

    } else if ( seconds ) {
      return seconds + 's';

    } else {
      return 'unknown';
    }
  }

  // Port of string.js getDurationFromLabel.
  function getDurationFromLabel( label ) {
    if ( label ) {
      var matches = Array.from( label.matchAll( /(?<hours>[0-9]+(?:\.[0-9]+)?)\s*h|(?<minutes>[0-9]+(?:\.[0-9]+)?)\s*m|(?<seconds>[0-9]+(?:\.[0-9]+)?)\s*s/gi ) );
      if ( matches.length > 0 ) {
        var duration = 0;

        matches.forEach( function ( m ) {
          if ( m.groups.hours ) {
            duration += parseFloat( m.groups.hours ) * 3600;
          } else if ( m.groups.minutes ) {
            duration += parseFloat( m.groups.minutes ) * 60;
          } else if ( m.groups.seconds ) {
            duration += parseFloat( m.groups.seconds );
          }
        } );

        return duration;
      }

      var milMatches = /(?:(?<hours>[0-9]+):)?(?<minutes>[0-9]+):(?<seconds>[0-9]+)/gi.exec( label );
      if ( milMatches && milMatches.length > 0 ) {
        var milDuration = 0;

        if ( milMatches.groups.hours ) {
          milDuration += parseInt( milMatches.groups.hours ) * 3600;
        }
        if ( milMatches.groups.minutes ) {
          milDuration += parseInt( milMatches.groups.minutes ) * 60;
        }
        if ( milMatches.groups.seconds ) {
          milDuration += parseInt( milMatches.groups.seconds );
        }

        return milDuration;
      }
    }

    return parseFloat( label );
  }

  /**
   * Turns a capture phrase into the regular expression text Nag runs.
   *
   * Port of Nag's phrase expansion. It follows the order in
   * src/electron/threads/log-watcher.js (generateTriggerFns, regex branch):
   * string.js parseNConditionalCodesToRegex, then parseShortCodesToRegex, then
   * parseStoredVariablesToRegexConditional. List codes ({L1}) and sequential
   * groups (?{name}) are not handled here.
   *
   * @param {string} phrase The phrase as typed in Nag.
   * @param {string} characterName The current character's name.
   * @param {function} makeId Returns the random id Nag puts in generated group names.
   * @returns {{source: string, nChecks: object[], varChecks: object[]}}
   */
  function expandPhrase( phrase, characterName, makeId ) {
    var value = phrase;
    var nChecks = [];
    var varChecks = [];

    // parseNConditionalCodesToRegex: {N>=9000} style first, then {N[1,5]} style.
    if ( !isNullOrWhitespace( value ) ) {
      var ginaMatches = Array.from( value.matchAll( /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/gi ) );

      if ( ginaMatches.length > 0 ) {
        value = value.replace( /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/gi, '(?<N$1>-?[0-9]+)' );
        ginaMatches.forEach( function ( m ) {
          var operator = m[ 2 ];
          var opVal = +m[ 3 ];
          var operation = {
            label: m[ 0 ],
            nIndex: +m[ 1 ] > 0 ? +m[ 1 ] : undefined,
            validateFns: []
          };

          if ( operator === '>' ) {
            operation.validateFns.push( function ( nValue ) { return nValue > opVal; } );
          } else if ( operator === '>=' ) {
            operation.validateFns.push( function ( nValue ) { return nValue >= opVal; } );
          } else if ( operator === '<' ) {
            operation.validateFns.push( function ( nValue ) { return nValue < opVal; } );
          } else if ( operator === '<=' ) {
            operation.validateFns.push( function ( nValue ) { return nValue <= opVal; } );
          } else if ( operator === '=' ) {
            operation.validateFns.push( function ( nValue ) { return nValue == opVal; } );
          } else if ( operator === '!=' ) {
            operation.validateFns.push( function ( nValue ) { return nValue != opVal; } );
          }

          nChecks.push( operation );
        } );

      } else {
        var nagMatches = Array.from( value.matchAll( /{N([0-9]*?)(\[|\()(.*?),(.*?)(\]|\))}/gi ) );

        if ( nagMatches.length > 0 ) {
          value = value.replace( /{N([0-9]*?)(\[|\()(.*?),(.*?)(\]|\))}/gi, '(?<N$1>-?[0-9]+)' );
          nagMatches.forEach( function ( m ) {
            var nIndex = +m[ 1 ];
            var leftHandeOp = m[ 2 ];
            var opVal1 = m[ 3 ].match( /[A-z]+/ ) || m[ 3 ] === '' ? undefined : +m[ 3 ];
            var opVal2 = m[ 4 ].match( /[A-z]+/ ) || m[ 4 ] === '' ? undefined : +m[ 4 ];
            var rightHandeOp = m[ 5 ];
            var operation = {
              label: m[ 0 ],
              nIndex: nIndex > 0 ? nIndex : undefined,
              validateFns: []
            };

            if ( leftHandeOp === '[' ) {
              operation.validateFns.push( function ( nValue ) { return opVal1 === undefined || nValue >= opVal1; } );
            } else if ( leftHandeOp === '(' ) {
              operation.validateFns.push( function ( nValue ) { return opVal1 === undefined || nValue > opVal1; } );
            }

            if ( rightHandeOp === ']' ) {
              operation.validateFns.push( function ( nValue ) { return opVal2 === undefined || nValue <= opVal2; } );
            } else if ( rightHandeOp === ')' ) {
              operation.validateFns.push( function ( nValue ) { return opVal2 === undefined || nValue < opVal2; } );
            }

            nChecks.push( operation );
          } );
        }
      }
    }

    // parseShortCodesToRegex
    if ( value ) {
      value = value.replace( /{LN}/gi, '(?<nag_listname>.+?)' );

      var unitPattern =
        '(?:' +
          '(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)' +
          '(?:[(]s[)]|s)?' +
        '|' +
          '[hms]' +
        ')' +
        '(?![A-Za-z])';

      value = value.replace(
        /{TS}/i,
        '(?<timerDuration>' +
          '(?:' +
            '\\b' +
            '[0-9]+' +
            ':' +
            '[0-9]+' +
            '(?:' +
              ':' +
              '[0-9]+' +
            ')?' +
            '\\b' +
          '|' +
            '\\b' +
            '[0-9]+' +
            '(?:' +
              '\\.' +
              '[0-9]+' +
            ')?' +
            '\\s*' +
            unitPattern +
            '(?:' +
              '\\s*' +
              '[0-9]+' +
              '(?:' +
                '\\.' +
                '[0-9]+' +
              ')?' +
              '\\s*' +
              unitPattern +
            ')*' +
            '(?:' +
              '\\s*' +
              '[0-9]+' +
              '(?:' +
                '\\.' +
                '[0-9]+' +
              ')?' +
              '\\b' +
            ')?' +
          '|' +
            '\\b' +
            '[0-9]+' +
            '(?:' +
              '\\.' +
              '[0-9]+' +
            ')?' +
            '\\b' +
          ')' +
        ')'
      );

      value = value.replace( /{C}/gi, characterName );
      value = value.replace( /\${Character}/gi, characterName );
      value = value.replace( /{S([0-9]*?)}/gi, '(?<S$1>.+?)' );
      value = value.replace( /{N([0-9]*?)}/gi, '(?<N$1>[0-9]+)' );
    }

    // parseStoredVariablesToRegexConditional: only the first ${name} is handled.
    var result = /\${(.[^}]*)}/g.exec( value );

    if ( result && result.length > 1 ) {
      for ( var i = 1; i < result.length; i++ ) {
        var check = { key: result[ i ], name: 'nag_' + makeId() };
        value = value.replace( RegExp( '\\${' + result[ i ] + '}', 'g' ), '(?<' + check.name + '>.+?)' );
        varChecks.push( check );
      }
    }

    return { source: value, nChecks: nChecks, varChecks: varChecks };
  }

  /**
   * Fills captured values and stored values into text such as Display Text,
   * timer names and Speak phrases.
   *
   * Port of the render order in src/electron/threads/log-watcher.js
   * (displayTextComponent for Display Text, displayTimerCountdownComponent and
   * speakPhrase for the rest): string.js parseShortCodeValuesToLiteral,
   * parseStoredVariablesToLiteral, parseMatchesToLiteral and
   * parseCountersToLiteral. Display Text applies counters before matches.
   *
   * @param {string} text The text as typed in Nag.
   * @param {object} ctx characterName, duration (seconds), match (RegExp result),
   *   storedVariables, counters and deltaTime.
   * @param {boolean} displayText True when rendering a Display Text action.
   */
  function renderText( text, ctx, displayText ) {
    var value = text;
    var match = ctx.match;
    var groups = match ? match.groups : null;
    var logEntry = match ? match[ 0 ] : null;

    // parseShortCodeValuesToLiteral
    if ( value ) {
      value = value.replace( /{TS}/gi, getDurationLabel( ctx.duration ) );
      value = value.replace( /{C}/gi, ctx.characterName );
      value = value.replace( /{L}/gi, logEntry );
      if ( groups ) {
        Object.keys( groups ).forEach( function ( key ) {
          if ( key.match( /^[N|S][0-9]{0,}$/gi ) ) {
            var rgx = new RegExp( '{' + key + '}', 'gi' );
            value = value.replace( rgx, groups[ key ] );
          }
        } );
      }
    }

    // parseStoredVariablesToLiteral
    function storedToLiteral() {
      if ( isNullOrWhitespace( value ) ) {
        return;
      }

      var namedResults = Array.from( value.matchAll( /\${(.[^}]*)}/g ) );

      for ( var m = 0; m < namedResults.length; m++ ) {
        var key = namedResults[ m ][ 1 ];
        var values = ctx.storedVariables[ key ];
        if ( values && values.length > 0 ) {
          var joined = values[ 0 ];

          for ( var i = 1; i < values.length; i++ ) {
            joined += ',' + values[ i ];
          }

          value = value.replace( RegExp( '\\${' + key + '}', 'g' ), joined );
        }
      }
    }

    // parseCountersToLiteral
    function countersToLiteral() {
      if ( isNullOrWhitespace( value ) ) {
        return;
      }

      var indexedResults = Array.from( value.matchAll( /\+{(.[^}]*)}/g ) );

      for ( var i = 0; i < indexedResults.length; i++ ) {
        var key = indexedResults[ i ][ 1 ];
        if ( ctx.counters[ key ] != null ) {
          value = value.replace( RegExp( '\\+{' + key + '}', 'g' ), ctx.counters[ key ].value );
        }
      }
    }

    // parseMatchesToLiteral
    function matchesToLiteral() {
      if ( isNullOrWhitespace( value ) || match == null ) {
        return;
      }

      var namedResults = Array.from( value.matchAll( /\${(.[^}]*)}/g ) );

      if ( namedResults.length > 0 && groups != null ) {
        for ( var m = 0; m < namedResults.length; m++ ) {
          var key = namedResults[ m ][ 1 ];

          if ( key === 'deltaTime' ) {
            value = value.replace( RegExp( '\\${' + key + '}', 'g' ), ctx.deltaTime );
          } else if ( groups[ key ] != null ) {
            value = value.replace( RegExp( '\\${' + key + '}', 'g' ), groups[ key ] );
          }
        }
      }

      var indexedResults = Array.from( value.matchAll( /(:?#|\$)?{([0-9]+?)}/g ) );

      for ( var i = 0; i < indexedResults.length; i++ ) {
        var index = +indexedResults[ i ][ indexedResults[ i ].length - 1 ];
        if ( match[ index ] != null ) {
          if ( indexedResults[ i ][ 1 ] === '$' || indexedResults[ i ][ 1 ] === '#' ) {
            value = value.replace( RegExp( '(#|\\$)\\{' + index + '\\}', 'g' ), match[ index ] );
          } else {
            value = value.replace( RegExp( '\\{' + index + '\\}', 'g' ), match[ index ] );
          }
        }
      }
    }

    storedToLiteral();
    if ( displayText ) {
      countersToLiteral();
      matchesToLiteral();
    } else {
      matchesToLiteral();
      countersToLiteral();
    }

    return value;
  }

  /* ---------- Matching ---------- */

  function cleanError( error ) {
    return String( error.message ).replace( /^Invalid regular expression: (?:\/.*\/[a-z]*: )?/, '' );
  }

  /**
   * Runs a phrase against a log line the way Nag does.
   *
   * @returns {{expansion: object, regex: RegExp, match: RegExpExecArray, error: string, failed: string}}
   */
  function runMatch( line, phrase, options ) {
    var out = { expansion: null, regex: null, match: null, error: '', failed: '' };
    var expansion;
    try {
      expansion = expandPhrase( phrase, options.characterName, options.makeId );
    } catch ( expandError ) {
      out.expansion = { source: phrase, nChecks: [], varChecks: [] };
      out.error = cleanError( expandError );
      return out;
    }
    out.expansion = expansion;

    var flags = options.ignoreCase ? 'i' : '';
    try {
      out.regex = new RegExp( expansion.source, 'd' + flags );
    } catch ( withIndices ) {
      try {
        out.regex = new RegExp( expansion.source, flags );
      } catch ( error ) {
        out.error = cleanError( error );
        return out;
      }
    }

    var match = out.regex.exec( line );

    if ( match && match.groups ) {
      for ( var v = 0; v < expansion.varChecks.length; v++ ) {
        var check = expansion.varChecks[ v ];
        var found = false;
        var values = options.storedVariables[ check.key ];

        if ( match.groups[ check.name ] && values && values.length > 0 ) {
          for ( var i = 0; i < values.length; i++ ) {
            if ( compare( match.groups[ check.name ], values[ i ] ) ) {
              match.groups[ check.key ] = values[ i ];
              found = true;
              break;
            }
          }
        }

        if ( !found ) {
          out.failed = values && values.length > 0
            ? '${' + check.key + '} did not equal a stored value'
            : '${' + check.key + '} has no stored value';
          return out;
        }
      }
    }

    if ( match && expansion.nChecks.length > 0 ) {
      for ( var o = 0; o < expansion.nChecks.length; o++ ) {
        var op = expansion.nChecks[ o ];
        var nValue = op.nIndex == undefined ? +match.groups.N : +match.groups[ 'N' + op.nIndex ];
        var pass = true;

        for ( var f = 0; f < op.validateFns.length; f++ ) {
          pass = op.validateFns[ f ]( nValue );
          if ( !pass ) {
            break;
          }
        }

        if ( !pass ) {
          out.failed = op.label + ' check failed for ' + nValue;
          return out;
        }
      }
    }

    out.match = match;
    return out;
  }

  /**
   * Lists the capturing groups of an expanded regular expression, left to right.
   */
  function scanGroups( source ) {
    var groups = [];
    var inClass = false;
    var i = 0;

    while ( i < source.length ) {
      var c = source.charAt( i );
      if ( c === '\\' ) {
        i += 2;
        continue;
      }
      if ( inClass ) {
        if ( c === ']' ) {
          inClass = false;
        }
        i++;
        continue;
      }
      if ( c === '[' ) {
        inClass = true;
        i++;
        continue;
      }
      if ( c === '(' ) {
        if ( source.charAt( i + 1 ) !== '?' ) {
          groups.push( { name: null } );
        } else {
          var named = /^\(\?<([A-Za-z_$][A-Za-z0-9_$]*)>/.exec( source.slice( i ) );
          if ( named ) {
            groups.push( { name: named[ 1 ] } );
          }
        }
      }
      i++;
    }

    return groups;
  }

  /**
   * Describes each capturing group: its chip label, its kind and how to use it in text.
   */
  function describeGroups( expansion ) {
    var meta = {};
    var groups = scanGroups( expansion.source );

    groups.forEach( function ( g, n ) {
      var index = n + 1;
      var name = g.name;
      var check = null;

      if ( name === null ) {
        meta[ index ] = { label: 'group ' + index, use: '{' + index + '}', kind: 'cap', glyph: '( )' };
      } else if ( name === 'timerDuration' ) {
        meta[ index ] = { label: '{TS}', use: '{TS}', kind: 'cap', glyph: '⏱', ts: true };
      } else if ( name === 'nag_listname' ) {
        meta[ index ] = { label: '{LN}', use: '', kind: 'cap', glyph: 'Aa' };
      } else if ( /^S[0-9]*$/.test( name ) ) {
        meta[ index ] = { label: '{' + name + '}', use: '{' + name + '}', kind: 'cap', glyph: 'Aa', text: true };
      } else if ( /^N[0-9]*$/.test( name ) ) {
        expansion.nChecks.forEach( function ( op ) {
          if ( 'N' + ( op.nIndex || '' ) === name ) {
            check = op.label;
          }
        } );
        meta[ index ] = { label: check || '{' + name + '}', use: '{' + name + '}', kind: 'cap', glyph: '#' };
      } else if ( /^nag_/.test( name ) ) {
        var key = null;
        expansion.varChecks.forEach( function ( c ) {
          if ( c.name === name ) {
            key = c.key;
          }
        } );
        meta[ index ] = { label: '${' + key + '}', use: '${' + key + '}', kind: 'val', glyph: '$', variable: key };
      } else {
        meta[ index ] = { label: '(?<' + name + '>)', use: '${' + name + '}', kind: 'cap', glyph: '⚑' };
      }
    } );

    return meta;
  }

  /* ---------- Parsing the typed phrase for display ---------- */

  function tokenize( phrase ) {
    var tokens = [];
    var opens = [];
    var depth = [];
    var cap = 0;
    var i = 0;
    var firstVar = null;
    var ginaPresent = /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/i.test( phrase );
    var tsSeen = false;
    var m;

    while ( i < phrase.length ) {
      var rest = phrase.slice( i );

      if ( ( m = /^{LN}/i.exec( rest ) ) ) {
        cap++;
        tokens.push( { k: 'snip', s: m[ 0 ], g: 'Aa', cap: cap } );
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^{TS}/i.exec( rest ) ) ) {
        if ( tsSeen ) {
          tokens.push( { k: 'plain', s: m[ 0 ], why: 'Nag only expands the first {TS} in a phrase' } );
        } else {
          tsSeen = true;
          cap++;
          tokens.push( { k: 'snip', s: m[ 0 ], g: '⏱', cap: cap } );
        }
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^{C}/i.exec( rest ) ) || ( m = /^\${Character}/i.exec( rest ) ) ) {
        tokens.push( { k: 'char', s: m[ 0 ] } );
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/i.exec( rest ) ) || ( !ginaPresent && ( m = /^{N([0-9]*?)(\[|\()(.*?),(.*?)(\]|\))}/i.exec( rest ) ) ) ) {
        cap++;
        tokens.push( { k: 'snip', s: m[ 0 ], g: '#', cap: cap } );
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^{S([0-9]*?)}/i.exec( rest ) ) ) {
        cap++;
        tokens.push( { k: 'snip', s: m[ 0 ], g: 'Aa', cap: cap } );
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^{N([0-9]*?)}/i.exec( rest ) ) ) {
        cap++;
        tokens.push( { k: 'snip', s: m[ 0 ], g: '#', cap: cap } );
        i += m[ 0 ].length;
        continue;
      }
      if ( ( m = /^\${(.[^}]*)}/.exec( rest ) ) ) {
        if ( firstVar === null ) {
          firstVar = m[ 1 ];
        }
        if ( m[ 1 ] === firstVar ) {
          cap++;
          tokens.push( { k: 'var', s: m[ 0 ], cap: cap } );
        } else {
          tokens.push( { k: 'plain', s: m[ 0 ], why: 'Nag only expands the first ${Variable} in a phrase' } );
        }
        i += m[ 0 ].length;
        continue;
      }

      var c = phrase.charAt( i );

      if ( c === '\\' ) {
        var pair = phrase.slice( i, i + 2 );
        tokens.push( { k: /^\\[dDwWsSbB]$/.test( pair ) ? 'sh' : 'esc', s: pair } );
        i += 2;
        continue;
      }
      if ( c === '[' ) {
        var j = i + 1;
        if ( phrase.charAt( j ) === '^' ) {
          j++;
        }
        while ( j < phrase.length && phrase.charAt( j ) !== ']' ) {
          if ( phrase.charAt( j ) === '\\' ) {
            j++;
          }
          j++;
        }
        tokens.push( { k: j < phrase.length ? 'class' : 'err', s: phrase.slice( i, j + 1 ) } );
        i = j + 1;
        continue;
      }
      if ( c === '(' ) {
        if ( ( m = /^\(\?<([A-Za-z_][A-Za-z0-9_]*)>/.exec( rest ) ) ) {
          cap++;
          depth.push( cap );
          opens.push( tokens.length );
          tokens.push( { k: 'open', s: m[ 0 ], name: m[ 1 ], cap: cap } );
          i += m[ 0 ].length;
          continue;
        }
        if ( ( m = /^\(\?(?::|=|!|<=|<!)/.exec( rest ) ) ) {
          depth.push( 0 );
          opens.push( tokens.length );
          tokens.push( { k: 'open', s: m[ 0 ], cap: 0 } );
          i += m[ 0 ].length;
          continue;
        }
        cap++;
        depth.push( cap );
        opens.push( tokens.length );
        tokens.push( { k: 'open', s: '(', cap: cap } );
        i++;
        continue;
      }
      if ( c === ')' ) {
        if ( depth.length ) {
          opens.pop();
          tokens.push( { k: 'close', s: ')', cap: depth.pop() } );
        } else {
          tokens.push( { k: 'err', s: ')' } );
        }
        i++;
        continue;
      }
      if ( ( m = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/.exec( rest ) ) ) {
        tokens.push( { k: 'q', s: m[ 0 ] } );
        i += m[ 0 ].length;
        continue;
      }
      if ( c === '^' || c === '$' ) {
        tokens.push( { k: 'anchor', s: c } );
      } else if ( c === '|' ) {
        tokens.push( { k: 'alt', s: c } );
      } else if ( c === '.' ) {
        tokens.push( { k: 'dot', s: c } );
      } else {
        tokens.push( { k: 'lit', s: c } );
      }
      i++;
    }

    while ( opens.length ) {
      tokens[ opens.pop() ].k = 'err';
    }

    return tokens;
  }

  /* ---------- Rendering ---------- */

  function esc( s ) {
    return String( s ).replace( /[&<>"']/g, function ( c ) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ];
    } );
  }

  function slotClass( n ) {
    return 'nag-s' + ( ( ( n - 1 ) % SLOT_COUNT ) + 1 );
  }

  function chipHtml( kind, glyph, label, slot ) {
    return '<span class="nag-chip nag-' + kind + ( slot ? ' ' + slotClass( slot ) : '' ) + '"><span class="nag-gl" aria-hidden="true">' + esc( glyph ) + '</span>' + esc( label ) + '</span>';
  }

  function highlightPhrase( tokens ) {
    var html = '';

    tokens.forEach( function ( t ) {
      var s = esc( t.s || '' );

      switch ( t.k ) {
        case 'snip':
          html += chipHtml( 'cap', t.g, t.s, t.cap );
          break;
        case 'char':
          html += chipHtml( 'val', '@', t.s );
          break;
        case 'var':
          html += chipHtml( 'val', '$', t.s );
          break;
        case 'plain':
          html += '<span class="rx-err" title="' + esc( t.why ) + '">' + s + '</span>';
          break;
        case 'open':
          if ( t.cap ) {
            html += '<span class="rx-grp ' + slotClass( t.cap ) + '"><span class="rx-paren">' + ( t.name ? '(?&lt;<span class="rx-gname">' + esc( t.name ) + '</span>&gt;' : '(' ) + '</span>';
          } else {
            html += '<span class="rx-grp rx-nc"><span class="rx-paren">' + s + '</span>';
          }
          break;
        case 'close':
          html += '<span class="rx-paren">)</span></span>';
          break;
        case 'q':
          html += '<span class="rx-q">' + s + '</span>';
          break;
        case 'anchor':
          html += '<span class="rx-anchor">' + s + '</span>';
          break;
        case 'dot':
          html += '<span class="rx-dot">' + s + '</span>';
          break;
        case 'alt':
          html += '<span class="rx-alt">' + s + '</span>';
          break;
        case 'sh':
          html += '<span class="rx-sh">' + s + '</span>';
          break;
        case 'esc':
          html += '<span class="rx-esc">' + s + '</span>';
          break;
        case 'class':
          html += '<span class="rx-class">' + s + '</span>';
          break;
        case 'err':
          html += '<span class="rx-err" title="Unmatched or unclosed">' + s + '</span>';
          break;
        default:
          html += t.s === ' ' ? '<span class="rx-lit rx-sp"> </span>' : '<span class="rx-lit">' + s + '</span>';
      }
    } );

    return html;
  }

  function renderLog( line, match, meta ) {
    if ( !match ) {
      return '<span class="nomatch">' + esc( line ) + '</span>';
    }

    var start = match.index;
    var end = start + match[ 0 ].length;
    var owner = [];
    var p;

    for ( p = 0; p < line.length; p++ ) {
      owner.push( 0 );
    }

    if ( match.indices ) {
      var spans = [];
      for ( var g = 1; g < match.length; g++ ) {
        var ix = match.indices[ g ];
        if ( ix && meta[ g ] ) {
          spans.push( { g: g, a: ix[ 0 ], b: ix[ 1 ] } );
        }
      }
      spans.sort( function ( x, y ) { return ( y.b - y.a ) - ( x.b - x.a ); } ).forEach( function ( sp ) {
        for ( var k = sp.a; k < sp.b; k++ ) {
          owner[ k ] = sp.g;
        }
      } );
    }

    var html = esc( line.slice( 0, start ) );
    var current = -1;
    var buffer = '';
    var seen = {};

    function flush() {
      if ( !buffer ) {
        return;
      }
      if ( current > 0 ) {
        var tag = seen[ current ] ? '' : ' data-tag="' + esc( meta[ current ].label ) + '"';
        seen[ current ] = true;
        var cls = meta[ current ].kind === 'val' ? 'nag-val' : slotClass( current );
        html += '<span class="hit ' + cls + '"' + tag + '>' + esc( buffer ) + '</span>';
      } else {
        html += '<span class="m">' + esc( buffer ) + '</span>';
      }
      buffer = '';
    }

    for ( p = start; p < end; p++ ) {
      if ( owner[ p ] !== current ) {
        flush();
        current = owner[ p ];
      }
      buffer += line.charAt( p );
    }
    flush();

    return html + '<span class="nomatch">' + esc( line.slice( end ) ) + '</span>';
  }

  /* ---------- Page wiring ---------- */

  function parseKeyValues( text, splitValues ) {
    var out = {};
    String( text || '' ).split( /\r?\n/ ).forEach( function ( row ) {
      var at = row.indexOf( '=' );
      var key = row.slice( 0, at ).trim();
      if ( at > 0 && key ) {
        var raw = row.slice( at + 1 ).trim();
        out[ key ] = splitValues ? ( raw ? raw.split( '|' ) : [] ) : { value: +raw };
      }
    } );
    return out;
  }

  function placeholderId() {
    return 'xxxxxxxxxxxxxxxx';
  }

  function init( rootEl ) {
    if ( rootEl.hasAttribute( 'data-ready' ) ) {
      return;
    }
    var live = rootEl.querySelector( '[data-role="live"]' );
    var fallback = rootEl.querySelector( '[data-role="static"]' );

    function part( role ) {
      return rootEl.querySelector( '[data-role="' + role + '"]' );
    }

    try {
      new RegExp( '(?<a>a)', 'd' );
    } catch ( unsupported ) {
      return;
    }

    var fields = {
      log: part( 'log' ),
      phrase: part( 'phrase' ),
      text: part( 'text' ),
      character: part( 'character' ),
      ignoreCase: part( 'ignore-case' ),
      mode: part( 'mode' ),
      duration: part( 'duration' ),
      variables: part( 'variables' ),
      counters: part( 'counters' )
    };
    var presetBox = part( 'presets' );
    var buttons = [];
    var pending = null;

    function refresh() {
      var raw = fields.log.value;
      var line = raw.replace( TIMESTAMP_RX, '' );
      var characterName = fields.character.value || 'Soandso';
      var storedVariables = parseKeyValues( fields.variables.value, true );
      storedVariables.Character = [ characterName ];
      var counters = parseKeyValues( fields.counters.value, false );
      var phrase = fields.phrase.value;
      var tokens = tokenize( phrase );
      var status = part( 'status' );
      var table = part( 'table' );
      var out = runMatch( line, phrase, {
        characterName: characterName,
        ignoreCase: fields.ignoreCase.checked,
        storedVariables: storedVariables,
        makeId: placeholderId
      } );

      part( 'phrase-view' ).innerHTML = highlightPhrase( tokens ) || '<span class="rx-lit">(empty)</span>';

      if ( phrase.length === 0 ) {
        part( 'expanded' ).textContent = '';
        part( 'stripped' ).textContent = '';
        status.className = 'status no';
        status.textContent = 'No phrase: this trigger never fires';
        part( 'log-view' ).innerHTML = renderLog( line, null, {} );
        table.innerHTML = '<tr><td colspan="3" class="faint">Nag skips empty phrases.</td></tr>';
        part( 'rendered' ).textContent = '(nothing: the trigger did not fire)';
        return;
      }

      part( 'expanded' ).textContent = out.expansion.source;
      part( 'stripped' ).textContent = raw === line ? '' : 'Nag removes the [timestamp] before matching, so it was left out here.';

      if ( out.error ) {
        status.className = 'status err';
        status.textContent = 'Invalid phrase: ' + out.error;
        part( 'log-view' ).innerHTML = renderLog( line, null, {} );
        table.innerHTML = '<tr><td colspan="3">Nag logs a parse error and the trigger never fires. The Regex Visualizer marks the problem in red.</td></tr>';
        part( 'rendered' ).textContent = '';
        return;
      }

      var match = out.match;
      var meta = describeGroups( out.expansion );

      if ( out.failed ) {
        status.className = 'status no';
        status.textContent = 'Matched, but ' + out.failed + ': the trigger does not fire';
      } else if ( match ) {
        status.className = 'status ok';
        status.textContent = '✓ Fires';
      } else {
        status.className = 'status no';
        status.textContent = 'No match: the trigger does not fire';
      }

      var shown = match;
      part( 'log-view' ).innerHTML = renderLog( line, shown, meta );

      var rows = '';
      var timerSeconds = null;
      Object.keys( meta ).map( Number ).sort( function ( a, b ) { return a - b; } ).forEach( function ( index ) {
        var mt = meta[ index ];
        var value = shown ? shown[ index ] : undefined;
        var extra = '';

        if ( mt.ts && value ) {
          timerSeconds = getDurationFromLabel( value );
          extra += ' <small>= ' + esc( timerSeconds ) + ' s timer</small>';
        }
        if ( mt.variable ) {
          var stored = storedVariables[ mt.variable ];
          extra += ' <small>(stored: ' + ( stored && stored.length ? esc( stored.join( ', ' ) ) : 'nothing' ) + ')</small>';
        }
        if ( mt.text && value && value.length === 1 ) {
          extra += ' <small class="warn">one character: a lazy capture at the end of a phrase</small>';
        }

        rows += '<tr><td>' + chipHtml( mt.kind, mt.glyph, mt.label, mt.kind === 'val' ? 0 : index ) + '</td><td class="mono">' +
          ( value != null ? esc( value ) : '<span class="faint">&mdash;</span>' ) + extra + '</td><td>' + ( mt.use ? '<code>' + esc( mt.use ) + '</code>' : '' ) + '</td></tr>';
      } );
      if ( /{C}|\${Character}/i.test( phrase ) ) {
        rows += '<tr><td>' + chipHtml( 'val', '@', '{C}' ) + '</td><td class="mono">' + esc( characterName ) + ' <small>(fixed text, not a capture)</small></td><td><code>{C}</code></td></tr>';
      }
      table.innerHTML = rows || '<tr><td colspan="3" class="faint">No captures in this phrase.</td></tr>';

      if ( shown ) {
        var displayMode = fields.mode.value === 'display';
        var actionDuration = +fields.duration.value;
        var duration = !displayMode && timerSeconds ? timerSeconds : actionDuration;
        try {
          part( 'rendered' ).textContent = renderText( fields.text.value, {
            characterName: characterName,
            duration: duration,
            match: shown,
            storedVariables: storedVariables,
            counters: counters,
            deltaTime: 0
          }, displayMode );
        } catch ( renderError ) {
          part( 'rendered' ).textContent = '(Nag could not render this text: ' + renderError.message + ')';
        }
      } else {
        part( 'rendered' ).textContent = '(nothing: the trigger did not fire)';
      }
    }

    function markPreset( id ) {
      buttons.forEach( function ( b ) {
        b.button.setAttribute( 'aria-pressed', String( b.id === id ) );
      } );
    }

    function loadPreset( id ) {
      var p = null;
      PRESETS.forEach( function ( candidate ) {
        if ( candidate.id === id ) {
          p = candidate;
        }
      } );
      if ( !p ) {
        return;
      }
      fields.log.value = p.log;
      fields.phrase.value = p.phrase;
      fields.text.value = p.text;
      fields.ignoreCase.checked = false;
      fields.mode.value = p.mode === 'timer' ? 'timer' : 'display';
      markPreset( id );
      refresh();
    }

    PRESETS.forEach( function ( p ) {
      var button = document.createElement( 'button' );
      button.type = 'button';
      button.className = 'preset';
      button.textContent = p.name;
      button.setAttribute( 'aria-pressed', 'false' );
      button.addEventListener( 'click', function () {
        loadPreset( p.id );
      } );
      presetBox.appendChild( button );
      buttons.push( { id: p.id, button: button } );
    } );

    fields.variables.value = DEFAULT_VARIABLES;
    fields.counters.value = DEFAULT_COUNTERS;
    fields.duration.value = '5';

    [ fields.log, fields.phrase, fields.text, fields.character, fields.variables, fields.counters, fields.duration ].forEach( function ( el ) {
      el.addEventListener( 'input', function () {
        if ( el === fields.log || el === fields.phrase || el === fields.text ) {
          markPreset( null );
        }
        root.clearTimeout( pending );
        pending = root.setTimeout( refresh, 150 );
      } );
    } );
    fields.ignoreCase.addEventListener( 'change', refresh );
    fields.mode.addEventListener( 'change', refresh );

    rootEl.setAttribute( 'data-ready', '' );
    live.hidden = false;
    if ( fallback ) {
      fallback.hidden = true;
    }
    loadPreset( rootEl.getAttribute( 'data-preset' ) || PRESETS[ 0 ].id );
  }

  var api = {
    expandPhrase: expandPhrase,
    renderText: renderText,
    runMatch: runMatch,
    getDurationFromLabel: getDurationFromLabel,
    getDurationLabel: getDurationLabel,
    PRESETS: PRESETS
  };

  if ( typeof module !== 'undefined' && module.exports ) {
    module.exports = api;
  }

  if ( typeof document !== 'undefined' ) {
    var start = function () {
      Array.prototype.forEach.call( document.querySelectorAll( '[data-regex-tester]' ), init );
    };
    if ( document.readyState === 'loading' ) {
      document.addEventListener( 'DOMContentLoaded', start );
    } else {
      start();
    }
  }
} )();
