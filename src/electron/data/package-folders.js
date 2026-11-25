'use strict';

/**
 * Returns a copy of the package folder tree in which every folder id appears
 * once. Packages published before the package editor fix listed a moved
 * trigger's folder twice, once in place and once at the root, under the same
 * id; installing both copies put the triggers in the root copy and left the
 * real folder empty. The deepest copy is kept, because the stray copies were
 * always added at the root, but never one nested inside another copy of the
 * same id: dropping its outer copy would take the kept one with it. Children
 * of a dropped copy move to the kept copy. The package editor has the same
 * rule in NewTriggerPackageComponent.removeStrayPackageFolders.
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

        // Only an outermost copy can be kept; a copy inside another copy 
        // would be removed together with that outer copy.
        const isInsideAnotherCopy = occurrence =>
            duplicated.some( other => other !== occurrence && containsNode( other.folder.children, occurrence.folder ) );
        const outermost = duplicated.filter( occurrence => !isInsideAnotherCopy( occurrence ) );
        let keep = outermost[ 0 ];
        for ( const occurrence of outermost ) {
            if ( occurrence.depth > keep.depth ) {
                keep = occurrence;
            }
        }

        // Remove one other copy per pass: removing a second copy in the same
        // pass could use a sibling list the first move already changed.
        const drop = duplicated.find( occurrence => occurrence !== keep );
        for ( const child of drop.folder.children ?? [] ) {
            // Skip a child that holds the kept copy, so the tree never loops.
            const childHoldsKeptCopy = containsNode( [ child ], keep.folder );
            // A child whose id the kept copy already has is still moved; the
            // next pass merges the two, so nothing below it is lost.
            if ( !childHoldsKeptCopy ) {
                keep.folder.children.push( child );
            }
        }
        drop.siblings.splice( drop.siblings.indexOf( drop.folder ), 1 );
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
    return folders.filter( folder => folder !== null && typeof folder === 'object' ).map( folder => ( {
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
 * Returns true when the given folder object sits anywhere in the trees.
 * 
 * @param {PackageFolder[]} folders The trees to search.
 * @param {PackageFolder} node The folder object to look for.
 * @returns {boolean} True when found.
 */
function containsNode( folders, node ) {
    return ( folders ?? [] ).some( folder => folder === node || containsNode( folder.children, node ) );
}










module.exports = { removeDuplicatePackageFolders };
