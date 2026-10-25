"""Version numbers and release notes for the Test build, Pre-release and
Release workflows.

Versions are <series>.<build>, e.g. 0.2.27.  The series (0.2) comes from
package.json; the build number goes up by one for every pre-release and
release, and test builds are <next version>-beta.<n>.  Nobody edits versions
by hand: each workflow asks this script for the next one.

Commands (run from the repository root, with GH_TOKEN and GITHUB_REPOSITORY):
  version test|pre|release      print the version to build
  release-source                print "<tag> <commit>" of the pre-release to release
  draft pre|release VERSION SHA FILE...
                                create or update the draft release VERSION
"""
import json
import os
import re
import subprocess
import sys

REPO = os.environ['GITHUB_REPOSITORY']
MARKER_RE = re.compile(r'\n*<!-- generated through ([0-9a-f]{40}) -->\s*$')
THIS_REPO_AUTHOR = 'Antix Guild'


def run( *args ):
    return subprocess.check_output( args, text=True, encoding='utf-8' ).strip()


def gh( *args, data=None ):
    out = subprocess.check_output( [ 'gh', *args ], input=json.dumps( data ) if data is not None else None, text=True, encoding='utf-8' )
    return json.loads( out ) if out.strip().startswith( ( '[', '{' ) ) else out


def normalize( body ):
    """Release notes edited on GitHub can have Windows line endings."""
    return ( body or '' ).replace( '\r\n', '\n' )


def releases():
    pages = gh( 'api', '--paginate', '--slurp', f'repos/{REPO}/releases?per_page=100' )
    return [ r for page in pages for r in page ]


def series():
    with open( 'package.json', encoding='utf-8' ) as f:
        version = json.load( f )[ 'version' ]
    return '.'.join( version.split( '.' )[ :2 ] )


def build_of( tag, s ):
    """Returns 27 for v0.2.27 in series 0.2, otherwise None."""
    m = re.fullmatch( re.escape( f'v{s}.' ) + r'(\d+)', tag or '' )
    return int( m.group( 1 ) ) if m else None


def pending_draft( rels, s, prerelease ):
    """The build number of an unpublished draft of the given kind, if any."""
    builds = [ build_of( r[ 'tag_name' ], s ) for r in rels if r[ 'draft' ] and r[ 'prerelease' ] == prerelease ]
    return max( [ b for b in builds if b is not None ], default=None )


def next_version( kind ):
    s = series()
    rels = releases()
    builds = [ build_of( r[ 'tag_name' ], s ) for r in rels ]
    builds += [ build_of( t, s ) for t in run( 'git', 'tag', '--list', f'v{s}.*' ).splitlines() ]
    next_build = max( [ b for b in builds if b is not None ], default=0 ) + 1

    if kind == 'release':
        return f'{s}.{pending_draft( rels, s, False ) or next_build}'

    # A pending pre-release draft keeps its number until it's published.
    build = pending_draft( rels, s, True ) or next_build
    if kind == 'pre':
        return f'{s}.{build}'

    beta_re = re.escape( f'test-{s}.{build}-beta.' ) + r'(\d+)'
    betas = [ int( m.group( 1 ) ) for r in rels if ( m := re.fullmatch( beta_re, r[ 'tag_name' ] ) ) ]
    return f'{s}.{build}-beta.{max( betas, default=0 ) + 1}'


def published( rels, s ):
    return [ r for r in rels if not r[ 'draft' ] and build_of( r[ 'tag_name' ], s ) is not None ]


def prereleases_to_release( rels, s ):
    """Published pre-releases newer than the latest full release, oldest first."""
    pub = published( rels, s )
    last_full = max( [ build_of( r[ 'tag_name' ], s ) for r in pub if not r[ 'prerelease' ] ], default=-1 )
    pres = [ r for r in pub if r[ 'prerelease' ] and build_of( r[ 'tag_name' ], s ) > last_full ]
    return sorted( pres, key=lambda r: build_of( r[ 'tag_name' ], s ) )


def release_source():
    s = series()
    pres = prereleases_to_release( releases(), s )
    if not pres:
        sys.exit( '::error::There is no published pre-release newer than the latest release. Run Pre-release first.' )
    tag = pres[ -1 ][ 'tag_name' ]
    return f'{tag} {run( "git", "rev-list", "-n", "1", tag )}'


def change_lines( since, until ):
    """One line per commit that changed the app (src/ or main.js)."""
    log = run( 'git', 'log', '--no-merges', '--reverse', '--format=%s%x1f%an', f'{since}..{until}', '--', 'src', 'main.js' )
    lines = []
    for entry in log.splitlines():
        subject, author = entry.split( '\x1f' )
        lines.append( f'- {subject}' + ( '' if author == THIS_REPO_AUTHOR else f' ({author})' ) )
    return lines


def prerelease_notes( tag, sha, body ):
    """Adds the app changes since the last published release (or since the
    previous run on this draft) below whatever the maintainer has written."""
    marker = MARKER_RE.search( body )
    if marker:
        since = marker.group( 1 )
        body = body[ :marker.start() ]
    else:
        since = run( 'git', 'describe', '--tags', '--abbrev=0', '--match', 'v*', '--exclude', tag, sha )
    lines = change_lines( since, sha )
    if lines:
        heading = '### More changes to write up' if marker else '### Changes to write up'
        body = body.rstrip() + ( '\n\n' if body.strip() else '' ) + heading + '\n' + '\n'.join( lines )
    return body.rstrip() + f'\n\n<!-- generated through {sha} -->\n'


def release_notes( rels, s ):
    """The notes of every pre-release since the latest full release, newest first."""
    pres = prereleases_to_release( rels, s )
    parts = []
    for r in reversed( pres ):
        notes = MARKER_RE.sub( '', normalize( r.get( 'body' ) ) ).strip()
        parts.append( f'## {r[ "tag_name" ]}\n\n{notes or "_No notes._"}' )
    return '\n\n'.join( parts ) + '\n'


def draft( kind, version, sha, files ):
    s = series()
    tag = f'v{version}'
    rels = releases()
    existing = next( ( r for r in rels if r[ 'tag_name' ] == tag ), None )
    if existing and not existing[ 'draft' ]:
        sys.exit( f'::error::{tag} is already published.' )

    body = normalize( ( existing or {} ).get( 'body' ) )
    if kind == 'pre':
        body = prerelease_notes( tag, sha, body )
    elif not body.strip():
        # A release draft is filled once; later runs keep the maintainer's edits.
        body = release_notes( rels, s )

    with open( 'release-notes.md', 'w', encoding='utf-8' ) as f:
        f.write( body )

    label = [ '--prerelease' ] if kind == 'pre' else [ '--prerelease=false', '--latest' ]
    if existing:
        gh( 'release', 'upload', tag, *files, '--repo', REPO, '--clobber' )
        gh( 'release', 'edit', tag, '--repo', REPO, '--draft', '--target', sha, '--notes-file', 'release-notes.md', *label )
    else:
        gh( 'release', 'create', tag, *files, '--repo', REPO, '--draft', '--target', sha, '--title', tag, '--notes-file', 'release-notes.md', *label )
    print( f'Draft {tag} is ready: https://github.com/{REPO}/releases' )


if __name__ == '__main__':
    command = sys.argv[ 1 ]
    if command == 'version':
        print( next_version( sys.argv[ 2 ] ) )
    elif command == 'release-source':
        print( release_source() )
    elif command == 'draft':
        draft( sys.argv[ 2 ], sys.argv[ 3 ], sys.argv[ 4 ], sys.argv[ 5: ] )
    else:
        sys.exit( f'Unknown command: {command}' )
