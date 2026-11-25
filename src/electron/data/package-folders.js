'use strict';

/**
 * Returns a copy of the package folder tree in which every folder id appears
 * once. Packages published before the package editor fix listed a moved
 * trigger's folder twice, once in place and once at the root, under the same
 * id; installing both copies put the triggers in the root copy and left the
 * real folder empty. The deepest copy is kept, because the stray copies were
 * always added at the root. Children of a dropped copy move to the kept copy.
 *
 * @param {PackageFolder[]} packageFolders The package's root folders.
 * @returns {PackageFolder[]} The de-duplicated tree; the input is not changed.
 */
function removeDuplicatePackageFolders( packageFolders ) {
    const folders = cloneFolders( packageFolders ?? [] );

    // Fix one duplicated id per pass and rescan, because merging children
    // changes where nested duplicates live. Each pass removes at least one
    // copy, so the loop ends.
    for ( ;; ) {
        const occurrencesByFolderId = new Map();
        collectOccurrences( folders, 0, occurrencesByFolderId );

        let duplicated = null;
        for ( const occurrences of occurrencesByFolderId.values() ) {
            if ( occurrences.length > 1 ) {
                duplicated = occurrences;
                break;
            }
        }
        if ( duplicated === null ) {
            return folders;
        }

        let keep = duplicated[ 0 ];
        for ( const occurrence of duplicated ) {
            if ( occurrence.depth > keep.depth ) {
                keep = occurrence;
            }
        }

        for ( const occurrence of duplicated ) {
            if ( occurrence === keep ) {
                continue;
            }
            for ( const child of occurrence.folder.children ?? [] ) {
                // Skip a child that holds the kept copy, so the tree never loops.
                const childHoldsKeptCopy = containsFolderId( [ child ], keep.folder.folderId );
                const alreadyKept = keep.folder.children.some( keptChild => keptChild.folderId === child.folderId );
                if ( !childHoldsKeptCopy && !alreadyKept ) {
                    keep.folder.children.push( child );
                }
            }
            occurrence.siblings.splice( occurrence.siblings.indexOf( occurrence.folder ), 1 );
        }
    }
}










/**
 * Deep-copies the folder tree so installing never changes the downloaded
 * package model.
 *
 * @param {PackageFolder[]} folders The folders to copy.
 * @returns {PackageFolder[]} The copies, each with a children array.
 */
function cloneFolders( folders ) {
    return folders.map( folder => ( {
        folderId: folder.folderId,
        name: folder.name,
        children: cloneFolders( folder.children ?? [] ),
    } ) );
}










/**
 * Records every place each folder id appears in the tree.
 *
 * @param {PackageFolder[]} folders The folders at this level.
 * @param {number} depth How deep this level is; the root is 0.
 * @param {Map<string, object[]>} occurrencesByFolderId Filled in by this call:
 *     folder id to its copies ({ folder, siblings, depth }).
 */
function collectOccurrences( folders, depth, occurrencesByFolderId ) {
    for ( const folder of folders ) {
        if ( !occurrencesByFolderId.has( folder.folderId ) ) {
            occurrencesByFolderId.set( folder.folderId, [] );
        }
        occurrencesByFolderId.get( folder.folderId ).push( { folder, siblings: folders, depth } );
        collectOccurrences( folder.children, depth + 1, occurrencesByFolderId );
    }
}










/**
 * Returns true when the folder id appears anywhere in the given trees.
 *
 * @param {PackageFolder[]} folders The trees to search.
 * @param {string} folderId The folder id to look for.
 * @returns {boolean} True when found.
 */
function containsFolderId( folders, folderId ) {
    return folders.some( folder => folder.folderId === folderId || containsFolderId( folder.children ?? [], folderId ) );
}

module.exports = { removeDuplicatePackageFolders };
