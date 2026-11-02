// ESLint rules for Nag, matching "Code Styles.md".
//
// Run `npm run lint` to check the files you changed. Pull requests are checked
// the same way (.github/workflows/lint.yml): only the lines a pull request adds
// or changes are reported, so older code that doesn't follow the guide yet
// doesn't get in the way.

const stylistic = require( '@stylistic/eslint-plugin' );
const jsdoc = require( 'eslint-plugin-jsdoc' );
const tsParser = require( '@typescript-eslint/parser' );
const globals = require( 'globals' );

/** Rules shared by the JavaScript and TypeScript code. */
const styleRules = {
    // Readability
    'curly': [ 'error', 'all' ],
    'eqeqeq': [ 'error', 'always' ],
    'no-var': 'error',
    'prefer-const': [ 'error', { destructuring: 'all' } ],
    'no-unused-expressions': [ 'error', { allowShortCircuit: false, allowTernary: false } ],
    'no-console': [ 'error', { allow: [ 'warn', 'error' ] } ],

    // Formatting
    '@stylistic/semi': [ 'error', 'always' ],
    '@stylistic/quotes': [ 'error', 'single', { avoidEscape: true, allowTemplateLiterals: true } ],
    '@stylistic/space-in-parens': [ 'error', 'always' ],
    '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
    '@stylistic/computed-property-spacing': [ 'error', 'always' ],
    '@stylistic/object-curly-spacing': [ 'error', 'always' ],
    '@stylistic/template-curly-spacing': [ 'error', 'never' ],
    '@stylistic/brace-style': [ 'error', '1tbs', { allowSingleLine: false } ],
    '@stylistic/space-before-function-paren': [ 'error', { anonymous: 'always', named: 'never', asyncArrow: 'always' } ],
    '@stylistic/space-before-blocks': 'error',
    '@stylistic/keyword-spacing': 'error',
    '@stylistic/space-infix-ops': 'error',
    '@stylistic/comma-spacing': 'error',
    '@stylistic/key-spacing': 'error',
    '@stylistic/arrow-spacing': 'error',
    '@stylistic/no-tabs': 'error',
    // Whitespace-only lines (the gaps between members, " * " in summaries) are left alone.
    '@stylistic/no-trailing-spaces': [ 'error', { skipBlankLines: true, ignoreComments: true } ],
    '@stylistic/eol-last': 'error',
    '@stylistic/max-len': [ 'error', {
        code: 140,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: false,
    } ],

    // Everything gets a summary
    'jsdoc/require-jsdoc': [ 'error', {
        require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true },
        checkConstructors: false,
    } ],
    'jsdoc/require-description': 'error',
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
};

module.exports = [
    {
        ignores: [ 'dist/**', 'electron/**', 'node_modules/**', 'source-maps/**', '**/*.min.js' ],
    },
    {
        // Electron main process, windows and utilities (CommonJS)
        files: [ 'src/electron/**/*.js', '*.js' ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...globals.browser },
        },
        plugins: { '@stylistic': stylistic, jsdoc },
        rules: styleRules,
    },
    {
        // main.js and the tools use ES modules
        files: [ 'main.js', 'tools/**/*.mjs' ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        plugins: { '@stylistic': stylistic, jsdoc },
        rules: styleRules,
    },
    {
        // The tools print their results to the console.
        files: [ 'tools/**/*.mjs' ],
        rules: { 'no-console': 'off' },
    },
    {
        // Angular app (TypeScript): types are in the code, so @param lines only need a description
        files: [ 'src/app/**/*.ts' ],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        plugins: { '@stylistic': stylistic, jsdoc },
        settings: { jsdoc: { mode: 'typescript' } },
        rules: {
            ...styleRules,
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-returns-type': 'off',
        },
    },
];
