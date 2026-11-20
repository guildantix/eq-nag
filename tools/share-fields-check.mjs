/**
 * Fails when a field of a trigger, action, phrase, condition, folder or overlay model is
 * missing from the share allowlist in share-trigger-fields.js, or when the allowlist expects
 * another type than the model's default value has. Without this, a new model field is
 * silently stripped from every shared trigger, and a wrongly typed one is stripped or
 * mangled, and nobody notices.
 *
 * Run from the repository root: node tools/share-fields-check.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire( import.meta.url );
const repositoryRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const triggerModels = require( path.join( repositoryRoot, 'src/electron/data/models/trigger.js' ) );
const overlayModels = require( path.join( repositoryRoot, 'src/electron/data/models/overlay-window.js' ) );
const shareFieldsPath = path.join( repositoryRoot, 'src/electron/utilities/share-trigger-fields.js' );
const { shareFieldAllowlists } = require( shareFieldsPath );

/**
 * Model fields that are deliberately not on the allowlist, with the reason. Everything else
 * must be listed.
 */
const deliberatelyExcludedFields = {
    folder: {
        expanded: 'Screen state of the tree, not part of a share.',
        active: 'Screen state of the tree, not part of a share.',
        comments: 'Folder notes are not shared.',
        children: 'Cleaned separately, as nested folders.',
        folderConditions: 'Not shared.',
    },
};










/**
 * The JavaScript type each allowlist type name stands for, as 'array' for lists, so it can be
 * compared with the type of a model field's default value.
 */
const javaScriptTypeByAllowlistType = {
    text: 'string',
    icon: 'string',
    number: 'number',
    boolean: 'boolean',
    rectangle: 'object',
    textOverflow: 'object',
    textList: 'array',
    phraseList: 'array',
    actionList: 'array',
    conditionList: 'array',
    classLevelList: 'array',
    hotkeyList: 'array',
    subActionList: 'array',
    variableAssignmentList: 'array',
};










/**
 * Returns 'array' for a list, otherwise the typeof of the value.
 *
 * @param {any} value The value to describe.
 */
function describeValueType( value ) {
    return Array.isArray( value ) ? 'array' : typeof value;
}










/** Each allowlist, with the model classes whose fields it has to cover. */
const checks = [
    { allowlist: 'trigger', models: [ triggerModels.Trigger ] },
    { allowlist: 'action', models: [ triggerModels.TriggerAction ] },
    { allowlist: 'phrase', models: [ triggerModels.CapturePhrase ] },
    { allowlist: 'condition', models: [ triggerModels.TriggerCondition ] },
    { allowlist: 'classLevel', models: [ triggerModels.CharacterClassLevel ] },
    { allowlist: 'subAction', models: [ triggerModels.TriggerSubAction ] },
    { allowlist: 'variableAssignment', models: [ triggerModels.VariableAssignment ] },
    { allowlist: 'folder', models: [ triggerModels.TriggerFolder ] },
    { allowlist: 'overlay', models: [ overlayModels.OverlayWindow ] },
];

let checkedFieldCount = 0;
let typeComparedFieldCount = 0;
const problems = [];

checks.forEach( check => {
    const allowlist = shareFieldAllowlists[ check.allowlist ];
    const excluded = deliberatelyExcludedFields[ check.allowlist ] ?? {};

    check.models.forEach( ModelClass => {
        if ( typeof ModelClass !== 'function' ) {
            problems.push( `${check.allowlist}: the model class was not exported.` );
            return;
        }

        const modelInstance = new ModelClass();

        Object.keys( modelInstance ).forEach( fieldName => {
            checkedFieldCount++;

            const isListed = Object.prototype.hasOwnProperty.call( allowlist, fieldName );
            const isExcluded = Object.prototype.hasOwnProperty.call( excluded, fieldName );

            if ( !isListed && !isExcluded ) {
                problems.push( `${ModelClass.name}.${fieldName} is not in the ${check.allowlist} share allowlist.` );
            }

            const defaultValue = modelInstance[ fieldName ];

            // A null default says nothing about the real type, so only real defaults are compared.
            if ( isListed && defaultValue !== null && defaultValue !== undefined ) {
                typeComparedFieldCount++;
                const modelType = describeValueType( defaultValue );
                const allowlistType = javaScriptTypeByAllowlistType[ allowlist[ fieldName ] ] ?? `unknown type ${allowlist[ fieldName ]}`;

                if ( modelType !== allowlistType ) {
                    problems.push( `${ModelClass.name}.${fieldName}: model has ${modelType}, allowlist says ${allowlistType}` );
                }
            }
        } );
    } );
} );

if ( problems.length > 0 ) {
    problems.forEach( problem => console.error( problem ) );
    console.error( `share-fields-check: ${problems.length} problem(s) in ${checkedFieldCount} model fields.` );
    process.exit( 1 );
}

console.log( `share-fields-check: all ${checkedFieldCount} model fields are covered, ${typeComparedFieldCount} types compared.` );
