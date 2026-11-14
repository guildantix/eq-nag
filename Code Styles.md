# Code Styles

Nag is open source now, and anyone may read, fix or extend its code. We're
striving to always create **easily understood code**: code that someone new
to the project, or even someone who doesn't write code, can read and get a
good idea of what it does. Think "Fisher Price code": big, obvious pieces that
fit together in an obvious way.

That's not always possible. Some things, like regular expressions or timing
math, are complicated by nature. That's what comments are for: to explain the
parts the code itself can't make obvious.

"Fisher Price code" is a guide, not a law. We're still writing for other
developers, and sometimes the plainest-looking version is actually harder to
follow (for example, a long `if` / `else` block where one short expression
says it better). When a rule here makes the code harder to understand, choose
the clearer code, and be ready to explain why in the review.

Pull requests are reviewed against this guide. Existing code doesn't always
follow it yet; when you change a piece of old code, bring the lines you touch
up to this style, but you don't need to reformat whole files.

Most of these rules are checked automatically. Run `npm run lint` before you
open a pull request: it checks the lines you changed (ESLint with
`eslint.config.js`, plus the empty-lines rule), and every pull request gets
the same check, with any problems shown on its "Files changed" tab. The
check can't judge whether a name is clear or a comment explains *why*; the
reviewer does. Where the tools and this guide disagree, this guide wins.

---

## Readability first

### Use long, descriptive names

Names should say what something is, not how it's stored. Don't abbreviate.

```js
// Good
const characterName = getCharacterName( logFile );
const secondsRemaining = timer.duration - timer.elapsed;

// Avoid
const cn = getCharName( lf );
const rem = t.d - t.e;
```

- Variables and properties are **nouns**: `overlayWindow`, `triggerFolders`.
- Functions and methods start with a **verb**: `loadTriggers()`,
  `sendDisplayTextToOverlay()`.
- True/false values read like a **question**: `isEnabled`, `hasCooldown`,
  `shouldRestartTimer`.
- Loop counters (`i`, `j`) are fine for short, simple loops. Anything longer
  gets a real name.

### Write code that reads like a sentence

If someone could read a line out loud and understand it, it's good.

```js
if ( trigger.isEnabled && !trigger.isOnCooldown ) {
    executeTriggerActions( trigger, logEntry );
}
```

### Prefer `if` over `switch`

Use a `switch` only when you need its fall-through behavior (several cases
sharing one block). Otherwise, write an `if` / `else if` chain.

```js
// Good
if ( action.actionType === ActionTypes.DisplayText ) {
    displayTextComponent( action );
} else if ( action.actionType === ActionTypes.Timer ) {
    displayTimerComponent( action );
}
```

### Use `if` to run code, not `&&` or `||`

Don't use `&&` or `||` as a shortcut for an `if` statement.

```js
// Good
if ( enableLogging ) {
    sendInformationToLog( message );
}

// Avoid
enableLogging && sendInformationToLog( message );
```

(`&&`, `||` and `??` are fine inside conditions and for picking a value:
`const name = model.name ?? 'Unknown';`)

### Ternaries

A ternary (`condition ? a : b`) is a good choice for picking a value, and
often clearer than an `if` / `else` that does nothing but set one variable.
Use one when it reads like a simple sentence.

```js
const label = isRaid ? 'Raid' : 'Group';
```

If you need to nest them, put each condition on its own line, so it reads like
a short paragraph instead of one long sentence. Use `if` / `else if` when the
branches do more than pick a value, or when the paragraph stops being easy to
follow.

```js
const endingSoonSeconds =
    duration <= 120 ? 12 :
    duration <= 600 ? 60 :
    duration < 900  ? 120 :
                      600;
```

### Return early instead of nesting

Handle the "nothing to do" cases first and return, so the main work isn't
buried several levels deep.

```js
function playAudioFile( fileId ) {
    if ( !fileId ) {
        return;
    }

    const url = getAudioFileUrl( fileId );
    // ...
}
```

---

## Comments

### Everything gets a summary

Every class, function, method and exported value has a `/** ... */` summary
that says what it's for. Describe the parameters and the return value, too.

```js
/**
 * Plays the specified audio file.
 * 
 * @param {string} fileId The id of the file to play.
 * @param {number} volume The volume, from 0 to 100.
 */
function playAudioFile( fileId, volume ) {
```

In TypeScript the types are already in the code, so the `@param` lines only
need a description.

### Comments explain *why*, not *what*

The code says what it does. A comment should explain why it does it, or what
isn't obvious from reading it.

```js
// Good: explains why
// EverQuest adds "~ " before the name on /emote messages since the
// October 2026 patch; emulator servers don't, so it's optional.
const clearAllPhrase = '^(?:~ )?{C} clears their mind\\.$';

// Avoid: repeats the code
// Set the phrase to the clear all phrase.
const clearAllPhrase = '^(?:~ )?{C} clears their mind\\.$';
```

Complicated code, like a regular expression or a timing calculation, gets a
comment that explains how it works. For regular expressions, include an
example log line it matches.

### Don't leave old code behind

Delete code instead of commenting it out; git keeps the history. A `TODO`
must say what's missing and why it isn't done yet.

---

## Formatting

### Spacing between members

Put **10 empty lines** between methods, functions and classes, counting from
the end of one to the summary of the next. It makes each one easy to find
when scrolling.

### Order of class members

Classes are laid out the same way everywhere, so the code reads as if one
developer wrote it:

1. Properties and fields, including `@Input`, `@Output` and `@ViewChild`.
2. The constructor. Every Angular component has one, even if it's empty.
3. Angular's lifecycle handlers (`ngOnInit`, `ngOnChanges`, `ngOnDestroy`,
   etc.), right below the constructor with one empty line between each and
   no summary. Keep each one under 10 lines; move anything longer into a
   method with a name that says what it does.
4. Methods, each with a summary and 10 empty lines before it.

```ts
/**
 * A right-click menu that opens at the mouse.
 */
export class ContextMenuComponent implements OnInit, OnDestroy {

    @Input() public menu: ContextMenuModel[];
    @ViewChild( 'mainBackground' ) mainBackground: ElementRef<HTMLElement>;

    public isOpen: boolean = false;

    constructor( private contextService: ContextService ) { }

    ngOnInit() {
        this.contextService.register( this );
    }

    ngOnDestroy() {
        this.close();
    }










    /**
     * Closes the context menu and cleans up its subscriptions.
     */
    public close(): void {
```

### Indentation and whitespace

- Indent with **4 spaces**, never tabs.
- No spaces at the end of a line, and every file ends with a newline.
- Files are UTF-8, with Windows line endings (CRLF). `.gitattributes` makes
  git check them out that way, so you don't need to set anything up.

### Spaces inside parentheses and brackets

Put a space inside parentheses and square brackets that have something in
them, and inside object braces. Leave empty ones closed.

```js
if ( timer.isRunning ) {
    updateTimer( timers[ 0 ], { duration: 30 } );
}

const names = [];
refresh();
```

No space between a function name and its parentheses:
`function loadTriggers( folderId )`, `loadTriggers( folderId )`. A function
without a name gets a space after `function`: `function ( event, data ) {`.

### Braces

Always use braces on `if`, `else`, `for` and `while`, even for one line. The
opening brace goes on the same line.

```js
// Good
if ( !overlay ) {
    return;
}

// Avoid
if ( !overlay ) return;
```

### Line length

Keep lines under **140 characters**. Break long conditions, calls and objects
across several lines. Long regular expressions, URLs and text that can't
sensibly be split are the exception.

```js
if ( trigger.captureMethod === 'Sequential'
    && trigger.capturePhrases.length > 1
    && !trigger.isOnCooldown ) {
```

Comments wrap at **100 characters**, counting the indent. Wrapped lines line
up with the start of the text above them, so each paragraph reads as a block.
For `@param`, `@property` and similar tags, that's where the description
starts, after the parameter's name (and its type, in JavaScript):

```ts
/**
 * Executes the action associated with the given menu item. If the menu item has children, it
 * will keep the context menu open and position the submenu accordingly.
 *
 * @param menuItem The menu item whose action is to be executed.
 * @param subMenu The HTML element representing the submenu, if applicable. This is used for
 *                positioning the submenu when the menu item has children.
 */
```

The exception is an exceptionally long name or type, where lining up would
leave only a narrow column for the text. Then indent the wrapped lines
**8 spaces** (two indents) from the start of the tag instead:

```ts
/**
 * @param thisIsAVeryLongAndDescriptiveNameForReasons Here's the comment that would explain what
 *         this does and why the long name is the best fit.
 */
```

---

## Language rules

### Variables

- Use `const` unless the variable is reassigned later; then use `let`.
- Never use `var`.

### Strings

- Use **single quotes** in JavaScript and TypeScript: `'Raid'`.
- Use template literals when inserting values: `` `${characterName} died.` ``
- Double quotes only inside HTML and JSON.

### Statements

- End every statement with a semicolon.
- Use `===` and `!==`, not `==` and `!=`.

### Naming

- `camelCase` for variables, functions, methods and properties.
- `PascalCase` for classes, types, interfaces and enums.
- `kebab-case` for file names: `trigger-database.js`,
  `new-trigger-dialog.component.ts`.
- Angular components end in `Component` and use the `app-` selector prefix.

### Logging

Don't use `console.log`, `console.debug` or similar in committed code. Use
Nag's logging (`electron-log` in the main process, the log functions in each
window) so messages end up in the log file testers can send.

---

## Project rules

These aren't about style, but every change must follow them.

- **Never read EverQuest's memory.** Nag only reads the log files and the
  game's files on disk.
- **Sanitize HTML.** Trigger text, package text and log text can come from
  other players. Never put them into `innerHTML` or `bypassSecurityTrustHtml`
  without `sanitizeHtml()` (`src/electron/utilities/html.js`,
  `src/app/utilities/html.utilities.ts`).
- **Keep built-in trigger phrases cheap.** Built-in triggers are checked
  against every log line. Start phrases with `^` and a literal word, prefer
  bounded patterns like `[^!]*` over `.*`, and use non-capturing groups
  `(?:...)` unless you need the value.
- **Measure changes to anything that runs per log line** with the
  performance test (`tools/perf/README.md`).
