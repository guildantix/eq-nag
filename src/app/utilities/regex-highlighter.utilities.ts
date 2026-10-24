/*
 * REGEX SYNTAX HIGHLIGHTER
 *
 * This module provides comprehensive regex syntax highlighting for EQNag.
 * It converts regular expressions into HTML with color-coded syntax
 * highlighting to help users visualize and debug their regex patterns.
 *
 * FEATURES:
 * - Highlights all standard regex syntax (quantifiers, groups, character classes, etc.)
 * - Supports custom shortcodes ({LN}, {TS}, {C}, {S1}, {N1}, etc.)
 * - Handles premade JavaScript variables (${varName}, +{varName}) with special styling
 * - Provides error highlighting for common user mistakes
 * - Robust handling of edge cases and malformed regex patterns
 * - Index-safe handling of advanced {N} patterns and premade variables
 * - Groups consecutive literals into single spans for better CSS styling
 * - Proper highlighting for non-capture and lookaround groups
 * - Optimized HTML output with smart word breaks (<wbr>) and reduced span bloat
 *
 * PROCESSING PIPELINE:
 * 1. Parse custom shortcodes ({C} → ${Character}, {LN} → named groups, etc.)
 * 2. Extract and style premade variables, replacing them with safe placeholders
 * 3. Apply regex syntax highlighting to the processed string
 * 4. Restore styled variables and advanced {N} patterns from placeholders
 *
 * SYNTAX HIGHLIGHTING CLASSES:
 * - 'regex-' prefix on all to reduce risk of namespace conflict
 * - regex-literal: Regular text characters
 * - regex-shorthand: Shorthand escapes (\d, \w, \s, etc.)
 * - regex-escape: Other escape sequences (\n, \., etc.)
 * - regex-group: Parentheses for capturing groups
 * - regex-group-modifier: Special group prefixes ((?:, (?=, etc.)
 * - regex-named-group-*: Components of named groups (?<name>...)
 * - regex-non-capture-group: Non-capturing group wrapper (?:...)
 * - regex-lookaround-group: Lookahead/lookbehind group wrapper
 * - regex-class-bracket: Square brackets for character classes
 * - regex-class-content: Content inside character classes
 * - regex-class-special: Special chars in classes (^ at start, - in middle)
 * - regex-quantifier: Quantifiers (*, +, ?, {n,m})
 * - regex-anchor: Anchors (^, $)
 * - regex-alternation: Alternation operator (|)
 * - regex-special-char: Special characters (.)
 * - regex-variable-*: Components of premade variables
 * - regex-shortcode-advanced: Advanced {N} patterns with math operators
 * - regex-error: Invalid or problematic syntax
 *
 * ERROR DETECTION:
 * - Quantifiers without preceding quantifiable element (*hello, ^+)
 * - Invalid quantifier formats ({abc}, {5,3})
 * - Unclosed constructs ([abc, {3,)
 * - Invalid character class ranges ([z-a])
 * - Malformed named groups ((?<incomplete)
 * - Incomplete escape sequences at end of string (test\)
 * - Unmatched parentheses (lonely ( or ) without pairs)
 * - Unmatched braces for quantifiers ({3, or })
 *
 * CUSTOM SHORTCODES:
 * - {LN}: Named group for list names → (?<nag_listname>[A-Z][a-z]+?)
 * - {TS}: Timer duration pattern → complex time format regex (currently mirrored from string.js)
 * - {C}: Character placeholder → ${Character}
 * - {S1}, {S2}: String capture groups → (?<S1>.+?), (?<S2>.+?)
 * - {N1}, {N2}: Number capture groups → (?<N1>[0-9]+?), (?<N2>[0-9]+?)
 * - Advanced {N}: {N>122}, {N>=122}, {N(5,9)}, {N[120,124]} → preserved as-is
 *
 * PREMADE VARIABLES:
 * - ${varName}: Dollar-prefixed variables (must be valid JS identifiers)
 * - +{varName}: Plus-prefixed variables (must be valid JS identifiers)
 * - Variables with spaces or invalid characters are treated as literal text
 *
 * USAGE:
 * const highlighted = getRegexHighlightedHtml("(\w+) healed you for (?<healValue>\d+)\s", true);
 * // Returns HTML with proper syntax highlighting
 *
 * KNOWN LIMITATIONS:
 * - Does not support Unicode regex features (\p{...}, etc.)
 * - Limited to JavaScript regex engine capabilities
 * - Some edge cases with deeply nested constructs may not be handled perfectly
 *
 * NOTE:
 * This implementation is specifically tailored for the Nag phrase use case.
*/









/**
 * Safely escapes HTML special characters in literal text parts to prevent
 * injection and ensure proper display in HTML output.
 *
 * @param {string} text - The text string to escape.
 * @returns {string} The escaped HTML-safe string.
 */
function escapeHtml( text: string ): string {
    return text
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&#39;' );
}










/**
 * Helper class to build HTML with grouped literals.
 * This class accumulates adjacent literal characters into single spans
 * to reduce HTML bloat and improve CSS styling capabilities.
 */
class HtmlBuilder {
    private result: string = '';
    private pendingLiterals: string = '';










    /**
     * Flushes any pending literal characters into a single span element.
     * This method processes embedded HTML markers and escapes literal text
     * while preserving raw HTML elements that were marked for inclusion.
     */
    private flushLiterals(): void {
        if ( this.pendingLiterals.length > 0 ) {
            // Handle embedded HTML in literals
            let content = this.pendingLiterals;

            // Split by our HTML markers and process
            const parts = content.split( /§HTML§([^§]+)§/ );
            let processedContent = '';

            for ( let i = 0; i < parts.length; i++ ) {
                if ( i % 2 === 0 ) {
                    // Even indices are literal text - escape them
                    processedContent += escapeHtml( parts[i] );
                } else {
                    // Odd indices are HTML - keep them raw
                    processedContent += parts[i];
                }
            }

            this.result += `<span class="regex-literal">${processedContent}</span>`;
            this.pendingLiterals = '';
        }
    }










    /**
     * Adds a literal character to the current pending literal sequence.
     * Adjacent literal characters are grouped together until flushed.
     *
     * @param {string} char - The literal character to append to the pending buffer.
     */
    addLiteral( char: string ): void {
        this.pendingLiterals += char;
    }










    /**
     * Adds a literal character that includes raw HTML markup (such as `<wbr>`).
     * The HTML is stored in the pending literal span and will be injected later
     * when the literals are flushed. This allows non-breaking HTML elements
     * to be preserved within the literal text.
     *
     * @param {string} char - The literal character to append to the pending buffer.
     * @param {string} html - The raw HTML string to embed alongside the literal.
     */
    addLiteralWithHtml( char: string, html: string ): void {
        // If we have pending literals, include the HTML in the current span
        this.pendingLiterals += char;
        // We'll handle the HTML injection in flushLiterals
        this.pendingLiterals += `§HTML§${html}§`;
    }










    /**
     * Adds a span element with the specified class name. Flushes any pending
     * literals before adding the span to maintain proper grouping.
     *
     * @param {string} content - The text content to place inside the span.
     * @param {string} className - The CSS class name to apply to the span.
     * @param {boolean} addWordBreak - Whether to add a `<wbr>` tag after the span. Defaults to false.
     */
    addSpan(
        content: string,
        className: string,
        addWordBreak: boolean = false
    ): void {
        this.flushLiterals();
        const wbr = addWordBreak ? '<wbr>' : '';
        this.result += `<span class="${className}">${escapeHtml( content )}</span>${wbr}`;
    }










    /**
     * Adds raw HTML directly to the output. Flushes any pending literals
     * before adding the raw HTML to ensure proper ordering.
     *
     * @param {string} html - The raw HTML string to append to the output.
     */
    addRaw( html: string ): void {
        this.flushLiterals();
        this.result += html;
    }










    /**
     * Adds a word break opportunity (`<wbr>` tag) to the output.
     * Flushes any pending literals before adding the word break.
     */
    addWordBreak(): void {
        this.flushLiterals();
        this.result += '<wbr>';
    }










    /**
     * Gets the final HTML string by flushing any remaining pending literals
     * and returning the complete built HTML output.
     * 
     * @returns {string} The complete HTML string with all syntax highlighting.
     */
    toString(): string {
        this.flushLiterals();
        return this.result;
    }
}










/**
 * Determines whether a word break opportunity should be inserted at the
 * current position to improve text wrapping in long regex patterns.
 * 
 * @param {string} char - The current character being processed.
 * @param {string | undefined} nextChar - The next character in the string, if any.
 * @returns {boolean} True if a word break should be added, false otherwise.
 */
function shouldAddWordBreak(
    char: string,
    nextChar: string | undefined
): boolean {
    // Before opening constructs
    if ( '([{'.includes( char ) ) return true;
    // After closing constructs
    if ( ')]}*+?'.includes( char ) ) return true;
    // Before alternation
    if ( char === '|' ) return true;
    // After certain sequences when followed by different token types
    if ( char === '>' && nextChar && !'()[]{}*+?|'.includes( nextChar ) )
        return true;

    return false;
}










/**
 * Extracts and protects advanced {N} patterns from being converted during
 * the normal highlighting process. These patterns include comparison and
 * range operators like {N=8}, {N!=8}, {N>8}, {N<8}, {N>=8}, {N<=8},
 * {N(4,8)}, and {N[4,8]}.
 *
 * @param {string} input - The input string containing potential advanced {N} patterns.
 * @returns {{ processedInput: string; advancedN: string[] }} An object containing the processed input with placeholders and an array of styled advanced {N} patterns.
 */
function extractAdvancedN( input: string ): {
    processedInput: string;
    advancedN: string[];
} {
    const advancedN: string[] = [];
    // Accept >, <, >=, <=, !=, =, (m,n), [m,n]
    const advancedNPattern =
        /\{N(?:(?:>=|<=|!=|=|>|<)\d+|\(\d+,\d+\)|\[\d+,\d+\])\}/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const parts: string[] = [];
    let placeholderIndex = 0;

    while ( ( match = advancedNPattern.exec( input ) ) !== null ) {
        const fullMatch = match[0];
        const start = match.index;
        const end = advancedNPattern.lastIndex;

        parts.push( input.slice( lastIndex, start ) );

        // Extract condition part for styling
        const condition = fullMatch.slice( 2, -1 ); // drop {N and }
        const styledAdvancedN =
            `<span class="regex-shortcode-advanced">` +
            `<span class="regex-shortcode-advanced-prefix">{N</span>` +
            `<span class="regex-shortcode-advanced-content">${escapeHtml( condition )}</span>` +
            `<span class="regex-shortcode-advanced-suffix">}</span>` +
            `</span>`;

        advancedN.push( styledAdvancedN );
        const placeholder = `§ADVN${placeholderIndex}§`;
        parts.push( placeholder );
        placeholderIndex++;
        lastIndex = end;
    }

    parts.push( input.slice( lastIndex ) );
    return { processedInput: parts.join( '' ), advancedN };
}










/**
 * Extracts and styles premade variables, replacing them with safe placeholders.
 * Variables must follow the format ${varName} or +{varName} where varName is
 * a valid JavaScript identifier. This function is index-safe and preserves
 * the exact position of each variable for later restoration.
 * 
 * @param {string} input - The input string containing potential premade variables.
 * @returns {{ processedInput: string; variables: string[] }} An object containing the processed input with placeholders and an array of styled variable HTML.
 */
function extractVariables( input: string ): {
    processedInput: string;
    variables: string[];
} {
    const variables: string[] = [];
    const variablePattern = /([\$\+])\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const parts: string[] = [];
    let placeholderIndex = 0;

    while ( ( match = variablePattern.exec( input ) ) !== null ) {
        const fullMatch = match[0];
        const prefix = match[1];
        const varName = match[2];
        const start = match.index;
        const end = variablePattern.lastIndex;

        parts.push( input.slice( lastIndex, start ) );

        const styledVariable =
            `<span class="regex-variable">` +
            `<span class="regex-variable-prefix">${escapeHtml( prefix )}</span>` +
            `<span class="regex-variable-brace">{</span>` +
            `<span class="regex-variable-name">${escapeHtml( varName )}</span>` +
            `<span class="regex-variable-brace">}</span>` +
            `</span>`;

        variables.push( styledVariable );
        const placeholder = `§VAR${placeholderIndex}§`;
        parts.push( placeholder );
        placeholderIndex++;
        lastIndex = end;
    }

    parts.push( input.slice( lastIndex ) );
    return { processedInput: parts.join( '' ), variables };
}










/**
 * Restores protected content (variables and advanced {N} patterns) from
 * placeholders back into the highlighted HTML. This function ensures that
 * placeholders are properly replaced even when they end up inside literal
 * spans, by breaking out of those spans when necessary.
 * 
 * @param {string} highlightedText - The highlighted HTML string containing placeholders.
 * @param {string[]} variables - Array of styled variable HTML strings.
 * @param {string[]} advancedN - Array of styled advanced {N} pattern HTML strings.
 * @returns {string} The final HTML with all protected content restored.
 */
function restoreProtected(
    highlightedText: string,
    variables: string[],
    advancedN: string[]
): string {
    let result = highlightedText;

    // Helper function to break out of literal spans
    function breakOutOfLiteralSpan(
        html: string,
        placeholder: string,
        replacement: string
    ): string {
        // Simple pattern: find placeholder inside literal spans
        const pattern = new RegExp(
            `(<span class="regex-literal">)(.*?)${placeholder.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            )}(.*?)(</span>)`,
            'g'
        );

        return html.replace(
            pattern,
            ( match, openTag, before, after, closeTag ) => {
                let result = '';

                // 1. Close current literal span (with before content if any)
                if ( before.length > 0 ) {
                    result += openTag + before + closeTag;
                }

                // 2. Insert the styled replacement
                result += replacement;

                // 3. Open new literal span (with after content if any)
                if ( after.length > 0 ) {
                    result += openTag + after + closeTag;
                }

                return result;
            }
        );
    }

    // Restore variables
    variables.forEach( ( styledVariable, index ) => {
        const placeholder = `§VAR${index}§`;
        result = breakOutOfLiteralSpan( result, placeholder, styledVariable );
    } );

    // Restore advanced N patterns
    advancedN.forEach( ( styledAdvancedN, index ) => {
        const placeholder = `§ADVN${index}§`;
        result = breakOutOfLiteralSpan( result, placeholder, styledAdvancedN );
    } );

    return result;
}









/**
 * Checks if a character at the specified position is escaped by counting
 * the number of preceding backslashes. A character is escaped if there's
 * an odd number of backslashes immediately before it.
 * 
 * @param {string} input - The input string to check.
 * @param {number} position - The position of the character to check.
 * @returns {boolean} True if the character is escaped, false otherwise.
 */
function isEscaped( input: string, position: number ): boolean {
    let escapeCount = 0;
    let i = position - 1;

    while ( i >= 0 && input[i] === '\\' ) {
        escapeCount++;
        i--;
    }

    return escapeCount % 2 === 1;
}










/**
 * Pre-validates parentheses balance before highlighting to detect unmatched
 * parentheses. This helps provide better error highlighting for malformed
 * regex patterns.
 * 
 * @param {string} input - The input string to validate.
 * @returns {{ isValid: boolean; unmatchedPositions: number[] }} An object indicating whether parentheses are balanced and the positions of any unmatched parentheses.
 */
function validateParentheses( input: string ): {
    isValid: boolean;
    unmatchedPositions: number[];
} {
    const unmatchedPositions: number[] = [];
    const openParens: number[] = [];
    let i = 0;

    while ( i < input.length ) {
        const char = input[i];

        if ( char === '\\' && i + 1 < input.length ) {
            i += 2;
            continue;
        }

        if ( char === '(' && !isEscaped( input, i ) ) {
            openParens.push( i );
        } else if ( char === ')' && !isEscaped( input, i ) ) {
            if ( openParens.length === 0 ) {
                unmatchedPositions.push( i );
            } else {
                openParens.pop();
            }
        }

        i++;
    }

    unmatchedPositions.push( ...openParens );

    return {
        isValid: unmatchedPositions.length === 0,
        unmatchedPositions,
    };
}









/**
 * Validates brace balance for quantifiers to detect unmatched braces.
 * This helps highlight errors like unclosed quantifier ranges.
 * 
 * @param {string} input - The input string to validate.
 * @returns {number[]} An array of positions where unmatched braces occur.
 */
function validateBraces( input: string ): number[] {
    const unmatchedPositions: number[] = [];
    const openBraces: number[] = [];
    let i = 0;

    while ( i < input.length ) {
        const char = input[i];

        if ( char === '\\' && i + 1 < input.length ) {
            i += 2;
            continue;
        }

        if ( char === '{' && !isEscaped( input, i ) ) {
            openBraces.push( i );
        } else if ( char === '}' && !isEscaped( input, i ) ) {
            if ( openBraces.length === 0 ) {
                unmatchedPositions.push( i );
            } else {
                openBraces.pop();
            }
        }

        i++;
    }

    unmatchedPositions.push( ...openBraces );

    return unmatchedPositions;
}










/**
 * Translates custom shortcodes to their equivalent regex patterns.
 * This includes shortcodes for list names ({LN}), timer durations ({TS}),
 * character placeholders ({C}), and numbered string/number capture groups.
 * 
 * @param {string} value - The input string containing shortcodes.
 * @returns {string} The string with shortcodes replaced by regex patterns.
 */
function translateShortCodesToRegex( value: string ): string {
    if ( !value ) return '';

    value = value.replace( /{LN}/gi, '(?<nag_listname>[A-Z][a-z]+?)' );
    value = value.replace(
        // This regex pattern is the new one, from the fixed {TS} Oct -2025
        /{TS}/gi,
        '(?<timerDuration>(?:\\b[0-9]+:[0-9]+(?::[0-9]+)?\\b|\\b[0-9]+(?:\\.[0-9]+)?\\s*(?:(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)(?:[(]s[)]|s)?|[hms])(?=$|\\W)(?:\\s*[0-9]+(?:\\.[0-9]+)?\\s*(?:(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)(?:[(]s[)]|s)?|[hms])(?=$|\\W))*|\\b[0-9]+(?:\\.[0-9]+)?\\b))'
    );
    value = value.replace( /{C}/gi, '${Character}' );
    value = value.replace( /{S(\d*?)}/gi, ( _, n ) => `(?<S${n}>.+?)` );
    value = value.replace( /{N(\d*?)}/gi, ( _, n ) => `(?<N${n}>[0-9]+)` );

    return value;
}










/**
 * Finds the closing bracket (]) for a character class starting at the
 * specified position. Handles escaped brackets within the character class.
 * 
 * @param {string} input - The input string to search.
 * @param {number} start - The starting position of the opening bracket ([).
 * @returns {number} The position of the closing bracket, or -1 if not found.
 */
function findCharacterClassEnd( input: string, start: number ): number {
    let i = start + 1;
    while ( i < input.length ) {
        if ( input[i] === '\\' && i + 1 < input.length ) {
            i += 2;
        } else if ( input[i] === ']' ) {
            return i;
        } else {
            i++;
        }
    }
    return -1;
}










/**
 * Finds the closing brace (}) for a quantifier starting at the specified
 * position. Handles escaped braces within the quantifier range.
 * 
 * @param {string} input - The input string to search.
 * @param {number} start - The starting position of the opening brace ({).
 * @returns {number} The position of the closing brace, or -1 if not found.
 */
function findQuantifierEnd( input: string, start: number ): number {
    let i = start + 1;
    while ( i < input.length ) {
        if ( input[i] === '\\' && i + 1 < input.length ) {
            i += 2;
        } else if ( input[i] === '}' ) {
            return i;
        } else {
            i++;
        }
    }
    return -1;
}









/**
 * Finds the closing parenthesis ()) for a group starting at the specified
 * position. Properly handles nested groups and escaped parentheses.
 * 
 * @param {string} input - The input string to search.
 * @param {number} start - The starting position of the opening parenthesis (().
 * @returns {number} The position of the matching closing parenthesis, or -1 if not found.
 */
function findGroupEnd( input: string, start: number ): number {
    let openParens = 1;
    let i = start + 1;

    while ( i < input.length && openParens > 0 ) {
        if ( input[i] === '\\' && i + 1 < input.length ) {
            i += 2;
        } else if ( input[i] === '(' ) {
            openParens++;
            i++;
        } else if ( input[i] === ')' ) {
            openParens--;
            i++;
        } else {
            i++;
        }
    }
    return openParens === 0 ? i - 1 : -1;
}










/**
 * Validates whether a quantifier has valid syntax. Checks for patterns like
 * {n}, {n,}, {,m}, and {n,m}, and ensures that min <= max when both are present.
 * 
 * @param {string} content - The quantifier string including braces (e.g., "{3,5}").
 * @returns {boolean} True if the quantifier is valid, false otherwise.
 */
function isValidQuantifier( content: string ): boolean {
    const inner = content.slice( 1, -1 );
    if ( inner.length === 0 ) return false;
    if ( !/^[\d,]+$/.test( inner ) ) return false;

    if ( /^\d+$/.test( inner ) ) return true;
    if ( /^\d+,$/.test( inner ) ) return true;
    if ( /^,\d+$/.test( inner ) ) return true;
    if ( /^\d+,\d+$/.test( inner ) ) {
        const [ min, max ] = inner.split( ',' ).map( Number );
        return min <= max;
    }
    return false;
}









/**
 * Determines whether a quantifier can be applied at the specified position.
 * Quantifiers cannot appear at the start of a pattern or after certain
 * special characters like other quantifiers or anchors.
 * 
 * @param {string} input - The input string to check.
 * @param {number} position - The position where the quantifier appears.
 * @returns {boolean} True if the quantifier can be applied, false otherwise.
 */
function canQuantify( input: string, position: number ): boolean {
    if ( position === 0 ) return false;

    let i = position - 1;

    // Skip spaces but don't count them as non-quantifiable
    while ( i >= 0 && input[i] === ' ' ) i--;
    if ( i < 0 ) return false;

    const prevChar = input[i];

    // Non-quantifiable characters at start of regex or after these specific chars
    const nonQuantifiableChars = '*+?^|([{';

    // Check for quantifiable elements
    // Letters, digits, ), ], }, ., escaped chars, and special chars like $ are quantifiable
    // Only these specific chars are non-quantifiable at the start: * + ? ^ | ( [ {
    if ( '*+?^|([{'.includes( prevChar ) && prevChar !== '§' ) {
        return false;
    }

    return true;
}









/**
 * Checks if a question mark at the specified position is a lazy modifier
 * (making a quantifier non-greedy). Lazy modifiers follow quantifiers
 * like *, +, ?, or {n,m}.
 * 
 * @param {string} input - The input string to check.
 * @param {number} position - The position of the question mark.
 * @returns {boolean} True if the question mark is a lazy modifier, false otherwise.
 */
function isLazyModifier( input: string, position: number ): boolean {
    if ( position === 0 ) return false;

    let i = position - 1;
    while ( i >= 0 && input[i] === ' ' ) i--;
    if ( i < 0 ) return false;

    const prevChar = input[i];

    if ( '*+?'.includes( prevChar ) ) return true;

    if ( prevChar === '}' ) {
        let j = i - 1;
        while ( j >= 0 && input[j] !== '{' ) j--;
        if ( j >= 0 ) {
            const content = input.substring( j, i + 1 );
            return isValidQuantifier( content );
        }
    }

    return false;
}










/**
 * Checks if a question mark at the specified position is part of a group
 * syntax modifier (like ?: or ?=). This occurs when the question mark
 * immediately follows an opening parenthesis.
 * 
 * @param {string} input - The input string to check.
 * @param {number} position - The position of the question mark.
 * @returns {boolean} True if the question mark is part of group syntax, false otherwise.
 */
function isGroupSyntax( input: string, position: number ): boolean {
    return position > 0 && input[position - 1] === '(';
}










/**
 * Enhanced highlighting function with grouped literals and better word breaking.
 * This is the main syntax highlighting engine that processes the input string
 * character by character and generates HTML with appropriate CSS classes.
 * 
 * @param {string} input - The regex pattern string to highlight.
 * @returns {string} HTML string with syntax highlighting applied.
 */
export function highlightRegexSyntax( input: string ): string {
    if ( !input ) return '';

    const { isValid, unmatchedPositions } = validateParentheses( input );
    const unmatchedSet = new Set( unmatchedPositions );
    const unmatchedBraces = new Set( validateBraces( input ) );

    const builder = new HtmlBuilder();
    let i = 0;

    while ( i < input.length ) {
        const char = input[i];
        const nextChar = i + 1 < input.length ? input[i + 1] : undefined;

        // Handle escape sequences
        if ( char === '\\' ) {
            if ( i + 1 < input.length ) {
                const nextChar = input[i + 1];
                const seq = input.slice( i, i + 2 );
                const className = 'dDwWsS'.includes( nextChar )
                    ? 'regex-shorthand'
                    : 'regex-escape';
                builder.addSpan( seq, className );
                i += 2;
            } else {
                builder.addSpan( char, 'regex-error' );
                i++;
            }
            continue;
        }

        // Handle complex groups with improved non-capture group styling
        if ( char === '(' && i + 1 < input.length && input[i + 1] === '?' ) {
            if ( unmatchedSet.has( i ) ) {
                builder.addSpan( char, 'regex-error' );
                i++;
                continue;
            }

            const groupEnd = findGroupEnd( input, i );
            if ( groupEnd === -1 ) {
                builder.addSpan( char, 'regex-error' );
                i++;
                continue;
            }

            const isNamedGroup = input.slice( i, i + 3 ) === '(?<';
            const isNonCapturing = input.slice( i, i + 3 ) === '(?:';
            const isLookaround = [ '(?=', '(?!', '(?<=', '(?<!' ].some( ( prefix ) =>
                input.slice( i ).startsWith( prefix )
            );

            if ( shouldAddWordBreak( char, nextChar ) ) {
                builder.addWordBreak();
            }

            if ( isNamedGroup ) {
                const nameEnd = input.indexOf( '>', i + 3 );
                if ( nameEnd !== -1 && nameEnd < groupEnd ) {
                    const groupName = input.substring( i + 3, nameEnd );
                    builder.addRaw( '<span class="regex-named-group">' );
                    builder.addRaw(
                        '<span class="regex-named-group-start">(?&lt;</span>'
                    );
                    builder.addRaw(
                        `<span class="regex-named-group-name">${escapeHtml(
                            groupName
                        )}</span>`
                    );
                    builder.addRaw(
                        '<span class="regex-named-group-end">&gt;</span>'
                    );
                    builder.addRaw(
                        highlightRegexSyntax(
                            input.substring( nameEnd + 1, groupEnd )
                        )
                    );
                    builder.addRaw(
                        '<span class="regex-named-group-end">)</span></span>'
                    );
                    i = groupEnd + 1;
                    continue;
                }
            } else if ( isNonCapturing ) {
                // Improved styling for non-capturing groups
                builder.addRaw( '<span class="regex-non-capture-group">' );
                builder.addRaw( '<span class="regex-group-modifier">(?:</span>' );
                builder.addRaw(
                    highlightRegexSyntax( input.substring( i + 3, groupEnd ) )
                );
                builder.addRaw(
                    '<span class="regex-group-modifier">)</span></span>'
                );
                i = groupEnd + 1;
                continue;
            } else if ( isLookaround ) {
                let prefixLen = 3;
                if (
                    input.slice( i, i + 4 ) === '(?<=' ||
                    input.slice( i, i + 4 ) === '(?<!'
                ) {
                    prefixLen = 4;
                }

                builder.addRaw( '<span class="regex-lookaround-group">' );
                builder.addRaw(
                    `<span class="regex-group-modifier">${escapeHtml(
                        input.slice( i, i + prefixLen )
                    )}</span>`
                );
                builder.addRaw(
                    highlightRegexSyntax(
                        input.substring( i + prefixLen, groupEnd )
                    )
                );
                builder.addRaw(
                    '<span class="regex-group-modifier">)</span></span>'
                );
                i = groupEnd + 1;
                continue;
            }
        }

        // Simple groups - wrapping the entire group
        if ( char === '(' || char === ')' ) {
            if ( shouldAddWordBreak( char, nextChar ) ) {
                builder.addWordBreak();
            }

            if ( unmatchedSet.has( i ) ) {
                builder.addSpan( char, 'regex-error' );
            } else if ( char === '(' ) {
                // Find the matching closing parenthesis
                const groupEnd = findGroupEnd( input, i );
                if ( groupEnd !== -1 ) {
                    // Wrap the entire group
                    builder.addRaw( '<span class="regex-group">' );
                    builder.addRaw( '<span class="regex-group-start">(</span>' );
                    builder.addRaw(
                        highlightRegexSyntax( input.substring( i + 1, groupEnd ) )
                    );
                    builder.addRaw(
                        '<span class="regex-group-end">)</span></span>'
                    );
                    i = groupEnd + 1;
                    continue;
                } else {
                    // Unmatched opening parenthesis
                    builder.addSpan( char, 'regex-error' );
                }
            } else {
                // This closing parenthesis should have been handled by the opening one
                // If we reach here, it's an unmatched closing parenthesis
                builder.addSpan( char, 'regex-error' );
            }
            i++;
            continue;
        }

        // Character classes
        if ( char === '[' ) {
            const endIndex = findCharacterClassEnd( input, i );
            if ( endIndex === -1 ) {
                builder.addSpan( char, 'regex-error' );
                i++;
                continue;
            }

            if ( shouldAddWordBreak( char, nextChar ) ) {
                builder.addWordBreak();
            }

            // Add wrapper for entire character class
            builder.addRaw( '<span class="regex-class">' );
            builder.addSpan( '[', 'regex-class-bracket' );

            const classContent = input.substring( i + 1, endIndex );
            let k = 0;
            while ( k < classContent.length ) {
                const contentChar = classContent[k];

                if ( contentChar === '\\' && k + 1 < classContent.length ) {
                    const seq = classContent.slice( k, k + 2 );
                    const className = 'dDwWsS'.includes( classContent[k + 1] )
                        ? 'regex-shorthand'
                        : 'regex-escape';
                    builder.addSpan( seq, className );
                    k += 2;
                } else if (
                    ( contentChar === '^' && k === 0 ) ||
                    ( contentChar === '-' &&
                        k > 0 &&
                        k < classContent.length - 1 )
                ) {
                    builder.addSpan( contentChar, 'regex-class-special' );
                    k++;
                } else {
                    builder.addSpan( contentChar, 'regex-class-content' );
                    k++;
                }
            }

            builder.addSpan(
                ']',
                'regex-class-bracket',
                shouldAddWordBreak( ']', input[endIndex + 1] )
            );
            builder.addRaw( '</span>' ); // Close regex-class wrapper
            i = endIndex + 1;
            continue;
        }

        // Question mark handling
        if ( char === '?' ) {
            if ( isGroupSyntax( input, i ) ) {
                builder.addLiteral( char );
            } else if ( isLazyModifier( input, i ) ) {
                builder.addSpan( char, 'regex-quantifier' );
            } else if ( canQuantify( input, i ) ) {
                builder.addSpan(
                    char,
                    'regex-quantifier',
                    shouldAddWordBreak( char, nextChar )
                );
            } else {
                builder.addSpan( char, 'regex-error' );
            }
            i++;
            continue;
        }

        // Simple quantifiers
        if ( '*+'.includes( char ) ) {
            if ( canQuantify( input, i ) ) {
                builder.addSpan(
                    char,
                    'regex-quantifier',
                    shouldAddWordBreak( char, nextChar )
                );
            } else {
                builder.addSpan( char, 'regex-error' );
            }
            i++;
            continue;
        }

        // Quantifier ranges - with improved error handling for unclosed braces
        if ( char === '{' ) {
            const endIndex = findQuantifierEnd( input, i );

            // Check if this brace is unmatched (no closing brace)
            if ( endIndex === -1 || unmatchedBraces.has( i ) ) {
                builder.addSpan( char, 'regex-error' );
                i++;
                continue;
            }

            const content = input.substring( i, endIndex + 1 );
            if ( !canQuantify( input, i ) ) {
                builder.addSpan( content, 'regex-error' );
            } else if ( isValidQuantifier( content ) ) {
                builder.addSpan(
                    content,
                    'regex-quantifier',
                    shouldAddWordBreak( '}', input[endIndex + 1] )
                );
            } else {
                builder.addSpan( content, 'regex-error' );
            }
            i = endIndex + 1;
            continue;
        }

        // Handle unmatched closing braces
        if ( char === '}' && unmatchedBraces.has( i ) ) {
            builder.addSpan( char, 'regex-error' );
            i++;
            continue;
        }

        // Anchors, alternation, special characters
        if ( char === '^' || char === '$' ) {
            builder.addSpan( char, 'regex-anchor' );
            i++;
            continue;
        }

        if ( char === '|' ) {
            if ( shouldAddWordBreak( char, nextChar ) ) {
                builder.addWordBreak();
            }
            builder.addSpan( char, 'regex-alternation', true );
            i++;
            continue;
        }

        if ( char === '.' ) {
            builder.addSpan( char, 'regex-special-char' );
            i++;
            continue;
        }

        // Literal characters (grouped together)
        if ( char === ' ' ) {
            builder.addLiteralWithHtml( '·', '<wbr>' ); // Visible space with word break inside the span
        } else {
            builder.addLiteral( char );
        }
        i++;
    }

    return builder.toString();
}










/**
 * Main export function that processes a phrase with optional regex highlighting.
 * This function orchestrates the entire highlighting pipeline: extracting
 * protected patterns, translating shortcodes, highlighting syntax, and
 * restoring protected content.
 *
 * @param {string} phrase - The regex pattern or plain text phrase to process.
 * @param {boolean} useRegEx - Whether to apply regex syntax highlighting or just escape HTML.
 * @returns {string} HTML string with syntax highlighting applied (if useRegEx is true) or escaped HTML (if false).
 */
export function getRegexHighlightedHtml(
    phrase: string,
    useRegEx: boolean
): string {
    if ( !phrase ) return '';
    if ( !useRegEx ) return escapeHtml( phrase );

    // The highlighter marks its own HTML and placeholders with '§' (§HTML§,
    // §VAR0§, §ADVN0§). Phrases can come from shared triggers, so a '§' in
    // the phrase must never be read as a marker: swap it for a private-use
    // character first and turn it back into a plain '§' at the end.
    const sectionSign = '';
    phrase = phrase.replace( /§/g, sectionSign );

    // Step 1: Extract and protect advanced {N} patterns
    const { processedInput: inputAfterAdvancedN, advancedN } =
        extractAdvancedN( phrase );

    // Step 2: Translate custom shortcodes to regex
    const processedPhrase = translateShortCodesToRegex( inputAfterAdvancedN );

    // Step 3: Extract variables and replace with placeholders
    const { processedInput, variables } = extractVariables( processedPhrase );

    // Step 4: Run the highlighting
    const highlighted = highlightRegexSyntax( processedInput );

    // Step 5: Restore protected content
    return restoreProtected( highlighted, variables, advancedN ).replace( //g, '§' );
}
