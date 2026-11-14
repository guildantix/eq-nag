// Checks the lines you changed against "Code Styles.md".
//
//   npm run lint                      compares your work with origin/development
//   npm run lint -- --base <commit>   compares with another commit
//
// Runs ESLint (eslint.config.js) on the changed files and reports only the
// problems on lines that were added or changed, so older code that doesn't
// follow the guide yet doesn't get in the way. Also checks that methods,
// functions and classes are separated by 10 empty lines, which ESLint has no
// rule for. In GitHub Actions the problems are shown on the pull request.

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const repo = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
const require = createRequire( import.meta.url );
const { loadESLint } = require( 'eslint' );

const lintedFile = /^(src\/electron\/.*\.js|src\/app\/.*\.ts|tools\/.*\.mjs|[^/]+\.js)$/;
const emptyLinesBetweenMembers = 10;









/**
 * Runs git in the repository and returns its output.
 *
 * @param {string[]} args The git arguments.
 */
function git( args ) {
    return execFileSync( 'git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 } );
}










/**
 * The commit to compare with: --base, or where this branch left origin/development.
 */
function findBase() {
    const index = process.argv.indexOf( '--base' );
    if ( index > -1 ) {
        return process.argv[ index + 1 ];
    }
    return git( [ 'merge-base', 'HEAD', 'origin/development' ] ).trim();
}










/**
 * Returns the changed files and, for each, the line numbers that were added
 * or changed since the base commit (including uncommitted work).
 *
 * @param {string} base The commit to compare with.
 * @returns {Map<string, Set<number>>}
 */
function changedLines( base ) {
    const files = new Map();
    const diff = git( [ 'diff', '-U0', '--diff-filter=ACMR', '--no-color', base, '--' ] );
    let currentFile = null;

    for ( const line of diff.split( '\n' ) ) {
        const fileHeader = /^\+\+\+ b\/(.+)$/.exec( line );
        if ( fileHeader ) {
            currentFile = lintedFile.test( fileHeader[ 1 ] ) ? fileHeader[ 1 ] : null;
            if ( currentFile ) {
                files.set( currentFile, new Set() );
            }
            continue;
        }

        // "@@ -12,3 +14,5 @@" means lines 14 to 18 are new or changed.
        const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec( line );
        if ( hunk && currentFile ) {
            const start = +hunk[ 1 ];
            const count = hunk[ 2 ] === undefined ? 1 : +hunk[ 2 ];
            for ( let lineNumber = start; lineNumber < start + count; lineNumber++ ) {
                files.get( currentFile ).add( lineNumber );
            }
        }
    }

    // New files that aren't committed yet: every line is new.
    for ( const file of git( [ 'ls-files', '--others', '--exclude-standard' ] ).split( '\n' ) ) {
        if ( lintedFile.test( file ) ) {
            const lineCount = fs.readFileSync( path.join( repo, file ), 'utf8' ).split( /\r?\n/ ).length;
            files.set( file, new Set( Array.from( { length: lineCount }, ( value, index ) => index + 1 ) ) );
        }
    }

    return files;
}










/**
 * Finds summaries (/**) on changed lines that follow another member without
 * exactly 10 empty lines in between. A summary counts as following a member
 * when the last non-empty line before it is a closing brace at the same
 * indentation.
 *
 * @param {string} file The file, relative to the repository.
 * @param {Set<number>} lines The changed line numbers.
 */
function checkMemberSpacing( file, lines ) {
    const problems = [];
    const text = fs.readFileSync( path.join( repo, file ), 'utf8' ).split( /\r?\n/ );

    for ( const lineNumber of lines ) {
        const summary = /^(\s*)\/\*\*/.exec( text[ lineNumber - 1 ] ?? '' );
        if ( !summary ) {
            continue;
        }

        let previous = lineNumber - 2;
        while ( previous >= 0 && text[ previous ].trim() === '' ) {
            previous--;
        }
        const emptyLines = lineNumber - 2 - previous;
        const closesMember = previous >= 0 && new RegExp( `^${summary[ 1 ]}\\}[);]*$` ).test( text[ previous ] );

        if ( closesMember && emptyLines !== emptyLinesBetweenMembers ) {
            problems.push( {
                line: lineNumber,
                column: 1,
                ruleId: 'member-spacing',
                message: `Put ${emptyLinesBetweenMembers} empty lines between members (found ${emptyLines}).`,
            } );
        }
    }

    return problems;
}









const base = findBase();
const files = changedLines( base );

if ( files.size === 0 ) {
    console.log( 'No changed JavaScript or TypeScript files to check.' );
    process.exit( 0 );
}

// ESLint 8 needs to be told to use eslint.config.js.
const FlatESLint = await loadESLint( { useFlatConfig: true } );
const eslint = new FlatESLint( { cwd: repo } );
const results = await eslint.lintFiles( [ ...files.keys() ] );
const inGitHub = process.env.GITHUB_ACTIONS === 'true';
let problemCount = 0;

for ( const result of results ) {
    const file = path.relative( repo, result.filePath ).split( path.sep ).join( '/' );
    const lines = files.get( file ) ?? new Set();
    const problems = [
        ...result.messages.filter( message => message.fatal || lines.has( message.line ) ),
        ...checkMemberSpacing( file, lines ),
    ].sort( ( a, b ) => a.line - b.line );

    for ( const problem of problems ) {
        problemCount++;
        if ( inGitHub ) {
            console.log( `::error file=${file},line=${problem.line},col=${problem.column ?? 1},title=${problem.ruleId ?? 'error'}::${problem.message}` );
        } else {
            console.log( `${file}:${problem.line}:${problem.column ?? 1}  ${problem.message}  (${problem.ruleId ?? 'error'})` );
        }
    }
}

if ( problemCount > 0 ) {
    console.log( `\n${problemCount} problem(s) on changed lines. See "Code Styles.md".` );
    process.exit( 1 );
}
console.log( `Checked ${files.size} changed file(s): no problems on changed lines.` );
