---
title: Advanced Trigger Mechanics
parent: "Triggers & Regex"
grand_parent: Documentation
nav_exclude: true
hide_meta: true
---

{% assign conditions_page = site.pages | where: "path", "triggers/conditions.md" | first %}
{% if conditions_page %}{% assign conditions_url = conditions_page.url | relative_url %}{% else %}{% assign conditions_url = '/triggers/' | relative_url %}{% endif %}
{% assign phrases_page = site.pages | where: "path", "triggers/capture-phrases.md" | first %}
{% if phrases_page %}{% assign phrases_url = phrases_page.url | relative_url %}{% else %}{% assign phrases_url = '/triggers/' | relative_url %}{% endif %}
{% assign snippets_page = site.pages | where: "path", "triggers/snippets.md" | first %}
{% if snippets_page %}{% assign snippets_url = snippets_page.url | relative_url %}{% else %}{% assign snippets_url = '/triggers/' | relative_url %}{% endif %}

# Advanced Trigger Mechanics

This page has been split into smaller pages, one for each topic. Pick the topic you were looking for. If you followed an old link to a part of this page, you should be taken to the right place automatically.

## Conditions

- Variable conditions, the four operators and condition values: [Conditions and variables]({{ conditions_url }})
- Character classes: [Conditions and variables]({{ conditions_url }}), and see [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }}) if a class limit is stopping a trigger
- Variable storage mechanics and Clear Variable's three rules: [Conditions and variables]({{ conditions_url }})

## Capture Phrases

- Capture method, cooldown and the phrases grid: [Capture phrases]({{ phrases_url }})
- Plain text, regular expressions and the Regex Visualizer: [Capture phrases]({{ phrases_url }})

## Actions

All sixteen action types, with every property: [Actions reference]({{ '/triggers/actions' | relative_url }})

- [Display Text]({{ '/triggers/actions#display-text' | relative_url }})
- [Speak]({{ '/triggers/actions#speak' | relative_url }})
- [Play Audio]({{ '/triggers/actions#play-audio' | relative_url }})
- [Clipboard]({{ '/triggers/actions#clipboard' | relative_url }})
- [Counter]({{ '/triggers/actions#counter' | relative_url }})
- [Store Variable]({{ '/triggers/actions#store-variable' | relative_url }}) and [Clear Variable]({{ '/triggers/actions#clear-variable' | relative_url }})
- [Timer, Countdown, DoT Timer and Beneficial Timer]({{ '/triggers/timers' | relative_url }}), including Timer Ending, Timer Ended and End Early

## Advanced Ramblings

- Capture and render snippets such as `{S1}`, `{N1}`, `{TS}`, `{C}` and `+{Counter}`: [Snippets]({{ snippets_url }})
- Variable storage mechanics: [Conditions and variables]({{ conditions_url }})

## More

- [Trigger cookbook]({{ '/triggers/cookbook' | relative_url }}): worked examples
- [Trigger hotkeys]({{ '/triggers/hotkeys' | relative_url }})
- [Why didn't my trigger fire?]({{ '/triggers/why-didnt-it-fire' | relative_url }})

<script>
  ( function () {
    var pages = {
      conditions: '{{ conditions_url }}',
      phrases: '{{ phrases_url }}',
      snippets: '{{ snippets_url }}',
      actions: '{{ '/triggers/actions' | relative_url }}',
      timers: '{{ '/triggers/timers' | relative_url }}'
    };
    var rules = [
      [ /^clear-variable-action$/, pages.actions + '#clear-variable' ],
      [ /^(conditions|variable-conditions|a-note-on-condition-values|character-classes|variable-storage-mechanics|clear-variable-.*)$/, pages.conditions ],
      [ /^(capture-phrases|capture-phrases-grid|capture-method|capture-cooldown)$/, pages.phrases ],
      [ /^(advanced-ramblings|capture-and-render-snippets|capture-phrase-snippets|literal-snippets)$/, pages.snippets ],
      [ /^(dot-timer|beneficial-timer|timer|countdown)-.*end-early$/, pages.timers + '#end-early' ],
      [ /^dot-timer-exclude-targets$/, pages.timers + '#exclude-targets' ],
      [ /^(dot-timer|beneficial-timer|timer|countdown)-.*ended/, pages.timers + '#timer-ended' ],
      [ /^(dot-timer|beneficial-timer|timer|countdown)-.*ending/, pages.timers + '#timer-ending' ],
      [ /^dot-timer/, pages.timers + '#dot-timer' ],
      [ /^beneficial-timer/, pages.timers + '#beneficial-timer' ],
      [ /^(timer|countdown)/, pages.timers + '#the-timer-tab' ],
      [ /^display-text-action/, pages.actions + '#display-text' ],
      [ /^play-audio/, pages.actions + '#play-audio' ],
      [ /^speak-action/, pages.actions + '#speak' ],
      [ /^store-variable-action/, pages.actions + '#store-variable' ],
      [ /^counter-action/, pages.actions + '#counter' ],
      [ /^clipboard-action/, pages.actions + '#clipboard' ],
      [ /^(action-types|actions)$/, pages.actions ]
    ];
    var id = '';
    try {
      id = decodeURIComponent( window.location.hash.replace( /^#/, '' ) );
    } catch ( error ) {
      return;
    }
    if ( !id || document.getElementById( id ) ) {
      return;
    }
    for ( var i = 0; i < rules.length; i++ ) {
      if ( rules[ i ][ 0 ].test( id ) ) {
        window.location.replace( rules[ i ][ 1 ] );
        return;
      }
    }
  } )();
</script>
